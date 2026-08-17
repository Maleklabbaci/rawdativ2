-- RawdhaPlus — journaux d'activité minimisés et cloisonnés
-- Objectif : enregistrer qui a effectué quelle action métier, quand,
-- sans copier les données personnelles des lignes métier.

create table if not exists public.activity_logs (
  id text primary key default gen_random_uuid()::text,
  actor_id uuid,
  actor_role text,
  creche_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  record_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.activity_logs is
  'Audit minimal des actions métier : aucun payload personnel, uniquement acteur, périmètre, action, table, identifiant technique et horodatage.';
comment on column public.activity_logs.details is
  'Métadonnées techniques minimisées. Ne jamais y copier le contenu de data, les noms, emails, téléphones ou montants.';

alter table public.activity_logs enable row level security;

revoke all on table public.activity_logs from public, anon, authenticated;
grant select on table public.activity_logs to authenticated;

drop policy if exists "activity_logs_select_own_creche" on public.activity_logs;
create policy "activity_logs_select_own_creche"
on public.activity_logs
for select
to authenticated
using (
  creche_id = auth.uid()::text
  or coalesce(public.rawdha_is_admin(), false)
);

create or replace function public.rawdha_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_record jsonb;
  v_creche_id text;
  v_record_id text;
  v_actor_id uuid;
  v_actor_role text;
begin
  v_record := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  v_creche_id := coalesce(
    v_record ->> 'creche_id',
    v_record -> 'data' ->> 'crecheId'
  );
  v_record_id := v_record ->> 'id';

  -- auth.uid() reste NULL pour une opération sans JWT (par exemple service role).
  v_actor_id := auth.uid();
  v_actor_role := nullif(current_setting('request.jwt.claim.role', true), '');

  insert into public.activity_logs (
    actor_id,
    actor_role,
    creche_id,
    action,
    table_name,
    record_id,
    details
  ) values (
    v_actor_id,
    v_actor_role,
    v_creche_id,
    TG_OP,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    v_record_id,
    jsonb_build_object('source', 'database_trigger')
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

-- La fonction est appelée uniquement par les triggers et ne doit pas être
-- invocable via /rest/v1/rpc par un rôle exposé.
revoke all on function public.rawdha_log_activity() from public, anon, authenticated;

-- Triggers idempotents sur les tables métier sensibles.
do $$
declare
  v_table text;
  v_trigger text;
begin
  foreach v_table in array array[
    'enfants',
    'presences',
    'paiements',
    'personnel',
    'classes',
    'activites',
    'repas',
    'presence_journees'
  ] loop
    v_trigger := 'rawdha_activity_' || v_table;
    if to_regclass('public.' || v_table) is not null
       and not exists (
         select 1
         from pg_trigger
         where tgname = v_trigger
           and tgrelid = ('public.' || v_table)::regclass
           and not tgisinternal
       ) then
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute function public.rawdha_log_activity()',
        v_trigger,
        v_table
      );
    end if;
  end loop;
end;
$$;

create index if not exists activity_logs_creche_created_idx
  on public.activity_logs (creche_id, created_at desc);
create index if not exists activity_logs_table_record_idx
  on public.activity_logs (table_name, record_id);
