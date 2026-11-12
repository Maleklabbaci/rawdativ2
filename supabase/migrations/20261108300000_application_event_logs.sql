-- Diagnostic events are best effort, not an audit trail. No free-form payloads.
begin;
create table if not exists public.application_event_logs (
  id bigint generated always as identity primary key,
  actor_id text not null,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('page_view','data_failure','js_error','async_error')),
  page text not null,
  operation text
);
create index if not exists application_event_logs_cursor_idx on public.application_event_logs (created_at desc, id desc);
create index if not exists application_event_logs_actor_time_idx on public.application_event_logs (actor_id, created_at desc);
create index if not exists application_event_logs_kind_time_idx on public.application_event_logs (kind, created_at desc, id desc);
alter table public.application_event_logs enable row level security;
revoke all on public.application_event_logs from public, anon, authenticated;

create or replace function public.rawdha_record_application_event(p_kind text,p_page text,p_operation text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor text := auth.uid()::text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_kind not in ('page_view','data_failure','js_error','async_error') or p_page not in ('dashboard','enfants','admissions','community','classes','presences','paiements','achats','personnel','activites','repas','admin','logs','comptes','notifications','communication','demarrage','aide','support','rapports','parametres','abonnement','unknown')
     or (p_kind = 'data_failure' and (p_operation is null or p_operation not in ('create','update','delete','list','get','write')))
     or (p_kind <> 'data_failure' and p_operation is not null) then raise exception 'Invalid diagnostic event'; end if;
  -- Bound abuse even with simultaneous requests from the same account.
  perform pg_advisory_xact_lock(hashtextextended(v_actor, 8146));
  if (select count(*) from public.application_event_logs where actor_id = v_actor and created_at > now() - interval '1 minute') >= 60 then return; end if;
  insert into public.application_event_logs(actor_id,kind,page,operation) values (v_actor,p_kind,p_page,p_operation);
end $$;
revoke all on function public.rawdha_record_application_event(text,text,text) from public, anon;
grant execute on function public.rawdha_record_application_event(text,text,text) to authenticated;

create or replace function public.rawdha_application_log_page(p_kind text default 'all', p_actor text default '', p_cursor_time timestamptz default null, p_cursor_id bigint default null, p_limit integer default 26)
returns table(id bigint, actor_id text, created_at timestamptz, kind text, page text, operation text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not coalesce(public.rawdha_is_admin(),false) then raise exception 'Accès administrateur requis'; end if;
  if p_kind not in ('all','errors','page_view','data_failure','js_error','async_error') or length(coalesce(p_actor,'')) > 200 or (p_cursor_time is null) <> (p_cursor_id is null) then raise exception 'Invalid filters'; end if;
  return query select l.id,l.actor_id,l.created_at,l.kind,l.page,l.operation from public.application_event_logs l
    where (p_cursor_time is null or (l.created_at,l.id) < (p_cursor_time,p_cursor_id))
      and (p_actor = '' or l.actor_id = p_actor)
      and (p_kind = 'all' or (p_kind = 'errors' and l.kind <> 'page_view') or l.kind = p_kind)
    order by l.created_at desc,l.id desc limit least(greatest(coalesce(p_limit,26),1),51);
end $$;
revoke all on function public.rawdha_application_log_page(text,text,timestamptz,bigint,integer) from public, anon;
grant execute on function public.rawdha_application_log_page(text,text,timestamptz,bigint,integer) to authenticated;
commit;
