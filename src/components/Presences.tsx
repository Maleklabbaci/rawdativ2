import { departureNeedsRecheck } from '../utils/departure';
import { useDeferredValue, useState, useMemo, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  CalendarCheck, 
  Search, 
  Clock, 
  Thermometer, 
  ChevronDown,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Coffee,
  Heart,
  Users,
  Calendar,
  Layers,
  ArrowLeftRight,
  BookHeart,
  MessageCircle,
  RefreshCw,
  Send,
  WifiOff,
  Bell,
  BellOff,
  LogOut,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { Enfant, Presence } from '../types';
import { presenceFormValues, validatePresenceDetails } from '../utils/presence';
import { attendanceChildren, groupAttendanceChildren } from '../utils/attendanceGroups';
import { useOfflineAttendanceQueue } from '../utils/offlineAttendanceQueue';
import ParentDailyReportModal from './ParentDailyReportModal';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';
import {
  dispatchAutomaticAttendancePush,
  isAutoAttendancePushEnabled,
  setAutoAttendancePushEnabled,
} from '../utils/parentPortal';
import { motion, AnimatePresence } from 'motion/react';

const normalizeAlgerianWhatsApp = (raw?: string) => {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  let normalized = digits;
  if (normalized.startsWith('00213')) normalized = normalized.slice(2);
  else if (normalized.startsWith('0') && normalized.length === 10) normalized = `213${normalized.slice(1)}`;
  else if (normalized.length === 9 && /^[567]/.test(normalized)) normalized = `213${normalized}`;
  return /^213[567]\d{8}$/.test(normalized) ? normalized : null;
};

export default function PresencesPage() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  const { 
    presences: allDbPresences, 
    enfants: allEnfantsData, 
    classes: classesData,
    repas: repasData = [],
    activites: activitesData = [],
    addPresence,
    updatePresence,
    deletePresence,
    presenceJournees,
    savePresenceJournee
  } = useDb();
  
  const { user, creche } = useAuth();
  const { hasPagePermission } = useWorkspaceProfile();
  const canPoint = hasPagePermission('presences', 'point');
  const canDailyReport = hasPagePermission('presences', 'daily_report');
  const canValidateDay = hasPagePermission('presences', 'validate_day');
  const isDirecteur = user?.role === 'directeur';
  const [dailyReportChild, setDailyReportChild] = useState<Enfant | null>(null);

  const {
    queue: offlineQueue,
    isOffline,
    isSyncing,
    enqueueAttendance,
    flushQueue,
  } = useOfflineAttendanceQueue({
    crecheId: user?.id,
    addPresence,
    updatePresence,
    onSynced: (count) => {
      showToast(
        isArabic
          ? `تمت مزامنة ${count} تسجيل حضور مع الخادم.`
          : `${count} pointage(s) hors-ligne synchronisé(s) avec succès.`,
        'success'
      );
    },
  });
  
  // Filtrer les enfants de la crèche courante
  const enfantsData = isDirecteur ? allEnfantsData.filter(e => e.crecheId === user!.id) : allEnfantsData;
  const enfantIdsVisibles = new Set(enfantsData.map(e => e.id));
  const dbPresences = isDirecteur ? allDbPresences.filter(p => enfantIdsVisibles.has(p.enfantId)) : allDbPresences;

  // Fusion optimiste de la file hors-ligne avec les pointages enregistrés
  const presences: Presence[] = useMemo(() => {
    if (offlineQueue.length === 0) return dbPresences;
    const merged = [...dbPresences];
    for (const item of offlineQueue) {
      if (!enfantIdsVisibles.has(item.payload.enfantId)) continue;
      const idx = merged.findIndex(
        p => p.enfantId === item.payload.enfantId && p.date === item.payload.date
      );
      const optimistic: Presence = {
        id: item.existingId || item.queueId,
        ...item.payload,
      };
      if (idx >= 0) merged[idx] = optimistic;
      else merged.push(optimistic);
    }
    return merged;
  }, [dbPresences, enfantIdsVisibles, offlineQueue]);

  // Gestion des États (Tabs)
  const [activeTab, setActiveTab] = useState<'pointing' | 'history'>('pointing');
  const getLocalDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60_000).toISOString().split('T')[0];
  };
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDate);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'present' | 'absent'>('all');
  const [expandAllClasses, setExpandAllClasses] = useState(false);
  const [expandedClasseId, setExpandedClasseId] = useState<string | null>(null);

  const getNowHHMM = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // Modals
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [selectedEnfantForAbsence, setSelectedEnfantForAbsence] = useState<string | null>(null);
  const [absenceSnapshot, setAbsenceSnapshot] = useState<{ date: string; record: Presence | null } | null>(null);
  const [showPresenceDetailsModal, setShowPresenceDetailsModal] = useState(false);
  const [selectedEnfantForPresenceDetails, setSelectedEnfantForPresenceDetails] = useState<string | null>(null);
  const [detailsSnapshot, setDetailsSnapshot] = useState<{ date: string; record: Presence | null } | null>(null);
  const [parentNotificationPreview, setParentNotificationPreview] = useState<{ phone: string; childName: string; message: string } | null>(null);

  // Formulaires Modals
  const [absenceForm, setAbsenceForm] = useState({
    statut: 'Absent non justifié' as 'Absent justifié' | 'Absent non justifié',
    motifAbsence: ''
  });

  const [presenceDetailsForm, setPresenceDetailsForm] = useState(() => presenceFormValues());
  const [personneRecuperationInput, setPersonneRecuperationInput] = useState('');
  const [autoPushEnabled, setAutoPushEnabled] = useState<boolean>(() => isAutoAttendancePushEnabled(user?.id));
  const [isSavingPointage, setIsSavingPointage] = useState(false);
  const savingPointageRef = useRef(false);

  const handleToggleAutoPush = () => {
    const next = !autoPushEnabled;
    setAutoPushEnabled(next);
    if (user?.id) setAutoAttendancePushEnabled(user.id, next);
    showToast(
      next
        ? (isArabic ? 'الإشعار التلقائي للأولياء مفعّل.' : 'Alerte Push auto aux parents activée.')
        : (isArabic ? 'تم إيقاف الإشعار التلقائي للأولياء.' : 'Alerte Push auto aux parents désactivée.'),
      'info'
    );
  };

  // Action rapide de pointage "Présent" : on conserve l’id existant pour éviter
  // les doublons et permettre une vraie modification du pointage du jour.
  const handleMarkPresent = (enfantId: string) => {
    if (!selectedDate) { showToast(isArabic ? 'يرجى اختيار التاريخ.' : 'Veuillez choisir une date.', 'error'); return; }
    if (isDayValidated) {
      showToast(isArabic ? 'هذا اليوم معتمد. افتحه من جديد قبل التعديل.' : 'Cette journée est validée. Rouvrez-la avant de modifier un pointage.', 'error');
      return;
    }
    const existing = presences.find(p => p.enfantId === enfantId && p.date === selectedDate);
    setDetailsSnapshot({ date: selectedDate, record: existing || null });
    const baseValues = presenceFormValues(existing?.statut === 'Présent' ? existing : undefined);
    setPresenceDetailsForm({
      ...baseValues,
      heureArrivee: baseValues.heureArrivee || getNowHHMM(),
    });
    setPersonneRecuperationInput(existing?.personneRecuperation || '');
    setSelectedEnfantForPresenceDetails(enfantId);
    setShowPresenceDetailsModal(true);
  };

  // Action 1 clic "Récupéré" pour un enfant déjà pointé Présent
  const handleQuickPickup = async (enfant: Enfant, existing: Presence) => {
    if (!selectedDate || savingPointageRef.current) return;
    if (isDayValidated) {
      showToast(isArabic ? 'هذا اليوم معتمد. افتحه من جديد قبل التعديل.' : 'Cette journée est validée. Rouvrez-la avant de modifier un pointage.', 'error');
      return;
    }
    let departTime = getNowHHMM();
    if (existing.heureArrivee && departTime <= existing.heureArrivee) {
      const [hStr, mStr] = existing.heureArrivee.split(':');
      const totalMins = Math.min(23 * 60 + 59, (Number(hStr) || 8) * 60 + (Number(mStr) || 0) + 1);
      departTime = `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
    }
    const updatedPayload = {
      ...existing,
      statut: 'Présent' as const,
      heureDepart: departTime,
    };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueueAttendance({
        mode: !existing.id.startsWith('off-pres-') ? 'update' : 'add',
        existingId: !existing.id.startsWith('off-pres-') ? existing.id : undefined,
        existingSnapshot: !existing.id.startsWith('off-pres-') ? existing : undefined,
        payload: updatedPayload,
      });
      showToast(
        isArabic ? 'تم تسجيل الاستلام محلياً.' : 'Départ enregistré hors-ligne.',
        'info'
      );
      return;
    }
    savingPointageRef.current = true;
    setIsSavingPointage(true);
    try {
      await updatePresence(existing.id, { heureDepart: departTime }, existing);
      const pushRes = await dispatchAutomaticAttendancePush({
        crecheId: user?.id,
        crecheNom: creche?.nom,
        enfant,
        previous: existing,
        next: updatedPayload,
        isArabic,
      }).catch(() => {
        showToast(isArabic ? 'تم حفظ البيانات، لكن الإشعار غير مؤكد.' : 'Données enregistrées, mais la notification n’a pas pu être confirmée.', 'info');
        return { triggered: false, sentPushCount: 0 };
      });
      showToast(
        pushRes.triggered && pushRes.sentPushCount > 0
          ? (isArabic
              ? `تم تسجيل الاستلام (${departTime}) · أُرسل إشعار فوري للولي`
              : `Départ enregistré (${departTime}) · envoi Push accepté par le service`)
          : (isArabic
              ? `تم تسجيل استلام ${enfant.prenom} على ${departTime}`
              : `${enfant.prenom} marqué(e) récupéré(e) à ${departTime}`),
        'success'
      );
    } catch {
      // Data provider shows error
    } finally {
      savingPointageRef.current = false;
      setIsSavingPointage(false);
    }
  };

  // Soumission des détails de présence avec validation minimale des données métier.
  const submitPresenceDetails = async () => {
    if (!selectedEnfantForPresenceDetails || !detailsSnapshot) return;
    const validation = validatePresenceDetails(presenceDetailsForm);
    if (validation) {
      const message = validation === 'arrival'
        ? (isArabic ? 'يرجى إدخال وقت الوصول.' : 'Veuillez saisir l’heure d’arrivée.')
        : validation === 'departure'
          ? (isArabic ? 'يجب أن يكون وقت المغادرة بعد وقت الوصول.' : 'Le départ doit être après l’arrivée.')
          : (isArabic ? 'درجة الحرارة غير صالحة.' : 'La température saisie est invalide.');
      showToast(message, 'error');
      return;
    }
    const existing = detailsSnapshot.record;
    const trimmedPickupBy = personneRecuperationInput.trim();
    const details = {
      enfantId: selectedEnfantForPresenceDetails,
      date: detailsSnapshot.date,
      statut: 'Présent' as const,
      ...presenceDetailsForm,
      ...(presenceDetailsForm.heureDepart && trimmedPickupBy ? { personneRecuperation: trimmedPickupBy } : {}),
      ...(departureNeedsRecheck(existing, presenceDetailsForm.heureArrivee, presenceDetailsForm.heureDepart) ? { departVerifie: false, departVerifiePar: '', departVerifieLe: '', personneRecuperationId: '' } : {}),
      temperature: presenceDetailsForm.temperature.trim()
        ? Number(presenceDetailsForm.temperature.trim().replace(',', '.')).toFixed(1)
        : ''
    };
    if (savingPointageRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueueAttendance({
        mode: existing && !existing.id.startsWith('off-pres-') ? 'update' : 'add',
        existingId: existing && !existing.id.startsWith('off-pres-') ? existing.id : undefined,
        existingSnapshot: existing && !existing.id.startsWith('off-pres-') ? existing : undefined,
        payload: details,
      });
      setShowPresenceDetailsModal(false);
      setSelectedEnfantForPresenceDetails(null);
      setDetailsSnapshot(null);
      setPresenceDetailsForm(presenceFormValues());
      setPersonneRecuperationInput('');
      showToast(
        isArabic
          ? 'تم حفظ الحضور محلياً وسيتم إرساله تلقائياً فور عودة الإنترنت.'
          : 'Pointage enregistré hors-ligne — synchronisation automatique dès le retour d’Internet.',
        'info'
      );
      return;
    }
    savingPointageRef.current = true;
    setIsSavingPointage(true);
    try {
      if (existing) await updatePresence(existing.id, details, existing);
      else await addPresence(details);
      const targetChild = enfantsData.find(item => item.id === selectedEnfantForPresenceDetails) || null;
      const pushRes = await dispatchAutomaticAttendancePush({
        crecheId: user?.id,
        crecheNom: creche?.nom,
        enfant: targetChild,
        previous: existing,
        next: details,
        isArabic,
      }).catch(() => {
        showToast(isArabic ? 'تم حفظ البيانات، لكن الإشعار غير مؤكد.' : 'Données enregistrées, mais la notification n’a pas pu être confirmée.', 'info');
        return { triggered: false, sentPushCount: 0 };
      });
      if (pushRes.triggered && pushRes.sentPushCount > 0) {
        showToast(
          isArabic
            ? `تم حفظ الحضور · أُرسل إشعار فوري للولي (${pushRes.sentPushCount})`
            : `Pointage enregistré · envoi Push accepté par le service`,
          'success'
        );
      }
      setShowPresenceDetailsModal(false);
      setSelectedEnfantForPresenceDetails(null);
      setDetailsSnapshot(null);
      setPresenceDetailsForm(presenceFormValues());
      setPersonneRecuperationInput('');
    } catch {
      // The data provider displays the write error; keep the form intact.
    } finally {
      savingPointageRef.current = false;
      setIsSavingPointage(false);
    }
  };

  // Action rapide de pointage "Absent" (Ouvre le modal de saisie de motif)
  const handleMarkAbsentClick = (enfantId: string) => {
    if (!selectedDate) { showToast(isArabic ? 'يرجى اختيار التاريخ.' : 'Veuillez choisir une date.', 'error'); return; }
    if (isDayValidated) {
      showToast(isArabic ? 'هذا اليوم معتمد. افتحه من جديد قبل التعديل.' : 'Cette journée est validée. Rouvrez-la avant de modifier un pointage.', 'error');
      return;
    }
    const existing = presences.find(p => p.enfantId === enfantId && p.date === selectedDate);
    setAbsenceSnapshot({ date: selectedDate, record: existing || null });
    setAbsenceForm({
      statut: existing?.statut === 'Absent justifié' ? 'Absent justifié' : 'Absent non justifié',
      motifAbsence: existing?.motifAbsence || ''
    });
    setSelectedEnfantForAbsence(enfantId);
    setShowAbsenceModal(true);
  };

  // Soumission de l’absence : le motif est obligatoire pour garder un registre exploitable.
  const submitAbsence = async () => {
    if (!selectedEnfantForAbsence || !absenceSnapshot) return;
    const motif = absenceForm.motifAbsence.trim();
    if (!motif) {
      showToast(isArabic ? 'يرجى إدخال سبب الغياب.' : 'Veuillez renseigner le motif de l’absence.', 'error');
      return;
    }
    const existing = absenceSnapshot.record;
    const absence = {
      enfantId: selectedEnfantForAbsence,
      date: absenceSnapshot.date,
      statut: absenceForm.statut,
      motifAbsence: motif,
      personneRecuperationId: '', departVerifie: false, departVerifiePar: '', departVerifieLe: '',
    };
    if (savingPointageRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueueAttendance({
        mode: existing && !existing.id.startsWith('off-pres-') ? 'update' : 'add',
        existingId: existing && !existing.id.startsWith('off-pres-') ? existing.id : undefined,
        existingSnapshot: existing && !existing.id.startsWith('off-pres-') ? existing : undefined,
        payload: absence,
      });
      setShowAbsenceModal(false);
      setSelectedEnfantForAbsence(null);
      setAbsenceSnapshot(null);
      setAbsenceForm({ statut: 'Absent non justifié', motifAbsence: '' });
      showToast(
        isArabic
          ? 'تم حفظ الغياب محلياً وسيتم إرساله تلقائياً فور عودة الإنترنت.'
          : 'Absence enregistrée hors-ligne — synchronisation automatique dès le retour d’Internet.',
        'info'
      );
      return;
    }
    savingPointageRef.current = true;
    setIsSavingPointage(true);
    try {
      if (existing) await updatePresence(existing.id, absence, existing);
      else await addPresence(absence);
      const targetChild = enfantsData.find(item => item.id === selectedEnfantForAbsence) || null;
      const pushRes = await dispatchAutomaticAttendancePush({
        crecheId: user?.id,
        crecheNom: creche?.nom,
        enfant: targetChild,
        previous: existing,
        next: absence,
        isArabic,
      }).catch(() => {
        showToast(isArabic ? 'تم حفظ البيانات، لكن الإشعار غير مؤكد.' : 'Données enregistrées, mais la notification n’a pas pu être confirmée.', 'info');
        return { triggered: false, sentPushCount: 0 };
      });
      if (pushRes.triggered && pushRes.sentPushCount > 0) {
        showToast(
          isArabic
            ? 'تم تسجيل الغياب · أُرسل إشعار فوري للولي'
            : 'Absence enregistrée · envoi Push accepté par le service',
          'success'
        );
      }
      setShowAbsenceModal(false);
      setSelectedEnfantForAbsence(null);
      setAbsenceSnapshot(null);
      setAbsenceForm({ statut: 'Absent non justifié', motifAbsence: '' });
    } catch {
      // Keep the entered reason available for retry.
    } finally {
      savingPointageRef.current = false;
      setIsSavingPointage(false);
    }
  };

  // Retirer un pointage (remettre à non-pointé)
  const handleDeleteAbsence = async (absence: Presence) => {
    const confirmed = await confirm({
      title: isArabic ? 'تأكيد حذف الغياب' : 'Confirmer la suppression de l’absence',
      message: isArabic
        ? 'سيتم حذف تسجيل الغياب هذا نهائياً.'
        : 'Cet enregistrement d’absence sera supprimé définitivement.',
      confirmLabel: isArabic ? 'حذف الغياب' : 'Supprimer l’absence',
      variant: 'danger',
    });
    if (confirmed) await deletePresence(absence.id, absence).catch(() => {});
  };

  const handleParentNotification = (presence: Presence) => {
    const enfant = enfantsData.find(item => item.id === presence.enfantId);
    const parent = enfant?.parents
      ?.map(item => ({ ...item, phone: normalizeAlgerianWhatsApp(item.telephone) }))
      .find(item => Boolean(item.phone));
    if (!enfant || !parent?.phone) {
      showToast(
        isArabic ? 'لا يوجد رقم واتساب صالح لولي الطفل.' : 'Aucun numéro WhatsApp valide n’est enregistré pour ce parent.',
        'error',
      );
      return;
    }

    const dateLabel = new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }).format(new Date(`${presence.date}T12:00:00`));
    const childName = `${enfant.prenom} ${enfant.nom}`;
    const message = presence.statut === 'Présent'
      ? (isArabic
        ? `السلام عليكم، نعلمكم بأن تسجيل حضور ${childName} ليوم ${dateLabel} تم بنجاح. وقت الدخول: ${presence.heureArrivee || 'غير محدد'}، وقت الانصراف: ${presence.heureDepart || 'غير محدد'}. إدارة الحضانة.`
        : `Bonjour, le pointage de ${childName} pour le ${dateLabel} est enregistré comme présent. Arrivée : ${presence.heureArrivee || 'non précisée'} ; départ : ${presence.heureDepart || 'non précisé'}.\n\nLa direction de la crèche.`)
      : (isArabic
        ? `السلام عليكم، نعلمكم بأن ${childName} مسجل غائباً ليوم ${dateLabel} (${presence.statut === 'Absent justifié' ? 'غياب مبرر' : 'غياب غير مبرر'}). السبب: ${presence.motifAbsence || 'غير محدد'}. إدارة الحضانة.`
        : `Bonjour, ${childName} est enregistré absent pour le ${dateLabel} (${presence.statut === 'Absent justifié' ? 'absence justifiée' : 'absence non justifiée'}). Motif : ${presence.motifAbsence || 'non précisé'}.\n\nLa direction de la crèche.`);
    setParentNotificationPreview({ phone: parent.phone, childName, message });
  };

  const handleResetPointing = (enfantId: string) => {
    if (!selectedDate) { showToast(isArabic ? 'يرجى اختيار التاريخ.' : 'Veuillez choisir une date.', 'error'); return; }
    if (isDayValidated) {
      showToast(isArabic ? 'هذا اليوم معتمد. افتحه من جديد قبل التعديل.' : 'Cette journée est validée. Rouvrez-la avant de modifier un pointage.', 'error');
      return;
    }
    const existing = presences.find(p => p.enfantId === enfantId && p.date === selectedDate);
    if (existing) {
      void deletePresence(existing.id, existing).catch(() => {});
    }
  };

  // --- CALCULS DES STATISTIQUES POUR LA DATE SÉLECTIONNÉE ---
  const todayPresenceByChild = useMemo(() => {
    // Une seule fiche par enfant et par jour : les anciens doublons ne faussent plus les compteurs.
    const recordsByChild = new Map<string, Presence>();
    presences.filter(p => p.date === selectedDate).forEach(p => recordsByChild.set(p.enfantId, p));
    return recordsByChild;
  }, [presences, selectedDate]);
  const todayPresences = useMemo(() => Array.from(todayPresenceByChild.values()), [todayPresenceByChild]);

  const childrenForAttendance = attendanceChildren(enfantsData, todayPresences);
  const attendanceIds = new Set(childrenForAttendance.map(child => child.id));
  const visibleRecords = todayPresences.filter(p => attendanceIds.has(p.enfantId));
  const attendanceGroups = groupAttendanceChildren(childrenForAttendance, classesData);
  const countPresents = visibleRecords.filter(p => p.statut === 'Présent').length;
  const countAbsents = visibleRecords.filter(p => p.statut.startsWith('Absent')).length;
  const countNonPointes = Math.max(childrenForAttendance.length - visibleRecords.length, 0);
  const isDayComplete = !!selectedDate && childrenForAttendance.length > 0 && countNonPointes === 0;
  const currentPresenceJournee = presenceJournees.find(j => j.date === selectedDate && j.crecheId === user?.id);
  const isDayValidated = currentPresenceJournee?.statut === 'validee';

  const handleValidateDay = async () => {
    if (!user?.id || !isDayComplete) {
      showToast(isArabic ? 'يرجى تسجيل حضور جميع الأطفال أولاً.' : 'Pointez tous les enfants avant de valider la journée.', 'error');
      return;
    }
    await savePresenceJournee({
      crecheId: user.id,
      date: selectedDate,
      statut: 'validee',
      valideeLe: new Date().toISOString(),
      valideePar: user.id
    });
    showToast(isArabic ? 'تم اعتماد يوم الحضور.' : 'La journée de présence est validée.', 'success');
  };

  const handleReopenDay = async () => {
    if (!user?.id) return;
    await savePresenceJournee({
      id: currentPresenceJournee?.id,
      crecheId: user.id,
      date: selectedDate,
      statut: 'ouverte'
    });
    showToast(isArabic ? 'تم فتح يوم الحضور من جديد.' : 'La journée est de nouveau ouverte à la modification.', 'success');
  };

  // --- HISTORIQUE DES ABSENCES TRIÉ PAR JOUR (Pour l'onglet Historique) ---
  const absencesGroupedByDay = useMemo(() => {
    const allAbsences = presences.filter(p => p.statut.startsWith('Absent'));
    
    // Regrouper par date
    const groups: Record<string, Presence[]> = {};
    allAbsences.forEach(p => {
      if (!groups[p.date]) {
        groups[p.date] = [];
      }
      groups[p.date].push(p);
    });

    // Trier les dates par ordre décroissant (du plus récent au plus ancien)
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [presences]);

  return (
    <div className={`space-y-4 sm:space-y-6 ${isArabic ? 'rtl' : 'ltr'}`}>
      
      {/* En-tête principal épuré */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex w-full md:w-auto items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isArabic ? 'الحضور والغيابات' : 'Présences'}
            </h1>
            <p className="hidden sm:block text-sm text-slate-500 mt-0.5">
              {isArabic
                ? 'سجل الحضور اليومي حسب الفصول ومتابعة الغيابات.'
                : 'Appel quotidien par classe et suivi des absences.'}
            </p>
          </div>

          <div className={`md:hidden shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-xl text-[11px] font-bold border ${
            isDayValidated
              ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
              : isDayComplete
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-100'
          }`}>
            {!selectedDate ? (isArabic ? 'اختر تاريخ الحضور' : 'Choisissez une date') : isDayValidated
              ? (isArabic ? 'اليوم معتمد' : 'Validée')
              : isDayComplete
                ? (isArabic ? 'اليوم مكتمل' : 'Complet')
                : (isArabic ? `${countNonPointes} متبقي` : `${countNonPointes} à pointer`)}
          </div>
        </div>

        {/* Sélectionneur de date et bouton de clôture alignés sur 1 ligne */}
        <div className="flex w-full md:w-auto items-center gap-2">
          <div className="flex min-w-0 flex-1 md:flex-initial items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-xl">
            <Calendar className="w-4 h-4 shrink-0 text-slate-500" />
            <input
              type="date"
              aria-label={isArabic ? 'تاريخ الحضور' : 'Date de présence'}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="min-w-0 w-full outline-none text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer"
            />
          </div>
          <div className={`hidden md:block shrink-0 whitespace-nowrap px-2.5 py-2 rounded-xl text-xs font-bold border ${
            isDayValidated
              ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
              : isDayComplete
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-100'
          }`}>
            {!selectedDate ? (isArabic ? 'اختر تاريخ الحضور' : 'Choisissez une date') : isDayValidated
              ? (isArabic ? 'اليوم معتمد' : 'Journée validée')
              : isDayComplete
                ? (isArabic ? 'اليوم مكتمل' : 'Pointage complet')
                : (isArabic ? `${countNonPointes} متبقي` : `${countNonPointes} à pointer`)}
          </div>
          {canValidateDay && (isDayValidated ? (
            <button
              type="button"
              onClick={() => void handleReopenDay().catch(() => {})}
              className="min-h-9! shrink-0 whitespace-nowrap px-3 py-2 rounded-xl text-xs font-bold bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer"
            >
              {isArabic ? 'إعادة فتح اليوم' : 'Rouvrir la journée'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleValidateDay().catch(() => {})}
              disabled={!isDayComplete}
              className="min-h-9! shrink-0 whitespace-nowrap px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isArabic ? 'اعتماد اليوم' : 'Valider la journée'}
            </button>
          ))}
        </div>
      </div>

      {/* Bandeau de file d'attente hors-ligne */}
      {(isOffline || offlineQueue.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          <div className="flex items-center gap-2.5">
            <WifiOff className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span className="font-semibold">
              {isOffline
                ? isArabic
                  ? `وضع دون اتصال مفعل · يمكنك متابعة النداء الصباحي (${offlineQueue.length} في الانتظار).`
                  : `Mode hors-ligne actif · L’appel continue normalement (${offlineQueue.length} en attente de synchronisation).`
                : isArabic
                  ? `${offlineQueue.length} تسجيل حضور محفوظ محلياً جاهز للمزامنة.`
                  : `${offlineQueue.length} pointage(s) hors-ligne prêt(s) à être synchronisé(s).`}
            </span>
          </div>
          {!isOffline && offlineQueue.length > 0 && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => void flushQueue()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-950 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isArabic ? 'مزامنة الآن' : 'Synchroniser'}</span>
            </button>
          )}
        </div>
      )}

      {/* Widgets Statistiques (affichés dès md, car sur mobile les pastilles de filtre affichent déjà les compteurs) */}
      <div className="hidden md:grid md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-500">{isArabic ? 'حاضر اليوم' : 'Présents'}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">{selectedDate ? countPresents : '—'}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-500">{isArabic ? 'غائب اليوم' : 'Absents'}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">{selectedDate ? countAbsents : '—'}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-500">{isArabic ? 'إجمالي الأطفال' : 'Total enfants'}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">{childrenForAttendance.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDayComplete ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-500">{isArabic ? 'المتبقي' : 'À pointer'}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">{selectedDate ? countNonPointes : '—'}</p>
          </div>
        </div>
      </div>

      {/* Barre de navigation des onglets */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('pointing')}
          className={`pb-3 text-sm font-black transition-all cursor-pointer relative ${
            activeTab === 'pointing' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {isArabic ? 'أخذ حضور الفصول اليومي' : 'Appel quotidien'}
          {activeTab === 'pointing' && (
            <motion.div layoutId="activeTabBorder" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-black transition-all cursor-pointer relative flex items-center gap-2 ${
            activeTab === 'history' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {isArabic ? 'سجل الغيابات المنظم' : 'Registre des absences'}
          <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full">
            {presences.filter(p => p.statut.startsWith('Absent')).length}
          </span>
          {activeTab === 'history' && (
            <motion.div layoutId="activeTabBorder" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full" />
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. ONGLET : POINTAGE QUOTIDIEN PAR CLASSE */}
      {/* ======================================================== */}
      {activeTab === 'pointing' && (
        <div className="space-y-4">
          
          {/* Barre de recherche + filtres rapides mobile + bouton Tout déplier */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={isArabic ? 'ابحث عن طفل لتحديد صفه...' : 'Rechercher un enfant...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full ps-9 pe-9 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition text-sm font-semibold text-slate-800"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label={isArabic ? 'مسح البحث' : 'Effacer la recherche'}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
              {[
                { key: 'all' as const, label: isArabic ? `الكل (${childrenForAttendance.length})` : `Tous (${childrenForAttendance.length})` },
                { key: 'todo' as const, label: isArabic ? `متبقي (${selectedDate ? countNonPointes : 0})` : `À pointer (${selectedDate ? countNonPointes : 0})` },
                { key: 'present' as const, label: isArabic ? `حاضرون (${selectedDate ? countPresents : 0})` : `Présents (${selectedDate ? countPresents : 0})` },
                { key: 'absent' as const, label: isArabic ? `غائبون (${selectedDate ? countAbsents : 0})` : `Absents (${selectedDate ? countAbsents : 0})` },
              ].map(pill => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setStatusFilter(pill.key)}
                  className={`min-h-9! rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-bold transition cursor-pointer tabular-nums ${
                    statusFilter === pill.key
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
              {attendanceGroups.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setExpandAllClasses(prev => !prev);
                    setExpandedClasseId(null);
                  }}
                  className="min-h-9! col-span-2 sm:col-span-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 whitespace-nowrap transition cursor-pointer"
                >
                  {expandAllClasses
                    ? (isArabic ? 'طي الكل' : 'Tout replier')
                    : (isArabic ? 'فتح الكل' : 'Tout déplier')}
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleAutoPush}
                data-testid="toggle-auto-parent-push"
                className={`min-h-9! col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  autoPushEnabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
                title={
                  isArabic
                    ? 'إرسال إشعار تلقائي للولي عند الوصول أو الاستلام أو الغياب'
                    : 'Envoi Push automatique aux parents liés (Bien arrivé / Récupéré / Absence)'
                }
              >
                {autoPushEnabled ? <Bell className="w-3.5 h-3.5 shrink-0" /> : <BellOff className="w-3.5 h-3.5 shrink-0" />}
                <span>{isArabic ? (autoPushEnabled ? 'إشعار الولي: تلقائي' : 'إشعار الولي: متوقف') : (autoPushEnabled ? 'Push parents : Auto' : 'Push parents : Off')}</span>
              </button>
            </div>
          </div>

          {/* Grid des Classes (Accordéons) */}
          <div className="space-y-3">
            {attendanceGroups.map((group) => {
              const normalizedSearch = deferredSearchTerm.toLowerCase();
              const groupPointedCount = group.children.filter(child =>
                todayPresenceByChild.has(child.id)
              ).length;
              const classeChildren = group.children.filter(e => {
                const matchesName = !normalizedSearch || `${e.prenom} ${e.nom}`.toLowerCase().includes(normalizedSearch);
                if (!matchesName) return false;
                if (statusFilter === 'all') return true;
                const rec = todayPresenceByChild.get(e.id);
                if (statusFilter === 'todo') return !rec;
                if (statusFilter === 'present') return rec?.statut === 'Présent';
                return Boolean(rec?.statut.startsWith('Absent'));
              });
              if ((deferredSearchTerm || statusFilter !== 'all') && classeChildren.length === 0) return null;

              const isExpanded =
                expandAllClasses ||
                Boolean(deferredSearchTerm.trim()) ||
                statusFilter !== 'all' ||
                expandedClasseId === group.key;

              const groupProgressPct = group.children.length > 0
                ? Math.round((groupPointedCount / group.children.length) * 100)
                : 0;

              return (
                <div key={group.key} className="rawdha-card-modern bg-white rounded-3xl border border-slate-200/75 shadow-2xs overflow-hidden">
                  
                  {/* Header de l'accordéon de classe */}
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => {
                      if (expandAllClasses) setExpandAllClasses(false);
                      setExpandedClasseId(isExpanded ? null : group.key);
                    }}
                    className="w-full p-4 sm:p-5 flex flex-col gap-2.5 text-start cursor-pointer hover:bg-slate-50/50 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/20 flex items-center justify-center">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate font-extrabold text-slate-950 text-sm sm:text-base">{group.unassigned ? (isArabic ? 'دون قسم' : 'Sans classe') : group.nom}</h3>
                          <p className="text-xs text-slate-500 font-bold">{group.niveau && <>{group.niveau} • </>}{classeChildren.length} {isArabic ? 'أطفال مسجلين' : 'enfants'}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {selectedDate && (
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold tabular-nums ${
                            groupPointedCount === group.children.length && group.children.length > 0
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {groupPointedCount}/{group.children.length}
                          </span>
                        )}
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-all ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`} />
                      </div>
                    </div>
                    {selectedDate && group.children.length > 0 && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                          style={{ width: `${groupProgressPct}%` }}
                        />
                      </div>
                    )}
                  </button>

                  {/* Corps de l'accordéon contenant les enfants */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="border-t border-slate-100 bg-slate-50/30"
                      >
                        <div className="p-3.5 sm:p-5 divide-y divide-slate-100">
                          {classeChildren.length > 0 ? (
                            classeChildren.map((enfant) => {
                              // Vérifier le statut de l'enfant pour la date sélectionnée
                              const statusRecord = todayPresenceByChild.get(enfant.id);
                              
                              return (
                                <div key={enfant.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  
                                  {/* Infos Enfant */}
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-2xl font-black text-xs flex items-center justify-center text-white shadow-xs ${
                                      enfant.genre === 'Fille' ? 'bg-gradient-to-tr from-pink-500 to-rose-400' : 'bg-gradient-to-tr from-sky-500 to-indigo-500'
                                    }`}>
                                      {enfant.prenom[0]}{enfant.nom[0]}
                                    </div>
                                    <div>
                                      <p className="font-extrabold text-slate-900">{enfant.prenom} {enfant.nom}</p>
                                      <p className="text-[11px] text-slate-400 font-bold">{enfant.genre}</p>
                                    </div>
                                  </div>

                                  {/* Affichage des détails si pointé présent */}
                                  {statusRecord?.statut === 'Présent' && (
                                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
                                      {statusRecord.temperature && <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-md font-bold">
                                        <Thermometer className="w-3.5 h-3.5" /> {statusRecord.temperature}°C
                                      </span>}
                                      <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-md font-bold">
                                        <Clock className="w-3.5 h-3.5" /> {statusRecord.heureArrivee || '—'} - {statusRecord.heureDepart || (isArabic ? 'لم تسجل المغادرة' : 'Départ non renseigné')}
                                      </span>
                                    </div>
                                  )}

                                  {/* Affichage du motif si pointé absent */}
                                  {statusRecord?.statut.startsWith('Absent') && (
                                    <div className="max-w-xs text-xs text-rose-600 bg-rose-50/50 border border-rose-100 px-3 py-1.5 rounded-xl font-bold">
                                      {statusRecord.motifAbsence}
                                    </div>
                                  )}

                                  {/* Double boutons interactifs de Pointage */}
                                  <div className="flex flex-wrap items-center gap-2">
                                    
                                    {/* Bouton : PRÉSENT */}
                                    <button
                                      disabled={!selectedDate || isSavingPointage || !canPoint}
                                      onClick={() => handleMarkPresent(enfant.id)}
                                      className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border disabled:opacity-45 disabled:cursor-not-allowed ${
                                        statusRecord?.statut === 'Présent'
                                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                          : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/30'
                                      }`}
                                    >
                                      {isArabic ? 'حاضر' : 'Présent'}
                                    </button>

                                    {/* Bouton 1 clic : RÉCUPÉRÉ (visible dès que l'enfant est Présent sans heureDepart) */}
                                    {statusRecord?.statut === 'Présent' && !statusRecord.heureDepart && (
                                      <button
                                        type="button"
                                        disabled={!selectedDate || isSavingPointage || !canPoint}
                                        onClick={() => void handleQuickPickup(enfant, statusRecord)}
                                        data-testid={`quick-pickup-${enfant.id}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-45 disabled:cursor-not-allowed"
                                      >
                                        <LogOut className="w-3.5 h-3.5 shrink-0" />
                                        <span>{isArabic ? 'تم الاستلام' : 'Récupéré'}</span>
                                      </button>
                                    )}

                                    {statusRecord?.statut === 'Présent' && Boolean(statusRecord.heureDepart) && (
                                      <span className="inline-flex items-center gap-1 rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[11px] font-extrabold text-teal-800 whitespace-nowrap">
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                        <span>{isArabic ? `استُلم ${statusRecord.heureDepart}` : `Récupéré ${statusRecord.heureDepart}`}</span>
                                      </span>
                                    )}

                                    {/* Bouton : ABSENT */}
                                    <button
                                      disabled={!selectedDate || isSavingPointage || !canPoint}
                                      onClick={() => handleMarkAbsentClick(enfant.id)}
                                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border disabled:opacity-45 disabled:cursor-not-allowed ${
                                        statusRecord?.statut.startsWith('Absent')
                                          ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                                          : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300 hover:bg-rose-50/30'
                                      }`}
                                    >
                                      {isArabic ? 'غائب' : 'Absent'}
                                    </button>

                                    {/* Actions après pointage */}
                                    {statusRecord && (
                                      <>
                                        {canDailyReport && (
                                          <button
                                            type="button"
                                            onClick={() => setDailyReportChild(enfant)}
                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                            title={isArabic ? 'دفتر المتابعة اليومي للأولياء' : 'Carnet de liaison du jour'}
                                            aria-label={isArabic ? 'دفتر المتابعة اليومي للأولياء' : 'Carnet de liaison du jour'}
                                          >
                                            <BookHeart className="w-4 h-4" />
                                          </button>
                                        )}
                                        {canDailyReport && (
                                          <button
                                            type="button"
                                            onClick={() => handleParentNotification(statusRecord)}
                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                            title={isArabic ? 'إعداد إشعار لولي الطفل' : 'Préparer une notification parent'}
                                            aria-label={isArabic ? 'إعداد إشعار لولي الطفل' : 'Préparer une notification parent'}
                                          >
                                            <MessageCircle className="w-4 h-4" />
                                          </button>
                                        )}
                                        {canPoint && (
                                          <button
                                            type="button"
                                            onClick={() => handleResetPointing(enfant.id)}
                                            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                            title={isArabic ? 'إلغاء التحديد' : 'Réinitialiser'}
                                            aria-label={isArabic ? 'إلغاء التحديد' : 'Réinitialiser le pointage'}
                                          >
                                            <ArrowLeftRight className="w-4 h-4" />
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>

                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-slate-400 text-center py-4">{isArabic ? 'لا توجد أطفال يطابقون بحثك' : 'Aucun enfant trouvé.'}</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 2. ONGLET : HISTORIQUE DES ABSENCES CLASSÉ PAR JOURS */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          
          {absencesGroupedByDay.length > 0 ? (
            absencesGroupedByDay.map(([date, dailyAbsences]) => (
              <div key={date} className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                
                {/* En-tête du jour */}
                <div className="bg-slate-50 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {new Date(date).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-FR', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </span>
                  <span className="bg-rose-100 text-rose-700 text-xs px-2.5 py-1 rounded-full font-black">
                    {dailyAbsences.length} {isArabic ? 'غيابات' : 'absences'}
                  </span>
                </div>

                {/* Liste des absences de cette journée */}
                <div className="divide-y divide-slate-100">
                  {dailyAbsences.map((abs) => {
                    const enfant = enfantsData.find(e => e.id === abs.enfantId);
                    
                    return (
                      <div key={abs.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        {/* Kid profile */}
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 font-black text-xs flex items-center justify-center">
                            {enfant ? `${enfant.prenom[0]}${enfant.nom[0]}` : '?'}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900">{enfant ? `${enfant.prenom} ${enfant.nom}` : 'Enfant Inconnu'}</p>
                            <p className="text-[10px] text-slate-400 font-bold">
                              {abs.statut === 'Absent justifié' ? (isArabic ? 'غياب مبرر 🟢' : 'Justifiée 🟢') : (isArabic ? 'غياب غير مبرر 🔴' : 'Non justifiée 🔴')}
                            </p>
                          </div>
                        </div>

                        {/* Motif d'absence */}
                        <div className="flex-1 max-w-md bg-slate-50/80 border border-slate-100 p-3 rounded-xl">
                          <p className="text-xs font-bold text-slate-700">
                            {abs.motifAbsence}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleParentNotification(abs)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            title={isArabic ? 'إعداد إشعار لولي الطفل' : 'Préparer une notification parent'}
                            aria-label={isArabic ? 'إعداد إشعار لولي الطفل' : 'Préparer une notification parent'}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { void handleDeleteAbsence(abs); }}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title={isArabic ? 'حذف تسجيل الغياب' : 'Supprimer l’absence'}
                            aria-label={isArabic ? 'حذف تسجيل الغياب' : 'Supprimer l’absence'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>

              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-xs">
              <HelpCircle className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="font-extrabold text-slate-900">{isArabic ? 'لا توجد غيابات مسجلة' : 'Aucune absence enregistrée'}</p>
              <p className="text-xs text-slate-400 mt-1">{isArabic ? 'تظهر الغيابات هنا عندما تقوم بتأشير الأطفال كغائبين.' : 'Les absences marquées apparaîtront ici triées par jour.'}</p>
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1 : SPÉCIFIER LES DÉTAILS DE L'ABSENCE */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showAbsenceModal && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[999] p-4 cursor-pointer"
            onClick={() => { if (!isSavingPointage) setShowAbsenceModal(false); }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-h-none sm:overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 bg-rose-600 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black">{isArabic ? 'تفاصيل عذر الغياب' : 'Enregistrer une Absence'}</h3>
                  <p className="text-xs text-rose-100 mt-0.5">{isArabic ? 'تحديد تبرير وسبب الغياب بدقة' : 'Préciser la justification et le motif de l\'absence'}</p>
                </div>
                <button 
                  onClick={() => { if (!isSavingPointage) setShowAbsenceModal(false); }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <div className="p-4 sm:p-6 space-y-4">
                
                {/* Type de justification */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isArabic ? 'حالة الغياب *' : 'Statut de l\'absence *'}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAbsenceForm({ ...absenceForm, statut: 'Absent justifié' })}
                      className={`p-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                        absenceForm.statut === 'Absent justifié'
                          ? 'bg-amber-600 text-white border-transparent'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isArabic ? 'مبرر' : 'Justifié'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbsenceForm({ ...absenceForm, statut: 'Absent non justifié' })}
                      className={`p-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                        absenceForm.statut === 'Absent non justifié'
                          ? 'bg-rose-600 text-white border-transparent'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isArabic ? 'غير مبرر' : 'Non justifié'}
                    </button>
                  </div>
                </div>

                {/* Motif de l'absence */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isArabic ? 'عذر أو سبب الغياب *' : 'Motif ou description *'}</label>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {(isArabic
                      ? ['وعكة صحية', 'موعد طبي', 'سفر عائلي', 'ظرف عائلي']
                      : ['Malade', 'Rendez-vous médical', 'Voyage', 'Empêchement familial']
                    ).map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setAbsenceForm({ ...absenceForm, motifAbsence: suggestion })}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                          absenceForm.motifAbsence === suggestion
                            ? 'border-rose-300 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={absenceForm.motifAbsence}
                    onChange={(e) => setAbsenceForm({ ...absenceForm, motifAbsence: e.target.value })}
                    placeholder={isArabic ? 'مثال: موعد طبي، وعكة صحية، سفر...' : 'Ex: Malade, voyage, urgence familiale...'}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-rose-500 font-semibold text-sm text-slate-800"
                  />
                </div>

              </div>

              {/* Actions Footer */}
              <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => { if (!isSavingPointage) setShowAbsenceModal(false); }}
                  className="w-full sm:flex-1 py-3 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold text-slate-700 transition cursor-pointer text-xs"
                >
                  {t('common.cancel')}
                </button>
                <button
                  disabled={isSavingPointage}
                  onClick={() => void submitAbsence()}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition cursor-pointer text-xs shadow-md shadow-rose-200"
                >
                  {isArabic ? 'تأشير كغائب' : 'Marquer absent'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL 2 : SPÉCIFIER LES DÉTAILS DU PASSAGE / SANTÉ (PRÉSENT) */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showPresenceDetailsModal && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[999] p-4 cursor-pointer"
            onClick={() => { if (!isSavingPointage) setShowPresenceDetailsModal(false); }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-h-none sm:overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 sm:p-6 bg-emerald-600 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black">{isArabic ? 'مؤشرات يوم الحضور' : 'Indicateurs de Présence'}</h3>
                  <p className="text-xs text-emerald-100 mt-0.5">{isArabic ? 'مراقبة المعايير الصحية والمزاج والأكل' : 'Saisir les observations santé, repas et humeur'}</p>
                </div>
                <button 
                  onClick={() => { if (!isSavingPointage) setShowPresenceDetailsModal(false); }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <div className="p-4 sm:p-6 space-y-4">
                
                {/* Heures Arrivée & Départ — placées en premier pour un pointage mobile en 1 geste */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase">{isArabic ? 'وقت الدخول *' : 'Heure d\'arrivée *'}</label>
                      <button
                        type="button"
                        onClick={() => setPresenceDetailsForm({ ...presenceDetailsForm, heureArrivee: getNowHHMM() })}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-black text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <Clock className="w-3 h-3" />
                        {isArabic ? 'الآن' : 'Maintenant'}
                      </button>
                    </div>
                    <input
                      type="time"
                      value={presenceDetailsForm.heureArrivee}
                      onChange={(e) => setPresenceDetailsForm({ ...presenceDetailsForm, heureArrivee: e.target.value })}
                      placeholder="08:30"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-semibold text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase">{isArabic ? 'وقت الانصراف (اختياري)' : 'Heure de départ (facultatif)'}</label>
                      <button
                        type="button"
                        onClick={() => setPresenceDetailsForm({ ...presenceDetailsForm, heureDepart: getNowHHMM() })}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                      >
                        {isArabic ? 'الآن' : 'Maintenant'}
                      </button>
                    </div>
                    <input
                      type="time"
                      value={presenceDetailsForm.heureDepart}
                      onChange={(e) => setPresenceDetailsForm({ ...presenceDetailsForm, heureDepart: e.target.value })}
                      placeholder="16:30"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-semibold text-sm text-slate-800"
                    />
                  </div>
                </div>

                {/* Accompagnateur lors du départ (affiché si heureDepart saisie) */}
                {presenceDetailsForm.heureDepart && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      {isArabic ? 'الشخص المستلم (اختياري)' : 'Récupéré par (facultatif)'}
                    </label>
                    <input
                      type="text"
                      value={personneRecuperationInput}
                      onChange={(e) => setPersonneRecuperationInput(e.target.value)}
                      placeholder={isArabic ? 'مثال: الأب، الأم، الجد...' : 'Ex : Papa, Maman, Grand-mère...'}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold text-sm text-slate-800"
                    />
                  </div>
                )}

                {/* Température */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isArabic ? 'درجة الحرارة (°C) (اختياري)' : 'Température (°C) (facultatif)'}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={presenceDetailsForm.temperature}
                    onChange={(e) => setPresenceDetailsForm({ ...presenceDetailsForm, temperature: e.target.value })}
                    placeholder="36.5"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-black text-sm text-slate-800"
                  />
                </div>

                {/* Repas & Humeur */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isArabic ? 'الوجبة' : 'Repas mangé'}</label>
                    <select
                      value={presenceDetailsForm.repas}
                      onChange={(e) => setPresenceDetailsForm({ ...presenceDetailsForm, repas: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-semibold text-sm text-slate-800"
                    >
                      <option value="">{isArabic ? 'غير مسجل' : 'Non renseigné'}</option>
                      <option value="Tout">{isArabic ? 'أكل الكل' : 'Tout mangé'}</option>
                      <option value="Moyen">{isArabic ? 'متوسط' : 'Moyen'}</option>
                      <option value="Peu">{isArabic ? 'قليل' : 'Peu'}</option>
                      <option value="Non">{isArabic ? 'لم يأكل' : "N'a pas mangé"}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isArabic ? 'المزاج اليومي' : 'Humeur globale'}</label>
                    <select
                      value={presenceDetailsForm.humeur}
                      onChange={(e) => setPresenceDetailsForm({ ...presenceDetailsForm, humeur: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-semibold text-sm text-slate-800"
                    >
                      <option value="">{isArabic ? 'غير مسجل' : 'Non renseigné'}</option>
                      <option value="Souriant">{isArabic ? 'مبتسم' : 'Souriant'}</option>
                      <option value="Calme">{isArabic ? 'هادئ' : 'Calme'}</option>
                      <option value="Agité">{isArabic ? 'مضطرب' : 'Agité'}</option>
                      <option value="Fatigué">{isArabic ? 'متعب' : 'Fatigué'}</option>
                    </select>
                  </div>
                </div>

              </div>

              {/* Actions Footer */}
              <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => { if (!isSavingPointage) setShowPresenceDetailsModal(false); }}
                  className="w-full sm:flex-1 py-3 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold text-slate-700 transition cursor-pointer text-xs"
                >
                  {t('common.cancel')}
                </button>
                <button
                  disabled={isSavingPointage}
                  onClick={() => void submitPresenceDetails()}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition cursor-pointer text-xs shadow-md"
                >
                  {isArabic ? 'تأشير كحاضر' : 'Marquer présent'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {parentNotificationPreview && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setParentNotificationPreview(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="parent-notification-title"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{isArabic ? 'معاينة قبل واتساب' : 'Aperçu avant WhatsApp'}</p>
                <h2 id="parent-notification-title" className="mt-1 text-lg font-black text-slate-900">{isArabic ? `رسالة إلى ${parentNotificationPreview.childName}` : `Notification pour ${parentNotificationPreview.childName}`}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{parentNotificationPreview.phone}</p>
              </div>
              <button type="button" onClick={() => setParentNotificationPreview(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label={isArabic ? 'إغلاق' : 'Fermer'}>×</button>
            </div>
            <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{parentNotificationPreview.message}</p>
            <p className="mt-3 text-xs font-semibold text-slate-500">{isArabic ? 'لن يتم إرسال أي رسالة قبل الضغط على زر واتساب.' : 'Aucun message n’est envoyé avant votre clic sur WhatsApp.'}</p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setParentNotificationPreview(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">{isArabic ? 'إلغاء' : 'Annuler'}</button>
              <a href={`https://wa.me/${parentNotificationPreview.phone}?text=${encodeURIComponent(parentNotificationPreview.message)}`} target="_blank" rel="noopener noreferrer" onClick={() => setParentNotificationPreview(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700"><Send className="h-4 w-4" />{isArabic ? 'فتح واتساب' : 'Ouvrir WhatsApp'}</a>
            </div>
          </div>
        </div>
      )}

      {dailyReportChild && (
        <ParentDailyReportModal
          enfant={dailyReportChild}
          date={selectedDate}
          presence={todayPresenceByChild.get(dailyReportChild.id) || null}
          repasList={repasData}
          activitesList={activitesData}
          creche={creche}
          isArabic={isArabic}
          onClose={() => setDailyReportChild(null)}
        />
      )}

    </div>
  );
}
