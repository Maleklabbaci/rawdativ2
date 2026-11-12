import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { Download, History, Search, ShieldCheck } from 'lucide-react';
import { spreadsheetCsvCell } from '../utils/csv';
import type { AdminAuditLog, UserAccount } from '../types';

type Props = { logs: AdminAuditLog[]; accounts: UserAccount[]; isArabic: boolean };
const labels: Record<string, [string, string]> = {
  subscription_suspended: ['Abonnement suspendu', 'تعليق الاشتراك'], subscription_reactivated: ['Abonnement réactivé', 'إعادة تفعيل الاشتراك'], subscription_end_date_updated: ['Échéance modifiée', 'تعديل تاريخ الاشتراك'], trial_extended: ['Essai prolongé', 'تمديد التجربة'],
  director_approved: ['Compte accepté', 'قبول الحساب'], director_request_rejected: ['Demande refusée', 'رفض الطلب'],
  identity_document_reviewed: ['Document contrôlé', 'مراجعة الوثيقة'], identity_document_refused: ['Document refusé', 'رفض الوثيقة'],
  ticket_deleted: ['Ticket supprimé', 'حذف الطلب'], ticket_status_updated: ['Statut du ticket modifié', 'تعديل حالة الطلب'], ticket_response_saved: ['Réponse au ticket enregistrée', 'حفظ الرد'], ticket_assigned: ['Ticket attribué', 'تعيين الطلب'], ticket_priority_updated: ['Priorité modifiée', 'تعديل الأولوية'], ticket_due_date_updated: ['Échéance du ticket modifiée', 'تعديل موعد الطلب'],
  community_post_hidden: ['Publication masquée', 'إخفاء المنشور'], community_post_restored: ['Publication restaurée', 'استعادة المنشور'], community_post_pinned: ['Publication épinglée', 'تثبيت المنشور'], community_post_unpinned: ['Publication désépinglée', 'إلغاء تثبيت المنشور'],
  notification_sent: ['Annonce envoyée', 'إرسال إعلان'], notification_deleted: ['Annonce supprimée', 'حذف إعلان'], communication_segment_sent: ['Annonce ciblée envoyée', 'إرسال إعلان موجه'],
  commercial_stage_updated: ['Étape commerciale modifiée', 'تعديل المرحلة التجارية'], commercial_owner_updated: ['Responsable modifié', 'تغيير المسؤول'], commercial_note_updated: ['Note commerciale modifiée', 'تعديل الملاحظة التجارية'], followup_scheduled: ['Relance planifiée', 'جدولة متابعة'], followup_recorded: ['Relance enregistrée', 'تسجيل متابعة'], admin_role_prepared: ['Rôle préparé', 'تجهيز دور'],
};
const category = (action: string) => action.startsWith('identity_') ? 'identity' : /^(subscription_|trial_)/.test(action) ? 'subscription' : action.startsWith('ticket_') ? 'support' : action.startsWith('community_') ? 'community' : /^(notification_|communication_)/.test(action) ? 'notifications' : /^(commercial_|followup_)/.test(action) ? 'commercial' : 'accounts';
const limit = 25;
export default function AdminAuditHistory({ logs, accounts, isArabic }: Props) {
  const t = (fr: string, ar: string) => isArabic ? ar : fr;
  const [search, setSearch] = useState(''); const [type, setType] = useState('all'); const [actor, setActor] = useState('all');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [page, setPage] = useState(0);
  const actionLabel = (action: string) => labels[action]?.[isArabic ? 1 : 0] || action.replaceAll('_', ' ');
  const actorName = (id: string) => { const a = accounts.find(item => item.id === id); return a ? [a.prenom, a.nom].filter(Boolean).join(' ') || a.email || id : id || t('Inconnu', 'غير معروف'); };
  const filters = [ ['all', t('Toutes les catégories', 'كل الفئات')], ['accounts', t('Comptes', 'الحسابات')], ['identity', t('Documents', 'الوثائق')], ['subscription', t('Abonnements', 'الاشتراكات')], ['support', t('Support', 'الدعم')], ['community', t('Connect', 'كونكت')], ['notifications', t('Annonces', 'الإعلانات')], ['commercial', t('Suivi commercial', 'المتابعة التجارية')] ];
  type Cursor = { date: string; id: string } | null;
  const [cursors, setCursors] = useState<Cursor[]>([null]);
  const [entries, setEntries] = useState<AdminAuditLog[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const actors = useMemo(() => accounts.filter(a => a.role === 'admin').map(a => a.id), [accounts]);
  const demo = import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true';
  const cursor = cursors[page] || null;
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const timer = window.setTimeout(async () => {
      try {
        let rows: AdminAuditLog[];
        if (demo) {
          const term = search.trim().toLocaleLowerCase();
          rows = [...logs].sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.id.localeCompare(a.id)).filter(entry => {
            const day = String(entry.createdAt || '').slice(0,10);
            const match = !term || [entry.action, entry.targetLabel, entry.targetId, entry.actorId].filter(Boolean).join(' ').toLocaleLowerCase().includes(term);
            const before = !cursor || entry.createdAt < cursor.date || (entry.createdAt === cursor.date && entry.id < cursor.id);
            return before && match && (type === 'all' || category(entry.action) === type) && (actor === 'all' || entry.actorId === actor) && (!from || day >= from) && (!to || day <= to);
          }).slice(0,limit+1);
        } else {
          const { data, error: fetchError } = await supabase.rpc('rawdha_admin_audit_page', { p_search: search.trim(), p_category: type, p_actor: actor === 'all' ? '' : actor, p_from: from, p_to: to, p_cursor_date: cursor?.date || null, p_cursor_id: cursor?.id || null, p_limit: limit+1 });
          if (fetchError) throw fetchError;
          rows = (data || []) as AdminAuditLog[];
        }
        if (active) { setEntries(rows.slice(0,limit)); setHasMore(rows.length > limit); setLoading(false); }
      } catch { if (active) { setEntries([]); setHasMore(false); setLoading(false); setError(t('Impossible de charger le journal. Vérifiez la connexion et la migration serveur.', 'تعذر تحميل السجل. تحقق من الاتصال وتحديث الخادم.')); } }
    }, search ? 300 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [logs, demo, search, type, actor, from, to, cursor?.date, cursor?.id, reload]);
  const next = () => { const last = entries[entries.length-1]; if (!last || !hasMore) return; setCursors(previous => [...previous.slice(0,page+1), {date:last.createdAt,id:last.id}]); setPage(page+1); };
  const resetFilters = () => { setSearch(''); setType('all'); setActor('all'); setFrom(''); setTo(''); setPage(0); setCursors([null]); };
  const formatDate = (value: string) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-DZ', { dateStyle:'medium', timeStyle:'short' }).format(d); };
  const exportCsv = () => {
    const rows = [[t('Date', 'التاريخ'),t('Action','الإجراء'),t('Administrateur','المسؤول'),t('Cible','الهدف'),t('Type','النوع')],...entries.map(entry => [entry.createdAt, actionLabel(entry.action), actorName(entry.actorId), entry.targetLabel || entry.targetId, entry.targetType])];
    const csv = rows.map(row => row.map(spreadsheetCsvCell).join(';')).join('\n'); const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type:'text/csv;charset=utf-8' })); const link=document.createElement('a');link.href=url;link.download='rawdha-plus-journal-admin.csv';link.click();URL.revokeObjectURL(url);
  };
  const inputClass='w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500';
  return <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" dir={isArabic?'rtl':'ltr'}>
    <div className="border-b border-slate-100 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/50 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-indigo-700"><ShieldCheck size={15}/>{t('Traçabilité administrative','تتبع إجراءات الإدارة')}</p><h2 className="mt-2 text-xl font-black text-slate-950">{t('Journal des actions','سجل الإجراءات')}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">{t('Qui a fait quoi et quand, pour les actions actuellement enregistrées. Ce journal ne couvre pas encore tous les événements.', 'من قام بالإجراء ومتى، للإجراءات المسجلة حالياً. لا يشمل السجل جميع الأحداث بعد.')}</p></div><button type="button" onClick={exportCsv} disabled={!entries.length || loading} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs font-bold text-indigo-700 disabled:opacity-40"><Download size={15}/>{t('Exporter CSV','تصدير CSV')}</button></div></div>
    <div className="p-4 sm:p-6"><div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5"><label className="relative block sm:col-span-2 xl:col-span-1"><span className="sr-only">{t('Rechercher','بحث')}</span><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input className={`${inputClass} ps-9`} maxLength={120} placeholder={t('Action ou cible (identifiant)','إجراء أو هدف')} value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/></label><label><span className="sr-only">{t('Catégorie','الفئة')}</span><select className={inputClass} value={type} onChange={e=>{setType(e.target.value);setPage(0)}}>{filters.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label><span className="sr-only">{t('Administrateur','المسؤول')}</span><select className={inputClass} value={actor} onChange={e=>{setActor(e.target.value);setPage(0)}}><option value="all">{t('Tous les responsables','كل المسؤولين')}</option>{actors.map(id=><option key={id} value={id}>{actorName(id)}</option>)}</select></label><label><span className="sr-only">{t('Depuis','من تاريخ')}</span><input aria-label={t('Depuis','من تاريخ')} type="date" className={inputClass} value={from} onChange={e=>{setFrom(e.target.value);setPage(0)}}/></label><label><span className="sr-only">{t('Jusqu’au','إلى تاريخ')}</span><input aria-label={t('Jusqu’au','إلى تاريخ')} type="date" className={inputClass} value={to} onChange={e=>{setTo(e.target.value);setPage(0)}}/></label></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500"><span>{loading ? t('Chargement…','جار التحميل…') : `${entries.length} ${t('événement(s) sur cette page','حدث في هذه الصفحة')}`}</span><div className="flex gap-3"><button type="button" onClick={resetFilters} className="text-indigo-700 underline">{t('Effacer les filtres','مسح الفلاتر')}</button><button type="button" onClick={()=>setReload(n=>n+1)} className="text-indigo-700 underline">{t('Actualiser','تحديث')}</button></div></div>
    <div className="mt-3 space-y-2">{!loading && entries.map(entry=><article key={entry.id} className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm"><History size={17}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><p className="break-words text-sm font-extrabold text-slate-900">{actionLabel(entry.action)}</p><time className="text-[11px] font-semibold text-slate-500" dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time></div><p className="mt-1 break-words text-xs font-semibold text-slate-600">{entry.targetLabel || entry.targetId}</p><p className="mt-1 break-words text-[11px] text-slate-500">{t('Par','بواسطة')} {actorName(entry.actorId)}</p></div></article>)}{!loading && !error && entries.length===0 && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{t('Aucune action pour ces filtres.','لا توجد إجراءات لهذه الفلاتر.')}</div>}</div>{error && <div role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
    {(page>0 || hasMore) && <div className="mt-4 flex items-center justify-between gap-2 text-xs"><button disabled={page===0 || loading} onClick={()=>setPage(page-1)} className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40">{t('Précédent','السابق')}</button><span className="font-bold text-slate-500">{t('Page','الصفحة')} {page+1}</span><button disabled={!hasMore || loading} onClick={next} className="rounded-xl border border-slate-200 px-3 py-2 font-bold disabled:opacity-40">{t('Suivant','التالي')}</button></div>}
    <p className="mt-5 text-[11px] leading-5 text-slate-500">{t('L’export contient uniquement la page affichée. Les dates utilisent le fuseau local ; les filtres de date suivent les dates enregistrées (UTC). Les messages et documents ne sont pas affichés.','يشمل التصدير الصفحة المعروضة فقط. التوقيت محلي وفلاتر التاريخ حسب UTC. لا تُعرض الرسائل والوثائق هنا.')}</p></div>
  </section>;
}
