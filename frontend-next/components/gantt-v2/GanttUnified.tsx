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
import { useTheme } from 'next-themes';
import { GanttTask, GanttDependency, GanttConfig } from '@/lib/gantt/types';
import { UnifiedGanttCanvas, TableColumn } from './UnifiedGanttCanvas';
import { GanttOverlay, DependencyPopup } from './GanttOverlay';
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
  onResetManualPosition?: (task: GanttTask) => void;
  onUndo?: (selectedTaskId: string) => void;
  onEditDependencies?: (task: GanttTask) => void;

  // View options
  viewSlug?: string;
  onViewClear?: () => void;

  // Photo panel (job-specific)
  showPhotoPanel?: boolean;
  onTogglePhotoPanel?: () => void;
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
  onResetManualPosition,
  onUndo,
  onEditDependencies,
  viewSlug,
  onViewClear,
  showPhotoPanel,
  onTogglePhotoPanel,
}: GanttUnifiedProps) {
  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------

  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const ganttEngineRef = React.useRef<UnifiedGanttCanvas | null>(null);

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------

  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

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

  // Dependency popup state (for type selection when creating dependencies)
  const [dependencyPopup, setDependencyPopup] = React.useState<{
    isOpen: boolean;
    x: number;
    y: number;
    fromTaskId: string;
    toTaskId: string;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    fromTaskId: '',
    toTaskId: '',
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
        darkMode: isDarkMode,
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
        onDependencyPopupShow: (fromTaskId, toTaskId, x, y) => {
          console.log('[GanttUnified] Dependency popup show:', fromTaskId, '->', toTaskId, 'at', x, y);
          setDependencyPopup({
            isOpen: true,
            x,
            y,
            fromTaskId,
            toTaskId,
          });
        },
        onDependencyPopupHide: () => {
          console.log('[GanttUnified] Dependency popup hide');
          setDependencyPopup((prev) => ({ ...prev, isOpen: false }));
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
  }, [jobId, isDarkMode, onTaskClick, onTaskDoubleClick]); // Include callbacks and theme to prevent stale closures

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
  // Holiday Loading
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    if (!ganttEngineRef.current) return;

    const loadHolidays = async () => {
      const currentYear = new Date().getFullYear();

      try {
        // Try to load from API first
        const response = await fetch(
          `/api/v1/public_holidays/dates?year_start=${currentYear}&year_end=${currentYear + 2}&region=QLD`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.dates && Array.isArray(data.dates)) {
            const holidays = data.dates.map((dateStr: string) => ({
              date: new Date(dateStr),
              name: 'Public Holiday',
            }));
            console.log('[GanttUnified] Loaded holidays from API:', holidays.length);
            ganttEngineRef.current?.addHolidays(holidays);
            return;
          }
        }
      } catch (err) {
        console.warn('[GanttUnified] Failed to load holidays from API, using fallback:', err);
      }

      // Fallback: Australian QLD public holidays
      const getAustralianHolidays = (year: number) => {
        const holidays = [
          { date: new Date(year, 0, 1), name: "New Year's Day" },
          { date: new Date(year, 0, 26), name: 'Australia Day' },
          { date: new Date(year, 3, 25), name: 'ANZAC Day' },
          { date: new Date(year, 11, 25), name: 'Christmas Day' },
          { date: new Date(year, 11, 26), name: 'Boxing Day' },
        ];
        // Easter dates vary - add approximate ones
        if (year === 2025) {
          holidays.push({ date: new Date(2025, 3, 18), name: 'Good Friday' });
          holidays.push({ date: new Date(2025, 3, 19), name: 'Easter Saturday' });
          holidays.push({ date: new Date(2025, 3, 21), name: 'Easter Monday' });
        } else if (year === 2026) {
          holidays.push({ date: new Date(2026, 3, 3), name: 'Good Friday' });
          holidays.push({ date: new Date(2026, 3, 4), name: 'Easter Saturday' });
          holidays.push({ date: new Date(2026, 3, 6), name: 'Easter Monday' });
        }
        return holidays;
      };

      const fallbackHolidays = [
        ...getAustralianHolidays(currentYear),
        ...getAustralianHolidays(currentYear + 1),
        ...getAustralianHolidays(currentYear + 2),
      ];
      console.log('[GanttUnified] Using fallback holidays:', fallbackHolidays.length);
      ganttEngineRef.current?.addHolidays(fallbackHolidays);
    };

    loadHolidays();
  }, []);

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

  const handleContextMenuResetManualPosition = React.useCallback((task: GanttTask) => {
    console.log('[GanttUnified] Reset manual position:', task.id);
    onResetManualPosition?.(task);
  }, [onResetManualPosition]);

  const handleContextMenuEditDependencies = React.useCallback((task: GanttTask) => {
    console.log('[GanttUnified] Edit dependencies:', task.id);
    onEditDependencies?.(task);
  }, [onEditDependencies]);

  // Column visibility handler
  const handleColumnVisibilityChange = React.useCallback(
    (columnId: string, visible: boolean) => {
      ganttEngineRef.current?.setColumnVisibility(columnId, visible);
    },
    []
  );

  // Column reorder handler
  const handleColumnReorder = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      console.log('[GanttUnified] Column reorder:', fromIndex, '->', toIndex);
      ganttEngineRef.current?.reorderColumns(fromIndex, toIndex);
    },
    []
  );

  // Dependency popup handlers
  const handleDependencyPopupSelectType = React.useCallback(
    (type: 'FS' | 'SS' | 'FF' | 'SF') => {
      console.log('[GanttUnified] Dependency type selected:', type);
      ganttEngineRef.current?.completeDependencyCreation(type);
      setDependencyPopup((prev) => ({ ...prev, isOpen: false }));
    },
    []
  );

  const handleDependencyPopupCancel = React.useCallback(() => {
    console.log('[GanttUnified] Dependency creation cancelled');
    ganttEngineRef.current?.cancelDependencyCreation();
    setDependencyPopup((prev) => ({ ...prev, isOpen: false }));
  }, []);

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
  // Keyboard Handlers (Undo/Redo)
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();

        // Get selected task from selection state
        if (selectedTaskIds.size === 0) return;

        // Undo the first selected task
        const firstSelectedId = Array.from(selectedTaskIds)[0];
        if (firstSelectedId && onUndo) {
          console.log('[GanttUnified] Undo requested for task:', firstSelectedId);
          onUndo(firstSelectedId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskIds, onUndo]);

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
          zoomLevel={viewport.zoom * 100} // Convert from decimal to percentage
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
          onColumnReorder={handleColumnReorder}
          onExportPNG={handleExportPNG}
          onRefresh={onDataChange}
          jobId={jobId}
          showPhotoPanel={showPhotoPanel}
          onTogglePhotoPanel={onTogglePhotoPanel}
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
        onResetManualPosition={handleContextMenuResetManualPosition}
        onEditDependencies={handleContextMenuEditDependencies}
      />

      {/* Dependency Type Popup (shown when dragging to create dependency) */}
      {dependencyPopup.isOpen && (
        <DependencyPopup
          x={dependencyPopup.x}
          y={dependencyPopup.y}
          fromTaskId={dependencyPopup.fromTaskId}
          onSelectType={handleDependencyPopupSelectType}
          onCancel={handleDependencyPopupCancel}
        />
      )}
    </div>
  );
}

export default GanttUnified;
