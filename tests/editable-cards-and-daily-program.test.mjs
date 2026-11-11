import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('Repas, Activites, Personnel cards are modifiable and Repas/Activités du jour + crisp action icons render properly', async () => {
  process.env.VITE_ARENA_DEMO = 'false';
  globalThis.__rawdatiSupabaseClient__ = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        like: async () => ({ data: [], error: null }),
      }),
    }),
  };

  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
  });
  for (const key of [
    'window',
    'document',
    'navigator',
    'localStorage',
    'sessionStorage',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'MutationObserver',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ]) {
    if (key in dom.window) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        value: ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key)
          ? dom.window[key].bind(dom.window)
          : dom.window[key],
      });
    }
  }
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  window.scrollTo = () => {};
  const rafTimers = new Set();
  const customRaf = (cb) => {
    const id = setTimeout(() => {
      rafTimers.delete(id);
      cb(Date.now());
    }, 16);
    id.unref?.();
    rafTimers.add(id);
    return id;
  };
  const customCaf = (id) => {
    clearTimeout(id);
    rafTimers.delete(id);
  };
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, writable: true, value: customRaf });
  Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, writable: true, value: customRaf });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, writable: true, value: customCaf });
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, writable: true, value: customCaf });

  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  let root;

  try {
    const { createRoot } = await import('react-dom/client');
    await server.ssrLoadModule('/src/i18n.ts');
    const { LanguageProvider } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const { ConfirmProvider } = await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const { DemoProviders } = await server.ssrLoadModule('/src/demo/DemoProviders.tsx');
    const { default: Repas } = await server.ssrLoadModule('/src/components/Repas.tsx');
    const { default: Activites } = await server.ssrLoadModule('/src/components/Activites.tsx');
    const { default: Personnel } = await server.ssrLoadModule('/src/components/Personnel.tsx');
    const { default: Dashboard } = await server.ssrLoadModule('/src/components/Dashboard.tsx');
    const { default: Paiements } = await server.ssrLoadModule('/src/components/Paiements.tsx');

    const wait = (ms = 140) => new Promise((r) => setTimeout(r, ms));
    const click = (el) => {
      assert.ok(el, 'Expected clickable element');
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    };
    const setVal = (el, val) => {
      assert.ok(el, 'Expected input/textarea element');
      const proto =
        el.tagName === 'TEXTAREA'
          ? dom.window.HTMLTextAreaElement.prototype
          : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    root = createRoot(document.getElementById('root'));
    root.render(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(
          ToastProvider,
          null,
          React.createElement(
            ConfirmProvider,
            null,
            React.createElement(
              DemoProviders,
              null,
              React.createElement(
                'div',
                null,
                React.createElement('section', { id: 'dash' }, React.createElement(Dashboard, { onNavigate: () => {} })),
                React.createElement('section', { id: 'meals' }, React.createElement(Repas)),
                React.createElement('section', { id: 'acts' }, React.createElement(Activites)),
                React.createElement('section', { id: 'staff' }, React.createElement(Personnel)),
                React.createElement('section', { id: 'pay' }, React.createElement(Paiements)),
              ),
            ),
          ),
        ),
      ),
    );
    await wait(220);

    // 1. Dashboard displays Repas du jour & Activités du jour with real dishes & workshops
    const dashText = document.querySelector('#dash').textContent;
    assert.match(dashText, /Repas & Activités du jour/);
    assert.match(dashText, /Repas du jour/);
    assert.match(dashText, /Activités du jour/);

    // 2. Repas card is modifiable via Modifier button -> updates meal & Dashboard immediately
    assert.match(document.querySelector('#meals').textContent, /Repas du jour/);
    const editMealBtn = [...document.querySelectorAll('#meals button')].find((b) =>
      (b.getAttribute('aria-label') || '').includes('Modifier le repas'),
    );
    click(editMealBtn);
    await wait();
    assert.match(document.querySelector('#meals').textContent, /Modifier le repas/);
    const mealTextarea = document.querySelector('#meals textarea');
    setVal(mealTextarea, 'Tajine doux poulet & légumes bio du chef');
    await wait(60);
    const saveMealBtn = [...document.querySelectorAll('#meals button')].find((b) =>
      b.textContent.includes('Enregistrer'),
    );
    click(saveMealBtn);
    await wait(160);
    assert.match(document.querySelector('#meals').textContent, /Tajine doux poulet & légumes bio du chef/);

    // 3. Activites card is modifiable via Modifier button
    assert.match(document.querySelector('#acts').textContent, /Activités du jour/);
    const editActBtn = [...document.querySelectorAll('#acts button')].find((b) =>
      (b.getAttribute('aria-label') || '').includes('Modifier l’activité'),
    );
    click(editActBtn);
    await wait();
    assert.match(document.querySelector('#acts').textContent, /Modifier l’atelier éducatif/);
    const actTitleInput = document.querySelector('#acts input[placeholder^="Ex: Pâte"]');
    setVal(actTitleInput, 'Atelier poterie argile douce');
    await wait(60);
    const saveActBtn = [...document.querySelectorAll('#acts button')].find((b) =>
      b.textContent.includes('Enregistrer'),
    );
    click(saveActBtn);
    await wait(160);
    assert.match(document.querySelector('#acts').textContent, /Atelier poterie argile douce/);

    // 4. Personnel card is modifiable via Modifier button
    const editStaffBtn = [...document.querySelectorAll('#staff button')].find((b) =>
      (b.getAttribute('aria-label') || '').includes('Modifier le membre'),
    );
    click(editStaffBtn);
    await wait();
    assert.match(document.querySelector('#staff').textContent, /Modifier le dossier personnel/);
    const staffTelInput = document.querySelector('#staff input[type="tel"]');
    setVal(staffTelInput, '0550112233');
    await wait(60);
    const saveStaffBtn = [...document.querySelectorAll('#staff button')].find((b) =>
      b.textContent.includes('Enregistrer'),
    );
    click(saveStaffBtn);
    await wait(160);
    assert.match(document.querySelector('#staff').textContent, /0550112233/);

    // 5. Paiements table action buttons use fixed h-8 w-8 shrink-0 so icons never crush
    const viewInvoiceBtn = document.querySelector('#pay button[aria-label="Voir l’état de la facture"]');
    assert.ok(viewInvoiceBtn, 'Expected invoice view action button');
    assert.match(viewInvoiceBtn.className, /h-8/);
    assert.match(viewInvoiceBtn.className, /w-8/);
    assert.match(viewInvoiceBtn.className, /shrink-0/);
  } finally {
    root?.unmount();
    for (const id of rafTimers) clearTimeout(id);
    rafTimers.clear();
    await server.close();
    dom.window.close();
    delete globalThis.__rawdatiSupabaseClient__;
    process.env.VITE_ARENA_DEMO = 'false';
  }
});
