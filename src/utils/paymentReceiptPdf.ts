import type { Enfant, Paiement } from '../types';
import type { InvoiceInstallment } from '../components/InvoiceInstallmentsModal';
import { formatPaymentMethodLabel, invoicePeriod, localizeInvoicePeriodText } from './financePeriod';

function toPdfAsciiSafe(raw?: string | null, fallback = '-'): string {
  const value = (raw || '').trim();
  if (!value) return fallback;
  const cleaned = value
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u202F]/g, ' ')
    // Supprime les caractères hors plage WinAnsi (ex: arabe ou emojis) pour Helvetica pdf-lib
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, '')
    .trim();
  return cleaned || fallback;
}

function formatDzdAscii(amount: number): string {
  if (!Number.isFinite(amount)) return '0 DA';
  const rounded = Math.round(amount);
  const parts = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${rounded < 0 ? '-' : ''}${parts} DA`;
}

export interface BuildPaymentReceiptOptions {
  paiement: Paiement;
  enfant?: Enfant;
  creche?: {
    nom?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
  } | null;
  installments?: InvoiceInstallment[];
  focusInstallment?: InvoiceInstallment;
  recordedBy?: string;
}

export async function buildPaymentReceiptPdf(
  options: BuildPaymentReceiptOptions
): Promise<{ bytes: Uint8Array; fileName: string; receiptNumber: string; pageCount: number }> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28; // A4
  const PAGE_H = 841.89;
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  const indigoDark = rgb(0.14, 0.19, 0.42);
  const emerald = rgb(0.04, 0.49, 0.33);
  const amber = rgb(0.72, 0.41, 0.05);
  const slateDark = rgb(0.09, 0.13, 0.2);
  const slateMuted = rgb(0.42, 0.47, 0.56);
  const softBg = rgb(0.968, 0.976, 0.992);
  const borderGray = rgb(0.85, 0.88, 0.92);

  const { paiement, enfant, creche, installments = [], focusInstallment } = options;

  const todayIso = new Date().toISOString().slice(0, 10);
  const receiptNumber = focusInstallment?.receiptNumber
    || `REC-${todayIso.slice(0, 4)}-${paiement.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || '0001'}`;

  const crecheName = toPdfAsciiSafe(creche?.nom, 'Etablissement Petite Enfance - Rawdha+');
  const crecheSub = [
    toPdfAsciiSafe(creche?.adresse, ''),
    toPdfAsciiSafe(creche?.telephone, ''),
  ]
    .filter(v => v && v !== '-')
    .join('  |  ');

  // 1. Bandeau supérieur officiel
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 104,
    width: PAGE_W,
    height: 104,
    color: indigoDark,
  });

  page.drawText(crecheName.toUpperCase().slice(0, 56), {
    x: 40,
    y: PAGE_H - 40,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  if (crecheSub) {
    page.drawText(crecheSub.slice(0, 80), {
      x: 40,
      y: PAGE_H - 58,
      size: 9,
      font: fontRegular,
      color: rgb(0.82, 0.86, 0.96),
    });
  }

  page.drawText('BON / RECU DE PAIEMENT', {
    x: 40,
    y: PAGE_H - 82,
    size: 11.5,
    font: fontBold,
    color: rgb(0.68, 0.95, 0.84),
  });

  page.drawText(`N° : ${toPdfAsciiSafe(receiptNumber)}`, {
    x: PAGE_W - 195,
    y: PAGE_H - 44,
    size: 10.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Date : ${toPdfAsciiSafe(focusInstallment?.date || todayIso)}`, {
    x: PAGE_W - 195,
    y: PAGE_H - 64,
    size: 9.5,
    font: fontRegular,
    color: rgb(0.86, 0.89, 0.98),
  });

  let y = PAGE_H - 134;

  // 2. Bloc Enfant & Parent
  page.drawRectangle({
    x: 40,
    y: y - 76,
    width: PAGE_W - 80,
    height: 76,
    color: softBg,
    borderColor: borderGray,
    borderWidth: 1,
  });

  const childFullName = enfant
    ? toPdfAsciiSafe(`${enfant.prenom} ${enfant.nom}`, 'Enfant inscrit')
    : 'Dossier enfant';
  const childGroup = toPdfAsciiSafe(enfant?.groupeAge, 'Non precise');
  const primaryParent = enfant?.parents?.[0];
  const parentLabel = primaryParent
    ? toPdfAsciiSafe(`${primaryParent.prenom} ${primaryParent.nom}`.trim(), 'Parent / Responsable')
    : 'Parent / Responsable';
  const parentPhone = toPdfAsciiSafe(primaryParent?.telephone, '-');

  page.drawText('ENFANT BENEFICIAIRE', {
    x: 54,
    y: y - 20,
    size: 8.5,
    font: fontBold,
    color: slateMuted,
  });
  page.drawText(childFullName.slice(0, 42), {
    x: 54,
    y: y - 38,
    size: 12,
    font: fontBold,
    color: slateDark,
  });
  page.drawText(`Section : ${childGroup}`, {
    x: 54,
    y: y - 56,
    size: 9.5,
    font: fontRegular,
    color: slateMuted,
  });

  page.drawText('PARENT / RESPONSABLE', {
    x: 315,
    y: y - 20,
    size: 8.5,
    font: fontBold,
    color: slateMuted,
  });
  page.drawText(parentLabel.slice(0, 38), {
    x: 315,
    y: y - 38,
    size: 11,
    font: fontBold,
    color: slateDark,
  });
  page.drawText(`Tel : ${parentPhone}`, {
    x: 315,
    y: y - 56,
    size: 9.5,
    font: fontRegular,
    color: slateMuted,
  });

  y -= 104;

  // 3. Détail Financier
  const invoiceTotal = Math.max(0, Number(paiement.montant) || 0);
  const sumInstallments = installments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalSettled =
    paiement.statut === 'Payé'
      ? Math.max(invoiceTotal, sumInstallments)
      : Math.min(invoiceTotal, sumInstallments);
  const remaining = Math.max(0, invoiceTotal - totalSettled);
  const thisPaymentAmount = focusInstallment
    ? focusInstallment.amount
    : totalSettled > 0
    ? totalSettled
    : invoiceTotal;

  const periodLabel = toPdfAsciiSafe(
    localizeInvoicePeriodText(invoicePeriod(paiement), false),
    toPdfAsciiSafe(paiement.moisConcerne, '-')
  );
  const methodLabel = toPdfAsciiSafe(
    focusInstallment?.method || formatPaymentMethodLabel(paiement.moyenPaiement, false, 'Especes'),
    'Especes'
  );

  page.drawText('DETAIL DU REGLEMENT', {
    x: 40,
    y,
    size: 10.5,
    font: fontBold,
    color: indigoDark,
  });
  y -= 14;

  const summaryRows: Array<{ label: string; value: string; bold?: boolean; highlight?: 'emerald' | 'amber' }> = [
    { label: 'Reference facture', value: toPdfAsciiSafe(paiement.id) },
    { label: 'Periode concernee', value: periodLabel },
    { label: 'Mode de reglement', value: methodLabel },
    { label: 'Montant total facture', value: formatDzdAscii(invoiceTotal), bold: true },
    {
      label: focusInstallment ? 'Versement du jour (acompte)' : 'Montant regle',
      value: formatDzdAscii(thisPaymentAmount),
      bold: true,
      highlight: 'emerald',
    },
    {
      label: 'Reste a payer sur cette periode',
      value: formatDzdAscii(remaining),
      bold: true,
      highlight: remaining === 0 ? 'emerald' : 'amber',
    },
  ];

  for (const row of summaryRows) {
    y -= 28;
    page.drawRectangle({
      x: 40,
      y: y - 7,
      width: PAGE_W - 80,
      height: 26,
      color: row.highlight ? rgb(0.95, 0.99, 0.97) : rgb(1, 1, 1),
      borderColor: borderGray,
      borderWidth: 0.75,
    });
    page.drawText(row.label, {
      x: 52,
      y: y + 2,
      size: 9.5,
      font: row.bold ? fontBold : fontRegular,
      color: slateDark,
    });
    page.drawText(row.value, {
      x: 380,
      y: y + 2,
      size: 10.5,
      font: row.bold ? fontBold : fontRegular,
      color:
        row.highlight === 'emerald'
          ? emerald
          : row.highlight === 'amber'
          ? amber
          : slateDark,
    });
  }

  // 4. Historique des versements partiels s'il y en a
  if (installments.length > 0) {
    y -= 32;
    page.drawText(`HISTORIQUE DES VERSEMENTS (${installments.length})`, {
      x: 40,
      y,
      size: 9.5,
      font: fontBold,
      color: indigoDark,
    });
    y -= 8;

    for (const inst of installments.slice(0, 6)) {
      y -= 20;
      const line = `${toPdfAsciiSafe(inst.receiptNumber)}   |   ${toPdfAsciiSafe(inst.date)}   |   ${toPdfAsciiSafe(inst.method)}`;
      page.drawText(line, {
        x: 48,
        y,
        size: 8.5,
        font: fontRegular,
        color: slateMuted,
      });
      page.drawText(formatDzdAscii(inst.amount), {
        x: 400,
        y,
        size: 9,
        font: fontBold,
        color: emerald,
      });
    }
  }

  // 5. Cadres Cachet & Signature
  const signTop = Math.min(y - 36, 200);
  page.drawRectangle({
    x: 40,
    y: signTop - 86,
    width: 245,
    height: 86,
    borderColor: borderGray,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });
  page.drawText('Cachet & Signature de la Creche', {
    x: 52,
    y: signTop - 18,
    size: 9,
    font: fontBold,
    color: slateDark,
  });
  if (options.recordedBy) {
    page.drawText(`Saisi par : ${toPdfAsciiSafe(options.recordedBy)}`, {
      x: 52,
      y: signTop - 34,
      size: 8,
      font: fontRegular,
      color: slateMuted,
    });
  }

  page.drawRectangle({
    x: 310,
    y: signTop - 86,
    width: 245,
    height: 86,
    borderColor: borderGray,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });
  page.drawText('Signature du Parent / Responsable', {
    x: 322,
    y: signTop - 18,
    size: 9,
    font: fontBold,
    color: slateDark,
  });

  // Pied de page
  page.drawText(
    'Bon de reglement edite localement depuis Rawdha+ - Conservez ce recu pour vos archives.',
    {
      x: 40,
      y: 34,
      size: 8,
      font: fontRegular,
      color: slateMuted,
    }
  );

  pdfDoc.setTitle(`Recu ${receiptNumber} - ${childFullName}`);
  pdfDoc.setProducer('Rawdha+ Finance Receipt (pdf-lib)');

  const bytes = await pdfDoc.save();
  const safeChild = childFullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'enfant';
  return {
    bytes,
    fileName: `recu-${receiptNumber.toLowerCase()}-${safeChild}.pdf`,
    receiptNumber,
    pageCount: 1,
  };
}
