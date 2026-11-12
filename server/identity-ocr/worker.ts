/** Self-hosted, private OCR helper. Never approves or rejects a request. */
import { createClient } from '@supabase/supabase-js';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareNames, extractNames, type ReadName } from '../../src/utils/identityOcr';

export type Document = { account_id: string; ocr_revision: string; account_first_name: string; account_last_name: string; document_bytes: string };
export function bytesFromDatabase(value: string): Buffer {
  if (typeof value !== 'string' || !/^\\x(?:[0-9a-f]{2})+$/i.test(value) || value.length > 4194306) throw new Error('invalid document');
  return Buffer.from(value.slice(2), 'hex');
}
export function chooseResult(texts: { fra: string; ara: string }, account: ReadName) {
  const readings = [extractNames(texts.fra, 'fra'), extractNames(texts.ara, 'ara')];
  // Prefer a complete French reading; otherwise use a complete Arabic reading.
  // Never combine partial readings from different scripts into a seemingly complete name.
  const read = readings.find(r => r.first && r.last) || readings.find(r => r.first || r.last) || {first:'',last:''};
  const match = compareNames(read, account);
  return { result: match === 'unreadable' ? 'unreadable' : match === 'exact' || match === 'possible' ? 'matched' : 'not_matched', first: read.first.slice(0,100) || null, last: read.last.slice(0,100) || null };
}
export async function readImage(bytes: Buffer) {
  // Cap decompressed pixels, strip metadata, normalize orientation and bound OCR workload.
  const image = await sharp(bytes, {limitInputPixels: 20_000_000, failOn: 'error'}).rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).png().toBuffer();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const worker = await createWorker('fra+ara', 1, {langPath:path.join(root,'public/identity-ocr'), corePath:path.join(root,'node_modules/tesseract.js-core'), gzip:false, cacheMethod:'none'});
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const reading = worker.recognize(image);
    const timeout = new Promise<never>((_, reject) => {timer=setTimeout(()=>reject(new Error('OCR timeout')), 60000)});
    const {data} = await Promise.race([reading,timeout]);
    return {fra:data.text,ara:data.text};
  } finally { if(timer) clearTimeout(timer); await worker.terminate(); }
}

export async function processDocument(doc: Document, recognize = readImage) {
  const texts = await recognize(bytesFromDatabase(doc.document_bytes));
  return chooseResult(texts, {first:doc.account_first_name,last:doc.account_last_name});
}
export async function runOnce(client: ReturnType<typeof createClient>, recognize = readImage) {
  const {data: docs,error} = await client.rpc('rawdha_identity_ocr_queue');
  if(error) throw new Error('queue unavailable');
  for (const doc of (docs || []) as Document[]) {
    let result: ReturnType<typeof chooseResult>;
    try { result = await processDocument(doc as Document, recognize); }
    catch { result = {result:'unreadable',first:null,last:null}; }
    const {error: saveError} = await client.rpc('rawdha_record_identity_auto_result', {p_account_id:doc.account_id,p_revision:doc.ocr_revision,p_result:result.result,p_first_name:result.first,p_last_name:result.last});
    // The document can disappear, change or be decided while OCR is running. Never attach a stale result.
    if(saveError && !['review_not_pending','stale_document','account_name_changed'].some(reason => saveError.message.includes(reason))) throw new Error('result unavailable');
  }
  return (docs || []).length;
}
export function makeClient(url: string, serviceKey: string) {
  const parsed = new URL(url);
  if(parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('SUPABASE_URL must be HTTPS');
  return createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
}
