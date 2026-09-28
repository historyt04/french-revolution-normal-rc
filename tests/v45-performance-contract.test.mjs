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

test('v4.6 bounds retry amplification and preserves local quiz batching',async()=>{
 const [api,transaction,speed,client,domain]=await Promise.all([
  read('game-api.js'),
  read('supabase/functions/_shared/transaction-service.mjs'),
  read('student-v43-speed.js'),
  read('normal-rc-client.js'),
  read('supabase/functions/_shared/gas-v6-domain.mjs')
 ]);
 assert.match(api,/version:'4\.6'/);
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

test('v4.6 labels and cache keys are internally consistent',async()=>{
 const [student,teacher,manifest,api]=await Promise.all([
  read('student-preview.html'),read('teacher.html'),read('rc-preview-manifest.json'),read('game-api.js')
 ]);
 assert.match(student,/학습 게임 v4\.6/);
 assert.match(student,/game-api\.js\?v=46-/);
 assert.match(teacher,/통합 플랫폼 v4\.6/);
 assert.match(teacher,/game-api\.js\?v=46-/);
 assert.equal(JSON.parse(manifest).release,'v4.6-rc-20260928');
 assert.match(api,/version:'4\.6'/);
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
