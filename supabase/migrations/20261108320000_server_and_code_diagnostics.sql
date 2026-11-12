begin;
alter table public.application_event_logs drop constraint if exists application_event_logs_kind_check;
alter table public.application_event_logs add constraint application_event_logs_kind_check check (kind in ('page_view','data_success','data_failure','js_error','async_error','server_error'));
alter table public.application_event_logs add column if not exists source text;
alter table public.application_event_logs add column if not exists source_line integer;
alter table public.application_event_logs add column if not exists incident_id uuid;
create unique index if not exists application_event_logs_incident_idx on public.application_event_logs(incident_id) where incident_id is not null;

-- Source is only a known asset family and a bundle hash; query strings and free text are rejected.
create or replace function public.rawdha_record_code_error(p_page text,p_diagnostic text,p_source text default null,p_line integer default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor text:=auth.uid()::text;
begin
 if v_actor is null then raise exception 'Authentication required'; end if;
 if p_page is null or p_page not in ('dashboard','enfants','admissions','community','classes','presences','paiements','achats','personnel','activites','repas','admin','logs','comptes','notifications','communication','demarrage','aide','support','rapports','parametres','abonnement','unknown')
 or p_diagnostic is null or p_diagnostic not in ('unknown','type_error','reference_error','syntax_error','range_error','network','timeout','permission','authentication','conflict','validation','not_found')
 or (p_source is not null and p_source !~ '^(index|vendor-react|vendor-supabase|vendor-i18n|vendor-motion|vendor-icons|vendor-pdf|vendor-pdf-viewer|vendor-qr|vendor-charts|AdminCenter|ApplicationLogs|Community|Enfants|Presences|Paiements|Classes|Repas|Activites|Personnel|Achats|Admissions|AbonnementPaiement|Communication|CommunicationAdmin|Comptes|Dashboard|Parametres|Notifications|SignIn|Demarrage|Support|Rapports)-[A-Za-z0-9_-]{6,24}\.m?js$')
 or (p_line is not null and (p_line < 1 or p_line > 1000000)) or (p_source is null and p_line is not null) then raise exception 'Invalid diagnostic event'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_actor,8146));
 if (select count(*) from public.application_event_logs where actor_id=v_actor and created_at>now()-interval '1 minute')>=60 then return; end if;
 insert into public.application_event_logs(actor_id,kind,page,diagnostic,source,source_line) values(v_actor,'js_error',p_page,p_diagnostic,p_source,p_line);
end $$;
revoke all on function public.rawdha_record_code_error(text,text,text,integer) from public,anon;
grant execute on function public.rawdha_record_code_error(text,text,text,integer) to authenticated;

-- Only trusted edge functions can record a server incident. No request data is accepted.
create or replace function public.rawdha_record_server_incident(p_source text,p_incident_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_source not in ('slickpay-checkout','slickpay-webhook') or p_source is null or p_incident_id is null then raise exception 'Invalid incident'; end if;
 perform pg_advisory_xact_lock(hashtextextended('server:'||p_source,8146));
 if (select count(*) from public.application_event_logs where actor_id='system:'||p_source and created_at>now()-interval '1 minute')>=60 then return; end if;
 insert into public.application_event_logs(actor_id,kind,page,diagnostic,source,incident_id) values('system:'||p_source,'server_error','abonnement','unknown',p_source,p_incident_id) on conflict do nothing;
end $$;
revoke all on function public.rawdha_record_server_incident(text,uuid) from public,anon,authenticated;
grant execute on function public.rawdha_record_server_incident(text,uuid) to service_role;

drop function public.rawdha_application_log_page(text,text,timestamptz,bigint,integer);
create function public.rawdha_application_log_page(p_kind text default 'all',p_actor text default '',p_cursor_time timestamptz default null,p_cursor_id bigint default null,p_limit integer default 26)
returns table(id bigint,actor_id text,created_at timestamptz,kind text,page text,operation text,diagnostic text,source text,source_line integer,incident_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.rawdha_is_admin(),false) then raise exception 'Accès administrateur requis'; end if;
 if p_kind not in ('all','errors','page_view','data_success','data_failure','js_error','async_error','server_error') or length(coalesce(p_actor,''))>200 or (p_cursor_time is null)<>(p_cursor_id is null) then raise exception 'Invalid filters'; end if;
 return query select l.id,l.actor_id,l.created_at,l.kind,l.page,l.operation,l.diagnostic,l.source,l.source_line,l.incident_id from public.application_event_logs l
 where (p_cursor_time is null or (l.created_at,l.id)<(p_cursor_time,p_cursor_id)) and (p_actor='' or l.actor_id=p_actor)
 and (p_kind='all' or (p_kind='errors' and l.kind in ('data_failure','js_error','async_error','server_error')) or l.kind=p_kind)
 order by l.created_at desc,l.id desc limit least(greatest(coalesce(p_limit,26),1),51);
end $$;
revoke all on function public.rawdha_application_log_page(text,text,timestamptz,bigint,integer) from public,anon;
grant execute on function public.rawdha_application_log_page(text,text,timestamptz,bigint,integer) to authenticated;
create or replace function public.rawdha_application_log_summary()
returns table(total bigint,errors bigint) language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(public.rawdha_is_admin(),false) then raise exception 'Accès administrateur requis'; end if;
 return query select count(*),count(*) filter (where l.kind in ('data_failure','js_error','async_error','server_error')) from public.application_event_logs l where l.created_at>=now()-interval '24 hours';
end $$;
commit;
