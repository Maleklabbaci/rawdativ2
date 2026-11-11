import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('temporary safety guard blocks direct child deletion but permits archive updates', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table public.enfants(id text primary key,data jsonb not null);
      grant select, insert, update, delete on public.enfants to public, anon, authenticated, service_role;
      insert into public.enfants values ('child-1','{"statut":"Actif"}');
    `);
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108120000_pause_unsafe_child_deletion.sql', import.meta.url), 'utf8'));
    await db.exec('set role authenticated;');
    await assert.rejects(db.query("delete from public.enfants where id='child-1'"), /permission denied/);
    await db.query("update public.enfants set data = data || '{\"statut\":\"Inactif\"}'::jsonb where id='child-1'");
    assert.equal((await db.query("select data from public.enfants where id='child-1'")).rows[0].data.statut, 'Inactif');
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query("delete from public.enfants where id='child-1'"), /permission denied/);
    await db.exec('reset role; set role service_role;');
    assert.equal((await db.query("select id from public.enfants where id='child-1'")).rows.length, 1);
    await db.exec('reset role;');
  } finally {
    await db.close();
  }
});
