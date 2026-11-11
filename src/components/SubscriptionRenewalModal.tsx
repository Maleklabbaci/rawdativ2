import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  CreditCard,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Tag,
  X,
  Zap,
} from 'lucide-react';
import { buildOfficialWhatsappHref } from '../config/legal';
import {
  computeDiscountedPlanPrice,
  createSlickPaySubscriptionCheckout,
  savePendingSlickPayOrder,
  scheduleDemoSlickPayBackgroundWebhook,
  SUBSCRIPTION_PLAN_OPTIONS,
  type SubscriptionPlanMonths,
  type SubscriptionRenewalRequest,
} from '../utils/subscriptionRenewal';

interface SubscriptionRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  isArabic?: boolean;
  director: {
    id: string;
    prenom?: string;
    nom?: string;
    nomCreche?: string;
    email?: string;
    telephone?: string;
    dateFinAbonnement?: string;
  };
  initialCoupon?: string;
  onSubmitted?: (request: SubscriptionRenewalRequest) => void;
}

export default function SubscriptionRenewalModal({
  isOpen,
  onClose,
  isArabic = false,
  director,
  initialCoupon = '',
}: SubscriptionRenewalModalProps) {
  const [planMonths, setPlanMonths] = useState<SubscriptionPlanMonths>(1);
  const [coupon, setCoupon] = useState(initialCoupon);
  const [showPromo, setShowPromo] = useState(Boolean(initialCoupon));
  const [slickpayBusy, setSlickpayBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || typeof document === 'undefined') return null;

  const t = (fr: string, ar: string) => (isArabic ? ar : fr);
  const pricing = computeDiscountedPlanPrice(planMonths, coupon);
  const normalizedCoupon = coupon.trim().toUpperCase();
  const crecheLabel = director.nomCreche || 'Crèche';
  const durationFr = planMonths === 12 ? '12 mois' : planMonths === 3 ? '3 mois' : '1 mois';
  const durationAr = planMonths === 12 ? '12 شهراً' : planMonths === 3 ? '3 أشهر' : 'شهر واحد';

  const whatsappHref = buildOfficialWhatsappHref(
    isArabic
      ? `مرحباً فريق Rawdha+، أود تفعيل اشتراك "${crecheLabel}" لمدة ${durationAr} بمبلغ ${pricing.finalPrice} د.ج${
          pricing.discount > 0 ? ` (كود ${normalizedCoupon})` : ''
        }. البريد: ${director.email || ''}`
      : `Bonjour l’équipe Rawdha+, je souhaite activer l’abonnement pour "${crecheLabel}" (${durationFr} — ${pricing.finalPrice.toLocaleString(
          'fr-FR'
        )} DA${pricing.discount > 0 ? `, code ${normalizedCoupon}` : ''}). Email : ${director.email || ''}`
  );

  const handlePayWithSlickPay = async () => {
    if (slickpayBusy) return;
    setSlickpayBusy(true);
    setError('');
    try {
      const checkout = await createSlickPaySubscriptionCheckout({
        directorId: director.id,
        prenom: director.prenom,
        nom: director.nom,
        crecheName: crecheLabel,
        email: director.email || '',
        telephone: director.telephone,
        currentEndDate: director.dateFinAbonnement,
        planMonths,
        couponCode: pricing.discount > 0 ? normalizedCoupon : undefined,
      });

      if (checkout.mode === 'live') {
        savePendingSlickPayOrder({
          orderId: checkout.orderId,
          invoiceId: checkout.invoiceId,
          directorId: director.id,
          paymentUrl: checkout.paymentUrl,
          amountDzd: checkout.amountDzd,
          planMonths: checkout.planMonths,
          mode: checkout.mode,
          createdAt: new Date().toISOString(),
        });
        window.location.assign(checkout.paymentUrl);
        return;
      }

      onClose();
      scheduleDemoSlickPayBackgroundWebhook(checkout, director.id, 'Edahabia', 1500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('Passerelle SlickPay indisponible. Contactez-nous sur WhatsApp.', 'بوابة الدفع غير متاحة. تواصل عبر واتساب.')
      );
    } finally {
      setSlickpayBusy(false);
    }
  };

  return createPortal(
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-label={t('Abonnement Rawdha+', 'اشتراك Rawdha+')}
      className="fixed inset-0 z-[1150] flex items-end sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4 backdrop-blur-xs"
      onClick={() => !slickpayBusy && onClose()}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg overflow-hidden rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 py-4 text-white">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex shrink-0 items-center gap-1">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white p-0.5">
                <img src="/payment/edahabia.png" alt="Edahabia" className="h-full w-full object-contain" />
              </span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white p-0.5">
                <img src="/payment/cib.png" alt="CIB" className="h-full w-full object-contain" />
              </span>
            </div>
            <h3 className="truncate text-sm sm:text-base font-black">
              {t('Activer mon abonnement Rawdha+', 'تفعيل اشتراك Rawdha+')}
            </h3>
          </div>
          <button
            type="button"
            disabled={slickpayBusy}
            onClick={onClose}
            className="min-h-8! shrink-0 rounded-xl bg-white/15 p-1.5 text-white hover:bg-white/25 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 truncate">
              {error}
            </div>
          )}

          {/* Sélection durée */}
          <div className="grid grid-cols-3 gap-2.5">
            {SUBSCRIPTION_PLAN_OPTIONS.map(opt => {
              const active = planMonths === opt.months;
              const shortLabel =
                opt.months === 12
                  ? t('12 mois', '12 شهراً')
                  : opt.months === 3
                    ? t('3 mois', '3 أشهر')
                    : t('1 mois', 'شهر واحد');
              return (
                <button
                  key={opt.months}
                  type="button"
                  onClick={() => setPlanMonths(opt.months)}
                  className={`flex flex-col items-start justify-between rounded-2xl border-2 p-3 text-start transition cursor-pointer ${
                    active
                      ? 'border-indigo-600 bg-indigo-50/60'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <span className="text-[11px] font-black text-slate-800 truncate">
                      {shortLabel}
                    </span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-base font-black text-slate-950 tabular-nums">
                      {opt.priceDzd.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">{t('DA', 'د.ج')}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Code promo optionnel */}
          <div>
            {!showPromo && !coupon ? (
              <button
                type="button"
                onClick={() => setShowPromo(true)}
                className="min-h-7! inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 whitespace-nowrap cursor-pointer"
              >
                <Tag className="h-3.5 w-3.5 shrink-0" />
                <span>{t('J’ai un code promo', 'لدي كود خصم')}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={coupon}
                  onChange={e => setCoupon(e.target.value)}
                  placeholder={t('Code promo', 'كود الخصم')}
                  className="h-9 flex-1 rounded-xl border border-slate-200 px-3 text-xs font-bold uppercase text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
                {pricing.discount > 0 && (
                  <span className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-black text-emerald-700 border border-emerald-200 whitespace-nowrap">
                    -{pricing.discount} {t('DA', 'د.ج')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Deux boutons nets : CIB / Edahabia OU WhatsApp */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={slickpayBusy}
              onClick={handlePayWithSlickPay}
              className="min-h-11! w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap cursor-pointer transition"
            >
              {slickpayBusy ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">
                {t(
                  `Payer ${pricing.finalPrice.toLocaleString('fr-FR')} DA par CIB / Edahabia`,
                  `ادفع ${pricing.finalPrice.toLocaleString('fr-FR')} د.ج ببطاقة CIB / الذهبية`
                )}
              </span>
            </button>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11! w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 whitespace-nowrap cursor-pointer transition"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('Contacter sur WhatsApp', 'تواصل عبر واتساب')}</span>
            </a>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[10.5px] font-semibold text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="truncate">
              {t('Paiement sécurisé SATIM · Activation immédiate', 'دفع آمن عبر SATIM · تفعيل فوري')}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
