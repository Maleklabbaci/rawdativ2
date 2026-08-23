-- Module Achats Rawdha+.
-- Migration additive : aucune table ni donnée existante n'est supprimée.
-- Les dépenses sont isolées par crèche et les écritures passent exclusivement par RPC.

create table if not exists public.achats (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.achats is
  'Registre des dépenses Rawdha+, isolé par crecheId dans le payload JSONB.';

create index if not exists achats_creche_date_idx
  on public.achats ((data ->> 'crecheId'), (data ->> 'dateAchat') desc);

create index if not exists achats_creche_statut_idx
  on public.achats ((data ->> 'crecheId'), (data ->> 'statut'));

create index if not exists achats_creche_categorie_idx
  on public.achats ((data ->> 'crecheId'), (data ->> 'categorie'));

alter table public.achats enable row level security;

drop policy if exists achats_select on public.achats;
create policy achats_select
  on public.achats for select
  using (
    rawdha_is_admin()
    or (
      rawdha_is_approved_director()
      and data ->> 'crecheId' = auth.uid()::text
    )
  );

-- Les écritures directes depuis le navigateur restent interdites : les RPC ci-dessous
-- imposent le périmètre de crèche et rejettent les payloads malformés.
revoke insert, update, delete on public.achats from anon, authenticated;
grant select on public.achats to authenticated;

create or replace function public.rawdha_normalize_achat_data(
  p_data jsonb,
  p_creche_id text,
  p_created_by text,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_date date;
  v_montant numeric;
  v_taux_tva numeric;
  v_fournisseur text;
  v_categorie text;
  v_libelle text;
  v_statut text;
  v_moyen_paiement text;
  v_numero_piece text;
  v_notes text;
  v_recurrent boolean;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Les données d''achat sont invalides.' using errcode = '22023';
  end if;

  begin
    v_date := nullif(trim(coalesce(p_data ->> 'dateAchat', '')), '')::date;
  exception when others then
    raise exception 'La date d''achat est invalide.' using errcode = '22023';
  end;

  if v_date is null then
    raise exception 'La date d''achat est obligatoire.' using errcode = '22023';
  end if;

  begin
    v_montant := nullif(trim(coalesce(p_data ->> 'montant', '')), '')::numeric;
  exception when others then
    raise exception 'Le montant est invalide.' using errcode = '22023';
  end;

  if v_montant is null or v_montant <= 0 or v_montant > 100000000 then
    raise exception 'Le montant doit être strictement positif.' using errcode = '22023';
  end if;

  begin
    v_taux_tva := nullif(trim(coalesce(p_data ->> 'tauxTVA', '')), '')::numeric;
  exception when others then
    raise exception 'Le taux de TVA est invalide.' using errcode = '22023';
  end;

  if v_taux_tva is not null and (v_taux_tva < 0 or v_taux_tva > 100) then
    raise exception 'Le taux de TVA doit être compris entre 0 et 100.' using errcode = '22023';
  end if;

  v_libelle := left(trim(coalesce(p_data ->> 'libelle', '')), 180);
  if v_libelle = '' then
    raise exception 'Le libellé de l''achat est obligatoire.' using errcode = '22023';
  end if;

  v_categorie := trim(coalesce(p_data ->> 'categorie', ''));
  if v_categorie not in ('alimentation', 'hygiene', 'fournitures', 'materiel', 'services', 'loyer_charges', 'maintenance', 'transport', 'autre') then
    raise exception 'La catégorie d''achat est invalide.' using errcode = '22023';
  end if;

  v_statut := trim(coalesce(p_data ->> 'statut', ''));
  if v_statut not in ('payé', 'à_payer') then
    raise exception 'Le statut d''achat est invalide.' using errcode = '22023';
  end if;

  v_moyen_paiement := nullif(left(trim(coalesce(p_data ->> 'moyenPaiement', '')), 32), '');
  if v_moyen_paiement is not null and v_moyen_paiement not in ('especes', 'virement', 'cheque', 'carte', 'autre') then
    raise exception 'Le moyen de paiement est invalide.' using errcode = '22023';
  end if;
  if v_statut = 'payé' and v_moyen_paiement is null then
    raise exception 'Le moyen de paiement est obligatoire pour un achat payé.' using errcode = '22023';
  end if;

  v_fournisseur := nullif(left(trim(coalesce(p_data ->> 'fournisseur', '')), 140), '');
  v_numero_piece := nullif(left(trim(coalesce(p_data ->> 'numeroPiece', '')), 120), '');
  v_notes := nullif(left(trim(coalesce(p_data ->> 'notes', '')), 1000), '');
  v_recurrent := lower(coalesce(p_data ->> 'recurrent', 'false')) in ('true', '1');

  return jsonb_strip_nulls(jsonb_build_object(
    'crecheId', p_creche_id,
    'createdBy', p_created_by,
    'dateAchat', to_char(v_date, 'YYYY-MM-DD'),
    'fournisseur', v_fournisseur,
    'categorie', v_categorie,
    'libelle', v_libelle,
    'montant', v_montant,
    'tauxTVA', v_taux_tva,
    'statut', v_statut,
    'moyenPaiement', v_moyen_paiement,
    'numeroPiece', v_numero_piece,
    'notes', v_notes,
    'recurrent', v_recurrent,
    'createdAt', p_created_at,
    'updatedAt', now()
  ));
end;
$$;

create or replace function public.rawdha_create_achat(p_data jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text;
  v_data jsonb;
  v_now timestamptz := now();
begin
  if not rawdha_is_admin() and not rawdha_is_approved_director() then
    raise exception 'Seul un Directeur approuvé peut enregistrer un achat.' using errcode = '42501';
  end if;

  v_id := 'ach_' || md5(clock_timestamp()::text || random()::text || auth.uid()::text);
  v_data := rawdha_normalize_achat_data(p_data, auth.uid()::text, auth.uid()::text, v_now);

  insert into public.achats (id, data) values (v_id, v_data);
  return v_id;
end;
$$;

create or replace function public.rawdha_update_achat(p_id text, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing jsonb;
  v_merged jsonb;
  v_created_at timestamptz;
  v_created_by text;
  v_creche_id text;
begin
  if not rawdha_is_admin() and not rawdha_is_approved_director() then
    raise exception 'Seul un Directeur approuvé peut modifier un achat.' using errcode = '42501';
  end if;
  if p_id is null or length(trim(p_id)) = 0 or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'La modification demandée est invalide.' using errcode = '22023';
  end if;

  select data into v_existing from public.achats where id = p_id for update;
  if not found then
    raise exception 'Achat introuvable.' using errcode = 'P0002';
  end if;

  v_creche_id := v_existing ->> 'crecheId';
  if not rawdha_is_admin() and v_creche_id <> auth.uid()::text then
    raise exception 'Accès refusé à cet achat.' using errcode = '42501';
  end if;

  begin
    v_created_at := (v_existing ->> 'createdAt')::timestamptz;
  exception when others then
    v_created_at := now();
  end;
  v_created_by := coalesce(v_existing ->> 'createdBy', v_creche_id);
  v_merged := v_existing || p_patch;

  update public.achats
  set data = rawdha_normalize_achat_data(v_merged, v_creche_id, v_created_by, v_created_at)
  where id = p_id;

  return true;
end;
$$;

create or replace function public.rawdha_delete_achat(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_creche_id text;
begin
  if not rawdha_is_admin() and not rawdha_is_approved_director() then
    raise exception 'Seul un Directeur approuvé peut supprimer un achat.' using errcode = '42501';
  end if;
  if p_id is null or length(trim(p_id)) = 0 then
    raise exception 'L''achat à supprimer est invalide.' using errcode = '22023';
  end if;

  select data ->> 'crecheId' into v_creche_id from public.achats where id = p_id for update;
  if not found then
    raise exception 'Achat introuvable.' using errcode = 'P0002';
  end if;
  if not rawdha_is_admin() and v_creche_id <> auth.uid()::text then
    raise exception 'Accès refusé à cet achat.' using errcode = '42501';
  end if;

  delete from public.achats where id = p_id;
  return true;
end;
$$;

revoke all on function public.rawdha_normalize_achat_data(jsonb, text, text, timestamptz) from public;
revoke all on function public.rawdha_create_achat(jsonb) from public;
revoke all on function public.rawdha_update_achat(text, jsonb) from public;
revoke all on function public.rawdha_delete_achat(text) from public;
revoke all on function public.rawdha_normalize_achat_data(jsonb, text, text, timestamptz) from anon, authenticated;
revoke all on function public.rawdha_create_achat(jsonb) from anon;
revoke all on function public.rawdha_update_achat(text, jsonb) from anon;
revoke all on function public.rawdha_delete_achat(text) from anon;

grant execute on function public.rawdha_create_achat(jsonb) to authenticated;
grant execute on function public.rawdha_update_achat(text, jsonb) to authenticated;
grant execute on function public.rawdha_delete_achat(text) to authenticated;
