import type { Activite } from '../types';

/** An activity is a plan, not evidence that a child participated. */
export function plannedActivityMessage(activity: Activite, crecheId: string, today: string, isArabic: boolean): string | null {
  if (activity.crecheId !== crecheId || !['Bébés', 'Moyens', 'Grands'].includes(activity.groupe) || !activity.titre?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(activity.date)) return null;
  const date = new Date(`${activity.date}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== activity.date || activity.date < today) return null;
  return isArabic ? `نشاط مبرمج: ${activity.titre.trim()} — ${activity.date}.` : `Activité prévue : ${activity.titre.trim()} — ${activity.date}.`;
}
