import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const director = '00000000-0000-0000-0000-000000000011';
const other = '00000000-0000-0000-0000-000000000022';
const pending = '00000000-0000-0000-0000-000000000033';
const admin = '00000000-0000-0000-0000-000000000044';

// Isolated PostgreSQL simulation: these are not the policies currently deployed in Supabase.
test('account hardening isolates profiles and prevents client privilege escalation', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
      create table public.comptes (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz default now());
      create function public.rawdha_current_role() returns text language sql security definer stable set search_path = public as $$ select data->>'role' from public.comptes where id = auth.uid()::text $$;
      create function public.rawdha_is_admin() returns boolean language sql security definer stable set search_path = public as $$ select coalesce(public.rawdha_current_role() = 'admin', false) $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant select, insert, update, delete on public.comptes to anon, authenticated, service_role;
      alter table public.comptes enable row level security;
      create policy "allow all comptes" on public.comptes for all using (true) with check (true);
    `);
    await db.exec(fs.readFileSync(new URL('../supabase_pending_director_auth_compat_migration.sql', import.meta.url), 'utf8'));
    for (const [id, data] of [
      [director, { role: 'directeur', approvalStatus: 'approved', abonnementActif: false, nom: 'A' }],
      [other, { role: 'directeur', approvalStatus: 'approved', nom: 'B' }],
      [pending, { role: 'directeur', approvalStatus: 'pending' }],
      [admin, { role: 'admin' }],
    ]) {
      await db.query('insert into auth.users(id) values ($1)', [id]);
      await db.query('insert into public.comptes(id,data) values ($1,$2)', [id, data]);
    }
    // Demonstrate why permissive RLS + unrestricted JSON updates are unsafe.
    await db.exec(`set role authenticated; select set_config('request.uid','${director}',false);`);
    const before = await db.query("update public.comptes set data = data || '{\"role\":\"admin\"}'::jsonb where id=$1 returning id", [director]);
    assert.equal(before.rows.length, 1);
    await db.exec('reset role');
    await db.query("update public.comptes set data = data || '{\"role\":\"directeur\"}'::jsonb where id=$1", [director]);
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108100000_account_privilege_safety.sql', import.meta.url), 'utf8'));

    await db.exec(`set role authenticated; select set_config('request.uid','${director}',false);`);
    assert.deepEqual((await db.query('select id from public.comptes order by id')).rows.map(x => x.id), [director]);
    const allowed = await db.query("update public.comptes set data = data || '{\"telephone\":\"0550000000\"}'::jsonb where id=$1 returning id", [director]);
    assert.equal(allowed.rows.length, 1);
    for (const patch of [{role:'admin'}, {approvalStatus:'approved', abonnementActif:true}, {internalAdminRole:'super_admin'}, {unknownFuturePrivilege:true}]) {
      await assert.rejects(db.query('update public.comptes set data = data || $1::jsonb where id=$2', [patch, director]), /account_privileged_fields_forbidden/);
    }
    const crossUpdate = await db.query("update public.comptes set data=data || '{\"nom\":\"forged\"}'::jsonb where id=$1 returning id", [other]);
    assert.equal(crossUpdate.rows.length, 0);
    await assert.rejects(db.query('insert into public.comptes(id,data) values ($1,$2)', ['fake', { role:'admin' }]), /permission denied/);
    await assert.rejects(db.query('delete from public.comptes where id=$1', [director]), /permission denied/);

    await db.exec(`select set_config('request.uid','${pending}',false);`);
    assert.deepEqual((await db.query('select id from public.comptes')).rows.map(x => x.id), [pending]);
    assert.equal((await db.query("update public.comptes set data = data || '{\"approvalStatus\":\"approved\"}'::jsonb where id=$1 returning id", [pending])).rows.length, 0);

    await db.exec(`select set_config('request.uid','${admin}',false);`);
    assert.equal((await db.query('select id from public.comptes')).rows.length, 4);
    assert.equal((await db.query("update public.comptes set data=data || '{\"approvalStatus\":\"approved\"}'::jsonb where id=$1 returning id", [pending])).rows.length, 1);

    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from public.comptes'), /permission denied/);
    await assert.rejects(db.query("update public.comptes set data='{}'::jsonb"), /permission denied/);
    await db.exec('reset role;');
    // A backend SECURITY DEFINER workflow may still provision accounts. Its own
    // authorization must be audited separately; the trigger deliberately trusts it.
    await db.exec(`create function public.test_backend_provision() returns void language sql security definer as $$ insert into public.comptes(id,data) values ('service-created','{"role":"directeur","approvalStatus":"pending"}') $$; grant execute on function public.test_backend_provision() to authenticated; set role authenticated;`);
    await db.query('select public.test_backend_provision()');
    await db.exec('reset role;');
    assert.equal((await db.query("select count(*)::int as n from public.comptes where id='service-created'")).rows[0].n, 1);
    // Apply both proposed migrations together and exercise the signup hook through
    // a privileged backend while a client JWT is present.
    await db.exec("alter table auth.users add column email text; create table public.parametres(id text primary key, data jsonb not null default '{}'::jsonb);");
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108110000_explicit_director_approval.sql', import.meta.url), 'utf8'));
    const fresh = '00000000-0000-0000-0000-000000000055';
    await db.exec(`create function public.test_backend_signup() returns void language sql security definer as $$ insert into auth.users(id,email,raw_user_meta_data) values ('${fresh}','demo@example.invalid','{"role":"directeur","pendingDirector":false}') $$; grant execute on function public.test_backend_signup() to authenticated; set role authenticated;`);
    await db.query('select public.test_backend_signup()');
    await db.exec('reset role;');
    assert.equal((await db.query('select data from public.comptes where id=$1', [fresh])).rows[0].data.approvalStatus, 'pending');
  } finally {
    await db.close();
  }
});
