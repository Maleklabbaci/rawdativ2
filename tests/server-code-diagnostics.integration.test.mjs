import { PGlite } from '@electric-sql/pglite'; import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
test('server-only incidents and client code location do not admit arbitrary text',async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create function public.rawdha_is_admin() returns boolean language sql stable as $$select auth.uid()='00000000-0000-0000-0000-000000000001'::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;`);
 for(const m of ['20261108300000_application_event_logs.sql','20261108310000_application_log_diagnostics.sql','20261108320000_server_and_code_diagnostics.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+m,import.meta.url),'utf8'));
 await db.exec(`set role authenticated;select set_config('request.uid','00000000-0000-0000-0000-000000000002',false)`);
 await db.query("select public.rawdha_record_code_error('enfants','type_error','Enfants-Ab12cd34.js',87)");
 await assert.rejects(db.query("select public.rawdha_record_code_error('enfants','type_error','password-secret123.js',87)"),/Invalid diagnostic/);
 await assert.rejects(db.query("select public.rawdha_record_server_incident('slickpay-webhook','11111111-1111-4111-8111-111111111111')"),/permission denied/);
 await db.exec('reset role;set role service_role');
 await assert.rejects(db.query("select public.rawdha_record_server_incident('data-secret','11111111-1111-4111-8111-111111111111')"),/Invalid incident/);
 for(let i=0;i<2;i++)await db.query("select public.rawdha_record_server_incident('slickpay-webhook','11111111-1111-4111-8111-111111111111')");
 await db.exec(`reset role;set role authenticated;select set_config('request.uid','00000000-0000-0000-0000-000000000001',false)`);
 const rows=(await db.query("select * from public.rawdha_application_log_page('errors')")).rows;
 assert.equal(rows.length,2);assert.ok(rows.some(r=>r.source==='Enfants-Ab12cd34.js' && r.source_line===87));assert.ok(rows.some(r=>r.kind==='server_error' && r.incident_id==='11111111-1111-4111-8111-111111111111'));
 assert.equal(Number((await db.query('select * from public.rawdha_application_log_summary()')).rows[0].errors),2);
 }finally{await db.close()}});
