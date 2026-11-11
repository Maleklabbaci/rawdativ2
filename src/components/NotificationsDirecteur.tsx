import { invoicePeriod, reminderContext, reminderBlockReason } from '../utils/financePeriod';
import FinanceUnavailable from './FinanceUnavailable';
import { useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, CreditCard, Megaphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

export default function NotificationsDirecteur({ onNavigateToPaiements }: { onNavigateToPaiements: () => void }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const { notifications, paiements, enfants, markNotificationRead, financialDataReady } = useDb();
  const isFrench = language !== 'ar';
  const [readingIds, setReadingIds] = useState<string[]>([]);
  const readingRef = useRef(new Set<string>());

  const announcements = useMemo(() => notifications
    .filter(notification => notification.recipientRole === 'all_directeurs' || notification.recipientRole === user?.id || notification.recipientIds?.includes(user?.id || ''))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [notifications, user?.id]);
  const reminderState = useMemo(() => reminderContext(paiements), [paiements]);
  const suspected = reminderState.suspectedIds;
  const needsReview = paiements.filter(p => { const reason = reminderBlockReason(p, reminderState); return reason === 'period' || reason === 'sibling-period' || reason === 'details'; }).length;
  const eligible = useMemo(() => paiements
    .filter(payment => reminderBlockReason(payment, reminderState) === null)
    .map(payment => ({ payment, child: enfants.find(child => child.id === payment.enfantId) })), [enfants, paiements, reminderState]);
  const missingChildren = eligible.filter(row => !row.child).length;
  const pending = eligible.filter(row => row.child);

  const markRead = async (id: string) => {
    if (!user?.id || readingRef.current.has(id)) return;
    readingRef.current.add(id);
    setReadingIds(ids => [...ids, id]);
    try {
      await markNotificationRead(id, user.id);
    } catch {
      showToast(isFrench ? 'Lecture non confirmée. Vérifiez cette annonce avant de réessayer.' : 'لم يتأكد تسجيل القراءة. تحقق من الإعلان قبل المحاولة مجدداً.', 'error');
    } finally {
      readingRef.current.delete(id);
      setReadingIds(ids => ids.filter(item => item !== id));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6" dir={isFrench ? 'ltr' : 'rtl'}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600 shrink-0" />
            <span>{isFrench ? 'Notifications' : 'الإشعارات'}</span>
          </h1>
          <p className="hidden sm:block mt-0.5 text-xs text-slate-500">{isFrench ? 'Annonces de la plateforme et factures à vérifier.' : 'إعلانات المنصة والفواتير التي تحتاج للمتابعة.'}</p>
        </div>
      </div>
      {financialDataReady && suspected.size > 0 && <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">{isFrench ? 'Les factures liées à un soupçon sont masquées ici ; consultez leur suivi.' : 'الفواتير المرتبطة باشتباه مخفية هنا؛ راجع متابعتها.'}</p>}
      {financialDataReady && needsReview > 0 && <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">{isFrench ? `${needsReview} facture(s) exclues des rappels : période à vérifier sur leur dossier, ou montant/statut à vérifier. Consultez la facturation.` : `${needsReview} فاتورة مستثناة من التذكيرات بسبب فترة تحتاج للمراجعة في ملف الطفل أو مبلغ أو حالة تحتاج للتحقق. راجع الفواتير.`}</p>}
      {financialDataReady && missingChildren > 0 && <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">{isFrench ? `${missingChildren} facture(s) non affichées ici : enfant associé introuvable dans les données chargées. Vérifiez la facturation.` : `${missingChildren} فاتورة غير معروضة هنا: الطفل المرتبط غير موجود في البيانات المحمّلة. راجع الفواتير.`}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3"><Megaphone className="h-4 w-4 text-indigo-600" /><h2 className="text-sm font-bold text-slate-900">{isFrench ? 'Annonces' : 'الإعلانات'}</h2></div>
          {announcements.length === 0 ? <p className="px-4 py-8 text-center text-xs text-slate-500">{isFrench ? 'Aucune annonce.' : 'لا توجد إعلانات.'}</p> : <div className="divide-y divide-slate-100">{announcements.map(notification => {
            const read = notification.readBy?.includes(user?.id || '');
            const reading = readingIds.includes(notification.id);
            const date = new Date(notification.createdAt);
            return <article key={notification.id} className={`px-4 py-3 ${read ? '' : 'border-s-2 border-indigo-500 bg-indigo-50/30'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs sm:text-sm font-bold text-slate-900">{notification.title}</p>
                <span className="shrink-0 text-[10.5px] font-medium text-slate-400 tabular-nums">{Number.isNaN(date.getTime()) ? (isFrench ? 'Date non renseignée' : 'التاريخ غير متوفر') : date.toLocaleDateString(isFrench ? 'fr-FR' : 'ar-DZ')}</span>
              </div>
              <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-600">{notification.message}</p>
              <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-slate-500">{reading ? (isFrench ? 'Enregistrement…' : 'جارٍ الحفظ…') : read ? (isFrench ? 'Lue' : 'مقروء') : (isFrench ? 'Non lue' : 'غير مقروء')}</span>{!read && <button type="button" disabled={reading || !user?.id} onClick={() => void markRead(notification.id)} className="min-h-8! whitespace-nowrap rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 cursor-pointer">{isFrench ? 'Marquer comme lue' : 'تحديد كمقروء'}</button>}</div>
            </article>;
          })}</div>}
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs"><div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3"><CreditCard className="h-4 w-4 text-amber-600" /><h2 className="text-sm font-bold text-slate-900">{isFrench ? 'Factures à vérifier' : 'فواتير تحتاج للمتابعة'}</h2></div>{!financialDataReady ? <FinanceUnavailable /> : pending.length === 0 ? <div className="flex flex-col items-center px-4 py-8 text-center text-xs text-slate-500"><CheckCheck className="mb-2 h-7 w-7 text-emerald-500" />{isFrench ? 'Aucune facture à vérifier affichée.' : 'لا توجد فواتير ظاهرة للمتابعة.'}</div> : <div className="divide-y divide-slate-100">{pending.map(({ payment, child }) => <button key={payment.id} type="button" onClick={onNavigateToPaiements} className="block w-full px-4 py-3 text-start transition hover:bg-slate-50 cursor-pointer"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs sm:text-sm font-bold text-slate-900">{child?.prenom} {child?.nom}</p><p className="mt-0.5 truncate text-xs text-slate-500 tabular-nums">{invoicePeriod(payment)} · {payment.montant.toLocaleString()} DA</p></div><span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${payment.statut === 'Retard' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{isFrench ? payment.statut : payment.statut === 'Retard' ? 'متأخرة' : 'قيد الانتظار'}</span></div></button>)}</div>}</section>
      </div>
    </div>
  );
}
