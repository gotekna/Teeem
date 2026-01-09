/**
 * CriticalPathManager - Handles critical path calculation and tracking
 *
 * Responsibilities:
 * - Calculate critical path
 * - Identify slack/float times
 * - Track critical tasks
 * - Notify on critical path changes
 *
 * Note: Uses the core calculateCriticalPath function from CriticalPath.ts
 *
 * @example
 * ```typescript
 * const criticalPathManager = new CriticalPathManager();
 * criticalPathManager.setTasks(tasks);
 * criticalPathManager.setDependencies(dependencies);
 *
 * criticalPathManager.calculate();
 * const criticalTasks = criticalPathManager.getCriticalTasks();
 * const slack = criticalPathManager.getSlack('task-1');
 * ```
 */

import type { GanttTask, GanttDependency } from '../GanttCanvas';
import { calculateCriticalPath, type CriticalPathResult, type TaskSchedule } from '../CriticalPath';

// ============================================================================
// Types
// ============================================================================

export interface CriticalPathChangeEvent {
  criticalPath: string[];
  result: CriticalPathResult | null;
}

type CriticalPathChangeCallback = (event: CriticalPathChangeEvent) => void;

// ============================================================================
// CriticalPathManager Class
// ============================================================================

export class CriticalPathManager {
  // Data
  private tasks: GanttTask[] = [];
  private dependencies: GanttDependency[] = [];

  // Calculation result
  private result: CriticalPathResult | null = null;
  private criticalTaskIds: Set<string> = new Set();

  // Configuration
  private enabled: boolean = false;
  private autoRecalculate: boolean = true;

  // Callbacks
  private callbacks: Set<CriticalPathChangeCallback> = new Set();

  // ============================================================================
  // Setup
  // ============================================================================

  /**
   * Set tasks for critical path calculation
   */
  setTasks(tasks: GanttTask[]): void {
    this.tasks = tasks;
    if (this.enabled && this.autoRecalculate) {
      this.calculate();
    }
  }

  /**
   * Set dependencies for critical path calculation
   */
  setDependencies(dependencies: GanttDependency[]): void {
    this.dependencies = dependencies;
    if (this.enabled && this.autoRecalculate) {
      this.calculate();
    }
  }

  /**
   * Enable/disable critical path calculation
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled && this.result === null) {
      this.calculate();
    }
  }

  /**
   * Enable/disable auto-recalculation
   */
  setAutoRecalculate(autoRecalculate: boolean): void {
    this.autoRecalculate = autoRecalculate;
  }

  // ============================================================================
  // Calculation
  // ============================================================================

  /**
   * Calculate the critical path
   */
  calculate(): CriticalPathResult | null {
    if (this.tasks.length === 0) {
      this.result = null;
      this.criticalTaskIds.clear();
      return null;
    }

    try {
      this.result = calculateCriticalPath(this.tasks, this.dependencies);

      // Update critical task IDs set from criticalTasks Set
      this.criticalTaskIds = new Set(this.result.criticalTasks);

      this.notifyChange();
      return this.result;
    } catch (error) {
      console.error('[CriticalPathManager] Calculation failed:', error);
      this.result = null;
      this.criticalTaskIds.clear();
      return null;
    }
  }

  /**
   * Invalidate cached result (force recalculation on next access)
   */
  invalidate(): void {
    this.result = null;
    if (this.enabled && this.autoRecalculate) {
      this.calculate();
    }
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Get the critical path result
   */
  getResult(): CriticalPathResult | null {
    return this.result;
  }

  /**
   * Get critical path task IDs
   */
  getCriticalPath(): string[] {
    return this.result ? Array.from(this.result.criticalTasks) : [];
  }

  /**
   * Get all critical tasks
   */
  getCriticalTasks(): GanttTask[] {
    return this.tasks.filter(t => this.criticalTaskIds.has(t.id));
  }

  /**
   * Check if a task is on the critical path
   */
  isCritical(taskId: string): boolean {
    return this.criticalTaskIds.has(taskId);
  }

  /**
   * Get schedule info for a task
   */
  getTaskSchedule(taskId: string): TaskSchedule | undefined {
    return this.result?.schedules.get(taskId);
  }

  /**
   * Get slack (float) time for a task in days
   */
  getSlack(taskId: string): number {
    const schedule = this.result?.schedules.get(taskId);
    if (!schedule) return 0;
    return schedule.totalSlack;
  }

  /**
   * Get total project duration in days
   */
  getProjectDuration(): number {
    return this.result?.projectDuration || 0;
  }

  /**
   * Get project end date
   */
  getProjectEndDate(): Date | null {
    return this.result?.projectEnd || null;
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    enabled: boolean;
    totalTasks: number;
    criticalTasks: number;
    totalDurationDays: number;
    projectEndDate: Date | null;
  } {
    return {
      enabled: this.enabled,
      totalTasks: this.tasks.length,
      criticalTasks: this.criticalTaskIds.size,
      totalDurationDays: this.result?.projectDuration || 0,
      projectEndDate: this.result?.projectEnd || null,
    };
  }

  // ============================================================================
  // Near-Critical Analysis
  // ============================================================================

  /**
   * Get tasks that are near-critical (small slack)
   * @param maxSlackDays Maximum slack in days to be considered near-critical
   */
  getNearCriticalTasks(maxSlackDays: number = 2): GanttTask[] {
    if (!this.result) return [];

    return this.tasks.filter(task => {
      if (this.criticalTaskIds.has(task.id)) return false;
      const slack = this.getSlack(task.id);
      return slack > 0 && slack <= maxSlackDays;
    });
  }

  /**
   * Get all tasks sorted by slack (ascending)
   */
  getTasksBySlack(): Array<{ task: GanttTask; slack: number }> {
    if (!this.result) return [];

    return this.tasks
      .map(task => ({
        task,
        slack: this.getSlack(task.id),
      }))
      .sort((a, b) => a.slack - b.slack);
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  onChange(callback: CriticalPathChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyChange(): void {
    const event: CriticalPathChangeEvent = {
      criticalPath: this.getCriticalPath(),
      result: this.result,
    };

    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[CriticalPathManager] Callback error:', e);
      }
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  dispose(): void {
    this.callbacks.clear();
    this.tasks = [];
    this.dependencies = [];
    this.result = null;
    this.criticalTaskIds.clear();
  }
}

export default CriticalPathManager;
