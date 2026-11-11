import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentedText, mealAppliesOnDate } from '../src/utils/mealSafety';

test('dated and weekly meals appear on the correct day without invented defaults', () => {
  assert.equal(mealAppliesOnDate({ jour: 'Dimanche' }, '2026-11-08'), true);
  assert.equal(mealAppliesOnDate({ jour: 'Samedi' }, '2026-11-14'), true);
  assert.equal(mealAppliesOnDate({ jour: 'Lundi' }, '2026-11-08'), false);
  assert.equal(mealAppliesOnDate({ date: '2026-11-08' }, '2026-11-08'), true);
  assert.equal(mealAppliesOnDate({ date: '2026-11-09', jour: 'Dimanche' }, '2026-11-08'), false);
  assert.equal(mealAppliesOnDate({}, '2026-11-08'), false);
  assert.equal(mealAppliesOnDate({ jour: 'Dimanche' }, '2026-02-30'), false);
  assert.equal(mealAppliesOnDate({ jour: 'Dimanche' }, 'not-a-date'), false);
});

test('missing information remains unknown and supplied free text is retained', () => {
  assert.equal(documentedText(undefined), null);
  assert.equal(documentedText('  '), null);
  assert.equal(documentedText('  Arachides  '), 'Arachides');
  assert.equal(documentedText('Aucun allergène'), 'Aucun allergène');
});
