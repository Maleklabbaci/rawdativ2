import type { Enfant, Presence } from '../types';

export type PickupContact = { id: string; name: string; detail: string; kind: 'parent' | 'emergency' };

/** These are contacts to check, not a list of automatically authorized people. */
export function pickupContacts(child: Enfant): PickupContact[] {
  return [
    ...child.parents.map(parent => ({ id: `parent-${parent.id}`, name: `${parent.prenom} ${parent.nom}`.trim(), detail: parent.lien, kind: 'parent' as const })),
    ...child.contactsUrgence.map(contact => ({ id: `contact-${contact.id}`, name: contact.nom.trim(), detail: contact.lien, kind: 'emergency' as const })),
  ].filter(person => person.name);
}

/** Only an explicit manual attestation saved with the attendance counts as confirmed. */
export function departureConfirmed(presence?: Presence): boolean {
  return Boolean(presence?.statut === 'Présent' && departureTimeValid(presence.heureArrivee, presence.heureDepart) && presence.personneRecuperation?.trim() && presence.departVerifie === true && presence.departVerifiePar && presence.departVerifieLe);
}

export function departureTimeValid(arrival?: string, departure?: string): boolean {
  const validTime = (time: string | undefined): time is string => !!time && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
  return validTime(arrival) && validTime(departure) && departure > arrival;
}

/** A change to the presence status or either time requires a new verification. */
export function departureNeedsRecheck(existing: Presence | undefined, arrival: string, departure: string): boolean {
  return !!existing && (existing.statut !== 'Présent' || (existing.heureArrivee || '') !== arrival || (existing.heureDepart || '') !== departure);
}
