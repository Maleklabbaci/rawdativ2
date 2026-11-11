import type { Classe, Enfant } from '../types';

/** UI safeguard only: concurrent assignments also need a server-side constraint. */
export function checkClassAssignment(classe: Classe, classes: Classe[], enfants: Enfant[], selectedIds: string[]): 'invalid' | 'assigned' | 'capacity' | null {
  const existing = new Set(classe.childrenIds || []);
  const selected = new Set(selectedIds);
  const children = new Map(enfants.map(child => [child.id, child]));
  if (!selected.size || [...selected].some(id => !children.has(id) || children.get(id)?.statut !== 'Actif' || existing.has(id))) return 'invalid';
  if (classes.some(other => other.id !== classe.id && (other.childrenIds || []).some(id => selected.has(id)))) return 'assigned';
  if (!Number.isFinite(classe.capacite) || existing.size + selected.size > classe.capacite) return 'capacity';
  return null;
}
