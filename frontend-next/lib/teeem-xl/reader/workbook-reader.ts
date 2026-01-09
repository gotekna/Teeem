/**
 * WorkbookReader - Parses XLSX files
 *
 * Uses JSZip for ZIP handling and DOMParser for XML parsing.
 */

import JSZip from 'jszip';
import type {
  Workbook,
  Worksheet,
  Cell,
  CellValue,
  CellType,
  Relationship,
  ParsedStyles,
  CellFormat,
} from '../types';
import { NAMESPACES, RELATIONSHIP_TYPES } from '../types';
import { parseReference, columnToIndex } from '../index';

// Date format IDs that indicate date values
const DATE_FORMAT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

// Excel epoch (December 30, 1899)
const EXCEL_EPOCH = new Date(1899, 11, 30);

export class WorkbookReader {
  private zip!: JSZip;
  private sharedStrings: string[] = [];
  private styles: ParsedStyles = {
    numberFormats: new Map(),
    cellFormats: [],
  };

  /**
   * Read an Excel file
   */
  async read(source: File | Blob | ArrayBuffer): Promise<Workbook> {
    // Load ZIP (type assertion needed for JSZip compatibility)
    this.zip = await JSZip.loadAsync(source) as JSZip;

    // Parse supporting files
    await this.parseSharedStrings();
    await this.parseStyles();

    // Parse workbook
    const workbookXml = await this.readXml('xl/workbook.xml');
    if (!workbookXml) {
      throw new Error('Invalid XLSX: missing workbook.xml');
    }

    // Get workbook relationships
    const workbookRels = await this.parseRelationships(
      'xl/_rels/workbook.xml.rels'
    );

    // Parse sheets
    const sheets: Worksheet[] = [];
    const sheetElements = workbookXml.getElementsByTagName('sheet');

    for (let i = 0; i < sheetElements.length; i++) {
      const sheetEl = sheetElements[i];
      const name = sheetEl.getAttribute('name') || `Sheet${i + 1}`;
      const sheetId = parseInt(sheetEl.getAttribute('sheetId') || '0', 10);
      const relId =
        sheetEl.getAttribute('r:id') ||
        sheetEl.getAttributeNS(NAMESPACES.officeDocument, 'id') ||
        '';

      // Find worksheet path from relationships
      const rel = workbookRels.find((r) => r.id === relId);
      if (!rel) continue;

      const sheetPath = `xl/${rel.target}`;
      const sheet = await this.parseWorksheet(sheetPath, name, sheetId, relId);
      sheets.push(sheet);
    }

    // Parse named ranges
    const namedRanges = new Map<string, string>();
    const definedNames = workbookXml.getElementsByTagName('definedName');
    for (let i = 0; i < definedNames.length; i++) {
      const el = definedNames[i];
      const name = el.getAttribute('name');
      const ref = el.textContent;
      if (name && ref) {
        namedRanges.set(name, ref);
      }
    }

    return { sheets, namedRanges };
  }

  /**
   * Parse shared strings table
   */
  private async parseSharedStrings(): Promise<void> {
    const xml = await this.readXml('xl/sharedStrings.xml');
    if (!xml) return;

    const siElements = xml.getElementsByTagName('si');
    for (let i = 0; i < siElements.length; i++) {
      const si = siElements[i];

      // Try simple text first
      const tElement = si.getElementsByTagName('t')[0];
      if (tElement) {
        this.sharedStrings.push(tElement.textContent || '');
        continue;
      }

      // Handle rich text (multiple runs)
      const runs = si.getElementsByTagName('r');
      if (runs.length > 0) {
        let text = '';
        for (let j = 0; j < runs.length; j++) {
          const runT = runs[j].getElementsByTagName('t')[0];
          if (runT) text += runT.textContent || '';
        }
        this.sharedStrings.push(text);
        continue;
      }

      this.sharedStrings.push('');
    }
  }

  /**
   * Parse styles for date detection
   */
  private async parseStyles(): Promise<void> {
    const xml = await this.readXml('xl/styles.xml');
    if (!xml) return;

    // Parse custom number formats
    const numFmts = xml.getElementsByTagName('numFmt');
    for (let i = 0; i < numFmts.length; i++) {
      const el = numFmts[i];
      const id = parseInt(el.getAttribute('numFmtId') || '0', 10);
      const code = el.getAttribute('formatCode') || '';
      this.styles.numberFormats.set(id, code);
    }

    // Parse cell formats (cellXfs)
    const xfElements = xml.querySelectorAll('cellXfs > xf');
    for (let i = 0; i < xfElements.length; i++) {
      const el = xfElements[i];
      this.styles.cellFormats.push({
        numFmtId: parseInt(el.getAttribute('numFmtId') || '0', 10),
        fontId: parseInt(el.getAttribute('fontId') || '0', 10),
        fillId: parseInt(el.getAttribute('fillId') || '0', 10),
        borderId: parseInt(el.getAttribute('borderId') || '0', 10),
      });
    }
  }

  /**
   * Parse a worksheet
   */
  private async parseWorksheet(
    path: string,
    name: string,
    sheetId: number,
    relId: string
  ): Promise<Worksheet> {
    const xml = await this.readXml(path);
    if (!xml) {
      throw new Error(`Could not read worksheet: ${path}`);
    }

    const cells = new Map<string, Cell>();
    const mergedCells: string[] = [];
    const columnWidths = new Map<number, number>();
    const rowHeights = new Map<number, number>();
    let frozenPanes: { row: number; col: number } | undefined;
    let autoFilter: string | undefined;

    // Parse cells
    const rowElements = xml.getElementsByTagName('row');
    for (let i = 0; i < rowElements.length; i++) {
      const rowEl = rowElements[i];
      const rowNum = parseInt(rowEl.getAttribute('r') || '0', 10);

      // Row height
      const ht = rowEl.getAttribute('ht');
      if (ht) {
        rowHeights.set(rowNum, parseFloat(ht));
      }

      // Parse cells in row
      const cellElements = rowEl.getElementsByTagName('c');
      for (let j = 0; j < cellElements.length; j++) {
        const cellEl = cellElements[j];
        const cell = this.parseCell(cellEl);
        if (cell) {
          cells.set(cell.reference, cell);
        }
      }
    }

    // Parse merged cells
    const mergeCellElements = xml.getElementsByTagName('mergeCell');
    for (let i = 0; i < mergeCellElements.length; i++) {
      const ref = mergeCellElements[i].getAttribute('ref');
      if (ref) mergedCells.push(ref);
    }

    // Parse column widths
    const colElements = xml.getElementsByTagName('col');
    for (let i = 0; i < colElements.length; i++) {
      const col = colElements[i];
      const min = parseInt(col.getAttribute('min') || '0', 10);
      const max = parseInt(col.getAttribute('max') || '0', 10);
      const width = parseFloat(col.getAttribute('width') || '0');

      for (let c = min; c <= max; c++) {
        columnWidths.set(c - 1, width); // Convert to 0-indexed
      }
    }

    // Parse frozen panes
    const paneEl = xml.querySelector('sheetView > pane');
    if (paneEl) {
      const xSplit = parseInt(paneEl.getAttribute('xSplit') || '0', 10);
      const ySplit = parseInt(paneEl.getAttribute('ySplit') || '0', 10);
      if (xSplit > 0 || ySplit > 0) {
        frozenPanes = { row: ySplit, col: xSplit };
      }
    }

    // Parse auto-filter
    const autoFilterEl = xml.getElementsByTagName('autoFilter')[0];
    if (autoFilterEl) {
      autoFilter = autoFilterEl.getAttribute('ref') || undefined;
    }

    return {
      name,
      sheetId,
      relId,
      cells,
      mergedCells,
      columnWidths,
      rowHeights,
      frozenPanes,
      autoFilter,
    };
  }

  /**
   * Parse a single cell
   */
  private parseCell(cellEl: Element): Cell | null {
    const reference = cellEl.getAttribute('r');
    if (!reference) return null;

    const typeAttr = cellEl.getAttribute('t');
    const styleIndex = parseInt(cellEl.getAttribute('s') || '0', 10) || undefined;

    // Get value element
    const vElement = cellEl.getElementsByTagName('v')[0];
    const rawValue = vElement?.textContent || null;

    // Get formula if present
    const fElement = cellEl.getElementsByTagName('f')[0];
    const formula = fElement?.textContent || undefined;

    // Get inline string if present
    const isElement = cellEl.querySelector('is > t');
    const inlineString = isElement?.textContent;

    // Resolve type and value
    const { type, value } = this.resolveCellValue(
      typeAttr,
      rawValue,
      inlineString,
      styleIndex,
      formula
    );

    const cell: Cell = {
      reference: reference.toUpperCase(),
      value,
      type,
      styleIndex,
      formula,
    };

    // Store cached value for formulas
    if (formula && rawValue) {
      cell.cachedValue = this.convertNumericValue(rawValue, styleIndex);
    }

    return cell;
  }

  /**
   * Resolve cell value based on type attribute and content
   */
  private resolveCellValue(
    typeAttr: string | null,
    rawValue: string | null,
    inlineString: string | null | undefined,
    styleIndex: number | undefined,
    formula: string | undefined
  ): { type: CellType; value: CellValue } {
    // Formula cell
    if (formula) {
      return { type: 'formula', value: null };
    }

    switch (typeAttr) {
      case 's': {
        // Shared string
        const index = parseInt(rawValue || '0', 10);
        return { type: 'string', value: this.sharedStrings[index] || '' };
      }

      case 'inlineStr':
        return { type: 'string', value: inlineString || '' };

      case 'b':
        return { type: 'boolean', value: rawValue === '1' };

      case 'e':
        return { type: 'error', value: rawValue };

      case 'str':
        return { type: 'string', value: rawValue };

      case 'd':
        // ISO date
        return {
          type: 'date',
          value: rawValue ? new Date(rawValue) : null,
        };

      default: {
        // Number or blank
        if (rawValue === null) {
          return { type: 'blank', value: null };
        }

        // Check if this is a date based on style
        if (this.isDateFormat(styleIndex)) {
          const serial = parseFloat(rawValue);
          return { type: 'date', value: this.excelDateToJS(serial) };
        }

        // Regular number
        const value = rawValue.includes('.')
          ? parseFloat(rawValue)
          : parseInt(rawValue, 10);

        return { type: 'number', value };
      }
    }
  }

  /**
   * Convert numeric string to appropriate value
   */
  private convertNumericValue(
    rawValue: string,
    styleIndex: number | undefined
  ): CellValue {
    if (this.isDateFormat(styleIndex)) {
      return this.excelDateToJS(parseFloat(rawValue));
    }
    return rawValue.includes('.')
      ? parseFloat(rawValue)
      : parseInt(rawValue, 10);
  }

  /**
   * Check if a style index represents a date format
   */
  private isDateFormat(styleIndex: number | undefined): boolean {
    if (styleIndex === undefined) return false;

    const format = this.styles.cellFormats[styleIndex];
    if (!format) return false;

    const numFmtId = format.numFmtId;
    if (numFmtId === undefined) return false;

    // Check built-in date formats
    if (DATE_FORMAT_IDS.has(numFmtId)) return true;

    // Check custom format codes
    const formatCode = this.styles.numberFormats.get(numFmtId);
    if (!formatCode) return false;

    // Date formats typically contain y, m, d patterns
    const lower = formatCode.toLowerCase();
    const hasDate =
      lower.includes('y') ||
      (lower.includes('m') && lower.includes('d')) ||
      lower.includes('mmm');

    return hasDate;
  }

  /**
   * Convert Excel serial date to JavaScript Date
   */
  private excelDateToJS(serial: number): Date {
    if (!serial || serial === 0) return new Date(0);

    // Handle Excel's 1900 leap year bug
    let days = Math.floor(serial);
    if (days > 60) days--;

    const timeFraction = serial - Math.floor(serial);

    const date = new Date(EXCEL_EPOCH);
    date.setDate(date.getDate() + days);

    if (timeFraction > 0) {
      const totalSeconds = Math.round(timeFraction * 86400);
      date.setHours(Math.floor(totalSeconds / 3600));
      date.setMinutes(Math.floor((totalSeconds % 3600) / 60));
      date.setSeconds(totalSeconds % 60);
    }

    return date;
  }

  /**
   * Parse relationships file
   */
  private async parseRelationships(path: string): Promise<Relationship[]> {
    const xml = await this.readXml(path);
    if (!xml) return [];

    const relationships: Relationship[] = [];
    const relElements = xml.getElementsByTagName('Relationship');

    for (let i = 0; i < relElements.length; i++) {
      const el = relElements[i];
      relationships.push({
        id: el.getAttribute('Id') || '',
        type: el.getAttribute('Type') || '',
        target: el.getAttribute('Target') || '',
        targetMode: el.getAttribute('TargetMode') || undefined,
      });
    }

    return relationships;
  }

  /**
   * Read and parse an XML file from the ZIP
   */
  private async readXml(path: string): Promise<Document | null> {
    const file = this.zip.file(path);
    if (!file) return null;

    const content = await file.async('string');
    const parser = new DOMParser();
    return parser.parseFromString(content, 'application/xml');
  }
}
