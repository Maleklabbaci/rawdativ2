import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const file=name=>fs.readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
const sqls=['20261108170000_financial_write_safety.sql','20261108180000_invoice_period_review.sql','20261108190000_invoice_review_corrections.sql','20261108200000_invoice_reminder_preflight.sql','20261108210000_child_finance_rls_guards.sql'].map(file);
const owner='00000000-0000-0000-0000-000000000011',other='00000000-0000-0000-0000-000000000022',pending='00000000-0000-0000-0000-000000000033',admin='00000000-0000-0000-0000-000000000044';
const payment=(enfantId,month='2025-01')=>({enfantId,montant:1000,statut:'En attente',typeFacture:'Mensuel',moisConcerne:month,periodeCle:`M:${month}`});
async function setup(){
 const db=new PGlite(); await db.exec(`create role anon; create role authenticated; create role inherited_access; grant inherited_access to authenticated,anon;
  create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
  create function public.rawdha_is_admin() returns boolean language sql stable as $$select coalesce(current_setting('request.admin',true),'false')='true'$$;
  create function public.rawdha_is_approved_director() returns boolean language sql stable as $$select coalesce(current_setting('request.approved',true),'false')='true'$$;
  create table public.enfants(id text primary key,data jsonb not null); create table public.paiements(id text primary key,data jsonb not null);
  alter table enfants enable row level security; alter table paiements enable row level security;
  create policy "allow all enfants" on enfants for all using(true) with check(true); create policy "allow all paiements" on paiements for all using(true) with check(true);
  grant usage on schema public,auth to anon,authenticated,inherited_access;
  grant select,insert,update,delete on enfants,paiements to anon,authenticated,inherited_access;`);
 await db.query('insert into enfants values($1,$2),($3,$4),($5,$6)',['a',{crecheId:owner,statut:'Actif'},'b',{crecheId:other,statut:'Actif'},'p',{crecheId:pending,statut:'Actif'}]);
 await db.query('insert into paiements values($1,$2),($3,$4),($5,$6)',['pa',payment('a'),'pb',payment('b'),'pp',payment('p')]);
 return db;
}
test('restrictive child and financial RLS guards narrow even permissive policies and inherited grants',async()=>{
 const db=await setup();try{
  for(const sql of sqls.slice(0,4))await db.exec(sql);
  await db.exec(`set role authenticated; select set_config('request.uid','${owner}',false); select set_config('request.approved','true',false);`);
  assert.equal((await db.query('select id from enfants')).rows.length,3); // legacy allow-all leak
  assert.equal((await db.query('select id from paiements')).rows.length,3);
  await db.exec('reset role');await db.exec(sqls[4]);
  await db.exec(`set role authenticated; select set_config('request.uid','${owner}',false); select set_config('request.approved','true',false);`);
  assert.deepEqual((await db.query('select id from enfants order by id')).rows.map(r=>r.id),['a']);
  assert.deepEqual((await db.query('select id from paiements order by id')).rows.map(r=>r.id),['pa']);
  assert.equal((await db.query("update enfants set data=data||'{\"nom\":\"ok\"}'::jsonb where id='a' returning id")).rows.length,1);
  assert.equal((await db.query("update enfants set data='{}' where id='b' returning id")).rows.length,0);
  await assert.rejects(db.query("update enfants set data=jsonb_set(data,'{crecheId}',to_jsonb($1::text)) where id='a'",[other]),/row-level security/);
  await assert.rejects(db.query('insert into enfants values($1,$2)',['forged',{crecheId:other}]),/row-level security/);
  await db.query('insert into enfants values($1,$2)',['own',{crecheId:owner}]);
  assert.equal((await db.query("delete from enfants where id='own' returning id")).rows.length,0);
  assert.equal((await db.query("update paiements set data='{}' where id='pa' returning id")).rows.length,0);
  await assert.rejects(db.query('insert into paiements values($1,$2)',['new',payment('a','2025-02')]),/row-level security/);
  assert.equal((await db.query("select public.rawdha_write_invoice('create',$1,$2,null) as r",['rpc-ok',payment('a','2025-02')])).rows[0].r.id,'rpc-ok');
  await assert.rejects(db.query("select public.rawdha_write_invoice('create',$1,$2,null)",['rpc-cross',payment('b','2025-03')]),/not_allowed/);
  await db.exec(`select set_config('request.uid','${pending}',false); select set_config('request.approved','false',false)`);
  assert.equal((await db.query('select id from enfants')).rows.length,0);assert.equal((await db.query('select id from paiements')).rows.length,0);
  await assert.rejects(db.query('insert into enfants values($1,$2)',['pending-new',{crecheId:pending}]),/row-level security/);
  await db.exec(`select set_config('request.uid','${admin}',false); select set_config('request.admin','true',false)`);
  assert.equal((await db.query('select id from paiements')).rows.length,4);assert.ok((await db.query('select id from enfants')).rows.length>=3);
  // Even an admin cannot bypass the application's direct-write pause through RLS.
  assert.equal((await db.query("delete from enfants where id='own' returning id")).rows.length,0);
  await db.exec("reset role; set role anon; select set_config('request.uid','',false); select set_config('request.admin','false',false)");assert.equal((await db.query('select * from enfants')).rows.length,0);assert.equal((await db.query('select * from paiements')).rows.length,0);
  await db.exec('reset role');await assert.rejects(db.exec(sqls[4]),/finance_rls_guard_name_already_exists/);await db.exec('rollback');
  assert.ok((await db.query("select policyname from pg_policies where tablename='enfants' and policyname='allow all enfants'")).rows.length);
 }finally{await db.close()}
});
test('guard migration refuses disabled RLS without touching policies',async()=>{
 const db=await setup();try{
  for(const sql of sqls.slice(0,4))await db.exec(sql);
  await db.exec('alter table enfants disable row level security');await assert.rejects(db.exec(sqls[4]),/finance_rls_must_already_be_enabled/);await db.exec('rollback');
  assert.equal((await db.query("select count(*)::int as n from pg_policies where policyname='rawdha_child_read_guard'")).rows[0].n,0);
 }finally{await db.close()}
});
