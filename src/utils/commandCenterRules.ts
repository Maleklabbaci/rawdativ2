import type { Classe, Enfant, Paiement, Personnel, Presence } from '../types';

export type CommandCenterLocale = 'fr' | 'ar';
export type CommandCenterAlertLevel = 'urgent' | 'check' | 'info';

export interface CommandCenterAlert {
  id: string;
  level: CommandCenterAlertLevel;
  title: string;
  message: string;
  targetPage: string;
  count?: number;
}

export interface CommandCenterRulesInput {
  enfants: ReadonlyArray<Enfant>;
  presences: ReadonlyArray<Presence>;
  paiements: ReadonlyArray<Paiement>;
  personnel: ReadonlyArray<Personnel>;
  classes: ReadonlyArray<Classe & { childrenIds?: string[] }>;
  now: Date;
  locale?: CommandCenterLocale;
  maxAlerts?: number;
}

const levelPriority: Record<CommandCenterAlertLevel, number> = {
  urgent: 0,
  check: 1,
  info: 2,
};

function safeDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function paymentReferenceDate(payment: Paiement): Date | null {
  const candidate = payment as Paiement & {
    dateCreation?: string;
    createdAt?: string;
  };
  return safeDate(payment.dateEcheance || candidate.dateCreation || candidate.createdAt);
}

function daysPastDue(payment: Paiement, now: Date): number {
  const dueDate = paymentReferenceDate(payment);
  if (!dueDate) return 0;
  const elapsed = startOfDay(now).getTime() - startOfDay(dueDate).getTime();
  return Math.floor(elapsed / 86_400_000);
}

function buildPaymentAlerts(
  paiements: ReadonlyArray<Paiement>,
  now: Date,
  locale: CommandCenterLocale,
): CommandCenterAlert[] {
  const latePayments = paiements.filter(payment => payment.statut === 'Retard');
  const waitingOverFiveDays = paiements.filter(
    payment => payment.statut === 'En attente' && daysPastDue(payment, now) > 5,
  );
  const alerts: CommandCenterAlert[] = [];

  if (latePayments.length > 0) {
    alerts.push({
      id: 'payments-overdue',
      level: 'urgent',
      title: locale === 'ar' ? 'مدفوعات متأخرة' : 'Paiements en retard',
      message: locale === 'ar'
        ? `يوجد ${latePayments.length} من المدفوعات المتأخرة التي تحتاج إلى متابعة.`
        : `${latePayments.length} règlement${latePayments.length > 1 ? 's' : ''} nécessite${latePayments.length > 1 ? 'nt' : ''} une relance.`,
      targetPage: 'paiements',
      count: latePayments.length,
    });
  }

  if (waitingOverFiveDays.length > 0) {
    alerts.push({
      id: 'payments-waiting-over-five-days',
      level: 'check',
      title: locale === 'ar' ? 'مدفوعات تحتاج إلى التحقق' : 'Paiements à vérifier',
      message: locale === 'ar'
        ? `هناك ${waitingOverFiveDays.length} من المدفوعات قيد الانتظار منذ أكثر من 5 أيام.`
        : `${waitingOverFiveDays.length} paiement${waitingOverFiveDays.length > 1 ? 's' : ''} est${waitingOverFiveDays.length > 1 ? 'ent' : ''} en attente depuis plus de 5 jours.`,
      targetPage: 'paiements',
      count: waitingOverFiveDays.length,
    });
  }

  return alerts;
}

function buildDocumentAlert(enfants: ReadonlyArray<Enfant>, locale: CommandCenterLocale): CommandCenterAlert | null {
  const activeChildren = enfants.filter(enfant => enfant.statut === 'Actif');
  const incompleteChildren = activeChildren.filter(enfant => {
    const documents = enfant.documentsRequis;
    return !documents || !documents.certificatMedical || !documents.carnetVaccination || !documents.justificatifDomicile || !documents.photoIdentite;
  });

  if (incompleteChildren.length === 0) return null;

  return {
    id: 'children-missing-documents',
    level: 'check',
    title: locale === 'ar' ? 'ملفات الأطفال غير مكتملة' : 'Dossiers à compléter',
    message: locale === 'ar'
      ? `هناك ${incompleteChildren.length} من ملفات الأطفال تحتوي على وثيقة ناقصة على الأقل.`
      : `${incompleteChildren.length} dossier${incompleteChildren.length > 1 ? 's' : ''} enfant${incompleteChildren.length > 1 ? 's' : ''} comporte${incompleteChildren.length > 1 ? 'nt' : ''} une pièce manquante.`,
    targetPage: 'enfants',
    count: incompleteChildren.length,
  };
}

function buildAttendanceAlert(
  enfants: ReadonlyArray<Enfant>,
  presences: ReadonlyArray<Presence>,
  now: Date,
  locale: CommandCenterLocale,
): CommandCenterAlert | null {
  const activeChildren = enfants.filter(enfant => enfant.statut === 'Actif');
  if (activeChildren.length === 0) return null;

  const today = dateKey(now);
  const recordedToday = new Set(
    presences.filter(presence => presence.date === today).map(presence => presence.enfantId),
  );
  const missingAttendance = activeChildren.filter(enfant => !recordedToday.has(enfant.id));

  if (missingAttendance.length === 0) return null;

  return {
    id: 'attendance-not-recorded-today',
    level: 'info',
    title: locale === 'ar' ? 'استكمال تسجيل الحضور' : 'Pointage à compléter',
    message: locale === 'ar'
      ? `لم يُسجَّل حضور ${missingAttendance.length} من الأطفال اليوم.`
      : `${missingAttendance.length} enfant${missingAttendance.length > 1 ? 's' : ''} n'a${missingAttendance.length > 1 ? 'nt' : ''} pas encore de présence enregistrée aujourd'hui.`,
    targetPage: 'presences',
    count: missingAttendance.length,
  };
}

function buildCapacityAlerts(
  classes: ReadonlyArray<Classe & { childrenIds?: string[] }>,
  locale: CommandCenterLocale,
): CommandCenterAlert[] {
  const overflowingClasses = classes.filter(classe => {
    const capacity = Number(classe.capacite);
    const enrolled = Array.isArray(classe.childrenIds) ? classe.childrenIds.length : 0;
    return Number.isFinite(capacity) && capacity > 0 && enrolled > capacity;
  });

  return overflowingClasses.map(classe => {
    const capacity = Number(classe.capacite);
    const enrolled = Array.isArray(classe.childrenIds) ? classe.childrenIds.length : 0;
    return {
      id: `class-over-capacity-${classe.id}`,
      level: 'urgent',
      title: locale === 'ar' ? `تجاوز سعة القسم: ${classe.nom}` : `Capacité dépassée : ${classe.nom}`,
      message: locale === 'ar'
        ? `يوجد ${enrolled} من الأطفال في القسم مقابل ${capacity} مقعد${capacity > 1 ? 'اً' : ''}.`
        : `${enrolled} enfants pour ${capacity} place${capacity > 1 ? 's' : ''}.`,
      targetPage: 'classes',
      count: enrolled - capacity,
    };
  });
}

export function buildCommandCenterAlerts({
  enfants,
  presences,
  paiements,
  personnel,
  classes,
  now,
  locale = 'fr',
  maxAlerts = 6,
}: CommandCenterRulesInput): CommandCenterAlert[] {
  const alerts: CommandCenterAlert[] = [
    ...buildPaymentAlerts(paiements, now, locale),
    ...buildCapacityAlerts(classes, locale),
  ];

  const documentAlert = buildDocumentAlert(enfants, locale);
  if (documentAlert) alerts.push(documentAlert);

  const attendanceAlert = buildAttendanceAlert(enfants, presences, now, locale);
  if (attendanceAlert) alerts.push(attendanceAlert);

  const inactiveStaff = personnel.filter(member => member.statut === 'Inactif');
  if (inactiveStaff.length > 0) {
    alerts.push({
      id: 'inactive-personnel',
      level: 'check',
      title: locale === 'ar' ? 'التحقق من أعضاء الفريق' : 'Personnel à vérifier',
      message: locale === 'ar'
        ? `يوجد ${inactiveStaff.length} من أعضاء الفريق مميزون كغير نشطين.`
        : `${inactiveStaff.length} membre${inactiveStaff.length > 1 ? 's' : ''} du personnel est${inactiveStaff.length > 1 ? 'ent' : ''} marqué${inactiveStaff.length > 1 ? 's' : ''} inactif${inactiveStaff.length > 1 ? 's' : ''}.`,
      targetPage: 'personnel',
      count: inactiveStaff.length,
    });
  }

  if (classes.length === 0) {
    alerts.push({
      id: 'no-classes-configured',
      level: 'info',
      title: locale === 'ar' ? 'لا توجد أقسام مهيأة' : 'Aucune classe configurée',
      message: locale === 'ar'
        ? 'أضيفوا أول قسم لمتابعة السعة وتنظيم الأطفال حسب الفئة العمرية.'
        : 'Créez votre première classe pour suivre les capacités et les groupes.',
      targetPage: 'classes',
    });
  }

  return Array.from(new Map(alerts.map(alert => [alert.id, alert])).values())
    .sort((first, second) => levelPriority[first.level] - levelPriority[second.level])
    .slice(0, Math.max(1, maxAlerts));
}
