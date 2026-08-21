import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ✅ FIX: Use environment variables instead of hardcoded keys
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safety check
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '❌ MISSING ENVIRONMENT VARIABLES\n' +
    'Add to your .env file:\n' +
    'VITE_SUPABASE_URL=your_url\n' +
    'VITE_SUPABASE_ANON_KEY=your_key'
  );
  if (import.meta.env.PROD) throw new Error('Supabase config missing!');
}

type SupabaseClientInstance = SupabaseClient<any>;

type SupabaseGlobal = typeof globalThis & {
  __rawdatiSupabaseClient__?: SupabaseClientInstance;
};

const runtimeGlobal = globalThis as SupabaseGlobal;
export const supabase = runtimeGlobal.__rawdatiSupabaseClient__ ?? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // La session est conservée dans le stockage local du navigateur entre les reloads.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

if (import.meta.env.DEV) runtimeGlobal.__rawdatiSupabaseClient__ = supabase;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function logError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('Supabase Error: ', JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  }));
}

// Une table indisponible ne doit jamais bloquer toute l’application.
// Les appels réels peuvent continuer en arrière-plan, mais l’UI récupère la main
// après ce délai et affiche les données disponibles ou un état vide exploitable.
const READ_TIMEOUT_MS = 7_000;

function withReadTimeout<T>(promise: PromiseLike<T>, path: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Délai dépassé pour ${path}`)), READ_TIMEOUT_MS);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

type SupabaseResponseLike = {
  error?: { status?: number; code?: string; message?: string } | null;
};

function isAuthSessionError(error: SupabaseResponseLike['error']): boolean {
  return Boolean(
    error && (
      error.status === 401
      || error.code === 'PGRST301'
      || /jwt|token|session/i.test(error.message || '')
    )
  );
}

async function withAuthRetry<T extends SupabaseResponseLike>(request: () => PromiseLike<T>): Promise<T> {
  const firstResult = await request();
  if (!isAuthSessionError(firstResult.error)) return firstResult;

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) return firstResult;
  return request();
}

export async function callSupabaseRpc<T = unknown>(
  functionName: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: { status?: number; code?: string; message?: string } | null }> {
  return withAuthRetry(() => supabase.rpc(functionName, args)) as Promise<{ data: T | null; error: { status?: number; code?: string; message?: string } | null }>;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2);
}

/**
 * Generic functions mirroring the old Firestore-style API.
 * Each "collection" is a real Postgres table with two columns: id (text) and data (jsonb).
 * This keeps the rest of the app (DbContext.tsx, etc.) almost untouched.
 */
export async function getCollectionData<T>(collectionName: string): Promise<T[]> {
  try {
    const { data, error } = await withReadTimeout(
      withAuthRetry(() => supabase.from(collectionName).select('id, data')),
      collectionName,
    );
    if (error) throw error;
    return (data || []).map(row => ({ ...(row.data as object), id: row.id })) as T[];
  } catch (err) {
    logError(err, OperationType.LIST, collectionName);
    return [];
  }
}

export async function getCollectionDocument<T>(collectionName: string, id: string): Promise<T | null> {
  try {
    const { data, error } = await withReadTimeout(
      withAuthRetry(() => supabase
        .from(collectionName)
        .select('id, data')
        .eq('id', id)
        .maybeSingle()),
      `${collectionName}/${id}`,
    );
    if (error) throw error;
    if (!data) return null;
    return { ...(data.data as object), id: data.id } as T;
  } catch (err) {
    logError(err, OperationType.GET, `${collectionName}/${id}`);
    return null;
  }
}

export async function addCollectionDocument<T extends Record<string, any>>(
  collectionName: string,
  data: T
): Promise<string> {
  try {
    const { id: providedId, ...cleanedData } = data;
    const id = providedId || generateId();
    const { error } = await withAuthRetry(() => supabase
      .from(collectionName)
      .insert({ id, data: cleanedData }));
    if (error) throw error;
    return id;
  } catch (err) {
    logError(err, OperationType.CREATE, collectionName);
    throw err;
  }
}

export async function setCollectionDocument<T extends { id: string }>(
  collectionName: string,
  id: string,
  data: T
): Promise<void> {
  try {
    const { id: _, ...cleanedData } = data;
    const { error } = await withAuthRetry(() => supabase
      .from(collectionName)
      .upsert({ id, data: cleanedData }));
    if (error) throw error;
  } catch (err) {
    logError(err, OperationType.WRITE, `${collectionName}/${id}`);
    throw err;
  }
}

export async function updateCollectionDocument<T>(
  collectionName: string,
  id: string,
  partialData: Partial<T>
): Promise<void> {
  try {
    // Merge with existing data since Postgres jsonb columns are replaced wholesale on update.
    const { data: existing, error: fetchError } = await withAuthRetry(() => supabase
      .from(collectionName)
      .select('data')
      .eq('id', id)
      .maybeSingle());
    if (fetchError) throw fetchError;

    const mergedData = { ...((existing?.data as object) || {}), ...partialData };
    const { count, error } = await withAuthRetry(() => supabase
      .from(collectionName)
      .update({ data: mergedData }, { count: 'exact' })
      .eq('id', id));
    if (error) throw error;
    if (count !== 1) throw new Error(`Document introuvable ou modification non autorisée: ${collectionName}/${id}`);
  } catch (err) {
    logError(err, OperationType.UPDATE, `${collectionName}/${id}`);
    throw err;
  }
}

export async function deleteCollectionDocument(
  collectionName: string,
  id: string
): Promise<void> {
  try {
    const { count, error } = await withAuthRetry(() => supabase
      .from(collectionName)
      .delete({ count: 'exact' })
      .eq('id', id));
    if (error) throw error;
    if (count !== 1) throw new Error(`Document introuvable ou suppression non autorisée: ${collectionName}/${id}`);
  } catch (err) {
    logError(err, OperationType.DELETE, `${collectionName}/${id}`);
    throw err;
  }
}
