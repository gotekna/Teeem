/**
 * SelectionManager - Manages task selection state
 *
 * Responsibilities:
 * - Single and multi-task selection
 * - Shift+click range selection
 * - Ctrl+click toggle selection
 * - Selection change event emission
 *
 * @example
 * ```typescript
 * const selection = new SelectionManager();
 *
 * // Subscribe to selection changes
 * selection.onChange((event) => {
 *   console.log('Selected:', event.selected);
 *   console.log('Added:', event.added);
 *   console.log('Removed:', event.removed);
 * });
 *
 * // Select a task
 * selection.add('task-1');
 *
 * // Toggle selection
 * selection.toggle('task-2');
 *
 * // Range select (shift+click)
 * selection.selectRange('task-1', 'task-5', taskOrder);
 * ```
 */

import type { GanttTask } from '../GanttCanvas';

// ============================================================================
// Types
// ============================================================================

export interface SelectionChangeEvent {
  /** Currently selected task IDs */
  selected: Set<string>;
  /** Task IDs added in this change */
  added: string[];
  /** Task IDs removed in this change */
  removed: string[];
  /** Source of the change */
  source: 'click' | 'ctrl-click' | 'shift-click' | 'marquee' | 'api' | 'clear';
}

export type SelectionChangeCallback = (event: SelectionChangeEvent) => void;

export type ModifierKey = 'ctrl' | 'shift' | 'none';

// ============================================================================
// SelectionManager Class
// ============================================================================

export class SelectionManager {
  // State
  private selectedTaskIds: Set<string> = new Set();
  private lastSelectedTaskId: string | null = null;
  private anchorTaskId: string | null = null; // For range selection

  // Callbacks
  private changeCallbacks: Set<SelectionChangeCallback> = new Set();

  // Task order reference (for range selection)
  private taskOrder: string[] = [];

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor() {
    // Initialize empty
  }

  // ============================================================================
  // Public API - Selection Operations
  // ============================================================================

  /**
   * Add a task to selection
   * @param taskId Task ID to select
   * @param source Source of the selection change
   */
  add(taskId: string, source: SelectionChangeEvent['source'] = 'api'): void {
    if (this.selectedTaskIds.has(taskId)) {
      return; // Already selected
    }

    const added = [taskId];
    this.selectedTaskIds.add(taskId);
    this.lastSelectedTaskId = taskId;

    this.emitChange(added, [], source);
  }

  /**
   * Remove a task from selection
   * @param taskId Task ID to deselect
   */
  remove(taskId: string): void {
    if (!this.selectedTaskIds.has(taskId)) {
      return; // Not selected
    }

    const removed = [taskId];
    this.selectedTaskIds.delete(taskId);

    if (this.lastSelectedTaskId === taskId) {
      this.lastSelectedTaskId = this.selectedTaskIds.size > 0
        ? Array.from(this.selectedTaskIds).pop() || null
        : null;
    }

    this.emitChange([], removed, 'api');
  }

  /**
   * Toggle task selection
   * @param taskId Task ID to toggle
   */
  toggle(taskId: string): void {
    if (this.selectedTaskIds.has(taskId)) {
      this.remove(taskId);
    } else {
      this.add(taskId, 'ctrl-click');
    }
  }

  /**
   * Clear all selections
   */
  clear(): void {
    if (this.selectedTaskIds.size === 0) {
      return; // Nothing to clear
    }

    const removed = Array.from(this.selectedTaskIds);
    this.selectedTaskIds.clear();
    this.lastSelectedTaskId = null;
    this.anchorTaskId = null;

    this.emitChange([], removed, 'clear');
  }

  /**
   * Select a single task (clears previous selection)
   * @param taskId Task ID to select
   */
  selectSingle(taskId: string): void {
    const wasSelected = this.selectedTaskIds.has(taskId);
    const removed = Array.from(this.selectedTaskIds).filter(id => id !== taskId);

    this.selectedTaskIds.clear();
    this.selectedTaskIds.add(taskId);
    this.lastSelectedTaskId = taskId;
    this.anchorTaskId = taskId;

    if (removed.length > 0 || !wasSelected) {
      this.emitChange(wasSelected ? [] : [taskId], removed, 'click');
    }
  }

  /**
   * Handle click with modifier keys
   * @param taskId Clicked task ID
   * @param modifier Modifier key state
   */
  handleClick(taskId: string, modifier: ModifierKey): void {
    switch (modifier) {
      case 'ctrl':
        this.toggle(taskId);
        break;

      case 'shift':
        if (this.anchorTaskId && this.taskOrder.length > 0) {
          this.selectRange(this.anchorTaskId, taskId);
        } else {
          this.selectSingle(taskId);
        }
        break;

      case 'none':
      default:
        this.selectSingle(taskId);
        break;
    }
  }

  /**
   * Select a range of tasks (for shift+click)
   * @param fromId Start task ID
   * @param toId End task ID
   */
  selectRange(fromId: string, toId: string): void {
    if (this.taskOrder.length === 0) {
      // No task order set, just select both
      this.selectMultiple([fromId, toId], 'shift-click');
      return;
    }

    const fromIndex = this.taskOrder.indexOf(fromId);
    const toIndex = this.taskOrder.indexOf(toId);

    if (fromIndex === -1 || toIndex === -1) {
      // Tasks not in order, fall back to simple selection
      this.selectMultiple([fromId, toId], 'shift-click');
      return;
    }

    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);

    const rangeIds = this.taskOrder.slice(startIndex, endIndex + 1);
    this.selectMultiple(rangeIds, 'shift-click');
  }

  /**
   * Select multiple tasks
   * @param taskIds Array of task IDs to select
   * @param source Source of the selection change
   */
  selectMultiple(taskIds: string[], source: SelectionChangeEvent['source'] = 'api'): void {
    const previousSelected = new Set(this.selectedTaskIds);
    const newSelected = new Set(taskIds);

    // Calculate added and removed
    const added = taskIds.filter(id => !previousSelected.has(id));
    const removed = Array.from(previousSelected).filter(id => !newSelected.has(id));

    // Update state
    this.selectedTaskIds = newSelected;
    this.lastSelectedTaskId = taskIds.length > 0 ? taskIds[taskIds.length - 1] : null;

    if (added.length > 0 || removed.length > 0) {
      this.emitChange(added, removed, source);
    }
  }

  /**
   * Add multiple tasks to existing selection
   * @param taskIds Task IDs to add
   */
  addMultiple(taskIds: string[]): void {
    const added: string[] = [];

    for (const taskId of taskIds) {
      if (!this.selectedTaskIds.has(taskId)) {
        this.selectedTaskIds.add(taskId);
        added.push(taskId);
      }
    }

    if (added.length > 0) {
      this.lastSelectedTaskId = added[added.length - 1];
      this.emitChange(added, [], 'marquee');
    }
  }

  // ============================================================================
  // Public API - State Access
  // ============================================================================

  /**
   * Get all selected task IDs
   */
  getSelected(): Set<string> {
    return new Set(this.selectedTaskIds);
  }

  /**
   * Get selected task IDs as array
   */
  getSelectedArray(): string[] {
    return Array.from(this.selectedTaskIds);
  }

  /**
   * Check if a task is selected
   */
  isSelected(taskId: string): boolean {
    return this.selectedTaskIds.has(taskId);
  }

  /**
   * Get the count of selected tasks
   */
  count(): number {
    return this.selectedTaskIds.size;
  }

  /**
   * Check if any tasks are selected
   */
  hasSelection(): boolean {
    return this.selectedTaskIds.size > 0;
  }

  /**
   * Get the last selected task ID
   */
  getLastSelected(): string | null {
    return this.lastSelectedTaskId;
  }

  /**
   * Get the anchor task ID (for range selection)
   */
  getAnchor(): string | null {
    return this.anchorTaskId;
  }

  // ============================================================================
  // Public API - Task Order
  // ============================================================================

  /**
   * Set the task order for range selection
   * @param order Array of task IDs in display order
   */
  setTaskOrder(order: string[]): void {
    this.taskOrder = [...order];
  }

  /**
   * Update task order from tasks array
   * @param tasks Array of tasks
   */
  updateTaskOrderFromTasks(tasks: GanttTask[]): void {
    this.taskOrder = tasks.map(t => t.id);
  }

  // ============================================================================
  // Public API - Event Subscription
  // ============================================================================

  /**
   * Subscribe to selection changes
   * @param callback Callback function
   * @returns Unsubscribe function
   */
  onChange(callback: SelectionChangeCallback): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.changeCallbacks.clear();
  }

  // ============================================================================
  // Public API - State Management
  // ============================================================================

  /**
   * Get serializable state
   */
  getState(): { selected: string[]; lastSelected: string | null; anchor: string | null } {
    return {
      selected: Array.from(this.selectedTaskIds),
      lastSelected: this.lastSelectedTaskId,
      anchor: this.anchorTaskId,
    };
  }

  /**
   * Restore state from serialized data
   */
  setState(state: { selected: string[]; lastSelected?: string | null; anchor?: string | null }): void {
    this.selectedTaskIds = new Set(state.selected);
    this.lastSelectedTaskId = state.lastSelected ?? null;
    this.anchorTaskId = state.anchor ?? null;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.selectedTaskIds.clear();
    this.changeCallbacks.clear();
    this.taskOrder = [];
    this.lastSelectedTaskId = null;
    this.anchorTaskId = null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Emit selection change event
   */
  private emitChange(
    added: string[],
    removed: string[],
    source: SelectionChangeEvent['source']
  ): void {
    const event: SelectionChangeEvent = {
      selected: new Set(this.selectedTaskIds),
      added,
      removed,
      source,
    };

    for (const callback of this.changeCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[SelectionManager] Callback error:', error);
      }
    }
  }
}

export default SelectionManager;
