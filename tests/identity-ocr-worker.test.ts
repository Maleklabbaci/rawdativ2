import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bytesFromDatabase,chooseResult,processDocument,runOnce} from '../server/identity-ocr/worker';

test('OCR extraction is indicative, partial or wrong names never approve',()=>{
 const account={first:'Amel',last:'Benali'};
 assert.equal(chooseResult({fra:'NOM: BENALI\nPRENOM: AMEL',ara:''},account).result,'matched');
 assert.equal(chooseResult({fra:'NOM: AUTRE\nPRENOM: AMEL',ara:''},account).result,'not_matched');
 assert.equal(chooseResult({fra:'NOM: BENALI',ara:'الاسم : أمل'},account).result,'unreadable');
 assert.throws(()=>bytesFromDatabase('broken'));
});
test('worker sends only revision-bound assistance; failure leaves decision to admin',async()=>{
 const doc={account_id:'id',ocr_revision:'rev',account_first_name:'Amel',account_last_name:'Benali',document_bytes:'\\x0102'};
 const calls:{name:string,args:unknown}[]=[];
 const client={rpc:async(name:string,args:unknown)=>{calls.push({name,args});return name==='rawdha_identity_ocr_queue'?{data:[doc],error:null}:{error:null}}} as never;
 await runOnce(client,async()=>({fra:'NOM: BENALI\nPRENOM: AMEL',ara:''}));
 assert.deepEqual(calls.map(c=>c.name),['rawdha_identity_ocr_queue','rawdha_record_identity_auto_result']);
 assert.deepEqual(calls[1].args,{p_account_id:'id',p_revision:'rev',p_result:'matched',p_first_name:'AMEL',p_last_name:'BENALI'});
 calls.length=0;await runOnce(client,async()=>{throw new Error('failed')});
 assert.equal((calls[1].args as {p_result:string}).p_result,'unreadable');
 assert.equal((await processDocument(doc,async()=>({fra:'nothing',ara:''}))).result,'unreadable');
});
