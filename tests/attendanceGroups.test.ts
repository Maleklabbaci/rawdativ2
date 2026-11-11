import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attendanceChildren, groupAttendanceChildren } from '../src/utils/attendanceGroups.ts';
import type { Enfant, Classe, Presence } from '../src/types.ts';

const child = (id: string, statut: Enfant['statut'] = 'Actif') => ({ id, statut }) as Enfant;
const record = (enfantId: string) => ({ id: enfantId, enfantId, date: '2026-11-08', statut: 'Présent' }) as Presence;
const classe = (id: string, childrenIds: string[]) => ({ id, nom: id, niveau: 'Bébés', capacite: 12, childrenIds }) as Classe & { childrenIds: string[] };

test('newly admitted children can be pointed even without a class', () => {
  const groups = groupAttendanceChildren([child('a'), child('b')], [classe('c1', ['a'])]);
  assert.deepEqual(groups.map(g => [g.key, g.children.map(c => c.id)]), [['class:c1', ['a']], ['unassigned', ['b']]]);
  assert.deepEqual(groupAttendanceChildren([child('a')], []).map(g => g.children[0].id), ['a']);
});

test('inactive children do not block a day, but existing history remains visible', () => {
  const children = [child('active'), child('old', 'Inactif')];
  assert.deepEqual(attendanceChildren(children, []).map(c => c.id), ['active']);
  assert.deepEqual(attendanceChildren(children, [record('old')]).map(c => c.id), ['active', 'old']);
});

test('empty or stale class membership does not hide children', () => {
  const groups = groupAttendanceChildren([child('a')], [classe('c', ['deleted'])]);
  assert.equal(groups[0].children.length, 0);
  assert.equal(groups[1].children[0].id, 'a');
});
