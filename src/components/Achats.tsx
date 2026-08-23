// Style module Achats Rawdha+ : tableau financier clair, actions explicites, lecture mobile horizontale maîtrisée et aucune donnée fictive.
import { type ReactNode, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Download,
  Edit3,
  Package,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { Achat, AchatCategorie, AchatMoyenPaiement, AchatStatut } from '../types';
import { formatCurrency } from '../utils/format';

type AchatForm = {
  dateAchat: string;
  fournisseur: string;
  categorie: AchatCategorie;
  libelle: string;
  montant: string;
  tauxTVA: string;
  statut: AchatStatut;
  moyenPaiement: AchatMoyenPaiement;
  numeroPiece: string;
  notes: string;
  recurrent: boolean;
};

const CATEGORIES: { value: AchatCategorie; fr: string; ar: string }[] = [
  { value: 'alimentation', fr: 'Alimentation', ar: 'التغذية' },
  { value: 'hygiene', fr: 'Hygiène', ar: 'النظافة' },
  { value: 'fournitures', fr: 'Fournitures', ar: 'اللوازم' },
  { value: 'materiel', fr: 'Matériel', ar: 'المعدات' },
  { value: 'services', fr: 'Services', ar: 'الخدمات' },
  { value: 'loyer_charges', fr: 'Loyer & charges', ar: 'الإيجار والفواتير' },
  { value: 'maintenance', fr: 'Maintenance', ar: 'الصيانة' },
  { value: 'transport', fr: 'Transport', ar: 'النقل' },
  { value: 'autre', fr: 'Autre', ar: 'أخرى' },
];

const PAYMENT_METHODS: { value: AchatMoyenPaiement; fr: string; ar: string }[] = [
  { value: 'especes', fr: 'Espèces', ar: 'نقداً' },
  { value: 'virement', fr: 'Virement', ar: 'تحويل' },
  { value: 'cheque', fr: 'Chèque', ar: 'شيك' },
  { value: 'carte', fr: 'Carte', ar: 'بطاقة' },
  { value: 'autre', fr: 'Autre', ar: 'أخرى' },
];

const SUMMARY_TONES: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-600',
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): AchatForm => ({
  dateAchat: todayKey(),
  fournisseur: '',
  categorie: 'alimentation',
  libelle: '',
  montant: '',
  tauxTVA: '',
  statut: 'payé',
  moyenPaiement: 'especes',
  numeroPiece: '',
  notes: '',
  recurrent: false,
});

const csvValue = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export default function Achats() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { achats, addAchat, updateAchat, deleteAchat } = useDb();
  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();
  const isArabic = language === 'ar';
  const isReadOnly = user?.role === 'directeur' && user.approvalStatus === 'pending';

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'toutes' | AchatCategorie>('toutes');
  const [statusFilter, setStatusFilter] = useState<'tous' | AchatStatut>('tous');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Achat | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AchatForm>(emptyForm);

  const labelCategory = (value: AchatCategorie) => {
    const item = CATEGORIES.find(category => category.value === value);
    return item ? (isArabic ? item.ar : item.fr) : value;
  };
  const labelPaymentMethod = (value?: AchatMoyenPaiement) => {
    const item = PAYMENT_METHODS.find(method => method.value === value);
    return item ? (isArabic ? item.ar : item.fr) : (isArabic ? 'غير محدد' : 'Non renseigné');
  };
  const labelStatus = (value: AchatStatut) => value === 'payé'
    ? (isArabic ? 'مدفوع' : 'Payé')
    : (isArabic ? 'للدفع' : 'À payer');

  const filteredAchats = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return achats
      .filter(achat => categoryFilter === 'toutes' || achat.categorie === categoryFilter)
      .filter(achat => statusFilter === 'tous' || achat.statut === statusFilter)
      .filter(achat => !dateFrom || achat.dateAchat >= dateFrom)
      .filter(achat => !dateTo || achat.dateAchat <= dateTo)
      .filter(achat => !term || [achat.libelle, achat.fournisseur, achat.numeroPiece, achat.notes, labelCategory(achat.categorie)].filter(Boolean).join(' ').toLocaleLowerCase().includes(term))
      .sort((first, second) => second.dateAchat.localeCompare(first.dateAchat) || second.updatedAt.localeCompare(first.updatedAt));
  }, [achats, categoryFilter, dateFrom, dateTo, search, statusFilter, isArabic]);

  const summary = useMemo(() => {
    const total = filteredAchats.reduce((sum, achat) => sum + achat.montant, 0);
    const paid = filteredAchats.filter(achat => achat.statut === 'payé').reduce((sum, achat) => sum + achat.montant, 0);
    const toPay = filteredAchats.filter(achat => achat.statut === 'à_payer').reduce((sum, achat) => sum + achat.montant, 0);
    const categories = filteredAchats.reduce<Record<string, number>>((accumulator, achat) => {
      accumulator[achat.categorie] = (accumulator[achat.categorie] || 0) + achat.montant;
      return accumulator;
    }, {});
    const topCategory = (Object.entries(categories) as Array<[AchatCategorie, number]>).sort(([, first], [, second]) => second - first)[0]?.[0];
    return { total, paid, toPay, topCategory };
  }, [filteredAchats]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (achat: Achat) => {
    setEditing(achat);
    setForm({
      dateAchat: achat.dateAchat,
      fournisseur: achat.fournisseur || '',
      categorie: achat.categorie,
      libelle: achat.libelle,
      montant: String(achat.montant),
      tauxTVA: achat.tauxTVA === undefined ? '' : String(achat.tauxTVA),
      statut: achat.statut,
      moyenPaiement: achat.moyenPaiement || 'especes',
      numeroPiece: achat.numeroPiece || '',
      notes: achat.notes || '',
      recurrent: achat.recurrent === true,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const amount = Number(form.montant);
    const vat = form.tauxTVA.trim() ? Number(form.tauxTVA) : undefined;
    if (!form.libelle.trim() || !form.dateAchat || !Number.isFinite(amount) || amount <= 0 || (vat !== undefined && (!Number.isFinite(vat) || vat < 0 || vat > 100))) {
      showToast(isArabic ? 'راجعي التاريخ والوصف والمبلغ ونسبة الضريبة.' : 'Vérifiez la date, le libellé, le montant et le taux de TVA.', 'error');
      return;
    }

    const payload = {
      dateAchat: form.dateAchat,
      fournisseur: form.fournisseur.trim() || undefined,
      categorie: form.categorie,
      libelle: form.libelle.trim(),
      montant: amount,
      tauxTVA: vat,
      statut: form.statut,
      moyenPaiement: form.statut === 'payé' ? form.moyenPaiement : undefined,
      numeroPiece: form.numeroPiece.trim() || undefined,
      notes: form.notes.trim() || undefined,
      recurrent: form.recurrent,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateAchat(editing.id, payload);
      } else {
        await addAchat(payload);
      }
      showToast(editing
        ? (isArabic ? 'تم تعديل الشراء.' : 'Achat modifié.')
        : (isArabic ? 'تم تسجيل الشراء.' : 'Achat enregistré.'), 'success');
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm());
    } catch (error) {
      console.error('Erreur achat:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (achat: Achat) => {
    const accepted = await confirm({
      title: isArabic ? 'تأكيد حذف الشراء' : 'Confirmer la suppression de l’achat',
      message: isArabic ? `سيتم حذف « ${achat.libelle} » نهائياً.` : `« ${achat.libelle} » sera supprimé définitivement.`,
      confirmLabel: isArabic ? 'حذف الشراء' : 'Supprimer l’achat',
      variant: 'danger',
    });
    if (!accepted) return;
    try {
      await deleteAchat(achat.id);
      showToast(isArabic ? 'تم حذف الشراء.' : 'Achat supprimé.', 'success');
    } catch (error) {
      console.error('Suppression achat:', error);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Date', 'Fournisseur', 'Catégorie', 'Libellé', 'Montant DZD', 'TVA %', 'Statut', 'Moyen de paiement', 'Référence', 'Récurrent', 'Notes'],
      ...filteredAchats.map(achat => [
        achat.dateAchat,
        achat.fournisseur || '',
        labelCategory(achat.categorie),
        achat.libelle,
        achat.montant,
        achat.tauxTVA ?? '',
        labelStatus(achat.statut),
        labelPaymentMethod(achat.moyenPaiement),
        achat.numeroPiece || '',
        achat.recurrent ? (isArabic ? 'نعم' : 'Oui') : (isArabic ? 'لا' : 'Non'),
        achat.notes || '',
      ]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(csvValue).join(';')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `rawdha-achats-${todayKey()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(isArabic ? 'تم تصدير قائمة المشتريات المفلترة.' : 'La liste d’achats filtrée a été exportée.', 'success');
  };

  const formatDate = (value: string) => new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));

  return (
    <div className="min-w-0 space-y-4 sm:space-y-8" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-1 min-[390px]:grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: isArabic ? 'إجمالي المشتريات' : 'Achats filtrés', value: formatCurrency(summary.total), icon: ShoppingCart, tone: 'indigo' },
          { label: isArabic ? 'المبلغ المدفوع' : 'Dépenses payées', value: formatCurrency(summary.paid), icon: CheckCircle2, tone: 'emerald' },
          { label: isArabic ? 'المبلغ للدفع' : 'À payer', value: formatCurrency(summary.toPay), icon: WalletCards, tone: 'amber' },
          { label: isArabic ? 'أهم فئة' : 'Catégorie principale', value: summary.topCategory ? labelCategory(summary.topCategory) : '—', icon: Package, tone: 'fuchsia' },
        ].map(card => {
          const Icon = card.icon;
          return <div key={card.label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-xs transition hover:shadow-md">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${SUMMARY_TONES[card.tone]}`}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-wider text-slate-400">{card.label}</p><p className="mt-0.5 truncate text-base font-black text-slate-900">{card.value}</p></div>
          </div>;
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><ReceiptText className="h-6 w-6 text-fuchsia-600 sm:h-8 sm:w-8" /><h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{isArabic ? 'المشتريات والمصاريف' : 'Achats & dépenses'}</h1></div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{isArabic ? 'تابعي مصاريف الحضانة، الدفعات والمراجع من مكان واحد.' : 'Suivez les dépenses, les règlements et les références de votre crèche.'}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"><Download className="h-4 w-4" />{isArabic ? 'تصدير CSV' : 'Exporter CSV'}</button>
          <button type="button" disabled={isReadOnly} onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-fuchsia-600/15 transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />{isArabic ? 'تسجيل شراء' : 'Enregistrer un achat'}</button>
        </div>
      </div>

      {isReadOnly && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">{isArabic ? 'حسابك في وضع القراءة فقط إلى حين موافقة الإدارة.' : 'Votre compte reste en lecture seule jusqu’à validation par l’administration.'}</p>}

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-xs sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,11rem))]">
          <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={isArabic ? 'ابحث عن مورد أو وصف أو مرجع...' : 'Rechercher un fournisseur, libellé ou référence…'} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-800 outline-none transition focus:border-fuchsia-500 focus:bg-white rtl:pl-3 rtl:pr-9" /></label>
          <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value as typeof categoryFilter)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-fuchsia-500"><option value="toutes">{isArabic ? 'كل الفئات' : 'Toutes les catégories'}</option>{CATEGORIES.map(category => <option key={category.value} value={category.value}>{isArabic ? category.ar : category.fr}</option>)}</select>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-fuchsia-500"><option value="tous">{isArabic ? 'كل الحالات' : 'Tous les statuts'}</option><option value="payé">{isArabic ? 'مدفوع' : 'Payé'}</option><option value="à_payer">{isArabic ? 'للدفع' : 'À payer'}</option></select>
          <label className="relative"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3" /><input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} aria-label={isArabic ? 'من تاريخ' : 'À partir du'} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-2 text-xs font-bold text-slate-700 outline-none focus:border-fuchsia-500 rtl:pl-2 rtl:pr-9" /></label>
          <label className="relative"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3" /><input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} aria-label={isArabic ? 'إلى تاريخ' : 'Jusqu’au'} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-2 text-xs font-bold text-slate-700 outline-none focus:border-fuchsia-500 rtl:pl-2 rtl:pr-9" /></label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="mobile-scroll-x"><table className="min-w-[900px] w-full border-collapse text-left rtl:text-right"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-wider text-slate-400"><th className="p-4">{isArabic ? 'التاريخ' : 'Date'}</th><th className="p-4">{isArabic ? 'الشراء' : 'Achat'}</th><th className="p-4">{isArabic ? 'الفئة' : 'Catégorie'}</th><th className="p-4">{isArabic ? 'المبلغ' : 'Montant'}</th><th className="p-4">{isArabic ? 'الدفع' : 'Règlement'}</th><th className="p-4">{isArabic ? 'المرجع' : 'Référence'}</th><th className="p-4 text-center">{isArabic ? 'إجراءات' : 'Actions'}</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
          {filteredAchats.map(achat => <tr key={achat.id} className="transition hover:bg-slate-50/70"><td className="whitespace-nowrap p-4 text-xs font-bold text-slate-500">{formatDate(achat.dateAchat)}</td><td className="p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fuchsia-50 text-fuchsia-600"><Store className="h-4 w-4" /></span><div><p className="max-w-[210px] truncate font-extrabold text-slate-900">{achat.libelle}</p><p className="max-w-[210px] truncate text-xs text-slate-400">{achat.fournisseur || (isArabic ? 'بدون مورد' : 'Sans fournisseur')}</p></div></div></td><td className="p-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{labelCategory(achat.categorie)}</span>{achat.recurrent && <span className="ml-1 text-[10px] font-black text-fuchsia-600 rtl:ml-0 rtl:mr-1">{isArabic ? 'متكرر' : 'Récurrent'}</span>}</td><td className="whitespace-nowrap p-4 font-black text-slate-950">{formatCurrency(achat.montant)}{achat.tauxTVA !== undefined && <p className="text-[10px] font-bold text-slate-400">TVA {achat.tauxTVA}%</p>}</td><td className="p-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${achat.statut === 'payé' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{labelStatus(achat.statut)}</span><p className="mt-1 text-[10px] font-bold text-slate-400">{achat.statut === 'payé' ? labelPaymentMethod(achat.moyenPaiement) : '—'}</p></td><td className="max-w-[140px] truncate p-4 text-xs font-bold text-slate-500">{achat.numeroPiece || '—'}</td><td className="p-4"><div className="flex items-center justify-center gap-1"><button type="button" disabled={isReadOnly} onClick={() => openEdit(achat)} className="rounded-lg p-2 text-indigo-500 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={isArabic ? 'تعديل' : 'Modifier'}><Edit3 className="h-4 w-4" /></button><button type="button" disabled={isReadOnly} onClick={() => void handleDelete(achat)} className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={isArabic ? 'حذف' : 'Supprimer'}><Trash2 className="h-4 w-4" /></button></div></td></tr>)}
          {!filteredAchats.length && <tr><td colSpan={7} className="p-12 text-center"><Package className="mx-auto h-10 w-10 text-slate-200" /><p className="mt-3 font-extrabold text-slate-500">{isArabic ? 'لا توجد مشتريات لهذه المعايير' : 'Aucun achat pour ces critères'}</p><p className="mt-1 text-xs text-slate-400">{isArabic ? 'سجلي أول شراء أو عدلي الفلاتر.' : 'Enregistrez un premier achat ou modifiez les filtres.'}</p></td></tr>}
        </tbody></table></div>
      </section>

      <AnimatePresence>{showModal && <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-2 pt-2 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !saving && setShowModal(false)}><motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} onClick={event => event.stopPropagation()} className="mobile-safe-modal my-0 flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:my-10"><div className="flex items-start justify-between gap-4 bg-gradient-to-r from-fuchsia-600 to-violet-600 p-5 text-white"><div><p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-100">{isArabic ? 'سجل المصاريف' : 'Registre des dépenses'}</p><h2 className="mt-1 text-xl font-black">{editing ? (isArabic ? 'تعديل شراء' : 'Modifier un achat') : (isArabic ? 'تسجيل شراء جديد' : 'Enregistrer un achat')}</h2></div><button type="button" disabled={saving} onClick={() => setShowModal(false)} className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20"><X className="h-5 w-5" /></button></div><div className="space-y-4 overflow-y-auto p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2"><Field label={isArabic ? 'تاريخ الشراء *' : 'Date d’achat *'}><input type="date" value={form.dateAchat} onChange={event => setForm({ ...form, dateAchat: event.target.value })} className="input" /></Field><Field label={isArabic ? 'المورد' : 'Fournisseur'}><input value={form.fournisseur} maxLength={140} onChange={event => setForm({ ...form, fournisseur: event.target.value })} placeholder={isArabic ? 'مثال: مورد المواد الغذائية' : 'Ex. fournisseur alimentaire'} className="input" /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label={isArabic ? 'الفئة *' : 'Catégorie *'}><select value={form.categorie} onChange={event => setForm({ ...form, categorie: event.target.value as AchatCategorie })} className="input">{CATEGORIES.map(category => <option key={category.value} value={category.value}>{isArabic ? category.ar : category.fr}</option>)}</select></Field><Field label={isArabic ? 'المبلغ بالدينار *' : 'Montant DZD *'}><input type="number" min="1" step="0.01" value={form.montant} onChange={event => setForm({ ...form, montant: event.target.value })} placeholder="0" className="input" /></Field></div><Field label={isArabic ? 'وصف الشراء *' : 'Libellé de l’achat *'}><input value={form.libelle} maxLength={180} onChange={event => setForm({ ...form, libelle: event.target.value })} placeholder={isArabic ? 'مثال: مواد وجبة الأطفال' : 'Ex. fournitures repas enfants'} className="input" /></Field><div className="grid gap-4 sm:grid-cols-3"><Field label={isArabic ? 'الحالة *' : 'Statut *'}><select value={form.statut} onChange={event => setForm({ ...form, statut: event.target.value as AchatStatut })} className="input"><option value="payé">{isArabic ? 'مدفوع' : 'Payé'}</option><option value="à_payer">{isArabic ? 'للدفع' : 'À payer'}</option></select></Field><Field label={isArabic ? 'طريقة الدفع' : 'Moyen de paiement'}><select disabled={form.statut !== 'payé'} value={form.moyenPaiement} onChange={event => setForm({ ...form, moyenPaiement: event.target.value as AchatMoyenPaiement })} className="input disabled:cursor-not-allowed disabled:opacity-50">{PAYMENT_METHODS.map(method => <option key={method.value} value={method.value}>{isArabic ? method.ar : method.fr}</option>)}</select></Field><Field label={isArabic ? 'نسبة الضريبة %' : 'Taux TVA %'}><input type="number" min="0" max="100" step="0.01" value={form.tauxTVA} onChange={event => setForm({ ...form, tauxTVA: event.target.value })} placeholder="0" className="input" /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label={isArabic ? 'رقم الوصل أو الفاتورة' : 'N° reçu ou facture'}><input value={form.numeroPiece} maxLength={120} onChange={event => setForm({ ...form, numeroPiece: event.target.value })} placeholder={isArabic ? 'مرجع اختياري' : 'Référence facultative'} className="input" /></Field><label className="mt-6 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700"><input type="checkbox" checked={form.recurrent} onChange={event => setForm({ ...form, recurrent: event.target.checked })} className="h-4 w-4 accent-fuchsia-600" />{isArabic ? 'مصروف متكرر' : 'Dépense récurrente'}</label></div><Field label={isArabic ? 'ملاحظات' : 'Notes'}><textarea rows={3} value={form.notes} maxLength={1000} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder={isArabic ? 'معلومة داخلية اختيارية' : 'Information interne facultative'} className="input resize-none" /></Field></div><div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-4 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={() => setShowModal(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">{isArabic ? 'إلغاء' : 'Annuler'}</button><button type="button" disabled={saving} onClick={() => void handleSave()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-fuchsia-700 disabled:opacity-60">{saving ? (isArabic ? 'جارٍ الحفظ…' : 'Enregistrement…') : <><ShoppingCart className="h-4 w-4" />{editing ? (isArabic ? 'حفظ التعديل' : 'Enregistrer les modifications') : (isArabic ? 'تسجيل الشراء' : 'Enregistrer l’achat')}</>}</button></div></motion.div></div>}</AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-bold uppercase tracking-wide text-slate-500"><span className="mb-2 block">{label}</span>{children}</label>;
}
