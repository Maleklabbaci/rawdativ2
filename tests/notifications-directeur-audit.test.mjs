import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('director notifications show actual messages, handle reading errors and clarify financial exclusions in FR/AR', async () => {
  process.env.VITE_ARENA_DEMO = 'false';
  globalThis.__rawdatiSupabaseClient__ = {};
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3000', pretendToBeVisual: true });
  for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    if (key in dom.window) Object.defineProperty(globalThis, key, { configurable: true, value: ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key] });
  }
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  let root;
  try {
    const { createRoot } = await import('react-dom/client');
    await server.ssrLoadModule('/src/i18n.ts');
    const { LanguageProvider, useLanguage } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const { ToastContainer } = await server.ssrLoadModule('/src/components/ToastContainer.tsx');
    const { ConfirmProvider } = await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const { DemoProviders } = await server.ssrLoadModule('/src/demo/DemoProviders.tsx');
    const { DbContext, useDb } = await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const { default: NotificationsDirecteur } = await server.ssrLoadModule('/src/components/NotificationsDirecteur.tsx');
    let setLanguage, setReady, setInvoices, setAnnouncements, resolveRead, rejectRead, calls = 0, navigated = 0;
    const announcement = { id: 'n1', title: 'Information siteweb', message: 'Message exact de la direction', recipientRole: 'all_directeurs', createdAt: 'invalid', readBy: [] };
    const invoice = (id, enfantId, statut = 'En attente') => ({ id, enfantId, montant: 1000, statut, typeFacture: 'Mensuel', moisConcerne: '2026-03', periodeCle: 'M:2026-03' });
    function Harness() {
      const db = useDb();
      const [ready, updateReady] = React.useState(true);
      const [items, setItems] = React.useState([announcement, { ...announcement, id: 'private', recipientRole: 'other', title: 'Privé' }]);
      const [invoices, updateInvoices] = React.useState([invoice('p1', 'demo-child-2', 'Retard'), invoice('p2', 'missing'), { ...invoice('p3', 'another'), periodeCle: undefined }, invoice('paid', 'demo-child-3', 'Payé')]);
      setReady = updateReady; setInvoices = updateInvoices; setAnnouncements = setItems; setLanguage = useLanguage().setLanguage;
      const mark = (id, userId) => { calls++; return new Promise((resolve, reject) => { resolveRead = () => { setItems(old => old.map(n => n.id === id ? { ...n, readBy: [userId] } : n)); resolve(); }; rejectRead = reject; }); };
      const value = { ...db, notifications: items, financialDataReady: ready, paiements: invoices, markNotificationRead: mark };
      return React.createElement(DbContext.Provider, { value }, React.createElement(React.Fragment, null, React.createElement(NotificationsDirecteur, { onNavigateToPaiements: () => { navigated++; } }), React.createElement(ToastContainer)));
    }
    root = createRoot(document.getElementById('root'));
    root.render(React.createElement(LanguageProvider, null, React.createElement(ToastProvider, null, React.createElement(ConfirmProvider, null, React.createElement(DemoProviders, null, React.createElement(Harness))))));
    const wait = () => new Promise(resolve => setTimeout(resolve, 150));
    const click = element => { assert.ok(element); element.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
    const button = text => [...document.querySelectorAll('button')].find(element => element.textContent.includes(text));
    await wait();
    assert.match(document.body.textContent, /Information siteweb/);
    assert.match(document.body.textContent, /Message exact de la direction/);
    assert.doesNotMatch(document.body.textContent, /Privé/);
    assert.doesNotMatch(document.body.textContent, /Yasmine/);
    assert.match(document.body.textContent, /Date non renseignée/);
    assert.match(document.body.textContent, /1 facture\(s\) non affichées/);
    assert.match(document.body.textContent, /1 facture\(s\) exclues des rappels/);
    click(button('Amine')); assert.equal(navigated, 1);
    const markButton = button('Marquer comme lue'); click(markButton); click(markButton); await wait();
    assert.equal(calls, 1); assert.equal(markButton.disabled, true); assert.match(document.body.textContent, /Enregistrement/);
    rejectRead(new Error('network')); await wait();
    assert.match(document.body.textContent, /Lecture non confirmée/); assert.match(document.body.textContent, /Non lue/);
    click(button('Marquer comme lue')); await wait(); resolveRead(); await wait();
    assert.match(document.body.textContent, /Lue/); assert.equal(button('Marquer comme lue'), undefined);
    setLanguage('ar'); await wait(); assert.equal(document.documentElement.dir, 'rtl'); assert.match(document.body.textContent, /متأخرة/); assert.match(document.body.textContent, /غير معروضة هنا/);
    setReady(false); await wait(); assert.doesNotMatch(document.body.textContent, /Amine/); assert.doesNotMatch(document.body.textContent, /غير معروضة هنا/);
    setReady(true); setInvoices([]); setAnnouncements([]); await wait(); assert.match(document.body.textContent, /لا توجد إعلانات/); assert.match(document.body.textContent, /لا توجد فواتير ظاهرة/);
  } finally {
    root?.unmount(); await server.close(); dom.window.close(); delete globalThis.__rawdatiSupabaseClient__;
  }
});
