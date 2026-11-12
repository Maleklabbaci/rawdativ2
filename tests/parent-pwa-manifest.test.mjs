import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

test('parent and director installations have separate identities and parent opens parent page', () => {
 const parent = JSON.parse(fs.readFileSync('public/manifest-parent.webmanifest','utf8'));
 const director = JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));
 assert.equal(parent.id, '/espace-parent');
 assert.equal(parent.start_url, '/espace-parent');
 assert.ok(parent.start_url.startsWith(parent.scope));
 assert.notEqual(parent.id, director.id);
 const html = fs.readFileSync('index.html','utf8');
 for (const [path, expected] of [['/espace-parent?creche=example','/manifest-parent.webmanifest'], ['/dashboard','/manifest.webmanifest']]) {
  const dom = new JSDOM(html, {url:`https://example.invalid${path}`,runScripts:'dangerously'});
  assert.equal(dom.window.document.querySelector('link[rel=manifest]').getAttribute('href'), expected);
  dom.window.close();
 }
});
