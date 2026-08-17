import { useMemo } from 'react';
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

  const rows = useMemo(() => {
    const visibleChildren = enfants.filter(child => !user?.id || child.crecheId === user.id);
    const visibleIds = new Set(visibleChildren.map(child => child.id));
    return paiements
      .filter(payment => payment.statut !== 'Payé' && visibleIds.has(payment.enfantId))
      .map(payment => {
        const enfant = visibleChildren.find(child => child.id === payment.enfantId);
        const parent = enfant?.parents
          .map(item => ({ ...item, phone: normalizeAlgerianWhatsApp(item.telephone) }))
          .find(item => Boolean(item.phone));
        if (!enfant || !parent?.phone) return null;
        const message = isFrench
          ? `Bonjour,\n\nNous vous rappelons que la facture de ${enfant.prenom} ${enfant.nom} pour ${payment.moisConcerne} (${formatCurrency(payment.montant)}) est ${payment.statut === 'Retard' ? 'en retard et reste impayée' : 'en attente de règlement'}. Échéance : ${payment.dateEcheance || 'non précisée'}.\n\nMerci de prendre contact avec la direction de la crèche.\n\nCordialement,\nLa direction`
          : `السلام عليكم، نذكركم بأن فاتورة ${enfant.prenom} ${enfant.nom} الخاصة بـ ${payment.moisConcerne} بمبلغ ${formatCurrency(payment.montant)} دج ${payment.statut === 'Retard' ? 'متأخرة وغير مسددة' : 'في انتظار التسديد'}. تاريخ الاستحقاق: ${payment.dateEcheance || 'غير محدد'}. شكراً لتواصلكم مع إدارة الحضانة.`;
        return { payment, enfant, parent, message };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [enfants, isFrench, paiements, user?.id]);

  const openWhatsApp = (phone: string, message: string) => {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isFrench ? 'À traiter' : 'للمعالجة'}</p><p className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isFrench ? 'Retards' : 'المتأخرات'}</p><p className="mt-1 text-2xl font-bold text-rose-600">{rows.filter(row => row.payment.statut === 'Retard').length}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isFrench ? 'Numéros valides' : 'الأرقام الصالحة'}</p><p className="mt-1 text-2xl font-bold text-emerald-600">{rows.length}</p></div>
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
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Phone className="h-3.5 w-3.5" />{parent.telephone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${payment.statut === 'Retard' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{payment.statut}</span>
                  <button type="button" onClick={() => openWhatsApp(parent.phone as string, message)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
                    <Send className="h-4 w-4" />{isFrench ? 'Ouvrir WhatsApp' : 'فتح واتساب'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
