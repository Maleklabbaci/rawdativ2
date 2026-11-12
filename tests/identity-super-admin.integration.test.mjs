import {PGlite} from '@electric-sql/pglite';import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('identity access and decisions require server-managed super-admin grant', async()=>{const db=new PGlite(),owner='00000000-0000-0000-0000-000000000011',admin='00000000-0000-0000-0000-000000000022',superAdmin='00000000-0000-0000-0000-000000000033';try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create table public.comptes (id text primary key,data jsonb not null);create table public.admin_audit_logs(id text primary key,data jsonb not null);
 create function public.rawdha_is_admin() returns boolean language sql security definer stable as $$select exists(select 1 from public.comptes where id=auth.uid()::text and data->>'role'='admin')$$;
 grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.query('insert into public.comptes values ($1,$2),($3,$4),($5,$6)',[owner,{role:'directeur',prenom:'Amel',nom:'Benali'},admin,{role:'admin',internalAdminRole:'super_admin'},superAdmin,{role:'admin'}]);
 for(const m of ['20261108260000_identity_review_foundation.sql','20261108280000_identity_decision_audit.sql','20261108340000_identity_two_step_guard.sql','20261108350000_identity_ocr_queue.sql','20261108360000_identity_super_admin_access.sql']) await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+m,import.meta.url),'utf8'));
 await db.query('insert into public.identity_super_admins(account_id) values ($1)',[superAdmin]);
 await db.exec('set role service_role');await db.query("select public.rawdha_submit_identity_document($1,'image/jpeg','YWJj')",[owner]);
 assert.equal((await db.query('select public.rawdha_identity_is_super_admin($1) as yes',[superAdmin])).rows[0].yes,true);
 assert.equal((await db.query('select public.rawdha_identity_is_super_admin($1) as yes',[admin])).rows[0].yes,false);
 await assert.rejects(db.query('insert into public.identity_super_admins values ($1,now())',[admin]),/permission denied/);
 await assert.rejects(db.query("select public.rawdha_decide_identity_document($1,$2,'document_reviewed')",[owner,admin]),/super_admin_required/);
 assert.equal((await db.query('select count(*)::int n from public.identity_review_documents')).rows[0].n,1);
 for (const [id,expected] of [[owner,1],[admin,0],[superAdmin,1]]) {await db.exec('reset role;set role authenticated');await db.query("select set_config('request.uid',$1,false)",[id]);assert.equal((await db.query('select count(*)::int n from public.identity_document_reviews')).rows[0].n,expected);await assert.rejects(db.query('select * from public.identity_super_admins'),/permission denied/);await assert.rejects(db.query('select public.rawdha_identity_is_super_admin($1)',[id]),/permission denied/);}
 await db.exec('reset role;set role service_role');await db.query("select public.rawdha_decide_identity_document($1,$2,'document_reviewed')",[owner,superAdmin]);
 assert.equal((await db.query('select count(*)::int n from public.identity_review_documents')).rows[0].n,0);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.admin_audit_logs')).rows[0].n,1);await db.query('delete from public.identity_super_admins where account_id=$1',[superAdmin]);
 await db.exec('set role service_role');await db.query("select public.rawdha_submit_identity_document($1,'image/jpeg','YWJj')",[owner]);await assert.rejects(db.query("select public.rawdha_decide_identity_document($1,$2,'refused')",[owner,superAdmin]),/super_admin_required/);
 }finally{await db.close()}});
