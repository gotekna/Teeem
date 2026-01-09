/**
 * Columns Cache - Module-level cache for Foundation columns
 *
 * SSoT: Uses CACHE_TTL_COLUMNS from cache-constants.ts
 *
 * Benefits:
 * - Instant column loading on repeat visits to same table
 * - Survives component remounts within the same page session
 * - Allows parallel loading of columns, views, and records
 */

import { CACHE_TTL_COLUMNS } from '@/lib/constants/cache-constants';
import { api } from '@/lib/api';
import type { TableColumn } from '../types';

// Re-export for convenience
export { CACHE_TTL_COLUMNS };

interface CachedColumns {
  columns: TableColumn[];
  foundationInfo: { id: number; slug: string };
  timestamp: number;
}

// Module-level cache (survives component remounts)
export const columnsCache: Record<string, CachedColumns> = {};

// In-flight request deduplication (prevents duplicate API calls)
export const columnsFetchPromises: Record<string, Promise<CachedColumns | null>> = {};

/**
 * Get cached columns if still valid
 */
export function getCachedColumns(foundationId: string | number): CachedColumns | null {
  const key = String(foundationId);
  const cached = columnsCache[key];

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_COLUMNS)) {
    return cached;
  }

  // Expired - clean up
  if (cached) {
    delete columnsCache[key];
  }

  return null;
}

/**
 * Invalidate columns cache for a specific foundation
 */
export function invalidateColumnsCache(foundationId?: string | number): void {
  if (foundationId) {
    const key = String(foundationId);
    delete columnsCache[key];
    delete columnsFetchPromises[key];
  } else {
    // Clear all
    Object.keys(columnsCache).forEach(k => delete columnsCache[k]);
    Object.keys(columnsFetchPromises).forEach(k => delete columnsFetchPromises[k]);
  }
}

// Column type from API
interface ApiColumn {
  id: number;
  column_name: string;
  column_type: string;
  label?: string;
  name?: string;
  position: number;
  is_visible: boolean;
  is_sortable: boolean;
  is_filterable: boolean;
  is_required: boolean;
  is_editable: boolean;
  is_read_only?: boolean;
  min_width?: number;
  max_width?: number;
  header_align?: string;
  data_align?: string;
  lookup_foundation_id?: number | null;
  lookup_foundation_slug?: string | null;
  lookup_display_column?: string | null;
  format?: string | null;
  validation_pattern?: string | null;
  validation_message?: string | null;
  default_value?: unknown;
  choices?: string[];
  settings?: Record<string, unknown>;
}

/**
 * Convert API columns to TEEEM format
 */
function convertColumnsToTEEEMFormat(
  apiColumns: ApiColumn[],
  foundationId: string | number
): TableColumn[] {
  // Sort by position to maintain order
  const sorted = [...apiColumns].sort((a, b) => (a.position || 0) - (b.position || 0));

  return sorted.map((col) => ({
    key: col.column_name,
    label: col.label || col.name || col.column_name,
    sortable: col.is_sortable !== false,
    filterable: col.is_filterable !== false,
    column_type: col.column_type,
    id: col.id,
    foundation_id: typeof foundationId === 'number' ? foundationId : undefined,
    editable: col.is_read_only ? false : col.is_editable !== false,
    minWidth: col.min_width,
    headerAlign: col.header_align as TableColumn['headerAlign'],
    dataAlign: col.data_align as TableColumn['dataAlign'],
    lookup_foundation_id: col.lookup_foundation_id ?? undefined,
    lookup_foundation_slug: col.lookup_foundation_slug ?? undefined,
    lookup_display_column: col.lookup_display_column ?? undefined,
    choices: col.choices,
    settings: col.settings as TableColumn['settings'],
  }));
}

/**
 * Fetch columns for a foundation (with caching and deduplication)
 * Returns cached data instantly if available
 */
export async function fetchColumnsForFoundation(
  foundationId: string | number
): Promise<CachedColumns | null> {
  const key = String(foundationId);

  // Check cache first
  const cached = getCachedColumns(foundationId);
  if (cached) {
    return cached;
  }

  // Check if there's already an in-flight request
  if (key in columnsFetchPromises) {
    return columnsFetchPromises[key];
  }

  // Start new fetch
  const fetchPromise = (async (): Promise<CachedColumns | null> => {
    try {
      const response = await api.get<{
        foundation: {
          id: number;
          slug: string;
          columns: ApiColumn[]
        }
      }>(`/api/v1/foundations/${foundationId}`);

      if (!response?.foundation) {
        return null;
      }

      const columns = convertColumnsToTEEEMFormat(
        response.foundation.columns || [],
        foundationId
      );

      const result: CachedColumns = {
        columns,
        foundationInfo: {
          id: response.foundation.id,
          slug: response.foundation.slug,
        },
        timestamp: Date.now(),
      };

      // Cache the result
      columnsCache[key] = result;

      return result;
    } catch (error) {
      console.error(`[columns-cache] Failed to fetch columns for ${foundationId}:`, error);
      return null;
    } finally {
      // Clean up in-flight promise
      delete columnsFetchPromises[key];
    }
  })();

  // Store the promise for deduplication
  columnsFetchPromises[key] = fetchPromise;

  return fetchPromise;
}
