-- STAGING ONLY; requires 170000 and 180000 plus their prerequisites.
-- Suspicion is NOT cancellation: all amounts and statuses remain untouched.
begin;
lock table public.enfants, public.paiements in share row exclusive mode;
do $$ begin
  if to_regclass('public.rawdha_invoice_review_events') is not null then raise exception 'finance_events_table_already_exists' using errcode='42P07'; end if;
  if exists(select 1 from public.paiements where data ? 'doublonSuspect') then raise exception 'finance_existing_duplicate_marker' using errcode='23514'; end if;
end $$;

create table public.rawdha_invoice_review_events (
  request_id text primary key,
  invoice_id text not null references public.paiements(id) on delete restrict,
  enfant_id text not null references public.enfants(id) on delete restrict,
  creche_id text not null,
  action text not null check(action in ('correct_period','flag_duplicate','clear_suspicion')),
  period_key text,
  target_invoice_id text references public.paiements(id) on delete restrict,
  reason text not null,
  before_data jsonb not null,
  after_data jsonb not null,
  target_before jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index rawdha_invoice_review_events_invoice on public.rawdha_invoice_review_events(invoice_id,created_at,request_id);
alter table public.rawdha_invoice_review_events enable row level security;
revoke all on public.rawdha_invoice_review_events from public,anon,authenticated;

-- Existing write implementations remain callable only from these wrappers.
alter function public.rawdha_write_invoice(text,text,jsonb,jsonb) rename to rawdha_write_invoice_internal;
revoke all on function public.rawdha_write_invoice_internal(text,text,jsonb,jsonb) from public,anon,authenticated;
alter function public.rawdha_review_invoice_period(text,jsonb,text,text,boolean) rename to rawdha_review_invoice_period_internal;
revoke all on function public.rawdha_review_invoice_period_internal(text,jsonb,text,text,boolean) from public,anon,authenticated;

-- Both sides of a suspected pair are held for review. Child lock also closes
-- the race between marking a pair and creation/classification/update.
create function public.rawdha_invoice_review_guard(p_child text, p_invoice_id text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner text;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(),false) or coalesce(public.rawdha_is_approved_director(),false)) then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  select data->>'crecheId' into v_owner from public.enfants where id=p_child for update;
  if nullif(trim(v_owner),'') is null or (not coalesce(public.rawdha_is_admin(),false) and v_owner<>auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode='42501';
  end if;
  if exists (select 1 from public.paiements p where p.data->>'enfantId'=p_child and p.data ? 'doublonSuspect'
    and (p_invoice_id is null or p.id=p_invoice_id or p.data->'doublonSuspect'->>'targetInvoiceId'=p_invoice_id)) then
    raise exception 'finance_duplicate_review_pending' using errcode='55000';
  end if;
end $$;
revoke all on function public.rawdha_invoice_review_guard(text,text) from public,anon,authenticated;

create function public.rawdha_write_invoice(p_action text,p_id text,p_patch jsonb,p_expected jsonb default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_child text;
begin
  if p_action='create' then v_child:=p_patch->>'enfantId';
  elsif p_action='update' then select data->>'enfantId' into v_child from public.paiements where id=p_id;
  else return public.rawdha_write_invoice_internal(p_action,p_id,p_patch,p_expected); end if;
  perform public.rawdha_invoice_review_guard(v_child,case when p_action='create' then null else p_id end);
  return public.rawdha_write_invoice_internal(p_action,p_id,p_patch,p_expected);
end $$;
create function public.rawdha_review_invoice_period(p_invoice_id text,p_expected jsonb,p_period_key text,p_reason text,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_child text;
begin
  select data->>'enfantId' into v_child from public.paiements where id=p_invoice_id;
  perform public.rawdha_invoice_review_guard(v_child,p_invoice_id);
  return public.rawdha_review_invoice_period_internal(p_invoice_id,p_expected,p_period_key,p_reason,p_confirmed);
end $$;
revoke all on function public.rawdha_write_invoice(text,text,jsonb,jsonb) from public,anon;
revoke all on function public.rawdha_review_invoice_period(text,jsonb,text,text,boolean) from public,anon;
grant execute on function public.rawdha_write_invoice(text,text,jsonb,jsonb) to authenticated;
grant execute on function public.rawdha_review_invoice_period(text,jsonb,text,text,boolean) to authenticated;

create function public.rawdha_invoice_review_action(
  p_request_id text,p_action text,p_invoice_id text,p_expected jsonb,p_period_key text,
  p_target_invoice_id text,p_target_expected jsonb,p_reason text,p_confirmed boolean
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_before jsonb; v_current jsonb; v_after jsonb; v_target jsonb; v_child text; v_owner text; v_event public.rawdha_invoice_review_events%rowtype;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(),false) or coalesce(public.rawdha_is_approved_director(),false)) then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  if nullif(trim(p_request_id),'') is null or length(p_request_id)>200 or nullif(trim(p_invoice_id),'') is null
    or p_action is null or p_action not in ('correct_period','flag_duplicate','clear_suspicion')
    or jsonb_typeof(p_expected) is distinct from 'object' or nullif(trim(p_reason),'') is null or length(trim(p_reason))>500
    or p_confirmed is distinct from true then raise exception 'finance_invalid_review_action' using errcode='22023'; end if;
  if (p_action='correct_period' and (p_period_key is null or substring(p_period_key from 3 for 4)='0000'
        or (p_period_key !~ '^M:[0-9]{4}-(0[1-9]|1[0-2])$' and p_period_key !~ '^A:[0-9]{4}$')
        or p_target_invoice_id is not null or p_target_expected is not null))
    or (p_action='flag_duplicate' and (p_period_key is not null or nullif(trim(p_target_invoice_id),'') is null
        or p_target_invoice_id=p_invoice_id or jsonb_typeof(p_target_expected) is distinct from 'object'))
    or (p_action='clear_suspicion' and (p_period_key is not null or p_target_invoice_id is not null or p_target_expected is not null))
    then raise exception 'finance_invalid_review_action' using errcode='22023'; end if;

  select data into v_before from public.paiements where id=p_invoice_id;
  if v_before is null then raise exception 'finance_not_found' using errcode='P0002'; end if;
  v_child:=v_before->>'enfantId';
  select data->>'crecheId' into v_owner from public.enfants where id=v_child for update;
  if nullif(trim(v_owner),'') is null or (not coalesce(public.rawdha_is_admin(),false) and v_owner<>auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode='42501';
  end if;
  select data into v_current from public.paiements where id=p_invoice_id for update;
  if v_current is null or v_current->>'enfantId' is distinct from v_child then raise exception 'finance_changed' using errcode='40001'; end if;
  select * into v_event from public.rawdha_invoice_review_events where request_id=p_request_id;
  if found then
    if v_event.invoice_id=p_invoice_id and v_event.creche_id=v_owner and v_event.created_by=auth.uid() and v_event.action=p_action
      and v_event.period_key is not distinct from p_period_key and v_event.target_invoice_id is not distinct from p_target_invoice_id
      and v_event.reason=trim(p_reason) and (v_event.before_data-'id')=(p_expected-'id')
      and (v_event.target_before-'id') is not distinct from (p_target_expected-'id') and v_event.after_data=v_current then
      return v_current || jsonb_build_object('id',p_invoice_id);
    end if;
    raise exception 'finance_review_request_conflict' using errcode='23505';
  end if;
  if (p_expected-'id') is distinct from (v_current-'id') then raise exception 'finance_changed' using errcode='40001'; end if;
  if p_action='correct_period' then
    perform public.rawdha_invoice_review_guard(v_child,p_invoice_id);
    if not (v_current ? 'periodeCle') or v_current->>'periodeCle'=p_period_key then raise exception 'finance_invalid_review_action' using errcode='22023'; end if;
    if exists (select 1 from public.paiements p where p.id<>p_invoice_id and p.data->>'enfantId'=v_child and (
      p.data->>'periodeCle'=p_period_key or (substring(p.data->>'periodeCle' from 3 for 4)=substring(p_period_key from 3 for 4) and
      ((left(p.data->>'periodeCle',2)='A:' and left(p_period_key,2)='M:') or (left(p.data->>'periodeCle',2)='M:' and left(p_period_key,2)='A:')))))
      then raise exception 'finance_period_overlap' using errcode='23505'; end if;
    v_after:=jsonb_set(v_current,'{periodeCle}',to_jsonb(p_period_key),true);
  elsif p_action='flag_duplicate' then
    -- The child lock prevents other protected writes on either invoice. Verify
    -- both versions so a comparison cannot be based on an outdated target.
    perform public.rawdha_invoice_review_guard(v_child,p_invoice_id);
    perform public.rawdha_invoice_review_guard(v_child,p_target_invoice_id);
    select data into v_target from public.paiements where id=p_target_invoice_id for update;
    if v_target is null or v_target->>'enfantId' is distinct from v_child then raise exception 'finance_invalid_duplicate_target' using errcode='22023'; end if;
    if (p_target_expected-'id') is distinct from (v_target-'id') then raise exception 'finance_changed' using errcode='40001'; end if;
    v_after:=v_current || jsonb_build_object('doublonSuspect',jsonb_build_object('targetInvoiceId',p_target_invoice_id,'eventId',p_request_id));
  else
    if not (v_current ? 'doublonSuspect') then raise exception 'finance_invalid_review_action' using errcode='22023'; end if;
    v_after:=v_current-'doublonSuspect';
  end if;
  insert into public.rawdha_invoice_review_events(request_id,invoice_id,enfant_id,creche_id,action,period_key,target_invoice_id,reason,before_data,after_data,target_before,created_by)
    values(p_request_id,p_invoice_id,v_child,v_owner,p_action,p_period_key,p_target_invoice_id,trim(p_reason),v_current,v_after,v_target,auth.uid());
  update public.paiements set data=v_after where id=p_invoice_id;
  return v_after || jsonb_build_object('id',p_invoice_id);
end $$;

create function public.rawdha_list_invoice_review_events(p_invoice_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_child text; v_owner text; v_result jsonb;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(),false) or coalesce(public.rawdha_is_approved_director(),false)) then
    raise exception 'not_allowed' using errcode='42501'; end if;
  select data->>'enfantId' into v_child from public.paiements where id=p_invoice_id;
  select data->>'crecheId' into v_owner from public.enfants where id=v_child for share;
  if nullif(trim(v_owner),'') is null or (not coalesce(public.rawdha_is_admin(),false) and v_owner<>auth.uid()::text) then
    raise exception 'not_allowed_or_not_found' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('requestId',e.request_id,'invoiceId',e.invoice_id,'action',e.action,'periodKey',e.period_key,
    'targetInvoiceId',e.target_invoice_id,'reason',e.reason,'beforeData',e.before_data,'afterData',e.after_data,'targetBefore',e.target_before,
    'createdBy',e.created_by,'createdAt',e.created_at) order by e.created_at,e.request_id),'[]'::jsonb) into v_result
    from public.rawdha_invoice_review_events e where e.invoice_id=p_invoice_id and e.enfant_id=v_child and e.creche_id=v_owner;
  return v_result;
end $$;
revoke all on function public.rawdha_invoice_review_action(text,text,text,jsonb,text,text,jsonb,text,boolean) from public,anon;
revoke all on function public.rawdha_list_invoice_review_events(text) from public,anon;
grant execute on function public.rawdha_invoice_review_action(text,text,text,jsonb,text,text,jsonb,text,boolean) to authenticated;
grant execute on function public.rawdha_list_invoice_review_events(text) to authenticated;
commit;
