/**
 * Gantt Offline Cache
 *
 * IndexedDB storage for Gantt chart data to enable offline viewing.
 * Caches tasks, dependencies, and metadata per job/template.
 *
 * Architecture:
 * - Separate store from records-cache (gantt-specific data structure)
 * - 24-hour TTL for offline access
 * - Stores full Gantt data including dependencies
 * - Includes sync timestamp for "Last synced" indicator
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { GanttTask, GanttDependency, SmScheduleMaster } from "@/lib/gantt/types";

// =============================================================================
// Configuration
// =============================================================================

const DB_NAME = "teeem-gantt-cache";
const DB_VERSION = 1;
const STORE_NAME = "ganttData";

// TTL: 24 hours for offline access (longer than regular cache)
export const GANTT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// Types
// =============================================================================

export interface CachedGanttData {
  /** Unique key: "job-{jobId}" or "template-{templateId}" */
  cacheKey: string;
  /** Job ID (if mode is 'job') */
  jobId?: number;
  /** Template ID (if mode is 'template') */
  templateId?: number;
  /** Mode: 'job' or 'template' */
  mode: "job" | "template";
  /** Job/template name for display */
  name: string;
  /** Job code (for jobs) */
  jobCode?: string;
  /** Converted GanttTask array */
  tasks: GanttTask[];
  /** Dependencies between tasks */
  dependencies: GanttDependency[];
  /** Raw row data from API */
  rows: SmScheduleMaster[];
  /** Timestamp when data was cached */
  cachedAt: number;
  /** When the cache expires */
  expiresAt: number;
}

/**
 * Minimal job info for job list caching
 */
export interface CachedJobInfo {
  id: number;
  jobCode: string;
  name: string;
  /** Whether full Gantt data is cached for this job */
  hasGanttCache: boolean;
  /** When Gantt was last cached */
  ganttCachedAt?: number;
}

interface GanttCacheDB extends DBSchema {
  ganttData: {
    key: string;
    value: CachedGanttData;
    indexes: {
      "by-cachedAt": number;
      "by-mode": string;
    };
  };
  jobsList: {
    key: string; // "jobs-list"
    value: {
      key: string;
      jobs: CachedJobInfo[];
      cachedAt: number;
    };
  };
}

// =============================================================================
// Database Singleton
// =============================================================================

let dbPromise: Promise<IDBPDatabase<GanttCacheDB>> | null = null;

async function getDatabase(): Promise<IDBPDatabase<GanttCacheDB>> {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is not available in server-side rendering");
  }

  if (!dbPromise) {
    dbPromise = openDB<GanttCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        console.log(`[GanttCache] Upgrading database from v${oldVersion} to v${DB_VERSION}`);

        if (oldVersion < 1) {
          // Gantt data store
          const ganttStore = db.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
          ganttStore.createIndex("by-cachedAt", "cachedAt");
          ganttStore.createIndex("by-mode", "mode");

          // Jobs list store
          db.createObjectStore("jobsList", { keyPath: "key" });

          console.log("[GanttCache] Created ganttData and jobsList stores");
        }
      },
      blocked() {
        console.warn("[GanttCache] Database blocked - another tab may be using an older version");
      },
      blocking() {
        console.warn("[GanttCache] This tab is blocking a database upgrade in another tab");
      },
      terminated() {
        console.error("[GanttCache] Database connection terminated unexpectedly");
        dbPromise = null;
      },
    });
  }

  return dbPromise;
}

export function isGanttCacheAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.indexedDB;
  } catch {
    return false;
  }
}

// =============================================================================
// Cache Key Generation
// =============================================================================

export function getGanttCacheKey(mode: "job" | "template", id: number): string {
  return `${mode}-${id}`;
}

// =============================================================================
// Gantt Data Cache Operations
// =============================================================================

/**
 * Get cached Gantt data for a job or template
 */
export async function getGanttFromCache(
  mode: "job" | "template",
  id: number
): Promise<CachedGanttData | null> {
  if (!isGanttCacheAvailable()) return null;

  try {
    const db = await getDatabase();
    const cacheKey = getGanttCacheKey(mode, id);
    const data = await db.get(STORE_NAME, cacheKey);

    if (!data) {
      console.log(`[GanttCache] MISS: ${cacheKey}`);
      return null;
    }

    // Check TTL
    const now = Date.now();
    if (now > data.expiresAt) {
      await db.delete(STORE_NAME, cacheKey);
      console.log(`[GanttCache] EXPIRED: ${cacheKey}`);
      return null;
    }

    const age = Math.round((now - data.cachedAt) / 1000 / 60);
    console.log(`[GanttCache] HIT: ${cacheKey}, ${data.tasks.length} tasks, age: ${age}min`);
    return data;
  } catch (error) {
    console.warn("[GanttCache] Failed to read:", error);
    return null;
  }
}

/**
 * Store Gantt data in cache
 */
export async function setGanttInCache(
  mode: "job" | "template",
  id: number,
  name: string,
  tasks: GanttTask[],
  dependencies: GanttDependency[],
  rows: SmScheduleMaster[],
  jobCode?: string
): Promise<void> {
  if (!isGanttCacheAvailable()) return;

  try {
    const db = await getDatabase();
    const cacheKey = getGanttCacheKey(mode, id);
    const now = Date.now();

    // Serialize tasks - Date objects need special handling
    const serializedTasks = tasks.map(task => ({
      ...task,
      startDate: task.startDate.toISOString(),
      endDate: task.endDate.toISOString(),
    }));

    const data: CachedGanttData = {
      cacheKey,
      mode,
      name,
      tasks: serializedTasks as unknown as GanttTask[],
      dependencies,
      rows,
      cachedAt: now,
      expiresAt: now + GANTT_CACHE_TTL_MS,
      ...(mode === "job" ? { jobId: id, jobCode } : { templateId: id }),
    };

    await db.put(STORE_NAME, data);
    console.log(`[GanttCache] SET: ${cacheKey}, ${tasks.length} tasks`);

    // Update jobs list with cache status if this is a job
    if (mode === "job") {
      await updateJobCacheStatus(id, now);
    }
  } catch (error) {
    console.warn("[GanttCache] Failed to write:", error);
  }
}

/**
 * Delete cached Gantt data
 */
export async function deleteGanttFromCache(mode: "job" | "template", id: number): Promise<void> {
  if (!isGanttCacheAvailable()) return;

  try {
    const db = await getDatabase();
    const cacheKey = getGanttCacheKey(mode, id);
    await db.delete(STORE_NAME, cacheKey);
    console.log(`[GanttCache] DELETED: ${cacheKey}`);
  } catch (error) {
    console.warn("[GanttCache] Failed to delete:", error);
  }
}

/**
 * Get all cached Gantt entries (for listing available offline data)
 */
export async function getAllCachedGantt(): Promise<CachedGanttData[]> {
  if (!isGanttCacheAvailable()) return [];

  try {
    const db = await getDatabase();
    const all = await db.getAll(STORE_NAME);
    const now = Date.now();

    // Filter out expired entries
    return all.filter(entry => now <= entry.expiresAt);
  } catch (error) {
    console.warn("[GanttCache] Failed to get all:", error);
    return [];
  }
}

/**
 * Deserialize cached Gantt data (restore Date objects)
 */
export function deserializeGanttData(data: CachedGanttData): CachedGanttData {
  return {
    ...data,
    tasks: data.tasks.map(task => ({
      ...task,
      startDate: new Date(task.startDate as unknown as string),
      endDate: new Date(task.endDate as unknown as string),
    })),
  };
}

// =============================================================================
// Jobs List Cache Operations
// =============================================================================

const JOBS_LIST_KEY = "jobs-list";
const JOBS_LIST_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get cached jobs list (supervisor's assigned jobs)
 */
export async function getJobsListFromCache(): Promise<CachedJobInfo[] | null> {
  if (!isGanttCacheAvailable()) return null;

  try {
    const db = await getDatabase();
    const data = await db.get("jobsList", JOBS_LIST_KEY);

    if (!data) {
      console.log("[GanttCache] Jobs list MISS");
      return null;
    }

    // Check TTL
    const age = Date.now() - data.cachedAt;
    if (age > JOBS_LIST_TTL_MS) {
      console.log("[GanttCache] Jobs list EXPIRED");
      return null;
    }

    console.log(`[GanttCache] Jobs list HIT: ${data.jobs.length} jobs`);
    return data.jobs;
  } catch (error) {
    console.warn("[GanttCache] Failed to read jobs list:", error);
    return null;
  }
}

/**
 * Store jobs list in cache
 */
export async function setJobsListInCache(jobs: CachedJobInfo[]): Promise<void> {
  if (!isGanttCacheAvailable()) return;

  try {
    const db = await getDatabase();

    // Check which jobs have cached Gantt data
    const allGantt = await getAllCachedGantt();
    const cachedJobIds = new Set(
      allGantt
        .filter(g => g.mode === "job")
        .map(g => g.jobId)
    );

    const enrichedJobs = jobs.map(job => ({
      ...job,
      hasGanttCache: cachedJobIds.has(job.id),
      ganttCachedAt: allGantt.find(g => g.jobId === job.id)?.cachedAt,
    }));

    await db.put("jobsList", {
      key: JOBS_LIST_KEY,
      jobs: enrichedJobs,
      cachedAt: Date.now(),
    });

    console.log(`[GanttCache] Jobs list SET: ${jobs.length} jobs`);
  } catch (error) {
    console.warn("[GanttCache] Failed to write jobs list:", error);
  }
}

/**
 * Update a job's cache status in the jobs list
 */
async function updateJobCacheStatus(jobId: number, cachedAt: number): Promise<void> {
  if (!isGanttCacheAvailable()) return;

  try {
    const db = await getDatabase();
    const data = await db.get("jobsList", JOBS_LIST_KEY);

    if (data) {
      const updatedJobs = data.jobs.map(job =>
        job.id === jobId
          ? { ...job, hasGanttCache: true, ganttCachedAt: cachedAt }
          : job
      );

      await db.put("jobsList", {
        ...data,
        jobs: updatedJobs,
      });
    }
  } catch (error) {
    console.warn("[GanttCache] Failed to update job cache status:", error);
  }
}

// =============================================================================
// Cleanup & Stats
// =============================================================================

/**
 * Clean up expired cache entries
 */
export async function cleanupGanttCache(): Promise<number> {
  if (!isGanttCacheAvailable()) return 0;

  try {
    const db = await getDatabase();
    const now = Date.now();
    let deletedCount = 0;

    const tx = db.transaction(STORE_NAME, "readwrite");
    let cursor = await tx.store.openCursor();

    while (cursor) {
      if (now > cursor.value.expiresAt) {
        await cursor.delete();
        deletedCount++;
      }
      cursor = await cursor.continue();
    }

    await tx.done;

    if (deletedCount > 0) {
      console.log(`[GanttCache] Cleaned up ${deletedCount} expired entries`);
    }

    return deletedCount;
  } catch (error) {
    console.warn("[GanttCache] Failed to cleanup:", error);
    return 0;
  }
}

/**
 * Clear all Gantt cache data
 */
export async function clearGanttCache(): Promise<void> {
  if (!isGanttCacheAvailable()) return;

  try {
    const db = await getDatabase();
    await db.clear(STORE_NAME);
    await db.clear("jobsList");
    console.log("[GanttCache] ALL CLEARED");
  } catch (error) {
    console.warn("[GanttCache] Failed to clear:", error);
  }
}

/**
 * Get cache statistics
 */
export async function getGanttCacheStats(): Promise<{
  ganttEntries: number;
  totalTasks: number;
  jobsCached: number;
  templatesCached: number;
  oldestAge: number | null;
  totalSizeEstimate: string;
}> {
  if (!isGanttCacheAvailable()) {
    return {
      ganttEntries: 0,
      totalTasks: 0,
      jobsCached: 0,
      templatesCached: 0,
      oldestAge: null,
      totalSizeEstimate: "0 KB",
    };
  }

  try {
    const db = await getDatabase();
    const all = await db.getAll(STORE_NAME);

    const totalTasks = all.reduce((sum, entry) => sum + entry.tasks.length, 0);
    const jobsCached = all.filter(e => e.mode === "job").length;
    const templatesCached = all.filter(e => e.mode === "template").length;
    const oldestTimestamp = all.length > 0 ? Math.min(...all.map(e => e.cachedAt)) : null;
    const oldestAge = oldestTimestamp ? Date.now() - oldestTimestamp : null;

    // Rough size estimate (JSON string length)
    const sizeBytes = JSON.stringify(all).length;
    const sizeKB = sizeBytes / 1024;
    const totalSizeEstimate = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB.toFixed(0)} KB`;

    return {
      ganttEntries: all.length,
      totalTasks,
      jobsCached,
      templatesCached,
      oldestAge,
      totalSizeEstimate,
    };
  } catch (error) {
    console.warn("[GanttCache] Failed to get stats:", error);
    return {
      ganttEntries: 0,
      totalTasks: 0,
      jobsCached: 0,
      templatesCached: 0,
      oldestAge: null,
      totalSizeEstimate: "0 KB",
    };
  }
}
