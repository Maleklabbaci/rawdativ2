import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDiagnostic } from '../src/utils/diagnosticCategories';
test('error classifications use only approved categories and never return sensitive messages',()=>{
 assert.equal(classifyDiagnostic({code:'42501',message:'secret patient'}),'permission');
 assert.equal(classifyDiagnostic({message:'Failed to fetch token=secret'}),'network');
 assert.equal(classifyDiagnostic({code:'23505'}),'conflict');
 assert.equal(classifyDiagnostic(new TypeError('private data')),'type_error');
 assert.equal(classifyDiagnostic({message:'adresse privée'}),'unknown');
});
