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

import type { GanttConfig, GanttTask, GanttDependency } from './GanttCanvas';
import { Viewport } from './Viewport';

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
   * Draw grid lines and weekend shading
   */
  drawGrid(width: number, height: number, totalRows: number): void {
    const dayWidth = this.viewport.getDayWidth();
    const state = this.viewport.getState();

    // Calculate visible days
    const startDayOffset = Math.floor(state.scrollX / dayWidth);
    const endDayOffset = Math.ceil((state.scrollX + width) / dayWidth);

    // Draw vertical grid lines (days) and weekend shading
    for (let i = startDayOffset; i <= endDayOffset; i++) {
      const x = i * dayWidth - state.scrollX;
      const currentDate = new Date(state.startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dayOfWeek = currentDate.getDay();

      // Weekend shading (Saturday = 6, Sunday = 0)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        this.ctx.fillStyle = this.config.colors.weekendBackground;
        this.ctx.fillRect(x, this.config.headerHeight, dayWidth, height - this.config.headerHeight);
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
   * Draw task bars
   */
  drawTaskBars(
    tasks: GanttTask[],
    selectedTaskIds: Set<string>,
    hoveredTaskId: string | null,
    hoveredEdge?: 'left' | 'right' | null
  ): void {
    const { taskBarHeight, taskBarPadding, rowHeight } = this.config;

    tasks.forEach((task, index) => {
      const y = this.viewport.rowToY(index);
      const startX = this.viewport.dateToX(task.startDate);
      const endX = this.viewport.dateToX(task.endDate);
      const taskWidth = Math.max(endX - startX, 20); // Minimum width
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

      // Draw task bar border
      this.ctx.strokeStyle = this.config.colors.taskBarBorder;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.roundRect(startX, barY, taskWidth, barHeight, 4);
      this.ctx.stroke();

      // Draw progress bar if applicable
      if (task.progress !== undefined && task.progress > 0) {
        const progressWidth = taskWidth * (task.progress / 100);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.roundRect(startX, barY, progressWidth, barHeight, 4);
        this.ctx.fill();
      }

      // Draw lock icon if locked
      if (task.locked) {
        this.drawLockIcon(startX + 4, barY + barHeight / 2);
      }

      // Draw task name
      this.ctx.fillStyle = this.config.colors.taskBarText;
      this.ctx.font = '11px Inter, system-ui, sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';

      // Truncate text if needed
      const textX = startX + (task.locked ? 20 : 8);
      const maxTextWidth = taskWidth - (task.locked ? 28 : 16);

      if (maxTextWidth > 20) {
        const truncatedText = this.truncateText(task.name, maxTextWidth);
        this.ctx.fillText(truncatedText, textX, barY + barHeight / 2);
      }

      // Draw resize handles on hover (only for unlocked tasks)
      if (task.id === hoveredTaskId && !task.locked) {
        this.drawResizeHandles(startX, barY, taskWidth, barHeight, hoveredEdge);
      }

      // Draw dependency connector dots on hover
      if (task.id === hoveredTaskId) {
        this.drawConnectorDots(startX, endX, barY, barHeight);
      }
    });
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

    // Draw tooltip showing date change
    const daysDiff = Math.round((newDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff !== 0) {
      const tooltipText = daysDiff > 0 ? `+${daysDiff} days` : `${daysDiff} days`;
      const newDateStr = newDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
      const fullText = `${newDateStr} (${tooltipText})`;

      const tooltipX = newStartX + taskWidth / 2;
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
    highlightedTaskId: string | null = null
  ): void {
    const taskMap = new Map(tasks.map((t, i) => [t.id, { task: t, index: i }]));

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

    // Draw non-highlighted dependencies first (so highlighted ones are on top)
    dependencies.forEach((dep) => {
      const isHighlighted = highlightedPredecessors.has(dep.id) || highlightedSuccessors.has(dep.id);
      if (isHighlighted) return; // Skip, will draw later

      const from = taskMap.get(dep.fromId);
      const to = taskMap.get(dep.toId);
      if (!from || !to) return;

      const { fromX, toX } = this.getDependencyEndpoints(dep, from.task, to.task);
      const fromY = this.viewport.rowToY(from.index) + this.config.rowHeight / 2;
      const toY = this.viewport.rowToY(to.index) + this.config.rowHeight / 2;

      this.drawDependencyLine(fromX, fromY, toX, toY, dep.type, false);
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

      const { fromX, toX } = this.getDependencyEndpoints(dep, from.task, to.task);
      const fromY = this.viewport.rowToY(from.index) + this.config.rowHeight / 2;
      const toY = this.viewport.rowToY(to.index) + this.config.rowHeight / 2;

      const color = Renderer.DEPENDENCY_COLORS[colorIndex % Renderer.DEPENDENCY_COLORS.length];
      this.drawDependencyLine(fromX, fromY, toX, toY, dep.type, true, color);
      colorIndex++;
    });
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
}

export default Renderer;
