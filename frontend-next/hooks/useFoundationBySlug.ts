'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import { TableColumn, TableRow } from '@/components/table/types';
import type { Foundation } from './useFoundationData';

// System columns to hide from table views
const SYSTEM_COLUMNS = ['created_at', 'updated_at', 'deleted_at'];

/**
 * Extended return type with server-side search support
 */
export interface UseFoundationBySlugReturn {
  foundation: Foundation | null;
  columns: TableColumn[];
  records: TableRow[];
  originalRecords: TableRow[]; // Unfiltered records for stats
  totalCount: number | null; // Total count from server (for stats without loading all records)
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  // Server-side search
  serverSearch: (query: string, searchAll?: boolean) => Promise<void>;
  isSearching: boolean;
  clearSearch: () => void;
}

/**
 * API column format (what the backend returns)
 */
interface ApiColumn {
  id: number;
  foundation_id?: number;
  column_name: string;
  name: string;
  column_type: string;
  description?: string;
  available_choices?: string[];
  lookup_foundation_id?: number;
  lookup_display_column?: string;
  required?: boolean;
  is_unique?: boolean;
}

/**
 * API response shape for foundation lookup by slug
 */
interface FoundationLookupResponse {
  foundation: Foundation;
}

/**
 * API response shape for records
 */
interface RecordsResponse {
  records: TableRow[];
  pagination?: {
    total_count?: number;
    page?: number;
    per_page?: number;
    total_pages?: number;
  };
}

/**
 * API response shape for views
 */
interface ViewsResponse {
  success: boolean;
  views: unknown[];
}

// Module-level cache for preloaded views (shared with TeeemTableView)
 
export const preloadedViewsCache: Record<number, { views: any[]; timestamp: number }> = {};
const VIEWS_CACHE_TTL = 60000; // 1 minute

/**
 * Hook for loading foundation data by slug (not ID)
 * Used for slug-based URLs like /jobs, /pricebook, /contacts
 *
 * @param slug - The foundation slug (e.g., 'jobs', 'pricebook', 'contacts')
 * @param options - Additional options for data loading
 */
export function useFoundationBySlug(
  slug: string | null,
  options: {
    perPage?: number;
    autoLoad?: boolean;
  } = {}
): UseFoundationBySlugReturn {
  const { perPage = 500, autoLoad = true } = options;

  const [foundation, setFoundation] = useState<Foundation | null>(null);
  const [records, setRecords] = useState<TableRow[]>([]);
  const [originalRecords, setOriginalRecords] = useState<TableRow[]>([]); // Store original records for clearing search
  const [totalCount, setTotalCount] = useState<number | null>(null); // Total count from server
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Prevent duplicate concurrent fetches (React StrictMode causes double-mount)
  const fetchInProgressRef = useRef(false);
  const lastFetchSlugRef = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    // Prevent duplicate fetches for the same slug
    if (fetchInProgressRef.current && lastFetchSlugRef.current === slug) {
      console.log('[useFoundationBySlug] Skipping duplicate fetch for:', slug);
      return;
    }

    const startTime = performance.now();
    console.log('[useFoundationBySlug] loadData starting for slug:', slug);

    if (!slug) {
      setIsLoading(false);
      return;
    }

    fetchInProgressRef.current = true;
    lastFetchSlugRef.current = slug;
    setIsLoading(true);
    setError(null);

    try {
      // Load foundation metadata by slug (backend supports slug lookup)
      const foundationStartTime = performance.now();
      const foundationData = await api.get<FoundationLookupResponse>(
        `/api/v1/foundations/${slug}`
      );
      console.log('[useFoundationBySlug] Foundation loaded in', (performance.now() - foundationStartTime).toFixed(0), 'ms');

      const foundationObj = foundationData.foundation;
      setFoundation(foundationObj);

      // Load records AND views in parallel for better performance
      const recordsStartTime = performance.now();

      // Check if views are already cached
      const cachedViews = preloadedViewsCache[foundationObj.id];
      const now = Date.now();
      const viewsCached = cachedViews && (now - cachedViews.timestamp) < VIEWS_CACHE_TTL;

      // Start both requests in parallel
      // Use fields=minimal for 90%+ payload reduction (loads only essential columns for list view)
      const recordsPromise = api.get<RecordsResponse>(
        `/api/v1/foundations/${foundationObj.id}/records`,
        { params: { per_page: perPage, fields: 'minimal' } }
      );

      // Only fetch views if not cached
      const viewsPromise = viewsCached
        ? Promise.resolve(null)
        : api.get<ViewsResponse>(
            `/api/v1/foundation_views`,
            { params: { foundation_id: foundationObj.id } }
          );

      // Wait for both to complete
      const [recordsData, viewsData] = await Promise.all([recordsPromise, viewsPromise]);

      console.log('[useFoundationBySlug] Records loaded in', (performance.now() - recordsStartTime).toFixed(0), 'ms', '- count:', recordsData.records?.length);

      // Cache the views for TeeemTableView to use
      if (viewsData?.success && viewsData.views) {
        preloadedViewsCache[foundationObj.id] = {
          views: viewsData.views,
          timestamp: Date.now()
        };
        console.log('[useFoundationBySlug] Views preloaded:', viewsData.views.length);
      } else if (viewsCached) {
        console.log('[useFoundationBySlug] Using cached views');
      }

      const loadedRecords = recordsData.records || [];
      setRecords(loadedRecords);
      setOriginalRecords(loadedRecords); // Store for clearing search
      setTotalCount(recordsData.pagination?.total_count ?? null); // Store total count from server
      console.log('[useFoundationBySlug] Total loadData time:', (performance.now() - startTime).toFixed(0), 'ms');
    } catch (err) {
      console.error('Failed to load foundation data by slug:', err);
      setError(err instanceof Error ? err : new Error('Failed to load data'));
    } finally {
      setIsLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [slug, perPage]);

  // Server-side search function
  const serverSearch = useCallback(async (query: string, searchAll = false) => {
    if (!foundation) return;

    // If query is empty, restore original records
    if (!query.trim()) {
      setRecords(originalRecords);
      return;
    }

    setIsSearching(true);
    try {
      const recordsData = await api.get<RecordsResponse>(
        `/api/v1/foundations/${foundation.id}/records`,
        {
          params: {
            search: query,
            ...(searchAll && { search_all: 'true' }),
            per_page: 500 // Return up to 500 search results
          }
        }
      );
      setRecords(recordsData.records || []);
    } catch (err) {
      console.error('Server search failed:', err);
      // Keep current records on error
    } finally {
      setIsSearching(false);
    }
  }, [foundation, originalRecords]);

  // Clear search and restore original records
  const clearSearch = useCallback(() => {
    setRecords(originalRecords);
  }, [originalRecords]);

  // Load data on mount and when slug changes
  useEffect(() => {
    if (autoLoad) {
      loadData();
    }
  }, [autoLoad, loadData]);

  // Transform API columns to TeeemTableView format
  const columns: TableColumn[] = useMemo(() => {
    if (!foundation?.columns) return [];

    const tableColumns: TableColumn[] = [
      { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 40 }
    ];

    foundation.columns.forEach((col: ApiColumn) => {
      // Skip system columns
      if (SYSTEM_COLUMNS.includes(col.column_name)) return;

      tableColumns.push({
        id: col.id,
        foundation_id: col.foundation_id || foundation.id,
        key: col.column_name,
        label: col.name,
        column_type: col.column_type,
        resizable: true,
        sortable: true,
        filterable: true,
        width: getDefaultWidth(col.column_name, col.column_type),
        choices: col.available_choices,
        lookup_foundation_id: col.lookup_foundation_id,
        lookup_display_column: col.lookup_display_column,
      });
    });

    return tableColumns;
  }, [foundation]);

  return {
    foundation,
    columns,
    records,
    originalRecords, // Expose original unfiltered records
    totalCount, // Total count from server (for stats without loading all records)
    isLoading,
    error,
    refresh: loadData,
    serverSearch,
    isSearching,
    clearSearch,
  };
}

/**
 * Get default column width based on column name and type
 */
function getDefaultWidth(columnName: string, columnType: string): number {
  // Specific column overrides
  if (columnName === 'id') return 60;
  if (columnName === 'name' || columnName === 'title') return 250;
  if (columnName === 'ted_number') return 100;
  if (columnName === 'status' || columnName === 'job_status') return 120;
  if (columnName === 'job_type') return 120;
  if (columnName === 'code') return 80;
  if (columnName.includes('email')) return 200;
  if (columnName.includes('phone')) return 130;

  // Type-based defaults
  switch (columnType) {
    case 'currency':
    case 'percentage':
      return 100;
    case 'date':
    case 'date_and_time':
      return 120;
    case 'boolean':
      return 80;
    case 'multiple_lines_text':
    case 'long_text':
      return 300;
    default:
      return 150;
  }
}

export default useFoundationBySlug;
