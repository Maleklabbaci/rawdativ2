import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('mobile workflow ease: batch monthly invoices, quick search, 1-tap attendance time/motif, pickup prefill and mobile cards', async () => {
  process.env.VITE_ARENA_DEMO = 'false';
  globalThis.__rawdatiSupabaseClient__ = {};
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
    'KeyboardEvent',
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
  let mobileMatch = true;
  window.matchMedia = query => ({
    matches: query.includes('max-width') ? mobileMatch : false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  window.scrollTo = () => {};

  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  let root;
  try {
    const { createRoot } = await import('react-dom/client');
    await server.ssrLoadModule('/src/i18n.ts');
    const { LanguageProvider, useLanguage } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const { ConfirmProvider } = await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx');
    const { DemoProviders } = await server.ssrLoadModule('/src/demo/DemoProviders.tsx');
    const { DbContext, useDb } = await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const { default: Paiements } = await server.ssrLoadModule('/src/components/Paiements.tsx');
    const { default: Presences } = await server.ssrLoadModule('/src/components/Presences.tsx');
    const { default: PickupAuthorizations } = await server.ssrLoadModule('/src/components/PickupAuthorizations.tsx');
    const { default: QuickSearchModal } = await server.ssrLoadModule('/src/components/QuickSearchModal.tsx');

    const createdInvoices = [];
    let openedDossierChild = null;
    let setLanguage;

    function Harness() {
      const db = useDb();
      setLanguage = useLanguage().setLanguage;

      const children = [
        {
          id: 'c-ready',
          crecheId: 'director-1',
          prenom: 'Yasmine',
          nom: 'Merabet',
          genre: 'Fille',
          groupeAge: 'Moyens',
          statut: 'Actif',
          dateNaissance: '2023-03-10',
          dateInscription: '2025-09-01',
          parents: [{ id: 'p1', prenom: 'Karim', nom: 'Merabet', lien: 'Père', telephone: '0550118899' }],
        },
        {
          id: 'c-covered',
          crecheId: 'director-1',
          prenom: 'Adam',
          nom: 'Saidi',
          genre: 'Garçon',
          groupeAge: 'Grands',
          statut: 'Actif',
          dateNaissance: '2022-06-15',
          dateInscription: '2025-09-01',
          parents: [{ id: 'p2', prenom: 'Sara', nom: 'Saidi', lien: 'Mère', telephone: '0661223344' }],
        },
        {
          id: 'c-blocked',
          crecheId: 'director-1',
          prenom: 'Ines',
          nom: 'Boudiaf',
          genre: 'Fille',
          groupeAge: 'Bébés',
          statut: 'Actif',
          dateNaissance: '2024-01-20',
          dateInscription: '2025-09-01',
          parents: [],
        },
      ];

      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

      const [invoices, setInvoices] = React.useState([
        {
          id: 'inv-covered',
          enfantId: 'c-covered',
          montant: 13000,
          statut: 'En attente',
          typeFacture: 'Mensuel',
          moisConcerne: currentMonth,
          periodeCle: `M:${currentMonth}`,
        },
        {
          id: 'inv-legacy-unreviewed',
          enfantId: 'c-blocked',
          montant: 11000,
          statut: 'En attente',
          typeFacture: 'Mensuel',
          moisConcerne: 'Printemps 2025',
          periodeCle: null,
        },
      ]);

      return React.createElement(
        AuthContext.Provider,
        {
          value: {
            user: { id: 'director-1', role: 'directeur', approvalStatus: 'approved', prenom: 'Amel', nom: 'Kaci' },
            creche: { id: 'director-1', nom: 'Crèche El Yasmine', adresse: 'Blida', tuitionFeeRate: 13000 },
            loading: false,
          },
        },
        React.createElement(
          DbContext.Provider,
          {
            value: {
              ...db,
              enfants: children,
              classes: [{ id: 'cls-1', crecheId: 'director-1', nom: 'Les Étoiles', niveau: 'Moyens', capacite: 15, childrenIds: ['c-ready', 'c-covered'] }],
              paiements: invoices,
              presences: [],
              financialDataReady: true,
              listPickupAuthorizations: async () => [],
              addPaiement: async payload => {
                createdInvoices.push(payload);
                setInvoices(prev => [...prev, { id: `new-${prev.length}`, ...payload }]);
                return `new-${createdInvoices.length}`;
              },
            },
          },
          React.createElement(
            React.Fragment,
            null,
            React.createElement('div', { id: 'paiements' }, React.createElement(Paiements)),
            React.createElement('div', { id: 'presences' }, React.createElement(Presences)),
            React.createElement('div', { id: 'pickup' }, React.createElement(PickupAuthorizations, { childId: 'c-ready' })),
            React.createElement(
              'div',
              { id: 'search' },
              React.createElement(QuickSearchModal, {
                isOpen: true,
                onClose() {},
                onNavigate() {},
                onOpenChildDossier: child => {
                  openedDossierChild = child;
                },
              })
            )
          )
        )
      );
    }

    root = createRoot(document.getElementById('root'));
    root.render(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(
          ToastProvider,
          null,
          React.createElement(ConfirmProvider, null, React.createElement(DemoProviders, null, React.createElement(Harness)))
        )
      )
    );

    const wait = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));
    const click = el => {
      assert.ok(el);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    };
    const setInput = (el, value) => {
      assert.ok(el);
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    await wait(160);

    // 1. Mobile viewport renders vertical invoice cards (no table) + Batch Monthly Invoices modal works safely
    const paiementsScope = document.querySelector('#paiements');
    assert.equal(paiementsScope.querySelectorAll('table').length, 0, 'Sur téléphone, Factures utilise des cartes verticales');
    click([...paiementsScope.querySelectorAll('button')].find(b => b.textContent.includes('Préparer le mois')));
    await wait();
    assert.match(paiementsScope.textContent, /Facture déjà créée/);
    assert.match(paiementsScope.textContent, /Ancienne facture à rapprocher d’abord/);
    assert.match(paiementsScope.textContent, /1 enfant\(s\) sélectionné\(s\) sur 3 actif\(s\)/);
    click([...paiementsScope.querySelectorAll('button')].find(b => b.textContent.includes('Créer 1 facture(s)')));
    await wait(160);
    assert.equal(createdInvoices.length, 1);
    assert.equal(createdInvoices[0].enfantId, 'c-ready');
    assert.equal(createdInvoices[0].montant, 13000);
    assert.match(createdInvoices[0].periodeCle, /^M:\d{4}-\d{2}$/);

    // 2. QuickSearchModal finds child by partial phone digits and opens dossier in 1 tap
    const searchScope = document.querySelector('#search');
    const searchInput = searchScope.querySelector('input[type="text"]');
    setInput(searchInput, '8899');
    await wait();
    assert.match(searchScope.textContent, /Yasmine Merabet/);
    assert.doesNotMatch(searchScope.textContent, /Adam Saidi/);
    assert.ok(searchScope.querySelector('a[href="tel:0550118899"]'));
    click([...searchScope.querySelectorAll('button')].find(b => b.textContent.trim() === 'Dossier'));
    assert.equal(openedDossierChild?.id, 'c-ready');

    // 3. PickupAuthorizations 1-tap parent prefill keeps document reference & attestation mandatory
    const pickupScope = document.querySelector('#pickup');
    click([...pickupScope.querySelectorAll('button')].find(b => b.textContent.includes('Karim Merabet')));
    await wait();
    const pickupInputs = [...pickupScope.querySelectorAll('input:not([type="checkbox"])')];
    assert.equal(pickupInputs[0].value, 'Karim Merabet');
    assert.equal(pickupInputs[1].value, 'Père');
    assert.equal(pickupInputs[2].value, '0550118899');
    assert.equal(pickupInputs[3].value, '');
    const savePickupBtn = [...pickupScope.querySelectorAll('button')].find(b => b.textContent.includes('Enregistrer la déclaration'));
    assert.equal(savePickupBtn.disabled, true);

    // 4. Presences: filter "À pointer" auto-expands classes, and "Maintenant" fills HH:MM in 1 tap
    const presencesScope = document.querySelector('#presences');
    click([...presencesScope.querySelectorAll('button')].find(b => b.textContent.includes('À pointer')));
    await wait();
    const presentBtn = [...presencesScope.querySelectorAll('button')].find(b => b.textContent.trim() === 'Présent');
    assert.ok(presentBtn, 'Le filtre À pointer déplie automatiquement les classes concernées');
    click(presentBtn);
    await wait();
    const arrivalInput = presencesScope.querySelector('input[type="time"]');
    assert.equal(arrivalInput.value, '');
    click([...presencesScope.querySelectorAll('button')].find(b => b.textContent.trim() === 'Maintenant'));
    await wait();
    assert.match(arrivalInput.value, /^\d{2}:\d{2}$/);

    // Verify Arabic labels on mobile too
    setLanguage('ar');
    await wait(160);
    assert.match(presencesScope.textContent, /الآن/);
    assert.match(paiementsScope.textContent, /تحضير فواتير الشهر/);
  } finally {
    root?.unmount();
    await server.close();
    dom.window.close();
    delete globalThis.__rawdatiSupabaseClient__;
  }
});
