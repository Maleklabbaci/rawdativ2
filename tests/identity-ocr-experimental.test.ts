import {test} from 'node:test';import assert from 'node:assert/strict';import {compareNames,extractNames} from '../src/utils/identityOcr';
test('OCR extraction and comparisons never treat a transliteration as certain',()=>{
 assert.deepEqual(extractNames('NOM : BENALI\nPRENOM : AMEL','fra'),{first:'AMEL',last:'BENALI'});
 assert.deepEqual(extractNames('اللقب : بن علي\nالاسم : أمل','ara'),{first:'أمل',last:'بن علي'});
 const account={first:'Amel',last:'Benali'};
 assert.equal(compareNames({first:'AMEL',last:'BENALI'},account),'exact');
 assert.equal(compareNames({first:'أمل',last:'بن علي'},account),'possible');
 assert.equal(compareNames({first:'أمل',last:'قاسم'},account),'different');
 assert.equal(compareNames({first:'',last:'Benali'},account),'unreadable');
});
