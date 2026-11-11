import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
test('class RPC validates ownership, capacity, duplicates, stale writes and privileges', async () => {
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true),'')::uuid $$; create function public.rawdha_is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('request.admin',true),'false') = 'true' $$; create function public.rawdha_is_approved_director() returns boolean language sql stable as $$ select coalesce(current_setting('request.approved',true),'false') = 'true' $$; create table public.classes (id text primary key, data jsonb not null default '{}'::jsonb); create table public.enfants (id text primary key, data jsonb not null default '{}'::jsonb); grant usage on schema public,auth to authenticated; grant select,insert,update,delete on classes to authenticated; grant select on enfants to authenticated;`);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108090000_class_assignment_safety.sql', import.meta.url), 'utf8'));
const owner='00000000-0000-0000-0000-000000000011', other='00000000-0000-0000-0000-000000000022';
for(const [id,crecheId,statut] of [['a',owner,'Actif'],['b',owner,'Actif'],['c',owner,'Actif'],['inactive',owner,'Inactif'],['other',other,'Actif']]) await db.query('insert into enfants(id,data) values ($1,$2)',[id,{crecheId,statut}]);
await db.exec(`set role authenticated; select set_config('request.uid','${owner}',false); select set_config('request.approved','true',false);`);
const rpc=(action,id,patch={},expected=null)=>db.query('select public.rawdha_write_classe($1,$2,$3,$4) as result',[action,id,patch,expected]);
const cls=(name,cap)=>({crecheId:owner,nom:name,niveau:'Bébés',capacite:cap});
async function rejects(fn, msg) {await assert.rejects(fn, e=>e.message.includes(msg), msg); console.log('OK rejected',msg);}
await rejects(()=>rpc(null,'cl1',{}),'invalid_class_request');
await rpc('create','cl1',cls('classe 1',1)); await rpc('create','cl2',cls('classe 2',2));
await rpc('update','cl1',{childrenIds:['a']},[]);
await rejects(()=>rpc('update','cl1',{childrenIds:['a','b']},['a']),'class_capacity_exceeded');
await rejects(()=>rpc('update','cl2',{childrenIds:['a']},[]),'child_already_assigned');
await rejects(()=>rpc('update','cl2',{childrenIds:['other']},[]),'invalid_or_inactive_child');
await rejects(()=>rpc('update','cl2',{childrenIds:['inactive']},[]),'invalid_or_inactive_child');
await rejects(()=>rpc('update','cl2',{childrenIds:['b','b']},[]),'duplicate_class_children');
await rejects(()=>db.query("update classes set data = '{}'::jsonb where id='cl1'"),'permission denied');
await db.exec(`select set_config('request.uid','${other}',false);`);
await rejects(()=>rpc('update','cl1',{nom:'Oops'}),'not_allowed_or_not_found');
await db.exec(`select set_config('request.uid','${owner}',false); select set_config('request.approved','false',false);`);
await rejects(()=>rpc('update','cl1',{nom:'Oops'}),'not_allowed');
await db.exec(`select set_config('request.approved','true',false);`);
await rejects(()=>rpc('update','cl1',{childrenIds:['b']},[]),'class_membership_changed');
await rpc('update','cl1',{childrenIds:[]},['a']); await rpc('update','cl2',{childrenIds:['a']},[]);
assert.equal((await db.query("select data->'childrenIds' as ids from classes where id='cl2'")).rows[0].ids[0],'a');
console.log('OK remove then move'); await db.close();

});
