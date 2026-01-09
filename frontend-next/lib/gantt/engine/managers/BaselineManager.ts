/**
 * BaselineManager - Handles baseline schedule comparison
 *
 * Responsibilities:
 * - Capture schedule baselines
 * - Compare current vs baseline dates
 * - Calculate variances
 * - Track multiple baselines
 *
 * @example
 * ```typescript
 * const baselineManager = new BaselineManager();
 * baselineManager.setTasks(tasks);
 *
 * // Capture a baseline
 * const baseline = baselineManager.captureBaseline('Initial Plan');
 *
 * // Later, compare current state to baseline
 * const variance = baselineManager.getVariance('task-1', baseline.id);
 * ```
 */

import type { GanttTask, GanttBaseline } from '../GanttCanvas';

// ============================================================================
// Types
// ============================================================================

export interface BaselineSnapshot {
  id: string;
  name: string;
  capturedAt: Date;
  taskBaselines: Map<string, GanttBaseline>;
}

export interface TaskVariance {
  taskId: string;
  taskName: string;
  baselineStart: Date;
  baselineEnd: Date;
  currentStart: Date;
  currentEnd: Date;
  startVarianceDays: number;
  endVarianceDays: number;
  durationVarianceDays: number;
  isDelayed: boolean;
  isAhead: boolean;
}

export interface BaselineChangeEvent {
  type: 'capture' | 'delete' | 'select';
  baseline: BaselineSnapshot | null;
}

type BaselineChangeCallback = (event: BaselineChangeEvent) => void;

// ============================================================================
// BaselineManager Class
// ============================================================================

export class BaselineManager {
  // Stored baselines
  private baselines: Map<string, BaselineSnapshot> = new Map();

  // Current tasks (for comparison)
  private tasks: GanttTask[] = [];

  // Currently selected baseline for display
  private selectedBaselineId: string | null = null;

  // Callbacks
  private callbacks: Set<BaselineChangeCallback> = new Set();

  // ID counter
  private idCounter: number = 0;

  // ============================================================================
  // Setup
  // ============================================================================

  /**
   * Set current tasks for comparison
   */
  setTasks(tasks: GanttTask[]): void {
    this.tasks = tasks;
  }

  // ============================================================================
  // Baseline Operations
  // ============================================================================

  /**
   * Capture a new baseline from current task dates
   */
  captureBaseline(name: string = 'Baseline'): BaselineSnapshot {
    const id = `baseline-${++this.idCounter}`;
    const capturedAt = new Date();
    const taskBaselines = new Map<string, GanttBaseline>();

    for (const task of this.tasks) {
      taskBaselines.set(task.id, {
        taskId: task.id,
        startDate: new Date(task.startDate),
        endDate: new Date(task.endDate),
        name: task.name,
        capturedAt,
      });
    }

    const baseline: BaselineSnapshot = {
      id,
      name,
      capturedAt,
      taskBaselines,
    };

    this.baselines.set(id, baseline);
    this.notifyChange({ type: 'capture', baseline });

    return baseline;
  }

  /**
   * Delete a baseline
   */
  deleteBaseline(baselineId: string): boolean {
    const baseline = this.baselines.get(baselineId);
    if (!baseline) return false;

    this.baselines.delete(baselineId);

    if (this.selectedBaselineId === baselineId) {
      this.selectedBaselineId = null;
    }

    this.notifyChange({ type: 'delete', baseline });
    return true;
  }

  /**
   * Get a baseline by ID
   */
  getBaseline(baselineId: string): BaselineSnapshot | undefined {
    return this.baselines.get(baselineId);
  }

  /**
   * Get all baselines
   */
  getAllBaselines(): BaselineSnapshot[] {
    return Array.from(this.baselines.values());
  }

  /**
   * Select a baseline for display
   */
  selectBaseline(baselineId: string | null): void {
    this.selectedBaselineId = baselineId;
    const baseline = baselineId ? this.baselines.get(baselineId) || null : null;
    this.notifyChange({ type: 'select', baseline });
  }

  /**
   * Get the currently selected baseline
   */
  getSelectedBaseline(): BaselineSnapshot | null {
    if (!this.selectedBaselineId) return null;
    return this.baselines.get(this.selectedBaselineId) || null;
  }

  // ============================================================================
  // Variance Calculations
  // ============================================================================

  /**
   * Get variance for a single task
   */
  getTaskVariance(taskId: string, baselineId?: string): TaskVariance | null {
    const baselineToUse = baselineId || this.selectedBaselineId;
    if (!baselineToUse) return null;

    const baseline = this.baselines.get(baselineToUse);
    if (!baseline) return null;

    const taskBaseline = baseline.taskBaselines.get(taskId);
    if (!taskBaseline) return null;

    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return null;

    return this.calculateVariance(task, taskBaseline);
  }

  /**
   * Get variances for all tasks
   */
  getAllVariances(baselineId?: string): TaskVariance[] {
    const baselineToUse = baselineId || this.selectedBaselineId;
    if (!baselineToUse) return [];

    const baseline = this.baselines.get(baselineToUse);
    if (!baseline) return [];

    const variances: TaskVariance[] = [];

    for (const task of this.tasks) {
      const taskBaseline = baseline.taskBaselines.get(task.id);
      if (taskBaseline) {
        variances.push(this.calculateVariance(task, taskBaseline));
      }
    }

    return variances;
  }

  /**
   * Get only delayed tasks
   */
  getDelayedTasks(baselineId?: string): TaskVariance[] {
    return this.getAllVariances(baselineId).filter(v => v.isDelayed);
  }

  /**
   * Get only ahead-of-schedule tasks
   */
  getAheadTasks(baselineId?: string): TaskVariance[] {
    return this.getAllVariances(baselineId).filter(v => v.isAhead);
  }

  /**
   * Get summary statistics
   */
  getVarianceSummary(baselineId?: string): {
    totalTasks: number;
    onSchedule: number;
    delayed: number;
    ahead: number;
    avgDelayDays: number;
  } {
    const variances = this.getAllVariances(baselineId);

    const delayed = variances.filter(v => v.isDelayed);
    const ahead = variances.filter(v => v.isAhead);
    const onSchedule = variances.filter(v => !v.isDelayed && !v.isAhead);

    const avgDelayDays = delayed.length > 0
      ? delayed.reduce((sum, v) => sum + v.startVarianceDays, 0) / delayed.length
      : 0;

    return {
      totalTasks: variances.length,
      onSchedule: onSchedule.length,
      delayed: delayed.length,
      ahead: ahead.length,
      avgDelayDays: Math.round(avgDelayDays * 10) / 10,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private calculateVariance(task: GanttTask, baseline: GanttBaseline): TaskVariance {
    const msPerDay = 24 * 60 * 60 * 1000;

    const baselineDuration = (baseline.endDate.getTime() - baseline.startDate.getTime()) / msPerDay;
    const currentDuration = (task.endDate.getTime() - task.startDate.getTime()) / msPerDay;

    const startVarianceDays = Math.round((task.startDate.getTime() - baseline.startDate.getTime()) / msPerDay);
    const endVarianceDays = Math.round((task.endDate.getTime() - baseline.endDate.getTime()) / msPerDay);
    const durationVarianceDays = Math.round(currentDuration - baselineDuration);

    return {
      taskId: task.id,
      taskName: task.name,
      baselineStart: baseline.startDate,
      baselineEnd: baseline.endDate,
      currentStart: task.startDate,
      currentEnd: task.endDate,
      startVarianceDays,
      endVarianceDays,
      durationVarianceDays,
      isDelayed: startVarianceDays > 0,
      isAhead: startVarianceDays < 0,
    };
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  onChange(callback: BaselineChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyChange(event: BaselineChangeEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[BaselineManager] Callback error:', e);
      }
    }
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Export baselines to JSON
   */
  toJSON(): string {
    const data = {
      baselines: Array.from(this.baselines.values()).map(b => ({
        id: b.id,
        name: b.name,
        capturedAt: b.capturedAt.toISOString(),
        taskBaselines: Array.from(b.taskBaselines.values()).map(tb => ({
          taskId: tb.taskId,
          startDate: tb.startDate.toISOString(),
          endDate: tb.endDate.toISOString(),
          name: tb.name,
        })),
      })),
      selectedBaselineId: this.selectedBaselineId,
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import baselines from JSON
   */
  fromJSON(json: string): void {
    try {
      const data = JSON.parse(json);

      this.baselines.clear();

      for (const b of data.baselines || []) {
        const taskBaselines = new Map<string, GanttBaseline>();
        for (const tb of b.taskBaselines || []) {
          taskBaselines.set(tb.taskId, {
            taskId: tb.taskId,
            startDate: new Date(tb.startDate),
            endDate: new Date(tb.endDate),
            name: tb.name,
            capturedAt: new Date(b.capturedAt),
          });
        }

        this.baselines.set(b.id, {
          id: b.id,
          name: b.name,
          capturedAt: new Date(b.capturedAt),
          taskBaselines,
        });
      }

      this.selectedBaselineId = data.selectedBaselineId || null;
    } catch (e) {
      console.error('[BaselineManager] Failed to parse JSON:', e);
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  dispose(): void {
    this.callbacks.clear();
    this.baselines.clear();
    this.tasks = [];
    this.selectedBaselineId = null;
  }
}

export default BaselineManager;
