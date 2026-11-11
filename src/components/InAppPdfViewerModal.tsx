import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  FileText,
  Loader2,
  Printer,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { parseDataUrl, triggerDocumentDownload } from '../utils/documentPdf';
import { isStorageUri, resolveStoredDocumentPayload } from '../utils/documentStorage';

export interface InAppPdfViewerSource {
  title: string;
  fileName: string;
  mimeType?: string;
  bytes?: Uint8Array;
  dataUrl?: string;
  pageCount?: number;
}

interface InAppPdfViewerModalProps {
  documentSource: InAppPdfViewerSource | null;
  isArabic?: boolean;
  onClose: () => void;
}

interface RenderedPageImage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

let pdfWorkerConfigured = false;

export default function InAppPdfViewerModal({
  documentSource,
  isArabic = false,
  onClose,
}: InAppPdfViewerModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [totalPages, setTotalPages] = useState<number>(documentSource?.pageCount || 1);
  const [renderedPages, setRenderedPages] = useState<RenderedPageImage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [remotePayload, setRemotePayload] = useState<{ bytes: Uint8Array; mimeType: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRemotePayload(null);
    if (!documentSource?.dataUrl || !isStorageUri(documentSource.dataUrl)) return;
    setLoading(true);
    void resolveStoredDocumentPayload(documentSource.dataUrl, documentSource.mimeType || 'application/pdf').then(payload => {
      if (cancelled) return;
      if (payload) {
        setRemotePayload(payload);
      } else {
        setRenderError(
          isArabic
            ? 'تعذر تحميل الوثيقة من التخزين السحابي.'
            : 'Impossible de charger la pièce depuis le stockage sécurisé.'
        );
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [documentSource?.dataUrl, documentSource?.mimeType, isArabic]);

  const resolved = useMemo(() => {
    if (!documentSource) return null;
    if (documentSource.bytes && documentSource.bytes.length > 0) {
      return {
        bytes: documentSource.bytes,
        mimeType: documentSource.mimeType || 'application/pdf',
      };
    }
    if (documentSource.dataUrl) {
      if (isStorageUri(documentSource.dataUrl)) {
        return remotePayload;
      }
      const parsed = parseDataUrl(documentSource.dataUrl);
      if (parsed) {
        return {
          bytes: parsed.bytes,
          mimeType: documentSource.mimeType || parsed.mimeType || 'application/pdf',
        };
      }
    }
    return null;
  }, [documentSource, remotePayload]);

  const isImage = Boolean(resolved?.mimeType.startsWith('image/'));

  // Rendu 100 % intégré dans la SaaS sur Canvas via Mozilla PDF.js (aucun téléchargement forcé sur aucun navigateur/mobile)
  useEffect(() => {
    let cancelled = false;
    setRenderedPages([]);
    setRenderError('');
    setZoom(1);

    if (!resolved) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Cas 1 : image directe
    if (isImage) {
      const blob = new Blob([resolved.bytes], { type: resolved.mimeType });
      const url = URL.createObjectURL(blob);
      setTotalPages(1);
      setRenderedPages([{ pageNumber: 1, dataUrl: url, width: 800, height: 1000 }]);
      setLoading(false);
      return () => {
        cancelled = true;
        URL.revokeObjectURL(url);
      };
    }

    const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');

    (async () => {
      try {
        if (isJsdom) {
          const { PDFDocument } = await import('pdf-lib');
          const loaded = await PDFDocument.load(resolved.bytes, { ignoreEncryption: true });
          const count = Math.max(1, loaded.getPageCount());
          if (cancelled) return;
          setTotalPages(count);
          setRenderedPages(
            Array.from({ length: count }, (_, idx) => ({
              pageNumber: idx + 1,
              dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=',
              width: 595,
              height: 842,
            }))
          );
          setLoading(false);
          return;
        }

        const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
        if (!pdfWorkerConfigured && pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
            import.meta.url
          ).toString();
          pdfWorkerConfigured = true;
        }

        // Copie fraîche du buffer car PDF.js transfère l'ArrayBuffer au Web Worker
        const bufferCopy = new Uint8Array(resolved.bytes);
        const loadingTask = pdfjs.getDocument({ data: bufferCopy });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          void pdf.destroy?.();
          return;
        }

        const numPages = pdf.numPages || 1;
        setTotalPages(numPages);

        const pagesOut: RenderedPageImage[] = [];
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          if (cancelled) break;
          const page = await pdf.getPage(pageNum);
          // Échelle haute définition nette sur écrans standards et Retina
          const viewport = page.getViewport({ scale: 1.8 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          }
          pagesOut.push({
            pageNumber: pageNum,
            dataUrl: canvas.toDataURL('image/jpeg', 0.9),
            width: Math.round(viewport.width / 1.8),
            height: Math.round(viewport.height / 1.8),
          });
          // Affichage progressif dès la 1re page rendue
          if (!cancelled) {
            setRenderedPages([...pagesOut]);
            if (pageNum === 1) setLoading(false);
          }
        }

        void pdf.destroy?.();
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setRenderError(
            isArabic
              ? 'تعذر عرض صفحات ملف PDF داخل المتصفح.'
              : 'Impossible d’afficher les pages de ce PDF.'
          );
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isArabic, isImage, resolved]);

  // Touche Échap en phase de capture pour ne fermer QUE la visionneuse PDF
  useEffect(() => {
    if (!documentSource) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [documentSource, onClose]);

  const awaitingStorage = Boolean(documentSource?.dataUrl && isStorageUri(documentSource.dataUrl) && !resolved && !renderError);

  if (!documentSource || (!resolved && !awaitingStorage && !renderError) || typeof document === 'undefined') {
    return null;
  }

  const sizeKb = resolved ? Math.max(1, Math.ceil(resolved.bytes.length / 1024)) : 1;

  const handlePrint = () => {
    if (renderedPages.length === 0) return;
    const printWin = window.open('', '_blank', 'width=900,height=1100');
    if (!printWin) return;
    const imgsHtml = renderedPages
      .map(
        p =>
          `<div style="page-break-after:always;display:flex;justify-content:center;margin:0;padding:0;"><img src="${p.dataUrl}" style="max-width:100%;max-height:98vh;object-fit:contain;" /></div>`
      )
      .join('');
    printWin.document.write(
      `<!doctype html><html><head><title>${documentSource.title}</title><style>@page{margin:8mm}body{margin:0;background:#fff}</style></head><body>${imgsHtml}<script>window.onload=()=>{window.focus();window.print();}</script></body></html>`
    );
    printWin.document.close();
  };

  const handleDownload = () => {
    if (!resolved) return;
    triggerDocumentDownload(resolved.bytes, documentSource.fileName || 'document.pdf');
  };

  const scrollToPage = (pageNum: number) => {
    const el = scrollContainerRef.current?.querySelector(`[data-pdf-page="${pageNum}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const modalNode = (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-label={documentSource.title}
      className="fixed inset-0 z-[1200] flex flex-col bg-slate-950/75 p-2 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Barre supérieure de la visionneuse intégrée */}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#fcfdff] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f7efe7] text-[#c94b30]">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xs sm:text-sm font-extrabold text-[#25434c]">
                {documentSource.title}
              </h2>
              <p className="truncate text-[11px] font-medium text-slate-500">
                {documentSource.fileName} ·{' '}
                {!isImage && (isArabic ? `${totalPages} صفحة · ` : `${totalPages} page(s) · `)}
                {sizeKb} Ko
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Contrôle de zoom intégré */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))}
                aria-label={isArabic ? 'تصغير' : 'Zoom arrière'}
                className="min-h-0 rounded-lg p-1 text-slate-600 hover:bg-white cursor-pointer"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="px-1.5 text-slate-700 tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom(z => Math.min(2.2, Math.round((z + 0.2) * 10) / 10))}
                aria-label={isArabic ? 'تكبير' : 'Zoom avant'}
                className="min-h-0 rounded-lg p-1 text-slate-600 hover:bg-white cursor-pointer"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              type="button"
              disabled={renderedPages.length === 0}
              onClick={handlePrint}
              className="inline-flex min-h-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isArabic ? 'طباعة' : 'Imprimer'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex min-h-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#25434c] hover:bg-slate-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isArabic ? 'تحميل' : 'Télécharger'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={isArabic ? 'إغلاق المعاينة' : 'Fermer l’aperçu'}
              className="inline-flex min-h-0 items-center justify-center rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Accès rapide par page si document multi-pages */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-[11px] font-bold">
            <span className="shrink-0 text-slate-500">
              {isArabic ? `الانتقال إلى الصفحة (${totalPages}) :` : `Tout (${totalPages}) — Aller à :`}
            </span>
            {Array.from({ length: totalPages }, (_, idx) => (
              <button
                key={idx + 1}
                type="button"
                onClick={() => scrollToPage(idx + 1)}
                className="min-h-0 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:border-[#c94b30] hover:text-[#c94b30] cursor-pointer"
              >
                {isArabic ? `ص ${idx + 1}` : `Page ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* Feuilles A4 rendues directement dans la SaaS */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto bg-slate-200/80 p-3 sm:p-6"
        >
          {loading && renderedPages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-600">
              <Loader2 className="h-6 w-6 animate-spin text-[#c94b30]" />
              <p className="text-xs font-bold">
                {isArabic ? 'جاري عرض صفحات الوثيقة...' : 'Ouverture des pages dans Rawdha+...'}
              </p>
            </div>
          ) : renderError ? (
            <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center text-xs font-bold text-rose-700">
              {renderError}
            </div>
          ) : (
            <div className="mx-auto flex flex-col items-center gap-5">
              {renderedPages.map(p => (
                <div
                  key={p.pageNumber}
                  data-pdf-page={p.pageNumber}
                  style={{ width: `min(100%, ${Math.round(p.width * zoom)}px)` }}
                  className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md"
                >
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500">
                      <span>{documentSource.title}</span>
                      <span>
                        {isArabic
                          ? `صفحة ${p.pageNumber} من ${totalPages}`
                          : `Page ${p.pageNumber} / ${totalPages}`}
                      </span>
                    </div>
                  )}
                  <img
                    src={p.dataUrl}
                    alt={`${documentSource.title} - Page ${p.pageNumber}`}
                    className="block h-auto w-full bg-white"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500">
          <span>
            {isArabic
              ? 'معاينة مباشرة داخل المنصة دون الحاجة لتحميل الملف.'
              : 'Lecture directe dans Rawdha+ sans téléchargement obligatoire.'}
          </span>
          <span className="font-semibold text-slate-400">
            {isArabic ? 'استخدمي التكبير أو الطباعة من الأعلى' : 'Zoom et impression directe disponibles en haut'}
          </span>
        </footer>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}
