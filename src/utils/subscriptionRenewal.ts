import { LEGAL_CONFIG } from '../config/legal';
import { getCollectionDocument, setCollectionDocument, supabase } from '../supabase';
import { parseDataUrl, type StoredChildDocument } from './documentPdf';
import { uploadBytesToSupabaseStorage } from './documentStorage';

import {
  clearPendingSlickPayOrder,
  getPendingSlickPayOrder,
  savePendingSlickPayOrder,
  type PendingSlickPayOrder,
} from './slickpayPending';
export {
  clearPendingSlickPayOrder,
  getPendingSlickPayOrder,
  savePendingSlickPayOrder,
  type PendingSlickPayOrder,
};
export type SubscriptionPlanMonths = 1 | 3 | 12;
export type SubscriptionPaymentChannel = 'SlickPay' | 'BaridiMob' | 'CCP';
export type SubscriptionRenewalStatus = 'pending' | 'approved' | 'rejected';

export interface SubscriptionRenewalRequest {
  id: string;
  directorId: string;
  directorName: string;
  crecheName: string;
  email: string;
  telephone?: string;
  planMonths: SubscriptionPlanMonths;
  amountDzd: number;
  couponCode?: string;
  paymentChannel: SubscriptionPaymentChannel;
  transactionRef: string;
  proofDocument?: StoredChildDocument;
  status: SubscriptionRenewalStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

interface RenewalQueueDoc {
  version: number;
  items: SubscriptionRenewalRequest[];
}

const LOCAL_QUEUE_KEY = 'rawdha_subscription_renewals_v1';

export const SUBSCRIPTION_PLAN_OPTIONS: ReadonlyArray<{
  months: SubscriptionPlanMonths;
  priceDzd: number;
  badgeFr?: string;
  badgeAr?: string;
}> = [
  { months: 1, priceDzd: LEGAL_CONFIG.monthlyPlanPriceDzd },
  { months: 3, priceDzd: LEGAL_CONFIG.quarterlyPlanPriceDzd },
  {
    months: 12,
    priceDzd: LEGAL_CONFIG.annualPlanPriceDzd,
    badgeFr: '2 mois offerts',
    badgeAr: 'شهران مجاناً',
  },
];

export const SUBSCRIPTION_PROMO_CODES: Record<string, number> = {
  RAWDHA300: 300,
  RAWDHA500: 500,
  RAWDHA900: 900,
};

export function computeDiscountedPlanPrice(
  months: SubscriptionPlanMonths,
  couponRaw = ''
): { basePrice: number; discount: number; finalPrice: number } {
  const option = SUBSCRIPTION_PLAN_OPTIONS.find(item => item.months === months) || SUBSCRIPTION_PLAN_OPTIONS[0];
  const code = couponRaw.trim().toUpperCase();
  const discount = code && SUBSCRIPTION_PROMO_CODES[code] ? SUBSCRIPTION_PROMO_CODES[code] : 0;
  return {
    basePrice: option.priceDzd,
    discount,
    finalPrice: Math.max(0, option.priceDzd - discount),
  };
}

export function computeExtendedSubscriptionDate(
  currentEndDate?: string,
  months: SubscriptionPlanMonths = 1
): string {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  let anchor = today;
  if (currentEndDate && /^\d{4}-\d{2}-\d{2}$/.test(currentEndDate)) {
    const parsed = new Date(`${currentEndDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > today.getTime()) {
      anchor = parsed;
    }
  }

  const target = new Date(anchor);
  target.setMonth(target.getMonth() + months);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hasLiveSupabaseDb(): boolean {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  if (env.DEV && env.VITE_ARENA_DEMO === 'true') return false;
  const injectedMock = Boolean((globalThis as { __rawdatiSupabaseClient__?: unknown }).__rawdatiSupabaseClient__);
  const configuredUrl = String(env.VITE_SUPABASE_URL || '');
  if (!injectedMock && (!configuredUrl || configuredUrl.includes('preview.invalid'))) return false;
  return typeof (supabase as any)?.from === 'function';
}

function readLocalQueue(): SubscriptionRenewalRequest[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<RenewalQueueDoc>;
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function writeLocalQueue(items: SubscriptionRenewalRequest[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify({ version: 1, items }));
  } catch {
    // Ignore quota errors
  }
}

export async function loadSubscriptionRenewals(directorId?: string): Promise<SubscriptionRenewalRequest[]> {
  const localItems = readLocalQueue();
  const filterByDirector = (list: SubscriptionRenewalRequest[]) =>
    directorId ? list.filter(item => item.directorId === directorId) : list;

  if (!hasLiveSupabaseDb()) return filterByDirector(localItems);

  try {
    const byId = new Map<string, SubscriptionRenewalRequest>();

    if (directorId) {
      const doc = await getCollectionDocument<RenewalQueueDoc>('parametres', `abonnement_${directorId}`);
      if (doc && Array.isArray(doc.items)) {
        for (const item of doc.items) byId.set(item.id, item);
      }
    } else {
      const tableQuery = (supabase as any)?.from?.('parametres');
      const selectQuery = typeof tableQuery?.select === 'function' ? tableQuery.select('id, data') : null;
      if (selectQuery && typeof selectQuery.like === 'function') {
        const { data, error } = await selectQuery.like('id', 'abonnement_%');
        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const items = (row?.data as Partial<RenewalQueueDoc> | undefined)?.items;
            if (Array.isArray(items)) {
              for (const item of items) byId.set(item.id, item);
            }
          }
        }
      }
    }

    for (const local of filterByDirector(localItems)) {
      const existing = byId.get(local.id);
      if (!existing || (existing.status === 'pending' && local.status !== 'pending')) {
        byId.set(local.id, local);
      }
    }

    const merged = Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!directorId && merged.length > 0) {
      writeLocalQueue(merged);
    }
    return merged;
  } catch {
    return filterByDirector(localItems);
  }
}

async function persistDirectorRenewalBucket(
  directorId: string,
  allItems: SubscriptionRenewalRequest[]
): Promise<void> {
  if (!hasLiveSupabaseDb() || !directorId) return;
  const directorItems = allItems
    .filter(item => item.directorId === directorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  try {
    await setCollectionDocument('parametres', `abonnement_${directorId}`, {
      id: `abonnement_${directorId}`,
      version: 1,
      items: directorItems,
    });
  } catch {
    // Repli cache local en cas d'indisponibilité réseau
  }
}

async function persistSubscriptionRenewals(
  items: SubscriptionRenewalRequest[],
  targetDirectorId?: string
): Promise<void> {
  writeLocalQueue(items);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rawdha-subscription-renewals-updated'));
  }
  if (targetDirectorId) {
    await persistDirectorRenewalBucket(targetDirectorId, items);
  }
}

export async function submitSubscriptionRenewalRequest(input: {
  directorId: string;
  directorName: string;
  crecheName: string;
  email: string;
  telephone?: string;
  planMonths: SubscriptionPlanMonths;
  amountDzd: number;
  couponCode?: string;
  paymentChannel: SubscriptionPaymentChannel;
  transactionRef: string;
  proofDocument?: StoredChildDocument;
}): Promise<SubscriptionRenewalRequest> {
  let finalProof = input.proofDocument;

  if (finalProof?.contenu?.startsWith('data:')) {
    const parsed = parseDataUrl(finalProof.contenu);
    if (parsed) {
      const safeDir = (input.directorId || 'director').replace(/[^a-zA-Z0-9_-]+/g, '_');
      const uri = await uploadBytesToSupabaseStorage({
        bucket: 'subscription-proofs',
        path: `${safeDir}/recu-${Date.now()}.pdf`,
        bytes: parsed.bytes,
        mimeType: finalProof.type || parsed.mimeType || 'application/pdf',
      });
      if (uri) {
        finalProof = { ...finalProof, contenu: uri };
      }
    }
  }

  const request: SubscriptionRenewalRequest = {
    id: `ren_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    directorId: input.directorId,
    directorName: input.directorName.trim() || 'Directrice',
    crecheName: input.crecheName.trim() || 'Crèche',
    email: input.email.trim(),
    telephone: input.telephone?.trim() || undefined,
    planMonths: input.planMonths,
    amountDzd: Math.round(input.amountDzd),
    couponCode: input.couponCode?.trim().toUpperCase() || undefined,
    paymentChannel: input.paymentChannel,
    transactionRef: input.transactionRef.trim(),
    proofDocument: finalProof,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const existing = await loadSubscriptionRenewals(input.directorId);
  const allLocal = readLocalQueue().filter(item => item.id !== request.id);
  const byId = new Map<string, SubscriptionRenewalRequest>();
  for (const item of [...existing, ...allLocal]) byId.set(item.id, item);
  byId.set(request.id, request);
  const next = Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await persistSubscriptionRenewals(next, input.directorId);

  return request;
}

export async function updateSubscriptionRenewalStatus(
  requestId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string
): Promise<SubscriptionRenewalRequest | null> {
  const current = await loadSubscriptionRenewals();
  let updatedItem: SubscriptionRenewalRequest | null = null;
  const next = current.map(item => {
    if (item.id !== requestId) return item;
    updatedItem = {
      ...item,
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy,
    };
    return updatedItem;
  });
  if (updatedItem) {
    await persistSubscriptionRenewals(next, (updatedItem as SubscriptionRenewalRequest).directorId);
  }
  return updatedItem;
}

// ============================================================================
// PAIEMENT EN LIGNE OFFICIEL SLICKPAY API v2 (CIB / EDAHABIA — SATIM)
// ============================================================================

export interface SlickPayCheckoutResult {
  mode: 'live' | 'demo_gateway';
  orderId: string;
  invoiceId: string;
  paymentUrl: string;
  amountDzd: number;
  planMonths: SubscriptionPlanMonths;
}

export interface SlickPayVerifyResult {
  status: 'paid' | 'pending' | 'failed';
  orderId: string;
  invoiceId?: string;
  newEndDate?: string;
  planMonths?: SubscriptionPlanMonths;
  amountDzd?: number;
  transactionRef?: string;
  rejectionReason?: string;
}

interface DemoSlickPayOrder {
  orderId: string;
  invoiceId: string;
  directorId: string;
  directorName: string;
  crecheName: string;
  email: string;
  telephone?: string;
  planMonths: SubscriptionPlanMonths;
  amountDzd: number;
  couponCode?: string;
  currentEndDate?: string;
  status: 'pending' | 'paid' | 'failed';
  newEndDate?: string;
  transactionRef?: string;
  createdAt: string;
}

const DEMO_SLICKPAY_ORDERS_KEY = 'rawdha_slickpay_demo_orders_v1';

function readDemoSlickPayOrders(): DemoSlickPayOrder[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DEMO_SLICKPAY_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDemoSlickPayOrders(orders: DemoSlickPayOrder[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DEMO_SLICKPAY_ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // Ignore storage quota errors
  }
}

export function emitSubscriptionActivated(detail: {
  directorId: string;
  newEndDate: string;
  planMonths: SubscriptionPlanMonths;
  amountDzd: number;
  orderId: string;
  transactionRef: string;
}): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rawdha-subscription-activated', { detail }));
    window.dispatchEvent(new CustomEvent('rawdha-subscription-renewals-updated'));
  }
}

export async function createSlickPaySubscriptionCheckout(input: {
  directorId: string;
  prenom?: string;
  nom?: string;
  crecheName: string;
  email: string;
  telephone?: string;
  currentEndDate?: string;
  planMonths: SubscriptionPlanMonths;
  couponCode?: string;
}): Promise<SlickPayCheckoutResult> {
  const pricing = computeDiscountedPlanPrice(input.planMonths, input.couponCode || '');
  const amountDzd = Math.max(100, pricing.finalPrice);

  if (hasLiveSupabaseDb() && typeof (supabase as any)?.functions?.invoke === 'function') {
    const returnOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://rawdha.dz';
    const { data, error } = await (supabase as any).functions.invoke('slickpay-checkout', {
      body: {
        action: 'create',
        planMonths: input.planMonths,
        couponCode: input.couponCode?.trim().toUpperCase() || undefined,
        prenom: input.prenom,
        nom: input.nom,
        crecheName: input.crecheName,
        telephone: input.telephone,
        returnOrigin,
      },
    });

    if (error || !data?.ok || !data?.paymentUrl) {
      const errMsg =
        data?.error ||
        (error instanceof Error ? error.message : '') ||
        'Impossible d’initialiser la transaction SlickPay (SATIM).';
      throw new Error(errMsg);
    }

    const liveRes: SlickPayCheckoutResult = {
      mode: 'live',
      orderId: String(data.orderId),
      invoiceId: String(data.invoiceId || ''),
      paymentUrl: String(data.paymentUrl),
      amountDzd: Number(data.amountDzd || amountDzd),
      planMonths: input.planMonths,
    };

    // Sauvegarder la commande en attente avant la redirection SATIM :
    // si la directrice ferme l'onglet SATIM après l'OTP ou revient plus tard,
    // Rawdha+ vérifie et active l'abonnement automatiquement en arrière-plan !
    savePendingSlickPayOrder({
      ...liveRes,
      directorId: input.directorId,
      createdAt: new Date().toISOString(),
    });

    return liveRes;
  }

  // Mode Aperçu / Démo interactif (sans exposer aucune clé API côté navigateur)
  const orderId = `spk_demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const invoiceId = `${Math.floor(100000 + Math.random() * 900000)}`;
  const orders = readDemoSlickPayOrders();
  orders.unshift({
    orderId,
    invoiceId,
    directorId: input.directorId,
    directorName: `${input.prenom || ''} ${input.nom || ''}`.trim() || 'Directrice',
    crecheName: input.crecheName || 'Crèche',
    email: input.email || 'contact@rawdha.dz',
    telephone: input.telephone,
    planMonths: input.planMonths,
    amountDzd,
    couponCode: pricing.discount > 0 ? input.couponCode?.trim().toUpperCase() : undefined,
    currentEndDate: input.currentEndDate,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  writeDemoSlickPayOrders(orders.slice(0, 50));

  return {
    mode: 'demo_gateway',
    orderId,
    invoiceId,
    paymentUrl: `/abonnement?slickpay_order=${encodeURIComponent(orderId)}`,
    amountDzd,
    planMonths: input.planMonths,
  };
}

export async function completeDemoSlickPaySubscriptionOrder(
  orderId: string,
  cardType: 'Edahabia' | 'CIB' = 'Edahabia'
): Promise<SlickPayVerifyResult> {
  const orders = readDemoSlickPayOrders();
  const target = orders.find(item => item.orderId === orderId);
  if (!target) {
    throw new Error('Commande SlickPay introuvable.');
  }

  // Idempotence stricte : un second appel retourne le résultat déjà validé sans prolonger deux fois
  if (target.status === 'paid' && target.newEndDate) {
    return {
      status: 'paid',
      orderId: target.orderId,
      invoiceId: target.invoiceId,
      newEndDate: target.newEndDate,
      planMonths: target.planMonths,
      amountDzd: target.amountDzd,
      transactionRef: target.transactionRef,
    };
  }

  const newEndDate = computeExtendedSubscriptionDate(target.currentEndDate, target.planMonths);
  const transactionRef = `SLICKPAY-${cardType.toUpperCase()}-${target.invoiceId}`;
  const nowIso = new Date().toISOString();

  target.status = 'paid';
  target.newEndDate = newEndDate;
  target.transactionRef = transactionRef;
  writeDemoSlickPayOrders(orders);

  const renewalEntry: SubscriptionRenewalRequest = {
    id: `ren_spk_${target.orderId}`,
    directorId: target.directorId,
    directorName: target.directorName,
    crecheName: target.crecheName,
    email: target.email,
    telephone: target.telephone,
    planMonths: target.planMonths,
    amountDzd: target.amountDzd,
    couponCode: target.couponCode,
    paymentChannel: 'SlickPay',
    transactionRef,
    status: 'approved',
    createdAt: target.createdAt,
    reviewedAt: nowIso,
    reviewedBy: `SlickPay SATIM (${cardType})`,
  };

  const allLocal = readLocalQueue().filter(item => item.id !== renewalEntry.id);
  const next = [renewalEntry, ...allLocal].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await persistSubscriptionRenewals(next, target.directorId);

  clearPendingSlickPayOrder(target.orderId);

  emitSubscriptionActivated({
    directorId: target.directorId,
    newEndDate,
    planMonths: target.planMonths,
    amountDzd: target.amountDzd,
    orderId: target.orderId,
    transactionRef,
  });

  return {
    status: 'paid',
    orderId: target.orderId,
    invoiceId: target.invoiceId,
    newEndDate,
    planMonths: target.planMonths,
    amountDzd: target.amountDzd,
    transactionRef,
  };
}

export async function verifySlickPaySubscriptionOrder(
  orderId: string,
  directorId?: string
): Promise<SlickPayVerifyResult> {
  if (hasLiveSupabaseDb() && typeof (supabase as any)?.functions?.invoke === 'function') {
    const { data, error } = await (supabase as any).functions.invoke('slickpay-checkout', {
      body: { action: 'verify', orderId },
    });
    if (error || !data?.ok) {
      throw new Error(
        data?.error || (error instanceof Error ? error.message : 'Vérification SlickPay indisponible.')
      );
    }
    const status = (data.status === 'paid' || data.status === 'failed' ? data.status : 'pending') as
      | 'paid'
      | 'pending'
      | 'failed';
    const txRef = `SLICKPAY-${data.invoiceId || orderId}`;
    if (status === 'paid') {
      clearPendingSlickPayOrder(orderId);
      if (data.newEndDate && directorId) {
        emitSubscriptionActivated({
          directorId,
          newEndDate: String(data.newEndDate),
          planMonths: (Number(data.planMonths) as SubscriptionPlanMonths) || 1,
          amountDzd: Number(data.amountDzd || 1900),
          orderId,
          transactionRef: txRef,
        });
      }
    } else if (status === 'failed') {
      clearPendingSlickPayOrder(orderId);
    }
    return {
      status,
      orderId,
      invoiceId: data.invoiceId ? String(data.invoiceId) : undefined,
      newEndDate: data.newEndDate ? String(data.newEndDate) : undefined,
      planMonths: data.planMonths ? (Number(data.planMonths) as SubscriptionPlanMonths) : undefined,
      amountDzd: data.amountDzd ? Number(data.amountDzd) : undefined,
      transactionRef: status === 'paid' ? txRef : undefined,
      rejectionReason: data.rejectionReason ? String(data.rejectionReason) : undefined,
    };
  }

  const demoOrder = readDemoSlickPayOrders().find(item => item.orderId === orderId);
  if (!demoOrder) {
    clearPendingSlickPayOrder(orderId);
    return { status: 'failed', orderId, rejectionReason: 'Commande introuvable.' };
  }
  if (demoOrder.status === 'paid' || demoOrder.status === 'failed') {
    clearPendingSlickPayOrder(orderId);
  }
  return {
    status: demoOrder.status,
    orderId: demoOrder.orderId,
    invoiceId: demoOrder.invoiceId,
    newEndDate: demoOrder.newEndDate,
    planMonths: demoOrder.planMonths,
    amountDzd: demoOrder.amountDzd,
    transactionRef: demoOrder.transactionRef,
  };
}

/**
 * Simule l'arrivée asynchrone du Webhook serveur SlickPay en arrière-plan (ex. 3.5s après l'OTP SATIM),
 * même si la directrice change de page dans l'intervalle.
 */
export function scheduleDemoSlickPayBackgroundWebhook(
  checkout: SlickPayCheckoutResult,
  directorId: string,
  cardType: 'Edahabia' | 'CIB' = 'Edahabia',
  delayMs = 3200
): void {
  savePendingSlickPayOrder({
    ...checkout,
    directorId,
    createdAt: new Date().toISOString(),
  });
  const timer = setTimeout(() => {
    void completeDemoSlickPaySubscriptionOrder(checkout.orderId, cardType).catch(() => {});
  }, delayMs);
  (timer as unknown as { unref?: () => void }).unref?.();
}

/**
 * Surveille automatiquement une commande SlickPay en arrière-plan (Polling intelligent +
 * Supabase Realtime CDC sur `slickpay_subscription_orders` + reprise au focus de l'onglet).
 */
export function watchSlickPayOrderInBackground(params: {
  orderId: string;
  directorId: string;
  intervalMs?: number;
  maxAttempts?: number;
  onTick?: (attempt: number) => void;
  onResolved?: (result: SlickPayVerifyResult) => void;
}): () => void {
  const {
    orderId,
    directorId,
    intervalMs = 3000,
    maxAttempts = 25,
    onTick,
    onResolved,
  } = params;

  let disposed = false;
  let inFlight = false;
  let attempts = 0;

  const finish = (res: SlickPayVerifyResult) => {
    if (disposed) return;
    disposed = true;
    cleanup();
    onResolved?.(res);
  };

  const checkOnce = async () => {
    if (disposed || inFlight) return;
    inFlight = true;
    attempts += 1;
    onTick?.(attempts);
    try {
      const res = await verifySlickPaySubscriptionOrder(orderId, directorId);
      if (disposed) return;
      if (res.status === 'paid' || res.status === 'failed') {
        finish(res);
        return;
      }
      if (attempts >= maxAttempts) {
        disposed = true;
        cleanup();
      }
    } catch {
      // Ignorer erreur réseau transitoire, réessai au prochain cycle
    } finally {
      inFlight = false;
    }
  };

  const handleActivated = (ev: Event) => {
    const detail = (ev as CustomEvent<{
      orderId?: string;
      newEndDate?: string;
      planMonths?: SubscriptionPlanMonths;
      amountDzd?: number;
      transactionRef?: string;
    }>).detail;
    if (detail?.orderId === orderId && detail.newEndDate) {
      finish({
        status: 'paid',
        orderId,
        newEndDate: detail.newEndDate,
        planMonths: detail.planMonths,
        amountDzd: detail.amountDzd,
        transactionRef: detail.transactionRef,
      });
    }
  };

  const handleVisibilityOrFocus = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      void checkOnce();
    }
  };

  let realtimeChannel: any = null;
  if (hasLiveSupabaseDb() && typeof (supabase as any)?.channel === 'function') {
    try {
      realtimeChannel = (supabase as any)
        .channel(`slickpay-order-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'slickpay_subscription_orders',
            filter: `id=eq.${orderId}`,
          },
          (payload: any) => {
            const nextRow = payload?.new;
            if (nextRow?.status === 'paid' || nextRow?.status === 'failed') {
              void checkOnce();
            }
          }
        )
        .subscribe();
    } catch {
      realtimeChannel = null;
    }
  }

  const intervalId = setInterval(() => {
    void checkOnce();
  }, intervalMs);
  (intervalId as unknown as { unref?: () => void }).unref?.();

  if (typeof window !== 'undefined') {
    window.addEventListener('rawdha-subscription-activated', handleActivated);
    window.addEventListener('focus', handleVisibilityOrFocus);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
  }

  function cleanup() {
    clearInterval(intervalId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('rawdha-subscription-activated', handleActivated);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    }
    if (realtimeChannel && typeof (supabase as any)?.removeChannel === 'function') {
      try {
        void (supabase as any).removeChannel(realtimeChannel);
      } catch {
        // Ignore channel cleanup errors
      }
    }
  }

  // Première vérification immédiate
  void checkOnce();

  return () => {
    disposed = true;
    cleanup();
  };
}
