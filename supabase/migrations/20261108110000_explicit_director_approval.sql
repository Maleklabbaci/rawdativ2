-- Staging only. Never infer approval of legacy accounts automatically.
-- This migration intentionally refuses to run until every legacy director has
-- an explicitly reviewed approvalStatus of 'pending' or 'approved'.
begin;

do $$
begin
  if exists (
    select 1 from public.comptes
    where data->>'role' = 'directeur'
      and coalesce(data->>'approvalStatus', '') not in ('pending', 'approved')
  ) then
    raise exception 'legacy_director_approval_requires_review' using errcode = '23514';
  end if;
end;
$$;

-- User-editable Auth metadata is not an authorization source.
create or replace function public.rawdha_is_approved_director()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.comptes c
    where c.id = auth.uid()::text
      and c.data->>'role' = 'directeur'
      and c.data->>'approvalStatus' = 'approved'
  )
$$;
revoke all on function public.rawdha_is_approved_director() from public, anon;
grant execute on function public.rawdha_is_approved_director() to authenticated;

-- The Auth creation hook must create a pending profile *before* any separate
-- Edge Function runs. Metadata supplied during public signup cannot approve it.
-- Existing profiles/settings are never overwritten by this hook.
create or replace function public.handle_new_director_signup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  nursery_name text := nullif(trim(coalesce(metadata->>'nomCreche', '')), '');
begin
  if coalesce(metadata->>'role', 'directeur') = 'directeur' then
    insert into public.comptes (id, data)
    values (new.id::text, jsonb_build_object(
      'nom', coalesce(metadata->>'nom', ''),
      'prenom', coalesce(metadata->>'prenom', ''),
      'email', coalesce(new.email, ''),
      'role', 'directeur',
      'approvalStatus', 'pending',
      'abonnementActif', false,
      'dateFinAbonnement', null,
      'nomCreche', coalesce(nursery_name, ''),
      'telephone', coalesce(metadata->>'telephone', ''),
      'adresse', coalesce(metadata->>'adresse', '')
    )) on conflict (id) do nothing;

    if nursery_name is not null then
      insert into public.parametres (id, data)
      values ('creche_' || new.id::text, jsonb_build_object(
        'crecheName', nursery_name,
        'principalEmail', coalesce(new.email, ''),
        'phoneNumbers', coalesce(metadata->>'telephone', ''),
        'addressLine', coalesce(metadata->>'adresse', ''),
        'tuitionFeeRate', 3500,
        'siteWeb', coalesce(metadata->>'siteWeb', ''),
        'logoUrl', ''
      )) on conflict (id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_director_signup() from public, anon, authenticated;

-- This trigger may not exist on older installations; replace only this named hook.
drop trigger if exists on_auth_user_created_director on auth.users;
create trigger on_auth_user_created_director
after insert on auth.users
for each row execute function public.handle_new_director_signup();
commit;
