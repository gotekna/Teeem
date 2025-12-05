'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import type { TableColumn, TableRow } from '@/components/table/types';
import {
  convertColumnsToTEEEMFormat,
  type ApiColumn,
} from '@/lib/corporate/column-utils';
import {
  CORPORATE_TABLE_IDS,
  CORPORATE_API_ENDPOINTS,
  COLUMN_WIDTH_OVERRIDES,
  type CorporateEntityType,
} from '@/lib/corporate/config';

// =============================================================================
// Types
// =============================================================================

interface FoundationResponse {
  foundation: {
    id: number;
    name: string;
    columns: ApiColumn[];
  };
}

interface UseCorporateTableReturn {
  /** Columns formatted for TeeemTableView */
  columns: TableColumn[];
  /** Foundation ID (null for entities without foundations like Assets) */
  foundationId: number | null;
  /** Data rows from the API */
  entries: TableRow[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh columns from API (after schema changes) */
  refreshColumns: () => Promise<void>;
  /** Refresh data from API */
  refreshData: () => Promise<void>;
  /** CRUD operations */
  handleEdit: (entry: TableRow) => Promise<void>;
  handleDelete: (entry: TableRow) => Promise<void>;
  handleBulkDelete: (entries: TableRow[]) => Promise<void>;
}

interface UseCorporateTableOptions {
  /** Skip auto-loading data on mount */
  skipAutoLoad?: boolean;
  /** Additional query params for the API */
  queryParams?: Record<string, string | number | boolean>;
}

// =============================================================================
// Asset Columns (hardcoded since Assets have no Foundation)
// =============================================================================

const ASSET_COLUMNS: ApiColumn[] = [
  { id: 1, column_name: 'id', name: 'ID', column_type: 'auto_number' },
  { id: 2, column_name: 'name', name: 'Asset Name', column_type: 'single_line_text' },
  { id: 3, column_name: 'asset_type', name: 'Type', column_type: 'choice', available_choices: ['vehicle', 'equipment', 'property', 'other'] },
  { id: 4, column_name: 'status', name: 'Status', column_type: 'choice', available_choices: ['active', 'disposed', 'sold', 'written_off'] },
  { id: 5, column_name: 'company_id', name: 'Company', column_type: 'lookup', lookup_foundation_id: 353 },
  { id: 6, column_name: 'purchase_price', name: 'Purchase Price', column_type: 'currency' },
  { id: 7, column_name: 'purchase_date', name: 'Purchase Date', column_type: 'date' },
  { id: 8, column_name: 'current_book_value', name: 'Book Value', column_type: 'currency' },
  { id: 9, column_name: 'make', name: 'Make', column_type: 'single_line_text' },
  { id: 10, column_name: 'model', name: 'Model', column_type: 'single_line_text' },
  { id: 11, column_name: 'description', name: 'Description', column_type: 'multiple_lines_text' },
];

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for loading corporate entity data with TeeemTableView integration.
 *
 * Handles:
 * - Loading columns from Foundation (or hardcoded for entities without one)
 * - Loading data from entity-specific API endpoints
 * - Converting columns to TeeemTableView format
 * - CRUD operations
 *
 * @param entityType - The type of corporate entity ('companies', 'assets', 'directors')
 * @param options - Additional options
 */
export function useCorporateTable(
  entityType: CorporateEntityType,
  options: UseCorporateTableOptions = {}
): UseCorporateTableReturn {
  const { skipAutoLoad = false, queryParams = {} } = options;

  // State
  const [apiColumns, setApiColumns] = useState<ApiColumn[]>([]);
  const [entries, setEntries] = useState<TableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get configuration for this entity type
  const foundationId = getFoundationId(entityType);
  const apiEndpoint = CORPORATE_API_ENDPOINTS[entityType];
  const widthOverrides = useMemo(
    () => COLUMN_WIDTH_OVERRIDES[entityType] || {},
    [entityType]
  );

  // ==========================================================================
  // Load Columns
  // ==========================================================================

  const loadColumns = useCallback(async () => {
    try {
      if (entityType === 'assets') {
        // Assets don't have a Foundation - use hardcoded columns
        setApiColumns(ASSET_COLUMNS);
        return;
      }

      if (!foundationId) {
        console.warn(`No foundation ID for entity type: ${entityType}`);
        return;
      }

      const response = await api.get<FoundationResponse>(
        `/api/v1/foundations/${foundationId}`
      );

      setApiColumns(response.foundation?.columns || []);
    } catch (err) {
      console.error(`Failed to load columns for ${entityType}:`, err);
      setError(`Failed to load column schema`);
    }
  }, [entityType, foundationId]);

  // ==========================================================================
  // Load Data
  // ==========================================================================

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get<Record<string, TableRow[]>>(apiEndpoint, {
        params: queryParams,
      });

      // API returns { companies: [...] } or { assets: [...] } etc.
      const dataKey = getDataKey(entityType);
      const data = response[dataKey] || [];

      setEntries(data);
    } catch (err) {
      console.error(`Failed to load ${entityType}:`, err);
      setError(`Failed to load ${entityType}`);
    } finally {
      setIsLoading(false);
    }
  }, [apiEndpoint, entityType, queryParams]);

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  const handleEdit = useCallback(async (entry: TableRow) => {
    try {
      const singularKey = getSingularKey(entityType);
      await api.patch(`${apiEndpoint}/${entry.id}`, { [singularKey]: entry });

      // Refresh data to get the updated record
      await loadData();
    } catch (err) {
      console.error(`Failed to update ${entityType}:`, err);
      throw err;
    }
  }, [apiEndpoint, entityType, loadData]);

  const handleDelete = useCallback(async (entry: TableRow) => {
    try {
      await api.delete(`${apiEndpoint}/${entry.id}`);

      // Remove from local state
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch (err) {
      console.error(`Failed to delete ${entityType}:`, err);
      throw err;
    }
  }, [apiEndpoint, entityType]);

  const handleBulkDelete = useCallback(async (entriesToDelete: TableRow[]) => {
    try {
      await Promise.all(
        entriesToDelete.map(entry => api.delete(`${apiEndpoint}/${entry.id}`))
      );

      // Remove from local state
      const idsToDelete = new Set(entriesToDelete.map(e => e.id));
      setEntries(prev => prev.filter(e => !idsToDelete.has(e.id)));
    } catch (err) {
      console.error(`Failed to bulk delete ${entityType}:`, err);
      throw err;
    }
  }, [apiEndpoint, entityType]);

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Load columns and data on mount
  useEffect(() => {
    loadColumns();
    if (!skipAutoLoad) {
      loadData();
    }
  }, [loadColumns, loadData, skipAutoLoad]);

  // ==========================================================================
  // Memoized Columns
  // ==========================================================================

  const columns = useMemo(() => {
    if (apiColumns.length === 0) return [];

    return convertColumnsToTEEEMFormat(
      apiColumns,
      foundationId || 0,
      widthOverrides
    );
  }, [apiColumns, foundationId, widthOverrides]);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    columns,
    foundationId,
    entries,
    isLoading,
    error,
    refreshColumns: loadColumns,
    refreshData: loadData,
    handleEdit,
    handleDelete,
    handleBulkDelete,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function getFoundationId(entityType: CorporateEntityType): number | null {
  switch (entityType) {
    case 'companies':
      return CORPORATE_TABLE_IDS.COMPANIES;
    case 'assets':
      return null; // Assets don't have a Foundation
    case 'directors':
      return CORPORATE_TABLE_IDS.COMPANY_DIRECTOR;
    default:
      return null;
  }
}

function getDataKey(entityType: CorporateEntityType): string {
  switch (entityType) {
    case 'companies':
      return 'companies';
    case 'assets':
      return 'assets';
    case 'directors':
      return 'contacts'; // Directors are contacts with is_director=true
    default:
      return entityType;
  }
}

function getSingularKey(entityType: CorporateEntityType): string {
  switch (entityType) {
    case 'companies':
      return 'company';
    case 'assets':
      return 'asset';
    case 'directors':
      return 'contact';
  }
}

export default useCorporateTable;
