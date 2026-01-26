/**
 * useGanttWithOffline - Gantt Data Manager with Offline Support
 *
 * Wraps useGanttDataManager with offline caching capabilities:
 * - Automatically caches Gantt data to IndexedDB when online
 * - Serves cached data when offline
 * - Provides sync status indicators
 *
 * Usage:
 *   const { gantt, offline } = useGanttWithOffline({
 *     mode: 'job',
 *     jobId: 123,
 *     jobName: 'Smith Residence',
 *     jobCode: 'J-001'
 *   });
 */

import * as React from "react";
import { useAtomValue } from "jotai";
import { useGanttDataManager, type GanttDataManagerConfig } from "./useGanttDataManager";
import {
  isOnlineAtom,
  useGanttOfflineCache,
  setGanttInCache,
  getGanttFromCache,
  deserializeGanttData,
} from "@/lib/offline";

export interface UseGanttWithOfflineConfig extends GanttDataManagerConfig {
  /** Job name (for cache display) */
  jobName?: string;
  /** Job code (for jobs) */
  jobCode?: string;
  /** Template name (for templates) */
  templateName?: string;
}

export function useGanttWithOffline(config: UseGanttWithOfflineConfig) {
  const { mode, jobId, templateId, jobName, jobCode, templateName, ...ganttConfig } = config;
  const isOnline = useAtomValue(isOnlineAtom);

  // Get the ID based on mode
  const id = mode === "job" ? jobId : templateId;
  const name = mode === "job" ? (jobName || `Job ${jobId}`) : (templateName || `Template ${templateId}`);

  // Initialize the standard Gantt data manager
  const gantt = useGanttDataManager({ mode, jobId, templateId, ...ganttConfig });

  // Initialize offline cache hook
  const offlineCache = useGanttOfflineCache({
    mode,
    id,
    name,
    jobCode,
  });

  // Track if we're loading from cache vs API
  const [loadingFromCache, setLoadingFromCache] = React.useState(false);
  const [loadedFromCache, setLoadedFromCache] = React.useState(false);

  // When online and data is loaded, cache it
  React.useEffect(() => {
    if (
      isOnline &&
      !gantt.loading &&
      id &&
      gantt.tasks.length > 0
    ) {
      // Cache the data for offline use
      setGanttInCache(
        mode,
        id,
        name,
        gantt.tasks,
        gantt.dependencies,
        gantt.rows,
        jobCode
      );
      setLoadedFromCache(false);
    }
  }, [isOnline, gantt.loading, gantt.tasks, gantt.dependencies, gantt.rows, mode, id, name, jobCode]);

  // When offline and no data, try to load from cache
  React.useEffect(() => {
    async function loadFromOfflineCache() {
      if (!isOnline && gantt.tasks.length === 0 && !gantt.loading && id) {
        setLoadingFromCache(true);
        try {
          const cached = await getGanttFromCache(mode, id);
          if (cached) {
            const data = deserializeGanttData(cached);
            // Note: We can't directly set the gantt state since it's managed by useGanttDataManager
            // Instead, the page component should handle this case
            console.log("[GanttWithOffline] Loaded from cache:", data.tasks.length, "tasks");
            setLoadedFromCache(true);
          }
        } catch (error) {
          console.warn("[GanttWithOffline] Failed to load from cache:", error);
        } finally {
          setLoadingFromCache(false);
        }
      }
    }

    loadFromOfflineCache();
  }, [isOnline, gantt.tasks.length, gantt.loading, mode, id]);

  // Enhanced loadData that tries cache first when offline
  const loadDataWithOffline = React.useCallback(async (options?: { silent?: boolean }) => {
    if (!id) return;

    // If online, load from API (normal flow)
    if (isOnline) {
      return gantt.loadData(options);
    }

    // If offline, try to load from cache
    console.log("[GanttWithOffline] Offline - attempting cache load");
    const cached = await getGanttFromCache(mode, id);
    if (cached) {
      console.log("[GanttWithOffline] Serving cached data");
      // The gantt hook will show "no data" but we return cached data
      return deserializeGanttData(cached);
    }

    // No cache available - the standard hook will handle the error state
    return gantt.loadData(options);
  }, [isOnline, mode, id, gantt.loadData]);

  return {
    // Standard Gantt data manager return
    gantt: {
      ...gantt,
      loadData: loadDataWithOffline,
    },

    // Offline-specific state
    offline: {
      isOnline,
      isOfflineCached: offlineCache.isOfflineCached,
      lastSyncedAt: offlineCache.lastSyncedAt,
      lastSyncedDisplay: offlineCache.lastSyncedDisplay,
      isStale: offlineCache.isStale,
      loadingFromCache,
      loadedFromCache,
      // Method to explicitly save to cache
      saveToCache: () =>
        offlineCache.saveToCache(gantt.tasks, gantt.dependencies, gantt.rows),
      // Method to load from cache
      loadFromCache: offlineCache.loadFromCache,
    },
  };
}

export type UseGanttWithOfflineResult = ReturnType<typeof useGanttWithOffline>;
