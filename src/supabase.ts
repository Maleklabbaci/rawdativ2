import { createClient } from '@supabase/supabase-js';

// ⚠️ REMPLACE ces deux valeurs par celles de TON projet Supabase
// (Supabase Dashboard -> Project Settings -> API)
const SUPABASE_URL = 'https://bbhocbfcjhccabqkngxt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaG9jYmZjamhjY2FicWtuZ3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzQwMzIsImV4cCI6MjA5NzM1MDAzMn0.NU111QoDU_MsTG9CSI2K0WpJyPk1KmGSN_UCjb9RqT4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    const { data, error } = await supabase.from(collectionName).select('id, data');
    if (error) throw error;
    return (data || []).map(row => ({ ...(row.data as object), id: row.id })) as T[];
  } catch (err) {
    logError(err, OperationType.LIST, collectionName);
    return [];
  }
}

export async function getCollectionDocument<T>(collectionName: string, id: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from(collectionName)
      .select('id, data')
      .eq('id', id)
      .maybeSingle();
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
    const { error } = await supabase
      .from(collectionName)
      .insert({ id, data: cleanedData });
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
    const { error } = await supabase
      .from(collectionName)
      .upsert({ id, data: cleanedData });
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
    const { data: existing, error: fetchError } = await supabase
      .from(collectionName)
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;

    const mergedData = { ...((existing?.data as object) || {}), ...partialData };
    const { error } = await supabase
      .from(collectionName)
      .update({ data: mergedData })
      .eq('id', id);
    if (error) throw error;
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
    const { error } = await supabase.from(collectionName).delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    logError(err, OperationType.DELETE, `${collectionName}/${id}`);
    throw err;
  }
}
