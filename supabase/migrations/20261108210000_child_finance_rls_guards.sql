-- STAGING ONLY. Requires the explicit-approval, child-deletion and financial
-- migrations. These restrictive policies are ANDed with existing policies; no
-- existing policy is removed and no new permissive grant is added. Inventory
-- effective roles/grants and test all workflows before any coordinated rollout.
begin;
lock table public.enfants, public.paiements in share row exclusive mode;
do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='enfants' and c.relrowsecurity)
     or not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='paiements' and c.relrowsecurity) then
    raise exception 'finance_rls_must_already_be_enabled' using errcode='23514';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and policyname in (
    'rawdha_child_read_guard','rawdha_child_insert_guard','rawdha_child_update_guard','rawdha_child_delete_guard',
    'rawdha_invoice_read_guard','rawdha_invoice_insert_guard','rawdha_invoice_update_guard','rawdha_invoice_delete_guard')) then
    raise exception 'finance_rls_guard_name_already_exists' using errcode='42P07';
  end if;
end $$;

-- The restrictive policies target PUBLIC as inherited grants may otherwise
-- expose rows to anon or other non-bypass roles. PUBLIC grants can implicitly
-- grant anon or authenticated privileges. No
-- permissive grant is introduced here; test whether authenticated has the
-- explicit rights needed by the deployed client before rollout.
revoke select,insert,update,delete on public.enfants from public,anon;
revoke select,insert,update,delete on public.paiements from public,anon;

create policy rawdha_child_read_guard on public.enfants as restrictive for select to public
using (auth.uid() is not null and (coalesce(public.rawdha_is_admin(),false)
  or (coalesce(public.rawdha_is_approved_director(),false) and data->>'crecheId'=auth.uid()::text)));
create policy rawdha_child_insert_guard on public.enfants as restrictive for insert to public
with check (auth.uid() is not null and (coalesce(public.rawdha_is_admin(),false)
  or (coalesce(public.rawdha_is_approved_director(),false) and data->>'crecheId'=auth.uid()::text)));
create policy rawdha_child_update_guard on public.enfants as restrictive for update to public
using (auth.uid() is not null and (coalesce(public.rawdha_is_admin(),false)
  or (coalesce(public.rawdha_is_approved_director(),false) and data->>'crecheId'=auth.uid()::text)))
with check (auth.uid() is not null and (coalesce(public.rawdha_is_admin(),false)
  or (coalesce(public.rawdha_is_approved_director(),false) and data->>'crecheId'=auth.uid()::text)));
-- Defence in depth for the earlier delete pause even if a role inherits a grant.
create policy rawdha_child_delete_guard on public.enfants as restrictive for delete to public using (false);

create policy rawdha_invoice_read_guard on public.paiements as restrictive for select to public
using (auth.uid() is not null and (coalesce(public.rawdha_is_admin(),false)
  or (coalesce(public.rawdha_is_approved_director(),false) and exists (
    select 1 from public.enfants e where e.id=(paiements.data->>'enfantId') and e.data->>'crecheId'=auth.uid()::text
  ))));
-- All financial writes must go through the audited RPC, including when a
-- direct grant is inherited from another role. Privileged bypass roles remain
-- outside this protection and must be audited separately.
create policy rawdha_invoice_insert_guard on public.paiements as restrictive for insert to public with check (false);
create policy rawdha_invoice_update_guard on public.paiements as restrictive for update to public using (false) with check (false);
create policy rawdha_invoice_delete_guard on public.paiements as restrictive for delete to public using (false);
commit;
