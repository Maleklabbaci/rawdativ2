import { reminderContext, hasInvalidFinanceDetails } from '../utils/financePeriod';
import FinanceReviewWarning from './FinanceReviewWarning';
import FinanceUnavailable from './FinanceUnavailable';
import { useState, useMemo, lazy, Suspense } from 'react';
import {
  Users,
  Baby,
  AlertCircle,
  DollarSign,
  CalendarCheck,
  Utensils,
  Palette,
  ArrowRight,
  PlayCircle,
  UserCheck,
} from 'lucide-react';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';
import { mealAppliesOnDate } from '../utils/mealSafety';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';
import { prefetchRouteChunk } from '../utils/routePrefetch';
import DirectorLaunchPanel from './DirectorLaunchPanel';
import CommandCenter from './CommandCenter';
import DasCompliancePanel from './DasCompliancePanel';

const DailyRoutine = lazy(() => import('./DailyRoutine'));

export default function Dashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const {
    enfants: allEnfantsData = [],
    presences: allPresencesData = [],
    paiements: allPaiementsData = [],
    personnel: allPersonnelData = [],
    classes: allClassesData = [],
    repas: allRepasData = [],
    activites: allActivitesData = [],
    loading,
    financialDataReady,
  } = useDb();
  const { user } = useAuth();
  const { activeProfile, canAccessPage, hasPagePermission } = useWorkspaceProfile();
  const hideFinancials = Boolean(activeProfile?.hideFinancials) || !hasPagePermission('dashboard', 'view_finance_kpis');
  const canViewDas = hasPagePermission('dashboard', 'view_das');
  const isDirecteur = user?.role === 'directeur';

  const enfantsData = useMemo(
    () => (isDirecteur ? allEnfantsData.filter(e => e.crecheId === user!.id) : allEnfantsData),
    [allEnfantsData, isDirecteur, user],
  );
  const enfantIdsVisibles = useMemo(() => new Set(enfantsData.map(e => e.id)), [enfantsData]);
  const presencesData = useMemo(
    () => (isDirecteur ? allPresencesData.filter(p => enfantIdsVisibles.has(p.enfantId)) : allPresencesData),
    [allPresencesData, enfantIdsVisibles, isDirecteur],
  );
  const paiementsData = useMemo(
    () => (isDirecteur ? allPaiementsData.filter(p => enfantIdsVisibles.has(p.enfantId)) : allPaiementsData),
    [allPaiementsData, enfantIdsVisibles, isDirecteur],
  );
  const reminderState = useMemo(() => reminderContext(paiementsData), [paiementsData]);
  const suspected = reminderState.suspectedIds;
  const invalidFinanceCount = useMemo(() => paiementsData.filter(hasInvalidFinanceDetails).length, [paiementsData]);
  const personnelData = useMemo(
    () => (isDirecteur ? allPersonnelData.filter((p: any) => p.crecheId === user!.id) : allPersonnelData),
    [allPersonnelData, isDirecteur, user],
  );
  const classesData = useMemo(
    () => (isDirecteur ? allClassesData.filter((c: any) => c.crecheId === user!.id) : allClassesData),
    [allClassesData, isDirecteur, user],
  );
  const repasData = useMemo(
    () => (isDirecteur ? allRepasData.filter((r: any) => !r.crecheId || r.crecheId === user!.id) : allRepasData),
    [allRepasData, isDirecteur, user],
  );
  const activitesData = useMemo(
    () => (isDirecteur ? allActivitesData.filter((a: any) => !a.crecheId || a.crecheId === user!.id) : allActivitesData),
    [allActivitesData, isDirecteur, user],
  );

  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [showDailyRoutine, setShowDailyRoutine] = useState(false);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const formattedDate = now.toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const presencesAujourdhui = presencesData.filter(p => p.date === today && p.statut === 'Présent');
  const pointagesAujourdhui = new Set(presencesData.filter(p => p.date === today).map(p => p.enfantId));
  const enfantsActifs = enfantsData.filter(e => e.statut === 'Actif');
  const remainingToPoint = Math.max(0, enfantsActifs.length - pointagesAujourdhui.size);

  const capaciteTotale = classesData.reduce((total, classe: any) => total + Math.max(0, Number(classe.capacite) || 0), 0);
  const paiementsPayes = paiementsData.filter(p => p.statut === 'Payé');
  const paiementsEnAttente = paiementsData.filter(p => p.statut === 'En attente' || p.statut === 'Retard');
  const totalRevenusPayes = paiementsPayes.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const totalRevenusAttendus = paiementsEnAttente.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const activeStaffCount = personnelData.filter((p: any) => p.statut === 'Actif').length;

  const hour = now.getHours();
  const greetingText = isArabic
    ? hour < 13
      ? 'صباح الخير'
      : 'مساء الخير'
    : hour < 13
      ? 'Bonjour'
      : hour < 18
        ? 'Bon après-midi'
        : 'Bonsoir';

  const todayMeals = repasData.filter((meal: any) => mealAppliesOnDate(meal, today));
  const todayActivities = activitesData.filter((act: any) => act?.date === today);

  const statsParGroupe = [
    {
      key: 'Bébés',
      label: isArabic ? 'الرضع (0-2)' : 'Bébés (0–2 ans)',
      total: enfantsActifs.filter(e => e.groupeAge === 'Bébés').length,
      presents: presencesAujourdhui.filter(p => enfantsActifs.find(e => e.id === p.enfantId)?.groupeAge === 'Bébés').length,
    },
    {
      key: 'Moyens',
      label: isArabic ? 'المتوسطون (2-4)' : 'Moyens (2–4 ans)',
      total: enfantsActifs.filter(e => e.groupeAge === 'Moyens').length,
      presents: presencesAujourdhui.filter(p => enfantsActifs.find(e => e.id === p.enfantId)?.groupeAge === 'Moyens').length,
    },
    {
      key: 'Grands',
      label: isArabic ? 'الكبار (4-6)' : 'Grands (4–6 ans)',
      total: enfantsActifs.filter(e => e.groupeAge === 'Grands').length,
      presents: presencesAujourdhui.filter(p => enfantsActifs.find(e => e.id === p.enfantId)?.groupeAge === 'Grands').length,
    },
  ];

  const kpiCards = [
    {
      targetPage: 'enfants',
      title: isArabic ? 'الأطفال المسجلون' : 'Enfants inscrits',
      value: enfantsActifs.length,
      subtitle:
        capaciteTotale > 0
          ? isArabic
            ? `من أصل ${capaciteTotale} مقعد`
            : `sur ${capaciteTotale} places`
          : isArabic
            ? 'ملفات نشطة'
            : 'dossiers actifs',
      icon: Baby,
    },
    {
      targetPage: 'paiements',
      title: isArabic ? 'فواتير مدفوعة' : 'Factures payées',
      value: financialDataReady && !invalidFinanceCount ? formatCurrency(totalRevenusPayes) : '—',
      subtitle: !financialDataReady
        ? isArabic
          ? 'البيانات غير متاحة'
          : 'Données indisponibles'
        : isArabic
          ? `${paiementsPayes.length} فاتورة`
          : `${paiementsPayes.length} facture(s)`,
      icon: DollarSign,
    },
    {
      targetPage: 'paiements',
      title: isArabic ? 'فواتير قيد المتابعة' : 'Factures en attente',
      value: financialDataReady ? paiementsEnAttente.length : '—',
      subtitle:
        financialDataReady && !invalidFinanceCount
          ? formatCurrency(totalRevenusAttendus)
          : isArabic
            ? 'البيانات غير متاحة'
            : 'Données indisponibles',
      icon: AlertCircle,
    },
    {
      targetPage: 'personnel',
      title: isArabic ? 'الفريق النشط' : 'Équipe en poste',
      value: activeStaffCount,
      subtitle: isArabic ? `${classesData.length} أقسام` : `${classesData.length} classe(s)`,
      icon: UserCheck,
    },
  ].filter(card => !(hideFinancials && card.targetPage === 'paiements') && canAccessPage(card.targetPage));

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="min-w-0 space-y-4 sm:space-y-5">
      {/* Carte d'accueil sobre et directe */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-2xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium capitalize text-slate-500">{formattedDate}</p>
            <h1 className="mt-0.5 truncate text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {greetingText}
              {user?.prenom ? `, ${user.prenom}` : ''}
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            {onNavigate && (
              <button
                type="button"
                onPointerEnter={() => prefetchRouteChunk('presences')}
                onTouchStart={() => prefetchRouteChunk('presences')}
                onClick={() => onNavigate('presences')}
                className="min-h-9! inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white whitespace-nowrap transition hover:bg-indigo-700 cursor-pointer"
              >
                <CalendarCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">
                  {remainingToPoint > 0
                    ? isArabic
                      ? 'تسجيل الحضور'
                      : 'Faire l’appel'
                    : isArabic
                      ? 'سجل الحضور'
                      : 'Présences'}
                </span>
                {remainingToPoint > 0 && (
                  <span className="shrink-0 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-extrabold leading-none tabular-nums">
                    {remainingToPoint}
                  </span>
                )}
              </button>
            )}
            {isDirecteur && (
              <button
                type="button"
                onClick={() => setShowDailyRoutine(true)}
                className="min-h-9! inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap transition hover:bg-slate-100 cursor-pointer"
              >
                <PlayCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-indigo-600" />
                <span className="truncate">{isArabic ? 'روتين الصباح' : 'Routine matin'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Résumé immédiat du jour en 3 chiffres clairs */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 border-t border-slate-100 pt-4">
          <div className="rounded-xl bg-slate-50/80 px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">{isArabic ? 'حاضرون اليوم' : 'Présents'}</p>
            <p className="mt-0.5 text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
              {presencesAujourdhui.length}
              <span className="text-xs font-normal text-slate-400"> / {enfantsActifs.length}</span>
            </p>
          </div>
          <div className="rounded-xl bg-slate-50/80 px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">{isArabic ? 'متبقي للتسجيل' : 'À pointer'}</p>
            <p className={`mt-0.5 text-lg sm:text-xl font-bold tabular-nums ${remainingToPoint > 0 ? 'text-indigo-600' : 'text-emerald-600'}`}>
              {remainingToPoint}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50/80 px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">{isArabic ? 'وجبات اليوم' : 'Repas prévus'}</p>
            <p className="mt-0.5 text-lg sm:text-xl font-bold text-slate-900 tabular-nums">{todayMeals.length}</p>
          </div>
        </div>
      </section>

      <DirectorLaunchPanel onNavigate={onNavigate} />

      {showDailyRoutine && isDirecteur && (
        <Suspense fallback={null}>
          <DailyRoutine onClose={() => setShowDailyRoutine(false)} onCompleted={() => setShowDailyRoutine(false)} />
        </Suspense>
      )}

      {!financialDataReady ? (
        <FinanceUnavailable />
      ) : (
        <FinanceReviewWarning
          count={paiementsData.filter(p => !p.periodeCle).length}
          suspected={paiementsData.filter(p => suspected.has(p.id)).length}
          invalid={invalidFinanceCount}
        />
      )}

      {isDirecteur && financialDataReady && !hideFinancials && (
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

      {isDirecteur && canViewDas && (
        <DasCompliancePanel
          enfants={enfantsData}
          personnel={personnelData}
          isArabic={isArabic}
          onNavigate={onNavigate}
        />
      )}

      {/* 4 cartes de synthèse calmes et cliquables */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpiCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              role={onNavigate ? 'button' : undefined}
              tabIndex={onNavigate ? 0 : undefined}
              onPointerEnter={() => onNavigate && prefetchRouteChunk(stat.targetPage)}
              onClick={() => onNavigate?.(stat.targetPage)}
              onKeyDown={event => {
                if (onNavigate && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  onNavigate(stat.targetPage);
                }
              }}
              className={`rawdha-card-modern rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-2xs ${
                onNavigate ? 'cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-slate-500">{stat.title}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 truncate text-lg sm:text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {stat.value}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{stat.subtitle}</p>
            </div>
          );
        })}
      </div>

      {/* Suivi quotidien : Sections + Programme du jour */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Présences par section */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-bold text-slate-900">
              {isArabic ? 'الحضور حسب الفئة العمرية' : 'Présences par section'}
            </h2>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('classes')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                <span>{isArabic ? 'الأقسام' : 'Classes'}</span>
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </button>
            )}
          </div>

          <div className="space-y-3.5">
            {statsParGroupe.map(group => {
              const pct = group.total > 0 ? Math.round((group.presents / group.total) * 100) : 0;
              return (
                <div key={group.key}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-700">{group.label}</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {group.presents} / {group.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Repas & activités du jour */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 mb-3">
              {isArabic ? 'وجبات وأنشطة اليوم' : 'Repas & Activités du jour'}
            </h2>

            <div className="space-y-3">
              {/* Carte Repas du jour */}
              <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                      <Utensils className="h-4 w-4 shrink-0" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate">
                        {isArabic ? 'وجبات اليوم' : 'Repas du jour'}
                      </p>
                      <p className="truncate text-[11px] font-medium text-slate-500">
                        {todayMeals.length > 0
                          ? (isArabic ? `${todayMeals.length} وجبة مبرمجة اليوم` : `${todayMeals.length} service(s) programmé(s)`)
                          : (isArabic ? 'لم يتم إدخال قائمة اليوم بعد' : 'Aucun repas saisi pour aujourd’hui')}
                      </p>
                    </div>
                  </div>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('repas')}
                      className="min-h-8! shrink-0 whitespace-nowrap rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-50 cursor-pointer"
                    >
                      {isArabic ? 'تعديل / فتح' : 'Modifier'}
                    </button>
                  )}
                </div>

                {todayMeals.length > 0 && (
                  <div className="space-y-1.5 pt-0.5">
                    {todayMeals.map((m: any) => (
                      <div
                        key={m.id}
                        onClick={() => onNavigate?.('repas')}
                        className="flex items-center gap-2 rounded-lg bg-white/90 border border-amber-100 px-2.5 py-1.5 text-xs cursor-pointer hover:border-amber-300 transition"
                      >
                        <span className="shrink-0 rounded bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          {m.type || (isArabic ? 'وجبة' : 'Repas')}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                          {m.menu || m.nom || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Carte Activités du jour */}
              <div className="rounded-xl border border-teal-200/70 bg-teal-50/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-700">
                      <Palette className="h-4 w-4 shrink-0" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate">
                        {isArabic ? 'أنشطة اليوم' : 'Activités du jour'}
                      </p>
                      <p className="truncate text-[11px] font-medium text-slate-500">
                        {todayActivities.length > 0
                          ? (isArabic ? `${todayActivities.length} ورشة مبرمجة اليوم` : `${todayActivities.length} atelier(s) prévu(s) aujourd’hui`)
                          : (isArabic ? 'لا يوجد نشاط مبرمج اليوم' : 'Aucune activité programmée aujourd’hui')}
                      </p>
                    </div>
                  </div>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('activites')}
                      className="min-h-8! shrink-0 whitespace-nowrap rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-bold text-teal-900 hover:bg-teal-50 cursor-pointer"
                    >
                      {isArabic ? 'تعديل / فتح' : 'Modifier'}
                    </button>
                  )}
                </div>

                {todayActivities.length > 0 && (
                  <div className="space-y-1.5 pt-0.5">
                    {todayActivities.slice(0, 3).map((a: any) => (
                      <div
                        key={a.id}
                        onClick={() => onNavigate?.('activites')}
                        className="flex items-center gap-2 rounded-lg bg-white/90 border border-teal-100 px-2.5 py-1.5 text-xs cursor-pointer hover:border-teal-300 transition"
                      >
                        {a.heureDebut && (
                          <span className="shrink-0 tabular-nums text-[10px] font-bold text-slate-500">
                            {a.heureDebut}
                          </span>
                        )}
                        {a.groupe && (
                          <span className="shrink-0 rounded bg-teal-100/80 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">
                            {a.groupe}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                          {a.titre || a.nom || '—'}
                        </span>
                      </div>
                    ))}
                    {todayActivities.length > 3 && (
                      <button
                        type="button"
                        onClick={() => onNavigate?.('activites')}
                        className="text-[11px] font-bold text-teal-700 hover:underline cursor-pointer"
                      >
                        {isArabic ? `+ ${todayActivities.length - 3} أنشطة أخرى اليوم` : `+ ${todayActivities.length - 3} autre(s) atelier(s) du jour`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {onNavigate && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                {isArabic
                  ? `${activeStaffCount} في الخدمة اليوم`
                  : `${activeStaffCount} membre(s) de l’équipe en service`}
              </span>
              <button
                type="button"
                onClick={() => onNavigate('rapports')}
                className="font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                {isArabic ? 'التقارير ←' : 'Voir les bilans →'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
