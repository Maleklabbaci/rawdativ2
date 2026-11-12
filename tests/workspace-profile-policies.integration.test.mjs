import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('workspace profile documents are isolated by approved director', async () => {
  const db = new PGlite();
  const a='00000000-0000-0000-0000-000000000011', b='00000000-0000-0000-0000-000000000022';
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
      create function public.rawdha_is_approved_director() returns boolean language sql stable as $$ select current_setting('request.approved',true) = 'yes' $$;
      create table public.parametres(id text primary key,data jsonb); alter table public.parametres enable row level security;
      grant usage on schema public,auth to authenticated,anon; grant select,insert,update on public.parametres to authenticated;`);
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108380000_workspace_profile_policies.sql',import.meta.url),'utf8'));
    await db.exec(`set role authenticated; select set_config('request.uid','${a}',false); select set_config('request.approved','yes',false)`);
    await db.query('insert into public.parametres values ($1, $2)', ['profils_equipe_'+a, '{}']);
    await assert.rejects(db.query('insert into public.parametres values ($1, $2)', ['profils_equipe_'+b, '{}']));
    assert.equal((await db.query('select id from public.parametres')).rows.length,1);
    await db.exec(`select set_config('request.uid','${b}',false)`);
    assert.equal((await db.query('select id from public.parametres')).rows.length,0);
    assert.equal((await db.query('update public.parametres set data = $1 returning id',['{}'])).rows.length,0);
    await db.exec(`select set_config('request.uid','${a}',false); select set_config('request.approved','no',false)`);
    assert.equal((await db.query('select id from public.parametres')).rows.length,0);
  } finally { await db.close(); }
});
