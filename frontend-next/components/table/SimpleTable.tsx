/**
 * SimpleTable - Lightweight Table Using 4-Layer Architecture
 *
 * A demonstration of the new table architecture:
 * - Layer 1: Headless Core (lib/table-core) - Pure data processing
 * - Layer 2: Feature Hooks (hooks/) - React state management
 * - Layer 3: Compound Components (compound/) - Composable UI
 * - Layer 4: This component - Thin orchestration shell
 *
 * Use this for simple table needs. For full features, use TeeemTableView.
 *
 * @example
 * // Basic usage
 * <SimpleTable
 *   columns={columns}
 *   rows={rows}
 *   title="My Table"
 * />
 *
 * @example
 * // With handlers
 * <SimpleTable
 *   columns={columns}
 *   rows={rows}
 *   title="Jobs"
 *   onAdd={() => setShowModal(true)}
 *   onRefresh={fetchData}
 *   onRowClick={(row) => router.push(`/jobs/${row.id}`)}
 * />
 */

'use client';

import React, { useMemo } from 'react';
import { Table } from './compound';
import { cn } from '@/lib/utils';
import type { TableColumn, TableRow } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface SimpleTableProps {
  /** Column definitions */
  columns: TableColumn[];

  /** Data rows */
  rows: TableRow[];

  /** Table title */
  title?: string;

  /** Loading state */
  isLoading?: boolean;

  /** Error state */
  error?: Error | null;

  /** Refresh handler */
  onRefresh?: () => void;

  /** Add record handler */
  onAdd?: () => void;

  /** Add button label */
  addLabel?: string;

  /** Row click handler */
  onRowClick?: (row: TableRow) => void;

  /** Enable row selection */
  selectable?: boolean;

  /** Enable sorting */
  sortable?: boolean;

  /** View only mode */
  viewOnly?: boolean;

  /** Container className */
  className?: string;

  /** Show header row */
  showHeader?: boolean;

  /** Show footer */
  showFooter?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Simple table component using the 4-layer architecture
 *
 * ~100 lines vs TeeemTableView's ~6,700 lines
 */
export function SimpleTable({
  columns,
  rows,
  title,
  isLoading = false,
  error = null,
  onRefresh,
  onAdd,
  addLabel = 'Add',
  onRowClick,
  selectable = true,
  sortable = true,
  viewOnly = false,
  className,
  showHeader = true,
  showFooter = true,
}: SimpleTableProps) {
  // Add select column if selectable
  const columnsWithSelect = useMemo(() => {
    if (!selectable) return columns;

    const hasSelect = columns.some((c) => c.key === 'select');
    if (hasSelect) return columns;

    return [
      { key: 'select', label: '', width: 40 },
      ...columns,
    ];
  }, [columns, selectable]);

  // Error state
  if (error) {
    return (
      <div className={cn('flex flex-col h-full items-center justify-center p-8', className)}>
        <div className="text-destructive text-center">
          <p className="font-medium">Error loading data</p>
          <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-4 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Table.Root
      columns={columnsWithSelect}
      rows={rows}
      title={title}
      isLoading={isLoading}
      onRefresh={onRefresh}
      viewOnly={viewOnly}
      className={className}
    >
      {/* Toolbar */}
      <Table.Toolbar showHeader={showHeader} onAdd={onAdd} addLabel={addLabel} />

      {/* Header */}
      <Table.Header sortable={sortable} selectable={selectable} />

      {/* Body */}
      <Table.Body
        renderRow={
          onRowClick
            ? ({ row, index, isSelected }) => (
                <ClickableRow
                  key={row.id as string | number}
                  row={row}
                  isSelected={isSelected}
                  onClick={() => onRowClick(row as TableRow)}
                />
              )
            : undefined
        }
      />

      {/* Footer */}
      {showFooter && <Table.Footer />}
    </Table.Root>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface ClickableRowProps {
  row: Record<string, unknown>;
  isSelected: boolean;
  onClick: () => void;
}

function ClickableRow({ row, isSelected, onClick }: ClickableRowProps) {
  return (
    <Table.Row
      row={row}
      index={0}
      isSelected={isSelected}
      onClick={onClick}
      className="cursor-pointer hover:bg-muted/50"
    >
      {/* Cells rendered by parent Body component */}
    </Table.Row>
  );
}

SimpleTable.displayName = 'SimpleTable';

export default SimpleTable;
