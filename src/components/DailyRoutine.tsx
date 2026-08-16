import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare2,
  ListFilter,
  Search,
  Baby,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  DoorClosed,
  HeartPulse,
  Info,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  Play,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Utensils,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import type { Activite, Classe, Enfant, Personnel, Presence, Repas } from '../types';

type RoutineStepKey = 'ouverture' | 'presences' | 'sante' | 'repas' | 'activites' | 'departs' | 'fermeture';

type AbsenceDraft = {
  enfantId: string;
  statut: 'Absent justifié' | 'Absent non justifié';
  motif: string;
};

type DepartureMap = Record<string, string>;

interface DailyRoutineProps {
  onClose: () => void;
  onCompleted?: () => void;
}

const getLocalDateKey = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().split('T')[0];
};

const getTimeLabel = () => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date());

const readStoredArray = (key: string): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const readStoredObject = <T extends object>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as T : fallback;
  } catch {
    return fallback;
  }
};

const runInBatches = async <T,>(items: T[], worker: (item: T) => Promise<void>, batchSize = 10) => {
  for (let index = 0; index < items.length; index += batchSize) {
    await Promise.all(items.slice(index, index + batchSize).map(worker));
  }
};

export default function DailyRoutine({ onClose, onCompleted }: DailyRoutineProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const {
    enfants: allEnfants,
    presences: allPresences,
    presenceJournees,
    classes: allClasses,
    personnel: allPersonnel,
    repas: allRepas,
    activites: allActivites,
    loading,
    addPresence,
    updatePresence,
    savePresenceJournee,
  } = useDb();
  const isArabic = language === 'ar';
  const isDirecteur = user?.role === 'directeur';
  const today = getLocalDateKey();
  const storagePrefix = user?.id ? `rawdha:daily-routine:${user.id}:${today}` : null;

  const [activeStep, setActiveStep] = useState<RoutineStepKey>('ouverture');
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => storagePrefix ? readStoredArray(`${storagePrefix}:completed`) : []);
  const [absenceDraft, setAbsenceDraft] = useState<AbsenceDraft | null>(null);
  const [healthChildId, setHealthChildId] = useState<string | null>(null);
  const [healthForm, setHealthForm] = useState({ temperature: '36.5', repas: 'Tout', humeur: 'Souriant' });
  const [confirmedMeals, setConfirmedMeals] = useState<boolean>(() => storagePrefix ? window.localStorage.getItem(`${storagePrefix}:meals`) === '1' : false);
  const [confirmedActivities, setConfirmedActivities] = useState<boolean>(() => storagePrefix ? window.localStorage.getItem(`${storagePrefix}:activities`) === '1' : false);
  const [departures, setDepartures] = useState<DepartureMap>(() => storagePrefix ? readStoredObject<DepartureMap>(`${storagePrefix}:departures`, {}) : {});
  const [departureSelections, setDepartureSelections] = useState<DepartureMap>({});
  const [closed, setClosed] = useState<boolean>(() => storagePrefix ? window.localStorage.getItem(`${storagePrefix}:closed`) === '1' : false);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [presenceSearch, setPresenceSearch] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<'tous' | 'a-pointer' | 'presents' | 'absents'>('tous');
  const [batchAbsenceDraft, setBatchAbsenceDraft] = useState<{ statut: AbsenceDraft['statut']; motif: string } | null>(null);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  const enfants = useMemo(() => {
    if (!isDirecteur || !user?.id) return allEnfants;
    return allEnfants.filter((child) => child.crecheId === user.id && child.statut === 'Actif');
  }, [allEnfants, isDirecteur, user?.id]);

  const enfantIds = useMemo(() => new Set(enfants.map((child) => child.id)), [enfants]);
  const presences = useMemo(() => allPresences.filter((presence) => enfantIds.has(presence.enfantId)), [allPresences, enfantIds]);
  const classes = useMemo(() => {
    if (!isDirecteur || !user?.id) return allClasses;
    return allClasses.filter((classe) => classe.crecheId === user.id);
  }, [allClasses, isDirecteur, user?.id]);
  const personnel = useMemo(() => {
    if (!isDirecteur || !user?.id) return allPersonnel;
    return allPersonnel.filter((person) => person.crecheId === user.id);
  }, [allPersonnel, isDirecteur, user?.id]);
  const repas = useMemo(() => {
    if (!isDirecteur || !user?.id) return allRepas;
    return allRepas.filter((meal) => meal.crecheId === user.id);
  }, [allRepas, isDirecteur, user?.id]);
  const activites = useMemo(() => {
    if (!isDirecteur || !user?.id) return allActivites;
    return allActivites.filter((activity) => activity.crecheId === user.id);
  }, [allActivites, isDirecteur, user?.id]);

  const todayPresences = useMemo(() => {
    const byChild = new Map<string, Presence>();
    presences.filter((presence) => presence.date === today).forEach((presence) => byChild.set(presence.enfantId, presence));
    return byChild;
  }, [presences, today]);

  const presentChildren = useMemo(
    () => enfants.filter((child) => todayPresences.get(child.id)?.statut === 'Présent'),
    [enfants, todayPresences],
  );
  const pointedCount = todayPresences.size;
  const presentCount = presentChildren.length;
  const absentCount = (Array.from(todayPresences.values()) as Presence[]).filter((presence) => presence.statut.startsWith('Absent')).length;
  const unpointedCount = Math.max(enfants.length - pointedCount, 0);
  const dayPresence = presenceJournees.find((journee) => journee.date === today && (!user?.id || journee.crecheId === user.id));
  const isDayValidated = dayPresence?.statut === 'validee';

  const todayMeals = useMemo(() => repas.filter((meal) => meal.date === today), [repas, today]);
  const todayActivities = useMemo(() => activites.filter((activity) => activity.date === today), [activites, today]);
  const healthMissingCount = presentChildren.filter((child) => {
    const presence = todayPresences.get(child.id) as (Presence & { temperature?: string; humeur?: string; repas?: string }) | undefined;
    return !presence?.temperature || !presence?.humeur || !presence?.repas;
  }).length;
  const pendingDepartures = presentChildren.filter((child) => !departures[child.id]);
  const activePersonnelCount = personnel.filter((person) => person.statut === 'Actif').length;
  const dateLabel = new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  const steps = useMemo(() => [
    { key: 'ouverture' as const, icon: DoorClosed, fr: 'Ouverture', ar: 'الفتح', descriptionFr: 'Préparer la journée', descriptionAr: 'تحضير اليوم' },
    { key: 'presences' as const, icon: CalendarCheck2, fr: 'Présences', ar: 'الحضور', descriptionFr: 'Pointer les enfants', descriptionAr: 'تسجيل حضور الأطفال' },
    { key: 'sante' as const, icon: HeartPulse, fr: 'Santé et sécurité', ar: 'الصحة والسلامة', descriptionFr: 'Vérifier les informations sensibles', descriptionAr: 'التحقق من المعلومات الصحية' },
    { key: 'repas' as const, icon: Utensils, fr: 'Repas', ar: 'الوجبات', descriptionFr: 'Confirmer le service', descriptionAr: 'تأكيد تقديم الوجبات' },
    { key: 'activites' as const, icon: Sparkles, fr: 'Activités', ar: 'الأنشطة', descriptionFr: 'Lancer le programme', descriptionAr: 'بدء البرنامج' },
    { key: 'departs' as const, icon: LogOut, fr: 'Départs', ar: 'المغادرة', descriptionFr: 'Sécuriser les sorties', descriptionAr: 'تأمين مغادرة الأطفال' },
    { key: 'fermeture' as const, icon: Moon, fr: 'Fermeture', ar: 'الإغلاق', descriptionFr: 'Terminer la journée', descriptionAr: 'إنهاء اليوم' },
  ], [isArabic]);

  const activeStepIndex = Math.max(0, steps.findIndex((step) => step.key === activeStep));
  const activeStepData = steps[activeStepIndex];

  useEffect(() => {
    if (!storagePrefix || typeof window === 'undefined') return;
    window.localStorage.setItem(`${storagePrefix}:completed`, JSON.stringify(completedSteps));
    window.localStorage.setItem(`${storagePrefix}:meals`, confirmedMeals ? '1' : '0');
    window.localStorage.setItem(`${storagePrefix}:activities`, confirmedActivities ? '1' : '0');
    window.localStorage.setItem(`${storagePrefix}:departures`, JSON.stringify(departures));
    if (closed) window.localStorage.setItem(`${storagePrefix}:closed`, '1');
  }, [closed, completedSteps, confirmedActivities, confirmedMeals, departures, storagePrefix]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const text = (fr: string, ar: string) => isArabic ? ar : fr;
  const markCompleted = (key: RoutineStepKey) => {
    setCompletedSteps((previous) => previous.includes(key) ? previous : [...previous, key]);
  };
  const goToStep = (key: RoutineStepKey) => setActiveStep(key);
  const goNext = (key: RoutineStepKey) => {
    markCompleted(key);
    const next = steps[activeStepIndex + 1];
    if (next) setActiveStep(next.key);
  };
  const skipCurrentStep = () => goNext(activeStep);

  const getPresence = (childId: string) => todayPresences.get(childId);
  const isPointingLocked = isDayValidated;
  const normalizedPresenceSearch = presenceSearch.trim().toLocaleLowerCase();
  const isPresenceVisible = (child: Enfant) => {
    const presence = getPresence(child.id);
    const matchesSearch = !normalizedPresenceSearch || `${child.prenom} ${child.nom}`.toLocaleLowerCase().includes(normalizedPresenceSearch);
    const matchesFilter = presenceFilter === 'tous'
      || (presenceFilter === 'a-pointer' && !presence)
      || (presenceFilter === 'presents' && presence?.statut === 'Présent')
      || (presenceFilter === 'absents' && Boolean(presence?.statut?.startsWith('Absent')));
    return matchesSearch && matchesFilter;
  };
  const toggleChildSelection = (childId: string) => {
    setSelectedChildIds((previous) => previous.includes(childId)
      ? previous.filter((id) => id !== childId)
      : [...previous, childId]);
  };
  const toggleChildrenSelection = (childIds: string[]) => {
    setSelectedChildIds((previous) => {
      const allSelected = childIds.length > 0 && childIds.every((id) => previous.includes(id));
      return allSelected ? previous.filter((id) => !childIds.includes(id)) : Array.from(new Set([...previous, ...childIds]));
    });
  };

  const savePresent = async (child: Enfant, silent = false) => {
    if (isPointingLocked) {
      if (silent) return;

      showToast(text('La journée est validée. Rouvrez-la depuis Présences pour modifier un pointage.', 'تم اعتماد اليوم. افتحه من صفحة الحضور قبل التعديل.'), 'error');
      return;
    }
    const existing = getPresence(child.id);
    const payload = {
      enfantId: child.id,
      date: today,
      statut: 'Présent' as const,
      heureArrivee: existing?.heureArrivee || getTimeLabel(),
      heureDepart: existing?.heureDepart || '16:30',
      temperature: existing?.temperature || '36.5',
      repas: existing?.repas || 'Tout',
      humeur: existing?.humeur || 'Souriant',
      motifAbsence: '',
    };
    if (existing) await updatePresence(existing.id, payload);
    else await addPresence(payload);
  };

  const saveAbsenceForChild = async (enfantId: string, statut: AbsenceDraft['statut'], motif: string, silent = false) => {
    if (isPointingLocked) {
      if (!silent) showToast(text('La journée est validée. Rouvrez-la depuis Présences pour modifier un pointage.', 'تم اعتماد اليوم. افتحه من صفحة الحضور قبل التعديل.'), 'error');
      return false;
    }
    const existing = getPresence(enfantId);
    const payload = {
      enfantId,
      date: today,
      statut,
      motifAbsence: motif.trim() || text('Absence signalée', 'تم تسجيل الغياب'),
      heureArrivee: '',
      heureDepart: '',
      temperature: '',
      repas: '',
      humeur: '',
      personneRecuperation: '',
    };
    if (existing) await updatePresence(existing.id, payload);
    else await addPresence(payload);
    return true;
  };

  const saveAbsence = async () => {
    if (!absenceDraft) return;
    const saved = await saveAbsenceForChild(absenceDraft.enfantId, absenceDraft.statut, absenceDraft.motif);
    if (saved) setAbsenceDraft(null);
  };

  const saveSelectedPresent = async () => {
    if (selectedChildIds.length === 0) {
      showToast(text('Sélectionnez au moins un enfant.', 'اختر طفلاً واحداً على الأقل.'), 'error');
      return;
    }
    if (isPointingLocked) {
      showToast(text('La journée est validée. Rouvrez-la depuis Présences avant de modifier un pointage.', 'تم اعتماد اليوم. افتحه من صفحة الحضور قبل تعديل التسجيل.'), 'error');
      return;
    }
    setIsSavingBatch(true);
    try {
      await runInBatches<Enfant>(enfants.filter((item) => selectedChildIds.includes(item.id)), async (child: Enfant) => { await savePresent(child, true); });
      showToast(text(`${selectedChildIds.length} enfant${selectedChildIds.length > 1 ? 's' : ''} marqué${selectedChildIds.length > 1 ? 's' : ''} présent${selectedChildIds.length > 1 ? 's' : ''}.`, `تم تسجيل حضور ${selectedChildIds.length} طفل.`), 'success');
      setSelectedChildIds([]);
    } finally {
      setIsSavingBatch(false);
    }
  };

  const openBatchAbsence = () => {
    if (selectedChildIds.length === 0) {
      showToast(text('Sélectionnez au moins un enfant.', 'اختر طفلاً واحداً على الأقل.'), 'error');
      return;
    }
    if (isPointingLocked) {
      showToast(text('La journée est validée. Rouvrez-la depuis Présences avant de modifier un pointage.', 'تم اعتماد اليوم. افتحه من صفحة الحضور قبل تعديل التسجيل.'), 'error');
      return;
    }
    setBatchAbsenceDraft({ statut: 'Absent non justifié', motif: '' });
  };

  const saveBatchAbsence = async () => {
    if (!batchAbsenceDraft || selectedChildIds.length === 0) return;
    setIsSavingBatch(true);
    try {
      await runInBatches<string>(selectedChildIds, async (childId: string) => { await saveAbsenceForChild(childId, batchAbsenceDraft.statut, batchAbsenceDraft.motif, true); });
      showToast(text(`${selectedChildIds.length} absence${selectedChildIds.length > 1 ? 's' : ''} enregistrée${selectedChildIds.length > 1 ? 's' : ''}.`, `تم تسجيل غياب ${selectedChildIds.length} طفل.`), 'success');
      setSelectedChildIds([]);
      setBatchAbsenceDraft(null);
    } finally {
      setIsSavingBatch(false);
    }
  };

  const validatePresences = async () => {
    if (!user?.id || unpointedCount > 0) {
      showToast(text(`Pointez encore ${unpointedCount} enfant${unpointedCount > 1 ? 's' : ''} avant de valider.`, `سجّل حضور ${unpointedCount} طفل${unpointedCount > 1 ? 'ة' : ''} إضافي قبل الاعتماد.`), 'error');
      return;
    }
    await savePresenceJournee({
      id: dayPresence?.id,
      crecheId: user.id,
      date: today,
      statut: 'validee',
      valideeLe: new Date().toISOString(),
      valideePar: user.id,
    });
    showToast(text('Les présences du jour sont validées.', 'تم اعتماد حضور اليوم.'), 'success');
    goNext('presences');
  };

  const openHealthEditor = (child: Enfant) => {
    const presence = getPresence(child.id) as (Presence & { temperature?: string; repas?: string; humeur?: string }) | undefined;
    setHealthChildId(child.id);
    setHealthForm({
      temperature: presence?.temperature || '36.5',
      repas: presence?.repas || 'Tout',
      humeur: presence?.humeur || 'Souriant',
    });
  };

  const saveHealth = async () => {
    if (!healthChildId) return;
    const presence = getPresence(healthChildId);
    if (!presence) return;
    const temperature = Number(healthForm.temperature.replace(',', '.'));
    if (!Number.isFinite(temperature) || temperature < 30 || temperature > 45) {
      showToast(text('La température saisie est invalide.', 'درجة الحرارة المدخلة غير صالحة.'), 'error');
      return;
    }
    await updatePresence(presence.id, {
      temperature: temperature.toFixed(1),
      repas: healthForm.repas,
      humeur: healthForm.humeur,
    });
    setHealthChildId(null);
  };

  const authorizedPeople = (child: Enfant) => {
    const people = [
      ...child.parents.map((parent) => ({ id: `parent-${parent.id}`, name: `${parent.prenom} ${parent.nom}`.trim(), detail: parent.lien })),
      ...child.contactsUrgence.map((contact) => ({ id: `contact-${contact.id}`, name: contact.nom, detail: contact.lien })),
    ].filter((person) => person.name);
    return people.length > 0 ? people : [{ id: 'unknown', name: text('Personne autorisée à confirmer', 'الشخص المصرح له بالتأكيد'), detail: '' }];
  };

  const confirmDeparture = async (child: Enfant) => {
    const people = authorizedPeople(child);
    const selected = departureSelections[child.id] || people[0]?.name;
    if (!selected || people[0]?.id === 'unknown') {
      showToast(text('Sélectionnez la personne qui récupère l’enfant.', 'اختر الشخص الذي سيستلم الطفل.'), 'error');
      return;
    }
    const presence = getPresence(child.id);
    if (!presence) return;
    await updatePresence(presence.id, {
      heureDepart: getTimeLabel(),
      personneRecuperation: selected,
    } as Partial<Presence> & { personneRecuperation: string });
    setDepartures((previous) => ({ ...previous, [child.id]: selected }));
  };

  const canClose = enfants.length === 0 || (unpointedCount === 0 && pendingDepartures.length === 0);
  const completeClosing = async () => {
    if (!canClose) {
      showToast(text('Il reste des présences ou des départs à vérifier.', 'ما زالت هناك حضور أو مغادرات يجب التحقق منها.'), 'error');
      return;
    }
    if (user?.id && unpointedCount === 0 && dayPresence?.statut !== 'validee') {
      await savePresenceJournee({
        id: dayPresence?.id,
        crecheId: user.id,
        date: today,
        statut: 'validee',
        valideeLe: new Date().toISOString(),
        valideePar: user.id,
      });
    }
    markCompleted('fermeture');
    setClosed(true);
    onCompleted?.();
    showToast(text('La journée est bien clôturée.', 'تم إغلاق اليوم بنجاح.'), 'success');
  };

  const renderStepContent = () => {
    if (loading) {
      return (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 rounded-3xl bg-slate-200" />
          <div className="h-48 rounded-3xl bg-slate-200" />
          <div className="h-24 rounded-3xl bg-slate-200" />
        </div>
      );
    }

    if (activeStep === 'ouverture') {
      return (
        <div className="space-y-5">
          <div className="rounded-[2rem] bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-800 p-5 text-white shadow-xl sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-200"><Zap className="h-4 w-4" /> {text('Le pilotage quotidien commence ici', 'تبدأ إدارة يوم الحضانة من هنا')}</div>
                <h2 className="max-w-2xl text-2xl font-black tracking-tight sm:text-4xl">{text('Un déroulement clair, étape par étape.', 'سير عمل واضح، خطوة بخطوة.')}</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100/80">{text('Ouvrez la crèche, préparez les équipes et suivez chaque étape sans parcourir les menus.', 'افتح الحضانة، حضّر الفريق وتابع كل مرحلة دون التنقل بين القوائم.')}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 sm:min-w-48"><p className="text-xs font-bold text-indigo-200">{dateLabel}</p><p className="mt-2 text-3xl font-black">{getTimeLabel()}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: text('Enfants actifs', 'الأطفال النشطون'), value: enfants.length, icon: Baby, color: 'text-indigo-600 bg-indigo-50' },
              { label: text('Équipe active', 'الفريق النشط'), value: activePersonnelCount, icon: Users, color: 'text-emerald-600 bg-emerald-50' },
              { label: text('Classes', 'الأقسام'), value: classes.length, icon: ClipboardCheck, color: 'text-amber-600 bg-amber-50' },
              { label: text('À pointer', 'بانتظار التسجيل'), value: unpointedCount, icon: CircleAlert, color: 'text-rose-600 bg-rose-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${color}`}><Icon className="h-4 w-4" /></div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value}</p></div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => goNext('ouverture')} className="flex items-center justify-between rounded-2xl bg-indigo-600 p-4 text-left text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.98]"><span><span className="block text-sm font-black">{text('Ouvrir le suivi du jour', 'فتح المتابعة اليومية')}</span><span className="mt-1 block text-xs font-semibold text-indigo-100">{text('Accéder au pointage', 'الوصول إلى تسجيل الحضور')}</span></span><ArrowRight className="h-5 w-5 rtl:rotate-180" /></button>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="flex items-center gap-2 text-sm font-black text-slate-800"><Info className="h-4 w-4 text-indigo-600" /> {text('Préparation intégrée', 'التحضير المدمج')}</p><p className="mt-2 text-xs leading-5 text-slate-500">{text('Les classes et l’équipe sont déjà utilisées dans ce parcours. Vous pourrez passer à l’étape suivante sans quitter cet écran.', 'تم إدراج الأقسام والفريق داخل هذا المسار. يمكنك الانتقال إلى المرحلة التالية دون مغادرة هذه الصفحة.')}</p><button type="button" onClick={skipCurrentStep} className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">{text('Passer cette étape', 'تجاوز هذه المرحلة')}</button></div>
          </div>
        </div>
      );
    }

    if (activeStep === 'presences') {
      const classGroups = classes.map((classe) => ({ classe, children: enfants.filter((child) => Array.isArray((classe as Classe & { childrenIds?: string[] }).childrenIds) && (classe as Classe & { childrenIds?: string[] }).childrenIds?.includes(child.id)) }));
      const assignedIds = new Set(classGroups.flatMap((group) => group.children.map((child) => child.id)));
      const unassigned = enfants.filter((child) => !assignedIds.has(child.id));
      const groups = unassigned.length > 0 ? [...classGroups, { classe: { id: 'unassigned', nom: text('Sans classe', 'دون قسم'), niveau: 'Bébés', capacite: 0 } as Classe, children: unassigned }] : classGroups;
      return (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="text-xs font-black uppercase tracking-widest text-indigo-600">{text('Pointage en direct', 'التسجيل المباشر')}</p><h2 className="mt-1 text-2xl font-black text-slate-900">{text('Qui est présent aujourd’hui ?', 'من حاضر اليوم؟')}</h2><p className="mt-1 text-sm text-slate-500">{text('Touchez un enfant pour le marquer présent ou absent. Validez ensuite la journée.', 'اضغط على الطفل لتسجيل حضوره أو غيابه، ثم اعتمد اليوم.')}</p></div><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-emerald-50 px-3 py-2"><p className="text-xl font-black text-emerald-700">{presentCount}</p><p className="text-[10px] font-bold text-emerald-700">{text('Présents', 'حاضر')}</p></div><div className="rounded-xl bg-rose-50 px-3 py-2"><p className="text-xl font-black text-rose-700">{absentCount}</p><p className="text-[10px] font-bold text-rose-700">{text('Absents', 'غائب')}</p></div><div className="rounded-xl bg-slate-100 px-3 py-2"><p className="text-xl font-black text-slate-700">{unpointedCount}</p><p className="text-[10px] font-bold text-slate-700">{text('À pointer', 'لم يسجل')}</p></div></div></div>
          {isDayValidated && <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800"><LockKeyhole className="h-5 w-5 shrink-0" />{text('La journée est validée. Les modifications se font depuis la page Présences après réouverture.', 'تم اعتماد اليوم. يتم التعديل من صفحة الحضور بعد إعادة الفتح.')}</div>}
          <div className="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-3 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-indigo-950"><CheckSquare2 className="h-4 w-4 text-indigo-600" />{text(`${selectedChildIds.length} sélectionné${selectedChildIds.length > 1 ? 's' : ''}`, `${selectedChildIds.length} محدد`)}</div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button type="button" onClick={() => toggleChildrenSelection(enfants.filter(isPresenceVisible).map((child) => child.id))} className="rounded-xl bg-white px-3 py-2 text-[11px] font-black text-indigo-700 shadow-xs hover:bg-indigo-100">{text('Tout sélectionner', 'تحديد الكل')}</button>
                <button type="button" onClick={() => setSelectedChildIds([])} className="rounded-xl bg-white px-3 py-2 text-[11px] font-black text-slate-600 shadow-xs hover:bg-slate-100">{text('Effacer', 'مسح')}</button>
                <button type="button" disabled={selectedChildIds.length === 0 || isSavingBatch || isPointingLocked} onClick={() => void saveSelectedPresent()} className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{text('Marquer présents', 'تسجيل الحضور')}</button>
                <button type="button" disabled={selectedChildIds.length === 0 || isSavingBatch || isPointingLocked} onClick={openBatchAbsence} className="rounded-xl bg-rose-600 px-3 py-2 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{text('Marquer absents', 'تسجيل الغياب')}</button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px]">
              <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3" /><input value={presenceSearch} onChange={(event) => setPresenceSearch(event.target.value)} placeholder={text('Rechercher un enfant par nom…', 'ابحث عن طفل بالاسم…')} className="w-full rounded-xl border border-indigo-100 bg-white py-2.5 pl-9 pr-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 rtl:pl-3 rtl:pr-9" /></label>
              <label className="relative block"><ListFilter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3" /><select value={presenceFilter} onChange={(event) => setPresenceFilter(event.target.value as typeof presenceFilter)} className="w-full appearance-none rounded-xl border border-indigo-100 bg-white py-2.5 pl-9 pr-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 rtl:pl-3 rtl:pr-9"><option value="tous">{text('Tous les enfants', 'كل الأطفال')}</option><option value="a-pointer">{text('À pointer', 'بانتظار التسجيل')}</option><option value="presents">{text('Présents', 'الحاضرون')}</option><option value="absents">{text('Absents', 'الغائبون')}</option></select></label>
            </div>
            {batchAbsenceDraft && <div className="mt-3 grid gap-2 rounded-2xl border border-rose-200 bg-white p-3 sm:grid-cols-[180px_1fr_auto]"><select value={batchAbsenceDraft.statut} onChange={(event) => setBatchAbsenceDraft({ ...batchAbsenceDraft, statut: event.target.value as AbsenceDraft['statut'] })} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-slate-700 outline-none"><option value="Absent non justifié">{text('Absence non justifiée', 'غياب غير مبرر')}</option><option value="Absent justifié">{text('Absence justifiée', 'غياب مبرر')}</option></select><input value={batchAbsenceDraft.motif} onChange={(event) => setBatchAbsenceDraft({ ...batchAbsenceDraft, motif: event.target.value })} placeholder={text('Motif commun (facultatif)', 'سبب مشترك (اختياري)')} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-rose-400" /><button type="button" disabled={isSavingBatch} onClick={() => void saveBatchAbsence()} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{text('Confirmer', 'تأكيد')}</button></div>}
          </div>
          <div className="space-y-4">
            {groups.length === 0 ? <EmptyState icon={Users} text={text('Aucun enfant actif à pointer. Vous pouvez passer cette étape.', 'لا يوجد أطفال نشطون لتسجيل حضورهم. يمكنك تجاوز هذه المرحلة.')} /> : groups.map(({ classe, children }) => { const visibleChildren = children.filter(isPresenceVisible); const visibleIds = visibleChildren.map((child) => child.id); const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedChildIds.includes(id)); if (visibleChildren.length === 0) return null; return (
              <section key={classe.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5"><div><p className="text-sm font-black text-slate-900">{classe.nom}</p><p className="text-xs font-semibold text-slate-400">{visibleChildren.length} {text('enfant(s)', 'طفل')}</p></div><button type="button" onClick={() => toggleChildrenSelection(visibleIds)} className="rounded-xl bg-white px-3 py-1 text-[10px] font-black text-indigo-600 shadow-xs hover:bg-indigo-100">{allVisibleSelected ? text('Désélectionner', 'إلغاء التحديد') : text('Tout le groupe', 'كل المجموعة')}</button><span className="rounded-xl bg-white px-3 py-1 text-xs font-black text-indigo-600 shadow-xs">{visibleChildren.filter((child) => getPresence(child.id)?.statut === 'Présent').length}/{visibleChildren.length}</span></div><div className="divide-y divide-slate-100">{visibleChildren.map((child) => { const presence = getPresence(child.id); const isPresent = presence?.statut === 'Présent'; const isAbsent = presence?.statut?.startsWith('Absent'); const absenceOpen = absenceDraft?.enfantId === child.id; return <div key={child.id} className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => toggleChildSelection(child.id)} aria-label={text(`Sélectionner ${child.prenom} ${child.nom}`, `تحديد ${child.prenom} ${child.nom}`)} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition ${selectedChildIds.includes(child.id) ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-transparent hover:border-indigo-300'}`}><Check className="h-4 w-4" /></button><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-600">{child.prenom.charAt(0)}{child.nom.charAt(0)}</div><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{child.prenom} {child.nom}</p><p className="text-xs font-semibold text-slate-400">{child.groupeAge}{presence?.heureArrivee ? ` • ${presence.heureArrivee}` : ''}</p></div></div><div className="flex gap-2"><button type="button" disabled={isPointingLocked} onClick={() => void savePresent(child)} className={`flex-1 rounded-xl px-3 py-2 text-xs font-black transition active:scale-[0.98] sm:flex-none ${isPresent ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'} disabled:cursor-not-allowed disabled:opacity-50`}><Check className="mr-1 inline h-3.5 w-3.5" />{text('Présent', 'حاضر')}</button><button type="button" disabled={isPointingLocked} onClick={() => setAbsenceDraft({ enfantId: child.id, statut: presence?.statut === 'Absent justifié' ? 'Absent justifié' : 'Absent non justifié', motif: presence?.motifAbsence || '' })} className={`flex-1 rounded-xl px-3 py-2 text-xs font-black transition active:scale-[0.98] sm:flex-none ${isAbsent ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'} disabled:cursor-not-allowed disabled:opacity-50`}>{text('Absent', 'غائب')}</button></div></div>{absenceOpen && <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-3"><div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]"><select value={absenceDraft.statut} onChange={(event) => setAbsenceDraft({ ...absenceDraft, statut: event.target.value as AbsenceDraft['statut'] })} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none"><option value="Absent non justifié">{text('Absence non justifiée', 'غياب غير مبرر')}</option><option value="Absent justifié">{text('Absence justifiée', 'غياب مبرر')}</option></select><input value={absenceDraft.motif} onChange={(event) => setAbsenceDraft({ ...absenceDraft, motif: event.target.value })} placeholder={text('Motif de l’absence', 'سبب الغياب')} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-rose-400" /><button type="button" onClick={() => void saveAbsence()} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white">{text('Enregistrer', 'حفظ')}</button></div></div>}</div>; })}</div></section>
            ); })}
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={skipCurrentStep} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 hover:bg-slate-50">{text('Passer cette étape', 'تجاوز هذه المرحلة')}</button><button type="button" disabled={unpointedCount > 0 || loading} onClick={() => void validatePresences()} className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{text('Valider les présences', 'اعتماد الحضور')}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></button></div>
        </div>
      );
    }

    if (activeStep === 'sante') {
      return (
        <div className="space-y-5">
          <SectionIntro icon={Stethoscope} title={text('Santé et sécurité', 'الصحة والسلامة')} description={text('Contrôlez rapidement la température, l’humeur et le repas prévu pour les enfants présents.', 'تحقق بسرعة من درجة الحرارة والمزاج والوجبة المقررة للأطفال الحاضرين.')} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label={text('Présents', 'حاضر')} value={presentCount} color="emerald" /><Metric label={text('À vérifier', 'للمراجعة')} value={healthMissingCount} color={healthMissingCount > 0 ? 'rose' : 'emerald'} /><Metric label={text('Absents', 'غائب')} value={absentCount} color="amber" /><Metric label={text('Sécurité', 'السلامة')} value={text('OK', 'جيدة')} color="indigo" /></div>
          {presentChildren.length === 0 ? <EmptyState icon={ShieldCheck} text={text('Aucun enfant présent à contrôler pour le moment.', 'لا يوجد طفل حاضر للتحقق منه حالياً.')} /> : <div className="grid gap-3 md:grid-cols-2">{presentChildren.map((child) => { const presence = getPresence(child.id) as (Presence & { temperature?: string; humeur?: string; repas?: string }) | undefined; const selected = healthChildId === child.id; return <div key={child.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-xs font-black text-rose-600">{child.prenom.charAt(0)}{child.nom.charAt(0)}</div><div><p className="text-sm font-black text-slate-900">{child.prenom} {child.nom}</p><p className="text-xs font-semibold text-slate-400">{text('Arrivée', 'وقت الوصول')} {presence?.heureArrivee || '—'}</p></div></div><span className={`rounded-lg px-2 py-1 text-[10px] font-black ${presence?.temperature ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{presence?.temperature ? `${presence.temperature} °C` : text('À vérifier', 'للمراجعة')}</span></div><div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500"><span className="rounded-lg bg-slate-50 px-2 py-1">{presence?.humeur || text('Humeur à renseigner', 'المزاج غير مسجل')}</span><span className="rounded-lg bg-slate-50 px-2 py-1">{presence?.repas || text('Repas à renseigner', 'الوجبة غير مسجلة')}</span></div><button type="button" onClick={() => openHealthEditor(child)} className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800">{selected ? text('Fermer la fiche', 'إغلاق البطاقة') : text('Mettre à jour', 'تحديث')}</button>{selected && <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3"><div className="grid grid-cols-2 gap-2"><label className="text-[11px] font-bold text-slate-500"><span className="mb-1 block">{text('Température', 'الحرارة')}</span><input value={healthForm.temperature} onChange={(event) => setHealthForm({ ...healthForm, temperature: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" /></label><label className="text-[11px] font-bold text-slate-500"><span className="mb-1 block">{text('Repas', 'الوجبة')}</span><select value={healthForm.repas} onChange={(event) => setHealthForm({ ...healthForm, repas: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"><option value="Tout">{text('Tout', 'الكل')}</option><option value="Partiel">{text('Partiel', 'جزئي')}</option><option value="Refusé">{text('Refusé', 'مرفوض')}</option></select></label></div><label className="text-[11px] font-bold text-slate-500"><span className="mb-1 block">{text('Humeur', 'المزاج')}</span><input value={healthForm.humeur} onChange={(event) => setHealthForm({ ...healthForm, humeur: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" /></label><button type="button" onClick={() => void saveHealth()} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white">{text('Enregistrer la fiche', 'حفظ البطاقة')}</button></div>}</div>; })}</div>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={skipCurrentStep} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600">{text('Passer cette étape', 'تجاوز هذه المرحلة')}</button><button type="button" onClick={() => goNext('sante')} className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white">{text('Santé vérifiée', 'تم التحقق من الصحة')}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></button></div>
        </div>
      );
    }

    if (activeStep === 'repas') {
      return (
        <div className="space-y-5">
          <SectionIntro icon={ChefHat} title={text('Repas', 'الوجبات')} description={text('Confirmez ce qui sera servi aujourd’hui et gardez les informations sensibles visibles au bon moment.', 'أكد ما سيتم تقديمه اليوم واجعل المعلومات الحساسة واضحة في الوقت المناسب.')} />
          {todayMeals.length === 0 ? <EmptyState icon={Utensils} text={text('Aucun repas planifié pour aujourd’hui. Vous pouvez confirmer et passer cette étape.', 'لا توجد وجبات مبرمجة لليوم. يمكنك التأكيد وتجاوز هذه المرحلة.')} /> : <div className="grid gap-3 md:grid-cols-2">{todayMeals.map((meal) => <div key={meal.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-widest text-orange-600">{meal.type === 'Déjeuner' ? text('Déjeuner', 'الغداء') : text('Goûter', 'اللمجة')}</p><p className="mt-1 break-words text-base font-black text-slate-900">{meal.menu}</p></div><Utensils className="h-5 w-5 text-orange-500" /></div><p className="mt-3 text-xs font-semibold text-slate-400">{(meal as Repas & { allergenes?: string }).allergenes || text('Allergènes à vérifier dans la fiche repas', 'تحقق من الحساسية في بطاقة الوجبة')}</p></div>)}</div>}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-sm font-black text-emerald-900">{text('Service des repas confirmé', 'تم تأكيد تقديم الوجبات')}</p><p className="text-xs font-semibold text-emerald-700/80">{text('Une seule validation suffit pour l’équipe du jour.', 'يكفي تأكيد واحد لفريق اليوم.')}</p></div></div><button type="button" onClick={() => setConfirmedMeals((value) => !value)} className={`relative h-7 w-12 rounded-full transition ${confirmedMeals ? 'bg-emerald-600' : 'bg-emerald-200'}`} aria-pressed={confirmedMeals}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${confirmedMeals ? 'left-6' : 'left-1'}`} /></button></div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={skipCurrentStep} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600">{text('Passer cette étape', 'تجاوز هذه المرحلة')}</button><button type="button" onClick={() => goNext('repas')} className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white">{text('Repas confirmés', 'تم تأكيد الوجبات')}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></button></div>
        </div>
      );
    }

    if (activeStep === 'activites') {
      return (
        <div className="space-y-5">
          <SectionIntro icon={Sparkles} title={text('Activités', 'الأنشطة')} description={text('Voyez les ateliers du jour, les groupes concernés et les personnes qui les encadrent.', 'شاهد أنشطة اليوم والمجموعات المعنية والأشخاص المشرفين عليها.')} />
          {todayActivities.length === 0 ? <EmptyState icon={Sparkles} text={text('Aucune activité planifiée pour aujourd’hui. Vous pouvez lancer une journée sans activité prévue.', 'لا توجد أنشطة مبرمجة لليوم. يمكنك متابعة اليوم دون نشاط مبرمج.')} /> : <div className="grid gap-3 md:grid-cols-2">{todayActivities.map((activity) => <div key={activity.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-widest text-indigo-600">{activity.groupe}</p><p className="mt-1 break-words text-base font-black text-slate-900">{activity.titre}</p></div><Sparkles className="h-5 w-5 text-indigo-500" /></div><p className="mt-3 text-xs font-semibold text-slate-500">{(activity as Activite & { heureDebut?: string; heureFin?: string; lieu?: string }).heureDebut || '—'} - {(activity as Activite & { heureDebut?: string; heureFin?: string }).heureFin || '—'} · {(activity as Activite & { lieu?: string }).lieu || text('Lieu à préciser', 'المكان غير محدد')}</p></div>)}</div>}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600"><Play className="h-4 w-4" /></div><div><p className="text-sm font-black text-indigo-900">{text('Programme lancé', 'تم بدء البرنامج')}</p><p className="text-xs font-semibold text-indigo-700/80">{text('Les éducateurs peuvent suivre les activités prévues.', 'يمكن للمربين متابعة الأنشطة المبرمجة.')}</p></div></div><button type="button" onClick={() => setConfirmedActivities((value) => !value)} className={`relative h-7 w-12 rounded-full transition ${confirmedActivities ? 'bg-indigo-600' : 'bg-indigo-200'}`} aria-pressed={confirmedActivities}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${confirmedActivities ? 'left-6' : 'left-1'}`} /></button></div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={skipCurrentStep} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600">{text('Passer cette étape', 'تجاوز هذه المرحلة')}</button><button type="button" onClick={() => goNext('activites')} className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white">{text('Activités lancées', 'تم بدء الأنشطة')}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></button></div>
        </div>
      );
    }

    if (activeStep === 'departs') {
      return (
        <div className="space-y-5">
          <SectionIntro icon={LogOut} title={text('Départs sécurisés', 'مغادرة آمنة')} description={text('Confirmez chaque enfant récupéré avec une personne autorisée. Les départs encore en attente restent visibles.', 'أكد استلام كل طفل من طرف شخص مصرح له. ستبقى المغادرات المعلقة ظاهرة.')}/>
          <div className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 p-4"><div className="flex items-center gap-3"><DoorClosed className="h-5 w-5 text-amber-600"/><div><p className="text-sm font-black text-amber-900">{text('Départs en attente', 'المغادرات المعلقة')}</p><p className="text-xs font-semibold text-amber-700">{pendingDepartures.length} {text('enfant(s) à vérifier', 'طفل للتحقق')}</p></div></div><p className="text-2xl font-black text-amber-700">{pendingDepartures.length}</p></div>
          {presentChildren.length === 0 ? <EmptyState icon={LogOut} text={text('Aucun enfant présent à faire sortir.', 'لا يوجد طفل حاضر للمغادرة.')} /> : <div className="grid gap-3 md:grid-cols-2">{presentChildren.map((child) => { const people = authorizedPeople(child); const departed = Boolean(departures[child.id]); return <div key={child.id} className={`rounded-2xl border p-4 shadow-xs ${departed ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-xs font-black text-indigo-600">{child.prenom.charAt(0)}{child.nom.charAt(0)}</div><div><p className="text-sm font-black text-slate-900">{child.prenom} {child.nom}</p><p className="text-xs font-semibold text-slate-400">{departed ? `${text('Récupéré par', 'استلمه')} ${departures[child.id]}` : text('Départ non confirmé', 'المغادرة غير مؤكدة')}</p></div></div>{departed && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}</div>{!departed && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><select value={departureSelections[child.id] || people[0]?.name || ''} onChange={(event) => setDepartureSelections((previous) => ({ ...previous, [child.id]: event.target.value }))} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500">{people.map((person) => <option key={person.id} value={person.name}>{person.name}{person.detail ? ` · ${person.detail}` : ''}</option>)}</select><button type="button" onClick={() => void confirmDeparture(child)} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800">{text('Confirmer', 'تأكيد')}</button></div>}</div>; })}</div>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={skipCurrentStep} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600">{text('Passer cette étape', 'تجاوز هذه المرحلة')}</button><button type="button" disabled={pendingDepartures.length > 0} onClick={() => goNext('departs')} className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{text('Tous les départs sont vérifiés', 'تم التحقق من كل المغادرات')}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></button></div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <SectionIntro icon={Moon} title={text('Fermeture', 'الإغلاق')} description={text('Un dernier regard sur la journée avant de fermer la crèche.', 'نظرة أخيرة على اليوم قبل إغلاق الحضانة.')} />
        {closed ? <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-10"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"><CheckCircle2 className="h-8 w-8" /></div><h2 className="mt-5 text-2xl font-black text-emerald-900">{text('Journée clôturée avec succès.', 'تم إنهاء يوم الحضانة بنجاح.')}</h2><p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-emerald-700">{text('Les présences et les départs ont été vérifiés. Vous pouvez revenir au tableau de bord.', 'تم التحقق من الحضور والمغادرات. يمكنك العودة إلى لوحة التحكم.')}</p><button type="button" onClick={onClose} className="mt-6 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white">{text('Retour au tableau de bord', 'العودة إلى لوحة التحكم')}</button></div> : <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SummaryCard icon={CalendarCheck2} label={text('Présences', 'الحضور')} value={`${pointedCount}/${enfants.length}`} ok={unpointedCount === 0} /><SummaryCard icon={HeartPulse} label={text('Santé', 'الصحة')} value={healthMissingCount === 0 ? text('OK', 'جيدة') : `${healthMissingCount} ${text('à vérifier', 'للمراجعة')}`} ok={healthMissingCount === 0} /><SummaryCard icon={LogOut} label={text('Départs', 'المغادرة')} value={pendingDepartures.length === 0 ? text('OK', 'جيدة') : `${pendingDepartures.length} ${text('en attente', 'معلقة')}`} ok={pendingDepartures.length === 0} /><SummaryCard icon={ShieldCheck} label={text('Sécurité', 'السلامة')} value={text('Contrôlée', 'متحقق منها')} ok /></div><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"><h3 className="text-base font-black text-slate-900">{text('Avant de fermer', 'قبل الإغلاق')}</h3><div className="mt-4 space-y-3"><CheckRow label={text('Tous les enfants ont un statut de présence', 'لكل طفل حالة حضور')} done={unpointedCount === 0} /><CheckRow label={text('Les départs des enfants présents sont confirmés', 'تم تأكيد مغادرة الأطفال الحاضرين')} done={pendingDepartures.length === 0} /><CheckRow label={text('Les informations de santé prioritaires sont renseignées', 'تم إدخال المعلومات الصحية الأساسية')} done={healthMissingCount === 0} /><CheckRow label={text('Le service quotidien peut être clôturé', 'يمكن إغلاق خدمة اليوم')} done={true} /></div></div><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={() => goToStep('presences')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600">{text('Revoir les présences', 'مراجعة الحضور')}</button><button type="button" onClick={() => void completeClosing()} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 disabled:opacity-50">{text('Clôturer la journée', 'إنهاء يوم الحضانة')}<CheckCircle2 className="h-4 w-4" /></button></div></>}
      </div>
    );
  };

  if (!isDirecteur) return null;

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden bg-slate-950/70 backdrop-blur-sm" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="flex h-[100dvh] max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-slate-50 text-slate-900">
        <header className="shrink-0 border-b border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur sm:px-6 sm:py-4">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"><Zap className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">RAWDHA+ • {text('Pilotage quotidien', 'إدارة يوم الحضانة')}</p><h1 className="truncate text-base font-black sm:text-xl">{text('Pilotage quotidien', 'إدارة يوم الحضانة')}</h1></div></div><div className="flex items-center gap-2"><span className="hidden rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 sm:block">{dateLabel}</span><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50" aria-label={text('Fermer', 'إغلاق')}><X className="h-5 w-5" /></button></div></div>
        </header>
        <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 lg:hidden"><div className="flex min-w-0 gap-2 overflow-x-auto overscroll-contain pb-1 scrollbar-none">{steps.map((step, index) => { const Icon = step.icon; const isActive = step.key === activeStep; const isDone = completedSteps.includes(step.key) || (step.key === 'presences' && isDayValidated); return <button type="button" key={step.key} onClick={() => setActiveStep(step.key)} className={`flex min-w-[112px] items-center gap-2 rounded-xl px-3 py-2 text-left transition ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-white/15' : 'bg-white'}`}>{isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}</span><span><span className="block text-[10px] font-black">{index + 1}. {isArabic ? step.ar : step.fr}</span><span className={`block text-[9px] font-semibold ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>{isArabic ? step.descriptionAr : step.descriptionFr}</span></span></button>; })}</div></div>
        <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1">
          <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-5 lg:block"><div className="sticky top-0"><p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{text('Parcours du jour', 'مسار اليوم')}</p><nav className="mt-4 space-y-2">{steps.map((step, index) => { const Icon = step.icon; const isActive = step.key === activeStep; const isDone = completedSteps.includes(step.key) || (step.key === 'presences' && isDayValidated); return <button type="button" key={step.key} onClick={() => setActiveStep(step.key)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-600 hover:bg-slate-50'}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-white/15' : 'bg-slate-100 text-slate-500'}`}>{isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><span className="min-w-0"><span className="block text-xs font-black">{index + 1}. {isArabic ? step.ar : step.fr}</span><span className={`mt-0.5 block text-[10px] font-semibold ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>{isArabic ? step.descriptionAr : step.descriptionFr}</span></span></button>; })}</nav><div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><p className="text-xs font-black text-indigo-900">{text('Progression', 'التقدم')}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.round((completedSteps.length / steps.length) * 100)}%` }} /></div><p className="mt-2 text-[10px] font-bold text-indigo-700">{completedSteps.length}/{steps.length} {text('étapes terminées', 'مراحل مكتملة')}</p></div></div></aside>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"><div className="mx-auto max-w-5xl p-3 pb-8 sm:p-6 sm:pb-12 lg:p-10"><div className="mb-5 flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-widest text-indigo-600">{text(`Étape ${activeStepIndex + 1} sur ${steps.length}`, `المرحلة ${activeStepIndex + 1} من ${steps.length}`)}</p><h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">{isArabic ? activeStepData.ar : activeStepData.fr}</h2></div><div className="hidden items-center gap-2 text-xs font-bold text-slate-400 sm:flex"><span>{text('Aujourd’hui', 'اليوم')}</span><ChevronRight className="h-4 w-4 rtl:rotate-180" /><span className="text-slate-700">{dateLabel}</span></div></div>{renderStepContent()}</div></main>
        </div>
        <footer className="shrink-0 border-t border-slate-200 bg-white px-3 py-2 sm:px-6" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3"><button type="button" disabled={activeStepIndex === 0} onClick={() => setActiveStep(steps[activeStepIndex - 1]?.key || 'ouverture')} className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-black text-slate-500 hover:bg-slate-50 disabled:invisible sm:flex-none sm:px-3"><ChevronLeft className="h-4 w-4 rtl:rotate-180" />{text('Précédent', 'السابق')}</button><div className="hidden items-center gap-1.5 sm:flex">{steps.map((step) => <span key={step.key} className={`h-1.5 rounded-full transition-all ${step.key === activeStep ? 'w-8 bg-indigo-600' : completedSteps.includes(step.key) ? 'w-3 bg-emerald-500' : 'w-3 bg-slate-200'}`} />)}</div><button type="button" onClick={() => activeStepIndex === steps.length - 1 ? void completeClosing() : goNext(activeStep)} className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-indigo-600 px-2 py-2 text-xs font-black text-white hover:bg-indigo-700 sm:flex-none sm:px-3"><span>{activeStepIndex === steps.length - 1 ? text('Terminer le parcours', 'إنهاء المسار') : text('Suivant', 'التالي')}</span>{activeStepIndex === steps.length - 1 ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}</button></div></footer>
      </div>
    </div>
  );
}

function SectionIntro({ icon: Icon, title, description }: { icon: typeof DoorClosed; title: string; description: string }) {
  return <div className="flex min-w-0 items-start gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Icon className="h-5 w-5" /></div><div className="min-w-0"><h2 className="break-words text-xl font-black text-slate-900">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p></div></div>;
}

function Metric({ label, value, color }: { label: string; value: string | number; color: 'emerald' | 'rose' | 'amber' | 'indigo' }) {
  const styles = { emerald: 'bg-emerald-50 text-emerald-700', rose: 'bg-rose-50 text-rose-700', amber: 'bg-amber-50 text-amber-700', indigo: 'bg-indigo-50 text-indigo-700' };
  return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-2 inline-flex rounded-xl px-2 py-1 text-xl font-black ${styles[color]}`}>{value}</p></div>;
}

function SummaryCard({ icon: Icon, label, value, ok }: { icon: typeof DoorClosed; label: string; value: string; ok: boolean }) {
  return <div className={`rounded-2xl border p-4 shadow-xs ${ok ? 'border-emerald-100 bg-emerald-50/60' : 'border-rose-100 bg-rose-50/60'}`}><div className="flex items-center justify-between gap-2"><Icon className={`h-4 w-4 ${ok ? 'text-emerald-600' : 'text-rose-600'}`} />{ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-rose-600" />}</div><p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-1 text-sm font-black ${ok ? 'text-emerald-800' : 'text-rose-800'}`}>{value}</p></div>;
}

function CheckRow({ label, done }: { label: string; done: boolean }) {
  return <div className="flex items-center gap-3 text-sm font-bold text-slate-700"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{done ? <Check className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}</span><span>{label}</span></div>;
}

function EmptyState({ icon: Icon, text, actionLabel, onAction }: { icon: typeof DoorClosed; text: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><Icon className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-600">{text}</p>{actionLabel && onAction && <button type="button" onClick={onAction} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white">{actionLabel}</button>}</div>;
}
