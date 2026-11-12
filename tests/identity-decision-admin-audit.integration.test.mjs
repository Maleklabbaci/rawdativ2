import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('identity decision writes one private audit event atomically without document content', async () => {
  const db=new PGlite(), director='00000000-0000-0000-0000-000000000011', admin='00000000-0000-0000-0000-000000000033';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
      create table public.comptes (id text primary key, data jsonb not null);
      create function public.rawdha_is_admin() returns boolean language sql security definer stable as $$ select exists(select 1 from public.comptes where id = auth.uid()::text and data->>'role'='admin') $$;
      create table public.admin_audit_logs(id text primary key,data jsonb not null);
      alter table public.admin_audit_logs enable row level security;
      create policy admin_read on public.admin_audit_logs for select to authenticated using (public.rawdha_is_admin());
      grant select on public.admin_audit_logs to authenticated;
      grant usage on schema public,auth to authenticated,anon,service_role;`);
    await db.query('insert into public.comptes values ($1,$2),($3,$4)',[director,{role:'directeur',nom:'Benali',prenom:'Amel'},admin,{role:'admin'}]);
    for(const name of ['20261108260000_identity_review_foundation.sql','20261108280000_identity_decision_audit.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
    await db.exec('set role service_role');
    await db.query("select public.rawdha_submit_identity_document($1,'image/jpeg','YWJj')",[director]);
    await assert.rejects(db.query("select public.rawdha_decide_identity_document($1,$1,'refused')",[director]),/admin_required/);
    await db.query("select public.rawdha_decide_identity_document($1,$2,'document_reviewed')",[director,admin]);
    await assert.rejects(db.query("select public.rawdha_decide_identity_document($1,$2,'document_reviewed')",[director,admin]),/review_not_pending/);
    await db.query("select public.rawdha_submit_identity_document($1,'image/jpeg','YWJj')",[director]);
    await db.exec('reset role; alter table public.admin_audit_logs add constraint reject_audit check (false) not valid; set role service_role');
    await assert.rejects(db.query("select public.rawdha_decide_identity_document($1,$2,'refused')",[director,admin]), /check constraint/);
    assert.equal((await db.query('select count(*)::int as n from public.identity_review_documents')).rows[0].n,1);
    await db.exec('reset role; alter table public.admin_audit_logs drop constraint reject_audit');
    assert.equal((await db.query('select status from public.identity_document_reviews where account_id=$1',[director])).rows[0].status,'pending');
    const rows=(await db.query('select data from public.admin_audit_logs')).rows;assert.equal(rows.length,1);
    assert.equal(rows[0].data.action,'identity_document_reviewed');assert.equal(rows[0].data.actorId,admin);assert.equal(rows[0].data.targetId,director);
    assert.doesNotMatch(JSON.stringify(rows[0]),/YWJj|Benali|Amel|document_bytes/);
    await db.exec(`set role authenticated; select set_config('request.uid','${director}',false)`);
    assert.equal((await db.query('select * from public.admin_audit_logs')).rows.length,0);
    await assert.rejects(db.query("insert into public.admin_audit_logs(id,data) values('fake','{}')"),/permission denied/);
    await db.exec(`select set_config('request.uid','${admin}',false)`);assert.equal((await db.query('select * from public.admin_audit_logs')).rows.length,1);
  } finally {await db.close();}
});
