-- Centre Administrateur Rawdha+
-- Cette migration ajoute un journal d'audit et deux RPC d'administration.
-- Elle ne modifie ni ne supprime aucune donnée métier existante.

create table if not exists public.admin_audit_logs (
  id text primary key,
  data jsonb not null default '{}'::jsonb
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs ((data->>'createdAt'));

create index if not exists admin_audit_logs_action_idx
  on public.admin_audit_logs ((data->>'action'));

alter table public.admin_audit_logs enable row level security;

drop policy if exists admin_audit_logs_select_admin on public.admin_audit_logs;
create policy admin_audit_logs_select_admin
  on public.admin_audit_logs
  for select
  to authenticated
  using (public.rawdha_is_admin());

revoke all on table public.admin_audit_logs from public, anon, authenticated;
grant select on table public.admin_audit_logs to authenticated;

create or replace function public.rawdha_admin_log_action(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_target_label text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_data jsonb;
begin
  if not public.rawdha_is_admin() then
    raise exception 'Accès administrateur requis';
  end if;

  if p_action not in (
    'director_approved', 'director_request_rejected',
    'subscription_suspended', 'subscription_reactivated',
    'subscription_end_date_updated', 'trial_extended',
    'ticket_status_updated', 'ticket_response_saved',
    'community_post_hidden', 'community_post_restored',
    'community_post_pinned', 'community_post_unpinned',
    'notification_sent'
  ) then
    raise exception 'Action administrative non autorisée';
  end if;

  if p_target_type not in ('director_account', 'director_request', 'ticket', 'community_post', 'notification')
    or coalesce(btrim(p_target_id), '') = '' then
    raise exception 'Cible administrative invalide';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Métadonnées administratives invalides';
  end if;

  v_id := 'audit_' || md5(clock_timestamp()::text || random()::text || p_target_id || p_action);
  v_data := jsonb_strip_nulls(jsonb_build_object(
    'id', v_id,
    'actorId', auth.uid()::text,
    'action', p_action,
    'targetType', p_target_type,
    'targetId', p_target_id,
    'targetLabel', nullif(btrim(p_target_label), ''),
    'metadata', p_metadata,
    'createdAt', now()::text
  ));

  insert into public.admin_audit_logs (id, data) values (v_id, v_data);
  return v_data;
end;
$$;

create or replace function public.rawdha_admin_update_director_account(
  p_target_id text,
  p_patch jsonb,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account jsonb;
  v_updated jsonb;
  v_label text;
begin
  if not public.rawdha_is_admin() then
    raise exception 'Accès administrateur requis';
  end if;

  if p_action not in ('subscription_suspended', 'subscription_reactivated', 'subscription_end_date_updated', 'trial_extended') then
    raise exception 'Action d’abonnement non autorisée';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
    or p_patch - array['abonnementActif', 'dateFinAbonnement'] <> '{}'::jsonb
    or p_patch = '{}'::jsonb then
    raise exception 'Mise à jour d’abonnement invalide';
  end if;

  if p_patch ? 'abonnementActif' and jsonb_typeof(p_patch->'abonnementActif') <> 'boolean' then
    raise exception 'État d’abonnement invalide';
  end if;

  if p_patch ? 'dateFinAbonnement' then
    if jsonb_typeof(p_patch->'dateFinAbonnement') <> 'string' or (p_patch->>'dateFinAbonnement') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Date d’abonnement invalide';
    end if;
    perform (p_patch->>'dateFinAbonnement')::date;
  end if;

  select data into v_account from public.comptes where id = p_target_id for update;
  if v_account is null or v_account->>'role' <> 'directeur' then
    raise exception 'Compte Directeur introuvable';
  end if;

  update public.comptes
  set data = data || p_patch || jsonb_build_object('id', id)
  where id = p_target_id
  returning data into v_updated;

  v_label := trim(concat_ws(' ', v_updated->>'prenom', v_updated->>'nom'));
  perform public.rawdha_admin_log_action(
    p_action,
    'director_account',
    p_target_id,
    coalesce(nullif(v_label, ''), v_updated->>'nomCreche'),
    jsonb_strip_nulls(jsonb_build_object(
      'abonnementActif', v_updated->'abonnementActif',
      'dateFinAbonnement', v_updated->'dateFinAbonnement'
    ))
  );

  return v_updated;
end;
$$;

revoke all on function public.rawdha_admin_log_action(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.rawdha_admin_update_director_account(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.rawdha_admin_log_action(text, text, text, text, jsonb) to authenticated;
grant execute on function public.rawdha_admin_update_director_account(text, jsonb, text) to authenticated;
