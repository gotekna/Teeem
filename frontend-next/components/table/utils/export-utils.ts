/**
 * Export Utilities
 *
 * Functions for exporting table data to various formats (CSV, Excel, PDF).
 * Extracted from TeeemTableView.tsx to separate concerns.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { TableColumn, TableRow } from "../types";

/**
 * Export scope - which columns to include
 */
export type ExportScope = "visible" | "all";

/**
 * Export format
 */
export type ExportFormat = "csv" | "excel" | "pdf";

/**
 * Export table data to CSV
 *
 * @param data - Array of records
 * @param columns - Column definitions
 * @param scope - Which columns to include
 * @param filename - Output filename (without extension)
 */
export function exportToCSV(
  data: TableRow[],
  columns: TableColumn[],
  scope: ExportScope,
  filename: string = "export"
): void {
  const columnsToExport = scope === "visible"
    ? columns.filter(col => col.key !== "select" && col.key !== "actions")
    : columns.filter(col => col.key !== "select" && col.key !== "actions");

  // Header row
  const headers = columnsToExport.map(col => col.label);

  // Data rows
  const rows = data.map(row =>
    columnsToExport.map(col => {
      const value = row[col.key];
      return formatValueForExport(value, col.column_type);
    })
  );

  // Convert to CSV string
  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map(row => row.map(escapeCSV).join(","))
  ].join("\n");

  // Trigger download
  downloadFile(csvContent, `${filename}.csv`, "text/csv");
}

/**
 * Export table data to Excel
 *
 * @param data - Array of records
 * @param columns - Column definitions
 * @param scope - Which columns to include
 * @param filename - Output filename (without extension)
 */
export function exportToExcel(
  data: TableRow[],
  columns: TableColumn[],
  scope: ExportScope,
  filename: string = "export"
): void {
  const columnsToExport = scope === "visible"
    ? columns.filter(col => col.key !== "select" && col.key !== "actions")
    : columns.filter(col => col.key !== "select" && col.key !== "actions");

  // Prepare data for Excel
  const headers = columnsToExport.map(col => col.label);
  const rows = data.map(row =>
    columnsToExport.map(col => {
      const value = row[col.key];
      return formatValueForExport(value, col.column_type);
    })
  );

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  ws['!cols'] = columnsToExport.map(col => ({
    wch: Math.max(col.label.length, 15)
  }));

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  // Trigger download
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export table data to PDF
 *
 * @param data - Array of records
 * @param columns - Column definitions
 * @param scope - Which columns to include
 * @param filename - Output filename (without extension)
 * @param tableName - Name to display in PDF header
 */
export function exportToPDF(
  data: TableRow[],
  columns: TableColumn[],
  scope: ExportScope,
  filename: string = "export",
  tableName: string = "Table Data"
): void {
  const columnsToExport = scope === "visible"
    ? columns.filter(col => col.key !== "select" && col.key !== "actions")
    : columns.filter(col => col.key !== "select" && col.key !== "actions");

  // Create PDF document
  const doc = new jsPDF({
    orientation: columnsToExport.length > 5 ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  // Add title
  doc.setFontSize(16);
  doc.text(tableName, 14, 15);

  // Add timestamp
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

  // Prepare table data
  const headers = columnsToExport.map(col => col.label);
  const rows = data.map(row =>
    columnsToExport.map(col => {
      const value = row[col.key];
      return formatValueForExport(value, col.column_type);
    })
  );

  // Add table using autoTable
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 28,
    theme: "striped",
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: columnsToExport.reduce((acc, col, idx) => {
      // Adjust column widths based on type
      let width: "auto" | number = "auto";
      if (col.column_type === "boolean") {
        width = 15;
      } else if (col.column_type === "date") {
        width = 25;
      } else if (["currency", "number", "percentage"].includes(col.column_type || "")) {
        width = 20;
      }

      acc[idx] = { cellWidth: width };
      return acc;
    }, {} as Record<number, { cellWidth: "auto" | number }>),
  });

  // Save PDF
  doc.save(`${filename}.pdf`);
}

/**
 * Format value for export
 *
 * @param value - Raw value
 * @param columnType - Type of column
 * @returns Formatted value as string
 */
function formatValueForExport(value: unknown, columnType?: string): string {
  if (value === null || value === undefined) {
    return "";
  }

  switch (columnType) {
    case "boolean":
      return value === true || value === "true" ? "Yes" : value === false || value === "false" ? "No" : "";

    case "currency":
      if (typeof value === "number") {
        return `$${value.toFixed(2)}`;
      }
      return String(value);

    case "percentage":
      if (typeof value === "number") {
        return `${value}%`;
      }
      return String(value);

    case "date":
    case "date_and_time":
      // Format dates as ISO strings
      if (value instanceof Date) {
        return value.toISOString();
      }
      return String(value);

    case "multiple_lookups":
    case "array_of_items":
      // Convert arrays to comma-separated strings
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return String(value);

    case "structured_data":
      // Convert objects to JSON strings
      if (typeof value === "object") {
        return JSON.stringify(value);
      }
      return String(value);

    default:
      return String(value);
  }
}

/**
 * Escape CSV value
 *
 * @param value - Value to escape
 * @returns Escaped string
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // If contains comma, newline, or quotes, wrap in quotes and escape internal quotes
  if (str.includes(",") || str.includes("\n") || str.includes("\r") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Trigger file download in browser
 *
 * @param content - File content
 * @param filename - Filename with extension
 * @param mimeType - MIME type
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get suggested filename based on table name and current date
 *
 * @param tableName - Name of the table
 * @param format - Export format
 * @returns Suggested filename
 */
export function getSuggestedFilename(tableName: string, format: ExportFormat): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const sanitizedName = tableName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const extension = format === "excel" ? "xlsx" : format === "pdf" ? "pdf" : "csv";

  return `${sanitizedName}-${date}.${extension}`;
}
