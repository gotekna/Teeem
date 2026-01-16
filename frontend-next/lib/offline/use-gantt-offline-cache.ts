/**
 * Gantt Offline Cache Hook
 *
 * Provides offline caching support for Gantt data.
 * Use this hook alongside useGanttDataManager for offline-first behavior.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { isOnlineAtom } from "./offline-atoms";
import {
  getGanttFromCache,
  setGanttInCache,
  deserializeGanttData,
  type CachedGanttData,
  GANTT_CACHE_TTL_MS,
} from "./gantt-cache";
import type { GanttTask, GanttDependency, SmScheduleMaster } from "@/lib/gantt/types";

export interface UseGanttOfflineCacheOptions {
  mode: "job" | "template";
  id?: number;
  /** Name to display for this job/template */
  name?: string;
  /** Job code (for jobs only) */
  jobCode?: string;
  /** Whether to auto-fetch from cache when offline */
  autoFetchOffline?: boolean;
}

export interface UseGanttOfflineCacheResult {
  /** Whether data is being served from offline cache */
  isOfflineCached: boolean;
  /** When the data was last synced (null if never) */
  lastSyncedAt: Date | null;
  /** Human-readable "X mins ago" string */
  lastSyncedDisplay: string;
  /** Whether the cache is expired but still usable */
  isStale: boolean;
  /** Load data from cache (returns null if not cached) */
  loadFromCache: () => Promise<CachedGanttData | null>;
  /** Save data to cache */
  saveToCache: (
    tasks: GanttTask[],
    dependencies: GanttDependency[],
    rows: SmScheduleMaster[]
  ) => Promise<void>;
  /** Whether we're currently online */
  isOnline: boolean;
}

/**
 * Hook for managing Gantt offline cache
 */
export function useGanttOfflineCache(
  options: UseGanttOfflineCacheOptions
): UseGanttOfflineCacheResult {
  const { mode, id, name = "", jobCode } = options;
  const isOnline = useAtomValue(isOnlineAtom);

  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [isStale, setIsStale] = useState(false);

  // Calculate last synced display string
  const lastSyncedDisplay = useLastSyncedDisplay(lastSyncedAt);

  // Check cache status on mount and when id changes
  useEffect(() => {
    if (!id) return;

    const checkCache = async () => {
      const cached = await getGanttFromCache(mode, id);
      if (cached) {
        setLastSyncedAt(new Date(cached.cachedAt));
        setIsOfflineCached(true);
        // Check if stale (past half the TTL)
        const age = Date.now() - cached.cachedAt;
        setIsStale(age > GANTT_CACHE_TTL_MS / 2);
      } else {
        setLastSyncedAt(null);
        setIsOfflineCached(false);
        setIsStale(false);
      }
    };

    checkCache();
  }, [mode, id]);

  // Load from cache
  const loadFromCache = useCallback(async (): Promise<CachedGanttData | null> => {
    if (!id) return null;

    const cached = await getGanttFromCache(mode, id);
    if (cached) {
      setLastSyncedAt(new Date(cached.cachedAt));
      setIsOfflineCached(true);
      return deserializeGanttData(cached);
    }
    return null;
  }, [mode, id]);

  // Save to cache
  const saveToCache = useCallback(
    async (
      tasks: GanttTask[],
      dependencies: GanttDependency[],
      rows: SmScheduleMaster[]
    ): Promise<void> => {
      if (!id) return;

      await setGanttInCache(mode, id, name, tasks, dependencies, rows, jobCode);
      setLastSyncedAt(new Date());
      setIsOfflineCached(true);
      setIsStale(false);
    },
    [mode, id, name, jobCode]
  );

  return {
    isOfflineCached,
    lastSyncedAt,
    lastSyncedDisplay,
    isStale,
    loadFromCache,
    saveToCache,
    isOnline,
  };
}

/**
 * Hook to get human-readable "last synced" display
 */
function useLastSyncedDisplay(lastSyncedAt: Date | null): string {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!lastSyncedAt) {
      setDisplay("Never synced");
      return;
    }

    const updateDisplay = () => {
      const now = Date.now();
      const diff = now - lastSyncedAt.getTime();
      const mins = Math.floor(diff / 60000);

      if (mins < 1) {
        setDisplay("Just now");
      } else if (mins === 1) {
        setDisplay("1 min ago");
      } else if (mins < 60) {
        setDisplay(`${mins} mins ago`);
      } else {
        const hours = Math.floor(mins / 60);
        if (hours === 1) {
          setDisplay("1 hour ago");
        } else if (hours < 24) {
          setDisplay(`${hours} hours ago`);
        } else {
          const days = Math.floor(hours / 24);
          setDisplay(`${days} day${days > 1 ? "s" : ""} ago`);
        }
      }
    };

    updateDisplay();
    // Update every minute
    const interval = setInterval(updateDisplay, 60000);
    return () => clearInterval(interval);
  }, [lastSyncedAt]);

  return display;
}

/**
 * Hook to auto-cache Gantt data when loaded online
 * Use this in conjunction with useGanttDataManager
 */
export function useAutoGanttCache(
  options: UseGanttOfflineCacheOptions & {
    tasks: GanttTask[];
    dependencies: GanttDependency[];
    rows: SmScheduleMaster[];
    loading: boolean;
  }
): void {
  const { mode, id, name, jobCode, tasks, dependencies, rows, loading } = options;
  const isOnline = useAtomValue(isOnlineAtom);

  useEffect(() => {
    // Only cache when:
    // 1. Online (fresh data from server)
    // 2. Not loading
    // 3. Have data to cache
    // 4. Have a valid ID
    if (!isOnline || loading || !id || tasks.length === 0) {
      return;
    }

    // Debounce to avoid caching during rapid state changes
    const timer = setTimeout(() => {
      setGanttInCache(mode, id, name || "", tasks, dependencies, rows, jobCode);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOnline, loading, mode, id, name, jobCode, tasks, dependencies, rows]);
}
