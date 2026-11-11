// Optional real-browser check against the isolated Vite demo only.
// Start VITE_ARENA_DEMO=true pnpm dev, then run with CHROMIUM_PATH set to a local Chromium executable.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const executablePath = process.env.CHROMIUM_PATH;
if (!executablePath) throw new Error('Set CHROMIUM_PATH to a locally installed Chromium executable.');
const routes = ['/dashboard', '/enfants', '/admissions', '/classes', '/presences', '/factures', '/achats', '/reports', '/personnel', '/activites', '/repas', '/communication', '/notifications', '/parametres', '/demarrage', '/aide', '/support', '/community'];
const sizes = [['mobile', 390, 844], ['tablette', 768, 1024], ['ordinateur', 1440, 900]];
const modalCases = [
  ['/enfants', 'Ajouter un enfant', 'إضافة طفل'],
  ['/classes', 'Ajouter Classe', 'إضافة فصل'],
  ['/factures', 'Créer une facture', 'إصدار فاتورة جديدة'],
  ['/achats', 'Enregistrer un achat', 'تسجيل شراء'],
  ['/repas', 'Ajouter un repas', 'إضافة وجبة'],
  ['/personnel', 'Ajouter un membre du personnel', 'إضافة موظف'],
  ['/activites', 'Ajouter une activité', 'إضافة نشاط'],
];
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  let count = 0;
  let fieldsChecked = 0;
  for (const language of ['fr', 'ar']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: language === 'ar' ? 'ar-DZ' : 'fr-FR' });
    await context.addInitScript(lang => {
      localStorage.setItem('rawdha_language', lang);
      sessionStorage.setItem('rawdha_active_subprofile', 'owner-admin');
    }, language);
    const page = await context.newPage();
    let pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    for (const route of routes) {
      pageErrors = [];
      await page.goto(`http://127.0.0.1:3000${route}`, { waitUntil: 'domcontentloaded' });
      if (route !== '/community') {
        await page.locator('main h1').first().waitFor({ timeout: 15000 });
        assert.ok(await page.getByText(language === 'ar' ? 'نسخة تجريبية ببيانات وهمية' : 'Aperçu de démonstration', { exact: false }).first().isVisible(), 'Le serveur doit être en mode démonstration.');
      } else {
        await page.locator('h1, h2').first().waitFor({ timeout: 15000 });
      }
      for (const [name, width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(400);
        const geometry = await page.evaluate(() => {
          const root = [...document.querySelectorAll('main')].at(-1) || document.body;
          const clipped = [...root.querySelectorAll('button,input,select,textarea,h1,h2,h3')].filter(element => {
            const rect = element.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1 || getComputedStyle(element).visibility === 'hidden' || (rect.left >= -1 && rect.right <= innerWidth + 1)) return false;
            for (let parent = element.parentElement; parent && parent !== root; parent = parent.parentElement) {
              if (/auto|scroll/.test(getComputedStyle(parent).overflowX) && parent.scrollWidth > parent.clientWidth + 1) return false;
            }
            return true;
          }).map(element => `${element.tagName} ${(element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 50)}`);
          return { dir: document.documentElement.dir, overflow: document.documentElement.scrollWidth - innerWidth, clipped };
        });
        assert.equal(geometry.dir, language === 'ar' ? 'rtl' : 'ltr', `${route} ${language} direction`);
        assert.ok(geometry.overflow <= 1, `${route} ${language} ${name}: débordement horizontal`);
        assert.deepEqual(geometry.clipped, [], `${route} ${language} ${name}: contrôles coupés`);
        assert.deepEqual(pageErrors, [], `${route} ${language}: erreur JavaScript`);
        count++;
      }
    }
    // At tablet width, previously clipped actions must be reachable by scrolling.
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://127.0.0.1:3000/enfants');
    await page.locator('main h1').waitFor();
    const filter = page.getByRole('button', { name: language === 'ar' ? 'الأطفال المغادرون' : 'Enfants sortis' });
    await filter.click();
    await assertInViewport(filter);
    await page.goto('http://127.0.0.1:3000/factures');
    await page.locator('main h1').waitFor();
    const invoiceAction = page.getByRole('button', { name: language === 'ar' ? 'عرض بيان الفاتورة' : 'Voir l’état de la facture' }).first();
    await invoiceAction.scrollIntoViewIfNeeded();
    await assertInViewport(invoiceAction);
    const isScrollable = await invoiceAction.evaluate(element => { const container = element.closest('.mobile-scroll-x'); return !!container && container.scrollWidth > container.clientWidth && getComputedStyle(container).overflowX === 'auto'; });
    assert.equal(isScrollable, true, 'Le tableau de factures doit défiler sur tablette.');
    // Landscape phones must retain usable menu space, including lower entries.
    await page.setViewportSize({ width: 568, height: 320 });
    await page.goto('http://127.0.0.1:3000/dashboard');
    await page.locator('main h1').waitFor();
    await page.locator('#mobile-sidebar-toggle').click();
    await page.waitForTimeout(400);
    const menuMetrics = await page.locator('aside').first().evaluate(aside => {
      const nav = aside.querySelector('nav');
      const a = aside.getBoundingClientRect(), n = nav.getBoundingClientRect();
      return { visibleNavHeight: Math.max(0, Math.min(a.bottom, n.bottom) - Math.max(a.top, n.top)), overflow: getComputedStyle(aside).overflowY };
    });
    assert.ok(menuMetrics.visibleNavHeight >= 150, `${language}: menu trop petit en paysage`);
    assert.equal(menuMetrics.overflow, 'auto');
    const menuLink = page.locator('#sidebar-tab-repas');
    await menuLink.scrollIntoViewIfNeeded();
    await assertInViewport(menuLink);
    await menuLink.click();
    await page.waitForURL('**/repas');

    // Every enabled field must be reachable without being hidden behind the footer.
    // We open and close forms without submitting anything.
    for (const [width, height] of [[320, 568], [568, 320]]) {
      await page.setViewportSize({ width, height });
      for (const [route, fr, ar] of modalCases) {
        await page.goto(`http://127.0.0.1:3000${route}`);
        await page.locator('main h1').first().waitFor();
        await page.getByRole('button', { name: language === 'ar' ? ar : fr, exact: true }).click();
        await page.waitForTimeout(350);
        const cancel = page.getByRole('button', { name: language === 'ar' ? 'إلغاء' : 'Annuler', exact: true }).last();
        const modal = cancel.locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
        const fields = modal.locator('input:not([type=hidden]):not([type=file]),textarea,select');
        for (let i = 0; i < await fields.count(); i++) {
          const field = fields.nth(i);
          if (!(await field.isVisible()) || !(await field.isEnabled())) continue;
          await field.scrollIntoViewIfNeeded();
          const obscured = await field.evaluate(element => {
            const r = element.getBoundingClientRect();
            const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
            const y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
            const hit = document.elementFromPoint(x, y);
            return !(hit === element || element.contains(hit) || hit?.contains(element));
          });
          assert.equal(obscured, false, `${route} ${language} ${width}x${height}: champ masqué`);
          fieldsChecked++;
        }
        await cancel.scrollIntoViewIfNeeded();
        await assertInViewport(cancel);
        await cancel.click();
        await cancel.waitFor({ state: 'hidden', timeout: 3000 });
      }
    }

    // Secondary director panels: Batch monthly invoices, Facture preview (all 3 templates), EnfantDetails, QuickSearchModal, SupportBubble and Community composer.
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('http://127.0.0.1:3000/factures');
    await page.locator('main h1').first().waitFor();
    const batchBtn = page.getByRole('button', { name: language === 'ar' ? 'تحضير فواتير الشهر' : 'Préparer le mois', exact: true });
    await batchBtn.scrollIntoViewIfNeeded();
    await batchBtn.click();
    await page.waitForTimeout(250);
    await assertNoClipping(page, `director:${language}:batch-monthly-invoices`);
    count++;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const openInvoiceBtn = page.getByRole('button', { name: language === 'ar' ? 'عرض بيان الفاتورة' : 'Voir l’état de la facture' }).first();
    await openInvoiceBtn.scrollIntoViewIfNeeded();
    await openInvoiceBtn.click();
    await page.waitForTimeout(250);
    for (const tplLabel of language === 'ar' ? ['الأزرق الليلي', 'روضة الأطفال', 'ألوان هادئة'] : ['Bleu nuit', 'Jardin d’enfants', 'Pastel doux']) {
      const tplBtn = page.getByRole('button', { name: tplLabel, exact: true });
      await tplBtn.scrollIntoViewIfNeeded();
      await tplBtn.click();
      await page.waitForTimeout(150);
      await assertNoClipping(page, `director:${language}:facture-${tplLabel}`);
      count++;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    await page.goto('http://127.0.0.1:3000/enfants');
    await page.locator('main h1').first().waitFor();
    const openDossierBtn = page.getByRole('button', { name: language === 'ar' ? 'عرض ملف الطفل' : 'Ouvrir le dossier de l’enfant', exact: true }).first();
    await openDossierBtn.scrollIntoViewIfNeeded();
    await openDossierBtn.click();
    await page.waitForTimeout(300);
    await assertNoClipping(page, `director:${language}:enfant-details-info`);
    count++;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    await page.goto('http://127.0.0.1:3000/dashboard');
    await page.locator('main h1').first().waitFor();
    const menuTabBtn = page.getByRole('button', { name: language === 'ar' ? 'فتح القائمة' : 'Ouvrir le menu', exact: true });
    await menuTabBtn.click();
    await page.waitForTimeout(260);
    await assertNoClipping(page, `director:${language}:mobile-menu-sheet`);
    count++;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(180);

    const quickSearchBtn = page.getByRole('button', { name: language === 'ar' ? 'بحث سريع' : 'Recherche rapide', exact: true });
    await quickSearchBtn.click();
    await page.waitForTimeout(250);
    await assertNoClipping(page, `director:${language}:quick-search`);
    count++;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const supportBtn = page.getByRole('button', { name: language === 'ar' ? 'فتح مساعد Rawdha+' : 'Ouvrir l’assistant Rawdha+' });
    assert.equal(await supportBtn.isVisible(), true, `${language}: bulle support directrice`);
    await supportBtn.click();
    await page.waitForTimeout(250);
    await assertNoClipping(page, `director:${language}:support-bubble`);
    await page.getByRole('button', { name: language === 'ar' ? 'الدليل السريع' : 'Guide rapide' }).click();
    await page.waitForURL('**/aide');
    await assertNoClipping(page, `director:${language}:support-to-aide`);

    await page.goto('http://127.0.0.1:3000/community');
    await page.locator('h1:visible, h2:visible').first().waitFor({ timeout: 15000 });
    await page.getByText(language === 'ar' ? 'ما الجديد في حضانتك؟' : 'Quoi de neuf dans votre crèche ?').click();
    await page.waitForTimeout(250);
    await assertNoClipping(page, `director:${language}:community-composer`);

    await context.close();

    // Admin persona across narrow mobile, tablet, and desktop + sub-views/modals.
    const adminCtx = await browser.newContext({ viewport: { width: 320, height: 568 }, locale: language === 'ar' ? 'ar-DZ' : 'fr-FR' });
    await adminCtx.addInitScript(lang => {
      sessionStorage.setItem('rawdha_demo_persona', 'admin');
      localStorage.setItem('rawdha_language', lang);
      localStorage.setItem('rawdha_language_selected', 'true');
    }, language);
    const adminPage = await adminCtx.newPage();
    let adminErrors = [];
    adminPage.on('pageerror', error => adminErrors.push(error.message));
    for (const adminRoute of ['/admin', '/comptes', '/notifications', '/communication', '/community', '/parametres']) {
      adminErrors = [];
      await adminPage.goto(`http://127.0.0.1:3000${adminRoute}`, { waitUntil: 'domcontentloaded' });
      await adminPage.locator('h1:visible, h2:visible').first().waitFor({ timeout: 15000 });
      assert.equal(await adminPage.getByRole('button', { name: language === 'ar' ? 'فتح مساعد Rawdha+' : 'Ouvrir l’assistant Rawdha+' }).count(), 0, 'Pas de bulle support inutile pour admin.');
      for (const [name, width, height] of [['mobile-320', 320, 568], ...sizes]) {
        await adminPage.setViewportSize({ width, height });
        await adminPage.waitForTimeout(360);
        await assertNoClipping(adminPage, `admin:${language}:${adminRoute}:${name}`);
        assert.deepEqual(adminErrors, [], `admin ${adminRoute} ${language}: erreur JavaScript`);
        count++;
      }
    }
    // Admin subviews & modals at 320x568.
    await adminPage.setViewportSize({ width: 320, height: 568 });
    await adminPage.goto('http://127.0.0.1:3000/admin');
    await adminPage.locator('main h1').first().waitFor();
    await adminPage.getByRole('button', { name: language === 'ar' ? 'إعلان جديد' : 'Nouvelle annonce' }).click();
    await adminPage.waitForURL('**/notifications');
    await assertNoClipping(adminPage, `admin:${language}:announce-nav`);
    await adminPage.goto('http://127.0.0.1:3000/admin');
    await adminPage.locator('main h1').first().waitFor();
    await adminPage.getByRole('button', { name: language === 'ar' ? /الروضات/ : /Crèches/ }).first().click();
    await adminPage.waitForTimeout(250);
    await assertNoClipping(adminPage, `admin:${language}:creches-tab`);
    await adminPage.getByRole('button', { name: language === 'ar' ? 'فتح الملف' : 'Ouvrir la fiche' }).first().click();
    await adminPage.waitForTimeout(250);
    await assertNoClipping(adminPage, `admin:${language}:creche-detail`);
    await adminPage.goto('http://127.0.0.1:3000/comptes');
    await adminPage.locator('main h1').first().waitFor();
    await adminPage.getByRole('button', { name: language === 'ar' ? 'إضافة مدير روضة' : 'Ajouter un Directeur' }).click();
    await adminPage.waitForTimeout(250);
    await assertNoClipping(adminPage, `admin:${language}:comptes-add-form`);
    await adminPage.getByRole('button', { name: language === 'ar' ? 'قبول' : 'Accepter', exact: true }).first().click();
    await adminPage.waitForTimeout(250);
    await assertNoClipping(adminPage, `admin:${language}:comptes-approve-modal`);
    await adminCtx.close();

    // Pending, expired, and guest personas across narrow mobile and desktop.
    for (const [persona, personaRoutes] of [
      ['pending', ['/dashboard', '/community']],
      ['expired', ['/dashboard']],
      ['guest', ['/', '/login', '/signin', '/privacy', '/admission']],
      ['director-profiles', ['/dashboard']],
      ['director-educatrice', ['/presences', '/enfants']],
    ]) {
      const pCtx = await browser.newContext({ viewport: { width: 320, height: 568 }, locale: language === 'ar' ? 'ar-DZ' : 'fr-FR' });
      await pCtx.addInitScript(([p, lang]) => {
        if (p === 'director-profiles') {
          sessionStorage.setItem('rawdha_demo_persona', 'director');
          sessionStorage.removeItem('rawdha_active_subprofile');
        } else if (p === 'director-educatrice') {
          sessionStorage.setItem('rawdha_demo_persona', 'director');
          sessionStorage.setItem('rawdha_active_subprofile', 'demo-educatrice-poussins');
        } else {
          sessionStorage.setItem('rawdha_demo_persona', p);
        }
        localStorage.setItem('rawdha_language', lang);
        localStorage.setItem('rawdha_language_selected', 'true');
      }, [persona, language]);
      const pPage = await pCtx.newPage();
      let pErrors = [];
      pPage.on('pageerror', error => pErrors.push(error.message));
      for (const pRoute of personaRoutes) {
        pErrors = [];
        await pPage.goto(`http://127.0.0.1:3000${pRoute}`, { waitUntil: 'domcontentloaded' });
        await pPage.locator('h1:visible, h2:visible').first().waitFor({ timeout: 15000 });
        for (const [name, width, height] of [['mobile-320', 320, 568], ['ordinateur', 1440, 900]]) {
          await pPage.setViewportSize({ width, height });
          await pPage.waitForTimeout(360);
          await assertNoClipping(pPage, `${persona}:${language}:${pRoute}:${name}`);
          assert.deepEqual(pErrors, [], `${persona} ${pRoute} ${language}: erreur JavaScript`);
          count++;
        }
      }
      await pCtx.close();
    }
  }
  console.log(`OK: ${count} vues multi-rôles (directrice, admin, en attente, expiré, public), navigation tablette/paysage et ${fieldsChecked} champs contrôlés dans 28 ouvertures de formulaires.`);
} finally {
  await browser.close();
}

async function assertNoClipping(page, label) {
  const geometry = await page.evaluate(() => {
    const clipped = [...document.querySelectorAll('button,a,input,select,textarea,h1,h2,h3')].filter(element => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1 || (rect.left >= -1 && rect.right <= innerWidth + 1)) return false;
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const ps = getComputedStyle(parent);
        if (ps.visibility === 'hidden' || ps.display === 'none') return false;
        if (/auto|scroll/.test(ps.overflowX) && parent.scrollWidth > parent.clientWidth + 1) return false;
      }
      return true;
    }).map(element => `${element.tagName} ${(element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 50)}`);
    return { overflow: document.documentElement.scrollWidth - innerWidth, clipped };
  });
  assert.ok(geometry.overflow <= 1, `${label}: débordement horizontal (${geometry.overflow}px)`);
  assert.deepEqual(geometry.clipped, [], `${label}: contrôles coupés`);
}

async function assertInViewport(locator) {
  const box = await locator.boundingBox();
  const viewport = locator.page().viewportSize();
  assert.ok(box && box.x >= -1 && box.x + box.width <= viewport.width + 1 && box.y >= -1 && box.y + box.height <= viewport.height + 1, 'Contrôle hors écran.');
}
