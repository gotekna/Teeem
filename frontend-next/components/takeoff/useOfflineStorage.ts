"use client";

import { useCallback, useEffect, useState } from "react";
import type { TakeoffMeasurement, PageScale, GeometryData } from "./types";

// =============================================================================
// Types
// =============================================================================

interface OfflineMeasurement {
  id: string;  // Temporary ID (uuid)
  measurement_type: TakeoffMeasurement["measurement_type"];
  value: number;
  unit: string;
  category: string | null;
  page_number: number;
  display_label: string | null;
  color: string;
  is_deduction: boolean;
  geometry_data: GeometryData;
  layer_id: number | null;
  pricebook_item_id: number | null;
  pixel_value: number;
  // Sync metadata
  synced: boolean;
  server_id: number | null;  // Set after sync
  created_offline_at: string;
  plan_id?: string;
  docsort_item_id?: string;
}

interface OfflinePageScale {
  id: string;
  page_number: number;
  reference_length_mm: number;
  calibration_line: { x1: number; y1: number; x2: number; y2: number };
  canvas_width: number;
  canvas_height: number;
  synced: boolean;
  server_id: number | null;
  plan_id?: string;
  docsort_item_id?: string;
}

interface OfflinePdfCache {
  id: string;  // plan_id or docsort_item_id
  url: string;
  blob: Blob;
  cached_at: string;
}

interface SyncStatus {
  pendingMeasurements: number;
  pendingScales: number;
  lastSyncAttempt: string | null;
  lastSuccessfulSync: string | null;
  isOnline: boolean;
}

// =============================================================================
// IndexedDB Setup
// =============================================================================

const DB_NAME = "teeem_takeoff_offline";
const DB_VERSION = 1;

const STORES = {
  measurements: "measurements",
  pageScales: "page_scales",
  pdfCache: "pdf_cache",
} as const;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Measurements store
      if (!db.objectStoreNames.contains(STORES.measurements)) {
        const measurementStore = db.createObjectStore(STORES.measurements, { keyPath: "id" });
        measurementStore.createIndex("synced", "synced", { unique: false });
        measurementStore.createIndex("plan_id", "plan_id", { unique: false });
        measurementStore.createIndex("docsort_item_id", "docsort_item_id", { unique: false });
      }

      // Page scales store
      if (!db.objectStoreNames.contains(STORES.pageScales)) {
        const scaleStore = db.createObjectStore(STORES.pageScales, { keyPath: "id" });
        scaleStore.createIndex("synced", "synced", { unique: false });
        scaleStore.createIndex("plan_id", "plan_id", { unique: false });
        scaleStore.createIndex("docsort_item_id", "docsort_item_id", { unique: false });
      }

      // PDF cache store
      if (!db.objectStoreNames.contains(STORES.pdfCache)) {
        db.createObjectStore(STORES.pdfCache, { keyPath: "id" });
      }
    };
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getStore(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode = "readonly"
): Promise<IDBObjectStore> {
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

function generateId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// =============================================================================
// Hook
// =============================================================================

interface UseOfflineStorageOptions {
  planId?: string;
  docsortItemId?: string;
}

export function useOfflineStorage(options: UseOfflineStorageOptions = {}) {
  const { planId, docsortItemId } = options;

  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pendingMeasurements: 0,
    pendingScales: 0,
    lastSyncAttempt: null,
    lastSuccessfulSync: null,
    isOnline: true,
  });
  const [db, setDb] = useState<IDBDatabase | null>(null);

  // Initialize database
  useEffect(() => {
    openDatabase()
      .then(setDb)
      .catch((err) => console.error("Failed to open offline database:", err));
  }, []);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update sync status when online status changes
  useEffect(() => {
    setSyncStatus((prev) => ({ ...prev, isOnline }));
  }, [isOnline]);

  // =============================================================================
  // Measurement Operations
  // =============================================================================

  // Save measurement offline
  const saveMeasurementOffline = useCallback(
    async (measurement: Omit<OfflineMeasurement, "id" | "synced" | "server_id" | "created_offline_at">) => {
      if (!db) return null;

      const offlineMeasurement: OfflineMeasurement = {
        ...measurement,
        id: generateId(),
        synced: false,
        server_id: null,
        created_offline_at: new Date().toISOString(),
        plan_id: planId,
        docsort_item_id: docsortItemId,
      };

      const store = await getStore(db, STORES.measurements, "readwrite");
      return new Promise<OfflineMeasurement>((resolve, reject) => {
        const request = store.add(offlineMeasurement);
        request.onsuccess = () => {
          updateSyncStatus();
          resolve(offlineMeasurement);
        };
        request.onerror = () => reject(request.error);
      });
    },
    [db, planId, docsortItemId]
  );

  // Get all offline measurements for current plan/item
  const getOfflineMeasurements = useCallback(async (): Promise<OfflineMeasurement[]> => {
    if (!db) return [];

    const store = await getStore(db, STORES.measurements);
    const index = planId
      ? store.index("plan_id")
      : docsortItemId
        ? store.index("docsort_item_id")
        : null;

    if (!index) return [];

    const key = planId || docsortItemId;
    return new Promise((resolve, reject) => {
      const request = index.getAll(key);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }, [db, planId, docsortItemId]);

  // Mark measurement as synced
  const markMeasurementSynced = useCallback(
    async (offlineId: string, serverId: number) => {
      if (!db) return;

      const store = await getStore(db, STORES.measurements, "readwrite");
      const request = store.get(offlineId);

      request.onsuccess = () => {
        const measurement = request.result as OfflineMeasurement;
        if (measurement) {
          measurement.synced = true;
          measurement.server_id = serverId;
          store.put(measurement);
          updateSyncStatus();
        }
      };
    },
    [db]
  );

  // Delete offline measurement
  const deleteOfflineMeasurement = useCallback(
    async (offlineId: string) => {
      if (!db) return;

      const store = await getStore(db, STORES.measurements, "readwrite");
      return new Promise<void>((resolve, reject) => {
        const request = store.delete(offlineId);
        request.onsuccess = () => {
          updateSyncStatus();
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    },
    [db]
  );

  // =============================================================================
  // Page Scale Operations
  // =============================================================================

  // Save page scale offline
  const savePageScaleOffline = useCallback(
    async (scale: Omit<OfflinePageScale, "id" | "synced" | "server_id">) => {
      if (!db) return null;

      const offlineScale: OfflinePageScale = {
        ...scale,
        id: generateId(),
        synced: false,
        server_id: null,
        plan_id: planId,
        docsort_item_id: docsortItemId,
      };

      const store = await getStore(db, STORES.pageScales, "readwrite");
      return new Promise<OfflinePageScale>((resolve, reject) => {
        const request = store.add(offlineScale);
        request.onsuccess = () => {
          updateSyncStatus();
          resolve(offlineScale);
        };
        request.onerror = () => reject(request.error);
      });
    },
    [db, planId, docsortItemId]
  );

  // Get offline page scales
  const getOfflinePageScales = useCallback(async (): Promise<OfflinePageScale[]> => {
    if (!db) return [];

    const store = await getStore(db, STORES.pageScales);
    const index = planId
      ? store.index("plan_id")
      : docsortItemId
        ? store.index("docsort_item_id")
        : null;

    if (!index) return [];

    const key = planId || docsortItemId;
    return new Promise((resolve, reject) => {
      const request = index.getAll(key);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }, [db, planId, docsortItemId]);

  // =============================================================================
  // PDF Cache Operations
  // =============================================================================

  // Cache PDF for offline use
  const cachePdf = useCallback(
    async (url: string, blob: Blob) => {
      if (!db) return;

      const cacheId = planId || docsortItemId;
      if (!cacheId) return;

      const cache: OfflinePdfCache = {
        id: cacheId,
        url,
        blob,
        cached_at: new Date().toISOString(),
      };

      const store = await getStore(db, STORES.pdfCache, "readwrite");
      return new Promise<void>((resolve, reject) => {
        const request = store.put(cache);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
    [db, planId, docsortItemId]
  );

  // Get cached PDF
  const getCachedPdf = useCallback(async (): Promise<OfflinePdfCache | null> => {
    if (!db) return null;

    const cacheId = planId || docsortItemId;
    if (!cacheId) return null;

    const store = await getStore(db, STORES.pdfCache);
    return new Promise((resolve, reject) => {
      const request = store.get(cacheId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }, [db, planId, docsortItemId]);

  // Check if PDF is cached
  const isPdfCached = useCallback(async (): Promise<boolean> => {
    const cached = await getCachedPdf();
    return cached !== null;
  }, [getCachedPdf]);

  // =============================================================================
  // Sync Operations
  // =============================================================================

  // Update sync status counts
  const updateSyncStatus = useCallback(async () => {
    if (!db) return;

    const measurementStore = await getStore(db, STORES.measurements);
    const scaleStore = await getStore(db, STORES.pageScales);

    const measurementIndex = measurementStore.index("synced");
    const scaleIndex = scaleStore.index("synced");

    const pendingMeasurementsRequest = measurementIndex.count(IDBKeyRange.only(false));
    const pendingScalesRequest = scaleIndex.count(IDBKeyRange.only(false));

    pendingMeasurementsRequest.onsuccess = () => {
      setSyncStatus((prev) => ({
        ...prev,
        pendingMeasurements: pendingMeasurementsRequest.result,
      }));
    };

    pendingScalesRequest.onsuccess = () => {
      setSyncStatus((prev) => ({
        ...prev,
        pendingScales: pendingScalesRequest.result,
      }));
    };
  }, [db]);

  // Get all unsynced items
  const getUnsyncedItems = useCallback(async () => {
    if (!db) return { measurements: [], scales: [] };

    const measurementStore = await getStore(db, STORES.measurements);
    const scaleStore = await getStore(db, STORES.pageScales);

    const measurements = await new Promise<OfflineMeasurement[]>((resolve, reject) => {
      const request = measurementStore.index("synced").getAll(IDBKeyRange.only(false));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    const scales = await new Promise<OfflinePageScale[]>((resolve, reject) => {
      const request = scaleStore.index("synced").getAll(IDBKeyRange.only(false));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    return { measurements, scales };
  }, [db]);

  // Record sync attempt
  const recordSyncAttempt = useCallback((success: boolean) => {
    const now = new Date().toISOString();
    setSyncStatus((prev) => ({
      ...prev,
      lastSyncAttempt: now,
      lastSuccessfulSync: success ? now : prev.lastSuccessfulSync,
    }));
  }, []);

  // Initialize - update sync status on mount
  useEffect(() => {
    if (db) {
      updateSyncStatus();
    }
  }, [db, updateSyncStatus]);

  return {
    // State
    isOnline,
    syncStatus,
    isReady: db !== null,

    // Measurement operations
    saveMeasurementOffline,
    getOfflineMeasurements,
    markMeasurementSynced,
    deleteOfflineMeasurement,

    // Page scale operations
    savePageScaleOffline,
    getOfflinePageScales,

    // PDF cache operations
    cachePdf,
    getCachedPdf,
    isPdfCached,

    // Sync operations
    getUnsyncedItems,
    recordSyncAttempt,
    updateSyncStatus,
  };
}

// =============================================================================
// Export Types
// =============================================================================

export type { OfflineMeasurement, OfflinePageScale, OfflinePdfCache, SyncStatus };
