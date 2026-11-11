import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('parent portal SQL migration enforces zero child exposure until director approval and returns multi-child snapshot once approved', async () => {
  const sql = fs.readFileSync(
    new URL('../supabase/migrations/20261108230000_parent_portal_and_web_push.sql', import.meta.url),
    'utf8',
  );
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
      create function public.rawdha_is_admin() returns boolean language sql stable as $$select false$$;
      create table public.enfants(id text primary key, data jsonb not null);
      create table public.presences(id text primary key, data jsonb not null);
      create table public.repas(id text primary key, data jsonb not null);
      create table public.activites(id text primary key, data jsonb not null);
      create table public.paiements(id text primary key, data jsonb not null);
      grant usage on schema public, auth to anon, authenticated;
    `);
    await db.exec(sql);

    const crecheId = '00000000-0000-0000-0000-000000000055';
    await db.query('insert into enfants values ($1, $2), ($3, $4)', [
      'child-1',
      { crecheId, prenom: 'Amine', nom: 'Amrani', groupeAge: 'Bébés' },
      'child-2',
      { crecheId, prenom: 'Lina', nom: 'Amrani', groupeAge: 'Grands' },
    ]);

    const deviceToken = 'ptok_test_device_token_1234567890';
    const subRes = await db.query(
      `select public.submit_parent_link_request($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) as res`,
      [
        crecheId,
        'Crèche Les Petits Soleils',
        deviceToken,
        'Nadia',
        'Amrani',
        '0555123456',
        'Mère',
        JSON.stringify([
          { prenom: 'Amine', nom: 'Amrani', groupeAge: 'Bébés' },
          { prenom: 'Lina', nom: 'Amrani', groupeAge: 'Grands' },
        ]),
        'android',
      ],
    );
    const reqId = subRes.rows[0].res.id;
    assert.ok(reqId.startsWith('plr-'));

    // Before approval: zero child snapshots leaked
    const pendingSnap = await db.query(
      `select public.get_parent_portal_snapshot($1, $2) as snap`,
      [crecheId, deviceToken],
    );
    assert.equal(pendingSnap.rows[0].snap.request.status, 'pending');
    assert.equal(pendingSnap.rows[0].snap.request.linkedSnapshots.length, 0);

    // Director approves both siblings
    await db.query(
      `update public.parent_link_requests set status = 'approved', linked_enfant_ids = array['child-1', 'child-2'] where id = $1`,
      [reqId],
    );

    const approvedSnap = await db.query(
      `select public.get_parent_portal_snapshot($1, $2) as snap`,
      [crecheId, deviceToken],
    );
    assert.equal(approvedSnap.rows[0].snap.request.status, 'approved');
    assert.equal(approvedSnap.rows[0].snap.request.linkedSnapshots.length, 2);
  } finally {
    await db.close();
  }
});

test('automatic QR parent portal links 1 or multiple children, shows Home Screen + Push onboarding on director approval, and receives live Push announcements', async () => {
  process.env.VITE_ARENA_DEMO = 'false';
  globalThis.__rawdatiSupabaseClient__ = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        like: async () => ({ data: [], error: null }),
      }),
    }),
  };

  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    url: 'http://localhost:3000/espace-parent?creche=preview-director&nom=Cr%C3%A8che%20Les%20Petits%20Soleils',
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
    'MutationObserver',
    'getComputedStyle',
  ]) {
    if (key in dom.window) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: key === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : dom.window[key],
      });
    }
  }

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

  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  window.scrollTo = () => {};

  // Mock browser Notification API
  let notifPermission = 'default';
  const shownNotifications = [];
  class MockNotification {
    static get permission() {
      return notifPermission;
    }
    static async requestPermission() {
      notifPermission = 'granted';
      return 'granted';
    }
    constructor(title, options) {
      shownNotifications.push({ title, options });
    }
  }
  Object.defineProperty(globalThis, 'Notification', { configurable: true, writable: true, value: MockNotification });
  Object.defineProperty(window, 'Notification', { configurable: true, writable: true, value: MockNotification });

  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  let root;

  try {
    const { createRoot } = await import('react-dom/client');
    await server.ssrLoadModule('/src/i18n.ts');
    const { LanguageProvider } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const { ConfirmProvider } = await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const { DemoProviders } = await server.ssrLoadModule('/src/demo/DemoProviders.tsx');
    const { default: PublicParentPortal } = await server.ssrLoadModule('/src/components/PublicParentPortal.tsx');
    await server.ssrLoadModule('/src/components/ParentPortalDirectorPanel.tsx');
    const { default: Communication } = await server.ssrLoadModule('/src/components/Communication.tsx');

    const wait = (ms = 140) => new Promise((r) => setTimeout(r, ms));
    const click = (el) => {
      assert.ok(el, 'Expected clickable element');
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    };
    const setVal = (el, val) => {
      assert.ok(el, 'Expected input element');
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
                React.createElement('div', { id: 'parent-view' }, React.createElement(PublicParentPortal)),
                React.createElement('div', { id: 'director-view' }, React.createElement(Communication)),
              ),
            ),
          ),
        ),
      ),
    );
    await wait(220);

    // 1. Parent opens QR link -> sees link request form, adds a 2nd child (sibling), and submits
    const parentScope = document.querySelector('#parent-view');
    assert.match(parentScope.textContent, /Relier votre téléphone à votre enfant/);

    setVal(parentScope.querySelector('input[placeholder="Ex: Nadia"]'), 'Karima');
    setVal(parentScope.querySelector('input[placeholder="Ex: Amrani"]'), 'Benali');
    setVal(parentScope.querySelector('input[placeholder="0555 12 34 56"]'), '0551998877');

    // Add 2nd child row
    const addSiblingRowBtn = [...parentScope.querySelectorAll('button')].find((b) =>
      b.textContent.includes('+ Ajouter un enfant'),
    );
    click(addSiblingRowBtn);
    await wait(80);

    const childFirstInputs = [...parentScope.querySelectorAll('input[placeholder="Prénom de l’enfant *"]')];
    assert.equal(childFirstInputs.length, 2);
    setVal(childFirstInputs[0], 'Yasmine');
    setVal(childFirstInputs[1], 'Adam');
    await wait(60);

    const submitBtn = parentScope.querySelector('button[type="submit"]');
    click(submitBtn);
    await wait(160);

    // Parent automatically transitions to waiting screen
    assert.match(parentScope.textContent, /En attente de validation par la directrice/);
    assert.match(parentScope.textContent, /Yasmine Benali/);
    assert.match(parentScope.textContent, /Adam/);

    // 2. Director opens Communication -> QR Parents tab -> sees Karima Benali's multi-child request & approves
    const directorScope = document.querySelector('#director-view');
    const qrTabBtn = [...directorScope.querySelectorAll('button')].find((b) =>
      b.textContent.includes('QR Parents'),
    );
    click(qrTabBtn);
    await wait(280);
    assert.match(directorScope.textContent, /Karima Benali/);

    // Ensure 2 children are selected on Karima's request if demo children names differ from Yasmine/Adam
    const chooseChildrenBtns = [...directorScope.querySelectorAll('button')].filter((b) =>
      b.textContent.includes('Choisir / modifier enfants'),
    );
    click(chooseChildrenBtns[0]);
    await wait(100);
    const checkboxes = [...directorScope.querySelectorAll('input[type="checkbox"]')];
    if (checkboxes.length >= 2) {
      if (!checkboxes[0].checked) checkboxes[0].click();
      await wait(40);
      if (!checkboxes[1].checked) checkboxes[1].click();
    }
    await wait(80);

    const approveBtns = [...directorScope.querySelectorAll('button')].filter((b) =>
      b.textContent.includes('Accepter & lier'),
    );
    click(approveBtns[0]);
    await wait(200);

    // 3. Parent view AUTOMATICALLY transitions to Multi-Child Pass + Home Screen + Push Onboarding!
    assert.match(parentScope.textContent, /Finalisez votre Pass Parent en 2 gestes/);
    assert.match(parentScope.textContent, /1\. Mettre sur l’écran d’accueil/);
    assert.match(parentScope.textContent, /2\. Autoriser les notifications Push/);
    assert.match(parentScope.textContent, /Mes enfants rattachés \(2\)/);
    assert.match(parentScope.textContent, /Pass Parent Vérifié/);

    // 4. Parent authorizes Push Notifications
    const allowPushBtn = [...parentScope.querySelectorAll('button')].find((b) =>
      b.textContent.trim() === 'Autoriser',
    );
    click(allowPushBtn);
    await wait(180);
    assert.match(parentScope.textContent, /Push ON/);
    assert.ok(shownNotifications.length >= 1, 'Welcome push notification should trigger');

    // 5. Director switches to Notifs Push tab and broadcasts a holiday announcement -> Parent receives it live!
    const pushTabBtn = [...directorScope.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Notifs Push'),
    );
    click(pushTabBtn);
    await wait(120);

    const holidayPresetBtn = [...directorScope.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Jour férié'),
    );
    click(holidayPresetBtn);
    await wait(80);

    const sendPushBtn = [...directorScope.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Envoyer la notification Push'),
    );
    click(sendPushBtn);
    await wait(220);

    assert.match(parentScope.textContent, /Information : Fermeture exceptionnelle/);
  } finally {
    root?.unmount();
    for (const id of rafTimers) clearTimeout(id);
    rafTimers.clear();
    await server.close();
    dom.window.close();
    delete globalThis.__rawdatiSupabaseClient__;
    delete globalThis.Notification;
  }
});
