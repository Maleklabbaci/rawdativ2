import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { installUnsavedFormGuard } from '../src/utils/unsavedFormGuard.ts';

test('warns for unsaved form changes without storing values; reset and removal clear the warning', () => {
  const dom = new JSDOM('<form><input value="initial"><input type="password"><button>Save</button></form>', { url: 'https://example.test' });
  const win = dom.window;
  const saved = {};
  for (const key of ['HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','HTMLFormElement']) { saved[key] = globalThis[key]; globalThis[key] = win[key]; }
  const cleanup = installUnsavedFormGuard(win.document, win);
  try {
    const field = win.document.querySelector('input');
    const unload = () => { const event = new win.Event('beforeunload', { cancelable: true }); win.dispatchEvent(event); return event.defaultPrevented; };
    assert.equal(unload(), false);
    field.dispatchEvent(new win.FocusEvent('focusin', { bubbles: true }));
    field.value = 'modified'; field.dispatchEvent(new win.Event('input', { bubbles: true }));
    assert.equal(unload(), true);
    field.value = 'initial'; field.dispatchEvent(new win.Event('input', { bubbles: true }));
    assert.equal(unload(), false);
    field.value = 'again'; field.dispatchEvent(new win.Event('input', { bubbles: true }));
    win.document.querySelector('form').reset();
    assert.equal(unload(), false);
    field.value = 'again'; field.dispatchEvent(new win.Event('input', { bubbles: true }));
    win.document.querySelector('form').remove();
    assert.equal(unload(), false);
  } finally { cleanup(); for (const key of Object.keys(saved)) globalThis[key] = saved[key]; win.close(); }
});
