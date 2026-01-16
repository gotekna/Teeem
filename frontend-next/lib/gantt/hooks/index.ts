/**
 * Gantt Hooks - SSoT Exports
 */

export { useGanttDataManager } from './useGanttDataManager';
export { getGanttApiConfig, wrapPayload, type GanttMode, type GanttApiConfig } from './ganttApi';

// Offline support
export { useGanttWithOffline, type UseGanttWithOfflineConfig, type UseGanttWithOfflineResult } from './useGanttWithOffline';

// Re-export types from useGanttDataManager
export type {
  GanttDataManagerConfig,
  EditRowForm,
  CascadeDialogState,
  ConfirmDialogState,
  DependencyEditorState,
  StartTaskDialogState,
  UndoState,
} from './useGanttDataManager';
