// Only allowlisted classifications leave the browser; never transmit raw messages.
export type Diagnostic = 'unknown'|'permission'|'authentication'|'network'|'timeout'|'conflict'|'validation'|'not_found'|'type_error'|'reference_error'|'syntax_error'|'range_error';
export function classifyDiagnostic(value: unknown): Diagnostic {
  if (!value || typeof value !== 'object') return 'unknown';
  const e = value as { name?: unknown; code?: unknown; status?: unknown; message?: unknown };
  const names: Record<string, Diagnostic> = {TypeError:'type_error',ReferenceError:'reference_error',SyntaxError:'syntax_error',RangeError:'range_error'};
  const code = typeof e.code === 'string' ? e.code : '';
  const status = typeof e.status === 'number' ? e.status : 0;
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  if (status === 401 || code === 'PGRST301') return 'authentication';
  if (status === 403 || code === '42501') return 'permission';
  if (status === 409 || code === '23505') return 'conflict';
  if (status === 404 || code === 'PGRST116') return 'not_found';
  if (status === 400 || code === '23514' || code === '23502') return 'validation';
  if (code === '57014' || /délai dépassé|timed?\s*out|timeout/.test(message)) return 'timeout';
  if (/failed to fetch|networkerror|network request failed/.test(message)) return 'network';
  return names[typeof e.name === 'string' ? e.name : ''] || 'unknown';
}
