import { useEffect, useState } from 'react';

export function useIsMobileViewport(maxWidthPx = 767): boolean {
  const query = `(max-width: ${maxWidthPx}px)`;
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return Boolean(window.matchMedia(query).matches);
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(Boolean(mql.matches));
    onChange();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    if (typeof mql.addListener === 'function') {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, [query]);

  return isMobile;
}

export function normalizeTelHref(raw?: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `tel:${cleaned}`;
}

export function normalizeWhatsAppNumber(raw?: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  let normalized = digits;
  if (normalized.startsWith('00213')) normalized = normalized.slice(2);
  else if (normalized.startsWith('0') && normalized.length === 10) normalized = `213${normalized.slice(1)}`;
  else if (normalized.length === 9 && /^[567]/.test(normalized)) normalized = `213${normalized}`;
  return /^213[567]\d{8}$/.test(normalized) ? normalized : null;
}
