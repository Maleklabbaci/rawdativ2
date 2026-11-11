-- STAGING ONLY. Requires the finance migrations through 190000.
-- Read-only, point-in-time preflight: not proof of payment, a reservation, or
-- a guarantee that a later external message is safe. WhatsApp/clipboard are
-- outside the transaction and can never be recalled by this function.
begin;

create function public.rawdha_check_invoice_reminder(
  p_invoice_id text, p_expected_invoice jsonb, p_expected_first_name text,
  p_expected_last_name text, p_expected_phone text default null
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_child text; v_child_data jsonb; v_current jsonb; v_amount numeric;
begin
  if auth.uid() is null or not (coalesce(public.rawdha_is_admin(),false) or coalesce(public.rawdha_is_approved_director(),false)) then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  if nullif(trim(p_invoice_id),'') is null or length(p_invoice_id)>200 or jsonb_typeof(p_expected_invoice) is distinct from 'object'
    or p_expected_first_name is null or p_expected_last_name is null
    or (p_expected_phone is not null and (nullif(trim(p_expected_phone),'') is null or length(p_expected_phone)>100)) then
    raise exception 'finance_invalid_reminder' using errcode='22023';
  end if;
  select data->>'enfantId' into v_child from public.paiements where id=p_invoice_id;
  if nullif(trim(v_child),'') is null then raise exception 'finance_changed' using errcode='40001'; end if;
  -- Shared serialization order: child, then invoice. Guard authorizes the
  -- current owner/admin and checks both sides of a flagged pair.
  perform public.rawdha_invoice_review_guard(v_child,p_invoice_id);
  select data into v_child_data from public.enfants where id=v_child;
  select data into v_current from public.paiements where id=p_invoice_id for share;
  if v_current is null or v_current->>'enfantId' is distinct from v_child
    or (v_current-'id') is distinct from (p_expected_invoice-'id')
    or v_child_data->>'prenom' is distinct from p_expected_first_name
    or v_child_data->>'nom' is distinct from p_expected_last_name then
    raise exception 'finance_changed' using errcode='40001';
  end if;
  if p_expected_phone is not null then
    if jsonb_typeof(v_child_data->'parents') is distinct from 'array' then raise exception 'finance_changed' using errcode='40001'; end if;
    if not exists(select 1 from jsonb_array_elements(v_child_data->'parents') parent
      where jsonb_typeof(parent->'telephone')='string' and parent->>'telephone'=p_expected_phone) then
      raise exception 'finance_changed' using errcode='40001';
    end if;
  end if;
  if v_current->>'statut' not in ('En attente','Retard') or v_current->>'statut' is null
    or jsonb_typeof(v_current->'montant') is distinct from 'number' then
    raise exception 'finance_invalid_reminder' using errcode='22023';
  end if;
  v_amount := (v_current->>'montant')::numeric;
  if v_amount <= 0 then raise exception 'finance_invalid_reminder' using errcode='22023'; end if;
  if exists (select 1 from public.paiements p where p.data->>'enfantId'=v_child and (
      jsonb_typeof(p.data->'periodeCle') is distinct from 'string'
      or substring(p.data->>'periodeCle' from 3 for 4)='0000'
      or (p.data->>'periodeCle' !~ '^M:[0-9]{4}-(0[1-9]|1[0-2])$' and p.data->>'periodeCle' !~ '^A:[0-9]{4}$')
  )) then raise exception 'finance_legacy_review_required' using errcode='55000'; end if;
  return true;
end $$;
revoke all on function public.rawdha_check_invoice_reminder(text,jsonb,text,text,text) from public,anon;
grant execute on function public.rawdha_check_invoice_reminder(text,jsonb,text,text,text) to authenticated;
commit;
