/**
 * ExportModal Component
 *
 * Modal for exporting table data to CSV, Excel, or PDF formats.
 * Supports both client-side export (loaded rows) and server-side export (all records).
 *
 * @see Phase 7 refactoring - Modal Consolidation
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Download, FileSpreadsheet, Table2, Server, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
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

  /** Export handler (client-side) */
  handleExport: () => void;

  /** Foundation slug for server-side export */
  foundationSlug?: string;

  /** Total records on server (when available, enables server export option) */
  serverTotalRecords?: number;

  /** Current filters as JSON string (passed to server export) */
  currentFilters?: string;

  /** Current sort column */
  currentSortBy?: string;

  /** Current sort direction */
  currentSortDirection?: string;
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
  foundationSlug,
  serverTotalRecords,
  currentFilters,
  currentSortBy,
  currentSortDirection,
}: ExportModalProps) {
  const [exportSource, setExportSource] = useState<'client' | 'server'>('client');
  const [isExporting, setIsExporting] = useState(false);

  const loadedCount = filteredAndSortedEntries.length;
  const hasMoreOnServer = serverTotalRecords != null && serverTotalRecords > loadedCount;
  const canServerExport = !!foundationSlug && hasMoreOnServer;

  const handleServerExport = async () => {
    if (!foundationSlug) return;
    setIsExporting(true);

    try {
      const formatType = exportFormat === 'pdf' ? 'csv' : exportFormat;
      const params: Record<string, string> = {
        format_type: formatType === 'excel' ? 'xlsx' : 'csv',
      };
      if (currentFilters) params.filters = currentFilters;
      if (currentSortBy) params.sort_by = currentSortBy;
      if (currentSortDirection) params.sort_direction = currentSortDirection;

      const blob = await api.getBlob(`/api/v1/foundations/${foundationSlug}/records/export`, { params });

      // Download the file
      const ext = formatType === 'excel' ? 'xlsx' : 'csv';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${foundationSlug}_export_${new Date().toISOString().split('T')[0]}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch (err) {
      console.error('Server export failed:', err);
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const onExportClick = () => {
    if (exportSource === 'server') {
      handleServerExport();
    } else {
      handleExport();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Data
          </DialogTitle>
          <DialogDescription>
            Export {exportSource === 'server' ? (serverTotalRecords ?? loadedCount).toLocaleString() : loadedCount.toLocaleString()} rows to a file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Export Source - only show when server has more records */}
          {canServerExport && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Export Source</Label>
              <div className="grid gap-2">
                <label
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    exportSource === "client"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  )}
                >
                  <input
                    type="radio"
                    name="exportSource"
                    value="client"
                    checked={exportSource === "client"}
                    onChange={() => setExportSource("client")}
                    className="h-4 w-4 text-primary"
                  />
                  <Monitor className="h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium">Loaded Rows</div>
                    <div className="text-sm text-muted-foreground">
                      Export {loadedCount.toLocaleString()} currently loaded rows
                    </div>
                  </div>
                </label>

                <label
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    exportSource === "server"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  )}
                >
                  <input
                    type="radio"
                    name="exportSource"
                    value="server"
                    checked={exportSource === "server"}
                    onChange={() => setExportSource("server")}
                    className="h-4 w-4 text-primary"
                  />
                  <Server className="h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium">All Records (Server)</div>
                    <div className="text-sm text-muted-foreground">
                      Export all {(serverTotalRecords ?? 0).toLocaleString()} records from the database
                    </div>
                  </div>
                  <Badge variant="default" className="text-xs">Full</Badge>
                </label>
              </div>
            </div>
          )}

          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <div className={cn("grid gap-2", exportSource === 'server' ? "grid-cols-2" : "grid-cols-3")}>
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
                <FileSpreadsheet className="h-6 w-6 text-green-600 dark:text-green-400" />
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

              {/* PDF only available for client-side export */}
              {exportSource !== 'server' && (
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
                  <FileSpreadsheet className="h-6 w-6 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium">PDF</span>
                </label>
              )}
            </div>
          </div>

          {/* Column Selection - only for client-side export */}
          {exportSource !== 'server' && (
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
          )}

          <div className="p-3 bg-muted/50 rounded-lg border">
            <div className="text-sm font-medium mb-1">Export Summary</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Rows:</span>
                <span className="font-mono">
                  {exportSource === 'server' ? (serverTotalRecords ?? 0).toLocaleString() : loadedCount.toLocaleString()}
                </span>
              </div>
              {exportSource !== 'server' && (
                <div className="flex justify-between">
                  <span>Columns:</span>
                  <span className="font-mono">
                    {exportScope === "visible" ? visibleDataColumns.length : allDataColumns.length}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Format:</span>
                <span className="font-mono uppercase">{exportFormat === 'pdf' && exportSource === 'server' ? 'CSV' : exportFormat}</span>
              </div>
              {exportSource === 'server' && (
                <div className="flex justify-between">
                  <span>Source:</span>
                  <span className="font-mono">Server (all columns)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={onExportClick} disabled={isExporting}>
            {isExporting ? (
              <>
                <Spinner size={16} className="mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {(exportFormat === 'pdf' && exportSource === 'server' ? 'CSV' : exportFormat).toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
