import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('v4.6 reduces database round trips without changing the isolated schema',async()=>{
 const [edge,migration]=await Promise.all([
  read('supabase/functions/history-normal-rc-api/index.ts'),
  read('supabase/migrations/20260928061339_normal_rc_v46_shared_cache.sql')
 ]);
 assert.match(edge,/history_v5\.lock_actor_v45/);
 assert.match(edge,/history_v5\.load_scope_v46/);
 assert.match(edge,/Server-Timing/);
 assert.match(edge,/event:'normal-rc-slow'/);
 assert.match(edge,/postgres\(connectionString,\{prepare:false,max:1/);
 assert.doesNotMatch(edge,/6543/);
 assert.match(migration,/create or replace function history_v5\.load_shared_v46/);
 assert.match(migration,/create or replace function history_v5\.load_scope_v46/);
 assert.match(migration,/grant execute on function history_v5\.load_scope_v46[\s\S]*to history_v5_worker/);
 assert.doesNotMatch(migration,/drop\s+(table|schema)/i);
});

test('v4.7 bounds retry amplification and preserves local quiz batching',async()=>{
 const [api,transaction,speed,client,domain]=await Promise.all([
  read('game-api.js'),
  read('supabase/functions/_shared/transaction-service.mjs'),
  read('student-v43-speed.js'),
  read('normal-rc-client.js'),
  read('supabase/functions/_shared/gas-v6-domain.mjs')
 ]);
 assert.match(api,/version:'4\.7'/);
 assert.match(api,/studentMutationTail/);
 assert.match(api,/singleFlight/);
 assert.match(api,/Number\(opts\.maxAttempts\)\|\|3/);
 assert.match(api,/role\+'\.login',p,\{maxAttempts:2\}/);
 assert.match(transaction,/new Set\(\['40001','40P01'\]\)/);
 assert.match(transaction,/const out=await \(tx\.measure\?tx\.measure\('domain',runDomain\):runDomain\(\)\)/);
 assert.doesNotMatch(transaction,/retryableTransactionCodes=new Set\([^\n]*55P03/);
 assert.match(speed,/localQuestions/);
 assert.match(client,/attempt\.quiz\.complete/);
 assert.match(speed,/maxAttempts:3/);
 assert.match(domain,/const card=addCard\(c,c\.user,sample\(pool,1\)\[0\],rarity\)/);
 assert.doesNotMatch(domain,/resultShinyBonus/);
});

test('v4.8 RC student labels and changed-asset cache keys are internally consistent',async()=>{
 const [student,teacher,manifest,api]=await Promise.all([
  read('student-preview.html'),read('teacher.html'),read('rc-preview-manifest.json'),read('game-api.js')
 ]);
 assert.match(student,/학습 게임 v4\.8 RC/);
 assert.match(student,/game-api\.js\?v=47-/);
 assert.match(student,/student-v42\.js\?v=48-/);
 assert.match(student,/student-stage28\.js\?v=49-/);
 assert.match(student,/student-v47\.js\?v=48-/);
 assert.match(teacher,/통합 플랫폼 v4\.7/);
 assert.match(teacher,/game-api\.js\?v=47-/);
 assert.match(teacher,/teacher-v47\.js\?v=47-/);
 assert.equal(JSON.parse(manifest).release,'v4.7-rc-20260928');
 assert.match(api,/version:'4\.7'/);
});

test('v4.8 RC uses lightweight board and self-only student ranking payloads',async()=>{
 const [domain,board,student]=await Promise.all([
  read('supabase/functions/_shared/gas-v6-domain.mjs'),read('board27.js'),read('student-v47.js')
 ]);
 assert.match(board,/API\.request\('rankings\.read'/);
 assert.doesNotMatch(board,/API\.request\('teacher\.board\.read'/);
 assert.match(student,/selfOnly:true/);
 assert.match(student,/나의 최고기록/);
 assert.match(student,/TOP 100 전체 순위는 교실 전광판/);
 assert.doesNotMatch(student,/우리 반 최고 기록/);
 assert.match(domain,/selfOnly=p\.selfOnly===true/);
 assert.match(domain,/classTop:selfOnly\?\[\]/);
});

test('v4.9 RC board shows real names, explicit class scope, and readable filters',async()=>{
 const [board,css,html]=await Promise.all([read('board27.js'),read('rc-board.css'),read('board.html')]);
 assert.match(board,/row\.student\?\.name\|\|row\.student\?\.nickname/);
 assert.match(board,/name="rankingFilterScope"/);
 assert.match(board,/>전체 학생</);
 assert.match(board,/>특정 학년</);
 assert.match(board,/>특정 반</);
 assert.match(board,/rankingFilterScope==='class'/);
 assert.match(board,/scopeLabel\+' · '\+result\.periodLabel/);
 assert.match(css,/-webkit-text-fill-color:#172d37!important/);
 assert.match(css,/input:disabled/);
 assert.match(html,/rc-board\.css\?v=49-/);
 assert.match(html,/board27\.js\?v=49-/);
});

test('v4.7 adds cached rankings, TOP 100 filters, and session-only issued-code export',async()=>{
 const [domain,transaction,board,teacher,student,roster,ready]=await Promise.all([
  read('supabase/functions/_shared/gas-v6-domain.mjs'),read('supabase/functions/_shared/transaction-service.mjs'),read('board27.js'),read('teacher-v47.js'),read('student-v47.js'),read('teacher-student-import.js'),read('teacher-test-ready.js')
 ]);
 assert.match(domain,/completionRanked/);
 assert.match(domain,/\['all','today','weekly','monthly','yearly'\]/);
 assert.match(domain,/number\(p\.limit\|\|100,1,100\)/);
 assert.match(domain,/setCount:p\.setCount/);
 assert.match(transaction,/teacher\.board\.read/);
 assert.match(board,/TOP \$\{n\}/);
 assert.match(board,/leaderboardV47/);
 assert.match(teacher,/TOP 100/);
 assert.match(student,/history-rank-v47/);
 assert.match(student,/86400000/);
 assert.match(roster,/downloadIssuedCodes47/);
 assert.match(roster,/studentSecretsReady/);
 assert.doesNotMatch(ready,/prompt\('접속코드 재발급 사유'/);
});

test('v4.6 uses narrow idempotent paths for opening acknowledgement and abandon',async()=>{
 const [edge,transaction,opening,outbox]=await Promise.all([
  read('supabase/functions/history-normal-rc-api/index.ts'),
  read('supabase/functions/_shared/transaction-service.mjs'),
  read('student-stage28.js'),
  read('normal-rc-outbox.js')
 ]);
 assert.match(edge,/fastAction/);
 assert.match(edge,/cards\.openings\.ack/);
 assert.match(edge,/attempt\.abandon/);
 assert.match(edge,/Content-Encoding/);
 assert.match(transaction,/tx\.fastAction/);
 assert.match(opening,/openingAcks28/);
 assert.match(opening,/state\.sentRevealed>=state\.revealed/);
 assert.match(outbox,/timeoutMs:20000/);
});
