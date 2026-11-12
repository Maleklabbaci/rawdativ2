import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseParentInviteLink } from '../src/utils/parentInviteLink';

test('only a personal invitation on this exact origin and path can be opened', () => {
 const token = 'a'.repeat(64);
 const origin = 'https://rawdha.example';
 const link = `${origin}/espace-parent?creche=abc&nom=Creche#enfant=${token}`;
 assert.equal(parseParentInviteLink(link, origin), `/espace-parent?creche=abc&nom=Creche#enfant=${token}`);
 for (const bad of [`https://evil.example/espace-parent?creche=abc#enfant=${token}`, `${origin}/espace-parent?creche=abc`, `${origin}/espace-parent#enfant=${token}`, `${origin}/login?creche=abc#enfant=${token}`, 'javascript:alert(1)', `${origin}/espace-parent?creche=abc#enfant=bad`]) assert.equal(parseParentInviteLink(bad, origin), null);
});
