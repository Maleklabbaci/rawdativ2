import type { Enfant, Paiement } from '../types';
import { publishParentAnnouncement } from './parentPortal';

export function paymentChangeMessage(previous: Paiement | null, next: Paiement, isArabic: boolean): string | null {
  if (previous && (previous.id !== next.id || previous.enfantId !== next.enfantId || previous.statut === next.statut)) return null;
  if (next.statut === 'Payé') return isArabic ? 'تم تسجيل الدفع. افتحوا التطبيق للتحقق من التفاصيل.' : 'Paiement enregistré. Ouvrez l’application pour vérifier les détails.';
  if (!previous && next.statut === 'En attente') return isArabic ? 'تم تسجيل فاتورة جديدة. افتحوا التطبيق للتحقق من التفاصيل.' : 'Une nouvelle facture est enregistrée. Ouvrez l’application pour vérifier les détails.';
  if (next.statut === 'Retard' && previous?.statut !== 'Retard') return isArabic ? 'تم تحديث حالة الفاتورة. افتحوا التطبيق للتحقق من التفاصيل.' : 'Le statut d’une facture a changé. Ouvrez l’application pour vérifier les détails.';
  return null;
}

/** Best effort after confirmed persistence; never retry an uncertain push. */
export async function dispatchAutomaticPaymentPush(params: { crecheId: string; crecheNom: string; enfant: Enfant; previous: Paiement | null; next: Paiement; isArabic: boolean }) {
  if (!params.crecheId || params.enfant.crecheId !== params.crecheId || params.enfant.id !== params.next.enfantId) return null;
  const message = paymentChangeMessage(params.previous, params.next, params.isArabic);
  if (!message) return null;
  return publishParentAnnouncement({ crecheId: params.crecheId, crecheNom: params.crecheNom, title: params.isArabic ? 'تحديث الدفع' : 'Actualité paiement', message, category: 'info', targetScope: 'child', targetEnfantId: params.enfant.id, enfants: [params.enfant] });
}
