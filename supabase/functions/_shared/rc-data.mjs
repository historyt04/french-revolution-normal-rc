import {createHash, createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {schema, rules} from './gas-v6-domain.mjs';

export const TABLES = Object.freeze(Object.keys(schema));
export const TRANSIENT = new Set(['sessions','sessionScopes3','sessionRevocations3','limits','journals','ownerRecovery3']);
export const PREFLIGHT_VERSION = 'cross-ref-v2';
const RARITIES = Object.freeze(['normal','rare','unique','legend','myth']);
const EFFECT_ID = /^(0[1-9]|1[0-8])$/;
const STUDENT_AUDIT_ACTIONS = new Set(['xp.award','study.award']);
const RECEIPTLESS_AUDIT_ACTIONS = new Set(['owner.bootstrap','owner.recovered']);
const STAFF_AUDIT_ACTIONS = new Set([
  'owner.bootstrap','owner.recovered','owner.copyright.save','owner.school.save','owner.teacher.appoint','owner.teacher.update',
  'owner.teacher.code.rotate','owner.sessions.revoke','owner.recovery.rotate','owner.schoolSharing.save',
  'teacher.testSettings.save','teacher.device.revoke','teacher.student.code.rotate','teacher.test.issue',
  'teacher.backup.create','teacher.backup.restoreCopy','student.create','gift','collection.reissue','record.review',
  'delete','delete.restore','year.create','report.csv','settings.completion','settings.collection','settings.attendance25',
  'settings.learning26','settings.reporting27','settings.games','settings.access','settings.rewards','settings.visibility',
  'missions.save','missions.reset','missions.start','missions.end','missions.reset_progress','missions.add_round'
]);
const legacyEventId = value => ({5:'FR-X05',8:'FR-X08'}[value]||`FR-${String(value>8?value-2:value>5?value-1:value).padStart(2,'0')}`);
const copy = x => structuredClone(x);
export function invariant(ok, code) { if (!ok) throw Object.assign(new Error(code), {code}); }
export function canonical(x) {
  if (Array.isArray(x)) return '[' + x.map(v=>v===undefined?'null':canonical(v)).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).filter(k=>x[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',') + '}';
  return JSON.stringify(x);
}
export const digest = x => createHash('sha256').update(typeof x === 'string' ? x : canonical(x)).digest('hex');
export const emptyTables = () => Object.fromEntries(TABLES.map(t=>[t, []]));
const byId = (a,b) => a.id<b.id?-1:a.id>b.id?1:0;

const present = value => value!==undefined && value!==null && value!=='';
const setOf = rows => new Set(rows.map(row=>row.id));
const requireReference = (value,set,code) => { if(present(value)) invariant(set.has(String(value)),code); };
const isSyntheticStudent = value => typeof value==='string' && value.startsWith('TEST:');

// Fail closed before any live import. These checks deliberately use the original
// GAS identifiers instead of translating them to UUIDs, so every historical
// relationship remains reviewable and reversible.
export function validateReferences(tables) {
  const students=setOf(tables.students), teachers=setOf(tables.teachers), schools=setOf(tables.schools3);
  const attempts=setOf(tables.attempts), records=setOf(tables.records), runs=setOf(tables.missionRuns);
  const programs=setOf(tables.missionPrograms), deletions=setOf(tables.deletions), sessions=setOf(tables.sessions);
  const policies=setOf(tables.teacherPolicies), packIds=new Set(rules.packs.map(x=>x.id));
  const unitIds=new Set([rules.unitId]);
  const rowIds=Object.fromEntries(TABLES.map(t=>[t,setOf(tables[t])]));
  const rowsById=Object.fromEntries(TABLES.map(t=>[t,new Map(tables[t].map(row=>[row.id,row]))]));
  const receiptPairs=new Set(tables.receipts.map(row=>row.userId+'\0'+row.requestId));
  const student=(value,table)=>{
    if(!present(value))return;
    if(isSyntheticStudent(value)) return requireReference(String(value).slice(5),teachers,'ORPHAN_TEACHER_TEST:'+table);
    requireReference(value,students,'ORPHAN_STUDENT:'+table);
  };
  const teacher=(value,table)=>{if(present(value)&&value!=='system')requireReference(value,teachers,'ORPHAN_TEACHER:'+table);};
  const user=(value,table)=>{
    if(!present(value))return;
    invariant(students.has(String(value))||teachers.has(String(value))||isSyntheticStudent(value)&&teachers.has(String(value).slice(5)),'ORPHAN_USER:'+table);
  };
  const unit=(value,table)=>{if(present(value))requireReference(value,unitIds,'ORPHAN_UNIT:'+table);};
  const school=(value,table)=>{if(present(value))requireReference(value,schools,'ORPHAN_SCHOOL:'+table);};
  const request=(value,table)=>invariant(typeof value==='string'&&value.length>0,'INVALID_REQUEST_ID:'+table);
  const auditActor=row=>{
    request(row.requestId,'audit');
    if(row.actorId!=='system'){
      if(STUDENT_AUDIT_ACTIONS.has(row.action)) {
        requireReference(row.actorId,students,'ORPHAN_STUDENT:audit');
        if(row.action==='xp.award'&&present(row.target?.attemptId)){
          const attempt=rowsById.attempts.get(row.target.attemptId);
          invariant(attempt,'ORPHAN_ATTEMPT:audit');
          invariant(attempt.studentId===row.actorId,'AUDIT_ACTOR_TARGET_MISMATCH');
        }
      } else {
        invariant(STAFF_AUDIT_ACTIONS.has(row.action),'UNKNOWN_AUDIT_ACTION');
        requireReference(row.actorId,teachers,'ORPHAN_TEACHER:audit');
      }
      if(!RECEIPTLESS_AUDIT_ACTIONS.has(row.action))
        invariant(receiptPairs.has(row.actorId+'\0'+row.requestId),'AUDIT_ACTOR_REQUEST_MISMATCH');
    }
  };

  for(const t of TABLES)for(const row of tables[t]){
    if(present(row.studentId))student(row.studentId,t);
    if(present(row.unitId))unit(row.unitId,t);
    if(present(row.schoolId))school(row.schoolId,t);
    if(present(row.deletionId))requireReference(row.deletionId,deletions,'ORPHAN_DELETION:'+t);
  }
  for(const row of tables.studentScopes3){
    invariant(Array.isArray(row.units),'INVALID_UNIT_LIST:studentScopes3');
    row.units.forEach(value=>unit(value,'studentScopes3'));
  }
  for(const row of tables.objectScopes3){
    invariant(TABLES.includes(row.tableName),'UNKNOWN_SCOPED_TABLE');
    requireReference(row.rowId,rowIds[row.tableName],'ORPHAN_SCOPED_ROW');
    const target=rowsById[row.tableName].get(row.rowId);
    invariant(present(target?.actorId)&&target.actorId===row.actorId,'OBJECT_SCOPE_ACTOR_MISMATCH');
    invariant(Array.isArray(row.units),'INVALID_UNIT_LIST:objectScopes3');
    row.units.forEach(value=>value==='*'||unit(value,'objectScopes3'));
  }
  for(const row of tables.scopedSettings3){
    invariant(TABLES.includes(row.sourceTable),'UNKNOWN_SETTING_TABLE');
    requireReference(row.sourceId,rowIds[row.sourceTable],'ORPHAN_SETTING_SOURCE');
  }
  for(const row of tables.ownerRecovery3)teacher(row.ownerId,'ownerRecovery3');
  for(const row of tables.teacherPolicies){teacher(row.teacherId,'teacherPolicies');invariant(Array.isArray(row.units),'INVALID_UNIT_LIST:teacherPolicies');row.units.forEach(value=>value==='*'||unit(value,'teacherPolicies'));}
  for(const row of tables.sessions)user(row.userId,'sessions');
  for(const row of tables.sessionScopes3){requireReference(row.sessionId,sessions,'ORPHAN_SESSION:sessionScopes3');requireReference(row.policyId,policies,'ORPHAN_POLICY:sessionScopes3');}
  for(const row of tables.sessionRevocations3){requireReference(row.sessionId,sessions,'ORPHAN_SESSION:sessionRevocations3');user(row.userId,'sessionRevocations3');}
  for(const row of tables.missionRuns)teacher(row.actorId,'missionRuns');
  for(const row of tables.audit)auditActor(row);
  for(const t of ['deletions','backups'])for(const row of tables[t])teacher(row.actorId,t);
  for(const row of tables.receipts)user(row.userId,'receipts');

  for(const t of ['questionEvents27','attemptEvents27'])for(const row of tables[t])requireReference(row.attemptId,attempts,'ORPHAN_ATTEMPT:'+t);
  for(const t of ['xpClaims26','completionClaims'])for(const row of tables[t])requireReference(row.attemptId,attempts,'ORPHAN_ATTEMPT:'+t);
  for(const row of tables.records)requireReference(row.attemptId,attempts,'ORPHAN_ATTEMPT:records');
  for(const row of tables.speed){requireReference(row.attemptId,attempts,'ORPHAN_ATTEMPT:speed');requireReference(row.recordId,records,'ORPHAN_RECORD:speed');}
  for(const row of tables.progress)if(present(row.state?.run))requireReference(row.state.run,attempts,'ORPHAN_ATTEMPT:progress');
  for(const row of tables.activities)if(present(row.data?.recordId))requireReference(row.data.recordId,records,'ORPHAN_RECORD:activities');

  const expectedMaster=new Set();
  for(const event of rules.collections)for(const rarity of RARITIES)expectedMaster.add(event.id+':'+rarity);
  invariant(tables.cardMaster.length===rules.collections.length*RARITIES.length,'CARD_MASTER_COUNT');
  const masterCombos=new Set();
  for(const row of tables.cardMaster){
    invariant(Number.isInteger(row.legacyId)&&rules.collections.some(x=>x.id===row.legacyId),'INVALID_EVENT:cardMaster');
    invariant(row.eventId===legacyEventId(row.legacyId),'EVENT_ID_MISMATCH:cardMaster');
    invariant(RARITIES.includes(row.rarity),'INVALID_RARITY:cardMaster');
    const combo=row.legacyId+':'+row.rarity;invariant(!masterCombos.has(combo),'DUPLICATE_CARD_MASTER');masterCombos.add(combo);
  }
  invariant([...expectedMaster].every(key=>masterCombos.has(key)),'CARD_MASTER_INCOMPLETE');
  const progressByKey=new Map(tables.collectionProgress.map(row=>[[row.studentId,row.unitId,row.eventId,row.rarity].join(':'),row]));
  const variantsByKey=new Map(tables.cardVariants.map(row=>[[row.studentId,row.unitId,row.eventId,row.rarity,row.effect].join(':'),row]));
  const validateEventRarity=(eventId,rarity,table)=>{
    invariant(Number.isInteger(eventId)&&rules.collections.some(x=>x.id===eventId),'INVALID_EVENT:'+table);
    invariant(RARITIES.includes(rarity)&&masterCombos.has(eventId+':'+rarity),'INVALID_RARITY:'+table);
  };
  for(const row of tables.cards){
    validateEventRarity(row.legacyId,row.rarity,'cards');
    invariant(row.eventId===legacyEventId(row.legacyId),'EVENT_ID_MISMATCH:cards');
    const p=progressByKey.get([row.studentId,row.unitId,row.legacyId,row.rarity].join(':'));
    invariant(p?.normalSeen===true,'MISSING_NORMAL_PROGRESS');
  }
  for(const row of tables.cardVariants){
    validateEventRarity(row.eventId,row.rarity,'cardVariants');
    invariant(EFFECT_ID.test(row.effect),'INVALID_EFFECT');
    const p=progressByKey.get([row.studentId,row.unitId,row.eventId,row.rarity].join(':'));
    invariant(p&&Array.isArray(p.effects)&&p.effects.includes(row.effect),'MISSING_EFFECT_PROGRESS');
  }
  for(const row of tables.collectionProgress){
    validateEventRarity(row.eventId,row.rarity,'collectionProgress');
    invariant(typeof row.normalSeen==='boolean'&&Array.isArray(row.effects),'INVALID_COLLECTION_PROGRESS');
    invariant(new Set(row.effects).size===row.effects.length&&row.effects.every(x=>EFFECT_ID.test(x)),'INVALID_EFFECT');
    invariant(row.representative==='normal'?row.normalSeen:row.effects.includes(row.representative),'INVALID_REPRESENTATIVE_EFFECT');
    for(const effect of row.effects){const v=variantsByKey.get([row.studentId,row.unitId,row.eventId,row.rarity,effect].join(':'));invariant(v&&v.count>0,'ORPHAN_COLLECTION_EFFECT');}
  }
  for(const row of tables.collectionClaims){
    invariant(['set','tier'].includes(row.kind),'INVALID_COLLECTION_CLAIM');
    invariant(RARITIES.includes(row.rarity),'INVALID_RARITY:collectionClaims');
    if(row.kind==='set')validateEventRarity(row.eventId,row.rarity,'collectionClaims');
    else invariant(row.eventId===0,'INVALID_TIER_EVENT');
    request(row.requestId,'collectionClaims');
    invariant(Array.isArray(row.reissues),'INVALID_REISSUES');
    for(const reissue of row.reissues){teacher(reissue.actorId,'collectionClaims.reissues');request(reissue.requestId,'collectionClaims.reissues');}
  }
  const validateGrantedCards=(value,table)=>{
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value.cards))for(const card of value.cards){if(!card||typeof card!=='object')continue;validateEventRarity(card.eventId,card.rarity,table);if(card.effect&&card.effect!=='normal')invariant(EFFECT_ID.test(card.effect),'INVALID_EFFECT');}
  };
  for(const row of tables.packOpenings28){
    invariant(packIds.has(row.packId),'INVALID_PACK:packOpenings28');request(row.requestId,'packOpenings28');
    invariant(Array.isArray(row.cards),'INVALID_OPENING_CARDS');for(const card of row.cards)validateEventRarity(card.eventId,card.rarity,'packOpenings28');
  }
  for(const row of tables.packs){invariant(packIds.has(row.packId),'INVALID_PACK:packs');}
  for(const t of ['grantEvents27','xpClaims26','levelClaims26','studyClaims26','completionClaims','collectionClaims','missionClaims'])for(const row of tables[t])validateGrantedCards(row.result,t);
  for(const row of tables.fusion){
    invariant(Array.isArray(row.materials),'INVALID_FUSION_MATERIALS');for(const card of row.materials)validateEventRarity(card.eventId,card.rarity,'fusion');
    if(row.result)validateEventRarity(row.result.eventId,row.result.rarity,'fusion');
  }

  for(const row of tables.missionPrograms)if(present(row.activeRunId)&&row.activeRunId!=='stopped')requireReference(row.activeRunId,runs,'ORPHAN_MISSION_RUN:missionPrograms');
  for(const row of tables.missionAssignments26){
    requireReference(row.runId,runs,'ORPHAN_MISSION_RUN:missionAssignments26');
    if(present(row.programId)&&row.programId!=='stopped')invariant(programs.has(String(row.programId))||runs.has(String(row.programId)),'ORPHAN_MISSION_PROGRAM');
  }
  for(const row of tables.missionClaims){
    requireReference(row.runId,runs,'ORPHAN_MISSION_RUN:missionClaims');
    const run=tables.missionRuns.find(x=>x.id===row.runId);
    invariant(Array.isArray(run?.definitions)&&run.definitions.some(x=>x.id===row.missionId),'ORPHAN_MISSION:missionClaims');
    request(row.requestId,'missionClaims');
  }
  for(const row of tables.missions){
    const reward=tables.rewards.find(x=>x.schoolYear===row.schoolYear&&x.unitId===row.unitId);
    invariant(Array.isArray(reward?.settings?.missions)&&reward.settings.missions.some(x=>x.id===row.missionId),'ORPHAN_MISSION:missions');
  }

  receiptPairs.clear();
  for(const row of tables.receipts){
    request(row.requestId,'receipts');const key=row.userId+'\0'+row.requestId;
    invariant(!receiptPairs.has(key),'DUPLICATE_REQUEST_ID');receiptPairs.add(key);
  }
  for(const t of ['packOpenings28','xpClaims26','levelClaims26','studyClaims26','missionClaims'])for(const row of tables[t]){
    if(present(row.requestId))invariant(receiptPairs.has(row.studentId+'\0'+row.requestId),'ORPHAN_REQUEST:'+t);
  }
  for(const row of tables.backups)invariant(typeof row.fileId==='string'&&row.fileId.length>0,'INVALID_BACKUP_FILE_ID');
  return tables;
}

// All fields, including soft-deleted rows and legacy identifiers, are retained.
// No conversion to UUIDs and no 14-event -> 12-question conflation.
export function validateTables(tables, {requireFull=true}={}) {
  invariant(tables && typeof tables==='object' && !Array.isArray(tables), 'TABLES_REQUIRED');
  invariant(Object.keys(tables).every(t=>TABLES.includes(t)), 'UNKNOWN_TABLE');
  for (const t of TABLES) {
    if (!requireFull && !Object.hasOwn(tables,t)) continue;
    invariant(Array.isArray(tables[t]), 'MISSING_TABLE:'+t);
    const ids = new Set();
    for (const row of tables[t]) {
      invariant(row && typeof row==='object' && typeof row.id==='string' && row.id.length>0, 'INVALID_ROW:'+t);
      invariant(!ids.has(row.id), 'DUPLICATE_ID:'+t); ids.add(row.id);
      for (const col of schema[t].columns) {
        const value=row[col.name];
        if (value===undefined || value===null || value==='') continue;
        if (col.type==='integer') invariant(Number.isSafeInteger(value), 'INVALID_INTEGER:'+t+':'+col.name);
        if (col.type==='number') invariant(typeof value==='number' && Number.isFinite(value), 'INVALID_NUMBER:'+t+':'+col.name);
        if (col.type==='boolean') invariant(typeof value==='boolean', 'INVALID_BOOLEAN:'+t+':'+col.name);
      }
      for (const field of ['count','shards','totalXp']) if (Object.hasOwn(row,field)) invariant(Number.isSafeInteger(row[field]) && row[field]>=0, 'INVALID_BALANCE:'+t);
      if (t==='cardVariants') invariant(EFFECT_ID.test(row.effect), 'INVALID_EFFECT');
      if (t==='packs') invariant(Array.isArray(row.guarantees) && row.guarantees.length===row.count, 'PACK_GUARANTEE_MISMATCH');
      invariant(!canonical(row).includes('@private-json:'), 'UNRESOLVED_PRIVATE_JSON:'+t);
    }
  }
  if (requireFull) validateReferences(tables);
  return tables;
}

export class Repository {
  constructor(tables=emptyTables()) {
    this.tables=copy(tables); this.pending=new Map();
    this.indices=new Map(TABLES.map(t=>[t,new Map((this.tables[t]||[]).map(r=>[r.id,r]))]));
  }
  all(t) {
    invariant(TABLES.includes(t),'UNKNOWN_TABLE');
    const rows = new Map((this.tables[t]||[]).map(r=>[r.id,copy(r)]));
    for (const {table,row} of this.pending.values()) if (table===t) rows.set(row.id,copy(row));
    return [...rows.values()];
  }
  get(t,id) { invariant(TABLES.includes(t),'UNKNOWN_TABLE');return copy(this.pending.get(t+'\0'+id)?.row||this.indices.get(t).get(id)||null); }
  put(t,row) { invariant(TABLES.includes(t) && typeof row?.id==='string','INVALID_ROW'); this.pending.set(t+'\0'+row.id,{table:t,row:copy(row)}); }
  changes(only) { return copy([...this.pending.values()].filter(x=>!only||only.includes(x.table))); }
  commit(only) {
    for (const {table,row} of this.changes(only)) {
      const rows=this.tables[table]||(this.tables[table]=[]), i=rows.findIndex(r=>r.id===row.id);
      if(i<0) rows.push(row); else rows[i]=row;
      this.indices.get(table).set(row.id,row);
    }
    this.pending.clear();
  }
  rollback() {this.pending.clear();}
  snapshot() {return Object.fromEntries(TABLES.map(t=>[t,this.all(t)]));}
}

export function decodeCell(value, type, privateJson={}) {
  if (type==='json') {
    if (typeof value==='string' && value.startsWith('@private-json:')) {
      const id=value.slice(14); invariant(Object.hasOwn(privateJson,id),'PRIVATE_JSON_REQUIRED');
      return copy(privateJson[id]);
    }
    if (value===null || value==='') return null;
    if (typeof value==='string') {try {return JSON.parse(value);} catch {throw Object.assign(new Error('INVALID_JSON_CELL'),{code:'INVALID_JSON_CELL'});}}
    return copy(value);
  }
  if (type==='integer'||type==='number') {
    const number=value===''||value===null?0:Number(value);
    invariant(Number.isFinite(number) && (type!=='integer'||Number.isSafeInteger(number)), 'INVALID_NUMERIC_CELL'); return number;
  }
  if(type==='boolean') {
    invariant([true,false,'TRUE','FALSE','true','false','',null].includes(value),'INVALID_BOOLEAN_CELL');
    return value===true||value==='TRUE'||value==='true';
  }
  return String(value??'').replace(/^'(?=[=+@-])/,'');
}

// Input is an OFFLINE, unformatted-values export. Never reads Google or credentials.
export function convertSheetExport(input) {
  invariant(input?.format==='gas-sheet-export-v1' && input.complete===true, 'COMPLETE_EXPORT_REQUIRED');
  const tables=emptyTables();
  for(const [t,spec] of Object.entries(schema)) {
    const tab=input.sheets?.[spec.name]; invariant(tab && Array.isArray(tab.rows),'MISSING_SHEET:'+t);
    invariant(canonical(tab.headers)===canonical(spec.columns.map(c=>c.name)),'HEADER_MISMATCH:'+t);
    invariant(tab.expectedRows===tab.rows.length,'TRUNCATED_SHEET:'+t);
    tables[t]=tab.rows.filter(row=>row[0]!=='' && row[0]!==null).map(row=>{
      invariant(row.length===spec.columns.length,'COLUMN_COUNT:'+t);
      return Object.fromEntries(spec.columns.map((c,i)=>[c.name,decodeCell(row[i],c.type,input.privateJson)]));
    });
  }
  validateTables(tables);
  invariant(!tables.journals.some(x=>x.status==='pending'), 'PENDING_GAS_JOURNAL');
  return {version:'4.2',backupScope:'full',snapshotAt:input.snapshotAt,tables};
}

export function durableTables(tables) {
  return Object.fromEntries(TABLES.map(t=>[t,TRANSIENT.has(t)?[]:copy(tables[t]||[])
    .filter(r=>t!=='system'||!String(r.key).startsWith('device-login:'))
    .map(r=>t==='receipts'?{...r,result:{requestAlreadyProcessed:true}}:r)]));
}
export function migrationPlan(snapshot) {
  invariant(snapshot?.version==='4.2' && snapshot.backupScope==='full','FULL_OWNER_BACKUP_REQUIRED');
  validateTables(snapshot.tables);
  invariant(!snapshot.tables.journals.some(x=>x.status==='pending'),'PENDING_GAS_JOURNAL');
  const tables=durableTables(snapshot.tables);
  const manifest={format:'history-gas-rc-migration-v1',source:'active GAS deployment 6',events:rules.collections.length,
    validation:{version:PREFLIGHT_VERSION,passed:true},
    counts:Object.fromEntries(TABLES.map(t=>[t,{source:snapshot.tables[t].length,import:tables[t].length}])),
    excludedTransient:TABLES.filter(t=>TRANSIENT.has(t)),fingerprints:Object.fromEntries(TABLES.map(t=>[t,digest([...tables[t]].sort(byId))])),
    totals:{normalCards:tables.cards.reduce((n,r)=>n+r.count,0),shinyCards:tables.cardVariants.reduce((n,r)=>n+r.count,0),packs:tables.packs.reduce((n,r)=>n+r.count,0),shards:tables.shinyWallet.reduce((n,r)=>n+r.shards,0)}};
  return {manifest,tables};
}
export function compareCarryover(before,after) {
  const a=migrationPlan(before), b=migrationPlan(after);
  const differences=TABLES.filter(t=>a.manifest.fingerprints[t]!==b.manifest.fingerprints[t]);
  return {exact:!differences.length,differences};
}

export function sealBackup(snapshot,key) {
  invariant(key instanceof Uint8Array && key.length===32,'BACKUP_KEY_REQUIRED');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),plain=Buffer.from(canonical(snapshot));
  const body=Buffer.concat([cipher.update(plain),cipher.final()]);
  return {format:'history-rc-backup-v1',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),body:body.toString('base64')};
}
export function openBackup(envelope,key) {
  invariant(envelope?.format==='history-rc-backup-v1' && key instanceof Uint8Array && key.length===32,'BACKUP_FORMAT_OR_KEY');
  try {const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.body,'base64')),decipher.final()]).toString());
  } catch {throw Object.assign(new Error('BACKUP_INTEGRITY_FAILED'),{code:'BACKUP_INTEGRITY_FAILED'});}
}
