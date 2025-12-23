"use client";

/**
 * GanttCanvasView - React Wrapper for Canvas Gantt Engine
 *
 * High-performance canvas-based Gantt chart component.
 * Connects to the sm_template_rows API and renders tasks using the Canvas engine.
 *
 * Part of the 3-Year Schedule Master Masterpiece Plan.
 */

import * as React from "react";
import { useTheme } from "next-themes";
import { GanttCanvas } from "@/lib/gantt/engine/GanttCanvas";
import {
  convertRowsToTasks,
  convertToDependencies,
  type SmTemplateRow,
  type GanttTask,
  type TaskClickEvent,
  type TaskDragEvent,
} from "@/lib/gantt/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  Calendar,
  Maximize2,
  RefreshCw,
  Eye,
  PanelLeftClose,
  PanelLeft,
  Check,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableList, SortableItem } from "@/components/ui/dnd";
import { Checkbox } from "@/components/ui/checkbox";

// ============================================================================
// Types
// ============================================================================

interface GanttCanvasViewProps {
  /** Template ID - loads data from API */
  templateId?: number;
  /** Static tasks - bypasses API, used for demos */
  staticTasks?: GanttTask[];
  /** Static dependencies - used with staticTasks */
  staticDependencies?: Array<{ fromId: string; toId: string; type?: string }>;
  /** Show toolbar */
  showToolbar?: boolean;
  className?: string;
  onTaskClick?: (task: GanttTask) => void;
  onTaskDoubleClick?: (task: GanttTask) => void;
  onTaskDrag?: (task: GanttTask, newStartDate: Date) => void;
}

interface ApiResponse {
  success: boolean;
  rows: SmTemplateRow[];
}

/** Column configuration for sidebar table */
interface ColumnConfig {
  id: string;
  label: string;
  shortLabel?: string;
  width: number;
  visible: boolean;
  align?: 'left' | 'center' | 'right';
}

/** Default column configuration */
const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Name', width: 140, visible: true, align: 'left' },
  { id: 'startDate', label: 'Start Date', shortLabel: 'Start', width: 80, visible: true, align: 'left' },
  { id: 'endDate', label: 'End Date', shortLabel: 'End', width: 80, visible: true, align: 'left' },
  { id: 'duration', label: 'Duration', shortLabel: 'Days', width: 50, visible: true, align: 'center' },
  { id: 'progress', label: 'Progress', shortLabel: '%', width: 50, visible: true, align: 'center' },
  { id: 'status', label: 'Status', width: 80, visible: true, align: 'left' },
  { id: 'supplier', label: 'Supplier', width: 100, visible: true, align: 'left' },
  { id: 'confirm', label: 'Confirm', shortLabel: '✓', width: 40, visible: false, align: 'center' },
  { id: 'supplierConfirm', label: 'Supplier Confirm', shortLabel: 'S✓', width: 40, visible: false, align: 'center' },
  { id: 'dependencies', label: 'Dependencies', width: 80, visible: true, align: 'left' },
];

// ============================================================================
// Component
// ============================================================================

export function GanttCanvasView({
  templateId,
  staticTasks,
  staticDependencies,
  showToolbar = true,
  className,
  onTaskClick,
  onTaskDoubleClick,
  onTaskDrag,
}: GanttCanvasViewProps) {
  // Refs
  const containerRef = React.useRef<HTMLDivElement>(null);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const ganttRef = React.useRef<GanttCanvas | null>(null);

  // Determine if we're using static mode
  const isStaticMode = Boolean(staticTasks);

  // State
  const [loading, setLoading] = React.useState(!isStaticMode);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<SmTemplateRow[]>([]);
  const [showSidebar, setShowSidebar] = React.useState(true);
  const [tasks, setTasks] = React.useState<GanttTask[]>([]);

  // Column configuration state - controls order and visibility
  const [columns, setColumns] = React.useState<ColumnConfig[]>(DEFAULT_COLUMNS);

  // Helper to get visible status by column id (for backwards compatibility)
  const isColumnVisible = React.useCallback((columnId: string) => {
    return columns.find(c => c.id === columnId)?.visible ?? false;
  }, [columns]);

  // Toggle column visibility
  const toggleColumnVisibility = React.useCallback((columnId: string) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  }, []);

  // Handle column reorder
  const handleColumnReorder = React.useCallback((newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
  }, []);

  // Theme
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  // Load data from API (only when not using static mode)
  const loadData = React.useCallback(async () => {
    if (isStaticMode || !templateId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.get<ApiResponse>(
        `/api/v1/sm_templates/${templateId}/rows`
      );

      if (response.success && response.rows) {
        setRows(response.rows);
      } else {
        setError("Failed to load template rows");
      }
    } catch (err) {
      console.error("Error loading Gantt data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [templateId, isStaticMode]);

  // Initialize canvas engine
  React.useEffect(() => {
    if (!containerRef.current || loading || error) return;

    // Get tasks and dependencies based on mode
    let taskList: GanttTask[];
    let dependencies: Array<{ id: string; fromId: string; toId: string; type: "FS" | "SS" | "FF" | "SF"; lag?: number }>;

    if (isStaticMode && staticTasks) {
      // Static mode - use provided data directly
      taskList = staticTasks;
      dependencies = (staticDependencies || []).map((d, i) => ({
        id: `dep-${i}`,
        fromId: d.fromId,
        toId: d.toId,
        type: (d.type || "FS") as "FS" | "SS" | "FF" | "SF",
        lag: 0,
      }));
    } else {
      // API mode - convert rows to tasks
      const projectStartDate = new Date();
      projectStartDate.setDate(projectStartDate.getDate() - 7);
      taskList = convertRowsToTasks(rows, projectStartDate);
      dependencies = convertToDependencies(rows);
    }

    // Store tasks for sidebar
    setTasks(taskList);

    // Create canvas instance
    const gantt = new GanttCanvas(containerRef.current, {
      darkMode: isDarkMode,
    });

    // Set data
    gantt.setTasks(taskList);
    gantt.setDependencies(dependencies);

    // Set event handlers
    if (onTaskClick) {
      gantt.onTaskClickHandler(onTaskClick);
    }
    if (onTaskDoubleClick) {
      gantt.onTaskDoubleClickHandler(onTaskDoubleClick);
    }
    if (onTaskDrag) {
      gantt.onTaskDragHandler(onTaskDrag);
    }

    // Register scroll sync callback
    gantt.onScrollHandler((scrollX, scrollY) => {
      if (sidebarRef.current) {
        sidebarRef.current.scrollTop = scrollY;
      }
    });

    // Scroll to today
    gantt.scrollToToday();

    // Store reference
    ganttRef.current = gantt;

    // Cleanup
    return () => {
      gantt.destroy();
      ganttRef.current = null;
    };
  }, [rows, staticTasks, staticDependencies, isStaticMode, loading, error, isDarkMode, onTaskClick, onTaskDoubleClick, onTaskDrag]);

  // Update dark mode when theme changes
  React.useEffect(() => {
    if (ganttRef.current) {
      ganttRef.current.setDarkMode(isDarkMode);
    }
  }, [isDarkMode]);

  // Update column visibility and tooltip config when columns change
  React.useEffect(() => {
    if (ganttRef.current) {
      // Update visible columns in engine
      const cols = columns.filter(c => c.visible).map(c => c.id);
      ganttRef.current.setVisibleColumns(cols);

      // Update tooltip config to match
      ganttRef.current.setTooltipConfig({
        showDates: isColumnVisible('startDate') || isColumnVisible('endDate'),
        showDuration: isColumnVisible('duration'),
        showProgress: isColumnVisible('progress'),
        showDependencies: isColumnVisible('dependencies'),
        showStatus: isColumnVisible('status'),
      });
    }
  }, [columns, isColumnVisible]);

  // Load data on mount
  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync sidebar scroll with canvas scroll
  React.useEffect(() => {
    if (!containerRef.current || !sidebarRef.current || !ganttRef.current) return;

    let animationFrameId: number;
    let lastScrollY = 0;

    const syncScroll = () => {
      if (ganttRef.current && sidebarRef.current) {
        // Get scroll position from canvas engine using public API
        const { scrollY } = ganttRef.current.getScrollPosition();

        // Only update if changed
        if (scrollY !== lastScrollY) {
          lastScrollY = scrollY;
          sidebarRef.current.scrollTop = scrollY;
        }
      }
      animationFrameId = requestAnimationFrame(syncScroll);
    };

    animationFrameId = requestAnimationFrame(syncScroll);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [tasks, showSidebar]);

  // Toolbar handlers
  const handleZoomIn = () => {
    if (ganttRef.current) {
      const viewport = (ganttRef.current as unknown as { viewport: { setZoom: (z: number) => void; getState: () => { zoom: number } } }).viewport;
      const currentZoom = viewport.getState().zoom;
      viewport.setZoom(Math.min(3, currentZoom * 1.2));
      (ganttRef.current as unknown as { markDirty: () => void }).markDirty?.();
    }
  };

  const handleZoomOut = () => {
    if (ganttRef.current) {
      const viewport = (ganttRef.current as unknown as { viewport: { setZoom: (z: number) => void; getState: () => { zoom: number } } }).viewport;
      const currentZoom = viewport.getState().zoom;
      viewport.setZoom(Math.max(0.1, currentZoom * 0.8));
      (ganttRef.current as unknown as { markDirty: () => void }).markDirty?.();
    }
  };

  const handleScrollToToday = () => {
    ganttRef.current?.scrollToToday();
  };

  const handleZoomToFit = () => {
    ganttRef.current?.zoomToFit();
  };

  const handleRefresh = () => {
    loadData();
  };

  // Render loading state
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center h-full min-h-[400px]", className)}>
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-sm text-muted-foreground">Loading Gantt chart...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={cn("flex items-center justify-center h-full min-h-[400px]", className)}>
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Render empty state (only for API mode)
  const taskCount = isStaticMode ? (staticTasks?.length || 0) : rows.length;
  if (!isStaticMode && rows.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full min-h-[400px]", className)}>
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">No tasks in this template</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center gap-2 p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-px h-6 bg-border" />

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleScrollToToday} title="Go to Today">
              <Calendar className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleZoomToFit} title="Zoom to Fit">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-px h-6 bg-border" />

          {!isStaticMode && (
            <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}

          {/* Sidebar Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSidebar(!showSidebar)}
            title={showSidebar ? "Hide Sidebar" : "Show Sidebar"}
          >
            {showSidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>

          {/* Column Visibility & Order */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Column Visibility & Order">
                <Eye className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-1 py-1">
                <SortableList
                  items={columns}
                  onReorder={handleColumnReorder}
                  className="space-y-0.5"
                >
                  {columns.map((col, index) => (
                    <SortableItem
                      key={col.id}
                      id={col.id}
                      variant="simple"
                      showBadge={false}
                      className="py-1"
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`col-${col.id}`}
                          checked={col.visible}
                          onCheckedChange={() => toggleColumnVisibility(col.id)}
                        />
                        <label
                          htmlFor={`col-${col.id}`}
                          className="text-sm cursor-pointer select-none flex-1"
                        >
                          {col.label}
                        </label>
                      </div>
                    </SortableItem>
                  ))}
                </SortableList>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1" />

          <span className="text-sm text-muted-foreground">
            {taskCount} tasks
          </span>
        </div>
      )}

      {/* Main Content - Sidebar + Canvas */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar Table */}
        {showSidebar && (
          <div className="flex flex-col border-r bg-background" style={{ width: 'auto', minWidth: 200, maxWidth: 600 }}>
            {/* Sidebar Header */}
            <div
              className="flex items-center border-b bg-muted/50 px-2 text-xs font-medium text-muted-foreground"
              style={{ height: 60, minHeight: 60 }}
            >
              {columns.filter(c => c.visible).map(col => (
                <div
                  key={col.id}
                  className={cn(
                    "truncate px-1",
                    col.align === 'center' && "text-center",
                    col.align === 'right' && "text-right"
                  )}
                  style={{ width: col.width }}
                >
                  {col.shortLabel || col.label}
                </div>
              ))}
            </div>

            {/* Sidebar Rows */}
            <div
              ref={sidebarRef}
              className="flex-1 overflow-hidden"
              style={{ overflowY: 'hidden' }}
            >
              <div style={{ height: tasks.length * 40 }}>
                {tasks.map((task, index) => {
                  const row = rows.find(r => String(r.id) === task.id);
                  const startStr = task.startDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
                  const endStr = task.endDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
                  const duration = Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24));

                  // Render cell content based on column id
                  const renderCell = (col: ColumnConfig) => {
                    switch (col.id) {
                      case 'name':
                        return (
                          <div className="truncate px-2 font-medium" title={task.name}>
                            {task.name}
                          </div>
                        );
                      case 'startDate':
                        return <div className="truncate px-1 text-muted-foreground">{startStr}</div>;
                      case 'endDate':
                        return <div className="truncate px-1 text-muted-foreground">{endStr}</div>;
                      case 'duration':
                        return <div className="truncate px-1 text-muted-foreground text-center">{duration}</div>;
                      case 'progress':
                        return <div className="truncate px-1 text-muted-foreground text-center">{task.progress || 0}%</div>;
                      case 'status':
                        return <div className="truncate px-1 text-muted-foreground">{task.status || '-'}</div>;
                      case 'confirm':
                        return (
                          <div className="flex justify-center">
                            {row?.require_supervisor_check ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <X className="h-3 w-3 text-muted-foreground/30" />
                            )}
                          </div>
                        );
                      case 'supplierConfirm':
                        return (
                          <div className="flex justify-center">
                            {row?.require_supplier_confirm ? (
                              <Check className="h-3 w-3 text-blue-500" />
                            ) : (
                              <X className="h-3 w-3 text-muted-foreground/30" />
                            )}
                          </div>
                        );
                      case 'supplier':
                        return (
                          <div className="truncate px-1 text-muted-foreground" title={task.supplierName || ''}>
                            {task.supplierName || '-'}
                          </div>
                        );
                      case 'dependencies':
                        return <div className="truncate px-1 text-muted-foreground">-</div>;
                      default:
                        return null;
                    }
                  };

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center border-b text-xs hover:bg-muted/30",
                        index % 2 === 0 ? "bg-background" : "bg-muted/10"
                      )}
                      style={{ height: 40 }}
                    >
                      {columns.filter(c => c.visible).map(col => (
                        <div key={col.id} style={{ width: col.width }}>
                          {renderCell(col)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Canvas Container */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 bg-background"
          style={{ position: "relative" }}
        />
      </div>
    </div>
  );
}

export default GanttCanvasView;
