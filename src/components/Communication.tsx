import { useReminderPreflight } from '../hooks/useReminderPreflight';
import type { Enfant, Paiement } from '../types';
import { invoicePeriod, reminderContext, reminderBlockReason } from '../utils/financePeriod';
import FinanceUnavailable from './FinanceUnavailable';
import ParentPortalDirectorPanel from './ParentPortalDirectorPanel';
import PublicParentPortal from './PublicParentPortal';
import { useEffect, useMemo, useState } from 'react';
import { BellRing, CheckCircle2, MessageCircle, Phone, QrCode, Send, Smartphone, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatCurrency } from '../utils/format';

const normalizeAlgerianWhatsApp = (raw?: string) => {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  let normalized = digits;
  if (normalized.startsWith('00213')) normalized = normalized.slice(2);
  else if (normalized.startsWith('0') && normalized.length === 10) normalized = `213${normalized.slice(1)}`;
  else if (normalized.length === 9 && /^[567]/.test(normalized)) normalized = `213${normalized}`;
  return /^213[567]\d{8}$/.test(normalized) ? normalized : null;
};

export default function Communication() {
  const { user } = useAuth();
  const { paiements, enfants, financialDataReady } = useDb();
  const { language } = useLanguage();
  const isFrench = language !== 'ar';
  const reminderCheck = useReminderPreflight(paiements, enfants, financialDataReady);
  const [whatsappPreview, setWhatsappPreview] = useState<{ invoiceId: string; invoiceSnapshot: string; phone: string; childName: string; message: string } | null>(null);
  const [previewInvalidated, setPreviewInvalidated] = useState(false);
  const [activeTab, setActiveTab] = useState<'reminders' | 'links' | 'push'>('reminders');
  const [pendingParentLinksCount, setPendingParentLinksCount] = useState(0);
  const [showParentSimulator, setShowParentSimulator] = useState(false);

  useEffect(() => {
    const crecheId = user?.id || 'preview-director';
    const readPendingCount = () => {
      try {
        const raw = localStorage.getItem('rawdha_parent_link_requests_v1');
        if (!raw) {
          setPendingParentLinksCount(0);
          return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setPendingParentLinksCount(
            parsed.filter((r) => r && r.crecheId === crecheId && r.status === 'pending').length,
          );
        }
      } catch {
        setPendingParentLinksCount(0);
      }
    };
    readPendingCount();
    window.addEventListener('rawdha-parent-portal-updated', readPendingCount);
    window.addEventListener('storage', readPendingCount);
    return () => {
      window.removeEventListener('rawdha-parent-portal-updated', readPendingCount);
      window.removeEventListener('storage', readPendingCount);
    };
  }, [user?.id]);

  const rows = useMemo(() => {
    const visibleChildren = enfants.filter(child => !user?.id || child.crecheId === user.id);
    const visibleIds = new Set(visibleChildren.map(child => child.id));
    const reminderState = reminderContext(paiements);
    return paiements
      .filter(payment => visibleIds.has(payment.enfantId) && reminderBlockReason(payment, reminderState) === null)
      .map(payment => {
        const enfant = visibleChildren.find(child => child.id === payment.enfantId);
        const parents = enfant?.parents?.map(item => ({ ...item, phone: normalizeAlgerianWhatsApp(item.telephone) })) || [];
        const parent = parents.find(item => Boolean(item.phone)) || parents[0] || null;
        if (!enfant) return null;
        const recordedPeriod = invoicePeriod(payment);
        const period = isFrench ? recordedPeriod : recordedPeriod.replace(/janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/gi, month => ({ janvier: 'جانفي', février: 'فيفري', mars: 'مارس', avril: 'أفريل', mai: 'ماي', juin: 'جوان', juillet: 'جويلية', août: 'أوت', septembre: 'سبتمبر', octobre: 'أكتوبر', novembre: 'نوفمبر', décembre: 'ديسمبر' }[month.toLowerCase()] ?? month));
        const message = isFrench
          ? `Bonjour,\n\nMerci de contacter la direction pour vérifier la facture enregistrée pour ${enfant.prenom} ${enfant.nom}, période ${period}, montant ${formatCurrency(payment.montant)}. Échéance enregistrée : ${payment.dateEcheance || 'non précisée'}.\n\nCordialement,\nLa direction`
          : `السلام عليكم، نرجو التواصل مع إدارة الروضة للتحقق من الفاتورة المسجلة باسم ${enfant.prenom} ${enfant.nom} للفترة ${period} بمبلغ ${formatCurrency(payment.montant)}. تاريخ الاستحقاق المسجل: ${payment.dateEcheance || 'غير محدد'}. شكراً لكم.`;
        return { payment, enfant, parent, message };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [enfants, isFrench, paiements, user?.id]);

  const previewRow = whatsappPreview && rows.find(row => row.payment.id === whatsappPreview.invoiceId);
  const previewCurrent = !!whatsappPreview && financialDataReady && !!previewRow
    && JSON.stringify(previewRow.payment) === whatsappPreview.invoiceSnapshot
    && previewRow.parent?.phone === whatsappPreview.phone
    && `${previewRow.enfant.prenom} ${previewRow.enfant.nom}` === whatsappPreview.childName
    && previewRow.message === whatsappPreview.message;
  useEffect(() => {
    if (whatsappPreview && !previewCurrent) { setWhatsappPreview(null); setPreviewInvalidated(true); }
  }, [whatsappPreview, previewCurrent]);

  const openWhatsApp = async (payment: Paiement, child: Enfant, phone: string, rawPhone: string, message: string) => {
    if (!await reminderCheck.verify(payment, child, rawPhone)) return;
    setPreviewInvalidated(false);
    setWhatsappPreview({ invoiceId: payment.id, invoiceSnapshot: JSON.stringify(payment), phone, childName: `${child.prenom} ${child.nom}`, message });
  };

  const reminderState = reminderContext(paiements);
  const visibleChildIds = new Set(enfants.filter(child => !user?.id || child.crecheId === user.id).map(child => child.id));
  const needsReview = paiements.filter(p => {
    if (!visibleChildIds.has(p.enfantId)) return false;
    const reason = reminderBlockReason(p, reminderState);
    return reason === 'period' || reason === 'sibling-period' || reason === 'details';
  }).length;

  if (activeTab === 'reminders' && !financialDataReady) return <FinanceUnavailable />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-5" dir={isFrench ? 'ltr' : 'rtl'}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900">
            {isFrench ? 'Communication & Espace Parent' : 'التواصل وفضاء الأولياء'}
          </h1>
          <p className="hidden sm:block mt-0.5 text-xs text-slate-500">
            {isFrench
              ? 'QR Code automatique Parents, notifications Push gratuites sur téléphone et relances de facturation.'
              : 'رمز QR الذكي للأولياء، إشعارات فورية مجانية على الهاتف وتذكيرات الفواتير.'}
          </p>
        </div>

        {/* Sélecteur 3 onglets nets (sans slide horizontal) */}
        <div className="grid grid-cols-3 sm:inline-flex gap-1 rounded-xl bg-slate-100/90 p-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('reminders')}
            className={`min-h-9! inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer truncate ${
              activeTab === 'reminders' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600 hidden sm:inline" />
            <span className="truncate">{isFrench ? 'Relances' : 'التذكيرات'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={`min-h-9! inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer truncate ${
              activeTab === 'links' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
            <span className="truncate">{isFrench ? 'QR Parents' : 'ربط QR'}</span>
            {pendingParentLinksCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-black shrink-0 ${
                activeTab === 'links' ? 'bg-white text-indigo-700' : 'bg-rose-500 text-white'
              }`}>
                {pendingParentLinksCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('push')}
            className={`min-h-9! inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer truncate ${
              activeTab === 'push' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BellRing className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
            <span className="truncate">{isFrench ? 'Notifs Push' : 'إشعارات Push'}</span>
          </button>
        </div>
      </div>

      {activeTab === 'links' || activeTab === 'push' ? (
        <div className={showParentSimulator ? 'grid grid-cols-1 xl:grid-cols-[1fr_390px] gap-4 items-start' : ''}>
          <div>
            <ParentPortalDirectorPanel
              mode={activeTab}
              onOpenInlineSimulator={() => setShowParentSimulator(prev => !prev)}
            />
          </div>

          {showParentSimulator && (
            <aside className="rounded-[2rem] border-4 border-slate-900 bg-slate-900 shadow-2xl overflow-hidden xl:sticky xl:top-4">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Smartphone className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span>{isFrench ? 'Simulateur Téléphone Parent (Live)' : 'محاكاة هاتف الولي مباشرة'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowParentSimulator(false)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  aria-label="Fermer le simulateur"
                >
                  <X className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
              <div className="max-h-[72vh] overflow-y-auto bg-slate-50 rounded-b-[1.7rem]">
                <PublicParentPortal />
              </div>
            </aside>
          )}
        </div>
      ) : (
      <>
      {reminderState.suspectedIds.size > 0 && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">{isFrench ? 'Les factures liées à un soupçon de doublon sont exclues des rappels, pas des totaux.' : 'الفواتير المرتبطة باشتباه تكرار مستثناة من التذكيرات، لا من الإجماليات.'}</p>}
      {needsReview > 0 && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">{isFrench ? `${needsReview} facture(s) sont exclues des rappels : période à vérifier sur leur dossier, ou montant/statut à vérifier. Elles ne sont pas annulées. Consultez la facturation et les totaux.` : `${needsReview} فاتورة مستثناة من التذكيرات بسبب فترة تحتاج للمراجعة في ملف الطفل أو مبلغ أو حالة تحتاج للتحقق. لم تُلغَ الفواتير. راجع الفواتير والإجماليات.`}</p>}

      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-900">
        <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" />
        <p className="line-clamp-2 sm:line-clamp-none font-medium">{isFrench ? 'Rechargez les données et vérifiez les pièces et les encaissements avant tout contact : un statut ne prouve pas le paiement. Le message sera ouvert chez WhatsApp, un service externe.' : 'أعد تحميل البيانات وراجع الوثائق والتحصيل قبل التواصل؛ الحالة ليست إثباتاً للدفع. ستفتح الرسالة لدى واتساب، وهي خدمة خارجية.'}</p>
      </div>

      {/* 4 KPIs compacts en grille 2×2 sur téléphone (fini les 4 gros blocs empilés) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-2xs"><p className="truncate text-[11px] font-medium text-slate-500">{isFrench ? 'À traiter' : 'للمعالجة'}</p><p className="mt-0.5 text-lg sm:text-2xl font-bold text-slate-900 tabular-nums">{rows.length}</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-2xs"><p className="truncate text-[11px] font-medium text-slate-500">{isFrench ? 'Retards' : 'المتأخرات'}</p><p className="mt-0.5 text-lg sm:text-2xl font-bold text-rose-600 tabular-nums">{rows.filter(row => row.payment.statut === 'Retard').length}</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-2xs"><p className="truncate text-[11px] font-medium text-slate-500">{isFrench ? 'Numéros valides' : 'الأرقام الصالحة'}</p><p className="mt-0.5 text-lg sm:text-2xl font-bold text-emerald-600 tabular-nums">{rows.filter(row => Boolean(row.parent?.phone)).length}</p></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-2xs"><p className="truncate text-[11px] font-medium text-slate-500">{isFrench ? 'À vérifier' : 'تحتاج إلى التحقق'}</p><p className="mt-0.5 text-lg sm:text-2xl font-bold text-amber-600 tabular-nums">{rows.filter(row => !row.parent?.phone).length}</p></div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">{isFrench ? 'Paiements nécessitant un rappel' : 'المدفوعات التي تحتاج إلى تذكير'}</h2>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
            {isFrench ? 'Aucun rappel affichable pour le moment.' : 'لا توجد تذكيرات لإرسالها حالياً.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map(({ payment, enfant, parent, message }) => (
              <div key={payment.id} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{enfant.prenom} {enfant.nom}</p>
                  <p className="mt-1 text-sm text-slate-500">{invoicePeriod(payment)} · {formatCurrency(payment.montant)} · {parent ? `${parent.prenom || ''} ${parent.nom || ''}`.trim() : (isFrench ? 'Parent non renseigné' : 'ولي غير مسجل')}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Phone className="h-3.5 w-3.5" />{parent?.telephone || (isFrench ? 'Numéro non renseigné' : 'رقم غير مسجل')}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${payment.statut === 'Retard' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{payment.statut}</span>
                  {parent?.phone ? (
                    <button type="button" disabled={reminderCheck.busy} onClick={() => void openWhatsApp(payment, enfant, parent.phone as string, parent.telephone, message)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
                      <Send className="h-4 w-4" />{isFrench ? 'Aperçu WhatsApp' : 'معاينة واتساب'}
                    </button>
                  ) : (
                    <span className="inline-flex items-center rounded-lg bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-700">{isFrench ? 'Numéro à vérifier' : 'تحققوا من الرقم'}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {reminderCheck.error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-900">{reminderCheck.error}</p>}
      {reminderCheck.busy && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-xs font-bold text-indigo-900">{isFrench ? 'Vérification préalable en cours…' : 'جارٍ التحقق من البيانات…'}</p>}
      {previewInvalidated && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">{isFrench ? 'Aperçu fermé : les données locales ont changé ou sont indisponibles. Rechargez et vérifiez avant de préparer un nouveau message.' : 'أُغلقت المعاينة لأن البيانات المحلية تغيرت أو أصبحت غير متاحة. أعد التحميل والتحقق قبل إعداد رسالة جديدة.'}</p>}
      {whatsappPreview && previewCurrent && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={() => setWhatsappPreview(null)}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl" dir={isFrench ? 'ltr' : 'rtl'} onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{isFrench ? 'Aperçu avant WhatsApp' : 'معاينة قبل واتساب'}</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">{isFrench ? `Message pour ${whatsappPreview.childName}` : `رسالة إلى ${whatsappPreview.childName}`}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{whatsappPreview.phone}</p>
              </div>
              <button type="button" onClick={() => setWhatsappPreview(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label={isFrench ? 'Fermer' : 'إغلاق'}>×</button>
            </div>
            <p className="mt-3 text-xs font-bold text-amber-800">{isFrench ? 'La vérification est ponctuelle : un autre appareil peut modifier les données ensuite. Vérifiez les pièces et encaissements avant de contacter la famille.' : 'التحقق لحظي وقد تتغير البيانات بعده من جهاز آخر. راجع الوثائق والتحصيل قبل التواصل مع العائلة.'}</p>
            <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{whatsappPreview.message}</p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setWhatsappPreview(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">{isFrench ? 'Annuler' : 'إلغاء'}</button>
              <a href={`https://wa.me/${whatsappPreview.phone}?text=${encodeURIComponent(whatsappPreview.message)}`} target="_blank" rel="noopener noreferrer" onClick={() => setWhatsappPreview(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700"><MessageCircle className="h-4 w-4" />{isFrench ? 'Ouvrir WhatsApp' : 'فتح واتساب'}</a>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
