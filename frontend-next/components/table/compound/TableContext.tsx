/**
 * Table Context
 *
 * Provides table state and actions to all compound components.
 * Inspired by Radix UI's compound component pattern.
 *
 * Architecture:
 * - TableContext holds the result of useTableCore
 * - All compound components consume this context
 * - No prop drilling needed for deeply nested components
 *
 * @example
 * // In compound components:
 * const { sorting, filtering, processedRows } = useTableContext();
 */

import { createContext, useContext } from 'react';
import type { UseTableCoreReturn } from '../hooks/useTableCore';
import type { TableColumn, TableRow } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface TableContextValue extends UseTableCoreReturn {
  /** Column definitions */
  columns: TableColumn[];

  /** Raw data rows */
  rows: TableRow[];

  /** Processed rows (after filter → search → sort pipeline) */
  processedRows: TableRow[];

  /** Visible row IDs (respecting collapsed groups) */
  visibleRowIds: (number | string)[];

  /** Column widths */
  columnWidths: Record<string, number>;

  /** Set column width */
  setColumnWidth: (key: string, width: number) => void;

  /** Visible columns in display order */
  visibleColumnsInOrder: TableColumn[];

  /** Table title */
  title?: string;

  /** Foundation ID/slug */
  foundationId?: string | number;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error?: Error | null;

  /** Refresh data */
  onRefresh?: () => void;

  /** View only mode */
  viewOnly?: boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

const TableContext = createContext<TableContextValue | null>(null);

TableContext.displayName = 'TableContext';

// ============================================================================
// HOOK
// ============================================================================

/**
 * Access table context from any compound component
 *
 * @throws Error if used outside of Table.Root
 */
export function useTableContext(): TableContextValue {
  const context = useContext(TableContext);

  if (!context) {
    throw new Error(
      'useTableContext must be used within a <Table.Root> component. ' +
      'Make sure your component is wrapped in <Table.Root>.'
    );
  }

  return context;
}

/**
 * Access table context optionally (returns null if not in context)
 * Useful for components that can work both inside and outside Table.Root
 */
export function useTableContextOptional(): TableContextValue | null {
  return useContext(TableContext);
}

// ============================================================================
// PROVIDER
// ============================================================================

export const TableContextProvider = TableContext.Provider;

export default TableContext;
