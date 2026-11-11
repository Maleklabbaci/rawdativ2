import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const migration=name=>fs.readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
const owner='00000000-0000-0000-0000-000000000011',other='00000000-0000-0000-0000-000000000022';

test('reminder preflight checks owner, snapshots, recipient, sibling periods and both sides of suspect pairs',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
   create function public.rawdha_is_admin() returns boolean language sql stable as $$select coalesce(current_setting('request.admin',true),'false')='true'$$;
   create function public.rawdha_is_approved_director() returns boolean language sql stable as $$select coalesce(current_setting('request.approved',true),'false')='true'$$;
   create table public.enfants(id text primary key,data jsonb not null); create table public.paiements(id text primary key,data jsonb not null);
   grant usage on schema public,auth to anon,authenticated; grant select,insert,update,delete on public.paiements to authenticated;`);
  const child={crecheId:owner,prenom:'Lina',nom:'Test',statut:'Actif',parents:[{id:'p1',telephone:'0555123456'}]};
  const invoice={enfantId:'child',montant:1000,statut:'En attente',typeFacture:'Mensuel',moisConcerne:'2025-01',periodeCle:'M:2025-01'};
  const sibling={...invoice,statut:'Payé',moisConcerne:'2024-01',periodeCle:'M:2024-01'};
  await db.query('insert into enfants values($1,$2),($3,$4)',['child',child,'other',{...child,crecheId:other}]);
  await db.query('insert into paiements values($1,$2),($3,$4),($5,$6)',['inv',invoice,'old',sibling,'foreign',{...invoice,enfantId:'other'}]);
  for(const name of ['20261108170000_financial_write_safety.sql','20261108180000_invoice_period_review.sql','20261108190000_invoice_review_corrections.sql','20261108200000_invoice_reminder_preflight.sql']) await db.exec(migration(name));
  await db.exec(`set role authenticated; select set_config('request.uid','${owner}',false); select set_config('request.approved','true',false);`);
  const check=(id,expected,first='Lina',last='Test',phone='0555123456')=>db.query('select public.rawdha_check_invoice_reminder($1,$2,$3,$4,$5) as ok',[id,expected,first,last,phone]).then(r=>r.rows[0].ok);
  assert.equal(await check('inv',{id:'inv',...invoice}),true);
  assert.equal(await check('inv',{id:'inv',...invoice},'Lina','Test',null),true);
  await assert.rejects(check('inv',{id:'inv',...invoice},'Lina','Test','0555987654'),/finance_changed/);
  await assert.rejects(check('inv',{id:'inv',...invoice},'Autre','Test'),/finance_changed/);
  await assert.rejects(check('inv',{id:'inv',...invoice,montant:999}),/finance_changed/);
  await assert.rejects(check('foreign',{id:'foreign',...invoice,enfantId:'other'}),/not_allowed/);
  await assert.rejects(check('old',{id:'old',...sibling}),/finance_invalid_reminder/);
  await db.exec("reset role; update paiements set data=data-'periodeCle' where id='old'; set role authenticated;");
  await assert.rejects(check('inv',{id:'inv',...invoice}),/finance_legacy_review_required/);
  await db.exec("reset role; update paiements set data=jsonb_set(data,'{periodeCle}',to_jsonb('M:2024-13'::text)) where id='old'; set role authenticated;");
  await assert.rejects(check('inv',{id:'inv',...invoice}),/finance_legacy_review_required/);
  await db.exec("reset role; update paiements set data=jsonb_set(data,'{periodeCle}',to_jsonb('M:2024-01'::text)) where id='old'; update paiements set data=data||'{\"doublonSuspect\":{\"targetInvoiceId\":\"inv\",\"eventId\":\"flag\"}}'::jsonb where id='old'; set role authenticated;");
  await assert.rejects(check('inv',{id:'inv',...invoice}),/finance_duplicate_review_pending/);
  await db.exec("reset role; update paiements set data=data-'doublonSuspect' where id='old'; update enfants set data=jsonb_set(data,'{parents,0,telephone}',to_jsonb('0555000000'::text)) where id='child'; set role authenticated;");
  await assert.rejects(check('inv',{id:'inv',...invoice}),/finance_changed/);
  await db.exec("select set_config('request.approved','false',false)");await assert.rejects(check('inv',{id:'inv',...invoice}),/not_allowed/);
  await db.exec('reset role; set role anon');await assert.rejects(check('inv',{id:'inv',...invoice}),/permission denied/);
 } finally {await db.close()}
});
