-- Rawdha+ — Durcissement du parcours QR parent
-- P0 : validation serveur, tokens stricts, rate limit et anti-doublon.
-- Cette migration ne supprime aucune demande existante.

begin;

create table if not exists public.admission_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  last_request_at timestamptz not null default now()
);

create index if not exists admission_rate_limits_last_request_idx
  on public.admission_rate_limits (last_request_at);

alter table public.admission_rate_limits enable row level security;
revoke all on table public.admission_rate_limits from public, anon, authenticated;

-- Le token généré par Rawdha+ est une chaîne hexadécimale de 64 caractères.
create or replace function public.rawdha_get_inscription_context(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_token text := trim(coalesce(p_token, ''));
  v_link jsonb;
  v_settings jsonb;
  v_creche_id text;
begin
  if v_token !~ '^[0-9a-fA-F]{64}$' then
    return null;
  end if;

  select l.data into v_link
  from public.inscription_liens l
  where l.data->>'tokenHash' = encode(extensions.digest(v_token, 'sha256'), 'hex')
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

-- Limites prudentes pour éviter le spam sans bloquer une crèche active :
-- 100 demandes/heure par lien et 5 demandes/heure par téléphone et lien.
create or replace function public.rawdha_admission_rate_limit(p_link_id text, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_now timestamptz := now();
  v_key text;
  v_count integer;
begin
  if nullif(trim(coalesce(p_link_id, '')), '') is null then
    return false;
  end if;

  v_key := encode(extensions.digest('link:' || trim(p_link_id), 'sha256'), 'hex');
  insert into public.admission_rate_limits (key_hash, window_started_at, request_count, last_request_at)
  values (v_key, v_now, 1, v_now)
  on conflict (key_hash) do update
  set window_started_at = case
        when public.admission_rate_limits.window_started_at <= v_now - interval '1 hour' then v_now
        else public.admission_rate_limits.window_started_at
      end,
      request_count = case
        when public.admission_rate_limits.window_started_at <= v_now - interval '1 hour' then 1
        else public.admission_rate_limits.request_count + 1
      end,
      last_request_at = v_now
  returning request_count into v_count;

  if v_count > 100 then
    return false;
  end if;

  v_key := encode(extensions.digest(
    'phone:' || trim(p_link_id) || ':' || regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'),
    'sha256'
  ), 'hex');
  insert into public.admission_rate_limits (key_hash, window_started_at, request_count, last_request_at)
  values (v_key, v_now, 1, v_now)
  on conflict (key_hash) do update
  set window_started_at = case
        when public.admission_rate_limits.window_started_at <= v_now - interval '1 hour' then v_now
        else public.admission_rate_limits.window_started_at
      end,
      request_count = case
        when public.admission_rate_limits.window_started_at <= v_now - interval '1 hour' then 1
        else public.admission_rate_limits.request_count + 1
      end,
      last_request_at = v_now
  returning request_count into v_count;

  return v_count <= 5;
end;
$$;

revoke all on function public.rawdha_admission_rate_limit(text, text) from public, anon, authenticated;

create unique index if not exists demandes_admission_pending_dedupe_idx
on public.demandes_admission (
  (data->>'lienId'),
  (lower(trim(data->>'parentTelephone'))),
  (lower(trim(data->>'nom'))),
  (lower(trim(data->>'prenom'))),
  (data->>'dateNaissance')
)
where coalesce(data->>'statut', '') = 'en_attente';

create or replace function public.rawdha_submit_admission(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := trim(coalesce(p_token, ''));
  v_link jsonb;
  v_settings jsonb;
  v_creche_id text;
  v_id text := 'admission_' || extensions.gen_random_uuid()::text;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_nom text := left(trim(coalesce(p_payload->>'nom', '')), 100);
  v_prenom text := left(trim(coalesce(p_payload->>'prenom', '')), 100);
  v_date_naissance text := trim(coalesce(p_payload->>'dateNaissance', ''));
  v_birth_date date;
  v_genre text := trim(coalesce(p_payload->>'genre', 'Garçon'));
  v_groupe_age text := trim(coalesce(p_payload->>'groupeAge', 'Bébés'));
  v_allergie text := left(trim(coalesce(p_payload->>'allergie', '')), 1000);
  v_regime text := left(trim(coalesce(p_payload->>'regimeAlimentaire', '')), 1000);
  v_blood_group text := left(trim(coalesce(p_payload->>'bloodGroup', '')), 10);
  v_weight text := left(trim(coalesce(p_payload->>'weightKg', '')), 20);
  v_pediatrician text := left(trim(coalesce(p_payload->>'pediatricianName', '')), 150);
  v_vaccinations text := left(trim(coalesce(p_payload->>'vaccinations', '')), 2000);
  v_notes text := left(trim(coalesce(p_payload->>'notesMedicales', '')), 3000);
  v_parent_nom text := left(trim(coalesce(p_payload->>'parentNom', '')), 100);
  v_parent_prenom text := left(trim(coalesce(p_payload->>'parentPrenom', '')), 100);
  v_parent_telephone text := regexp_replace(trim(coalesce(p_payload->>'parentTelephone', '')), '[^0-9+]', '', 'g');
  v_parent_email text := lower(left(trim(coalesce(p_payload->>'parentEmail', '')), 180));
  v_parent_adresse text := left(trim(coalesce(p_payload->>'parentAdresse', '')), 500);
  v_parent_profession text := left(trim(coalesce(p_payload->>'parentProfession', '')), 150);
  v_parent_lien text := trim(coalesce(p_payload->>'parentLien', 'Tuteur'));
  v_documents_requis jsonb;
  v_documents_fichiers jsonb := case
    when jsonb_typeof(v_payload->'documentsFichiers') = 'object' then v_payload->'documentsFichiers'
    else '{}'::jsonb
  end;
  v_settings_name text;
begin
  if octet_length(v_payload::text) > 12000000 then
    raise exception 'payload_too_large';
  end if;

  if v_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'invalid_link';
  end if;

  if v_nom = '' or v_prenom = '' or v_date_naissance = '' or v_parent_nom = ''
     or v_parent_prenom = '' or v_parent_telephone = '' then
    raise exception 'required_fields';
  end if;

  begin
    v_birth_date := v_date_naissance::date;
  exception when others then
    raise exception 'invalid_birth_date';
  end;

  if v_birth_date > current_date or v_birth_date < (current_date - interval '12 years')::date then
    raise exception 'invalid_birth_date';
  end if;

  if left(v_parent_telephone, 4) = '+213' then
    v_parent_telephone := '0' || substr(v_parent_telephone, 5);
  elsif left(v_parent_telephone, 5) = '00213' then
    v_parent_telephone := '0' || substr(v_parent_telephone, 6);
  end if;

  if v_parent_telephone !~ '^0[2-9][0-9]{8}$' then
    raise exception 'invalid_phone';
  end if;

  if v_parent_email <> '' and v_parent_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email';
  end if;

  if v_genre not in ('Garçon', 'Fille') then
    raise exception 'invalid_genre';
  end if;

  if v_groupe_age not in ('Bébés', 'Moyens', 'Grands') then
    raise exception 'invalid_age_group';
  end if;

  if v_parent_lien not in ('Mère', 'Père', 'Tuteur') then
    raise exception 'invalid_parent_link';
  end if;

  if (select count(*) from jsonb_object_keys(v_documents_fichiers)) > 4 then
    raise exception 'too_many_files';
  end if;

  if exists (
    select 1
    from jsonb_each(v_documents_fichiers) as f(key, value)
    where jsonb_typeof(f.value) <> 'object'
       or octet_length(coalesce(f.value->>'contenu', '')) > 3000000
  ) then
    raise exception 'file_too_large';
  end if;

  v_documents_requis := jsonb_build_object(
    'certificatMedical', (v_payload->'documentsRequis'->>'certificatMedical') = 'true',
    'carnetVaccination', (v_payload->'documentsRequis'->>'carnetVaccination') = 'true',
    'justificatifDomicile', (v_payload->'documentsRequis'->>'justificatifDomicile') = 'true',
    'photoIdentite', (v_payload->'documentsRequis'->>'photoIdentite') = 'true'
  );

  select l.data into v_link
  from public.inscription_liens l
  where l.data->>'tokenHash' = encode(extensions.digest(v_token, 'sha256'), 'hex')
    and coalesce((l.data->>'active')::boolean, false)
    and (
      nullif(l.data->>'expiresAt', '') is null
      or (l.data->>'expiresAt')::timestamptz > now()
    )
  limit 1;

  if v_link is null then
    raise exception 'invalid_link';
  end if;

  if exists (
    select 1
    from public.demandes_admission d
    where coalesce(d.data->>'statut', '') = 'en_attente'
      and d.data->>'lienId' = v_link->>'id'
      and lower(trim(d.data->>'parentTelephone')) = lower(trim(v_parent_telephone))
      and lower(trim(d.data->>'nom')) = lower(trim(v_nom))
      and lower(trim(d.data->>'prenom')) = lower(trim(v_prenom))
      and d.data->>'dateNaissance' = v_date_naissance
    limit 1
  ) then
    raise exception 'duplicate_request';
  end if;

  if not public.rawdha_admission_rate_limit(v_link->>'id', v_parent_telephone) then
    raise exception 'rate_limited';
  end if;

  v_creche_id := v_link->>'crecheId';
  select p.data into v_settings
  from public.parametres p
  where p.id = 'creche_' || v_creche_id
  limit 1;
  v_settings_name := coalesce(v_settings->>'crecheName', v_link->>'nomCreche', 'Rawdha+');

  insert into public.demandes_admission (id, data)
  values (
    v_id,
    jsonb_build_object(
      'crecheId', v_creche_id,
      'nomCreche', v_settings_name,
      'lienId', v_link->>'id',
      'statut', 'en_attente',
      'dateDemande', now() at time zone 'utc',
      'nom', v_nom,
      'prenom', v_prenom,
      'dateNaissance', v_date_naissance,
      'genre', v_genre,
      'groupeAge', v_groupe_age,
      'allergie', v_allergie,
      'regimeAlimentaire', v_regime,
      'bloodGroup', v_blood_group,
      'weightKg', v_weight,
      'pediatricianName', v_pediatrician,
      'vaccinations', v_vaccinations,
      'notesMedicales', v_notes,
      'parentNom', v_parent_nom,
      'parentPrenom', v_parent_prenom,
      'parentTelephone', v_parent_telephone,
      'parentEmail', v_parent_email,
      'parentAdresse', v_parent_adresse,
      'parentProfession', v_parent_profession,
      'parentLien', v_parent_lien,
      'documentsRequis', v_documents_requis,
      'documentsFichiers', v_documents_fichiers
    )
  );

  return jsonb_build_object('id', v_id, 'nomCreche', v_settings_name, 'statut', 'en_attente');
exception
  when unique_violation then
    raise exception 'duplicate_request';
end;
$$;

grant execute on function public.rawdha_get_inscription_context(text) to anon, authenticated;
grant execute on function public.rawdha_submit_admission(text, jsonb) to anon, authenticated;

commit;
