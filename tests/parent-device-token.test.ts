import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secureParentDeviceToken } from '../src/utils/parentDeviceToken';

test('device credentials require secure randomness and durable storage without overwriting old tokens', () => {
  let value: string | null = null;
  const store = {getItem: () => value, setItem: (_: string,v: string) => { value=v; }};
  const cryptoMock = {getRandomValues: <T extends ArrayBufferView | null>(bytes: T): T => { if (bytes instanceof Uint8Array) bytes.fill(171); return bytes; }};
  assert.equal(secureParentDeviceToken(store, undefined), '');
  const token = secureParentDeviceToken(store, cryptoMock);
  assert.equal(token, `ptok_${'ab'.repeat(16)}`);
  assert.equal(secureParentDeviceToken(store, undefined), token);
  value = 'ptok_mem_123456789';
  assert.equal(secureParentDeviceToken(store, cryptoMock), '');
  assert.equal(value, 'ptok_mem_123456789');
  assert.equal(secureParentDeviceToken({getItem: () => null, setItem: () => {throw new Error('blocked');}}, cryptoMock), '');
  assert.equal(secureParentDeviceToken({getItem: () => null, setItem: () => {}}, cryptoMock), '');
});
