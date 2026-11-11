import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('performance & modern UI: PageSkeleton FR/AR, route prefetching, Dashboard quick actions & clickable KPIs, and deferred search', async () => {
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

  let idleScheduled = 0;
  window.requestIdleCallback = cb => {
    idleScheduled += 1;
    cb();
    return idleScheduled;
  };

  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });
  let root;

  try {
    const { createRoot } = await import('react-dom/client');
    const { flushSync } = await import('react-dom');
    await server.ssrLoadModule('/src/i18n.ts');
    const { LanguageProvider, useLanguage } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const { ConfirmProvider } = await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx');
    const { DbContext } = await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const { prefetchRouteChunk, prefetchCoreRoutesOnIdle } = await server.ssrLoadModule('/src/utils/routePrefetch.ts');
    const { default: PageSkeleton } = await server.ssrLoadModule('/src/components/PageSkeleton.tsx');
    const { default: Dashboard } = await server.ssrLoadModule('/src/components/Dashboard.tsx');
    const { default: Enfants } = await server.ssrLoadModule('/src/components/Enfants.tsx');
    const { default: Sidebar } = await server.ssrLoadModule('/src/components/Sidebar.tsx');
    const { default: Personnel } = await server.ssrLoadModule('/src/components/Personnel.tsx');
    const { default: Activites } = await server.ssrLoadModule('/src/components/Activites.tsx');
    const { default: Repas } = await server.ssrLoadModule('/src/components/Repas.tsx');
    const { default: MobileBottomNav } = await server.ssrLoadModule('/src/components/MobileBottomNav.tsx');
    const { default: MobileAppHubSheet } = await server.ssrLoadModule('/src/components/MobileAppHubSheet.tsx');

    // 1. Safe route prefetching (unknown route + deduplication + idle callback)
    prefetchRouteChunk('unknown-route-that-does-not-exist');
    prefetchRouteChunk('aide');
    prefetchRouteChunk('aide');
    prefetchCoreRoutesOnIdle('directeur');
    assert.equal(idleScheduled, 1);

    const navigated = [];
    const user = {
      id: 'creche-perf',
      nom: 'Directrice',
      email: 'dir@rawdha.dz',
      role: 'directeur',
      approvalStatus: 'approved',
    };
    const enfants = [
      {
        id: 'child-1',
        crecheId: 'creche-perf',
        nom: 'Saidi',
        prenom: 'Adam',
        dateNaissance: '2023-04-12',
        genre: 'Garçon',
        groupeAge: 'Moyens',
        allergies: [],
        parents: [{ id: 'p1', nom: 'Saidi', prenom: 'Karim', telephone: '0551223344', email: '', lien: 'Père' }],
        personnesAutorisees: [],
        dateInscription: '2026-09-01',
        statut: 'Actif',
      },
      {
        id: 'child-2',
        crecheId: 'creche-perf',
        nom: 'Merabet',
        prenom: 'Yasmine',
        dateNaissance: '2022-10-05',
        genre: 'Fille',
        groupeAge: 'Grands',
        allergies: [],
        parents: [{ id: 'p2', nom: 'Merabet', prenom: 'Nadia', telephone: '0770998877', email: '', lien: 'Mère' }],
        personnesAutorisees: [],
        dateInscription: '2026-09-01',
        statut: 'Actif',
      },
    ];

    const dbValue = {
      enfants,
      presences: [],
      presenceJournees: [],
      paiements: [
        {
          id: 'inv-1',
          crecheId: 'creche-perf',
          enfantId: 'child-1',
          montant: 15000,
          moisConcerne: '2026-11',
          periodeCle: 'M:2026-11',
          statut: 'En attente',
          typeFacture: 'Mensualité',
          dateEcheance: '2026-11-10',
        },
      ],
      financialDataReady: true,
      personnel: [],
      activites: [],
      repas: [],
      classes: [{ id: 'cls-1', crecheId: 'creche-perf', nom: 'Les Explorateurs', capacite: 20, groupeAge: 'Moyens' }],
      achats: [],
      comptes: [],
      parametres: {
        crecheNom: 'Crèche Moderne',
        tarifs: { bebes: 16000, moyens: 15000, grands: 14000, inscription: 5000 },
      },
      inscriptionLinks: [],
      demandesAdmission: [],
      loading: false,
      addEnfant: async () => 'new',
      updateEnfant: async () => {},
      decideAdmission: async () => {},
    };

    let switchLang;
    let quickSearchTriggered = 0;
    function MobileShellHarness() {
      const [hubOpen, setHubOpen] = React.useState(false);
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(MobileBottomNav, {
          currentPage: 'dashboard',
          onNavigate: page => navigated.push(page),
          onOpenMenu: () => setHubOpen(v => !v),
          isMenuOpen: hubOpen,
        }),
        React.createElement(MobileAppHubSheet, {
          isOpen: hubOpen,
          currentPage: 'dashboard',
          onClose: () => setHubOpen(false),
          onNavigate: page => navigated.push(page),
          onOpenQuickSearch: () => {
            quickSearchTriggered += 1;
          },
        })
      );
    }
    function LangController() {
      const { setLanguage } = useLanguage();
      switchLang = setLanguage;
      return null;
    }

    const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
    const click = el => {
      assert.ok(el, 'Expected clickable element');
      el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    };
    const setInput = (el, value) => {
      assert.ok(el, 'Expected input element');
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, value);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    };

    root = createRoot(document.getElementById('root'));
    flushSync(() => {
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
                AuthContext.Provider,
                { value: { user, isAuthenticated: true, isLoading: false } },
                React.createElement(
                  DbContext.Provider,
                  { value: dbValue },
                  React.createElement(LangController),
                  React.createElement('div', { id: 'skeleton' }, React.createElement(PageSkeleton)),
                  React.createElement(
                    'div',
                    { id: 'dash' },
                    React.createElement(Dashboard, { onNavigate: page => navigated.push(page) })
                  ),
                  React.createElement('div', { id: 'enfants' }, React.createElement(Enfants)),
                  React.createElement('div', { id: 'mobile-shell' }, React.createElement(MobileShellHarness)),
                  React.createElement(
                    'div',
                    { id: 'secondary-calm' },
                    React.createElement(Sidebar, {
                      activeTab: 'dashboard',
                      setActiveTab: page => navigated.push(page),
                      isOpen: false,
                      setIsOpen() {},
                    }),
                    React.createElement(Personnel),
                    React.createElement(Activites),
                    React.createElement(Repas)
                  )
                )
              )
            )
          )
        )
      );
    });
    await wait();

    // 2. PageSkeleton FR
    const skeletonEl = document.querySelector('#skeleton [aria-busy="true"]');
    assert.ok(skeletonEl);
    assert.equal(skeletonEl.getAttribute('dir'), 'ltr');
    assert.match(skeletonEl.getAttribute('aria-label'), /Chargement de la page/);

    // 3. Dashboard sobre : carte d'accueil directe + appel du jour + cartes KPI cliquables + pas de font-sans forcé
    const dashScope = document.querySelector('#dash');
    const dashRoot = dashScope.firstElementChild;
    assert.equal(dashRoot.className.includes('font-sans'), false);
    assert.match(dashScope.textContent, /Présents/);
    assert.match(dashScope.textContent, /Programme du jour/);
    assert.match(dashScope.textContent, /Aucun repas saisi pour aujourd’hui/);
    assert.doesNotMatch(dashScope.textContent, /Rawdha Command Center|Radar Rawdha|Sécurité infirmerie OK/);

    const quickAppelBtn = [...dashScope.querySelectorAll('button')].find(b =>
      b.textContent.includes('Faire l’appel') || b.textContent.includes('Voir les présences')
    );
    assert.ok(quickAppelBtn, 'Expected primary CTA Faire l’appel');
    click(quickAppelBtn);
    await wait(30);
    assert.equal(navigated.at(-1), 'presences');

    const kpiEnfants = [...dashScope.querySelectorAll('[role="button"]')].find(el =>
      el.textContent.includes('Enfants inscrits')
    );
    assert.ok(kpiEnfants, 'Expected clickable KPI card Enfants inscrits');
    click(kpiEnfants);
    await wait(30);
    assert.equal(navigated.at(-1), 'enfants');

    // 3b. Barre basse plate à 5 onglets + feuille Menu épurée
    const mobileShell = document.querySelector('#mobile-shell');
    const menuTabBtn = mobileShell.querySelector('button[aria-label="Ouvrir le menu"]');
    assert.ok(menuTabBtn, 'Expected Menu tab in bottom navigation');
    click(menuTabBtn);
    await wait(80);
    assert.match(mobileShell.textContent, /Menu/);
    const directSearchTrigger = [...mobileShell.querySelectorAll('button')].find(b =>
      b.textContent.includes('Chercher un enfant')
    );
    assert.ok(directSearchTrigger);
    click(directSearchTrigger);
    await wait(60);
    assert.equal(quickSearchTriggered, 1);

    // Reopen Menu sheet and tap a module item (Repas)
    click(menuTabBtn);
    await wait(80);
    const repasTile = [...mobileShell.querySelectorAll('button')].find(b => b.textContent.trim() === 'Repas');
    assert.ok(repasTile, 'Expected Repas module button');
    click(repasTile);
    await wait(60);
    assert.equal(navigated.at(-1), 'repas');

    // 4. Deferred search in Enfants (including parent phone lookup)
    const enfantsScope = document.querySelector('#enfants');
    const searchInput = enfantsScope.querySelector('input[type="text"]');
    setInput(searchInput, '998877');
    await wait(120);
    assert.match(enfantsScope.textContent, /Yasmine/);
    assert.doesNotMatch(enfantsScope.textContent, /Adam/);

    // 4b. Écrans secondaires & barres de navigation (Sidebar PC découpée courbe + Mobile notch courbe)
    const secondaryScope = document.querySelector('#secondary-calm');
    const sidebarAside = secondaryScope.querySelector('aside');
    assert.ok(sidebarAside.className.includes('rawdha-sidebar-curved'), 'Expected curved cutout desktop Sidebar');
    assert.ok(mobileShell.querySelector('.rawdha-mobile-notch-nav svg path'), 'Expected curved SVG notch on mobile bottom nav');
    assert.ok(secondaryScope.querySelector('#sidebar-tab-admissions'), 'Expected #sidebar-tab-admissions in Sidebar');
    assert.doesNotMatch(secondaryScope.textContent, /1 : 5 enfants|Taux d'Encadrement|4 Piliers Cognitifs/);
    assert.equal(secondaryScope.querySelector('.animate-bounce'), null);
    assert.equal(secondaryScope.querySelector('.animate-spin'), null);

    // 5. Switch to Arabic and verify RTL PageSkeleton + Dashboard Arabic CTA
    flushSync(() => {
      switchLang('ar');
    });
    await wait();
    const skeletonAr = document.querySelector('#skeleton [aria-busy="true"]');
    assert.equal(skeletonAr.getAttribute('dir'), 'rtl');
    assert.match(skeletonAr.getAttribute('aria-label'), /جارٍ تحميل الصفحة/);
    assert.match(dashScope.textContent, /تسجيل الحضور|سجل الحضور/);
  } finally {
    root?.unmount();
    await server.close();
    dom.window.close();
    delete globalThis.__rawdatiSupabaseClient__;
  }
});
