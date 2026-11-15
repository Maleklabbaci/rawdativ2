/** Préférence d'affichage locale à cet appareil, sans modifier les données de la crèche. */
export const TEXT_SIZE_KEY = 'rawdha:text-size';
export const TEXT_SIZE_MIN = 85;
export const TEXT_SIZE_MAX = 125;
export const TEXT_SIZE_STEP = 5;
export const TEXT_SIZE_DEFAULT = 100;

export function normalizeTextSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < TEXT_SIZE_MIN || parsed > TEXT_SIZE_MAX) return TEXT_SIZE_DEFAULT;
  return Math.round(parsed / TEXT_SIZE_STEP) * TEXT_SIZE_STEP;
}

export function readTextSize(): number {
  try {
    const value = localStorage.getItem(TEXT_SIZE_KEY);
    return value === null ? TEXT_SIZE_DEFAULT : normalizeTextSize(value);
  } catch {
    return TEXT_SIZE_DEFAULT;
  }
}

export function applyTextSize(value: number): number {
  const size = normalizeTextSize(value);
  document.documentElement.style.fontSize = size === TEXT_SIZE_DEFAULT ? '' : `${size}%`;
  return size;
}

export function saveTextSize(value: number): number {
  const size = applyTextSize(value);
  try { localStorage.setItem(TEXT_SIZE_KEY, String(size)); } catch { /* Affichage actif pour cette session. */ }
  return size;
}
