-- RAWDHA+ — Mode attente directeur : connexion autorisée, écritures interdites
-- Cette migration conserve les SELECT pour un directeur en attente, mais interdit
-- tout INSERT/UPDATE/DELETE jusqu’à l’approbation manuelle de l’administrateur.

begin;

create or replace function public.rawdha_is_approved_director()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (data->>'role' = 'directeur'
      and coalesce(data->>'approvalStatus', 'approved') <> 'pending'),
    false
  )
  from public.comptes
  where id = auth.uid()::text
$$;

grant execute on function public.rawdha_is_approved_director() to authenticated;
revoke execute on function public.rawdha_is_approved_director() from anon;

-- Tables directement rattachées à une crèche : lecture pour pending, écriture
-- seulement pour admin ou directeur approuvé.
do $$
declare
  t text;
begin
  foreach t in array array['enfants','classes','personnel','activites','repas','presence_journees'] loop
    execute format('drop policy if exists %I on %I', t || '_all', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format('drop policy if exists %I on %I', t || '_delete', t);

    execute format('create policy %I on %I for select to authenticated using (rawdha_is_admin() or (data->>''crecheId'') = auth.uid()::text)', t || '_select', t);
    execute format('create policy %I on %I for insert to authenticated with check (rawdha_is_admin() or (rawdha_is_approved_director() and (data->>''crecheId'') = auth.uid()::text))', t || '_insert', t);
    execute format('create policy %I on %I for update to authenticated using (rawdha_is_admin() or (rawdha_is_approved_director() and (data->>''crecheId'') = auth.uid()::text)) with check (rawdha_is_admin() or (rawdha_is_approved_director() and (data->>''crecheId'') = auth.uid()::text))', t || '_update', t);
    execute format('create policy %I on %I for delete to authenticated using (rawdha_is_admin() or (rawdha_is_approved_director() and (data->>''crecheId'') = auth.uid()::text))', t || '_delete', t);
  end loop;
end $$;

-- Présences et paiements sont rattachés à un enfant.
drop policy if exists "presences_all" on public.presences;
drop policy if exists "presences_select" on public.presences;
drop policy if exists "presences_insert" on public.presences;
drop policy if exists "presences_update" on public.presences;
drop policy if exists "presences_delete" on public.presences;
create policy "presences_select" on public.presences for select to authenticated using (
  rawdha_is_admin() or exists (
    select 1 from public.enfants e
    where e.id = (presences.data->>'enfantId')
      and e.data->>'crecheId' = auth.uid()::text
  )
);
create policy "presences_insert" on public.presences for insert to authenticated with check (
  rawdha_is_admin() or (rawdha_is_approved_director() and exists (
    select 1 from public.enfants e
    where e.id = (presences.data->>'enfantId')
      and e.data->>'crecheId' = auth.uid()::text
  ))
);
create policy "presences_update" on public.presences for update to authenticated using (
  rawdha_is_admin() or (rawdha_is_approved_director() and exists (
    select 1 from public.enfants e
    where e.id = (presences.data->>'enfantId')
      and e.data->>'crecheId' = auth.uid()::text
  ))
) with check (
  rawdha_is_admin() or (rawdha_is_approved_director() and exists (
    select 1 from public.enfants e
    where e.id = (presences.data->>'enfantId')
      and e.data->>'crecheId' = auth.uid()::text
  ))
);
create policy "presences_delete" on public.presences for delete to authenticated using (
  rawdha_is_admin() or (rawdha_is_approved_director() and exists (
    select 1 from public.enfants e
    where e.id = (presences.data->>'enfantId')
      and e.data->>'crecheId' = auth.uid()::text
  ))
);

drop policy if exists "paiements_all" on public.paiements;
drop policy if exists "paiements_select" on public.paiements;
drop policy if exists "paiements_insert" on public.paiements;
drop policy if exists "paiements_update" on public.paiements;
drop policy if exists "paiements_delete" on public.paiements;
create policy "paiements_select" on public.paiements for select to authenticated using (
  rawdha_is_admin() or exists (
    select 1 from public.enfants e
    where e.id = (paiements.data->>'enfantId')
      and e.data->>'crecheId' = auth.uid()::text
  )
);
create policy "paiements_insert" on public.paiements for insert to authenticated with check (
  rawdha_is_admin() or (rawdha_is_approved_director() and exists (
    select 1 from public.enfants e
    where e.id = (paiements.data->>'enfantId')
      and e.data->>'crecheId' = auth.uid()::text
  ))
);
create policy "paiements_update" on public.paiements for update to authenticated using (
  rawdha_is_admin() or (rawdha_is_approved_director() and exists (
    select 1 from public.enfants e
    where e.id = (paiements.data->>'enfantId')
      and e.data->>'crecheId' = auth.uid()::text
  ))
) with check (
  rawdha_is_admin() or (rawdha_is_approved_director() and exists (
    select 1 from public.enfants e
    where e.id = (paiements.data->>'enfantId')
      and e.data->>'crecheId' = auth.uid()::text
  ))
);
create policy "paiements_delete" on public.paiements for delete to authenticated using (
  rawdha_is_admin() or (rawdha_is_approved_director() and exists (
    select 1 from public.enfants e
    where e.id = (paiements.data->>'enfantId')
      and e.data->>'crecheId' = auth.uid()::text
  ))
);

-- Profil et paramètres : le directeur pending peut lire son contexte, mais ne peut pas le modifier.
drop policy if exists "comptes_update_own_or_admin" on public.comptes;
drop policy if exists "comptes_update" on public.comptes;
create policy "comptes_update" on public.comptes for update to authenticated
using (rawdha_is_admin() or (rawdha_is_approved_director() and id = auth.uid()::text))
with check (rawdha_is_admin() or (rawdha_is_approved_director() and id = auth.uid()::text));

drop policy if exists "parametres_insert_own_or_admin" on public.parametres;
drop policy if exists "parametres_update_own_or_admin" on public.parametres;
drop policy if exists "parametres_insert" on public.parametres;
drop policy if exists "parametres_update" on public.parametres;
drop policy if exists "parametres_delete" on public.parametres;
create policy "parametres_insert" on public.parametres for insert to authenticated with check (
  rawdha_is_admin() or (rawdha_is_approved_director() and id = 'creche_' || auth.uid()::text)
);
create policy "parametres_update" on public.parametres for update to authenticated using (
  rawdha_is_admin() or (rawdha_is_approved_director() and id = 'creche_' || auth.uid()::text)
) with check (
  rawdha_is_admin() or (rawdha_is_approved_director() and id = 'creche_' || auth.uid()::text)
);
create policy "parametres_delete" on public.parametres for delete to authenticated using (
  rawdha_is_admin() or (rawdha_is_approved_director() and id = 'creche_' || auth.uid()::text)
);

-- Messages, avis, signalements et communauté : lecture conservée, écritures approuvées uniquement.
drop policy if exists "messages_insert" on public.discussion_messages;
drop policy if exists "messages_update" on public.discussion_messages;
drop policy if exists "messages_delete" on public.discussion_messages;
create policy "messages_insert" on public.discussion_messages for insert to authenticated with check (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'parentId' = auth.uid()::text));
create policy "messages_update" on public.discussion_messages for update to authenticated using (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'parentId' = auth.uid()::text)) with check (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'parentId' = auth.uid()::text));
create policy "messages_delete" on public.discussion_messages for delete to authenticated using (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'parentId' = auth.uid()::text));

drop policy if exists "avis_insert" on public.avis;
create policy "avis_insert" on public.avis for insert to authenticated with check (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'userId' = auth.uid()::text));

drop policy if exists "signalements_insert" on public.signalements;
create policy "signalements_insert" on public.signalements for insert to authenticated with check (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'userId' = auth.uid()::text));

do $$
begin
  drop policy if exists "community_posts_insert" on public.community_posts;
  drop policy if exists "community_posts_update" on public.community_posts;
  drop policy if exists "community_posts_delete" on public.community_posts;
  create policy "community_posts_insert" on public.community_posts for insert to authenticated with check (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'authorId' = auth.uid()::text and data->>'crecheId' = auth.uid()::text));
  create policy "community_posts_update" on public.community_posts for update to authenticated using (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'authorId' = auth.uid()::text)) with check (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'authorId' = auth.uid()::text and data->>'crecheId' = auth.uid()::text));
  create policy "community_posts_delete" on public.community_posts for delete to authenticated using (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'authorId' = auth.uid()::text));

  drop policy if exists "community_comments_insert" on public.community_comments;
  drop policy if exists "community_comments_update" on public.community_comments;
  drop policy if exists "community_comments_delete" on public.community_comments;
  create policy "community_comments_insert" on public.community_comments for insert to authenticated with check (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'authorId' = auth.uid()::text));
  create policy "community_comments_update" on public.community_comments for update to authenticated using (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'authorId' = auth.uid()::text)) with check (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'authorId' = auth.uid()::text));
  create policy "community_comments_delete" on public.community_comments for delete to authenticated using (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'authorId' = auth.uid()::text));

  drop policy if exists "community_reactions_insert" on public.community_reactions;
  drop policy if exists "community_reactions_delete" on public.community_reactions;
  create policy "community_reactions_insert" on public.community_reactions for insert to authenticated with check (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'userId' = auth.uid()::text));
  create policy "community_reactions_delete" on public.community_reactions for delete to authenticated using (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'userId' = auth.uid()::text));
end $$;

-- Admission des enfants : consultation conservée, décision réservée aux comptes approuvés/admin.
drop policy if exists "demandes_admission_update" on public.demandes_admission;
create policy "demandes_admission_update" on public.demandes_admission for update to authenticated
using (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'crecheId' = auth.uid()::text))
with check (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'crecheId' = auth.uid()::text));

-- Le QR contient un token sensible : il n’est pas lisible ni modifiable avant approbation.
drop policy if exists "inscription_liens_all" on public.inscription_liens;
drop policy if exists "inscription_liens_write" on public.inscription_liens;
drop policy if exists "inscription_liens_select" on public.inscription_liens;
drop policy if exists "inscription_liens_insert" on public.inscription_liens;
drop policy if exists "inscription_liens_update" on public.inscription_liens;
drop policy if exists "inscription_liens_delete" on public.inscription_liens;
create policy "inscription_liens_select" on public.inscription_liens for select to authenticated using (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'crecheId' = auth.uid()::text));
create policy "inscription_liens_insert" on public.inscription_liens for insert to authenticated with check (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'crecheId' = auth.uid()::text));
create policy "inscription_liens_update" on public.inscription_liens for update to authenticated using (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'crecheId' = auth.uid()::text)) with check (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'crecheId' = auth.uid()::text));
create policy "inscription_liens_delete" on public.inscription_liens for delete to authenticated using (rawdha_is_admin() or (rawdha_is_approved_director() and data->>'crecheId' = auth.uid()::text));

-- Un directeur pending peut voir ses notifications, mais ne peut pas modifier readBy.
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_update_directeur" on public.notifications;
create policy "notifications_update" on public.notifications for update to authenticated using (
  rawdha_is_admin() or (rawdha_is_approved_director() and ((data->>'recipientRole') = 'all_directeurs' or (data->>'recipientRole') = auth.uid()::text))
) with check (rawdha_is_admin() or rawdha_is_approved_director());

-- RPCs sensibles : le statut pending est contrôlé même si la fonction est SECURITY DEFINER.
create or replace function public.rawdha_create_inscription_link(p_label text default null, p_expires_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id text := auth.uid()::text;
  v_link_id text;
  v_token text;
  v_existing jsonb;
  v_settings jsonb;
  v_name text;
begin
  if auth.uid() is null or not public.rawdha_is_approved_director() then
    raise exception 'not_allowed';
  end if;
  select p.data into v_settings from public.parametres p where p.id = 'creche_' || v_user_id limit 1;
  v_name := coalesce(v_settings->>'crecheName', 'Rawdha+');
  select l.data into v_existing from public.inscription_liens l where l.data->>'crecheId' = v_user_id and coalesce((l.data->>'active')::boolean, false) order by l.created_at asc limit 1;
  if v_existing is not null and nullif(v_existing->>'token', '') is not null then
    return jsonb_build_object('id', v_existing->>'id', 'token', v_existing->>'token', 'nomCreche', v_name, 'expiresAt', null);
  end if;
  v_link_id := coalesce(v_existing->>'id', 'lien_' || extensions.gen_random_uuid()::text);
  v_token := replace(extensions.gen_random_uuid()::text || extensions.gen_random_uuid()::text, '-', '');
  if v_existing is not null then
    update public.inscription_liens set data = v_existing || jsonb_build_object('id', v_link_id, 'crecheId', v_user_id, 'token', v_token, 'tokenHash', encode(extensions.digest(v_token, 'sha256'), 'hex'), 'label', coalesce(nullif(left(coalesce(p_label, ''), 120), ''), v_existing->>'label'), 'nomCreche', v_name, 'active', true, 'expiresAt', null) where id = v_link_id;
  else
    insert into public.inscription_liens (id, data) values (v_link_id, jsonb_build_object('id', v_link_id, 'crecheId', v_user_id, 'token', v_token, 'tokenHash', encode(extensions.digest(v_token, 'sha256'), 'hex'), 'label', nullif(left(coalesce(p_label, ''), 120), ''), 'nomCreche', v_name, 'active', true, 'createdAt', now() at time zone 'utc', 'expiresAt', null));
  end if;
  return jsonb_build_object('id', v_link_id, 'token', v_token, 'nomCreche', v_name, 'expiresAt', null);
end;
$$;

grant execute on function public.rawdha_create_inscription_link(text, timestamptz) to authenticated;

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
  if auth.uid() is null or (not public.rawdha_is_admin() and not public.rawdha_is_approved_director()) then raise exception 'not_allowed'; end if;
  if v_statut not in ('acceptee', 'refusee') then raise exception 'invalid_status'; end if;
  select d.data into v_demande from public.demandes_admission d where d.id = p_id for update;
  if v_demande is null then raise exception 'not_found'; end if;
  v_creche_id := v_demande->>'crecheId';
  if not public.rawdha_is_admin() and v_creche_id <> v_directeur_id then raise exception 'not_allowed'; end if;
  if coalesce(v_demande->>'statut', '') = 'acceptee' then return jsonb_build_object('id', p_id, 'statut', 'acceptee', 'enfantId', v_demande->>'enfantId'); end if;
  if v_statut = 'refusee' then
    update public.demandes_admission set data = v_demande || jsonb_build_object('statut', 'refusee', 'motifRefus', left(coalesce(p_motif, ''), 1000), 'traiteLe', now() at time zone 'utc', 'traitePar', v_directeur_id) where id = p_id;
    return jsonb_build_object('id', p_id, 'statut', 'refusee');
  end if;
  v_enfant_id := 'enfant_' || extensions.gen_random_uuid()::text;
  v_documents := coalesce(v_demande->'documentsRequis', jsonb_build_object('certificatMedical', false, 'carnetVaccination', false, 'justificatifDomicile', false, 'photoIdentite', false));
  insert into public.enfants (id, data) values (v_enfant_id, jsonb_build_object('id', v_enfant_id, 'crecheId', v_creche_id, 'nom', v_demande->>'nom', 'prenom', v_demande->>'prenom', 'dateNaissance', v_demande->>'dateNaissance', 'genre', coalesce(v_demande->>'genre', 'Garçon'), 'groupeAge', coalesce(v_demande->>'groupeAge', 'Bébés'), 'dateInscription', (now() at time zone 'utc')::date::text, 'statut', 'Actif', 'allergie', nullif(v_demande->>'allergie', ''), 'regimeAlimentaire', nullif(v_demande->>'regimeAlimentaire', ''), 'groupeSanguin', nullif(v_demande->>'bloodGroup', ''), 'poidsKg', case when (v_demande->>'weightKg') ~ '^\d+(\.\d+)?$' then (v_demande->>'weightKg')::numeric else null end, 'medecinTraitant', nullif(v_demande->>'pediatricianName', ''), 'vaccinations', nullif(v_demande->>'vaccinations', ''), 'notesMedicales', nullif(v_demande->>'notesMedicales', ''), 'contactsUrgence', jsonb_build_array(jsonb_build_object('id', v_contact_id, 'nom', concat_ws(' ', v_demande->>'parentPrenom', v_demande->>'parentNom'), 'telephone', v_demande->>'parentTelephone', 'lien', coalesce(v_demande->>'parentLien', 'Tuteur'))), 'parents', jsonb_build_array(jsonb_build_object('id', v_parent_id, 'nom', v_demande->>'parentNom', 'prenom', v_demande->>'parentPrenom', 'lien', coalesce(v_demande->>'parentLien', 'Tuteur'), 'telephone', v_demande->>'parentTelephone', 'email', nullif(v_demande->>'parentEmail', ''), 'adresse', nullif(v_demande->>'parentAdresse', ''), 'profession', nullif(v_demande->>'parentProfession', ''))), 'documentsRequis', v_documents, 'documentsFichiers', coalesce(v_demande->'documentsFichiers', '{}'::jsonb)));
  update public.demandes_admission set data = v_demande || jsonb_build_object('statut', 'acceptee', 'enfantId', v_enfant_id, 'traiteLe', now() at time zone 'utc', 'traitePar', v_directeur_id) where id = p_id;
  return jsonb_build_object('id', p_id, 'statut', 'acceptee', 'enfantId', v_enfant_id);
end;
$$;

grant execute on function public.rawdha_decide_admission(text, text, text) to authenticated;

-- QR automatique : ne rien provisionner pour un compte pending.
create or replace function public.rawdha_provision_inscription_link(p_creche_id text, p_nom_creche text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_existing jsonb;
  v_link_id text;
  v_token text;
  v_name text := coalesce(nullif(trim(p_nom_creche), ''), 'Rawdha+');
begin
  if not exists (select 1 from public.comptes c where c.id = p_creche_id and c.data->>'role' = 'directeur' and coalesce(c.data->>'approvalStatus', 'approved') <> 'pending') then raise exception 'not_allowed'; end if;
  select l.data into v_existing from public.inscription_liens l where l.data->>'crecheId' = p_creche_id and coalesce((l.data->>'active')::boolean, false) order by l.created_at asc limit 1;
  if v_existing is not null and nullif(v_existing->>'token', '') is not null then return jsonb_build_object('id', v_existing->>'id', 'token', v_existing->>'token', 'nomCreche', coalesce(v_existing->>'nomCreche', v_name), 'expiresAt', null); end if;
  v_link_id := coalesce(v_existing->>'id', 'lien_' || extensions.gen_random_uuid()::text);
  v_token := replace(extensions.gen_random_uuid()::text || extensions.gen_random_uuid()::text, '-', '');
  if v_existing is not null then
    update public.inscription_liens set data = v_existing || jsonb_build_object('id', v_link_id, 'crecheId', p_creche_id, 'token', v_token, 'tokenHash', encode(extensions.digest(v_token, 'sha256'), 'hex'), 'label', 'QR permanent de la crèche', 'nomCreche', v_name, 'active', true, 'expiresAt', null) where id = v_link_id;
  else
    insert into public.inscription_liens (id, data) values (v_link_id, jsonb_build_object('id', v_link_id, 'crecheId', p_creche_id, 'token', v_token, 'tokenHash', encode(extensions.digest(v_token, 'sha256'), 'hex'), 'label', 'QR permanent de la crèche', 'nomCreche', v_name, 'active', true, 'createdAt', now() at time zone 'utc', 'expiresAt', null));
  end if;
  return jsonb_build_object('id', v_link_id, 'token', v_token, 'nomCreche', v_name, 'expiresAt', null);
end;
$$;

create or replace function public.rawdha_provision_qr_after_director_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if coalesce(new.data->>'role', '') = 'directeur' and coalesce(new.data->>'approvalStatus', 'approved') <> 'pending' then
    perform public.rawdha_provision_inscription_link(new.id::text, coalesce(new.data->>'nomCreche', new.data->>'crecheName', 'Rawdha+'));
  end if;
  return new;
end;
$$;

revoke all on function public.rawdha_provision_inscription_link(text, text) from public, anon, authenticated;
revoke all on function public.rawdha_provision_qr_after_director_created() from public, anon, authenticated;

commit;
