/**
 * Records Cache - IndexedDB Storage
 *
 * Ultra solution for large dataset caching (Pricebook: 5,285 items, etc.)
 *
 * Architecture:
 * - L1: Memory cache (instant, lost on refresh)
 * - L2: IndexedDB (50MB+, survives refresh, 1 hour TTL)
 *
 * This replaces sessionStorage for large tables that exceed the 2MB limit.
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";

// =============================================================================
// Configuration
// =============================================================================

const DB_NAME = "teeem-records-cache";
const DB_VERSION = 1;
const STORE_NAME = "foundationRecords";

// TTL: 1 hour for IndexedDB (longer than memory since it's persistent)
export const IDB_CACHE_TTL_MS = 60 * 60 * 1000;

// =============================================================================
// Types
// =============================================================================

export interface CachedFoundationData {
  foundationId: string;
  records: Record<string, unknown>[];
  totalCount: number | null;
  hasMore: boolean;
  timestamp: number;
  cursor?: number;
}

interface RecordsCacheDB extends DBSchema {
  foundationRecords: {
    key: string;
    value: CachedFoundationData;
    indexes: {
      "by-timestamp": number;
    };
  };
}

// =============================================================================
// Database Singleton
// =============================================================================

let dbPromise: Promise<IDBPDatabase<RecordsCacheDB>> | null = null;

/**
 * Get or create the database connection.
 */
async function getDatabase(): Promise<IDBPDatabase<RecordsCacheDB>> {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is not available in server-side rendering");
  }

  if (!dbPromise) {
    dbPromise = openDB<RecordsCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        console.log(`[RecordsCacheIDB] Upgrading database from v${oldVersion} to v${DB_VERSION}`);

        if (oldVersion < 1) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "foundationId" });
          store.createIndex("by-timestamp", "timestamp");
          console.log("[RecordsCacheIDB] Created foundationRecords store");
        }
      },
      blocked() {
        console.warn("[RecordsCacheIDB] Database blocked - another tab may be using an older version");
      },
      blocking() {
        console.warn("[RecordsCacheIDB] This tab is blocking a database upgrade in another tab");
      },
      terminated() {
        console.error("[RecordsCacheIDB] Database connection terminated unexpectedly");
        dbPromise = null;
      },
    });
  }

  return dbPromise;
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.indexedDB;
  } catch {
    return false;
  }
}

// =============================================================================
// Cache Operations
// =============================================================================

/**
 * Get cached records from IndexedDB
 */
export async function getFromIDB(foundationId: string | number): Promise<CachedFoundationData | null> {
  if (!isIndexedDBAvailable()) return null;

  try {
    const db = await getDatabase();
    const key = String(foundationId);
    const data = await db.get(STORE_NAME, key);

    if (!data) {
      return null;
    }

    // Check TTL
    const age = Date.now() - data.timestamp;
    if (age > IDB_CACHE_TTL_MS) {
      // Expired - delete and return null
      await db.delete(STORE_NAME, key);
      console.log(`[RecordsCacheIDB] EXPIRED: ${foundationId}, age: ${Math.round(age / 1000 / 60)}min`);
      return null;
    }

    console.log(`[RecordsCacheIDB] HIT: ${foundationId}, ${data.records.length} records, age: ${Math.round(age / 1000)}s`);
    return data;
  } catch (error) {
    console.warn("[RecordsCacheIDB] Failed to read:", error);
    return null;
  }
}

/**
 * Store records in IndexedDB
 */
export async function setInIDB(
  foundationId: string | number,
  records: Record<string, unknown>[],
  totalCount: number | null,
  hasMore: boolean,
  cursor?: number
): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  try {
    const db = await getDatabase();
    const key = String(foundationId);

    const data: CachedFoundationData = {
      foundationId: key,
      records,
      totalCount,
      hasMore,
      timestamp: Date.now(),
      cursor,
    };

    await db.put(STORE_NAME, data);
    console.log(`[RecordsCacheIDB] SET: ${foundationId}, ${records.length} records`);
  } catch (error) {
    console.warn("[RecordsCacheIDB] Failed to write:", error);
  }
}

/**
 * Delete cached records for a foundation
 */
export async function deleteFromIDB(foundationId: string | number): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  try {
    const db = await getDatabase();
    await db.delete(STORE_NAME, String(foundationId));
    console.log(`[RecordsCacheIDB] DELETED: ${foundationId}`);
  } catch (error) {
    console.warn("[RecordsCacheIDB] Failed to delete:", error);
  }
}

/**
 * Clear all cached records
 */
export async function clearAllIDB(): Promise<void> {
  if (!isIndexedDBAvailable()) return;

  try {
    const db = await getDatabase();
    await db.clear(STORE_NAME);
    console.log("[RecordsCacheIDB] ALL CLEARED");
  } catch (error) {
    console.warn("[RecordsCacheIDB] Failed to clear:", error);
  }
}

/**
 * Clean up expired entries (call periodically)
 */
export async function cleanupExpiredIDB(): Promise<number> {
  if (!isIndexedDBAvailable()) return 0;

  try {
    const db = await getDatabase();
    const cutoff = Date.now() - IDB_CACHE_TTL_MS;

    const tx = db.transaction(STORE_NAME, "readwrite");
    const index = tx.store.index("by-timestamp");

    let deletedCount = 0;
    let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff));

    while (cursor) {
      await cursor.delete();
      deletedCount++;
      cursor = await cursor.continue();
    }

    await tx.done;

    if (deletedCount > 0) {
      console.log(`[RecordsCacheIDB] Cleaned up ${deletedCount} expired entries`);
    }

    return deletedCount;
  } catch (error) {
    console.warn("[RecordsCacheIDB] Failed to cleanup:", error);
    return 0;
  }
}

/**
 * Get cache statistics (for debugging)
 */
export async function getIDBStats(): Promise<{ count: number; totalRecords: number; oldestAge: number | null }> {
  if (!isIndexedDBAvailable()) return { count: 0, totalRecords: 0, oldestAge: null };

  try {
    const db = await getDatabase();
    const all = await db.getAll(STORE_NAME);

    const totalRecords = all.reduce((sum, entry) => sum + entry.records.length, 0);
    const oldestTimestamp = all.length > 0
      ? Math.min(...all.map(e => e.timestamp))
      : null;
    const oldestAge = oldestTimestamp ? Date.now() - oldestTimestamp : null;

    return {
      count: all.length,
      totalRecords,
      oldestAge,
    };
  } catch (error) {
    console.warn("[RecordsCacheIDB] Failed to get stats:", error);
    return { count: 0, totalRecords: 0, oldestAge: null };
  }
}
