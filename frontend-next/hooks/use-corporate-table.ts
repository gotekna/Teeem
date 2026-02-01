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
// Company Columns (hardcoded - Corporate is a Rails model, not Foundation)
// =============================================================================

const COMPANY_COLUMNS: ApiColumn[] = [
  { id: 1, column_name: 'id', name: 'ID', column_type: 'auto_number' },
  { id: 2, column_name: 'code', name: 'Code', column_type: 'single_line_text' },
  { id: 3, column_name: 'name', name: 'Company Name', column_type: 'single_line_text' },
  { id: 4, column_name: 'entity_type', name: 'Entity Type', column_type: 'single_line_text' },
  { id: 5, column_name: 'status', name: 'Status', column_type: 'choice', available_choices: ['active', 'inactive', 'dormant', 'deregistered'] },
  { id: 6, column_name: 'acn', name: 'ACN', column_type: 'single_line_text' },
  { id: 7, column_name: 'abn', name: 'ABN', column_type: 'single_line_text' },
  { id: 8, column_name: 'tfn', name: 'TFN', column_type: 'single_line_text' },
  { id: 9, column_name: 'date_incorporated', name: 'Date Incorporated', column_type: 'date' },
  { id: 10, column_name: 'company_group', name: 'Company Group', column_type: 'single_line_text' },
  { id: 11, column_name: 'registered_office_address', name: 'Registered Office', column_type: 'single_line_text' },
  { id: 12, column_name: 'principal_place_of_business', name: 'Principal Place', column_type: 'single_line_text' },
  { id: 13, column_name: 'review_date', name: 'Review Date', column_type: 'date' },
  { id: 14, column_name: 'gst_registration_status', name: 'GST Status', column_type: 'single_line_text' },
  { id: 15, column_name: 'bas_frequency', name: 'BAS Frequency', column_type: 'single_line_text' },
  { id: 16, column_name: 'health_status', name: 'Health Status', column_type: 'single_line_text' },
  { id: 17, column_name: 'health_score', name: 'Health Score', column_type: 'number' },
  { id: 18, column_name: 'active', name: 'Active', column_type: 'checkbox' },
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
// Stable empty object to prevent re-renders
const EMPTY_QUERY_PARAMS: Record<string, string | number | boolean> = {};

export function useCorporateTable(
  entityType: CorporateEntityType,
  options: UseCorporateTableOptions = {}
): UseCorporateTableReturn {
  const { skipAutoLoad = false, queryParams } = options;

  // Use stable reference for empty query params to prevent infinite re-renders
  const stableQueryParams = useMemo(
    () => queryParams || EMPTY_QUERY_PARAMS,
    // Only recreate if queryParams object contents change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(queryParams)]
  );

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
      // Companies and Assets use Rails models directly, not Foundations
      // Use hardcoded columns for these entity types
      if (entityType === 'companies') {
        setApiColumns(COMPANY_COLUMNS);
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
        params: stableQueryParams,
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
  }, [apiEndpoint, entityType, stableQueryParams]);

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
      return null; // Companies use Corporate Rails model, not Foundation
    case 'assets':
      return 530; // Assets Foundation - database-driven columns synced from assets table
    case 'directors':
      return null; // Directors use Contact Rails model with is_director=true
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
