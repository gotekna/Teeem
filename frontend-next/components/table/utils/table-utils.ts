/**
 * Table Utilities
 *
 * Common utility functions used across table components.
 * Extracted from TeeemTableView.tsx to reduce duplication and improve maintainability.
 */

import { TableColumn } from "../types";
import {
  SYSTEM_GENERATED_TYPES as _SYSTEM_GENERATED_TYPES,
  SYSTEM_VISIBLE_COLUMNS,
} from "@/lib/constants/system-columns";

// ============================================================================
// CONSTANTS (SSoT: Re-exported from @/lib/constants/system-columns)
// ============================================================================

/**
 * Column types that are system-generated/computed (user cannot manually enter)
 * SSoT: @/lib/constants/system-columns.ts
 */
export const SYSTEM_GENERATED_TYPES = _SYSTEM_GENERATED_TYPES;

/**
 * Background color for system-generated columns
 * Uses CSS variable for dark mode support
 */
export const SYSTEM_COLUMN_BG = "hsl(var(--system-column-bg))";

/**
 * Non-editable column keys
 * SSoT: @/lib/constants/system-columns.ts (SYSTEM_VISIBLE_COLUMNS)
 */
export const NON_EDITABLE_COLUMNS = SYSTEM_VISIBLE_COLUMNS;

/**
 * Default columns for generic tables
 */
export const DEFAULT_COLUMNS: TableColumn[] = [
  { key: "select", label: "", resizable: false, sortable: false, filterable: false, width: 40 },
  { key: "id", label: "ID", resizable: true, sortable: true, filterable: true, width: 50 },
  { key: "actions", label: "", resizable: false, sortable: false, filterable: false, width: 50 },
];

/**
 * Filter operators for display in cascade filters
 */
export const FILTER_OPERATOR_LABELS: Record<string, string> = {
  "=": "equals",
  "!=": "not equals",
  ">": ">",
  "<": "<",
  ">=": ">=",
  "<=": "<=",
  "contains": "contains",
  "not_contains": "not contains",
  "starts_with": "starts with",
  "ends_with": "ends with",
  "is_empty": "is empty",
  "is_not_empty": "is not empty",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a column is system-generated (non-editable, auto-computed)
 */
export function isSystemGeneratedColumn(column: TableColumn): boolean {
  return (
    column.editable === false ||
    column.system === true ||
    (NON_EDITABLE_COLUMNS as readonly string[]).includes(column.key) ||
    (NON_EDITABLE_COLUMNS as readonly string[]).includes(column.key?.toLowerCase()) ||
    (SYSTEM_GENERATED_TYPES as readonly string[]).includes(column.column_type || "")
  );
}

/**
 * Helper to get plain text for cell tooltip (handles objects, arrays, etc.)
 */
export function getCellTooltip(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    // Handle lookup/relation objects
    if ("display" in value) return String((value as { display: string }).display) || undefined;
    if ("name" in value) return String((value as { name: string }).name) || undefined;
    if ("label" in value) return String((value as { label: string }).label) || undefined;
    // Handle arrays (multi-select)
    if (Array.isArray(value) && value.length > 0) {
      const text = value
        .map((v) => {
          if (typeof v === "object" && v !== null) {
            if ("display" in v) return (v as { display: string }).display;
            if ("name" in v) return (v as { name: string }).name;
            return JSON.stringify(v);
          }
          return String(v);
        })
        .join(", ");
      return text || undefined;
    }
  }
  return undefined;
}

// ============================================================================
// ID AND SELECTION UTILITIES
// ============================================================================

/**
 * Extract selected IDs from various value formats
 *
 * This function consolidates the duplicated getSelectedOptionIds logic that appeared
 * in both lookup and multiple_lookups editors.
 *
 * Handles:
 * - Direct number IDs: 123
 * - Objects with ID: { id: 123 }
 * - String IDs: "123"
 * - Name matching: finds option by display name
 *
 * @param values - Array of values in various formats
 * @param options - Available options to match against
 * @returns Set of numeric IDs
 */
export function extractSelectedIds(
  values: unknown,
  options: Array<{ id: number; display: string }>
): Set<number> {
  if (!Array.isArray(values)) return new Set();

  const selectedSet = new Set<number>();

  for (const v of values) {
    if (typeof v === 'number') {
      // Direct number ID
      selectedSet.add(v);
    } else if (typeof v === 'object' && v !== null && 'id' in v) {
      // Object with ID property
      const objId = (v as { id: number | string }).id;
      if (typeof objId === 'number') {
        selectedSet.add(objId);
      } else if (typeof objId === 'string') {
        const numId = parseInt(objId, 10);
        if (!isNaN(numId)) {
          selectedSet.add(numId);
        } else {
          // String name - find matching option by display name
          const normalizedValue = objId.toLowerCase().replace(/\s+/g, '_');
          const matchingOption = options.find(opt =>
            opt.display.toLowerCase().replace(/\s+/g, '_') === normalizedValue
          );
          if (matchingOption) {
            selectedSet.add(matchingOption.id);
          }
        }
      }
    } else if (typeof v === 'string') {
      // String value
      const numId = parseInt(v, 10);
      if (!isNaN(numId)) {
        selectedSet.add(numId);
      } else {
        // String name - find matching option by display name
        const normalizedValue = v.toLowerCase().replace(/\s+/g, '_');
        const matchingOption = options.find(opt =>
          opt.display.toLowerCase().replace(/\s+/g, '_') === normalizedValue
        );
        if (matchingOption) {
          selectedSet.add(matchingOption.id);
        }
      }
    }
  }

  return selectedSet;
}

/**
 * Format cell value for display
 *
 * Handles formatting of common types like dates, numbers, currency.
 *
 * @param value - Raw value
 * @param columnType - Type of column
 * @returns Formatted string
 */
export function formatCellValue(value: unknown, columnType: string): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  switch (columnType) {
    case 'currency':
      if (typeof value === 'number') {
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return String(value);

    case 'percentage':
      if (typeof value === 'number') {
        return `${value}%`;
      }
      return String(value);

    case 'whole_number':
    case 'number':
      if (typeof value === 'number') {
        return value.toLocaleString('en-US');
      }
      return String(value);

    case 'date':
    case 'date_and_time':
      // Date formatting handled by date-fns elsewhere
      return String(value);

    case 'boolean':
      return value === true || value === 'true' ? 'Yes' : value === false || value === 'false' ? 'No' : '';

    default:
      return String(value);
  }
}

/**
 * Truncate text to specified length
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Parse CSV data
 *
 * @param csvText - CSV string
 * @returns Array of arrays representing rows and columns
 */
export function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentCell += '"';
        i++; // Skip next quote
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of cell
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of row
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip \n in \r\n
      }
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      }
    } else {
      currentCell += char;
    }
  }

  // Add final cell/row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Convert array of objects to CSV string
 *
 * @param data - Array of objects
 * @param columns - Columns to include
 * @returns CSV string
 */
export function objectsToCSV(
  data: Record<string, unknown>[],
  columns: string[]
): string {
  if (data.length === 0) return '';

  // Header row
  const header = columns.map(escapeCSVValue).join(',');

  // Data rows
  const rows = data.map(row =>
    columns.map(col => escapeCSVValue(row[col])).join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Escape value for CSV
 *
 * @param value - Value to escape
 * @returns Escaped string
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = String(value);

  // If contains comma, newline, or quotes, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Fuzzy search using trigram similarity (matches PostgreSQL pg_trgm behavior)
 *
 * Compares the search term against words in the text to find fuzzy matches.
 * This allows users to find "Coastal" by typing "coasal" (typo).
 *
 * @param search - The search term (user input, may contain typos)
 * @param text - The text to search within
 * @param threshold - Minimum similarity score (0-1). Default 0.4 matches pg_trgm word_similarity
 * @returns true if the text fuzzy-matches the search term
 */
export function fuzzyMatch(search: string, text: string, threshold: number = 0.4): boolean {
  if (!search || !text) return false;

  const searchLower = search.toLowerCase();
  const textLower = text.toLowerCase();

  // First check exact substring match (fast path)
  if (textLower.includes(searchLower)) {
    return true;
  }

  // Calculate trigram similarity for fuzzy matching
  // Split text into words and check each word against search term
  const words = textLower.split(/\s+/);

  for (const word of words) {
    const similarity = trigramSimilarity(searchLower, word);
    if (similarity >= threshold) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate trigram similarity between two strings (Dice coefficient)
 * Mimics PostgreSQL's pg_trgm similarity function
 *
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score between 0 and 1
 */
function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const trigramsA = getTrigrams(a);
  const trigramsB = getTrigrams(b);

  if (trigramsA.size === 0 || trigramsB.size === 0) return 0;

  // Count matching trigrams
  let matches = 0;
  for (const trigram of trigramsA) {
    if (trigramsB.has(trigram)) {
      matches++;
    }
  }

  // Dice coefficient: 2 * |A ∩ B| / (|A| + |B|)
  return (2 * matches) / (trigramsA.size + trigramsB.size);
}

/**
 * Extract trigrams from a string
 * Pads with spaces like PostgreSQL's pg_trgm
 *
 * @param s - Input string
 * @returns Set of trigrams
 */
function getTrigrams(s: string): Set<string> {
  const trigrams = new Set<string>();

  // Pad string with spaces (like pg_trgm)
  const padded = `  ${s} `;

  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.add(padded.slice(i, i + 3));
  }

  return trigrams;
}

/**
 * Calculate column statistics
 *
 * @param data - Array of records
 * @param columnKey - Column to calculate stats for
 * @param columnType - Type of column
 * @returns Statistics object
 */
export function calculateColumnStats(
  data: Record<string, unknown>[],
  columnKey: string,
  columnType: string
): {
  sum?: number;
  average?: number;
  min?: number;
  max?: number;
  count: number;
} {
  const stats: {
    sum?: number;
    average?: number;
    min?: number;
    max?: number;
    count: number;
  } = {
    count: data.length,
  };

  if (['number', 'whole_number', 'currency', 'percentage'].includes(columnType)) {
    const values = data
      .map(row => row[columnKey])
      .filter(v => typeof v === 'number' || !isNaN(Number(v)))
      .map(v => Number(v));

    if (values.length > 0) {
      stats.sum = values.reduce((a, b) => a + b, 0);
      stats.average = stats.sum / values.length;
      stats.min = Math.min(...values);
      stats.max = Math.max(...values);
    }
  }

  return stats;
}
