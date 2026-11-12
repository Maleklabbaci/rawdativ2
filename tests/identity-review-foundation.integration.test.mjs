import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('identity review status is separate, private and not writable by account owners', async () => {
  const db = new PGlite();
  const a = '00000000-0000-0000-0000-000000000011';
  const b = '00000000-0000-0000-0000-000000000022';
  const admin = '00000000-0000-0000-0000-000000000033';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
      create table public.comptes (id text primary key, data jsonb not null);
      create function public.rawdha_is_admin() returns boolean language sql security definer stable as $$ select exists(select 1 from public.comptes where id = auth.uid()::text and data->>'role' = 'admin') $$;
      grant usage on schema public, auth to authenticated, anon;`);
    for (const [id, role] of [[a, 'directeur'], [b, 'directeur'], [admin, 'admin']]) await db.query('insert into public.comptes values ($1,$2)', [id, { role, nom: 'Test', prenom: 'Compte' }]);
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108260000_identity_review_foundation.sql', import.meta.url), 'utf8'));
    await db.query("insert into public.identity_document_reviews(account_id, status, submitted_at) values ($1, 'pending', now()), ($2, 'pending', now())", [a,b]);
    await assert.rejects(db.query("update public.identity_document_reviews set status='document_reviewed' where account_id=$1", [a]), /check constraint/);
    await db.exec(`set role authenticated; select set_config('request.uid','${a}',false);`);
    assert.deepEqual((await db.query('select account_id from public.identity_document_reviews')).rows, [{ account_id: a }]);
    await assert.rejects(db.query("update public.identity_document_reviews set status='document_reviewed' where account_id=$1", [a]), /permission denied/);
    await assert.rejects(db.query("insert into public.identity_document_reviews(account_id) values ($1)", [a]), /permission denied/);
    await assert.rejects(db.query('delete from public.identity_document_reviews where account_id=$1', [a]), /permission denied/);
    await db.exec(`select set_config('request.uid','${admin}',false);`);
    assert.equal((await db.query('select account_id from public.identity_document_reviews')).rows.length, 2);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from public.identity_document_reviews'), /permission denied/);
  } finally { await db.close(); }
});

test('server-only submission and manual decision delete document atomically and invalidate on name change', async () => {
  const db = new PGlite();
  const a = '00000000-0000-0000-0000-000000000011';
  const admin = '00000000-0000-0000-0000-000000000033';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
      create table public.comptes (id text primary key, data jsonb not null);
      create function public.rawdha_is_admin() returns boolean language sql security definer stable as $$ select exists(select 1 from public.comptes where id = auth.uid()::text and data->>'role' = 'admin') $$;
      grant usage on schema public, auth to authenticated, anon, service_role;`);
    await db.query('insert into public.comptes values ($1,$2),($3,$4)', [a, { role: 'directeur', nom: 'Benali', prenom: 'Amel' }, admin, { role: 'admin' }]);
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108260000_identity_review_foundation.sql', import.meta.url), 'utf8'));
    await db.exec('set role authenticated');
    await assert.rejects(db.query("select public.rawdha_submit_identity_document($1,'image/jpeg','YWJj')", [a]), /permission denied/);
    await assert.rejects(db.query('select * from public.identity_review_documents'), /permission denied/);
    await db.exec('reset role; set role service_role');
    await db.query("select public.rawdha_submit_identity_document($1,'image/jpeg','YWJj')", [a]);
    await assert.rejects(db.query("select public.rawdha_submit_identity_document($1,'image/jpeg','YWJj')", [a]), /review_already_pending/);
    await assert.rejects(db.query("select public.rawdha_decide_identity_document($1,$1,'document_reviewed')", [a]), /admin_required/);
    await db.exec('reset role');
    await db.query("update public.comptes set data = jsonb_set(data,'{nom}',to_jsonb('Modifié'::text)) where id=$1", [a]);
    await db.exec('set role service_role');
    await assert.rejects(db.query("select public.rawdha_decide_identity_document($1,$2,'document_reviewed')", [a,admin]), /account_name_changed/);
    assert.equal((await db.query('select account_id from public.identity_review_documents')).rows.length, 1);
    await db.query("select public.rawdha_decide_identity_document($1,$2,'refused')", [a,admin]);
    assert.equal((await db.query('select account_id from public.identity_review_documents')).rows.length, 0);
    await db.query("select public.rawdha_submit_identity_document($1,'image/jpeg','YWJj')", [a]);
    await db.query("select public.rawdha_decide_identity_document($1,$2,'document_reviewed')", [a,admin]);
    assert.equal((await db.query('select account_id from public.identity_review_documents')).rows.length, 0);
    await db.exec(`reset role; set role authenticated; select set_config('request.uid','${a}',false);`);
    assert.equal((await db.query('select * from public.rawdha_reviewed_document_accounts()')).rows.length, 1);
    await db.exec('reset role');
    await db.query("update public.comptes set data = jsonb_set(data,'{prenom}',to_jsonb('Autre'::text)) where id=$1", [a]);
    assert.equal((await db.query('select status from public.identity_document_reviews where account_id=$1', [a])).rows[0].status, 'unverified');
  } finally { await db.close(); }
});
