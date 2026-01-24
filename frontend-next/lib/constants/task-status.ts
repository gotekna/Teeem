/**
 * Task Status Constants
 *
 * SSoT: backend/app/models/sm_task.rb
 *
 * DO NOT modify these values without updating the backend enum.
 * Verify with: rails runner "puts SmTask.statuses.keys"
 *
 * Usage:
 *   import { TASK_STATUS, TaskStatus } from '@/lib/constants/task-status';
 *   if (task.status === TASK_STATUS.STARTED) { ... }
 */

// =============================================================================
// Core Status Values (match backend exactly)
// =============================================================================

export const TASK_STATUS = {
  NOT_STARTED: 'not_started',
  STARTED: 'started',
  WAITING_FOR_RESPONSE: 'waiting_for_response',
  WAITING_FOR_INFO: 'waiting_for_info',
  COMPLETED: 'completed',
  // Extended statuses for Gantt visualization (not in backend enum)
  // These are visual states derived from task properties
  ON_HOLD: 'on_hold',
  AT_RISK: 'at_risk',
} as const;

// Type derived from the constant (single source of truth)
export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

// Core statuses that exist in backend (for API validation)
export const CORE_TASK_STATUSES = [
  TASK_STATUS.NOT_STARTED,
  TASK_STATUS.STARTED,
  TASK_STATUS.WAITING_FOR_RESPONSE,
  TASK_STATUS.WAITING_FOR_INFO,
  TASK_STATUS.COMPLETED,
] as const;

export type CoreTaskStatus = (typeof CORE_TASK_STATUSES)[number];

// All valid values as array (for validation, dropdowns, etc.)
export const TASK_STATUS_VALUES: TaskStatus[] = Object.values(TASK_STATUS);

// =============================================================================
// Display Labels (UI can differ from backend values)
// =============================================================================

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TASK_STATUS.NOT_STARTED]: 'Not Started',
  [TASK_STATUS.STARTED]: 'In Progress',
  [TASK_STATUS.WAITING_FOR_RESPONSE]: 'Waiting for Response',
  [TASK_STATUS.WAITING_FOR_INFO]: 'Waiting for More Info',
  [TASK_STATUS.COMPLETED]: 'Completed',
  [TASK_STATUS.ON_HOLD]: 'On Hold',
  [TASK_STATUS.AT_RISK]: 'At Risk',
};

// Short labels for compact UI
export const TASK_STATUS_SHORT_LABELS: Record<TaskStatus, string> = {
  [TASK_STATUS.NOT_STARTED]: 'To Do',
  [TASK_STATUS.STARTED]: 'Active',
  [TASK_STATUS.WAITING_FOR_RESPONSE]: 'Waiting',
  [TASK_STATUS.WAITING_FOR_INFO]: 'Need Info',
  [TASK_STATUS.COMPLETED]: 'Completed',
  [TASK_STATUS.ON_HOLD]: 'Hold',
  [TASK_STATUS.AT_RISK]: 'Risk',
};

// =============================================================================
// Colors (for badges, status indicators, Gantt bars, etc.)
// =============================================================================

export const TASK_STATUS_COLORS: Record<
  TaskStatus,
  { bg: string; text: string; border: string; hex: string }
> = {
  [TASK_STATUS.NOT_STARTED]: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-300 dark:border-gray-600',
    hex: '#9ca3af', // gray-400
  },
  [TASK_STATUS.STARTED]: {
    bg: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-600',
    hex: '#3b82f6', // blue-500
  },
  [TASK_STATUS.WAITING_FOR_RESPONSE]: {
    bg: 'bg-purple-100 dark:bg-purple-900',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-300 dark:border-purple-600',
    hex: '#a855f7', // purple-500
  },
  [TASK_STATUS.WAITING_FOR_INFO]: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-600',
    hex: '#f59e0b', // amber-500
  },
  [TASK_STATUS.COMPLETED]: {
    bg: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-300 dark:border-green-600',
    hex: '#22c55e', // green-500
  },
  [TASK_STATUS.ON_HOLD]: {
    bg: 'bg-orange-100 dark:bg-orange-900',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-600',
    hex: '#f97316', // orange-500
  },
  [TASK_STATUS.AT_RISK]: {
    bg: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-300 dark:border-red-600',
    hex: '#ef4444', // red-500
  },
};

// =============================================================================
// Progress Percentage by Status
// =============================================================================

export const TASK_STATUS_PROGRESS: Record<TaskStatus, number> = {
  [TASK_STATUS.NOT_STARTED]: 0,
  [TASK_STATUS.STARTED]: 50,
  [TASK_STATUS.WAITING_FOR_RESPONSE]: 75,
  [TASK_STATUS.WAITING_FOR_INFO]: 75,
  [TASK_STATUS.COMPLETED]: 100,
  [TASK_STATUS.ON_HOLD]: 0, // On hold tasks retain their progress but display as 0
  [TASK_STATUS.AT_RISK]: 50, // At risk is typically an in-progress state
};

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Type guard to validate if a value is a valid TaskStatus
 */
export function isValidTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === 'string' &&
    TASK_STATUS_VALUES.includes(value as TaskStatus)
  );
}

/**
 * Get display label for a status value
 */
export function getStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status] ?? status;
}

/**
 * Get short label for a status value
 */
export function getStatusShortLabel(status: TaskStatus): string {
  return TASK_STATUS_SHORT_LABELS[status] ?? status;
}

/**
 * Get color classes for a status value
 */
export function getStatusColors(status: TaskStatus) {
  return TASK_STATUS_COLORS[status] ?? TASK_STATUS_COLORS[TASK_STATUS.NOT_STARTED];
}

/**
 * Get progress percentage for a status value
 */
export function getStatusProgress(status: TaskStatus): number {
  return TASK_STATUS_PROGRESS[status] ?? 0;
}

// =============================================================================
// Status Transition Helpers
// =============================================================================

/**
 * Check if a task can be started (must be not_started)
 */
export function canStart(status: TaskStatus): boolean {
  return status === TASK_STATUS.NOT_STARTED;
}

/**
 * Check if a task can be completed (must be not completed)
 */
export function canComplete(status: TaskStatus): boolean {
  return status === TASK_STATUS.NOT_STARTED ||
         status === TASK_STATUS.STARTED ||
         status === TASK_STATUS.WAITING_FOR_RESPONSE ||
         status === TASK_STATUS.WAITING_FOR_INFO;
}

/**
 * Check if a task is active (not completed)
 */
export function isActive(status: TaskStatus): boolean {
  return status !== TASK_STATUS.COMPLETED;
}
