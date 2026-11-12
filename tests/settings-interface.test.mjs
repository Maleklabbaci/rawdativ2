import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('settings expose 1 900 DA subscription and card/WhatsApp options without dead placeholders', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3000', pretendToBeVisual: true });
  for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    if (key in dom.window) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        value: ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key)
          ? dom.window[key].bind(dom.window)
          : dom.window[key],
      });
    }
  }
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  globalThis.__rawdatiSupabaseClient__ = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  let root;
  try {
    const { createRoot } = await import('react-dom/client');
    await server.ssrLoadModule('/src/i18n.ts');
    const { LanguageProvider, useLanguage } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx');
    const { ConfirmProvider } = await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const { default: Parametres } = await server.ssrLoadModule('/src/components/Parametres.tsx');
    let setLanguage;
    const director = { id: 'director', role: 'directeur', approvalStatus: 'approved', prenom: 'A', nom: 'B', email: 'demo@example.invalid', nomCreche: 'Fictive' };
    function Harness({ role }) {
      setLanguage = useLanguage().setLanguage;
      return React.createElement(
        AuthContext.Provider,
        { value: { user: { ...director, role }, creche: { nom: 'Fictive' }, refreshCreche: async () => {}, updateProfile: async () => {} } },
        React.createElement(Parametres)
      );
    }
    const render = role => root.render(React.createElement(LanguageProvider, null, React.createElement(ConfirmProvider, null, React.createElement(Harness, { role }))));
    const wait = () => new Promise(resolve => setTimeout(resolve, 180));
    root = createRoot(document.getElementById('root'));
    render('directeur');
    await wait();
    const text = () => document.body.textContent.replace(/\s+/g, ' ');
    assert.equal([...document.querySelectorAll('span')].filter(s => s.textContent === 'Non disponible').length, 0);
    assert.match(text(), /1[\s\u202f\u00a0]?900 DA/);
    assert.match(text(), /Gérer \/ Renouveler mon abonnement/);
    assert.doesNotMatch(text(), /Renouveler \(BaridiMob \/ CCP\)/);
    assert.match(text(), /Sonnerie des notifications/);

    setLanguage('ar');
    await wait();
    assert.equal(document.documentElement.dir, 'rtl');
    assert.equal([...document.querySelectorAll('span')].filter(s => s.textContent === 'غير متاح').length, 0);
    assert.doesNotMatch(text(), /تجديد الاشتراك \(بريدي موب \/ CCP\)/);
    assert.match(text(), /الاشتراك/);

    setLanguage('fr');
    render('admin');
    await wait();
    assert.equal([...document.querySelectorAll('span')].filter(s => s.textContent === 'Non disponible').length, 0);
    assert.match(text(), /Offre publique & encaissement/);
    assert.match(text(), /CIB \/ Edahabia/);
    assert.match(text(), /WhatsApp/);
    assert.doesNotMatch(text(), /RIP BaridiMob/);
  } finally {
    root?.unmount();
    await server.close();
    dom.window.close();
    delete globalThis.__rawdatiSupabaseClient__;
  }
});
