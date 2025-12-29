"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  FileSpreadsheet,
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Spinner } from "./spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

export interface ExcelSheet {
  name: string;
  headers: (string | number | null)[];
  rows: (string | number | null)[][];
  row_count: number;
  col_count: number;
}

export interface ExcelData {
  sheets: string[];
  data: ExcelSheet[];
}

export interface ExcelViewerProps {
  data: ExcelData;
  filename?: string;
  className?: string;
  maxRows?: number;
  onExportCSV?: (sheetName: string) => void;
}

export function ExcelViewer({
  data,
  filename,
  className,
  maxRows = 100,
  onExportCSV,
}: ExcelViewerProps) {
  const [activeSheetIndex, setActiveSheetIndex] = React.useState(0);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [displayRows, setDisplayRows] = React.useState(maxRows);

  const activeSheet = data.data[activeSheetIndex];
  const sheets = data.sheets;

  // Filter rows based on search term
  const filteredRows = React.useMemo(() => {
    if (!activeSheet || !searchTerm) {
      return activeSheet?.rows.slice(1) || []; // Skip header row
    }
    const term = searchTerm.toLowerCase();
    return activeSheet.rows.slice(1).filter((row) =>
      row.some((cell) =>
        String(cell ?? "")
          .toLowerCase()
          .includes(term)
      )
    );
  }, [activeSheet, searchTerm]);

  const displayedRows = filteredRows.slice(0, displayRows);
  const hasMoreRows = filteredRows.length > displayRows;
  const headers = activeSheet?.headers || activeSheet?.rows[0] || [];

  const handleExportCSV = () => {
    if (!activeSheet) return;

    const csvContent = [
      headers.map((h) => `"${String(h ?? "").replace(/"/g, '""')}"`).join(","),
      ...activeSheet.rows.slice(1).map((row) =>
        row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${activeSheet.name || filename || "export"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    onExportCSV?.(activeSheet.name);
  };

  if (!data || !data.data || data.data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-64", className)}>
        <div className="text-center text-muted-foreground">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No spreadsheet data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium truncate max-w-[200px]">
            {filename || "Spreadsheet"}
          </span>
          <span className="text-xs text-muted-foreground">
            ({activeSheet?.row_count || 0} rows)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7 w-40 pl-7 text-xs"
            />
          </div>

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-7 text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {/* Sheet Tabs */}
      {sheets.length > 1 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/20 overflow-x-auto shrink-0">
          {sheets.map((sheetName, index) => (
            <button
              key={sheetName}
              onClick={() => setActiveSheetIndex(index)}
              className={cn(
                "px-3 py-1 text-xs rounded-t border-b-2 transition-colors",
                activeSheetIndex === index
                  ? "bg-background border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {sheetName}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-10 text-center text-xs text-muted-foreground">
                #
              </TableHead>
              {headers.map((header, colIndex) => (
                <TableHead
                  key={colIndex}
                  className="text-xs font-medium whitespace-nowrap"
                >
                  {String(header ?? `Col ${colIndex + 1}`)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedRows.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-muted/50">
                <TableCell className="w-10 text-center text-xs text-muted-foreground">
                  {rowIndex + 2}
                </TableCell>
                {row.map((cell, cellIndex) => (
                  <TableCell
                    key={cellIndex}
                    className="text-xs whitespace-nowrap max-w-[300px] truncate"
                    title={String(cell ?? "")}
                  >
                    {formatCell(cell)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Load More / Summary */}
        <div className="p-2 border-t bg-muted/20 text-center">
          {hasMoreRows ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDisplayRows((prev) => prev + maxRows)}
              className="text-xs"
            >
              Load more ({filteredRows.length - displayRows} remaining)
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Showing {displayedRows.length} of {filteredRows.length} rows
              {searchTerm && ` (filtered)`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Format cell value for display
function formatCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    // Format numbers with commas
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    // Format decimals to 2 places
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  return String(value);
}

// Loading state component
export function ExcelViewerLoading({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full", className)}>
      <Spinner size={32} className="mb-2 text-green-600" />
      <p className="text-sm text-muted-foreground">Loading spreadsheet...</p>
    </div>
  );
}

// Error state component
export function ExcelViewerError({
  error,
  className,
}: {
  error: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full", className)}>
      <FileSpreadsheet className="h-12 w-12 text-red-400 mb-2" />
      <p className="text-sm text-red-600 font-medium">Failed to load spreadsheet</p>
      <p className="text-xs text-muted-foreground mt-1">{error}</p>
    </div>
  );
}

export default ExcelViewer;
