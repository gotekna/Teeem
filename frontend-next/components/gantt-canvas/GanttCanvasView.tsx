"use client";

/**
 * GanttCanvasView - React Wrapper for Canvas Gantt Engine
 *
 * High-performance canvas-based Gantt chart component.
 * Connects to the sm_schedule_master API and renders tasks using the Canvas engine.
 *
 * Part of the 3-Year Schedule Master Masterpiece Plan.
 */

import * as React from "react";
import { useTheme } from "next-themes";
import { GanttCanvas } from "@/lib/gantt/engine/GanttCanvas";
import {
  convertRowsToTasks,
  convertToDependencies,
  countWorkingDays,
  type SmScheduleMaster,
  type GanttTask,
  type TaskClickEvent,
  type TaskDragEvent,
  type SuccessorInfo,
} from "@/lib/gantt/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDateForAPI } from "@/lib/timezone-utils";
import { useToast } from "@/components/ui/use-toast";
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
  ChevronDown,
  ChevronRight,
  Layers,
  ChevronsDownUp,
  ChevronsUpDown,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info, GitBranch } from "lucide-react";
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
  rows: SmScheduleMaster[];
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

/** Default column configuration - matches preferred layout */
const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Name', width: 242, visible: true, align: 'left' },
  { id: 'hold', label: 'Hold', shortLabel: '📌', width: 28, visible: true, align: 'center' },
  { id: 'confirm', label: 'Confirm', shortLabel: '✓', width: 28, visible: true, align: 'center' },
  { id: 'supplierConfirm', label: 'Supplier Confirm', shortLabel: 'S✓', width: 28, visible: true, align: 'center' },
  { id: 'complete', label: 'Done', shortLabel: '✓', width: 28, visible: true, align: 'center' },
  { id: 'dependencies', label: 'Dependencies', width: 80, visible: true, align: 'left' },
  { id: 'duration', label: 'Duration', shortLabel: 'Days', width: 50, visible: true, align: 'center' },
  { id: 'supplier', label: 'Supplier', width: 100, visible: true, align: 'left' },
  { id: 'startDate', label: 'Start Date', shortLabel: 'Start', width: 80, visible: false, align: 'left' },
  { id: 'endDate', label: 'End Date', shortLabel: 'End', width: 80, visible: false, align: 'left' },
  { id: 'progress', label: 'Progress', shortLabel: '%', width: 50, visible: false, align: 'center' },
  { id: 'status', label: 'Status', width: 80, visible: false, align: 'left' },
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

  // Ref for templateId to use in handlers (avoids stale closure issues)
  const templateIdRef = React.useRef(templateId);
  React.useEffect(() => {
    templateIdRef.current = templateId;
  }, [templateId]);

  // Determine if we're using static mode
  const isStaticMode = Boolean(staticTasks);

  // Toast for user-visible notifications
  const { toast } = useToast();

  // State
  const [loading, setLoading] = React.useState(!isStaticMode);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<SmScheduleMaster[]>([]);
  const [showSidebar, setShowSidebar] = React.useState(true);
  const [tasks, setTasks] = React.useState<GanttTask[]>([]);
  const [internalFullscreen, setInternalFullscreen] = React.useState(false);
  const [showDependencies, setShowDependencies] = React.useState(true);

  // Collapsed headers state - stores row IDs of collapsed header rows
  const [collapsedHeaders, setCollapsedHeaders] = React.useState<Set<number>>(new Set());

  // Selected task ID - synced between grid and Gantt
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

  // Duration editing state
  const [editingDurationTaskId, setEditingDurationTaskId] = React.useState<string | null>(null);
  const [editingDurationValue, setEditingDurationValue] = React.useState<string>('');

  // Filter to show only grouped tasks (headers + their children)
  const [showOnlyGrouped, setShowOnlyGrouped] = React.useState(false);

  // Confirm/Supplier Confirm dialog state
  const [confirmDialog, setConfirmDialog] = React.useState<{
    isOpen: boolean;
    type: 'confirm' | 'supplierConfirm';
    task: GanttTask | null;
    isChecking: boolean; // true = turning ON, false = turning OFF
    affectedSuccessors: SmScheduleMaster[];
  }>({
    isOpen: false,
    type: 'confirm',
    task: null,
    isChecking: true,
    affectedSuccessors: []
  });

  // Cascade dialog state for task moves
  const [cascadeDialog, setCascadeDialog] = React.useState<{
    isOpen: boolean;
    task: GanttTask | null;
    newStartDate: Date | null;
    successors: SmScheduleMaster[];
    lockedSuccessors: SuccessorInfo[]; // successors with confirm/supplier_confirm + downstream info
    unlockedSuccessors: SuccessorInfo[]; // successors that can cascade + downstream info
  }>({
    isOpen: false,
    task: null,
    newStartDate: null,
    successors: [],
    lockedSuccessors: [],
    unlockedSuccessors: []
  });

  // Track which locked tasks have "Break" selected (affects visibility of their downstream tasks)
  // Key: task id, Value: 'break' | 'cascade' | undefined
  const [lockedTaskDecisions, setLockedTaskDecisions] = React.useState<Record<number, 'break' | 'cascade'>>({});

  // Undo history - stores previous task states for session-based undo
  // Key: taskId, Value: { startDate, endDate, duration, manuallyPositioned, manualStartDate }
  const [undoHistory, setUndoHistory] = React.useState<Map<string, {
    startDate: Date;
    endDate: Date;
    duration: number;
    manuallyPositioned: boolean;
    manualStartDate: string | null;
  }>>(new Map());

  // Toggle header collapse state
  const toggleHeaderCollapse = React.useCallback((headerId: number) => {
    setCollapsedHeaders(prev => {
      const next = new Set(prev);
      if (next.has(headerId)) {
        next.delete(headerId);
      } else {
        next.add(headerId);
      }
      return next;
    });
  }, []);

  // Collapse all headers
  const collapseAllHeaders = React.useCallback(() => {
    const allHeaderIds = rows.filter(r => r.header === 'Header').map(r => r.id);
    setCollapsedHeaders(new Set(allHeaderIds));
  }, [rows]);

  // Expand all headers
  const expandAllHeaders = React.useCallback(() => {
    setCollapsedHeaders(new Set());
  }, []);

  // Get set of header IDs for quick lookup
  const headerIds = React.useMemo(() => {
    return new Set(rows.filter(r => r.header === 'Header').map(r => r.id));
  }, [rows]);

  // Filter visible tasks (hide children of collapsed headers, optionally show only grouped)
  const visibleTasks = React.useMemo(() => {
    return tasks.filter(task => {
      const row = rows.find(r => String(r.id) === task.id);
      if (!row) return true;

      // If showOnlyGrouped is enabled, only show headers
      if (showOnlyGrouped) {
        const isHeader = row.header === 'Header';
        if (!isHeader) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, rows, showOnlyGrouped]);

  // Check if a row is a header (header === 'Header')
  const isHeaderRow = React.useCallback((row: SmScheduleMaster | undefined) => {
    return row?.header === 'Header';
  }, []);

  // Get child count for a header (hierarchy removed - returns 0)
  const getChildCount = React.useCallback((_headerId: number) => {
    return 0;
  }, []);

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
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Helper: Merge saved columns with defaults (ensures new columns are included)
  const mergeColumnsWithDefaults = React.useCallback((saved: ColumnConfig[]): ColumnConfig[] => {
    if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_COLUMNS;

    const savedIds = new Set(saved.map((c: ColumnConfig) => c.id));
    const newColumns = DEFAULT_COLUMNS.filter(c => !savedIds.has(c.id));

    const mergedSaved = saved.map((savedCol: ColumnConfig) => {
      const defaultCol = DEFAULT_COLUMNS.find(d => d.id === savedCol.id);
      if (defaultCol) {
        return { ...defaultCol, visible: savedCol.visible, width: savedCol.width };
      }
      return savedCol;
    });

    return [...mergedSaved, ...newColumns];
  }, []);

  // Load column config from API (with localStorage as cache/fallback)
  React.useEffect(() => {
    const loadColumnConfig = async () => {
      // First, load from localStorage for fast initial render
      const localSaved = localStorage.getItem('gantt-column-config');
      if (localSaved) {
        try {
          const parsed = JSON.parse(localSaved);
          setColumns(mergeColumnsWithDefaults(parsed));
        } catch {
          // Invalid JSON, continue to API fetch
        }
      }

      // Then fetch from API (SSoT)
      try {
        const response = await api.get<{ success: boolean; settings: { gantt_column_config?: ColumnConfig[] } }>('/api/v1/sm_settings');
        if (response.success && response.settings?.gantt_column_config && Array.isArray(response.settings.gantt_column_config) && response.settings.gantt_column_config.length > 0) {
          const apiColumns = mergeColumnsWithDefaults(response.settings.gantt_column_config);
          setColumns(apiColumns);
          // Update localStorage cache
          localStorage.setItem('gantt-column-config', JSON.stringify(apiColumns));
        }
      } catch (error) {
        console.warn('Failed to load gantt column config from API, using localStorage/defaults:', error);
      }

      setColumnsLoaded(true);
    };

    loadColumnConfig();
  }, [mergeColumnsWithDefaults]);

  // Initialize company settings (timezone) on mount
  React.useEffect(() => {
    initCompanySettings();
  }, []);

  // Save columns to localStorage immediately and to API (debounced)
  React.useEffect(() => {
    if (!columnsLoaded) return;

    // Save to localStorage immediately for fast feedback
    localStorage.setItem('gantt-column-config', JSON.stringify(columns));

    // Debounce API save (500ms delay)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await api.patch('/api/v1/sm_settings', {
          settings: {
            gantt_column_config: columns
          }
        });
      } catch (error) {
        console.warn('Failed to save gantt column config to API:', error);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
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
  const [depEditorSuccessorLinks, setDepEditorSuccessorLinks] = React.useState<PredecessorLink[]>([]);

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

  // Permanent columns that cannot be hidden (always show in collapsed mode)
  // These are the essential status columns: Name + Hold, Confirm, Supplier Confirm, Complete
  // Order matters - this is the order they appear in collapsed mode
  const PERMANENT_COLUMN_IDS = ['name', 'hold', 'confirm', 'supplierConfirm', 'complete'];

  // Get visible columns (always includes permanent columns, name always first)
  // When sidebar is "hidden", only show permanent columns (Name + status checkboxes)
  const visibleColumns = React.useMemo(() => {
    const visible = columns.filter(c => c.visible || PERMANENT_COLUMN_IDS.includes(c.id));
    // Ensure Name is always first
    const nameCol = visible.find(c => c.id === 'name');
    const others = visible.filter(c => c.id !== 'name');
    const allVisible = nameCol ? [nameCol, ...others] : others;

    // When sidebar is hidden, only show permanent columns with fixed narrow widths
    if (!showSidebar) {
      // Use fixed widths in collapsed mode to ensure all columns fit
      const collapsedWidths: Record<string, number> = {
        name: 150,           // Narrower name to fit other columns
        hold: 28,
        confirm: 28,
        supplierConfirm: 28,
        complete: 28,
      };
      return PERMANENT_COLUMN_IDS.map(id => {
        const col = columns.find(c => c.id === id) || DEFAULT_COLUMNS.find(c => c.id === id);
        if (!col) return undefined;
        // Override width with fixed collapsed width
        return { ...col, width: collapsedWidths[id] || col.width };
      }).filter((c): c is ColumnConfig => c !== undefined);
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
    // Use full predecessor data from rowData if available (has type and lag)
    // Otherwise fall back to just IDs with defaults
    // NOTE: pred.id is task_number, need to convert to row.id for matching task.id
    const apiPredecessors = task.rowData?.predecessor_ids || [];
    const links: PredecessorLink[] = apiPredecessors.map(pred => {
      // Find the task by task_number to get its row.id
      const predecessorTask = tasks.find(t => t.rowData?.task_number === pred.id);
      return {
        predecessorId: predecessorTask?.id || String(pred.id), // Use task.id (row.id), fallback to task_number if not found
        type: (pred.type || 'FS') as DependencyType,
        lag: pred.lag || 0,
      };
    });
    setDepEditorLinks(links);

    // Also populate successor links - tasks that have this task as a predecessor
    const currentTaskNum = task.rowData?.task_number;
    const successorLinks: PredecessorLink[] = [];
    tasks.forEach(t => {
      if (t.id === task.id) return; // Skip self
      const predIds = t.rowData?.predecessor_ids;
      if (!predIds || !Array.isArray(predIds)) return;
      const predInfo = predIds.find((p: any) => {
        const predId = p?.id || p;
        return predId === currentTaskNum || String(predId) === String(task.id);
      });
      if (predInfo) {
        successorLinks.push({
          predecessorId: t.id, // This is actually the successor task ID
          type: (predInfo.type || 'FS') as DependencyType,
          lag: predInfo.lag || 0,
        });
      }
    });
    setDepEditorSuccessorLinks(successorLinks);

    setDepEditorOpen(true);
  }, [tasks]);

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

  // Update a successor link
  const updateSuccessorLink = React.useCallback((index: number, updates: Partial<PredecessorLink>) => {
    setDepEditorSuccessorLinks(prev => prev.map((link, i) =>
      i === index ? { ...link, ...updates } : link
    ));
  }, []);

  // Remove a successor link
  const removeSuccessorLink = React.useCallback((index: number) => {
    setDepEditorSuccessorLinks(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Check for circular dependencies
  // Returns true if adding these predecessors to taskId would create a cycle
  const hasCircularDependency = React.useCallback((taskId: string, newPredecessorIds: string[]): boolean => {
    // Helper: Check if targetId is an ancestor of currentId
    const isAncestor = (targetId: string, currentId: string, visited: Set<string>): boolean => {
      if (currentId === targetId) return true; // Found the target in ancestor chain
      if (visited.has(currentId)) return false; // Already checked this branch
      visited.add(currentId);

      const currentTask = tasks.find(t => t.id === currentId);
      if (!currentTask) return false;

      for (const predId of currentTask.predecessorIds || []) {
        if (isAncestor(targetId, predId, visited)) {
          return true;
        }
      }
      return false;
    };

    // For each new predecessor, check if taskId is in its ancestor chain
    // If so, adding this predecessor would create a cycle
    for (const predId of newPredecessorIds) {
      if (predId === taskId) return true; // Can't depend on itself
      if (isAncestor(taskId, predId, new Set())) {
        return true; // taskId is already an ancestor of predId
      }
    }
    return false;
  }, [tasks]);

  // Load data from API (only when not using static mode)
  // NOTE: Defined early because saveDependencies, handleTaskResize and handleDurationSave depend on it
  // silent=true skips loading spinner (for background refreshes after edits)
  const loadData = React.useCallback(async (silent = false) => {
    if (isStaticMode || !templateId) return;

    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const response = await api.get<ApiResponse>(
        `/api/v1/sm_schedule_master_templates/${templateId}/rows`
      );

      if (response.success && response.rows) {
        // Backend returns rows sorted by sequence_order
        // Scheduling is calculated client-side from predecessor_ids
        setRows(response.rows);
      } else {
        setError("Failed to load template rows");
      }
    } catch (err) {
      console.error("Error loading Gantt data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [templateId, isStaticMode]);

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

    // Also check successors for circular dependencies (current task would become predecessor of successor)
    const validSuccessorLinks = depEditorSuccessorLinks.filter(l => l.predecessorId);
    for (const succLink of validSuccessorLinks) {
      if (hasCircularDependency(succLink.predecessorId, [depEditorTask.id])) {
        alert('Cannot save: Adding this successor would create a circular dependency.');
        return;
      }
    }

    try {
      // Build predecessor_ids in the format backend expects: [{id, type, lag}]
      // NOTE: predecessorId is row.id (task.id), need to convert to task_number for API
      const predecessorData = validLinks.map(link => {
        // Find the task to get its task_number
        const predecessorTask = tasks.find(t => t.id === link.predecessorId);
        const taskNumber = predecessorTask?.rowData?.task_number || parseInt(link.predecessorId, 10);
        return {
          id: taskNumber,
          type: link.type || 'FS',
          lag: link.lag || 0
        };
      });

      // Call API to update dependencies
      // If task is FULLY LOCKED (both confirm AND supplier confirm), remove dependencies
      // and mark as dependency_broken - the task stays where it is but shows checkered
      const isLocked = depEditorTask.rowData?.supplier_confirm === true;
      const isFullyLocked = isLocked && depEditorTask.rowData?.confirm === true;

      if (isFullyLocked && predecessorData.length > 0) {
        // Task is fully locked - remove dependencies and mark as broken
        await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${depEditorTask.id}`, {
          row: {
            predecessor_ids: [],
            dependency_broken: true
          }
        });
      } else {
        // Normal case - save the dependencies
        await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${depEditorTask.id}`, {
          row: {
            predecessor_ids: predecessorData,
            // Clear dependency_broken if we're setting dependencies
            dependency_broken: false,
            // Set confirm if task is locked and can't follow dependencies
            ...(isLocked && predecessorData.length > 0 && { confirm: true })
          }
        });
      }

      // Now save successor changes - update each successor task's predecessor_ids
      // Get the current task's task_number for the predecessor reference
      const currentTaskNum = depEditorTask.rowData?.task_number;

      // Find original successors to compare (tasks that HAD this task as predecessor)
      const originalSuccessorIds = new Set<string>();
      tasks.forEach(t => {
        if (t.id === depEditorTask.id) return;
        const predIds = t.rowData?.predecessor_ids;
        if (!predIds || !Array.isArray(predIds)) return;
        const hasCurrent = predIds.some((p: any) => {
          const predId = p?.id || p;
          return predId === currentTaskNum || String(predId) === String(depEditorTask.id);
        });
        if (hasCurrent) originalSuccessorIds.add(t.id);
      });

      const newSuccessorIds = new Set(validSuccessorLinks.map(l => l.predecessorId));

      // Find removed successors (were in original, not in new)
      const removedSuccessors = [...originalSuccessorIds].filter(id => !newSuccessorIds.has(id));

      // Find added successors (in new, not in original)
      const addedSuccessors = [...newSuccessorIds].filter(id => !originalSuccessorIds.has(id));

      // Find modified successors (in both, but type/lag may have changed)
      const modifiedSuccessors = [...newSuccessorIds].filter(id => originalSuccessorIds.has(id));

      // Remove this task from removed successors' predecessor_ids
      for (const successorId of removedSuccessors) {
        const successorTask = tasks.find(t => t.id === successorId);
        if (!successorTask) continue;
        const existingPreds = successorTask.rowData?.predecessor_ids || [];
        const newPreds = existingPreds.filter((p: any) => {
          const predId = p?.id || p;
          return predId !== currentTaskNum && String(predId) !== String(depEditorTask.id);
        });
        await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${successorId}`, {
          row: { predecessor_ids: newPreds }
        });
      }

      // Add this task to added successors' predecessor_ids
      for (const successorId of addedSuccessors) {
        const successorTask = tasks.find(t => t.id === successorId);
        if (!successorTask) continue;
        const succLink = validSuccessorLinks.find(l => l.predecessorId === successorId);
        const existingPreds = successorTask.rowData?.predecessor_ids || [];
        const newPreds = [...existingPreds, {
          id: currentTaskNum,
          type: succLink?.type || 'FS',
          lag: succLink?.lag || 0
        }];
        await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${successorId}`, {
          row: { predecessor_ids: newPreds }
        });
      }

      // Update modified successors' predecessor_ids (type/lag might have changed)
      for (const successorId of modifiedSuccessors) {
        const successorTask = tasks.find(t => t.id === successorId);
        if (!successorTask) continue;
        const succLink = validSuccessorLinks.find(l => l.predecessorId === successorId);
        const existingPreds = successorTask.rowData?.predecessor_ids || [];
        const newPreds = existingPreds.map((p: any) => {
          const predId = p?.id || p;
          if (predId === currentTaskNum || String(predId) === String(depEditorTask.id)) {
            return {
              id: currentTaskNum,
              type: succLink?.type || 'FS',
              lag: succLink?.lag || 0
            };
          }
          return p;
        });
        await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${successorId}`, {
          row: { predecessor_ids: newPreds }
        });
      }

      // Build display string for local state update (matches backend format: "2FS+3, 5SS")
      // Uses task_number for display, not row.id
      const buildPredDisplay = (): string => {
        if (validLinks.length === 0) return 'None';
        return validLinks.map(link => {
          const predecessorTask = tasks.find(t => t.id === link.predecessorId);
          const taskNumber = predecessorTask?.rowData?.task_number || link.predecessorId;
          const lag = link.lag || 0;
          let result = `${taskNumber}${link.type || 'FS'}`;
          if (lag > 0) result += `+${lag}`;
          else if (lag < 0) result += `${lag}`;
          return result;
        }).join(', ');
      };

      // Update local state with both predecessorIds, display string, and confirm checkbox (if locked)
      setTasks(prev => prev.map(t =>
        t.id === depEditorTask.id
          ? {
              ...t,
              predecessorIds: isFullyLocked ? [] : validLinks.map(l => l.predecessorId),
              rowData: t.rowData ? {
                ...t.rowData,
                predecessor_display: isFullyLocked ? 'None' : buildPredDisplay(),
                predecessor_ids: isFullyLocked ? [] : predecessorData,
                dependency_broken: isFullyLocked,
                // Only set confirm if task is locked and can't follow dependencies
                ...(isLocked && !isFullyLocked && { confirm: true })
              } : undefined
            }
          : t
      ));

      setDepEditorOpen(false);

      // Silent reload to recalculate all dependent task dates (refresh Gantt with new lag values)
      await loadData(true);
    } catch (err: unknown) {
      console.error('Failed to save dependencies:', err);

      // Extract error message from API response
      const axiosError = err as { response?: { data?: { errors?: string[]; error?: string } }; message?: string };
      const errorMessage = axiosError?.response?.data?.errors?.join(', ')
        || axiosError?.response?.data?.error
        || axiosError?.message
        || 'Unknown error occurred';

      toast({
        variant: "destructive",
        title: "Failed to save dependencies",
        description: errorMessage,
      });
    }
  }, [depEditorTask, depEditorLinks, depEditorSuccessorLinks, templateId, tasks, toast, loadData, hasCircularDependency]);

  // Theme
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  // Handle task drag - show cascade dialog if there are successors
  const handleTaskDrag = React.useCallback(async (task: GanttTask, newStartDate: Date) => {
    // Use ref to get current templateId (avoids stale closure)
    const currentTemplateId = templateIdRef.current;

    // Call external handler if provided
    onTaskDrag?.(task, newStartDate);

    // Skip API save in static mode
    if (isStaticMode || !currentTemplateId) {
      return;
    }

    // Find all successors RECURSIVELY (entire dependency tree to the end)
    const row = rows.find(r => String(r.id) === task.id);
    if (!row) return;

    // Recursive function to find all successors down the entire tree
    const findAllSuccessorsRecursive = (taskNumber: string, visited: Set<number> = new Set()): typeof rows => {
      const directSuccessors = rows.filter(r =>
        r.predecessor_ids?.some(p => String(p.id) === taskNumber) && !visited.has(r.id)
      );

      let allDescendants = [...directSuccessors];

      // Mark these as visited to avoid infinite loops
      directSuccessors.forEach(s => visited.add(s.id));

      // Recursively find successors of successors (to the end of the schedule)
      directSuccessors.forEach(successor => {
        const childSuccessors = findAllSuccessorsRecursive(String(successor.task_number), visited);
        allDescendants = [...allDescendants, ...childSuccessors];
      });

      return allDescendants;
    };

    // Find direct successors
    const taskTaskNumber = row.task_number;
    const directSuccessors = rows.filter(r =>
      r.predecessor_ids?.some(p => p.id === taskTaskNumber)
    );

    // For each direct successor, find ALL their downstream successors (to the end)
    const visited = new Set<number>();
    directSuccessors.forEach(s => visited.add(s.id));

    // Build successor info with downstream data
    const successorInfo = directSuccessors.map(s => {
      const downstreamSuccessors = findAllSuccessorsRecursive(String(s.task_number), new Set(visited));
      // Get ALL locked downstream tasks (confirmed, supplier confirmed, finance approved, completed)
      const lockedDownstream = downstreamSuccessors.filter(ds =>
        ds.confirm || ds.supplier_confirm || ds.finance_approved || ds.is_completed
      );

      return {
        ...s,
        downstreamCount: downstreamSuccessors.length,
        downstreamTasks: lockedDownstream, // Only locked tasks - show ALL of them
        lockedDownstreamCount: lockedDownstream.length,
        hasMoreDownstream: false // We show all locked ones
      };
    });

    // Categorize successors (include finance_approved as a lock)
    const lockedSuccessors = successorInfo.filter(s =>
      s.confirm || s.supplier_confirm || s.finance_approved || s.is_completed
    );
    const unlockedSuccessors = successorInfo.filter(s =>
      !s.confirm && !s.supplier_confirm && !s.finance_approved && !s.is_completed
    );

    // If there are successors, show the cascade dialog
    if (successorInfo.length > 0) {
      // Reset decisions - default all to 'break'
      const defaultDecisions: Record<number, 'break' | 'cascade'> = {};
      lockedSuccessors.forEach(s => {
        defaultDecisions[s.id] = 'break';
        s.downstreamTasks?.forEach((dt: any) => {
          defaultDecisions[dt.id] = 'break';
        });
      });
      setLockedTaskDecisions(defaultDecisions);

      setCascadeDialog({
        isOpen: true,
        task,
        newStartDate,
        successors: successorInfo,
        lockedSuccessors,
        unlockedSuccessors
      });
      return;
    }

    // No successors - save directly
    await executeDragMove(task, newStartDate);
  }, [templateId, isStaticMode, onTaskDrag, rows]);

  // Execute the actual drag move (called directly or after cascade dialog confirmation)
  const executeDragMove = React.useCallback(async (task: GanttTask, newStartDate: Date) => {
    const currentTemplateId = templateIdRef.current;
    if (!currentTemplateId) return;

    // Save previous state for undo (before making any changes)
    const row = rows.find(r => String(r.id) === task.id);
    setUndoHistory(prev => {
      const next = new Map(prev);
      next.set(task.id, {
        startDate: new Date(task.startDate),
        endDate: new Date(task.endDate),
        duration: row?.duration_days || 1,
        manuallyPositioned: row?.hold || false,
        manualStartDate: row?.hold_date || null
      });
      return next;
    });

    try {
      // Format date as YYYY-MM-DD
      const dateStr = newStartDate.toISOString().split('T')[0];

      // Save manual position to API
      await api.patch(`/api/v1/sm_schedule_master_templates/${currentTemplateId}/rows/${task.id}`, {
        row: {
          hold: true,
          hold_date: dateStr
        }
      });

      // Update local state
      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? {
              ...t,
              startDate: newStartDate,
              rowData: t.rowData ? {
                ...t.rowData,
                hold: true,
                hold_date: dateStr
              } : undefined
            }
          : t
      ));

      // Also update rows for proper re-render
      setRows(prev => prev.map(r =>
        String(r.id) === task.id
          ? { ...r, hold: true, hold_date: dateStr }
          : r
      ));
    } catch (err) {
      console.error('Failed to save manual position:', err);
      toast({
        variant: "destructive",
        title: "Position not saved",
        description: "Failed to save task position. Please try again.",
      });
    }
  }, [rows, toast]);

  // Handle dependency create - save new dependency to API
  const handleDependencyCreate = React.useCallback(async (
    fromTaskId: string,
    toTaskId: string,
    type: 'FS' | 'SS' | 'FF' | 'SF'
  ) => {
    // Skip API save in static mode
    if (isStaticMode || !templateId) return;

    try {
      // Find the source task to get its task_number
      const fromRow = rows.find(r => String(r.id) === fromTaskId);
      // Find the target task to get its current predecessor_ids
      const toRow = rows.find(r => String(r.id) === toTaskId);

      if (!fromRow || !toRow) {
        console.error('Could not find tasks for dependency:', { fromTaskId, toTaskId });
        return;
      }

      // Build new predecessor entry using task_number
      const newPredecessor = {
        id: fromRow.task_number,
        type: type,
        lag: 0
      };

      // Get current predecessors or empty array
      const currentPredecessors = toRow.predecessor_ids || [];

      // Check if this dependency already exists
      const alreadyExists = currentPredecessors.some(p => p.id === fromRow.task_number);
      if (alreadyExists) {
        console.log('Dependency already exists, skipping');
        return;
      }

      // Add new predecessor
      const updatedPredecessors = [...currentPredecessors, newPredecessor];

      // Save to API
      await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${toTaskId}`, {
        row: {
          predecessor_ids: updatedPredecessors
        }
      });

      // Update local state
      setRows(prev => prev.map(r =>
        String(r.id) === toTaskId
          ? { ...r, predecessor_ids: updatedPredecessors }
          : r
      ));

      // Silent reload to recalculate dates
      await loadData(true);
    } catch (err: any) {
      console.error('Failed to save dependency:', err);
      // Show user-friendly toast for errors
      toast({
        variant: "destructive",
        title: "Dependency not saved",
        description: err?.message?.includes('circular')
          ? 'Cannot create dependency: This would create a circular reference.'
          : 'Failed to save dependency. Please try again.',
      });
      // Reload to remove the invalid dependency from canvas (API rejected it)
      await loadData(true);
    }
  }, [templateId, isStaticMode, rows, loadData, toast]);

  // Handle task resize - update duration and cascade dependencies
  const handleTaskResize = React.useCallback(async (task: GanttTask, newStartDate: Date, newEndDate: Date) => {
    // Skip API save in static mode
    if (isStaticMode || !templateId) return;

    // Save previous state for undo (before making any changes)
    const row = rows.find(r => String(r.id) === task.id);
    setUndoHistory(prev => {
      const next = new Map(prev);
      next.set(task.id, {
        startDate: new Date(task.startDate),
        endDate: new Date(task.endDate),
        duration: row?.duration_days || 1,
        manuallyPositioned: row?.hold || false,
        manualStartDate: row?.hold_date || null
      });
      return next;
    });

    try {
      // Calculate duration in WORKING days (skipping weekends/holidays)
      // This matches how convertRowToTask calculates dates from duration_days
      const durationDays = countWorkingDays(newStartDate, newEndDate);

      // Format dates as YYYY-MM-DD
      const startStr = newStartDate.toISOString().split('T')[0];

      // Save to API
      await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${task.id}`, {
        row: {
          hold: true,
          hold_date: startStr,
          duration_days: durationDays
        }
      });

      // Update local state for the resized task
      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? {
              ...t,
              startDate: newStartDate,
              endDate: newEndDate,
              duration: durationDays,
              rowData: t.rowData ? {
                ...t.rowData,
                hold: true,
                hold_date: startStr,
                duration_days: durationDays
              } : undefined
            }
          : t
      ));

      // Update rows for the resized task
      setRows(prev => prev.map(r =>
        String(r.id) === task.id
          ? { ...r, hold: true, hold_date: startStr, duration_days: durationDays }
          : r
      ));

      // Silent reload to recalculate all dependent task dates (no loading spinner)
      await loadData(true);
    } catch (err) {
      console.error('Failed to save task resize:', err);
      toast({
        variant: "destructive",
        title: "Resize not saved",
        description: "Failed to save task duration. Please try again.",
      });
    }
  }, [templateId, isStaticMode, loadData, rows, toast]);

  // Handle duration edit - save new duration and recalculate dependent task dates
  const handleDurationSave = React.useCallback(async (taskId: string, newDuration: number) => {
    if (isStaticMode || !templateId || newDuration < 0) return;

    try {
      // Save to API
      await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${taskId}`, {
        row: { duration_days: newDuration }
      });

      // Update local state
      setRows(prev => prev.map(r =>
        String(r.id) === taskId
          ? { ...r, duration_days: newDuration }
          : r
      ));

      // Update tasks state
      // INCLUSIVE: endDate is the last day of the task
      // A 2-day task starting Jan 1 ends on Jan 2 (duration - 1 days after start)
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          const newEndDate = new Date(t.startDate);
          newEndDate.setDate(newEndDate.getDate() + (newDuration - 1));
          return { ...t, duration: newDuration, endDate: newEndDate };
        }
        return t;
      }));

      // Silent reload to recalculate all dependent task dates (no loading spinner)
      await loadData(true);
    } catch (err) {
      console.error('Failed to save duration:', err);
      toast({
        variant: "destructive",
        title: "Duration not saved",
        description: "Failed to update task duration. Please try again.",
      });
    }

    setEditingDurationTaskId(null);
  }, [templateId, isStaticMode, loadData]);

  // Handle reset manual position (from context menu)
  const handleResetManualPosition = React.useCallback(async (task: GanttTask) => {
    // Skip API save in static mode
    if (isStaticMode || !templateId) return;

    try {
      // Clear manual position via API
      await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${task.id}`, {
        row: {
          hold: false,
          hold_date: null
        }
      });

      // Update local state
      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? {
              ...t,
              rowData: t.rowData ? {
                ...t.rowData,
                hold: false,
                hold_date: null
              } : undefined
            }
          : t
      ));

      // Also update rows for proper re-render
      setRows(prev => prev.map(r =>
        String(r.id) === task.id
          ? { ...r, hold: false, hold_date: null }
          : r
      ));
    } catch (err) {
      console.error('Failed to reset manual position:', err);
      toast({
        variant: "destructive",
        title: "Reset failed",
        description: "Failed to reset task position. Please try again.",
      });
    }
  }, [templateId, isStaticMode, toast]);

  // Handle undo - restore previous task state
  const handleUndoTask = React.useCallback(async (task: GanttTask) => {
    if (isStaticMode || !templateId) return;

    const previousState = undoHistory.get(task.id);
    if (!previousState) {
      console.log('No undo history for task:', task.id);
      return;
    }

    try {
      // Restore to previous state via API
      const startStr = previousState.manualStartDate || previousState.startDate.toISOString().split('T')[0];

      await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${task.id}`, {
        row: {
          hold: previousState.manuallyPositioned,
          hold_date: previousState.manuallyPositioned ? startStr : null,
          duration_days: previousState.duration
        }
      });

      // Clear from undo history
      setUndoHistory(prev => {
        const next = new Map(prev);
        next.delete(task.id);
        return next;
      });

      // Reload to get recalculated positions
      await loadData(true);
    } catch (err) {
      console.error('Failed to undo task change:', err);
    }
  }, [templateId, isStaticMode, undoHistory, loadData]);

  // Ctrl+Z undo for selected task
  React.useEffect(() => {
    const handleUndo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();

        // Get selected task from gantt engine
        const gantt = ganttRef.current;
        if (!gantt) return;

        const selectedIds = gantt.getSelectedTaskIds();
        if (selectedIds.length === 0) return;

        // Undo the first selected task that has undo history
        for (const taskId of selectedIds) {
          if (undoHistory.has(taskId)) {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
              handleUndoTask(task);
              break;
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleUndo);
    return () => window.removeEventListener("keydown", handleUndo);
  }, [undoHistory, tasks, handleUndoTask]);

  // Handle complete task toggle
  const handleCompleteTask = React.useCallback(async (task: GanttTask, complete: boolean) => {
    if (isStaticMode || !templateId) return;

    const row = rows.find(r => String(r.id) === task.id);
    if (!row) return;

    const taskTaskNumber = row.task_number;

    try {
      if (complete) {
        // Mark as complete - move to today, clear dependencies
        const today = new Date().toISOString().split('T')[0];

        // Find all successors (tasks that have this task as a predecessor)
        const successors = rows.filter(r =>
          r.predecessor_ids?.some(p => p.id === taskTaskNumber)
        );

        // Update the completed task
        await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${task.id}`, {
          row: {
            is_completed: true,
            completed_at: today,
            hold_date: today,
            predecessor_ids_backup: row.predecessor_ids || [],
            predecessor_ids: []
          }
        });

        // Remove completed task from all successors' predecessor_ids
        for (const successor of successors) {
          const newPredIds = (successor.predecessor_ids || []).filter(p => p.id !== taskTaskNumber);
          await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${successor.id}`, {
            row: { predecessor_ids: newPredIds }
          });
        }

        // Update local state
        setRows(prev => prev.map(r => {
          if (String(r.id) === task.id) {
            return {
              ...r,
              is_completed: true,
              completed_at: today,
              hold_date: today,
              predecessor_ids_backup: r.predecessor_ids || [],
              predecessor_ids: []
            };
          }
          // Also remove from successors' predecessor_ids in local state
          if (r.predecessor_ids?.some(p => p.id === taskTaskNumber)) {
            return {
              ...r,
              predecessor_ids: (r.predecessor_ids || []).filter(p => p.id !== taskTaskNumber)
            };
          }
          return r;
        }));
      } else {
        // Uncomplete - restore predecessors, clear hold, rejoin schedule
        await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${task.id}`, {
          row: {
            is_completed: false,
            completed_at: null,
            hold: false,
            hold_date: null,
            predecessor_ids: row.predecessor_ids_backup || []
          }
        });

        // Update local state
        setRows(prev => prev.map(r =>
          String(r.id) === task.id
            ? {
                ...r,
                is_completed: false,
                completed_at: null,
                hold: false,
                hold_date: null,
                predecessor_ids: r.predecessor_ids_backup || []
              }
            : r
        ));
      }
    } catch (err) {
      console.error('Failed to toggle complete:', err);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Failed to update complete status. Please try again.",
      });
    }
  }, [templateId, isStaticMode, rows, toast]);

  // Find all successors of a task (tasks that have this task as a predecessor)
  const findSuccessors = React.useCallback((taskTaskNumber: string): SmScheduleMaster[] => {
    return rows.filter(r =>
      r.predecessor_ids?.some(p => String(p.id) === taskTaskNumber)
    );
  }, [rows]);

  // Handle confirm toggle (confirm) - NO DIALOG, direct toggle
  const handleConfirmToggle = React.useCallback(async (task: GanttTask, checked: boolean) => {
    if (isStaticMode || !templateId) return;

    const row = rows.find(r => String(r.id) === task.id);
    if (!row) return;

    // Get current task position to lock it in place
    const currentTask = tasks.find(t => t.id === task.id);
    // Use company timezone (Brisbane) for date formatting
    const currentDateStr = formatDateForAPI(currentTask?.startDate ?? null);

    try {
      // When confirming, also save position so task doesn't move
      // DON'T set hold - just save the date, isLocked handles the rest
      const updateData: any = { confirm: checked };
      if (checked && currentDateStr) {
        updateData.hold_date = currentDateStr;
      }

      await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${task.id}`, {
        row: updateData
      });

      setRows(prev => prev.map(r =>
        String(r.id) === task.id
          ? {
              ...r,
              confirm: checked,
              ...(checked && currentDateStr ? {
                hold_date: currentDateStr
              } : {})
            }
          : r
      ));
    } catch (err) {
      console.error('Failed to toggle confirm:', err);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Failed to update confirm status. Please try again.",
      });
    }
  }, [templateId, isStaticMode, rows, tasks, toast]);

  // Handle supplier confirm toggle (supplier_confirm) - show dialog first
  const handleSupplierConfirmToggle = React.useCallback((task: GanttTask, checked: boolean) => {
    if (isStaticMode || !templateId) return;

    const row = rows.find(r => String(r.id) === task.id);
    if (!row) return;

    // Find affected successors
    const successors = findSuccessors(String(row.task_number));

    // Show confirmation dialog
    setConfirmDialog({
      isOpen: true,
      type: 'supplierConfirm',
      task,
      isChecking: checked,
      affectedSuccessors: successors
    });
  }, [templateId, isStaticMode, rows, findSuccessors]);

  // Execute the confirm/supplier confirm toggle after dialog confirmation
  const executeConfirmToggle = React.useCallback(async () => {
    if (!confirmDialog.task || !templateId) return;

    const { type, task, isChecking, affectedSuccessors } = confirmDialog;
    const fieldName = type === 'confirm' ? 'confirm' : 'supplier_confirm';

    // Find the current task position from the tasks state
    const currentTask = tasks.find(t => t.id === task.id);
    // Use company timezone (Brisbane) for date formatting
    const currentDateStr = formatDateForAPI(currentTask?.startDate ?? null);

    try {
      // When CONFIRMING (locking), also save the current position so it doesn't move
      // DON'T set hold - just save the date, isLocked handles the rest
      const updateData: any = { [fieldName]: isChecking };
      if (isChecking && currentDateStr) {
        updateData.hold_date = currentDateStr;
      }

      await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${task.id}`, {
        row: updateData
      });

      setRows(prev => prev.map(r =>
        String(r.id) === task.id
          ? {
              ...r,
              [fieldName]: isChecking,
              ...(isChecking && currentDateStr ? {
                hold_date: currentDateStr
              } : {})
            }
          : r
      ));

      // Close dialog
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
      console.error(`Failed to toggle ${type}:`, err);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: `Failed to update ${type === 'confirm' ? 'confirm' : 'supplier confirm'} status. Please try again.`,
      });
    }
  }, [confirmDialog, templateId, tasks, toast]);

  // Initialize canvas engine - recreated when data changes
  // Note: Using rows in dependencies causes recreation, but this is needed for proper handler binding
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
      // First task starts today
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

    // Disable snap-to-working-day for templates
    // Templates use relative day offsets, not calendar dates
    if (templateId && !isStaticMode) {
      gantt.setSnapConfig({ snapToWorkingDay: false });
    }

    // Set event handlers
    if (onTaskClick) {
      gantt.onTaskClickHandler(onTaskClick);
    }
    if (onTaskDoubleClick) {
      gantt.onTaskDoubleClickHandler(onTaskDoubleClick);
    }
    // Always register drag handler to save manual positions
    gantt.onTaskDragHandler(handleTaskDrag);

    // Register resize handler to save duration changes
    gantt.onTaskResizeHandler(handleTaskResize);

    // Register reset manual position handler (context menu)
    gantt.onResetManualPositionHandler(handleResetManualPosition);

    // Register dependency create handler to save new dependencies
    gantt.onDependencyCreateHandler(handleDependencyCreate);

    // Register scroll sync callback
    gantt.onScrollHandler((scrollX, scrollY) => {
      if (sidebarRef.current) {
        sidebarRef.current.scrollTop = scrollY;
      }
    });

    // Register selection change handler to sync with grid
    gantt.onSelectionChangeHandler((selectedIds) => {
      // Update grid selection to match Gantt selection
      setSelectedTaskId(selectedIds.length > 0 ? selectedIds[0] : null);
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
  }, [rows, staticTasks, staticDependencies, isStaticMode, loading, error, isDarkMode, onTaskClick, onTaskDoubleClick, handleTaskDrag, handleTaskResize, handleResetManualPosition, handleDependencyCreate]);

  // Update dark mode when theme changes
  React.useEffect(() => {
    if (ganttRef.current) {
      ganttRef.current.setDarkMode(isDarkMode);
    }
  }, [isDarkMode]);

  // Sync visible tasks to canvas when headers are collapsed/expanded
  React.useEffect(() => {
    if (ganttRef.current && visibleTasks.length > 0) {
      ganttRef.current.setTasks(visibleTasks);
    }
  }, [visibleTasks]);

  // Load holidays from API and add to canvas
  React.useEffect(() => {
    if (!ganttRef.current) return;

    // Australian QLD public holidays fallback
    const getAustralianHolidays = (year: number) => {
      const holidays = [
        { date: new Date(year, 0, 1), name: "New Year's Day" },
        { date: new Date(year, 0, 26), name: "Australia Day" },
        { date: new Date(year, 3, 25), name: "Anzac Day" },
        { date: new Date(year, 11, 25), name: "Christmas Day" },
        { date: new Date(year, 11, 26), name: "Boxing Day" },
      ];
      // Easter (approximate - Good Friday, Easter Saturday, Easter Monday)
      // 2025: April 18, 19, 21
      // 2026: April 3, 4, 6
      if (year === 2025) {
        holidays.push({ date: new Date(2025, 3, 18), name: "Good Friday" });
        holidays.push({ date: new Date(2025, 3, 19), name: "Easter Saturday" });
        holidays.push({ date: new Date(2025, 3, 21), name: "Easter Monday" });
        holidays.push({ date: new Date(2025, 7, 13), name: "Ekka (QLD)" }); // Aug 13 2025
        holidays.push({ date: new Date(2025, 9, 6), name: "King's Birthday (QLD)" }); // Oct 6 2025
      } else if (year === 2026) {
        holidays.push({ date: new Date(2026, 3, 3), name: "Good Friday" });
        holidays.push({ date: new Date(2026, 3, 4), name: "Easter Saturday" });
        holidays.push({ date: new Date(2026, 3, 6), name: "Easter Monday" });
        holidays.push({ date: new Date(2026, 7, 12), name: "Ekka (QLD)" });
        holidays.push({ date: new Date(2026, 9, 5), name: "King's Birthday (QLD)" });
      }
      return holidays.map(h => ({ ...h, type: 'public' as const }));
    };

    const loadHolidays = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const response = await api.get<{ dates: string[] }>(
          `/api/v1/public_holidays/dates?year_start=${currentYear}&year_end=${currentYear + 2}&region=QLD`
        );

        if (response.dates && response.dates.length > 0) {
          const holidays = response.dates.map(dateStr => {
            // Parse date parts to avoid timezone issues
            const [year, month, day] = dateStr.split('-').map(Number);
            return {
              date: new Date(year, month - 1, day), // month is 0-indexed
              name: 'Public Holiday',
              type: 'public' as const,
            };
          });
          ganttRef.current?.addHolidays(holidays);
        } else {
          // Fallback to hardcoded holidays
          const currentYear = new Date().getFullYear();
          const fallbackHolidays = [
            ...getAustralianHolidays(currentYear),
            ...getAustralianHolidays(currentYear + 1),
          ];
          ganttRef.current?.addHolidays(fallbackHolidays);
        }
      } catch (err) {
        console.error('Failed to load holidays, using fallback:', err);
        // Fallback to hardcoded holidays
        const currentYear = new Date().getFullYear();
        const fallbackHolidays = [
          ...getAustralianHolidays(currentYear),
          ...getAustralianHolidays(currentYear + 1),
        ];
        ganttRef.current?.addHolidays(fallbackHolidays);
      }
    };

    loadHolidays();
  }, [rows, staticTasks]); // Re-run when data changes (after canvas is created)

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

  // Trigger resize when sidebar is toggled
  React.useEffect(() => {
    if (ganttRef.current) {
      // Small delay to allow CSS transition to complete
      const timer = setTimeout(() => {
        ganttRef.current?.resize();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showSidebar]);

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
          <Button onClick={() => loadData()} variant="outline">
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

          {/* Grouped Tasks Filter Toggle */}
          <Button
            variant={showOnlyGrouped ? "default" : "ghost"}
            size="icon"
            onClick={() => setShowOnlyGrouped(!showOnlyGrouped)}
            title={showOnlyGrouped ? "Show All Tasks" : "Show Only Grouped Tasks"}
          >
            <Layers className="h-4 w-4" />
          </Button>

          {/* Collapse/Expand All */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={collapseAllHeaders}
              title="Collapse All Groups"
            >
              <ChevronsDownUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={expandAllHeaders}
              title="Expand All Groups"
            >
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          </div>

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
                    const isPermanent = PERMANENT_COLUMN_IDS.includes(col.id);
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

          {/* Legend */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" title="Color Legend">
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Task Bar Colors</h4>
                <p className="text-xs text-muted-foreground">Based on checkbox status (priority order)</p>
                <div className="grid gap-2 text-sm">
                  {/* Checkbox-based colors in priority order */}
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded" style={{ backgroundColor: '#1f2937' }} />
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Done checked</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded" style={{ backgroundColor: '#a855f7' }} />
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">S✓ (Supplier Confirm) checked</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded" style={{ backgroundColor: '#22c55e' }} />
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">✓ (Confirm) checked</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded" style={{ backgroundColor: '#D4A574' }} />
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Hold checked (tan)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded" style={{ backgroundColor: '#9ca3af' }} />
                    <span className="text-muted-foreground">No checkboxes (default)</span>
                  </div>
                </div>
                <div className="border-t pt-2 mt-2">
                  <h4 className="font-medium text-sm mb-2">Other Indicators</h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
                      <span className="text-muted-foreground">Today marker</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-3 rounded opacity-50" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }} />
                      <span className="text-muted-foreground">Weekend</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-3 rounded" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }} />
                      <span className="text-muted-foreground">Holiday</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-3 rounded overflow-hidden relative"
                        style={{ backgroundColor: '#a855f7' }}
                      >
                        {/* Checkerboard overlay */}
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage: `
                              linear-gradient(45deg, rgba(255,255,255,0.3) 25%, transparent 25%),
                              linear-gradient(-45deg, rgba(255,255,255,0.3) 25%, transparent 25%),
                              linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.3) 75%),
                              linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.3) 75%)
                            `,
                            backgroundSize: '4px 4px',
                            backgroundPosition: '0 0, 0 2px, 2px -2px, -2px 0px'
                          }}
                        />
                      </div>
                      <span className="text-muted-foreground">Broken dependency</span>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-2 mt-2">
                  <h4 className="font-medium text-sm mb-2">Task Shapes</h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-3 rounded" style={{ backgroundColor: '#9ca3af' }} />
                      <span className="text-muted-foreground">Regular task (bar)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg width="16" height="12" viewBox="0 0 16 12">
                        <polygon points="8,1 15,6 8,11 1,6" fill="#ea580c" stroke="#9a3412" strokeWidth="1" />
                        <text x="8" y="7" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">O</text>
                      </svg>
                      <span className="text-muted-foreground">Order task (spawned)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg width="16" height="12" viewBox="0 0 16 12">
                        <polygon points="8,1 15,6 8,11 1,6" fill="#2563eb" stroke="#1e40af" strokeWidth="1" />
                        <text x="8" y="7" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">C</text>
                      </svg>
                      <span className="text-muted-foreground">Call task (spawned)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg width="16" height="12" viewBox="0 0 16 12">
                        {/* Camera body */}
                        <rect x="2" y="3" width="12" height="8" rx="1.5" fill="#9333ea" stroke="#7c3aed" strokeWidth="0.5" />
                        {/* Viewfinder bump */}
                        <rect x="6" y="1" width="4" height="2" rx="0.5" fill="#9333ea" />
                        {/* Lens outer */}
                        <circle cx="8" cy="7" r="3" fill="white" />
                        {/* Lens inner */}
                        <circle cx="8" cy="7" r="1.5" fill="#9333ea" />
                      </svg>
                      <span className="text-muted-foreground">Photo task (spawned)</span>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-2 mt-2">
                  <h4 className="font-medium text-sm mb-2">Dependency Lines (on selection)</h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-0.5 relative">
                        <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(90deg, #000 0px, #000 3px, #fbbf24 3px, #fbbf24 6px)' }} />
                      </div>
                      <span className="text-muted-foreground">Predecessor (must finish before)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-0.5 relative">
                        <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(90deg, #000 0px, #000 3px, #60a5fa 3px, #60a5fa 6px)' }} />
                      </div>
                      <span className="text-muted-foreground">Successor (waits for this task)</span>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Dependency Lines Toggle */}
          <Button
            variant="ghost"
            size="icon"
            title={showDependencies ? "Hide Dependency Lines" : "Show Dependency Lines"}
            onClick={() => {
              const newValue = !showDependencies;
              setShowDependencies(newValue);
              ganttRef.current?.setDependenciesVisible(newValue);
            }}
            className={cn(!showDependencies && "text-muted-foreground")}
          >
            <GitBranch className="h-4 w-4" />
          </Button>

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
        <div className="flex flex-col border-r bg-background" style={{ width: 'auto', minWidth: showSidebar ? 200 : 280, maxWidth: showSidebar ? 600 : 300 }}>
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
                  style={{ height: 50, minHeight: 50 }}
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
              <div style={{ height: visibleTasks.length * 28 }}>
                {visibleTasks.map((task, index) => {
                  const row = rows.find(r => String(r.id) === task.id);
                  const startStr = task.startDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
                  const endStr = task.endDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
                  // Use working days to match backend duration_days semantics
                  const duration = countWorkingDays(task.startDate, task.endDate);
                  const isHeader = isHeaderRow(row);
                  const childCount = isHeader && row ? getChildCount(row.id) : 0;
                  const isCollapsed = row ? collapsedHeaders.has(row.id) : false;

                  // Render cell content based on column id
                  const renderCell = (col: ColumnConfig) => {
                    switch (col.id) {
                      case 'name':
                        return (
                          <div className={cn("truncate px-2 flex items-center", isHeader && "font-bold")} title={task.name}>
                            {isHeader && childCount > 0 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (row) toggleHeaderCollapse(row.id);
                                }}
                                className="mr-1 hover:bg-muted rounded p-0.5 flex-shrink-0"
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>
                            ) : (
                              <span className="text-muted-foreground mr-1">{index + 1}.</span>
                            )}
                            <span className={isHeader ? "text-primary" : ""}>{task.name}</span>
                            {isHeader && childCount > 0 && (
                              <span className="text-muted-foreground text-[10px] ml-2">
                                ({isCollapsed ? childCount : childCount})
                              </span>
                            )}
                          </div>
                        );
                      case 'startDate':
                        return <div className="truncate px-1 text-muted-foreground">{startStr}</div>;
                      case 'endDate':
                        return <div className="truncate px-1 text-muted-foreground">{endStr}</div>;
                      case 'duration':
                        if (editingDurationTaskId === task.id) {
                          return (
                            <input
                              type="number"
                              min="0"
                              autoFocus
                              value={editingDurationValue}
                              onChange={(e) => setEditingDurationValue(e.target.value)}
                              onBlur={() => {
                                const val = parseInt(editingDurationValue, 10);
                                if (!isNaN(val) && val >= 0) {
                                  handleDurationSave(task.id, val);
                                } else {
                                  setEditingDurationTaskId(null);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseInt(editingDurationValue, 10);
                                  if (!isNaN(val) && val >= 0) {
                                    handleDurationSave(task.id, val);
                                  }
                                } else if (e.key === 'Escape') {
                                  setEditingDurationTaskId(null);
                                }
                              }}
                              className="w-full h-5 px-1 text-center text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                              onClick={(e) => e.stopPropagation()}
                            />
                          );
                        }
                        return (
                          <div
                            className="truncate px-1 text-muted-foreground text-center cursor-pointer hover:bg-muted/50 rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDurationTaskId(task.id);
                              setEditingDurationValue(String(duration));
                            }}
                            title="Click to edit duration"
                          >
                            {duration}
                          </div>
                        );
                      case 'progress':
                        return <div className="truncate px-1 text-muted-foreground text-center">{task.progress || 0}%</div>;
                      case 'status':
                        return <div className="truncate px-1 text-muted-foreground">{task.status || '-'}</div>;
                      case 'confirm':
                        const isConfirmed = row?.confirm === true;
                        return (
                          <div className="flex justify-center">
                            <input
                              type="checkbox"
                              checked={isConfirmed}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleConfirmToggle(task, !isConfirmed);
                              }}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                              title={isConfirmed ? 'Supervisor check required - click to disable' : 'Click to require supervisor check'}
                            />
                          </div>
                        );
                      case 'supplierConfirm':
                        const isSupplierConfirmed = row?.supplier_confirm === true;
                        return (
                          <div className="flex justify-center">
                            <input
                              type="checkbox"
                              checked={isSupplierConfirmed}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSupplierConfirmToggle(task, !isSupplierConfirmed);
                              }}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                              title={isSupplierConfirmed ? 'Supplier confirm required - click to disable' : 'Click to require supplier confirm'}
                            />
                          </div>
                        );
                      case 'supplier':
                        return (
                          <div className="truncate px-1 text-muted-foreground" title={task.supplierName || ''}>
                            {task.supplierName || '-'}
                          </div>
                        );
                      case 'dependencies':
                        // SSoT FIX: Use STABLE row numbers from full task list (rows)
                        // NOT visibleTasks which changes when headers collapse
                        // rows is SmScheduleMaster[] with task_number directly (not in rowData)
                        const predecessorIds = task.rowData?.predecessor_ids || [];
                        const depDisplay = predecessorIds.length > 0
                          ? predecessorIds.map((pred: { id: number; type?: string; lag?: number }) => {
                              // Find the predecessor task by task_number in FULL rows list
                              // Note: rows is SmScheduleMaster[] so use t.task_number directly
                              const predRowIndex = rows.findIndex(t => t.task_number === pred.id);
                              // Get stable row number (1-based index in FULL task list)
                              const stableRowNum = predRowIndex >= 0 ? predRowIndex + 1 : pred.id;
                              const depType = pred.type || 'FS';
                              const lag = pred.lag || 0;
                              let result = `${stableRowNum}${depType}`;
                              if (lag !== 0) {
                                result += lag > 0 ? `+${lag}` : `${lag}`;
                              }
                              return result;
                            }).join(', ')
                          : 'None';
                        const hasDeps = predecessorIds.length > 0;
                        return (
                          <button
                            className="truncate px-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded cursor-pointer w-full text-left font-mono text-[11px]"
                            title={hasDeps ? `Click to edit: ${depDisplay}` : 'Click to add dependencies'}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDepEditor(task);
                            }}
                          >
                            {hasDeps ? depDisplay : '-'}
                          </button>
                        );
                      case 'hold':
                        const isHeld = row?.hold === true;
                        return (
                          <div className="flex justify-center">
                            <input
                              type="checkbox"
                              checked={isHeld}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (isHeld) {
                                  // Unchecking - reset manual position
                                  handleResetManualPosition(task);
                                }
                                // Note: Checking happens automatically when you drag
                              }}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                              title={isHeld ? 'Task is pinned - click to unpin' : 'Drag task to pin it'}
                              disabled={!isHeld} // Can only uncheck, checking happens on drag
                            />
                          </div>
                        );
                      case 'complete':
                        const isComplete = row?.is_completed === true;
                        return (
                          <div className="flex justify-center">
                            <input
                              type="checkbox"
                              checked={isComplete}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleCompleteTask(task, !isComplete);
                              }}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-500 cursor-pointer"
                              title={isComplete ? 'Task is complete - click to uncomplete' : 'Mark task as complete'}
                            />
                          </div>
                        );
                      default:
                        return null;
                    }
                  };

                  const isSelected = selectedTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center border-b text-xs hover:bg-muted/30 px-2 cursor-pointer",
                        isSelected
                          ? "bg-blue-100 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-500"
                          : isHeader
                            ? "bg-primary/10 dark:bg-primary/20 border-l-4 border-l-primary"
                            : (index % 2 === 0 ? "bg-background" : "bg-muted/10")
                      )}
                      style={{ height: 28 }}
                      onClick={() => {
                        // Select the task and scroll Gantt horizontally to show the bar
                        // The sidebar row is already visible since user clicked it
                        setSelectedTaskId(task.id);
                        // Scroll horizontally to the task bar, but keep Y position unchanged
                        // This shows the task bar in view without moving sidebar rows
                        if (ganttRef.current) {
                          ganttRef.current.scrollToTaskHorizontalOnly(task.id, true);
                        }
                      }}
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
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Dependencies</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Row {depEditorTask ? tasks.findIndex(t => t.id === depEditorTask.id) + 1 : ''}: {depEditorTask?.name}
            </p>
          </DialogHeader>

          <div className="flex-1 flex gap-4 min-h-0">
            {/* Left Sidebar - Info Panel */}
            <div className="w-64 shrink-0 space-y-4 overflow-y-auto">
              {/* Visual Guide */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">💡 Drag to connect on Gantt</p>
                <div className="flex flex-col items-center gap-2 py-2">
                  {/* Predecessor line: black/yellow */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center">
                      <div className="bg-indigo-500 text-white text-[10px] px-2 py-1 rounded font-medium">A</div>
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full -ml-0.5 ring-1 ring-white" />
                    </div>
                    <div className="w-8 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg, #000 0px, #000 3px, #fbbf24 3px, #fbbf24 6px)' }} />
                    <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-amber-400" />
                    <div className="flex items-center">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full -mr-0.5 ring-1 ring-white z-10" />
                      <div className="bg-purple-500 text-white text-[10px] px-2 py-1 rounded font-medium">B</div>
                    </div>
                    <span className="text-[9px] text-muted-foreground ml-1">predecessor</span>
                  </div>
                  {/* Successor line: black/blue */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center">
                      <div className="bg-purple-500 text-white text-[10px] px-2 py-1 rounded font-medium">B</div>
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full -ml-0.5 ring-1 ring-white" />
                    </div>
                    <div className="w-8 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg, #000 0px, #000 3px, #60a5fa 3px, #60a5fa 6px)' }} />
                    <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-blue-400" />
                    <div className="flex items-center">
                      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full -mr-0.5 ring-1 ring-white z-10" />
                      <div className="bg-gray-500 text-white text-[10px] px-2 py-1 rounded font-medium">C</div>
                    </div>
                    <span className="text-[9px] text-muted-foreground ml-1">successor</span>
                  </div>
                </div>
                <p className="text-[10px] text-blue-700 dark:text-blue-300 text-center">
                  Drag from right dot → left dot
                </p>
              </div>

              {/* Predecessors Info */}
              <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-indigo-800 dark:text-indigo-200 mb-1">Predecessors</h4>
                <p className="text-[10px] text-indigo-700 dark:text-indigo-300">
                  Tasks that must <strong>finish before</strong> this task can start. Controls when this task begins.
                </p>
              </div>

              {/* Successors Info */}
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-purple-800 dark:text-purple-200 mb-1">Successors</h4>
                <p className="text-[10px] text-purple-700 dark:text-purple-300">
                  Tasks that <strong>wait for</strong> this task. When this task moves, successors may cascade.
                </p>
              </div>

              {/* Dependency Types */}
              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="text-xs font-semibold mb-2">Dependency Types</h4>
                <div className="space-y-1.5 text-[10px]">
                  <div><strong>FS</strong> - Finish-to-Start (most common)</div>
                  <div><strong>SS</strong> - Start-to-Start</div>
                  <div><strong>FF</strong> - Finish-to-Finish</div>
                  <div><strong>SF</strong> - Start-to-Finish (rare)</div>
                </div>
              </div>

              {/* Lag Info */}
              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="text-xs font-semibold mb-1">Lag (Days)</h4>
                <p className="text-[10px] text-muted-foreground">
                  <strong>+3</strong> = wait 3 days after<br/>
                  <strong>-2</strong> = overlap by 2 days
                </p>
              </div>
            </div>

            {/* Main Content - Predecessors & Successors */}
            <div className="flex-1 overflow-y-auto space-y-4 min-w-0">
              {/* Predecessors Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <h3 className="text-sm font-semibold">Predecessors</h3>
                  <span className="text-xs text-muted-foreground">({depEditorLinks.filter(l => l.predecessorId).length})</span>
                </div>

              {/* Header row */}
              <div className="grid grid-cols-[60px_1fr_180px_60px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Row #</span>
                <span>Task</span>
                <span>Type</span>
                <span>Lag</span>
                <span></span>
              </div>

              {/* Predecessor rows */}
              <div className="space-y-2">
                {depEditorLinks.map((link, index) => {
                  const predecessorTask = tasks.find(t => t.id === link.predecessorId);
                  const predecessorRowNum = predecessorTask
                    ? tasks.findIndex(t => t.id === link.predecessorId) + 1
                    : '';

                  return (
                    <div key={index} className="grid grid-cols-[60px_1fr_180px_60px_32px] gap-2 items-center">
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
                <div className="grid grid-cols-[60px_1fr_180px_60px_32px] gap-2 items-center opacity-60">
                  <Input
                    type="number"
                    min={1}
                    max={tasks.length}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const rowNum = parseInt((e.target as HTMLInputElement).value, 10);
                        if (rowNum >= 1 && rowNum <= tasks.length) {
                          const task = tasks[rowNum - 1];
                          if (task && task.id !== depEditorTask?.id) {
                            setDepEditorLinks(prev => [...prev, { predecessorId: task.id, type: 'FS', lag: 0 }]);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const rowNum = parseInt(e.target.value, 10);
                      if (rowNum >= 1 && rowNum <= tasks.length) {
                        const task = tasks[rowNum - 1];
                        if (task && task.id !== depEditorTask?.id) {
                          setDepEditorLinks(prev => [...prev, { predecessorId: task.id, type: 'FS', lag: 0 }]);
                          e.target.value = '';
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

              {/* Successors Section (Editable) */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <h3 className="text-sm font-semibold">Successors</h3>
                  <span className="text-xs text-muted-foreground">({depEditorSuccessorLinks.filter(l => l.predecessorId).length})</span>
                </div>

              {/* Header row */}
              <div className="grid grid-cols-[60px_1fr_180px_60px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Row #</span>
                <span>Task</span>
                <span>Type</span>
                <span>Lag</span>
                <span></span>
              </div>

              {/* Successor rows */}
              <div className="space-y-2">
                {depEditorSuccessorLinks.map((link, index) => {
                  const successorTask = tasks.find(t => t.id === link.predecessorId);
                  const successorRowNum = successorTask
                    ? tasks.findIndex(t => t.id === link.predecessorId) + 1
                    : '';

                  return (
                    <div key={index} className="grid grid-cols-[60px_1fr_180px_60px_32px] gap-2 items-center">
                      {/* Row # input */}
                      <Input
                        type="number"
                        min={1}
                        max={tasks.length}
                        value={successorRowNum}
                        onChange={(e) => {
                          const rowNum = parseInt(e.target.value, 10);
                          if (rowNum >= 1 && rowNum <= tasks.length) {
                            const task = tasks[rowNum - 1];
                            if (task && task.id !== depEditorTask?.id) {
                              updateSuccessorLink(index, { predecessorId: task.id });
                            }
                          } else if (!e.target.value) {
                            updateSuccessorLink(index, { predecessorId: '' });
                          }
                        }}
                        className="h-8 text-center"
                        placeholder="#"
                      />

                      {/* Task dropdown */}
                      <ComboboxDropdown
                        items={taskComboItems}
                        selectedItem={taskComboItems.find(item => item.id === link.predecessorId)}
                        onSelect={(item) => updateSuccessorLink(index, { predecessorId: item.id })}
                        placeholder="Select task..."
                        searchPlaceholder="Search tasks..."
                        className="h-8"
                      />

                      {/* Type dropdown */}
                      <select
                        value={link.type}
                        onChange={(e) => updateSuccessorLink(index, { type: e.target.value as DependencyType })}
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
                        onChange={(e) => updateSuccessorLink(index, { lag: parseInt(e.target.value, 10) || 0 })}
                        className="h-8 text-center"
                        placeholder="0"
                      />

                      {/* Remove button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeSuccessorLink(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}

                {/* Empty row to add new successor */}
                <div className="grid grid-cols-[60px_1fr_180px_60px_32px] gap-2 items-center opacity-60">
                  <Input
                    type="number"
                    min={1}
                    max={tasks.length}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const rowNum = parseInt((e.target as HTMLInputElement).value, 10);
                        if (rowNum >= 1 && rowNum <= tasks.length) {
                          const task = tasks[rowNum - 1];
                          if (task && task.id !== depEditorTask?.id && !depEditorSuccessorLinks.some(l => l.predecessorId === task.id)) {
                            setDepEditorSuccessorLinks(prev => [...prev, { predecessorId: task.id, type: 'FS', lag: 0 }]);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const rowNum = parseInt(e.target.value, 10);
                      if (rowNum >= 1 && rowNum <= tasks.length) {
                        const task = tasks[rowNum - 1];
                        if (task && task.id !== depEditorTask?.id && !depEditorSuccessorLinks.some(l => l.predecessorId === task.id)) {
                          setDepEditorSuccessorLinks(prev => [...prev, { predecessorId: task.id, type: 'FS', lag: 0 }]);
                          e.target.value = '';
                        }
                      }
                    }}
                    className="h-8 text-center"
                    placeholder="#"
                  />
                  <ComboboxDropdown
                    items={taskComboItems.filter(item => !depEditorSuccessorLinks.some(l => l.predecessorId === item.id) && !depEditorLinks.some(l => l.predecessorId === item.id))}
                    onSelect={(item) => {
                      setDepEditorSuccessorLinks(prev => [...prev, { predecessorId: item.id, type: 'FS', lag: 0 }]);
                    }}
                    placeholder="Add successor..."
                    searchPlaceholder="Search tasks..."
                    className="h-8"
                  />
                  <select disabled className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option>Finish-to-Start (FS)</option>
                  </select>
                  <Input disabled className="h-8 text-center" placeholder="0" />
                  <div className="h-8 w-8" />
                </div>

                {depEditorSuccessorLinks.length === 0 && (
                  <p className="text-xs text-muted-foreground italic py-1">
                    No tasks depend on this task yet. Add one above.
                  </p>
                )}
              </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setDepEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveDependencies}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cascade Dependencies Dialog - shown when moving a task with successors */}
      <Dialog open={cascadeDialog.isOpen} onOpenChange={(open) => setCascadeDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              Cascade Dependencies
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {/* Task being moved - compact */}
            <div className="p-2 bg-muted rounded text-xs">
              Moving <span className="font-semibold">{cascadeDialog.task?.name}</span> to{' '}
              <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">
                {cascadeDialog.newStartDate?.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            {/* Affected successors */}
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <p className="text-[10px] font-medium text-yellow-800 dark:text-yellow-200 mb-1.5">
                ⚠️ {cascadeDialog.successors.length} dependent task{cascadeDialog.successors.length > 1 ? 's' : ''}
              </p>

              {/* Unlocked successors - will cascade - compact inline */}
              {cascadeDialog.unlockedSuccessors.length > 0 && (
                <div className="mb-1.5">
                  <div className="text-[10px] font-semibold text-green-700 dark:text-green-300 flex items-center gap-1 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Will Cascade ({cascadeDialog.unlockedSuccessors.length}):
                  </div>
                  <div className="flex flex-wrap gap-1 ml-2">
                    {cascadeDialog.unlockedSuccessors.map((s: any) => (
                      <span key={s.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 rounded text-[9px] text-green-700 dark:text-green-300">
                        #{s.task_number} {s.name.length > 15 ? s.name.slice(0, 15) + '...' : s.name}
                        {s.downstreamCount > 0 && <span className="font-semibold">+{s.downstreamCount}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Locked tasks - grid layout with parent-child relationships */}
              {(() => {
                // Build flat list with parent info for fading
                const allLockedTasks: any[] = [];
                const childToParentMap: Record<number, number> = {};

                cascadeDialog.lockedSuccessors.forEach(s => {
                  allLockedTasks.push({ ...s, isDirect: true, parentId: null });
                  s.downstreamTasks?.forEach((dt: any) => {
                    childToParentMap[dt.id] = s.id;
                    allLockedTasks.push({ ...dt, isDirect: false, parentId: s.id });
                  });
                });

                // Sort by task number
                allLockedTasks.sort((a, b) => (parseInt(a.task_number) || 0) - (parseInt(b.task_number) || 0));

                if (allLockedTasks.length === 0) return null;

                return (
                  <div>
                    <div className="text-[10px] font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-1 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      Locked Tasks ({allLockedTasks.length}):
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {allLockedTasks.map((task: any) => {
                        const lockType = task.supplier_confirm ? 'Supplier'
                          : task.finance_approved ? 'Finance'
                          : task.confirm ? 'Confirmed'
                          : task.is_completed ? 'Done' : 'Locked';
                        const canUnlock = !task.is_completed;
                        const decision = lockedTaskDecisions[task.id] || 'break';

                        // Check if this is a child and its parent has "break" selected
                        const parentId = childToParentMap[task.id];
                        const parentDecision = parentId ? (lockedTaskDecisions[parentId] || 'break') : null;
                        const isFaded = parentId && parentDecision === 'break';

                        return (
                          <div
                            key={task.id}
                            className={`p-1.5 rounded border transition-opacity duration-200 ${
                              isFaded
                                ? 'opacity-30 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
                                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                            }`}
                          >
                            {/* Task header */}
                            <div className="flex items-center gap-1 text-[10px] mb-1">
                              {!task.isDirect && <span className="text-muted-foreground text-[8px]">↳</span>}
                              <span className="font-medium truncate flex-1">#{task.task_number} {task.name}</span>
                              <span className={`px-1 py-0.5 rounded text-[9px] whitespace-nowrap ${
                                task.supplier_confirm ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                                : task.finance_approved ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                : task.confirm ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              }`}>
                                {lockType}
                              </span>
                            </div>

                            {/* Options - only show if not faded */}
                            {isFaded ? (
                              <div className="text-[9px] text-muted-foreground italic">Not affected</div>
                            ) : (
                              <div className="flex gap-1">
                                <label className={`flex items-center gap-1 cursor-pointer px-1.5 py-0.5 rounded flex-1 border ${decision === 'break' ? 'bg-red-100 dark:bg-red-900/50 border-red-300 dark:border-red-700' : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'}`}>
                                  <input
                                    type="checkbox"
                                    checked={decision === 'break'}
                                    className="h-3 w-3 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setLockedTaskDecisions(prev => ({ ...prev, [task.id]: 'break' }));
                                      }
                                    }}
                                  />
                                  <div className="flex-1">
                                    <span className="text-[9px] font-medium text-red-700 dark:text-red-300">Break</span>
                                    <p className="text-[8px] text-red-600 dark:text-red-400 leading-tight">Stays locked, dep removed</p>
                                  </div>
                                </label>

                                <label className={`flex items-center gap-1 px-1.5 py-0.5 rounded flex-1 border ${!canUnlock ? 'cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-50' : decision === 'cascade' ? 'cursor-pointer bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700' : 'cursor-pointer bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'}`}>
                                  <input
                                    type="checkbox"
                                    checked={decision === 'cascade'}
                                    disabled={!canUnlock}
                                    className="h-3 w-3 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                                    onChange={(e) => {
                                      if (e.target.checked && canUnlock) {
                                        setLockedTaskDecisions(prev => ({ ...prev, [task.id]: 'cascade' }));
                                      }
                                    }}
                                  />
                                  <div className="flex-1">
                                    <span className={`text-[9px] font-medium ${canUnlock ? 'text-green-700 dark:text-green-300' : 'text-gray-500'}`}>Clear & Cascade</span>
                                    <p className={`text-[8px] leading-tight ${canUnlock ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                      {canUnlock ? 'Unlocks, moves with flow' : 'Completed - locked'}
                                    </p>
                                  </div>
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Compact legend */}
            <div className="text-[9px] text-muted-foreground flex gap-3 pt-1 border-t">
              <span><span className="text-green-600">●</span> Cascade = moves with parent</span>
              <span><span className="text-red-600">●</span> Break = stays in place, dependency removed</span>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setCascadeDialog(prev => ({ ...prev, isOpen: false }))}>
              Cancel
            </Button>
            <Button size="sm"
              onClick={async () => {
                if (cascadeDialog.task && cascadeDialog.newStartDate) {
                  // Get the moved task's task_number to identify which predecessor to remove
                  const movedTaskRow = rows.find(r => String(r.id) === cascadeDialog.task?.id);
                  const movedTaskNumber = movedTaskRow?.task_number;

                  // CRITICAL FIX: Null check for movedTaskNumber
                  if (!movedTaskNumber) {
                    console.error('Cannot find moved task - aborting cascade operations');
                    await executeDragMove(cascadeDialog.task, cascadeDialog.newStartDate);
                    setCascadeDialog(prev => ({ ...prev, isOpen: false }));
                    return;
                  }

                  // CRITICAL FIX: Collect all updates first to avoid race conditions
                  // Each update contains: { id, apiPayload, rowUpdate }
                  const pendingUpdates: Array<{
                    id: number;
                    apiPayload: Record<string, unknown>;
                    rowUpdate: Record<string, unknown>;
                  }> = [];

                  // Helper to get formatted date from task (uses company timezone)
                  const getTaskDateStr = (taskId: number): string | null => {
                    const currentTask = tasks.find(t => t.id === String(taskId));
                    return formatDateForAPI(currentTask?.startDate ?? null);
                  };

                  // Process each direct locked successor and its children - collect updates
                  for (const parentTask of cascadeDialog.lockedSuccessors) {
                    const parentDecision = lockedTaskDecisions[parentTask.id] || 'break';

                    if (parentDecision === 'break') {
                      // BREAK DEPENDENCY on parent - children are not affected (stay connected to parent)
                      const currentPreds = parentTask.predecessor_ids || [];
                      // CRITICAL FIX: Use String() for consistent comparison
                      const updatedPreds = currentPreds.filter((p: { id: string | number }) => String(p.id) !== String(movedTaskNumber));
                      const currentDateStr = getTaskDateStr(parentTask.id);

                      pendingUpdates.push({
                        id: parentTask.id,
                        apiPayload: {
                          predecessor_ids: updatedPreds,
                          hold: true,
                          hold_date: currentDateStr,
                          dependency_broken: true
                        },
                        rowUpdate: {
                          predecessor_ids: updatedPreds,
                          hold: true,
                          hold_date: currentDateStr,
                          dependency_broken: true
                        }
                      });
                      // Children stay connected to this parent - no action needed for them
                    } else {
                      // CLEAR & CASCADE on parent - then process children
                      const fieldName = parentTask.supplier_confirm ? 'supplier_confirm'
                        : parentTask.finance_approved ? 'finance_approved'
                        : 'confirm';

                      pendingUpdates.push({
                        id: parentTask.id,
                        apiPayload: { [fieldName]: false },
                        rowUpdate: { [fieldName]: false }
                      });

                      // Now process children since parent is cascading
                      for (const childTask of (parentTask.downstreamTasks || [])) {
                        const childDecision = lockedTaskDecisions[childTask.id] || 'break';

                        if (childDecision === 'break') {
                          // Break child dependency
                          const currentPreds = childTask.predecessor_ids || [];
                          // CRITICAL FIX: Use String() for consistent comparison - filter out parent's task_number
                          const updatedPreds = currentPreds.filter((p: { id: string | number }) => String(p.id) !== String(parentTask.task_number));
                          const currentDateStr = getTaskDateStr(childTask.id);

                          pendingUpdates.push({
                            id: childTask.id,
                            apiPayload: {
                              predecessor_ids: updatedPreds,
                              hold: true,
                              hold_date: currentDateStr,
                              dependency_broken: true
                            },
                            rowUpdate: {
                              predecessor_ids: updatedPreds,
                              hold: true,
                              hold_date: currentDateStr,
                              dependency_broken: true
                            }
                          });
                        } else {
                          // Clear & cascade child
                          const childFieldName = childTask.supplier_confirm ? 'supplier_confirm'
                            : childTask.finance_approved ? 'finance_approved'
                            : 'confirm';

                          pendingUpdates.push({
                            id: childTask.id,
                            apiPayload: { [childFieldName]: false },
                            rowUpdate: { [childFieldName]: false }
                          });
                        }
                      }
                    }
                  }

                  // CRITICAL FIX: Execute all API calls in parallel
                  try {
                    await Promise.all(
                      pendingUpdates.map(update =>
                        api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${update.id}`, {
                          row: update.apiPayload
                        })
                      )
                    );

                    // CRITICAL FIX: Single setRows call with all updates
                    setRows(prev => {
                      const updateMap = new Map(pendingUpdates.map(u => [u.id, u.rowUpdate]));
                      return prev.map(r => {
                        const update = updateMap.get(r.id);
                        return update ? { ...r, ...update } : r;
                      });
                    });
                  } catch (err) {
                    console.error('Failed to apply cascade updates:', err);
                    toast({
                      variant: "destructive",
                      title: "Update failed",
                      description: "Failed to apply cascade updates. Please try again.",
                    });
                  }

                  // Now execute the move
                  await executeDragMove(cascadeDialog.task, cascadeDialog.newStartDate);
                  setCascadeDialog(prev => ({ ...prev, isOpen: false }));
                }
              }}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm/Supplier Confirm Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog.type === 'supplierConfirm' ? (
                <>
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  Supplier Confirm
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  Confirm Task
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Task being modified */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{confirmDialog.task?.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Task #{confirmDialog.task?.rowData?.task_number}
              </p>
            </div>

            {/* What will happen */}
            {confirmDialog.isChecking ? (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border-2 ${
                  confirmDialog.type === 'supplierConfirm'
                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                }`}>
                  <p className="text-sm font-medium">
                    {confirmDialog.type === 'supplierConfirm'
                      ? '🔒 Supplier has confirmed this date'
                      : '✓ Supervisor confirms this task'}
                  </p>
                  <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                    <li>• Task becomes "locked" - won't move during cascade</li>
                    <li>• Predecessor changes won't affect this task</li>
                    <li>• Dependencies TO this task will break if predecessors move</li>
                  </ul>
                </div>

                {confirmDialog.affectedSuccessors.length > 0 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      ⚠️ {confirmDialog.affectedSuccessors.length} successor{confirmDialog.affectedSuccessors.length > 1 ? 's' : ''} depend on this task:
                    </p>
                    <ul className="mt-2 text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                      {confirmDialog.affectedSuccessors.slice(0, 5).map(s => (
                        <li key={s.id}>• #{s.task_number} {s.name}</li>
                      ))}
                      {confirmDialog.affectedSuccessors.length > 5 && (
                        <li>• ... and {confirmDialog.affectedSuccessors.length - 5} more</li>
                      )}
                    </ul>
                    <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 italic">
                      If this task moves, successor dependencies may break.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  🔓 Removing {confirmDialog.type === 'supplierConfirm' ? 'supplier confirmation' : 'confirmation'}
                </p>
                <ul className="mt-2 text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Task will rejoin the cascade chain</li>
                  <li>• Predecessor changes will move this task</li>
                  <li>• Dependencies will be maintained</li>
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
              Cancel
            </Button>
            <Button
              onClick={executeConfirmToggle}
              className={confirmDialog.type === 'supplierConfirm'
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-green-600 hover:bg-green-700'
              }
            >
              {confirmDialog.isChecking ? 'Confirm' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return ganttContent;
}

export default GanttCanvasView;
