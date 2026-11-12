/** Parse a personal invitation without sending it to a third party. */
export function parseParentInviteLink(value: string, origin: string): string | null {
  try {
    const url = new URL(value.trim());
    const token = new URLSearchParams(url.hash.slice(1)).get('enfant');
    if (url.origin !== origin || url.pathname.replace(/\/+$/, '') !== '/espace-parent' || !url.searchParams.get('creche')?.trim() || !token || !/^[0-9a-f]{64}$/.test(token)) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}
