/**
 * Renderer - Canvas Drawing Operations
 *
 * Handles all drawing operations for the Gantt chart:
 * - Background and grid
 * - Time scale headers
 * - Task bars
 * - Dependencies
 * - Today marker
 * - Overlays
 */

import type { GanttConfig, GanttTask, GanttDependency, GanttBaseline, ContextMenuItem } from './GanttCanvas';
import { Viewport } from './Viewport';
import type { WorkingDaysCalendar } from './WorkingDaysCalendar';

// ============================================================================
// Renderer Class
// ============================================================================

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private config: GanttConfig;
  private viewport: Viewport;

  constructor(ctx: CanvasRenderingContext2D, config: GanttConfig, viewport: Viewport) {
    this.ctx = ctx;
    this.config = config;
    this.viewport = viewport;
  }

  /**
   * Update config (e.g., when dark mode changes)
   */
  updateConfig(config: GanttConfig): void {
    this.config = config;
  }

  /**
   * Get the visible row range for virtual scrolling
   */
  getVisibleRowRange(totalRows: number, canvasHeight: number): { first: number; last: number } {
    const { rowHeight, headerHeight } = this.config;
    const state = this.viewport.getState();

    const visibleHeight = canvasHeight;
    const first = Math.max(0, Math.floor(state.scrollY / rowHeight) - 2); // Buffer of 2
    const last = Math.min(
      totalRows - 1,
      Math.ceil((state.scrollY + visibleHeight - headerHeight) / rowHeight) + 2
    );

    return { first, last };
  }

  // ============================================================================
  // Drawing Methods
  // ============================================================================

  /**
   * Draw background
   */
  drawBackground(width: number, height: number): void {
    this.ctx.fillStyle = this.config.colors.background;
    this.ctx.fillRect(0, 0, width, height);
  }

  /**
   * Draw grid lines, weekend shading, and holiday shading
   */
  drawGrid(width: number, height: number, totalRows: number, calendar?: WorkingDaysCalendar): void {
    const dayWidth = this.viewport.getDayWidth();
    const state = this.viewport.getState();

    // Calculate visible days
    const startDayOffset = Math.floor(state.scrollX / dayWidth);
    const endDayOffset = Math.ceil((state.scrollX + width) / dayWidth);

    // Draw vertical grid lines (days) and non-working day shading
    for (let i = startDayOffset; i <= endDayOffset; i++) {
      const x = i * dayWidth - state.scrollX;
      const currentDate = new Date(state.startDate);
      currentDate.setDate(currentDate.getDate() + i);

      // Use calendar if available, otherwise fall back to simple weekend check
      if (calendar) {
        if (calendar.isHoliday(currentDate)) {
          // Holiday shading (slightly different color from weekends)
          this.ctx.fillStyle = this.config.darkMode ? '#2d1f1f' : '#fef2f2'; // Reddish tint
          this.ctx.fillRect(x, this.config.headerHeight, dayWidth, height - this.config.headerHeight);
        } else if (calendar.isWeekend(currentDate)) {
          // Weekend shading
          this.ctx.fillStyle = this.config.colors.weekendBackground;
          this.ctx.fillRect(x, this.config.headerHeight, dayWidth, height - this.config.headerHeight);
        }
      } else {
        // Fallback: simple weekend check
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          this.ctx.fillStyle = this.config.colors.weekendBackground;
          this.ctx.fillRect(x, this.config.headerHeight, dayWidth, height - this.config.headerHeight);
        }
      }

      // Grid line
      this.ctx.strokeStyle = this.config.colors.gridLines;
      this.ctx.lineWidth = 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(x, this.config.headerHeight);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    // Draw horizontal grid lines (rows)
    for (let i = 0; i <= totalRows; i++) {
      const y = this.viewport.rowToY(i);
      if (y < this.config.headerHeight || y > height) continue;

      this.ctx.strokeStyle = this.config.colors.gridLines;
      this.ctx.lineWidth = 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }
  }

  /**
   * Draw time scale header
   */
  drawTimeScale(width: number): void {
    const dayWidth = this.viewport.getDayWidth();
    const state = this.viewport.getState();

    // Draw header background
    this.ctx.fillStyle = this.config.colors.headerBackground;
    this.ctx.fillRect(0, 0, width, this.config.headerHeight);

    // Draw header bottom border
    this.ctx.strokeStyle = this.config.colors.gridLines;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.config.headerHeight);
    this.ctx.lineTo(width, this.config.headerHeight);
    this.ctx.stroke();

    // Calculate visible days
    const startDayOffset = Math.floor(state.scrollX / dayWidth);
    const endDayOffset = Math.ceil((state.scrollX + width) / dayWidth);

    // Determine what level of detail to show based on zoom
    const showDays = dayWidth >= 20;
    const showMonthsOnly = dayWidth < 20;

    if (showMonthsOnly) {
      // Only show months
      this.drawMonthHeaders(width, startDayOffset, endDayOffset);
    } else {
      // Show both months and days
      this.drawMonthHeaders(width, startDayOffset, endDayOffset);
      this.drawDayHeaders(width, startDayOffset, endDayOffset);
    }
  }

  private drawMonthHeaders(width: number, startDayOffset: number, endDayOffset: number): void {
    const dayWidth = this.viewport.getDayWidth();
    const state = this.viewport.getState();

    let currentMonth = -1;
    let currentYear = -1;
    let monthStartX = 0;

    for (let i = startDayOffset; i <= endDayOffset + 1; i++) {
      const currentDate = new Date(state.startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();

      if (month !== currentMonth || year !== currentYear) {
        // Draw previous month label
        if (currentMonth !== -1) {
          const x = i * dayWidth - state.scrollX;
          const monthWidth = x - monthStartX;

          if (monthWidth > 50) {
            const monthDate = new Date(currentYear, currentMonth, 1);
            const monthLabel = monthDate.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });

            this.ctx.fillStyle = this.config.colors.headerText;
            this.ctx.font = 'bold 12px Inter, system-ui, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(monthLabel, monthStartX + monthWidth / 2, 15);
          }

          // Draw month separator
          this.ctx.strokeStyle = this.config.colors.gridLines;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(x, 0);
          this.ctx.lineTo(x, this.config.headerHeight / 2);
          this.ctx.stroke();
        }

        currentMonth = month;
        currentYear = year;
        monthStartX = i * dayWidth - state.scrollX;
      }
    }
  }

  private drawDayHeaders(width: number, startDayOffset: number, endDayOffset: number): void {
    const dayWidth = this.viewport.getDayWidth();
    const state = this.viewport.getState();

    for (let i = startDayOffset; i <= endDayOffset; i++) {
      const x = i * dayWidth - state.scrollX;
      const currentDate = new Date(state.startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dayOfWeek = currentDate.getDay();

      // Only show day numbers if there's enough room
      if (dayWidth >= 25) {
        const dayLabel = currentDate.getDate().toString();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        this.ctx.fillStyle = isWeekend ? '#9ca3af' : this.config.colors.headerText;
        this.ctx.font = '11px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(dayLabel, x + dayWidth / 2, this.config.headerHeight - 15);
      }
    }
  }

  /**
   * Draw today marker
   */
  drawTodayMarker(height: number): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const x = this.viewport.dateToX(today);

    if (x < 0 || x > 10000) return; // Off screen

    // Draw line
    this.ctx.strokeStyle = this.config.colors.todayMarker;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, this.config.headerHeight);
    this.ctx.lineTo(x, height);
    this.ctx.stroke();

    // Draw triangle marker at top
    this.ctx.fillStyle = this.config.colors.todayMarker;
    this.ctx.beginPath();
    this.ctx.moveTo(x, this.config.headerHeight);
    this.ctx.lineTo(x - 6, this.config.headerHeight - 10);
    this.ctx.lineTo(x + 6, this.config.headerHeight - 10);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw "Today" label
    this.ctx.fillStyle = this.config.colors.todayMarker;
    this.ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText('Today', x, this.config.headerHeight - 12);
  }

  /**
   * Draw task bars with virtual scrolling
   * Only renders tasks that are visible in the viewport
   */
  drawTaskBars(
    tasks: GanttTask[],
    selectedTaskIds: Set<string>,
    hoveredTaskId: string | null,
    hoveredEdge?: 'left' | 'right' | null,
    canvasHeight?: number,
    criticalTaskIds?: Set<string>
  ): void {
    const { taskBarHeight, taskBarPadding, rowHeight, headerHeight } = this.config;
    const state = this.viewport.getState();

    // Calculate visible row range for virtual scrolling
    const visibleHeight = canvasHeight ?? 800;
    const firstVisibleRow = Math.max(0, Math.floor(state.scrollY / rowHeight) - 1); // -1 for buffer
    const lastVisibleRow = Math.min(
      tasks.length - 1,
      Math.ceil((state.scrollY + visibleHeight - headerHeight) / rowHeight) + 1 // +1 for buffer
    );

    // Calculate visible X range for horizontal virtual scrolling
    const visibleStartX = state.scrollX - 100; // Buffer
    const visibleEndX = state.scrollX + (canvasHeight ? visibleHeight * 2 : 2000) + 100; // Use a reasonable width estimate

    // Only iterate through visible tasks
    for (let index = firstVisibleRow; index <= lastVisibleRow; index++) {
      const task = tasks[index];
      if (!task) continue;

      const y = this.viewport.rowToY(index);
      const startX = this.viewport.dateToX(task.startDate);
      const endX = this.viewport.dateToX(task.endDate);
      const taskWidth = Math.max(endX - startX, 20); // Minimum width

      // Horizontal virtual scrolling: skip if task is entirely outside visible X range
      if (endX < visibleStartX || startX > visibleEndX) {
        // Still draw row highlight for selected/hovered even if bar not visible
        const isSelected = selectedTaskIds.has(task.id);
        if (isSelected) {
          this.ctx.fillStyle = this.config.colors.selectedRow;
          this.ctx.fillRect(0, y, 10000, rowHeight);
        } else if (task.id === hoveredTaskId) {
          this.ctx.fillStyle = this.config.colors.hoverRow;
          this.ctx.fillRect(0, y, 10000, rowHeight);
        }
        continue;
      }

      const isSelected = selectedTaskIds.has(task.id);

      // Row background for selection/hover
      if (isSelected) {
        this.ctx.fillStyle = this.config.colors.selectedRow;
        this.ctx.fillRect(0, y, 10000, rowHeight);
      } else if (task.id === hoveredTaskId) {
        this.ctx.fillStyle = this.config.colors.hoverRow;
        this.ctx.fillRect(0, y, 10000, rowHeight);
      }

      // Calculate task bar position
      const barY = y + taskBarPadding;
      const barHeight = taskBarHeight;

      // Get task color based on status
      const taskColor = this.getTaskColor(task);

      // Draw task bar shadow
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      this.ctx.beginPath();
      this.ctx.roundRect(startX + 2, barY + 2, taskWidth, barHeight, 4);
      this.ctx.fill();

      // Draw task bar
      this.ctx.fillStyle = taskColor;
      this.ctx.beginPath();
      this.ctx.roundRect(startX, barY, taskWidth, barHeight, 4);
      this.ctx.fill();

      // Check if task is on critical path
      const isCritical = criticalTaskIds?.has(task.id);

      // Draw task bar border
      if (isCritical) {
        // Critical path: red glow effect
        this.ctx.shadowColor = '#ef4444';
        this.ctx.shadowBlur = 8;
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2;
      } else {
        this.ctx.strokeStyle = this.config.colors.taskBarBorder;
        this.ctx.lineWidth = 1;
      }
      this.ctx.beginPath();
      this.ctx.roundRect(startX, barY, taskWidth, barHeight, 4);
      this.ctx.stroke();

      // Reset shadow
      if (isCritical) {
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
      }

      // Draw progress bar if applicable
      const hasProgress = task.progress !== undefined && task.progress > 0;
      if (hasProgress) {
        const progressWidth = taskWidth * (task.progress! / 100);

        // Progress section - slightly darker/more saturated
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        this.ctx.beginPath();
        this.ctx.roundRect(startX, barY, progressWidth, barHeight, 4);
        this.ctx.fill();

        // Highlight strip at top of progress section
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        this.ctx.fillRect(startX + 2, barY + 2, Math.max(0, progressWidth - 4), 3);

        // Separator line at edge of progress
        if (task.progress! < 100 && progressWidth > 4) {
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(startX + progressWidth, barY + 2);
          this.ctx.lineTo(startX + progressWidth, barY + barHeight - 2);
          this.ctx.stroke();
        }
      }

      // Draw lock icon if locked
      if (task.locked) {
        this.drawLockIcon(startX + 4, barY + barHeight / 2);
      }

      // Calculate text positioning
      const hasProgressLabel = hasProgress && taskWidth > 80;
      const progressLabelWidth = hasProgressLabel ? 28 : 0; // Space for "100%"

      // Draw task name
      this.ctx.fillStyle = this.config.colors.taskBarText;
      this.ctx.font = '11px Inter, system-ui, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';

      // Truncate text if needed (leave room for progress label)
      const textX = startX + (task.locked ? 20 : 8);
      const maxTextWidth = taskWidth - (task.locked ? 28 : 16) - progressLabelWidth;

      if (maxTextWidth > 20) {
        const truncatedText = this.truncateText(task.name, maxTextWidth);
        this.ctx.fillText(truncatedText, textX, barY + barHeight / 2);
      }

      // Draw progress percentage label on the right side
      if (hasProgressLabel) {
        const progressText = `${Math.round(task.progress!)}%`;
        this.ctx.font = 'bold 10px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.fillText(progressText, startX + taskWidth - 6, barY + barHeight / 2);
      }

      // Draw resize handles on hover (only for unlocked tasks)
      if (task.id === hoveredTaskId && !task.locked) {
        this.drawResizeHandles(startX, barY, taskWidth, barHeight, hoveredEdge);
      }

      // Draw dependency connector dots on hover
      if (task.id === hoveredTaskId) {
        this.drawConnectorDots(startX, endX, barY, barHeight);
      }
    }
  }

  /**
   * Draw baseline bars below task bars for schedule comparison
   * Shows original planned dates vs current dates
   */
  drawBaselines(
    tasks: GanttTask[],
    baselines: Map<string, GanttBaseline>,
    canvasHeight?: number
  ): void {
    if (baselines.size === 0) return;

    const { rowHeight, headerHeight, taskBarHeight, taskBarPadding } = this.config;
    const state = this.viewport.getState();

    // Calculate visible row range for virtual scrolling
    const visibleHeight = canvasHeight ?? 800;
    const firstVisibleRow = Math.max(0, Math.floor(state.scrollY / rowHeight) - 1);
    const lastVisibleRow = Math.min(
      tasks.length - 1,
      Math.ceil((state.scrollY + visibleHeight - headerHeight) / rowHeight) + 1
    );

    // Baseline bar is thinner and positioned below the main bar
    const baselineHeight = 6;
    const baselineOffset = taskBarPadding + taskBarHeight + 2;

    for (let index = firstVisibleRow; index <= lastVisibleRow; index++) {
      const task = tasks[index];
      if (!task) continue;

      const baseline = baselines.get(task.id);
      if (!baseline) continue;

      const y = this.viewport.rowToY(index);
      const baselineStartX = this.viewport.dateToX(baseline.startDate);
      const baselineEndX = this.viewport.dateToX(baseline.endDate);
      const baselineWidth = Math.max(baselineEndX - baselineStartX, 10);

      const baselineY = y + baselineOffset;

      // Calculate variance for color coding
      const msPerDay = 24 * 60 * 60 * 1000;
      const startVariance = Math.round((task.startDate.getTime() - baseline.startDate.getTime()) / msPerDay);
      const endVariance = Math.round((task.endDate.getTime() - baseline.endDate.getTime()) / msPerDay);

      // Color based on variance:
      // Gray = on schedule (within 1 day)
      // Green = ahead of schedule
      // Red = behind schedule
      let baselineColor: string;
      if (Math.abs(startVariance) <= 1 && Math.abs(endVariance) <= 1) {
        baselineColor = this.config.darkMode ? '#4b5563' : '#9ca3af'; // Gray - on track
      } else if (endVariance < -1) {
        baselineColor = this.config.darkMode ? '#166534' : '#22c55e'; // Green - ahead
      } else if (endVariance > 1) {
        baselineColor = this.config.darkMode ? '#991b1b' : '#ef4444'; // Red - behind
      } else {
        baselineColor = this.config.darkMode ? '#4b5563' : '#9ca3af'; // Gray - mixed
      }

      // Draw baseline bar with pattern (diagonal stripes)
      this.ctx.fillStyle = baselineColor;
      this.ctx.globalAlpha = 0.6;
      this.ctx.beginPath();
      this.ctx.roundRect(baselineStartX, baselineY, baselineWidth, baselineHeight, 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;

      // Draw baseline border
      this.ctx.strokeStyle = baselineColor;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.roundRect(baselineStartX, baselineY, baselineWidth, baselineHeight, 2);
      this.ctx.stroke();

      // Draw variance indicator if significantly different
      if (Math.abs(endVariance) > 1) {
        const currentEndX = this.viewport.dateToX(task.endDate);
        const varianceText = endVariance > 0 ? `+${endVariance}d` : `${endVariance}d`;

        // Position text at the end of whichever bar is further right
        const textX = Math.max(currentEndX, baselineEndX) + 4;
        const textY = baselineY + baselineHeight / 2;

        this.ctx.font = '9px Inter, system-ui, sans-serif';
        this.ctx.fillStyle = endVariance > 0 ? '#ef4444' : '#22c55e';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(varianceText, textX, textY);
      }
    }
  }

  /**
   * Draw connector dots for dependency creation
   */
  private drawConnectorDots(startX: number, endX: number, barY: number, barHeight: number): void {
    const dotRadius = 5;
    const centerY = barY + barHeight / 2;

    // Start connector (left side)
    this.ctx.fillStyle = '#3b82f6';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(startX, centerY, dotRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // End connector (right side)
    this.ctx.beginPath();
    this.ctx.arc(endX, centerY, dotRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  /**
   * Draw resize handles on task bar edges
   */
  private drawResizeHandles(
    startX: number,
    barY: number,
    taskWidth: number,
    barHeight: number,
    hoveredEdge?: 'left' | 'right' | null
  ): void {
    const handleWidth = 4;
    const handleHeight = barHeight - 4;
    const handleY = barY + 2;

    // Left handle
    const leftActive = hoveredEdge === 'left';
    this.ctx.fillStyle = leftActive ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
    this.ctx.beginPath();
    this.ctx.roundRect(startX + 2, handleY, handleWidth, handleHeight, 2);
    this.ctx.fill();

    // Right handle
    const rightActive = hoveredEdge === 'right';
    this.ctx.fillStyle = rightActive ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
    this.ctx.beginPath();
    this.ctx.roundRect(startX + taskWidth - handleWidth - 2, handleY, handleWidth, handleHeight, 2);
    this.ctx.fill();
  }

  /**
   * Draw drag preview overlay
   */
  drawDragPreview(task: GanttTask, newDate: Date, rowIndex: number): void {
    const { taskBarHeight, taskBarPadding } = this.config;
    const originalStartX = this.viewport.dateToX(task.startDate);
    const originalEndX = this.viewport.dateToX(task.endDate);
    const taskDuration = task.endDate.getTime() - task.startDate.getTime();

    // Calculate new position
    const newStartX = this.viewport.dateToX(newDate);
    const newEndDate = new Date(newDate.getTime() + taskDuration);
    const newEndX = this.viewport.dateToX(newEndDate);
    const taskWidth = Math.max(newEndX - newStartX, 20);

    const y = this.viewport.rowToY(rowIndex);
    const barY = y + taskBarPadding;
    const barHeight = taskBarHeight;

    // Draw ghost of original position
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = '#9ca3af';
    this.ctx.beginPath();
    this.ctx.roundRect(originalStartX, barY, originalEndX - originalStartX, barHeight, 4);
    this.ctx.fill();
    this.ctx.globalAlpha = 1;

    // Draw new position with highlight
    this.ctx.fillStyle = '#3b82f6';
    this.ctx.beginPath();
    this.ctx.roundRect(newStartX, barY, taskWidth, barHeight, 4);
    this.ctx.fill();

    // Draw border
    this.ctx.strokeStyle = '#1d4ed8';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.roundRect(newStartX, barY, taskWidth, barHeight, 4);
    this.ctx.stroke();

    // Draw task name
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '11px Inter, system-ui, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    if (taskWidth > 30) {
      const truncatedText = this.truncateText(task.name, taskWidth - 16);
      this.ctx.fillText(truncatedText, newStartX + 8, barY + barHeight / 2);
    }

    // Draw enhanced drag tooltip
    const daysDiff = Math.round((newDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const newDateStr = newDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const originalDateStr = task.startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const durationDays = Math.round((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Build tooltip lines
    const lines: string[] = [];
    lines.push(`📅 ${newDateStr}${daysDiff !== 0 ? ` (${daysDiff > 0 ? '+' : ''}${daysDiff}d)` : ''}`);
    lines.push(`📆 Was: ${originalDateStr}`);
    lines.push(`⏱️ Duration: ${durationDays}d`);

    // Show predecessor warning if moving too early
    if (task.predecessorIds && task.predecessorIds.length > 0) {
      lines.push(`⬅️ Predecessors: ${task.predecessorIds.length}`);
    }

    const tooltipX = newStartX + taskWidth / 2;
    const tooltipY = barY - 12;
    const padding = 8;
    const lineHeight = 16;

    // Calculate max width
    this.ctx.font = '11px Inter, system-ui, sans-serif';
    let maxWidth = 0;
    lines.forEach(line => {
      const w = this.ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    });

    const tooltipWidth = maxWidth + padding * 2;
    const tooltipHeight = lines.length * lineHeight + padding * 2;

    // Tooltip background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    this.ctx.beginPath();
    this.ctx.roundRect(
      tooltipX - tooltipWidth / 2,
      tooltipY - tooltipHeight,
      tooltipWidth,
      tooltipHeight,
      6
    );
    this.ctx.fill();

    // Draw tooltip lines
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      // First line is bold
      if (i === 0) {
        this.ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      } else {
        this.ctx.font = '11px Inter, system-ui, sans-serif';
      }
      const lineY = tooltipY - tooltipHeight + padding + lineHeight / 2 + (i * lineHeight);
      this.ctx.fillText(line, tooltipX - tooltipWidth / 2 + padding, lineY);
    });
  }

  /**
   * Draw resize preview overlay
   */
  drawResizePreview(
    task: GanttTask,
    newStartDate: Date,
    newEndDate: Date,
    rowIndex: number,
    edge: 'left' | 'right'
  ): void {
    const { taskBarHeight, taskBarPadding } = this.config;
    const originalStartX = this.viewport.dateToX(task.startDate);
    const originalEndX = this.viewport.dateToX(task.endDate);

    // Calculate new position
    const newStartX = this.viewport.dateToX(newStartDate);
    const newEndX = this.viewport.dateToX(newEndDate);
    const taskWidth = Math.max(newEndX - newStartX, 20);

    const y = this.viewport.rowToY(rowIndex);
    const barY = y + taskBarPadding;
    const barHeight = taskBarHeight;

    // Draw ghost of original position
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = '#9ca3af';
    this.ctx.beginPath();
    this.ctx.roundRect(originalStartX, barY, originalEndX - originalStartX, barHeight, 4);
    this.ctx.fill();
    this.ctx.globalAlpha = 1;

    // Draw new position with highlight (green for expand, orange for shrink)
    const isExpanding = (newEndX - newStartX) > (originalEndX - originalStartX);
    this.ctx.fillStyle = isExpanding ? '#22c55e' : '#f59e0b';
    this.ctx.beginPath();
    this.ctx.roundRect(newStartX, barY, taskWidth, barHeight, 4);
    this.ctx.fill();

    // Draw border
    this.ctx.strokeStyle = isExpanding ? '#16a34a' : '#d97706';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.roundRect(newStartX, barY, taskWidth, barHeight, 4);
    this.ctx.stroke();

    // Draw task name
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '11px Inter, system-ui, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    if (taskWidth > 30) {
      const truncatedText = this.truncateText(task.name, taskWidth - 16);
      this.ctx.fillText(truncatedText, newStartX + 8, barY + barHeight / 2);
    }

    // Draw tooltip showing duration change
    const originalDuration = Math.round(
      (task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const newDuration = Math.round(
      (newEndDate.getTime() - newStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const durationDiff = newDuration - originalDuration;

    if (durationDiff !== 0) {
      const tooltipText = durationDiff > 0 ? `+${durationDiff}d` : `${durationDiff}d`;
      const fullText = `${newDuration} days (${tooltipText})`;

      const tooltipX = edge === 'left' ? newStartX : newEndX;
      const tooltipY = barY - 8;
      const padding = 6;
      const textWidth = this.ctx.measureText(fullText).width;

      // Tooltip background
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      this.ctx.beginPath();
      this.ctx.roundRect(
        tooltipX - textWidth / 2 - padding,
        tooltipY - 10 - padding,
        textWidth + padding * 2,
        16 + padding,
        4
      );
      this.ctx.fill();

      // Tooltip text
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(fullText, tooltipX, tooltipY - 2);
    }
  }

  /**
   * Draw dependency creation line while dragging from connector
   */
  drawDependencyCreationLine(
    fromTask: GanttTask,
    fromEdge: 'start' | 'end',
    toX: number,
    toY: number,
    rowIndex: number,
    targetTask?: GanttTask | null
  ): void {
    const { taskBarHeight, taskBarPadding } = this.config;
    const y = this.viewport.rowToY(rowIndex);
    const barY = y + taskBarPadding;
    const centerY = barY + taskBarHeight / 2;

    // Calculate from point
    const fromX = fromEdge === 'start'
      ? this.viewport.dateToX(fromTask.startDate)
      : this.viewport.dateToX(fromTask.endDate);

    // Draw line with animated dashes
    this.ctx.setLineDash([5, 3]);
    this.ctx.strokeStyle = '#3b82f6';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(fromX, centerY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw source connector (pulsing)
    this.ctx.fillStyle = '#3b82f6';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(fromX, centerY, 7, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Draw target indicator if hovering over a task
    if (targetTask) {
      const targetStartX = this.viewport.dateToX(targetTask.startDate);
      const targetEndX = this.viewport.dateToX(targetTask.endDate);
      const targetY = this.viewport.rowToY(this.getTaskIndex(targetTask));
      const targetBarY = targetY + taskBarPadding;
      const targetCenterY = targetBarY + taskBarHeight / 2;

      // Determine which end we're closer to
      const distToStart = Math.abs(toX - targetStartX);
      const distToEnd = Math.abs(toX - targetEndX);
      const snapX = distToStart < distToEnd ? targetStartX : targetEndX;

      // Draw snap indicator
      this.ctx.fillStyle = '#22c55e';
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(snapX, targetCenterY, 7, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }
  }

  // Helper to get task index (needed for dependency creation line)
  private taskIndexCache: Map<string, number> = new Map();

  setTaskIndices(tasks: GanttTask[]): void {
    this.taskIndexCache.clear();
    tasks.forEach((task, index) => this.taskIndexCache.set(task.id, index));
  }

  private getTaskIndex(task: GanttTask): number {
    return this.taskIndexCache.get(task.id) ?? 0;
  }

  /**
   * Draw dependencies between tasks
   */
  // Dependency highlight colors (6-color palette as per spec)
  private static readonly DEPENDENCY_COLORS = [
    '#f59e0b', // amber
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#22c55e', // green
    '#ec4899', // pink
    '#06b6d4', // cyan
  ];

  drawDependencies(
    tasks: GanttTask[],
    dependencies: GanttDependency[],
    highlightedTaskId: string | null = null,
    canvasHeight?: number,
    criticalDependencyIds?: Set<string>,
    flashingDepIds?: Set<string>,
    flashPhase?: number,
    brokenDepIds?: Set<string>
  ): void {
    const taskMap = new Map(tasks.map((t, i) => [t.id, { task: t, index: i }]));

    // Get visible range for filtering (if canvas height provided)
    const visibleRange = canvasHeight
      ? this.getVisibleRowRange(tasks.length, canvasHeight)
      : null;

    // Find dependencies connected to highlighted task
    const highlightedPredecessors = new Set<string>();
    const highlightedSuccessors = new Set<string>();

    if (highlightedTaskId) {
      dependencies.forEach((dep) => {
        if (dep.toId === highlightedTaskId) {
          highlightedPredecessors.add(dep.id);
        }
        if (dep.fromId === highlightedTaskId) {
          highlightedSuccessors.add(dep.id);
        }
      });
    }

    // Helper to check if a dependency should be rendered
    const shouldRenderDep = (fromIndex: number, toIndex: number): boolean => {
      if (!visibleRange) return true;
      // Render if either task is visible (or close to visible due to line routing)
      const buffer = 5; // Extra buffer for lines that might curve into view
      const fromVisible = fromIndex >= visibleRange.first - buffer && fromIndex <= visibleRange.last + buffer;
      const toVisible = toIndex >= visibleRange.first - buffer && toIndex <= visibleRange.last + buffer;
      return fromVisible || toVisible;
    };

    // Draw non-highlighted dependencies first (so highlighted ones are on top)
    dependencies.forEach((dep) => {
      const isHighlighted = highlightedPredecessors.has(dep.id) || highlightedSuccessors.has(dep.id);
      if (isHighlighted) return; // Skip, will draw later

      const from = taskMap.get(dep.fromId);
      const to = taskMap.get(dep.toId);
      if (!from || !to) return;

      // Virtual scrolling: skip if both tasks are outside visible range
      if (!shouldRenderDep(from.index, to.index)) return;

      const { fromX, toX } = this.getDependencyEndpoints(dep, from.task, to.task);
      const fromY = this.viewport.rowToY(from.index) + this.config.rowHeight / 2;
      const toY = this.viewport.rowToY(to.index) + this.config.rowHeight / 2;

      // Check if this is a broken dependency
      const isBroken = brokenDepIds?.has(dep.id);
      if (isBroken) {
        this.drawBrokenDependencyLine(fromX, fromY, toX, toY, dep.type);
      } else {
        // Check if this dependency is on the critical path
        const isCritical = criticalDependencyIds?.has(dep.id);
        if (isCritical) {
          this.drawDependencyLine(fromX, fromY, toX, toY, dep.type, true, '#ef4444');
        } else {
          this.drawDependencyLine(fromX, fromY, toX, toY, dep.type, false);
        }
      }
    });

    // Draw highlighted dependencies on top with colors
    let colorIndex = 0;
    dependencies.forEach((dep) => {
      const isPredecessor = highlightedPredecessors.has(dep.id);
      const isSuccessor = highlightedSuccessors.has(dep.id);
      if (!isPredecessor && !isSuccessor) return;

      const from = taskMap.get(dep.fromId);
      const to = taskMap.get(dep.toId);
      if (!from || !to) return;

      // Virtual scrolling: skip if both tasks are outside visible range
      // (but we still render highlighted ones for UX - user clicked on a task)
      if (!shouldRenderDep(from.index, to.index)) return;

      const { fromX, toX } = this.getDependencyEndpoints(dep, from.task, to.task);
      const fromY = this.viewport.rowToY(from.index) + this.config.rowHeight / 2;
      const toY = this.viewport.rowToY(to.index) + this.config.rowHeight / 2;

      const color = Renderer.DEPENDENCY_COLORS[colorIndex % Renderer.DEPENDENCY_COLORS.length];
      this.drawDependencyLine(fromX, fromY, toX, toY, dep.type, true, color);
      colorIndex++;
    });

    // Draw flashing dependencies with animation effect
    if (flashingDepIds && flashingDepIds.size > 0 && flashPhase !== undefined) {
      dependencies.forEach((dep) => {
        if (!flashingDepIds.has(dep.id)) return;

        const from = taskMap.get(dep.fromId);
        const to = taskMap.get(dep.toId);
        if (!from || !to) return;

        const { fromX, toX } = this.getDependencyEndpoints(dep, from.task, to.task);
        const fromY = this.viewport.rowToY(from.index) + this.config.rowHeight / 2;
        const toY = this.viewport.rowToY(to.index) + this.config.rowHeight / 2;

        // Animated glow effect using flashPhase (0-1)
        this.ctx.save();

        // Outer glow - pulses with flashPhase
        const glowOpacity = 0.3 + flashPhase * 0.5;
        const glowWidth = 6 + flashPhase * 4;
        this.ctx.strokeStyle = `rgba(251, 191, 36, ${glowOpacity})`; // amber glow
        this.ctx.lineWidth = glowWidth;
        this.ctx.lineCap = 'round';
        this.ctx.shadowColor = '#fbbf24';
        this.ctx.shadowBlur = 10 + flashPhase * 10;

        // Draw glow path
        this.drawDependencyPath(fromX, fromY, toX, toY, dep.type);
        this.ctx.stroke();

        // Inner line - bright amber
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.lineWidth = 2 + flashPhase;
        this.drawDependencyPath(fromX, fromY, toX, toY, dep.type);
        this.ctx.stroke();

        // Draw arrowhead
        this.ctx.fillStyle = '#f59e0b';
        this.drawDependencyArrowhead(toX, toY, dep.type, from.index < to.index);

        this.ctx.restore();
      });
    }
  }

  private getDependencyEndpoints(
    dep: GanttDependency,
    fromTask: GanttTask,
    toTask: GanttTask
  ): { fromX: number; toX: number } {
    let fromX: number;
    let toX: number;

    switch (dep.type) {
      case 'SS':
        fromX = this.viewport.dateToX(fromTask.startDate);
        toX = this.viewport.dateToX(toTask.startDate);
        break;
      case 'FF':
        fromX = this.viewport.dateToX(fromTask.endDate);
        toX = this.viewport.dateToX(toTask.endDate);
        break;
      case 'SF':
        fromX = this.viewport.dateToX(fromTask.startDate);
        toX = this.viewport.dateToX(toTask.endDate);
        break;
      case 'FS':
      default:
        fromX = this.viewport.dateToX(fromTask.endDate);
        toX = this.viewport.dateToX(toTask.startDate);
        break;
    }

    return { fromX, toX };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private getTaskColor(task: GanttTask): string {
    const { taskBar } = this.config.colors;

    switch (task.status) {
      case 'completed':
        return taskBar.completed;
      case 'in-progress':
        return taskBar.inProgress;
      case 'on-hold':
        return taskBar.onHold;
      case 'at-risk':
        return taskBar.atRisk;
      default:
        return taskBar.notStarted;
    }
  }

  private drawLockIcon(x: number, y: number): void {
    const size = 10;

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.lineWidth = 1.5;

    // Lock body
    this.ctx.beginPath();
    this.ctx.rect(x, y - size / 4, size, size * 0.6);
    this.ctx.fill();

    // Lock shackle
    this.ctx.beginPath();
    this.ctx.arc(x + size / 2, y - size / 4, size / 3, Math.PI, 0);
    this.ctx.stroke();
  }

  private drawDependencyLine(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    type: string,
    highlighted: boolean = false,
    highlightColor?: string
  ): void {
    const controlOffset = 20;
    const color = highlighted && highlightColor ? highlightColor : '#6b7280';
    const lineWidth = highlighted ? 3 : 1.5;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;

    // Add glow effect for highlighted lines
    if (highlighted) {
      this.ctx.shadowColor = highlightColor || color;
      this.ctx.shadowBlur = 6;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);

    if (Math.abs(toY - fromY) < 5) {
      // Same row - draw straight line
      this.ctx.lineTo(toX, toY);
    } else {
      // Different rows - draw bezier curve
      this.ctx.bezierCurveTo(
        fromX + controlOffset,
        fromY,
        toX - controlOffset,
        toY,
        toX,
        toY
      );
    }

    this.ctx.stroke();

    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;

    // Draw arrow head
    this.drawArrowHead(toX, toY, toX > fromX ? 0 : Math.PI, color);
  }

  private drawArrowHead(x: number, y: number, angle: number, color: string = '#6b7280'): void {
    const size = 6;

    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(
      x - size * Math.cos(angle - Math.PI / 6),
      y - size * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      x - size * Math.cos(angle + Math.PI / 6),
      y - size * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * Draw a broken dependency line with dashed red styling
   */
  private drawBrokenDependencyLine(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    type: string
  ): void {
    const controlOffset = 20;
    const color = '#ef4444'; // Red for broken
    const lineWidth = 2;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.setLineDash([6, 4]); // Dashed line pattern

    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);

    if (Math.abs(toY - fromY) < 5) {
      this.ctx.lineTo(toX, toY);
    } else {
      this.ctx.bezierCurveTo(
        fromX + controlOffset,
        fromY,
        toX - controlOffset,
        toY,
        toX,
        toY
      );
    }

    this.ctx.stroke();
    this.ctx.setLineDash([]); // Reset line dash

    // Draw X mark instead of arrow to indicate broken
    const xSize = 5;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(toX - xSize, toY - xSize);
    this.ctx.lineTo(toX + xSize, toY + xSize);
    this.ctx.moveTo(toX + xSize, toY - xSize);
    this.ctx.lineTo(toX - xSize, toY + xSize);
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Draw dependency path without styling (for use with custom stroke/fill)
   */
  private drawDependencyPath(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    type: string
  ): void {
    const controlOffset = 20;

    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);

    if (Math.abs(toY - fromY) < 5) {
      // Same row - draw straight line
      this.ctx.lineTo(toX, toY);
    } else {
      // Different rows - draw bezier curve
      this.ctx.bezierCurveTo(
        fromX + controlOffset,
        fromY,
        toX - controlOffset,
        toY,
        toX,
        toY
      );
    }
  }

  /**
   * Draw arrowhead for dependency with custom fill (already applied)
   */
  private drawDependencyArrowhead(
    x: number,
    y: number,
    type: string,
    goingDown: boolean
  ): void {
    const size = 8; // Slightly larger for flashing
    // Arrow points right for FS/SS, left for FF/SF
    const angle = (type === 'FS' || type === 'SS') ? 0 : Math.PI;

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(
      x - size * Math.cos(angle - Math.PI / 6),
      y - size * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      x - size * Math.cos(angle + Math.PI / 6),
      y - size * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  private truncateText(text: string, maxWidth: number): string {
    const ellipsis = '...';
    let width = this.ctx.measureText(text).width;

    if (width <= maxWidth) return text;

    while (width > maxWidth && text.length > 0) {
      text = text.slice(0, -1);
      width = this.ctx.measureText(text + ellipsis).width;
    }

    return text + ellipsis;
  }

  /**
   * Draw tooltip for hovered task
   */
  drawTooltip(task: GanttTask, mouseX: number, mouseY: number, canvasWidth: number): void {
    const padding = 8;
    const lineHeight = 18;
    const lines: string[] = [];

    // Build tooltip content
    lines.push(task.name);

    // Format dates
    const startStr = task.startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    const endStr = task.endDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    lines.push(`${startStr} → ${endStr}`);

    // Calculate duration in working days
    const durationMs = task.endDate.getTime() - task.startDate.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    lines.push(`Duration: ${durationDays} day${durationDays !== 1 ? 's' : ''}`);

    // Add supplier if present
    if (task.supplierName) {
      lines.push(`Supplier: ${task.supplierName}`);
    }

    // Add status
    if (task.status) {
      const statusText = task.status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
      lines.push(`Status: ${statusText}`);
    }

    // Add lock status
    if (task.locked) {
      const lockText = task.locked.replace(/([A-Z])/g, ' $1').trim();
      lines.push(`🔒 ${lockText}`);
    }

    // Calculate tooltip dimensions
    this.ctx.font = '12px Inter, system-ui, sans-serif';
    const maxLineWidth = Math.max(...lines.map(line => this.ctx.measureText(line).width));
    const tooltipWidth = maxLineWidth + padding * 2;
    const tooltipHeight = lines.length * lineHeight + padding * 2;

    // Position tooltip (avoid going off screen)
    let tooltipX = mouseX + 15;
    let tooltipY = mouseY + 15;

    if (tooltipX + tooltipWidth > canvasWidth - 10) {
      tooltipX = mouseX - tooltipWidth - 15;
    }
    if (tooltipY + tooltipHeight > this.ctx.canvas.height / window.devicePixelRatio - 10) {
      tooltipY = mouseY - tooltipHeight - 15;
    }

    // Draw tooltip background with shadow
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;

    this.ctx.fillStyle = this.config.darkMode ? '#1f2937' : '#ffffff';
    this.ctx.beginPath();
    this.ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 6);
    this.ctx.fill();

    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    // Draw border
    this.ctx.strokeStyle = this.config.darkMode ? '#374151' : '#e5e7eb';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Draw text
    this.ctx.fillStyle = this.config.darkMode ? '#e5e7eb' : '#374151';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    lines.forEach((line, i) => {
      // First line (task name) is bold
      if (i === 0) {
        this.ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      } else {
        this.ctx.font = '12px Inter, system-ui, sans-serif';
      }
      this.ctx.fillText(line, tooltipX + padding, tooltipY + padding + i * lineHeight);
    });
  }

  /**
   * Draw selection count badge
   */
  drawSelectionBadge(count: number, canvasWidth: number): void {
    if (count <= 1) return;

    const text = `${count} tasks selected`;
    this.ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    const textWidth = this.ctx.measureText(text).width;
    const padding = 8;
    const badgeWidth = textWidth + padding * 2;
    const badgeHeight = 24;
    const badgeX = canvasWidth - badgeWidth - 16;
    const badgeY = this.config.headerHeight + 16;

    // Draw badge background
    this.ctx.fillStyle = this.config.darkMode ? '#3b82f6' : '#2563eb';
    this.ctx.beginPath();
    this.ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 12);
    this.ctx.fill();

    // Draw text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
  }

  /**
   * Draw context menu
   */
  drawContextMenu(
    x: number,
    y: number,
    items: ContextMenuItem[],
    canvasWidth: number,
    canvasHeight: number,
    hoveredItemId?: string | null
  ): void {
    const padding = 8;
    const itemHeight = 32;
    const separatorHeight = 9;
    const minWidth = 160;

    // Calculate menu dimensions
    this.ctx.font = '13px Inter, system-ui, sans-serif';
    let maxLabelWidth = 0;
    items.forEach(item => {
      if (!item.separator) {
        const width = this.ctx.measureText(item.label).width;
        if (width > maxLabelWidth) maxLabelWidth = width;
      }
    });

    const menuWidth = Math.max(minWidth, maxLabelWidth + padding * 4 + 24); // 24 for icon space
    let menuHeight = padding * 2;
    items.forEach(item => {
      menuHeight += item.separator ? separatorHeight : itemHeight;
    });

    // Adjust position to stay on screen
    let menuX = x;
    let menuY = y;
    if (menuX + menuWidth > canvasWidth - 10) {
      menuX = canvasWidth - menuWidth - 10;
    }
    if (menuY + menuHeight > canvasHeight - 10) {
      menuY = canvasHeight - menuHeight - 10;
    }

    // Draw shadow
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    this.ctx.shadowBlur = 12;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 4;

    // Draw menu background
    this.ctx.fillStyle = this.config.darkMode ? '#1f2937' : '#ffffff';
    this.ctx.beginPath();
    this.ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 8);
    this.ctx.fill();

    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    // Draw border
    this.ctx.strokeStyle = this.config.darkMode ? '#374151' : '#e5e7eb';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Draw items
    let itemY = menuY + padding;
    items.forEach(item => {
      if (item.separator) {
        // Draw separator line
        this.ctx.strokeStyle = this.config.darkMode ? '#374151' : '#e5e7eb';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(menuX + padding, itemY + separatorHeight / 2);
        this.ctx.lineTo(menuX + menuWidth - padding, itemY + separatorHeight / 2);
        this.ctx.stroke();
        itemY += separatorHeight;
      } else {
        // Draw hover background
        if (item.id === hoveredItemId && !item.disabled) {
          this.ctx.fillStyle = this.config.darkMode ? '#374151' : '#f3f4f6';
          this.ctx.beginPath();
          this.ctx.roundRect(menuX + 4, itemY, menuWidth - 8, itemHeight, 4);
          this.ctx.fill();
        }

        // Draw icon placeholder (could be replaced with actual icons)
        const iconX = menuX + padding + 8;
        const textX = menuX + padding + 28;

        // Draw icon (simple emoji icons for now)
        this.ctx.font = '14px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        if (item.icon) {
          this.ctx.fillStyle = item.disabled
            ? (this.config.darkMode ? '#6b7280' : '#9ca3af')
            : (this.config.darkMode ? '#e5e7eb' : '#374151');
          this.ctx.fillText(item.icon, iconX, itemY + itemHeight / 2);
        }

        // Draw label
        this.ctx.font = '13px Inter, system-ui, sans-serif';
        this.ctx.fillStyle = item.disabled
          ? (this.config.darkMode ? '#6b7280' : '#9ca3af')
          : (this.config.darkMode ? '#e5e7eb' : '#374151');
        this.ctx.fillText(item.label, textX, itemY + itemHeight / 2);

        itemY += itemHeight;
      }
    });
  }

  /**
   * Draw minimap overview in corner
   */
  drawMinimap(
    tasks: GanttTask[],
    canvasWidth: number,
    canvasHeight: number,
    minimapWidth: number = 200,
    minimapHeight: number = 120
  ): { x: number; y: number; width: number; height: number; viewportRect: { x: number; y: number; width: number; height: number } } {
    if (tasks.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0, viewportRect: { x: 0, y: 0, width: 0, height: 0 } };
    }

    const state = this.viewport.getState();
    const padding = 16;
    const minimapX = canvasWidth - minimapWidth - padding;
    const minimapY = canvasHeight - minimapHeight - padding;

    // Calculate data bounds
    const minDate = new Date(Math.min(...tasks.map(t => t.startDate.getTime())));
    const maxDate = new Date(Math.max(...tasks.map(t => t.endDate.getTime())));
    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 14; // Add padding
    const totalRows = tasks.length;

    // Scale factors
    const scaleX = (minimapWidth - 8) / totalDays;
    const scaleY = (minimapHeight - 8) / Math.max(totalRows, 1);

    // Draw minimap background with shadow
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 2;

    this.ctx.fillStyle = this.config.darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    this.ctx.beginPath();
    this.ctx.roundRect(minimapX, minimapY, minimapWidth, minimapHeight, 8);
    this.ctx.fill();

    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;

    // Draw border
    this.ctx.strokeStyle = this.config.darkMode ? '#4b5563' : '#d1d5db';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Draw "Minimap" label
    this.ctx.fillStyle = this.config.darkMode ? '#9ca3af' : '#6b7280';
    this.ctx.font = '10px Inter, system-ui, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Overview', minimapX + 6, minimapY + 4);

    // Content area (inside minimap)
    const contentX = minimapX + 4;
    const contentY = minimapY + 18;
    const contentWidth = minimapWidth - 8;
    const contentHeight = minimapHeight - 22;

    // Draw tasks as thin bars
    tasks.forEach((task, index) => {
      const taskStartDays = (task.startDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      const taskEndDays = (task.endDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);

      const barX = contentX + taskStartDays * scaleX;
      const barWidth = Math.max((taskEndDays - taskStartDays) * scaleX, 2);
      const barY = contentY + index * scaleY;
      const barHeight = Math.max(scaleY - 1, 1);

      // Color based on status
      const color = this.getTaskColor(task);
      this.ctx.fillStyle = color;
      this.ctx.fillRect(barX, barY, barWidth, barHeight);
    });

    // Calculate viewport rectangle
    const dayWidth = this.viewport.getDayWidth();
    const viewportStartDays = state.scrollX / dayWidth;
    const viewportEndDays = (state.scrollX + canvasWidth) / dayWidth;
    const viewportStartRow = state.scrollY / this.config.rowHeight;
    const viewportEndRow = (state.scrollY + canvasHeight - this.config.headerHeight) / this.config.rowHeight;

    // Offset from minDate
    const startDateOffset = (state.startDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);

    const vpX = contentX + (startDateOffset + viewportStartDays) * scaleX;
    const vpY = contentY + viewportStartRow * scaleY;
    const vpWidth = (viewportEndDays - viewportStartDays) * scaleX;
    const vpHeight = (viewportEndRow - viewportStartRow) * scaleY;

    // Clamp viewport rectangle to content bounds
    const clampedVpX = Math.max(contentX, Math.min(vpX, contentX + contentWidth - 10));
    const clampedVpY = Math.max(contentY, Math.min(vpY, contentY + contentHeight - 10));
    const clampedVpWidth = Math.min(vpWidth, contentWidth);
    const clampedVpHeight = Math.min(vpHeight, contentHeight);

    // Draw viewport rectangle
    this.ctx.strokeStyle = this.config.darkMode ? '#60a5fa' : '#3b82f6';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(clampedVpX, clampedVpY, clampedVpWidth, clampedVpHeight);

    // Fill with semi-transparent blue
    this.ctx.fillStyle = this.config.darkMode ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.15)';
    this.ctx.fillRect(clampedVpX, clampedVpY, clampedVpWidth, clampedVpHeight);

    // Return bounds for hit testing
    return {
      x: minimapX,
      y: minimapY,
      width: minimapWidth,
      height: minimapHeight,
      viewportRect: { x: clampedVpX, y: clampedVpY, width: clampedVpWidth, height: clampedVpHeight },
    };
  }

  /**
   * Convert minimap click to scroll position
   */
  minimapClickToScroll(
    clickX: number,
    clickY: number,
    minimapBounds: { x: number; y: number; width: number; height: number },
    tasks: GanttTask[],
    canvasWidth: number,
    canvasHeight: number
  ): { scrollX: number; scrollY: number } | null {
    if (tasks.length === 0) return null;

    // Check if click is within minimap
    if (
      clickX < minimapBounds.x ||
      clickX > minimapBounds.x + minimapBounds.width ||
      clickY < minimapBounds.y ||
      clickY > minimapBounds.y + minimapBounds.height
    ) {
      return null;
    }

    // Content area
    const contentX = minimapBounds.x + 4;
    const contentY = minimapBounds.y + 18;
    const contentWidth = minimapBounds.width - 8;
    const contentHeight = minimapBounds.height - 22;

    // Calculate data bounds
    const minDate = new Date(Math.min(...tasks.map(t => t.startDate.getTime())));
    const maxDate = new Date(Math.max(...tasks.map(t => t.endDate.getTime())));
    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 14;
    const totalRows = tasks.length;

    // Scale factors
    const scaleX = contentWidth / totalDays;
    const scaleY = contentHeight / Math.max(totalRows, 1);

    // Convert click position to relative position in content area
    const relX = (clickX - contentX) / scaleX;
    const relY = (clickY - contentY) / scaleY;

    // Convert to scroll position
    const state = this.viewport.getState();
    const dayWidth = this.viewport.getDayWidth();

    // Calculate new scroll position (centering the viewport on clicked point)
    const startDateOffset = (state.startDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    const newScrollX = Math.max(0, (relX - startDateOffset - (canvasWidth / dayWidth / 2)) * dayWidth);
    const newScrollY = Math.max(0, (relY - (canvasHeight - this.config.headerHeight) / this.config.rowHeight / 2) * this.config.rowHeight);

    return { scrollX: newScrollX, scrollY: newScrollY };
  }

  /**
   * Hit test for context menu items
   * Returns the item ID if a non-separator, non-disabled item was clicked
   */
  hitTestContextMenu(
    mouseX: number,
    mouseY: number,
    menuX: number,
    menuY: number,
    items: ContextMenuItem[],
    canvasWidth: number
  ): string | null {
    const padding = 8;
    const itemHeight = 32;
    const separatorHeight = 9;
    const minWidth = 160;

    // Calculate menu width
    this.ctx.font = '13px Inter, system-ui, sans-serif';
    let maxLabelWidth = 0;
    items.forEach(item => {
      if (!item.separator) {
        const width = this.ctx.measureText(item.label).width;
        if (width > maxLabelWidth) maxLabelWidth = width;
      }
    });
    const menuWidth = Math.max(minWidth, maxLabelWidth + padding * 4 + 24);

    // Adjust menu position (same as drawing)
    let adjustedX = menuX;
    if (adjustedX + menuWidth > canvasWidth - 10) {
      adjustedX = canvasWidth - menuWidth - 10;
    }

    // Check if mouse is within menu bounds
    if (mouseX < adjustedX || mouseX > adjustedX + menuWidth) return null;

    // Find which item
    let itemY = menuY + padding;
    for (const item of items) {
      if (item.separator) {
        itemY += separatorHeight;
        continue;
      }

      if (mouseY >= itemY && mouseY < itemY + itemHeight) {
        if (item.disabled) return null;
        return item.id;
      }

      itemY += itemHeight;
    }

    return null;
  }

  // ============================================================================
  // Marquee Selection
  // ============================================================================

  /**
   * Draw marquee selection rectangle
   */
  drawMarqueeSelection(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    selectedCount: number
  ): void {
    // Normalize rectangle
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    // Draw semi-transparent fill
    this.ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'; // Blue with low opacity
    this.ctx.fillRect(left, top, width, height);

    // Draw border
    this.ctx.strokeStyle = '#3b82f6'; // Blue border
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 2]); // Dashed line
    this.ctx.strokeRect(left, top, width, height);
    this.ctx.setLineDash([]); // Reset dash

    // Draw selection count badge
    if (selectedCount > 0) {
      const badgeText = `${selectedCount} task${selectedCount !== 1 ? 's' : ''}`;
      this.ctx.font = '12px system-ui, sans-serif';
      const metrics = this.ctx.measureText(badgeText);
      const badgeWidth = metrics.width + 12;
      const badgeHeight = 20;
      const badgeX = left + width / 2 - badgeWidth / 2;
      const badgeY = top - badgeHeight - 4;

      // Draw badge background
      this.ctx.fillStyle = '#3b82f6';
      this.ctx.beginPath();
      this.ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4);
      this.ctx.fill();

      // Draw badge text
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
    }
  }

  // ============================================================================
  // Progress Drag Preview
  // ============================================================================

  /**
   * Draw progress drag preview on a task bar
   */
  drawProgressDragPreview(
    task: GanttTask,
    currentProgress: number,
    taskIndex: number
  ): void {
    const state = this.viewport.getState();

    // Calculate positions
    const taskStartX = this.viewport.dateToX(task.startDate);
    const taskEndX = this.viewport.dateToX(task.endDate);
    const taskWidth = taskEndX - taskStartX;
    const rowY = this.viewport.rowToY(taskIndex);
    const barTop = rowY + (this.config.rowHeight - this.config.taskBarHeight) / 2;

    // Draw the updated progress bar
    const progressWidth = (taskWidth * currentProgress) / 100;

    // Draw progress fill with highlight
    this.ctx.fillStyle = 'rgba(34, 197, 94, 0.8)'; // Green with opacity
    this.ctx.fillRect(taskStartX, barTop, progressWidth, this.config.taskBarHeight);

    // Draw progress handle line
    const handleX = taskStartX + progressWidth;
    this.ctx.strokeStyle = '#16a34a'; // Darker green
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(handleX, barTop);
    this.ctx.lineTo(handleX, barTop + this.config.taskBarHeight);
    this.ctx.stroke();

    // Draw progress percentage tooltip
    const tooltipText = `${Math.round(currentProgress)}%`;
    this.ctx.font = 'bold 11px system-ui, sans-serif';
    const metrics = this.ctx.measureText(tooltipText);
    const tooltipWidth = metrics.width + 8;
    const tooltipHeight = 18;
    const tooltipX = handleX - tooltipWidth / 2;
    const tooltipY = barTop - tooltipHeight - 4;

    // Draw tooltip background
    this.ctx.fillStyle = '#1f2937';
    this.ctx.beginPath();
    this.ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 3);
    this.ctx.fill();

    // Draw tooltip text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(tooltipText, tooltipX + tooltipWidth / 2, tooltipY + tooltipHeight / 2);
  }
}

export default Renderer;
