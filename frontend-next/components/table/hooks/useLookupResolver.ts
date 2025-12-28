/**
 * useLookupResolver Hook
 *
 * Automatically resolves lookup column values from raw IDs to { id, display } objects.
 * This fixes the SSoT violation where 43+ pages pass custom entries with raw IDs
 * instead of using Foundation API's auto-resolution.
 *
 * When entries have raw numeric values for lookup columns, this hook:
 * 1. Detects which columns need resolution (column_type === 'lookup' with lookup_foundation_id)
 * 2. Collects unique IDs across all entries for each lookup column
 * 3. Batch fetches display values from lookup foundations
 * 4. Transforms entries to include { id, display } objects
 *
 * @example
 * const resolvedEntries = useLookupResolver(entries, columns);
 * // If entries had { trade: 14 }, resolvedEntries will have { trade: { id: 14, display: "CARPENTER" } }
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import type { TableColumn } from '../types';

type EntryValue = unknown;
type EntryRecord = { id: number | string; [key: string]: EntryValue };

interface LookupValue {
  id: number | string;
  display: string;
}

interface LookupCache {
  [foundationId: string]: {
    [id: string]: string; // id -> display name
  };
}

/**
 * Check if a value needs lookup resolution (is a raw ID, not already resolved)
 */
function needsResolution(value: EntryValue): boolean {
  if (value === null || value === undefined || value === '') return false;

  // Already resolved as object with display
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if ('display' in obj || 'display_value' in obj || 'name' in obj) {
      return false;
    }
  }

  // Raw number or numeric string needs resolution
  if (typeof value === 'number') return true;
  if (typeof value === 'string' && /^\d+$/.test(value)) return true;

  return false;
}

/**
 * Get the numeric ID from a value
 */
function extractId(value: EntryValue): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10);
  return null;
}

export function useLookupResolver<T extends EntryRecord>(
  entries: T[] | undefined,
  columns: TableColumn[] | undefined | null
): T[] {
  const [lookupCache, setLookupCache] = useState<LookupCache>({});
  const [isResolving, setIsResolving] = useState(false);
  const fetchedFoundationsRef = useRef<Set<string>>(new Set());

  // Identify lookup columns that have lookup_foundation_id
  const lookupColumns = useMemo(() => {
    if (!columns) return [];
    return columns.filter(col =>
      (col.column_type === 'lookup' || col.column_type === 'relation') &&
      col.lookup_foundation_id
    );
  }, [columns]);

  // Collect IDs that need resolution for each lookup foundation
  const idsToFetch = useMemo(() => {
    if (!entries || entries.length === 0 || lookupColumns.length === 0) {
      return new Map<number, Set<number>>();
    }

    const idsByFoundation = new Map<number, Set<number>>();

    for (const col of lookupColumns) {
      const foundationId = col.lookup_foundation_id!;

      for (const entry of entries) {
        const value = entry[col.key];
        if (needsResolution(value)) {
          const id = extractId(value);
          if (id !== null) {
            if (!idsByFoundation.has(foundationId)) {
              idsByFoundation.set(foundationId, new Set());
            }
            idsByFoundation.get(foundationId)!.add(id);
          }
        }
      }
    }

    return idsByFoundation;
  }, [entries, lookupColumns]);

  // Fetch lookup values for all foundations that need resolution
  useEffect(() => {
    if (idsToFetch.size === 0) return;

    const fetchLookups = async () => {
      setIsResolving(true);
      const newCache: LookupCache = { ...lookupCache };

      for (const [foundationId, ids] of idsToFetch) {
        const cacheKey = String(foundationId);

        // Skip if we've already fetched this foundation
        if (fetchedFoundationsRef.current.has(cacheKey)) continue;

        // Filter out IDs we already have in cache
        const idsToFetchNow = Array.from(ids).filter(id =>
          !newCache[cacheKey]?.[String(id)]
        );

        if (idsToFetchNow.length === 0) continue;

        try {
          // Fetch records from the lookup foundation
          const response = await api.get<{
            success: boolean;
            records: Array<{ id: number; name?: string; display_name?: string; title?: string }>;
          }>(`/api/v1/foundations/${foundationId}/records`, {
            params: {
              ids: idsToFetchNow.join(','),
              per_page: idsToFetchNow.length
            }
          });

          if (response?.success && response.records) {
            if (!newCache[cacheKey]) {
              newCache[cacheKey] = {};
            }

            // Find the display column from column config
            const col = lookupColumns.find(c => c.lookup_foundation_id === foundationId);
            const displayCol = col?.lookup_display_column || 'name';

            for (const record of response.records) {
              const display =
                (record as Record<string, unknown>)[displayCol] as string ||
                record.display_name ||
                record.name ||
                record.title ||
                `#${record.id}`;
              newCache[cacheKey][String(record.id)] = String(display);
            }

            fetchedFoundationsRef.current.add(cacheKey);
          }
        } catch (error) {
          console.warn(`[useLookupResolver] Failed to fetch lookups for foundation ${foundationId}:`, error);
        }
      }

      setLookupCache(newCache);
      setIsResolving(false);
    };

    fetchLookups();
  }, [idsToFetch, lookupColumns]); // Don't include lookupCache to avoid infinite loop

  // Transform entries with resolved lookup values
  const resolvedEntries = useMemo((): T[] => {
    if (!entries || entries.length === 0) return (entries || []) as T[];
    if (lookupColumns.length === 0) return entries;

    return entries.map(entry => {
      const resolved = { ...entry } as T;

      for (const col of lookupColumns) {
        const value = entry[col.key];
        if (needsResolution(value)) {
          const id = extractId(value);
          if (id !== null) {
            const cacheKey = String(col.lookup_foundation_id);
            const displayValue = lookupCache[cacheKey]?.[String(id)];

            if (displayValue) {
              (resolved as Record<string, unknown>)[col.key] = { id, display: displayValue } as LookupValue;
            }
            // If not in cache yet, keep the original value (will update on next render after fetch)
          }
        }
      }

      return resolved;
    });
  }, [entries, lookupColumns, lookupCache]);

  return resolvedEntries;
}

export default useLookupResolver;
