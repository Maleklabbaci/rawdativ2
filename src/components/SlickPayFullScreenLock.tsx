import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

export type SlickPayLockPhase = 'creating' | 'waiting' | 'confirmed';

interface SlickPayFullScreenLockProps {
  open: boolean;
  phase: SlickPayLockPhase;
  isArabic?: boolean;
  amountDzd?: number;
  planMonths?: 1 | 3 | 12;
  invoiceId?: string;
  paymentUrl?: string;
  pollAttempt?: number;
  rechecking?: boolean;
  confirmedEndDate?: string;
  onRecheckNow?: () => void;
  onCancelWait?: () => void;
  onDismissConfirmed?: () => void;
}

export default function SlickPayFullScreenLock({
  open,
  phase,
  isArabic = false,
  amountDzd,
  planMonths,
  invoiceId,
  paymentUrl,
  pollAttempt = 0,
  rechecking = false,
  confirmedEndDate,
  onRecheckNow,
  onCancelWait,
  onDismissConfirmed,
}: SlickPayFullScreenLockProps) {
  const t = (fr: string, ar: string) => (isArabic ? ar : fr);

  // Verrouillage complet du scroll et de la touche Échap tant que le paiement est en cours
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const blockEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', blockEscape, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', blockEscape, true);
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const formattedConfirmedDate = confirmedEndDate
    ? (() => {
        const parsed = new Date(`${confirmedEndDate}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) return confirmedEndDate;
        return parsed.toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      })()
    : '';

  const durationLabel =
    planMonths === 12
      ? t('12 mois', '12 شهراً')
      : planMonths === 3
        ? t('3 mois', '3 أشهر')
        : t('1 mois', 'شهر واحد');

  return createPortal(
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      role="alertdialog"
      aria-modal="true"
      aria-busy={phase !== 'confirmed'}
      data-testid="slickpay-fullscreen-lock"
      onClick={e => e.stopPropagation()}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md select-none"
    >
      <div
        data-testid={phase === 'waiting' ? 'slickpay-waiting-card' : undefined}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl"
      >
        {/* Bande supérieure d'état */}
        <div
          className={`h-1.5 w-full ${
            phase === 'confirmed'
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-600 animate-pulse'
          }`}
        />

        <div className="p-6 sm:p-7 text-center space-y-5">
          {/* Icône centrale */}
          {phase === 'confirmed' ? (
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
              <CheckCircle2 className="h-9 w-9" />
            </div>
          ) : (
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
              <span className="absolute inset-0 rounded-full border-4 border-indigo-100" />
              <span className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
              <Lock className="h-6 w-6 text-indigo-700" />
            </div>
          )}

          {/* Titre + sous-titre concis sur 1 ligne */}
          <div className="space-y-1">
            <h2 className="truncate text-base sm:text-lg font-black text-slate-900">
              {phase === 'creating'
                ? t('Connexion sécurisée SATIM…', 'جاري الاتصال الآمن ببوابة الدفع...')
                : phase === 'confirmed'
                  ? t('Paiement confirmé !', 'تم تأكيد الدفع بنجاح!')
                  : t('Validation du paiement en cours…', 'جاري تأكيد عملية الدفع...')}
            </h2>
            <p className="truncate text-xs font-semibold text-slate-500">
              {phase === 'creating'
                ? t('Préparation de votre transaction CIB / Edahabia.', 'تحضير معاملة البطاقة الذهبية / CIB.')
                : phase === 'confirmed'
                  ? formattedConfirmedDate
                    ? t(`Abonnement actif jusqu’au ${formattedConfirmedDate}`, `الاشتراك مفعل إلى غاية ${formattedConfirmedDate}`)
                    : t('Votre abonnement Rawdha+ est actif.', 'تم تفعيل اشتراكك في Rawdha+.')
                  : t('Page verrouillée jusqu’à confirmation du paiement.', 'الصفحة مقفلة حتى تأكيد عملية الدفع.')}
            </p>
          </div>

          {/* Récapitulatif compact avec logos officiels CIB & Edahabia */}
          {phase !== 'confirmed' && (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-0.5">
                    <img src="/payment/edahabia.png" alt="Edahabia" className="h-full w-full object-contain" />
                  </span>
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-0.5">
                    <img src="/payment/cib.png" alt="CIB" className="h-full w-full object-contain" />
                  </span>
                  <span className="font-bold text-slate-700 truncate">
                    {planMonths ? `Rawdha+ · ${durationLabel}` : 'Rawdha+'}
                  </span>
                </div>
                {typeof amountDzd === 'number' && amountDzd > 0 && (
                  <span className="shrink-0 text-sm font-black text-slate-950 tabular-nums">
                    {amountDzd.toLocaleString('fr-FR')} {t('DA', 'د.ج')}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 font-bold text-indigo-700 truncate">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  <span className="truncate">
                    {phase === 'creating'
                      ? t('Ouverture SlickPay…', 'فتح SlickPay...')
                      : t('Attente confirmation bancaire…', 'بانتظار التأكيد البنكي...')}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 font-black text-[10px] text-indigo-800 tabular-nums">
                  {invoiceId ? `#${invoiceId.slice(-6)}` : 'SATIM'}
                  {pollAttempt > 0 ? ` · ${pollAttempt}` : ''}
                </span>
              </div>
            </div>
          )}

          {/* Actions selon la phase */}
          {phase === 'waiting' && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-center gap-2">
                {onRecheckNow && (
                  <button
                    type="button"
                    data-testid="slickpay-recheck-now-btn"
                    disabled={rechecking}
                    onClick={onRecheckNow}
                    className="min-h-10! flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap cursor-pointer transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${rechecking ? 'animate-spin' : ''}`} />
                    <span className="truncate">{t('Vérifier maintenant', 'تحقق الآن')}</span>
                  </button>
                )}
                {paymentUrl && /^https?:\/\//i.test(paymentUrl) && (
                  <a
                    href={paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-10! inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 whitespace-nowrap transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                    <span className="truncate">{t('Page SATIM', 'صفحة الدفع')}</span>
                  </a>
                )}
              </div>

              {onCancelWait && (
                <button
                  type="button"
                  data-testid="slickpay-cancel-wait-btn"
                  onClick={onCancelWait}
                  className="min-h-8! inline-flex items-center justify-center px-3 py-1 text-[11px] font-bold text-slate-400 hover:text-rose-600 whitespace-nowrap cursor-pointer transition"
                >
                  {t('Annuler l’attente', 'إلغاء الانتظار')}
                </button>
              )}
            </div>
          )}

          {phase === 'confirmed' && onDismissConfirmed && (
            <button
              type="button"
              onClick={onDismissConfirmed}
              className="min-h-10! w-full inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700 whitespace-nowrap cursor-pointer transition"
            >
              {t('Continuer', 'متابعة')}
            </button>
          )}

          {/* Pied de sécurité */}
          <div className="flex items-center justify-center gap-1.5 pt-1 text-[10.5px] font-bold text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="truncate">
              {t('Paiement sécurisé SlickPay · SATIM Algérie', 'دفع آمن عبر SlickPay · SATIM الجزائر')}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
