import { supabase } from '../supabase';
import { classifyDiagnostic } from './diagnosticCategories';
import { safeCodeLocation } from './codeErrorLocation';
type Kind = 'page_view' | 'data_failure' | 'js_error' | 'async_error';
const pages = new Set(['dashboard','enfants','admissions','community','classes','presences','paiements','achats','personnel','activites','repas','admin','logs','comptes','notifications','communication','demarrage','aide','support','rapports','parametres','abonnement']);
let lastEvent = ''; let lastTime = 0;
// No error text, stack, URLs, form contents, identifiers or document data are transmitted.
export function recordApplicationEvent(kind: Kind, page: string, operation?: string, error?: unknown) {
  if (import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true') return;
  const safePage = pages.has(page) ? page : 'unknown';
  const key = `${kind}:${safePage}:${operation || ''}`; const now = Date.now();
  if (key === lastEvent && now - lastTime < 3000) return;
  lastEvent = key; lastTime = now;
  void Promise.resolve(supabase.rpc('rawdha_record_application_event', { p_kind: kind, p_page: safePage, p_operation: operation || null, p_diagnostic: kind === 'js_error' || kind === 'async_error' || kind === 'data_failure' ? classifyDiagnostic(error) : null })).catch(() => undefined);
}

export function recordCodeError(page: string, event: ErrorEvent) {
  if (import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true') return;
  const safePage = pages.has(page) ? page : 'unknown';
  const key = `js_error:${safePage}`; const now=Date.now();
  if (key === lastEvent && now-lastTime < 3000) return;
  lastEvent=key; lastTime=now;
  const location = safeCodeLocation(event.filename || '', event.lineno, window.location.origin);
  void Promise.resolve(supabase.rpc('rawdha_record_code_error', { p_page:safePage, p_diagnostic:classifyDiagnostic(event.error), p_source:location.source, p_line:location.line })).catch(() => undefined);
}
