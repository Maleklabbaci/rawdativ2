import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

async function loadHandler(name, { provider, saveFails = false, order = null, envOverrides = {} } = {}) {
  let handler; let confirms = 0; const rows = new Map();
  if (order) rows.set(order.id, { ...order });
  class Query {
    constructor(table) { this.table = table; this.filters = []; }
    select() { return this; } eq(k,v) { this.filters.push([k,v]); return this; }
    insert(obj) { rows.set(obj.id, { ...obj }); return Promise.resolve({ error: null }); }
    update(obj) { this.updateData = obj; return this; }
    async maybeSingle() {
      if (this.table === 'comptes') return { data: { data: { role:'directeur', nom:'Demo', prenom:'User', email:'test@example.com' } }, error: null };
      const row = [...rows.values()].find(r => this.filters.every(([k,v]) => r[k] === v));
      if (this.updateData) { if (saveFails) return {data: null,error:{message:'db error'}}; if (row) Object.assign(row, this.updateData); }
      return {data: row || null, error:null};
    }
    then(resolve, reject) { return this.maybeSingle().then(resolve,reject); }
  }
  const service = { from: t => new Query(t), rpc: async () => { confirms++; return {data: {newEndDate:'2027-01-01'},error:null}; } };
  const createClient = (_url, key) => key === 'service' ? service : {auth:{getUser:async()=>({data:{user:{id:'director',email:'test@example.com'}},error:null})}};
  const original = fs.readFileSync(new URL(`../supabase/slickpay-${name}/index.ts`, import.meta.url),'utf8').replace(/^import .*?;\s*/m, '');
  const code = (await transform(original, { loader: 'ts', format:'iife' })).code;
  const env = { SUPABASE_URL:'https://db.example', SUPABASE_ANON_KEY:'anon', SUPABASE_SERVICE_ROLE_KEY:'service', SLICKPAY_PUBLIC_KEY:'key', SLICKPAY_SECRET_KEY:'secret', SLICKPAY_ACCOUNT_TYPE:'merchant', SLICKPAY_ENV:'sandbox', SLICKPAY_ENABLE_PAYMENTS:'true', ...envOverrides };
  const ctx = { Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn}}, createClient, fetch:provider, Request, Response, Headers, AbortController, setTimeout, clearTimeout, URL, TextEncoder, Uint8Array, crypto:globalThis.crypto, console };
  vm.runInNewContext(code, ctx);
  return { handler, getConfirms:()=>confirms, rows };
}
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const create = () => new Request('https://db.example/checkout',{method:'POST',headers:{Authorization:'Bearer token','content-type':'application/json'},body:JSON.stringify({planMonths:3})});
test('checkout refuses incomplete gateway responses and failed order persistence', async () => {
  for (const item of [
    { response:{success:true,url:'https://pay.example/'}, saveFails:false },
    { response:{success:true,id:12,url:'http://pay.example/'}, saveFails:false },
    { response:{success:true,id:12,url:'https://pay.example/'}, saveFails:true },
  ]) {
    const {handler} = await loadHandler('checkout',{provider:async()=>json(item.response),saveFails:item.saveFails});
    const response = await handler(create());
    assert.ok(response.status >= 400);
    assert.equal((await response.json()).paymentUrl, undefined);
  }
  const {handler, rows} = await loadHandler('checkout',{provider:async()=>json({success:true,id:12,url:'https://pay.example/'})});
  const response = await handler(create()); const result = await response.json();
  assert.equal(result.paymentUrl,'https://pay.example/');
  assert.equal(rows.get(result.orderId).slickpay_invoice_id,'12');
  assert.equal(rows.get(result.orderId).amount_dzd,5700);
});
test('verification credits only the saved paid invoice with the expected amount', async () => {
  const order = {id:'order',director_id:'director',status:'pending',slickpay_invoice_id:'12',amount_dzd:5700, plan_months:3};
  for (const [data, paid] of [
    [{id:12,completed:1,transaction:{amount:'5700.00'}},true],
    [{id:12,completed:0,transaction:{amount:5700}},false],
    [{id:12,completed:1,transaction:{amount:1900}},false],
    [{id:13,completed:1,transaction:{amount:5700}},false],
    [{id:12,completed:1},false],
  ]) {
    const {handler,getConfirms} = await loadHandler('checkout',{order,provider:async()=>json({data})});
    const request = new Request('https://db.example/checkout',{method:'POST',headers:{Authorization:'Bearer token','content-type':'application/json'},body:JSON.stringify({action:'verify',orderId:'order'})});
    await handler(request);
    assert.equal(getConfirms(), paid ? 1 : 0);
  }
});

test('webhook requires a stored invoice and reconciles amount before activation', async () => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw',encoder.encode('secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC',key,encoder.encode('order'))).toString('hex');
  for (const [invoice, amount, expectedStatus, confirmations] of [['12',5700,200,1],['12',1900,503,0],['',5700,503,0]]) {
    const order = {id:'order',director_id:'director',status:'pending',slickpay_invoice_id:invoice,amount_dzd:5700,plan_months:3};
    const {handler,getConfirms} = await loadHandler('webhook',{order,provider:async()=>json({data:{id:12,completed:1,transaction:{amount}}})});
    const response = await handler(new Request(`https://db.example/webhook?order_id=order&sig=${signature}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:12})}));
    assert.equal(response.status, expectedStatus);
    assert.equal(getConfirms(), confirmations);
  }
});

test('incident logging is minimal and failure to log does not alter checkout failure', async () => {
  const calls=[];
  const {handler}=await loadHandler('checkout',{saveFails:true,provider:async (url,options) => {
    if (String(url).includes('/rest/v1/rpc/rawdha_record_server_incident')) { calls.push(JSON.parse(options.body)); throw new Error('logging offline'); }
    return json({success:true,id:12,url:'https://pay.example/'});
  }});
  const response=await handler(create());
  assert.equal(response.status,503); const id=response.headers.get('X-Rawdha-Incident');
  assert.match(id,/^[0-9a-f-]{36}$/); assert.deepEqual(calls,[{p_source:'slickpay-checkout',p_incident_id:id}]);
  assert.match((await response.json()).error,/Impossible d’enregistrer/);
});

test('payment endpoints remain disabled until both the explicit switch and a valid environment are configured',async()=>{
 for (const name of ['checkout','webhook']) {
  for (const envOverrides of [{SLICKPAY_ENABLE_PAYMENTS:''},{SLICKPAY_ENV:''},{SLICKPAY_ENV:'typo'}]) {
    let requests=0;const {handler}=await loadHandler(name,{envOverrides,provider:async(url)=>{if(String(url).includes('slick-pay.com'))requests++;return json({})}});
    const response=await handler(new Request('https://db.example/'+name,{method:'POST',headers:{Authorization:'Bearer token','content-type':'application/json'},body:'{}'}));
    assert.equal(response.status,503);assert.equal(requests,0);
  }
 }
});
