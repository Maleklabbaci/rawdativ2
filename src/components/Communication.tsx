import { useMemo, useState } from 'react';
import { CheckCircle2, MessageCircle, Phone, Send } from 'lucide-react';
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
  const { paiements, enfants } = useDb();
  const { language } = useLanguage();
  const isFrench = language !== 'ar';
  const [whatsappPreview, setWhatsappPreview] = useState<{ phone: string; childName: string; message: string } | null>(null);

  const rows = useMemo(() => {
    const visibleChildren = enfants.filter(child => !user?.id || child.crecheId === user.id);
    const visibleIds = new Set(visibleChildren.map(child => child.id));
    return paiements
      .filter(payment => payment.statut !== 'Payé' && visibleIds.has(payment.enfantId))
      .map(payment => {
        const enfant = visibleChildren.find(child => child.id === payment.enfantId);
        const parents = enfant?.parents.map(item => ({ ...item, phone: normalizeAlgerianWhatsApp(item.telephone) })) || [];
        const parent = parents.find(item => Boolean(item.phone)) || parents[0] || null;
        if (!enfant || !parent) return null;
        const period = isFrench ? payment.moisConcerne : payment.moisConcerne.replace(/janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/gi, month => ({ janvier: 'جانفي', février: 'فيفري', mars: 'مارس', avril: 'أفريل', mai: 'ماي', juin: 'جوان', juillet: 'جويلية', août: 'أوت', septembre: 'سبتمبر', octobre: 'أكتوبر', novembre: 'نوفمبر', décembre: 'ديسمبر' }[month.toLowerCase()] ?? month));
        const message = isFrench
          ? `Bonjour,\n\nNous vous rappelons que la facture de ${enfant.prenom} ${enfant.nom} pour ${period} (${formatCurrency(payment.montant)}) est ${payment.statut === 'Retard' ? 'en retard et reste impayée' : 'en attente de règlement'}. Échéance : ${payment.dateEcheance || 'non précisée'}.\n\nMerci de prendre contact avec la direction de la crèche.\n\nCordialement,\nLa direction`
          : `السلام عليكم، نذكركم بأن فاتورة ${enfant.prenom} ${enfant.nom} الخاصة بـ ${period} بمبلغ ${formatCurrency(payment.montant)} ${payment.statut === 'Retard' ? 'متأخرة وغير مسددة' : 'في انتظار التسديد'}. تاريخ الاستحقاق: ${payment.dateEcheance || 'غير محدد'}. شكراً لتواصلكم مع إدارة الحضانة.`;
        return { payment, enfant, parent, message };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [enfants, isFrench, paiements, user?.id]);

  const openWhatsApp = (phone: string, childName: string, message: string) => {
    setWhatsappPreview({ phone, childName, message });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir={isFrench ? 'ltr' : 'rtl'}>
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">{isFrench ? 'Communication' : 'التواصل'}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{isFrench ? 'Relancer les familles' : 'التواصل مع العائلات'}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {isFrench
            ? 'Consultez les paiements en attente et ouvrez une conversation WhatsApp avec le parent concerné.'
            : 'راجعوا المدفوعات المعلقة وافتحوا محادثة واتساب مع ولي الطفل المعني.'}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <p>{isFrench ? 'Le message est préparé automatiquement, mais rien n’est envoyé sans votre clic dans WhatsApp.' : 'يتم إعداد الرسالة تلقائياً، ولا يتم إرسال أي شيء دون الضغط على زر واتساب.'}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isFrench ? 'À traiter' : 'للمعالجة'}</p><p className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isFrench ? 'Retards' : 'المتأخرات'}</p><p className="mt-1 text-2xl font-bold text-rose-600">{rows.filter(row => row.payment.statut === 'Retard').length}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isFrench ? 'Numéros valides' : 'الأرقام الصالحة'}</p><p className="mt-1 text-2xl font-bold text-emerald-600">{rows.filter(row => Boolean(row.parent.phone)).length}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isFrench ? 'À vérifier' : 'تحتاج إلى التحقق'}</p><p className="mt-1 text-2xl font-bold text-amber-600">{rows.filter(row => !row.parent.phone).length}</p></div>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="text-base font-bold text-slate-900">{isFrench ? 'Paiements nécessitant un rappel' : 'المدفوعات التي تحتاج إلى تذكير'}</h2>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
            {isFrench ? 'Aucun rappel à envoyer pour le moment.' : 'لا توجد تذكيرات لإرسالها حالياً.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map(({ payment, enfant, parent, message }) => (
              <div key={payment.id} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{enfant.prenom} {enfant.nom}</p>
                  <p className="mt-1 text-sm text-slate-500">{payment.moisConcerne} · {formatCurrency(payment.montant)} · {parent.prenom} {parent.nom}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Phone className="h-3.5 w-3.5" />{parent.telephone || (isFrench ? 'Numéro non renseigné' : 'رقم غير مسجل')}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${payment.statut === 'Retard' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{payment.statut}</span>
                  {parent.phone ? (
                    <button type="button" onClick={() => openWhatsApp(parent.phone as string, `${enfant.prenom} ${enfant.nom}`, message)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
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

      {whatsappPreview && (
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
            <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{whatsappPreview.message}</p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setWhatsappPreview(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">{isFrench ? 'Annuler' : 'إلغاء'}</button>
              <a href={`https://wa.me/${whatsappPreview.phone}?text=${encodeURIComponent(whatsappPreview.message)}`} target="_blank" rel="noopener noreferrer" onClick={() => setWhatsappPreview(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700"><MessageCircle className="h-4 w-4" />{isFrench ? 'Ouvrir WhatsApp' : 'فتح واتساب'}</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
