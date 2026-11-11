import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PGlite } from '@electric-sql/pglite';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

function setupDom(url = 'http://localhost:3000/abonnement') {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url,
    pretendToBeVisual: true,
  });
  for (const key of [
    'window',
    'document',
    'navigator',
    'localStorage',
    'sessionStorage',
    'HTMLElement',
    'HTMLInputElement',
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
  let stopped = false;
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: (cb) => {
      if (stopped) return 0;
      const id = setTimeout(() => {
        rafTimers.delete(id);
        if (!stopped) cb(Date.now());
      }, 0);
      rafTimers.add(id);
      return id;
    },
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    writable: true,
    value: (id) => {
      rafTimers.delete(id);
      clearTimeout(id);
    },
  });
  const stopRaf = () => {
    stopped = true;
    for (const id of rafTimers) clearTimeout(id);
    rafTimers.clear();
  };
  return { dom, stopRaf };
}

function getLocalTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

test('Security check: SlickPay keys are strictly server-side and never present in client or tracked files', () => {
  const envExample = fs.readFileSync(path.resolve('.env.example'), 'utf8');
  assert.match(envExample, /SLICKPAY_PUBLIC_KEY=\s*$/m);
  assert.match(envExample, /SLICKPAY_SECRET_KEY=\s*$/m);
  assert.doesNotMatch(envExample, /VITE_SLICKPAY/i);

  const checkoutFn = fs.readFileSync(path.resolve('supabase/slickpay-checkout/index.ts'), 'utf8');
  const webhookFn = fs.readFileSync(path.resolve('supabase/slickpay-webhook/index.ts'), 'utf8');
  const cliConfig = fs.readFileSync(path.resolve('supabase/config.toml'), 'utf8');
  assert.ok(fs.existsSync(path.resolve('supabase/functions/slickpay-checkout/index.ts')));
  assert.ok(fs.existsSync(path.resolve('supabase/functions/slickpay-webhook/index.ts')));
  assert.match(cliConfig, /\[functions\.slickpay-webhook\][\s\S]*verify_jwt\s*=\s*false/);
  assert.match(checkoutFn, /prodapi\.slick-pay\.com\/api\/v2/);
  assert.match(checkoutFn, /\/invoices/);
  assert.match(checkoutFn, /Deno\.env\.get\('SLICKPAY_PUBLIC_KEY'\)/);
  assert.match(checkoutFn, /Deno\.env\.get\('SLICKPAY_SECRET_KEY'\)/);
  assert.match(webhookFn, /confirm_slickpay_subscription_order/);
});

test('PostgreSQL migration `20261108240000_slickpay_subscription_orders.sql` activates and extends subscription idempotently', async () => {
  const sql = fs.readFileSync(
    new URL('../supabase/migrations/20261108240000_slickpay_subscription_orders.sql', import.meta.url),
    'utf8'
  );
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
      create function public.rawdha_is_admin() returns boolean language sql stable as $$select false$$;
      create table public.comptes(id text primary key, data jsonb not null);
      create table public.parametres(id text primary key, data jsonb not null);
      grant usage on schema public, auth to anon, authenticated, service_role;
    `);
    await db.exec(sql);

    const directorId = '00000000-0000-0000-0000-000000000088';
    await db.query('insert into public.comptes values ($1, $2::jsonb)', [
      directorId,
      JSON.stringify({
        id: directorId,
        role: 'directeur',
        approvalStatus: 'approved',
        abonnementActif: false,
        dateFinAbonnement: '2027-09-01',
        nomCreche: 'Crèche El Yasmine',
      }),
    ]);

    await db.query(
      `insert into public.slickpay_subscription_orders
        (id, director_id, director_name, creche_name, email, plan_months, amount_dzd, slickpay_invoice_id, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
      ['spk_pg_test_1', directorId, 'Amel Hadj', 'Crèche El Yasmine', 'amel@rawdha.dz', 3, 5700, '998877']
    );

    const firstConfirm = await db.query(
      `select public.confirm_slickpay_subscription_order($1, $2, $3::jsonb) as res`,
      ['spk_pg_test_1', '998877', JSON.stringify({ completed: 1 })]
    );
    assert.equal(firstConfirm.rows[0].res.alreadyPaid, false);
    assert.equal(firstConfirm.rows[0].res.newEndDate, '2027-12-01');

    // Second concurrent call (e.g. webhook + browser return) must NOT extend twice
    const secondConfirm = await db.query(
      `select public.confirm_slickpay_subscription_order($1, $2, $3::jsonb) as res`,
      ['spk_pg_test_1', '998877', JSON.stringify({ completed: 1 })]
    );
    assert.equal(secondConfirm.rows[0].res.alreadyPaid, true);
    assert.equal(secondConfirm.rows[0].res.newEndDate, '2027-12-01');

    const updatedAccount = await db.query('select data from public.comptes where id = $1', [directorId]);
    assert.equal(updatedAccount.rows[0].data.abonnementActif, true);
    assert.equal(updatedAccount.rows[0].data.dateFinAbonnement, '2027-12-01');

    const paramBucket = await db.query('select data from public.parametres where id = $1', [
      `abonnement_${directorId}`,
    ]);
    assert.equal(paramBucket.rows[0].data.items.length, 1);
    assert.equal(paramBucket.rows[0].data.items[0].paymentChannel, 'SlickPay');
    assert.equal(paramBucket.rows[0].data.items[0].status, 'approved');
  } finally {
    await db.close();
  }
});

test('Automatic Attendance Push (Bien arrivé / Récupéré / Fièvre / Absence) + SlickPay Checkout UI', async () => {
  const prevDemo = process.env.VITE_ARENA_DEMO;
  process.env.VITE_ARENA_DEMO = 'true';
  const { dom, stopRaf } = setupDom('http://localhost:3000/abonnement');

  globalThis.__rawdatiSupabaseClient__ = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        like: async () => ({ data: [], error: null }),
      }),
    }),
  };

  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });
  let root;

  try {
    await server.ssrLoadModule('/src/i18n.ts');
    const parentPortal = await server.ssrLoadModule('/src/utils/parentPortal.ts');
    const subRenewal = await server.ssrLoadModule('/src/utils/subscriptionRenewal.ts');
    const { LanguageProvider } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const { ConfirmProvider } = await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const { DemoProviders } = await server.ssrLoadModule('/src/demo/DemoProviders.tsx');
    const { WorkspaceProfileProvider } = await server.ssrLoadModule('/src/contexts/WorkspaceProfileContext.tsx');
    const { default: AbonnementPaiement } = await server.ssrLoadModule('/src/components/AbonnementPaiement.tsx');
    const { default: Sidebar } = await server.ssrLoadModule('/src/components/Sidebar.tsx');
    const { default: Presences } = await server.ssrLoadModule('/src/components/Presences.tsx');

    const crecheId = 'creche-auto-push-1';
    const today = getLocalTodayIso();
    const amine = {
      id: 'enf-amine',
      prenom: 'Amine',
      nom: 'Bensalem',
      genre: 'Garçon',
      dateNaissance: '2023-04-10',
      groupeAge: 'Moyens',
      statut: 'Actif',
    };
    const lina = {
      id: 'enf-lina',
      prenom: 'Lina',
      nom: 'Khelifi',
      genre: 'Fille',
      dateNaissance: '2023-08-22',
      groupeAge: 'Bébés',
      statut: 'Actif',
    };

    const reqAmine = await parentPortal.submitParentLinkRequest({
      crecheId,
      crecheNom: 'Crèche El Yasmine',
      parentPrenom: 'Karim',
      parentNom: 'Bensalem',
      parentTelephone: '0551112233',
      parentLien: 'Père',
      requestedChildren: [{ prenom: 'Amine', nom: 'Bensalem' }],
      deviceToken: 'dev-token-amine-parent-123456',
    });
    const approvedAmine = await parentPortal.approveParentLinkRequest({
      requestId: reqAmine.id,
      enfantIds: [amine.id],
      enfants: [amine, lina],
      presences: [],
      repas: [],
      activites: [],
      paiements: [],
    });

    const rawList = JSON.parse(globalThis.localStorage.getItem('rawdha_parent_link_requests_v1') || '[]');
    for (const item of rawList) {
      if (item.id === reqAmine.id) item.pushEnabled = true;
    }
    globalThis.localStorage.setItem('rawdha_parent_link_requests_v1', JSON.stringify(rawList));

    const reqLina = await parentPortal.submitParentLinkRequest({
      crecheId,
      crecheNom: 'Crèche El Yasmine',
      parentPrenom: 'Nadia',
      parentNom: 'Khelifi',
      parentTelephone: '0661223344',
      parentLien: 'Mère',
      requestedChildren: [{ prenom: 'Lina', nom: 'Khelifi' }],
      deviceToken: 'dev-token-lina-parent-654321',
    });
    const approvedLina = await parentPortal.approveParentLinkRequest({
      requestId: reqLina.id,
      enfantIds: [lina.id],
      enfants: [amine, lina],
      presences: [],
      repas: [],
      activites: [],
      paiements: [],
    });

    // Arrivée -> "Bien arrivé — Amine"
    const arrivalState = {
      date: today,
      statut: 'Présent',
      heureArrivee: '08:20',
      heureDepart: '',
      humeur: 'Souriant',
      temperature: '36.7',
    };
    const resArrival = await parentPortal.dispatchAutomaticAttendancePush({
      crecheId,
      crecheNom: 'Crèche El Yasmine',
      enfant: amine,
      previous: null,
      next: arrivalState,
    });
    assert.equal(resArrival.triggered, true);
    assert.equal(resArrival.kind, 'arrival');
    assert.equal(resArrival.sentPushCount, 1);
    assert.match(resArrival.announcement.title, /Bien arrivé — Amine/);

    // Anti-doublon
    const resDuplicate = await parentPortal.dispatchAutomaticAttendancePush({
      crecheId,
      crecheNom: 'Crèche El Yasmine',
      enfant: amine,
      previous: null,
      next: arrivalState,
    });
    assert.equal(resDuplicate.triggered, false);

    // Température >= 38°C -> catégorie 'sante'
    const feverState = { ...arrivalState, temperature: '38.5' };
    const resFever = await parentPortal.dispatchAutomaticAttendancePush({
      crecheId,
      crecheNom: 'Crèche El Yasmine',
      enfant: amine,
      previous: arrivalState,
      next: feverState,
    });
    assert.equal(resFever.triggered, true);
    assert.equal(resFever.announcement.category, 'sante');

    // Récupération -> "Récupéré — Amine"
    const pickupState = { ...feverState, heureDepart: '16:45', personneRecuperation: 'Papa' };
    const resPickup = await parentPortal.dispatchAutomaticAttendancePush({
      crecheId,
      crecheNom: 'Crèche El Yasmine',
      enfant: amine,
      previous: feverState,
      next: pickupState,
    });
    assert.equal(resPickup.triggered, true);
    assert.equal(resPickup.kind, 'pickup');
    assert.match(resPickup.announcement.message, /16:45 par Papa/);

    // Absence de Lina -> "Absence enregistrée — Lina"
    const resAbsence = await parentPortal.dispatchAutomaticAttendancePush({
      crecheId,
      crecheNom: 'Crèche El Yasmine',
      enfant: lina,
      previous: null,
      next: { date: today, statut: 'Absent justifié', motifAbsence: 'Rendez-vous pédiatre' },
    });
    assert.equal(resAbsence.triggered, true);
    assert.equal(resAbsence.kind, 'absence');

    // Isolation stricte Loi 18-07
    const allAnns = await parentPortal.loadParentAnnouncements(crecheId);
    const visibleForLina = allAnns.filter((ann) =>
      ann.targetScope === 'child' ? approvedLina.linkedEnfantIds.includes(ann.targetEnfantId) : true
    );
    assert.equal(visibleForLina.length, 1);
    assert.match(visibleForLina[0].title, /Lina/);

    const visibleForAmine = allAnns.filter((ann) =>
      ann.targetScope === 'child' ? approvedAmine.linkedEnfantIds.includes(ann.targetEnfantId) : true
    );
    assert.equal(visibleForAmine.length, 3);

    // Rendu DOM : AbonnementPaiement + Presences
    const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
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
                WorkspaceProfileProvider,
                null,
                React.createElement(
                  'div',
                  null,
                  React.createElement(Sidebar, { currentPage: 'dashboard', isOpen: true }),
                  React.createElement(AbonnementPaiement, null),
                  React.createElement(Presences, null)
                )
              )
            )
          )
        )
      )
    );
    await wait(220);

    const toggleBtn = document.querySelector('[data-testid="toggle-auto-parent-push"]');
    assert.ok(toggleBtn);
    assert.match(toggleBtn.textContent, /Push parents : Auto/);

    const slickpayBtn = document.querySelector('[data-testid="slickpay-pay-btn"]');
    assert.ok(slickpayBtn);
    assert.match(slickpayBtn.textContent, /1[\s\u202f\u00a0]?900 DA/);
    const whatsappBtn = document.querySelector('[data-testid="whatsapp-subscribe-btn"]');
    assert.ok(whatsappBtn, 'Bouton Contacter sur WhatsApp présent');
    assert.doesNotMatch(document.body.textContent, /BaridiMob|CCP/i);
    assert.ok(fs.existsSync(path.join(process.cwd(), 'public/payment/cib.png')), 'Logo PNG officiel CIB présent');
    assert.ok(fs.existsSync(path.join(process.cwd(), 'public/payment/edahabia.png')), 'Logo PNG officiel Edahabia présent');
    assert.ok(document.querySelector('img[src="/payment/cib.png"]'), 'Image CIB affichée sur la page paiement');
    assert.ok(document.querySelector('img[src="/payment/edahabia.png"]'), 'Image Edahabia affichée sur la page paiement');

    slickpayBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(140);

    // Valider dans la passerelle SATIM -> déclenche le verrouillage plein écran bloquant toute la page
    const demoConfirmBtn = document.querySelector('[data-testid="slickpay-demo-confirm-btn"]');
    assert.ok(demoConfirmBtn, 'Bouton de confirmation SATIM présent');
    demoConfirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(150);

    const fullScreenLock = document.querySelector('[data-testid="slickpay-fullscreen-lock"]');
    assert.ok(fullScreenLock, 'Le loading plein écran bloquant est affiché sur toute la page');
    assert.equal(document.body.style.overflow, 'hidden', 'Le scroll de toute la page est verrouillé');
    assert.match(fullScreenLock.textContent, /Validation du paiement en cours/);

    // Attendre que le Webhook asynchrone valide la transaction (~1.4s) puis déverrouille l'écran (~1.3s)
    await wait(1800);
    const successBanner = document.querySelector('[data-testid="slickpay-success-banner"]');
    assert.ok(successBanner, 'La bannière de confirmation s’affiche dès validation du paiement');

    const sidebarLineAfterPaid = document.querySelector('#sidebar-subscription-line');
    assert.match(
      sidebarLineAfterPaid.textContent,
      /Abonnement · 01\/10\/27/,
      'La date d’abonnement sous Directrice Démo est prolongée d’1 mois en direct'
    );

    await wait(1200);
    assert.equal(
      document.querySelector('[data-testid="slickpay-fullscreen-lock"]'),
      null,
      'Le verrouillage plein écran se libère une fois le paiement passé'
    );
    assert.notEqual(document.body.style.overflow, 'hidden', 'Le scroll de la page est débloqué');

    const renewals = await subRenewal.loadSubscriptionRenewals('preview-director');
    assert.equal(renewals.filter((r) => r.paymentChannel === 'SlickPay').length, 1);
  } finally {
    stopRaf();
    root?.unmount();
    if (prevDemo === undefined) delete process.env.VITE_ARENA_DEMO;
    else process.env.VITE_ARENA_DEMO = prevDemo;
    delete globalThis.__rawdatiSupabaseClient__;
    await server.close();
    dom.window.close();
  }
});
