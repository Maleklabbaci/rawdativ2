import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {transform} from 'esbuild';
test('director upload does not accept a client-provided OCR result as confirmation',async()=>{
 let handler;const calls=[];const id='00000000-0000-0000-0000-000000000011';
 const service={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{data:{role:'directeur'}},error:null})}),rpc:async(name,args)=>{calls.push({name,args});return {error:null}}};
 const createClient=(_url,key)=>key==='service'?service:{auth:{getUser:async()=>({data:{user:{id}},error:null})}};
 const source=fs.readFileSync(new URL('../supabase/identity-document-review/index.ts',import.meta.url),'utf8').replace(/^import .*?;\s*/m,'');const code=(await transform(source,{loader:'ts',format:'iife'})).code;
 vm.runInNewContext(code,{createClient,Request,Response,Uint8Array,atob,JSON,Number,String,console,Deno:{env:{get:k=>({SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'})[k]},serve:fn=>{handler=fn}}});
 const body={action:'submit',mime:'image/jpeg',image:Buffer.from([255,216,255,1,2]).toString('base64'),auto_match:'matched',decision:'document_reviewed'};
 const result=await handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer token','content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal(result.status,200);assert.equal((await result.json()).status,'pending');assert.equal(calls.length,1);assert.equal(calls[0].name,'rawdha_submit_identity_document');assert.deepEqual(Object.keys(calls[0].args).sort(),['p_account_id','p_base64','p_mime']);
});
test('only server-authorized super admins can list, view or decide; errors fail closed',async()=>{
 const id='00000000-0000-0000-0000-000000000033',target='00000000-0000-0000-0000-000000000011';let handler,allowed=false,permissionError=null,queries=0,actions=[];
 const service={from:(table)=>({select(){return this},eq(){return this},in(){return this},maybeSingle:async()=>table==='comptes'?{data:{data:{role:'admin'}},error:null}:{data:{account_id:target,mime_type:'image/jpeg',document_bytes:'\\xabcdef'},error:null},then(resolve){queries++;resolve({data:[],error:null})}}),rpc:async(name,args)=>{actions.push([name,args]);return name==='rawdha_identity_is_super_admin'?{data:allowed,error:permissionError}:{error:null}}};
 const createClient=(_url,key)=>key==='service'?service:{auth:{getUser:async()=>({data:{user:{id}},error:null})}};
 const source=fs.readFileSync(new URL('../supabase/functions/identity-document-review/index.ts',import.meta.url),'utf8').replace(/^import .*?;\s*/m,'');
 vm.runInNewContext((await transform(source,{loader:'ts',format:'iife'})).code,{createClient,Request,Response,Uint8Array,atob,JSON,Number,String,console,Deno:{env:{get:k=>({SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'})[k]},serve:fn=>{handler=fn}}});
 const request=body=>handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer token','content-type':'application/json'},body:JSON.stringify(body)}));
 for(const action of ['list','document','decide']) {const response=await request({action,accountId:target,decision:'document_reviewed',adminId:id,internalAdminRole:'super_admin'});assert.equal(response.status,403)}
 assert.equal(queries,0);assert.ok(actions.every(([name])=>name==='rawdha_identity_is_super_admin'));
 permissionError={message:'unavailable'};assert.equal((await request({action:'list'})).status,503);
 permissionError=null;allowed=true;assert.equal((await request({action:'list'})).status,200);assert.equal(queries,1);
 const result=await request({action:'decide',accountId:target,decision:'document_reviewed',adminId:target});assert.equal(result.status,200);assert.equal(actions.at(-1)[0],'rawdha_decide_identity_document');assert.equal(actions.at(-1)[1].p_admin_id,id);
});
