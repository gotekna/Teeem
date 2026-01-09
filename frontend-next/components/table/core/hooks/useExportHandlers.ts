/**
 * Export Handlers Hook
 *
 * Provides handlers for exporting table data to CSV, Excel, and PDF formats.
 * Extracted from TeeemTableView to improve code organization and reusability.
 *
 * @see Phase 5 refactoring - Event Handler Hooks extraction
 */

import { useCallback } from 'react';
import type { TableColumn, TableRow as TableRowType } from '../../types';

export interface UseExportHandlersProps {
  /** Scope of export - visible columns only or all columns */
  exportScope: 'visible' | 'all';

  /** Array of visible data columns */
  visibleDataColumns: TableColumn[];

  /** Array of all data columns */
  allDataColumns: TableColumn[];

  /** The filtered and sorted table data */
  filteredAndSortedEntries: TableRowType[];

  /** Name of the table (used in filename) */
  tableName: string;

  /** Toast notification function */
  toast: (options: {
    title: string;
    description: string;
    variant?: 'default' | 'destructive';
  }) => void;

  /** Callback to close export modal (optional) */
  onExportComplete?: () => void;
}

export interface UseExportHandlersReturn {
  /** Export table data to CSV format */
  handleExportCSV: () => void;

  /** Export table data to Excel format */
  handleExportExcel: () => Promise<void>;

  /** Export table data to PDF format */
  handleExportPDF: () => Promise<void>;

  /** Master export handler that routes to the correct format */
  handleExport: (format: 'csv' | 'excel' | 'pdf') => void | Promise<void>;
}

/**
 * Hook for managing table export handlers
 *
 * @param props - Export configuration and dependencies
 * @returns Export handler functions
 */
export function useExportHandlers(props: UseExportHandlersProps): UseExportHandlersReturn {
  const {
    exportScope,
    visibleDataColumns,
    allDataColumns,
    filteredAndSortedEntries,
    tableName,
    toast,
    onExportComplete,
  } = props;

  // Export handler - exports to CSV
  const handleExportCSV = useCallback(() => {
    const columnsToExport = exportScope === "visible" ? visibleDataColumns : allDataColumns;

    // Helper to escape CSV values
    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // If contains comma, quote, or newline, wrap in quotes and escape existing quotes
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build header row
    const headers = columnsToExport.map((col) => escapeCSV(col.label || col.key));

    // Build data rows from filtered/sorted entries
    const rows = filteredAndSortedEntries.map((entry) => {
      return columnsToExport.map((col) => {
        const value = entry[col.key];
        // Handle objects (like nested relations)
        if (typeof value === "object" && value !== null) {
          if ("name" in value) return escapeCSV((value as { name: string }).name);
          if ("label" in value) return escapeCSV((value as { label: string }).label);
          return escapeCSV(JSON.stringify(value));
        }
        return escapeCSV(value);
      });
    });

    // Combine into CSV string
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    // Create and download blob
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const timestamp = new Date().toISOString().split("T")[0];
    const scopeLabel = exportScope === "visible" ? "visible" : "all";
    a.download = `${tableName.toLowerCase().replace(/\s+/g, "-")}-${scopeLabel}-${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Close modal and show toast
    onExportComplete?.();
    toast({
      title: "Export Complete",
      description: `Exported ${filteredAndSortedEntries.length} rows with ${columnsToExport.length} columns`,
    });
  }, [exportScope, visibleDataColumns, allDataColumns, filteredAndSortedEntries, tableName, toast, onExportComplete]);

  // Export handler - exports to Excel using TeeemXL
  const handleExportExcel = useCallback(async () => {
    const columnsToExport = exportScope === "visible" ? visibleDataColumns : allDataColumns;

    // Dynamic import TeeemXL to avoid SSR issues
    const TeeemXL = await import('@/lib/teeem-xl');

    // Build headers
    const headers = columnsToExport.map((col) => col.label || col.key);

    // Build data rows - ensure all values are CellValue compatible
    const dataRows: (string | number | boolean | Date | null)[][] = filteredAndSortedEntries.map((entry) => {
      return columnsToExport.map((col): string | number | boolean | Date | null => {
        const value = entry[col.key];
        // Handle null/undefined
        if (value === null || value === undefined) return null;
        // Handle dates
        if (value instanceof Date) return value;
        // Handle objects (like nested relations)
        if (typeof value === "object") {
          if ("name" in value) return String((value as { name: string }).name);
          if ("label" in value) return String((value as { label: string }).label);
          return JSON.stringify(value);
        }
        // Handle primitives
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          return value;
        }
        // Fallback: convert to string
        return String(value);
      });
    });

    // Combine headers and data into 2D array
    const allData = [headers, ...dataRows];

    // Calculate column widths (auto-size based on content)
    const columnWidths = columnsToExport.map((_, colIdx) => {
      let maxLen = String(headers[colIdx] || '').length;
      dataRows.forEach((row) => {
        const cellLen = String(row[colIdx] ?? '').length;
        if (cellLen > maxLen) maxLen = cellLen;
      });
      return Math.min(maxLen + 2, 50);
    });

    // Write Excel file using TeeemXL
    const blob = await TeeemXL.write(allData, {
      sheetName: tableName.slice(0, 31), // Sheet name max 31 chars
      headerStyle: { bold: true, backgroundColor: 'E0E0E0' }, // Header styling
      freezeHeader: true,
      columnWidths,
    });

    // Generate and download
    const timestamp = new Date().toISOString().split("T")[0];
    const scopeLabel = exportScope === "visible" ? "visible" : "all";
    const fileName = `${tableName.toLowerCase().replace(/\s+/g, "-")}-${scopeLabel}-${timestamp}.xlsx`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Close modal and show toast
    onExportComplete?.();
    toast({
      title: "Export Complete",
      description: `Exported ${filteredAndSortedEntries.length} rows to Excel`,
    });
  }, [exportScope, visibleDataColumns, allDataColumns, filteredAndSortedEntries, tableName, toast, onExportComplete]);

  // Export handler - exports to PDF
  const handleExportPDF = useCallback(async () => {
    const columnsToExport = exportScope === "visible" ? visibleDataColumns : allDataColumns;

    // Dynamic imports to avoid SSR issues
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    // Create PDF document
    const doc = new jsPDF({
      orientation: columnsToExport.length > 6 ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Add title
    doc.setFontSize(16);
    doc.text(tableName, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Exported: ${new Date().toLocaleString()}`, 14, 22);
    doc.text(`Rows: ${filteredAndSortedEntries.length} | Columns: ${columnsToExport.length}`, 14, 27);

    // Build table data
    const headers = columnsToExport.map((col) => col.label || col.key);
    const data = filteredAndSortedEntries.map((entry) => {
      return columnsToExport.map((col) => {
        const value = entry[col.key];
        // Handle objects (like nested relations)
        if (typeof value === "object" && value !== null) {
          if ("name" in value) return (value as { name: string }).name;
          if ("label" in value) return (value as { label: string }).label;
          return JSON.stringify(value);
        }
        // Truncate long values for PDF readability
        const strVal = String(value ?? '');
        return strVal.length > 50 ? strVal.slice(0, 47) + '...' : strVal;
      });
    });

    // Add table using autoTable
    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 32,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246], // Blue header
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      margin: { top: 32 },
    });

    // Generate and download
    const timestamp = new Date().toISOString().split("T")[0];
    const scopeLabel = exportScope === "visible" ? "visible" : "all";
    doc.save(`${tableName.toLowerCase().replace(/\s+/g, "-")}-${scopeLabel}-${timestamp}.pdf`);

    // Close modal and show toast
    onExportComplete?.();
    toast({
      title: "Export Complete",
      description: `Exported ${filteredAndSortedEntries.length} rows to PDF`,
    });
  }, [exportScope, visibleDataColumns, allDataColumns, filteredAndSortedEntries, tableName, toast, onExportComplete]);

  // Master export handler that routes to the correct format
  const handleExport = useCallback((format: 'csv' | 'excel' | 'pdf') => {
    switch (format) {
      case 'excel':
        return handleExportExcel();
      case 'pdf':
        return handleExportPDF();
      default:
        return handleExportCSV();
    }
  }, [handleExportCSV, handleExportExcel, handleExportPDF]);

  return {
    handleExportCSV,
    handleExportExcel,
    handleExportPDF,
    handleExport,
  };
}
