export type SetupPage = 'enfants' | 'classes' | 'personnel';
const key = (userId: string, page: SetupPage) => `rawdha:setup-task:${userId}:${page}`;
export function prepareSetupTask(userId: string, page: SetupPage) {
  try { window.sessionStorage.setItem(key(userId, page), '1'); } catch { /* the user can open the action manually */ }
}
export function takeSetupTask(userId: string | undefined, page: SetupPage): boolean {
  if (!userId || typeof window === 'undefined') return false;
  try { const k = key(userId, page); const yes = window.sessionStorage.getItem(k) === '1'; window.sessionStorage.removeItem(k); return yes; }
  catch { return false; }
}
