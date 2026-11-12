import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'vite';
test('tracked RPC records only safe operation metadata and never breaks a successful business mutation',async()=>{
 const calls=[]; const oldWindow=globalThis.window;globalThis.window={location:{pathname:'/presences'}};
 globalThis.__rawdatiSupabaseClient__={rpc:(name,args)=>{calls.push({name,args}); if(name==='rawdha_record_application_event')throw Error('logger unavailable'); if(name==='rawdha_write_presence')return Promise.resolve({data:{id:'private'},error:null});return Promise.resolve({data:false,error:null})}};
 const server=await createServer({server:{middlewareMode:true},appType:'custom'});
 try {const {trackedBusinessRpc}=await server.ssrLoadModule('/src/supabase.ts');let r=await trackedBusinessRpc('rawdha_write_presence',{p_action:'create',p_patch:{nom:'PRIVATE'},p_id:'PRIVATE'});assert.equal(r.data.id,'private');const event=calls.find(c=>c.name==='rawdha_record_application_event');assert.ok(event);assert.deepEqual(event.args,{p_kind:'data_success',p_page:'presences',p_operation:'create',p_diagnostic:null});assert.doesNotMatch(JSON.stringify(event.args),/PRIVATE|private/);
 r=await trackedBusinessRpc('rawdha_write_invoice',{p_action:'update',p_patch:{secret:'SECRET'}});assert.equal(r.data,false);assert.equal(calls.at(-1).args.p_kind,'data_failure');await assert.rejects(trackedBusinessRpc('not_allowed',{}),/non instrumentée/);
 }finally{await server.close();delete globalThis.__rawdatiSupabaseClient__;globalThis.window=oldWindow;}
});
