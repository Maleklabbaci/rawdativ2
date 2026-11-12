-- Bounded, structured diagnostic categories; no free-form error messages or stack traces.
begin;
alter table public.application_event_logs add column if not exists diagnostic text;
alter table public.application_event_logs drop constraint if exists application_event_logs_kind_check;
alter table public.application_event_logs add constraint application_event_logs_kind_check check (kind in ('page_view','data_success','data_failure','js_error','async_error'));
alter table public.application_event_logs add constraint application_event_logs_diagnostic_check check (diagnostic is null or diagnostic in ('unknown','permission','authentication','network','timeout','conflict','validation','not_found','type_error','reference_error','syntax_error','range_error'));
drop function public.rawdha_record_application_event(text,text,text);
create function public.rawdha_record_application_event(p_kind text,p_page text,p_operation text default null,p_diagnostic text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor text := auth.uid()::text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_kind is null or p_kind not in ('page_view','data_success','data_failure','js_error','async_error')
     or p_page is null or p_page not in ('dashboard','enfants','admissions','community','classes','presences','paiements','achats','personnel','activites','repas','admin','logs','comptes','notifications','communication','demarrage','aide','support','rapports','parametres','abonnement','unknown')
     or (p_kind in ('data_failure','data_success') and (p_operation is null or p_operation not in ('create','update','delete','list','get','write')))
     or (p_kind not in ('data_failure','data_success') and p_operation is not null)
     or (p_kind in ('page_view','data_success') and p_diagnostic is not null)
     or (p_kind in ('data_failure','js_error','async_error') and (p_diagnostic is null or p_diagnostic not in ('unknown','permission','authentication','network','timeout','conflict','validation','not_found','type_error','reference_error','syntax_error','range_error'))) then raise exception 'Invalid diagnostic event'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_actor,8146));
  if (select count(*) from public.application_event_logs where actor_id=v_actor and created_at>now()-interval '1 minute') >= 60 then return; end if;
  insert into public.application_event_logs(actor_id,kind,page,operation,diagnostic) values(v_actor,p_kind,p_page,p_operation,p_diagnostic);
end $$;
revoke all on function public.rawdha_record_application_event(text,text,text,text) from public,anon;
grant execute on function public.rawdha_record_application_event(text,text,text,text) to authenticated;
drop function public.rawdha_application_log_page(text,text,timestamptz,bigint,integer);
create function public.rawdha_application_log_page(p_kind text default 'all',p_actor text default '',p_cursor_time timestamptz default null,p_cursor_id bigint default null,p_limit integer default 26)
returns table(id bigint, actor_id text, created_at timestamptz, kind text, page text, operation text, diagnostic text)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.rawdha_is_admin(),false) then raise exception 'Accès administrateur requis'; end if;
 if p_kind not in ('all','errors','page_view','data_success','data_failure','js_error','async_error') or length(coalesce(p_actor,''))>200 or (p_cursor_time is null)<>(p_cursor_id is null) then raise exception 'Invalid filters'; end if;
 return query select l.id,l.actor_id,l.created_at,l.kind,l.page,l.operation,l.diagnostic from public.application_event_logs l
 where (p_cursor_time is null or (l.created_at,l.id)<(p_cursor_time,p_cursor_id)) and (p_actor='' or l.actor_id=p_actor)
 and (p_kind='all' or (p_kind='errors' and l.kind in ('data_failure','js_error','async_error')) or l.kind=p_kind)
 order by l.created_at desc,l.id desc limit least(greatest(coalesce(p_limit,26),1),51);
end $$;
revoke all on function public.rawdha_application_log_page(text,text,timestamptz,bigint,integer) from public,anon;
grant execute on function public.rawdha_application_log_page(text,text,timestamptz,bigint,integer) to authenticated;
create or replace function public.rawdha_application_log_summary()
returns table(total bigint, errors bigint) language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.rawdha_is_admin(),false) then raise exception 'Accès administrateur requis'; end if;
 return query select count(*),count(*) filter (where l.kind in ('data_failure','js_error','async_error')) from public.application_event_logs l where l.created_at >= now()-interval '24 hours';
end $$;
revoke all on function public.rawdha_application_log_summary() from public,anon;
grant execute on function public.rawdha_application_log_summary() to authenticated;
-- Service-only, bounded cleanup. Scheduling is an explicit deployment operation.
create or replace function public.rawdha_purge_application_events(p_batch integer default 10000)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare removed integer;
begin
 with old_rows as (select id from public.application_event_logs where created_at < now()-interval '90 days' order by created_at,id limit least(greatest(coalesce(p_batch,10000),1),10000))
 delete from public.application_event_logs l using old_rows where l.id=old_rows.id;
 get diagnostics removed = row_count; return removed;
end $$;
revoke all on function public.rawdha_purge_application_events(integer) from public,anon,authenticated;
grant execute on function public.rawdha_purge_application_events(integer) to service_role;
commit;
