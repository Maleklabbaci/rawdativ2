import { PGlite } from '@electric-sql/pglite'; import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
test('diagnostics use allowlists, constrain read access, show 24h stats and purge in service-only batches',async()=>{const db=new PGlite();try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create function public.rawdha_is_admin() returns boolean language sql stable as $$select auth.uid()='00000000-0000-0000-0000-000000000001'::uuid$$; grant usage on schema public,auth to anon,authenticated,service_role;`);
 for(const m of ['20261108300000_application_event_logs.sql','20261108310000_application_log_diagnostics.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+m,import.meta.url),'utf8'));
 await db.exec(`set role authenticated; select set_config('request.uid','00000000-0000-0000-0000-000000000002',false)`);
 await db.query("select public.rawdha_record_application_event('data_success','enfants','create',null)");
 await db.query("select public.rawdha_record_application_event('data_failure','enfants','update','permission')");
 await assert.rejects(db.query("select public.rawdha_record_application_event('data_failure','enfants','update','password secret')"),/Invalid diagnostic/);
 await assert.rejects(db.query('select * from public.rawdha_application_log_summary()'),/administrateur/);
 await assert.rejects(db.query('select public.rawdha_purge_application_events(100)'),/permission denied/);
 await db.exec(`select set_config('request.uid','00000000-0000-0000-0000-000000000001',false)`);
 const summary=(await db.query('select * from public.rawdha_application_log_summary()')).rows[0];assert.equal(Number(summary.total),2);assert.equal(Number(summary.errors),1);
 const results=(await db.query("select * from public.rawdha_application_log_page('errors')")).rows;assert.equal(results.length,1);assert.equal(results[0].diagnostic,'permission');assert.equal(results[0].operation,'update');
 await db.exec("reset role; insert into public.application_event_logs(actor_id,kind,page,created_at) values ('old','page_view','enfants',now()-interval '91 days'),('old','page_view','enfants',now()-interval '91 days'); set role service_role;");
 assert.equal((await db.query('select public.rawdha_purge_application_events(1) n')).rows[0].n,1);
 assert.equal((await db.query('select public.rawdha_purge_application_events(100) n')).rows[0].n,1);
 }finally{await db.close()}});
