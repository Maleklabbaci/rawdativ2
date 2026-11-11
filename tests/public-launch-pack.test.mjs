import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { PGlite } from '@electric-sql/pglite';
import { LEGAL_CONFIG } from '../src/config/legal.ts';
import {
  buildChildrenImportTemplateCsv,
  normalizeSpreadsheetDate,
  parseDelimitedSpreadsheetText,
  parseXlsxRows,
} from '../src/utils/spreadsheetParser.ts';
import { buildPaymentReceiptPdf } from '../src/utils/paymentReceiptPdf.ts';
import {
  computeDiscountedPlanPrice,
  computeExtendedSubscriptionDate,
} from '../src/utils/subscriptionRenewal.ts';

/** Construit en mémoire une archive ZIP (.xlsx) minimale valide avec compression Deflate */
function buildMinimalXlsxZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const entries = Object.entries(files);

  const writeU16 = (buf, pos, val) => {
    buf[pos] = val & 0xff;
    buf[pos + 1] = (val >> 8) & 0xff;
  };
  const writeU32 = (buf, pos, val) => {
    buf[pos] = val & 0xff;
    buf[pos + 1] = (val >> 8) & 0xff;
    buf[pos + 2] = (val >> 16) & 0xff;
    buf[pos + 3] = (val >>> 24) & 0xff;
  };

  for (const [name, content] of entries) {
    const nameBytes = encoder.encode(name);
    const rawBytes = encoder.encode(content);
    const compressed = new Uint8Array(zlib.deflateRawSync(rawBytes));

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeU32(localHeader, 0, 0x04034b50);
    writeU16(localHeader, 4, 20);
    writeU16(localHeader, 8, 8); // deflate
    writeU32(localHeader, 18, compressed.length);
    writeU32(localHeader, 22, rawBytes.length);
    writeU16(localHeader, 26, nameBytes.length);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeU32(centralHeader, 0, 0x02014b50);
    writeU16(centralHeader, 4, 20);
    writeU16(centralHeader, 6, 20);
    writeU16(centralHeader, 10, 8); // deflate
    writeU32(centralHeader, 20, compressed.length);
    writeU32(centralHeader, 24, rawBytes.length);
    writeU16(centralHeader, 28, nameBytes.length);
    writeU32(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, compressed);
    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralSize = centralParts.reduce((s, b) => s + b.length, 0);
  const eocd = new Uint8Array(22);
  writeU32(eocd, 0, 0x06054b50);
  writeU16(eocd, 8, entries.length);
  writeU16(eocd, 10, entries.length);
  writeU32(eocd, 12, centralSize);
  writeU32(eocd, 16, offset);

  const totalLen = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

test('public launch pricing is 1 900 DA/month and BaridiMob/CCP renewal math extends dates accurately', () => {
  assert.equal(LEGAL_CONFIG.monthlyPlanPriceDzd, 1900);
  const p1 = computeDiscountedPlanPrice(1);
  assert.equal(p1.finalPrice, 1900);
  const p1Promo = computeDiscountedPlanPrice(1, 'RAWDHA500');
  assert.equal(p1Promo.finalPrice, 1400);

  const extended = computeExtendedSubscriptionDate('2028-05-10', 3);
  assert.equal(extended, '2028-08-10');
});

test('local spreadsheet parser reads real .xlsx files, Excel serial dates, and copy-paste TSV', async () => {
  const xlsxBytes = buildMinimalXlsxZip({
    'xl/sharedStrings.xml': `<?xml version="1.0" encoding="UTF-8"?>
      <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <si><t>اللقب</t></si>
        <si><t>الاسم</t></si>
        <si><t>تاريخ الميلاد</t></si>
        <si><t>الهاتف</t></si>
        <si><t>بن عيسى</t></si>
        <si><t>آدم</t></si>
        <si><t>0555123456</t></si>
      </sst>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?>
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>
          <row r="1">
            <c r="A1" t="s"><v>0</v></c>
            <c r="B1" t="s"><v>1</v></c>
            <c r="C1" t="s"><v>2</v></c>
            <c r="D1" t="s"><v>3</v></c>
          </row>
          <row r="2">
            <c r="A2" t="s"><v>4</v></c>
            <c r="B2" t="s"><v>5</v></c>
            <c r="C2"><v>45000</v></c>
            <c r="D2" t="s"><v>6</v></c>
          </row>
        </sheetData>
      </worksheet>`,
  });

  const rows = await parseXlsxRows(xlsxBytes);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], ['اللقب', 'الاسم', 'تاريخ الميلاد', 'الهاتف']);
  assert.equal(rows[1][0], 'بن عيسى');
  assert.equal(rows[1][1], 'آدم');
  assert.equal(normalizeSpreadsheetDate(rows[1][2]), '2023-03-15');

  const tsv = parseDelimitedSpreadsheetText('Nom\tPrénom\tTéléphone\nMerad\tLina\t0661987654');
  assert.equal(tsv.separator, '\t');
  assert.equal(tsv.rows.length, 2);

  const template = buildChildrenImportTemplateCsv(false);
  assert.match(template, /Nom;Prénom;Date de naissance/);
});

test('payment receipt PDF generator builds a lightweight < 80 KB PDF locally', async () => {
  const receipt = await buildPaymentReceiptPdf({
    paiement: {
      id: 'inv_2026_11_adam',
      enfantId: 'child_1',
      montant: 15000,
      statut: 'Payé',
      moisConcerne: '2026-11',
      periodeCle: 'M:2026-11',
      moyenPaiement: 'Espèces',
    },
    enfant: {
      id: 'child_1',
      nom: 'Benaissa',
      prenom: 'Adam',
      dateNaissance: '2023-03-15',
      genre: 'Garçon',
      groupeAge: 'Moyens',
      dateInscription: '2026-09-01',
      statut: 'Actif',
      parents: [{ id: 'p1', nom: 'Benaissa', prenom: 'Nadia', lien: 'Mère', telephone: '0555123456' }],
      documentsRequis: { certificatMedical: true, carnetVaccination: true, justificatifDomicile: true, photoIdentite: true },
    },
    creche: { nom: 'Crèche Les Petits Pas', adresse: 'Blida', telephone: '0555001122' },
    recordedBy: 'Directrice Nadia',
  });

  assert.equal(receipt.pageCount, 1);
  assert.ok(receipt.bytes.length > 500 && receipt.bytes.length < 80_000);
  const header = new TextDecoder().decode(receipt.bytes.subarray(0, 5));
  assert.equal(header, '%PDF-');
});

test('accounting invoice cancellation SQL migration preserves audit trail and unlocks period re-issuance', async () => {
  const read = (name) => fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
  const migrations = [
    '20261108170000_financial_write_safety.sql',
    '20261108180000_invoice_period_review.sql',
    '20261108190000_invoice_review_corrections.sql',
    '20261108220000_public_launch_storage_and_billing.sql',
  ].map(read);

  const owner = '00000000-0000-0000-0000-000000000011';
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
      create function public.rawdha_is_admin() returns boolean language sql stable as $$select false$$;
      create function public.rawdha_is_approved_director() returns boolean language sql stable as $$select true$$;
      create table public.enfants(id text primary key, data jsonb not null);
      create table public.paiements(id text primary key, data jsonb not null);
      create table public.parametres(id text primary key, data jsonb not null);
      alter table public.parametres enable row level security;
      grant usage on schema public, auth to anon, authenticated;
      grant select, insert, update, delete on public.paiements, public.parametres to anon, authenticated;
    `);
    await db.query('insert into enfants values($1, $2)', ['child_a', { crecheId: owner, statut: 'Actif' }]);
    const wrongInvoice = {
      enfantId: 'child_a',
      montant: 99000,
      statut: 'En attente',
      typeFacture: 'Mensuel',
      moisConcerne: '2026-11',
      periodeCle: 'M:2026-11',
    };
    await db.query('insert into paiements values($1, $2)', ['inv_wrong', wrongInvoice]);

    for (const sql of migrations) {
      await db.exec(sql);
    }

    await db.exec(`set role authenticated; select set_config('request.uid', '${owner}', false);`);

    // 1. Cancel the erroneous invoice with mandatory reason
    const cancelledRes = await db.query(
      'select public.rawdha_invoice_review_action($1,$2,$3,$4,$5,$6,$7,$8,$9) as r',
      ['cancel_req_1', 'cancel_invoice', 'inv_wrong', { id: 'inv_wrong', ...wrongInvoice }, null, null, null, 'Erreur de saisie du tarif', true]
    );
    const cancelled = cancelledRes.rows[0].r;
    assert.equal(cancelled.statut, 'Annulé');
    assert.equal(cancelled.motifAnnulation, 'Erreur de saisie du tarif');

    // 2. Re-issue clean invoice for the exact same month (M:2026-11) -> succeeds!
    const reissuedRes = await db.query(
      'select public.rawdha_write_invoice($1,$2,$3,$4) as r',
      [
        'create',
        'inv_clean_nov',
        {
          enfantId: 'child_a',
          montant: 15000,
          statut: 'En attente',
          typeFacture: 'Mensuel',
          moisConcerne: '2026-11',
          periodeCle: 'M:2026-11',
        },
        null,
      ]
    );
    assert.equal(reissuedRes.rows[0].r.montant, 15000);

    // 3. Audit trail preserves before & after snapshots
    const eventsRes = await db.query('select public.rawdha_list_invoice_review_events($1) as r', ['inv_wrong']);
    assert.equal(eventsRes.rows[0].r.length, 1);
    assert.equal(eventsRes.rows[0].r[0].action, 'cancel_invoice');

    // 4. Cloud sync RLS on public.parametres permits own acomptes/rh/abonnement and blocks cross-nursery writes
    await db.query('insert into public.parametres(id, data) values ($1, $2)', [`acomptes_${owner}`, { version: 1, items: [] }]);
    await db.query('insert into public.parametres(id, data) values ($1, $2)', [`rh_${owner}`, { version: 1, advances: [] }]);
    await db.query('insert into public.parametres(id, data) values ($1, $2)', [`abonnement_${owner}`, { version: 1, items: [] }]);
    await assert.rejects(() =>
      db.query('insert into public.parametres(id, data) values ($1, $2)', ['acomptes_00000000-0000-0000-0000-000000000099', { version: 1 }])
    );
  } finally {
    await db.close();
  }
});

test('1-line subscription bar below Directrice Démo navigates straight to Abonnement & Paiement page', async () => {
  const { JSDOM } = await import('jsdom');
  const { createServer } = await import('vite');
  const React = (await import('react')).default;

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
  globalThis.__rawdatiSupabaseClient__ = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        like: async () => ({ data: [], error: null }),
      }),
    }),
  };

  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  let root;
  try {
    const { createRoot } = await import('react-dom/client');
    await server.ssrLoadModule('/src/i18n.ts');
    const { LanguageProvider } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx');
    const { DbContext } = await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const { default: Sidebar } = await server.ssrLoadModule('/src/components/Sidebar.tsx');
    const { default: AbonnementPaiement } = await server.ssrLoadModule('/src/components/AbonnementPaiement.tsx');

    const demoDirector = {
      id: 'preview-director',
      prenom: 'Directrice',
      nom: 'Démo',
      email: 'demo@example.invalid',
      role: 'directeur',
      approvalStatus: 'approved',
      abonnementActif: true,
      dateFinAbonnement: '2027-09-01',
      nomCreche: 'Crèche Les Petits Soleils',
    };

    let navigatedTo = '';
    function Harness() {
      const [page, setPage] = React.useState('dashboard');
      return React.createElement(
        LanguageProvider,
        null,
        React.createElement(
          ToastProvider,
          null,
          React.createElement(
            AuthContext.Provider,
            {
              value: {
                user: demoDirector,
                creche: { nom: 'Crèche Les Petits Soleils' },
                isAuthenticated: true,
                loading: false,
                logout: async () => {},
              },
            },
            React.createElement(
              DbContext.Provider,
              {
                value: {
                  comptes: [demoDirector],
                  enfants: [],
                  presences: [],
                  paiements: [],
                  demandesAdmission: [],
                  demandesDirecteur: [],
                  communityFeatures: [],
                  notifications: [],
                },
              },
              React.createElement(
                'div',
                null,
                React.createElement(Sidebar, {
                  currentPage: page,
                  isOpen: true,
                  onPageChange: next => {
                    navigatedTo = next;
                    setPage(next);
                  },
                }),
                page === 'abonnement'
                  ? React.createElement(AbonnementPaiement, { onNavigate: setPage })
                  : null
              )
            )
          )
        )
      );
    }

    const wait = () => new Promise(resolve => setTimeout(resolve, 180));
    root = createRoot(document.getElementById('root'));
    root.render(React.createElement(Harness));
    await wait();

    const subBtn = document.querySelector('#sidebar-subscription-line');
    assert.ok(subBtn, '1-line subscription button must appear below Directrice Démo');
    assert.match(subBtn.textContent, /Abonnement · 01\/09\/27 · 1[\s\u202f\u00a0]?900 DA/);

    subBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await wait();

    assert.equal(navigatedTo, 'abonnement');
    const bodyText = document.body.textContent.replace(/\s+/g, ' ');
    assert.match(bodyText, /Abonnement & Paiement/);
    assert.match(bodyText, /Paiement par Carte CIB \/ Edahabia/);
    assert.match(bodyText, /Contacter sur WhatsApp/);
    assert.doesNotMatch(bodyText, /BaridiMob|CCP/i);
  } finally {
    root?.unmount();
    await server.close();
    dom.window.close();
    delete globalThis.__rawdatiSupabaseClient__;
  }
});
