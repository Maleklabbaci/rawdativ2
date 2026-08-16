import type { Classe, Enfant, Paiement, Personnel, Presence } from '../types';

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

function buildPaymentAlerts(paiements: ReadonlyArray<Paiement>, now: Date): CommandCenterAlert[] {
  const latePayments = paiements.filter(payment => payment.statut === 'Retard');
  const waitingOverFiveDays = paiements.filter(
    payment => payment.statut === 'En attente' && daysPastDue(payment, now) > 5,
  );
  const alerts: CommandCenterAlert[] = [];

  if (latePayments.length > 0) {
    alerts.push({
      id: 'payments-overdue',
      level: 'urgent',
      title: 'Paiements en retard',
      message: `${latePayments.length} règlement${latePayments.length > 1 ? 's' : ''} nécessite${latePayments.length > 1 ? 'nt' : ''} une relance.`,
      targetPage: 'paiements',
      count: latePayments.length,
    });
  }

  if (waitingOverFiveDays.length > 0) {
    alerts.push({
      id: 'payments-waiting-over-five-days',
      level: 'check',
      title: 'Paiements à vérifier',
      message: `${waitingOverFiveDays.length} paiement${waitingOverFiveDays.length > 1 ? 's' : ''} est${waitingOverFiveDays.length > 1 ? 'ent' : ''} en attente depuis plus de 5 jours.`,
      targetPage: 'paiements',
      count: waitingOverFiveDays.length,
    });
  }

  return alerts;
}

function buildDocumentAlert(enfants: ReadonlyArray<Enfant>): CommandCenterAlert | null {
  const activeChildren = enfants.filter(enfant => enfant.statut === 'Actif');
  const incompleteChildren = activeChildren.filter(enfant => {
    const documents = enfant.documentsRequis;
    return !documents || !documents.certificatMedical || !documents.carnetVaccination || !documents.justificatifDomicile || !documents.photoIdentite;
  });

  if (incompleteChildren.length === 0) return null;

  return {
    id: 'children-missing-documents',
    level: 'check',
    title: 'Dossiers à compléter',
    message: `${incompleteChildren.length} dossier${incompleteChildren.length > 1 ? 's' : ''} enfant${incompleteChildren.length > 1 ? 's' : ''} comporte${incompleteChildren.length > 1 ? 'nt' : ''} une pièce manquante.`,
    targetPage: 'enfants',
    count: incompleteChildren.length,
  };
}

function buildAttendanceAlert(
  enfants: ReadonlyArray<Enfant>,
  presences: ReadonlyArray<Presence>,
  now: Date,
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
    title: 'Pointage à compléter',
    message: `${missingAttendance.length} enfant${missingAttendance.length > 1 ? 's' : ''} n'a${missingAttendance.length > 1 ? 'nt' : ''} pas encore de présence enregistrée aujourd'hui.`,
    targetPage: 'presences',
    count: missingAttendance.length,
  };
}

function buildCapacityAlerts(classes: ReadonlyArray<Classe & { childrenIds?: string[] }>): CommandCenterAlert[] {
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
      title: `Capacité dépassée : ${classe.nom}`,
      message: `${enrolled} enfants pour ${capacity} place${capacity > 1 ? 's' : ''}.`,
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
  maxAlerts = 6,
}: CommandCenterRulesInput): CommandCenterAlert[] {
  const alerts: CommandCenterAlert[] = [
    ...buildPaymentAlerts(paiements, now),
    ...buildCapacityAlerts(classes),
  ];

  const documentAlert = buildDocumentAlert(enfants);
  if (documentAlert) alerts.push(documentAlert);

  const attendanceAlert = buildAttendanceAlert(enfants, presences, now);
  if (attendanceAlert) alerts.push(attendanceAlert);

  const inactiveStaff = personnel.filter(member => member.statut === 'Inactif');
  if (inactiveStaff.length > 0) {
    alerts.push({
      id: 'inactive-personnel',
      level: 'check',
      title: 'Personnel à vérifier',
      message: `${inactiveStaff.length} membre${inactiveStaff.length > 1 ? 's' : ''} du personnel est${inactiveStaff.length > 1 ? 'ent' : ''} marqué${inactiveStaff.length > 1 ? 's' : ''} inactif${inactiveStaff.length > 1 ? 's' : ''}.`,
      targetPage: 'personnel',
      count: inactiveStaff.length,
    });
  }

  if (classes.length === 0) {
    alerts.push({
      id: 'no-classes-configured',
      level: 'info',
      title: 'Aucune classe configurée',
      message: 'Créez votre première classe pour suivre les capacités et les groupes.',
      targetPage: 'classes',
    });
  }

  return Array.from(new Map(alerts.map(alert => [alert.id, alert])).values())
    .sort((first, second) => levelPriority[first.level] - levelPriority[second.level])
    .slice(0, Math.max(1, maxAlerts));
}
