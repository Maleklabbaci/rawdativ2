import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeParentAccessTransfer, decodeParentAccessTransfer } from '../src/utils/parentAccessClipboard';
test('temporary access is scoped to the same site and legacy manual codes still work', () => {
  const token = 'a'.repeat(64);
  const origin = 'https://rawdhaplus.vercel.app';
  const value = encodeParentAccessTransfer(token, origin);
  assert.equal(decodeParentAccessTransfer(value, origin), token);
  assert.equal(decodeParentAccessTransfer(value, 'https://preview.example'), null);
  assert.equal(decodeParentAccessTransfer(token, origin), token);
  assert.equal(decodeParentAccessTransfer('other clipboard contents', origin), null);
  assert.equal(decodeParentAccessTransfer(value + '\nextra', origin), null);
  assert.throws(() => encodeParentAccessTransfer('bad', origin));
});
