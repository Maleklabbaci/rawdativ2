import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importBatches } from '../src/utils/importBatches.ts';

test('an import waits for the whole batch and stops before sending more after a failure', async () => {
  const calls: number[] = [];
  const complete: number[] = [];
  const result = await importBatches([1, 2, 3, 4, 5], async n => {
    calls.push(n);
    await new Promise(resolve => setTimeout(resolve, n === 1 ? 20 : 1));
    complete.push(n);
    if (n === 2) throw new Error('outcome unknown');
  }, 3);
  assert.deepEqual(calls, [1, 2, 3]);
  assert.deepEqual(complete.slice().sort(), [1, 2, 3]);
  assert.deepEqual(result, { saved: [1, 3], unconfirmed: [2], notAttempted: [4, 5] });
});

test('a successful import reports every saved row and validates the batch size', async () => {
  assert.deepEqual(await importBatches([1, 2], async () => {}, 1), { saved: [1, 2], unconfirmed: [], notAttempted: [] });
  await assert.rejects(importBatches([1], async () => {}, 0), /Invalid batch size/);
});
