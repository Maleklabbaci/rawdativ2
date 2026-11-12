import {PGlite} from '@electric-sql/pglite';import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('pending Auth hook followed by service-only atomic setup enables trial without identity document',async()=>{const db=new PGlite();const id='00000000-0000-0000-0000-000000000011', email='amel@example.invalid';try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create table public.comptes(id text primary key,data jsonb not null default '{}'::jsonb,created_at timestamptz default now());
 create table public.parametres(id text primary key,data jsonb not null default '{}'::jsonb);
 create function public.rawdha_is_admin() returns boolean language sql security definer stable as $$select exists(select 1 from public.comptes where id=auth.uid()::text and data->>'role'='admin')$$;
 grant usage on schema public,auth to authenticated,anon,service_role;`);
 for(const m of ['20261108100000_account_privilege_safety.sql','20261108110000_explicit_director_approval.sql','20261108270000_director_onboarding.sql','20261108370000_director_signup_initialization.sql']) await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+m,import.meta.url),'utf8'));
 await db.query('insert into auth.users values ($1,$2,$3)',[id,email,{role:'directeur',prenom:'Amel',nom:'Benali',nomCreche:'Crèche test'}]);
 let account=(await db.query('select data from public.comptes where id=$1',[id])).rows[0].data;assert.equal(account.approvalStatus,'pending');assert.equal(account.abonnementActif,false);
 await db.exec('set role authenticated');await assert.rejects(db.query('select public.rawdha_signup_take_slot()'),/permission denied/);await assert.rejects(db.query('select * from public.director_signup_attempts'),/permission denied/);
 const init="select public.rawdha_initialize_director_signup($1,$2,'Amel','Benali','0550123456','Crèche test','Alger','')";
 await assert.rejects(db.query(init,[id,email]),/permission denied/);
 await db.exec('reset role;set role service_role');await assert.rejects(db.query(init,[id,'incorrect@example.invalid']),/signup_auth_mismatch/);
 assert.equal((await db.query('select public.rawdha_signup_take_slot() as yes')).rows[0].yes,true);
 await db.query(init,[id,email]);await db.exec('reset role');account=(await db.query('select data from public.comptes where id=$1',[id])).rows[0].data;
 assert.equal(account.approvalStatus,'approved');assert.equal(account.abonnementActif,true);assert.equal(account.prenom,'Amel');assert.equal((await db.query("select (data->>'dateFinAbonnement')::date - (now() at time zone 'UTC')::date as days from public.comptes where id=$1",[id])).rows[0].days,15);
 assert.equal((await db.query('select step from public.director_onboarding where account_id=$1',[id])).rows[0].step,'welcome');assert.equal((await db.query('select verified_at from public.director_email_verification where account_id=$1',[id])).rows[0].verified_at,null);assert.equal((await db.query('select data from public.parametres where id=$1',['creche_'+id])).rows[0].data.crecheName,'Crèche test');
 await db.exec('set role authenticated');await assert.rejects(db.query("update public.director_email_verification set verified_at=now()"),/permission denied/);
 await db.exec('reset role;set role service_role');await assert.rejects(db.query(init,[id,email]),/signup_account_already_initialized/);
 for(let i=1;i<20;i++) assert.equal((await db.query('select public.rawdha_signup_take_slot() as yes')).rows[0].yes,true);
 assert.equal((await db.query('select public.rawdha_signup_take_slot() as yes')).rows[0].yes,false);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int as n from public.director_signup_attempts')).rows[0].n,20);
 }finally{await db.close()}});

test('database setup rolls back profile and settings if onboarding insert fails',async()=>{const db=new PGlite(), id='00000000-0000-0000-0000-000000000011';try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;create table auth.users(id uuid,email text);
 create table public.comptes(id text primary key,data jsonb not null);create table public.parametres(id text primary key,data jsonb not null);
 create table public.director_onboarding(account_id text primary key,step text check (step='never'));
 grant usage on schema public,auth to service_role;`);
 await db.query("insert into auth.users values ($1,'x@example.invalid')",[id]);await db.query("insert into public.comptes values ($1,'{\"role\":\"directeur\",\"approvalStatus\":\"pending\"}')",[id]);
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108370000_director_signup_initialization.sql',import.meta.url),'utf8'));await db.exec('set role service_role');
 await assert.rejects(db.query("select public.rawdha_initialize_director_signup($1,'x@example.invalid','Amel','Benali','0550123456','Test','Alger','')",[id]),/check constraint/);
 await db.exec('reset role');assert.equal((await db.query('select data from public.comptes where id=$1',[id])).rows[0].data.approvalStatus,'pending');assert.equal((await db.query('select count(*)::int n from public.parametres')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from public.director_email_verification')).rows[0].n,0);
 }finally{await db.close()}});
