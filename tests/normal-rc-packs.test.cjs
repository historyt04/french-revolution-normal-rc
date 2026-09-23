const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {CompletionQueue}=require('../normal-rc-outbox.js');
const rows=new Map(),receipts=new Map();let failSave=false,lose=true,effects=0;
class Store{
 async get(id){return structuredClone(rows.get(id))}
 async list(owner){return [...rows.values()].filter(x=>x.owner===owner).map(x=>structuredClone(x))}
 async put(row){if(failSave){failSave=false;throw Error('storage full')}const old=rows.get(row.id);if(old?.status==='confirmed')return old;rows.set(row.id,structuredClone(row));return row}
}
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))};
let serial=0;
function page(who='A'){
 const messages=[],attached=[];
 const context={console,setTimeout:()=>1,clearTimeout:()=>{},addEventListener:()=>{},HISTORY_API_CONFIG:{rcUrl:'test',rcStorageScope:'test'},HistoryNormalOutbox:{CompletionQueue,IndexedCompletionStore:Store},state42:{profile:{id:who}},openPlan42:{packId:'basic',total:1},opening28:null,busy42:false,packAutoV38:false,
  api42:{session:{role:'student',user:{id:who}},newRequestId:()=>String(++serial),request:async(action,payload,opts)=>{assert.equal(action,'cards.openPack');if(receipts.has(opts.requestId))return receipts.get(opts.requestId);effects++;const result={student:{profile:{id:who}},opening:{id:'opening-'+serial}};receipts.set(opts.requestId,result);if(lose){lose=false;throw Error('lost response')}return result}},
  beginOpening28:()=>{},packVaultV38:()=>'',applyState42(s){context.state42=s},attachOpening28(row){context.opening28=row;context.openPlan42=null;attached.push(row.id)},render42:()=>{},toast42:m=>messages.push(m)};
 context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../normal-rc-packs.js',`file://${__filename}`),'utf8'),context);return {context,messages,attached};
}
(async()=>{
 const a=page();await settle();failSave=true;await a.context.beginOpening28();await settle();assert.equal(effects,0,'cannot spend without local persistence');
 await Promise.all([a.context.beginOpening28(),a.context.beginOpening28()]);await settle();assert.equal(effects,1,'double click makes one request');assert.equal(a.attached.length,0);
 const b=page('B');await settle();assert.equal(effects,1,'different student cannot recover another student opening');
 const reopened=page();await settle();assert.equal(effects,1,'reopened page replays rather than spends');assert([...rows.values()].every(r=>r.status==='confirmed'));assert(reopened.messages.some(x=>x.includes('개봉 결과를 확인')));
 console.log('PASS: pack UI save failure, double click, response loss, different student, page reopen without second spend');
})().catch(e=>{console.error(e);process.exitCode=1});
