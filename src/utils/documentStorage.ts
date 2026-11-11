import { supabase } from '../supabase';
import type { Enfant } from '../types';
import { parseDataUrl, type ChildDocumentKey, type StoredChildDocument } from './documentPdf';

export type RawdhaStorageBucket = 'child-documents' | 'subscription-proofs';

const STORAGE_URI_PREFIX = 'storage://';
const memoryByteCache = new Map<string, { bytes: Uint8Array; mimeType: string }>();

function rememberCached(uri: string, payload: { bytes: Uint8Array; mimeType: string }) {
  if (memoryByteCache.size > 40) {
    const firstKey = memoryByteCache.keys().next().value;
    if (firstKey) memoryByteCache.delete(firstKey);
  }
  memoryByteCache.set(uri, payload);
}

export function isStorageUri(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith(STORAGE_URI_PREFIX);
}

export function parseStorageUri(uri: string): { bucket: string; path: string } | null {
  if (!isStorageUri(uri)) return null;
  const rest = uri.slice(STORAGE_URI_PREFIX.length);
  const slashIndex = rest.indexOf('/');
  if (slashIndex <= 0 || slashIndex === rest.length - 1) return null;
  const bucket = rest.slice(0, slashIndex).trim();
  const path = rest.slice(slashIndex + 1).trim();
  if (!bucket || !path || path.includes('..')) return null;
  return { bucket, path };
}

function hasLiveSupabaseStorage(): boolean {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  if (env.DEV && env.VITE_ARENA_DEMO === 'true') return false;
  const injectedMock = Boolean((globalThis as { __rawdatiSupabaseClient__?: unknown }).__rawdatiSupabaseClient__);
  const configuredUrl = String(env.VITE_SUPABASE_URL || '');
  if (!injectedMock && (!configuredUrl || configuredUrl.includes('preview.invalid'))) return false;
  const storage = (supabase as unknown as { storage?: { from?: unknown } })?.storage;
  return Boolean(storage && typeof storage.from === 'function');
}

function sanitizeSegment(raw: string): string {
  return (raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'item';
}

export async function uploadBytesToSupabaseStorage(options: {
  bucket: RawdhaStorageBucket;
  path: string;
  bytes: Uint8Array;
  mimeType: string;
}): Promise<string | null> {
  if (!hasLiveSupabaseStorage()) return null;
  try {
    const storageApi = (supabase as any).storage.from(options.bucket);
    if (!storageApi || typeof storageApi.upload !== 'function') return null;
    const blob = new Blob([options.bytes], { type: options.mimeType || 'application/pdf' });
    const { error } = await storageApi.upload(options.path, blob, {
      contentType: options.mimeType || 'application/pdf',
      upsert: true,
    });
    if (error) return null;
    const uri = `${STORAGE_URI_PREFIX}${options.bucket}/${options.path}`;
    rememberCached(uri, { bytes: options.bytes, mimeType: options.mimeType || 'application/pdf' });
    return uri;
  } catch {
    return null;
  }
}

export async function resolveStoredDocumentPayload(
  contenu?: string | null,
  fallbackMime = 'application/pdf'
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  if (!contenu) return null;

  if (contenu.startsWith('data:')) {
    const parsed = parseDataUrl(contenu);
    if (!parsed) return null;
    return { bytes: parsed.bytes, mimeType: parsed.mimeType || fallbackMime };
  }

  const parsedUri = parseStorageUri(contenu);
  if (!parsedUri) return null;

  const cached = memoryByteCache.get(contenu);
  if (cached) return cached;

  if (!hasLiveSupabaseStorage()) return null;

  try {
    const storageApi = (supabase as any).storage.from(parsedUri.bucket);
    if (!storageApi || typeof storageApi.download !== 'function') return null;
    const { data, error } = await storageApi.download(parsedUri.path);
    if (error || !data) return null;
    const ab = await data.arrayBuffer();
    const payload = {
      bytes: new Uint8Array(ab),
      mimeType: (data.type && data.type !== 'application/octet-stream' ? data.type : fallbackMime),
    };
    rememberCached(contenu, payload);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Déporte automatiquement les PDF Base64 d'un dossier enfant vers le bucket privé
 * `child-documents` lorsque Supabase Storage est actif, avec repli transparent
 * sur le format local si le bucket n'est pas encore provisionné.
 */
export async function offloadChildDocumentsToStorage(
  crecheId: string,
  enfantId: string,
  files?: Enfant['documentsFichiers']
): Promise<Enfant['documentsFichiers']> {
  if (!files || !crecheId || !enfantId || !hasLiveSupabaseStorage()) {
    return files;
  }

  const keys = Object.keys(files) as ChildDocumentKey[];
  if (keys.length === 0) return files;

  const nextFiles: NonNullable<Enfant['documentsFichiers']> = { ...files };
  const safeCreche = sanitizeSegment(crecheId);
  const safeChild = sanitizeSegment(enfantId);

  for (const key of keys) {
    const item = files[key] as StoredChildDocument | undefined;
    if (!item?.contenu || isStorageUri(item.contenu)) continue;
    const parsed = parseDataUrl(item.contenu);
    if (!parsed) continue;
    const ext = (item.type || parsed.mimeType).includes('pdf') ? 'pdf' : 'jpg';
    const path = `${safeCreche}/${safeChild}/${sanitizeSegment(key)}-${Date.now()}.${ext}`;
    const uri = await uploadBytesToSupabaseStorage({
      bucket: 'child-documents',
      path,
      bytes: parsed.bytes,
      mimeType: item.type || parsed.mimeType || 'application/pdf',
    });
    if (uri) {
      nextFiles[key] = {
        ...item,
        contenu: uri,
      };
    }
  }

  return nextFiles;
}
