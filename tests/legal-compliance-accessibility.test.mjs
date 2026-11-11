import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('20-point legal, privacy, consent, transparency & accessibility compliance in FR and AR', async () => {
  process.env.VITE_ARENA_DEMO = 'false';
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost:3000/privacy',
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

  let invokedDirectorBody = null;
  let submittedAdmissionPayload = null;
  globalThis.__rawdatiSupabaseClient__ = {
    functions: {
      invoke: async (_fn, { body }) => {
        invokedDirectorBody = body;
        return { data: { ok: true }, error: null };
      },
    },
    rpc: async (fn, args) => {
      if (fn === 'rawdha_get_inscription_context') {
        return { data: { linkId: 'lnk-1', nomCreche: 'Crèche El Yasmine', adresse: 'Blida' }, error: null };
      }
      if (fn === 'rawdha_submit_admission') {
        submittedAdmissionPayload = args.p_payload;
        return { data: { ok: true }, error: null };
      }
      return { data: null, error: null };
    },
  };

  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });
  let root;

  try {
    const { createRoot } = await import('react-dom/client');
    await server.ssrLoadModule('/src/i18n.ts');
    const { LanguageProvider, useLanguage } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx');
    const { DbContext } = await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const { isLegalPathname, resolveInitialLegalTab, LEGAL_CONFIG } = await server.ssrLoadModule('/src/config/legal.ts');
    const { default: CookieConsentBanner } = await server.ssrLoadModule('/src/components/CookieConsentBanner.tsx');
    const { default: PrivacyPolicy } = await server.ssrLoadModule('/src/components/PrivacyPolicy.tsx');
    const { default: LandingPage } = await server.ssrLoadModule('/src/components/LandingPage.tsx');
    const { default: SignIn } = await server.ssrLoadModule('/src/components/SignIn.tsx');
    const { default: PublicAdmission } = await server.ssrLoadModule('/src/components/PublicAdmission.tsx');
    const { default: Support } = await server.ssrLoadModule('/src/components/Support.tsx');

    // 1. Legal path routing helpers
    assert.equal(isLegalPathname('/privacy'), true);
    assert.equal(isLegalPathname('/confidentialite/'), true);
    assert.equal(isLegalPathname('/cgu'), true);
    assert.equal(isLegalPathname('/suppression-donnees'), true);
    assert.equal(resolveInitialLegalTab('/suppression-donnees', ''), 'suppression');
    assert.equal(resolveInitialLegalTab('/confidentialite', '?tab=remboursement'), 'remboursement');
    assert.equal(LEGAL_CONFIG.officialEmail, '', 'Must not invent a fake official email before user configures one');

    const wait = (ms = 90) => new Promise(resolve => setTimeout(resolve, ms));
    const click = el => {
      assert.ok(el, 'Expected clickable element');
      el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    };
    const setVal = (el, val) => {
      assert.ok(el, 'Expected input/textarea element');
      const proto =
        el.tagName === 'TEXTAREA'
          ? dom.window.HTMLTextAreaElement.prototype
          : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    };

    let switchLang;
    function LangCtrl() {
      switchLang = useLanguage().setLanguage;
      return null;
    }

    root = createRoot(document.getElementById('root'));

    // 2. CookieConsentBanner + PrivacyPolicy (all 5 tabs + data deletion form)
    root.render(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(LangCtrl),
        React.createElement(PrivacyPolicy),
        React.createElement(CookieConsentBanner)
      )
    );
    await wait();

    assert.ok(document.querySelector('a.rawdha-skip-link[href="#main-content"]'), 'Expected keyboard skip link');
    assert.match(document.body.textContent, /18-07/);
    assert.match(document.body.textContent, /stockage technique strictement nécessaire/);

    // Dismiss cookie banner and check localStorage persistence
    const ackBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Compris'));
    click(ackBtn);
    await wait(50);
    assert.equal(localStorage.getItem(LEGAL_CONFIG.cookieNoticeStorageKey), 'essential_only');
    assert.equal(
      [...document.querySelectorAll('button')].find(b => b.textContent.includes('Compris')),
      undefined
    );

    // Navigate across all legal tabs
    click([...document.querySelectorAll('button')].find(b => b.textContent.includes('Conditions (CGU)')));
    await wait(50);
    assert.match(document.body.textContent, /zéro frais caché/i);

    click([...document.querySelectorAll('button')].find(b => b.textContent.includes('Abonnement & remboursement')));
    await wait(50);
    assert.match(document.body.textContent, /7 jours ouvrés/);

    click([...document.querySelectorAll('button')].find(b => b.textContent.includes('Cookies, SDK & mentions')));
    await wait(50);
    assert.match(document.body.textContent, /SIL Open Font License/);
    assert.match(document.body.textContent, /\+213 697 66 09 69/);

    click([...document.querySelectorAll('button')].find(b => b.textContent.includes('Suppression & résiliation')));
    await wait(50);
    const copyReqBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Copier le texte'));
    assert.equal(copyReqBtn.disabled, true);
    const inputs = [...document.querySelectorAll('input[type="text"]')];
    setVal(inputs[0], 'Nadia Benaissa');
    setVal(inputs[1], '0555123456');
    setVal(inputs[2], 'Crèche El Yasmine');
    await wait(50);
    assert.equal(copyReqBtn.disabled, false);

    // Switch Legal Center to Arabic RTL
    switchLang('ar');
    await wait(60);
    assert.equal(document.documentElement.dir, 'rtl');
    assert.match(document.body.textContent, /المركز القانوني وحماية البيانات/);

    // 3. LandingPage: bilingual hero alt text, transparent pricing, legal footer
    root.render(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(LangCtrl),
        React.createElement(LandingPage, { onNavigate() {} })
      )
    );
    await wait(60);
    const heroImgAr = document.querySelector('#plateforme img');
    assert.equal(heroImgAr.getAttribute('alt'), 'طفل يكتشف ألعاباً تعليمية في الحضانة');
    assert.match(document.querySelector('footer').textContent, /حذف البيانات/);
    assert.match(document.body.textContent, /1900 د\.ج/);

    switchLang('fr');
    await wait(60);
    assert.equal(
      document.querySelector('#plateforme img').getAttribute('alt'),
      'Enfant découvrant des jeux éducatifs à la crèche'
    );
    assert.match(document.querySelector('footer').textContent, /Suppression des données/);

    // 4. SignIn request mode: explicit consent checkbox required (#6)
    root.render(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(
          AuthContext.Provider,
          { value: { loginWithCredentials: async () => ({ user: null, error: null }) } },
          React.createElement(SignIn, { mode: 'request' })
        )
      )
    );
    await wait(80);
    setVal(document.querySelector('input[placeholder="Nadia"]'), 'Nadia');
    setVal(document.querySelector('input[placeholder="Benaissa"]'), 'Benaissa');
    setVal(document.querySelector('input[type="email"]'), 'nadia@creche.dz');
    setVal(document.querySelector('input[placeholder="Les Petits Pas"]'), 'Les Petits Pas');
    setVal(document.querySelector('input[type="tel"]'), '0555123456');
    setVal(document.querySelector('textarea'), 'Rue des Roses, Blida');
    const pwds = [...document.querySelectorAll('input[type="password"]')];
    setVal(pwds[0], 'Secret1234');
    setVal(pwds[1], 'Secret1234');
    await wait(50);

    document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await wait(60);
    assert.equal(invokedDirectorBody, null, 'Must block director request before consent checkbox is checked');
    assert.match(document.body.textContent, /Conditions d’utilisation/);

    const termsBox = document.querySelector('input[type="checkbox"]');
    click(termsBox);
    await wait(40);
    document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await wait(80);
    assert.equal(invokedDirectorBody?.email, 'nadia@creche.dz');

    // 5. PublicAdmission: parental authority (#17) + data consent (#6) both mandatory
    window.history.replaceState({}, '', '/admission?token=valid-token-123');
    root.render(React.createElement(LanguageProvider, null, React.createElement(PublicAdmission)));
    await wait(140);

    const admInputs = [...document.querySelectorAll('input:not([type="checkbox"]):not([type="file"])')];
    // nom, prenom, dateNaissance, bloodGroup, weightKg, pediatrician, parentNom, parentPrenom, parentTelephone
    setVal(admInputs[0], 'Amrani');
    setVal(admInputs[1], 'Lina');
    setVal(admInputs[2], '2023-05-10');
    setVal(admInputs[6], 'Amrani');
    setVal(admInputs[7], 'Samira');
    setVal(admInputs[8], '0555987654');
    await wait(50);

    const allCheckboxes = [...document.querySelectorAll('input[type="checkbox"]')];
    const parentalAuthorityBox = allCheckboxes.at(-2);
    const dataConsentBox = allCheckboxes.at(-1);
    assert.equal(parentalAuthorityBox.checked, false);
    assert.equal(dataConsentBox.checked, false);

    // Submit without parental authority -> blocked
    document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await wait(60);
    assert.equal(submittedAdmissionPayload, null);
    assert.match(document.body.textContent, /représentant légal habilité/);

    // Check parental authority only, leave data consent unchecked -> still blocked
    click(parentalAuthorityBox);
    await wait(40);
    document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await wait(60);
    assert.equal(submittedAdmissionPayload, null);
    assert.match(document.body.textContent, /accepter le traitement des données/);

    // Check data consent -> succeeds!
    click(dataConsentBox);
    await wait(40);
    document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await wait(90);
    assert.equal(submittedAdmissionPayload?.attestationAutoriteParentale, true);
    assert.equal(submittedAdmissionPayload?.consentementDonnees, true);

    // 6. Support: in-app Unsubscribe (#18) & Data Deletion (#20)
    const sentSignals = [];
    window.history.replaceState({}, '', '/support');
    root.render(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(
          AuthContext.Provider,
          { value: { user: { id: 'dir-1', prenom: 'Amira', nom: 'Khellaf', email: 'amira@creche.dz', nomCreche: 'Crèche Nour' } } },
          React.createElement(
            DbContext.Provider,
            {
              value: {
                messages: [],
                avis: [],
                signalements: [],
                addMessage: async () => {},
                addAvis: async () => {},
                addSignalement: async payload => {
                  sentSignals.push(payload);
                },
              },
            },
            React.createElement(Support)
          )
        )
      )
    );
    await wait(80);

    click([...document.querySelectorAll('button')].find(b => b.textContent.includes('Ne pas renouveler mon abonnement')));
    await wait(40);
    click([...document.querySelectorAll('button')].find(b => b.textContent.includes('Confirmer la demande')));
    await wait(70);
    assert.equal(sentSignals.length, 1);
    assert.match(sentSignals[0].titre, /non-renouvellement/);

    click([...document.querySelectorAll('button')].find(b => b.textContent.includes('Demander la suppression des données')));
    await wait(40);
    click([...document.querySelectorAll('button')].find(b => b.textContent.includes('Confirmer la demande')));
    await wait(70);
    assert.equal(sentSignals.length, 2);
    assert.match(sentSignals[1].titre, /suppression de compte/);
  } finally {
    root?.unmount();
    await server.close();
    dom.window.close();
    delete globalThis.__rawdatiSupabaseClient__;
  }
});
