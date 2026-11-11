import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const migration = name => fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const owner='00000000-0000-0000-0000-000000000011', other='00000000-0000-0000-0000-000000000022', date='2026-11-08';

test('server confirmation requires a live authorization and protects attestation fields', async () => {
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
    create function public.rawdha_is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('request.admin',true),'false')='true' $$;
    create function public.rawdha_is_approved_director() returns boolean language sql stable as $$ select coalesce(current_setting('request.approved',true),'false')='true' $$;
    create table public.enfants(id text primary key,data jsonb not null);
    create table public.presences(id text primary key,data jsonb not null);
    create table public.presence_journees(id text primary key,data jsonb not null);
    grant usage on schema public,auth to anon,authenticated;
    grant select,insert,update,delete on public.presences,public.presence_journees to authenticated;`);
  await db.query('insert into enfants values($1,$2),($3,$4)', ['a',{crecheId:owner,statut:'Actif'},'b',{crecheId:other,statut:'Actif'}]);
  await db.exec(migration('20261108130000_attendance_integrity.sql'));
  await db.exec(migration('20261108140000_pickup_authorizations.sql'));
  await db.exec(migration('20261108150000_atomic_pickup_departure.sql'));
  await db.exec(`set role authenticated; select set_config('request.uid','${owner}',false); select set_config('request.approved','true',false);`);
  const write=(action,id,patch,expected=null)=>db.query('select public.rawdha_write_presence($1,$2,$3,$4) result',[action,id,patch,expected]).then(r=>r.rows[0].result);
  const auth=(action,child,id)=>db.query('select public.rawdha_write_pickup_authorization($1,$2,$3,$4,$5,$6,$7) result',[action,child,id,'Samir','Oncle','','Dossier papier']).then(r=>r.rows[0].result);
  const departure=(id,expected,authId,time='16:30',checked=true)=>db.query('select public.rawdha_confirm_pickup_departure($1,$2,$3,$4,$5) result',[id,expected,authId,time,checked]).then(r=>r.rows[0].result);
  const presence=await write('create','p',{enfantId:'a',date,statut:'Présent',heureArrivee:'08:30'});
  await auth('create','a','author1');
  await assert.rejects(write('create','forged',{enfantId:'a',date:'2026-11-09',statut:'Présent',heureArrivee:'08:30',departVerifie:true}),/pickup_confirmation_requires_registry/);
  await assert.rejects(write('update','p',{departVerifie:true},presence),/pickup_confirmation_requires_registry/);
  await assert.rejects(write('update','p',{departVerifiePar:owner},presence),/pickup_confirmation_requires_registry/);
  await assert.rejects(db.query("select public.rawdha_write_presence_internal('update','p','{}',null)"),/permission denied/);
  await assert.rejects(departure('p',presence,'author1','16:30',false),/pickup_check_required/);
  await assert.rejects(departure('p',presence,'missing'),/pickup_authorization_inactive/);
  await assert.rejects(departure('p',presence,'author1',null),/invalid_attendance_times/);
  await assert.rejects(departure('p',presence,'author1','07:30'),/invalid_attendance_times/);
  const changed=await write('update','p',{temperature:'36.5'},presence);
  await assert.rejects(departure('p',presence,'author1'),/attendance_changed/);
  await auth('revoke','a','author1');
  await assert.rejects(departure('p',changed,'author1'),/pickup_authorization_inactive/);
  await auth('create','a','author2');
  await db.query('select public.rawdha_write_attendance_day($1,$2,$3,$4)',[owner,date,'validee',null]);
  const done=await departure('p',changed,'author2');
  assert.equal(done.personneRecuperation,'Samir');assert.equal(done.personneRecuperationId,'registry-author2');assert.equal(done.departVerifie,true);assert.equal(done.departVerifiePar,owner);assert.ok(done.departVerifieLe);
  await assert.rejects(departure('p',done,'author2'),/pickup_presence_invalid/);
  await auth('revoke','a','author2');
  const observed=await write('update','p',{humeur:'Calme'},done);
  assert.equal(observed.departVerifie,true); // later revocation does not rewrite history
  const amended=await write('update','p',{heureDepart:'17:00'},observed);
  assert.equal(amended.departVerifie,false);assert.equal(amended.personneRecuperationId,'');
  await db.exec(`select set_config('request.uid','${other}',false)`);
  await assert.rejects(departure('p',amended,'author2'),/not_allowed_or_not_found/);
  await db.exec("select set_config('request.approved','false',false)");
  await assert.rejects(departure('p',amended,'author2'),/not_allowed/);
  await db.exec('reset role; set role anon');
  await assert.rejects(departure('p',amended,'author2'),/permission denied/);
 } finally { await db.close(); }
});
