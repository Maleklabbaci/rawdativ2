import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCommunityNavigation, saveCommunityNavigation } from '../src/utils/communityNavigation';

test('restores connect navigation per user without sharing conversation state', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  saveCommunityNavigation('a', { view: 'messages', profileId: null, recipientId: 'b' }, storage);
  assert.deepEqual(loadCommunityNavigation('a', storage), { view: 'messages', profileId: null, recipientId: 'b' });
  assert.deepEqual(loadCommunityNavigation('b', storage), { view: 'feed', profileId: null, recipientId: null });
  data.set('rawdha_connect_navigation:a', '{bad json');
  assert.equal(loadCommunityNavigation('a', storage).view, 'feed');
  data.set('rawdha_connect_navigation:a', JSON.stringify({ view: 'profile', profileId: null }));
  assert.equal(loadCommunityNavigation('a', storage).view, 'feed');
});
