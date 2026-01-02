/**
 * Gantt V2 - Unified Canvas Architecture
 *
 * A clean rewrite of the Gantt chart using the "DOM Overlay on Canvas" pattern.
 * Single canvas draws everything, React overlays for interactive elements only.
 *
 * This is the public API for the gantt-v2 component.
 */

// Main component
export { GanttUnified, type GanttUnifiedProps } from './GanttUnified';

// Toolbar
export { GanttToolbar } from './GanttToolbar';

// Overlay components
export { GanttOverlay, InputOverlay, DependencyPopup } from './GanttOverlay';

// Context menu
export { GanttContextMenu, type ContextMenuState, type GanttContextMenuProps } from './GanttContextMenu';

// Canvas engine
export {
  UnifiedGanttCanvas,
  type UnifiedGanttCallbacks,
  type ViewportState,
  type OverlayPosition,
  type TableColumn,
  type UnifiedGanttConfig,
} from './UnifiedGanttCanvas';
