// Local-only PostgreSQL concurrency tests, NOT a Supabase staging test.
// Starts a new temporary cluster on a private Unix socket; never accepts a URL
// or connects to an existing server. Requires initdb/pg_ctl on PATH or in
// TEST_POSTGRES_BIN_DIR, and must run as a non-root user.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

if (process.platform === 'win32') throw new Error('This isolated Unix-socket test requires Linux or macOS.');
if (process.getuid?.() === 0) throw new Error('PostgreSQL initdb must run as an unprivileged user.');
const bin = process.env.TEST_POSTGRES_BIN_DIR;
const executable = name => bin ? join(resolve(bin), name) : name;
const root = mkdtempSync(join(tmpdir(), 'rawdpg-'));
if (!/^\/[a-zA-Z0-9_./-]+$/.test(root) || root.length > 70) { rmSync(root,{recursive:true,force:true}); throw new Error('Temporary directory must have a short Unix path without spaces or shell characters.'); }
const data = join(root,'data'); const port = 55432;
let started = false, startAttempted = false, stopFailed = false; const clients = [];
const exec = (name, args) => execFileSync(executable(name), args, {encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:45000});
const migration = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const owner = '00000000-0000-0000-0000-000000000011';
const child = id => ({id,crecheId:owner,prenom:'Fictif',nom:'Test',statut:'Actif',parents:[{telephone:'0555123456'}]});
const invoice = (childId, period, extra={}) => ({enfantId:childId,montant:1000,statut:'En attente',typeFacture:period.startsWith('A:')?'Annuel':'Mensuel',moisConcerne:period.slice(2),periodeCle:period,...extra});
const rpc = (c, sql, params) => c.query(sql,params);
const write = (c, id, patch) => rpc(c,"select public.rawdha_write_invoice('create',$1,$2,null) as r",[id,patch]);
const update = (c, id, patch, expected) => rpc(c,"select public.rawdha_write_invoice('update',$1,$2,$3) as r",[id,patch,expected]);
const flag = (c, id, expected, target, targetExpected, request) => rpc(c,"select public.rawdha_invoice_review_action($1,'flag_duplicate',$2,$3,null,$4,$5,'Dossier fictif',true) as r",[request,id,expected,target,targetExpected]);
const check = (c,id,expected) => rpc(c,"select public.rawdha_check_invoice_reminder($1,$2,'Fictif','Test','0555123456') as r",[id,expected]);
const settled = promise => promise.then(value=>({value}),error=>({error}));
async function waitForBlock(admin, waiting, blocker) {
  const end = Date.now()+3000;
  while (Date.now()<end) {
    const result = await admin.query('select pg_blocking_pids($1) as ids',[waiting.processID]);
    if (result.rows[0].ids.includes(blocker.processID)) return;
    await delay(30);
  }
  throw new Error(`Expected session ${waiting.processID} to wait for ${blocker.processID}`);
}
async function expectError(outcome, pattern) {
  const result = await outcome;
  assert.ok(result.error, 'expected the waiting transaction to fail');
  assert.match(result.error.message,pattern);
}
async function session() {
  const c = new pg.Client({host:root,port,user:'postgres',database:'postgres',connectionTimeoutMillis:5000});
  await c.connect(); clients.push(c);
  await c.query(`set role authenticated; set statement_timeout='8s'; set lock_timeout='6s'; select set_config('request.uid','${owner}',false); select set_config('request.approved','true',false);`);
  return c;
}

try {
  exec('initdb',['-D',data,'-U','postgres','--auth=trust','--no-instructions','--no-locale','-E','UTF8']);
  // No TCP listener, private mode-0700 directory created by mkdtemp.
  startAttempted=true;
  exec('pg_ctl',['-D',data,'-l',join(root,'server.log'),'-o',`-c listen_addresses='' -c unix_socket_directories='${root}' -p ${port} -c fsync=off`,'-w','start']); started=true;
  const admin = new pg.Client({host:root,port,user:'postgres',database:'postgres',connectionTimeoutMillis:5000}); await admin.connect();clients.push(admin);
  await admin.query(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
    create function public.rawdha_is_admin() returns boolean language sql stable as $$select coalesce(current_setting('request.admin',true),'false')='true'$$;
    create function public.rawdha_is_approved_director() returns boolean language sql stable as $$select coalesce(current_setting('request.approved',true),'false')='true'$$;
    create table public.enfants(id text primary key,data jsonb not null); create table public.paiements(id text primary key,data jsonb not null);
    grant usage on schema public,auth to anon,authenticated; grant select,insert,update,delete on public.paiements to authenticated;`);
  for (const name of ['20261108170000_financial_write_safety.sql','20261108180000_invoice_period_review.sql','20261108190000_invoice_review_corrections.sql','20261108200000_invoice_reminder_preflight.sql']) await admin.query(migration(name));
  const a = await session(), b = await session();
  async function seedChild(id) { const {id:_id,...data}=child(id); await admin.query('insert into enfants values($1,$2)',[id,data]); }
  async function seedInvoice(id,data) {await admin.query('insert into paiements values($1,$2)',[id,data]);}

  // Child lock serializes the two independent requests; no arbitrary period is chosen.
  await seedChild('same'); await a.query('begin'); await write(a,'same-1',invoice('same','M:2025-01'));
  const same = settled(write(b,'same-2',invoice('same','M:2025-01')));
  await waitForBlock(admin,b,a); await a.query('commit'); await expectError(same,/finance_period_overlap/);
  assert.equal(Number((await admin.query("select count(*) as n from paiements where data->>'enfantId'='same'")).rows[0].n),1);
  console.log('ok: concurrent identical periods');

  await seedChild('overlap'); await a.query('begin'); await write(a,'overlap-1',invoice('overlap','M:2025-06'));
  const overlap = settled(write(b,'overlap-2',invoice('overlap','A:2025')));
  await waitForBlock(admin,b,a); await a.query('commit'); await expectError(overlap,/finance_period_overlap/);
  assert.equal(Number((await admin.query("select count(*) as n from paiements where data->>'enfantId'='overlap'")).rows[0].n),1);
  console.log('ok: concurrent month/year overlap');

  await seedChild('stale'); const original=invoice('stale','M:2025-01'); await seedInvoice('stale-1',original);
  await a.query('begin'); await update(a,'stale-1',{notes:'première modification'},{id:'stale-1',...original});
  const stale = settled(update(b,'stale-1',{notes:'deuxième modification'},{id:'stale-1',...original}));
  await waitForBlock(admin,b,a); await a.query('commit'); await expectError(stale,/finance_changed/);
  assert.equal((await admin.query("select data->>'notes' as notes from paiements where id='stale-1'")).rows[0].notes,'première modification');
  console.log('ok: stale update does not overwrite a committed update');

  await seedChild('suspect'); const one=invoice('suspect','M:2025-01'),two=invoice('suspect','M:2025-02');
  await seedInvoice('suspect-1',one);await seedInvoice('suspect-2',two);await a.query('begin');
  await flag(a,'suspect-1',{id:'suspect-1',...one},'suspect-2',{id:'suspect-2',...two},'request-1');
  const createWhileFlagged = settled(write(b,'suspect-3',invoice('suspect','M:2025-03')));
  await waitForBlock(admin,b,a);await a.query('commit');await expectError(createWhileFlagged,/finance_duplicate_review_pending/);
  assert.equal(Number((await admin.query("select count(*) as n from paiements where data->>'enfantId'='suspect'")).rows[0].n),2);
  console.log('ok: suspected pair vs concurrent creation');

  // When the pair is flagged first, the target cannot be updated either.
  await seedChild('hold-update'); const h1=invoice('hold-update','M:2025-01'),h2=invoice('hold-update','M:2025-02');
  await seedInvoice('hold-1',h1);await seedInvoice('hold-2',h2);await a.query('begin');
  await flag(a,'hold-1',{id:'hold-1',...h1},'hold-2',{id:'hold-2',...h2},'request-4');
  const heldUpdate=settled(update(b,'hold-2',{notes:'ne doit pas passer'},{id:'hold-2',...h2}));
  await waitForBlock(admin,b,a);await a.query('commit');await expectError(heldUpdate,/finance_duplicate_review_pending/);
  assert.equal((await admin.query("select data->>'notes' as notes from paiements where id='hold-2'")).rows[0].notes,null);
  console.log('ok: flagged target blocks a concurrent edit');

  // If the edit commits first, the signaler must compare again.
  await seedChild('reverse');const r1=invoice('reverse','M:2025-01'),r2=invoice('reverse','M:2025-02');
  await seedInvoice('reverse-1',r1);await seedInvoice('reverse-2',r2);await a.query('begin');
  await update(a,'reverse-2',{notes:'updated'},{id:'reverse-2',...r2});
  const staleFlag=settled(flag(b,'reverse-1',{id:'reverse-1',...r1},'reverse-2',{id:'reverse-2',...r2},'request-5'));
  await waitForBlock(admin,b,a);await a.query('commit');await expectError(staleFlag,/finance_changed/);
  assert.equal((await admin.query("select data ? 'doublonSuspect' as flagged from paiements where id='reverse-1'")).rows[0].flagged,false);
  console.log('ok: stale target prevents a concurrent flag');

  // Review and creation use the same child lock and see the committed result.
  await seedChild('review');const legacy={enfantId:'review',montant:1000,statut:'En attente',moisConcerne:'Ancien'};
  await seedInvoice('review-1',legacy);await a.query('begin');
  await rpc(a,"select public.rawdha_review_invoice_period('review-1',$1,'M:2024-01','Registre fictif',true)",[{id:'review-1',...legacy}]);
  const afterReview=settled(write(b,'review-2',invoice('review','M:2025-01')));
  await waitForBlock(admin,b,a);await a.query('commit');assert.ifError((await afterReview).error);
  assert.equal(Number((await admin.query("select count(*) as n from paiements where data->>'enfantId'='review'")).rows[0].n),2);
  console.log('ok: creation waits for committed legacy review');

  // The preflight must not validate a phone changed while it waited on the child.
  await seedChild('phone');const phoneInvoice=invoice('phone','M:2025-01');await seedInvoice('phone-1',phoneInvoice);
  await admin.query('begin');await admin.query("update enfants set data=jsonb_set(data,'{parents,0,telephone}',to_jsonb('0555000000'::text)) where id='phone'");
  const stalePhone=settled(check(b,'phone-1',{id:'phone-1',...phoneInvoice}));
  // Use session a as an independent observer while admin holds the row lock.
  await waitForBlock(a,b,admin);await admin.query('commit');await expectError(stalePhone,/finance_changed/);
  console.log('ok: preflight waits for a parent change and rejects the old number');

  await seedChild('preflight'); const first=invoice('preflight','M:2025-01'),second=invoice('preflight','M:2025-02');
  await seedInvoice('preflight-1',first);await seedInvoice('preflight-2',second);
  await a.query('begin');await flag(a,'preflight-1',{id:'preflight-1',...first},'preflight-2',{id:'preflight-2',...second},'request-2');
  const heldCheck=settled(check(b,'preflight-2',{id:'preflight-2',...second}));
  await waitForBlock(admin,b,a);await a.query('commit');await expectError(heldCheck,/finance_duplicate_review_pending/);
  console.log('ok: server preflight waits for a concurrent suspicion');

  await seedChild('after');const x=invoice('after','M:2025-01'),y=invoice('after','M:2025-02');await seedInvoice('after-1',x);await seedInvoice('after-2',y);
  await a.query('begin');assert.equal((await check(a,'after-2',{id:'after-2',...y})).rows[0].r,true);
  const laterFlag=settled(flag(b,'after-1',{id:'after-1',...x},'after-2',{id:'after-2',...y},'request-3'));
  await waitForBlock(admin,b,a);await a.query('commit');const flagResult=await laterFlag;assert.ifError(flagResult.error);
  await assert.rejects(check(a,'after-2',{id:'after-2',...y}),/finance_duplicate_review_pending/);
  console.log('ok: preflight is only point-in-time, not a reservation');
  const privileges=await admin.query(`select has_table_privilege('authenticated','public.paiements','UPDATE') as can_write,
    has_function_privilege('authenticated','public.rawdha_write_invoice_internal(text,text,jsonb,jsonb)','EXECUTE') as can_call_internal,
    has_function_privilege('anon','public.rawdha_check_invoice_reminder(text,jsonb,text,text,text)','EXECUTE') as anon_can_check`);
  assert.deepEqual(privileges.rows[0],{can_write:false,can_call_internal:false,anon_can_check:false});
  console.log('ok: direct grants and internal RPC are unavailable to the simulated roles');
  console.log('Local PostgreSQL concurrency checks passed. Auth was simulated; Supabase RLS/deployment were not tested.');
} catch (err) {
  if (err?.stderr) console.error(String(err.stderr));
  console.error(err); process.exitCode=1;
} finally {
  for (const c of clients.reverse()) { try { await c.end(); } catch {} }
  if (started || existsSync(join(data,'postmaster.pid'))) { try { exec('pg_ctl',['-D',data,'-m','immediate','-w','stop']); } catch (err) { console.error('Failed to stop local PostgreSQL:',err);stopFailed=true;process.exitCode=1; } }
  // Never remove a cluster after an uncertain startup/shutdown. The retained
  // directory is our private fresh fixture, not a caller-supplied path.
  if (!stopFailed && (!startAttempted || started) && process.exitCode !== 1) rmSync(root,{recursive:true,force:true});
  else console.error(`Temporary cluster retained for inspection: ${root}`);
}
