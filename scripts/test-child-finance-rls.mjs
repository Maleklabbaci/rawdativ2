// Local-only PostgreSQL RLS tests, NOT a Supabase staging test.
// Starts a new temporary cluster on a private Unix socket; never accepts a URL
// or connects to an existing server. Requires initdb/pg_ctl on PATH or in
// TEST_POSTGRES_BIN_DIR, and must run as a non-root user.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
const other = '00000000-0000-0000-0000-000000000022';
const pending = '00000000-0000-0000-0000-000000000033';
const adminId = '00000000-0000-0000-0000-000000000044';
const invoice = enfantId => ({enfantId,montant:1000,statut:'En attente',typeFacture:'Mensuel',moisConcerne:'2025-01',periodeCle:'M:2025-01'});
try {
  exec('initdb',['-D',data,'-U','postgres','--auth=trust','--no-instructions','--no-locale','-E','UTF8']);
  startAttempted=true;
  exec('pg_ctl',['-D',data,'-l',join(root,'server.log'),'-o',`-c listen_addresses='' -c unix_socket_directories='${root}' -p ${port} -c fsync=off`,'-w','start']); started=true;
  const db = new pg.Client({host:root,port,user:'postgres',database:'postgres',connectionTimeoutMillis:5000}); await db.connect(); clients.push(db);
  await db.query(`create role anon; create role authenticated; create role inherited_access; grant inherited_access to anon,authenticated;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb not null default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
    create table public.comptes(id text primary key,data jsonb not null default '{}'::jsonb,created_at timestamptz default now());
    create table public.parametres(id text primary key,data jsonb not null default '{}'::jsonb);
    create function public.rawdha_is_admin() returns boolean language sql security definer stable set search_path=public,pg_temp as $$select exists(select 1 from comptes where id=auth.uid()::text and data->>'role'='admin')$$;
    create table public.enfants(id text primary key,data jsonb not null); create table public.paiements(id text primary key,data jsonb not null);
    alter table enfants enable row level security; alter table paiements enable row level security;
    create policy "allow all enfants" on enfants for all using(true) with check(true); create policy "allow all paiements" on paiements for all using(true) with check(true);
    grant usage on schema public,auth to anon,authenticated,inherited_access;
    grant select,insert,update,delete on enfants,paiements to anon,authenticated,inherited_access;`);
  for (const [id, data] of [[owner,{role:'directeur',approvalStatus:'approved'}],[other,{role:'directeur',approvalStatus:'approved'}],[pending,{role:'directeur',approvalStatus:'pending'}],[adminId,{role:'admin'}]]) await db.query('insert into comptes(id,data) values($1,$2)',[id,data]);
  for (const [id, who] of [['a',owner],['b',other],['p',pending]]) {
    await db.query('insert into enfants values($1,$2)',[id,{crecheId:who,statut:'Actif'}]);
    await db.query('insert into paiements values($1,$2)',[`p${id}`,invoice(id)]);
  }
  for (const name of ['20261108100000_account_privilege_safety.sql','20261108110000_explicit_director_approval.sql','20261108120000_pause_unsafe_child_deletion.sql','20261108170000_financial_write_safety.sql','20261108180000_invoice_period_review.sql','20261108190000_invoice_review_corrections.sql','20261108200000_invoice_reminder_preflight.sql']) await db.query(migration(name));
  const login=async id=>db.query(`set role authenticated; select set_config('request.uid','${id}',false)`);
  await login(owner);
  assert.equal((await db.query('select id from enfants')).rowCount,3);
  assert.equal((await db.query('select id from paiements')).rowCount,3);
  console.log('ok: legacy allow-all policies expose cross-nursery rows in the simulated fixture');
  await db.query('reset role'); await db.query(migration('20261108210000_child_finance_rls_guards.sql')); await login(owner);
  assert.deepEqual((await db.query('select id from enfants')).rows.map(r=>r.id),['a']);
  assert.deepEqual((await db.query('select id from paiements')).rows.map(r=>r.id),['pa']);
  assert.equal((await db.query("update enfants set data=data||'{\"nom\":\"ok\"}'::jsonb where id='a' returning id")).rowCount,1);
  assert.equal((await db.query("update enfants set data='{}' where id='b' returning id")).rowCount,0);
  await assert.rejects(db.query("update enfants set data=jsonb_set(data,'{crecheId}',to_jsonb($1::text)) where id='a'",[other]),/row-level security/);
  await assert.rejects(db.query('insert into enfants values($1,$2)',['forged',{crecheId:other}]),/row-level security/);
  await db.query('insert into enfants values($1,$2)',['own',{crecheId:owner}]);
  assert.equal((await db.query("delete from enfants where id='own' returning id")).rowCount,0);
  assert.equal((await db.query("update paiements set data='{}' where id='pa' returning id")).rowCount,0);
  await assert.rejects(db.query('insert into paiements values($1,$2)',['bad',invoice('a')]),/row-level security/);
  const newInvoice={...invoice('a'),moisConcerne:'2025-02',periodeCle:'M:2025-02'};
  assert.equal((await db.query("select public.rawdha_write_invoice('create',$1,$2,null) as r",['rpc-ok',newInvoice])).rows[0].r.id,'rpc-ok');
  await assert.rejects(db.query("select public.rawdha_write_invoice('create',$1,$2,null)",['cross',invoice('b')]),/not_allowed/);
  console.log('ok: director isolation, ownership checks, inherited write denial and allowed finance RPC');
  await login(other);
  assert.deepEqual((await db.query('select id from enfants')).rows.map(r=>r.id),['b']);
  assert.deepEqual((await db.query('select id from paiements')).rows.map(r=>r.id),['pb']);
  await login(pending); assert.equal((await db.query('select id from enfants')).rowCount,0); assert.equal((await db.query('select id from paiements')).rowCount,0);
  await assert.rejects(db.query('insert into enfants values($1,$2)',['blocked',{crecheId:pending}]),/row-level security/);
  await login(adminId); assert.equal((await db.query('select id from paiements')).rowCount,4);
  assert.equal((await db.query("delete from enfants where id='own' returning id")).rowCount,0);
  await db.query("reset role; set role anon; select set_config('request.uid','',false)");
  // A policy helper not executable by anon may raise rather than return zero.
  for (const table of ['enfants','paiements']) { try { assert.equal((await db.query(`select id from ${table}`)).rowCount,0); } catch (err) { assert.match(err.message,/permission denied/); } }
  console.log('ok: other director, pending director, admin and anon with inherited grants');
  await db.query('reset role'); await assert.rejects(db.query(migration('20261108210000_child_finance_rls_guards.sql')),/finance_rls_guard_name_already_exists/); await db.query('rollback');
  await db.query('alter table enfants disable row level security');
  await assert.rejects(db.query(migration('20261108210000_child_finance_rls_guards.sql')),/finance_rls_must_already_be_enabled/); await db.query('rollback');
  console.log('ok: migration refuses duplicate guards and disabled RLS');
  console.log('Local PostgreSQL RLS checks passed. Auth, schema, grants and roles are simulated; deployed Supabase was not tested.');
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
