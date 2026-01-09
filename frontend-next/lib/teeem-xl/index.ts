/**
 * TeeemXL - Custom Excel Reader/Writer
 *
 * A dependency-free Excel library for reading and writing XLSX files.
 * Uses JSZip for ZIP handling and native DOM parsing for XML.
 *
 * Usage:
 *   // Reading
 *   const workbook = await TeeemXL.read(file);
 *   for (const sheet of workbook.sheets) {
 *     console.log(sheet.name, getRows(sheet));
 *   }
 *
 *   // Writing
 *   const blob = await TeeemXL.write(data, { sheetName: 'Report' });
 *   downloadBlob(blob, 'report.xlsx');
 */

import { WorkbookReader } from './reader/workbook-reader';
import { WorkbookWriter } from './writer/workbook-writer';
import type { Workbook, Worksheet, Cell, CellValue, WriteOptions } from './types';

export * from './types';
export { WorkbookReader } from './reader/workbook-reader';
export { WorkbookWriter } from './writer/workbook-writer';

/**
 * Read an Excel file
 *
 * @param source File, Blob, or ArrayBuffer containing XLSX data
 * @returns Parsed workbook
 */
export async function read(
  source: File | Blob | ArrayBuffer
): Promise<Workbook> {
  const reader = new WorkbookReader();
  return reader.read(source);
}

/**
 * Write data to an Excel file
 *
 * @param data 2D array of data (rows and columns)
 * @param options Write options
 * @returns Blob containing XLSX data
 */
export async function write(
  data: CellValue[][],
  options?: WriteOptions
): Promise<Blob> {
  const writer = new WorkbookWriter();
  return writer.write(data, options);
}

/**
 * Write a workbook to an Excel file
 *
 * @param workbook Workbook to write
 * @returns Blob containing XLSX data
 */
export async function writeWorkbook(workbook: Workbook): Promise<Blob> {
  const writer = new WorkbookWriter();
  return writer.writeWorkbook(workbook);
}

// Utility functions

/**
 * Get all rows from a worksheet as a 2D array
 */
export function getRows(sheet: Worksheet): CellValue[][] {
  if (sheet.cells.size === 0) return [];

  const rows: CellValue[][] = [];
  let maxRow = 0;
  let maxCol = 0;

  // Find dimensions
  Array.from(sheet.cells.values()).forEach((cell) => {
    const [row, col] = parseReference(cell.reference);
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
  });

  // Build 2D array
  for (let r = 1; r <= maxRow; r++) {
    const row: CellValue[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const ref = makeReference(r, c);
      const cell = sheet.cells.get(ref);
      row.push(cell?.value ?? null);
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Get a single cell value from a worksheet
 */
export function getCellValue(sheet: Worksheet, reference: string): CellValue {
  const cell = sheet.cells.get(reference.toUpperCase());
  return cell?.value ?? null;
}

/**
 * Convert column letter to 0-based index
 */
export function columnToIndex(col: string): number {
  let result = 0;
  for (const char of col.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }
  return result - 1;
}

/**
 * Convert 0-based index to column letter
 */
export function indexToColumn(index: number): string {
  let result = '';
  let n = index + 1;
  while (n > 0) {
    n--;
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

/**
 * Parse cell reference into row and column
 * @returns [row (1-based), column (0-based)]
 */
export function parseReference(ref: string): [number, number] {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) throw new Error(`Invalid cell reference: ${ref}`);
  return [parseInt(match[2], 10), columnToIndex(match[1])];
}

/**
 * Create cell reference from row and column
 * @param row 1-based row number
 * @param col 0-based column index
 */
export function makeReference(row: number, col: number): string {
  return `${indexToColumn(col)}${row}`;
}

// Default export for convenience
const TeeemXL = {
  read,
  write,
  writeWorkbook,
  getRows,
  getCellValue,
  columnToIndex,
  indexToColumn,
  parseReference,
  makeReference,
};

export default TeeemXL;
