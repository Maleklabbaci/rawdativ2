import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';
import { PDFDocument } from 'pdf-lib';

// PNG 1x1 valide minimal (base64)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function makePngFile(name = 'page.png') {
  const bytes = Buffer.from(TINY_PNG_BASE64, 'base64');
  return new File([bytes], name, { type: 'image/png' });
}

test('Image-to-PDF scanner & Complete DAS Child Dossier PDF: multi-page vaccination booklet, append page, 90deg rotate, full dossier merge & UI permissions', async () => {
  process.env.VITE_ARENA_DEMO = 'false';

  globalThis.__rawdatiSupabaseClient__ = {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      upsert: async () => ({ error: null }),
    }),
  };

  const dom = new JSDOM('<!doctype html><html lang="fr"><body><div id="root"></div></body></html>', {
    url: 'http://localhost:3000/',
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
    'MouseEvent',
    'MutationObserver',
    'getComputedStyle',
  ]) {
    if (key in dom.window) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        value: key === 'getComputedStyle' ? dom.window[key].bind(dom.window) : dom.window[key],
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

  if (typeof globalThis.URL.createObjectURL !== 'function') {
    globalThis.URL.createObjectURL = () => 'blob:http://localhost:3000/mock-pdf';
    globalThis.URL.revokeObjectURL = () => {};
  }

  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  let root;

  try {
    const {
      convertFilesToStoredPdf,
      rotateStoredPdfDocument,
      buildCompleteChildDossierPdf,
      parseDataUrl,
    } = await server.ssrLoadModule('/src/utils/documentPdf.ts');

    // 1. Conversion multi-photos (3 pages de carnet de vaccination) -> 1 seul PDF A4 de 3 pages
    const carnetDoc = await convertFilesToStoredPdf({
      files: [makePngFile('vaccin-p1.png'), makePngFile('vaccin-p2.png'), makePngFile('vaccin-p3.png')],
      docKey: 'carnetVaccination',
      childName: 'Lina Mansouri',
    });

    assert.equal(carnetDoc.type, 'application/pdf');
    assert.equal(carnetDoc.nom, 'carnet-vaccination-lina-mansouri.pdf');
    assert.equal(carnetDoc.pages, 3);
    assert.ok(carnetDoc.contenu.startsWith('data:application/pdf;base64,'));

    const parsedCarnet = parseDataUrl(carnetDoc.contenu);
    assert.ok(parsedCarnet);
    const loadedCarnet = await PDFDocument.load(parsedCarnet.bytes);
    assert.equal(loadedCarnet.getPageCount(), 3);

    // 2. Ajout d'une 4e page au même PDF (+ Page)
    const appendedCarnet = await convertFilesToStoredPdf({
      files: [makePngFile('vaccin-p4.png')],
      docKey: 'carnetVaccination',
      childName: 'Lina Mansouri',
      appendTo: carnetDoc,
    });
    assert.equal(appendedCarnet.pages, 4);
    const loadedAppended = await PDFDocument.load(parseDataUrl(appendedCarnet.contenu).bytes);
    assert.equal(loadedAppended.getPageCount(), 4);

    // 3. Rotation +90° d'un certificat médical scanné
    const certifDoc = await convertFilesToStoredPdf({
      files: [makePngFile('certificat.png')],
      docKey: 'certificatMedical',
      childName: 'Lina Mansouri',
    });
    const rotatedCertif = await rotateStoredPdfDocument(certifDoc, 'certificatMedical', 'Lina Mansouri');
    const loadedRotated = await PDFDocument.load(parseDataUrl(rotatedCertif.contenu).bytes);
    assert.equal(loadedRotated.getPages()[0].getRotation().angle, 90);

    // 4. Génération du « Dossier Administratif Complet (Contrôle DAS) » (Page de garde + fusion PDF & image)
    const sampleChild = {
      id: 'c-lina',
      crecheId: 'dir-1',
      prenom: 'Lina',
      nom: 'Mansouri',
      dateNaissance: '2024-03-15',
      genre: 'Fille',
      groupeAge: 'Bébés',
      dateInscription: '2026-09-01',
      statut: 'Actif',
      groupeSanguin: 'O+',
      allergie: 'Arachides',
      medecinTraitant: 'Dr. Benali',
      parents: [
        { id: 'p1', prenom: 'Karim', nom: 'Mansouri', lien: 'Père', telephone: '0555112233' },
      ],
      contactsUrgence: [],
      documentsRequis: {
        certificatMedical: true,
        carnetVaccination: true,
        justificatifDomicile: false,
        photoIdentite: true,
      },
      documentsFichiers: {
        certificatMedical: rotatedCertif, // 1 page PDF
        carnetVaccination: appendedCarnet, // 4 pages PDF
        photoIdentite: {
          nom: 'photo.png',
          type: 'image/png',
          taille: 95,
          contenu: `data:image/png;base64,${TINY_PNG_BASE64}`, // 1 page image directe
          ajouteLe: new Date().toISOString(),
        },
      },
    };

    const fullDossier = await buildCompleteChildDossierPdf(sampleChild, {
      crecheNom: 'Crèche El Yasmine — روضة الياسمين',
    });
    assert.equal(fullDossier.fileName, 'dossier-complet-lina-mansouri.pdf');
    assert.equal(
      fullDossier.pageCount,
      1 + 1 + 4 + 1,
      'Complete dossier PDF must have 1 summary cover page + 1 certif + 4 vaccination + 1 ID photo = 7 pages'
    );
    const loadedFull = await PDFDocument.load(fullDossier.bytes);
    assert.equal(loadedFull.getPageCount(), 7);

    // 5. Rendu UI dans EnfantDetails (Admin Crèche vs Éducatrice lecture seule)
    const { createRoot } = await import('react-dom/client');
    await server.ssrLoadModule('/src/i18n.ts');
    const { LanguageProvider } = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const { AuthContext } = await server.ssrLoadModule('/src/contexts/AuthContext.tsx');
    const { DbContext } = await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const { WorkspaceProfileContext } = await server.ssrLoadModule('/src/contexts/WorkspaceProfileContext.tsx');
    const { default: EnfantDetails } = await server.ssrLoadModule('/src/components/EnfantDetails.tsx');

    root = createRoot(document.getElementById('root'));

    const renderDossier = (canEdit) =>
      root.render(
        React.createElement(
          LanguageProvider,
          null,
          React.createElement(
            ToastProvider,
            null,
            React.createElement(
              AuthContext.Provider,
              {
                value: {
                  isAuthenticated: true,
                  loading: false,
                  user: { id: 'dir-1', role: 'directeur', approvalStatus: 'approved', nomCreche: 'Crèche El Yasmine' },
                  creche: { nom: 'Crèche El Yasmine', adresse: 'Blida', logoUrl: null },
                },
              },
              React.createElement(
                DbContext.Provider,
                {
                  value: {
                    enfants: [sampleChild],
                    presences: [],
                    paiements: [],
                    repas: [],
                    activites: [],
                    financialDataReady: true,
                    updateEnfant: async () => {},
                  },
                },
                React.createElement(
                  WorkspaceProfileContext.Provider,
                  {
                    value: {
                      requiresProfileSelection: false,
                      loadingProfiles: false,
                      profiles: [],
                      activeProfile: { id: 'p', name: 'Test', hideFinancials: !canEdit },
                      isOwnerProfile: canEdit,
                      canAccessPage: () => true,
                      hasPagePermission: (_page, perm) => (perm === 'edit' ? canEdit : true),
                      unlockProfile: async () => ({ ok: true }),
                      setupOwnerPasswordAndUnlock: async () => ({ ok: true }),
                      verifyOwnerPassword: async () => true,
                      saveSubProfile: async () => ({ ok: true }),
                      deleteSubProfile: async () => {},
                      lockProfile: () => {},
                    },
                  },
                  React.createElement(EnfantDetails, { enfant: sampleChild, onClose: () => {} })
                )
              )
            )
          )
        )
      );

    renderDossier(true);
    await new Promise(r => setTimeout(r, 80));
    assert.match(document.body.textContent || '', /Voir le dossier PDF/);
    assert.match(document.body.textContent || '', /carnet-vaccination-lina-mansouri\.pdf/);
    assert.match(document.body.textContent || '', /4 p\./);
    assert.match(document.body.textContent || '', /Photo\(s\) → PDF/);

    // Clic sur « Voir » d'une pièce -> ouvre la visionneuse PDF intégrée dans la SaaS sans téléchargement forcé
    const voirPieceBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Voir');
    assert.ok(voirPieceBtn, 'Each attached PDF must expose an in-app Voir button');
    voirPieceBtn.click();
    await new Promise(r => setTimeout(r, 120));
    assert.match(document.body.textContent || '', /Lecture directe dans Rawdha\+ sans téléchargement obligatoire/);
    assert.ok(document.querySelector('[data-pdf-page="1"]'), 'In-app PDF viewer must render PDF pages directly inside the SaaS without iframe download');

    // Fermeture de la visionneuse
    const closeViewerBtn = document.querySelector('button[aria-label="Fermer l’aperçu"]');
    assert.ok(closeViewerBtn);
    closeViewerBtn.click();
    await new Promise(r => setTimeout(r, 60));

    // Clic sur « Voir le dossier PDF » -> génère et ouvre le dossier complet DAS de 7 pages dans la visionneuse SaaS
    const voirFullBtn = [...document.querySelectorAll('button')].find(b => /Voir le dossier PDF/.test(b.textContent || ''));
    assert.ok(voirFullBtn);
    voirFullBtn.click();
    await new Promise(r => setTimeout(r, 200));
    assert.match(document.body.textContent || '', /Dossier administratif complet \(DAS\) — Lina Mansouri/);
    assert.match(document.body.textContent || '', /Tout \(7\)/);
    document.querySelector('button[aria-label="Fermer l’aperçu"]')?.click();
    await new Promise(r => setTimeout(r, 60));

    // En mode Éducatrice (sans permission 'edit' sur 'enfants') : consultation directe dans la SaaS permise, pas de bouton d'upload/suppression
    renderDossier(false);
    await new Promise(r => setTimeout(r, 80));
    assert.match(document.body.textContent || '', /Voir le dossier PDF/);
    assert.match(document.body.textContent || '', /Voir/);
    assert.ok(!/Photo\(s\) → PDF/.test(document.body.textContent || ''), 'Read-only profile must not see upload buttons');
  } finally {
    if (root) root.unmount();
    await server.close();
    dom.window.close();
  }
});
