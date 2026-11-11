import type { Parent } from '../types';

/** The editor changes the first parent; it must preserve the remaining contacts. */
export function updatePrimaryParent(parents: Parent[], primary: Parent): Parent[] {
  return [primary, ...parents.slice(1)];
}
