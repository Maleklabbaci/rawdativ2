import type { Classe, Enfant, Presence } from '../types';

type AttendanceClass = Classe & { childrenIds?: string[] };

/** Keep archived children visible on dates where they already have a record. */
export function attendanceChildren(enfants: Enfant[], records: Presence[]): Enfant[] {
  const recordedIds = new Set(records.map(record => record.enfantId));
  return enfants.filter(child => child.statut === 'Actif' || recordedIds.has(child.id));
}

/** Assignments are read from the existing class records, not a second copy. */
export function groupAttendanceChildren(enfants: Enfant[], classes: AttendanceClass[]) {
  const classGroups = classes.map(classe => ({
    key: `class:${classe.id}`,
    nom: classe.nom,
    niveau: classe.niveau as string,
    children: enfants.filter(child => Array.isArray(classe.childrenIds) && classe.childrenIds.includes(child.id)),
    unassigned: false,
  }));
  const assigned = new Set(classGroups.flatMap(group => group.children.map(child => child.id)));
  const unassigned = enfants.filter(child => !assigned.has(child.id));
  return unassigned.length
    ? [...classGroups, { key: 'unassigned', nom: '', niveau: '', children: unassigned, unassigned: true }]
    : classGroups;
}
