import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInBatches } from '../src/utils/runInBatches.ts';

test('batch waits for every write and reports partial failures across batches', async () => {
  const completed: number[] = [];
  const failed = await runInBatches([1, 2, 3, 4], async (item) => {
    await new Promise(resolve => setTimeout(resolve, item === 1 ? 20 : 1));
    completed.push(item);
    if (item === 2 || item === 4) throw new Error('simulated write failure');
  }, 2);
  assert.deepEqual(failed, [2, 4]);
  assert.deepEqual(completed.slice().sort(), [1, 2, 3, 4]);
});

test('batch reports synchronous failures and rejects invalid batch sizes', async () => {
  const failed = await runInBatches([1, 2], (item) => {
    if (item === 1) throw new Error('failure');
    return Promise.resolve();
  });
  assert.deepEqual(failed, [1]);
  await assert.rejects(runInBatches([1], async () => {}, 0), /Invalid batch size/);
});
