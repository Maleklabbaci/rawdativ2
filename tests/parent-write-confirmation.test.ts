import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireConfirmedParentWrite } from '../src/utils/parentWriteConfirmation';

test('parent decision or announcement requires a confirmed row', async () => {
  await assert.rejects(requireConfirmedParentWrite(Promise.resolve({data:null,error:null})), /non confirmé/);
  await assert.rejects(requireConfirmedParentWrite(Promise.resolve({data:{id:'a'},error:'denied'})), /non confirmé/);
  await assert.rejects(requireConfirmedParentWrite(Promise.reject(new Error('network'))), /network/);
  await requireConfirmedParentWrite(Promise.resolve({data:{id:'a'},error:null}));
});
