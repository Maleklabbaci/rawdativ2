import type { Repas } from '../types';

const weekdays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/** A dated menu applies only on its date; weekly menus have an explicit day. */
export function mealAppliesOnDate(meal: Pick<Repas, 'date' | 'jour'>, date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  if (meal.date) return meal.date === date;
  return Boolean(meal.jour && meal.jour === weekdays[parsed.getUTCDay()]);
}

/** Empty, null and whitespace are unknown, not an assertion of absence. */
export function documentedText(value?: string | null): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
