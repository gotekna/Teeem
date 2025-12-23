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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const ganttRef = React.useRef<GanttCanvas | null>(null);

  // Determine if we're using static mode
  const isStaticMode = Boolean(staticTasks);

  // State
  const [loading, setLoading] = React.useState(!isStaticMode);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<SmTemplateRow[]>([]);

  // Column visibility state - controls what shows in task sidebar/tooltips
  const [visibleColumns, setVisibleColumns] = React.useState<Record<string, boolean>>({
    name: true,
    startDate: true,
    endDate: true,
    duration: true,
    progress: true,
    status: true,
    supplier: true,
    confirm: false,
    supplierConfirm: false,
    dependencies: true,
  });

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
    let tasks: GanttTask[];
    let dependencies: Array<{ id: string; fromId: string; toId: string; type: "FS" | "SS" | "FF" | "SF"; lag?: number }>;

    if (isStaticMode && staticTasks) {
      // Static mode - use provided data directly
      tasks = staticTasks;
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
      tasks = convertRowsToTasks(rows, projectStartDate);
      dependencies = convertToDependencies(rows);
    }

    // Create canvas instance
    const gantt = new GanttCanvas(containerRef.current, {
      darkMode: isDarkMode,
    });

    // Set data
    gantt.setTasks(tasks);
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
      const cols = Object.entries(visibleColumns)
        .filter(([, visible]) => visible)
        .map(([col]) => col);
      ganttRef.current.setVisibleColumns(cols);

      // Update tooltip config to match
      ganttRef.current.setTooltipConfig({
        showDates: visibleColumns.startDate || visibleColumns.endDate,
        showDuration: visibleColumns.duration,
        showProgress: visibleColumns.progress,
        showDependencies: visibleColumns.dependencies,
        showStatus: visibleColumns.status,
      });
    }
  }, [visibleColumns]);

  // Load data on mount
  React.useEffect(() => {
    loadData();
  }, [loadData]);

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

          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Column Visibility">
                <Eye className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={visibleColumns.name}
                onCheckedChange={(checked) =>
                  setVisibleColumns((prev) => ({ ...prev, name: checked }))
                }
              >
                Name
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.startDate}
                onCheckedChange={(checked) =>
                  setVisibleColumns((prev) => ({ ...prev, startDate: checked }))
                }
              >
                Start Date
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.endDate}
                onCheckedChange={(checked) =>
                  setVisibleColumns((prev) => ({ ...prev, endDate: checked }))
                }
              >
                End Date
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.duration}
                onCheckedChange={(checked) =>
                  setVisibleColumns((prev) => ({ ...prev, duration: checked }))
                }
              >
                Duration
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.progress}
                onCheckedChange={(checked) =>
                  setVisibleColumns((prev) => ({ ...prev, progress: checked }))
                }
              >
                Progress
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.status}
                onCheckedChange={(checked) =>
                  setVisibleColumns((prev) => ({ ...prev, status: checked }))
                }
              >
                Status
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={visibleColumns.supplier}
                onCheckedChange={(checked) =>
                  setVisibleColumns((prev) => ({ ...prev, supplier: checked }))
                }
              >
                Supplier
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.confirm}
                onCheckedChange={(checked) =>
                  setVisibleColumns((prev) => ({ ...prev, confirm: checked }))
                }
              >
                Confirm
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.supplierConfirm}
                onCheckedChange={(checked) =>
                  setVisibleColumns((prev) => ({ ...prev, supplierConfirm: checked }))
                }
              >
                Supplier Confirm
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={visibleColumns.dependencies}
                onCheckedChange={(checked) =>
                  setVisibleColumns((prev) => ({ ...prev, dependencies: checked }))
                }
              >
                Dependencies
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1" />

          <span className="text-sm text-muted-foreground">
            {taskCount} tasks
          </span>
        </div>
      )}

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 bg-background"
        style={{ position: "relative" }}
      />
    </div>
  );
}

export default GanttCanvasView;
