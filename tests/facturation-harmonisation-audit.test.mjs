import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('facturation UI and cross-screen harmonization handle missing children, payment methods, CSV export, RTL labels and attendance badges', async () => {
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
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  window.scrollTo = () => {};

  const anchorClickOrig = dom.window.HTMLAnchorElement.prototype.click;
  let lastDownloadName = '';
  dom.window.HTMLAnchorElement.prototype.click = function stubAnchorClick() {
    lastDownloadName = this.download || '';
  };
  let exportedBlobText = '';
  URL.createObjectURL = blob => {
    blob.text().then(content => {
      exportedBlobText = content;
    });
    return 'blob:facturation-export';
  };
  URL.revokeObjectURL = () => {};

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
    const { default: Facture } = await server.ssrLoadModule('/src/components/Facture.tsx');
    const { default: NotificationBell } = await server.ssrLoadModule('/src/components/NotificationBell.tsx');
    const { default: EnfantDetails } = await server.ssrLoadModule('/src/components/EnfantDetails.tsx');

    let setLanguage;
    let setRoleMode;
    let factureClosed = false;

    function Harness() {
      const db = useDb();
      const lang = useLanguage();
      setLanguage = lang.setLanguage;
      const [roleMode, changeRoleMode] = React.useState('admin');
      setRoleMode = changeRoleMode;

      const enrichedChild = {
        ...db.enfants[0],
        crecheId: 'director-1',
        medecinTraitant: 'Dr Benali',
        poidsKg: 14,
        vaccinations: 'DTCoq à jour',
        documentsRequis: {
          certificatMedical: true,
          carnetVaccination: false,
          justificatifDomicile: true,
          photoIdentite: false,
        },
      };
      const otherCrecheChild = {
        id: 'other-child',
        nom: 'Autre',
        prenom: 'Sami',
        crecheId: 'director-2',
        dateNaissance: '2022-04-01',
        dateInscription: '2025-09-01',
        groupeAge: 'Grands',
        statut: 'Actif',
        parents: [],
      };
      const invoices = [
        {
          id: 'inv-known',
          enfantId: enrichedChild.id,
          montant: 12000,
          statut: 'En attente',
          typeFacture: 'Mensuel',
          moisConcerne: '2026-10',
          periodeCle: 'M:2026-10',
          dateEcheance: '2026-10-05',
        },
        {
          id: 'inv-orphan',
          enfantId: 'missing-child-id',
          montant: 9500,
          statut: 'Payé',
          moyenPaiement: 'Chèque',
          typeFacture: 'Mensuel',
          moisConcerne: '2026-09',
          periodeCle: 'M:2026-09',
        },
        {
          id: 'inv-other-creche',
          enfantId: otherCrecheChild.id,
          montant: 15000,
          statut: 'Retard',
          typeFacture: 'Mensuel',
          moisConcerne: '2026-08',
          periodeCle: 'M:2026-08',
        },
      ];
      const presences = [
        { id: 'pres-1', enfantId: enrichedChild.id, date: '2026-11-06', statut: 'Absent justifié' },
        { id: 'pres-2', enfantId: enrichedChild.id, date: '2026-11-07', statut: 'Absent non justifié' },
      ];

      const authValue = {
        user: roleMode === 'pending-director'
          ? { id: 'director-1', role: 'directeur', approvalStatus: 'pending', prenom: 'Amel', nom: 'Kaci' }
          : roleMode === 'director'
          ? { id: 'director-1', role: 'directeur', approvalStatus: 'approved', prenom: 'Amel', nom: 'Kaci' }
          : { id: 'admin-1', role: 'admin', prenom: 'Admin', nom: 'Root' },
        creche: { id: 'director-1', nom: 'Crèche El Yasmine', adresse: '', tuitionFeeRate: 12000 },
        loading: false,
      };

      return React.createElement(
        AuthContext.Provider,
        { value: authValue },
        React.createElement(
          DbContext.Provider,
          {
            value: {
              ...db,
              enfants: [enrichedChild, otherCrecheChild],
              paiements: invoices,
              presences,
              notifications: [],
              financialDataReady: true,
            },
          },
          React.createElement(
            React.Fragment,
            null,
            React.createElement('div', { id: 'paiements' }, React.createElement(Paiements)),
            React.createElement(
              'div',
              { id: 'facture-orphan' },
              React.createElement(Facture, {
                paiement: invoices[1],
                enfant: undefined,
                onClose: () => {
                  factureClosed = true;
                },
              })
            ),
            React.createElement('div', { id: 'bell' }, React.createElement(NotificationBell, { onNavigateToPaiements() {} })),
            React.createElement('div', { id: 'enfant-details' }, React.createElement(EnfantDetails, { enfant: enrichedChild, onClose() {} }))
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

    await wait();

    // 1. Orphan invoice is NOT silently hidden when search is empty and displays "Enfant non disponible"
    const paiementsScope = document.querySelector('#paiements');
    assert.match(paiementsScope.textContent, /Enfant non disponible/);
    assert.doesNotMatch(paiementsScope.textContent, /Tous les enfants/);

    // 2. Search by period / reference + CSV export
    click([...paiementsScope.querySelectorAll('button')].find(b => b.textContent.includes('Exporter CSV')));
    await wait();
    assert.match(lastDownloadName, /^facturation-rawdha-.*\.csv$/);
    assert.match(exportedBlobText, /Statut déclaratif \(pas un justificatif de paiement\)/);
    assert.match(exportedBlobText, /inv-orphan/);

    // 3. Create modal requires declared payment method when marked Payé, and clears it when switched back
    click([...paiementsScope.querySelectorAll('button')].find(b => b.textContent.includes('Créer une facture')));
    await wait();
    const childSelect = [...paiementsScope.querySelectorAll('select')].find(s =>
      [...s.options].some(o => o.value === 'other-child')
    );
    childSelect.value = 'other-child';
    childSelect.dispatchEvent(new Event('change', { bubbles: true }));
    click([...paiementsScope.querySelectorAll('button')].find(b => b.textContent.trim() === 'Déjà Réglé'));
    await wait();
    click([...paiementsScope.querySelectorAll('button')].find(b => b.textContent.trim() === 'Enregistrer'));
    await wait();
    assert.match(paiementsScope.textContent, /Précisez le moyen de règlement déclaré/);
    click([...paiementsScope.querySelectorAll('button')].find(b => b.textContent.trim() === 'Annuler'));
    await wait();

    // 4. Facture handles missing child, non-receipt disclaimer & Escape key
    const factureScope = document.querySelector('#facture-orphan');
    assert.match(factureScope.textContent, /Enfant non disponible/);
    assert.match(factureScope.textContent, /ne constitue ni un reçu d’encaissement ni un justificatif comptable/);
    window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(factureClosed, true);

    // 5. EnfantDetails distinguishes excused vs unexcused absence (no "Excuzé" bug)
    const detailsScope = document.querySelector('#enfant-details');
    click([...detailsScope.querySelectorAll('button')].find(b => b.textContent.includes('Présences')));
    await wait(500);
    assert.match(detailsScope.textContent, /Absent justifié/);
    assert.match(detailsScope.textContent, /Absent non justifié/);
    assert.doesNotMatch(detailsScope.textContent, /Excuzé/);

    // 6. Director isolation in NotificationBell + Arabic localization across screens
    setRoleMode('director');
    setLanguage('ar');
    await wait(200);

    click(document.querySelector('#bell button[aria-label="Notifications"]'));
    await wait(200);
    const bellText = document.querySelector('#bell').textContent;
    assert.doesNotMatch(bellText, /Sami Autre/);
    assert.match(bellText, /متأخرة|قيد الانتظار/);

    assert.match(factureScope.textContent, /شيك بنكي/);
    assert.match(factureScope.textContent, /الطفل غير متاح/);
    assert.match(factureScope.textContent, /ولا يُعد وصل قبض/);

    // Switch EnfantDetails back to info tab in Arabic to verify medical/admin labels
    click([...detailsScope.querySelectorAll('button')].find(b => b.textContent.includes('الملف الطبي والشخصي')));
    await wait(500);
    assert.match(detailsScope.textContent, /الطبيب المعالج:/);
    assert.match(detailsScope.textContent, /دفتر التلقيحات للأطفال/);

    // 7. Pending director read-only disables "إصدار فاتورة جديدة"
    setRoleMode('pending-director');
    await wait();
    const createBtnAr = [...paiementsScope.querySelectorAll('button')].find(b => b.textContent.includes('إصدار فاتورة جديدة'));
    assert.ok(createBtnAr);
    assert.equal(createBtnAr.disabled, true);
    assert.match(paiementsScope.textContent, /وضع القراءة فقط/);
  } finally {
    dom.window.HTMLAnchorElement.prototype.click = anchorClickOrig;
    root?.unmount();
    await server.close();
    dom.window.close();
    delete globalThis.__rawdatiSupabaseClient__;
  }
});
