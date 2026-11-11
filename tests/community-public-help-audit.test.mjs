import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('HelpCenterModal Arabic coverage and Community private message failure handling + double-submit guard', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3000', pretendToBeVisual: true });
  for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    if (key in dom.window) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        value: ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key],
      });
    }
  }
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.scrollTo = () => {};
  localStorage.setItem('rawdha_language', 'ar');
  globalThis.__rawdatiSupabaseClient__ = { rpc: async () => ({ error: null }) };

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
    const { default: HelpCenterModal } = await server.ssrLoadModule('/src/components/HelpCenterModal.tsx');
    const { default: Community } = await server.ssrLoadModule('/src/components/Community.tsx');

    let featureCalls = 0;
    let shouldFail = true;
    const db = {
      enfants: [],
      comptes: [
        { id: 'd1', nom: 'مديرة', prenom: 'أولى', email: 'd1@rawdha.dz', role: 'directeur', approvalStatus: 'approved', abonnementActif: true, nomCreche: 'روضة الياسمين' },
        { id: 'd2', nom: 'زميلة', prenom: 'سلمى', email: 'd2@rawdha.dz', role: 'directeur', approvalStatus: 'approved', abonnementActif: true, nomCreche: 'روضة الربيع' },
      ],
      communityPosts: [],
      communityComments: [],
      communityReactions: [],
      communityFeatures: [],
      addCommunityPost: async () => {},
      repostCommunityPost: async () => {},
      updateCommunityPost: async () => {},
      deleteCommunityPost: async () => {},
      addCommunityComment: async () => {},
      deleteCommunityComment: async () => {},
      toggleCommunityReaction: async () => {},
      addCommunityFeature: async () => {
        featureCalls++;
        await new Promise((r) => setTimeout(r, 40));
        if (shouldFail) throw new Error('انقطاع الشبكة');
      },
      markCommunityFeatureRead: async () => {},
      deleteCommunityFeature: async () => {},
      logAdminAction: async () => {},
    };

    const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
    root = createRoot(document.getElementById('root'));
    root.render(
      React.createElement(LanguageProvider, null,
        React.createElement(ToastProvider, null,
          React.createElement(ConfirmProvider, null,
            React.createElement(AuthContext.Provider, { value: { user: db.comptes[0], creche: { nom: 'روضة الياسمين' }, updateProfile: async () => {} } },
              React.createElement(DbContext.Provider, { value: db },
                React.createElement(React.Fragment, null,
                  React.createElement(HelpCenterModal, { isOpen: true, onClose: () => {}, currentPage: 'admissions', language: 'ar' }),
                  React.createElement(HelpCenterModal, { isOpen: true, onClose: () => {}, currentPage: 'unknown-page', language: 'ar' }),
                  React.createElement(Community),
                  React.createElement(ToastContainer),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await wait();
    // Verify Arabic help modal entries & fallback contain zero French fallback text
    assert.match(document.body.textContent, /طلبات التسجيل/);
    assert.match(document.body.textContent, /منصة تسيير الحضانة/);
    assert.doesNotMatch(document.body.textContent, /Votre plateforme de gestion/);

    // Switch Community to Messages, pick recipient d2, and send a message while network fails
    const msgTab = document.querySelector('button[aria-label="الرسائل"]');
    assert.ok(msgTab);
    msgTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(80);
    const newMessage = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('رسالة جديدة'));
    assert.ok(newMessage);
    newMessage.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(80);
    const recipientBtn = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').includes('سلمى زميلة'));
    assert.ok(recipientBtn);
    recipientBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(80);

    const textarea = document.querySelector('textarea');
    assert.ok(textarea);
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'مرحبا زميلة');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(50);

    const form = textarea.closest('form');
    assert.ok(form);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await wait(120);

    assert.equal(featureCalls, 1, 'Double submit on private message must be blocked');
    assert.equal(textarea.value, 'مرحبا زميلة', 'Draft must be preserved when send fails');
    assert.match(document.body.textContent, /انقطاع الشبكة/, 'Error toast must surface instead of failing silently');
  } finally {
    root?.unmount();
    await server.close();
    dom.window.close();
    delete globalThis.__rawdatiSupabaseClient__;
  }
});
