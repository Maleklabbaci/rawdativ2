-- Rawdha+ — Liens privés d'admission et demandes d'inscription enfant
-- Les tokens bruts ne sont jamais stockés en base : seul leur hash SHA-256 est conservé.

create table if not exists public.inscription_liens (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.demandes_admission (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.inscription_liens enable row level security;
alter table public.demandes_admission enable row level security;

create index if not exists inscription_liens_creche_idx
  on public.inscription_liens ((data->>'crecheId'));
create index if not exists inscription_liens_token_hash_idx
  on public.inscription_liens ((data->>'tokenHash'));
create index if not exists demandes_admission_creche_idx
  on public.demandes_admission ((data->>'crecheId'));
create index if not exists demandes_admission_statut_idx
  on public.demandes_admission ((data->>'statut'));

revoke all on public.inscription_liens, public.demandes_admission from anon;
revoke all on public.inscription_liens, public.demandes_admission from authenticated;

drop policy if exists "inscription_liens_select" on public.inscription_liens;
create policy "inscription_liens_select" on public.inscription_liens
  for select to authenticated
  using (public.rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text);

drop policy if exists "inscription_liens_insert" on public.inscription_liens;
create policy "inscription_liens_insert" on public.inscription_liens
  for insert to authenticated
  with check (public.rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text);

drop policy if exists "inscription_liens_update" on public.inscription_liens;
create policy "inscription_liens_update" on public.inscription_liens
  for update to authenticated
  using (public.rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text)
  with check (public.rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text);

drop policy if exists "inscription_liens_delete" on public.inscription_liens;
create policy "inscription_liens_delete" on public.inscription_liens
  for delete to authenticated
  using (public.rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text);

drop policy if exists "demandes_admission_select" on public.demandes_admission;
create policy "demandes_admission_select" on public.demandes_admission
  for select to authenticated
  using (public.rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text);

drop policy if exists "demandes_admission_update" on public.demandes_admission;
create policy "demandes_admission_update" on public.demandes_admission
  for update to authenticated
  using (public.rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text)
  with check (public.rawdha_is_admin() or (data->>'crecheId') = auth.uid()::text);

drop policy if exists "demandes_admission_delete" on public.demandes_admission;
create policy "demandes_admission_delete" on public.demandes_admission
  for delete to authenticated
  using (public.rawdha_is_admin());

-- Le directeur génère un lien. Le token brut est rendu une seule fois à son navigateur.
create or replace function public.rawdha_create_inscription_link(p_label text default null, p_expires_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id text := auth.uid()::text;
  v_link_id text := 'lien_' || extensions.gen_random_uuid()::text;
  v_token text := replace(extensions.gen_random_uuid()::text || extensions.gen_random_uuid()::text, '-', '');
  v_settings jsonb;
  v_name text;
begin
  if auth.uid() is null or public.rawdha_current_role() <> 'directeur' then
    raise exception 'not_allowed';
  end if;

  select p.data into v_settings
  from public.parametres p
  where p.id = 'creche_' || v_user_id
  limit 1;

  v_name := coalesce(v_settings->>'crecheName', 'Rawdha+');

  insert into public.inscription_liens (id, data)
  values (
    v_link_id,
    jsonb_build_object(
      'id', v_link_id,
      'crecheId', v_user_id,
      'tokenHash', encode(extensions.digest(v_token, 'sha256'), 'hex'),
      'label', nullif(left(coalesce(p_label, ''), 120), ''),
      'nomCreche', v_name,
      'active', true,
      'createdAt', now() at time zone 'utc',
      'expiresAt', p_expires_at
    )
  );

  return jsonb_build_object(
    'id', v_link_id,
    'token', v_token,
    'nomCreche', v_name,
    'expiresAt', p_expires_at
  );
end;
$$;

grant execute on function public.rawdha_create_inscription_link(text, timestamptz) to authenticated;

-- Le formulaire public ne reçoit que les informations publiques de la crèche.
create or replace function public.rawdha_get_inscription_context(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_link jsonb;
  v_settings jsonb;
  v_creche_id text;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    return null;
  end if;

  select l.data into v_link
  from public.inscription_liens l
  where l.data->>'tokenHash' = encode(extensions.digest(trim(p_token), 'sha256'), 'hex')
    and coalesce((l.data->>'active')::boolean, false)
    and (
      nullif(l.data->>'expiresAt', '') is null
      or (l.data->>'expiresAt')::timestamptz > now()
    )
  limit 1;

  if v_link is null then
    return null;
  end if;

  v_creche_id := v_link->>'crecheId';
  select p.data into v_settings
  from public.parametres p
  where p.id = 'creche_' || v_creche_id
  limit 1;

  return jsonb_build_object(
    'linkId', v_link->>'id',
    'nomCreche', coalesce(v_settings->>'crecheName', v_link->>'nomCreche', 'Rawdha+'),
    'adresse', coalesce(v_settings->>'addressLine', ''),
    'logoUrl', coalesce(v_settings->>'logoUrl', null),
    'siteWeb', coalesce(v_settings->>'siteWeb', '')
  );
end;
$$;

grant execute on function public.rawdha_get_inscription_context(text) to anon, authenticated;

-- Le parent anonyme ne peut créer qu'une demande en attente liée au token fourni.
create or replace function public.rawdha_submit_admission(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link jsonb;
  v_settings jsonb;
  v_creche_id text;
  v_id text := 'admission_' || extensions.gen_random_uuid()::text;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_nom text := left(trim(coalesce(v_payload->>'nom', '')), 100);
  v_prenom text := left(trim(coalesce(v_payload->>'prenom', '')), 100);
  v_date_naissance text := trim(coalesce(v_payload->>'dateNaissance', ''));
  v_parent_nom text := left(trim(coalesce(v_payload->>'parentNom', '')), 100);
  v_parent_prenom text := left(trim(coalesce(v_payload->>'parentPrenom', '')), 100);
  v_parent_telephone text := left(trim(coalesce(v_payload->>'parentTelephone', '')), 40);
  v_parent_lien text := left(trim(coalesce(v_payload->>'parentLien', 'Tuteur')), 30);
  v_name text;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    raise exception 'invalid_link';
  end if;

  if v_nom = '' or v_prenom = '' or v_date_naissance = '' or v_parent_nom = ''
     or v_parent_prenom = '' or v_parent_telephone = '' then
    raise exception 'required_fields';
  end if;

  if v_date_naissance !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid_birth_date';
  end if;

  if octet_length(v_payload::text) > 12000000 then
    raise exception 'payload_too_large';
  end if;

  select l.data into v_link
  from public.inscription_liens l
  where l.data->>'tokenHash' = encode(extensions.digest(trim(p_token), 'sha256'), 'hex')
    and coalesce((l.data->>'active')::boolean, false)
    and (
      nullif(l.data->>'expiresAt', '') is null
      or (l.data->>'expiresAt')::timestamptz > now()
    )
  limit 1;

  if v_link is null then
    raise exception 'invalid_link';
  end if;

  v_creche_id := v_link->>'crecheId';
  select p.data into v_settings
  from public.parametres p
  where p.id = 'creche_' || v_creche_id
  limit 1;
  v_name := coalesce(v_settings->>'crecheName', v_link->>'nomCreche', 'Rawdha+');

  insert into public.demandes_admission (id, data)
  values (
    v_id,
    jsonb_build_object(
      'crecheId', v_creche_id,
      'nomCreche', v_name,
      'lienId', v_link->>'id',
      'statut', 'en_attente',
      'dateDemande', now() at time zone 'utc',
      'nom', v_nom,
      'prenom', v_prenom,
      'dateNaissance', v_date_naissance,
      'genre', coalesce(nullif(v_payload->>'genre', ''), 'Garçon'),
      'groupeAge', coalesce(nullif(v_payload->>'groupeAge', ''), 'Bébés'),
      'allergie', left(coalesce(v_payload->>'allergie', ''), 1000),
      'regimeAlimentaire', left(coalesce(v_payload->>'regimeAlimentaire', ''), 1000),
      'bloodGroup', left(coalesce(v_payload->>'bloodGroup', ''), 10),
      'weightKg', left(coalesce(v_payload->>'weightKg', ''), 20),
      'pediatricianName', left(coalesce(v_payload->>'pediatricianName', ''), 150),
      'vaccinations', left(coalesce(v_payload->>'vaccinations', ''), 2000),
      'notesMedicales', left(coalesce(v_payload->>'notesMedicales', ''), 3000),
      'parentNom', v_parent_nom,
      'parentPrenom', v_parent_prenom,
      'parentTelephone', v_parent_telephone,
      'parentEmail', left(coalesce(v_payload->>'parentEmail', ''), 180),
      'parentAdresse', left(coalesce(v_payload->>'parentAdresse', ''), 500),
      'parentProfession', left(coalesce(v_payload->>'parentProfession', ''), 150),
      'parentLien', v_parent_lien,
      'documentsRequis', coalesce(v_payload->'documentsRequis', '{}'::jsonb),
      'documentsFichiers', case
        when jsonb_typeof(v_payload->'documentsFichiers') = 'object' then v_payload->'documentsFichiers'
        else '{}'::jsonb
      end
    )
  );

  return jsonb_build_object('id', v_id, 'nomCreche', v_name, 'statut', 'en_attente');
end;
$$;

grant execute on function public.rawdha_submit_admission(text, jsonb) to anon, authenticated;

-- La décision de la direction est atomique : l'enfant actif et le statut de la demande
-- sont écrits dans la même transaction. Cela évite les doublons en cas de double clic.
create or replace function public.rawdha_decide_admission(p_id text, p_statut text, p_motif text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_demande jsonb;
  v_enfant_id text;
  v_creche_id text;
  v_statut text := lower(trim(coalesce(p_statut, '')));
  v_directeur_id text := auth.uid()::text;
  v_parent_id text := 'parent_' || extensions.gen_random_uuid()::text;
  v_contact_id text := 'contact_' || extensions.gen_random_uuid()::text;
  v_documents jsonb;
begin
  if auth.uid() is null or (public.rawdha_current_role() <> 'directeur' and not public.rawdha_is_admin()) then
    raise exception 'not_allowed';
  end if;

  if v_statut not in ('acceptee', 'refusee') then
    raise exception 'invalid_status';
  end if;

  select d.data into v_demande
  from public.demandes_admission d
  where d.id = p_id
  for update;

  if v_demande is null then
    raise exception 'not_found';
  end if;

  v_creche_id := v_demande->>'crecheId';
  if not public.rawdha_is_admin() and v_creche_id <> v_directeur_id then
    raise exception 'not_allowed';
  end if;

  if coalesce(v_demande->>'statut', '') = 'acceptee' then
    return jsonb_build_object(
      'id', p_id,
      'statut', 'acceptee',
      'enfantId', v_demande->>'enfantId'
    );
  end if;

  if v_statut = 'refusee' then
    update public.demandes_admission
    set data = v_demande || jsonb_build_object(
      'statut', 'refusee',
      'motifRefus', left(coalesce(p_motif, ''), 1000),
      'traiteLe', now() at time zone 'utc',
      'traitePar', v_directeur_id
    )
    where id = p_id;

    return jsonb_build_object('id', p_id, 'statut', 'refusee');
  end if;

  v_enfant_id := 'enfant_' || extensions.gen_random_uuid()::text;
  v_documents := coalesce(v_demande->'documentsRequis', jsonb_build_object(
    'certificatMedical', false,
    'carnetVaccination', false,
    'justificatifDomicile', false,
    'photoIdentite', false
  ));

  insert into public.enfants (id, data)
  values (
    v_enfant_id,
    jsonb_build_object(
      'id', v_enfant_id,
      'crecheId', v_creche_id,
      'nom', v_demande->>'nom',
      'prenom', v_demande->>'prenom',
      'dateNaissance', v_demande->>'dateNaissance',
      'genre', coalesce(v_demande->>'genre', 'Garçon'),
      'groupeAge', coalesce(v_demande->>'groupeAge', 'Bébés'),
      'dateInscription', (now() at time zone 'utc')::date::text,
      'statut', 'Actif',
      'allergie', nullif(v_demande->>'allergie', ''),
      'regimeAlimentaire', nullif(v_demande->>'regimeAlimentaire', ''),
      'groupeSanguin', nullif(v_demande->>'bloodGroup', ''),
      'poidsKg', case when (v_demande->>'weightKg') ~ '^\d+(\.\d+)?$' then (v_demande->>'weightKg')::numeric else null end,
      'medecinTraitant', nullif(v_demande->>'pediatricianName', ''),
      'vaccinations', nullif(v_demande->>'vaccinations', ''),
      'notesMedicales', nullif(v_demande->>'notesMedicales', ''),
      'contactsUrgence', jsonb_build_array(jsonb_build_object(
        'id', v_contact_id,
        'nom', concat_ws(' ', v_demande->>'parentPrenom', v_demande->>'parentNom'),
        'telephone', v_demande->>'parentTelephone',
        'lien', coalesce(v_demande->>'parentLien', 'Tuteur')
      )),
      'parents', jsonb_build_array(jsonb_build_object(
        'id', v_parent_id,
        'nom', v_demande->>'parentNom',
        'prenom', v_demande->>'parentPrenom',
        'lien', coalesce(v_demande->>'parentLien', 'Tuteur'),
        'telephone', v_demande->>'parentTelephone',
        'email', nullif(v_demande->>'parentEmail', ''),
        'adresse', nullif(v_demande->>'parentAdresse', ''),
        'profession', nullif(v_demande->>'parentProfession', '')
      )),
      'documentsRequis', v_documents,
      'documentsFichiers', coalesce(v_demande->'documentsFichiers', '{}'::jsonb)
    )
  );

  update public.demandes_admission
  set data = v_demande || jsonb_build_object(
    'statut', 'acceptee',
    'enfantId', v_enfant_id,
    'traiteLe', now() at time zone 'utc',
    'traitePar', v_directeur_id
  )
  where id = p_id;

  return jsonb_build_object('id', p_id, 'statut', 'acceptee', 'enfantId', v_enfant_id);
end;
$$;

grant execute on function public.rawdha_decide_admission(text, text, text) to authenticated;
