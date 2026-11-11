import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>fs.readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
const sqls=['20261108170000_financial_write_safety.sql','20261108180000_invoice_period_review.sql','20261108190000_invoice_review_corrections.sql'].map(read);
const owner='00000000-0000-0000-0000-000000000011', other='00000000-0000-0000-0000-000000000022';
const old=(child='child',label='Janvier')=>({enfantId:child,moisConcerne:label,montant:15000,statut:'Payé',notes:'avant'});
async function setup(){
 const db=new PGlite(); await db.exec(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create function public.rawdha_is_admin() returns boolean language sql stable as $$select coalesce(current_setting('request.admin',true),'false')='true'$$;
 create function public.rawdha_is_approved_director() returns boolean language sql stable as $$select coalesce(current_setting('request.approved',true),'false')='true'$$;
 create table public.enfants(id text primary key,data jsonb not null); create table public.paiements(id text primary key,data jsonb not null);
 grant usage on schema public,auth to anon,authenticated; grant select,insert,update,delete on public.paiements to anon,authenticated;`);
 await db.query('insert into enfants values($1,$2),($3,$4)',['child',{crecheId:owner,statut:'Actif'},'outside',{crecheId:other,statut:'Actif'}]);
 await db.query('insert into paiements values($1,$2),($3,$4),($5,$6),($7,$8)',['one',old(),'two',old('child','Février'),'foreign',old('outside'),'three',{...old('child','2025-03'),typeFacture:'Mensuel',periodeCle:'M:2025-03'}]);
 return db;
}
test('period corrections and suspected duplicates preserve amounts and require verified snapshots',async()=>{
 const db=await setup();try{
  for(const sql of sqls) await db.exec(sql);
  await db.exec(`set role authenticated; select set_config('request.uid','${owner}',false); select set_config('request.approved','true',false);`);
  const review=(id,expected,key)=>db.query('select public.rawdha_review_invoice_period($1,$2,$3,$4,true) as r',[id,expected,key,'preuve']).then(r=>r.rows[0].r);
  const write=(action,id,patch,expected=null)=>db.query('select public.rawdha_write_invoice($1,$2,$3,$4) as r',[action,id,patch,expected]).then(r=>r.rows[0].r);
  const act=(request,action,invoice,expected,key=null,target=null,targetExpected=null,reason='Vérifié',confirmed=true)=>db.query('select public.rawdha_invoice_review_action($1,$2,$3,$4,$5,$6,$7,$8,$9) as r',[request,action,invoice,expected,key,target,targetExpected,reason,confirmed]).then(r=>r.rows[0].r);
  const history=id=>db.query('select public.rawdha_list_invoice_review_events($1) as r',[id]).then(r=>r.rows[0].r);
  const one={id:'one',...old()}, two={id:'two',...old('child','Février')};
  const first=await review('one',one,'M:2025-01');
  await assert.rejects(act('bad','correct_period','one',{...first,montant:1},'M:2025-02'),/finance_changed/);
  await assert.rejects(act('bad','correct_period','one',first,'M:2025-02',null,null,'',true),/finance_invalid_review_action/);
  const corrected=await act('change1','correct_period','one',first,'M:2025-02');
  await assert.rejects(act('overlap','correct_period','one',corrected,'M:2025-03'),/finance_period_overlap/);
  await assert.rejects(act('overlap','correct_period','one',corrected,'A:2025'),/finance_period_overlap/);
  assert.equal(corrected.periodeCle,'M:2025-02'); assert.equal(corrected.moisConcerne,'Janvier'); assert.equal(corrected.montant,15000); assert.equal(corrected.statut,'Payé');
  assert.deepEqual(await act('change1','correct_period','one',first,'M:2025-02'),corrected);
  await assert.rejects(act('change1','correct_period','one',first,'M:2025-03'),/finance_review_request_conflict/);
  await assert.rejects(review('two',two,'M:2025-02'),/finance_period_overlap/);
  await assert.rejects(act('x','flag_duplicate','two',two,null,'one',{...corrected,montant:9}),/finance_changed/);
  await assert.rejects(act('x','flag_duplicate','two',two,null,'foreign',{id:'foreign',...old('outside')}),/finance_invalid_duplicate_target/);
  await assert.rejects(act('forged','flag_duplicate','two',two,null,'one',corrected,'raison',false),/finance_invalid_review_action/);
  const flagged=await act('flag1','flag_duplicate','two',two,null,'one',corrected);
  assert.deepEqual(await act('flag1','flag_duplicate','two',two,null,'one',corrected),flagged);
  await assert.rejects(act('flag2','flag_duplicate','one',corrected,null,'two',flagged),/finance_duplicate_review_pending/);
  assert.equal(flagged.doublonSuspect.targetInvoiceId,'one'); assert.equal(flagged.montant,15000); assert.equal(flagged.statut,'Payé');
  await assert.rejects(write('update','one',{notes:'autre'},corrected),/finance_duplicate_review_pending/);
  await assert.rejects(write('update','two',{notes:'autre'},flagged),/finance_duplicate_review_pending/);
  await assert.rejects(review('two',flagged,'M:2025-03'),/finance_duplicate_review_pending/);
  await assert.rejects(act('x','correct_period','one',corrected,'M:2025-03'),/finance_duplicate_review_pending/);
  await assert.rejects(write('create','new',{enfantId:'child',montant:10,statut:'En attente',typeFacture:'Mensuel',moisConcerne:'2026-01',periodeCle:'M:2026-01'}),/finance_duplicate_review_pending/);
  const events=await history('two'); assert.equal(events.length,1); assert.equal(events[0].targetInvoiceId,'one'); assert.equal(events[0].targetBefore.montant,15000);
  const cleared=await act('clear1','clear_suspicion','two',flagged,null,null,null,'Non doublon après vérification');
  assert.equal(cleared.doublonSuspect,undefined); assert.equal(cleared.statut,'Payé'); assert.equal((await history('two')).length,2);
  await write('update','one',{notes:'nouvelle note'},corrected);
  await assert.rejects(act('change1','correct_period','one',first,'M:2025-02'),/finance_review_request_conflict/);
  await assert.rejects(db.query('select * from public.rawdha_invoice_review_events'),/permission denied/);
  await assert.rejects(db.query('delete from public.rawdha_invoice_review_events'),/permission denied/);
  await assert.rejects(db.query("select public.rawdha_write_invoice_internal('delete','one','{}',null)"),/permission denied/);
  await assert.rejects(db.query("select public.rawdha_review_invoice_period_internal('one','{}','M:2025-01','x',true)"),/permission denied/);
  await db.exec("select set_config('request.approved','false',false)"); await assert.rejects(history('one'),/not_allowed/);
  await db.exec(`reset role; update enfants set data=jsonb_set(data,'{crecheId}',to_jsonb('${other}'::text)) where id='child'; set role authenticated; select set_config('request.uid','${other}',false); select set_config('request.approved','true',false);`);
  assert.deepEqual(await history('two'),[]); // traces remain scoped to the original creche
  await db.exec('reset role; set role anon'); await assert.rejects(history('two'),/permission denied/);
 }finally{await db.close()}
});
test('migration preflight refuses pre-existing markers or review event table',async()=>{
 const db=await setup();try{
  await db.exec(sqls[0]); await db.exec(sqls[1]);
  await db.exec("update paiements set data=data||'{\"doublonSuspect\":{}}'::jsonb where id='one'");
  await assert.rejects(db.exec(sqls[2]),/finance_existing_duplicate_marker/);await db.exec('rollback');
  assert.equal((await db.query("select data ? 'doublonSuspect' as present from paiements where id='one'")).rows[0].present,true);
  await db.exec("update paiements set data=data-'doublonSuspect' where id='one'; create table public.rawdha_invoice_review_events(original text); insert into public.rawdha_invoice_review_events values('keep')");
  await assert.rejects(db.exec(sqls[2]),/finance_events_table_already_exists/);await db.exec('rollback');
  assert.equal((await db.query('select original from public.rawdha_invoice_review_events')).rows[0].original,'keep');
 }finally{await db.close()}
});
