import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../supabase/migrations/20261108170000_financial_write_safety.sql',import.meta.url),'utf8');
const owner='00000000-0000-0000-0000-000000000011', other='00000000-0000-0000-0000-000000000022';
async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
 create function public.rawdha_is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('request.admin',true),'false')='true' $$;
 create function public.rawdha_is_approved_director() returns boolean language sql stable as $$ select coalesce(current_setting('request.approved',true),'false')='true' $$;
 create table public.enfants(id text primary key,data jsonb not null); create table public.paiements(id text primary key,data jsonb not null);
 grant usage on schema public,auth to anon,authenticated; grant select,insert,update,delete on public.paiements to anon,authenticated;`);
 for(const [id,creche,statut] of [['c',owner,'Actif'],['legacy',owner,'Actif'],['inactive',owner,'Inactif'],['other',other,'Actif']]) await db.query('insert into enfants values($1,$2)',[id,{crecheId:creche,statut}]);
 return db;
}
const month=(child='c',key='2026-01')=>({enfantId:child,montant:12000,statut:'En attente',typeFacture:'Mensuel',moisConcerne:key,periodeCle:`M:${key}`});
test('invoice RPC preserves legacy data and guards authorization, periods and stale writes',async()=>{
 const db=await setup();
 try{
  const legacy={enfantId:'legacy',montant:12000,statut:'Payé',moisConcerne:'janvier 2025',custom:'preserved'};
  await db.query('insert into paiements values($1,$2)',['old',legacy]); await db.exec(sql);
  await db.exec(`set role authenticated; select set_config('request.uid','${owner}',false); select set_config('request.approved','true',false);`);
  const rpc=(a,id,p,expected=null)=>db.query('select public.rawdha_write_invoice($1,$2,$3,$4) as r',[a,id,p,expected]).then(r=>r.rows[0].r);
  await assert.rejects(rpc('create','wrong',month('other')),/not_allowed_or_not_found/);
  await assert.rejects(rpc('create','inactive',month('inactive')),/finance_child_inactive/);
  await assert.rejects(rpc('create','old-new',month('legacy')),/finance_legacy_review_required/);
  await assert.rejects(rpc('create','invalid',month('c','2026-13')),/finance_invalid_period/);
  await assert.rejects(rpc('create','invalid-year',month('c','0000-01')),/finance_invalid_period/);
  await assert.rejects(rpc('create','zero',{...month(),montant:0}),/finance_invalid_amount/);
  await assert.rejects(rpc('create','date',{...month(),dateEcheance:'2026-02-31'}),/finance_invalid_date/);
  const first=await rpc('create','p1',month()); assert.equal(first.periodeCle,'M:2026-01');
  assert.deepEqual(await rpc('create','p1',month()),first);
  await assert.rejects(rpc('create','p1',{...month(),montant:1}),/finance_request_id_conflict/);
  await assert.rejects(rpc('create','p2',month()),/finance_period_overlap/);
  await assert.rejects(rpc('create','annual',{enfantId:'c',montant:100,statut:'En attente',typeFacture:'Annuel',moisConcerne:'2026',periodeCle:'A:2026'}),/finance_period_overlap/);
  await rpc('create','other-month',month('c','2026-02'));
  await rpc('create','annual-2027',{enfantId:'c',montant:100,statut:'En attente',typeFacture:'Annuel',moisConcerne:'2027',periodeCle:'A:2027'});
  await assert.rejects(rpc('create','month-in-annual',month('c','2027-01')),/finance_period_overlap/);
  const changed=await rpc('update','p1',{statut:'Payé',moyenPaiement:'Espèces'},first);
  await assert.rejects(rpc('update','p1',{montant:100},first),/finance_changed/);
  await assert.rejects(rpc('update','p1',{enfantId:'other'},changed),/finance_identity_immutable/);
  const next=await rpc('update','p1',{moyenPaiement:null},changed); assert.equal(next.moyenPaiement,undefined);
  const savedLegacy=await rpc('update','old',{notes:'suivi'},{id:'old',...legacy}); assert.equal(savedLegacy.custom,'preserved'); assert.equal(savedLegacy.periodeCle,undefined);
  await assert.rejects(rpc('delete','old',{},savedLegacy),/finance_invalid_request/);
  await assert.rejects(db.query("insert into paiements values ('bad','{}')"),/permission denied/);
  await assert.rejects(db.query("delete from paiements where id='p1'"),/permission denied/);
  await db.exec("select set_config('request.approved','false',false)"); await assert.rejects(rpc('update','p1',{notes:'x'},next),/not_allowed/);
  await db.exec('reset role; set role anon;'); await assert.rejects(rpc('update','p1',{},next),/permission denied/);
 }finally{await db.close()}
});
test('preflight stops for malformed keyed rows, duplicate keys and annual overlaps without rewriting history',async()=>{
 const db=await setup();
 try{
  await db.query('insert into paiements values($1,$2)',['bad',{...month(),periodeCle:'M:bad'}]);
  await assert.rejects(db.exec(sql),/finance_legacy_invalid_keyed_rows/); await db.exec('rollback');
  assert.equal((await db.query('select data from paiements where id=$1',['bad'])).rows[0].data.periodeCle,'M:bad');
  await db.exec('delete from paiements');
  await db.query('insert into paiements values($1,$2)',['orphan',{enfantId:'missing',moisConcerne:'janvier'}]);
  await assert.rejects(db.exec(sql),/finance_legacy_orphan_or_invalid/); await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int as n from paiements')).rows[0].n,1);
  await db.exec('delete from paiements');
  await db.query('insert into paiements values($1,$2),($3,$4)',['a',month(),'b',month()]);
  await assert.rejects(db.exec(sql),/finance_legacy_keyed_duplicates/); await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int as n from paiements')).rows[0].n,2);
  await db.exec("delete from paiements where id='b'");
  await db.query('insert into paiements values($1,$2)',['a2026',{enfantId:'c',periodeCle:'A:2026',typeFacture:'Annuel',moisConcerne:'2026'}]);
  await assert.rejects(db.exec(sql),/finance_legacy_period_overlap/); await db.exec('rollback');
 }finally{await db.close()}
});
