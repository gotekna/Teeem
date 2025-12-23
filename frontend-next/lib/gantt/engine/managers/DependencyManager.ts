/**
 * DependencyManager - Manages task dependencies and cascading updates
 *
 * Responsibilities:
 * - Dependency CRUD operations (add, remove, update)
 * - Circular dependency detection and prevention
 * - Broken dependency tracking and restoration
 * - Cascade calculation (successor date updates)
 * - Dependency validation
 *
 * @example
 * ```typescript
 * const depManager = new DependencyManager();
 *
 * // Add a dependency
 * const dep = depManager.addDependency('task-1', 'task-2', 'FS');
 *
 * // Check for circular dependencies
 * if (depManager.wouldCreateCycle('task-2', 'task-1')) {
 *   console.warn('Would create cycle!');
 * }
 *
 * // Get successors that need updating
 * const successors = depManager.getSuccessors('task-1');
 * ```
 */

import type { GanttTask, GanttDependency } from '../GanttCanvas';

// ============================================================================
// Types
// ============================================================================

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface DependencyValidationError {
  taskId: string;
  brokenPredecessorId: string;
  reason: string;
}

export interface CascadeResult {
  /** Task IDs that were updated */
  updatedTaskIds: string[];
  /** New dates for each task */
  newDates: Map<string, { startDate: Date; endDate: Date }>;
  /** Any errors during cascade */
  errors: string[];
}

export interface DependencyChangeEvent {
  type: 'add' | 'remove' | 'update';
  dependency: GanttDependency;
}

export type DependencyChangeCallback = (event: DependencyChangeEvent) => void;

// ============================================================================
// DependencyManager Class
// ============================================================================

export class DependencyManager {
  // State
  private dependencies: GanttDependency[] = [];
  private taskMap: Map<string, GanttTask> = new Map();

  // Broken dependency tracking
  private brokenDependencies: Map<string, Set<string>> = new Map(); // taskId -> Set<predecessorId>

  // Callbacks
  private changeCallbacks: Set<DependencyChangeCallback> = new Set();

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor() {
    // Initialize empty
  }

  // ============================================================================
  // Public API - State Management
  // ============================================================================

  /**
   * Set the dependencies array
   */
  setDependencies(dependencies: GanttDependency[]): void {
    this.dependencies = [...dependencies];
  }

  /**
   * Set the task map for validation and cascade calculations
   */
  setTasks(tasks: GanttTask[]): void {
    this.taskMap = new Map(tasks.map(t => [t.id, t]));
  }

  /**
   * Get all dependencies
   */
  getDependencies(): GanttDependency[] {
    return [...this.dependencies];
  }

  // ============================================================================
  // Public API - CRUD Operations
  // ============================================================================

  /**
   * Add a new dependency with cycle prevention
   * @returns The new dependency if created, or null if it would cause a cycle
   */
  addDependency(
    fromId: string,
    toId: string,
    type: DependencyType = 'FS',
    lag: number = 0
  ): GanttDependency | null {
    // Check for circular dependency
    if (this.wouldCreateCycle(fromId, toId)) {
      console.warn(`Circular dependency prevented: ${fromId} → ${toId}`);
      return null;
    }

    // Check if dependency already exists
    const existing = this.findDependency(fromId, toId);
    if (existing) {
      console.warn(`Dependency already exists: ${fromId} → ${toId}`);
      return existing;
    }

    // Create the dependency
    const newDep: GanttDependency = {
      id: `dep-${fromId}-${toId}-${Date.now()}`,
      fromId,
      toId,
      type,
      lag,
    };

    this.dependencies.push(newDep);

    // Emit change event
    this.emitChange({ type: 'add', dependency: newDep });

    return newDep;
  }

  /**
   * Remove a dependency by ID
   */
  removeDependency(dependencyId: string): boolean {
    const index = this.dependencies.findIndex(d => d.id === dependencyId);
    if (index === -1) return false;

    const removed = this.dependencies.splice(index, 1)[0];

    // Emit change event
    this.emitChange({ type: 'remove', dependency: removed });

    return true;
  }

  /**
   * Remove a dependency between two tasks
   */
  removeDependencyBetween(fromId: string, toId: string): boolean {
    const dep = this.findDependency(fromId, toId);
    if (!dep) return false;
    return this.removeDependency(dep.id);
  }

  /**
   * Update a dependency's type or lag
   */
  updateDependency(
    dependencyId: string,
    updates: { type?: DependencyType; lag?: number }
  ): boolean {
    const dep = this.dependencies.find(d => d.id === dependencyId);
    if (!dep) return false;

    if (updates.type !== undefined) dep.type = updates.type;
    if (updates.lag !== undefined) dep.lag = updates.lag;

    // Emit change event
    this.emitChange({ type: 'update', dependency: dep });

    return true;
  }

  // ============================================================================
  // Public API - Query Operations
  // ============================================================================

  /**
   * Find a dependency between two tasks
   */
  findDependency(fromId: string, toId: string): GanttDependency | undefined {
    return this.dependencies.find(d => d.fromId === fromId && d.toId === toId);
  }

  /**
   * Get all predecessors (dependencies pointing TO a task)
   */
  getPredecessors(taskId: string): GanttDependency[] {
    return this.dependencies.filter(d => d.toId === taskId);
  }

  /**
   * Get all successors (dependencies pointing FROM a task)
   */
  getSuccessors(taskId: string): GanttDependency[] {
    return this.dependencies.filter(d => d.fromId === taskId);
  }

  /**
   * Get all predecessor task IDs for a task
   */
  getPredecessorIds(taskId: string): string[] {
    return this.getPredecessors(taskId).map(d => d.fromId);
  }

  /**
   * Get all successor task IDs for a task
   */
  getSuccessorIds(taskId: string): string[] {
    return this.getSuccessors(taskId).map(d => d.toId);
  }

  /**
   * Get all tasks that depend on a task (recursive)
   */
  getAllDependentTasks(taskId: string): string[] {
    const visited = new Set<string>();
    const stack = [taskId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const successorIds = this.getSuccessorIds(current);
      for (const successorId of successorIds) {
        if (!visited.has(successorId)) {
          stack.push(successorId);
        }
      }
    }

    // Remove the original task from results
    visited.delete(taskId);
    return Array.from(visited);
  }

  // ============================================================================
  // Public API - Cycle Detection
  // ============================================================================

  /**
   * Check if adding a dependency would create a cycle
   */
  wouldCreateCycle(fromId: string, toId: string): boolean {
    // Direct cycle: A → A
    if (fromId === toId) return true;

    // Build successor map for efficient traversal
    const successorMap = this.buildSuccessorMap();

    // Add the proposed dependency temporarily
    const existing = successorMap.get(fromId) || [];
    successorMap.set(fromId, [...existing, toId]);

    // DFS to detect if we can reach fromId starting from toId
    const visited = new Set<string>();
    const stack = [toId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === fromId) return true; // Cycle detected!

      if (visited.has(current)) continue;
      visited.add(current);

      const successors = successorMap.get(current) || [];
      for (const successor of successors) {
        if (!visited.has(successor)) {
          stack.push(successor);
        }
      }
    }

    return false;
  }

  /**
   * Find all circular dependencies in the graph
   * @returns Array of cycle paths, each as an array of task IDs
   */
  findCycles(): string[][] {
    const cycles: string[][] = [];
    const successorMap = this.buildSuccessorMap();

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (taskId: string): void => {
      visited.add(taskId);
      recStack.add(taskId);
      path.push(taskId);

      const successors = successorMap.get(taskId) || [];
      for (const successor of successors) {
        if (!visited.has(successor)) {
          dfs(successor);
        } else if (recStack.has(successor)) {
          // Found a cycle
          const cycleStart = path.indexOf(successor);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), successor]);
          }
        }
      }

      path.pop();
      recStack.delete(taskId);
    };

    // Get all task IDs in dependencies
    const allTaskIds = new Set<string>();
    this.dependencies.forEach(dep => {
      allTaskIds.add(dep.fromId);
      allTaskIds.add(dep.toId);
    });

    // Run DFS from each
    allTaskIds.forEach(taskId => {
      if (!visited.has(taskId)) {
        dfs(taskId);
      }
    });

    return cycles;
  }

  /**
   * Remove all circular dependencies
   * @returns IDs of removed dependencies
   */
  removeCircularDependencies(): string[] {
    const removedIds: string[] = [];
    const cycles = this.findCycles();

    cycles.forEach(cycle => {
      if (cycle.length < 2) return;

      // Find the dependency that closes this cycle
      const lastTaskId = cycle[cycle.length - 2];
      const cycleCloser = cycle[cycle.length - 1];

      const dep = this.findDependency(lastTaskId, cycleCloser);
      if (dep && !removedIds.includes(dep.id)) {
        this.removeDependency(dep.id);
        removedIds.push(dep.id);
      }
    });

    return removedIds;
  }

  // ============================================================================
  // Public API - Broken Dependencies
  // ============================================================================

  /**
   * Check if a task has broken dependencies
   */
  hasBrokenDependencies(taskId: string): boolean {
    const broken = this.brokenDependencies.get(taskId);
    return !!broken && broken.size > 0;
  }

  /**
   * Get broken dependencies for a task
   */
  getBrokenDependencies(taskId: string): string[] {
    const broken = this.brokenDependencies.get(taskId);
    return broken ? Array.from(broken) : [];
  }

  /**
   * Mark a dependency as broken
   */
  markAsBroken(taskId: string, predecessorId: string): void {
    let broken = this.brokenDependencies.get(taskId);
    if (!broken) {
      broken = new Set();
      this.brokenDependencies.set(taskId, broken);
    }
    broken.add(predecessorId);
  }

  /**
   * Restore a broken dependency
   */
  restoreBroken(taskId: string, predecessorId: string): void {
    const broken = this.brokenDependencies.get(taskId);
    if (broken) {
      broken.delete(predecessorId);
      if (broken.size === 0) {
        this.brokenDependencies.delete(taskId);
      }
    }
  }

  /**
   * Restore all broken dependencies for a task
   */
  restoreAllBroken(taskId: string): void {
    this.brokenDependencies.delete(taskId);
  }

  /**
   * Clear all broken dependencies
   */
  clearAllBroken(): void {
    this.brokenDependencies.clear();
  }

  // ============================================================================
  // Public API - Validation
  // ============================================================================

  /**
   * Validate all dependencies and find broken ones
   */
  validate(): DependencyValidationError[] {
    const errors: DependencyValidationError[] = [];

    this.dependencies.forEach(dep => {
      const fromTask = this.taskMap.get(dep.fromId);
      const toTask = this.taskMap.get(dep.toId);

      if (!fromTask) {
        errors.push({
          taskId: dep.toId,
          brokenPredecessorId: dep.fromId,
          reason: 'Predecessor task does not exist',
        });
        return;
      }

      if (!toTask) {
        return; // Orphan dependency
      }

      // Check date constraints based on dependency type
      const lag = dep.lag || 0;

      switch (dep.type) {
        case 'FS': // Finish-to-Start
          if (toTask.startDate < new Date(fromTask.endDate.getTime() + lag * 86400000)) {
            errors.push({
              taskId: dep.toId,
              brokenPredecessorId: dep.fromId,
              reason: `Successor starts before predecessor ends (FS violation)`,
            });
          }
          break;

        case 'SS': // Start-to-Start
          if (toTask.startDate < new Date(fromTask.startDate.getTime() + lag * 86400000)) {
            errors.push({
              taskId: dep.toId,
              brokenPredecessorId: dep.fromId,
              reason: `Successor starts before predecessor starts (SS violation)`,
            });
          }
          break;

        case 'FF': // Finish-to-Finish
          if (toTask.endDate < new Date(fromTask.endDate.getTime() + lag * 86400000)) {
            errors.push({
              taskId: dep.toId,
              brokenPredecessorId: dep.fromId,
              reason: `Successor finishes before predecessor finishes (FF violation)`,
            });
          }
          break;

        case 'SF': // Start-to-Finish
          if (toTask.endDate < new Date(fromTask.startDate.getTime() + lag * 86400000)) {
            errors.push({
              taskId: dep.toId,
              brokenPredecessorId: dep.fromId,
              reason: `Successor finishes before predecessor starts (SF violation)`,
            });
          }
          break;
      }
    });

    return errors;
  }

  /**
   * Auto-mark broken dependencies based on validation
   */
  updateBrokenFromValidation(): void {
    // Clear existing broken status
    this.clearAllBroken();

    // Run validation
    const errors = this.validate();

    // Mark broken
    errors.forEach(error => {
      this.markAsBroken(error.taskId, error.brokenPredecessorId);
    });
  }

  // ============================================================================
  // Public API - Cascade Calculation
  // ============================================================================

  /**
   * Calculate cascade updates when a task moves
   * @param movedTaskId The task that was moved
   * @param newStartDate The new start date
   * @param newEndDate The new end date
   * @returns Tasks that need to be updated with their new dates
   */
  calculateCascade(
    movedTaskId: string,
    newStartDate: Date,
    newEndDate: Date
  ): CascadeResult {
    const result: CascadeResult = {
      updatedTaskIds: [],
      newDates: new Map(),
      errors: [],
    };

    const movedTask = this.taskMap.get(movedTaskId);
    if (!movedTask) {
      result.errors.push(`Task ${movedTaskId} not found`);
      return result;
    }

    // Get all successors (direct and transitive)
    const successorIds = this.getSuccessorIds(movedTaskId);

    for (const successorId of successorIds) {
      const successorTask = this.taskMap.get(successorId);
      if (!successorTask) continue;

      const dep = this.findDependency(movedTaskId, successorId);
      if (!dep) continue;

      const lag = dep.lag || 0;
      const lagMs = lag * 86400000;

      let requiredStart: Date | null = null;

      // Calculate required start date based on dependency type
      switch (dep.type) {
        case 'FS':
          requiredStart = new Date(newEndDate.getTime() + lagMs);
          break;
        case 'SS':
          requiredStart = new Date(newStartDate.getTime() + lagMs);
          break;
        case 'FF': {
          // Successor end must be after predecessor end + lag
          const requiredEnd = new Date(newEndDate.getTime() + lagMs);
          const duration = successorTask.endDate.getTime() - successorTask.startDate.getTime();
          requiredStart = new Date(requiredEnd.getTime() - duration);
          break;
        }
        case 'SF': {
          // Successor end must be after predecessor start + lag
          const requiredEnd = new Date(newStartDate.getTime() + lagMs);
          const duration = successorTask.endDate.getTime() - successorTask.startDate.getTime();
          requiredStart = new Date(requiredEnd.getTime() - duration);
          break;
        }
      }

      if (requiredStart && requiredStart > successorTask.startDate) {
        // Need to push successor forward
        const duration = successorTask.endDate.getTime() - successorTask.startDate.getTime();
        const newEnd = new Date(requiredStart.getTime() + duration);

        result.updatedTaskIds.push(successorId);
        result.newDates.set(successorId, {
          startDate: requiredStart,
          endDate: newEnd,
        });
      }
    }

    return result;
  }

  // ============================================================================
  // Public API - Event Subscription
  // ============================================================================

  /**
   * Subscribe to dependency changes
   */
  onChange(callback: DependencyChangeCallback): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.changeCallbacks.clear();
  }

  // ============================================================================
  // Public API - Cleanup
  // ============================================================================

  /**
   * Clear all data
   */
  clear(): void {
    this.dependencies = [];
    this.taskMap.clear();
    this.brokenDependencies.clear();
  }

  /**
   * Dispose and clean up
   */
  dispose(): void {
    this.clear();
    this.changeCallbacks.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build a successor map for efficient traversal
   */
  private buildSuccessorMap(): Map<string, string[]> {
    const successorMap = new Map<string, string[]>();

    this.dependencies.forEach(dep => {
      const existing = successorMap.get(dep.fromId) || [];
      existing.push(dep.toId);
      successorMap.set(dep.fromId, existing);
    });

    return successorMap;
  }

  /**
   * Emit change event
   */
  private emitChange(event: DependencyChangeEvent): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[DependencyManager] Callback error:', error);
      }
    }
  }
}

export default DependencyManager;
