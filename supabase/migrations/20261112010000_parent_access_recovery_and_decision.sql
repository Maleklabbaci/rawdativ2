-- Transfer an approved parent's access only with a short-lived, single-use bearer
-- secret created by the already approved device. Never store the secret itself.
begin;
create table if not exists public.parent_device_transfers (
 token_hash text primary key,
 source_request_id text not null references public.parent_link_requests(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 used_at timestamptz
);
alter table public.parent_device_transfers enable row level security;
revoke all on public.parent_device_transfers from public, anon, authenticated;

create or replace function public.rawdha_create_parent_device_transfer(p_creche_id text, p_device_token text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_request public.parent_link_requests%rowtype; v_token text;
begin
 if p_device_token is null or p_device_token !~ '^ptok_[0-9a-f]{32}$' then raise exception 'invalid_device'; end if;
 select * into v_request from public.parent_link_requests where creche_id=p_creche_id
  and device_token_hash=encode(sha256(convert_to(p_device_token,'UTF8')),'hex') and status='approved' and cardinality(linked_enfant_ids)>0 for update;
 if not found or not exists(select 1 from public.comptes where id=v_request.creche_id and data->>'role'='directeur' and data->>'approvalStatus'='approved') then raise exception 'access_unavailable'; end if;
 if (select count(*) from public.parent_device_transfers where source_request_id=v_request.id and created_at>now()-interval '1 hour') >= 5 then raise exception 'too_many_transfers'; end if;
 -- A newer code invalidates earlier unused codes, without invalidating the source device.
 update public.parent_device_transfers set used_at=now() where source_request_id=v_request.id and used_at is null;
 v_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.parent_device_transfers(token_hash,source_request_id,expires_at) values(encode(sha256(convert_to(v_token,'UTF8')),'hex'),v_request.id,now()+interval '10 minutes');
 return jsonb_build_object('token',v_token,'expiresAt',now()+interval '10 minutes');
end $$;

create or replace function public.rawdha_redeem_parent_device_transfer(p_token text,p_device_token text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_transfer public.parent_device_transfers%rowtype; v_source public.parent_link_requests%rowtype; v_hash text;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_device_token is null or p_device_token !~ '^ptok_[0-9a-f]{32}$' then raise exception 'invalid_input'; end if;
 select * into v_transfer from public.parent_device_transfers where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and used_at is null and expires_at>now() for update;
 if not found then raise exception 'transfer_unavailable'; end if;
 select * into v_source from public.parent_link_requests where id=v_transfer.source_request_id and status='approved' and cardinality(linked_enfant_ids)>0 for update;
 if not found or not exists(select 1 from public.comptes where id=v_source.creche_id and data->>'role'='directeur' and data->>'approvalStatus'='approved') then raise exception 'transfer_unavailable'; end if;
 v_hash:=encode(sha256(convert_to(p_device_token,'UTF8')),'hex');
 if exists(select 1 from public.parent_link_requests where creche_id=v_source.creche_id and device_token_hash=v_hash) then raise exception 'device_already_linked'; end if;
 insert into public.parent_link_requests(id,creche_id,creche_nom,device_token_hash,parent_prenom,parent_nom,parent_telephone,parent_lien,requested_children,requested_child_id,linked_enfant_ids,status,platform_hint)
 values('plr-'||replace(gen_random_uuid()::text,'-',''),v_source.creche_id,v_source.creche_nom,v_hash,v_source.parent_prenom,v_source.parent_nom,v_source.parent_telephone,v_source.parent_lien,v_source.requested_children,v_source.requested_child_id,v_source.linked_enfant_ids,'approved','ios');
 update public.parent_device_transfers set used_at=now() where token_hash=v_transfer.token_hash;
 return jsonb_build_object('ok',true,'crecheId',v_source.creche_id,'crecheNom',v_source.creche_nom);
end $$;
revoke all on function public.rawdha_create_parent_device_transfer(text,text) from public,anon,authenticated;
revoke all on function public.rawdha_redeem_parent_device_transfer(text,text) from public,anon,authenticated;
grant execute on function public.rawdha_create_parent_device_transfer(text,text) to anon,authenticated;
grant execute on function public.rawdha_redeem_parent_device_transfer(text,text) to anon,authenticated;

-- Atomic personal-QR decision: preserve existing contacts and prevent stale approvals.
create or replace function public.rawdha_approve_personal_parent_request(p_request_id text,p_child_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_req public.parent_link_requests%rowtype; v_data jsonb; v_parents jsonb; v_parent jsonb;
begin
 if auth.uid() is null or not coalesce(public.rawdha_is_approved_director(),false) then raise exception 'director_required'; end if;
 select * into v_req from public.parent_link_requests where id=p_request_id and creche_id=auth.uid()::text and status='pending' and requested_child_id=p_child_id for update;
 if not found then raise exception 'request_unavailable'; end if;
 select data into v_data from public.enfants where id=p_child_id and data->>'crecheId'=auth.uid()::text for update;
 if not found then raise exception 'child_unavailable'; end if;
 if v_data ? 'parents' and v_data->'parents' <> 'null'::jsonb and jsonb_typeof(v_data->'parents') <> 'array' then raise exception 'invalid_parent_data'; end if;
 v_parents:=case when jsonb_typeof(v_data->'parents')='array' then v_data->'parents' else '[]'::jsonb end;
 if not exists(select 1 from jsonb_array_elements(v_parents) p where lower(trim(coalesce(p->>'prenom','')))=lower(trim(v_req.parent_prenom)) and lower(trim(coalesce(p->>'nom','')))=lower(trim(v_req.parent_nom)) and regexp_replace(coalesce(p->>'telephone',''),'[^0-9]','','g')=regexp_replace(v_req.parent_telephone,'[^0-9]','','g') and p->>'lien'=case when v_req.parent_lien in ('Mère','Père','Tuteur') then v_req.parent_lien else 'Tuteur' end) then
   v_parent:=jsonb_build_object('id','parent-'||replace(gen_random_uuid()::text,'-',''),'prenom',v_req.parent_prenom,'nom',v_req.parent_nom,'telephone',v_req.parent_telephone,'lien',case when v_req.parent_lien in ('Mère','Père','Tuteur') then v_req.parent_lien else 'Tuteur' end);
   update public.enfants set data=jsonb_set(data,'{parents}',v_parents||jsonb_build_array(v_parent),true) where id=p_child_id;
 end if;
 update public.parent_link_requests set status='approved',linked_enfant_ids=array[p_child_id],rejection_reason=null,updated_at=now() where id=v_req.id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.rawdha_approve_personal_parent_request(text,text) from public,anon,authenticated;
grant execute on function public.rawdha_approve_personal_parent_request(text,text) to authenticated;
commit;
