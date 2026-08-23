import { useMemo } from 'react';
import { Bell, CheckCheck, CreditCard, Megaphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function NotificationsDirecteur({ onNavigateToPaiements }: { onNavigateToPaiements: () => void }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { notifications, paiements, enfants, markNotificationRead } = useDb();
  const isFrench = language !== 'ar';

  const announcements = useMemo(() => notifications
    .filter(notification => notification.recipientRole === 'all_directeurs' || notification.recipientRole === user?.id || notification.recipientIds?.includes(user?.id || ''))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [notifications, user?.id]);
  const pending = useMemo(() => paiements
    .filter(payment => payment.statut !== 'Payé')
    .map(payment => ({ payment, child: enfants.find(child => child.id === payment.enfantId) }))
    .filter(row => Boolean(row.child)), [enfants, paiements]);

  const display = (notification: typeof announcements[number]) => {
    const legacy = `${notification.title} ${notification.message}`.toLowerCase();
    if (legacy.includes('siteweb') || legacy.includes('si ta pas')) return { title: isFrench ? 'Information de la plateforme' : 'معلومة من المنصة', message: isFrench ? 'Rawdha+ est disponible pour vous accompagner dans la gestion de votre crèche.' : 'منصة روضتي+ متاحة لمساعدتكم في تسيير الحضانة.' };
    return { title: notification.title, message: notification.message };
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir={isFrench ? 'ltr' : 'rtl'}>
      <div className="border-b border-slate-200 pb-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{isFrench ? 'Suivi' : 'المتابعة'}</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"><Bell className="h-7 w-7 text-indigo-600" />{isFrench ? 'Notifications' : 'الإشعارات'}</h1><p className="mt-2 text-sm text-slate-500">{isFrench ? 'Annonces de la plateforme et paiements à traiter.' : 'إعلانات المنصة والمدفوعات المطلوب متابعتها.'}</p></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4"><Megaphone className="h-4 w-4 text-indigo-600" /><h2 className="font-bold text-slate-900">{isFrench ? 'Annonces' : 'الإعلانات'}</h2></div>{announcements.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">{isFrench ? 'Aucune annonce.' : 'لا توجد إعلانات.'}</p> : <div className="divide-y divide-slate-100">{announcements.map(notification => { const item = display(notification); const read = notification.readBy?.includes(user?.id || ''); return <button key={notification.id} type="button" onClick={() => user?.id && markNotificationRead(notification.id, user.id)} className={`block w-full px-5 py-4 text-left transition hover:bg-slate-50 ${read ? '' : 'border-l-2 border-indigo-500 bg-indigo-50/30'}`}><p className="font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p><p className="mt-2 text-xs text-slate-400">{new Date(notification.createdAt).toLocaleString(isFrench ? 'fr-FR' : 'ar-DZ')}</p></button>; })}</div>}</section>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4"><CreditCard className="h-4 w-4 text-amber-600" /><h2 className="font-bold text-slate-900">{isFrench ? 'Paiements à traiter' : 'المدفوعات المطلوب متابعتها'}</h2></div>{pending.length === 0 ? <div className="flex flex-col items-center px-5 py-10 text-center text-sm text-slate-500"><CheckCheck className="mb-3 h-8 w-8 text-emerald-500" />{isFrench ? 'Tous les paiements sont à jour.' : 'كل المدفوعات محدثة.'}</div> : <div className="divide-y divide-slate-100">{pending.map(({ payment, child }) => <button key={payment.id} type="button" onClick={onNavigateToPaiements} className="block w-full px-5 py-4 text-left transition hover:bg-slate-50"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-slate-900">{child?.prenom} {child?.nom}</p><p className="mt-1 text-sm text-slate-500">{payment.moisConcerne} · {payment.montant.toLocaleString()} DA</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${payment.statut === 'Retard' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{payment.statut}</span></div></button>)}</div>}</section>
      </div>
    </div>
  );
}
