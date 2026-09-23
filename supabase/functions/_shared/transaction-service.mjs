import {execute,gasHash,validateRequest} from './rc-service.mjs';
import {invariant,digest,sealBackup,openBackup} from './rc-data.mjs';

const staffRoles=new Set(['teacher','owner','teacherTest']);
// These staff operations only read shared/student data and write their own
// session, receipt, audit or backup rows. Configuration changes remain exclusive.
const sharedStaffActions=new Set(['teacher.login','teacher.overview','teacher.student.cards','teacher.records.read','teacher.records.student','teacher.records.settings','teacher.records.csv','teacher.scope.read','teacher.backup.create','teacher.backup.restoreCopy','teacher.test.check','portal.read','access.check','rankings.read','session.logout']);
const deny=code=>({ok:false,code,message:({AUTH_REQUIRED:'먼저 로그인하세요.',SESSION_EXPIRED:'다시 로그인해 주세요.',FORBIDDEN:'이 기능을 사용할 권한이 없습니다.',BUSY:'잠시 후 같은 요청으로 다시 시도합니다.'})[code]||'서버에서 요청을 확인하지 못했습니다.'});
const brief=result=>{
 const copy=structuredClone(result);
 if(copy?.student)copy.student={};
 return copy;
};
export function assertOwnedChanges(changes,actor,sessionId,limitIds){
 const sessionIds=new Set([sessionId,...changes.filter(x=>x.table==='sessions'&&x.row.userId===actor).map(x=>x.row.id)]);
 for(const {table,row} of changes){
  const owned=row.studentId===actor||row.userId===actor||row.actorId===actor;
  const safe=owned||table==='students'&&row.id===actor||table==='system'&&row.value?.studentId===actor||table==='sessionScopes3'&&sessionIds.has(row.id)||table==='limits'&&limitIds.includes(row.id)||table==='securityEvents';
  invariant(safe,'PARTITION_VIOLATION');
 }
}

// Driver owns one real PostgreSQL transaction for load, domain execution (including
// random draws), all inventory changes, completion claims and request receipts.
export function makeTransactionalService({database,pepper,backupKey,now=()=>Date.now()}){
 const hash=gasHash(pepper);
 return async request=>{
  try{
   validateRequest(request);
   // Reject unauthenticated malformed traffic before opening a DB connection.
   const ticket=request.ticket;
   invariant(ticket&&ticket.expiresAt>=now()&&ticket.expiresAt<=now()+121000&&typeof ticket.nonce==='string'&&ticket.nonce.length<=300&&ticket.signature===hash('ticket:'+ticket.expiresAt+':'+ticket.nonce),'REQUEST_EXPIRED');
   invariant(typeof request.requestId==='string'&&/^[\w-]{12,100}$/.test(request.requestId),'INVALID_REQUEST');
   for(let retry=0;retry<3;retry++){
    try{return await database.transaction(async tx=>{
     const p=request.payload||{},login=request.action==='student.login'||request.action==='teacher.login',recovery=request.action==='owner.recover';
     let actor,sessionId='',isStaff=false;
     if(login||recovery){
      if(login)invariant(typeof p.code==='string'&&p.code.length<=150,'INVALID_INPUT');
      if(request.action==='student.login'){
       const legacy=await tx.legacySchool();
       const school=p.schoolId||legacy;
       invariant(typeof school==='string'&&school.length<=64,'INVALID_INPUT');
       for(const [k,min,max] of [['schoolYear',2020,2200],['grade',1,6],['classNo',1,99],['number',1,99]])invariant(Number.isInteger(p[k])&&p[k]>=min&&p[k]<=max,'INVALID_INPUT');
       actor=(school===legacy?'':school+':')+`${p.schoolYear}-${p.grade}-${p.classNo}-${p.number}`;
      }else{invariant(typeof p.loginId==='string'&&p.loginId.length<=100,'INVALID_INPUT');actor=p.loginId.trim().toLowerCase();isStaff=true;}
     }else{
      invariant(typeof request.token==='string'&&request.token.length<300,'AUTH_REQUIRED');
      const session=await tx.session(hash(request.token));
      invariant(session&&!session.revokedAt&&Date.parse(session.expiresAt)>now(),'SESSION_EXPIRED');
      actor=session.role==='teacherTest'?'TEST:'+session.userId:session.userId;
      sessionId=session.id;isStaff=staffRoles.has(session.role);
      // Reject privileged actions before fetching any staff data.
      invariant(isStaff||!request.action.startsWith('teacher.')&&!request.action.startsWith('owner.'),'FORBIDDEN');
     }
     // Shared configuration lock is compatible across all students. Only staff
     // operations use exclusive mode; no classroom-wide student write lock.
     await tx.lock(actor,isStaff&&!sharedStaffActions.has(request.action));
     const limitIds=[sessionId,sessionId+':openings28','reports27:'+actor,'board27:'+actor,'csv27:'+actor,'test-ready:'+actor,'login:'+(isStaff?'teacher':'student')+':'+actor,...(recovery?['owner-recovery-global','owner-recovery:'+actor]:[])].map(key=>hash('rate:'+key));
     const tables=await tx.load(actor,sessionId,request.requestId,request.action,isStaff,limitIds,p);
     const fp=digest({action:request.action,payload:p});
     if(login){
      // The ticket was checked before the transaction. Replay is encrypted at rest.
      const prior=await tx.loginReceipt(actor,request.requestId);
      if(prior){invariant(prior.body_hash===fp,'REQUEST_CONFLICT');return {...openBackup(prior.envelope,backupKey).response,replayed:true};}
     }
     const backupEnvelope=request.action==='teacher.backup.restoreCopy'?await tx.readBackup(String(p.backupId||'')):undefined;
     const out=execute({tables},request,{pepper,backupKey,now,backupEnvelope,minimalLogin:true,partitionRates:true});
     if(!isStaff)assertOwnedChanges(out.changes,actor,sessionId,limitIds);
     for(const change of out.changes)if(change.table==='receipts')change.row.result=brief(change.row.result);
     await tx.write(out.changes,out.backups,out.copies);
     if(login&&out.result.ok)await tx.saveLoginReceipt(actor,request.requestId,fp,sealBackup({response:out.result},backupKey));
     return out.result;
    });}catch(error){
     if(['40001','40P01','55P03'].includes(error.code)&&retry<2)continue;
     throw error;
    }
   }
  }catch(error){
   // Never log request bodies, SQL parameters, tokens or credentials.
   if(!['REQUEST_EXPIRED','INVALID_REQUEST','INVALID_INPUT','AUTH_REQUIRED','SESSION_EXPIRED','FORBIDDEN','REQUEST_CONFLICT'].includes(error.code))console.error(JSON.stringify({event:'normal-rc-error',code:String(error.code||'SERVER_ERROR').slice(0,60),action:request?.action}));
   return deny(['40001','40P01','55P03','57014','CONNECTION_CLOSED','CONNECT_TIMEOUT'].includes(error.code)?'BUSY':error.code||'SERVER_ERROR');
  }
 };
}
