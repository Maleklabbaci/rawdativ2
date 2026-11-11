import type { Enfant } from '../types';
import { isStorageUri, resolveStoredDocumentPayload } from './documentStorage';

export type ChildDocumentKey =
  | 'certificatMedical'
  | 'carnetVaccination'
  | 'justificatifDomicile'
  | 'photoIdentite';

export interface StoredChildDocument {
  nom: string;
  type: string;
  taille: number;
  contenu: string;
  ajouteLe: string;
  pages?: number;
}

export const MAX_STORED_DOCUMENT_BYTES = Math.floor(1.95 * 1024 * 1024); // < 2 Mo (compatibilité JSONB / RPC)

export const DOCUMENT_SLUGS: Record<ChildDocumentKey, string> = {
  certificatMedical: 'certificat-medical',
  carnetVaccination: 'carnet-vaccination',
  justificatifDomicile: 'justificatif-domicile',
  photoIdentite: 'photo-identite',
};

export const DOCUMENT_TITLES_FR: Record<ChildDocumentKey, string> = {
  certificatMedical: 'Certificat medical d’aptitude',
  carnetVaccination: 'Carnet de vaccination pediatrique',
  justificatifDomicile: 'Justificatif de domicile',
  photoIdentite: 'Fiche / Photo d’identite',
};

export function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined' && typeof window === 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export function base64ToUint8(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, '');
  if (typeof atob === 'function') {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(clean, 'base64'));
}

export function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return null;
  const header = dataUrl.slice(5, commaIdx);
  const mimeType = header.split(';')[0] || 'application/octet-stream';
  const payload = dataUrl.slice(commaIdx + 1);
  if (header.includes(';base64')) {
    return { mimeType, bytes: base64ToUint8(payload) };
  }
  const decoded = decodeURIComponent(payload);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return { mimeType, bytes };
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    const ab = await file.arrayBuffer();
    return new Uint8Array(ab);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('invalid_file_buffer'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('file_read_error'));
    reader.readAsArrayBuffer(file);
  });
}

function detectImageFormat(bytes: Uint8Array, mimeHint: string): 'png' | 'jpg' | 'other' {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  if (mimeHint.includes('png')) return 'png';
  if (mimeHint.includes('jpeg') || mimeHint.includes('jpg')) return 'jpg';
  return 'other';
}

function isPdfBuffer(bytes: Uint8Array, mimeHint: string, nameHint = ''): boolean {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return true;
  }
  return mimeHint === 'application/pdf' || nameHint.toLowerCase().endsWith('.pdf');
}

/**
 * Redimensionne et compresse une photo de smartphone en JPEG léger dans le navigateur.
 * En environnement de test JSDOM (sans moteur Canvas 2D), conserve les octets PNG/JPEG d'origine.
 */
async function compressImageForPdf(
  rawBytes: Uint8Array,
  mimeType: string,
  maxDimension: number,
  jpegQuality: number
): Promise<{ bytes: Uint8Array; format: 'jpg' | 'png' }> {
  const nativeFormat = detectImageFormat(rawBytes, mimeType);

  const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');

  if (typeof document !== 'undefined' && !isJsdom) {
    try {
      const probeCanvas = document.createElement('canvas');
      let ctx: CanvasRenderingContext2D | null = null;
      try {
        ctx = probeCanvas.getContext('2d');
      } catch {
        ctx = null;
      }

      if (ctx && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const blob = new Blob([rawBytes], { type: mimeType || 'image/jpeg' });
        const objectUrl = URL.createObjectURL(blob);
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            const timer = setTimeout(() => reject(new Error('image_load_timeout')), 4000);
            el.onload = () => {
              clearTimeout(timer);
              resolve(el);
            };
            el.onerror = () => {
              clearTimeout(timer);
              reject(new Error('image_decode_failed'));
            };
            el.src = objectUrl;
          });

          const srcW = img.naturalWidth || img.width || 800;
          const srcH = img.naturalHeight || img.height || 1000;
          const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
          const targetW = Math.max(1, Math.round(srcW * scale));
          const targetH = Math.max(1, Math.round(srcH * scale));

          probeCanvas.width = targetW;
          probeCanvas.height = targetH;
          // Fond blanc propre pour les PNG transparents (ex: signature ou photo détourée)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);

          const jpegDataUrl = probeCanvas.toDataURL('image/jpeg', jpegQuality);
          const parsed = parseDataUrl(jpegDataUrl);
          if (parsed && parsed.bytes.length > 0) {
            return { bytes: parsed.bytes, format: 'jpg' };
          }
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }
    } catch {
      // Repli direct sur les octets natifs si supportés par pdf-lib
    }
  }

  if (nativeFormat === 'png') return { bytes: rawBytes, format: 'png' };
  if (nativeFormat === 'jpg') return { bytes: rawBytes, format: 'jpg' };
  throw new Error('unsupported_image_format');
}

function slugifyPart(text?: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Nettoie une chaîne pour StandardFonts WinAnsi (pdf-lib) afin d'éviter toute exception
 * sur les apostrophes typographiques ou caractères arabes dans les métadonnées PDF.
 */
function toWinAnsiSafe(input?: string | null, fallback = '-'): string {
  if (!input) return fallback;
  const normalized = input
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ');

  let out = '';
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff)) {
      out += normalized[i];
    } else if (code === 0x0a || code === 0x0d) {
      out += ' ';
    }
  }
  const trimmed = out.replace(/\s+/g, ' ').trim();
  return trimmed || fallback;
}

/**
 * Convertit 1 ou plusieurs fichiers (photos caméra/galerie ou PDF existants) en un unique
 * document PDF A4 propre et compressé (< 2 Mo), avec possibilité d'ajouter des pages à un PDF existant.
 */
export async function convertFilesToStoredPdf(options: {
  files: File[];
  docKey: ChildDocumentKey;
  childName?: string;
  appendTo?: StoredChildDocument | null;
}): Promise<StoredChildDocument> {
  const { files, docKey, childName, appendTo } = options;
  if (!files || files.length === 0) {
    throw new Error('empty_files');
  }

  const { PDFDocument } = await import('pdf-lib');

  const rawEntries = await Promise.all(
    files.map(async file => ({
      name: file.name,
      mime: file.type || 'application/octet-stream',
      bytes: await readFileBytes(file),
    }))
  );

  // Cas simple : 1 seul PDF déjà léger sans fusion demandée
  if (
    !appendTo &&
    rawEntries.length === 1 &&
    isPdfBuffer(rawEntries[0].bytes, rawEntries[0].mime, rawEntries[0].name) &&
    rawEntries[0].bytes.length <= MAX_STORED_DOCUMENT_BYTES
  ) {
    let pageCount = 1;
    try {
      const loaded = await PDFDocument.load(rawEntries[0].bytes, { ignoreEncryption: true });
      pageCount = loaded.getPageCount();
    } catch {
      // Conserve le PDF tel quel
    }
    const base64 = uint8ToBase64(rawEntries[0].bytes);
    const childSlug = slugifyPart(childName);
    const cleanPdfName = rawEntries[0].name.toLowerCase().endsWith('.pdf')
      ? rawEntries[0].name
      : `${DOCUMENT_SLUGS[docKey]}${childSlug ? `-${childSlug}` : ''}.pdf`;

    return {
      nom: cleanPdfName,
      type: 'application/pdf',
      taille: rawEntries[0].bytes.length,
      contenu: `data:application/pdf;base64,${base64}`,
      ajouteLe: new Date().toISOString(),
      pages: pageCount,
    };
  }

  const buildPass = async (maxDim: number, quality: number) => {
    const outPdf = await PDFDocument.create();
    const PAGE_W = 595.28; // A4 portrait (pt)
    const PAGE_H = 841.89;
    const MARGIN = 28;

    // Si on ajoute une page à une pièce existante, on copie d'abord ses pages
    if (appendTo?.contenu) {
      const existingParsed = parseDataUrl(appendTo.contenu);
      if (existingParsed) {
        if (isPdfBuffer(existingParsed.bytes, appendTo.type, appendTo.nom)) {
          const prevPdf = await PDFDocument.load(existingParsed.bytes, { ignoreEncryption: true });
          const copied = await outPdf.copyPages(prevPdf, prevPdf.getPageIndices());
          copied.forEach(p => outPdf.addPage(p));
        } else {
          const compressedPrev = await compressImageForPdf(existingParsed.bytes, existingParsed.mimeType, maxDim, quality);
          const embeddedPrev =
            compressedPrev.format === 'png'
              ? await outPdf.embedPng(compressedPrev.bytes)
              : await outPdf.embedJpg(compressedPrev.bytes);
          const page = outPdf.addPage([PAGE_W, PAGE_H]);
          const ratio = Math.min(
            (PAGE_W - MARGIN * 2) / embeddedPrev.width,
            (PAGE_H - MARGIN * 2) / embeddedPrev.height,
            1
          );
          const w = embeddedPrev.width * ratio;
          const h = embeddedPrev.height * ratio;
          page.drawImage(embeddedPrev, {
            x: (PAGE_W - w) / 2,
            y: (PAGE_H - h) / 2,
            width: w,
            height: h,
          });
        }
      }
    }

    for (const entry of rawEntries) {
      if (isPdfBuffer(entry.bytes, entry.mime, entry.name)) {
        const srcPdf = await PDFDocument.load(entry.bytes, { ignoreEncryption: true });
        const copied = await outPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        copied.forEach(p => outPdf.addPage(p));
      } else {
        const compressed = await compressImageForPdf(entry.bytes, entry.mime, maxDim, quality);
        const embedded =
          compressed.format === 'png'
            ? await outPdf.embedPng(compressed.bytes)
            : await outPdf.embedJpg(compressed.bytes);

        const isPhotoId = docKey === 'photoIdentite';
        const maxBoxW = isPhotoId ? 240 : PAGE_W - MARGIN * 2;
        const maxBoxH = isPhotoId ? 300 : PAGE_H - MARGIN * 2;

        const page = outPdf.addPage([PAGE_W, PAGE_H]);
        const scale = Math.min(maxBoxW / embedded.width, maxBoxH / embedded.height);
        const drawW = embedded.width * scale;
        const drawH = embedded.height * scale;

        page.drawImage(embedded, {
          x: (PAGE_W - drawW) / 2,
          y: (PAGE_H - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      }
    }

    outPdf.setTitle(`${DOCUMENT_TITLES_FR[docKey]}${childName ? ` - ${toWinAnsiSafe(childName, '')}` : ''}`);
    outPdf.setProducer('Rawdha+ Document Scanner (pdf-lib)');

    const pdfBytes = await outPdf.save();
    return { pdfBytes, pageCount: outPdf.getPageCount() };
  };

  // Passe 1 : Haute netteté lecture administrative (1600px, JPEG 0.80)
  let result = await buildPass(1600, 0.8);

  // Passe 2 automatique si carnet multi-pages dense (> 1.95 Mo)
  if (result.pdfBytes.length > MAX_STORED_DOCUMENT_BYTES) {
    result = await buildPass(1150, 0.62);
  }
  // Passe 3 ultra-compacte si nécessaire
  if (result.pdfBytes.length > MAX_STORED_DOCUMENT_BYTES) {
    result = await buildPass(880, 0.5);
  }

  if (result.pdfBytes.length > MAX_STORED_DOCUMENT_BYTES) {
    throw new Error('document_too_large');
  }

  const childSlug = slugifyPart(childName);
  const fileName = `${DOCUMENT_SLUGS[docKey]}${childSlug ? `-${childSlug}` : ''}.pdf`;
  const base64 = uint8ToBase64(result.pdfBytes);

  return {
    nom: fileName,
    type: 'application/pdf',
    taille: result.pdfBytes.length,
    contenu: `data:application/pdf;base64,${base64}`,
    ajouteLe: new Date().toISOString(),
    pages: result.pageCount,
  };
}

/**
 * Pivote toutes les pages d'un PDF stocké de +90° (utile quand une photo de certificat a été prise de côté).
 */
export async function rotateStoredPdfDocument(
  doc: StoredChildDocument,
  docKey: ChildDocumentKey,
  childName?: string
): Promise<StoredChildDocument> {
  const parsed = isStorageUri(doc.contenu)
    ? await resolveStoredDocumentPayload(doc.contenu, doc.type || 'application/pdf')
    : parseDataUrl(doc.contenu);
  if (!parsed) throw new Error('invalid_stored_document');

  const { PDFDocument, degrees } = await import('pdf-lib');
  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;

  if (isPdfBuffer(parsed.bytes, doc.type, doc.nom)) {
    pdfDoc = await PDFDocument.load(parsed.bytes, { ignoreEncryption: true });
  } else {
    // Convertit d'abord une ancienne image stockée en PDF avant rotation
    const blob = new Blob([parsed.bytes], { type: parsed.mimeType });
    const pseudoFile = new File([blob], doc.nom || 'piece.jpg', { type: parsed.mimeType });
    const converted = await convertFilesToStoredPdf({ files: [pseudoFile], docKey, childName });
    const convParsed = parseDataUrl(converted.contenu)!;
    pdfDoc = await PDFDocument.load(convParsed.bytes, { ignoreEncryption: true });
  }

  for (const page of pdfDoc.getPages()) {
    const currentAngle = page.getRotation().angle || 0;
    page.setRotation(degrees((currentAngle + 90) % 360));
  }

  const savedBytes = await pdfDoc.save();
  return {
    ...doc,
    nom: doc.nom.toLowerCase().endsWith('.pdf') ? doc.nom : `${DOCUMENT_SLUGS[docKey]}.pdf`,
    type: 'application/pdf',
    taille: savedBytes.length,
    contenu: `data:application/pdf;base64,${uint8ToBase64(savedBytes)}`,
    ajouteLe: new Date().toISOString(),
    pages: pdfDoc.getPageCount(),
  };
}

/**
 * Génère en 1 clic le « Dossier Administratif Complet (Contrôle DAS) » d'un enfant en un seul PDF :
 * - Page 1 : Fiche récapitulative officielle (identité, santé, parents, état des 4 pièces réglementaires)
 * - Pages suivantes : Fusion intégrale de toutes les pièces jointes disponibles (certificat, carnet de vaccination, justificatif, photo d'identité).
 */
export async function buildCompleteChildDossierPdf(
  enfant: Enfant,
  options?: { crecheNom?: string }
): Promise<{ bytes: Uint8Array; fileName: string; pageCount: number }> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const cover = pdfDoc.addPage([PAGE_W, PAGE_H]);

  const petrol = rgb(0.145, 0.263, 0.298); // #25434c
  const terracotta = rgb(0.788, 0.294, 0.188); // #c94b30
  const slateDark = rgb(0.09, 0.13, 0.2);
  const slateMuted = rgb(0.39, 0.45, 0.54);
  const lightBg = rgb(0.975, 0.965, 0.953);
  const greenOk = rgb(0.04, 0.49, 0.33);
  const redMissing = rgb(0.75, 0.18, 0.24);

  // Bandeau supérieur
  cover.drawRectangle({
    x: 0,
    y: PAGE_H - 96,
    width: PAGE_W,
    height: 96,
    color: petrol,
  });

  const crecheLabel = toWinAnsiSafe(options?.crecheNom, 'Etablissement d’accueil petite enfance');
  cover.drawText(crecheLabel.toUpperCase(), {
    x: 40,
    y: PAGE_H - 42,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  cover.drawText('DOSSIER ADMINISTRATIF & MEDICAL DE L’ENFANT (CONTROLE DAS)', {
    x: 40,
    y: PAGE_H - 64,
    size: 10.5,
    font: fontRegular,
    color: rgb(0.92, 0.86, 0.82),
  });
  cover.drawText(`Edite le : ${new Date().toISOString().slice(0, 10)}`, {
    x: 40,
    y: PAGE_H - 82,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.8, 0.86, 0.88),
  });

  let y = PAGE_H - 130;

  const drawSectionHeader = (title: string) => {
    cover.drawRectangle({
      x: 40,
      y: y - 6,
      width: PAGE_W - 80,
      height: 22,
      color: lightBg,
    });
    cover.drawText(title, {
      x: 48,
      y: y,
      size: 10,
      font: fontBold,
      color: terracotta,
    });
    y -= 26;
  };

  const drawKeyValue = (label: string, value: string, xOffset = 48) => {
    cover.drawText(`${label} :`, {
      x: xOffset,
      y,
      size: 9.5,
      font: fontBold,
      color: slateMuted,
    });
    cover.drawText(toWinAnsiSafe(value, 'Non renseigne').slice(0, 68), {
      x: xOffset + 135,
      y,
      size: 9.5,
      font: fontRegular,
      color: slateDark,
    });
    y -= 17;
  };

  // 1. Identité
  drawSectionHeader('1. IDENTITE & INSCRIPTION DE L’ENFANT');
  const fullChildName = `${enfant.prenom || ''} ${enfant.nom || ''}`.trim();
  drawKeyValue('Nom & Prenom', fullChildName);
  drawKeyValue('Date de naissance', enfant.dateNaissance || '-');
  drawKeyValue('Genre / Section', `${enfant.genre || '-'} / ${enfant.groupeAge || '-'}`);
  drawKeyValue('Date d’admission', enfant.dateInscription || '-');
  drawKeyValue('Statut du dossier', enfant.statut || 'Actif');
  y -= 8;

  // 2. Informations médicales
  drawSectionHeader('2. FICHE SANTE & PRECAUTIONS MEDICALES');
  drawKeyValue('Groupe sanguin', enfant.groupeSanguin || 'Non renseigne');
  drawKeyValue('Medecin traitant', enfant.medecinTraitant || 'Non renseigne');
  drawKeyValue('Allergies signalees', enfant.allergie || 'Aucune allergie signalee');
  drawKeyValue('Regime alimentaire', enfant.regimeAlimentaire || 'Standard');
  drawKeyValue('Suivi vaccinations', enfant.vaccinations || 'Voir carnet joint');
  y -= 8;

  // 3. Parents & responsables légaux
  drawSectionHeader('3. PARENTS / REPRESENTANTS LEGAUX');
  if (Array.isArray(enfant.parents) && enfant.parents.length > 0) {
    for (const parent of enfant.parents.slice(0, 3)) {
      const pName = `${parent.prenom || ''} ${parent.nom || ''}`.trim();
      drawKeyValue(
        toWinAnsiSafe(parent.lien, 'Parent'),
        `${pName} - Tel : ${parent.telephone || '-'}${parent.profession ? ` (${parent.profession})` : ''}`
      );
    }
  } else {
    drawKeyValue('Responsable legal', 'Non renseigne');
  }
  y -= 8;

  // 4. Récapitulatif des pièces réglementaires
  drawSectionHeader('4. PIECES REGLEMENTAIRES DU DOSSIER');

  const docKeys: ChildDocumentKey[] = [
    'certificatMedical',
    'carnetVaccination',
    'justificatifDomicile',
    'photoIdentite',
  ];

  const reqFlags = enfant.documentsRequis || {
    certificatMedical: false,
    carnetVaccination: false,
    justificatifDomicile: false,
    photoIdentite: false,
  };
  const attachedMap = enfant.documentsFichiers || {};

  for (const key of docKeys) {
    const fileItem = attachedMap[key];
    const isPresent = Boolean(fileItem || reqFlags[key]);
    const statusText = fileItem
      ? `JOINT AU PDF (${fileItem.pages ? `${fileItem.pages} p.` : 'piece numerisee'})`
      : reqFlags[key]
        ? 'DECLARE REMIS (papier)'
        : 'MANQUANT';

    cover.drawText(`• ${DOCUMENT_TITLES_FR[key]}`, {
      x: 48,
      y,
      size: 9.5,
      font: fontBold,
      color: slateDark,
    });
    cover.drawText(statusText, {
      x: 330,
      y,
      size: 9,
      font: fontBold,
      color: isPresent ? greenOk : redMissing,
    });
    y -= 18;
  }

  cover.drawText(
    'Document genere localement par Rawdha+ pour archivage interne et presentation reglementaire.',
    {
      x: 40,
      y: 32,
      size: 8,
      font: fontRegular,
      color: slateMuted,
    }
  );

  // Fusion de toutes les pièces numériques rattachées à la suite de la page de garde
  for (const key of docKeys) {
    const attached = attachedMap[key];
    if (!attached?.contenu) continue;
    const parsed = isStorageUri(attached.contenu)
      ? await resolveStoredDocumentPayload(attached.contenu, attached.type || 'application/pdf')
      : parseDataUrl(attached.contenu);
    if (!parsed) continue;

    try {
      if (isPdfBuffer(parsed.bytes, attached.type, attached.nom)) {
        const subPdf = await PDFDocument.load(parsed.bytes, { ignoreEncryption: true });
        const copiedPages = await pdfDoc.copyPages(subPdf, subPdf.getPageIndices());
        copiedPages.forEach(p => pdfDoc.addPage(p));
      } else {
        const compressed = await compressImageForPdf(parsed.bytes, parsed.mimeType, 1500, 0.82);
        const img =
          compressed.format === 'png'
            ? await pdfDoc.embedPng(compressed.bytes)
            : await pdfDoc.embedJpg(compressed.bytes);
        const p = pdfDoc.addPage([PAGE_W, PAGE_H]);
        p.drawText(`Annexe : ${DOCUMENT_TITLES_FR[key]} - ${toWinAnsiSafe(fullChildName, '')}`, {
          x: 36,
          y: PAGE_H - 32,
          size: 10,
          font: fontBold,
          color: petrol,
        });
        const maxW = PAGE_W - 72;
        const maxH = PAGE_H - 90;
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const drawW = img.width * ratio;
        const drawH = img.height * ratio;
        p.drawImage(img, {
          x: (PAGE_W - drawW) / 2,
          y: (PAGE_H - 44 - drawH) / 2 + 12,
          width: drawW,
          height: drawH,
        });
      }
    } catch {
      // Ignore une pièce corrompue sans bloquer le reste du dossier
    }
  }

  const finalBytes = await pdfDoc.save();
  const slug = slugifyPart(fullChildName) || 'enfant';
  return {
    bytes: finalBytes,
    fileName: `dossier-complet-${slug}.pdf`,
    pageCount: pdfDoc.getPageCount(),
  };
}

/**
 * Ouvre proprement une pièce stockée (PDF ou image) dans un nouvel onglet via Blob URL.
 */
export function openStoredDocumentInBrowser(doc: StoredChildDocument): void {
  const parsed = parseDataUrl(doc.contenu);
  if (!parsed || typeof window === 'undefined') return;
  const blob = new Blob([parsed.bytes], { type: doc.type || parsed.mimeType || 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/**
 * Télécharge une pièce stockée ou un tableau d'octets PDF sur l'appareil.
 */
export function triggerDocumentDownload(bytesOrDoc: Uint8Array | StoredChildDocument, fileNameHint?: string): void {
  if (typeof document === 'undefined') return;

  const downloadBlob = (bytes: Uint8Array, mime: string, fileName: string) => {
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
  };

  if (bytesOrDoc instanceof Uint8Array) {
    downloadBlob(bytesOrDoc, 'application/pdf', fileNameHint || 'document.pdf');
    return;
  }

  const fileName = bytesOrDoc.nom || fileNameHint || 'document.pdf';
  if (isStorageUri(bytesOrDoc.contenu)) {
    void resolveStoredDocumentPayload(bytesOrDoc.contenu, bytesOrDoc.type || 'application/pdf').then(payload => {
      if (payload) {
        downloadBlob(payload.bytes, bytesOrDoc.type || payload.mimeType || 'application/pdf', fileName);
      }
    });
    return;
  }

  const parsed = parseDataUrl(bytesOrDoc.contenu);
  if (!parsed) return;
  downloadBlob(parsed.bytes, bytesOrDoc.type || parsed.mimeType || 'application/pdf', fileName);
}
