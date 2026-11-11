// Style module Achats Rawdha+ : tableau financier clair, actions explicites, lecture mobile horizontale maîtrisée et aucune donnée fictive.
import { type ReactNode, useDeferredValue, useMemo, useRef, useState } from 'react';
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
import { spreadsheetCsvCell } from '../utils/csv';
import { useIsMobileViewport } from '../hooks/useMobileViewport';

type AchatForm = {
  dateAchat: string;
  fournisseur: string;
  categorie: AchatCategorie;
  libelle: string;
  montant: string;
  tauxTVA: string;
  statut: AchatStatut | '';
  moyenPaiement: AchatMoyenPaiement | '';
  numeroPiece: string;
  notes: string;
  recurrent: boolean;
};

type AchatQuickPatch = Partial<Achat> & {
  moyenPaiement?: AchatMoyenPaiement | null;
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

const todayKey = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };

const emptyForm = (): AchatForm => ({
  dateAchat: todayKey(),
  fournisseur: '',
  categorie: 'alimentation',
  libelle: '',
  montant: '',
  tauxTVA: '',
  statut: '',
  moyenPaiement: '',
  numeroPiece: '',
  notes: '',
  recurrent: false,
});


export default function Achats() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { achats, addAchat, updateAchat, deleteAchat } = useDb();
  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();
  const isArabic = language === 'ar';
  const isMobileViewport = useIsMobileViewport();
  const isReadOnly = user?.role === 'directeur' && user.approvalStatus === 'pending';

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [categoryFilter, setCategoryFilter] = useState<'toutes' | AchatCategorie>('toutes');
  const [statusFilter, setStatusFilter] = useState<'tous' | AchatStatut>('tous');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Achat | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveUncertain, setSaveUncertain] = useState(false);
  const [quickUpdatingId, setQuickUpdatingId] = useState<string | null>(null);
  const [form, setForm] = useState<AchatForm>(emptyForm);

  const labelCategory = (value: AchatCategorie) => {
    const item = CATEGORIES.find(category => category.value === value);
    return item ? (isArabic ? item.ar : item.fr) : value;
  };
  const labelPaymentMethod = (value?: AchatMoyenPaiement | null) => {
    const item = PAYMENT_METHODS.find(method => method.value === value);
    return item ? (isArabic ? item.ar : item.fr) : (isArabic ? 'غير محدد' : 'Non renseigné');
  };
  const labelStatus = (value: AchatStatut) => value === 'payé'
    ? (isArabic ? 'مدفوع' : 'Payé')
    : (isArabic ? 'للدفع' : 'À payer');

  const filteredAchats = useMemo(() => {
    const term = deferredSearch.trim().toLocaleLowerCase();
    return achats
      .filter(achat => categoryFilter === 'toutes' || achat.categorie === categoryFilter)
      .filter(achat => statusFilter === 'tous' || achat.statut === statusFilter)
      .filter(achat => !dateFrom || achat.dateAchat >= dateFrom)
      .filter(achat => !dateTo || achat.dateAchat <= dateTo)
      .filter(achat => !term || [achat.libelle, achat.fournisseur, achat.numeroPiece, achat.notes, labelCategory(achat.categorie)].filter(Boolean).join(' ').toLocaleLowerCase().includes(term))
      .sort((first, second) => second.dateAchat.localeCompare(first.dateAchat) || second.updatedAt.localeCompare(first.updatedAt));
  }, [achats, categoryFilter, dateFrom, dateTo, deferredSearch, statusFilter, isArabic]);

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
    setSaveUncertain(false);
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (achat: Achat) => {
    setSaveUncertain(false);
    setEditing(achat);
    setForm({
      dateAchat: achat.dateAchat,
      fournisseur: achat.fournisseur || '',
      categorie: achat.categorie,
      libelle: achat.libelle,
      montant: String(achat.montant),
      tauxTVA: achat.tauxTVA === undefined ? '' : String(achat.tauxTVA),
      statut: achat.statut,
      moyenPaiement: achat.moyenPaiement || '',
      numeroPiece: achat.numeroPiece || '',
      notes: achat.notes || '',
      recurrent: achat.recurrent === true,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (savingRef.current || saveUncertain) return;
    const amount = Number(form.montant);
    const vat = form.tauxTVA.trim() ? Number(form.tauxTVA) : undefined;
    if (!form.libelle.trim() || !form.dateAchat || !form.statut || (form.statut === 'payé' && !form.moyenPaiement) || !Number.isFinite(amount) || amount <= 0 || (vat !== undefined && (!Number.isFinite(vat) || vat < 0 || vat > 100))) {
      showToast(isArabic ? 'راجعي التاريخ والوصف والمبلغ والحالة وطريقة الدفع ونسبة الضريبة.' : 'Vérifiez la date, le libellé, le montant, le statut, le moyen de paiement et la TVA.', 'error');
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
      moyenPaiement: form.statut === 'payé' ? form.moyenPaiement as AchatMoyenPaiement : null,
      numeroPiece: form.numeroPiece.trim() || undefined,
      notes: form.notes.trim() || undefined,
      recurrent: form.recurrent,
    };

    savingRef.current = true;
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
      setSaveUncertain(true);
      showToast(isArabic ? 'لم يتأكد الحفظ. أغلق النافذة وتحقق من قائمة المشتريات قبل المحاولة مجدداً.' : 'Enregistrement non confirmé. Fermez la fenêtre et vérifiez la liste des achats avant de réessayer.', 'error');
    } finally {
      savingRef.current = false;
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

  const handleQuickUpdate = async (achat: Achat, patch: AchatQuickPatch) => {
    if (isReadOnly || quickUpdatingId) return;
    setQuickUpdatingId(achat.id);
    try {
      await updateAchat(achat.id, patch as Partial<Achat>);
      showToast(isArabic ? 'تم تحديث الشراء.' : 'Achat mis à jour.', 'success');
    } catch (error) {
      console.error('Modification rapide achat:', error);
    } finally {
      setQuickUpdatingId(null);
    }
  };

  const settlementValue = (achat: Achat) => achat.statut === 'à_payer'
    ? 'à_payer'
    : `payé:${achat.moyenPaiement || 'inconnu'}`;

  const handleSettlementChange = (achat: Achat, value: string) => {
    if (value === 'à_payer') {
      void handleQuickUpdate(achat, { statut: 'à_payer', moyenPaiement: null });
      return;
    }
    if (!value.startsWith('payé:') || value === 'payé:inconnu') return;
    const moyenPaiement = value.replace('payé:', '') as AchatMoyenPaiement;
    void handleQuickUpdate(achat, { statut: 'payé', moyenPaiement });
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
    const csv = `\uFEFF${rows.map(row => row.map(spreadsheetCsvCell).join(';')).join('\n')}`;
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
    <div className="min-w-0 space-y-4 sm:space-y-6" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{isArabic ? 'المشتريات والمصاريف' : 'Achats & dépenses'}</h1>
          <p className="hidden sm:block mt-0.5 text-xs text-slate-500">{isArabic ? 'تابعي مصاريف الحضانة، الدفعات والمراجع.' : 'Suivi des achats, règlements et justificatifs de la crèche.'}</p>
        </div>
        <div className="grid grid-cols-[auto_1fr] sm:flex sm:items-center gap-2">
          <button type="button" onClick={exportCsv} className="min-h-9! whitespace-nowrap inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"><Download className="h-4 w-4 shrink-0 text-slate-500" /><span>{isArabic ? 'تصدير CSV' : 'Exporter CSV'}</span></button>
          <button type="button" disabled={isReadOnly} onClick={openCreate} className="min-h-9! whitespace-nowrap inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white transition hover:bg-indigo-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4 shrink-0 stroke-[2.5]" /><span className="truncate">{isArabic ? 'تسجيل شراء' : 'Enregistrer un achat'}</span></button>
        </div>
      </div>

      {isReadOnly && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">{isArabic ? 'حسابك في وضع القراءة فقط إلى حين موافقة الإدارة.' : 'Votre compte reste en lecture seule jusqu’à validation par l’administration.'}</p>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
        {[
          { label: isArabic ? 'إجمالي المشتريات' : 'Total filtré', value: formatCurrency(summary.total), valueClass: 'text-slate-900' },
          { label: isArabic ? 'المبلغ المدفوع' : 'Dépenses payées', value: formatCurrency(summary.paid), valueClass: 'text-emerald-700' },
          { label: isArabic ? 'المبلغ للدفع' : 'À payer', value: formatCurrency(summary.toPay), valueClass: 'text-amber-700' },
          { label: isArabic ? 'أهم فئة' : 'Catégorie principale', value: summary.topCategory ? labelCategory(summary.topCategory) : '—', valueClass: 'text-indigo-600' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-2xs">
            <p className="truncate text-[11px] font-medium text-slate-500">{card.label}</p>
            <p className={`mt-0.5 truncate text-sm sm:text-lg font-bold tabular-nums ${card.valueClass}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs sm:p-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,11rem))]">
          <label className="relative col-span-2 lg:col-span-1 block"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={isArabic ? 'ابحث عن مورد أو وصف أو مرجع...' : 'Rechercher un fournisseur, libellé ou référence…'} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-3 text-xs font-medium text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white" /></label>
          <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value as typeof categoryFilter)} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"><option value="toutes">{isArabic ? 'كل الفئات' : 'Catégories'}</option>{CATEGORIES.map(category => <option key={category.value} value={category.value}>{isArabic ? category.ar : category.fr}</option>)}</select>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"><option value="tous">{isArabic ? 'كل الحالات' : 'Statuts'}</option><option value="payé">{isArabic ? 'مدفوع' : 'Payé'}</option><option value="à_payer">{isArabic ? 'للدفع' : 'À payer'}</option></select>
          <input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} aria-label={isArabic ? 'من تاريخ' : 'À partir du'} className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500" />
          <input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} aria-label={isArabic ? 'إلى تاريخ' : 'Jusqu’au'} className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500" />
        </div>
      </section>

      {isMobileViewport ? (
        <section className="space-y-3" aria-label={isArabic ? 'قائمة المشتريات' : 'Liste des achats'}>
          {filteredAchats.length > 0 ? filteredAchats.map(achat => {
            const isQuickUpdating = quickUpdatingId === achat.id;
            return (
              <div
                key={achat.id}
                onClick={() => { if (!isReadOnly && !isQuickUpdating) openEdit(achat); }}
                className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3 transition ${!isReadOnly ? 'cursor-pointer hover:border-indigo-200' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                      <Store className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-slate-900">{achat.libelle}</p>
                      <p className="truncate text-xs text-slate-400">
                        {formatDate(achat.dateAchat)} · {achat.fournisseur || (isArabic ? 'بدون مورد' : 'Sans fournisseur')}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-sm font-black text-slate-950">{formatCurrency(achat.montant)}</p>
                    {achat.tauxTVA !== undefined && <p className="text-[10px] font-bold text-slate-400">TVA {achat.tauxTVA}%</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2" onClick={e => e.stopPropagation()}>
                  <select
                    value={achat.categorie}
                    disabled={isReadOnly || isQuickUpdating}
                    onChange={event => void handleQuickUpdate(achat, { categorie: event.target.value as AchatCategorie })}
                    aria-label={isArabic ? 'تعديل فئة الشراء' : 'Modifier la catégorie de l’achat'}
                    className="w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none disabled:opacity-60"
                  >
                    {CATEGORIES.map(category => <option key={category.value} value={category.value}>{isArabic ? category.ar : category.fr}</option>)}
                  </select>
                  <select
                    value={settlementValue(achat)}
                    disabled={isReadOnly || isQuickUpdating}
                    onChange={event => handleSettlementChange(achat, event.target.value)}
                    aria-label={isArabic ? 'تعديل حالة الدفع وطريقته' : 'Modifier le règlement'}
                    className={`w-full cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold outline-none disabled:opacity-60 ${
                      achat.statut === 'payé'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    <option value="à_payer">{isArabic ? 'للدفع' : 'À payer'}</option>
                    <option value="payé:inconnu" disabled>{isArabic ? 'مدفوع — الطريقة غير محددة' : 'Payé — moyen non renseigné'}</option>
                    {PAYMENT_METHODS.map(method => <option key={method.value} value={`payé:${method.value}`}>{isArabic ? `مدفوع — ${method.ar}` : `Payé — ${method.fr}`}</option>)}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs">
                  <span className="truncate font-bold text-slate-400">
                    {achat.numeroPiece ? `${isArabic ? 'المرجع:' : 'Réf. :'} ${achat.numeroPiece}` : (achat.recurrent ? (isArabic ? 'مصروف متكرر' : 'Dépense récurrente') : '')}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <button type="button" disabled={isReadOnly || isQuickUpdating} onClick={() => openEdit(achat)} className="min-h-8! inline-flex items-center gap-1 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 cursor-pointer" aria-label={isArabic ? 'تعديل' : 'Modifier'}>
                      <Edit3 className="h-3.5 w-3.5 shrink-0" />
                      {isArabic ? 'تعديل' : 'Modifier'}
                    </button>
                    <button type="button" disabled={isReadOnly || isQuickUpdating} onClick={() => void handleDelete(achat)} className="min-h-8! h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-40 cursor-pointer" aria-label={isArabic ? 'حذف' : 'Supprimer'}>
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center">
              <Package className="mx-auto h-10 w-10 text-slate-200" />
              <p className="mt-3 font-extrabold text-slate-500">{isArabic ? 'لا توجد مشتريات لهذه المعايير' : 'Aucun achat pour ces critères'}</p>
            </div>
          )}
        </section>
      ) : (
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <p className="px-4 pt-3 text-xs text-slate-500 xl:hidden">{isArabic ? 'مرر الجدول أفقياً لرؤية كل الأعمدة.' : 'Faites défiler le tableau horizontalement pour voir toutes les colonnes.'}</p>
        <div className="mobile-scroll-x focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500" role="region" tabIndex={0} aria-label={isArabic ? 'جدول المشتريات' : 'Tableau des achats'}><table className="min-w-[900px] w-full border-collapse text-start"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-wider text-slate-400"><th className="p-4">{isArabic ? 'التاريخ' : 'Date'}</th><th className="p-4">{isArabic ? 'الشراء' : 'Achat'}</th><th className="p-4">{isArabic ? 'الفئة' : 'Catégorie'}</th><th className="p-4">{isArabic ? 'المبلغ' : 'Montant'}</th><th className="p-4">{isArabic ? 'الدفع' : 'Règlement'}</th><th className="p-4">{isArabic ? 'المرجع' : 'Référence'}</th><th className="p-4 text-center">{isArabic ? 'إجراءات' : 'Actions'}</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
          {filteredAchats.map(achat => {
            const isQuickUpdating = quickUpdatingId === achat.id;
            return <tr key={achat.id} onClick={() => { if (!isReadOnly && !isQuickUpdating) openEdit(achat); }} className={`transition hover:bg-slate-50/70 ${!isReadOnly ? 'cursor-pointer' : ''}`}><td className="whitespace-nowrap p-4 text-xs font-bold text-slate-500">{formatDate(achat.dateAchat)}</td><td className="p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fuchsia-50 text-fuchsia-600"><Store className="h-4 w-4 shrink-0" /></span><div><p className="max-w-[210px] truncate font-extrabold text-slate-900">{achat.libelle}</p><p className="max-w-[210px] truncate text-xs text-slate-400">{achat.fournisseur || (isArabic ? 'بدون مورد' : 'Sans fournisseur')}</p></div></div></td><td className="p-4" onClick={e => e.stopPropagation()}><div className="flex items-center gap-1.5"><select value={achat.categorie} disabled={isReadOnly || isQuickUpdating} onChange={event => void handleQuickUpdate(achat, { categorie: event.target.value as AchatCategorie })} aria-label={isArabic ? 'تعديل فئة الشراء' : 'Modifier la catégorie de l’achat'} className="max-w-[150px] cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 outline-none transition hover:border-fuchsia-300 focus:border-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60">{CATEGORIES.map(category => <option key={category.value} value={category.value}>{isArabic ? category.ar : category.fr}</option>)}</select>{achat.recurrent && <span className="text-[10px] font-black text-fuchsia-600">{isArabic ? 'متكرر' : 'Récurrent'}</span>}</div></td><td className="whitespace-nowrap p-4 font-black text-slate-950">{formatCurrency(achat.montant)}{achat.tauxTVA !== undefined && <p className="text-[10px] font-bold text-slate-400">TVA {achat.tauxTVA}%</p>}</td><td className="p-4" onClick={e => e.stopPropagation()}><select value={settlementValue(achat)} disabled={isReadOnly || isQuickUpdating} onChange={event => handleSettlementChange(achat, event.target.value)} aria-label={isArabic ? 'تعديل حالة الدفع وطريقته' : 'Modifier le règlement'} className={`min-w-[142px] cursor-pointer rounded-xl border px-2.5 py-2 text-xs font-bold outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${achat.statut === 'payé' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 focus:border-emerald-500' : 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 focus:border-amber-500'}`}><option value="à_payer">{isArabic ? 'للدفع' : 'À payer'}</option><option value="payé:inconnu" disabled>{isArabic ? 'مدفوع — الطريقة غير محددة' : 'Payé — moyen non renseigné'}</option>{PAYMENT_METHODS.map(method => <option key={method.value} value={`payé:${method.value}`}>{isArabic ? `مدفوع — ${method.ar}` : `Payé — ${method.fr}`}</option>)}</select>{isQuickUpdating && <p className="mt-1 text-[10px] font-bold text-slate-400">{isArabic ? 'جارٍ الحفظ…' : 'Enregistrement…'}</p>}</td><td className="max-w-[140px] truncate p-4 text-xs font-bold text-slate-500">{achat.numeroPiece || '—'}</td><td className="p-4 whitespace-nowrap" onClick={e => e.stopPropagation()}><div className="inline-flex items-center justify-center gap-1.5"><button type="button" disabled={isReadOnly || isQuickUpdating} onClick={() => openEdit(achat)} className="min-h-8! h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-xl border border-indigo-200/80 bg-indigo-50/70 text-indigo-600 transition hover:bg-indigo-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" title={isArabic ? 'تعديل' : 'Modifier'} aria-label={isArabic ? 'تعديل' : 'Modifier'}><Edit3 className="h-4 w-4 shrink-0" /></button><button type="button" disabled={isReadOnly || isQuickUpdating} onClick={() => void handleDelete(achat)} className="min-h-8! h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/70 text-rose-600 transition hover:bg-rose-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" title={isArabic ? 'حذف' : 'Supprimer'} aria-label={isArabic ? 'حذف' : 'Supprimer'}><Trash2 className="h-4 w-4 shrink-0" /></button></div></td></tr>;
          })}
          {!filteredAchats.length && <tr><td colSpan={7} className="p-12 text-center"><Package className="mx-auto h-10 w-10 text-slate-200" /><p className="mt-3 font-extrabold text-slate-500">{isArabic ? 'لا توجد مشتريات لهذه المعايير' : 'Aucun achat pour ces critères'}</p><p className="mt-1 text-xs text-slate-400">{isArabic ? 'سجلي أول شراء أو عدلي الفلاتر.' : 'Enregistrez un premier achat ou modifiez les filtres.'}</p></td></tr>}
        </tbody></table></div>
      </section>
      )}

      <AnimatePresence>{showModal && <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-2 pt-2 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !savingRef.current && setShowModal(false)}><motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} onClick={event => event.stopPropagation()} className="mobile-safe-modal my-0 flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:my-10"><div className="flex items-start justify-between gap-4 bg-gradient-to-r from-fuchsia-600 to-violet-600 p-5 text-white"><div><p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-100">{isArabic ? 'سجل المصاريف' : 'Registre des dépenses'}</p><h2 className="mt-1 text-xl font-black">{editing ? (isArabic ? 'تعديل شراء' : 'Modifier un achat') : (isArabic ? 'تسجيل شراء جديد' : 'Enregistrer un achat')}</h2></div><button type="button" disabled={saving} aria-label={isArabic ? 'إغلاق' : 'Fermer'} onClick={() => setShowModal(false)} className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20"><X className="h-5 w-5" /></button></div><div className="space-y-4 overflow-y-auto p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2"><Field label={isArabic ? 'تاريخ الشراء *' : 'Date d’achat *'}><input type="date" value={form.dateAchat} onChange={event => setForm({ ...form, dateAchat: event.target.value })} className="input" /></Field><Field label={isArabic ? 'المورد' : 'Fournisseur'}><input value={form.fournisseur} maxLength={140} onChange={event => setForm({ ...form, fournisseur: event.target.value })} placeholder={isArabic ? 'مثال: مورد المواد الغذائية' : 'Ex. fournisseur alimentaire'} className="input" /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label={isArabic ? 'الفئة *' : 'Catégorie *'}><select value={form.categorie} onChange={event => setForm({ ...form, categorie: event.target.value as AchatCategorie })} className="input">{CATEGORIES.map(category => <option key={category.value} value={category.value}>{isArabic ? category.ar : category.fr}</option>)}</select></Field><Field label={isArabic ? 'المبلغ بالدينار *' : 'Montant DZD *'}><input type="number" min="1" step="0.01" value={form.montant} onChange={event => setForm({ ...form, montant: event.target.value })} placeholder="0" className="input" /></Field></div><Field label={isArabic ? 'وصف الشراء *' : 'Libellé de l’achat *'}><input value={form.libelle} maxLength={180} onChange={event => setForm({ ...form, libelle: event.target.value })} placeholder={isArabic ? 'مثال: مواد وجبة الأطفال' : 'Ex. fournitures repas enfants'} className="input" /></Field><div className="grid gap-4 sm:grid-cols-3"><Field label={isArabic ? 'الحالة *' : 'Statut *'}><select value={form.statut} onChange={event => setForm({ ...form, statut: event.target.value as AchatStatut })} className="input"><option value="">{isArabic ? 'اختر الحالة' : 'Choisir le statut'}</option><option value="payé">{isArabic ? 'مدفوع' : 'Payé'}</option><option value="à_payer">{isArabic ? 'للدفع' : 'À payer'}</option></select></Field><Field label={isArabic ? 'طريقة الدفع' : 'Moyen de paiement'}><select disabled={form.statut !== 'payé'} value={form.moyenPaiement} onChange={event => setForm({ ...form, moyenPaiement: event.target.value as AchatMoyenPaiement })} className="input disabled:cursor-not-allowed disabled:opacity-50"><option value="">{isArabic ? 'اختر طريقة الدفع' : 'Choisir le moyen de paiement'}</option>{PAYMENT_METHODS.map(method => <option key={method.value} value={method.value}>{isArabic ? method.ar : method.fr}</option>)}</select></Field><Field label={isArabic ? 'نسبة الضريبة %' : 'Taux TVA %'}><input type="number" min="0" max="100" step="0.01" value={form.tauxTVA} onChange={event => setForm({ ...form, tauxTVA: event.target.value })} placeholder="0" className="input" /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label={isArabic ? 'رقم الوصل أو الفاتورة' : 'N° reçu ou facture'}><input value={form.numeroPiece} maxLength={120} onChange={event => setForm({ ...form, numeroPiece: event.target.value })} placeholder={isArabic ? 'مرجع اختياري' : 'Référence facultative'} className="input" /></Field><label className="mt-6 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700"><input type="checkbox" checked={form.recurrent} onChange={event => setForm({ ...form, recurrent: event.target.checked })} className="h-4 w-4 accent-fuchsia-600" />{isArabic ? 'مصروف متكرر' : 'Dépense récurrente'}</label></div><Field label={isArabic ? 'ملاحظات' : 'Notes'}><textarea rows={3} value={form.notes} maxLength={1000} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder={isArabic ? 'معلومة داخلية اختيارية' : 'Information interne facultative'} className="input resize-none" /></Field>{saveUncertain && <p role="alert" className="text-sm text-red-700">{isArabic ? 'لم يتأكد الحفظ. أغلق النافذة وتحقق من قائمة المشتريات قبل المحاولة مجدداً.' : 'Enregistrement non confirmé. Fermez cette fenêtre et vérifiez la liste des achats avant de réessayer.'}</p>}</div><div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-4 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={() => setShowModal(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">{isArabic ? 'إلغاء' : 'Annuler'}</button><button type="button" disabled={saving || saveUncertain} onClick={() => void handleSave()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-fuchsia-700 disabled:opacity-60">{saving ? (isArabic ? 'جارٍ الحفظ…' : 'Enregistrement…') : <><ShoppingCart className="h-4 w-4" />{editing ? (isArabic ? 'حفظ التعديل' : 'Enregistrer les modifications') : (isArabic ? 'تسجيل الشراء' : 'Enregistrer l’achat')}</>}</button></div></motion.div></div>}</AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-bold uppercase tracking-wide text-slate-500"><span className="mb-2 block">{label}</span>{children}</label>;
}
