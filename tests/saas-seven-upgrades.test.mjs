import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('7 SaaS upgrades: Netflix subprofiles, autonomous password reset, partial invoice installments, parent daily report, staff HR advances, DAS compliance & offline attendance queue', async () => {
  process.env.VITE_ARENA_DEMO = 'false';

  let lastResetEmail = null;
  let lastUpdatedPassword = null;
  const parametresStore = new Map();

  globalThis.__rawdatiSupabaseClient__ = {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      resetPasswordForEmail: async (email) => {
        lastResetEmail = email;
        return { data: {}, error: null };
      },
      updateUser: async ({ password }) => {
        lastUpdatedPassword = password;
        return { data: { user: { id: 'u1' } }, error: null };
      },
    },
    functions: {
      invoke: async () => ({ data: { ok: true }, error: null }),
    },
    from: (table) => ({
      select: () => ({
        eq: (_col, id) => ({
          maybeSingle: async () => {
            if (table === 'parametres' && parametresStore.has(id)) {
              return { data: { id, data: parametresStore.get(id) }, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
      upsert: async ({ id, data }) => {
        if (table === 'parametres') {
          parametresStore.set(id, data);
        }
        return { error: null };
      },
    }),
  };

  const dom = new JSDOM('<!doctype html><html lang="fr"><body><div id="root"></div></body></html>', {
    url: 'http://localhost:3000/login/',
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
    'HTMLTextAreaElement',
    'HTMLSelectElement',
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

  let mockOnline = true;
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => mockOnline,
  });

  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  window.scrollTo = () => {};
  window.print = () => {};

  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  let root;

  const flush = async (ms = 45) => {
    await new Promise(resolve => setTimeout(resolve, ms));
    await new Promise(resolve => setTimeout(resolve, ms));
  };

  const setVal = (el, value) => {
    assert.ok(el, `Expected form control for value "${value}"`);
    const proto =
      el.tagName === 'TEXTAREA'
        ? dom.window.HTMLTextAreaElement.prototype
        : el.tagName === 'SELECT'
          ? dom.window.HTMLSelectElement.prototype
          : dom.window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  };

  try {
    const { createRoot } = await import('react-dom/client');
    await server.ssrLoadModule('/src/i18n.ts');
    const { LanguageProvider } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const { ConfirmProvider } = await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx');
    const { DbContext, useDb } = await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const {
      WorkspaceProfileProvider,
      useWorkspaceProfile,
    } = await server.ssrLoadModule('/src/contexts/WorkspaceProfileContext.tsx');
    const { default: ProfileSelectorScreen } = await server.ssrLoadModule('/src/components/ProfileSelectorScreen.tsx');
    const { default: SignIn } = await server.ssrLoadModule('/src/components/SignIn.tsx');
    const { default: Paiements } = await server.ssrLoadModule('/src/components/Paiements.tsx');
    const { default: Presences } = await server.ssrLoadModule('/src/components/Presences.tsx');
    const { default: Personnel } = await server.ssrLoadModule('/src/components/Personnel.tsx');
    const { default: Parametres } = await server.ssrLoadModule('/src/components/Parametres.tsx');
    const { default: Dashboard } = await server.ssrLoadModule('/src/components/Dashboard.tsx');

    root = createRoot(document.getElementById('root'));

    const wrap = (node, authVal, dbVal) =>
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(
          ConfirmProvider,
          null,
          React.createElement(
            ToastProvider,
            null,
            React.createElement(
              AuthContext.Provider,
              { value: authVal },
              React.createElement(
                DbContext.Provider,
                { value: dbVal },
                React.createElement(WorkspaceProfileProvider, null, node)
              )
            )
          )
        )
      );

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const monthStr = todayStr.slice(0, 7);

    const directorAuth = {
      isAuthenticated: true,
      loading: false,
      user: {
        id: 'dir-test-1',
        nom: 'Benali',
        prenom: 'Nadia',
        email: 'nadia@creche.dz',
        role: 'directeur',
        approvalStatus: 'approved',
        abonnementActif: true,
        nomCreche: 'Crèche El Yasmine',
      },
      creche: { nom: 'Crèche El Yasmine', adresse: 'Blida', logoUrl: null, tuitionFeeRate: 12000 },
      loginWithCredentials: async () => ({ user: null, error: null }),
      logout: () => {},
      refreshCreche: async () => {},
      updateProfile: async () => {},
    };

    const adminAuth = {
      ...directorAuth,
      user: {
        id: 'admin-1',
        nom: 'Admin',
        prenom: 'Rawdha',
        email: 'admin@rawdha.dz',
        role: 'admin',
        abonnementActif: true,
      },
    };

    let invoicesState = [
      {
        id: 'inv-1',
        enfantId: 'c1',
        montant: 12000,
        statut: 'En attente',
        typeFacture: 'Mensuel',
        moisConcerne: monthStr,
        periodeCle: `M:${monthStr}`,
        dateEcheance: todayStr,
      },
    ];
    let presencesState = [];
    let addedPresenceCalls = 0;

    const makeDb = () => ({
      loading: false,
      financialDataReady: true,
      enfants: [
        {
          id: 'c1',
          crecheId: 'dir-test-1',
          prenom: 'Lina',
          nom: 'Mansouri',
          genre: 'Fille',
          groupeAge: 'Bébés',
          dateNaissance: '2024-02-10',
          dateInscription: todayStr,
          statut: 'Actif',
          parents: [{ id: 'p1', prenom: 'Karim', nom: 'Mansouri', lien: 'Père', telephone: '0555123456' }],
          contactsUrgence: [],
          documentsRequis: {
            certificatMedical: true,
            carnetVaccination: false,
            justificatifDomicile: true,
            photoIdentite: true,
          },
        },
        {
          id: 'c2',
          crecheId: 'dir-test-1',
          prenom: 'Yanis',
          nom: 'Khelifi',
          genre: 'Garçon',
          groupeAge: 'Grands',
          dateNaissance: '2022-05-10',
          dateInscription: todayStr,
          statut: 'Actif',
          parents: [{ id: 'p2', prenom: 'Sonia', nom: 'Khelifi', lien: 'Mère', telephone: '0661223344' }],
          contactsUrgence: [],
          documentsRequis: {
            certificatMedical: true,
            carnetVaccination: true,
            justificatifDomicile: true,
            photoIdentite: true,
          },
        },
      ],
      classes: [
        { id: 'cls-poussins', crecheId: 'dir-test-1', nom: 'Les Poussins', niveau: 'Bébés', capacite: 10, childrenIds: ['c1'] },
        { id: 'cls-grands', crecheId: 'dir-test-1', nom: 'Les Grands', niveau: 'Grands', capacite: 15, childrenIds: ['c2'] },
      ],
      paiements: invoicesState,
      achats: [{ id: 'ach-1', crecheId: 'dir-test-1', libelle: 'Couches', montant: 4000, statut: 'payé', moyenPaiement: 'especes', categorie: 'hygiene', dateAchat: todayStr, createdBy: 'dir-test-1', recurrent: false, createdAt: todayStr, updatedAt: todayStr }],
      presences: presencesState,
      presenceJournees: [],
      personnel: [
        { id: 'st-1', crecheId: 'dir-test-1', prenom: 'Sara', nom: 'Amrani', poste: 'Éducatrice', statut: 'Actif', assuranceActive: false },
      ],
      repas: [{ id: 'm1', crecheId: 'dir-test-1', type: 'Déjeuner', date: todayStr, menu: 'Soupe de légumes & poulet' }],
      activites: [{ id: 'a1', crecheId: 'dir-test-1', titre: 'Éveil sensoriel', date: todayStr, groupe: 'Bébés' }],
      invoiceReviews: [],
      invoiceReviewEvents: [],
      demandesAdmission: [],
      demandesDirecteur: [],
      comptes: [],
      communityFeatures: [],
      notifications: [],
      updatePaiement: async (id, patch) => {
        invoicesState = invoicesState.map(inv => (inv.id === id ? { ...inv, ...patch } : inv));
      },
      addPaiement: async () => {},
      addPresence: async (payload) => {
        addedPresenceCalls += 1;
        presencesState = [...presencesState, { id: `pres-${addedPresenceCalls}`, ...payload }];
      },
      updatePresence: async () => {},
      deletePresence: async () => {},
      savePresenceJournee: async () => {},
      addEnfant: async () => {},
      addRepas: async () => {},
      addPersonnel: async () => {},
      deletePersonnel: async () => {},
    });

    // =========================================================================
    // 1. BRIQUE 1 : Sous-profils façon Netflix + exclusion Admin + ScopedDb
    // =========================================================================
    let latestProfileCtx = null;
    let latestScopedDb = null;

    function ProfileProbe() {
      latestProfileCtx = useWorkspaceProfile();
      latestScopedDb = useDb();
      if (latestProfileCtx.requiresProfileSelection) {
        return React.createElement(ProfileSelectorScreen);
      }
      return React.createElement('div', { id: 'unlocked-probe' }, latestProfileCtx.activeProfile?.name || '');
    }

    // 1a. L'administrateur plateforme n'est JAMAIS bloqué par l'écran Netflix
    root.render(wrap(React.createElement(ProfileProbe), adminAuth, makeDb()));
    await flush();
    assert.equal(latestProfileCtx.requiresProfileSelection, false, 'Platform admin must bypass profile selector');
    assert.ok(document.querySelector('#unlocked-probe'));

    // 1b. Le compte Crèche (directeur approuvé) affiche l'écran de choix de profil au thème LandingPage/SignIn
    sessionStorage.clear();
    localStorage.clear();
    root.render(wrap(React.createElement(ProfileProbe), directorAuth, makeDb()));
    await flush(70);
    assert.equal(latestProfileCtx.requiresProfileSelection, true);
    assert.match(document.body.textContent || '', /Qui utilise l’espace crèche\s*\?/);
    assert.match(document.body.textContent || '', /Nadia Benali/);
    assert.match(document.body.textContent || '', /Ajouter un profil/);
    assert.ok(document.querySelector('img[src="/rawdah-logo.png"]'), 'Profile selector must use Rawdha+ logo like LandingPage/SignIn');
    assert.ok(!document.body.innerHTML.includes('bg-[#0f172a]'), 'Profile selector must not use dark cinema background');

    // 1c. Protection initiale du profil Direction + création d'un profil Éducatrice avec permissions fines par page
    const setupRes = await latestProfileCtx.setupOwnerPasswordAndUnlock('1234');
    assert.equal(setupRes.ok, true);
    assert.ok(parametresStore.has('profils_equipe_dir-test-1'), 'Profiles must persist in parametres table');

    const saveStaffRes = await latestProfileCtx.saveSubProfile({
      name: 'Sara',
      roleLabel: 'Éducatrice Bébés',
      preset: 'educatrice',
      color: 'emerald',
      password: '1111',
      pagePermissions: {
        presences: ['view', 'point', 'daily_report'], // PAS validate_day
        enfants: ['view', 'health_pickup'],           // PAS edit ni archive
        classes: ['view'],                            // Lecture seule
        repas: ['view'],                              // Lecture seule (PAS manage)
        activites: ['view', 'manage'],
        personnel: ['view'],                          // Consultation équipe, PAS accès Admin
      },
      allowedClassIds: ['cls-poussins'],
      hideFinancials: true,
    });
    assert.equal(saveStaffRes.ok, true);
    await flush();

    // Verrouillage puis tentative avec mauvais code
    latestProfileCtx.lockProfile();
    await flush();
    assert.equal(latestProfileCtx.requiresProfileSelection, true);

    const saraProfile = latestProfileCtx.profiles.find(p => p.name === 'Sara');
    assert.ok(saraProfile);
    const badRes = await latestProfileCtx.unlockProfile(saraProfile.id, '9999');
    assert.equal(badRes.ok, false);

    // Déverrouillage de Sara -> isolation classes + permissions granulaires par page + blocage écriture lecture seule
    const okSara = await latestProfileCtx.unlockProfile(saraProfile.id, '1111');
    assert.equal(okSara.ok, true);
    await flush();
    assert.equal(latestProfileCtx.activeProfile?.name, 'Sara');
    assert.equal(latestProfileCtx.isOwnerProfile, false);
    assert.equal(latestProfileCtx.canAccessPage('paiements'), false);
    assert.equal(latestProfileCtx.canAccessPage('presences'), true);
    assert.equal(latestProfileCtx.hasPagePermission('presences', 'point'), true);
    assert.equal(latestProfileCtx.hasPagePermission('presences', 'validate_day'), false);
    assert.equal(latestProfileCtx.hasPagePermission('enfants', 'view'), true);
    assert.equal(latestProfileCtx.hasPagePermission('enfants', 'edit'), false);
    assert.equal(latestProfileCtx.hasPagePermission('repas', 'manage'), false);
    assert.equal(latestScopedDb.enfants.length, 1, 'Sara should only see children in Les Poussins');
    assert.equal(latestScopedDb.enfants[0].prenom, 'Lina');
    assert.equal(latestScopedDb.paiements.length, 0, 'Financial records must be hidden from educator subprofile');
    assert.equal(latestScopedDb.achats.length, 0, 'Purchases must be hidden from educator subprofile');

    // Toute tentative d'écriture non autorisée dans une page en lecture seule est bloquée par ScopedDbByProfile
    await assert.rejects(
      () => latestScopedDb.addEnfant({ prenom: 'Test' }),
      /permission_denied_by_subprofile/
    );
    await assert.rejects(
      () => latestScopedDb.addRepas({ type: 'Goûter' }),
      /permission_denied_by_subprofile/
    );

    // En tant que Sara (non-Admin), l'onglet « Accès & Permissions » dans Personnel n'est PAS accessible
    root.render(wrap(React.createElement(Personnel), directorAuth, makeDb()));
    await flush();
    assert.ok(
      ![...document.querySelectorAll('button')].some(b => /Accès & Permissions/i.test(b.textContent || '')),
      'Educator subprofile must never see Admin Access & Permissions tab'
    );

    // Rebranchement de la sonde pour déverrouiller le profil Admin Crèche (Direction)
    root.render(wrap(React.createElement(ProfileProbe), directorAuth, makeDb()));
    await flush();
    const okOwner = await latestProfileCtx.unlockProfile('owner-admin', '1234');
    assert.equal(okOwner.ok, true);
    await flush();
    assert.equal(latestProfileCtx.isOwnerProfile, true);
    assert.equal(latestScopedDb.enfants.length, 2);
    assert.equal(latestScopedDb.paiements.length, 1);

    // En tant qu'Admin Crèche (Direction), la gestion des accès est disponible dans Personnel ET dans Paramètres
    root.render(wrap(React.createElement(Personnel), directorAuth, makeDb()));
    await flush();
    const accessTabBtn = [...document.querySelectorAll('button')].find(b => /Accès & Permissions/i.test(b.textContent || ''));
    assert.ok(accessTabBtn, 'Admin Crèche must see Accès & Permissions tab in Personnel');
    accessTabBtn.click();
    await flush();
    assert.match(document.body.textContent || '', /Profils d’équipe & permissions par page/);

    root.render(wrap(React.createElement(Parametres), directorAuth, makeDb()));
    await flush(70);
    assert.match(document.body.textContent || '', /Profils d’équipe & permissions par page/);

    // =========================================================================
    // 2. BRIQUE 2 : « Mot de passe oublié ? » autonome + retour ?reset=1
    // =========================================================================
    root.render(wrap(React.createElement(SignIn, { mode: 'signin' }), { ...directorAuth, isAuthenticated: false, user: null }, makeDb()));
    await flush();
    const forgotBtn = [...document.querySelectorAll('button')].find(b => /Mot de passe oublié/i.test(b.textContent || ''));
    assert.ok(forgotBtn, 'SignIn must display Forgot Password button');
    forgotBtn.click();
    await flush();

    const resetEmailInput = document.querySelector('input[type="email"]');
    setVal(resetEmailInput, 'Directrice@Creche.dz');
    document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    assert.equal(lastResetEmail, 'directrice@creche.dz');
    assert.match(document.body.textContent || '', /lien sécurisé de réinitialisation/i);

    // Simulation du retour depuis le lien e-mail (?reset=1)
    dom.reconfigure({ url: 'http://localhost:3000/login/?reset=1' });
    root.render(wrap(React.createElement(SignIn, { key: 'recovery-view', mode: 'signin' }), { ...directorAuth, isAuthenticated: false, user: null }, makeDb()));
    await flush();
    const passInputs = [...document.querySelectorAll('input[type="password"]')];
    assert.equal(passInputs.length, 2, 'Password recovery view must render new password + confirmation inputs');
    setVal(passInputs[0], 'NouveauSecret2026!');
    setVal(passInputs[1], 'NouveauSecret2026!');
    document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    assert.equal(lastUpdatedPassword, 'NouveauSecret2026!');
    dom.reconfigure({ url: 'http://localhost:3000/' });

    // =========================================================================
    // 3. BRIQUE 3 : Acomptes / Versements partiels + Bon numéroté + Caisse du jour
    // =========================================================================
    sessionStorage.setItem('rawdha_active_subprofile_dir-test-1', 'owner-admin');
    root.render(wrap(React.createElement(Paiements), directorAuth, makeDb()));
    await flush(60);
    assert.match(document.body.textContent || '', /Versements & acomptes déclarés aujourd’hui/);

    const acompteBtn = document.querySelector('button[aria-label*="acompte"]');
    assert.ok(acompteBtn, 'Invoice row must expose Acompte action button');
    acompteBtn.click();
    await flush();

    const amountInput = document.querySelector('input[type="number"]');
    setVal(amountInput, '5000');
    const submitInstBtn = [...document.querySelectorAll('button')].find(b => /Valider le versement/i.test(b.textContent || ''));
    assert.ok(submitInstBtn);
    submitInstBtn.click();
    await flush(60);

    assert.match(document.body.textContent || '', /BV-\d{4}-0001/, 'Must issue sequential receipt number BV-YYYY-0001');
    assert.equal(invoicesState[0].statut, 'En attente', 'Partial installment keeps invoice open');
    assert.ok(parametresStore.has('acomptes_dir-test-1'), 'Installments must persist in parametres/acomptes_<id>');

    // Deuxième versement soldant les 7 000 DA restants -> facture marquée Payée automatiquement
    const secondAmountInput = document.querySelector('input[type="number"]');
    setVal(secondAmountInput, '7000');
    submitInstBtn.click();
    await flush(60);
    assert.match(document.body.textContent || '', /BV-\d{4}-0002/);
    assert.equal(invoicesState[0].statut, 'Payé', 'Completing remaining balance transitions invoice to Payé');

    // =========================================================================
    // 4 & 7. BRIQUES 4 & 7 : Pointage hors-ligne + Carnet de liaison Parent
    // =========================================================================
    mockOnline = false;
    window.dispatchEvent(new dom.window.Event('offline'));
    root.render(wrap(React.createElement(Presences), directorAuth, makeDb()));
    await flush(60);

    // Ouvrir la classe Les Poussins et pointer Lina hors-ligne
    const classBtn = [...document.querySelectorAll('button')].find(b => /Les Poussins/.test(b.textContent || ''));
    assert.ok(classBtn);
    classBtn.click();
    await flush();

    const presentBtn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Présent');
    assert.ok(presentBtn);
    presentBtn.click();
    await flush();

    const timeInput = document.querySelector('input[type="time"]');
    setVal(timeInput, '08:25');
    const confirmPresentBtn = [...document.querySelectorAll('button')].find(b => /Marquer présent/i.test(b.textContent || ''));
    confirmPresentBtn.click();
    await flush(60);

    assert.equal(addedPresenceCalls, 0, 'While offline, addPresence must not be called immediately');
    assert.match(document.body.textContent || '', /1 en attente de synchronisation/);

    // Ouvrir le Carnet de liaison du jour sur le pointage optimiste
    const dailyBookBtn = document.querySelector('button[aria-label="Carnet de liaison du jour"]');
    assert.ok(dailyBookBtn, 'Pointed child must expose Carnet de liaison button');
    dailyBookBtn.click();
    await flush();
    assert.match(document.body.textContent || '', /Carnet de liaison du jour/);
    assert.match(document.body.textContent || '', /Soupe de légumes & poulet/);
    assert.match(document.body.textContent || '', /Éveil sensoriel/);
    const waLink = [...document.querySelectorAll('a')].find(a => (a.getAttribute('href') || '').startsWith('https://wa.me/213555123456'));
    assert.ok(waLink, 'Parent daily report must generate valid Algerian WhatsApp link');

    // Retour d'Internet -> synchronisation automatique de la file d'attente
    mockOnline = true;
    window.dispatchEvent(new dom.window.Event('online'));
    await flush(80);
    assert.equal(addedPresenceCalls, 1, 'Returning online must flush queued attendance to addPresence');

    // =========================================================================
    // 5. BRIQUE 5 : Pointage & avances sur salaire du Personnel
    // =========================================================================
    root.render(wrap(React.createElement(Personnel), directorAuth, makeDb()));
    await flush(60);
    const hrTabBtn = [...document.querySelectorAll('button')].find(b => /Pointage & Avances RH/i.test(b.textContent || ''));
    assert.ok(hrTabBtn);
    hrTabBtn.click();
    await flush();

    const defineSalaryBtn = [...document.querySelectorAll('button')].find(b => /Définir salaire/i.test(b.textContent || ''));
    defineSalaryBtn.click();
    await flush();
    const salaryInput = document.querySelector('input[placeholder="Salaire mensuel"]');
    setVal(salaryInput, '40000');
    const okSalBtn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'OK');
    okSalBtn.click();
    await flush();

    const advInput = document.querySelector('input[placeholder="Montant (DA)"]');
    setVal(advInput, '10000');
    const addAdvBtn = [...document.querySelectorAll('button')].find(b => /Ajouter l’avance/i.test(b.textContent || ''));
    addAdvBtn.closest('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    assert.match(document.body.textContent || '', /30[\s\u202f\u00a0]?000/);
    assert.ok(parametresStore.has('rh_dir-test-1'), 'Staff HR advances must persist in parametres/rh_<id>');

    // =========================================================================
    // 6. BRIQUE 6 : Alertes « Prête pour contrôle DAS » sur Dashboard
    // =========================================================================
    root.render(wrap(React.createElement(Dashboard), directorAuth, makeDb()));
    await flush(60);
    const dasBtn = [...document.querySelectorAll('button')].find(b => /Prête pour contrôle DAS/i.test(b.textContent || ''));
    assert.ok(dasBtn, 'Dashboard must render DAS compliance readiness bar');
    dasBtn.click();
    await flush();
    assert.match(document.body.textContent || '', /Lina Mansouri/);
    assert.match(document.body.textContent || '', /Carnet de vaccination/);
    assert.match(document.body.textContent || '', /Sara Amrani/);
  } finally {
    if (root) root.unmount();
    await server.close();
  }
});
