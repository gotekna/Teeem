/**
 * ViewRecordModal Component
 *
 * Modal for viewing records in read-only mode.
 * Displays all field values with proper formatting based on column type.
 * Auto-enabled when TeeemTableView has foundationIdNumeric set.
 *
 * @see formatFieldValue for value formatting logic
 * @see Phase 8 refactoring - Record CRUD Modals
 */

"use client";

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Eye, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/formatters';
import type { TableColumn, TableRow } from '../types';

// Alias for consistency
type TableRowType = TableRow;

export interface ViewRecordModalProps {
  /** Whether modal is open */
  open: boolean;

  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;

  /** Table name for display */
  tableName: string;

  /** Column definitions */
  columns: TableColumn[];

  /** Record being viewed */
  record: TableRowType | null;

  /** Optional: Callback to switch to edit mode */
  onEdit?: () => void;
}

/**
 * Format a value for display based on column type
 */
function formatDisplayValue(column: TableColumn, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground italic">—</span>;
  }

  // SSoT: column_type should always be set - log error if missing (skip system columns)
  const systemColumns = ['id', 'created_at', 'updated_at'];
  if (!column.column_type && !systemColumns.includes(column.key)) {
    console.error(`[SSoT] Column "${column.key}" missing column_type - defaulting to single_line_text`);
  }
  const columnType = column.column_type || 'single_line_text';

  switch (columnType) {
    case 'boolean':
      return (
        <Badge variant={value ? "default" : "secondary"}>
          {value ? "Yes" : "No"}
        </Badge>
      );

    case 'date':
      try {
        const formatted = formatDate(String(value));
        return formatted === '-' ? String(value) : formatted;
      } catch {
        return String(value);
      }

    case 'date_and_time':
    case 'datetime':
      try {
        return new Date(String(value)).toLocaleString('en-AU');
      } catch {
        return String(value);
      }

    case 'currency':
      return typeof value === 'number'
        ? `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `$${String(value)}`;

    case 'percentage':
      return `${Number(value)}%`;

    case 'color_picker':
      return (
        <span className="flex items-center gap-2">
          <span
            className="w-5 h-5 rounded border inline-block"
            style={{ backgroundColor: String(value) }}
          />
          <span className="font-mono text-sm">{String(value)}</span>
        </span>
      );

    case 'url':
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          {String(value)}
        </a>
      );

    case 'email':
      return (
        <a
          href={`mailto:${String(value)}`}
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          {String(value)}
        </a>
      );

    case 'long_text':
      return (
        <div className="whitespace-pre-wrap max-h-[200px] overflow-y-auto text-sm">
          {String(value)}
        </div>
      );

    case 'number':
    case 'whole_number':
      return typeof value === 'number'
        ? value.toLocaleString('en-AU')
        : String(value);

    default:
      return String(value);
  }
}

/**
 * Modal for viewing records in read-only mode
 */
export function ViewRecordModal({
  open,
  onOpenChange,
  tableName,
  columns,
  record,
  onEdit,
}: ViewRecordModalProps) {
  if (!record) return null;

  // Filter out system/UI columns
  const displayColumns = columns.filter(
    (col) => !['select', 'actions'].includes(col.key)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            View Record #{record.id}
          </DialogTitle>
          <DialogDescription>
            Read-only view of this record in {tableName}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {displayColumns.map((col) => {
            const value = record[col.key as keyof typeof record];

            // Skip empty values for cleaner display
            if (value === null || value === undefined || value === '') {
              return null;
            }

            return (
              <div
                key={col.key}
                className="grid grid-cols-3 gap-4 items-start py-2 border-b border-border/50 last:border-0"
              >
                <Label className="text-sm font-medium text-muted-foreground pt-0.5">
                  {col.label}
                </Label>
                <div className="col-span-2 text-sm">
                  {formatDisplayValue(col, value)}
                </div>
              </div>
            );
          })}

          {/* If all values are empty, show a message */}
          {displayColumns.every(
            (col) => {
              const value = record[col.key as keyof typeof record];
              return value === null || value === undefined || value === '';
            }
          ) && (
            <div className="text-center py-8 text-muted-foreground">
              <p>This record has no data to display.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEdit && (
            <Button onClick={() => {
              onOpenChange(false);
              onEdit();
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ViewRecordModal;
