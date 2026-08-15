-- QR d'admission automatique : un seul lien permanent par crèche.
-- Le trigger s'exécute lors de la création d'un compte directeur ; l'appel React
-- reste idempotent pour réparer les anciens comptes sans créer de doublon.

create or replace function public.rawdha_provision_inscription_link(
  p_creche_id text,
  p_nom_creche text default null
)
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
  if p_creche_id is null or trim(p_creche_id) = '' then
    raise exception 'missing_creche_id';
  end if;

  select l.data into v_existing
  from public.inscription_liens l
  where l.data->>'crecheId' = p_creche_id
    and coalesce((l.data->>'active')::boolean, false)
  order by l.created_at asc
  limit 1;

  if v_existing is not null and nullif(v_existing->>'token', '') is not null then
    return jsonb_build_object(
      'id', v_existing->>'id',
      'token', v_existing->>'token',
      'nomCreche', coalesce(v_existing->>'nomCreche', v_name),
      'expiresAt', null
    );
  end if;

  v_link_id := coalesce(v_existing->>'id', 'lien_' || extensions.gen_random_uuid()::text);
  v_token := replace(extensions.gen_random_uuid()::text || extensions.gen_random_uuid()::text, '-', '');

  if v_existing is not null then
    update public.inscription_liens
    set data = v_existing || jsonb_build_object(
      'id', v_link_id,
      'crecheId', p_creche_id,
      'token', v_token,
      'tokenHash', encode(extensions.digest(v_token, 'sha256'), 'hex'),
      'label', 'QR permanent de la crèche',
      'nomCreche', v_name,
      'active', true,
      'expiresAt', null
    )
    where id = v_link_id;
  else
    insert into public.inscription_liens (id, data)
    values (
      v_link_id,
      jsonb_build_object(
        'id', v_link_id,
        'crecheId', p_creche_id,
        'token', v_token,
        'tokenHash', encode(extensions.digest(v_token, 'sha256'), 'hex'),
        'label', 'QR permanent de la crèche',
        'nomCreche', v_name,
        'active', true,
        'createdAt', now() at time zone 'utc',
        'expiresAt', null
      )
    );
  end if;

  return jsonb_build_object(
    'id', v_link_id,
    'token', v_token,
    'nomCreche', v_name,
    'expiresAt', null
  );
end;
$$;

revoke all on function public.rawdha_provision_inscription_link(text, text) from public;
grant execute on function public.rawdha_provision_inscription_link(text, text) to authenticated;

-- La création automatique s'applique aux nouveaux comptes directeurs.
create or replace function public.rawdha_provision_qr_after_director_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if coalesce(new.data->>'role', '') = 'directeur' then
    perform public.rawdha_provision_inscription_link(
      new.id::text,
      coalesce(new.data->>'nomCreche', new.data->>'crecheName', 'Rawdha+')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists rawdha_auto_qr_after_director_created on public.comptes;
create trigger rawdha_auto_qr_after_director_created
after insert on public.comptes
for each row execute function public.rawdha_provision_qr_after_director_created();

-- Backfill idempotent des comptes directeurs existants : aucun doublon n'est créé.
do $$
declare
  v_account record;
begin
  for v_account in
    select id, data
    from public.comptes
    where coalesce(data->>'role', '') = 'directeur'
  loop
    perform public.rawdha_provision_inscription_link(
      v_account.id::text,
      coalesce(v_account.data->>'nomCreche', v_account.data->>'crecheName', 'Rawdha+')
    );
  end loop;
end;
$$;

-- Nettoyage défensif : si une ancienne version a créé plusieurs QR actifs,
-- on conserve le plus ancien (le QR historique) et on désactive les autres.
with ranked_links as (
  select id,
         row_number() over (partition by data->>'crecheId' order by created_at asc, id asc) as rn
  from public.inscription_liens
  where coalesce((data->>'active')::boolean, false)
)
update public.inscription_liens l
set data = l.data || jsonb_build_object('active', false)
from ranked_links r
where l.id = r.id and r.rn > 1;

-- Un seul QR actif est autorisé par crèche après le backfill.
create unique index if not exists inscription_liens_one_active_per_creche_idx
on public.inscription_liens ((data->>'crecheId'))
where coalesce((data->>'active')::boolean, false);
