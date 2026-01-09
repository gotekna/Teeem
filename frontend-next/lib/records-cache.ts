/**
 * Records Cache - SSoT for loaded table data across navigation
 *
 * Problem: User loads 1000 records, clicks a row for detail, comes back - data is gone.
 *
 * Solution: Two-tier caching strategy:
 * - L1: Memory cache (instant, lost on refresh)
 * - L2: IndexedDB (50MB+, survives refresh, 1 hour TTL)
 *
 * Features:
 * - In-memory L1 cache (instant access, no serialization)
 * - IndexedDB L2 cache (persistent, handles large datasets like Pricebook 5,285 items)
 * - Per-foundation keying
 * - TTL-based expiration
 * - Automatic L2 → L1 restoration on cache hit
 */

import { CACHE_TTL_RECORDS } from './constants/cache-constants';
import { getFromIDB, setInIDB, deleteFromIDB, clearAllIDB, isIndexedDBAvailable } from './records-cache-idb';

interface CachedRecords {
  records: Record<string, unknown>[];
  totalCount: number | null;
  hasMore: boolean;
  timestamp: number;
  cursor?: number; // Last cursor position for pagination
}

// Module-level cache - survives route changes
const recordsCache = new Map<string | number, CachedRecords>();

// SSoT: Cache TTL for memory cache (L1)
const DEFAULT_TTL_MS = CACHE_TTL_RECORDS;

// Log deduplication - prevents flooding console with repeated identical logs
const recentLogs = new Map<string, { count: number; lastTime: number }>();
const LOG_DEDUPE_MS = 1000; // Dedupe identical logs within 1 second

function dedupedLog(message: string): void {
  const now = Date.now();
  const existing = recentLogs.get(message);

  if (existing && (now - existing.lastTime) < LOG_DEDUPE_MS) {
    // Same message within dedupe window - increment count, don't log
    existing.count++;
    existing.lastTime = now;
    return;
  }

  // Log any suppressed duplicates from the previous batch
  if (existing && existing.count > 1) {
    console.log(`[RecordsCache] (${existing.count - 1} identical logs suppressed)`);
  }

  // Log new message and reset counter
  console.log(message);
  recentLogs.set(message, { count: 1, lastTime: now });

  // Clean up old entries (prevent memory leak)
  if (recentLogs.size > 50) {
    const cutoff = now - LOG_DEDUPE_MS * 10;
    for (const [key, value] of recentLogs) {
      if (value.lastTime < cutoff) {
        recentLogs.delete(key);
      }
    }
  }
}

/**
 * Get cached records for a foundation (sync - memory only)
 * Use getCachedRecordsAsync for IndexedDB fallback
 */
export function getCachedRecords(foundationId: string | number): CachedRecords | null {
  // Check memory cache (instant, sync)
  const memoryCache = recordsCache.get(foundationId);
  if (memoryCache) {
    const age = Date.now() - memoryCache.timestamp;
    if (age < DEFAULT_TTL_MS) {
      dedupedLog(`[RecordsCache] HIT (L1 memory): ${foundationId}, ${memoryCache.records.length} records, age: ${Math.round(age / 1000)}s`);
      return memoryCache;
    }
    // Expired - remove it
    recordsCache.delete(foundationId);
    dedupedLog(`[RecordsCache] EXPIRED (L1 memory): ${foundationId}`);
  }

  dedupedLog(`[RecordsCache] MISS (L1 memory): ${foundationId}`);
  return null;
}

/**
 * Get cached records with IndexedDB fallback (async)
 * Checks L1 (memory) then L2 (IndexedDB)
 * On L2 hit, restores to L1 for subsequent sync access
 */
export async function getCachedRecordsAsync(foundationId: string | number): Promise<CachedRecords | null> {
  // Check L1 memory cache first (instant)
  const memoryCache = getCachedRecords(foundationId);
  if (memoryCache) {
    return memoryCache;
  }

  // Check L2 IndexedDB (async, survives page refresh)
  if (isIndexedDBAvailable()) {
    const idbData = await getFromIDB(foundationId);
    if (idbData) {
      // Restore to L1 memory cache for subsequent sync access
      const cachedEntry: CachedRecords = {
        records: idbData.records,
        totalCount: idbData.totalCount,
        hasMore: idbData.hasMore,
        timestamp: idbData.timestamp,
        cursor: idbData.cursor,
      };
      recordsCache.set(foundationId, cachedEntry);
      dedupedLog(`[RecordsCache] HIT (L2 IndexedDB→L1): ${foundationId}, ${idbData.records.length} records`);
      return cachedEntry;
    }
  }

  dedupedLog(`[RecordsCache] MISS (all layers): ${foundationId}`);
  return null;
}

/**
 * Cache records for a foundation
 * Writes to both L1 (memory) and L2 (IndexedDB)
 */
export function setCachedRecords(
  foundationId: string | number,
  records: Record<string, unknown>[],
  totalCount: number | null,
  hasMore: boolean,
  cursor?: number
): void {
  const entry: CachedRecords = {
    records,
    totalCount,
    hasMore,
    timestamp: Date.now(),
    cursor,
  };

  // L1: Always store in memory (instant, no size limit)
  recordsCache.set(foundationId, entry);
  dedupedLog(`[RecordsCache] SET (L1 memory): ${foundationId}, ${records.length} records`);

  // L2: Persist to IndexedDB (async, fire-and-forget, 50MB+ capacity)
  // This handles large datasets like Pricebook (5,285 items)
  if (isIndexedDBAvailable()) {
    setInIDB(foundationId, records, totalCount, hasMore, cursor).catch(e => {
      console.warn('[RecordsCache] Failed to write to IndexedDB:', e);
    });
  }
}

/**
 * Update cached records (append new records from pagination)
 */
export function appendCachedRecords(
  foundationId: string | number,
  newRecords: Record<string, unknown>[],
  hasMore: boolean,
  cursor?: number
): void {
  const existing = getCachedRecords(foundationId);
  if (!existing) {
    // No existing cache - just set the new records
    setCachedRecords(foundationId, newRecords, null, hasMore, cursor);
    return;
  }

  // Deduplicate by ID when appending
  const existingIds = new Set(existing.records.map(r => r.id));
  const uniqueNewRecords = newRecords.filter(r => !existingIds.has(r.id));

  const mergedRecords = [...existing.records, ...uniqueNewRecords];

  setCachedRecords(
    foundationId,
    mergedRecords,
    existing.totalCount,
    hasMore,
    cursor
  );
}

/**
 * Clear cache for a foundation (after data changes like merge/delete)
 * Clears both L1 (memory) and L2 (IndexedDB)
 */
export function clearCachedRecords(foundationId: string | number): void {
  // L1: Clear memory
  recordsCache.delete(foundationId);

  // L2: Clear IndexedDB (async)
  if (isIndexedDBAvailable()) {
    deleteFromIDB(foundationId).catch(() => {/* ignore */});
  }

  dedupedLog(`[RecordsCache] CLEARED: ${foundationId}`);
}

/**
 * Clear all cached records
 * Clears both L1 (memory) and L2 (IndexedDB)
 */
export function clearAllCachedRecords(): void {
  // L1: Clear all memory
  recordsCache.clear();

  // L2: Clear all IndexedDB (async)
  if (isIndexedDBAvailable()) {
    clearAllIDB().catch(() => {/* ignore */});
  }

  dedupedLog('[RecordsCache] ALL CLEARED');
}

/**
 * Remove a specific record from cache (after delete)
 * Updates both L1 (memory) and L2 (IndexedDB)
 */
export function removeFromCache(foundationId: string | number, recordId: string | number): void {
  const cached = recordsCache.get(foundationId);
  if (cached) {
    cached.records = cached.records.filter(r => r.id !== recordId);
    recordsCache.set(foundationId, cached);

    // L2: Update IndexedDB with modified records
    if (isIndexedDBAvailable()) {
      setInIDB(foundationId, cached.records, cached.totalCount, cached.hasMore, cached.cursor)
        .catch(() => {/* ignore */});
    }
  }
}

/**
 * Remove multiple records from cache (after bulk delete/merge)
 * Updates both L1 (memory) and L2 (IndexedDB)
 */
export function removeMultipleFromCache(foundationId: string | number, recordIds: (string | number)[]): void {
  const cached = recordsCache.get(foundationId);
  if (cached) {
    const idsSet = new Set(recordIds);
    cached.records = cached.records.filter(r => !idsSet.has(r.id as string | number));
    recordsCache.set(foundationId, cached);

    // L2: Update IndexedDB with modified records
    if (isIndexedDBAvailable()) {
      setInIDB(foundationId, cached.records, cached.totalCount, cached.hasMore, cached.cursor)
        .catch(() => {/* ignore */});
    }
  }
}
