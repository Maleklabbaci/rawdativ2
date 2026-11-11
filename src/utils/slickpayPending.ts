export type SlickPayPendingPlanMonths = 1 | 3 | 12;

export interface PendingSlickPayOrder {
  orderId: string;
  invoiceId: string;
  directorId: string;
  paymentUrl: string;
  amountDzd: number;
  planMonths: SlickPayPendingPlanMonths;
  mode: 'live' | 'demo_gateway';
  createdAt: string;
}

const PENDING_SLICKPAY_ORDER_KEY = 'rawdha_pending_slickpay_order_v1';
const PENDING_SLICKPAY_TTL_MS = 2 * 60 * 60 * 1000; // 2 heures

export function getPendingSlickPayOrder(directorId?: string | null): PendingSlickPayOrder | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_SLICKPAY_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSlickPayOrder;
    if (!parsed?.orderId) return null;
    if (directorId && parsed.directorId && parsed.directorId !== directorId) return null;
    const ageMs = Date.now() - new Date(parsed.createdAt || 0).getTime();
    if (Number.isFinite(ageMs) && ageMs > PENDING_SLICKPAY_TTL_MS) {
      localStorage.removeItem(PENDING_SLICKPAY_ORDER_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePendingSlickPayOrder(order: PendingSlickPayOrder): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PENDING_SLICKPAY_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Ignore storage quota errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rawdha-slickpay-pending-changed', { detail: order }));
  }
}

export function clearPendingSlickPayOrder(orderId?: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (orderId) {
      const current = getPendingSlickPayOrder();
      if (current && current.orderId !== orderId) return;
    }
    localStorage.removeItem(PENDING_SLICKPAY_ORDER_KEY);
  } catch {
    // Ignore storage errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rawdha-slickpay-pending-changed', { detail: null }));
  }
}
