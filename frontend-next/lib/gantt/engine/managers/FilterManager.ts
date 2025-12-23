/**
 * FilterManager - Handles task filtering and search functionality
 *
 * Responsibilities:
 * - Text-based search
 * - Status filtering
 * - Date range filtering
 * - Supplier filtering
 * - Progress filtering
 * - Custom predicate filtering
 * - Filter statistics
 *
 * @example
 * ```typescript
 * const filterManager = new FilterManager();
 * filterManager.setTasks(tasks);
 *
 * // Apply filters
 * filterManager.setFilter({ status: ['in-progress'], searchText: 'foundation' });
 * const filtered = filterManager.getFilteredTasks();
 * const stats = filterManager.getStats();
 * ```
 */

import type { GanttTask } from '../GanttCanvas';

// ============================================================================
// Types
// ============================================================================

export interface TaskFilterConfig {
  /** Filter by status (any of these) */
  status?: GanttTask['status'][];
  /** Filter by supplier IDs (any of these) */
  supplierIds?: number[];
  /** Filter by date range (tasks that overlap this range) */
  dateRange?: { start: Date; end: Date };
  /** Filter by progress range */
  progressRange?: { min: number; max: number };
  /** Filter by locked state */
  locked?: boolean;
  /** Text search in task name */
  searchText?: string;
  /** Custom filter predicate */
  customPredicate?: (task: GanttTask) => boolean;
  /** Only show tasks on critical path */
  criticalPathOnly?: boolean;
  /** Only show on-hold tasks */
  onHoldOnly?: boolean;
  /** Only show tasks with broken dependencies */
  brokenDependenciesOnly?: boolean;
}

export interface FilterStats {
  total: number;
  visible: number;
  hidden: number;
  percentage: number;
}

export interface FilterChangeEvent {
  filter: TaskFilterConfig;
  stats: FilterStats;
}

type FilterChangeCallback = (event: FilterChangeEvent) => void;

// ============================================================================
// FilterManager Class
// ============================================================================

export class FilterManager {
  // Current filter configuration
  private filter: TaskFilterConfig = {};

  // Tasks (injected)
  private tasks: GanttTask[] = [];

  // Critical path task IDs (for criticalPathOnly filter)
  private criticalPathTaskIds: Set<string> = new Set();

  // Cached filtered results
  private cachedFilteredTasks: GanttTask[] | null = null;

  // Callbacks
  private callbacks: Set<FilterChangeCallback> = new Set();

  // ============================================================================
  // Setup
  // ============================================================================

  /**
   * Set the tasks to filter
   */
  setTasks(tasks: GanttTask[]): void {
    this.tasks = tasks;
    this.invalidateCache();
  }

  /**
   * Set critical path task IDs (for criticalPathOnly filter)
   */
  setCriticalPathTasks(taskIds: string[]): void {
    this.criticalPathTaskIds = new Set(taskIds);
    this.invalidateCache();
  }

  // ============================================================================
  // Filter Operations
  // ============================================================================

  /**
   * Set the filter configuration
   */
  setFilter(filter: TaskFilterConfig): void {
    this.filter = { ...filter };
    this.invalidateCache();
    this.notifyChange();
  }

  /**
   * Update part of the filter
   */
  updateFilter(partialFilter: Partial<TaskFilterConfig>): void {
    this.filter = { ...this.filter, ...partialFilter };
    this.invalidateCache();
    this.notifyChange();
  }

  /**
   * Clear all filters
   */
  clearFilter(): void {
    this.filter = {};
    this.invalidateCache();
    this.notifyChange();
  }

  /**
   * Get current filter configuration
   */
  getFilter(): TaskFilterConfig {
    return { ...this.filter };
  }

  /**
   * Check if any filter is active
   */
  isFiltering(): boolean {
    return (
      (this.filter.status && this.filter.status.length > 0) ||
      (this.filter.supplierIds && this.filter.supplierIds.length > 0) ||
      this.filter.dateRange !== undefined ||
      this.filter.progressRange !== undefined ||
      this.filter.locked !== undefined ||
      (this.filter.searchText && this.filter.searchText.length > 0) ||
      this.filter.customPredicate !== undefined ||
      this.filter.criticalPathOnly === true ||
      this.filter.onHoldOnly === true ||
      this.filter.brokenDependenciesOnly === true
    );
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Get filtered tasks
   */
  getFilteredTasks(): GanttTask[] {
    if (this.cachedFilteredTasks !== null) {
      return this.cachedFilteredTasks;
    }

    if (!this.isFiltering()) {
      this.cachedFilteredTasks = this.tasks;
      return this.tasks;
    }

    this.cachedFilteredTasks = this.tasks.filter(task => this.matchesFilter(task));
    return this.cachedFilteredTasks;
  }

  /**
   * Check if a task matches the current filter
   */
  matchesFilter(task: GanttTask): boolean {
    // Status filter
    if (this.filter.status && this.filter.status.length > 0) {
      if (!this.filter.status.includes(task.status)) {
        return false;
      }
    }

    // Supplier filter
    if (this.filter.supplierIds && this.filter.supplierIds.length > 0) {
      if (task.supplierId === undefined || !this.filter.supplierIds.includes(task.supplierId)) {
        return false;
      }
    }

    // Date range filter
    if (this.filter.dateRange) {
      const { start, end } = this.filter.dateRange;
      // Task must overlap with date range
      if (task.endDate < start || task.startDate > end) {
        return false;
      }
    }

    // Progress range filter
    if (this.filter.progressRange) {
      const progress = task.progress || 0;
      if (progress < this.filter.progressRange.min || progress > this.filter.progressRange.max) {
        return false;
      }
    }

    // Locked filter
    if (this.filter.locked !== undefined) {
      const isLocked = task.locked !== undefined && task.locked !== null;
      if (this.filter.locked !== isLocked) {
        return false;
      }
    }

    // Text search
    if (this.filter.searchText && this.filter.searchText.length > 0) {
      const searchLower = this.filter.searchText.toLowerCase();
      const nameLower = task.name.toLowerCase();
      if (!nameLower.includes(searchLower)) {
        return false;
      }
    }

    // Critical path only
    if (this.filter.criticalPathOnly) {
      if (!this.criticalPathTaskIds.has(task.id)) {
        return false;
      }
    }

    // On hold only
    if (this.filter.onHoldOnly) {
      if (task.status !== 'on-hold') {
        return false;
      }
    }

    // Broken dependencies only
    if (this.filter.brokenDependenciesOnly) {
      if (!task.brokenPredecessorIds || task.brokenPredecessorIds.length === 0) {
        return false;
      }
    }

    // Custom predicate
    if (this.filter.customPredicate) {
      if (!this.filter.customPredicate(task)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get filter statistics
   */
  getStats(): FilterStats {
    const filtered = this.getFilteredTasks();
    const total = this.tasks.length;
    const visible = filtered.length;
    const hidden = total - visible;
    const percentage = total > 0 ? Math.round((visible / total) * 100) : 100;

    return { total, visible, hidden, percentage };
  }

  // ============================================================================
  // Convenience Search Methods
  // ============================================================================

  /**
   * Search tasks by name
   */
  searchByName(query: string): GanttTask[] {
    const lowerQuery = query.toLowerCase();
    return this.tasks.filter(t => t.name.toLowerCase().includes(lowerQuery));
  }

  /**
   * Get tasks by status
   */
  getByStatus(status: GanttTask['status']): GanttTask[] {
    return this.tasks.filter(t => t.status === status);
  }

  /**
   * Get tasks by supplier
   */
  getBySupplier(supplierId: number): GanttTask[] {
    return this.tasks.filter(t => t.supplierId === supplierId);
  }

  /**
   * Get tasks within date range
   */
  getInDateRange(start: Date, end: Date): GanttTask[] {
    return this.tasks.filter(t => t.endDate >= start && t.startDate <= end);
  }

  /**
   * Get tasks with no predecessors (root tasks)
   */
  getRootTasks(): GanttTask[] {
    return this.tasks.filter(t => !t.predecessorIds || t.predecessorIds.length === 0);
  }

  /**
   * Get tasks that are on hold
   */
  getOnHoldTasks(): GanttTask[] {
    return this.tasks.filter(t => t.status === 'on-hold');
  }

  /**
   * Get tasks with broken dependencies
   */
  getBrokenDependencyTasks(): GanttTask[] {
    return this.tasks.filter(t => t.brokenPredecessorIds && t.brokenPredecessorIds.length > 0);
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  /**
   * Subscribe to filter changes
   */
  onChange(callback: FilterChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyChange(): void {
    const event: FilterChangeEvent = {
      filter: this.getFilter(),
      stats: this.getStats(),
    };

    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[FilterManager] Callback error:', e);
      }
    }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  private invalidateCache(): void {
    this.cachedFilteredTasks = null;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  dispose(): void {
    this.callbacks.clear();
    this.tasks = [];
    this.filter = {};
    this.cachedFilteredTasks = null;
    this.criticalPathTaskIds.clear();
  }
}

export default FilterManager;
