import { makeClient, runOnce } from './worker';
const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the private OCR host');
const client=makeClient(url,key);
let running=true;
process.on('SIGTERM',()=>{running=false});process.on('SIGINT',()=>{running=false});
console.log('Identity OCR worker started');
while(running) {
  try {await runOnce(client)} catch {console.error('Identity OCR worker: temporary processing error');}
  if(running) await new Promise(resolve=>setTimeout(resolve,10000));
}
