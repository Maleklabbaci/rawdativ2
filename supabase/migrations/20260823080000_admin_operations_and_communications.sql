-- Exploitation Administrateur Rawdha+
-- Pipeline commercial, relances manuelles et communication ciblée.
-- Aucune automatisation WhatsApp ou tâche planifiée n’est créée dans cette migration.

create table if not exists public.admin_followups (
  id text primary key,
  data jsonb not null default '{}'::jsonb
);

create index if not exists admin_followups_target_idx on public.admin_followups ((data->>'targetAccountId'));
create index if not exists admin_followups_due_at_idx on public.admin_followups ((data->>'dueAt'));

alter table public.admin_followups enable row level security;

drop policy if exists admin_followups_select_admin on public.admin_followups;
create policy admin_followups_select_admin
  on public.admin_followups
  for select
  to authenticated
  using (public.rawdha_is_admin());

revoke all on table public.admin_followups from public, anon, authenticated;
grant select on table public.admin_followups to authenticated;

-- Les Directrices n’écrivent plus directement dans les annonces : la lecture est
-- validée dans une RPC qui ne modifie que leur propre identifiant dans readBy.
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_select_directeur on public.notifications;

create policy notifications_select_recipient_or_admin
  on public.notifications
  for select
  to authenticated
  using (
    public.rawdha_is_admin()
    or data->>'recipientRole' = 'all_directeurs'
    or data->>'recipientRole' = auth.uid()::text
    or coalesce(data->'recipientIds', '[]'::jsonb) ? auth.uid()::text
  );

create policy notifications_update_admin
  on public.notifications
  for update
  to authenticated
  using (public.rawdha_is_admin())
  with check (public.rawdha_is_admin());

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
    'ticket_status_updated', 'ticket_response_saved', 'ticket_assigned',
    'ticket_priority_updated', 'ticket_due_date_updated',
    'community_post_hidden', 'community_post_restored',
    'community_post_pinned', 'community_post_unpinned',
    'notification_sent', 'communication_segment_sent', 'notification_deleted',
    'commercial_stage_updated', 'commercial_owner_updated',
    'commercial_note_updated', 'followup_scheduled', 'followup_recorded',
    'admin_role_prepared'
  ) then
    raise exception 'Action administrative non autorisée';
  end if;

  if p_target_type not in ('director_account', 'director_request', 'ticket', 'community_post', 'notification', 'followup')
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

create or replace function public.rawdha_admin_update_director_operations(
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

  if p_action not in ('commercial_stage_updated', 'commercial_owner_updated', 'commercial_note_updated', 'followup_scheduled', 'followup_recorded') then
    raise exception 'Action opérationnelle non autorisée';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
    or p_patch - array['commercialStage', 'commercialOwnerId', 'nextFollowUpAt', 'lastFollowUpAt', 'commercialNote'] <> '{}'::jsonb
    or p_patch = '{}'::jsonb then
    raise exception 'Mise à jour opérationnelle invalide';
  end if;

  if p_patch ? 'commercialStage' and (jsonb_typeof(p_patch->'commercialStage') <> 'string' or p_patch->>'commercialStage' not in ('nouveau', 'essai', 'relance', 'interesse', 'abonne', 'suspendu')) then
    raise exception 'Étape commerciale invalide';
  end if;

  if p_patch ? 'commercialOwnerId' and jsonb_typeof(p_patch->'commercialOwnerId') <> 'string' then
    raise exception 'Responsable commercial invalide';
  end if;

  if p_patch ? 'commercialNote' and (jsonb_typeof(p_patch->'commercialNote') <> 'string' or length(p_patch->>'commercialNote') > 1200) then
    raise exception 'Note commerciale invalide';
  end if;

  if p_patch ? 'nextFollowUpAt' and (jsonb_typeof(p_patch->'nextFollowUpAt') <> 'string' or (p_patch->>'nextFollowUpAt') !~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'Date de relance invalide';
  end if;

  if p_patch ? 'lastFollowUpAt' and (jsonb_typeof(p_patch->'lastFollowUpAt') <> 'string' or (p_patch->>'lastFollowUpAt') !~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'Date de dernière relance invalide';
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
    coalesce(nullif(v_updated->>'nomCreche', ''), nullif(v_label, '')),
    p_patch
  );

  return v_updated;
end;
$$;

create or replace function public.rawdha_admin_create_followup(
  p_target_id text,
  p_channel text,
  p_note text default null,
  p_due_at text default null,
  p_status text default 'planned'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account jsonb;
  v_id text;
  v_data jsonb;
  v_label text;
begin
  if not public.rawdha_is_admin() then
    raise exception 'Accès administrateur requis';
  end if;

  if p_channel not in ('whatsapp_manual', 'appel_manuel', 'notification_interne', 'email', 'autre') then
    raise exception 'Canal de relance invalide';
  end if;

  if p_status not in ('planned', 'done', 'cancelled') then
    raise exception 'Statut de relance invalide';
  end if;

  if length(coalesce(p_note, '')) > 1200 then
    raise exception 'Note de relance trop longue';
  end if;

  if p_due_at is not null and p_due_at !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Date de relance invalide';
  end if;

  select data into v_account from public.comptes where id = p_target_id;
  if v_account is null or v_account->>'role' <> 'directeur' then
    raise exception 'Compte Directeur introuvable';
  end if;

  v_id := 'followup_' || md5(clock_timestamp()::text || random()::text || p_target_id || p_channel);
  v_label := coalesce(nullif(v_account->>'nomCreche', ''), trim(concat_ws(' ', v_account->>'prenom', v_account->>'nom')));
  v_data := jsonb_strip_nulls(jsonb_build_object(
    'id', v_id,
    'targetAccountId', p_target_id,
    'targetLabel', v_label,
    'channel', p_channel,
    'note', nullif(btrim(p_note), ''),
    'dueAt', p_due_at,
    'status', p_status,
    'createdBy', auth.uid()::text,
    'createdAt', now()::text,
    'completedAt', case when p_status = 'done' then now()::text else null end
  ));

  insert into public.admin_followups (id, data) values (v_id, v_data);
  perform public.rawdha_admin_log_action(
    case when p_status = 'done' then 'followup_recorded' else 'followup_scheduled' end,
    'followup',
    v_id,
    v_label,
    jsonb_strip_nulls(jsonb_build_object('targetAccountId', p_target_id, 'channel', p_channel, 'dueAt', p_due_at, 'status', p_status))
  );
  return v_data;
end;
$$;

create or replace function public.rawdha_admin_publish_notification(
  p_payload jsonb,
  p_recipient_ids text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_data jsonb;
  v_valid_ids text[];
  v_audience text;
begin
  if not public.rawdha_is_admin() then
    raise exception 'Accès administrateur requis';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or p_payload - array['title', 'message', 'bgColor', 'textColor', 'buttonColor', 'icon', 'showAsPopup', 'ctaLabel', 'ctaType', 'ctaUrl', 'ctaPage', 'repeatCount', 'repeatIntervalSeconds', 'audienceLabel'] <> '{}'::jsonb then
    raise exception 'Annonce invalide';
  end if;

  if coalesce(length(btrim(p_payload->>'title')), 0) = 0 or length(p_payload->>'title') > 140
    or coalesce(length(btrim(p_payload->>'message')), 0) = 0 or length(p_payload->>'message') > 3000 then
    raise exception 'Titre ou message invalide';
  end if;

  if p_payload ? 'ctaType' and p_payload->>'ctaType' not in ('link', 'page') then
    raise exception 'Type de bouton invalide';
  end if;

  if coalesce(p_payload->>'ctaType', '') = 'link' and coalesce(p_payload->>'ctaUrl', '') <> '' and p_payload->>'ctaUrl' !~ '^https?://' then
    raise exception 'Lien de bouton invalide';
  end if;

  if p_payload ? 'showAsPopup' and jsonb_typeof(p_payload->'showAsPopup') <> 'boolean' then
    raise exception 'Priorité d’annonce invalide';
  end if;

  if p_recipient_ids is null or cardinality(p_recipient_ids) = 0 then
    v_valid_ids := null;
    v_audience := 'all_directeurs';
  else
    select array_agg(id order by id) into v_valid_ids
    from public.comptes
    where id = any(p_recipient_ids)
      and data->>'role' = 'directeur'
      and coalesce(data->>'approvalStatus', 'approved') = 'approved';
    if coalesce(cardinality(v_valid_ids), 0) = 0 then
      raise exception 'Aucun destinataire Directeur valide';
    end if;
    v_audience := 'segmented';
  end if;

  v_id := 'notif_' || md5(clock_timestamp()::text || random()::text || coalesce(array_to_string(v_valid_ids, ','), 'all'));
  v_data := jsonb_strip_nulls(p_payload || jsonb_build_object(
    'id', v_id,
    'recipientRole', v_audience,
    'recipientIds', coalesce(to_jsonb(v_valid_ids), '[]'::jsonb),
    'senderName', coalesce((select trim(concat_ws(' ', data->>'prenom', data->>'nom')) from public.comptes where id = auth.uid()::text), 'Admin'),
    'createdAt', now()::text,
    'readBy', '[]'::jsonb
  ));

  insert into public.notifications (id, data) values (v_id, v_data);
  perform public.rawdha_admin_log_action(
    case when v_audience = 'all_directeurs' then 'notification_sent' else 'communication_segment_sent' end,
    'notification',
    v_id,
    p_payload->>'title',
    jsonb_strip_nulls(jsonb_build_object('audience', v_audience, 'recipientsCount', coalesce(cardinality(v_valid_ids), (select count(*) from public.comptes where data->>'role' = 'directeur' and coalesce(data->>'approvalStatus', 'approved') = 'approved'), 0), 'audienceLabel', p_payload->>'audienceLabel'))
  );
  return v_data;
end;
$$;

create or replace function public.rawdha_mark_notification_read(p_notification_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
  v_user_id text := auth.uid()::text;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  select data into v_data from public.notifications where id = p_notification_id for update;
  if v_data is null then
    raise exception 'Annonce introuvable';
  end if;

  if not public.rawdha_is_admin()
    and v_data->>'recipientRole' <> 'all_directeurs'
    and v_data->>'recipientRole' <> v_user_id
    and not (coalesce(v_data->'recipientIds', '[]'::jsonb) ? v_user_id) then
    raise exception 'Annonce non accessible';
  end if;

  if not coalesce(v_data->'readBy', '[]'::jsonb) ? v_user_id then
    update public.notifications
    set data = data || jsonb_build_object('readBy', coalesce(data->'readBy', '[]'::jsonb) || to_jsonb(v_user_id))
    where id = p_notification_id
    returning data into v_data;
  end if;

  return v_data;
end;
$$;

revoke all on function public.rawdha_admin_update_director_operations(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.rawdha_admin_create_followup(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.rawdha_admin_publish_notification(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.rawdha_mark_notification_read(text) from public, anon, authenticated;

grant execute on function public.rawdha_admin_update_director_operations(text, jsonb, text) to authenticated;
grant execute on function public.rawdha_admin_create_followup(text, text, text, text, text) to authenticated;
grant execute on function public.rawdha_admin_publish_notification(jsonb, text[]) to authenticated;
grant execute on function public.rawdha_mark_notification_read(text) to authenticated;
