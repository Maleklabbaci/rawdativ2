import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const safety = fs.readFileSync(new URL('../supabase/migrations/20261108170000_financial_write_safety.sql',import.meta.url),'utf8');
const review = fs.readFileSync(new URL('../supabase/migrations/20261108180000_invoice_period_review.sql',import.meta.url),'utf8');
const owner='00000000-0000-0000-0000-000000000011', other='00000000-0000-0000-0000-000000000022';
async function setup(){
 const db=new PGlite(); await db.exec(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
 create function public.rawdha_is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('request.admin',true),'false')='true' $$;
 create function public.rawdha_is_approved_director() returns boolean language sql stable as $$ select coalesce(current_setting('request.approved',true),'false')='true' $$;
 create table public.enfants(id text primary key,data jsonb not null); create table public.paiements(id text primary key,data jsonb not null);
 grant usage on schema public,auth to anon,authenticated; grant select,insert,update,delete on public.paiements to anon,authenticated;`);
 await db.query('insert into enfants values($1,$2),($3,$4)',['c',{crecheId:owner,statut:'Actif'},'other',{crecheId:other,statut:'Actif'}]);
 return db;
}
const old=(child='c',period='Janvier 2025')=>({id:'embedded-legacy-id',enfantId:child,moisConcerne:period,statut:'Payé',montant:9000,custom:'retain original'});
const draft=(key)=>({enfantId:'c',montant:100,statut:'En attente',typeFacture:'Mensuel',moisConcerne:key,periodeCle:`M:${key}`});
test('manual review preserves history, rejects conflicts, checks snapshots and unblocks only reviewed children',async()=>{
 const db=await setup();
 try{
  await db.query('insert into paiements values($1,$2),($3,$4),($5,$6)',['old1',old(),'old2',old('c','Février 2025'),'foreign',old('other')]);
  await db.exec(safety); await db.exec(review);
  await db.exec(`set role authenticated; select set_config('request.uid','${owner}',false); select set_config('request.approved','true',false);`);
  const classify=(id,expected,key,reason='Vérifié avec le registre papier',confirmed=true)=>db.query('select public.rawdha_review_invoice_period($1,$2,$3,$4,$5) as r',[id,expected,key,reason,confirmed]).then(r=>r.rows[0].r);
  const get=id=>db.query('select public.rawdha_get_invoice_period_review($1) as r',[id]).then(r=>r.rows[0].r);
  const create=(id,body)=>db.query("select public.rawdha_write_invoice('create',$1,$2,null)",[id,body]);
  const first={...old(),id:'old1'}, second={...old('c','Février 2025'),id:'old2'};
  await assert.rejects(create('new',draft('2026-01')),/finance_legacy_review_required/);
  await assert.rejects(classify('foreign',{...old('other'),id:'foreign'},'M:2025-01'),/not_allowed_or_not_found/);
  await assert.rejects(classify('old1',first,'M:2025-01','',true),/finance_invalid_review/);
  await assert.rejects(classify('old1',first,'M:2025-01','source',false),/finance_invalid_review/);
  await assert.rejects(classify('old1',first,'M:0000-01'),/finance_invalid_period/);
  await assert.rejects(classify('old1',{...first,montant:1},'M:2025-01'),/finance_changed/);
  const saved=await classify('old1',first,'M:2025-01');
  assert.equal(saved.moisConcerne,'Janvier 2025'); assert.equal(saved.custom,'retain original');
  assert.deepEqual(await classify('old1',first,'M:2025-01'),saved);
  const record=await get('old1'); assert.equal(record.reviewedBy,owner); assert.deepEqual(record.originalData,old()); assert.equal(record.periodKey,'M:2025-01');
  await assert.rejects(classify('old1',first,'M:2025-02'),/finance_review_already_classified/);
  await assert.rejects(classify('old2',second,'M:2025-01'),/finance_period_overlap/);
  await assert.rejects(classify('old2',second,'A:2025'),/finance_period_overlap/);
  await assert.rejects(create('new',draft('2026-01')),/finance_legacy_review_required/);
  await classify('old2',second,'M:2025-02'); await create('new',draft('2026-01'));
  await assert.rejects(create('dup',draft('2025-01')),/finance_period_overlap/);
  assert.equal(await get('new'),null);
  await assert.rejects(db.query("select * from public.rawdha_invoice_period_reviews"),/permission denied/);
  await assert.rejects(db.query("update public.rawdha_invoice_period_reviews set reason='x'"),/permission denied/);
  await db.exec("select set_config('request.approved','false',false)"); await assert.rejects(get('old1'),/not_allowed/);
  await db.exec(`reset role; update enfants set data=jsonb_set(data,'{crecheId}',to_jsonb('${other}'::text)) where id='c'; set role authenticated; select set_config('request.uid','${other}',false); select set_config('request.approved','true',false);`);
  assert.equal(await get('old1'),null); // review history is not silently transferred to another owner
  await db.exec('reset role; set role anon'); await assert.rejects(get('old1'),/permission denied/);
 }finally{await db.close()}
});
test('existing review table aborts installation without damaging records',async()=>{
 const db=await setup(); try{
  await db.exec(safety); await db.exec('create table public.rawdha_invoice_period_reviews(existing text); insert into public.rawdha_invoice_period_reviews values(\'keep\')');
  await assert.rejects(db.exec(review),/finance_review_table_already_exists/); await db.exec('rollback');
  assert.equal((await db.query('select existing from public.rawdha_invoice_period_reviews')).rows[0].existing,'keep');
 } finally{await db.close()}
});
