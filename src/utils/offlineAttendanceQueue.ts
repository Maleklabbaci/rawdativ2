import { useCallback, useEffect, useState } from 'react';
import type { Presence } from '../types';

export interface QueuedAttendanceItem {
  queueId: string;
  mode: 'add' | 'update';
  existingId?: string;
  existingSnapshot?: Presence;
  payload: Omit<Presence, 'id'>;
  queuedAt: string;
}

function getQueueKey(crecheId?: string): string {
  return `rawdha_offline_presences_${crecheId || 'default'}`;
}

export function readOfflineAttendanceQueue(crecheId?: string): QueuedAttendanceItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getQueueKey(crecheId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeOfflineAttendanceQueue(crecheId: string | undefined, items: QueuedAttendanceItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(getQueueKey(crecheId));
    } else {
      window.localStorage.setItem(getQueueKey(crecheId), JSON.stringify(items));
    }
  } catch {
    // Ignore quota errors
  }
}

export function useOfflineAttendanceQueue({
  crecheId,
  addPresence,
  updatePresence,
  onSynced,
}: {
  crecheId?: string;
  addPresence: (p: Omit<Presence, 'id'>) => Promise<void>;
  updatePresence: (id: string, p: Partial<Presence>, prev?: Presence) => Promise<void>;
  onSynced?: (count: number) => void;
}) {
  const [queue, setQueue] = useState<QueuedAttendanceItem[]>(() => readOfflineAttendanceQueue(crecheId));
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine === false : false
  );
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setQueue(readOfflineAttendanceQueue(crecheId));
  }, [crecheId]);

  const enqueueAttendance = useCallback(
    (item: Omit<QueuedAttendanceItem, 'queueId' | 'queuedAt'>) => {
      setQueue(prev => {
        // Un seul pointage en attente par enfant + date
        const filtered = prev.filter(
          q => !(q.payload.enfantId === item.payload.enfantId && q.payload.date === item.payload.date)
        );
        const next: QueuedAttendanceItem[] = [
          ...filtered,
          {
            ...item,
            queueId: `off-pres-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            queuedAt: new Date().toISOString(),
          },
        ];
        writeOfflineAttendanceQueue(crecheId, next);
        return next;
      });
    },
    [crecheId]
  );

  const flushQueue = useCallback(async () => {
    const current = readOfflineAttendanceQueue(crecheId);
    if (current.length === 0) return 0;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;

    setIsSyncing(true);
    const remaining: QueuedAttendanceItem[] = [];
    let syncedCount = 0;

    try {
      for (const item of current) {
        try {
          if (item.mode === 'update' && item.existingId) {
            await updatePresence(item.existingId, item.payload, item.existingSnapshot);
          } else {
            await addPresence(item.payload);
          }
          syncedCount += 1;
        } catch {
          remaining.push(item);
        }
      }
      writeOfflineAttendanceQueue(crecheId, remaining);
      setQueue(remaining);
      if (syncedCount > 0) {
        onSynced?.(syncedCount);
      }
      return syncedCount;
    } finally {
      setIsSyncing(false);
    }
  }, [addPresence, crecheId, onSynced, updatePresence]);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      void flushQueue();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [flushQueue]);

  return {
    queue,
    isOffline,
    isSyncing,
    enqueueAttendance,
    flushQueue,
  };
}
