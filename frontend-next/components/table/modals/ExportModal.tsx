/**
 * ExportModal Component
 *
 * Modal for exporting table data to CSV, Excel, or PDF formats.
 * Extracted from TeeemTableView to improve code organization.
 *
 * @see Phase 7 refactoring - Modal Consolidation
 */

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TableColumn } from '../types';

export interface ExportModalProps {
  /** Whether modal is open */
  open: boolean;

  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;

  /** Export format (csv, excel, pdf) */
  exportFormat: 'csv' | 'excel' | 'pdf';

  /** Set export format */
  setExportFormat: (format: 'csv' | 'excel' | 'pdf') => void;

  /** Export scope (visible or all columns) */
  exportScope: 'visible' | 'all';

  /** Set export scope */
  setExportScope: (scope: 'visible' | 'all') => void;

  /** Visible data columns */
  visibleDataColumns: TableColumn[];

  /** All data columns */
  allDataColumns: TableColumn[];

  /** Filtered and sorted entries */
  filteredAndSortedEntries: Array<{ id: number | string; [key: string]: unknown }>;

  /** Export handler */
  handleExport: () => void;
}

/**
 * Modal for configuring and executing data export
 */
export function ExportModal({
  open,
  onOpenChange,
  exportFormat,
  setExportFormat,
  exportScope,
  setExportScope,
  visibleDataColumns,
  allDataColumns,
  filteredAndSortedEntries,
  handleExport,
}: ExportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Data
          </DialogTitle>
          <DialogDescription>
            Export {filteredAndSortedEntries.length} rows to a file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <div className="grid grid-cols-3 gap-2">
              <label
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-colors",
                  exportFormat === "csv"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                )}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  value="csv"
                  checked={exportFormat === "csv"}
                  onChange={() => setExportFormat("csv")}
                  className="sr-only"
                />
                <FileSpreadsheet className="h-6 w-6 text-green-600" />
                <span className="text-sm font-medium">CSV</span>
              </label>

              <label
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-colors",
                  exportFormat === "excel"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                )}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  value="excel"
                  checked={exportFormat === "excel"}
                  onChange={() => setExportFormat("excel")}
                  className="sr-only"
                />
                <Table2 className="h-6 w-6 text-emerald-600" />
                <span className="text-sm font-medium">Excel</span>
              </label>

              <label
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-colors",
                  exportFormat === "pdf"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                )}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  value="pdf"
                  checked={exportFormat === "pdf"}
                  onChange={() => setExportFormat("pdf")}
                  className="sr-only"
                />
                <FileSpreadsheet className="h-6 w-6 text-red-600" />
                <span className="text-sm font-medium">PDF</span>
              </label>
            </div>
          </div>

          {/* Column Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Columns to Export</Label>
            <div className="grid gap-2">
              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  exportScope === "visible"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                )}
              >
                <input
                  type="radio"
                  name="exportScope"
                  value="visible"
                  checked={exportScope === "visible"}
                  onChange={() => setExportScope("visible")}
                  className="h-4 w-4 text-primary"
                />
                <div className="flex-1">
                  <div className="font-medium">Visible Columns Only</div>
                  <div className="text-sm text-muted-foreground">
                    Export {visibleDataColumns.length} columns currently shown
                  </div>
                </div>
                <Badge variant="secondary">{visibleDataColumns.length}</Badge>
              </label>

              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  exportScope === "all"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                )}
              >
                <input
                  type="radio"
                  name="exportScope"
                  value="all"
                  checked={exportScope === "all"}
                  onChange={() => setExportScope("all")}
                  className="h-4 w-4 text-primary"
                />
                <div className="flex-1">
                  <div className="font-medium">All Columns</div>
                  <div className="text-sm text-muted-foreground">
                    Export all {allDataColumns.length} columns in the table
                  </div>
                </div>
                <Badge variant="secondary">{allDataColumns.length}</Badge>
              </label>
            </div>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg border">
            <div className="text-sm font-medium mb-1">Export Summary</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Rows:</span>
                <span className="font-mono">{filteredAndSortedEntries.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Columns:</span>
                <span className="font-mono">
                  {exportScope === "visible" ? visibleDataColumns.length : allDataColumns.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Format:</span>
                <span className="font-mono uppercase">{exportFormat}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export {exportFormat.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
