/**
 * ExportManager - Handles all export functionality for the Gantt chart
 *
 * Responsibilities:
 * - Image export (PNG, JPEG)
 * - PDF export
 * - CSV export
 * - JSON export/import
 * - MS Project export
 * - SVG export
 * - Clipboard operations
 *
 * @example
 * ```typescript
 * const exportManager = new ExportManager();
 * exportManager.setDataAccessors(getTasks, getDependencies);
 * exportManager.setCanvas(canvasElement);
 *
 * // Export to various formats
 * const imageUrl = exportManager.toImage('png');
 * const csvData = exportManager.toCSV();
 * await exportManager.downloadPDF({ title: 'My Schedule' });
 * ```
 */

import type { GanttTask, GanttDependency } from '../GanttCanvas';

// ============================================================================
// Types
// ============================================================================

export interface PDFExportOptions {
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'A3' | 'letter' | 'legal';
  quality?: number;
  includeTaskList?: boolean;
  title?: string;
}

export interface ImageExportOptions {
  format?: 'png' | 'jpeg';
  quality?: number;
  scale?: number;
  backgroundColor?: string;
}

export interface CSVExportOptions {
  delimiter?: string;
  includeHeaders?: boolean;
  dateFormat?: 'iso' | 'local';
}

export interface JSONExportData {
  tasks: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    progress?: number;
    status?: string;
    locked?: string;
    predecessorIds?: string[];
    supplierId?: number;
    supplierName?: string;
  }>;
  dependencies: GanttDependency[];
  exportedAt: string;
  version?: string;
}

export interface ExportEvent {
  type: 'image' | 'pdf' | 'csv' | 'json' | 'msproject' | 'svg';
  format?: string;
  filename?: string;
  success: boolean;
  error?: Error;
}

type ExportCallback = (event: ExportEvent) => void;

// ============================================================================
// ExportManager Class
// ============================================================================

export class ExportManager {
  // Canvas reference
  private canvas: HTMLCanvasElement | null = null;

  // Data accessors (injected)
  private getTasks: (() => GanttTask[]) | null = null;
  private getDependencies: (() => GanttDependency[]) | null = null;

  // Callbacks
  private exportCallbacks: Set<ExportCallback> = new Set();

  // ============================================================================
  // Setup
  // ============================================================================

  /**
   * Set the canvas element for image/PDF export
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /**
   * Set data accessor functions
   */
  setDataAccessors(
    getTasks: () => GanttTask[],
    getDependencies: () => GanttDependency[]
  ): void {
    this.getTasks = getTasks;
    this.getDependencies = getDependencies;
  }

  // ============================================================================
  // Image Export
  // ============================================================================

  /**
   * Export canvas to image data URL
   */
  toImage(format: 'png' | 'jpeg' = 'png', quality: number = 0.92): string | null {
    if (!this.canvas) {
      this.emitEvent({ type: 'image', format, success: false, error: new Error('Canvas not set') });
      return null;
    }

    try {
      const dataUrl = this.canvas.toDataURL(`image/${format}`, quality);
      this.emitEvent({ type: 'image', format, success: true });
      return dataUrl;
    } catch (error) {
      this.emitEvent({ type: 'image', format, success: false, error: error as Error });
      return null;
    }
  }

  /**
   * Export canvas to Blob
   */
  async toBlob(format: 'png' | 'jpeg' = 'png', quality: number = 0.92): Promise<Blob | null> {
    if (!this.canvas) {
      return null;
    }

    return new Promise((resolve) => {
      this.canvas!.toBlob(
        blob => resolve(blob),
        `image/${format}`,
        quality
      );
    });
  }

  /**
   * Download canvas as image file
   */
  downloadImage(filename: string = 'gantt-chart', format: 'png' | 'jpeg' = 'png', quality: number = 0.92): void {
    const dataUrl = this.toImage(format, quality);
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.download = `${filename}.${format}`;
    link.href = dataUrl;
    link.click();
  }

  // ============================================================================
  // CSV Export
  // ============================================================================

  /**
   * Export tasks to CSV format
   */
  toCSV(options: CSVExportOptions = {}): string | null {
    if (!this.getTasks) return null;

    const {
      delimiter = ',',
      includeHeaders = true,
      dateFormat = 'iso',
    } = options;

    const tasks = this.getTasks();
    const formatDate = dateFormat === 'iso'
      ? (d: Date) => d.toISOString().split('T')[0]
      : (d: Date) => d.toLocaleDateString();

    const headers = ['ID', 'Name', 'Start Date', 'End Date', 'Duration (days)', 'Progress', 'Status', 'Locked', 'Predecessors'];

    const rows = tasks.map(t => {
      const duration = Math.ceil((t.endDate.getTime() - t.startDate.getTime()) / (24 * 60 * 60 * 1000));
      return [
        t.id,
        `"${t.name.replace(/"/g, '""')}"`,
        formatDate(t.startDate),
        formatDate(t.endDate),
        duration.toString(),
        (t.progress || 0).toString(),
        t.status || 'not-started',
        t.locked || '',
        (t.predecessorIds || []).join(';'),
      ].join(delimiter);
    });

    const csv = includeHeaders
      ? [headers.join(delimiter), ...rows].join('\n')
      : rows.join('\n');

    this.emitEvent({ type: 'csv', success: true });
    return csv;
  }

  /**
   * Download CSV file
   */
  downloadCSV(filename: string = 'gantt-tasks', options: CSVExportOptions = {}): void {
    const csv = this.toCSV(options);
    if (!csv) return;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ============================================================================
  // JSON Export/Import
  // ============================================================================

  /**
   * Export data to JSON format
   */
  toJSON(): string | null {
    if (!this.getTasks || !this.getDependencies) return null;

    const tasks = this.getTasks();
    const dependencies = this.getDependencies();

    const data: JSONExportData = {
      tasks: tasks.map(t => ({
        id: t.id,
        name: t.name,
        startDate: t.startDate.toISOString(),
        endDate: t.endDate.toISOString(),
        progress: t.progress,
        status: t.status,
        locked: t.locked,
        predecessorIds: t.predecessorIds,
        supplierId: t.supplierId,
        supplierName: t.supplierName,
      })),
      dependencies,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    this.emitEvent({ type: 'json', success: true });
    return JSON.stringify(data, null, 2);
  }

  /**
   * Parse JSON import data (validation only, doesn't apply)
   */
  parseJSON(json: string): { tasks: GanttTask[]; dependencies: GanttDependency[] } | null {
    try {
      const data = JSON.parse(json) as JSONExportData;

      if (!data.tasks || !Array.isArray(data.tasks)) {
        throw new Error('Invalid JSON format: missing tasks array');
      }

      const tasks: GanttTask[] = data.tasks.map(t => ({
        id: t.id,
        name: t.name,
        startDate: new Date(t.startDate),
        endDate: new Date(t.endDate),
        progress: t.progress,
        status: t.status as GanttTask['status'],
        locked: t.locked as GanttTask['locked'],
        predecessorIds: t.predecessorIds,
        supplierId: t.supplierId,
        supplierName: t.supplierName,
      }));

      const dependencies = data.dependencies || [];

      return { tasks, dependencies };
    } catch (error) {
      console.error('[ExportManager] Failed to parse JSON:', error);
      return null;
    }
  }

  /**
   * Download JSON file
   */
  downloadJSON(filename: string = 'gantt-data'): void {
    const json = this.toJSON();
    if (!json) return;

    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ============================================================================
  // PDF Export
  // ============================================================================

  /**
   * Export to PDF (requires html2canvas + jspdf)
   */
  async toPDF(options: PDFExportOptions = {}): Promise<Blob | null> {
    if (!this.canvas || !this.getTasks) {
      this.emitEvent({ type: 'pdf', success: false, error: new Error('Canvas or tasks not available') });
      return null;
    }

    const {
      orientation = 'landscape',
      pageSize = 'A4',
      quality = 2,
      includeTaskList = true,
      title = 'Gantt Chart',
    } = options;

    try {
      // Dynamic imports for PDF libraries
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Create a temporary container for the canvas
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.appendChild(this.canvas.cloneNode(true) as HTMLCanvasElement);
      document.body.appendChild(container);

      // Capture canvas as image
      const canvasImage = await html2canvas(container, { scale: quality });

      // Create PDF
      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: pageSize,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Add title
      pdf.setFontSize(16);
      pdf.text(title, pageWidth / 2, 15, { align: 'center' });

      // Add chart image
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvasImage.height * imgWidth) / canvasImage.width;
      pdf.addImage(canvasImage.toDataURL('image/png'), 'PNG', 10, 25, imgWidth, Math.min(imgHeight, pageHeight - 50));

      // Add task list on additional pages if requested
      if (includeTaskList) {
        const tasks = this.getTasks!();
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.text('Task List', 10, 15);

        let y = 25;
        pdf.setFontSize(10);

        tasks.forEach((task, index) => {
          if (y > pageHeight - 20) {
            pdf.addPage();
            y = 15;
          }

          const status = task.status || 'not-started';
          const progress = task.progress || 0;
          pdf.text(`${index + 1}. ${task.name} - ${status} (${progress}%)`, 10, y);
          y += 7;
        });
      }

      // Cleanup
      document.body.removeChild(container);

      this.emitEvent({ type: 'pdf', success: true });
      return pdf.output('blob');

    } catch (error) {
      console.error('[ExportManager] PDF export failed:', error);
      this.emitEvent({ type: 'pdf', success: false, error: error as Error });
      return null;
    }
  }

  /**
   * Download PDF file
   */
  async downloadPDF(options: PDFExportOptions = {}): Promise<void> {
    const blob = await this.toPDF(options);
    if (!blob) return;

    const filename = options.filename || 'gantt-chart.pdf';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================================
  // MS Project Export
  // ============================================================================

  /**
   * Export to MS Project XML format (basic)
   */
  toMSProjectXML(): string | null {
    if (!this.getTasks || !this.getDependencies) return null;

    const tasks = this.getTasks();
    const dependencies = this.getDependencies();

    // Build XML structure
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Project xmlns="http://schemas.microsoft.com/project">',
      '  <Name>Gantt Export</Name>',
      '  <Tasks>',
    ];

    tasks.forEach((task, index) => {
      const duration = Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (24 * 60 * 60 * 1000));

      xml.push(`    <Task>`);
      xml.push(`      <UID>${index + 1}</UID>`);
      xml.push(`      <ID>${index + 1}</ID>`);
      xml.push(`      <Name>${this.escapeXML(task.name)}</Name>`);
      xml.push(`      <Start>${task.startDate.toISOString()}</Start>`);
      xml.push(`      <Finish>${task.endDate.toISOString()}</Finish>`);
      xml.push(`      <Duration>PT${duration * 8}H0M0S</Duration>`);
      xml.push(`      <PercentComplete>${task.progress || 0}</PercentComplete>`);
      xml.push(`    </Task>`);
    });

    xml.push('  </Tasks>');

    // Add dependencies (links)
    if (dependencies.length > 0) {
      xml.push('  <Assignments/>');
      xml.push('  <Links>');

      dependencies.forEach((dep, index) => {
        const fromIndex = tasks.findIndex(t => t.id === dep.fromId);
        const toIndex = tasks.findIndex(t => t.id === dep.toId);

        if (fromIndex >= 0 && toIndex >= 0) {
          xml.push(`    <Link>`);
          xml.push(`      <LinkUID>${index + 1}</LinkUID>`);
          xml.push(`      <PredecessorUID>${fromIndex + 1}</PredecessorUID>`);
          xml.push(`      <SuccessorUID>${toIndex + 1}</SuccessorUID>`);
          xml.push(`      <Type>1</Type>`); // FS = 1, SS = 0, FF = 2, SF = 3
          xml.push(`    </Link>`);
        }
      });

      xml.push('  </Links>');
    }

    xml.push('</Project>');

    this.emitEvent({ type: 'msproject', success: true });
    return xml.join('\n');
  }

  /**
   * Download MS Project XML file
   */
  downloadMSProject(filename: string = 'gantt-project'): void {
    const xml = this.toMSProjectXML();
    if (!xml) return;

    const blob = new Blob([xml], { type: 'application/xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.xml`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ============================================================================
  // SVG Export
  // ============================================================================

  /**
   * Export to SVG format (placeholder - requires SVG rendering)
   */
  toSVG(): string | null {
    // This would require re-rendering the chart to SVG
    // For now, return a basic SVG placeholder
    this.emitEvent({ type: 'svg', success: false, error: new Error('SVG export not fully implemented') });
    return null;
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  /**
   * Subscribe to export events
   */
  onExport(callback: ExportCallback): () => void {
    this.exportCallbacks.add(callback);
    return () => this.exportCallbacks.delete(callback);
  }

  private emitEvent(event: ExportEvent): void {
    for (const callback of this.exportCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[ExportManager] Callback error:', e);
      }
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  dispose(): void {
    this.exportCallbacks.clear();
    this.canvas = null;
    this.getTasks = null;
    this.getDependencies = null;
  }
}

export default ExportManager;
