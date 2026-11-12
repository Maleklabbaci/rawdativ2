export type CommunityView = 'feed' | 'profile' | 'reposts' | 'saved' | 'notifications' | 'messages' | 'discover';
export type CommunityNavigation = { view: CommunityView; profileId: string | null; recipientId: string | null };
const allowedViews: CommunityView[] = ['feed', 'profile', 'reposts', 'saved', 'notifications', 'messages', 'discover'];
const defaultNavigation: CommunityNavigation = { view: 'feed', profileId: null, recipientId: null };
const keyFor = (userId: string) => `rawdha_connect_navigation:${userId}`;

export function loadCommunityNavigation(userId: string | undefined, storage?: Pick<Storage, 'getItem'>): CommunityNavigation {
  if (!userId || !storage) return { ...defaultNavigation };
  try {
    const value = JSON.parse(storage.getItem(keyFor(userId)) || 'null');
    if (!value || !allowedViews.includes(value.view)) return { ...defaultNavigation };
    const safeId = (id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 128 ? id : null;
    const profileId = safeId(value.profileId);
    const recipientId = safeId(value.recipientId);
    return { view: value.view === 'profile' && !profileId ? 'feed' : value.view, profileId, recipientId };
  } catch { return { ...defaultNavigation }; }
}

export function saveCommunityNavigation(userId: string | undefined, value: CommunityNavigation, storage?: Pick<Storage, 'setItem'>): void {
  if (!userId || !storage) return;
  try { storage.setItem(keyFor(userId), JSON.stringify(value)); } catch { /* Navigation still works without storage. */ }
}
