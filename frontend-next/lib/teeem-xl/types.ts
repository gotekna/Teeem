/**
 * TeeemXL Types
 *
 * TypeScript type definitions for the TeeemXL Excel library.
 */

/** Cell data types in Excel */
export type CellType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'error'
  | 'formula'
  | 'blank';

/** Cell value types */
export type CellValue = string | number | boolean | Date | null;

/** Cell representation */
export interface Cell {
  /** Cell reference (e.g., "A1", "B2") */
  reference: string;
  /** Cell value */
  value: CellValue;
  /** Cell type */
  type: CellType;
  /** Style index (reference to styles) */
  styleIndex?: number;
  /** Formula string (without =) */
  formula?: string;
  /** Cached formula result */
  cachedValue?: CellValue;
}

/** Row representation */
export interface Row {
  /** 1-based row number */
  rowNumber: number;
  /** Cells in this row */
  cells: Cell[];
}

/** Worksheet representation */
export interface Worksheet {
  /** Sheet name */
  name: string;
  /** Sheet ID */
  sheetId?: number;
  /** Relationship ID */
  relId?: string;
  /** All cells in the sheet */
  cells: Map<string, Cell>;
  /** Merged cell ranges */
  mergedCells: string[];
  /** Column widths (0-indexed) */
  columnWidths: Map<number, number>;
  /** Row heights (1-indexed) */
  rowHeights: Map<number, number>;
  /** Frozen panes configuration */
  frozenPanes?: { row: number; col: number };
  /** Auto-filter range */
  autoFilter?: string;
}

/** Workbook representation */
export interface Workbook {
  /** All worksheets */
  sheets: Worksheet[];
  /** Named ranges */
  namedRanges: Map<string, string>;
}

/** Relationship entry */
export interface Relationship {
  id: string;
  type: string;
  target: string;
  targetMode?: string;
}

/** Style definition */
export interface Style {
  fontName?: string;
  fontSize?: number;
  fontColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  backgroundColor?: string;
  border?: BorderStyle;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  wrapText?: boolean;
  numberFormat?: string;
}

/** Border style */
export interface BorderStyle {
  left?: 'thin' | 'medium' | 'thick';
  right?: 'thin' | 'medium' | 'thick';
  top?: 'thin' | 'medium' | 'thick';
  bottom?: 'thin' | 'medium' | 'thick';
  color?: string;
}

/** Cell format from styles.xml */
export interface CellFormat {
  numFmtId?: number;
  fontId?: number;
  fillId?: number;
  borderId?: number;
}

/** Parsed styles */
export interface ParsedStyles {
  numberFormats: Map<number, string>;
  cellFormats: CellFormat[];
}

/** Writer options */
export interface WriteOptions {
  /** Sheet name (default: "Sheet1") */
  sheetName?: string;
  /** Header row style */
  headerStyle?: Style;
  /** Apply auto-filter to header row */
  autoFilter?: boolean;
  /** Freeze the header row */
  freezeHeader?: boolean;
  /** Column widths */
  columnWidths?: number[];
}

/** OOXML namespace constants */
export const NAMESPACES = {
  spreadsheet: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  relationships: 'http://schemas.openxmlformats.org/package/2006/relationships',
  contentTypes: 'http://schemas.openxmlformats.org/package/2006/content-types',
  officeDocument:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
} as const;

/** Relationship type URIs */
export const RELATIONSHIP_TYPES = {
  worksheet:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
  sharedStrings:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings',
  styles:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  theme:
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme',
} as const;

/** Content type strings */
export const CONTENT_TYPES = {
  workbook:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
  worksheet:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
  sharedStrings:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml',
  styles:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml',
} as const;
