import { useEffect, useState } from 'react';
import { 
  Users, 
  Baby, 
  AlertCircle, 
  DollarSign, 
  Calendar as CalendarIcon,
  Clock,
  ArrowUp,
  ArrowDown,
  FileText,
  ShieldCheck,
  Coffee,
  Zap,
  School,
  PlayCircle
} from 'lucide-react';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';
import { useLanguage } from '../contexts/LanguageContext';
import DirectorLaunchPanel from './DirectorLaunchPanel';
import CommandCenter from './CommandCenter';
import DailyRoutine from './DailyRoutine';

export default function Dashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { enfants: allEnfantsData, presences: allPresencesData, paiements: allPaiementsData, personnel: allPersonnelData, classes: allClassesData, loading } = useDb();
  const { user } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  const enfantsData = isDirecteur ? allEnfantsData.filter(e => e.crecheId === user!.id) : allEnfantsData;
  const enfantIdsVisibles = new Set(enfantsData.map(e => e.id));
  const presencesData = isDirecteur ? allPresencesData.filter(p => enfantIdsVisibles.has(p.enfantId)) : allPresencesData;
  const paiementsData = isDirecteur ? allPaiementsData.filter(p => enfantIdsVisibles.has(p.enfantId)) : allPaiementsData;
  const personnelData = isDirecteur ? allPersonnelData.filter((p: any) => p.crecheId === user!.id) : allPersonnelData;
  const classesData = isDirecteur ? allClassesData.filter((c: any) => c.crecheId === user!.id) : allClassesData;
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [periodeSelectionnee, setPeriodeSelectionnee] = useState<'semaine' | 'mois'>('semaine');
  const [showDailyRoutine, setShowDailyRoutine] = useState(false);

  // Utilise la date locale (et non UTC) afin que la présence corresponde bien au jour
  // affiché à la directrice, même le soir ou lors d'un changement de fuseau horaire.
  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const now = new Date();
  const today = toDateKey(now);
  const dailyRoutineClosedKey = isDirecteur && user?.id ? `rawdha:daily-routine:${user.id}:${today}:closed` : null;
  const [dailyRoutineClosed, setDailyRoutineClosed] = useState(() => dailyRoutineClosedKey && typeof window !== 'undefined'
    ? window.localStorage.getItem(dailyRoutineClosedKey) === '1'
    : false);

  useEffect(() => {
    if (!dailyRoutineClosedKey || typeof window === 'undefined') {
      setDailyRoutineClosed(false);
      return;
    }
    setDailyRoutineClosed(window.localStorage.getItem(dailyRoutineClosedKey) === '1');
  }, [dailyRoutineClosedKey]);
  const presencesAujourdhui = presencesData.filter(p => p.date === today && p.statut === 'Présent');
  const enfantsActifs = enfantsData.filter(e => e.statut === 'Actif');

  // La capacité vient des classes enregistrées. Les enfants affectés sont dédupliqués
  // par identifiant; si les classes ne contiennent pas encore d'affectation, on utilise
  // les enfants actifs de la crèche plutôt que d'inventer une capacité de 30 places.
  const capaciteTotale = classesData.reduce((total, classe: any) => total + Math.max(0, Number(classe.capacite) || 0), 0);
  const enfantsAffectesIds = new Set<string>(classesData.flatMap((classe: any) => Array.isArray(classe.childrenIds) ? classe.childrenIds : []));
  const enfantsOccupants = enfantsAffectesIds.size > 0
    ? enfantsActifs.filter(enfant => enfantsAffectesIds.has(enfant.id))
    : enfantsActifs;
  const placesOccupees = enfantsOccupants.length;
  const tauxOccupation = capaciteTotale > 0 ? Math.round((placesOccupees / capaciteTotale) * 100) : 0;
  const placesDisponibles = Math.max(0, capaciteTotale - placesOccupees);
  const depassementCapacite = Math.max(0, placesOccupees - capaciteTotale);

  const paymentDate = (paiement: any): Date | null => {
    const rawDate = paiement.datePaiement || paiement.dateReglement || paiement.dateEcheance;
    if (!rawDate) return null;
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const periodStart = new Date(now);
  if (periodeSelectionnee === 'semaine') periodStart.setDate(now.getDate() - 6);
  else periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);
  const paiementsPayes = paiementsData.filter(p => {
    if (p.statut !== 'Payé') return false;
    const date = paymentDate(p);
    return date !== null && date >= periodStart && date <= now;
  });
  const paiementsEnAttente = paiementsData.filter(p => p.statut === 'En attente' || p.statut === 'Retard');
  const totalRevenusPayes = paiementsPayes.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const totalRevenusAttendus = paiementsEnAttente.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const tauxPresence = enfantsActifs.length > 0 ? Math.round((presencesAujourdhui.length / enfantsActifs.length) * 100) : 0;

  const periodeLabel = periodeSelectionnee === 'semaine' 
    ? (isArabic ? 'للأسبوع الحالي' : 'de la semaine') 
    : (isArabic ? 'لهذا الشهر' : 'du mois');
    
  // Statistiques réelles basées sur la base de données
  const nouveauxEnfants = enfantsActifs.filter(e => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(e.dateInscription) >= thirtyDaysAgo;
  }).length;

  const tendanceEnfants = nouveauxEnfants > 0 ? `+${nouveauxEnfants}` : '0';
  const tendancePresence = tauxPresence > 0 ? `${tauxPresence}%` : '0%';
  const tendanceRevenus = paiementsPayes.length > 0 ? `+${paiementsPayes.length}` : '0';
  const tendancePaiements = paiementsEnAttente.length > 0 ? `${paiementsEnAttente.length}` : '0';

  const statsParGroupe = {
    'Bébés': {
      total: enfantsData.filter(e => e.groupeAge === 'Bébés').length,
      presents: presencesData.filter(p => {
        const enfant = enfantsData.find(e => e.id === p.enfantId);
        return enfant?.groupeAge === 'Bébés' && p.date === today && p.statut === 'Présent';
      }).length,
      labelRef: isArabic ? 'رضع (0-2 سنوات)' : 'Tranche Bébés (0-2 ans)',
    },
    'Moyens': {
      total: enfantsData.filter(e => e.groupeAge === 'Moyens').length,
      presents: presencesData.filter(p => {
        const enfant = enfantsData.find(e => e.id === p.enfantId);
        return enfant?.groupeAge === 'Moyens' && p.date === today && p.statut === 'Présent';
      }).length,
      labelRef: isArabic ? 'متوسطين (2-4 سنوات)' : 'Tranche Moyens (2-4 ans)',
    },
    'Grands': {
      total: enfantsData.filter(e => e.groupeAge === 'Grands').length,
      presents: presencesData.filter(p => {
        const enfant = enfantsData.find(e => e.id === p.enfantId);
        return enfant?.groupeAge === 'Grands' && p.date === today && p.statut === 'Présent';
      }).length,
      labelRef: isArabic ? 'كبار (4-6 سنوات)' : 'Tranche Grands (4-6 ans)',
    }
  };

  const groupeLabels: Record<string, string> = {
    Bébés: 'الرضع',
    Moyens: 'الأطفال المتوسطون',
    Grands: 'الأطفال الكبار',
  };

  const localizePaymentStatus = (status: string) => {
    if (!isArabic) return status;
    if (status === 'Payé') return 'مدفوعة';
    if (status === 'Retard') return 'متأخرة';
    if (status === 'En attente') return 'قيد الانتظار';
    return status;
  };

  const localizePaymentMonth = (value: string) => {
    if (!isArabic) return value;
    const monthLabels: Record<string, string> = {
      janvier: 'جانفي',
      février: 'فيفري',
      mars: 'مارس',
      avril: 'أفريل',
      mai: 'ماي',
      juin: 'جوان',
      juillet: 'جويلية',
      août: 'أوت',
      septembre: 'سبتمبر',
      octobre: 'أكتوبر',
      novembre: 'نوفمبر',
      décembre: 'ديسمبر',
    };
    return value.replace(/janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/gi, match => monthLabels[match.toLowerCase()] ?? match);
  };

  const documentsManquants = enfantsData.filter(e => {
    const documents = e.documentsRequis || {};
    return !documents.certificatMedical ||
      !documents.carnetVaccination ||
      !documents.justificatifDomicile ||
      !documents.photoIdentite;
  }).length;

  const statsCards = [
    {
      title: isArabic ? 'الأطفال المسجلون' : 'Enfants Inscrits',
      value: enfantsActifs.length,
      subtitle: capaciteTotale > 0
        ? (isArabic ? `القدرة الاستيعابية: ${capaciteTotale} مقعد` : `Capacité : ${capaciteTotale} places`)
        : (isArabic ? 'السعة غير مهيأة' : 'Capacité non configurée'),
      icon: Baby,
      color: 'from-indigo-500 to-indigo-600',
      bgLight: 'bg-indigo-50 text-indigo-600',
      trend: tendanceEnfants,
      trendUp: nouveauxEnfants > 0
    },
    {
      title: isArabic ? 'معدل الحضور اليومي' : 'Taux de Présence',
      value: `${tauxPresence}%`,
      subtitle: isArabic ? `${presencesAujourdhui.length}/${enfantsActifs.length} حاضرون اليوم` : `${presencesAujourdhui.length}/${enfantsActifs.length} présents`,
      icon: Users,
      color: 'from-emerald-500 to-emerald-600',
      bgLight: 'bg-emerald-50 text-emerald-600',
      trend: tendancePresence,
      trendUp: tauxPresence > 0
    },
    {
      title: isArabic ? `المداخيل ${periodeLabel}` : `Revenus ${periodeLabel}`,
      value: formatCurrency(totalRevenusPayes),
      subtitle: isArabic ? `${paiementsPayes.length} دفعة مؤكدة` : `${paiementsPayes.length} versements reçus`,
      icon: DollarSign,
      color: 'from-purple-500 to-purple-600',
      bgLight: 'bg-purple-50 text-purple-600',
      trend: tendanceRevenus,
      trendUp: paiementsPayes.length > 0
    },
    {
      title: isArabic ? 'دفعات معلقة' : 'Paiements en attente',
      value: paiementsEnAttente.length,
      subtitle: formatCurrency(totalRevenusAttendus),
      icon: AlertCircle,
      color: 'from-rose-500 to-rose-600',
      bgLight: 'bg-rose-50 text-rose-600',
      trend: tendancePaiements,
      trendUp: false
    }
  ];

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="min-w-0 space-y-5 sm:space-y-8 font-sans">
      <div className="flex min-w-0 flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-0.5 flex items-center gap-1">
            <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-bounce" />
            {isArabic ? 'الفضاء الإداري لروضتي' : 'Espace RAWDHA+ Premium'}
          </span>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {isArabic ? 'لوحة التحكم الإحصائية' : 'Vue d\'Ensemble'}
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2 text-xs sm:text-sm font-semibold">
            <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
            {new Date().toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-FR', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
        </div>
        <div className="flex gap-2 p-1 bg-white/95 rounded-xl shadow-xs border border-slate-200/50 self-start md:self-auto">
          <button
            onClick={() => setPeriodeSelectionnee('semaine')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-extrabold rounded-lg transition duration-150 cursor-pointer ${
              periodeSelectionnee === 'semaine'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {isArabic ? 'أسبوعي' : 'Semaine'}
          </button>
          <button
            onClick={() => setPeriodeSelectionnee('mois')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-extrabold rounded-lg transition duration-150 cursor-pointer ${
              periodeSelectionnee === 'mois'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {isArabic ? 'شهري' : 'Mois'}
          </button>
        </div>
      </div>

      <DirectorLaunchPanel onNavigate={onNavigate} />

      {isDirecteur && !dailyRoutineClosed && (
        <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-800 p-4 text-white shadow-xl shadow-indigo-900/10 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-indigo-100"><PlayCircle className="h-6 w-6" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">{isArabic ? 'إدارة يوم الحضانة' : 'PILOTAGE QUOTIDIEN RAWDHA+'}</p>
                <h2 className="mt-1 text-lg font-black sm:text-xl">{isArabic ? 'أدر يوم الحضانة بخطوات واضحة' : 'Pilotez la journée en quelques étapes'}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-indigo-100/80">{isArabic ? 'ابدأ العمل، تابع الحضور، راقب الصحة والسلامة، وأنهِ اليوم من مكان واحد.' : 'Ouverture, présences, santé, repas, activités, départs et fermeture réunis dans un seul parcours.'}</p>
              </div>
            </div>
            <button type="button" onClick={() => setShowDailyRoutine(true)} className="flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black text-indigo-900 shadow-lg shadow-black/10 transition hover:bg-indigo-50 sm:w-auto sm:px-5"><PlayCircle className="h-4 w-4" />{isArabic ? 'إدارة يوم الحضانة' : 'Piloter la journée'}</button>
          </div>
        </section>
      )}

      {showDailyRoutine && isDirecteur && (
        <DailyRoutine onClose={() => setShowDailyRoutine(false)} onCompleted={() => { setDailyRoutineClosed(true); setShowDailyRoutine(false); }} />
      )}

      {isDirecteur && (
        <CommandCenter
          enfants={enfantsActifs}
          presences={presencesData}
          paiements={paiementsData}
          personnel={personnelData}
          classes={classesData}
          loading={loading}
          onNavigate={onNavigate}
        />
      )}

      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 animate-fade-in">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={index} 
              className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-xs relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-violet-500" />
              
              <div className="flex items-start justify-between mb-2 sm:mb-4">
                <div className={`${stat.bgLight} p-2 sm:p-3 rounded-xl shadow-xs`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold ${
                  stat.trendUp 
                    ? 'bg-emerald-50 text-emerald-700' 
                    : 'bg-rose-50 text-rose-700'
                }`}>
                  {stat.trendUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {stat.trend}
                </span>
              </div>

              <h3 className="text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-wider">{stat.title}</h3>
              <p className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5 tracking-tight">{stat.value}</p>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 font-bold leading-tight">{stat.subtitle}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 min-w-0 bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {isArabic ? 'نسب الحضور حسب المجموعات العمرية' : 'Présence par Groupe de Section'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-semibold">
                  {isArabic ? 'مخطط الحضور والمواظبة اليومي' : 'Pointage ventilé par catégories pédiatriques.'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-400 px-3 py-1.5 bg-slate-50 rounded-lg">
                <Clock className="w-4 h-4 text-slate-400 animate-spin" />
                <span>{isArabic ? 'اليوم' : "Aujourd'hui"}</span>
              </div>
            </div>

            <div className="space-y-6">
              {Object.entries(statsParGroupe).map(([groupe, stats], idx) => {
                const pourcentage = stats.total > 0 ? Math.round((stats.presents / stats.total) * 100) : 0;
                const colors = [
                  { bg: 'bg-indigo-500', barBg: 'bg-indigo-50', text: 'text-indigo-600' },
                  { bg: 'bg-pink-500', barBg: 'bg-pink-50', text: 'text-pink-600' },
                  { bg: 'bg-amber-500', barBg: 'bg-amber-50', text: 'text-amber-600' }
                ];

                return (
                  <div key={groupe} className="group-item">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${colors[idx % 3].barBg} ${colors[idx % 3].text} font-black text-xs flex items-center justify-center`}>
                          {stats.presents}/{stats.total}
                        </div>
                        <div>
                          <span className="text-sm font-extrabold text-slate-900 block leading-tight">{isArabic ? (groupeLabels[groupe] ?? groupe) : groupe}</span>
                          <span className="text-[10px] text-slate-400 font-bold">{stats.labelRef}</span>
                        </div>
                      </div>
                      <span className="text-sm font-black text-slate-900">{pourcentage}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
                      <div 
                        className={`absolute top-0 left-0 h-full ${colors[idx % 3].bg} rounded-full transition-all duration-500`}
                        style={{ width: `${pourcentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 min-[390px]:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-black text-emerald-600">{presencesAujourdhui.length}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{isArabic ? 'الحاضرون' : 'Présents'}</p>
            </div>
            <div>
              <p className="text-xl font-black text-amber-500">
                {presencesData.filter(p => p.date === today && p.statut === 'Absent justifié').length}
              </p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{isArabic ? 'غيابات مبررة' : 'Absences justifiées'}</p>
            </div>
            <div>
              <p className="text-xl font-black text-rose-500">
                {presencesData.filter(p => p.date === today && p.statut === 'Absent non justifié').length}
              </p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{isArabic ? 'غيابات غير مبررة' : 'Absences non justifiées'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-tr from-indigo-700 via-indigo-800 to-violet-800 rounded-2xl shadow-xl p-4 sm:p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-white/10 rounded-xl">
                <School className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider">{isArabic ? 'معدل حجز المقاعد' : 'Remplissage Salles'}</h3>
            </div>
            <div className="text-center py-4">
              <p className="text-5xl sm:text-6xl font-black mb-1">{tauxOccupation}%</p>
              <p className="text-indigo-100 text-xs font-semibold">
                {placesOccupees} / {capaciteTotale > 0 ? capaciteTotale : '—'} {isArabic ? 'مقاعد مشغولة' : 'places occupées'}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-white/15 text-xs text-indigo-200 font-bold flex justify-between items-center">
              <span>{isArabic ? 'المقاعد المتاحة فورياً:' : 'Places disponibles :'}</span>
              <span className="bg-white/10 px-2 py-0.5 rounded-lg text-white font-black">{capaciteTotale > 0 ? `${placesDisponibles} ${isArabic ? 'مقاعد' : 'places'}` : '—'}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">{isArabic ? 'نقاط المراقبة السريعة' : 'Points de contrôle'}</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-black text-emerald-800">{isArabic ? 'النظام الصحي: مستقر وآمن' : 'Sécurité infirmerie OK'}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-pink-50/50 rounded-xl border border-pink-100/50">
                <Coffee className="w-5 h-5 text-pink-600" />
                <span className="text-xs font-black text-pink-800">{isArabic ? 'الوجبات: خالية من مسببات الحساسية' : 'Repas : menus sains et adaptés'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">{isArabic ? 'الـمتأخرات المالية الحرجة' : 'Retards de Règlements'}</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{isArabic ? 'إجراءات المتابعة العائلية' : 'Relance parentale immédiate'}</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-rose-50 text-rose-600 text-xs font-black rounded-lg">
              {paiementsEnAttente.length} {isArabic ? 'تنبيهات' : 'alertes'}
            </span>
          </div>

          <div className="p-4 sm:p-6 space-y-4 max-h-96 overflow-y-auto divide-y divide-slate-100/70">
            {paiementsEnAttente.slice(0, 3).map((paiement) => {
              const enfant = enfantsData.find(e => e.id === paiement.enfantId);
              return (
                <div key={paiement.id} className="flex items-start gap-4 pt-3 first:pt-0">
                  <div className="w-10 h-10 bg-gradient-to-tr from-slate-100 to-slate-200 text-slate-700 rounded-xl flex items-center justify-center font-bold text-sm">
                    {enfant ? `${enfant.prenom[0]}${enfant.nom[0]}` : '--'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-extrabold text-slate-900">{enfant?.prenom} {enfant?.nom}</p>
                      <span className="text-xs font-black text-rose-600">{formatCurrency(paiement.montant)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                      <span>{isArabic ? 'الاستحقاق: ' : 'Échéance : '}{localizePaymentMonth(paiement.moisConcerne)}</span>
                      <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded font-black text-[10px]">
                        {localizePaymentStatus(paiement.statut)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {documentsManquants > 0 && (
              <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl flex gap-3 mt-4">
                <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-extrabold text-amber-900">{isArabic ? 'ملفات تسجيل غير مكتملة' : 'Dossiers Incomplets (Justificatifs)'}</p>
                  <p className="text-[11px] text-amber-700/80 font-bold mt-1">
                    {documentsManquants} {isArabic ? 'أطفال لم يكتمل تقديم شهادات اللقاحات الخاصة بهم' : "enfants n'ont pas encore fourni de certificat médical ou vaccination valide."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">{isArabic ? 'فريق الرعاية اليومي' : 'Personnel en service'}</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{isArabic ? 'المشرفون الحاضرون' : 'Intervenants éducatifs actifs'}</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-black rounded-lg">
              {personnelData.filter((p: any) => p.statut === 'Actif').length} {isArabic ? 'في الخدمة' : 'en poste'}
            </span>
          </div>

          <div className="p-5 space-y-3.5 max-h-96 overflow-y-auto">
            {personnelData.filter((p: any) => p.statut === 'Actif').slice(0, 4).map((person: any) => (
              <div key={person.id} className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl hover:bg-slate-50 transition">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs">
                    {person.prenom[0]}{person.nom[0]}
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">{person.prenom} {person.nom}</p>
                    <p className="text-[10px] text-slate-400 font-bold leading-none mt-1">{person.poste}</p>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  {isArabic ? 'نشط' : 'Actif'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <h2 className="text-base font-extrabold text-slate-900 tracking-tight mb-6">{isArabic ? 'مؤشرات التحصيل والنسب الشهرية' : 'Indicateurs Financiers & Taux de Recouvrement'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-5 bg-emerald-50/50 border border-emerald-100/30 rounded-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isArabic ? 'المحصل' : 'Perçu'}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalRevenusPayes)}</p>
          </div>
          <div className="p-5 bg-amber-50/50 border border-amber-100/30 rounded-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isArabic ? 'في الانتظار' : 'Diligence'}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalRevenusAttendus)}</p>
          </div>
          <div className="p-5 bg-indigo-50/50 border border-indigo-100/30 rounded-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isArabic ? 'القيمة الإجمالية' : 'Cible attendue'}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalRevenusPayes + totalRevenusAttendus)}</p>
          </div>
          <div className="p-5 bg-purple-50/50 border border-purple-100/30 rounded-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isArabic ? 'معدل النجاح' : 'Taux de succès'}</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">
              {totalRevenusPayes + totalRevenusAttendus > 0 ? Math.round((totalRevenusPayes / (totalRevenusPayes + totalRevenusAttendus)) * 100) : 0} %
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
