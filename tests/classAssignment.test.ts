import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkClassAssignment } from '../src/utils/classAssignment.ts';
import type { Classe, Enfant } from '../src/types.ts';
const c = (id: string, ids: string[], capacity = 2) => ({ id, nom: id, niveau: 'Bébés', capacite: capacity, childrenIds: ids }) as Classe;
const child = (id: string, statut: Enfant['statut'] = 'Actif') => ({ id, statut }) as Enfant;
test('assignment respects capacity and avoids duplicate class membership', () => {
 const a = c('a', ['1']); const b = c('b', ['2']); const children = [child('1'), child('2'), child('3'), child('4')];
 assert.equal(checkClassAssignment(a, [a,b], children, ['3']), null);
 assert.equal(checkClassAssignment(a, [a,b], children, ['2']), 'assigned');
 assert.equal(checkClassAssignment(a, [a,b], children, ['3','4']), 'capacity');
 assert.equal(checkClassAssignment(a, [a,b], children, ['1']), 'invalid');
 assert.equal(checkClassAssignment(a, [a,b], children, ['missing']), 'invalid');
 assert.equal(checkClassAssignment(a, [a,b], [child('3','Inactif')], ['3']), 'invalid');
});
