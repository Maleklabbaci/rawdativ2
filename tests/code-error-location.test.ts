import test from 'node:test'; import assert from 'node:assert/strict'; import {safeCodeLocation} from '../src/utils/codeErrorLocation';
test('only same-origin known asset names and valid lines are retained',()=>{
 const o='https://rawdha.example';
 assert.deepEqual(safeCodeLocation(`${o}/assets/Enfants-Ab12cd34.js?token=secret`,42,o),{source:'Enfants-Ab12cd34.js',line:42});
 assert.deepEqual(safeCodeLocation('https://evil.example/assets/Enfants-Ab12cd34.js',42,o),{source:null,line:null});
 assert.deepEqual(safeCodeLocation(`${o}/assets/secret-Ab12cd34.js`,42,o),{source:null,line:null});
 assert.deepEqual(safeCodeLocation(`${o}/assets/index-Ab12cd34.js`,0,o),{source:'index-Ab12cd34.js',line:null});
});
