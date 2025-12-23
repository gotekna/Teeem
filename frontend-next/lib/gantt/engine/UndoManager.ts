/**
 * UndoManager - Command Pattern for Undo/Redo
 *
 * Implements a 10-step undo history with redo support.
 * Uses the Command pattern where each action is encapsulated.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Command interface - all undoable actions implement this
 */
export interface Command {
  /** Unique identifier for deduplication */
  id: string;
  /** Execute the action */
  execute: () => void;
  /** Reverse the action */
  undo: () => void;
  /** Description for debugging/display */
  description: string;
  /** Timestamp when command was created */
  timestamp: number;
}

/**
 * Listener for undo state changes
 */
export type UndoStateListener = (canUndo: boolean, canRedo: boolean) => void;

// ============================================================================
// UndoManager Class
// ============================================================================

export class UndoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory: number;
  private listeners: Set<UndoStateListener> = new Set();
  private isExecuting: boolean = false;

  constructor(maxHistory: number = 10) {
    this.maxHistory = maxHistory;
  }

  /**
   * Execute a command and add it to the undo stack
   */
  execute(command: Command): void {
    if (this.isExecuting) {
      console.warn('UndoManager: Cannot execute while undo/redo in progress');
      return;
    }

    this.isExecuting = true;
    try {
      command.execute();
    } finally {
      this.isExecuting = false;
    }

    // Add to undo stack
    this.undoStack.push(command);

    // Limit stack size
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    // Clear redo stack (new action invalidates redo history)
    this.redoStack = [];

    this.notifyListeners();
  }

  /**
   * Add a command without executing it (for actions already performed)
   */
  record(command: Command): void {
    // Add to undo stack
    this.undoStack.push(command);

    // Limit stack size
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    // Clear redo stack
    this.redoStack = [];

    this.notifyListeners();
  }

  /**
   * Undo the last command
   */
  undo(): Command | null {
    if (!this.canUndo()) return null;
    if (this.isExecuting) {
      console.warn('UndoManager: Cannot undo while operation in progress');
      return null;
    }

    const command = this.undoStack.pop()!;

    this.isExecuting = true;
    try {
      command.undo();
    } finally {
      this.isExecuting = false;
    }

    this.redoStack.push(command);
    this.notifyListeners();

    return command;
  }

  /**
   * Redo the last undone command
   */
  redo(): Command | null {
    if (!this.canRedo()) return null;
    if (this.isExecuting) {
      console.warn('UndoManager: Cannot redo while operation in progress');
      return null;
    }

    const command = this.redoStack.pop()!;

    this.isExecuting = true;
    try {
      command.execute();
    } finally {
      this.isExecuting = false;
    }

    this.undoStack.push(command);
    this.notifyListeners();

    return command;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get the description of the next undo action
   */
  getUndoDescription(): string | null {
    if (!this.canUndo()) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * Get the description of the next redo action
   */
  getRedoDescription(): string | null {
    if (!this.canRedo()) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: UndoStateListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.canUndo(), this.canRedo());
    // Return unsubscribe function
    return () => this.listeners.delete(listener);
  }

  /**
   * Get stack sizes for debugging
   */
  getStackSizes(): { undo: number; redo: number } {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length,
    };
  }

  /**
   * Get history for debugging
   */
  getHistory(): { undo: string[]; redo: string[] } {
    return {
      undo: this.undoStack.map(c => c.description),
      redo: this.redoStack.map(c => c.description),
    };
  }

  private notifyListeners(): void {
    const canUndo = this.canUndo();
    const canRedo = this.canRedo();
    this.listeners.forEach(listener => listener(canUndo, canRedo));
  }
}

// ============================================================================
// Command Factory Functions
// ============================================================================

/**
 * Create a task move command
 */
export function createMoveTaskCommand(
  taskId: string,
  oldStartDate: Date,
  newStartDate: Date,
  applyMove: (taskId: string, date: Date) => void
): Command {
  return {
    id: `move-${taskId}-${Date.now()}`,
    description: `Move task to ${newStartDate.toLocaleDateString()}`,
    timestamp: Date.now(),
    execute: () => applyMove(taskId, newStartDate),
    undo: () => applyMove(taskId, oldStartDate),
  };
}

/**
 * Create a task resize command
 */
export function createResizeTaskCommand(
  taskId: string,
  oldStart: Date,
  oldEnd: Date,
  newStart: Date,
  newEnd: Date,
  applyResize: (taskId: string, start: Date, end: Date) => void
): Command {
  const daysDiff = Math.round((newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60 * 24));
  return {
    id: `resize-${taskId}-${Date.now()}`,
    description: `Resize task to ${daysDiff} days`,
    timestamp: Date.now(),
    execute: () => applyResize(taskId, newStart, newEnd),
    undo: () => applyResize(taskId, oldStart, oldEnd),
  };
}

/**
 * Create a dependency creation command
 */
export function createAddDependencyCommand(
  fromTaskId: string,
  toTaskId: string,
  type: 'FS' | 'SS' | 'FF' | 'SF',
  addDep: (from: string, to: string, type: 'FS' | 'SS' | 'FF' | 'SF') => void,
  removeDep: (from: string, to: string) => void
): Command {
  return {
    id: `add-dep-${fromTaskId}-${toTaskId}-${Date.now()}`,
    description: `Add ${type} dependency`,
    timestamp: Date.now(),
    execute: () => addDep(fromTaskId, toTaskId, type),
    undo: () => removeDep(fromTaskId, toTaskId),
  };
}

/**
 * Create a dependency removal command
 */
export function createRemoveDependencyCommand(
  fromTaskId: string,
  toTaskId: string,
  type: 'FS' | 'SS' | 'FF' | 'SF',
  addDep: (from: string, to: string, type: 'FS' | 'SS' | 'FF' | 'SF') => void,
  removeDep: (from: string, to: string) => void
): Command {
  return {
    id: `remove-dep-${fromTaskId}-${toTaskId}-${Date.now()}`,
    description: `Remove ${type} dependency`,
    timestamp: Date.now(),
    execute: () => removeDep(fromTaskId, toTaskId),
    undo: () => addDep(fromTaskId, toTaskId, type),
  };
}

/**
 * Create a task delete command
 */
export function createDeleteTaskCommand(
  task: { id: string; name: string; startDate: Date; endDate: Date },
  deleteTask: (taskId: string) => void,
  restoreTask: (task: { id: string; name: string; startDate: Date; endDate: Date }) => void
): Command {
  return {
    id: `delete-${task.id}-${Date.now()}`,
    description: `Delete "${task.name}"`,
    timestamp: Date.now(),
    execute: () => deleteTask(task.id),
    undo: () => restoreTask(task),
  };
}

export default UndoManager;
