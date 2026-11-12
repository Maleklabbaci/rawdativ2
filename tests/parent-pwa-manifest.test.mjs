import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

test('server sends the parent manifest in the initial HTML before any script runs', () => {
 const parent = JSON.parse(fs.readFileSync('public/manifest-parent.webmanifest','utf8'));
 const director = JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));
 assert.equal(parent.id, '/espace-parent');
 assert.equal(parent.start_url, '/espace-parent');
 assert.ok(parent.start_url.startsWith(parent.scope));
 assert.notEqual(parent.id, director.id);
 for (const [filename, expected] of [['parent.html','/manifest-parent.webmanifest'], ['index.html','/manifest.webmanifest']]) {
  const html = fs.readFileSync(filename,'utf8');
  const dom = new JSDOM(html, {url:'https://example.invalid/espace-parent'});
  const links = dom.window.document.querySelectorAll('link[rel=manifest]');
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute('href'), expected);
  dom.window.close();
 }
 const config = JSON.parse(fs.readFileSync('vercel.json','utf8'));
 const parentRoute = config.rewrites.findIndex(r => r.source === '/espace-parent' && r.destination === '/parent.html');
 const fallback = config.rewrites.findIndex(r => r.source === '/(.*)');
 assert.ok(parentRoute >= 0 && parentRoute < fallback);
 assert.ok(config.headers.some(h => h.source === '/manifest-parent.webmanifest' && h.headers.some(v => v.key === 'Cache-Control' && v.value.includes('no-store'))));
});
