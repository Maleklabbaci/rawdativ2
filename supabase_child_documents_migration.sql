-- Normalise les documents d'un enfant créé depuis une admission, y compris pour
-- les anciennes demandes dont documentsRequis est partiel ou absent.
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
  v_documents_fichiers jsonb;
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
  v_documents := jsonb_build_object(
    'certificatMedical', lower(coalesce(v_demande->'documentsRequis'->>'certificatMedical', 'false')) = 'true',
    'carnetVaccination', lower(coalesce(v_demande->'documentsRequis'->>'carnetVaccination', 'false')) = 'true',
    'justificatifDomicile', lower(coalesce(v_demande->'documentsRequis'->>'justificatifDomicile', 'false')) = 'true',
    'photoIdentite', lower(coalesce(v_demande->'documentsRequis'->>'photoIdentite', 'false')) = 'true'
  );
  v_documents_fichiers := case
    when jsonb_typeof(v_demande->'documentsFichiers') = 'object' then v_demande->'documentsFichiers'
    else '{}'::jsonb
  end;

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
      'poidsKg', case when (v_demande->>'weightKg') ~ '^\\d+(\\.\\d+)?$' then (v_demande->>'weightKg')::numeric else null end,
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
      'documentsFichiers', v_documents_fichiers
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
