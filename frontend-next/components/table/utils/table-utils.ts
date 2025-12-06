/**
 * Table Utilities
 *
 * Common utility functions used across table components.
 * Extracted from TeeemTableView.tsx to reduce duplication and improve maintainability.
 */

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
