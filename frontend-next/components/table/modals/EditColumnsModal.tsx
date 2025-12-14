/**
 * EditColumnsModal Component
 *
 * Modal for showing/hiding and reordering table columns.
 * Features drag-and-drop reordering, column width adjustment, and visibility toggles.
 * Extracted from TeeemTableView to improve code organization.
 *
 * @see Phase 7 refactoring - Modal Consolidation
 */

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RotateCcw } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableColumnRow } from '../components/SortableColumnRow';
import type { TableColumn } from '../types';
import type { DragEndEvent, SensorDescriptor, SensorOptions } from '@dnd-kit/core';

export interface VisibleColumnsState {
  [key: string]: boolean;
}

export interface SearchableColumnsState {
  [key: string]: boolean;
}

export interface EditColumnsModalProps {
  /** Whether modal is open */
  open: boolean;

  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;

  /** All table columns */
  COLUMNS: TableColumn[];

  /** Visible columns state */
  visibleColumns: VisibleColumnsState;

  /** Set visible columns */
  setVisibleColumns: React.Dispatch<React.SetStateAction<VisibleColumnsState>>;

  /** Searchable columns state (for view-level search scope) */
  searchableColumns: SearchableColumnsState;

  /** Set searchable columns */
  setSearchableColumns: React.Dispatch<React.SetStateAction<SearchableColumnsState>>;

  /** Column widths */
  columnWidths: Record<string, number>;

  /** Set column widths */
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  /** Get sorted columns for modal */
  getSortedColumnsForModal: () => TableColumn[];

  /** Reorder column to position */
  reorderColumnToPosition: (columnKey: string, newPosition: number) => void;

  /** Get default visible columns */
  getDefaultVisibleColumns: () => VisibleColumnsState;

  /** Get column type emoji */
  getColumnTypeEmoji: (type: string) => string;

  /** Get column type SQL type */
  getColumnTypeSqlType: (type: string) => string;

  /** Get column type label */
  getColumnTypeLabel: (type: string) => string;

  /** Get column type validation rules */
  getColumnTypeValidationRules: (type: string) => string;

  /** DnD sensors */
  dndSensors: SensorDescriptor<SensorOptions>[];

  /** Handle column drag end */
  handleColumnDragEnd: (event: DragEndEvent) => void;
}

/**
 * Modal for editing column visibility, order, and width
 */
export function EditColumnsModal({
  open,
  onOpenChange,
  COLUMNS,
  visibleColumns,
  setVisibleColumns,
  searchableColumns,
  setSearchableColumns,
  columnWidths,
  setColumnWidths,
  getSortedColumnsForModal,
  reorderColumnToPosition,
  getDefaultVisibleColumns,
  getColumnTypeEmoji,
  getColumnTypeSqlType,
  getColumnTypeLabel,
  getColumnTypeValidationRules,
  dndSensors,
  handleColumnDragEnd,
}: EditColumnsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-8">
        <DialogHeader className="pb-4">
          <DialogTitle>SHOW/HIDE & REORDER COLUMNS</DialogTitle>
          <DialogDescription>
            Drag rows to reorder, or click the position number to type a new position
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[600px] border rounded-md">
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleColumnDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Order</TableHead>
                  <TableHead className="w-12">Show</TableHead>
                  <TableHead className="w-12">Search</TableHead>
                  <TableHead className="w-44">Column Name</TableHead>
                  <TableHead className="w-32">SQL Type</TableHead>
                  <TableHead className="w-32">Display Type</TableHead>
                  <TableHead className="min-w-[200px]">Validation Rules</TableHead>
                  <TableHead className="w-20">Width</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext
                  items={getSortedColumnsForModal().map(c => c.key)}
                  strategy={verticalListSortingStrategy}
                >
                  {(() => {
                    const sortedColumns = getSortedColumnsForModal();
                    const visibleColumnKeys = sortedColumns.filter(c => visibleColumns[c.key] === true).map(c => c.key);
                    const totalVisible = visibleColumnKeys.length;

                    return sortedColumns.map((col) => {
                      const isVisible = visibleColumns[col.key] === true;
                      const visibleIndex = isVisible ? visibleColumnKeys.indexOf(col.key) + 1 : 0;

                      return (
                        <SortableColumnRow
                          key={col.key}
                          id={col.key}
                          column={col}
                          isVisible={isVisible}
                          isSearchable={searchableColumns[col.key] === true}
                          index={visibleIndex}
                          totalVisible={totalVisible}
                          onToggleVisibility={() =>
                            setVisibleColumns((prev) => ({
                              ...prev,
                              [col.key]: !prev[col.key],
                            }))
                          }
                          onToggleSearchable={() =>
                            setSearchableColumns((prev) => ({
                              ...prev,
                              [col.key]: !prev[col.key],
                            }))
                          }
                          onReorder={(newPos) => reorderColumnToPosition(col.key, newPos)}
                          columnWidth={columnWidths[col.key] || col.width || 50}
                          onWidthChange={(width) =>
                            setColumnWidths((prev) => ({
                              ...prev,
                              [col.key]: width,
                            }))
                          }
                          getColumnTypeEmoji={getColumnTypeEmoji}
                          getColumnTypeSqlType={getColumnTypeSqlType}
                          getColumnTypeLabel={getColumnTypeLabel}
                          getColumnTypeValidationRules={getColumnTypeValidationRules}
                        />
                      );
                    });
                  })()}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </ScrollArea>

        <DialogFooter className="flex justify-between pt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Show all columns
                const allVisible: VisibleColumnsState = {};
                COLUMNS.forEach(c => { allVisible[c.key] = true; });
                setVisibleColumns(allVisible);
              }}
            >
              Show All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Hide all except essential columns
                const hidden: VisibleColumnsState = {};
                COLUMNS.forEach(c => { hidden[c.key] = c.key === "id"; });
                setVisibleColumns(hidden);
              }}
            >
              Hide All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleColumns(getDefaultVisibleColumns())}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
