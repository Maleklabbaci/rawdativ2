-- STAGING FIRST. Coordinate with register-director-request deployment and onboarding.
-- Database profile/settings/onboarding are initialized in one transaction; Auth remains separate.
begin;
create table if not exists public.director_signup_attempts (attempted_at timestamptz not null default clock_timestamp());
alter table public.director_signup_attempts enable row level security;
revoke all on public.director_signup_attempts from public,anon,authenticated,service_role;

-- Independent evidence of mailbox ownership. Auth is auto-confirmed for direct
-- access, so its email_confirmed_at must NOT be used as ownership evidence.
-- No workflow marks this verified yet; this table is reserved for a future,
-- proof-backed verification design. Never allow client writes.
create table if not exists public.director_email_verification (
  account_id text primary key references public.comptes(id) on delete cascade,
  email text not null,
  verified_at timestamptz
);
alter table public.director_email_verification enable row level security;
revoke all on public.director_email_verification from public,anon,authenticated,service_role;
grant select on public.director_email_verification to authenticated;
create policy director_email_verification_owner_read on public.director_email_verification for select to authenticated
  using (account_id=auth.uid()::text);

-- A global emergency budget, not a substitute for trusted per-IP edge/WAF limits.
-- No IP addresses, email addresses or credentials are stored here.
create or replace function public.rawdha_signup_take_slot()
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare attempts integer;
begin
  perform pg_advisory_xact_lock(hashtext('rawdha_director_signup_budget'));
  delete from public.director_signup_attempts where attempted_at < clock_timestamp()-interval '2 minutes';
  select count(*) into attempts from public.director_signup_attempts where attempted_at >= clock_timestamp()-interval '1 minute';
  if attempts >= 20 then return false; end if;
  insert into public.director_signup_attempts default values;
  return true;
end $$;
revoke all on function public.rawdha_signup_take_slot() from public,anon,authenticated;
grant execute on function public.rawdha_signup_take_slot() to service_role;

create or replace function public.rawdha_initialize_director_signup(
  p_account_id text, p_email text, p_first text, p_last text, p_phone text,
  p_nursery text, p_address text, p_website text
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare previous jsonb;
begin
  if p_account_id is null or p_email is null or p_first is null or p_last is null
    or p_phone is null or p_nursery is null or p_address is null or p_website is null
    or length(p_email)>254 or length(p_first)>120 or length(p_last)>120 or length(p_phone)>40
    or length(p_nursery)>160 or length(p_address)>500 or length(p_website)>2048
    or trim(p_email)='' or trim(p_first)='' or trim(p_last)='' or trim(p_phone)=''
    or trim(p_nursery)='' or trim(p_address)='' then raise exception 'invalid_signup'; end if;
  -- Auth is created first by the trusted Edge Function. Do not initialize a different email.
  if not exists(select 1 from auth.users u where u.id::text=p_account_id and lower(u.email)=lower(p_email)) then raise exception 'signup_auth_mismatch'; end if;
  select data into previous from public.comptes where id=p_account_id for update;
  if previous is not null and (previous->>'role' is distinct from 'directeur' or previous->>'approvalStatus' is distinct from 'pending') then
    raise exception 'signup_account_already_initialized';
  end if;
  insert into public.comptes(id,data) values(p_account_id,jsonb_build_object(
    'nom',p_last,'prenom',p_first,'email',p_email,'role','directeur','approvalStatus','approved',
    'abonnementActif',true,'nomCreche',p_nursery,
    'dateFinAbonnement',((now() at time zone 'UTC')::date + 15)::text))
  on conflict (id) do update set data=excluded.data;
  insert into public.parametres(id,data) values('creche_'||p_account_id,jsonb_build_object(
    'crecheName',p_nursery,'principalEmail',p_email,'phoneNumbers',p_phone,'addressLine',p_address,
    'siteWeb',p_website,'tuitionFeeRate',3500,'logoUrl',''))
  on conflict (id) do update set data=excluded.data;
  insert into public.director_email_verification(account_id,email,verified_at) values(p_account_id,p_email,null);
  insert into public.director_onboarding(account_id,step) values(p_account_id,'welcome');
end $$;
revoke all on function public.rawdha_initialize_director_signup(text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.rawdha_initialize_director_signup(text,text,text,text,text,text,text,text) to service_role;
commit;
