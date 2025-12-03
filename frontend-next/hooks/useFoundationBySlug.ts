'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { TableColumn, TableRow } from '@/components/table/types';
import type { Foundation } from './useFoundationData';

/**
 * Extended return type with server-side search support
 */
export interface UseFoundationBySlugReturn {
  foundation: Foundation | null;
  columns: TableColumn[];
  records: TableRow[];
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
  meta?: {
    total_count?: number;
    page?: number;
    per_page?: number;
  };
}

/**
 * Hook for loading foundation data by slug (not ID)
 * Used for slug-based URLs like /jobs_GOD_LOVES_YOU_ instead of /204/jobs_GOD_LOVES_YOU_
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    if (!slug) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load foundation metadata by slug (backend supports slug lookup)
      const foundationData = await api.get<FoundationLookupResponse>(
        `/api/v1/foundations/${slug}`
      );

      const foundationObj = foundationData.foundation;
      setFoundation(foundationObj);

      // Load records via the universal records endpoint using the foundation ID
      const recordsData = await api.get<RecordsResponse>(
        `/api/v1/foundations/${foundationObj.id}/records`,
        { params: { per_page: perPage } }
      );

      const loadedRecords = recordsData.records || [];
      setRecords(loadedRecords);
      setOriginalRecords(loadedRecords); // Store for clearing search
    } catch (err) {
      console.error('Failed to load foundation data by slug:', err);
      setError(err instanceof Error ? err : new Error('Failed to load data'));
    } finally {
      setIsLoading(false);
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
            search_all: searchAll ? 'true' : undefined,
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

  // System columns to hide
  const SYSTEM_COLUMNS = ['created_at', 'updated_at', 'deleted_at'];

  // Transform API columns to TeeemTableView format
  const columns: TableColumn[] = useMemo(() => {
    if (!foundation?.columns) return [];

    const tableColumns: TableColumn[] = [
      { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 40 }
    ];

    foundation.columns.forEach((col: ApiColumn) => {
      // Skip system columns
      if (SYSTEM_COLUMNS.includes(col.column_name)) return;

      // Log lookup columns for debugging
      if (col.lookup_foundation_id) {
        console.log('[useFoundationBySlug] Column', col.column_name, 'has lookup_foundation_id:', col.lookup_foundation_id, 'display_column:', col.lookup_display_column);
      }

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
        lookup_config: col.lookup_foundation_id ? {
          target_table_id: col.lookup_foundation_id,
          display_column: col.lookup_display_column,
        } : undefined,
      });
    });

    return tableColumns;
  }, [foundation]);

  return {
    foundation,
    columns,
    records,
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
