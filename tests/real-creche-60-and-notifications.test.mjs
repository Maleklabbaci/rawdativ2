import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('60-child real nursery seed, minimalist notification badge, and live sound chime', async () => {
  process.env.VITE_ARENA_DEMO = 'false';
  globalThis.__rawdatiSupabaseClient__ = {};

  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost:3000/dashboard',
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
    'CustomEvent',
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

  // Activer le jeu de données "Crèche Réelle 60 enfants"
  window.sessionStorage.setItem('rawdha_demo_dataset', 'real60');

  const chimes = [];
  window.addEventListener('rawdha:notification-chime', event => {
    chimes.push(event.detail);
  });

  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  let root;

  try {
    const { createRoot } = await import('react-dom/client');
    await server.ssrLoadModule('/src/i18n.ts');
    const { LanguageProvider } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const { ConfirmProvider } = await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const { DemoProviders } = await server.ssrLoadModule('/src/demo/DemoProviders.tsx');
    const { useDb } = await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const { default: NotificationBell } = await server.ssrLoadModule('/src/components/NotificationBell.tsx');
    const { playNotificationChime, isNotificationSoundEnabled } = await server.ssrLoadModule(
      '/src/utils/notificationSound.ts',
    );

    let capturedDb = null;
    function Harness() {
      capturedDb = useDb();
      return React.createElement(NotificationBell, {
        onNavigateToPaiements: () => {},
        onNavigate: () => {},
      });
    }

    const wait = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));
    const click = el => {
      assert.ok(el, 'Expected clickable element');
      el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
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

    // 1. Vérification complète de la vraie crèche (60 enfants actifs + 2 sortis, 10 personnels, 4 classes, 10 repas, 8 activités)
    assert.ok(capturedDb, 'Expected DbContext from DemoProviders');
    const activeChildren = capturedDb.enfants.filter(c => c.statut === 'Actif');
    const departedChildren = capturedDb.enfants.filter(c => c.statut === 'Inactif');
    assert.equal(activeChildren.length, 60, 'Expected 60 active children');
    assert.equal(departedChildren.length, 2, 'Expected 2 departed children');
    assert.equal(capturedDb.classes.length, 4, 'Expected 4 balanced classes');
    assert.equal(capturedDb.personnel.length, 10, 'Expected 10 nursery staff members');
    assert.equal(capturedDb.repas.length, 10, 'Expected 10 weekly meals (Sun-Thu lunch + snack)');
    assert.equal(capturedDb.activites.length, 8, 'Expected 8 pedagogical activities');
    assert.equal(capturedDb.presences.length, 48, 'Expected 48 pointed children + 12 remaining');
    assert.equal(capturedDb.paiements.length, 56, 'Expected 56 monthly invoices + 4 ready for batch');

    // 2. Compteur minimaliste sur l’icône cloche 🔔 :
    //    2 annonces non lues + 2 admissions QR en attente + 1 message support non lu + 10 factures non payées = 15
    const badgeEl = document.querySelector('[data-notification-badge]');
    assert.ok(badgeEl, 'Expected minimalist badge on notification bell');
    assert.equal(badgeEl.textContent.trim(), '15');

    // 3. Ouverture de la cloche : contrôle du son (Son / Muet) + bouton Tester + lecture d’annonce
    click(document.querySelector('button[aria-label="Notifications"]'));
    await wait();
    assert.equal(isNotificationSoundEnabled(), true);

    const testerBtn = [...document.querySelectorAll('button')].find(
      b => (b.textContent || '').trim() === 'Tester',
    );
    click(testerBtn);
    assert.equal(chimes.length, 1, 'Clicking Tester should trigger notification chime');

    // Couper le son -> playNotificationChime() automatique est bloqué en mode muet
    const muteToggle = [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes('Son'),
    );
    click(muteToggle);
    await wait(50);
    assert.equal(isNotificationSoundEnabled(), false);
    assert.equal(playNotificationChime(), false, 'Muted mode should suppress automatic chimes');

    // Réactiver le son -> sonne immédiatement pour confirmer la réactivation
    const unmuteToggle = [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes('Muet'),
    );
    click(unmuteToggle);
    await wait(50);
    assert.equal(isNotificationSoundEnabled(), true);
    assert.equal(chimes.length, 2);

    // Cliquer sur une annonce non lue -> le badge passe immédiatement de 15 à 14
    const firstAnnonce = [...document.querySelectorAll('button')].find(b =>
      (b.textContent || '').includes('Campagne de contrôle sanitaire'),
    );
    click(firstAnnonce);
    await wait();
    assert.equal(document.querySelector('[data-notification-badge]').textContent.trim(), '14');
  } finally {
    root?.unmount();
    await server.close();
    dom.window.close();
    delete globalThis.__rawdatiSupabaseClient__;
  }
});
