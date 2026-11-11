import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updatePrimaryParent } from '../src/utils/childProfile.ts';

test('editing the primary parent keeps all other parents unchanged', () => {
  const original = [
    { id: 'p1', nom: 'A', prenom: 'Nadia', lien: 'Mère' as const, telephone: '1' },
    { id: 'p2', nom: 'B', prenom: 'Samir', lien: 'Père' as const, telephone: '2' },
  ];
  const primary = { ...original[0], telephone: '3' };
  const result = updatePrimaryParent(original, primary);
  assert.deepEqual(result, [primary, original[1]]);
  assert.equal(original[0].telephone, '1');
  assert.deepEqual(updatePrimaryParent([], primary), [primary]);
});
