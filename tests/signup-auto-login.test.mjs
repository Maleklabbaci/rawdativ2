import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('active registration attempts automatic login and reports a created account if it fails', () => {
  const source = readFileSync('src/components/SignIn.tsx', 'utf8');
  const registration = source.slice(source.indexOf('const handleSubmitRequest'), source.indexOf('const handleLogin'));
  assert.match(registration, /registration\?\.status === 'active'/);
  assert.match(registration, /loginWithCredentials\(directorEmail\.trim\(\)\.toLowerCase\(\), directorPassword\)/);
  assert.match(registration, /Votre compte est créé, mais la connexion automatique a échoué/);
  assert.match(registration, /busyRef\.current = true/);
  assert.match(registration, /busyRef\.current = false/);
});
