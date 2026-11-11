import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('Enfants mobile minimalist directory scales cleanly to 135+ children (progressive 50-row windowing, A-Z index, smart filters & mobile quick-action sheet in FR/AR)', async () => {
  process.env.VITE_ARENA_DEMO = 'false';
  globalThis.__rawdatiSupabaseClient__ = {};

  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost:3000/enfants',
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

  window.matchMedia = query => ({
    matches: String(query).includes('767px'),
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
    const { DemoProviders } = await server.ssrLoadModule('/src/demo/DemoProviders.tsx');
    const { DbContext, useDb } = await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const { default: Enfants } = await server.ssrLoadModule('/src/components/Enfants.tsx');

    const prenoms = [
      'Adam', 'Amina', 'Bilal', 'Bouchra', 'Chakib', 'Dalia', 'Elias', 'Farah', 'Hamza', 'Inès',
      'Karim', 'Lina', 'Mehdi', 'Meriem', 'Nassim', 'Nour', 'Omar', 'Rania', 'Sami', 'Yasmine',
    ];
    const noms = ['Amrani', 'Benali', 'Cherif', 'Hadjadj', 'Khelifi', 'Mansouri', 'Meziane', 'Saidi', 'Touati'];
    const groupes = ['Bébés', 'Moyens', 'Grands'];

    const generatedChildren = Array.from({ length: 135 }, (_, idx) => {
      const prenom = prenoms[idx % prenoms.length];
      const nom = `${noms[idx % noms.length]}-${idx + 1}`;
      const isComplete = idx % 3 === 0;
      const hasAllergy = idx < 6;
      return {
        id: `bulk-child-${String(idx + 1).padStart(3, '0')}`,
        crecheId: 'preview-director',
        prenom,
        nom,
        dateNaissance: '2023-06-15',
        dateInscription: '2026-09-01',
        genre: idx % 2 === 0 ? 'Garçon' : 'Fille',
        groupeAge: groupes[idx % 3],
        statut: 'Actif',
        allergie: hasAllergy ? 'Arachides' : '',
        parents: [
          {
            id: `p-${idx + 1}`,
            prenom: 'Karim',
            nom,
            lien: 'Père',
            telephone: `0555${String(100000 + idx).slice(0, 6)}`,
          },
        ],
        contactsUrgence: [],
        documentsRequis: {
          certificatMedical: true,
          carnetVaccination: isComplete,
          justificatifDomicile: isComplete,
          photoIdentite: true,
        },
      };
    });

    let switchLang;
    const updatedGroupCalls = [];

    function Harness() {
      const db = useDb();
      const { setLanguage } = useLanguage();
      switchLang = setLanguage;

      const updateEnfant = async (id, patch) => {
        updatedGroupCalls.push({ id, patch });
      };

      return React.createElement(
        DbContext.Provider,
        { value: { ...db, enfants: generatedChildren, updateEnfant } },
        React.createElement(Enfants),
      );
    }

    const wait = (ms = 160) => new Promise(resolve => setTimeout(resolve, ms));
    const click = el => {
      assert.ok(el, 'Expected clickable element');
      el.click();
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
            React.createElement(DemoProviders, null, React.createElement(Harness)),
          ),
        ),
      ),
    );

    await wait(200);

    // 1. Par défaut sur mobile : liste minimaliste active (pas de tableau large ni 135 cartes lourdes)
    assert.ok(
      document.querySelector('[data-directory-mode="mobile-minimal-list"]'),
      'Expected mobile minimalist directory list by default on phone',
    );
    assert.equal(document.querySelector('table'), null, 'Desktop wide table should not be mounted on phone');
    assert.equal(
      document.querySelectorAll('.mobile-scroll-x, .overflow-x-auto').length,
      0,
      'Zero horizontal slide bars allowed inside mobile cards, headers, or A-Z filters',
    );

    // 2. Fenêtrage progressif : 50 lignes rendues initialement sur 135
    assert.equal(document.querySelectorAll('[data-mobile-child-row]').length, 50);
    assert.match(document.body.textContent || '', /50 sur 135 enfants affichés/);

    // Charger 50 de plus -> 100 lignes
    const loadMoreBtn = [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes('Afficher 50 de plus'),
    );
    click(loadMoreBtn);
    await wait();
    assert.equal(document.querySelectorAll('[data-mobile-child-row]').length, 100);

    // 3. Aucun clavier alphabétique A-B-C-D-E... encombrant + filtrage par section en 1 clic
    assert.equal(
      document.querySelectorAll('button[aria-label^="Lettre "]').length,
      0,
      'Cluttered A-B-C-D-E button matrix must not exist',
    );
    const moyensBtn = [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes('Moyens'),
    );
    click(moyensBtn);
    await wait();
    assert.equal(document.querySelectorAll('[data-mobile-child-row]').length, 45);
    const tousBtn = [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes('Tous'),
    );
    click(tousBtn);
    await wait();
    assert.equal(document.querySelectorAll('[data-mobile-child-row]').length, 50);

    // 4. Filtre opérationnel "Allergies" (exactement 6 enfants sur 135)
    const allergyFilterBtn = [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes('Allergies'),
    );
    click(allergyFilterBtn);
    await wait();
    assert.equal(document.querySelectorAll('[data-mobile-child-row]').length, 6);
    click(allergyFilterBtn);
    await wait();

    // 5. Fiche d'actions rapides mobile (⋯) : changement de section en 1 geste
    const firstMoreBtn = document.querySelector('[data-mobile-child-row] button[aria-label^="Actions pour "]');
    click(firstMoreBtn);
    await wait();
    const sheetDialog = document.querySelector('[role="dialog"]');
    assert.ok(sheetDialog, 'Expected mobile quick-action bottom sheet');
    assert.match(sheetDialog.textContent || '', /Ouvrir le dossier complet & pièces PDF/);

    const grandsPill = [...sheetDialog.querySelectorAll('button')].find(
      b => (b.textContent || '').trim() === 'Grands',
    );
    click(grandsPill);
    await wait();
    assert.equal(updatedGroupCalls.length, 1);
    assert.equal(updatedGroupCalls[0].patch.groupeAge, 'Grands');

    // Fermer la feuille d'actions rapides via Escape
    window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait();
    assert.equal(document.querySelector('[role="dialog"]'), null);

    // 6. Vérification RTL en arabe (sans barre A-Z encombrante)
    switchLang('ar');
    await wait();
    assert.equal(
      document.querySelector('[aria-label="فهرس الحروف الأبجدية"]'),
      null,
      'Arabic A-Z keypad should also be absent',
    );
    assert.match(document.body.textContent || '', /ملف ناقص/);
  } finally {
    root?.unmount();
    await server.close();
    dom.window.close();
    delete globalThis.__rawdatiSupabaseClient__;
  }
});
