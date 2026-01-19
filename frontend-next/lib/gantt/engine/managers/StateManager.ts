/**
 * StateManager - Manages Gantt canvas state persistence and restoration
 *
 * Responsibilities:
 * - State persistence to localStorage (with debouncing)
 * - State restoration on load
 * - State change subscriptions
 * - State snapshots for undo/redo integration
 * - Viewport state management
 *
 * @example
 * ```typescript
 * const stateManager = new StateManager('gantt-state');
 *
 * // Enable persistence
 * stateManager.enablePersistence();
 *
 * // Update state
 * stateManager.updateViewport({ scrollX: 100, scrollY: 50 });
 *
 * // State will auto-persist after debounce interval
 *
 * // Take a snapshot for undo
 * const snapshot = stateManager.takeSnapshot();
 * ```
 */

import { getStorageItem, setStorageItem, removeStorageItem } from '@/lib/storage-utils';

// ============================================================================
// Types
// ============================================================================

export interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  startDate: Date;
}

export interface GanttCanvasState {
  /** Viewport scroll and zoom state */
  viewportState: ViewportState;
  /** Currently selected task IDs */
  selectedTaskIds: string[];
  /** Whether the minimap is visible */
  minimapVisible: boolean;
  /** Whether critical path is enabled */
  criticalPathEnabled: boolean;
  /** Whether baseline comparison is enabled */
  baselineEnabled: boolean;
  /** Last selected task ID for shift+click */
  lastSelectedTaskId: string | null;
}

export interface StateSnapshot {
  timestamp: number;
  state: GanttCanvasState;
  label?: string;
}

export interface StateChangeEvent {
  type: 'viewport' | 'selection' | 'feature' | 'full';
  previousState: Partial<GanttCanvasState>;
  newState: Partial<GanttCanvasState>;
}

export type StateChangeCallback = (event: StateChangeEvent) => void;

export interface PersistenceConfig {
  key: string;
  debounceMs: number;
  enabled: boolean;
}

// ============================================================================
// StateManager Class
// ============================================================================

export class StateManager {
  // Current state
  private state: GanttCanvasState;

  // Persistence
  private persistence: PersistenceConfig;
  private persistenceTimeout: ReturnType<typeof setTimeout> | null = null;

  // Snapshots for undo/redo
  private snapshots: StateSnapshot[] = [];
  private maxSnapshots: number = 50;

  // Callbacks
  private changeCallbacks: Set<StateChangeCallback> = new Set();

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor(persistenceKey: string = 'gantt-canvas-state') {
    // Initialize default state
    this.state = this.getDefaultState();

    // Initialize persistence config
    this.persistence = {
      key: persistenceKey,
      debounceMs: 1000,
      enabled: false,
    };
  }

  // ============================================================================
  // Public API - State Access
  // ============================================================================

  /**
   * Get the current state
   */
  getState(): GanttCanvasState {
    return { ...this.state };
  }

  /**
   * Get viewport state
   */
  getViewportState(): ViewportState {
    return { ...this.state.viewportState };
  }

  /**
   * Get selected task IDs
   */
  getSelectedTaskIds(): string[] {
    return [...this.state.selectedTaskIds];
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: 'minimap' | 'criticalPath' | 'baseline'): boolean {
    switch (feature) {
      case 'minimap':
        return this.state.minimapVisible;
      case 'criticalPath':
        return this.state.criticalPathEnabled;
      case 'baseline':
        return this.state.baselineEnabled;
    }
  }

  // ============================================================================
  // Public API - State Updates
  // ============================================================================

  /**
   * Update viewport state
   */
  updateViewport(updates: Partial<ViewportState>): void {
    const previous = { viewportState: { ...this.state.viewportState } };

    this.state.viewportState = {
      ...this.state.viewportState,
      ...updates,
    };

    this.emitChange({
      type: 'viewport',
      previousState: previous,
      newState: { viewportState: { ...this.state.viewportState } },
    });

    this.schedulePersistence();
  }

  /**
   * Update selection state
   */
  updateSelection(selectedIds: string[], lastSelectedId: string | null = null): void {
    const previous = {
      selectedTaskIds: [...this.state.selectedTaskIds],
      lastSelectedTaskId: this.state.lastSelectedTaskId,
    };

    this.state.selectedTaskIds = selectedIds;
    this.state.lastSelectedTaskId = lastSelectedId;

    this.emitChange({
      type: 'selection',
      previousState: previous,
      newState: {
        selectedTaskIds: [...this.state.selectedTaskIds],
        lastSelectedTaskId: this.state.lastSelectedTaskId,
      },
    });

    this.schedulePersistence();
  }

  /**
   * Toggle a feature
   */
  toggleFeature(feature: 'minimap' | 'criticalPath' | 'baseline', enabled?: boolean): void {
    const previous: Partial<GanttCanvasState> = {};
    const updates: Partial<GanttCanvasState> = {};

    switch (feature) {
      case 'minimap':
        previous.minimapVisible = this.state.minimapVisible;
        this.state.minimapVisible = enabled ?? !this.state.minimapVisible;
        updates.minimapVisible = this.state.minimapVisible;
        break;
      case 'criticalPath':
        previous.criticalPathEnabled = this.state.criticalPathEnabled;
        this.state.criticalPathEnabled = enabled ?? !this.state.criticalPathEnabled;
        updates.criticalPathEnabled = this.state.criticalPathEnabled;
        break;
      case 'baseline':
        previous.baselineEnabled = this.state.baselineEnabled;
        this.state.baselineEnabled = enabled ?? !this.state.baselineEnabled;
        updates.baselineEnabled = this.state.baselineEnabled;
        break;
    }

    this.emitChange({
      type: 'feature',
      previousState: previous,
      newState: updates,
    });

    this.schedulePersistence();
  }

  /**
   * Set full state (for restore operations)
   */
  setState(newState: Partial<GanttCanvasState>): void {
    const previous = { ...this.state };

    if (newState.viewportState) {
      this.state.viewportState = { ...newState.viewportState };
    }
    if (newState.selectedTaskIds) {
      this.state.selectedTaskIds = [...newState.selectedTaskIds];
    }
    if (newState.lastSelectedTaskId !== undefined) {
      this.state.lastSelectedTaskId = newState.lastSelectedTaskId;
    }
    if (newState.minimapVisible !== undefined) {
      this.state.minimapVisible = newState.minimapVisible;
    }
    if (newState.criticalPathEnabled !== undefined) {
      this.state.criticalPathEnabled = newState.criticalPathEnabled;
    }
    if (newState.baselineEnabled !== undefined) {
      this.state.baselineEnabled = newState.baselineEnabled;
    }

    this.emitChange({
      type: 'full',
      previousState: previous,
      newState: { ...this.state },
    });

    this.schedulePersistence();
  }

  // ============================================================================
  // Public API - Persistence
  // ============================================================================

  /**
   * Enable state persistence to localStorage
   */
  enablePersistence(key?: string, debounceMs?: number): void {
    if (key) this.persistence.key = key;
    if (debounceMs) this.persistence.debounceMs = debounceMs;
    this.persistence.enabled = true;
  }

  /**
   * Disable state persistence
   */
  disablePersistence(): void {
    this.persistence.enabled = false;
    this.cancelScheduledPersistence();
  }

  /**
   * Check if persistence is enabled
   */
  isPersistenceEnabled(): boolean {
    return this.persistence.enabled;
  }

  /**
   * Immediately persist current state
   */
  persistNow(): void {
    this.cancelScheduledPersistence();
    this.persist();
  }

  /**
   * Restore state from localStorage
   * @returns true if state was restored, false otherwise
   */
  restore(): boolean {
    if (!this.persistence.enabled) return false;

    try {
      const saved = getStorageItem<string>(this.persistence.key, '', false);
      if (!saved) return false;

      const parsed = JSON.parse(saved);
      this.applyPersistedState(parsed);
      return true;
    } catch (e) {
      console.warn('[StateManager] Failed to restore state:', e);
      return false;
    }
  }

  /**
   * Clear persisted state from localStorage
   */
  clearPersistedState(): void {
    try {
      removeStorageItem(this.persistence.key, false);
    } catch (e) {
      console.warn('[StateManager] Failed to clear persisted state:', e);
    }
  }

  // ============================================================================
  // Public API - Snapshots
  // ============================================================================

  /**
   * Take a snapshot of the current state
   */
  takeSnapshot(label?: string): StateSnapshot {
    const snapshot: StateSnapshot = {
      timestamp: Date.now(),
      state: this.getState(),
      label,
    };

    this.snapshots.push(snapshot);

    // Trim old snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * Restore state from a snapshot
   */
  restoreSnapshot(snapshot: StateSnapshot): void {
    this.setState(snapshot.state);
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): StateSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Clear all snapshots
   */
  clearSnapshots(): void {
    this.snapshots = [];
  }

  // ============================================================================
  // Public API - Event Subscription
  // ============================================================================

  /**
   * Subscribe to state changes
   */
  onChange(callback: StateChangeCallback): () => void {
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
   * Reset to default state
   */
  reset(): void {
    this.state = this.getDefaultState();
    this.snapshots = [];
    this.cancelScheduledPersistence();
  }

  /**
   * Dispose and clean up
   */
  dispose(): void {
    this.cancelScheduledPersistence();
    this.changeCallbacks.clear();
    this.snapshots = [];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get default state
   */
  private getDefaultState(): GanttCanvasState {
    return {
      viewportState: {
        scrollX: 0,
        scrollY: 0,
        zoom: 1,
        startDate: new Date(),
      },
      selectedTaskIds: [],
      minimapVisible: true,
      criticalPathEnabled: false,
      baselineEnabled: false,
      lastSelectedTaskId: null,
    };
  }

  /**
   * Schedule debounced persistence
   */
  private schedulePersistence(): void {
    if (!this.persistence.enabled) return;

    this.cancelScheduledPersistence();

    this.persistenceTimeout = setTimeout(() => {
      this.persist();
      this.persistenceTimeout = null;
    }, this.persistence.debounceMs);
  }

  /**
   * Cancel scheduled persistence
   */
  private cancelScheduledPersistence(): void {
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
      this.persistenceTimeout = null;
    }
  }

  /**
   * Persist state to localStorage
   */
  private persist(): void {
    if (!this.persistence.enabled) return;

    try {
      const stateToSave = {
        viewportState: {
          ...this.state.viewportState,
          startDate: this.state.viewportState.startDate.toISOString(),
        },
        selectedTaskIds: this.state.selectedTaskIds,
        minimapVisible: this.state.minimapVisible,
        criticalPathEnabled: this.state.criticalPathEnabled,
        baselineEnabled: this.state.baselineEnabled,
        lastSelectedTaskId: this.state.lastSelectedTaskId,
      };

      setStorageItem(this.persistence.key, stateToSave, false);
    } catch (e) {
      console.warn('[StateManager] Failed to persist state:', e);
    }
  }

  /**
   * Apply persisted state
   */
  private applyPersistedState(parsed: unknown): void {
    if (!parsed || typeof parsed !== 'object') return;

    const data = parsed as Record<string, unknown>;

    if (data.viewportState && typeof data.viewportState === 'object') {
      const vp = data.viewportState as Record<string, unknown>;
      this.state.viewportState = {
        scrollX: typeof vp.scrollX === 'number' ? vp.scrollX : 0,
        scrollY: typeof vp.scrollY === 'number' ? vp.scrollY : 0,
        zoom: typeof vp.zoom === 'number' ? vp.zoom : 1,
        startDate: typeof vp.startDate === 'string' ? new Date(vp.startDate) : new Date(),
      };
    }

    if (Array.isArray(data.selectedTaskIds)) {
      this.state.selectedTaskIds = data.selectedTaskIds.filter((id): id is string => typeof id === 'string');
    }

    if (typeof data.minimapVisible === 'boolean') {
      this.state.minimapVisible = data.minimapVisible;
    }

    if (typeof data.criticalPathEnabled === 'boolean') {
      this.state.criticalPathEnabled = data.criticalPathEnabled;
    }

    if (typeof data.baselineEnabled === 'boolean') {
      this.state.baselineEnabled = data.baselineEnabled;
    }

    if (typeof data.lastSelectedTaskId === 'string' || data.lastSelectedTaskId === null) {
      this.state.lastSelectedTaskId = data.lastSelectedTaskId;
    }
  }

  /**
   * Emit state change event
   */
  private emitChange(event: StateChangeEvent): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[StateManager] Callback error:', error);
      }
    }
  }
}

export default StateManager;
