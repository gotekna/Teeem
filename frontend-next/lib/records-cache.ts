/**
 * Records Cache - SSoT for loaded table data across navigation
 *
 * Problem: User loads 1000 records, clicks a row for detail, comes back - data is gone.
 *
 * Solution: Module-level cache that survives React re-renders and route changes.
 * Records are kept in memory for instant restoration when navigating back.
 *
 * Features:
 * - In-memory cache (no serialization, instant access)
 * - Per-foundation keying
 * - TTL-based expiration (5 minutes default)
 * - Automatic cleanup of expired entries
 * - Optional sessionStorage persistence for page refresh survival
 */

interface CachedRecords {
  records: Record<string, unknown>[];
  totalCount: number | null;
  hasMore: boolean;
  timestamp: number;
  cursor?: number; // Last cursor position for pagination
}

// Module-level cache - survives route changes
const recordsCache = new Map<string | number, CachedRecords>();

// Default TTL: 5 minutes (records can change, don't want stale data too long)
const DEFAULT_TTL_MS = 5 * 60 * 1000;

// Max age for sessionStorage: 30 minutes (longer since it's across refresh)
const SESSION_STORAGE_TTL_MS = 30 * 60 * 1000;

// Session storage key prefix
const STORAGE_PREFIX = 'teeem-records-cache-v1-';

/**
 * Get cached records for a foundation
 */
export function getCachedRecords(foundationId: string | number): CachedRecords | null {
  // Check memory cache first (instant)
  const memoryCache = recordsCache.get(foundationId);
  if (memoryCache) {
    const age = Date.now() - memoryCache.timestamp;
    if (age < DEFAULT_TTL_MS) {
      console.log(`[RecordsCache] HIT (memory): ${foundationId}, ${memoryCache.records.length} records, age: ${Math.round(age / 1000)}s`);
      return memoryCache;
    }
    // Expired - remove it
    recordsCache.delete(foundationId);
    console.log(`[RecordsCache] EXPIRED (memory): ${foundationId}`);
  }

  // Check sessionStorage (survives page refresh)
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${foundationId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as CachedRecords;
        const age = Date.now() - parsed.timestamp;
        if (age < SESSION_STORAGE_TTL_MS) {
          console.log(`[RecordsCache] HIT (session): ${foundationId}, ${parsed.records.length} records, age: ${Math.round(age / 1000)}s`);
          // Restore to memory cache for faster subsequent access
          recordsCache.set(foundationId, parsed);
          return parsed;
        }
        // Expired - remove it
        sessionStorage.removeItem(`${STORAGE_PREFIX}${foundationId}`);
        console.log(`[RecordsCache] EXPIRED (session): ${foundationId}`);
      }
    } catch (e) {
      console.warn('[RecordsCache] Failed to read from sessionStorage:', e);
    }
  }

  console.log(`[RecordsCache] MISS: ${foundationId}`);
  return null;
}

/**
 * Cache records for a foundation
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

  // Always store in memory (instant, no size limit concerns)
  recordsCache.set(foundationId, entry);
  console.log(`[RecordsCache] SET (memory): ${foundationId}, ${records.length} records`);

  // Try to persist to sessionStorage for page refresh survival
  // But only if the data isn't too large (avoid quota issues)
  if (typeof window !== 'undefined') {
    try {
      const json = JSON.stringify(entry);
      // Only persist if under 2MB (sessionStorage is typically 5MB total)
      if (json.length < 2 * 1024 * 1024) {
        sessionStorage.setItem(`${STORAGE_PREFIX}${foundationId}`, json);
        console.log(`[RecordsCache] SET (session): ${foundationId}, ${Math.round(json.length / 1024)}KB`);
      } else {
        console.log(`[RecordsCache] SKIP (session): ${foundationId}, too large (${Math.round(json.length / 1024)}KB)`);
      }
    } catch (e) {
      // Quota exceeded or other error - that's fine, memory cache still works
      console.warn('[RecordsCache] Failed to write to sessionStorage:', e);
    }
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
 */
export function clearCachedRecords(foundationId: string | number): void {
  recordsCache.delete(foundationId);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(`${STORAGE_PREFIX}${foundationId}`);
    } catch {
      // Ignore
    }
  }
  console.log(`[RecordsCache] CLEARED: ${foundationId}`);
}

/**
 * Clear all cached records
 */
export function clearAllCachedRecords(): void {
  recordsCache.clear();
  if (typeof window !== 'undefined') {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch {
      // Ignore
    }
  }
  console.log('[RecordsCache] ALL CLEARED');
}

/**
 * Remove a specific record from cache (after delete)
 */
export function removeFromCache(foundationId: string | number, recordId: string | number): void {
  const cached = recordsCache.get(foundationId);
  if (cached) {
    cached.records = cached.records.filter(r => r.id !== recordId);
    recordsCache.set(foundationId, cached);
    // Also update sessionStorage
    if (typeof window !== 'undefined') {
      try {
        const json = JSON.stringify(cached);
        if (json.length < 2 * 1024 * 1024) {
          sessionStorage.setItem(`${STORAGE_PREFIX}${foundationId}`, json);
        }
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Remove multiple records from cache (after bulk delete/merge)
 */
export function removeMultipleFromCache(foundationId: string | number, recordIds: (string | number)[]): void {
  const cached = recordsCache.get(foundationId);
  if (cached) {
    const idsSet = new Set(recordIds);
    cached.records = cached.records.filter(r => !idsSet.has(r.id as string | number));
    recordsCache.set(foundationId, cached);
    // Also update sessionStorage
    if (typeof window !== 'undefined') {
      try {
        const json = JSON.stringify(cached);
        if (json.length < 2 * 1024 * 1024) {
          sessionStorage.setItem(`${STORAGE_PREFIX}${foundationId}`, json);
        }
      } catch {
        // Ignore
      }
    }
  }
}
