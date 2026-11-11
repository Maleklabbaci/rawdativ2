import { test } from 'node:test';
import assert from 'node:assert/strict';
import { departureConfirmed, departureTimeValid, departureNeedsRecheck, pickupContacts } from '../src/utils/departure.ts';
import type { Enfant, Presence } from '../src/types.ts';

const present: Presence = { id: 'presence-1', enfantId: 'child-1', date: '2026-11-08', statut: 'Présent', heureArrivee: '08:30', heureDepart: '16:30', personneRecuperation: 'Nadia Exemple' };

test('old or incomplete departure data is not a manual confirmation', () => {
  assert.equal(departureConfirmed(present), false);
  assert.equal(departureConfirmed({ ...present, departVerifie: true }), false);
  assert.equal(departureConfirmed({ ...present, departVerifie: true, departVerifiePar: 'director', departVerifieLe: '2026-11-08T16:30:00Z' }), true);
  assert.equal(departureConfirmed({ ...present, statut: 'Absent justifié', departVerifie: true, departVerifiePar: 'director', departVerifieLe: '2026-11-08T16:30:00Z' }), false);
  assert.equal(departureConfirmed({ ...present, heureDepart: '07:00', departVerifie: true, departVerifiePar: 'director', departVerifieLe: '2026-11-08T16:30:00Z' }), false);
});

test('departure time requires valid times and must follow arrival', () => {
  assert.equal(departureTimeValid('08:30', '16:30'), true);
  assert.equal(departureTimeValid('08:30', '08:30'), false);
  assert.equal(departureTimeValid('08:30', '07:30'), false);
  assert.equal(departureTimeValid('', '16:30'), false);
  assert.equal(departureTimeValid('99:00', '99:59'), false);
});

test('contacts are candidates and retain their emergency-contact distinction', () => {
  const child = { parents: [{ id: '1', prenom: 'Nadia', nom: 'Exemple', lien: 'Mère' }], contactsUrgence: [{ id: '2', nom: 'Samir Exemple', lien: 'Tuteur' }] } as Enfant;
  const contacts = pickupContacts(child);
  assert.deepEqual(contacts.map(({ id, kind }) => ({ id, kind })), [{ id: 'parent-1', kind: 'parent' }, { id: 'contact-2', kind: 'emergency' }]);
  assert.deepEqual(pickupContacts({ parents: [], contactsUrgence: [] } as unknown as Enfant), []);
});


test('changing a presence status or time requires checking the departure again', () => {
  assert.equal(departureNeedsRecheck(undefined, '08:30', '16:30'), false);
  assert.equal(departureNeedsRecheck(present, '08:30', '16:30'), false);
  assert.equal(departureNeedsRecheck(present, '08:40', '16:30'), true);
  assert.equal(departureNeedsRecheck(present, '08:30', ''), true);
  assert.equal(departureNeedsRecheck({ ...present, statut: 'Absent justifié' }, '08:30', '16:30'), true);
});
