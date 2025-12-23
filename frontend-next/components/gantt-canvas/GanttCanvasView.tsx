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
  Minimize2,
  RefreshCw,
  Eye,
  PanelLeftClose,
  PanelLeft,
  Check,
  X,
  Expand,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableList, SortableItem } from "@/components/ui/dnd";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initCompanySettings, getTodayInCompanyTimezone } from "@/lib/stores/company-settings-store";

// ============================================================================
// Types
// ============================================================================

interface TemplateOption {
  id: number;
  name: string;
  row_count: number;
}

interface GanttCanvasViewProps {
  /** Template ID - loads data from API */
  templateId?: number;
  /** Static tasks - bypasses API, used for demos */
  staticTasks?: GanttTask[];
  /** Static dependencies - used with staticTasks */
  staticDependencies?: Array<{ fromId: string; toId: string; type?: string }>;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Templates for selector dropdown */
  templates?: TemplateOption[];
  /** Callback when template changes */
  onTemplateChange?: (templateId: number) => void;
  /** Show fullscreen button in toolbar */
  showFullscreenButton?: boolean;
  /** External fullscreen state control */
  isFullscreen?: boolean;
  /** Callback when fullscreen is toggled */
  onFullscreenChange?: (isFullscreen: boolean) => void;
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
// Sortable Column Header Component
// ============================================================================

interface SortableColumnHeaderProps {
  column: ColumnConfig;
  resizingColumn: string | null;
  onResizeStart: (e: React.MouseEvent, columnId: string, currentWidth: number) => void;
}

function SortableColumnHeader({ column, resizingColumn, onResizeStart }: SortableColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: column.width,
    minWidth: column.width,
    flexShrink: 0,
    height: '100%',
    touchAction: 'none',
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "truncate px-1 relative group select-none",
        column.align === 'center' && "text-center",
        column.align === 'right' && "text-right",
        isDragging && "z-50 bg-blue-200 dark:bg-blue-800 shadow-lg rounded opacity-80 ring-2 ring-blue-500"
      )}
    >
      {column.shortLabel || column.label}
      {/* Resize handle - stop propagation to prevent drag conflict */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize",
          "hover:bg-primary/50 active:bg-primary",
          resizingColumn === column.id && "bg-primary"
        )}
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart(e, column.id, column.width);
        }}
        onPointerDown={(e) => {
          // Stop pointer events on resize handle to prevent drag
          e.stopPropagation();
        }}
      />
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function GanttCanvasView({
  templateId,
  staticTasks,
  staticDependencies,
  showToolbar = true,
  templates,
  onTemplateChange,
  showFullscreenButton = true,
  isFullscreen: externalFullscreen,
  onFullscreenChange,
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
  const [internalFullscreen, setInternalFullscreen] = React.useState(false);

  // Fullscreen state - use external if provided, otherwise internal
  const isFullscreen = externalFullscreen !== undefined ? externalFullscreen : internalFullscreen;
  const toggleFullscreen = React.useCallback(() => {
    const newValue = !isFullscreen;
    if (onFullscreenChange) {
      onFullscreenChange(newValue);
    } else {
      setInternalFullscreen(newValue);
    }
  }, [isFullscreen, onFullscreenChange]);

  // Exit fullscreen on Escape key
  React.useEffect(() => {
    if (!isFullscreen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (onFullscreenChange) {
          onFullscreenChange(false);
        } else {
          setInternalFullscreen(false);
        }
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isFullscreen, onFullscreenChange]);

  // Column configuration state - controls order and visibility
  const [columns, setColumns] = React.useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [columnsLoaded, setColumnsLoaded] = React.useState(false);

  // Load columns from localStorage on client mount
  React.useEffect(() => {
    const saved = localStorage.getItem('gantt-column-config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setColumns(parsed);
        }
      } catch {
        // Invalid JSON, use defaults
      }
    }
    setColumnsLoaded(true);
  }, []);

  // Initialize company settings (timezone) on mount
  React.useEffect(() => {
    initCompanySettings();
  }, []);

  // Save columns to localStorage whenever they change (only after initial load)
  React.useEffect(() => {
    if (columnsLoaded) {
      localStorage.setItem('gantt-column-config', JSON.stringify(columns));
    }
  }, [columns, columnsLoaded]);

  // Dependency types
  type DependencyType = 'FS' | 'FF' | 'SS' | 'SF';
  interface PredecessorLink {
    predecessorId: string;
    type: DependencyType;
    lag: number;
  }

  // Dependency editor state
  const [depEditorOpen, setDepEditorOpen] = React.useState(false);
  const [depEditorTask, setDepEditorTask] = React.useState<GanttTask | null>(null);
  const [depEditorLinks, setDepEditorLinks] = React.useState<PredecessorLink[]>([]);

  // Task items for combobox (memoized)
  const taskComboItems = React.useMemo((): ComboboxItem[] => {
    return tasks
      .filter(t => t.id !== depEditorTask?.id)
      .map(t => {
        const rowNum = tasks.findIndex(task => task.id === t.id) + 1;
        return {
          id: t.id,
          label: `${rowNum}. ${t.name}`,
        };
      });
  }, [tasks, depEditorTask]);

  // Permanent columns that cannot be hidden
  const PERMANENT_COLUMNS = ['name'];

  // Get visible columns (always includes permanent columns, name always first)
  // When sidebar is "hidden", only show permanent columns (Name)
  const visibleColumns = React.useMemo(() => {
    const visible = columns.filter(c => c.visible || PERMANENT_COLUMNS.includes(c.id));
    // Ensure Name is always first
    const nameCol = visible.find(c => c.id === 'name');
    const others = visible.filter(c => c.id !== 'name');
    const allVisible = nameCol ? [nameCol, ...others] : others;

    // When sidebar is hidden, only show permanent columns
    if (!showSidebar) {
      return allVisible.filter(c => PERMANENT_COLUMNS.includes(c.id));
    }
    return allVisible;
  }, [columns, showSidebar]);

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

  // Handle column reorder from dropdown SortableList
  const handleColumnReorder = React.useCallback((newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
  }, []);

  // Handle column reorder via drag-and-drop in header
  // Must work with visibleColumns order since that's what user sees/drags
  const handleColumnDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Get indices from visibleColumns (what user sees)
    const oldVisibleIndex = visibleColumns.findIndex(col => col.id === active.id);
    const newVisibleIndex = visibleColumns.findIndex(col => col.id === over.id);

    if (oldVisibleIndex === -1 || newVisibleIndex === -1) {
      return;
    }

    // Create new order from visibleColumns then merge back hidden columns
    const reorderedVisible = arrayMove([...visibleColumns], oldVisibleIndex, newVisibleIndex);

    // Rebuild full columns: reordered visible + hidden columns at end
    setColumns(prev => {
      const hiddenCols = prev.filter(c => !c.visible && c.id !== 'name');
      return [...reorderedVisible, ...hiddenCols];
    });
  }, [visibleColumns]);

  // DnD sensors with delay to distinguish from resize
  const columnDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Must drag at least 8px to start
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Column resize state
  const [resizingColumn, setResizingColumn] = React.useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = React.useState(0);
  const [resizeStartWidth, setResizeStartWidth] = React.useState(0);

  // Handle column resize
  const handleResizeStart = React.useCallback((e: React.MouseEvent, columnId: string, currentWidth: number) => {
    e.preventDefault();
    setResizingColumn(columnId);
    setResizeStartX(e.clientX);
    setResizeStartWidth(currentWidth);
  }, []);

  // Mouse move handler for resize
  React.useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX;
      const newWidth = Math.max(40, resizeStartWidth + delta); // Min width 40px
      setColumns(prev => prev.map(col =>
        col.id === resizingColumn ? { ...col, width: newWidth } : col
      ));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  // Open dependency editor for a task
  const openDepEditor = React.useCallback((task: GanttTask) => {
    setDepEditorTask(task);
    // Convert predecessorIds to PredecessorLink objects (default to FS, 0 lag)
    const links: PredecessorLink[] = (task.predecessorIds || []).map(id => ({
      predecessorId: id,
      type: 'FS' as DependencyType,
      lag: 0,
    }));
    setDepEditorLinks(links);
    setDepEditorOpen(true);
  }, []);

  // Add a new predecessor link
  const addPredecessorLink = React.useCallback(() => {
    setDepEditorLinks(prev => [...prev, { predecessorId: '', type: 'FS', lag: 0 }]);
  }, []);

  // Update a predecessor link
  const updatePredecessorLink = React.useCallback((index: number, updates: Partial<PredecessorLink>) => {
    setDepEditorLinks(prev => prev.map((link, i) =>
      i === index ? { ...link, ...updates } : link
    ));
  }, []);

  // Remove a predecessor link
  const removePredecessorLink = React.useCallback((index: number) => {
    setDepEditorLinks(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Check for circular dependencies
  const hasCircularDependency = React.useCallback((taskId: string, newPredecessorIds: string[], visited: Set<string> = new Set()): boolean => {
    if (visited.has(taskId)) return true;
    visited.add(taskId);

    for (const predId of newPredecessorIds) {
      // Get the predecessor's own predecessors
      const predTask = tasks.find(t => t.id === predId);
      if (predTask) {
        const predPredecessors = predTask.predecessorIds || [];
        // Check if this predecessor (or any of its predecessors) depends on our task
        if (predPredecessors.includes(taskId)) return true;
        if (hasCircularDependency(taskId, predPredecessors, visited)) return true;
      }
    }
    return false;
  }, [tasks]);

  // Save dependencies
  const saveDependencies = React.useCallback(async () => {
    if (!depEditorTask || !templateId) return;

    // Filter out empty links
    const validLinks = depEditorLinks.filter(l => l.predecessorId);
    const predecessorIds = validLinks.map(l => l.predecessorId);

    // Check for circular dependencies
    if (hasCircularDependency(depEditorTask.id, predecessorIds)) {
      alert('Cannot save: Circular dependency detected. A task cannot depend on itself or create a dependency loop.');
      return;
    }

    try {
      const predecessorIdsNumeric = predecessorIds.map(id => parseInt(id, 10));

      // Call API to update dependencies
      await api.patch(`/api/v1/sm_template_rows/${depEditorTask.id}`, {
        predecessor_ids: predecessorIdsNumeric
      });

      // Update local state
      setTasks(prev => prev.map(t =>
        t.id === depEditorTask.id
          ? { ...t, predecessorIds: validLinks.map(l => l.predecessorId) }
          : t
      ));

      setDepEditorOpen(false);
    } catch (err) {
      console.error('Failed to save dependencies:', err);
    }
  }, [depEditorTask, depEditorLinks, templateId]);

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
      // Use company timezone for consistent date handling
      const today = getTodayInCompanyTimezone();
      const projectStartDate = new Date(today);
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

  // Trigger resize when fullscreen changes
  React.useEffect(() => {
    if (ganttRef.current) {
      // Small delay to allow CSS transition to complete
      const timer = setTimeout(() => {
        ganttRef.current?.resize();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen]);

  // Update column visibility and tooltip config when columns change
  React.useEffect(() => {
    if (ganttRef.current) {
      // Update visible columns in engine
      const cols = visibleColumns.map(c => c.id);
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
      <div className={cn("flex flex-col h-full", className)}>
        {/* Toolbar with template selector */}
        {showToolbar && (
          <div className="flex items-center gap-2 p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex-1" />
            {templates && templates.length > 0 && onTemplateChange && (
              <Select
                value={templateId ? String(templateId) : ""}
                onValueChange={(value) => onTemplateChange(parseInt(value))}
              >
                <SelectTrigger className="w-[280px] h-8">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={String(template.id)}>
                      {template.name} ({template.row_count} tasks)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span className="text-sm text-muted-foreground">0 tasks</span>
          </div>
        )}
        <div className="flex items-center justify-center flex-1">
          <p className="text-sm text-muted-foreground">
            {templateId ? "No tasks in this template" : "Select a template to preview"}
          </p>
        </div>
      </div>
    );
  }

  // Main Gantt content (used both inline and in fullscreen dialog)
  const ganttContent = (
    <div className={cn("flex flex-col h-full", isFullscreen ? "fixed inset-0 z-50 bg-background" : "", className)}>
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

          {/* Fullscreen Toggle */}
          {showFullscreenButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
            </Button>
          )}

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
                  {columns.map((col, index) => {
                    const isPermanent = col.id === 'name';
                    return (
                      <SortableItem
                        key={col.id}
                        id={col.id}
                        variant="simple"
                        showBadge={false}
                        className="py-1"
                      >
                        <div className="flex items-center gap-2">
                          {isPermanent ? (
                            <Check className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Checkbox
                              id={`col-${col.id}`}
                              checked={col.visible}
                              onCheckedChange={() => toggleColumnVisibility(col.id)}
                            />
                          )}
                          <label
                            htmlFor={`col-${col.id}`}
                            className={cn(
                              "text-sm select-none flex-1",
                              isPermanent ? "text-muted-foreground" : "cursor-pointer"
                            )}
                          >
                            {col.label}{isPermanent && " (always)"}
                          </label>
                        </div>
                      </SortableItem>
                    );
                  })}
                </SortableList>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1" />

          {/* Template Selector */}
          {templates && templates.length > 0 && onTemplateChange && (
            <Select
              value={templateId ? String(templateId) : ""}
              onValueChange={(value) => onTemplateChange(parseInt(value))}
            >
              <SelectTrigger className="w-[280px] h-8">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={String(template.id)}>
                    {template.name} ({template.row_count} tasks)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <span className="text-sm text-muted-foreground">
            {taskCount} tasks
          </span>
        </div>
      )}

      {/* Main Content - Sidebar + Canvas */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar Table - always shows Name column, toggles other columns */}
        <div className="flex flex-col border-r bg-background" style={{ width: 'auto', minWidth: showSidebar ? 200 : 160, maxWidth: showSidebar ? 600 : 200 }}>
            {/* Sidebar Header - Draggable Columns */}
            <DndContext
              sensors={columnDragSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleColumnDragEnd}
            >
              <SortableContext
                items={visibleColumns.map(c => c.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div
                  className="flex items-center border-b bg-muted/50 px-2 text-xs font-medium text-muted-foreground"
                  style={{ height: 60, minHeight: 60 }}
                >
                  {visibleColumns.map((col) => (
                    <SortableColumnHeader
                      key={col.id}
                      column={col}
                      resizingColumn={resizingColumn}
                      onResizeStart={handleResizeStart}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

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
                            <span className="text-muted-foreground mr-1">{index + 1}.</span>
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
                        // Show predecessor row numbers (e.g., "1, 3, 5")
                        const deps = task.predecessorIds || [];
                        // Find row numbers for predecessor IDs
                        const depRowNums = deps.length > 0
                          ? deps.map(predId => {
                              const predIndex = tasks.findIndex(t => t.id === predId);
                              return predIndex >= 0 ? predIndex + 1 : '?';
                            }).join(', ')
                          : '-';
                        return (
                          <button
                            className="truncate px-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded cursor-pointer w-full text-left"
                            title={`Click to edit dependencies: ${depRowNums}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDepEditor(task);
                            }}
                          >
                            {depRowNums}
                          </button>
                        );
                      default:
                        return null;
                    }
                  };

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center border-b text-xs hover:bg-muted/30 px-2",
                        index % 2 === 0 ? "bg-background" : "bg-muted/10"
                      )}
                      style={{ height: 40 }}
                    >
                      {visibleColumns.map(col => (
                        <div key={col.id} style={{ width: col.width, minWidth: col.width, flexShrink: 0 }} className="truncate px-1">
                          {renderCell(col)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
        </div>

        {/* Canvas Container */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 bg-background"
          style={{ position: "relative" }}
        />
      </div>

      {/* Dependency Editor Dialog */}
      <Dialog open={depEditorOpen} onOpenChange={setDepEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Predecessors</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Row {depEditorTask ? tasks.findIndex(t => t.id === depEditorTask.id) + 1 : ''}: {depEditorTask?.name}
            </p>
          </DialogHeader>

          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-[60px_1fr_150px_60px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Row #</span>
              <span>Task</span>
              <span>Type</span>
              <span>Lag</span>
              <span></span>
            </div>

            {/* Predecessor rows - min height for 8 rows without scrolling */}
            <div className="space-y-2 min-h-[360px]">
              {depEditorLinks.map((link, index) => {
                const predecessorTask = tasks.find(t => t.id === link.predecessorId);
                const predecessorRowNum = predecessorTask
                  ? tasks.findIndex(t => t.id === link.predecessorId) + 1
                  : '';

                return (
                  <div key={index} className="grid grid-cols-[60px_1fr_150px_60px_32px] gap-2 items-center">
                    {/* Row # input */}
                    <Input
                      type="number"
                      min={1}
                      max={tasks.length}
                      value={predecessorRowNum}
                      onChange={(e) => {
                        const rowNum = parseInt(e.target.value, 10);
                        if (rowNum >= 1 && rowNum <= tasks.length) {
                          const task = tasks[rowNum - 1];
                          if (task && task.id !== depEditorTask?.id) {
                            updatePredecessorLink(index, { predecessorId: task.id });
                          }
                        } else if (!e.target.value) {
                          updatePredecessorLink(index, { predecessorId: '' });
                        }
                      }}
                      className="h-8 text-center"
                      placeholder="#"
                    />

                    {/* Task dropdown */}
                    <ComboboxDropdown
                      items={taskComboItems}
                      selectedItem={taskComboItems.find(item => item.id === link.predecessorId)}
                      onSelect={(item) => updatePredecessorLink(index, { predecessorId: item.id })}
                      placeholder="Select task..."
                      searchPlaceholder="Search tasks..."
                      className="h-8"
                    />

                    {/* Type dropdown */}
                    <select
                      value={link.type}
                      onChange={(e) => updatePredecessorLink(index, { type: e.target.value as DependencyType })}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="FS">Finish-to-Start (FS)</option>
                      <option value="FF">Finish-to-Finish (FF)</option>
                      <option value="SS">Start-to-Start (SS)</option>
                      <option value="SF">Start-to-Finish (SF)</option>
                    </select>

                    {/* Lag input */}
                    <Input
                      type="number"
                      value={link.lag}
                      onChange={(e) => updatePredecessorLink(index, { lag: parseInt(e.target.value, 10) || 0 })}
                      className="h-8 text-center"
                      placeholder="0"
                    />

                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removePredecessorLink(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}

              {/* Empty row to add new predecessor */}
              <div className="grid grid-cols-[60px_1fr_150px_60px_32px] gap-2 items-center opacity-60">
                <Input
                  type="number"
                  min={1}
                  max={tasks.length}
                  onChange={(e) => {
                    const rowNum = parseInt(e.target.value, 10);
                    if (rowNum >= 1 && rowNum <= tasks.length) {
                      const task = tasks[rowNum - 1];
                      if (task && task.id !== depEditorTask?.id) {
                        setDepEditorLinks(prev => [...prev, { predecessorId: task.id, type: 'FS', lag: 0 }]);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  className="h-8 text-center"
                  placeholder="#"
                />
                <ComboboxDropdown
                  items={taskComboItems.filter(item => !depEditorLinks.some(l => l.predecessorId === item.id))}
                  onSelect={(item) => {
                    setDepEditorLinks(prev => [...prev, { predecessorId: item.id, type: 'FS', lag: 0 }]);
                  }}
                  placeholder="Add predecessor..."
                  searchPlaceholder="Search tasks..."
                  className="h-8"
                />
                <select disabled className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                  <option>Finish-to-Start (FS)</option>
                </select>
                <Input disabled className="h-8 text-center" placeholder="0" />
                <div className="h-8 w-8" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDepEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveDependencies}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return ganttContent;
}

export default GanttCanvasView;
