import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Printer,
  Users,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';

const monthKey = (date: Date) => date.toISOString().slice(0, 7);

export default function Rapports() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const { user } = useAuth();
  const { enfants: allEnfants, presences: allPresences, paiements: allPaiements, personnel: allPersonnel } = useDb();
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));

  const enfants = user?.role === 'directeur'
    ? allEnfants.filter(enfant => enfant.crecheId === user.id)
    : allEnfants;
  const enfantIds = useMemo(() => new Set(enfants.map(enfant => enfant.id)), [enfants]);
  const presences = allPresences.filter(presence => enfantIds.has(presence.enfantId));
  const paiements = allPaiements.filter(paiement => enfantIds.has(paiement.enfantId));
  const personnel = user?.role === 'directeur'
    ? allPersonnel.filter((personne: any) => personne.crecheId === user.id)
    : allPersonnel;

  const selectedMonthLabel = useMemo(() => {
    const date = new Date(`${selectedMonth}-01T12:00:00`);
    return new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-FR', { month: 'long', year: 'numeric' }).format(date);
  }, [isArabic, selectedMonth]);
  const selectedMonthLabels = useMemo(() => {
    const date = new Date(`${selectedMonth}-01T12:00:00`);
    return ['fr-FR', 'ar-DZ'].map(locale => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date).toLowerCase());
  }, [selectedMonth]);

  const report = useMemo(() => {
    const presencesMois = presences.filter(presence => presence.date?.startsWith(selectedMonth));
    const presents = presencesMois.filter(presence => presence.statut === 'Présent').length;
    const absencesJustifiees = presencesMois.filter(presence => presence.statut === 'Absent justifié').length;
    const absencesNonJustifiees = presencesMois.filter(presence => presence.statut === 'Absent non justifié').length;
    const totalPointages = presents + absencesJustifiees + absencesNonJustifiees;
    const tauxPresence = totalPointages > 0 ? Math.round((presents / totalPointages) * 100) : 0;

    const paiementsMois = paiements.filter((paiement: any) => {
      const echeance = typeof paiement.dateEcheance === 'string' ? paiement.dateEcheance : '';
      const periode = typeof paiement.moisConcerne === 'string' ? paiement.moisConcerne.toLowerCase() : '';
      return echeance.startsWith(selectedMonth) || selectedMonthLabels.some(label => periode.includes(label));
    });
    const payes = paiementsMois.filter(paiement => paiement.statut === 'Payé');
    const enAttente = paiementsMois.filter(paiement => paiement.statut === 'En attente');
    const retards = paiementsMois.filter(paiement => paiement.statut === 'Retard');

    const sections = ['Bébés', 'Moyens', 'Grands'].map(section => {
      const total = enfants.filter(enfant => enfant.groupeAge === section && enfant.statut === 'Actif').length;
      const presentsSection = presencesMois.filter(presence => {
        const enfant = enfants.find(item => item.id === presence.enfantId);
        return enfant?.groupeAge === section && presence.statut === 'Présent';
      }).length;
      return { section, total, presents: presentsSection };
    });

    return {
      presents,
      absencesJustifiees,
      absencesNonJustifiees,
      totalPointages,
      tauxPresence,
      payes,
      enAttente,
      retards,
      totalPaye: payes.reduce((total, paiement) => total + Number(paiement.montant || 0), 0),
      totalAttendu: enAttente.reduce((total, paiement) => total + Number(paiement.montant || 0), 0),
      totalRetard: retards.reduce((total, paiement) => total + Number(paiement.montant || 0), 0),
      totalFactures: paiementsMois.length,
      sections,
    };
  }, [enfants, paiements, presences, selectedMonth, selectedMonthLabels]);

  const changeMonth = (offset: number) => {
    const date = new Date(`${selectedMonth}-01T12:00:00`);
    date.setMonth(date.getMonth() + offset);
    setSelectedMonth(monthKey(date));
  };

  // L’appel direct à window.print() bloque le canal de contrôle du navigateur
  // avant que le clic ne soit acquitté. Le lancement différé laisse l’interface
  // terminer l’événement utilisateur avant d’ouvrir l’aperçu d’impression.
  const handlePrint = () => {
    window.setTimeout(() => {
      window.focus();
      window.print();
    }, 80);
  };

  return (
    <div className="space-y-5 print:bg-white print:p-0">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              {isArabic ? 'التقارير الشهرية' : 'Rapports mensuels'}
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isArabic ? `ملخص موثوق للفترة ${selectedMonthLabel} مبني على البيانات المسجلة في المنصة.` : `Synthèse de ${selectedMonthLabel}, calculée uniquement à partir des données enregistrées.`}
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          <button onClick={() => changeMonth(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:border-indigo-300 cursor-pointer" aria-label={isArabic ? 'الشهر السابق' : 'Mois précédent'}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1 px-2 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 sm:min-w-36 text-center capitalize truncate">
            {selectedMonthLabel}
          </div>
          <button onClick={() => changeMonth(1)} className="flex h-10 w-10 shrink-0 items-center justify-center p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:border-indigo-300 cursor-pointer" aria-label={isArabic ? 'الشهر التالي' : 'Mois suivant'}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={handlePrint} aria-label={isArabic ? 'طباعة التقرير' : 'Imprimer le rapport'} className="flex h-10 shrink-0 items-center justify-center gap-2 px-3.5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{isArabic ? 'طباعة' : 'Imprimer'}</span>
          </button>
        </div>
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-black text-slate-900">Rawdha+ — Rapport mensuel</h1>
        <p className="text-sm text-slate-500 capitalize">{selectedMonthLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <Users className="w-5 h-5 text-indigo-500 mb-3" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isArabic ? 'الأطفال النشطون' : 'Enfants actifs'}</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{enfants.filter(enfant => enfant.statut === 'Actif').length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <CalendarCheck className="w-5 h-5 text-emerald-500 mb-3" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isArabic ? 'نسبة الحضور' : 'Taux de présence'}</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{report.tauxPresence}%</p>
          <p className="text-[10px] text-slate-400 mt-1">{isArabic ? `${report.totalPointages} تسجيلات` : `${report.totalPointages} pointages sur la période`}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <CreditCard className="w-5 h-5 text-indigo-500 mb-3" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isArabic ? 'المبلغ المحصل خلال الفترة' : 'Montant encaissé sur la période'}</p>
          <p className="text-xl font-black text-indigo-600 mt-1">{formatCurrency(report.totalPaye)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-500 mb-3" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isArabic ? 'المتأخرات المستحقة خلال الفترة' : 'Impayés échus sur la période'}</p>
          <p className="text-xl font-black text-rose-600 mt-1">{formatCurrency(report.totalRetard)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5">
          <h2 className="font-black text-slate-900 flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-emerald-500" />{isArabic ? 'الحضور خلال الفترة' : 'Présence sur la période'}</h2>
          <div className="grid grid-cols-1 gap-2.5 mt-5 sm:grid-cols-3 sm:gap-3">
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase text-emerald-700">{isArabic ? 'الحاضرون' : 'Présents'}</p><p className="text-2xl font-black text-emerald-700">{report.presents}</p></div>
            <div className="rounded-xl bg-amber-50 p-3"><p className="text-[10px] font-black uppercase text-amber-700">{isArabic ? 'غيابات مبررة' : 'Justifiées'}</p><p className="text-2xl font-black text-amber-700">{report.absencesJustifiees}</p></div>
            <div className="rounded-xl bg-rose-50 p-3"><p className="text-[10px] font-black uppercase text-rose-700">{isArabic ? 'غيابات غير مبررة' : 'Non justifiées'}</p><p className="text-2xl font-black text-rose-700">{report.absencesNonJustifiees}</p></div>
          </div>
          <div className="mt-5 space-y-3">
            {report.sections.map(section => (
              <div key={section.section}>
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1"><span>{isArabic ? (({ Bébés: 'الرضع', Moyens: 'الأطفال المتوسطون', Grands: 'الأطفال الكبار' } as Record<string, string>)[section.section] ?? section.section) : section.section}</span><span aria-label={isArabic ? `${section.presents} حاضر من ${section.total}` : `${section.presents} présent sur ${section.total}`}>{section.presents}/{section.total}</span></div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${section.total ? Math.min(100, Math.round((section.presents / section.total) * 100)) : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5">
          <h2 className="font-black text-slate-900 flex items-center gap-2"><CreditCard className="w-4 h-4 text-indigo-500" />{isArabic ? 'التحصيل خلال الفترة' : 'Encaissement sur la période'}</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50"><span className="font-bold text-emerald-800">{isArabic ? 'مدفوع' : 'Payé'}</span><span className="font-black text-emerald-700">{formatCurrency(report.totalPaye)}</span></div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50"><span className="font-bold text-amber-800">{isArabic ? 'قيد الانتظار' : 'En attente'}</span><span className="font-black text-amber-700">{formatCurrency(report.totalAttendu)}</span></div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50"><span className="font-bold text-rose-800">{isArabic ? 'متأخر' : 'En retard'}</span><span className="font-black text-rose-700">{formatCurrency(report.totalRetard)}</span></div>
          </div>
          <div className="mt-5 p-3 rounded-xl border border-slate-100 flex items-start gap-2 text-xs text-slate-500">
            <FileText className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <span>{report.totalFactures === 0
              ? (isArabic ? 'لا توجد فواتير مطابقة لهذه الفترة.' : 'Aucune facture ne correspond à cette période.')
              : (isArabic ? `${report.totalFactures} فواتير مطابقة للفترة المحددة.` : `${report.totalFactures} facture(s) correspondant à la période sélectionnée.`)}</span>
          </div>
        </section>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 text-xs text-slate-500">
        <p className="font-bold text-slate-700">{isArabic ? `الموظفون المسجلون: ${personnel.length}` : `Personnel enregistré : ${personnel.length}`}</p>
        <p className="mt-1">{isArabic ? 'يُحسب هذا التقرير عند الطلب. ولا يحل محل المستندات المحاسبية ولا يرسل أي بيانات تلقائياً.' : 'Ce rapport est calculé à la demande. Il ne remplace pas les justificatifs comptables et n’envoie aucune donnée automatiquement.'}</p>
      </div>
    </div>
  );
}

