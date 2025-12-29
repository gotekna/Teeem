'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { TableColumn, TableRow } from '@/components/table/types';
import { isHiddenSystemColumn, isVisibleSystemColumn } from '@/lib/constants/system-columns';

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
 * Foundation data from the API
 */
export interface Foundation {
  id: number;
  name: string;
  table_type: 'system' | 'user';
  model_class?: string;
  database_table_name?: string;
  api_endpoint?: string;
  columns: ApiColumn[];
}

/**
 * API response shape for foundation
 */
interface FoundationResponse {
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
 * Hook return type
 */
export interface UseFoundationDataReturn {
  foundation: Foundation | null;
  columns: TableColumn[];
  records: TableRow[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Unified hook for loading foundation data (metadata + records)
 * Works for both system tables (Jobs, Contacts) and user foundations
 *
 * @param tableId - The foundation/table ID (e.g., 204 for Jobs, 1 for Gold Standard)
 * @param options - Additional options for data loading
 */
export function useFoundationData(
  tableId: number | null,
  options: {
    perPage?: number;
    autoLoad?: boolean;
  } = {}
): UseFoundationDataReturn {
  const { perPage = 500, autoLoad = true } = options;

  const [foundation, setFoundation] = useState<Foundation | null>(null);
  const [records, setRecords] = useState<TableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    if (!tableId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load foundation metadata (includes columns)
      const foundationData = await api.get<FoundationResponse>(
        `/api/v1/foundations/${tableId}`
      );

      const foundationObj = foundationData.foundation;
      setFoundation(foundationObj);

      // Load records via the universal records endpoint
      const recordsData = await api.get<RecordsResponse>(
        `/api/v1/foundations/${tableId}/records`,
        { params: { per_page: perPage } }
      );

      setRecords(recordsData.records || []);
    } catch (err) {
      console.error('Failed to load foundation data:', err);
      setError(err instanceof Error ? err : new Error('Failed to load data'));
    } finally {
      setIsLoading(false);
    }
  }, [tableId, perPage]);

  // Load data on mount and when tableId changes
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

    foundation.columns.forEach((col) => {
      // Skip hidden system columns (e.g., deleted_at)
      if (isHiddenSystemColumn(col.column_name)) return;

      // Check if this is a visible system column (id, created_at, updated_at)
      // These should be visible but non-editable with yellow highlight
      const isSystemCol = isVisibleSystemColumn(col.column_name);

      tableColumns.push({
        id: col.id,
        foundation_id: col.foundation_id || foundation.id,
        key: col.column_name, // Map column_name to key
        label: col.name,
        column_type: col.column_type,
        resizable: true,
        sortable: true,
        filterable: true,
        width: getDefaultWidth(col.column_name, col.column_type),
        choices: col.available_choices,
        lookup_foundation_id: col.lookup_foundation_id,
        lookup_display_column: col.lookup_display_column,
        // SSoT: System columns are visible but non-editable (GOLD_STANDARD_TABLE.md)
        ...(isSystemCol && { editable: false, isSystemColumn: true }),
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

export default useFoundationData;
