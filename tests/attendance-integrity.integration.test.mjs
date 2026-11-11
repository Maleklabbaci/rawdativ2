import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/20261108130000_attendance_integrity.sql', import.meta.url), 'utf8');
const owner='00000000-0000-0000-0000-000000000011', other='00000000-0000-0000-0000-000000000022';
const date='2026-11-08';
async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
    create function public.rawdha_is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('request.admin',true),'false') = 'true' $$;
    create function public.rawdha_is_approved_director() returns boolean language sql stable as $$ select coalesce(current_setting('request.approved',true),'false') = 'true' $$;
    create table public.enfants (id text primary key, data jsonb not null default '{}'::jsonb);
    create table public.presences (id text primary key, data jsonb not null default '{}'::jsonb);
    create table public.presence_journees (id text primary key, data jsonb not null default '{}'::jsonb);
    grant usage on schema public,auth to anon,authenticated;
    grant select,insert,update,delete on public.presences,public.presence_journees to anon,authenticated;
  `);
  return db;
}

test('attendance RPC validates isolation, duplicates, stale writes and day lock', async () => {
  const db=await setup();
  try {
    for (const [id,crecheId,statut] of [['a',owner,'Actif'],['b',owner,'Actif'],['c',other,'Actif'],['inactive',owner,'Inactif']])
      await db.query('insert into enfants(id,data) values ($1,$2)',[id,{crecheId,statut}]);
    await db.exec(sql);
    await db.exec(`set role authenticated; select set_config('request.uid','${owner}',false); select set_config('request.approved','true',false);`);
    const rpc=(action,id,patch={},expected=null)=>db.query('select public.rawdha_write_presence($1,$2,$3,$4) as result',[action,id,patch,expected]).then(r=>r.rows[0].result);
    const day=(status,expected=null,creche=owner,d=date)=>db.query('select public.rawdha_write_attendance_day($1,$2,$3,$4) as result',[creche,d,status,expected]).then(r=>r.rows[0].result);
    const a={enfantId:'a',date,statut:'Présent',heureArrivee:'08:30'};
    const b={enfantId:'b',date,statut:'Absent non justifié',motifAbsence:'Signalé'};
    await assert.rejects(rpc('create','bad',{...a,date:'2026-02-31'}), /invalid_attendance_identity/);
    await assert.rejects(rpc('create','bad',{...a,enfantId:'c'}), /not_allowed_or_not_found/);
    await assert.rejects(rpc('create','bad',{...a,enfantId:'inactive'}), /attendance_child_inactive/);
    await assert.rejects(rpc('create','bad',{...a,heureArrivee:'10:00',heureDepart:'09:00'}), /invalid_attendance_times/);
    const saved=await rpc('create','p1',a);
    await assert.rejects(rpc('create','p2',a), /attendance_already_exists/);
    await assert.rejects(day('validee'), /attendance_day_incomplete/);
    await rpc('create','p2',b);
    const changed=await rpc('update','p1',{temperature:'36.5'},saved);
    await assert.rejects(rpc('update','p1',{humeur:'Calme'},saved), /attendance_changed/);
    await assert.rejects(rpc('delete','p1',{},saved), /attendance_changed/);
    await assert.rejects(rpc('update','p1',{enfantId:'b'},changed), /attendance_identity_change_forbidden/);
    const locked=await day('validee');
    assert.equal(locked.valideePar,owner);
    await assert.rejects(rpc('update','p1',{statut:'Absent non justifié'},changed), /attendance_day_locked/);
    await assert.rejects(rpc('delete','p1',{},changed), /attendance_day_locked/);
    await assert.rejects(rpc('create','p3',{enfantId:'b',date:'2026-11-08',statut:'Absent justifié'}), /attendance_already_exists/);
    const departed=await rpc('update','p1',{heureDepart:'16:30'},changed);
    assert.equal(departed.heureDepart,'16:30');
    await assert.rejects(day('ouverte'), /attendance_day_changed/);
    const opened=await day('ouverte',locked);
    assert.equal(opened.statut,'ouverte'); assert.equal(opened.valideeLe,undefined);
    await rpc('delete','p1',{},departed);
    await assert.rejects(day('validee',opened), /attendance_day_incomplete/);
    await assert.rejects(day('ouverte',null,other), /not_allowed_or_not_found/);
    await assert.rejects(db.query("insert into public.presences(id,data) values ('direct','{}')"), /permission denied/);
    await assert.rejects(db.query("update public.presence_journees set data='{}'"), /permission denied/);
    await db.exec("select set_config('request.approved','false',false)");
    await assert.rejects(rpc('create','pending',a), /not_allowed/);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query("select public.rawdha_write_presence('delete','p2','{}',null)"), /permission denied/);
    await db.exec('reset role;');
    // Even a privileged accidental direct insert cannot duplicate child/date.
    await assert.rejects(db.query('insert into public.presences(id,data) values($1,$2)',['direct-duplicate',b]), /unique constraint/);
  } finally { await db.close(); }
});

test('migration refuses duplicates, invalid rows and orphans without changing historical data', async () => {
  const db=await setup();
  try {
    await db.query('insert into public.enfants(id,data) values($1,$2)',['a',{crecheId:owner,statut:'Actif'}]);
    const p={enfantId:'a',date,statut:'Présent',heureArrivee:'08:30'};
    await db.query('insert into public.presences(id,data) values($1,$2),($3,$4)',['p1',p,'p2',p]);
    await assert.rejects(db.exec(sql), /attendance_legacy_duplicates/); await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int as n from public.presences')).rows[0].n,2);
    await db.exec("delete from public.presences where id='p2'");
    await db.query('insert into public.presences(id,data) values ($1,$2)',['orphan',{...p,enfantId:'missing'}]);
    await assert.rejects(db.exec(sql), /attendance_legacy_orphan/); await db.exec('rollback');
    await db.exec("delete from public.presences where id='orphan'");
    await db.query('insert into public.presences(id,data) values ($1,$2)',['bad',{...p,date:'2026-02-31'}]);
    await assert.rejects(db.exec(sql), /attendance_legacy_invalid_rows/); await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int as n from public.presences')).rows[0].n,2);
    await db.exec("delete from public.presences where id='bad'");
    const dayData={crecheId:owner,date,statut:'ouverte'};
    await db.query('insert into public.presence_journees(id,data) values($1,$2),($3,$4)',['d1',dayData,'d2',dayData]);
    await assert.rejects(db.exec(sql), /attendance_day_legacy_duplicates/); await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int as n from public.presence_journees')).rows[0].n,2);
  } finally { await db.close(); }
});
