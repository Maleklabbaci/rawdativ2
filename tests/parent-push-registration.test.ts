import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmParentPushRegistration } from '../src/utils/parentPushRegistration';

test('push is registered only after a real subscription and an affirmative RPC response', async () => {
  let calls = 0;
  const sub = { endpoint: 'https://push.example/test' };
  assert.equal(await confirmParentPushRegistration(null, async () => { calls++; return { data: {ok:true}, error:null }; }), false);
  assert.equal(calls, 0);
  assert.equal(await confirmParentPushRegistration(sub, async () => ({data: {ok:false}, error:null})), false);
  assert.equal(await confirmParentPushRegistration(sub, async () => ({data: null, error: 'error'})), false);
  assert.equal(await confirmParentPushRegistration(sub, async () => {throw new Error('network');}), false);
  assert.equal(await confirmParentPushRegistration(sub, async () => ({data: {ok:true}, error:null})), true);
});
