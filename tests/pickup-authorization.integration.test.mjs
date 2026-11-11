import { PGlite } from '@electric-sql/pglite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/20261108140000_pickup_authorizations.sql', import.meta.url), 'utf8');
const owner='00000000-0000-0000-0000-000000000011', other='00000000-0000-0000-0000-000000000022';

test('pickup registry requires approved ownership and preserves revocation history', async () => {
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
      create function public.rawdha_is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('request.admin',true),'false') = 'true' $$;
      create function public.rawdha_is_approved_director() returns boolean language sql stable as $$ select coalesce(current_setting('request.approved',true),'false') = 'true' $$;
      create table public.enfants (id text primary key, data jsonb not null);
      grant usage on schema public,auth to authenticated,anon;`);
    await db.query('insert into enfants values($1,$2),($3,$4)', ['a',{crecheId:owner},'b',{crecheId:other}]);
    await db.exec(sql);
    await db.exec(`set role authenticated; select set_config('request.uid','${owner}',false); select set_config('request.approved','true',false);`);
    const list=(child)=>db.query('select public.rawdha_list_pickup_authorizations($1) as result',[child]).then(r=>r.rows[0].result);
    const write=(action,child,id,name='Nadia Exemple',relation='Mère',phone='',ref='Autorisation papier vérifiée')=>db.query('select public.rawdha_write_pickup_authorization($1,$2,$3,$4,$5,$6,$7) as result',[action,child,id,name,relation,phone,ref]).then(r=>r.rows[0].result);
    assert.deepEqual(await list('a'),[]);
    await assert.rejects(list('b'),/not_allowed_or_not_found/);
    await assert.rejects(write('create','b','x'),/not_allowed_or_not_found/);
    await assert.rejects(write('create','a','x',' ', 'Mère','','document'),/invalid_pickup_details/);
    await assert.rejects(write('create','a','x','Nadia','Mère','',' '),/invalid_pickup_details/);
    const saved=await write('create','a','x');
    assert.equal(saved.createdBy,owner);assert.ok(saved.createdAt);assert.equal(saved.revokedAt,null);
    await assert.rejects(write('create','a','x'),/duplicate key/);
    await assert.rejects(db.query("delete from public.rawdha_pickup_authorizations"),/permission denied/);
    await assert.rejects(write('revoke','b','x'),/not_allowed_or_not_found/);
    const revoked=await write('revoke','a','x');
    assert.equal(revoked.revokedBy,owner);assert.ok(revoked.revokedAt);
    await assert.rejects(write('revoke','a','x'),/pickup_already_revoked/);
    assert.equal((await list('a'))[0].revokedAt,revoked.revokedAt);
    await db.exec("select set_config('request.approved','false',false)");
    await assert.rejects(list('a'),/not_allowed/);
    await assert.rejects(write('create','a','y'),/not_allowed/);
    await db.exec('reset role; set role anon');
    await assert.rejects(list('a'),/permission denied/);
    await db.exec('reset role');
    await assert.rejects(db.query("delete from public.enfants where id='a'"),/foreign key/);
    // A later child transfer does not disclose a previous creche's declarations.
    await db.query('update public.enfants set data=$1 where id=$2',[{crecheId:other},'a']);
    await db.exec(`set role authenticated; select set_config('request.uid','${other}',false); select set_config('request.approved','true',false);`);
    assert.deepEqual(await list('a'),[]);
    await assert.rejects(write('revoke','a','x'),/pickup_not_found/);
    await db.exec('reset role');
  } finally {await db.close();}
});
