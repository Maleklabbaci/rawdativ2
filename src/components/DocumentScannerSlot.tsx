import React, { useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Loader2,
  RotateCw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  convertFilesToStoredPdf,
  rotateStoredPdfDocument,
  triggerDocumentDownload,
  type ChildDocumentKey,
  type StoredChildDocument,
} from '../utils/documentPdf';
import InAppPdfViewerModal from './InAppPdfViewerModal';

interface DocumentScannerSlotProps {
  key?: React.Key;
  docKey: ChildDocumentKey;
  label: string;
  isArabic?: boolean;
  childName?: string;
  value?: StoredChildDocument;
  declaredWithoutFile?: boolean;
  onToggleDeclared?: (checked: boolean) => void;
  onChange?: (next: StoredChildDocument | undefined) => void;
  readOnly?: boolean;
  onError?: (message: string) => void;
}

export default function DocumentScannerSlot({
  docKey,
  label,
  isArabic = false,
  childName,
  value,
  declaredWithoutFile = false,
  onToggleDeclared,
  onChange,
  readOnly = false,
  onError,
}: DocumentScannerSlotProps) {
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const appendInputRef = useRef<HTMLInputElement>(null);

  const canEdit = !readOnly && typeof onChange === 'function';

  const reportError = (code: string) => {
    const msg =
      code === 'document_too_large'
        ? isArabic
          ? 'حجم الملف بعد الضغط يتجاوز 2 ميغابايت. يرجى تقليل عدد الصفحات.'
          : 'Le PDF dépasse 2 Mo malgré la compression. Réduisez le nombre de pages.'
        : isArabic
          ? 'تعذر تحويل الصورة إلى ملف PDF. يرجى تجربة صورة JPG أو PNG أو ملف PDF.'
          : 'Impossible de convertir ce fichier en PDF. Utilisez une photo (JPG/PNG) ou un PDF.';
    onError?.(msg);
  };

  const handleFilesSelected = async (fileList: FileList | null, appendMode: boolean) => {
    if (!fileList || fileList.length === 0 || !onChange) return;
    const files = Array.from(fileList);
    setBusy(true);
    try {
      const converted = await convertFilesToStoredPdf({
        files,
        docKey,
        childName,
        appendTo: appendMode ? value || null : null,
      });
      onChange(converted);
    } catch (err: any) {
      reportError(err?.message || 'conversion_failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRotate = async () => {
    if (!value || !onChange || busy) return;
    setBusy(true);
    try {
      const rotated = await rotateStoredPdfDocument(value, docKey, childName);
      onChange(rotated);
    } catch {
      reportError('rotate_failed');
    } finally {
      setBusy(false);
    }
  };

  const hasDocument = Boolean(value?.contenu);
  const isOk = hasDocument || declaredWithoutFile;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs transition hover:border-slate-300">
      {/* Ligne supérieure : titre + badge d'état */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {onToggleDeclared && canEdit ? (
            <input
              type="checkbox"
              checked={isOk}
              onChange={e => onToggleDeclared(e.target.checked)}
              aria-label={label}
              className="h-4 w-4 shrink-0 accent-indigo-600 cursor-pointer"
            />
          ) : (
            <FileText
              className={`h-4 w-4 shrink-0 ${
                hasDocument
                  ? 'text-emerald-600'
                  : declaredWithoutFile
                    ? 'text-amber-600'
                    : 'text-slate-400'
              }`}
            />
          )}
          <span className="truncate text-xs font-bold text-slate-800">{label}</span>
        </div>

        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
            hasDocument
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
              : declaredWithoutFile
                ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                : 'bg-rose-50 text-rose-700 border border-rose-200/70'
          }`}
        >
          {hasDocument
            ? 'PDF'
            : declaredWithoutFile
              ? isArabic
                ? 'ورقي'
                : 'Papier'
              : isArabic
                ? 'ناقص'
                : 'Manquant'}
        </span>
      </div>

      {/* Détail du PDF généré (cliquable pour lire directement dans la SaaS) */}
      {hasDocument && value ? (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="mt-2 flex w-full min-h-0 items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-2.5 py-1.5 text-start text-[11px] text-emerald-900 transition hover:bg-emerald-100/70 cursor-pointer"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="truncate font-bold">{value.nom}</span>
          </div>
          <span className="shrink-0 font-semibold text-emerald-700 tabular-nums">
            {value.pages ? `${value.pages} p. · ` : ''}
            {Math.max(1, Math.ceil(value.taille / 1024))} Ko
          </span>
        </button>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-500">
          {declaredWithoutFile
            ? isArabic
              ? 'مُصرّح بتسليمه ورقياً (بدون نسخة رقمية مرفقة)'
              : 'Remis en version papier (aucun scan PDF joint)'
            : isArabic
              ? 'صوّري الوثيقة (صفحة أو عدة صفحات) لتحويلها تلقائياً إلى PDF'
              : 'Prenez 1 ou plusieurs photos : conversion automatique en PDF'}
        </p>
      )}

      {/* Boutons d'action */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {canEdit && (
          <>
            {/* Sélection 1 ou plusieurs photos / PDF */}
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              multiple
              className="hidden"
              onChange={e => {
                void handleFilesSelected(e.target.files, false);
                e.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => uploadInputRef.current?.click()}
              className="inline-flex min-h-0 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 cursor-pointer"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              <span>
                {hasDocument
                  ? isArabic
                    ? 'استبدال'
                    : 'Remplacer'
                  : isArabic
                    ? 'صورة / ملف → PDF'
                    : 'Photo(s) → PDF'}
              </span>
            </button>

            {/* Prise directe appareil photo mobile */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                void handleFilesSelected(e.target.files, hasDocument);
                e.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraInputRef.current?.click()}
              title={
                isArabic
                  ? 'تصوير بالكاميرا وتحويل إلى PDF'
                  : 'Scanner avec l’appareil photo et convertir en PDF'
              }
              className="inline-flex min-h-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
            >
              <Camera className="h-3.5 w-3.5 text-[#c94b30]" />
              <span>{isArabic ? 'تصوير' : 'Scanner'}</span>
            </button>

            {/* Ajouter une page supplémentaire (ex. pages 2, 3 du carnet de vaccination) */}
            {hasDocument && (
              <>
                <input
                  ref={appendInputRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  multiple
                  className="hidden"
                  onChange={e => {
                    void handleFilesSelected(e.target.files, true);
                    e.currentTarget.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => appendInputRef.current?.click()}
                  title={
                    isArabic
                      ? 'إضافة صفحة أخرى إلى نفس ملف PDF (مثل صفحات دفتر التلقيح)'
                      : 'Ajouter une autre page à ce PDF (ex. suite du carnet de vaccination)'
                  }
                  className="inline-flex min-h-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  <span>{isArabic ? '+ صفحة' : '+ Page'}</span>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRotate()}
                  title={isArabic ? 'تدوير 90 درجة' : 'Pivoter de 90°'}
                  aria-label={isArabic ? 'تدوير الوثيقة' : 'Pivoter le PDF de 90°'}
                  className="inline-flex min-h-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </>
        )}

        {/* Consultation directe dans la SaaS & Téléchargement optionnel */}
        {hasDocument && value && (
          <>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              title={isArabic ? 'معاينة PDF داخل المنصة' : 'Voir le PDF directement dans la SaaS'}
              className="inline-flex min-h-0 items-center gap-1 rounded-lg border border-[#25434c]/25 bg-[#25434c] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#1c343b] cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{isArabic ? 'معاينة' : 'Voir'}</span>
            </button>

            <button
              type="button"
              onClick={() => triggerDocumentDownload(value)}
              title={isArabic ? 'تحميل PDF' : 'Télécharger le PDF'}
              aria-label={isArabic ? `تحميل ${label}` : `Télécharger ${label}`}
              className="inline-flex min-h-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            {canEdit && onChange && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onChange(undefined)}
                title={isArabic ? 'حذف المرفق' : 'Supprimer le fichier joint'}
                aria-label={isArabic ? `حذف ${label}` : `Supprimer ${label}`}
                className="inline-flex min-h-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>

      {previewOpen && value && (
        <InAppPdfViewerModal
          documentSource={{
            title: childName ? `${label} — ${childName}` : label,
            fileName: value.nom,
            mimeType: value.type,
            dataUrl: value.contenu,
            pageCount: value.pages,
          }}
          isArabic={isArabic}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
