import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presenceFormValues, validatePresenceDetails } from '../src/utils/presence.ts';

test('new and incomplete records do not invent observations', () => {
  assert.deepEqual(presenceFormValues(), { heureArrivee: '', heureDepart: '', temperature: '', repas: '', humeur: '' });
  assert.equal(presenceFormValues({ id: '1', enfantId: '1', date: '2026-11-08', statut: 'Présent', heureArrivee: '08:20' }).heureDepart, '');
});

test('arrival required but departure and observations can be recorded later', () => {
  const details = presenceFormValues();
  assert.equal(validatePresenceDetails(details), 'arrival');
  assert.equal(validatePresenceDetails({ ...details, heureArrivee: '08:20' }), null);
  assert.equal(validatePresenceDetails({ ...details, heureArrivee: '08:20', heureDepart: '08:19' }), 'departure');
  assert.equal(validatePresenceDetails({ ...details, heureArrivee: '08:20', heureDepart: '16:30', temperature: '36,5' }), null);
  assert.equal(validatePresenceDetails({ ...details, heureArrivee: '08:20', temperature: 'invalid' }), 'temperature');
});
