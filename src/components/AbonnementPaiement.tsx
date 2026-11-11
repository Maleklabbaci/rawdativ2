import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { buildOfficialWhatsappHref } from '../config/legal';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import {
  clearPendingSlickPayOrder,
  computeDiscountedPlanPrice,
  computeExtendedSubscriptionDate,
  createSlickPaySubscriptionCheckout,
  getPendingSlickPayOrder,
  loadSubscriptionRenewals,
  savePendingSlickPayOrder,
  scheduleDemoSlickPayBackgroundWebhook,
  SUBSCRIPTION_PLAN_OPTIONS,
  verifySlickPaySubscriptionOrder,
  watchSlickPayOrderInBackground,
  type PendingSlickPayOrder,
  type SlickPayCheckoutResult,
  type SubscriptionPlanMonths,
  type SubscriptionRenewalRequest,
} from '../utils/subscriptionRenewal';
import SlickPayFullScreenLock, { type SlickPayLockPhase } from './SlickPayFullScreenLock';

interface AbonnementPaiementProps {
  onNavigate?: (page: string) => void;
}

export default function AbonnementPaiement({ onNavigate }: AbonnementPaiementProps) {
  const { user, creche } = useAuth();
  const { comptes = [] } = useDb();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === 'ar';
  const t = (fr: string, ar: string) => (isArabic ? ar : fr);

  const liveUser = user ? comptes.find(c => c.id === user.id) || user : null;

  const [planMonths, setPlanMonths] = useState<SubscriptionPlanMonths>(1);
  const [selectedCardBrand, setSelectedCardBrand] = useState<'Edahabia' | 'CIB'>('Edahabia');
  const [coupon, setCoupon] = useState('');
  const [showPromoField, setShowPromoField] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<SubscriptionRenewalRequest[]>([]);

  // États du verrouillage plein écran SlickPay
  const [slickpayCreating, setSlickpayCreating] = useState(false);
  const [pendingSlickPay, setPendingSlickPay] = useState<PendingSlickPayOrder | null>(() =>
    getPendingSlickPayOrder(liveUser?.id)
  );
  const [pollAttempt, setPollAttempt] = useState(0);
  const [manualRechecking, setManualRechecking] = useState(false);
  const [confirmedModalEndDate, setConfirmedModalEndDate] = useState<string | null>(null);
  const [slickpaySuccessBanner, setSlickpaySuccessBanner] = useState<{ newEndDate: string; txRef?: string } | null>(
    null
  );

  // Passerelle simulée SATIM (uniquement en aperçu démo sans clés Edge déployées)
  const [demoGatewayCheckout, setDemoGatewayCheckout] = useState<SlickPayCheckoutResult | null>(null);
  const [demoCardType, setDemoCardType] = useState<'Edahabia' | 'CIB'>('Edahabia');

  useEffect(() => {
    if (!liveUser?.id) return;
    let active = true;
    const sync = () => {
      void loadSubscriptionRenewals(liveUser.id).then(items => {
        if (active) setHistory(items);
      });
    };
    const syncPending = () => {
      if (active) setPendingSlickPay(getPendingSlickPayOrder(liveUser.id));
    };
    sync();
    syncPending();
    window.addEventListener('rawdha-subscription-renewals-updated', sync);
    window.addEventListener('rawdha-slickpay-pending-changed', syncPending);
    return () => {
      active = false;
      window.removeEventListener('rawdha-subscription-renewals-updated', sync);
      window.removeEventListener('rawdha-slickpay-pending-changed', syncPending);
    };
  }, [liveUser?.id]);

  // Détection automatique de `?slickpay_order=...` au retour depuis SATIM
  useEffect(() => {
    if (!liveUser?.id || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlOrderId = params.get('slickpay_order');
    if (!urlOrderId) return;

    const existingPending = getPendingSlickPayOrder(liveUser.id);
    if (!existingPending || existingPending.orderId !== urlOrderId) {
      const currentFinalPrice = computeDiscountedPlanPrice(planMonths, coupon).finalPrice;
      const nextPending: PendingSlickPayOrder = {
        orderId: urlOrderId,
        invoiceId: '',
        directorId: liveUser.id,
        paymentUrl: '',
        amountDzd: currentFinalPrice,
        planMonths,
        mode: 'live',
        createdAt: new Date().toISOString(),
      };
      savePendingSlickPayOrder(nextPending);
      setPendingSlickPay(nextPending);
    }

    try {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('slickpay_order');
      window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    } catch {
      // Ignore URL cleanup errors
    }
  }, [liveUser?.id, planMonths, coupon]);

  // Surveillance temps réel + verrouillage plein écran jusqu'à confirmation du paiement
  useEffect(() => {
    if (!liveUser?.id || !pendingSlickPay?.orderId) {
      setPollAttempt(0);
      return;
    }

    setError('');
    const stopWatching = watchSlickPayOrderInBackground({
      orderId: pendingSlickPay.orderId,
      directorId: liveUser.id,
      intervalMs: 2500,
      maxAttempts: 36,
      onTick: attempt => setPollAttempt(attempt),
      onResolved: res => {
        setPendingSlickPay(null);
        if (res.status === 'paid' && res.newEndDate) {
          setConfirmedModalEndDate(res.newEndDate);
          setSlickpaySuccessBanner({ newEndDate: res.newEndDate, txRef: res.transactionRef });
          showToast(
            isArabic
              ? 'تم تأكيد الدفع وتفعيل اشتراكك بنجاح!'
              : 'Paiement CIB / Edahabia confirmé — abonnement prolongé !',
            'success'
          );
          setTimeout(() => {
            setConfirmedModalEndDate(null);
          }, 1300);
        } else if (res.status === 'failed') {
          setError(
            res.rejectionReason ||
              (isArabic ? 'لم تكتمل عملية الدفع عبر البطاقة.' : 'La transaction par carte n’a pas abouti.')
          );
        }
      },
    });

    return () => {
      stopWatching();
    };
  }, [liveUser?.id, pendingSlickPay?.orderId, isArabic, showToast]);

  if (!liveUser) return null;

  const pricing = computeDiscountedPlanPrice(planMonths, coupon);
  const projectedEndDate = computeExtendedSubscriptionDate(liveUser.dateFinAbonnement, planMonths);

  let daysRemaining: number | null = null;
  let formattedCurrentEnd = '';
  if (liveUser.dateFinAbonnement && /^\d{4}-\d{2}-\d{2}$/.test(liveUser.dateFinAbonnement)) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(`${liveUser.dateFinAbonnement}T00:00:00`);
    if (!Number.isNaN(end.getTime())) {
      daysRemaining = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      formattedCurrentEnd = end.toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  }

  const formattedProjectedEnd = (() => {
    const end = new Date(`${projectedEndDate}T00:00:00`);
    if (Number.isNaN(end.getTime())) return projectedEndDate;
    return end.toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  })();

  const isExpired = liveUser.abonnementActif === false || (daysRemaining !== null && daysRemaining < 0);
  const crecheLabel = creche?.nom || liveUser.nomCreche || 'Crèche';
  const durationTextFr = planMonths === 12 ? '12 mois' : planMonths === 3 ? '3 mois' : '1 mois';
  const durationTextAr = planMonths === 12 ? '12 شهراً' : planMonths === 3 ? '3 أشهر' : 'شهر واحد';
  const normalizedCoupon = coupon.trim().toUpperCase();

  const whatsappHref = buildOfficialWhatsappHref(
    isArabic
      ? `مرحباً فريق Rawdha+، أود تفعيل اشتراك الروضة "${crecheLabel}" لمدة ${durationTextAr} بمبلغ ${pricing.finalPrice} د.ج${
          pricing.discount > 0 ? ` (كود الخصم ${normalizedCoupon})` : ''
        }. البريد: ${liveUser.email || ''}`
      : `Bonjour l’équipe Rawdha+, je souhaite activer l’abonnement pour "${crecheLabel}" (${durationTextFr} — ${pricing.finalPrice.toLocaleString(
          'fr-FR'
        )} DA${pricing.discount > 0 ? `, code ${normalizedCoupon}` : ''}). Email : ${liveUser.email || ''}`
  );

  const handlePayWithSlickPay = async () => {
    if (slickpayCreating || Boolean(pendingSlickPay)) return;
    setSlickpayCreating(true);
    setError('');
    setSlickpaySuccessBanner(null);

    try {
      const checkout = await createSlickPaySubscriptionCheckout({
        directorId: liveUser.id,
        prenom: liveUser.prenom,
        nom: liveUser.nom,
        crecheName: crecheLabel,
        email: liveUser.email || '',
        telephone: liveUser.telephone || creche?.telephone,
        currentEndDate: liveUser.dateFinAbonnement,
        planMonths,
        couponCode: pricing.discount > 0 ? normalizedCoupon : undefined,
      });

      if (checkout.mode === 'live') {
        const nextPending: PendingSlickPayOrder = {
          orderId: checkout.orderId,
          invoiceId: checkout.invoiceId,
          directorId: liveUser.id,
          paymentUrl: checkout.paymentUrl,
          amountDzd: checkout.amountDzd,
          planMonths,
          mode: 'live',
          createdAt: new Date().toISOString(),
        };
        savePendingSlickPayOrder(nextPending);
        setPendingSlickPay(nextPending);
        window.location.assign(checkout.paymentUrl);
        return;
      }

      // Mode passerelle démo (aperçu local sans Edge Function déployée)
      setSlickpayCreating(false);
      setDemoCardType(selectedCardBrand);
      setDemoGatewayCheckout(checkout);
    } catch (err) {
      setSlickpayCreating(false);
      setError(
        err instanceof Error
          ? err.message
          : t('Connexion SlickPay indisponible. Utilisez WhatsApp.', 'تعذر الاتصال ببوابة الدفع. تواصل عبر واتساب.')
      );
    }
  };

  const handleConfirmDemoPayment = (delayMs = 1500) => {
    if (!demoGatewayCheckout || !liveUser?.id) return;
    const targetCheckout = demoGatewayCheckout;
    const chosenCard = demoCardType;
    setDemoGatewayCheckout(null);

    // Active immédiatement le verrouillage plein écran jusqu'à réception du webhook simulé
    scheduleDemoSlickPayBackgroundWebhook(targetCheckout, liveUser.id, chosenCard, delayMs);
    setPendingSlickPay(getPendingSlickPayOrder(liveUser.id));
  };

  const handleManualRecheck = async () => {
    if (!pendingSlickPay?.orderId || manualRechecking) return;
    setManualRechecking(true);
    try {
      const res = await verifySlickPaySubscriptionOrder(pendingSlickPay.orderId);
      if (res.status === 'paid' && res.newEndDate) {
        clearPendingSlickPayOrder(pendingSlickPay.orderId);
        setPendingSlickPay(null);
        setConfirmedModalEndDate(res.newEndDate);
        setSlickpaySuccessBanner({ newEndDate: res.newEndDate, txRef: res.transactionRef });
        showToast(
          t('Paiement confirmé — abonnement prolongé !', 'تم تأكيد الدفع وتمديد الاشتراك!'),
          'success'
        );
        setTimeout(() => setConfirmedModalEndDate(null), 1300);
      } else if (res.status === 'failed') {
        clearPendingSlickPayOrder(pendingSlickPay.orderId);
        setPendingSlickPay(null);
        setError(res.rejectionReason || t('Paiement refusé ou annulé.', 'تم رفض أو إلغاء عملية الدفع.'));
      }
    } finally {
      setManualRechecking(false);
    }
  };

  const handleCancelWaiting = () => {
    if (!pendingSlickPay) return;
    clearPendingSlickPayOrder(pendingSlickPay.orderId);
    setPendingSlickPay(null);
    setPollAttempt(0);
  };

  // Phase du verrouillage plein écran (bloque 100 % de la page tant que l'opération est active)
  const lockOpen =
    !demoGatewayCheckout &&
    (slickpayCreating || Boolean(pendingSlickPay) || Boolean(confirmedModalEndDate));
  const lockPhase: SlickPayLockPhase = confirmedModalEndDate
    ? 'confirmed'
    : pendingSlickPay
      ? 'waiting'
      : 'creating';

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="mx-auto max-w-4xl space-y-5 pb-12">
      {/* Verrouillage plein écran bloquant jusqu'à validation du paiement */}
      <SlickPayFullScreenLock
        open={lockOpen}
        phase={lockPhase}
        isArabic={isArabic}
        amountDzd={pendingSlickPay?.amountDzd ?? pricing.finalPrice}
        planMonths={pendingSlickPay?.planMonths ?? planMonths}
        invoiceId={pendingSlickPay?.invoiceId}
        paymentUrl={pendingSlickPay?.paymentUrl}
        pollAttempt={pollAttempt}
        rechecking={manualRechecking}
        confirmedEndDate={confirmedModalEndDate || undefined}
        onRecheckNow={handleManualRecheck}
        onCancelWait={handleCancelWaiting}
        onDismissConfirmed={() => setConfirmedModalEndDate(null)}
      />

      {/* En-tête épuré sur 1 ligne */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="min-h-9! inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer transition"
            >
              {isArabic ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
              <span>{t('Retour', 'رجوع')}</span>
            </button>
          )}
          <h1 className="truncate text-lg sm:text-xl font-black text-slate-900">
            {t('Abonnement & Paiement', 'الاشتراك والدفع')}
          </h1>
        </div>

        <span
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black whitespace-nowrap ${
            isExpired
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>
            {isExpired
              ? t('Expiré', 'منتهي')
              : formattedCurrentEnd
                ? t(`Actif · ${formattedCurrentEnd}`, `نشط · ${formattedCurrentEnd}`)
                : t('Actif', 'نشط')}
          </span>
        </span>
      </div>

      {/* Bannière de confirmation après déblocage */}
      {slickpaySuccessBanner && (
        <div
          role="status"
          data-testid="slickpay-success-banner"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span className="truncate text-xs sm:text-sm font-black">
              {t(
                `Abonnement actif jusqu’au ${new Date(`${slickpaySuccessBanner.newEndDate}T00:00:00`).toLocaleDateString('fr-FR')}`,
                `تم تمديد الاشتراك إلى غاية ${slickpaySuccessBanner.newEndDate}`
              )}
            </span>
          </div>
          {slickpaySuccessBanner.txRef && (
            <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-800 border border-emerald-200">
              {slickpaySuccessBanner.txRef}
            </span>
          )}
        </div>
      )}

      {/* Message d'erreur éventuel */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700"
        >
          <span className="truncate">{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="min-h-7! shrink-0 rounded-lg p-1 text-rose-500 hover:bg-rose-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Carte d'identité Abonnement Crèche (sobre, sombre & premium) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-indigo-500/20 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-200">
              <Sparkles className="h-3 w-3 shrink-0 text-amber-300" />
              <span className="truncate">{crecheLabel}</span>
            </div>
            <h2 className="truncate text-base sm:text-lg font-black tracking-tight">
              {t('Licence Rawdha+ · Accès Complet', 'رخصة Rawdha+ · وصول كامل')}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {[
                t('Enfants illimités', 'أطفال غير محدودين'),
                t('Push Parents 0 DA', 'إشعارات مجانية'),
                t('Factures & PDF', 'فواتير وملفات PDF'),
                t('Équipe multi-profils', 'حسابات الفريق'),
              ].map((feat, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-100 whitespace-nowrap"
                >
                  <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                  <span>{feat}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-xs sm:text-end">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-200">
              {t('Après renouvellement', 'بعد التجديد')}
            </div>
            <div className="mt-0.5 text-base sm:text-lg font-black text-white tabular-nums whitespace-nowrap">
              {formattedProjectedEnd}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-emerald-300 whitespace-nowrap">
              +{isArabic ? durationTextAr : durationTextFr}
            </div>
          </div>
        </div>
      </div>

      {/* Étape 1 : Choix de la durée (3 cartes claires, sans slide) */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            {t('1. Durée d’abonnement', '1. مدة الاشتراك')}
          </span>
          <span className="text-xs font-bold text-indigo-600 whitespace-nowrap">
            {t('Cumulé sans perte de jours', 'يُضاف دون ضياع الأيام المتبقية')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SUBSCRIPTION_PLAN_OPTIONS.map(opt => {
            const active = planMonths === opt.months;
            const monthlyEq = Math.round(opt.priceDzd / opt.months);
            const planLabel =
              opt.months === 12
                ? t('Annuel · 12 mois', 'سنوي · 12 شهراً')
                : opt.months === 3
                  ? t('Trimestriel · 3 mois', 'فصلي · 3 أشهر')
                  : t('Mensuel · 1 mois', 'شهري · شهر واحد');
            const savingBadge =
              opt.months === 3
                ? t('-300 DA', '-300 د.ج')
                : opt.badgeFr
                  ? isArabic
                    ? opt.badgeAr
                    : opt.badgeFr
                  : null;
            return (
              <button
                key={opt.months}
                type="button"
                data-testid={`plan-option-${opt.months}m`}
                onClick={() => setPlanMonths(opt.months)}
                className={`relative flex flex-col justify-between rounded-2xl border-2 p-4 text-start transition cursor-pointer ${
                  active
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-2 ring-indigo-600/10'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="text-xs font-black text-slate-800 truncate">{planLabel}</span>
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                      active
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-300 bg-white text-transparent'
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-slate-950 tabular-nums">
                    {opt.priceDzd.toLocaleString('fr-FR')}
                  </span>
                  <span className="text-xs font-bold text-slate-500">{t('DA', 'د.ج')}</span>
                  {savingBadge && (
                    <span className="ms-auto shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800 whitespace-nowrap">
                      {savingBadge}
                    </span>
                  )}
                </div>

                <div className="mt-1.5 text-[11px] font-semibold text-slate-500 truncate">
                  {opt.months === 1
                    ? t('Sans engagement', 'بدون التزام')
                    : t(
                        `Soit ${monthlyEq.toLocaleString('fr-FR')} DA / mois`,
                        `أي ${monthlyEq.toLocaleString('fr-FR')} د.ج / شهر`
                      )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Étape 2 : Paiement CIB / Edahabia OU WhatsApp */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Carte principale : Paiement en ligne Edahabia / CIB avec vrais logos officiels */}
        <section className="lg:col-span-7 flex flex-col justify-between rounded-3xl border-2 border-indigo-600/20 bg-white p-5 sm:p-6 shadow-sm space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600">
                  {t('2. Paiement en ligne instantané', '2. الدفع الإلكتروني الفوري')}
                </span>
                <h2 className="truncate text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  {t('Paiement par Carte CIB / Edahabia', 'الدفع ببطاقة CIB / الذهبية')}
                </h2>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                  <img
                    src="/payment/edahabia.png"
                    alt="Carte Edahabia Algérie Poste"
                    className="h-full w-full object-contain"
                  />
                </span>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                  <img
                    src="/payment/cib.png"
                    alt="Carte CIB SATIM"
                    className="h-full w-full object-contain"
                  />
                </span>
              </div>
            </div>

            {/* Sélecteur visuel des 2 cartes algériennes avec leurs logos PNG */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedCardBrand('Edahabia')}
                className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-start transition cursor-pointer ${
                  selectedCardBrand === 'Edahabia'
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white p-1 shadow-2xs">
                  <img
                    src="/payment/edahabia.png"
                    alt="Edahabia"
                    className="h-full w-full object-contain"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-black text-slate-900">
                    {t('Edahabia', 'البطاقة الذهبية')}
                  </div>
                  <div className="truncate text-[10.5px] font-semibold text-slate-500">
                    {t('Algérie Poste', 'بريد الجزائر')}
                  </div>
                </div>
                {selectedCardBrand === 'Edahabia' && (
                  <span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-indigo-600 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedCardBrand('CIB')}
                className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-start transition cursor-pointer ${
                  selectedCardBrand === 'CIB'
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white p-1 shadow-2xs">
                  <img
                    src="/payment/cib.png"
                    alt="Carte CIB"
                    className="h-full w-full object-contain"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-black text-slate-900">
                    {t('Carte CIB', 'بطاقة CIB')}
                  </div>
                  <div className="truncate text-[10.5px] font-semibold text-slate-500">
                    {t('Banques d’Algérie', 'البنوك الجزائرية')}
                  </div>
                </div>
                {selectedCardBrand === 'CIB' && (
                  <span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-indigo-600 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            </div>

            {/* Ticket récapitulatif net */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-600 truncate">
                  {t('Formule choisie', 'الباقة المختارة')}
                </span>
                <span className="shrink-0 font-bold text-slate-900 whitespace-nowrap">
                  Rawdha+ · {isArabic ? durationTextAr : durationTextFr}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-600 truncate">
                  {t('Nouvelle date de fin', 'تاريخ الانتهاء الجديد')}
                </span>
                <span className="shrink-0 font-bold text-indigo-700 whitespace-nowrap">
                  {formattedProjectedEnd}
                </span>
              </div>

              {pricing.discount > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs text-emerald-700">
                  <span className="font-bold truncate">
                    {t(`Remise (${normalizedCoupon})`, `خصم (${normalizedCoupon})`)}
                  </span>
                  <span className="shrink-0 font-black tabular-nums">
                    -{pricing.discount.toLocaleString('fr-FR')} {t('DA', 'د.ج')}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {t('Net à payer', 'المبلغ الصافي')}
                </span>
                <span className="text-xl font-black text-slate-950 tabular-nums whitespace-nowrap">
                  {pricing.finalPrice.toLocaleString('fr-FR')} {t('DA', 'د.ج')}
                </span>
              </div>
            </div>

            {/* Code promo discret */}
            <div>
              {!showPromoField && !coupon ? (
                <button
                  type="button"
                  onClick={() => setShowPromoField(true)}
                  className="min-h-8! inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 whitespace-nowrap cursor-pointer"
                >
                  <Tag className="h-3.5 w-3.5 shrink-0" />
                  <span>{t('Ajouter un code promo', 'إضافة كود خصم')}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={coupon}
                    onChange={e => setCoupon(e.target.value)}
                    placeholder={t('Code promo', 'كود الخصم')}
                    className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold uppercase text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                  {pricing.discount > 0 && (
                    <span className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-black text-emerald-700 border border-emerald-200 whitespace-nowrap">
                      -{pricing.discount} {t('DA', 'د.ج')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              data-testid="slickpay-pay-btn"
              disabled={slickpayCreating || Boolean(pendingSlickPay)}
              onClick={handlePayWithSlickPay}
              className="min-h-12! w-full inline-flex items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap cursor-pointer transition"
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white p-0.5">
                <img
                  src={selectedCardBrand === 'Edahabia' ? '/payment/edahabia.png' : '/payment/cib.png'}
                  alt={selectedCardBrand}
                  className="h-full w-full object-contain"
                />
              </span>
              <span className="truncate">
                {t(
                  `Payer ${pricing.finalPrice.toLocaleString('fr-FR')} DA par CIB / Edahabia`,
                  `ادفع ${pricing.finalPrice.toLocaleString('fr-FR')} د.ج ببطاقة CIB / الذهبية`
                )}
              </span>
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="truncate">
                {t('Homologué SATIM · Activation automatique immédiate', 'معتمد من SATIM · تفعيل فوري تلقائي')}
              </span>
            </div>
          </div>
        </section>

        {/* Option alternative : Contacter directement sur WhatsApp */}
        <section className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-emerald-200/90 bg-gradient-to-b from-emerald-50/60 via-white to-white p-5 sm:p-6 shadow-xs space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                  {t('Alternative directe', 'بديل مباشر')}
                </span>
                <h2 className="truncate text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  {t('Activer via WhatsApp', 'التفعيل عبر واتساب')}
                </h2>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <MessageCircle className="h-5 w-5" />
              </span>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-emerald-100 bg-white p-4">
              {[
                t('Sans carte CIB / Edahabia', 'بدون بطاقة بنكية أو ذهبية'),
                t('Message pré-rempli avec votre tarif', 'رسالة جاهزة بتفاصيل باقتك'),
                t('Activation directe avec notre équipe', 'تفعيل مباشر مع فريق Rawdha+'),
              ].map((line, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-800">
                    {i + 1}
                  </span>
                  <span className="truncate">{line}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3.5 py-2.5 border border-slate-200/70 text-xs">
              <span className="font-semibold text-slate-600 truncate">
                {isArabic ? durationTextAr : durationTextFr}
              </span>
              <span className="shrink-0 font-black text-slate-900 tabular-nums whitespace-nowrap">
                {pricing.finalPrice.toLocaleString('fr-FR')} {t('DA', 'د.ج')}
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="whatsapp-subscribe-btn"
              className="min-h-12! w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 whitespace-nowrap cursor-pointer transition"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('Contacter sur WhatsApp', 'تواصل معنا عبر واتساب')}</span>
            </a>

            <div className="text-center text-[11px] font-semibold text-slate-400 truncate">
              {t('Assistance directe 7j/7 · Algérie', 'مرافقة مباشرة طوال الأسبوع · الجزائر')}
            </div>
          </div>
        </section>
      </div>

      {/* Historique des activations (compact, affiché uniquement s'il existe) */}
      {history.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
            {t('Historique des paiements', 'سجل المدفوعات')}
          </h3>
          <div className="divide-y divide-slate-100">
            {history.slice(0, 6).map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  {item.status === 'approved' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <span className="font-black text-slate-900 tabular-nums whitespace-nowrap">
                    {item.amountDzd.toLocaleString('fr-FR')} {t('DA', 'د.ج')}
                  </span>
                  <span className="text-slate-500 truncate">
                    · {item.planMonths} {t('mois', 'أشهر')}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-black whitespace-nowrap ${
                    item.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {item.status === 'approved' ? t('Confirmé', 'مؤكد') : t('En cours', 'قيد المعالجة')}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fenêtre passerelle SATIM / SlickPay (uniquement en mode aperçu démo) */}
      {demoGatewayCheckout &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            role="dialog"
            aria-modal="true"
            data-testid="slickpay-demo-modal"
            className="fixed inset-0 z-[10010] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
          >
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 bg-slate-900 px-5 py-4 text-white">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Lock className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="truncate text-sm font-black">
                    {t('Passerelle SlickPay · SATIM', 'بوابة SlickPay · SATIM')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDemoGatewayCheckout(null)}
                  className="min-h-8! rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-600 truncate">
                    Rawdha+ · {demoGatewayCheckout.planMonths} {t('mois', 'أشهر')}
                  </span>
                  <span className="text-lg font-black text-slate-950 tabular-nums whitespace-nowrap">
                    {demoGatewayCheckout.amountDzd.toLocaleString('fr-FR')} {t('DA', 'د.ج')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {(['Edahabia', 'CIB'] as const).map(card => (
                    <button
                      key={card}
                      type="button"
                      onClick={() => setDemoCardType(card)}
                      className={`min-h-12! flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-black whitespace-nowrap transition cursor-pointer ${
                        demoCardType === card
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white p-0.5 border border-slate-200">
                        <img
                          src={card === 'Edahabia' ? '/payment/edahabia.png' : '/payment/cib.png'}
                          alt={card}
                          className="h-full w-full object-contain"
                        />
                      </span>
                      <span className="truncate">
                        {card === 'Edahabia' ? t('Edahabia', 'الذهبية') : t('Carte CIB', 'بطاقة CIB')}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  data-testid="slickpay-demo-confirm-btn"
                  onClick={() => handleConfirmDemoPayment(1400)}
                  className="min-h-11! w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs sm:text-sm font-black text-white hover:bg-emerald-700 whitespace-nowrap cursor-pointer transition"
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {t(
                      `Valider ${demoGatewayCheckout.amountDzd.toLocaleString('fr-FR')} DA (${demoCardType})`,
                      `تأكيد دفع ${demoGatewayCheckout.amountDzd.toLocaleString('fr-FR')} د.ج (${demoCardType})`
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
