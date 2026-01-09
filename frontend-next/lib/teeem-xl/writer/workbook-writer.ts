/**
 * WorkbookWriter - Generates XLSX files
 *
 * Creates valid XLSX files that can be opened in Excel.
 */

import * as JSZip from 'jszip';
import type { Workbook, Worksheet, Cell, CellValue, WriteOptions } from '../types';
import { NAMESPACES, RELATIONSHIP_TYPES, CONTENT_TYPES } from '../types';
import { makeReference, indexToColumn } from '../index';

// Excel epoch (December 30, 1899)
const EXCEL_EPOCH = new Date(1899, 11, 30);

export class WorkbookWriter {
  private sharedStrings: string[] = [];
  private stringIndexMap: Map<string, number> = new Map();

  /**
   * Write data to an Excel file
   */
  async write(data: CellValue[][], options?: WriteOptions): Promise<Blob> {
    const workbook = this.createWorkbook(data, options);
    return this.writeWorkbook(workbook);
  }

  /**
   * Write a workbook to an Excel file
   */
  async writeWorkbook(workbook: Workbook): Promise<Blob> {
    const zip = new JSZip();

    // Reset shared strings
    this.sharedStrings = [];
    this.stringIndexMap.clear();

    // Collect all strings first
    this.collectStrings(workbook);

    // Write all parts
    this.writeContentTypes(zip, workbook);
    this.writePackageRels(zip);
    this.writeWorkbookXml(zip, workbook);
    this.writeWorkbookRels(zip, workbook);
    this.writeWorksheets(zip, workbook);
    this.writeSharedStrings(zip);
    this.writeStyles(zip);

    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * Create a workbook from 2D data array
   */
  private createWorkbook(data: CellValue[][], options?: WriteOptions): Workbook {
    const sheetName = options?.sheetName || 'Sheet1';
    const cells = new Map<string, Cell>();

    // Convert data to cells
    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx];
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const value = row[colIdx];
        const reference = makeReference(rowIdx + 1, colIdx);
        const type = this.detectType(value);

        cells.set(reference, {
          reference,
          value,
          type,
          styleIndex: rowIdx === 0 && options?.headerStyle ? 1 : undefined,
        });
      }
    }

    // Build column widths
    const columnWidths = new Map<number, number>();
    if (options?.columnWidths) {
      options.columnWidths.forEach((width, idx) => {
        columnWidths.set(idx, width);
      });
    }

    const sheet: Worksheet = {
      name: sheetName,
      sheetId: 1,
      cells,
      mergedCells: [],
      columnWidths,
      rowHeights: new Map(),
      frozenPanes: options?.freezeHeader ? { row: 1, col: 0 } : undefined,
      autoFilter: options?.autoFilter && data.length > 0
        ? `A1:${indexToColumn(data[0].length - 1)}1`
        : undefined,
    };

    return {
      sheets: [sheet],
      namedRanges: new Map(),
    };
  }

  /**
   * Detect cell type from value
   */
  private detectType(value: CellValue): Cell['type'] {
    if (value === null || value === undefined) return 'blank';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    return 'string';
  }

  /**
   * Collect all strings for shared strings table
   */
  private collectStrings(workbook: Workbook): void {
    for (const sheet of workbook.sheets) {
      Array.from(sheet.cells.values()).forEach((cell) => {
        if (cell.type === 'string' && typeof cell.value === 'string') {
          this.addString(cell.value);
        }
      });
    }
  }

  /**
   * Add a string to shared strings and return its index
   */
  private addString(str: string): number {
    const existing = this.stringIndexMap.get(str);
    if (existing !== undefined) return existing;

    const index = this.sharedStrings.length;
    this.sharedStrings.push(str);
    this.stringIndexMap.set(str, index);
    return index;
  }

  /**
   * Write [Content_Types].xml
   */
  private writeContentTypes(zip: JSZip, workbook: Workbook): void {
    const parts = [
      '<Override PartName="/xl/workbook.xml" ContentType="' + CONTENT_TYPES.workbook + '"/>',
      '<Override PartName="/xl/sharedStrings.xml" ContentType="' + CONTENT_TYPES.sharedStrings + '"/>',
      '<Override PartName="/xl/styles.xml" ContentType="' + CONTENT_TYPES.styles + '"/>',
    ];

    workbook.sheets.forEach((_, idx) => {
      parts.push(
        `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="${CONTENT_TYPES.worksheet}"/>`
      );
    });

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${parts.join('\n  ')}
</Types>`;

    zip.file('[Content_Types].xml', xml);
  }

  /**
   * Write _rels/.rels
   */
  private writePackageRels(zip: JSZip): void {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    zip.file('_rels/.rels', xml);
  }

  /**
   * Write xl/workbook.xml
   */
  private writeWorkbookXml(zip: JSZip, workbook: Workbook): void {
    const sheets = workbook.sheets
      .map(
        (sheet, idx) =>
          `<sheet name="${this.escapeXml(sheet.name)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`
      )
      .join('\n    ');

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NAMESPACES.spreadsheet}" xmlns:r="${NAMESPACES.officeDocument}">
  <sheets>
    ${sheets}
  </sheets>
</workbook>`;

    zip.file('xl/workbook.xml', xml);
  }

  /**
   * Write xl/_rels/workbook.xml.rels
   */
  private writeWorkbookRels(zip: JSZip, workbook: Workbook): void {
    const rels: string[] = [];

    // Worksheet relationships
    workbook.sheets.forEach((_, idx) => {
      rels.push(
        `<Relationship Id="rId${idx + 1}" Type="${RELATIONSHIP_TYPES.worksheet}" Target="worksheets/sheet${idx + 1}.xml"/>`
      );
    });

    // Shared strings and styles
    const nextId = workbook.sheets.length + 1;
    rels.push(
      `<Relationship Id="rId${nextId}" Type="${RELATIONSHIP_TYPES.sharedStrings}" Target="sharedStrings.xml"/>`
    );
    rels.push(
      `<Relationship Id="rId${nextId + 1}" Type="${RELATIONSHIP_TYPES.styles}" Target="styles.xml"/>`
    );

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels.join('\n  ')}
</Relationships>`;

    zip.file('xl/_rels/workbook.xml.rels', xml);
  }

  /**
   * Write worksheets
   */
  private writeWorksheets(zip: JSZip, workbook: Workbook): void {
    workbook.sheets.forEach((sheet, idx) => {
      const xml = this.generateWorksheetXml(sheet);
      zip.file(`xl/worksheets/sheet${idx + 1}.xml`, xml);
    });
  }

  /**
   * Generate worksheet XML
   */
  private generateWorksheetXml(sheet: Worksheet): string {
    const parts: string[] = [];

    // Sheet views (frozen panes)
    let sheetViews = '<sheetViews><sheetView tabSelected="1" workbookViewId="0">';
    if (sheet.frozenPanes && (sheet.frozenPanes.row > 0 || sheet.frozenPanes.col > 0)) {
      const topLeft = makeReference(sheet.frozenPanes.row + 1, sheet.frozenPanes.col);
      const attrs = [`state="frozen"`, `topLeftCell="${topLeft}"`];
      if (sheet.frozenPanes.col > 0) attrs.push(`xSplit="${sheet.frozenPanes.col}"`);
      if (sheet.frozenPanes.row > 0) attrs.push(`ySplit="${sheet.frozenPanes.row}"`);
      sheetViews += `<pane ${attrs.join(' ')}/>`;
    }
    sheetViews += '</sheetView></sheetViews>';
    parts.push(sheetViews);

    // Sheet format
    parts.push('<sheetFormatPr defaultRowHeight="15"/>');

    // Column widths
    if (sheet.columnWidths.size > 0) {
      const cols = Array.from(sheet.columnWidths.entries())
        .sort((a, b) => a[0] - b[0])
        .map(
          ([col, width]) =>
            `<col min="${col + 1}" max="${col + 1}" width="${width}" customWidth="1"/>`
        )
        .join('');
      parts.push(`<cols>${cols}</cols>`);
    }

    // Sheet data
    const rowsXml = this.generateRowsXml(sheet);
    parts.push(`<sheetData>${rowsXml}</sheetData>`);

    // Merged cells
    if (sheet.mergedCells.length > 0) {
      const merges = sheet.mergedCells
        .map((ref) => `<mergeCell ref="${ref}"/>`)
        .join('');
      parts.push(`<mergeCells count="${sheet.mergedCells.length}">${merges}</mergeCells>`);
    }

    // Auto-filter
    if (sheet.autoFilter) {
      parts.push(`<autoFilter ref="${sheet.autoFilter}"/>`);
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NAMESPACES.spreadsheet}" xmlns:r="${NAMESPACES.officeDocument}">
  ${parts.join('\n  ')}
</worksheet>`;
  }

  /**
   * Generate rows XML
   */
  private generateRowsXml(sheet: Worksheet): string {
    if (sheet.cells.size === 0) return '';

    // Group cells by row
    const rowMap = new Map<number, Cell[]>();
    Array.from(sheet.cells.values()).forEach((cell) => {
      const match = cell.reference.match(/(\d+)$/);
      if (!match) return;
      const rowNum = parseInt(match[1], 10);

      if (!rowMap.has(rowNum)) {
        rowMap.set(rowNum, []);
      }
      rowMap.get(rowNum)!.push(cell);
    });

    // Sort rows and generate XML
    const sortedRows = Array.from(rowMap.entries()).sort((a, b) => a[0] - b[0]);
    return sortedRows
      .map(([rowNum, cells]) => {
        const sortedCells = cells.sort((a, b) => {
          const colA = a.reference.replace(/\d+$/, '');
          const colB = b.reference.replace(/\d+$/, '');
          return colA.localeCompare(colB);
        });

        const cellsXml = sortedCells.map((cell) => this.generateCellXml(cell)).join('');
        const height = sheet.rowHeights.get(rowNum);
        const htAttr = height ? ` ht="${height}" customHeight="1"` : '';

        return `<row r="${rowNum}"${htAttr}>${cellsXml}</row>`;
      })
      .join('');
  }

  /**
   * Generate cell XML
   */
  private generateCellXml(cell: Cell): string {
    const attrs: string[] = [`r="${cell.reference}"`];
    if (cell.styleIndex !== undefined) {
      attrs.push(`s="${cell.styleIndex}"`);
    }

    let content = '';

    switch (cell.type) {
      case 'string':
        if (typeof cell.value === 'string') {
          const index = this.stringIndexMap.get(cell.value) ?? 0;
          attrs.push('t="s"');
          content = `<v>${index}</v>`;
        }
        break;

      case 'number':
        content = `<v>${cell.value}</v>`;
        break;

      case 'boolean':
        attrs.push('t="b"');
        content = `<v>${cell.value ? 1 : 0}</v>`;
        break;

      case 'date':
        if (cell.value instanceof Date) {
          // Apply date style if not already styled
          if (cell.styleIndex === undefined) {
            // Check if it has a time component
            const hasTime = cell.value.getHours() !== 0 ||
                           cell.value.getMinutes() !== 0 ||
                           cell.value.getSeconds() !== 0;
            attrs.push(`s="${hasTime ? 3 : 2}"`); // DATETIME or DATE style
          }
          content = `<v>${this.dateToExcel(cell.value)}</v>`;
        }
        break;

      case 'formula':
        if (cell.formula) {
          content = `<f>${this.escapeXml(cell.formula)}</f>`;
          if (cell.cachedValue !== undefined) {
            content += `<v>${cell.cachedValue}</v>`;
          }
        }
        break;

      case 'error':
        attrs.push('t="e"');
        content = `<v>${cell.value}</v>`;
        break;

      case 'blank':
      default:
        break;
    }

    return `<c ${attrs.join(' ')}>${content}</c>`;
  }

  /**
   * Write xl/sharedStrings.xml
   */
  private writeSharedStrings(zip: JSZip): void {
    if (this.sharedStrings.length === 0) {
      // Write minimal shared strings to avoid errors
      zip.file(
        'xl/sharedStrings.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="${NAMESPACES.spreadsheet}" count="0" uniqueCount="0"/>`
      );
      return;
    }

    const strings = this.sharedStrings
      .map((s) => `<si><t>${this.escapeXml(s)}</t></si>`)
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="${NAMESPACES.spreadsheet}" count="${this.sharedStrings.length}" uniqueCount="${this.sharedStrings.length}">
  ${strings}
</sst>`;

    zip.file('xl/sharedStrings.xml', xml);
  }

  /**
   * Write xl/styles.xml
   */
  private writeStyles(zip: JSZip): void {
    // Enhanced styles with header, date, currency, and bordered styles
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NAMESPACES.spreadsheet}">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>
    <numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm:ss"/>
  </numFmts>
  <fonts count="2">
    <font>
      <sz val="11"/>
      <color rgb="FF000000"/>
      <name val="Calibri"/>
      <family val="2"/>
      <scheme val="minor"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="FFFFFFFF"/>
      <name val="Calibri"/>
      <family val="2"/>
      <scheme val="minor"/>
    </font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FF4472C4"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="2">
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
    <border>
      <left style="thin"><color auto="1"/></left>
      <right style="thin"><color auto="1"/></right>
      <top style="thin"><color auto="1"/></top>
      <bottom style="thin"><color auto="1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

    zip.file('xl/styles.xml', xml);
  }

  // Style indices for convenience
  static readonly STYLE_INDEX = {
    NORMAL: 0,
    HEADER: 1,
    DATE: 2,
    DATETIME: 3,
    BORDERED: 4,
  } as const;

  /**
   * Convert JavaScript Date to Excel serial number
   */
  private dateToExcel(date: Date): number {
    const msPerDay = 86400000;
    let days = Math.floor(
      (date.getTime() - EXCEL_EPOCH.getTime()) / msPerDay
    );

    // Excel has a bug where it thinks 1900 was a leap year (Feb 29, 1900 = day 60)
    // For dates on or after Mar 1, 1900, we need to add 1 to the serial
    const march1_1900 = new Date(1900, 2, 1); // March 1, 1900
    if (date >= march1_1900) {
      days += 1;
    }

    // Time fraction
    const timeFraction =
      (date.getHours() * 3600 +
        date.getMinutes() * 60 +
        date.getSeconds()) /
      86400;

    return days + timeFraction;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
