/**
 * Column State Hook
 *
 * Consolidates all column-related state management:
 * - Column visibility (which columns are shown/hidden)
 * - Column order (drag-to-reorder)
 * - Column widths (resize)
 * - Column sorting (multi-column sort)
 * - Auto-fit columns toggle
 *
 * Wraps Jotai atoms for cleaner component code.
 */

import { useAtom, useAtomValue } from 'jotai';
import {
  currentSortColumnsAtom,
  currentColumnWidthsAtom,
  currentColumnOrderAtom,
  currentVisibleColumnsAtom,
  currentAutoFitColumnsAtom,
} from '@/lib/table-atoms';

export interface ColumnState {
  // Sort state
  sortColumns: Array<{ column: string; dir: 'asc' | 'desc' | 'custom'; customOrder?: string[] }>;
  setSortColumns: (value: Array<{ column: string; dir: 'asc' | 'desc' | 'custom'; customOrder?: string[] }>) => void;

  // Width state
  columnWidths: Record<string, number>;
  setColumnWidths: (value: Record<string, number>) => void;

  // Order state
  columnOrder: string[];
  setColumnOrder: (value: string[]) => void;

  // Visibility state
  visibleColumns: Record<string, boolean>;
  setVisibleColumns: (value: Record<string, boolean>) => void;

  // Auto-fit toggle
  autoFitColumns: boolean;
  setAutoFitColumns: (value: boolean) => void;
}

/**
 * Hook for managing column state
 *
 * @returns Column state and setters
 */
export function useColumnState(): ColumnState {
  const [sortColumns, setSortColumns] = useAtom(currentSortColumnsAtom);
  const [columnWidths, setColumnWidths] = useAtom(currentColumnWidthsAtom);
  const [columnOrder, setColumnOrder] = useAtom(currentColumnOrderAtom);
  const [visibleColumns, setVisibleColumns] = useAtom(currentVisibleColumnsAtom);
  const [autoFitColumns, setAutoFitColumns] = useAtom(currentAutoFitColumnsAtom);

  return {
    sortColumns,
    setSortColumns,
    columnWidths,
    setColumnWidths,
    columnOrder,
    setColumnOrder,
    visibleColumns,
    setVisibleColumns,
    autoFitColumns,
    setAutoFitColumns,
  };
}
