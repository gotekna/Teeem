'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { TableColumn, TableRow } from '@/components/table/types';

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
  columns: TableColumn[];
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

  // Extract columns from foundation
  const columns = foundation?.columns || [];

  return {
    foundation,
    columns,
    records,
    isLoading,
    error,
    refresh: loadData,
  };
}

export default useFoundationData;
