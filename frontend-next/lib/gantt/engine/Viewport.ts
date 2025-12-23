/**
 * Viewport - Pan, Zoom, and Coordinate Transformation
 *
 * Handles all viewport-related calculations including:
 * - Pan (scroll) position
 * - Zoom level
 * - Date to X coordinate conversion
 * - X coordinate to Date conversion
 * - Row index to Y coordinate conversion
 */

import type { GanttConfig } from './GanttCanvas';

// ============================================================================
// Types
// ============================================================================

export interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  startDate: Date;
}

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  visibleStartDate: Date;
  visibleEndDate: Date;
  visibleStartRow: number;
  visibleEndRow: number;
}

// ============================================================================
// Viewport Class
// ============================================================================

export class Viewport {
  private config: GanttConfig;
  private state: ViewportState;
  private containerWidth: number = 0;
  private containerHeight: number = 0;
  private contentHeight: number = 0; // Total height of all tasks

  constructor(config: GanttConfig, initialState: ViewportState) {
    this.config = config;
    this.state = { ...initialState };
  }

  /**
   * Set the total content height (tasks.length * rowHeight)
   */
  setContentHeight(height: number): void {
    this.contentHeight = height;
  }

  /**
   * Get the maximum scroll Y value
   */
  private getMaxScrollY(): number {
    if (this.contentHeight <= 0 || this.containerHeight <= 0) return Infinity;
    const visibleHeight = this.containerHeight - this.config.headerHeight;
    if (visibleHeight <= 0) return Infinity;
    return Math.max(0, this.contentHeight - visibleHeight);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Update container dimensions
   */
  setContainerSize(width: number, height: number): void {
    this.containerWidth = width;
    this.containerHeight = height;
  }

  /**
   * Get current state
   */
  getState(): ViewportState {
    return { ...this.state };
  }

  /**
   * Set the start date for the viewport
   */
  setStartDate(date: Date): void {
    this.state.startDate = new Date(date);
  }

  /**
   * Get the effective day width (accounting for zoom)
   */
  getDayWidth(): number {
    return this.config.dayWidth * this.state.zoom;
  }

  /**
   * Convert a date to X coordinate
   */
  dateToX(date: Date): number {
    const daysDiff = this.daysBetween(this.state.startDate, date);
    return daysDiff * this.getDayWidth() - this.state.scrollX;
  }

  /**
   * Convert X coordinate to date
   */
  xToDate(x: number): Date {
    const adjustedX = x + this.state.scrollX;
    const days = adjustedX / this.getDayWidth();
    const result = new Date(this.state.startDate);
    result.setDate(result.getDate() + Math.floor(days));
    return result;
  }

  /**
   * Convert row index to Y coordinate
   */
  rowToY(rowIndex: number): number {
    return this.config.headerHeight + rowIndex * this.config.rowHeight - this.state.scrollY;
  }

  /**
   * Convert Y coordinate to row index
   */
  yToRow(y: number): number {
    const adjustedY = y - this.config.headerHeight + this.state.scrollY;
    return Math.floor(adjustedY / this.config.rowHeight);
  }

  /**
   * Pan the viewport
   */
  pan(deltaX: number, deltaY: number): void {
    this.state.scrollX = Math.max(0, this.state.scrollX - deltaX);
    const newScrollY = this.state.scrollY - deltaY;
    this.state.scrollY = Math.max(0, Math.min(newScrollY, this.getMaxScrollY()));
  }

  /**
   * Scroll to a specific position
   */
  scrollTo(x: number, y: number): void {
    this.state.scrollX = Math.max(0, x);
    this.state.scrollY = Math.max(0, Math.min(y, this.getMaxScrollY()));
  }

  /**
   * Zoom the viewport (centered on a point)
   */
  zoom(factor: number, centerX: number, centerY: number): void {
    const oldZoom = this.state.zoom;
    const newZoom = Math.max(0.1, Math.min(3, oldZoom * factor));

    // Adjust scroll to keep the center point fixed
    const zoomRatio = newZoom / oldZoom;
    const scrollXBeforeZoom = this.state.scrollX + centerX;
    const scrollXAfterZoom = scrollXBeforeZoom * zoomRatio;
    this.state.scrollX = Math.max(0, scrollXAfterZoom - centerX);

    this.state.zoom = newZoom;
  }

  /**
   * Set zoom level directly
   */
  setZoom(zoom: number): void {
    this.state.zoom = Math.max(0.1, Math.min(3, zoom));
  }

  /**
   * Get visible bounds
   */
  getVisibleBounds(totalRows: number): ViewportBounds {
    const dayWidth = this.getDayWidth();

    // Calculate visible date range
    const visibleDaysStart = Math.floor(this.state.scrollX / dayWidth);
    const visibleDaysEnd = Math.ceil((this.state.scrollX + this.containerWidth) / dayWidth);

    const visibleStartDate = new Date(this.state.startDate);
    visibleStartDate.setDate(visibleStartDate.getDate() + visibleDaysStart);

    const visibleEndDate = new Date(this.state.startDate);
    visibleEndDate.setDate(visibleEndDate.getDate() + visibleDaysEnd);

    // Calculate visible row range
    const visibleStartRow = Math.max(0, Math.floor(this.state.scrollY / this.config.rowHeight));
    const visibleEndRow = Math.min(
      totalRows,
      Math.ceil((this.state.scrollY + this.containerHeight - this.config.headerHeight) / this.config.rowHeight) + 1
    );

    return {
      minX: this.state.scrollX,
      maxX: this.state.scrollX + this.containerWidth,
      minY: this.state.scrollY,
      maxY: this.state.scrollY + this.containerHeight,
      visibleStartDate,
      visibleEndDate,
      visibleStartRow,
      visibleEndRow,
    };
  }

  /**
   * Check if a row is visible
   */
  isRowVisible(rowIndex: number, totalRows: number): boolean {
    const bounds = this.getVisibleBounds(totalRows);
    return rowIndex >= bounds.visibleStartRow && rowIndex < bounds.visibleEndRow;
  }

  /**
   * Check if a date is visible
   */
  isDateVisible(date: Date): boolean {
    const x = this.dateToX(date);
    return x >= 0 && x <= this.containerWidth;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate days between two dates
   */
  private daysBetween(date1: Date, date2: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    const diffTime = date2.getTime() - date1.getTime();
    return diffTime / oneDay;
  }
}

export default Viewport;
