-- ============================================================================
-- Migration : Portail Parent QR automatique (1 ou plusieurs enfants) & Web Push VAPID
-- Conformité Loi 18-07 (Algérie) : aucune donnée d’enfant n’est exposée tant que
-- la directrice n’a pas explicitement validé la liaison (status = 'approved').
-- ============================================================================

-- Utilisation des fonctions cryptographiques natives PostgreSQL 14+ (sha256, gen_random_uuid)
-- sans dépendance externe à pgcrypto.

create table if not exists public.parent_link_requests (
  id text primary key,
  creche_id text not null,
  creche_nom text not null default '',
  device_token_hash text not null,
  parent_prenom text not null,
  parent_nom text not null,
  parent_telephone text not null,
  parent_lien text not null default 'Parent',
  requested_children jsonb not null default '[]'::jsonb,
  linked_enfant_ids text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  push_enabled boolean not null default false,
  push_subscription jsonb,
  platform_hint text,
  home_screen_installed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creche_id, device_token_hash)
);

create index if not exists idx_parent_link_requests_creche_status
  on public.parent_link_requests (creche_id, status);

create table if not exists public.parent_announcements (
  id text primary key,
  creche_id text not null,
  title text not null,
  message text not null,
  category text not null default 'info',
  target_scope text not null default 'all' check (target_scope in ('all', 'group', 'child')),
  target_group text,
  target_enfant_id text,
  sender_name text not null default 'Direction',
  sent_push_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_parent_announcements_creche_created
  on public.parent_announcements (creche_id, created_at desc);

alter table public.parent_link_requests enable row level security;
alter table public.parent_announcements enable row level security;

-- Politiques RLS Directrice (lecture/validation uniquement sur sa propre crèche)
drop policy if exists parent_link_requests_director_all on public.parent_link_requests;
create policy parent_link_requests_director_all
  on public.parent_link_requests
  for all
  to authenticated
  using (creche_id = auth.uid()::text or public.rawdha_is_admin())
  with check (creche_id = auth.uid()::text or public.rawdha_is_admin());

drop policy if exists parent_announcements_director_all on public.parent_announcements;
create policy parent_announcements_director_all
  on public.parent_announcements
  for all
  to authenticated
  using (creche_id = auth.uid()::text or public.rawdha_is_admin())
  with check (creche_id = auth.uid()::text or public.rawdha_is_admin());

-- RPC publique sécurisée : soumission ou mise à jour d’une demande de liaison par QR
create or replace function public.submit_parent_link_request(
  p_creche_id text,
  p_creche_nom text,
  p_device_token text,
  p_parent_prenom text,
  p_parent_nom text,
  p_parent_telephone text,
  p_parent_lien text,
  p_requested_children jsonb,
  p_platform_hint text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_id text;
  v_existing record;
begin
  if coalesce(trim(p_creche_id), '') = '' or length(coalesce(trim(p_device_token), '')) < 16 then
    raise exception 'Paramètres de liaison invalides.';
  end if;
  if coalesce(trim(p_parent_prenom), '') = '' or coalesce(trim(p_parent_nom), '') = '' then
    raise exception 'Le nom et le prénom du parent sont obligatoires.';
  end if;

  v_hash := encode(sha256(convert_to(trim(p_device_token), 'UTF8')), 'hex');

  select * into v_existing
  from public.parent_link_requests
  where creche_id = trim(p_creche_id)
    and device_token_hash = v_hash;

  if found then
    update public.parent_link_requests
    set parent_prenom = trim(p_parent_prenom),
        parent_nom = trim(p_parent_nom),
        parent_telephone = trim(p_parent_telephone),
        parent_lien = coalesce(nullif(trim(p_parent_lien), ''), 'Parent'),
        requested_children = coalesce(p_requested_children, '[]'::jsonb),
        platform_hint = coalesce(p_platform_hint, platform_hint),
        -- Si le parent avait déjà des enfants validés et demande d'ajouter un frère/sœur,
        -- on conserve ses enfants déjà liés tout en repassant la demande en révision uniquement si aucun enfant n'était lié.
        status = case when cardinality(linked_enfant_ids) > 0 then 'approved' else 'pending' end,
        updated_at = now()
    where id = v_existing.id
    returning id into v_id;
  else
    v_id := 'plr-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    insert into public.parent_link_requests (
      id, creche_id, creche_nom, device_token_hash,
      parent_prenom, parent_nom, parent_telephone, parent_lien,
      requested_children, status, platform_hint
    ) values (
      v_id, trim(p_creche_id), coalesce(trim(p_creche_nom), ''), v_hash,
      trim(p_parent_prenom), trim(p_parent_nom), trim(p_parent_telephone),
      coalesce(nullif(trim(p_parent_lien), ''), 'Parent'),
      coalesce(p_requested_children, '[]'::jsonb), 'pending', p_platform_hint
    );
  end if;

  return jsonb_build_object('id', v_id, 'ok', true);
end;
$$;

-- RPC publique sécurisée : enregistrement de l’abonnement Web Push VAPID + statut écran d’accueil
create or replace function public.register_parent_web_push(
  p_creche_id text,
  p_device_token text,
  p_push_enabled boolean,
  p_push_subscription jsonb default null,
  p_home_screen_installed boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  v_hash := encode(sha256(convert_to(trim(p_device_token), 'UTF8')), 'hex');

  update public.parent_link_requests
  set push_enabled = coalesce(p_push_enabled, push_enabled),
      push_subscription = case when p_push_subscription is not null then p_push_subscription else push_subscription end,
      home_screen_installed = coalesce(p_home_screen_installed, home_screen_installed),
      updated_at = now()
  where creche_id = trim(p_creche_id)
    and device_token_hash = v_hash;

  return jsonb_build_object('ok', found);
end;
$$;

grant execute on function public.submit_parent_link_request(text, text, text, text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.register_parent_web_push(text, text, boolean, jsonb, boolean) to anon, authenticated;

-- RPC publique sécurisée : lecture de l’état du Pass Parent uniquement pour l’appareil détenteur du device_token
-- Aucune donnée d’enfant n’est retournée tant que status <> 'approved'.
create or replace function public.get_parent_portal_snapshot(
  p_creche_id text,
  p_device_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_req public.parent_link_requests%rowtype;
  v_snapshots jsonb := '[]'::jsonb;
  v_announcements jsonb := '[]'::jsonb;
  v_today text := to_char(now(), 'YYYY-MM-DD');
begin
  if coalesce(trim(p_creche_id), '') = '' or length(coalesce(trim(p_device_token), '')) < 16 then
    return null;
  end if;

  v_hash := encode(sha256(convert_to(trim(p_device_token), 'UTF8')), 'hex');

  select * into v_req
  from public.parent_link_requests
  where creche_id = trim(p_creche_id)
    and device_token_hash = v_hash
  limit 1;

  if not found then
    return null;
  end if;

  if v_req.status = 'approved' and cardinality(v_req.linked_enfant_ids) > 0 then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'prenom', coalesce(e.data->>'prenom', ''),
          'nom', coalesce(e.data->>'nom', ''),
          'groupeAge', coalesce(e.data->>'groupeAge', 'Bébés'),
          'dateNaissance', e.data->>'dateNaissance',
          'presenceToday', (
            select jsonb_build_object(
              'statut', pr.data->>'statut',
              'heureArrivee', pr.data->>'heureArrivee',
              'heureDepart', pr.data->>'heureDepart',
              'humeur', pr.data->>'humeur',
              'repas', pr.data->>'repas'
            )
            from public.presences pr
            where pr.data->>'enfantId' = e.id
              and pr.data->>'date' = v_today
            limit 1
          ),
          'todayMeals', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', rp.id,
                'type', coalesce(rp.data->>'type', 'Déjeuner'),
                'menu', coalesce(rp.data->>'menu', '')
              )
            )
            from public.repas rp
            where rp.data->>'crecheId' = v_req.creche_id
              and (rp.data->>'date' = v_today or rp.data->>'jour' is not null)
          ), '[]'::jsonb),
          'todayActivities', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', ac.id,
                'titre', coalesce(ac.data->>'titre', ''),
                'heureDebut', ac.data->>'heureDebut',
                'heureFin', ac.data->>'heureFin',
                'groupe', coalesce(ac.data->>'groupe', '')
              )
            )
            from public.activites ac
            where ac.data->>'crecheId' = v_req.creche_id
              and ac.data->>'date' = v_today
              and (ac.data->>'groupe' is null or ac.data->>'groupe' = coalesce(e.data->>'groupeAge', ''))
          ), '[]'::jsonb),
          'invoices', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', pa.id,
                'moisConcerne', coalesce(pa.data->>'moisConcerne', ''),
                'montant', coalesce((pa.data->>'montant')::numeric, 0),
                'statut', coalesce(pa.data->>'statut', 'En attente')
              )
            )
            from public.paiements pa
            where pa.data->>'enfantId' = e.id
              and coalesce(pa.data->>'statut', '') <> 'Annulé'
          ), '[]'::jsonb)
        )
      ),
      '[]'::jsonb
    )
    into v_snapshots
    from public.enfants e
    where e.id = any(v_req.linked_enfant_ids)
      and e.data->>'crecheId' = v_req.creche_id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'crecheId', a.creche_id,
          'title', a.title,
          'message', a.message,
          'category', a.category,
          'targetScope', a.target_scope,
          'targetGroup', a.target_group,
          'targetEnfantId', a.target_enfant_id,
          'senderName', a.sender_name,
          'sentPushCount', a.sent_push_count,
          'createdAt', a.created_at
        )
        order by a.created_at desc
      ),
      '[]'::jsonb
    )
    into v_announcements
    from (
      select *
      from public.parent_announcements
      where creche_id = v_req.creche_id
      order by created_at desc
      limit 30
    ) a;
  end if;

  return jsonb_build_object(
    'request', jsonb_build_object(
      'id', v_req.id,
      'crecheId', v_req.creche_id,
      'crecheNom', v_req.creche_nom,
      'parentPrenom', v_req.parent_prenom,
      'parentNom', v_req.parent_nom,
      'parentTelephone', v_req.parent_telephone,
      'parentLien', v_req.parent_lien,
      'requestedChildren', v_req.requested_children,
      'linkedEnfantIds', to_jsonb(v_req.linked_enfant_ids),
      'linkedSnapshots', v_snapshots,
      'status', v_req.status,
      'rejectionReason', v_req.rejection_reason,
      'pushEnabled', v_req.push_enabled,
      'homeScreenInstalled', v_req.home_screen_installed,
      'platformHint', v_req.platform_hint,
      'createdAt', v_req.created_at,
      'updatedAt', v_req.updated_at
    ),
    'announcements', v_announcements
  );
end;
$$;

grant execute on function public.get_parent_portal_snapshot(text, text) to anon, authenticated;
