import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('Comptes and AdminCenter respect Arabic RTL, avoid invented 3500 DA tariff, guard double-submit and neutralize CSV formulas', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3000', pretendToBeVisual: true });
  for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'Blob']) {
    if (key in dom.window) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        value: ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key],
      });
    }
  }
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.scrollTo = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () {};
  localStorage.setItem('rawdha_language', 'ar');
  let capturedCsv = '';
  const origBlob = globalThis.Blob;
  globalThis.Blob = class extends origBlob {
    constructor(parts, opts) {
      super(parts, opts);
      capturedCsv = parts.join('');
    }
  };
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = () => {};

  let insertedRows = [];
  globalThis.__rawdatiSupabaseClient__ = {
    from: (table) => ({
      insert: async (payload) => {
        insertedRows.push({ table, payload });
        return { error: null };
      },
    }),
  };

  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  let root;
  try {
    const { createRoot } = await import('react-dom/client');
    await server.ssrLoadModule('/src/i18n.ts');
    const { LanguageProvider } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const { ToastContainer } = await server.ssrLoadModule('/src/components/ToastContainer.tsx');
    const { ConfirmProvider } = await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx');
    const { DbContext } = await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const { default: Comptes } = await server.ssrLoadModule('/src/components/Comptes.tsx');
    const { default: AdminCenter } = await server.ssrLoadModule('/src/components/AdminCenter.tsx');

    let addCompteCalls = 0;
    const db = {
      comptes: [
        { id: 'adm1', nom: 'Admin', prenom: 'Super', email: 'admin@rawdha.dz', role: 'admin', abonnementActif: true },
        { id: 'd1', nom: 'Khellaf', prenom: 'Amira', email: 'amira@rawdha.dz', role: 'directeur', nomCreche: '=2+2 Crèche', telephone: '+213555112233', abonnementActif: true, dateFinAbonnement: '2020-01-01', approvalStatus: 'approved' },
      ],
      enfants: [],
      demandesDirecteur: [
        { id: 'req1', nom: 'Benali', prenom: 'Nadia', email: 'nadia@rawdha.dz', telephone: '0555998877', nomCreche: 'روضة النور', adresse: 'البليدة', statut: 'en_attente', dateDemande: '2026-10-01T10:00:00Z' },
      ],
      messages: [],
      avis: [],
      signalements: [],
      communityPosts: [],
      communityFeatures: [],
      adminFollowups: [],
      adminAuditLogs: [],
      loading: false,
      addCompte: async () => {
        addCompteCalls++;
        await new Promise((r) => setTimeout(r, 40));
        return 'new-dir-1';
      },
      updateDirectorSubscription: async () => {},
      logAdminAction: async () => {},
      deleteCompte: async () => {},
      approveDemandeDirecteur: async () => 'acc-1',
      deleteDemandeDirecteur: async () => {},
      refreshAll: async () => {},
    };

    const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
    const button = (txt) => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes(txt) || (b.getAttribute('aria-label') || '').includes(txt));
    const click = (el) => { assert.ok(el, 'Expected clickable element'); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
    const set = (el, value) => {
      const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    root = createRoot(document.getElementById('root'));
    root.render(
      React.createElement(LanguageProvider, null,
        React.createElement(ToastProvider, null,
          React.createElement(ConfirmProvider, null,
            React.createElement(AuthContext.Provider, { value: { user: { id: 'adm1', role: 'admin', prenom: 'Super', nom: 'Admin' } } },
              React.createElement(DbContext.Provider, { value: db },
                React.createElement(React.Fragment, null,
                  React.createElement(Comptes),
                  React.createElement(AdminCenter, { onNavigate: () => {} }),
                  React.createElement(ToastContainer),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await wait();
    // Arabic translations in Comptes
    assert.match(document.body.textContent, /طلبات مدراء الروضات/);
    assert.match(document.body.textContent, /1 في الانتظار/);
    assert.match(document.body.textContent, /منتهي/);
    assert.match(document.body.textContent, /النظام/);
    assert.doesNotMatch(document.body.textContent, /Demandes de directeurs/);

    // Open Add Director form and verify tariff is NOT prefilled with '3500'
    click(button('إضافة مدير روضة'));
    await wait();
    const numberInput = document.querySelector('input[type="number"]');
    assert.ok(numberInput);
    assert.equal(numberInput.value, '');

    // Fill required fields ONLY (no tariff, no address) and verify no invented parametres row is inserted
    set(document.querySelector('input[placeholder*="أميرة"]'), 'سارة');
    set(document.querySelector('input[placeholder*="خلاف"]'), 'قاسمي');
    set(document.querySelector('input[type="email"]'), 'sara@rawdha.dz');
    set(document.querySelector('input[placeholder="••••••••"]'), 'Secret1234');
    set(document.querySelector('input[placeholder*="روضة الأزهار"]'), 'روضة الأمل');
    set(document.querySelector('input[placeholder="+213 5 55 12 34 56"]'), '0555123456');
    await wait(50);

    click(button('حفظ الحساب'));
    await wait(80);
    const confirmBtn = button('إنشاء الحساب');
    assert.ok(confirmBtn);
    click(confirmBtn);
    click(confirmBtn);
    await wait(120);
    assert.equal(addCompteCalls, 1, 'Double click must not create two director accounts');
    assert.equal(insertedRows.length, 0, 'Must not write parametres with invented tariff when optional fields are blank');

    // AdminCenter CSV export neutralizes leading '=' formula
    click(button('الروضات'));
    await wait(80);
    assert.ok(document.querySelector('button[aria-label="فتح الملف"]'), 'Icon action button must expose aria-label');
    click(document.querySelector('button[title="تصدير القائمة المفلترة"]'));
    await wait(50);
    assert.match(capturedCsv, /"'=2\+2 Crèche"/, 'CSV export must neutralize spreadsheet formulas');
  } finally {
    root?.unmount();
    await server.close();
    dom.window.close();
    globalThis.Blob = origBlob;
    delete globalThis.__rawdatiSupabaseClient__;
  }
});
