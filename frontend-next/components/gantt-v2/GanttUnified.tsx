'use client';

/**
 * GanttUnified - Unified Gantt Chart Component
 *
 * This is the new Gantt implementation using the "DOM Overlay on Canvas" pattern
 * (Google Sheets/Figma pattern). One canvas draws EVERYTHING (table + timeline),
 * with React overlays for interactive elements only.
 *
 * Key differences from old GanttCanvasView:
 * - Single canvas draws both table (left) and timeline (right)
 * - No scroll sync needed - canvas owns all scrolling
 * - React overlays positioned absolutely over interactive areas
 * - Eliminates scroll drift between table and timeline
 *
 * @see TEEEM_DOCS/GANTT_FEATURE_INVENTORY.md - 148 features to preserve
 * @see TEEEM_DOCS/GANTT_USABILITY_INVENTORY.md - 95 UX patterns to preserve
 * @see TEEEM_DOCS/GANTT_BUSINESS_RULES.md - 31 rules that must not break
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { GanttTask, GanttDependency, GanttConfig } from '@/lib/gantt/types';
import { UnifiedGanttCanvas, TableColumn } from './UnifiedGanttCanvas';
import { GanttOverlay } from './GanttOverlay';
import { GanttToolbar } from './GanttToolbar';
import { GanttContextMenu, ContextMenuState } from './GanttContextMenu';
import { Spinner } from '@/components/ui/spinner';

// =============================================================================
// Types
// =============================================================================

export interface GanttUnifiedProps {
  // Data
  tasks: GanttTask[];
  dependencies: GanttDependency[];

  // Configuration
  jobId?: number;
  templateId?: number;
  showToolbar?: boolean;
  className?: string;

  // Callbacks
  onTaskClick?: (task: GanttTask) => void;
  onTaskDoubleClick?: (task: GanttTask) => void;
  onTaskDrag?: (task: GanttTask, newStartDate: Date) => void;
  onTaskResize?: (task: GanttTask, newStartDate: Date, newEndDate: Date) => void;
  onDependencyCreate?: (fromId: string, toId: string, type: string) => void;
  onDependencyDelete?: (dependencyId: string) => void;
  onCheckboxToggle?: (taskId: string, field: string, checked: boolean) => void;
  onProgressChange?: (taskId: string, newProgress: number) => void;
  onDataChange?: () => void;

  // View options
  viewSlug?: string;
  onViewClear?: () => void;
}

interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

interface OverlayPosition {
  taskId: string;
  rowIndex: number;
  y: number;
  checkboxes: Array<{
    x: number;
    field: string;
    checked: boolean;
  }>;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Partial<GanttConfig> = {
  rowHeight: 28,
  headerHeight: 50,
  taskBarHeight: 18,
  taskBarPadding: 5,
  dayWidth: 25,
  minDayWidth: 10,
  maxDayWidth: 100,
};

// =============================================================================
// Component
// =============================================================================

export function GanttUnified({
  tasks,
  dependencies,
  jobId,
  templateId,
  showToolbar = true,
  className,
  onTaskClick,
  onTaskDoubleClick,
  onTaskDrag,
  onTaskResize,
  onDependencyCreate,
  onDependencyDelete,
  onCheckboxToggle,
  onProgressChange,
  onDataChange,
  viewSlug,
  onViewClear,
}: GanttUnifiedProps) {
  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------

  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const ganttEngineRef = React.useRef<UnifiedGanttCanvas | null>(null);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Viewport state (scroll position, zoom)
  const [viewport, setViewport] = React.useState<ViewportState>({
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
  });

  // Overlay positions (calculated by canvas, used by React overlays)
  const [overlayPositions, setOverlayPositions] = React.useState<OverlayPosition[]>([]);

  // Visible row range (for virtualization)
  const [visibleRange, setVisibleRange] = React.useState({ start: 0, end: 50 });

  // Selection state
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(new Set());

  // UI state
  const [showDependencies, setShowDependencies] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showGroupedOnly, setShowGroupedOnly] = React.useState(false);
  const [showCriticalPath, setShowCriticalPath] = React.useState(false);
  const [showBaseline, setShowBaseline] = React.useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    task: null,
  });

  // Column visibility state
  const [columns, setColumns] = React.useState<TableColumn[]>([]);

  // ---------------------------------------------------------------------------
  // Canvas Initialization
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    try {
      // Create the unified canvas engine
      const engine = new UnifiedGanttCanvas(canvasRef.current, {
        ...DEFAULT_CONFIG,
        onViewportChange: (newViewport) => {
          setViewport(newViewport);
        },
        onOverlayPositionsChange: (positions) => {
          setOverlayPositions(positions);
        },
        onVisibleRangeChange: (range) => {
          setVisibleRange(range);
        },
        onSelectionChange: (ids) => {
          setSelectedTaskIds(ids);
        },
        onTaskClick: (task) => {
          onTaskClick?.(task);
        },
        onTaskDoubleClick: (task) => {
          console.log('[GanttUnified] onTaskDoubleClick callback:', task.id, task.name);
          onTaskDoubleClick?.(task);
        },
        onColumnsChange: (newColumns) => {
          // Update local state
          setColumns([...newColumns]);
          // Save to localStorage for persistence
          if (jobId) {
            try {
              localStorage.setItem(`gantt-columns-${jobId}`, JSON.stringify(newColumns));
            } catch {
              // Ignore localStorage errors
            }
          }
        },
        onCollapsedChange: (collapsedIds) => {
          // Save to localStorage for persistence
          if (jobId) {
            try {
              localStorage.setItem(
                `gantt-collapsed-${jobId}`,
                JSON.stringify(Array.from(collapsedIds))
              );
            } catch {
              // Ignore localStorage errors
            }
          }
        },
        onDependencyClick: (task) => {
          console.log('[GanttUnified] Dependency clicked:', task.id);
          // TODO: Open dependency editor modal
        },
        onTaskDrag: (task, newStartDate) => {
          console.log('[GanttUnified] Task dragged:', task.id, 'to', newStartDate);
          onTaskDrag?.(task, newStartDate);
        },
        onTaskResize: (task, newStartDate, newEndDate) => {
          console.log('[GanttUnified] Task resized:', task.id, 'from', newStartDate, 'to', newEndDate);
          onTaskResize?.(task, newStartDate, newEndDate);
        },
        onContextMenu: (task, x, y, _event) => {
          console.log('[GanttUnified] Context menu:', task?.id, 'at', x, y);
          setContextMenu({
            isOpen: true,
            x,
            y,
            task,
          });
        },
        onDependencyCreate: (fromId, toId, type) => {
          console.log('[GanttUnified] Dependency created:', fromId, '->', toId, 'type:', type);
          onDependencyCreate?.(fromId, toId, type);
        },
        onProgressChange: (task, newProgress) => {
          console.log('[GanttUnified] Progress changed:', task.id, 'to', newProgress);
          onProgressChange?.(task.id, newProgress);
        },
      });

      ganttEngineRef.current = engine;

      // Restore saved column config
      if (jobId) {
        try {
          const savedColumns = localStorage.getItem(`gantt-columns-${jobId}`);
          if (savedColumns) {
            engine.setColumns(JSON.parse(savedColumns));
          }
        } catch {
          // Ignore localStorage errors
        }
      }

      // Initialize column state from engine
      setColumns(engine.getColumns());

      // Initial data load
      engine.setTasks(tasks);
      engine.setDependencies(dependencies);

      setIsLoading(false);
    } catch (err) {
      console.error('[GanttUnified] Failed to initialize canvas:', err);
      setError('Failed to initialize Gantt chart');
      setIsLoading(false);
    }

    // Cleanup
    return () => {
      if (ganttEngineRef.current) {
        ganttEngineRef.current.destroy();
        ganttEngineRef.current = null;
      }
    };
  }, [jobId, onTaskClick, onTaskDoubleClick]); // Include callbacks to prevent stale closures

  // ---------------------------------------------------------------------------
  // Data Updates
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    if (ganttEngineRef.current) {
      ganttEngineRef.current.setTasks(tasks);
    }
  }, [tasks]);

  React.useEffect(() => {
    if (ganttEngineRef.current) {
      ganttEngineRef.current.setDependencies(dependencies);
    }
  }, [dependencies]);

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  const handleZoomIn = React.useCallback(() => {
    ganttEngineRef.current?.zoomIn();
  }, []);

  const handleZoomOut = React.useCallback(() => {
    ganttEngineRef.current?.zoomOut();
  }, []);

  const handleZoomToFit = React.useCallback(() => {
    ganttEngineRef.current?.zoomToFit();
  }, []);

  const handleScrollToToday = React.useCallback(() => {
    ganttEngineRef.current?.scrollToToday();
  }, []);

  const handleToggleDependencies = React.useCallback(() => {
    setShowDependencies((prev) => {
      const newValue = !prev;
      ganttEngineRef.current?.setShowDependencies(newValue);
      return newValue;
    });
  }, []);

  const handleToggleFullscreen = React.useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Collapse/Expand handlers
  const handleCollapseAll = React.useCallback(() => {
    ganttEngineRef.current?.collapseAll();
  }, []);

  const handleExpandAll = React.useCallback(() => {
    ganttEngineRef.current?.expandAll();
  }, []);

  // Search handler
  const handleSearchChange = React.useCallback((query: string) => {
    setSearchQuery(query);
    ganttEngineRef.current?.setSearchQuery(query);
  }, []);

  // Grouped filter handler
  const handleToggleGroupedOnly = React.useCallback(() => {
    setShowGroupedOnly((prev) => {
      const newValue = !prev;
      ganttEngineRef.current?.setShowGroupedOnly(newValue);
      return newValue;
    });
  }, []);

  // Critical path toggle handler
  const handleToggleCriticalPath = React.useCallback(() => {
    setShowCriticalPath((prev) => {
      const newValue = !prev;
      ganttEngineRef.current?.setCriticalPathEnabled(newValue);
      return newValue;
    });
  }, []);

  // Baseline toggle handler
  const handleToggleBaseline = React.useCallback(() => {
    setShowBaseline((prev) => {
      const newValue = !prev;
      ganttEngineRef.current?.setBaselineEnabled(newValue);
      return newValue;
    });
  }, []);

  // Capture baseline handler
  const handleCaptureBaseline = React.useCallback(() => {
    if (ganttEngineRef.current) {
      ganttEngineRef.current.captureBaseline();
      setShowBaseline(true);
    }
  }, []);

  // Export PNG handler
  const handleExportPNG = React.useCallback(() => {
    if (ganttEngineRef.current) {
      const filename = jobId ? `gantt-job-${jobId}.png` : templateId ? `gantt-template-${templateId}.png` : 'gantt-chart.png';
      ganttEngineRef.current.downloadPNG(filename);
    }
  }, [jobId, templateId]);

  // Checkbox toggle handler (called from overlay)
  const handleCheckboxToggle = React.useCallback(
    (taskId: string, field: string, checked: boolean) => {
      // Update canvas immediately for visual feedback
      ganttEngineRef.current?.updateTaskField(taskId, field, checked);

      // Call parent callback
      onCheckboxToggle?.(taskId, field, checked);
    },
    [onCheckboxToggle]
  );

  // Context menu handlers
  const handleContextMenuClose = React.useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleContextMenuEdit = React.useCallback((task: GanttTask) => {
    console.log('[GanttUnified] Context menu edit:', task.id);
    onTaskDoubleClick?.(task);
  }, [onTaskDoubleClick]);

  const handleContextMenuMarkStarted = React.useCallback((task: GanttTask) => {
    const rowData = task.rowData as Record<string, unknown> | undefined;
    const newValue = !rowData?.started;
    ganttEngineRef.current?.updateTaskField(task.id, 'started', newValue);
    onCheckboxToggle?.(task.id, 'started', newValue);
  }, [onCheckboxToggle]);

  const handleContextMenuMarkOnHold = React.useCallback((task: GanttTask) => {
    const rowData = task.rowData as Record<string, unknown> | undefined;
    const newValue = !rowData?.hold;
    ganttEngineRef.current?.updateTaskField(task.id, 'hold', newValue);
    onCheckboxToggle?.(task.id, 'hold', newValue);
  }, [onCheckboxToggle]);

  const handleContextMenuMarkCompleted = React.useCallback((task: GanttTask) => {
    const rowData = task.rowData as Record<string, unknown> | undefined;
    const newValue = !rowData?.is_completed;
    ganttEngineRef.current?.updateTaskField(task.id, 'is_completed', newValue);
    onCheckboxToggle?.(task.id, 'is_completed', newValue);
  }, [onCheckboxToggle]);

  const handleContextMenuExpandChildren = React.useCallback((task: GanttTask) => {
    ganttEngineRef.current?.toggleHeaderCollapse(task.id);
  }, []);

  const handleContextMenuCollapseChildren = React.useCallback((task: GanttTask) => {
    ganttEngineRef.current?.toggleHeaderCollapse(task.id);
  }, []);

  // Column visibility handler
  const handleColumnVisibilityChange = React.useCallback(
    (columnId: string, visible: boolean) => {
      ganttEngineRef.current?.setColumnVisibility(columnId, visible);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Resize Observer
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        ganttEngineRef.current?.resize(width, height);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Always render canvas structure (so refs are available), but show overlays for loading/error states
  return (
    <div
      className={cn(
        'flex flex-col h-full overflow-hidden bg-background',
        isFullscreen && 'fixed inset-0 z-50',
        className
      )}
    >
      {/* Toolbar - hide during loading/error */}
      {showToolbar && !isLoading && !error && (
        <GanttToolbar
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomToFit={handleZoomToFit}
          onScrollToToday={handleScrollToToday}
          onToggleDependencies={handleToggleDependencies}
          onToggleFullscreen={handleToggleFullscreen}
          onCollapseAll={handleCollapseAll}
          onExpandAll={handleExpandAll}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          showGroupedOnly={showGroupedOnly}
          onToggleGroupedOnly={handleToggleGroupedOnly}
          showDependencies={showDependencies}
          isFullscreen={isFullscreen}
          taskCount={tasks.length}
          showCriticalPath={showCriticalPath}
          onToggleCriticalPath={handleToggleCriticalPath}
          showBaseline={showBaseline}
          onToggleBaseline={handleToggleBaseline}
          onCaptureBaseline={handleCaptureBaseline}
          viewSlug={viewSlug}
          onViewClear={onViewClear}
          columns={columns}
          onColumnVisibilityChange={handleColumnVisibilityChange}
          onExportPNG={handleExportPNG}
        />
      )}

      {/* Main Content: Canvas + Overlays */}
      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">
        {/* Canvas Layer - ALWAYS rendered (so refs are available for initialization) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ touchAction: 'none' }} // Prevent browser touch gestures
          onDoubleClick={(e) => {
            console.log('[GanttUnified] React onDoubleClick fired at', e.nativeEvent.offsetX, e.nativeEvent.offsetY);
          }}
        />

        {/* Overlay Layer - React components for interactive elements */}
        {!isLoading && !error && (
          <GanttOverlay
            overlayPositions={overlayPositions}
            visibleRange={visibleRange}
            viewport={viewport}
            rowHeight={DEFAULT_CONFIG.rowHeight!}
            onCheckboxToggle={handleCheckboxToggle}
          />
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-4">
              <Spinner />
              <p className="text-sm text-muted-foreground">Loading Gantt chart...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-primary underline"
              >
                Reload page
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      <GanttContextMenu
        state={contextMenu}
        onClose={handleContextMenuClose}
        onEdit={handleContextMenuEdit}
        onMarkStarted={handleContextMenuMarkStarted}
        onMarkOnHold={handleContextMenuMarkOnHold}
        onMarkCompleted={handleContextMenuMarkCompleted}
        onExpandChildren={handleContextMenuExpandChildren}
        onCollapseChildren={handleContextMenuCollapseChildren}
      />
    </div>
  );
}

export default GanttUnified;
