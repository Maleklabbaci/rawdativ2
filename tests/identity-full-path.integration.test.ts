/** Exercises the actual Edge handler, database migrations and local OCR with a synthetic card.
 * PGlite and the Supabase client adapter are local test substitutes, not a deployed Supabase test. */
import {PGlite} from '@electric-sql/pglite';import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {transform} from 'esbuild';import sharp from 'sharp';import {runOnce} from '../server/identity-ocr/worker';

test('synthetic card travels from upload to OCR assistance to super-admin decision', {timeout:90000},async()=>{
 const db=new PGlite();const director='00000000-0000-0000-0000-000000000011', admin='00000000-0000-0000-0000-000000000022', supervisor='00000000-0000-0000-0000-000000000033';
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
  create table public.comptes(id text primary key,data jsonb not null);create table public.admin_audit_logs(id text primary key,data jsonb not null);
  create function public.rawdha_is_admin() returns boolean language sql security definer stable as $$select exists(select 1 from public.comptes where id=auth.uid()::text and data->>'role'='admin')$$;
  grant usage on schema public,auth to anon,authenticated,service_role;grant select on public.comptes to service_role;`);
  await db.query('insert into public.comptes values ($1,$2),($3,$4),($5,$6)',[director,{role:'directeur',prenom:'Amel',nom:'Benali'},admin,{role:'admin'},supervisor,{role:'admin'}]);
  for(const m of ['20261108260000_identity_review_foundation.sql','20261108280000_identity_decision_audit.sql','20261108340000_identity_two_step_guard.sql','20261108350000_identity_ocr_queue.sql','20261108360000_identity_super_admin_access.sql']) await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+m,import.meta.url),'utf8'));
  await db.query('insert into public.identity_super_admins(account_id) values ($1)',[supervisor]);await db.exec('set role service_role');
  const convert=(row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Uint8Array?'\\x'+Buffer.from(v).toString('hex'):v]));
  const service={rpc:async(name:string,args:Record<string,unknown>={})=>{try{const vals=Object.values(args),bindings=Object.keys(args).map((k,i)=>`${k} => $${i+1}`).join(',');const result=await db.query(`select * from public.${name}(${bindings})`,vals);if(name==='rawdha_identity_is_super_admin')return {data:Object.values(result.rows[0])[0],error:null};if(name==='rawdha_identity_ocr_queue')return {data:result.rows.map(row=>convert(row as Record<string,unknown>)),error:null};return {data:null,error:null};}catch(e){return {data:null,error:e as Error}}},from:(table:string)=>{
   let columns='*';const filters:{key:string,value:unknown,in?:boolean}[]=[];
   const get=async(single=false)=>{try {const vals=filters.map(f=>f.value);const where=filters.map((f,i)=>`${f.key} ${f.in?'= any':'='}($${i+1})`).join(' and ');const result=await db.query(`select ${columns} from public.${table}${where?' where '+where:''}`,vals);const rows=result.rows.map(row=>convert(row as Record<string,unknown>));return {data:single?rows[0] || null:rows,error:null}}catch(e){return {data:null,error:e as Error}}};
   const chain={select(c:string){columns=c;return chain},eq(k:string,v:unknown){filters.push({key:k,value:v});return chain},in(k:string,v:unknown){filters.push({key:k,value:v,in:true});return chain},maybeSingle(){return get(true)},then(resolve:(value:unknown)=>void,reject:(reason:unknown)=>void){return get().then(resolve,reject)}};return chain;
  }};
  let handler: ((req:Request)=>Promise<Response>)|undefined;
  const createClient=(_url:string,key:string,opts?:{global:{headers:{Authorization:string}}})=> key==='service'?service:{auth:{getUser:async()=>({data:{user:{id:opts?.global.headers.Authorization.slice(7)}},error:null})}};
  const source=fs.readFileSync(new URL('../supabase/functions/identity-document-review/index.ts',import.meta.url),'utf8').replace(/^import .*?;\s*/m,'');
  vm.runInNewContext((await transform(source,{loader:'ts',format:'iife'})).code,{createClient,Request,Response,Uint8Array,atob,JSON,Number,String,console,Deno:{env:{get:(k:string)=>({SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'} as Record<string,string>)[k]},serve:(fn:typeof handler)=>{handler=fn}}});
  const call=(id:string,body:Record<string,unknown>)=>handler!(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer '+id,'content-type':'application/json'},body:JSON.stringify(body)}));
  const svg=Buffer.from('<svg width="1100" height="620" xmlns="http://www.w3.org/2000/svg"><rect width="1100" height="620" fill="white"/><text x="80" y="110" font-size="36" font-family="DejaVu Sans">CARTE FICTIVE</text><text x="80" y="240" font-size="50" font-family="DejaVu Sans">NOM : BENALI</text><text x="80" y="340" font-size="50" font-family="DejaVu Sans">PRENOM : AMEL</text></svg>');
  const image=await sharp(svg).png().toBuffer();const sent=await call(director,{action:'submit',mime:'image/png',image:image.toString('base64')});assert.equal(sent.status,200);assert.equal((await sent.json()).status,'pending');
  assert.equal((await call(admin,{action:'list'})).status,403);
  const before=await (await call(supervisor,{action:'list'})).json();assert.equal(before.requests.length,1);assert.equal(before.requests[0].auto_match,'not_checked');
  assert.equal(await runOnce(service as never),1);
  const after=await (await call(supervisor,{action:'list'})).json();assert.equal(after.requests[0].auto_match,'matched');assert.equal(after.requests[0].ocr_first_name,'AMEL');assert.equal(after.requests[0].ocr_last_name,'BENALI');
  assert.equal((await db.query('select status from public.identity_document_reviews where account_id=$1',[director])).rows[0].status,'pending');
  const view=await call(supervisor,{action:'document',accountId:director});assert.equal(view.status,200);assert.equal(view.headers.get('content-type'),'application/octet-stream');assert.deepEqual(Buffer.from(await view.arrayBuffer()),image);
  assert.equal((await call(admin,{action:'decide',accountId:director,decision:'document_reviewed'})).status,403);
  const decision=await call(supervisor,{action:'decide',accountId:director,decision:'document_reviewed'});assert.equal(decision.status,200);
  assert.equal((await db.query('select status from public.identity_document_reviews where account_id=$1',[director])).rows[0].status,'document_reviewed');assert.equal((await db.query('select count(*)::int n from public.identity_review_documents')).rows[0].n,0);assert.equal((await (await call(supervisor,{action:'list'})).json()).requests.length,0);
  // A second fictitious request with failed OCR stays pending and may be refused manually.
  assert.equal((await call(director,{action:'submit',mime:'image/png',image:image.toString('base64')})).status,200);
  await runOnce(service as never,async()=>{throw new Error('simulated OCR failure')});
  const unreadable=await (await call(supervisor,{action:'list'})).json();assert.equal(unreadable.requests[0].auto_match,'unreadable');
  assert.equal((await db.query('select status from public.identity_document_reviews where account_id=$1',[director])).rows[0].status,'pending');
  assert.equal((await call(supervisor,{action:'decide',accountId:director,decision:'refused'})).status,200);
  assert.equal((await db.query('select status from public.identity_document_reviews where account_id=$1',[director])).rows[0].status,'refused');
  assert.equal((await db.query('select count(*)::int n from public.identity_review_documents')).rows[0].n,0);

 } finally {await db.close()}
});
