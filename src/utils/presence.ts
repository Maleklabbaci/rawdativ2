import type { Presence } from '../types';

export type PresenceDetails = Pick<Presence, 'heureArrivee' | 'heureDepart' | 'temperature' | 'repas' | 'humeur'>;

/** A blank field means that no observation was recorded, not a normal result. */
export function presenceFormValues(presence?: Presence): Required<PresenceDetails> {
  return {
    heureArrivee: presence?.heureArrivee || '',
    heureDepart: presence?.heureDepart || '',
    temperature: presence?.temperature || '',
    repas: presence?.repas || '',
    humeur: presence?.humeur || '',
  };
}

export function validatePresenceDetails(details: Required<PresenceDetails>): 'arrival' | 'departure' | 'temperature' | null {
  if (!details.heureArrivee) return 'arrival';
  if (details.heureDepart && details.heureDepart <= details.heureArrivee) return 'departure';
  if (details.temperature.trim()) {
    const value = Number(details.temperature.trim().replace(',', '.'));
    if (!Number.isFinite(value) || value < 30 || value > 45) return 'temperature';
  }
  return null;
}
