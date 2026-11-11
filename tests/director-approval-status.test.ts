import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directorApprovalStatus } from '../src/utils/directorApproval';

test('only an explicit approved status unlocks director data in the client', () => {
  assert.equal(directorApprovalStatus('approved'), 'approved');
  for (const value of ['pending', undefined, null, '', 'Approved', 'unknown', true]) {
    assert.equal(directorApprovalStatus(value), 'pending');
  }
});
