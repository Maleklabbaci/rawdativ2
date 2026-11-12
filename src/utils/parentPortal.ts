import { secureParentDeviceToken } from './parentDeviceToken';
import { requireConfirmedParentWrite } from './parentWriteConfirmation';
import { confirmParentPushRegistration } from './parentPushRegistration';
import type { Activite, Enfant, Paiement, Presence, Repas } from '../types';
import { mealAppliesOnDate } from './mealSafety';

async function getSupabaseClient() {
  const mod = await import('../supabase');
  return mod.supabase;
}

export interface ParentRequestedChild {
  prenom: string;
  nom: string;
  dateNaissance?: string;
  groupeAge?: 'Bébés' | 'Moyens' | 'Grands' | '';
}

export interface ParentChildSnapshot {
  id: string;
  prenom: string;
  nom: string;
  groupeAge: 'Bébés' | 'Moyens' | 'Grands';
  dateNaissance?: string;
  presenceToday?: {
    statut: string;
    heureArrivee?: string;
    heureDepart?: string;
    humeur?: string;
    repas?: string;
  } | null;
  todayMeals: Array<{ id: string; type: string; menu: string }>;
  todayActivities: Array<{ id: string; titre: string; heureDebut?: string; heureFin?: string; groupe: string }>;
  invoices: Array<{ id: string; moisConcerne: string; montant: number; statut: string }>;
}

export interface ParentLinkRequest {
  id: string;
  crecheId: string;
  crecheNom: string;
  deviceToken?: string;
  parentPrenom: string;
  parentNom: string;
  parentTelephone: string;
  parentLien: 'Mère' | 'Père' | 'Tuteur' | 'Parent';
  requestedChildren: ParentRequestedChild[];
  requestedChildId?: string;
  linkedEnfantIds: string[];
  linkedSnapshots?: ParentChildSnapshot[];
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  pushEnabled: boolean;
  pushSubscription?: Record<string, unknown> | null;
  homeScreenInstalled: boolean;
  platformHint?: 'ios' | 'android' | 'desktop';
  createdAt: string;
  updatedAt: string;
}

export interface ParentAnnouncement {
  id: string;
  crecheId: string;
  title: string;
  message: string;
  category: 'fermeture' | 'evenement' | 'rappel' | 'sante' | 'info';
  targetScope: 'all' | 'group' | 'child';
  targetGroup?: 'Bébés' | 'Moyens' | 'Grands';
  targetEnfantId?: string;
  senderName: string;
  sentPushCount: number;
  createdAt: string;
}

const REQUESTS_STORAGE_KEY = 'rawdha_parent_link_requests_v1';
const ANNOUNCEMENTS_STORAGE_KEY = 'rawdha_parent_announcements_v1';
const REMEMBERED_CRECHE_KEY = 'rawdha_parent_last_creche_v1';
const BROADCAST_CHANNEL_NAME = 'rawdha_parent_portal_sync_v1';
export const PARENT_PORTAL_UPDATED_EVENT = 'rawdha-parent-portal-updated';

function readEnv(): Record<string, string | undefined> {
  return (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
}

export function hasLiveSupabaseParentPortal(): boolean {
  const env = readEnv();
  const url = (env.VITE_SUPABASE_URL || '').trim();
  const key = (env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return false;
  if (url.includes('preview.invalid') || key === 'preview-anon-key') return false;
  if (env.VITE_ARENA_DEMO === 'true') return false;
  if ((globalThis as { __rawdatiSupabaseClient__?: unknown }).__rawdatiSupabaseClient__) return false;
  return true;
}

export function detectMobilePlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isRunningStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window.navigator as { standalone?: boolean }).standalone === true) return true;
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
}

export function getOrCreateParentDeviceToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return secureParentDeviceToken(window.localStorage, globalThis.crypto);
  } catch {
    return '';
  }
}

export function rememberParentCreche(crecheId: string, crecheNom = ''): void {
  if (typeof window === 'undefined' || !crecheId.trim()) return;
  try {
    localStorage.setItem(
      REMEMBERED_CRECHE_KEY,
      JSON.stringify({ crecheId: crecheId.trim(), crecheNom: crecheNom.trim() }),
    );
  } catch {
    // ignore storage quota errors
  }
}

export function getRememberedParentCreche(): { crecheId: string; crecheNom: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(REMEMBERED_CRECHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { crecheId?: string; crecheNom?: string };
    if (!parsed?.crecheId) return null;
    return { crecheId: parsed.crecheId, crecheNom: parsed.crecheNom || '' };
  } catch {
    return null;
  }
}

export function buildParentQrUrl(crecheId: string, crecheNom = ''): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rawdha.dz';
  const params = new URLSearchParams({ creche: crecheId });
  if (crecheNom.trim()) params.set('nom', crecheNom.trim());
  return `${origin}/espace-parent?${params.toString()}`;
}

function notifyPortalUpdated(payload: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PARENT_PORTAL_UPDATED_EVENT, { detail: payload }));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      (bc as unknown as { unref?: () => void }).unref?.();
      bc.postMessage({ type: PARENT_PORTAL_UPDATED_EVENT, ...payload });
      bc.close();
    }
  } catch {
    // BroadcastChannel optional in JSDOM
  }
}

export function subscribeToParentPortalChanges(
  onUpdate: (detail?: Record<string, unknown>) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handleCustom = (ev: Event) => {
    onUpdate((ev as CustomEvent<Record<string, unknown>>).detail);
  };
  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === REQUESTS_STORAGE_KEY || ev.key === ANNOUNCEMENTS_STORAGE_KEY) {
      onUpdate({ source: 'storage' });
    }
  };
  window.addEventListener(PARENT_PORTAL_UPDATED_EVENT, handleCustom);
  window.addEventListener('storage', handleStorage);

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      (bc as unknown as { unref?: () => void }).unref?.();
      bc.onmessage = (msg) => {
        onUpdate((msg?.data as Record<string, unknown>) || {});
      };
    }
  } catch {
    bc = null;
  }

  return () => {
    window.removeEventListener(PARENT_PORTAL_UPDATED_EVENT, handleCustom);
    window.removeEventListener('storage', handleStorage);
    try {
      bc?.close();
    } catch {
      // ignore
    }
  };
}

function readLocalRequests(): ParentLinkRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REQUESTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalRequests(items: ParentLinkRequest[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function readLocalAnnouncements(): ParentAnnouncement[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ANNOUNCEMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAnnouncements(items: ParentAnnouncement[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function normalizeName(text?: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim();
}

export function findMatchingChildrenForRequest(
  request: Pick<ParentLinkRequest, 'requestedChildren' | 'parentTelephone' | 'parentNom'>,
  enfants: Enfant[],
): string[] {
  const matched = new Set<string>();
  const reqPhoneDigits = (request.parentTelephone || '').replace(/\D/g, '').slice(-9);

  for (const reqChild of request.requestedChildren || []) {
    const wantFirst = normalizeName(reqChild.prenom);
    const wantLast = normalizeName(reqChild.nom || request.parentNom);

    for (const child of enfants) {
      const cFirst = normalizeName(child.prenom);
      const cLast = normalizeName(child.nom);
      if (wantFirst && cFirst === wantFirst && (!wantLast || cLast === wantLast)) {
        matched.add(child.id);
      } else if (
        wantFirst &&
        cFirst === wantFirst &&
        reqPhoneDigits.length === 9 &&
        (child.parents || []).some((p) => (p.telephone || '').replace(/\D/g, '').slice(-9) === reqPhoneDigits)
      ) {
        matched.add(child.id);
      }
    }
  }

  // Fallback by parent phone if no exact first-name match was typed cleanly
  if (matched.size === 0 && reqPhoneDigits.length === 9) {
    for (const child of enfants) {
      if ((child.parents || []).some((p) => (p.telephone || '').replace(/\D/g, '').slice(-9) === reqPhoneDigits)) {
        matched.add(child.id);
      }
    }
  }

  return [...matched];
}

export function buildChildSnapshots(params: {
  enfantIds: string[];
  enfants: Enfant[];
  presences: Presence[];
  repas: Repas[];
  activites: Activite[];
  paiements: Paiement[];
}): ParentChildSnapshot[] {
  const { enfantIds, enfants, presences, repas, activites, paiements } = params;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayMeals = repas
    .filter((m) => mealAppliesOnDate(m, today))
    .map((m) => ({ id: m.id, type: m.type, menu: m.menu }));

  return enfantIds
    .map((id) => enfants.find((c) => c.id === id))
    .filter((c): c is Enfant => Boolean(c))
    .map((child) => {
      const pres = presences.find((p) => p.enfantId === child.id && p.date === today);
      const childActs = activites
        .filter((a) => a.date === today && (!a.groupe || a.groupe === child.groupeAge))
        .map((a: any) => ({
          id: a.id,
          titre: a.titre,
          heureDebut: a.heureDebut,
          heureFin: a.heureFin,
          groupe: a.groupe,
        }));
      const childInvoices = paiements
        .filter((p) => p.enfantId === child.id && p.statut !== 'Annulé')
        .slice(0, 4)
        .map((p) => ({
          id: p.id,
          moisConcerne: p.moisConcerne,
          montant: p.montant,
          statut: p.statut,
        }));

      return {
        id: child.id,
        prenom: child.prenom,
        nom: child.nom,
        groupeAge: child.groupeAge,
        dateNaissance: child.dateNaissance,
        presenceToday: pres
          ? {
              statut: pres.statut,
              heureArrivee: pres.heureArrivee,
              heureDepart: pres.heureDepart,
              humeur: pres.humeur,
              repas: pres.repas,
            }
          : null,
        todayMeals,
        todayActivities: childActs,
        invoices: childInvoices,
      };
    });
}

export function ensureDemoParentPortalSeed(params: {
  crecheId: string;
  crecheNom: string;
  enfants: Enfant[];
  presences: Presence[];
  repas: Repas[];
  activites: Activite[];
  paiements: Paiement[];
}): void {
  const { crecheId, crecheNom, enfants, presences, repas, activites, paiements } = params;
  if (!crecheId || hasLiveSupabaseParentPortal()) return;
  if (readEnv().VITE_ARENA_DEMO !== 'true') return;

  const existingReqs = readLocalRequests().filter((r) => r.crecheId === crecheId);
  if (existingReqs.length === 0 && enfants.length >= 2) {
    const first = enfants[0];
    const second = enfants[1];
    const third = enfants[2] || enfants[0];
    const nowIso = new Date().toISOString();

    const seededRequests: ParentLinkRequest[] = [
      {
        id: 'demo-plr-pending-1',
        crecheId,
        crecheNom,
        deviceToken: 'demo-parent-pending-token-1',
        parentPrenom: first.parents?.[0]?.prenom || 'Nadia',
        parentNom: first.nom,
        parentTelephone: first.parents?.[0]?.telephone || '0555123456',
        parentLien: 'Mère',
        requestedChildren: [
          { prenom: first.prenom, nom: first.nom, groupeAge: first.groupeAge },
        ],
        linkedEnfantIds: [],
        status: 'pending',
        pushEnabled: false,
        homeScreenInstalled: false,
        platformHint: 'android',
        createdAt: new Date(Date.now() - 18 * 60_000).toISOString(),
        updatedAt: nowIso,
      },
      {
        id: 'demo-plr-pending-siblings',
        crecheId,
        crecheNom,
        deviceToken: 'demo-parent-pending-token-2',
        parentPrenom: second.parents?.[0]?.prenom || 'Mourad',
        parentNom: second.nom,
        parentTelephone: second.parents?.[0]?.telephone || '0661445566',
        parentLien: 'Père',
        requestedChildren: [
          { prenom: second.prenom, nom: second.nom, groupeAge: second.groupeAge },
          ...(third.id !== second.id
            ? [{ prenom: third.prenom, nom: third.nom, groupeAge: third.groupeAge }]
            : []),
        ],
        linkedEnfantIds: [],
        status: 'pending',
        pushEnabled: false,
        homeScreenInstalled: false,
        platformHint: 'ios',
        createdAt: new Date(Date.now() - 42 * 60_000).toISOString(),
        updatedAt: nowIso,
      },
      {
        id: 'demo-plr-approved-1',
        crecheId,
        crecheNom,
        deviceToken: 'demo-parent-approved-token-1',
        parentPrenom: (enfants[3] || first).parents?.[0]?.prenom || 'Samira',
        parentNom: (enfants[3] || first).nom,
        parentTelephone: (enfants[3] || first).parents?.[0]?.telephone || '0770889900',
        parentLien: 'Mère',
        requestedChildren: [
          { prenom: (enfants[3] || first).prenom, nom: (enfants[3] || first).nom },
        ],
        linkedEnfantIds: [(enfants[3] || first).id],
        linkedSnapshots: buildChildSnapshots({
          enfantIds: [(enfants[3] || first).id],
          enfants,
          presences,
          repas,
          activites,
          paiements,
        }),
        status: 'approved',
        pushEnabled: true,
        homeScreenInstalled: true,
        platformHint: 'android',
        createdAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
        updatedAt: nowIso,
      },
    ];

    writeLocalRequests([...readLocalRequests(), ...seededRequests]);
  }

  const existingAnns = readLocalAnnouncements().filter((a) => a.crecheId === crecheId);
  if (existingAnns.length === 0) {
    const seededAnns: ParentAnnouncement[] = [
      {
        id: 'demo-ann-1',
        crecheId,
        title: 'Menu & ateliers d’automne mis à jour',
        message: 'Le programme nutritionnel bio et les ateliers sensoriels de la semaine sont consultables sur votre Pass Parent.',
        category: 'info',
        targetScope: 'all',
        senderName: crecheNom || 'La Direction',
        sentPushCount: 1,
        createdAt: new Date(Date.now() - 4 * 3600_000).toISOString(),
      },
    ];
    writeLocalAnnouncements([...readLocalAnnouncements(), ...seededAnns]);
  }
}

export async function loadParentLinkRequests(crecheId: string): Promise<ParentLinkRequest[]> {
  if (!crecheId) return [];
  if (hasLiveSupabaseParentPortal()) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('parent_link_requests')
      .select('*')
      .eq('creche_id', crecheId)
      .order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map((row: any) => ({
        id: row.id,
        crecheId: row.creche_id,
        crecheNom: row.creche_nom || '',
        parentPrenom: row.parent_prenom,
        parentNom: row.parent_nom,
        parentTelephone: row.parent_telephone,
        parentLien: row.parent_lien || 'Parent',
        requestedChildren: Array.isArray(row.requested_children) ? row.requested_children : [],
        requestedChildId: row.requested_child_id || undefined,
        linkedEnfantIds: Array.isArray(row.linked_enfant_ids) ? row.linked_enfant_ids : [],
        status: row.status,
        rejectionReason: row.rejection_reason || undefined,
        pushEnabled: Boolean(row.push_enabled),
        pushSubscription: row.push_subscription || null,
        homeScreenInstalled: Boolean(row.home_screen_installed),
        platformHint: row.platform_hint || 'android',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }
    throw new Error('Impossible de charger les demandes parent. Vérifiez la connexion puis actualisez.');
  }
  return readLocalRequests()
    .filter((r) => r.crecheId === crecheId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCurrentDeviceParentRequest(
  crecheId: string,
  deviceToken = getOrCreateParentDeviceToken(),
): Promise<ParentLinkRequest | null> {
  if (!crecheId || !deviceToken) return null;
  if (hasLiveSupabaseParentPortal()) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.rpc('get_parent_portal_snapshot', {
      p_creche_id: crecheId,
      p_device_token: deviceToken,
    });
    if (error) throw new Error('Impossible de charger le statut parent.');
    if (data && typeof data === 'object' && 'request' in (data as Record<string, unknown>)) {
      const payload = data as { request: ParentLinkRequest; announcements?: ParentAnnouncement[] };
      return payload.request;
    }
    return null;
  }
  const local = readLocalRequests().find(
    (r) => r.crecheId === crecheId && r.deviceToken === deviceToken,
  );
  return local || null;
}

/** Fetch only announcements already filtered by the parent snapshot RPC. */
export async function loadParentAnnouncementsForDevice(crecheId: string, deviceToken: string): Promise<ParentAnnouncement[]> {
  if (!crecheId || !deviceToken) return [];
  if (!hasLiveSupabaseParentPortal()) return loadParentAnnouncements(crecheId);
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('get_parent_portal_snapshot', {
    p_creche_id: crecheId,
    p_device_token: deviceToken,
  });
  if (error) throw new Error('Impossible de charger les annonces parent.');
  return Array.isArray(data?.announcements) ? data.announcements as ParentAnnouncement[] : [];
}

export async function submitParentLinkRequest(params: {
  crecheId: string;
  crecheNom: string;
  parentPrenom: string;
  parentNom: string;
  parentTelephone: string;
  parentLien: 'Mère' | 'Père' | 'Tuteur' | 'Parent';
  requestedChildren: ParentRequestedChild[];
  deviceToken?: string;
}): Promise<ParentLinkRequest> {
  const deviceToken = params.deviceToken || getOrCreateParentDeviceToken();
  if (!deviceToken) throw new Error('Accès parent indisponible sur cet appareil. Contactez la crèche pour rétablir votre accès.');
  const platformHint = detectMobilePlatform();
  const cleanChildren = params.requestedChildren
    .map((c) => ({
      prenom: c.prenom.trim(),
      nom: (c.nom || params.parentNom).trim(),
      dateNaissance: c.dateNaissance?.trim() || undefined,
      groupeAge: c.groupeAge || undefined,
    }))
    .filter((c) => c.prenom.length > 0);

  if (!params.parentPrenom.trim() || !params.parentNom.trim() || !params.parentTelephone.trim()) {
    throw new Error('Veuillez renseigner votre nom, prénom et téléphone.');
  }
  if (cleanChildren.length === 0) {
    throw new Error('Veuillez indiquer au moins un enfant à rattacher.');
  }

  rememberParentCreche(params.crecheId, params.crecheNom);

  if (hasLiveSupabaseParentPortal()) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.rpc('submit_parent_link_request', {
      p_creche_id: params.crecheId,
      p_creche_nom: params.crecheNom,
      p_device_token: deviceToken,
      p_parent_prenom: params.parentPrenom.trim(),
      p_parent_nom: params.parentNom.trim(),
      p_parent_telephone: params.parentTelephone.trim(),
      p_parent_lien: params.parentLien,
      p_requested_children: cleanChildren,
      p_platform_hint: platformHint,
    });
    if (error || data?.ok !== true || typeof data?.id !== 'string') {
      throw new Error('Envoi non confirmé. Actualisez pour vérifier avant de réessayer.');
    }
    const { data: snapshot, error: snapshotError } = await supabase.rpc('get_parent_portal_snapshot', {
      p_creche_id: params.crecheId,
      p_device_token: deviceToken,
    });
    if (snapshotError || !snapshot?.request || snapshot.request.id !== data.id) {
      throw new Error('Demande enregistrée, mais son statut est indisponible. Actualisez la page avant de réessayer.');
    }
    notifyPortalUpdated({ action: 'request_submitted', crecheId: params.crecheId, requestId: data.id });
    return snapshot.request as ParentLinkRequest;
  }

  const all = readLocalRequests();
  const nowIso = new Date().toISOString();
  const idx = all.findIndex(
    (r) => r.crecheId === params.crecheId && r.deviceToken === deviceToken,
  );

  let saved: ParentLinkRequest;
  if (idx >= 0) {
    const prev = all[idx];
    // Si le parent avait déjà des enfants approuvés et ajoute un frère/sœur, il garde son accès actif
    const mergedRequested = [...prev.requestedChildren];
    for (const c of cleanChildren) {
      const exists = mergedRequested.some(
        (m) => normalizeName(m.prenom) === normalizeName(c.prenom) && normalizeName(m.nom) === normalizeName(c.nom),
      );
      if (!exists) mergedRequested.push(c);
    }
    saved = {
      ...prev,
      crecheNom: params.crecheNom || prev.crecheNom,
      parentPrenom: params.parentPrenom.trim(),
      parentNom: params.parentNom.trim(),
      parentTelephone: params.parentTelephone.trim(),
      parentLien: params.parentLien,
      requestedChildren: prev.linkedEnfantIds.length > 0 ? mergedRequested : cleanChildren,
      status: prev.linkedEnfantIds.length > 0 ? 'approved' : 'pending',
      rejectionReason: undefined,
      platformHint,
      updatedAt: nowIso,
    };
    all[idx] = saved;
  } else {
    saved = {
      id: `plr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      crecheId: params.crecheId,
      crecheNom: params.crecheNom,
      deviceToken,
      parentPrenom: params.parentPrenom.trim(),
      parentNom: params.parentNom.trim(),
      parentTelephone: params.parentTelephone.trim(),
      parentLien: params.parentLien,
      requestedChildren: cleanChildren,
      linkedEnfantIds: [],
      status: 'pending',
      pushEnabled: false,
      homeScreenInstalled: isRunningStandalonePwa(),
      platformHint,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    all.unshift(saved);
  }

  writeLocalRequests(all);
  notifyPortalUpdated({ action: 'request_submitted', crecheId: params.crecheId, requestId: saved.id });
  return saved;
}

export async function approveParentLinkRequest(params: {
  requestId: string;
  enfantIds: string[];
  enfants: Enfant[];
  presences: Presence[];
  repas: Repas[];
  activites: Activite[];
  paiements: Paiement[];
}): Promise<ParentLinkRequest | null> {
  if (params.enfantIds.length === 0) {
    throw new Error('Sélectionnez au moins un dossier enfant à lier.');
  }

  const snapshots = buildChildSnapshots({
    enfantIds: params.enfantIds,
    enfants: params.enfants,
    presences: params.presences,
    repas: params.repas,
    activites: params.activites,
    paiements: params.paiements,
  });

  if (hasLiveSupabaseParentPortal()) {
    const supabase = await getSupabaseClient();
    await requireConfirmedParentWrite(supabase
      .from('parent_link_requests')
      .update({
        status: 'approved',
        linked_enfant_ids: params.enfantIds,
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.requestId).select('id').maybeSingle());
    notifyPortalUpdated({ action: 'request_approved', requestId: params.requestId });
    return null;
  }

  const all = readLocalRequests();
  const idx = all.findIndex((r) => r.id === params.requestId);
  if (idx < 0) return null;

  const updated: ParentLinkRequest = {
    ...all[idx],
    status: 'approved',
    linkedEnfantIds: params.enfantIds,
    linkedSnapshots: snapshots,
    rejectionReason: undefined,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  writeLocalRequests(all);
  notifyPortalUpdated({
    action: 'request_approved',
    crecheId: updated.crecheId,
    requestId: updated.id,
  });
  return updated;
}

export async function rejectParentLinkRequest(
  requestId: string,
  reason = '',
): Promise<void> {
  if (hasLiveSupabaseParentPortal()) {
    const supabase = await getSupabaseClient();
    await requireConfirmedParentWrite(supabase
      .from('parent_link_requests')
      .update({
        status: 'rejected',
        linked_enfant_ids: [],
        rejection_reason: reason.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId).select('id').maybeSingle());
    notifyPortalUpdated({ action: 'request_rejected', requestId });
    return;
  }

  const all = readLocalRequests();
  const idx = all.findIndex((r) => r.id === requestId);
  if (idx >= 0) {
    const crecheId = all[idx].crecheId;
    all[idx] = {
      ...all[idx],
      status: 'rejected',
      linkedEnfantIds: [],
      linkedSnapshots: [],
      rejectionReason: reason.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    writeLocalRequests(all);
    notifyPortalUpdated({ action: 'request_rejected', crecheId, requestId });
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof atob === 'function' ? atob(base64) : '';
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function triggerLocalServiceWorkerNotification(
  title: string,
  body: string,
  url = '/espace-parent',
): Promise<void> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        if (typeof reg.showNotification === 'function') {
          await reg.showNotification(title, {
            body,
            icon: '/favicon.png',
            badge: '/favicon.png',
            data: { url },
          });
          return;
        }
        reg.active?.postMessage({ type: 'RAWDHA_SHOW_LOCAL_PUSH', title, body, url });
        return;
      }
    }
    new Notification(title, { body, icon: '/favicon.png' });
  } catch {
    // ignore browser notification restrictions in headless environments
  }
}

export async function subscribeParentWebPush(params: {
  crecheId: string;
  crecheNom?: string;
  deviceToken?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const deviceToken = params.deviceToken || getOrCreateParentDeviceToken();
  if (!deviceToken) return { ok: false, reason: 'registration_failed' };

  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { ok: false, reason: 'unsupported' };
  }

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  let permission: NotificationPermission = 'default';
  try {
    permission = await Notification.requestPermission();
  } catch {
    permission = 'default';
  }

  // Dans un aperçu intégré (iframe cross-origin), les navigateurs bloquent parfois la boîte système
  // Notification.requestPermission() : on active alors le canal Push applicatif de démonstration
  // pour permettre de tester tout le flux en direct depuis l’aperçu.
  if (permission !== 'granted' && (hasLiveSupabaseParentPortal() || !inIframe)) {
    return { ok: false, reason: 'denied' };
  }

  let subscriptionJson: Record<string, unknown> | null = null;
  const vapidPublicKey = (readEnv().VITE_VAPID_PUBLIC_KEY || '').trim();

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (vapidPublicKey && registration.pushManager) {
        const existing = await registration.pushManager.getSubscription();
        const sub =
          existing ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }));
        subscriptionJson = sub.toJSON() as Record<string, unknown>;
      }
    }
  } catch {
    // Local SW notification still works even without external VAPID key
  }

  if (hasLiveSupabaseParentPortal()) {
    const supabase = await getSupabaseClient();
    const registered = await confirmParentPushRegistration(subscriptionJson, () => supabase.rpc('register_parent_web_push', {
      p_creche_id: params.crecheId,
      p_device_token: deviceToken,
      p_push_enabled: true,
      p_push_subscription: subscriptionJson,
      p_home_screen_installed: isRunningStandalonePwa(),
    }));
    if (!registered) return { ok: false, reason: 'registration_failed' };
  }

  const all = readLocalRequests();
  const idx = all.findIndex(
    (r) => r.crecheId === params.crecheId && r.deviceToken === deviceToken,
  );
  if (idx >= 0) {
    all[idx] = {
      ...all[idx],
      pushEnabled: true,
      pushSubscription: subscriptionJson,
      updatedAt: new Date().toISOString(),
    };
    writeLocalRequests(all);
  }

  if (!hasLiveSupabaseParentPortal()) {
    await triggerLocalServiceWorkerNotification(
      params.crecheNom ? `${params.crecheNom} — Notifications de démonstration` : 'Rawdha+ — Notifications de démonstration',
      'Ceci est une notification locale de démonstration.',
      `/espace-parent?creche=${encodeURIComponent(params.crecheId)}`,
    );
  }

  notifyPortalUpdated({ action: 'push_enabled', crecheId: params.crecheId });
  return { ok: true, reason: hasLiveSupabaseParentPortal() ? undefined : 'demo' };
}

export async function markParentHomeScreenInstalled(
  crecheId: string,
  deviceToken = getOrCreateParentDeviceToken(),
): Promise<void> {
  if (hasLiveSupabaseParentPortal()) {
    const supabase = await getSupabaseClient();
    await supabase.rpc('register_parent_web_push', {
      p_creche_id: crecheId,
      p_device_token: deviceToken,
      p_push_enabled: null,
      p_push_subscription: null,
      p_home_screen_installed: true,
    });
  }

  const all = readLocalRequests();
  const idx = all.findIndex(
    (r) => r.crecheId === crecheId && r.deviceToken === deviceToken,
  );
  if (idx >= 0) {
    all[idx] = { ...all[idx], homeScreenInstalled: true, updatedAt: new Date().toISOString() };
    writeLocalRequests(all);
    notifyPortalUpdated({ action: 'home_screen_installed', crecheId });
  }
}

export async function loadParentAnnouncements(crecheId: string): Promise<ParentAnnouncement[]> {
  if (!crecheId) return [];
  if (hasLiveSupabaseParentPortal()) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('parent_announcements')
      .select('*')
      .eq('creche_id', crecheId)
      .order('created_at', { ascending: false })
      .limit(40);
    if (!error && Array.isArray(data)) {
      return data.map((row: any) => ({
        id: row.id,
        crecheId: row.creche_id,
        title: row.title,
        message: row.message,
        category: row.category || 'info',
        targetScope: row.target_scope || 'all',
        targetGroup: row.target_group || undefined,
        targetEnfantId: row.target_enfant_id || undefined,
        senderName: row.sender_name || 'Direction',
        sentPushCount: Number(row.sent_push_count) || 0,
        createdAt: row.created_at,
      }));
    }
  }
  return readLocalAnnouncements()
    .filter((a) => a.crecheId === crecheId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function publishParentAnnouncement(params: {
  crecheId: string;
  crecheNom: string;
  title: string;
  message: string;
  category: ParentAnnouncement['category'];
  targetScope: ParentAnnouncement['targetScope'];
  targetGroup?: 'Bébés' | 'Moyens' | 'Grands';
  targetEnfantId?: string;
  enfants: Enfant[];
}): Promise<{ announcement: ParentAnnouncement; sentPushCount: number; pushStatus: 'confirmed' | 'incomplete' | 'unknown' | 'demo' }> {
  const title = params.title.trim();
  const message = params.message.trim();
  if (!title || !message) {
    throw new Error('Le titre et le message de l’annonce sont obligatoires.');
  }

  if ((params.targetScope === 'child' && !params.targetEnfantId) || (params.targetScope === 'group' && !params.targetGroup)) {
    throw new Error('Sélectionnez le destinataire de l’annonce.');
  }
  const requests = hasLiveSupabaseParentPortal() ? [] : await loadParentLinkRequests(params.crecheId);
  const approvedPushDevices = requests.filter((r) => {
    if (r.status !== 'approved' || !r.pushEnabled) return false;
    if (params.targetScope === 'all') return true;
    if (params.targetScope === 'child' && params.targetEnfantId) {
      return r.linkedEnfantIds.includes(params.targetEnfantId);
    }
    if (params.targetScope === 'group' && params.targetGroup) {
      return r.linkedEnfantIds.some((id) => {
        const child = params.enfants.find((e) => e.id === id);
        return child?.groupeAge === params.targetGroup;
      });
    }
    return false;
  });

  let sentPushCount = 0;
  let pushStatus: 'confirmed' | 'incomplete' | 'unknown' | 'demo' = 'demo';
  const annId = `pann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = new Date().toISOString();

  if (hasLiveSupabaseParentPortal()) {
    const supabase = await getSupabaseClient();
    // Save first: never send a push for an announcement that was not confirmed.
    await requireConfirmedParentWrite(supabase.from('parent_announcements').insert({
      id: annId,
      creche_id: params.crecheId,
      title,
      message,
      category: params.category,
      target_scope: params.targetScope,
      target_group: params.targetGroup || null,
      target_enfant_id: params.targetEnfantId || null,
      sender_name: params.crecheNom || 'Direction',
      sent_push_count: 0,
      created_at: createdAt,
    }).select('id').maybeSingle());

    pushStatus = 'unknown';
    try {
      const { data: pushRes, error: pushError } = await supabase.functions.invoke('send-parent-web-push', {
        body: {
          crecheId: params.crecheId,
          title: `${params.crecheNom || 'Crèche'} — ${title}`,
          message,
          targetScope: params.targetScope,
          targetGroup: params.targetGroup,
          targetEnfantId: params.targetEnfantId,
          announcementId: annId,
        },
      });
      if (!pushError && pushRes?.configured === true && Number.isInteger(pushRes.sent) && pushRes.sent >= 0 && Number.isInteger(pushRes.failed) && pushRes.failed >= 0) {
        sentPushCount = pushRes.sent;
        pushStatus = pushRes.failed > 0 ? 'incomplete' : 'confirmed';
        // A statistics failure must not cause a duplicate send on retry.
        if (sentPushCount > 0) await supabase.from('parent_announcements').update({ sent_push_count: sentPushCount }).eq('id', annId);
      } else if (!pushError && pushRes?.configured === false) {
        pushStatus = 'incomplete';
      }
    } catch {
      // The request may have reached the server: do not retry automatically.
    }
  } else {
    sentPushCount = approvedPushDevices.length;
  }

  const announcement: ParentAnnouncement = {
    id: annId,
    crecheId: params.crecheId,
    title,
    message,
    category: params.category,
    targetScope: params.targetScope,
    targetGroup: params.targetGroup,
    targetEnfantId: params.targetEnfantId,
    senderName: params.crecheNom || 'Direction',
    sentPushCount,
    createdAt,
  };

  if (!hasLiveSupabaseParentPortal()) {
    const all = readLocalAnnouncements();
    all.unshift(announcement);
    writeLocalAnnouncements(all);
  }

  // The shared browser channel must not broadcast targeted content to other
  // parent tabs. Live parents refresh their server-filtered snapshots instead.
  notifyPortalUpdated(hasLiveSupabaseParentPortal()
    ? { action: 'announcements_changed', crecheId: params.crecheId }
    : { action: 'announcement_published', crecheId: params.crecheId, announcement });

  return { announcement, sentPushCount, pushStatus };
}

// ============================================================================
// ALERTES PUSH AUTOMATIQUES DE POINTAGE (Bien arrivé / Récupéré / Absence / Suivi)
// ============================================================================

const AUTO_ATTENDANCE_PUSH_KEY_PREFIX = 'rawdha_auto_attendance_push_v1_';
const recentAttendancePushSignatures = new Map<string, string>();

export type AttendancePushEventKind = 'arrival' | 'pickup' | 'absence' | 'observation';

export interface AttendanceSnapshotLike {
  date: string;
  statut: 'Présent' | 'Absent justifié' | 'Absent non justifié' | string;
  heureArrivee?: string;
  heureDepart?: string;
  temperature?: string;
  repas?: string;
  humeur?: string;
  motifAbsence?: string;
  personneRecuperation?: string;
}

export function isAutoAttendancePushEnabled(crecheId?: string | null): boolean {
  if (!crecheId || typeof localStorage === 'undefined') return true;
  try {
    const raw = localStorage.getItem(`${AUTO_ATTENDANCE_PUSH_KEY_PREFIX}${crecheId}`);
    if (raw === null) return true;
    return raw !== '0' && raw !== 'false';
  } catch {
    return true;
  }
}

export function setAutoAttendancePushEnabled(crecheId: string, enabled: boolean): void {
  if (!crecheId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${AUTO_ATTENDANCE_PUSH_KEY_PREFIX}${crecheId}`, enabled ? '1' : '0');
  } catch {
    // Ignore storage quota errors
  }
}

function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function dispatchAutomaticAttendancePush(params: {
  crecheId?: string | null;
  crecheNom?: string;
  enfant?: Enfant | null;
  previous?: AttendanceSnapshotLike | null;
  next: AttendanceSnapshotLike;
  isArabic?: boolean;
  allowHistoricalDate?: boolean;
}): Promise<{
  triggered: boolean;
  kind?: AttendancePushEventKind;
  sentPushCount: number;
  announcement?: ParentAnnouncement;
}> {
  const { crecheId, crecheNom, enfant, previous, next, isArabic = false, allowHistoricalDate = false } = params;
  if (!crecheId || !enfant?.id) {
    return { triggered: false, sentPushCount: 0 };
  }
  if (!isAutoAttendancePushEnabled(crecheId)) {
    return { triggered: false, sentPushCount: 0 };
  }
  if (!allowHistoricalDate && next.date !== getLocalTodayIso()) {
    return { triggered: false, sentPushCount: 0 };
  }

  const prevArrivee = (previous?.heureArrivee || '').trim();
  const nextArrivee = (next.heureArrivee || '').trim();
  const prevDepart = (previous?.heureDepart || '').trim();
  const nextDepart = (next.heureDepart || '').trim();
  const prevTemp = (previous?.temperature || '').trim();
  const nextTemp = (next.temperature || '').trim();
  const prevRepas = (previous?.repas || '').trim();
  const nextRepas = (next.repas || '').trim();
  const prevHumeur = (previous?.humeur || '').trim();
  const nextHumeur = (next.humeur || '').trim();
  const prevMotif = (previous?.motifAbsence || '').trim();
  const nextMotif = (next.motifAbsence || '').trim();
  const accompagnateur = (next.personneRecuperation || '').trim();

  const fullName = `${enfant.prenom} ${enfant.nom}`.trim();
  const isGirl = enfant.genre === 'Fille';

  let kind: AttendancePushEventKind | null = null;
  let title = '';
  let message = '';
  let category: ParentAnnouncement['category'] = 'info';

  if (next.statut === 'Présent') {
    const wasPresent = previous?.statut === 'Présent';
    const hasNewPickup = Boolean(nextDepart) && nextDepart !== prevDepart;

    if (hasNewPickup && (wasPresent || Boolean(prevArrivee) || Boolean(nextArrivee))) {
      kind = 'pickup';
      title = isArabic
        ? `تم الاستلام — ${enfant.prenom}`
        : `${isGirl ? 'Récupérée' : 'Récupéré'} — ${enfant.prenom}`;
      const byFr = accompagnateur ? ` par ${accompagnateur}` : '';
      const byAr = accompagnateur ? ` رفقة ${accompagnateur}` : '';
      message = isArabic
        ? `غادر(ت) ${fullName} الروضة بسلام على الساعة ${nextDepart}${byAr}. طابت أمسيتكم!`
        : `${fullName} a bien été ${isGirl ? 'récupérée' : 'récupéré'} à ${nextDepart}${byFr}. Bonne fin de journée !`;
    } else if (!wasPresent) {
      kind = 'arrival';
      const arrivalClock = nextArrivee || new Date().toTimeString().slice(0, 5);
      title = isArabic
        ? `وصل(ت) بسلام — ${enfant.prenom}`
        : `Bien ${isGirl ? 'arrivée' : 'arrivé'} — ${enfant.prenom}`;
      const detailsFr: string[] = [];
      const detailsAr: string[] = [];
      if (nextHumeur) {
        detailsFr.push(`Humeur : ${nextHumeur}`);
        detailsAr.push(`المزاج: ${nextHumeur}`);
      }
      if (nextTemp) {
        detailsFr.push(`${nextTemp}°C`);
        detailsAr.push(`${nextTemp}°C`);
      }
      const suffixFr = detailsFr.length > 0 ? ` (${detailsFr.join(' · ')})` : '';
      const suffixAr = detailsAr.length > 0 ? ` (${detailsAr.join(' · ')})` : '';
      message = isArabic
        ? `وصل(ت) ${fullName} إلى الروضة بسلام على الساعة ${arrivalClock}${suffixAr}. يوم موفق!`
        : `${fullName} est bien ${isGirl ? 'arrivée' : 'arrivé'} à la crèche à ${arrivalClock}${suffixFr}. Belle journée !`;
    } else {
      const tempChanged = Boolean(nextTemp) && nextTemp !== prevTemp;
      const repasChanged = Boolean(nextRepas) && nextRepas !== prevRepas;
      const humeurChanged = Boolean(nextHumeur) && nextHumeur !== prevHumeur;
      if (tempChanged || repasChanged || humeurChanged) {
        kind = 'observation';
        const numericTemp = Number(nextTemp.replace(',', '.'));
        const hasFever = tempChanged && Number.isFinite(numericTemp) && numericTemp >= 38;
        if (hasFever) {
          category = 'sante';
          title = isArabic
            ? `تنبيه حرارة (${nextTemp}°C) — ${enfant.prenom}`
            : `Alerte température (${nextTemp}°C) — ${enfant.prenom}`;
          message = isArabic
            ? `تم تسجيل درجة حرارة ${nextTemp}°C للطفل(ة) ${fullName}. يرجى متابعة الإشعار أو الاتصال بالروضة.`
            : `Une température de ${nextTemp}°C vient d'être relevée pour ${fullName}. Merci de rester joignable.`;
        } else {
          const partsFr: string[] = [];
          const partsAr: string[] = [];
          if (nextRepas) {
            partsFr.push(`Repas : ${nextRepas}`);
            partsAr.push(`الوجبة: ${nextRepas}`);
          }
          if (nextHumeur) {
            partsFr.push(`Humeur : ${nextHumeur}`);
            partsAr.push(`المزاج: ${nextHumeur}`);
          }
          if (nextTemp) {
            partsFr.push(`Température : ${nextTemp}°C`);
            partsAr.push(`الحرارة: ${nextTemp}°C`);
          }
          title = isArabic
            ? `متابعة اليوم — ${enfant.prenom}`
            : `Suivi du jour — ${enfant.prenom}`;
          message = isArabic
            ? `تحديث يومي لـ ${fullName}: ${partsAr.join(' · ')}.`
            : `Pointage mis à jour pour ${fullName} : ${partsFr.join(' · ')}.`;
        }
      }
    }
  } else if (next.statut.startsWith('Absent')) {
    const statusChanged = !previous || previous.statut !== next.statut || prevMotif !== nextMotif;
    if (statusChanged) {
      kind = 'absence';
      const justified = next.statut === 'Absent justifié';
      category = justified ? 'info' : 'rappel';
      const statusLabelAr = justified ? 'غياب مبرر' : 'غياب غير مبرر';
      title = isArabic
        ? `تسجيل غياب — ${enfant.prenom}`
        : `Absence enregistrée — ${enfant.prenom}`;
      message = isArabic
        ? `تم تسجيل غياب ${fullName} اليوم (${statusLabelAr})${nextMotif ? ` — السبب: ${nextMotif}` : ''}.`
        : `Absence enregistrée aujourd'hui pour ${fullName} (${next.statut.toLowerCase()})${nextMotif ? ` — Motif : ${nextMotif}` : ''}.`;
    }
  }

  if (!kind || !title || !message) {
    return { triggered: false, sentPushCount: 0 };
  }

  const dedupeKey = `${crecheId}:${enfant.id}:${next.date}`;
  const signature = `${kind}|${next.statut}|${nextArrivee}|${nextDepart}|${nextTemp}|${nextRepas}|${nextHumeur}|${nextMotif}|${accompagnateur}`;
  if (recentAttendancePushSignatures.get(dedupeKey) === signature) {
    return { triggered: false, sentPushCount: 0 };
  }
  recentAttendancePushSignatures.set(dedupeKey, signature);

  const { announcement, sentPushCount } = await publishParentAnnouncement({
    crecheId,
    crecheNom,
    title,
    message,
    category,
    targetScope: 'child',
    targetEnfantId: enfant.id,
    enfants: [enfant],
  });

  return {
    triggered: true,
    kind,
    sentPushCount,
    announcement,
  };
}
