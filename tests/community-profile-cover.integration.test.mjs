import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('covers are readable by approved directors and only editable by their owner', async () => {
  const db = new PGlite();
  const a = '00000000-0000-0000-0000-000000000011';
  const b = '00000000-0000-0000-0000-000000000022';
  const pending = '00000000-0000-0000-0000-000000000033';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
      create table public.comptes (id text primary key, data jsonb not null);
      create function public.rawdha_is_approved_director() returns boolean language sql security definer stable as $$ select exists(select 1 from public.comptes where id = auth.uid()::text and data->>'approvalStatus' = 'approved') $$;
      create function public.rawdha_is_admin() returns boolean language sql security definer stable as $$ select false $$;
      grant usage on schema public, auth to authenticated, anon;`);
    for (const [id, approvalStatus] of [[a, 'approved'], [b, 'approved'], [pending, 'pending']]) await db.query('insert into public.comptes values ($1,$2)', [id, { approvalStatus }]);
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108250000_community_profile_covers.sql', import.meta.url), 'utf8'));
    await db.exec(`set role authenticated; select set_config('request.uid','${a}',false);`);
    await db.query('insert into public.community_profile_covers(profile_id,image_url) values ($1,$2)', [a, 'data:image/jpeg;base64,YWJj']);
    await assert.rejects(db.query('insert into public.community_profile_covers(profile_id,image_url) values ($1,$2)', [b, 'data:image/jpeg;base64,YWJj']), /row-level security/);
    await assert.rejects(db.query('update public.community_profile_covers set image_url=$1 where profile_id=$2', ['https://example.com/image.jpg', a]), /check constraint/);
    await db.exec(`select set_config('request.uid','${b}',false);`);
    assert.equal((await db.query('select * from public.community_profile_covers')).rows.length, 1);
    assert.equal((await db.query('delete from public.community_profile_covers where profile_id=$1 returning profile_id', [a])).rows.length, 0);
    await db.exec(`select set_config('request.uid','${pending}',false);`);
    assert.equal((await db.query('select * from public.community_profile_covers')).rows.length, 0);
    await assert.rejects(db.query('insert into public.community_profile_covers(profile_id,image_url) values ($1,$2)', [pending, 'data:image/jpeg;base64,YWJj']), /row-level security/);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from public.community_profile_covers'), /permission denied/);
  } finally { await db.close(); }
});
