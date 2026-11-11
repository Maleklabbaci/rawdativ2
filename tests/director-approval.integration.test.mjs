import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const legacy = '00000000-0000-0000-0000-000000000011';
const fresh = '00000000-0000-0000-0000-000000000022';
const missing = '00000000-0000-0000-0000-000000000033';

test('approval migration refuses unreviewed accounts and does not trust user metadata', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
      create table public.comptes(id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz default now());
      create table public.parametres(id text primary key, data jsonb not null default '{}'::jsonb);
      grant usage on schema public,auth to authenticated;
    `);
    await db.query('insert into public.comptes(id,data) values ($1,$2)', [legacy, {role:'directeur'}]);
    const sql = fs.readFileSync(new URL('../supabase/migrations/20261108110000_explicit_director_approval.sql', import.meta.url), 'utf8');
    await assert.rejects(db.exec(sql), /legacy_director_approval_requires_review/);
    await db.exec('rollback');
    assert.equal((await db.query('select data from public.comptes where id=$1',[legacy])).rows[0].data.approvalStatus, undefined);
    // Review is deliberate; no migration automatically approves old accounts.
    await db.query("update public.comptes set data=data || '{\"approvalStatus\":\"approved\"}'::jsonb where id=$1",[legacy]);
    await db.exec(sql);
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [fresh,'demo@example.invalid',{role:'directeur',pendingDirector:false,nomCreche:'Fictive'}]);
    assert.equal((await db.query('select data from public.comptes where id=$1',[fresh])).rows[0].data.approvalStatus, 'pending');
    await db.exec(`set role authenticated; select set_config('request.uid','${fresh}',false);`);
    assert.equal((await db.query('select public.rawdha_is_approved_director() as approved')).rows[0].approved,false);
    await db.exec('reset role');
    await db.query("update auth.users set raw_user_meta_data = '{\"pendingDirector\":false}'::jsonb where id=$1",[fresh]);
    await db.exec(`set role authenticated; select set_config('request.uid','${fresh}',false);`);
    assert.equal((await db.query('select public.rawdha_is_approved_director() as approved')).rows[0].approved,false);
    await db.exec(`select set_config('request.uid','${missing}',false);`);
    assert.equal((await db.query('select public.rawdha_is_approved_director() as approved')).rows[0].approved,false);
    await db.exec(`select set_config('request.uid','${legacy}',false);`);
    assert.equal((await db.query('select public.rawdha_is_approved_director() as approved')).rows[0].approved,true);
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});
