import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql = fs.readFileSync(new URL('../supabase/migrations/20261108160000_child_health_journal.sql',import.meta.url),'utf8');
const owner='00000000-0000-0000-0000-000000000011', other='00000000-0000-0000-0000-000000000022';
async function setup() {
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
  create function public.rawdha_is_approved_director() returns boolean language sql stable as $$ select coalesce(current_setting('request.approved',true),'false')='true' $$;
  create function public.rawdha_valid_attendance_date(p text) returns boolean language plpgsql immutable as $$ begin
    if p is null or p !~ '^\\d{4}-\\d{2}-\\d{2}$' then return false; end if;
    return to_char(p::date,'YYYY-MM-DD')=p; exception when invalid_datetime_format or datetime_field_overflow then return false; end $$;
  create table public.enfants(id text primary key,data jsonb not null);
  grant usage on schema public,auth to anon,authenticated;`);
 await db.query('insert into enfants values($1,$2),($3,$4)', ['a',{crecheId:owner},'b',{crecheId:other}]);
 return db;
}
test('health journal restricts read/write to owner, validates fields and retains corrections',async()=>{
 const db=await setup();try {
  await db.exec(sql);await db.exec(`set role authenticated; select set_config('request.uid','${owner}',false); select set_config('request.approved','true',false);`);
  const list=(child)=>db.query('select public.rawdha_list_child_health_events($1) result',[child]).then(r=>r.rows[0].result);
  const add=(id,child,type,details,correction=null,date='2026-11-08',time='')=>db.query('select public.rawdha_add_child_health_event($1,$2,$3,$4,$5,$6,$7) result',[id,child,type,date,time,details,correction]).then(r=>r.rows[0].result);
  assert.deepEqual(await list('a'),[]);await assert.rejects(list('b'),/health_not_allowed_or_not_found/);
  await assert.rejects(add('x','b','incident',{description:'test'}),/health_not_allowed_or_not_found/);
  await assert.rejects(add('x','a','incident',{description:''}),/health_invalid_details/);
  await assert.rejects(add('x','a','incident',{description:'test',createdBy:owner}),/health_invalid_details/);
  await assert.rejects(add('x','a','medicament',{description:'test'}),/health_invalid_details/);
  await assert.rejects(add('x','a','incident',{description:'test'},null,'2026-02-30'),/health_invalid_request/);
  await assert.rejects(add('x','a','incident',{description:'test'},null,'2026-11-08','29:00'),/health_invalid_request/);
  await assert.rejects(add('x','a','correction',{description:'test'},'missing'),/health_invalid_correction/);
  const original=await add('first','a','incident',{description:'Chute observée',gravite:'À évaluer'});
  assert.equal(original.createdBy,owner);assert.ok(original.createdAt);
  assert.deepEqual(await add('first','a','incident',{description:'Chute observée',gravite:'À évaluer'}),original);
  await assert.rejects(add('first','a','incident',{description:'Autre'}),/health_request_id_conflict/);
  await assert.rejects(add('bad','a','soin',{description:'test'},'first'),/health_invalid_correction/);
  const correction=await add('correct','a','correction',{description:'Rectification de la date'},'first');
  assert.equal(correction.correctsId,'first');assert.equal((await list('a')).length,2);
  await assert.rejects(db.query('delete from public.rawdha_child_health_events'),/permission denied/);
  await assert.rejects(db.query("update public.rawdha_child_health_events set details='{}'"),/permission denied/);
  await db.exec("select set_config('request.approved','false',false)");await assert.rejects(list('a'),/health_not_allowed/);
  await db.exec('reset role; set role anon');await assert.rejects(list('a'),/permission denied/);
  await db.exec('reset role');await assert.rejects(db.query("delete from enfants where id='a'"),/foreign key/);
  await db.query('update enfants set data=$1 where id=$2',[{crecheId:other},'a']);
  await db.exec(`set role authenticated; select set_config('request.uid','${other}',false); select set_config('request.approved','true',false)`);
  assert.deepEqual(await list('a'),[]);await assert.rejects(add('cross','a','correction',{description:'test'},'first'),/health_invalid_correction/);
 } finally {await db.close();}
});
test('legacy PR health table blocks migration without touching its data',async()=>{
 const db=await setup();try {
  await db.exec("create table public.sante_evenements(id text primary key,data jsonb); insert into public.sante_evenements values ('legacy','{}')");
  await assert.rejects(db.exec(sql),/health_legacy_table_requires_review/);await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from public.sante_evenements')).rows[0].n,1);
  assert.equal((await db.query("select to_regclass('public.rawdha_child_health_events') name")).rows[0].name,null);
 }finally{await db.close();}
});
