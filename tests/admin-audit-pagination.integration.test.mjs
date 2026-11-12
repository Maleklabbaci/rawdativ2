import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('admin audit pagination enforces access, stable cursors and filters without leaking metadata',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
   create function public.rawdha_is_admin() returns boolean language sql stable as $$ select auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid $$;
   create table public.admin_audit_logs(id text primary key,data jsonb not null);
   alter table public.admin_audit_logs enable row level security;
   create policy admin_read on public.admin_audit_logs for select to authenticated using (public.rawdha_is_admin());
   grant usage on schema public,auth to authenticated,anon; grant select on public.admin_audit_logs to authenticated;`);
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108290000_admin_audit_pagination.sql',import.meta.url),'utf8'));
  for(let i=0;i<75;i++) await db.query('insert into public.admin_audit_logs values ($1,$2)',[`id${String(i).padStart(3,'0')}`,{id:`id${i}`,createdAt:'2026-11-01T12:00:00Z',actorId:'admin',action:i%2?'ticket_status_updated':'subscription_suspended',targetLabel:`Creche ${i}`,targetId:`target${i}`,targetType:'director_account',metadata:{secret:'private'}}]);
  await db.exec(`set role authenticated;select set_config('request.uid','00000000-0000-0000-0000-000000000002',false)`);
  await assert.rejects(db.query('select * from public.rawdha_admin_audit_page()'),/administrateur/);
  await db.exec(`select set_config('request.uid','00000000-0000-0000-0000-000000000001',false)`);
  const get=async(args=[]) => (await db.query(`select * from public.rawdha_admin_audit_page(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args)).rows.map(r=>r.rawdha_admin_audit_page);
  let first=await get(['','all','','','','','',26]).catch(()=>[]); // invalid empty cursor does not match any event
  first=await get(); assert.equal(first.length,25); assert.equal(first[0].id,'id074');assert.ok(!('metadata' in first[0]));
  let next=await get(['','all','','','',first.at(-1).createdAt,first.at(-1).id,25]);assert.equal(next.length,25);assert.equal(next[0].id,'id049');assert.equal(new Set([...first,...next].map(e=>e.id)).size,50);
  assert.equal((await get(['','support','','','','',null,25]).catch(()=>[])).length,0); // malformed cursor rejected
  let support=await get(['','support','','','',null,null,51]);assert.equal(support.length,37);assert.ok(support.every(e=>e.action==='ticket_status_updated'));
  assert.equal((await get(['target3','all','','','',null,null,51])).length,11);
  await assert.rejects(get(['','all','','','',null,'id1',25]),/Filtres invalides/);
 } finally {await db.close()}
});
