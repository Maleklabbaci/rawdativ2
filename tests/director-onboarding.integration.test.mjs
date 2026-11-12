import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('onboarding progress is isolated by user and cannot be created or removed by clients', async () => {
  const db = new PGlite();
  const a = '00000000-0000-0000-0000-000000000011', b = '00000000-0000-0000-0000-000000000022';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
      create table public.comptes (id text primary key, data jsonb not null);
      grant usage on schema public, auth to authenticated, anon, service_role;`);
    await db.query("insert into public.comptes values ($1,'{}'),($2,'{}')",[a,b]);
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108270000_director_onboarding.sql', import.meta.url),'utf8'));
    await db.query('insert into public.director_onboarding(account_id) values ($1),($2)',[a,b]);
    await db.exec(`set role authenticated; select set_config('request.uid','${a}',false);`);
    assert.deepEqual((await db.query('select account_id from public.director_onboarding')).rows,[{account_id:a}]);
    assert.equal((await db.query("update public.director_onboarding set step='classes',language='ar',task_page='classes' where account_id=$1 returning step",[a])).rows[0].step,'classes');
    assert.equal((await db.query("update public.director_onboarding set step='done' where account_id=$1 returning step",[b])).rows.length,0);
    await assert.rejects(db.query("update public.director_onboarding set step='invalid' where account_id=$1",[a]),/check constraint/);
    await assert.rejects(db.query('insert into public.director_onboarding(account_id) values ($1)',[a]),/permission denied/);
    await assert.rejects(db.query('delete from public.director_onboarding where account_id=$1',[a]),/permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from public.director_onboarding'),/permission denied/);
  } finally { await db.close(); }
});
