const prefetched = new Set<string>();

const ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  dashboard: () => import('../components/Dashboard'),
  enfants: () => import('../components/Enfants'),
  admissions: () => import('../components/Admissions'),
  community: () => import('../components/Community'),
  classes: () => import('../components/Classes'),
  presences: () => import('../components/Presences'),
  paiements: () => import('../components/Paiements'),
  achats: () => import('../components/Achats'),
  personnel: () => import('../components/Personnel'),
  activites: () => import('../components/Activites'),
  repas: () => import('../components/Repas'),
  admin: () => import('../components/AdminCenter'),
  comptes: () => import('../components/Comptes'),
  notifications: () => import('../components/NotificationsDirecteur'),
  communication: () => import('../components/Communication'),
  demarrage: () => import('../components/Demarrage'),
  aide: () => import('../components/Aide'),
  support: () => import('../components/Support'),
  rapports: () => import('../components/Rapports'),
  parametres: () => import('../components/Parametres'),
  abonnement: () => import('../components/AbonnementPaiement'),
};

export function prefetchRouteChunk(page: string): void {
  if (prefetched.has(page)) return;
  const loader = ROUTE_LOADERS[page];
  if (!loader) return;
  prefetched.add(page);
  void loader().catch(() => {
    prefetched.delete(page);
  });
}

export function prefetchCoreRoutesOnIdle(role?: string): void {
  if (typeof window === 'undefined') return;
  const pages =
    role === 'admin'
      ? ['admin', 'comptes', 'communication', 'notifications']
      : ['dashboard', 'presences', 'enfants', 'paiements'];

  const run = () => {
    for (const page of pages) {
      prefetchRouteChunk(page);
    }
  };

  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  if (typeof ric === 'function') {
    ric(run, { timeout: 1500 });
  } else {
    window.setTimeout(run, 600);
  }
}
