import { PGlite } from '@electric-sql/pglite'; import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
test('diagnostics accept only fixed safe fields, restrict access and page reliably',async()=>{const db=new PGlite();try {
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create function public.rawdha_is_admin() returns boolean language sql stable as $$select auth.uid()='00000000-0000-0000-0000-000000000001'::uuid$$;
 grant usage on schema public,auth to anon,authenticated;`);
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108300000_application_event_logs.sql',import.meta.url),'utf8'));
 await db.exec(`set role authenticated; select set_config('request.uid','00000000-0000-0000-0000-000000000002',false)`);
 await assert.rejects(db.query("select public.rawdha_record_application_event('js_error','password=secret',null)"),/Invalid diagnostic/);
 await assert.rejects(db.query("select public.rawdha_record_application_event('data_failure','enfants','private details')"),/Invalid diagnostic/);
 for(let i=0;i<65;i++) await db.query("select public.rawdha_record_application_event('data_failure','enfants','update')");
 await assert.rejects(db.query('select * from public.application_event_logs'),/permission denied/);
 await assert.rejects(db.query('select * from public.rawdha_application_log_page()'),/administrateur/);
 await db.exec(`select set_config('request.uid','00000000-0000-0000-0000-000000000001',false)`);
 const a=(await db.query("select * from public.rawdha_application_log_page('errors','',null,null,26)")).rows;assert.equal(a.length,26);assert.equal(a[0].actor_id,'00000000-0000-0000-0000-000000000002');assert.deepEqual(Object.keys(a[0]),['id','actor_id','created_at','kind','page','operation']);
 const b=(await db.query("select * from public.rawdha_application_log_page('errors','',$1,$2,51)",[a[25].created_at,a[25].id])).rows;assert.equal(b.length,34); assert.equal(new Set([...a,...b].map(x=>x.id)).size,60);
 await db.exec('reset role; set role anon');await assert.rejects(db.query("select public.rawdha_record_application_event('page_view','enfants',null)"),/permission denied/);
 } finally {await db.close()}});
