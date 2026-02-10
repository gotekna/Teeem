"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { copyToClipboard } from "@/utils/formatters";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { useLayoutMode } from "@/contexts/LayoutModeContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import MultipleSelector, { Option } from "@/components/ui/multiple-selector";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Calendar,
  ListChecks,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Flag,
  Camera,
  Settings,
  BarChart3,
  Table as TableIcon,
  BookOpen,
  X,
  MoreVertical,
  Tag,
  // SSoT: Expand/Minimize2 removed - fullscreen now handled by TeeemTableView
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import TeeemTableView from "@/components/table/TeeemTableView";
import { ExpandChevron } from "@/components/ui/expand-chevron";
import { GanttUnified, GanttDependencyEditor } from "@/components/gantt";
import { useGanttDataManager } from "@/lib/gantt/hooks";
import { SMGanttTab } from "./SMGanttTab";
import { RecurringTasksSection } from "./RecurringTasksSection";
import { api } from "@/lib/api";
import { isWorkingDay, skipToPreviousWorkingDay, type GanttTask, type SmScheduleMaster as GanttSmScheduleMaster, type SuccessorInfo } from "@/lib/gantt/types";
import { useToast } from "@/components/ui/use-toast";
import { EditRowDialog, type EditRowData, type EditRowFormData } from "@/components/schedule/EditRowDialog";
import { Spinner } from "@/components/ui/spinner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Check, AlertCircle, Link2Off, PlayCircle, GitBranch, Search, Phone, MessageSquare, Mail } from "lucide-react";
import { useAtom, useStore } from "jotai";
import { smDataViewTemplateIdAtom } from "@/lib/table-atoms";

// Copyable code component for column names
function CopyableCode({ children }: { children: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await copyToClipboard(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{children}</code>
      <button
        onClick={handleCopy}
        className="p-0.5 rounded hover:bg-muted transition-colors shrink-0"
        title="Copy column name"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500 dark:text-green-400" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        )}
      </button>
    </span>
  );
}

/**
 * Extract ID from lookup values that might be objects or primitives.
 * Backend may return lookup columns as {id: 123, display: "..."} or just the value.
 */
function extractLookupId(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  // If it's an object with an id property, extract the id
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (obj.id !== undefined) return String(obj.id);
    // Try other common patterns
    if (obj.value !== undefined) return String(obj.value);
    return undefined;
  }
  // If it's already a primitive, convert to string
  return String(value);
}

/**
 * Extracts the display value from a lookup column (Foundation API format).
 * Lookup columns return {id: 123, display: "Name"} format.
 */
function extractLookupDisplay(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.display === 'string') return obj.display;
    if (typeof obj.label === 'string') return obj.label;
    if (typeof obj.name === 'string') return obj.name;
  }
  return undefined;
}

interface SmScheduleMaster {
  id: number;
  task_number: number;
  name: string;
  description?: string;
  duration_days: number;
  sequence_order: number;
  predecessor_ids: Array<{ id: number; type?: string; lag?: number }>;
  trade?: string;
  stage?: string;
  trade_name?: string;  // SSoT: Resolved from Foundation SM Trades by backend
  stage_name?: string;  // SSoT: Resolved from Foundation SM Stages by backend
  assigned_role?: string | null;
  cost_centre?: string;
  header_gantt?: string | { id: number; display: string } | null;  // "Header" = this IS a header, {id,display} = parent lookup
  allow_header?: boolean;  // If true, this row can be selected as a header for other tasks
  is_active?: boolean;
  tags?: string[];
  po_required: boolean;
  critical_po?: boolean;
  create_po_on_job_start?: boolean;
  spawn_order_task?: boolean;
  spawn_call_task?: boolean;
  order_time_days?: number;
  call_time_days?: number;
  require_photo: boolean;
  pass_fail_enabled?: boolean;
  // Auto-PO configuration
  po_supplier_id?: number | null;
  po_supplier_name?: string | null;
  po_line_items?: Array<{ pricebook_item_id: number; qty: number }>;
  // Linked non-PO tasks (visibility follows this PO task)
  linked_task_ids?: number[];
  // Completion linked tasks (cascade complete together when this task completes)
  completion_linked_task_ids?: number[];
  // Related PO tasks for supplier coordination info
  related_po_task_ids?: number[];
  related_po_task_names?: string[];
  // Checklist and task linking
  checklist_id?: number | { id: number; display: string } | null;
  spawn_scan_task_id?: number | { id: number; display: string } | null;
  // Document types for GET task spawning (SSoT: via sm_schedule_master_document_types join table)
  document_types?: Array<{
    id: number;
    document_type_id: number;
    document_type_name: string;
    lag_days?: number;
    assigned_role?: string;
  }>;
  // Multi-template support
  sm_template_ids: number[];
  // Claim task settings (SSoT: Schedule Master defines job claims)
  is_claim_task?: boolean;
  is_variation?: boolean;
  claim_percentage?: number | null;
  claim_invoice_pattern?: string | null;
  claim_invoice_template_id?: number | null;
  claim_trading_name_id?: number | null;
  claim_trading_name?: string | null;
  // Workflow triggers (SSoT: BpmnProcess)
  start_workflow_enabled?: boolean;
  start_workflow_id?: number | null;
  start_workflow_name?: string | null;
  complete_workflow_enabled?: boolean;
  complete_workflow_id?: number | null;
  complete_workflow_name?: string | null;
  // Completion document requirement (requires document attachment to complete task)
  requires_document_to_complete?: boolean;
  completion_document_type_id?: number | null;
  completion_document_type_name?: string | null;
}

// Claim Invoice Template for selecting invoice styles
interface ClaimInvoiceTemplate {
  id: number;
  name: string;
  description: string;
  style_key: string;
  is_default: boolean;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  logo_position: string;
  header_style: string;
  show_logo: boolean;
  show_company_details: boolean;
  show_bank_details: boolean;
}

// Trading Name for claim invoices (SSoT: Foundation trading_names)
interface TradingName {
  id: number;
  name: string;
  abn?: string;
  address?: string;
  is_default?: boolean;
}

interface SmScheduleMasterTemplate {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  row_count: number;
  rows?: SmScheduleMaster[];
  copied_from_id?: number | null;
  copied_from_name?: string | null;
  created_at: string;
  updated_at: string;
}

const VALID_SUBTABS = [
  "schedule-templates",
  "display-settings",
  "gantt",
  "data-view",
  "column-reference",
  "tables",
] as const;

type SubTab = typeof VALID_SUBTABS[number];

// All columns for tracking
const ALL_COLUMNS = [
  // Core Identity
  "task_number", "name", "description", "sequence_order", "header_gantt", "allow_header",
  // Scheduling
  "duration_days", "predecessor_ids", "predecessor_ids_backup",
  // Locking & Status (prevents cascade, confirms completion)
  "hold", "hold_date", "hold_at", "dependency_broken", "started", "previous_hold_date",
  "confirm", "confirmed_at",
  "supplier_confirm", "supplier_confirmed_at",
  "completed", "completed_at",
  // Assignment & Supplier
  "trade", "stage", "assigned_role", "cost_centre",
  // PO Settings
  "po_required", "critical_po",
  // Auto-PO (create_po_on_job_start + po_line_items work together)
  "create_po_on_job_start", "po_line_items",
  "order_time_days", "call_time_days", "po_supplier_id",
  // Related PO Tasks (for supplier coordination)
  "related_po_task_ids",
  // Completion Requirements
  "require_photo", "pass_fail_enabled",
  // Workflow Triggers
  "start_workflow_enabled", "start_workflow_id", "complete_workflow_enabled", "complete_workflow_id",
  // Document Requirements
  "requires_document_to_complete", "completion_document_type_id", "document_types",
  // Task Groups
  "sm_task_group_id",
  // Claim Task Settings (SSoT for job claims)
  "is_claim_task", "is_variation", "claim_percentage", "claim_sequence_number",
  "claim_invoice_pattern", "claim_invoice_template_id", "claim_trading_name_id",
  // Subtasks
  "has_subtasks", "subtask_count", "subtask_names", "linked_task_ids",
  // Completion Cascade
  "completion_linked_task_ids",
  // Documentation
  "documentation_category_ids",
  // Spawning Tasks
  "spawn_scan_task_id", "spawn_scan_lag_days", "spawn_order_task", "spawn_call_task",
  // Checklists
  "checklist_id",
  // Template Membership
  "sm_template_ids",
  // Display
  "tags", "color", "is_active",
  // Audit
  "created_by_id", "updated_by_id", "created_at", "updated_at",
] as const;

type ColumnStatus = {
  complete: Record<string, boolean>;
};

// SSoT: Using storage-utils STORAGE_KEYS.SM_COLUMN_STATUS for localStorage key

interface ScheduleMasterTabProps {
  /** Base path for navigation (e.g., "/settings/operations/schedule-master" or "/admin/system/schedule-master") */
  basePath?: string;
}

const DEFAULT_SM_BASE_PATH = "/admin/system/schedule-master";

export function ScheduleMasterTab({ basePath = DEFAULT_SM_BASE_PATH }: ScheduleMasterTabProps) {
  console.log("[ScheduleMasterTab] Component mounted - v2 with document types");
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const router = useRouter();
  const pathname = usePathname();
  // v2711: Jotai store for reading CURRENT atom value inside async functions
  const jotaiStore = useStore();

  // SSoT: Parse path segments for state
  // Pattern: /[basePath]/[subtab]/[view-or-table]
  const pathSegments = React.useMemo(() => {
    const parts = (pathname ?? "").replace(basePath, "").split("/").filter(Boolean);
    return {
      subtab: parts[0] || null,  // e.g., "data-view", "tables"
      extra: parts[1] || null,   // e.g., "live" (view) or "sm_resources" (table)
    };
  }, [pathname, basePath]);

  // URL is SSoT for tab state (back button support)
  const activeTab: SubTab = VALID_SUBTABS.includes(pathSegments.subtab as SubTab)
    ? (pathSegments.subtab as SubTab)
    : "schedule-templates";

  // SSoT: Set fullscreen layout mode for gantt tabs (hides sidebar & breadcrumbs)
  const { setMode } = useLayoutMode();
  React.useEffect(() => {
    const isGanttTab = activeTab === "gantt";
    setMode(isGanttTab ? "fullscreen" : "full-height");
    return () => setMode("padded"); // Reset on unmount
  }, [activeTab, setMode]);

  // URL view param (Foundation view filter) - only for data-view tab
  const viewSlug = activeTab === "data-view" ? pathSegments.extra || undefined : undefined;

  // State to override viewSlug during template change (must be declared before use)
  // When true, forces viewSlug to null for TeeemTableView (overrides URL-derived value)
  const [overrideViewSlugClear, setOverrideViewSlugClear] = React.useState(false);
  // Ref to track pending template change (prevents view navigation during template switch)
  const pendingTemplateIdRef = React.useRef<number | null>(null);

  // Effective viewSlug for TeeemTableView - can be overridden during template change
  // This allows immediate clearing of view while URL updates asynchronously
  // ⚠️ DO NOT SIMPLIFY - null means "explicitly no view, ignore URL" (v2696)
  // When overrideViewSlugClear is true, pass null (not undefined) to tell
  // TeeemTableView to ignore the URL path and apply no view filters
  const effectiveViewSlug = overrideViewSlugClear ? null : viewSlug;

  // Clear the override once URL has actually updated (viewSlug becomes undefined)
  React.useEffect(() => {
    if (overrideViewSlugClear && !viewSlug) {
      setOverrideViewSlugClear(false);
    }
  }, [viewSlug, overrideViewSlugClear]);

  // Clear view filter from URL
  const handleViewClear = React.useCallback(() => {
    router.push(`${basePath}/data-view`, { scroll: false });
  }, [router, basePath]);

  // Update URL when view changes (for path-based view persistence)
  // SSoT: Template dropdown selection is KEPT when views change
  // Views filter WITHIN the currently selected template, not replace it
  const handleViewChange = React.useCallback((view: {
    slug?: string | null;
    filters?: Array<{ column: string; operator: string; value: string | number | boolean | null }>;
  } | null) => {
    // Skip navigation if we're clearing the view for a template change
    // Otherwise this would navigate back to the old view URL, overriding our clear
    if (pendingTemplateIdRef.current !== null) return;

    if (view?.slug) {
      router.push(`${basePath}/data-view/${view.slug}`, { scroll: false });
    }
    // Note: Do NOT sync template from view filters
    // The template dropdown stays as the user selected it
    // Saved views add additional filters on top of the template filter
  }, [router, basePath]);

  // Update URL when tab changes
  const handleTabChange = React.useCallback((value: string) => {
    const newTab = value as SubTab;
    if (newTab === "schedule-templates") {
      router.push(basePath, { scroll: false });
    } else {
      router.push(`${basePath}/${newTab}`, { scroll: false });
    }
  }, [router, basePath]);

  // Schedule Templates state
  const [templates, setTemplates] = React.useState<SmScheduleMasterTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showInactive, setShowInactive] = React.useState(false);
  const [expandedTemplate, setExpandedTemplate] = React.useState<number | null>(null);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<SmScheduleMasterTemplate | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [duplicating, setDuplicating] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState<number | null>(null);
  const [loadingRows, setLoadingRows] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
  });

  // Data View state
  // ⚠️ DO NOT SIMPLIFY - Jotai atom survives component remounts (v2711 ultra fix)
  // ════════════════════════════════════════════════════════════════════
  // Why: router.push() causes component remount. useState/useRef reset on remount.
  //      Jotai atoms persist outside component lifecycle.
  // Bug: Without atom, selecting Kitchen while /setup view active → reverts to House
  // ════════════════════════════════════════════════════════════════════
  const [dataViewTemplateId, setDataViewTemplateId] = useAtom(smDataViewTemplateIdAtom);
  const [dataViewRows, setDataViewRows] = React.useState<SmScheduleMaster[]>([]);
  const [dataViewLoading, setDataViewLoading] = React.useState(false);
  const [dataViewRefreshKey, setDataViewRefreshKey] = React.useState(0);
  const [noTemplateCount, setNoTemplateCount] = React.useState<number>(0);
  // SSoT: dataViewFullscreen removed - now handled by TeeemTableView via enableFullscreen prop

  // Gantt state - template ID for selection
  const [ganttTemplateId, setGanttTemplateIdState] = React.useState<number | null>(null);
  // ⚠️ Ref to track CURRENT value for async closure safety (v2711)
  const ganttTemplateIdRef = React.useRef<number | null>(null);
  // ⚠️ DO NOT SIMPLIFY - Sync wrapper updates ref BEFORE state (v2711 fix)
  const setGanttTemplateId = React.useCallback((id: number | null) => {
    ganttTemplateIdRef.current = id;
    setGanttTemplateIdState(id);
  }, []);
  // Show PO required tasks without suppliers (useful for template editing)
  const [showAllPOTasks, setShowAllPOTasks] = React.useState(false);
  const [showClaims, setShowClaims] = React.useState(false);

  // SSoT: Use shared hook for all Gantt behavior
  // Gantt always loads its own data (same as Job Gantt) - no external data mode
  const gantt = useGanttDataManager({
    mode: 'template',
    templateId: ganttTemplateId ?? undefined,
    showAllPOTasks,
    showClaims,
  });

  // Aliases for backward compatibility during transition
  const ganttTasks = gantt.tasks;
  const ganttDependencies = gantt.dependencies;
  const ganttLoading = gantt.loading;
  const ganttUndoHistory = gantt.undoHistory;
  const cascadeDialog = gantt.cascadeDialog;
  const setCascadeDialog = gantt.setCascadeDialog;
  const lockedTaskDecisions = gantt.lockedTaskDecisions;
  const setLockedTaskDecisions = gantt.setLockedTaskDecisions;
  const confirmDialog = gantt.confirmDialog;
  const setConfirmDialog = gantt.setConfirmDialog;
  const startTaskDialog = gantt.startTaskDialog;
  const setStartTaskDialog = gantt.setStartTaskDialog;
  const supplierConfirmDialog = gantt.supplierConfirmDialog;
  const setSupplierConfirmDialog = gantt.setSupplierConfirmDialog;
  const executeSupplierConfirm = gantt.executeSupplierConfirm;
  const executeSupplierUnconfirm = gantt.executeSupplierUnconfirm;
  const executeEmailSupplier = gantt.executeEmailSupplier;
  const dependencyEditorState = gantt.dependencyEditorState;
  const setDependencyEditorState = gantt.setDependencyEditorState;
  const executeGanttCheckboxToggle = gantt.executeCheckboxToggle;
  const executeGanttDragMove = gantt.executeDragMove;
  const executeStartTask = gantt.executeStartTask;
  const loadGanttData = gantt.loadData;
  const storeGanttUndoState = gantt.storeUndoState;
  const handleGanttUndo = gantt.handleUndo;

  // Row Edit Sheet state
  const [showEditSheet, setShowEditSheet] = React.useState(false);
  const [editingRow, setEditingRow] = React.useState<SmScheduleMaster | null>(null);
  const [selectedRowForEdit, setSelectedRowForEdit] = React.useState<EditRowData | null>(null);  // SSoT: converted for EditRowDialog
  const [activeEditTemplateId, setActiveEditTemplateId] = React.useState<number | null>(null); // Tracks which template to save to
  const [editRowForm, setEditRowForm] = React.useState<Partial<SmScheduleMaster>>({});
  const [savingRow, setSavingRow] = React.useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const initialFormLoadRef = React.useRef(true);

  // Auto-PO Configuration state
  const [showAutoPODialog, setShowAutoPODialog] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState<Array<{ id: number; display_name: string }>>([]);
  const [priceHistories, setPriceHistories] = React.useState<Array<{
    id: number;
    pricebook_item_id: number;
    pricebook_item_name: string;
    pricebook_item_code: string;
    new_price: number | string;
  }>>([]);
  const [loadingSuppliers, setLoadingSuppliers] = React.useState(false);
  const [loadingPriceHistories, setLoadingPriceHistories] = React.useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>("");
  const [poLineItems, setPoLineItems] = React.useState<Array<{ pricebook_item_id: number; qty: number }>>([]);
  const [savingAutoPO, setSavingAutoPO] = React.useState(false);

  // Column status tracking (persisted to localStorage)
  const [columnStatus, setColumnStatus] = React.useState<ColumnStatus>({
    complete: {},
  });

  // Column reference search
  const [columnSearch, setColumnSearch] = React.useState("");

  // Job EntityTabs for photo storage dropdown
  const [jobEntityTabs, setJobEntityTabs] = React.useState<Array<{ id: number; display_name: string; tab_key: string }>>([]);

  // Lookup Tables subtab state - SSoT for which table is displayed
  // NOTE: Using foundationId (slug) only - not numericId - to avoid environment ID mismatches
  const LOOKUP_TABLES = [
    { id: "sm_trades", name: "SM Trades", description: "Trade types for schedule tasks (e.g., CARPENTER, ELECTRICIAN)" },
    { id: "sm_stages", name: "SM Stages", description: "Stage types for schedule tasks (e.g., 01 Slab, 05 Enclosed)" },
    { id: "cost_centres", name: "Cost Centres", description: "Cost centres for categorizing schedule tasks" },
    { id: "sm_task_groups", name: "Task Groups", description: "Group PO and non-PO tasks together - when any PO from group is on job, all linked tasks appear" },
  ] as const;
  type LookupTableId = typeof LOOKUP_TABLES[number]["id"];

  // URL is SSoT for table selection (enables shareable links)
  // In "tables" subtab, pathSegments.extra contains the table id
  const selectedLookupTable: LookupTableId = activeTab === "tables" && LOOKUP_TABLES.some(t => t.id === pathSegments.extra)
    ? (pathSegments.extra as LookupTableId)
    : "sm_trades";

  // Update URL when table changes
  const handleTableChange = React.useCallback((tableId: LookupTableId) => {
    if (tableId === "sm_trades") {
      router.push(`${basePath}/tables`, { scroll: false });
    } else {
      router.push(`${basePath}/tables/${tableId}`, { scroll: false });
    }
  }, [router, basePath]);

  const [lookupTableRefreshKey, setLookupTableRefreshKey] = React.useState(0);

  // Tag management state
  const [availableTags, setAvailableTags] = React.useState<string[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = React.useState<string>("");
  const [showTagDialog, setShowTagDialog] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState("");
  const [editingTag, setEditingTag] = React.useState<string | null>(null);
  const [editTagName, setEditTagName] = React.useState("");
  const [savingTag, setSavingTag] = React.useState(false);

  // Trade, Stage, Role, Cost Centre dropdown management
  // SSoT: Trades come from Foundation SM Trades (ID 542)
  const [availableTrades, setAvailableTrades] = React.useState<{ id: number; name: string }[]>([]);
  // SSoT: Stages come from Foundation SM Stages (ID 543)
  const [availableStages, setAvailableStages] = React.useState<{ id: number; name: string }[]>([]);
  // SSoT: Roles come from Role model (Admin > System > Company > Security > Roles)
  const [availableRoles, setAvailableRoles] = React.useState<{ id: number; name: string; display_name: string }[]>([]);
  // SSoT: Cost Centres come from Foundation Cost Centres (ID 533)
  const [availableCostCentres, setAvailableCostCentres] = React.useState<{ id: number; name: string }[]>([]);
  // SSoT: Header rows are rows with header=NULL (they ARE headers, no parent)
  // SSoT: header_gantt uses task_number (not id) - include both for proper lookups
  const [availableHeaderRows, setAvailableHeaderRows] = React.useState<{ id: number; task_number: number; name: string }[]>([]);
  // SSoT: Checklists from Supervisor Checklist Template foundation
  const [availableChecklists, setAvailableChecklists] = React.useState<{ id: number; name: string }[]>([]);
  // SSoT: Job-scoped document types for spawn scan task dropdown
  const [availableDocumentTypes, setAvailableDocumentTypes] = React.useState<{ id: number; name: string; display_name?: string; form_number_mapping?: Record<string, string> }[]>([]);
  // SSoT: Claim invoice templates for styling claim invoices
  const [claimInvoiceTemplates, setClaimInvoiceTemplates] = React.useState<ClaimInvoiceTemplate[]>([]);
  const [templatePreviewHtml, setTemplatePreviewHtml] = React.useState<string | null>(null);
  const [loadingTemplatePreview, setLoadingTemplatePreview] = React.useState(false);
  const [showFullPreview, setShowFullPreview] = React.useState(false);
  // SSoT: Trading names for claim invoices (from Foundation trading_names)
  const [tradingNames, setTradingNames] = React.useState<TradingName[]>([]);
  // SSoT: Workflows (BPMN processes) for task workflow triggers
  const [availableWorkflows, setAvailableWorkflows] = React.useState<{ id: number; name: string }[]>([]);
  // SSoT: Task Groups from Foundation SM Task Groups - for grouping PO and non-PO tasks
  const [availableTaskGroups, setAvailableTaskGroups] = React.useState<{ id: number; name: string }[]>([]);

  // FRC (Feb 2026): Edit dialog data loaded lazily on first edit sheet open.
  // These 5 endpoints took ~19 seconds combined and were only used in EditRowDialog.
  const editDialogDataLoadedRef = React.useRef(false);

  // Load column status from localStorage on mount
  // SSoT: Using storage-utils for localStorage operations
  React.useEffect(() => {
    const saved = getStorageItem<ColumnStatus>(STORAGE_KEYS.SM_COLUMN_STATUS, { complete: {} });
    setColumnStatus(saved);
  }, []);

  // Save column status to localStorage when it changes
  // SSoT: Using storage-utils for localStorage operations
  const updateColumnStatus = (column: string, value: boolean) => {
    setColumnStatus((prev) => {
      const newStatus = {
        ...prev,
        complete: {
          ...prev.complete,
          [column]: value,
        },
      };
      setStorageItem(STORAGE_KEYS.SM_COLUMN_STATUS, newStatus);
      return newStatus;
    });
  };

  // Calculate stats
  const completeCount = Object.values(columnStatus.complete).filter(Boolean).length;
    const totalColumns = ALL_COLUMNS.length;

  // Column search helper - checks if column name matches search query
  const columnMatchesSearch = (columnName: string): boolean => {
    if (!columnSearch.trim()) return true;
    const query = columnSearch.toLowerCase().trim();
    // Match against column name (with underscores converted to spaces for natural search)
    return columnName.toLowerCase().includes(query) ||
           columnName.replace(/_/g, " ").toLowerCase().includes(query);
  };

  // Check if a section has any matching columns
  const sectionHasMatches = (columnNames: string[]): boolean => {
    if (!columnSearch.trim()) return true;
    return columnNames.some(columnMatchesSearch);
  };

  // v2711 note: Ref sync moved to wrapper setters (setGanttTemplateId, setDataViewTemplateId,
  // setGanttTemplateId) which update refs synchronously BEFORE state. This prevents race
  // conditions where effects run after async API completes but before commit phase.

  // FRC (Feb 2026): Split loading into essential (page render) and deferred (edit dialog).
  // Before: 14 loaders on mount = 37 API calls, 19+ seconds of slow endpoints.
  // After: Essential loaders on mount, slow edit-dialog data loaded on first edit open.
  React.useEffect(() => {
    console.log("[ScheduleMasterTab] useEffect running, loading essential data...");
    loadTemplates();
    loadJobEntityTabs();
    loadTags();
    loadTrades();
    loadStages();
    loadRoles();
    loadCostCentres();
    loadHeaderRows();
    loadChecklists();
    console.log("[ScheduleMasterTab] Essential loaders called");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  // FRC (Feb 2026): Lazy-load slow edit dialog data on first edit sheet open.
  // These 5 endpoints (document_types, claim_invoice_templates, trading_names,
  // bpmn_processes, sm_task_groups) took ~19 seconds combined but are only
  // needed when user opens the edit dialog.
  React.useEffect(() => {
    if (showEditSheet && !editDialogDataLoadedRef.current) {
      editDialogDataLoadedRef.current = true;
      loadDocumentTypes();
      loadClaimInvoiceTemplates();
      loadTradingNames();
      loadWorkflows();
      loadTaskGroups();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEditSheet]);

  // Load job EntityTabs for photo storage dropdown
  const loadJobEntityTabs = async () => {
    try {
      const data = await api.get<{ success: boolean; data: { tabs: Array<{ id: number; display_name: string; tab_key: string }> } }>("/api/v1/warehouse_folders?scope=job");
      if (data?.data?.tabs) {
        setJobEntityTabs(data.data.tabs);
      }
    } catch (error) {
      console.error("Failed to load job EntityTabs:", error);
    }
  };

  // Load available tags from SmSetting
  const loadTags = async () => {
    try {
      const data = await api.get<{ success: boolean; tags: string[] }>("/api/v1/sm_settings/tags");
      if (data?.tags) {
        setAvailableTags(data.tags);
      }
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  };

  // Add a new tag
  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    setSavingTag(true);
    try {
      const data = await api.post<{ success: boolean; tags: string[] }>("/api/v1/sm_settings/tags", { tag: newTagName.trim() });
      if (data?.tags) {
        setAvailableTags(data.tags);
        setNewTagName("");
        toast({ title: "Tag added", description: `"${newTagName.trim()}" has been added.` });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add tag", variant: "destructive" });
    } finally {
      setSavingTag(false);
    }
  };

  // Rename a tag
  const handleRenameTag = async () => {
    if (!editingTag || !editTagName.trim()) return;
    setSavingTag(true);
    try {
      const data = await api.patch<{ success: boolean; tags: string[] }>(`/api/v1/sm_settings/tags/${encodeURIComponent(editingTag)}`, { new_name: editTagName.trim() });
      if (data?.tags) {
        setAvailableTags(data.tags);
        // Update filter if the renamed tag was selected
        if (selectedTagFilter === editingTag) {
          setSelectedTagFilter(editTagName.trim());
        }
        setEditingTag(null);
        setEditTagName("");
        toast({ title: "Tag renamed" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to rename tag", variant: "destructive" });
    } finally {
      setSavingTag(false);
    }
  };

  // Delete a tag
  const handleDeleteTag = async (tagName: string) => {
    setSavingTag(true);
    try {
      const data = await api.delete<{ success: boolean; tags: string[] }>(`/api/v1/sm_settings/tags/${encodeURIComponent(tagName)}`);
      if (data?.tags) {
        setAvailableTags(data.tags);
        // Clear filter if the deleted tag was selected
        if (selectedTagFilter === tagName) {
          setSelectedTagFilter("");
        }
        toast({ title: "Tag deleted" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete tag", variant: "destructive" });
    } finally {
      setSavingTag(false);
    }
  };

  // SSoT: Load trades from Foundation SM Trades (slug: sm_trades)
  const loadTrades = async () => {
    try {
      const data = await api.get<{ success: boolean; records: { id: number; name: string }[] }>("/api/v1/foundations/sm_trades/records?per_page=100");
      if (data?.records) {
        setAvailableTrades(data.records);
      }
    } catch (error) {
      console.error("Failed to load trades:", error);
    }
  };

  // SSoT: Load stages from Foundation SM Stages (slug: sm_stages)
  const loadStages = async () => {
    try {
      const data = await api.get<{ success: boolean; records: { id: number; name: string }[] }>("/api/v1/foundations/sm_stages/records?per_page=100");
      if (data?.records) {
        setAvailableStages(data.records);
      }
    } catch (error) {
      console.error("Failed to load stages:", error);
    }
  };

  // Navigate to Tables tab to add new trades/stages
  const handleNavigateToTables = () => {
    handleTabChange("tables");
  };

  // SSoT: Load roles from Foundation Role (slug: roles) - same as Admin > System > Company > Security > Roles
  const loadRoles = async () => {
    try {
      const data = await api.get<{ success: boolean; records: { id: number; name: string; display_name: string }[] }>("/api/v1/foundations/roles/records?per_page=100");
      if (data?.records) {
        setAvailableRoles(data.records.map(r => ({ id: r.id, name: r.name, display_name: r.display_name || r.name })));
      }
    } catch (error) {
      console.error("Failed to load roles:", error);
    }
  };

  // SSoT: Load cost centres from Foundation Cost Centres (slug: cost_centres)
  const loadCostCentres = async () => {
    try {
      const data = await api.get<{ success: boolean; records: { id: number; name: string }[] }>("/api/v1/foundations/cost_centres/records?per_page=100");
      if (data?.records) {
        setAvailableCostCentres(data.records);
      }
    } catch (error) {
      console.error("Failed to load cost centres:", error);
    }
  };

  // SSoT: Load task groups from Foundation SM Task Groups (slug: sm_task_groups)
  const loadTaskGroups = async () => {
    try {
      const data = await api.get<{ success: boolean; records: { id: number; name: string }[] }>("/api/v1/foundations/sm_task_groups/records?per_page=100");
      if (data?.records) {
        setAvailableTaskGroups(data.records);
      }
    } catch (error) {
      console.error("Failed to load task groups:", error);
    }
  };

  // SSoT: Load header rows (rows where allow_header = true)
  const loadHeaderRows = async () => {
    try {
      // Query sm_schedule_master rows where allow_header = true (the ones that CAN be headers)
      // SSoT: header_gantt uses task_number (not id) - we need both for proper lookups
      const data = await api.get<{ success: boolean; records: { id: number; task_number: number; name: string }[] }>(
        "/api/v1/foundations/sm-schedule-master/records?per_page=100&filters=" + encodeURIComponent(JSON.stringify([
          { column: "allow_header", operator: "equals", value: "true" }
        ]))
      );
      if (data?.records) {
        setAvailableHeaderRows(data.records);
      }
    } catch (error) {
      console.error("Failed to load header rows:", error);
    }
  };

  // SSoT: Load checklists from Supervisor Checklist Template foundation
  const loadChecklists = async () => {
    try {
      const data = await api.get<{ success: boolean; records: { id: number; name: string }[] }>(
        "/api/v1/foundations/supervisor_checklist_templates/records?per_page=100"
      );
      if (data?.records) {
        setAvailableChecklists(data.records);
      }
    } catch (error) {
      console.error("Failed to load checklists:", error);
    }
  };

  // SSoT: Load job-scoped document types for spawn scan task dropdown
  // Fetch both "job" and "both" scoped document types
  const loadDocumentTypes = async () => {
    try {
      console.log("[loadDocumentTypes] Fetching document types...");
      const data = await api.get<{ success: boolean; data: Array<{ id: number; name: string; display_name?: string; scope?: string }> }>(
        "/api/v1/document_types"
      );
      console.log("[loadDocumentTypes] Response:", data);
      console.log("[loadDocumentTypes] First 3 items:", data?.data?.slice(0, 3));
      if (data?.data) {
        // Filter to job-applicable document types (scope = "job" or "both")
        const jobDocTypes = data.data.filter(dt => dt.scope === "job" || dt.scope === "both");
        console.log("[loadDocumentTypes] Filtered job doc types:", jobDocTypes.length);
        if (jobDocTypes.length > 0) {
          setAvailableDocumentTypes(jobDocTypes);
        } else {
          // Fallback: show all if no job-scoped types found (shouldn't happen)
          console.warn("[loadDocumentTypes] No job-scoped types, showing all");
          setAvailableDocumentTypes(data.data);
        }
      } else {
        console.warn("[loadDocumentTypes] No data in response");
      }
    } catch (error) {
      console.error("Failed to load document types:", error);
    }
  };

  // SSoT: Load claim invoice templates for styling claim invoices
  const loadClaimInvoiceTemplates = async () => {
    try {
      const data = await api.get<{ success: boolean; data: ClaimInvoiceTemplate[] }>(
        "/api/v1/claim_invoice_templates"
      );
      if (data?.data) {
        setClaimInvoiceTemplates(data.data);
      }
    } catch (error) {
      console.error("Failed to load claim invoice templates:", error);
    }
  };

  // SSoT: Load trading names from Foundation for claim invoices
  const loadTradingNames = async () => {
    try {
      const data = await api.get<{ success: boolean; records: TradingName[] }>(
        "/api/v1/foundations/trading_names/records"
      );
      if (data?.records) {
        setTradingNames(data.records);
      }
    } catch (error) {
      console.error("Failed to load trading names:", error);
    }
  };

  // SSoT: Load workflows (BPMN processes) for task workflow triggers
  const loadWorkflows = async () => {
    try {
      const data = await api.get<{ success: boolean; bpmn_processes: Array<{ id: number; name: string }> }>(
        "/api/v1/bpmn_processes?published=true"
      );
      if (data?.bpmn_processes) {
        setAvailableWorkflows(data.bpmn_processes);
      }
    } catch (error) {
      console.error("Failed to load workflows:", error);
    }
  };

  // Load preview HTML for a specific template
  // Accepts optional params to show realistic preview with actual task data
  const loadTemplatePreview = async (
    templateId: number,
    options?: {
      tradingName?: string;
      claimPercentage?: number;
      taskName?: string;
      jobId?: number;
    }
  ) => {
    setLoadingTemplatePreview(true);
    try {
      // Build query params for customized preview
      // Backend uses real company data from CorporateSetting + job data if provided
      const params = new URLSearchParams();
      if (options?.tradingName) params.set('trading_name', options.tradingName);
      if (options?.claimPercentage) params.set('claim_percentage', String(options.claimPercentage));
      if (options?.taskName) params.set('task_name', options.taskName);
      // Use job 201 by default for realistic preview data (address, client, contract price)
      params.set('job_id', String(options?.jobId || 201));

      const queryString = params.toString();
      const url = `/api/v1/claim_invoice_templates/${templateId}/preview${queryString ? `?${queryString}` : ''}`;

      const data = await api.get<{ success: boolean; data: { preview_html: string } }>(url);
      if (data?.data?.preview_html) {
        setTemplatePreviewHtml(data.data.preview_html);
      }
    } catch (error) {
      console.error("Failed to load template preview:", error);
      setTemplatePreviewHtml(null);
    } finally {
      setLoadingTemplatePreview(false);
    }
  };

  // Load count of items with no templates assigned
  const loadNoTemplateCount = async () => {
    try {
      const response = await api.get<{ pagination?: { total_count: number } }>("/api/v1/foundations/sm-schedule-master/records", {
        params: {
          per_page: 1,
          filters: JSON.stringify([{ column: "sm_template_ids", operator: "is_empty" }]),
        },
      });
      setNoTemplateCount(response.pagination?.total_count || 0);
    } catch (error) {
      console.error("Failed to load no-template count:", error);
      setNoTemplateCount(0);
    }
  };

  const loadTemplates = async () => {
    try {
      const url = showInactive
        ? "/api/v1/sm_schedule_master_templates?include_inactive=true"
        : "/api/v1/sm_schedule_master_templates";
      const data = await api.get<{ success: boolean; sm_schedule_master_templates: SmScheduleMasterTemplate[] }>(url);
      const loadedTemplates = data?.sm_schedule_master_templates || [];
      setTemplates(loadedTemplates);

      // Load count of items without any template
      loadNoTemplateCount();

      // Auto-select template for Gantt Preview if not already selected
      // v2711: Use ref (not closure) to check CURRENT value after async await
      if (!ganttTemplateIdRef.current && loadedTemplates.length > 0) {
        // Try to find a template in priority order:
        // 1. "PO Schedule Master" (current default)
        // 2. Any template with "schedule master" in name
        // 3. First template in list
        const autoSelectTemplate = loadedTemplates.find(t =>
          t.name.toLowerCase() === 'po schedule master'
        ) || loadedTemplates.find(t =>
          t.name.toLowerCase().includes('schedule master')
        ) || loadedTemplates[0];

        if (autoSelectTemplate) {
          setGanttTemplateId(autoSelectTemplate.id);
        }
      }

      // Auto-select template for Data View (same priority as Gantt)
      // v2709: ALWAYS auto-select template, even when view is in URL
      // Templates and views are independent - views filter WITHIN the selected template
      // Without a template selected, initialFilters is empty and table shows 0 records
      // v2711: Read CURRENT atom value (not stale closure) via store.get()
      // ════════════════════════════════════════════════════════════════════
      // Why: This async function may have started before user clicked a template.
      //      The closure-captured `dataViewTemplateId` would be stale (null).
      //      Using store.get() reads the CURRENT atom value after await returns.
      // ════════════════════════════════════════════════════════════════════
      const currentTemplateId = jotaiStore.get(smDataViewTemplateIdAtom);
      if (!currentTemplateId && loadedTemplates.length > 0) {
        const autoSelectTemplate = loadedTemplates.find(t =>
          t.name.toLowerCase() === 'po schedule master'
        ) || loadedTemplates.find(t =>
          t.name.toLowerCase().includes('schedule master')
        ) || loadedTemplates[0];

        if (autoSelectTemplate) {
          loadDataViewRows(autoSelectTemplate.id);
        }
      }

      // Auto-select template for Gantt (same priority as others)
      // v2711: Use ref (not closure) to check CURRENT value after async await
      if (!ganttTemplateIdRef.current && loadedTemplates.length > 0) {
        const autoSelectTemplate = loadedTemplates.find(t =>
          t.name.toLowerCase() === 'po schedule master'
        ) || loadedTemplates.find(t =>
          t.name.toLowerCase().includes('schedule master')
        ) || loadedTemplates[0];

        if (autoSelectTemplate) {
          setGanttTemplateId(autoSelectTemplate.id);
        }
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({ name: "", description: "" });
    setEditingTemplate(null);
    setShowDialog(true);
  };

  const handleOpenEditDialog = (template: SmScheduleMasterTemplate) => {
    setFormData({
      name: template.name,
      description: template.description || "",
    });
    setEditingTemplate(template);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Template name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        await api.patch(`/api/v1/sm_schedule_master_templates/${editingTemplate.id}`, {
          sm_schedule_master_template: formData,
        });
        toast({ title: "Success", description: "Template updated successfully" });
      } else {
        await api.post("/api/v1/sm_schedule_master_templates", {
          sm_schedule_master_template: formData,
        });
        toast({ title: "Success", description: "Template created successfully" });
      }
      setShowDialog(false);
      loadTemplates();
    } catch (error) {
      console.error("Failed to save template:", error);
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    setDuplicating(id);
    try {
      await api.post(`/api/v1/sm_schedule_master_templates/${id}/duplicate`);
      toast({ title: "Success", description: "Template duplicated successfully" });
      loadTemplates();
    } catch (error) {
      console.error("Failed to duplicate template:", error);
      toast({ title: "Error", description: "Failed to duplicate template", variant: "destructive" });
    } finally {
      setDuplicating(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm("Are you sure you want to delete this template? This cannot be undone."))) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/sm_schedule_master_templates/${id}`);
      toast({ title: "Success", description: "Template archived successfully" });
      loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast({ title: "Error", description: "Failed to archive template", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  // Get current template for display
  const currentTemplate = dataViewTemplateId ? templates.find(t => t.id === dataViewTemplateId) : null;

  const toggleExpand = async (id: number) => {
    if (expandedTemplate === id) {
      setExpandedTemplate(null);
      return;
    }

    // Check if we already have rows for this template
    const template = templates.find(t => t.id === id);
    if (template?.rows && template.rows.length > 0) {
      setExpandedTemplate(id);
      return;
    }

    // Fetch the template with rows
    setLoadingRows(id);
    try {
      const data = await api.get<{ success: boolean; sm_schedule_master_template: SmScheduleMasterTemplate }>(`/api/v1/sm_schedule_master_templates/${id}`);
      if (data?.sm_schedule_master_template) {
        setTemplates(prev => prev.map(t =>
          t.id === id ? { ...t, rows: data.sm_schedule_master_template.rows } : t
        ));
      }
      setExpandedTemplate(id);
    } catch (error) {
      console.error("Failed to load template rows:", error);
      toast({ title: "Error", description: "Failed to load template details", variant: "destructive" });
    } finally {
      setLoadingRows(null);
    }
  };

  const getTotalDuration = (rows: SmScheduleMaster[]) => {
    return rows.reduce((sum, row) => sum + row.duration_days, 0);
  };

  // Data View functions
  const loadDataViewRows = async (templateId: number | null) => {
    setDataViewTemplateId(templateId);
    if (!templateId) {
      setDataViewRows([]);
      return;
    }
    setDataViewLoading(true);
    try {
      const data = await api.get<{ success: boolean; rows: SmScheduleMaster[] }>(
        `/api/v1/sm_schedule_master_templates/${templateId}/rows`
      );
      setDataViewRows(data.rows || []);
    } catch (error) {
      console.error("Failed to load data view rows:", error);
      setDataViewRows([]);
    } finally {
      setDataViewLoading(false);
    }
  };

  // Handle row update from Data View (inline editing)
  const handleDataViewRowUpdate = async (
    rowId: number | string,
    field: string,
    value: unknown
  ): Promise<{ success: boolean; error?: string }> => {
    if (!dataViewTemplateId) {
      return { success: false, error: "No template selected" };
    }
    try {
      // Special case: -1 means "no template" - update directly via Foundation API
      if (dataViewTemplateId === -1) {
        await api.patch(`/api/v1/foundations/sm-schedule-master/records/${rowId}`, {
          record: { [field]: value },
        });
      } else {
        await api.patch(`/api/v1/sm_schedule_master_templates/${dataViewTemplateId}/rows/${rowId}`, {
          row: { [field]: value },
        });
      }
      // SSoT: Refresh TeeemTableView (primary data display via Foundation API)
      setDataViewRefreshKey(prev => prev + 1);
      // Also refresh predecessor selector list (secondary use) - skip for "no template" view
      if (dataViewTemplateId !== -1) {
        loadDataViewRows(dataViewTemplateId);
      }
      // Refresh no-template count in case template was added/removed
      loadNoTemplateCount();
      return { success: true };
    } catch (error) {
      console.error("Failed to update row:", error);
      return { success: false, error: "Failed to update row" };
    }
  };

  // ==========================================================================
  // SSoT EditRowDialog Integration
  // ==========================================================================

  // Helper: Convert SmScheduleMaster to EditRowData for shared dialog
  const convertToEditRowData = React.useCallback((row: SmScheduleMaster): EditRowData => {
    return {
      id: row.id,
      task_number: row.task_number,
      name: row.name,
      description: row.description || undefined,
      duration_days: row.duration_days,
      sequence_order: row.sequence_order,
      trade: extractLookupId(row.trade) || undefined,
      trade_name: row.trade_name || extractLookupDisplay(row.trade) || undefined,
      stage: extractLookupId(row.stage) || undefined,
      stage_name: row.stage_name || extractLookupDisplay(row.stage) || undefined,
      assigned_role: extractLookupId(row.assigned_role) || null,
      cost_centre: extractLookupId(row.cost_centre) || undefined,
      header_gantt: extractLookupId(row.header_gantt) || undefined,
      allow_header: row.allow_header || false,
      is_active: row.is_active !== false,
      po_required: row.po_required || false,
      critical_po: row.critical_po || false,
      create_po_on_job_start: row.create_po_on_job_start || false,
      spawn_order_task: row.spawn_order_task || false,
      spawn_call_task: row.spawn_call_task || false,
      require_photo: row.require_photo || false,
      pass_fail_enabled: row.pass_fail_enabled || false,
      checklist_id: typeof row.checklist_id === 'number' ? row.checklist_id : undefined,
      is_claim_task: row.is_claim_task || false,
      is_variation: row.is_variation || false,
      claim_percentage: row.claim_percentage,
      claim_invoice_pattern: row.claim_invoice_pattern,
      claim_invoice_template_id: extractLookupId(row.claim_invoice_template_id)
        ? parseInt(extractLookupId(row.claim_invoice_template_id)!)
        : (typeof row.claim_invoice_template_id === 'number' ? row.claim_invoice_template_id : undefined),
      claim_trading_name_id: extractLookupId(row.claim_trading_name_id)
        ? parseInt(extractLookupId(row.claim_trading_name_id)!)
        : (typeof row.claim_trading_name_id === 'number' ? row.claim_trading_name_id : undefined),
      // Template membership (Schedule Master specific)
      sm_template_ids: (row.sm_template_ids || []).map((item: number | { id: number }) =>
        typeof item === 'object' ? item.id : item
      ),
      // Document types for GET task spawning (SSoT: sm_schedule_master_document_types join table)
      document_types: row.document_types || [],
      // Workflow triggers
      start_workflow_enabled: row.start_workflow_enabled || false,
      start_workflow_id: row.start_workflow_id || null,
      start_workflow_name: row.start_workflow_name || null,
      complete_workflow_enabled: row.complete_workflow_enabled || false,
      complete_workflow_id: row.complete_workflow_id || null,
      complete_workflow_name: row.complete_workflow_name || null,
      // Completion document requirement
      requires_document_to_complete: row.requires_document_to_complete || false,
      completion_document_type_id: row.completion_document_type_id || null,
      completion_document_type_name: row.completion_document_type_name || null,
      // Related PO tasks for supplier coordination info
      related_po_task_ids: row.related_po_task_ids || [],
      related_po_task_names: row.related_po_task_names || [],
      // Linked tasks (visibility follows this task)
      linked_task_ids: row.linked_task_ids || [],
      // Completion linked tasks (cascade complete together)
      completion_linked_task_ids: row.completion_linked_task_ids || [],
    };
  }, []);

  // SSoT: Save handler for EditRowDialog
  const handleEditRowSave = React.useCallback(async (rowId: number, data: EditRowFormData) => {
    // activeEditTemplateId can be:
    // - null: no template context (shouldn't happen)
    // - -1: "No Template Selected" view - use Foundation API
    // - positive number: specific template - use template API
    if (activeEditTemplateId === null) {
      throw new Error("No active template to save to");
    }

    // Transform EditRowFormData to API payload
    const rowPayload: Record<string, unknown> = {
      name: data.name,
      description: data.description,
      duration_days: data.duration_days,
      sequence_order: data.sequence_order,
      trade: data.trade,
      stage: data.stage,
      assigned_role: data.assigned_role,
      cost_centre: data.cost_centre,
      header_gantt: data.header_gantt,
      allow_header: data.allow_header,
      is_active: data.is_active,
      po_required: data.po_required,
      critical_po: data.critical_po,
      create_po_on_job_start: data.create_po_on_job_start,
      spawn_order_task: data.spawn_order_task,
      spawn_call_task: data.spawn_call_task,
      require_photo: data.require_photo,
      pass_fail_enabled: data.pass_fail_enabled,
      checklist_id: data.checklist_id,
      is_claim_task: data.is_claim_task,
      is_variation: data.is_variation,
      claim_percentage: data.claim_percentage,
      claim_invoice_pattern: data.claim_invoice_pattern,
      claim_invoice_template_id: data.claim_invoice_template_id,
      claim_trading_name_id: data.claim_trading_name_id,
      // Template membership - which templates this row belongs to
      sm_template_ids: data.sm_template_ids,
      // Workflow triggers
      start_workflow_enabled: data.start_workflow_enabled,
      start_workflow_id: data.start_workflow_id,
      complete_workflow_enabled: data.complete_workflow_enabled,
      complete_workflow_id: data.complete_workflow_id,
      // Completion document requirement
      requires_document_to_complete: data.requires_document_to_complete,
      completion_document_type_id: data.completion_document_type_id,
      // Related PO tasks for supplier coordination
      related_po_task_ids: data.related_po_task_ids,
      // Linked tasks (visibility follows this task)
      linked_task_ids: data.linked_task_ids,
      // Completion linked tasks (cascade complete together)
      completion_linked_task_ids: data.completion_linked_task_ids,
    };

    // Transform document_types to Rails nested attributes format (SSoT: sm_schedule_master_document_types)
    if (data.document_types !== undefined) {
      rowPayload.sm_schedule_master_document_types_attributes = data.document_types.map(dt => ({
        id: dt.id || undefined, // Include id for existing records
        document_type_id: dt.document_type_id,
        lag_days: dt.lag_days || 0,
        assigned_role: dt.assigned_role || null,
      }));
    }

    // SSoT: Use Foundation API for "No Template Selected" view, template API otherwise
    if (activeEditTemplateId === -1) {
      // "No Template Selected" - use Foundation API directly
      await api.patch(`/api/v1/foundations/sm-schedule-master/records/${rowId}`, {
        record: rowPayload,
      });
    } else {
      // Specific template - use template API
      await api.patch(`/api/v1/sm_schedule_master_templates/${activeEditTemplateId}/rows/${rowId}`, {
        row: rowPayload,
      });
    }

    // Refresh data
    setDataViewRefreshKey(prev => prev + 1);
    loadDataViewRows(dataViewTemplateId);
    if (activeEditTemplateId === ganttTemplateId && ganttTemplateId) {
      loadGanttData();
    }
  }, [activeEditTemplateId, dataViewTemplateId, ganttTemplateId, loadDataViewRows, loadGanttData]);

  // SSoT: Refresh handler for EditRowDialog
  const handleEditRowRefresh = React.useCallback(() => {
    setDataViewRefreshKey(prev => prev + 1);
    loadDataViewRows(dataViewTemplateId);
    if (ganttTemplateId) {
      loadGanttData();
    }
  }, [dataViewTemplateId, ganttTemplateId, loadDataViewRows, loadGanttData]);

  // SSoT: Copy to template handler for EditRowDialog
  const handleCopyToTemplate = React.useCallback(async (templateId: number, rowId: number) => {
    // Add template membership via API
    if (!editingRow) return;
    const currentTemplateIds = editingRow.sm_template_ids || [];
    const normalizedIds = currentTemplateIds.map((item: number | { id: number }) =>
      typeof item === 'object' ? item.id : item
    );
    if (!normalizedIds.includes(templateId)) {
      normalizedIds.push(templateId);
    }
    await api.patch(`/api/v1/sm_schedule_master_templates/${activeEditTemplateId}/rows/${rowId}`, {
      row: { sm_template_ids: normalizedIds },
    });
    handleEditRowRefresh();
  }, [editingRow, activeEditTemplateId, handleEditRowRefresh]);

  // SSoT: Child task update handler for EditRowDialog
  const handleChildTaskHeaderUpdate = React.useCallback(async (childId: number, headerGantt: number | null) => {
    if (!activeEditTemplateId) return;
    await api.patch(`/api/v1/sm_schedule_master_templates/${activeEditTemplateId}/rows/${childId}`, {
      row: { header_gantt: headerGantt },
    });
    handleEditRowRefresh();
  }, [activeEditTemplateId, handleEditRowRefresh]);

  // Handle row double-click - open edit sheet
  // SSoT: Use row directly from TeeemTableView callback (Foundation API data)
  // Don't lookup from dataViewRows which comes from custom endpoint with broken lookup expansion
  const handleDataViewRowDoubleClick = (row: Record<string, unknown>) => {
    setActiveEditTemplateId(dataViewTemplateId); // Track which template to save to

    // Cast row from TeeemTableView - it has all the data with proper lookup expansion from Foundation API
    const fullRow = row as unknown as SmScheduleMaster;
    setEditingRow(fullRow);
    // SSoT: Convert to EditRowData for shared EditRowDialog
    setSelectedRowForEdit(convertToEditRowData(fullRow));
    setShowEditSheet(true);
  };

  // Handle Gantt task double-click - open edit sheet
  const handleGanttTaskDoubleClick = (task: GanttTask) => {
    console.log('[ScheduleMasterTab] handleGanttTaskDoubleClick called with task:', task.id, task.name);
    setActiveEditTemplateId(ganttTemplateId); // Track which template to save to

    // Extract row data from task.rowData (set by convertRowsToTasks)
    const rowData = task.rowData as GanttSmScheduleMaster | undefined;
    if (!rowData) {
      console.error('[Gantt] No rowData found on task:', task);
      return;
    }

    // Convert to SmScheduleMaster format for the edit sheet
    // Note: GanttSmScheduleMaster uses supplier_id/supplier_name, local type uses po_supplier_id/po_supplier_name
    const fullRow: SmScheduleMaster = {
      id: Number(task.id),
      task_number: rowData.task_number,
      name: rowData.name,
      description: rowData.description || undefined,
      duration_days: rowData.duration_days,
      sequence_order: rowData.sequence_order,
      predecessor_ids: rowData.predecessor_ids || [],
      trade: rowData.trade || undefined,
      stage: rowData.stage || undefined,
      trade_name: rowData.trade || undefined,
      stage_name: rowData.stage || undefined,
      assigned_role: rowData.assigned_role || undefined,
      cost_centre: rowData.cost_centre || undefined,
      header_gantt: rowData.header_gantt || undefined,
      allow_header: rowData.allow_header || false,
      is_active: rowData.is_active ?? true,
      tags: rowData.tags || [],
      po_required: rowData.po_required || false,
      critical_po: rowData.critical_po || false,
      create_po_on_job_start: rowData.create_po_on_job_start || false,
      spawn_order_task: (rowData as unknown as SmScheduleMaster).spawn_order_task || false,
      spawn_call_task: (rowData as unknown as SmScheduleMaster).spawn_call_task || false,
      order_time_days: rowData.order_time_days ?? undefined,
      call_time_days: rowData.call_time_days ?? undefined,
      require_photo: rowData.require_photo || false,
      pass_fail_enabled: rowData.pass_fail_enabled || false,
      po_supplier_id: rowData.supplier_id ?? undefined,
      po_supplier_name: rowData.supplier_name ?? undefined,
      po_line_items: undefined,
      linked_task_ids: rowData.linked_task_ids,
      sm_template_ids: rowData.sm_template_ids || [],
      is_claim_task: (rowData as unknown as SmScheduleMaster).is_claim_task || false,
      is_variation: (rowData as unknown as SmScheduleMaster).is_variation || false,
      claim_percentage: (rowData as unknown as SmScheduleMaster).claim_percentage ?? null,
      claim_invoice_pattern: (rowData as unknown as SmScheduleMaster).claim_invoice_pattern ?? null,
      claim_invoice_template_id: (rowData as unknown as SmScheduleMaster).claim_invoice_template_id ?? null,
      claim_trading_name_id: (rowData as unknown as SmScheduleMaster).claim_trading_name_id ?? null,
    };

    setEditingRow(fullRow);
    // SSoT: Convert to EditRowData for shared EditRowDialog
    setSelectedRowForEdit(convertToEditRowData(fullRow));
    setShowEditSheet(true);
  };

  // Gantt: Handle checkbox toggle (Started, Hold, Confirm, Supplier Confirm, Complete)
  const handleGanttCheckboxToggle = async (taskId: string, field: string, checked: boolean) => {
    if (!ganttTemplateId) return;

    console.log('[Gantt] Checkbox toggle:', taskId, field, checked);

    // For "started" field, check if task is under a header or has predecessors
    if (field === 'started' && checked) {
      const task = ganttTasks.find(t => t.id === taskId);
      if (!task) return;

      const row = task.rowData as GanttSmScheduleMaster | undefined;
      if (!row) {
        await executeGanttCheckboxToggle(taskId, field, checked);
        return;
      }

      // Check if task is under a header (has header_gantt that references a parent)
      const headerGanttValue = row.header_gantt;
      const isUnderHeader = headerGanttValue !== null &&
                            headerGanttValue !== undefined &&
                            headerGanttValue !== 'Header'; // 'Header' means this IS a header

      // Check if task has predecessors
      const hasPredecessors = (row.predecessor_ids?.length ?? 0) > 0;

      if (isUnderHeader || hasPredecessors) {
        // Find header name for display
        let headerName: string | null = null;
        if (isUnderHeader) {
          const headerTaskNumber = extractLookupId(headerGanttValue);
          if (headerTaskNumber) {
            // Find header row by task_number (ganttTasks has GanttTask with rowData)
            const headerTask = ganttTasks.find(t => String((t.rowData as SmScheduleMaster | undefined)?.task_number) === headerTaskNumber);
            const headerRow = headerTask?.rowData as SmScheduleMaster | undefined;
            headerName = headerRow?.name || extractLookupDisplay(headerGanttValue) || `Task #${headerTaskNumber}`;
          }
        }

        // Fetch holidays from API to check working days
        const today = new Date();
        const currentYear = today.getFullYear();
        let holidayDates: Set<string> | undefined;

        try {
          const holidayResponse = await api.get<{ dates: string[] }>(
            `/api/v1/public_holidays/dates?year_start=${currentYear - 1}&year_end=${currentYear + 1}&region=QLD`
          );
          if (holidayResponse?.dates) {
            holidayDates = new Set(holidayResponse.dates);
            console.log('[Start Task] Fetched holidays from API:', holidayResponse.dates.filter(d => d.startsWith('2026-01')));
          }
        } catch (err) {
          console.warn('[Gantt] Failed to fetch holidays from API:', err);
          // SSoT: No fallback - working day calculations proceed without holidays
        }

        console.log('[Start Task] Today:', today.toISOString().split('T')[0], 'isWorkingDay:', isWorkingDay(today, holidayDates));
        console.log('[Start Task] Holiday dates loaded:', holidayDates ? holidayDates.size : 0);

        // Check if today is a working day
        const isTodayWorking = isWorkingDay(today, holidayDates);
        const lastWorking = isTodayWorking ? null : skipToPreviousWorkingDay(today, holidayDates);
        console.log('[Start Task] isTodayWorking:', isTodayWorking, 'lastWorkingDay:', lastWorking?.toISOString().split('T')[0] || 'N/A');

        // Show start task dialog
        setStartTaskDialog({
          isOpen: true,
          task,
          headerName,
          hasPredecessors,
          isTodayWorkingDay: isTodayWorking,
          lastWorkingDay: lastWorking
        });
        return;
      }
    }

    // For supplier_confirm and confirm fields, show confirmation dialog first
    if (field === 'supplier_confirm' || field === 'confirm') {
      const task = ganttTasks.find(t => t.id === taskId);
      if (!task) return;

      const row = task.rowData as GanttSmScheduleMaster | undefined;
      if (!row) {
        // No row data, just save directly
        await executeGanttCheckboxToggle(taskId, field, checked);
        return;
      }

      // Find successors that depend on this task
      const successors = ganttTasks
        .filter(t => {
          const r = t.rowData as GanttSmScheduleMaster | undefined;
          return r?.predecessor_ids?.some((p: { id: number }) => p.id === row.task_number);
        })
        .map(t => t.rowData as GanttSmScheduleMaster);

      // Show confirmation dialog
      setConfirmDialog({
        isOpen: true,
        type: field === 'supplier_confirm' ? 'supplierConfirm' : 'confirm',
        task,
        isChecking: checked,
        affectedSuccessors: successors
      });
      return;
    }

    // For other fields, save directly
    await executeGanttCheckboxToggle(taskId, field, checked);
  };

  // SSoT: executeGanttCheckboxToggle now provided by useGanttDataManager hook (see aliases above)

  // SSoT: executeStartTask now provided by useGanttDataManager hook (see aliases above)

  // Gantt: Handle task drag (reschedule) - shows cascade dialog if successors exist
  const handleGanttTaskDrag = async (task: GanttTask, newStartDate: Date) => {
    if (!ganttTemplateId) return;

    // Store undo state before making changes
    storeGanttUndoState(task);

    console.log('[Gantt] Task dragged:', task.id, 'to', newStartDate);

    // Find the row for this task
    const row = task.rowData as GanttSmScheduleMaster | undefined;
    if (!row) {
      // No row data, just save directly
      await executeGanttDragMove(task, newStartDate);
      return;
    }

    // Recursive function to find all successors down the tree
    const findAllSuccessorsRecursive = (taskNumber: number, visited: Set<number> = new Set()): GanttSmScheduleMaster[] => {
      const directSuccessors = ganttTasks
        .filter(t => {
          const r = t.rowData as GanttSmScheduleMaster | undefined;
          return r?.predecessor_ids?.some((p: { id: number }) => p.id === taskNumber) && !visited.has(r.id);
        })
        .map(t => t.rowData as GanttSmScheduleMaster);

      let allDescendants = [...directSuccessors];

      directSuccessors.forEach(s => visited.add(s.id));

      directSuccessors.forEach(successor => {
        const childSuccessors = findAllSuccessorsRecursive(successor.task_number, visited);
        allDescendants = [...allDescendants, ...childSuccessors];
      });

      return allDescendants;
    };

    // Find direct successors
    const taskTaskNumber = row.task_number;
    const directSuccessors = ganttTasks
      .filter(t => {
        const r = t.rowData as GanttSmScheduleMaster | undefined;
        return r?.predecessor_ids?.some((p: { id: number }) => p.id === taskTaskNumber);
      })
      .map(t => t.rowData as GanttSmScheduleMaster);

    if (directSuccessors.length === 0) {
      // No successors, save directly
      await executeGanttDragMove(task, newStartDate);
      return;
    }

    // Build successor info with downstream data
    const visited = new Set<number>(directSuccessors.map(s => s.id));

    const successorInfo: SuccessorInfo[] = directSuccessors.map(s => {
      const downstreamSuccessors = findAllSuccessorsRecursive(s.task_number, new Set(visited));
      const lockedDownstream = downstreamSuccessors.filter(ds =>
        ds.confirm || ds.supplier_confirm || ds.is_completed
      );

      return {
        ...s,
        downstreamCount: downstreamSuccessors.length,
        downstreamTasks: lockedDownstream,
        lockedDownstreamCount: lockedDownstream.length,
        hasMoreDownstream: false
      };
    });

    // Categorize successors
    const lockedSuccessors = successorInfo.filter(s =>
      s.confirm || s.supplier_confirm || s.is_completed
    );
    const unlockedSuccessors = successorInfo.filter(s =>
      !s.confirm && !s.supplier_confirm && !s.is_completed
    );

    // If no locked successors, just execute move directly - unlocked tasks cascade automatically via SSoT
    if (lockedSuccessors.length === 0) {
      await executeGanttDragMove(task, newStartDate);
      return;
    }

    // Reset decisions - default all to 'break'
    const defaultDecisions: Record<number, 'break' | 'cascade'> = {};
    lockedSuccessors.forEach(s => {
      defaultDecisions[s.id] = 'break';
      s.downstreamTasks?.forEach((dt) => {
        defaultDecisions[dt.id] = 'break';
      });
    });
    setLockedTaskDecisions(defaultDecisions);

    // Show cascade dialog only when locked tasks need user decision
    setCascadeDialog({
      isOpen: true,
      task,
      newStartDate,
      successors: successorInfo,
      lockedSuccessors,
      unlockedSuccessors
    });
  };

  // SSoT: executeGanttDragMove now provided by useGanttDataManager hook (see aliases above)

  // Gantt: Handle task resize (change duration)
  const handleGanttTaskResize = async (task: GanttTask, _newStartDate: Date, newEndDate: Date) => {
    if (!ganttTemplateId) return;

    // Store undo state before making changes
    storeGanttUndoState(task);

    // Calculate new duration in days
    const startDate = task.startDate;
    const diffTime = newEndDate.getTime() - startDate.getTime();
    const newDuration = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    console.log('[Gantt] Task resized:', task.id, 'new duration:', newDuration);

    try {
      await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${task.id}`, {
        row: { duration_days: newDuration },
      });

      toast({ title: "Duration updated", description: `${newDuration} days` });

      // Refresh data
      loadGanttData();
    } catch (error) {
      console.error('[Gantt] Failed to save duration:', error);
      toast({ title: "Error", description: "Failed to update duration", variant: "destructive" });
    }
  };

  // Gantt: Handle inline duration change (from Days column double-click edit)
  const handleGanttDurationChange = async (taskId: string, newDuration: number) => {
    if (!ganttTemplateId) return;

    console.log('[Gantt] Duration changed via inline edit:', taskId, 'new duration:', newDuration);

    try {
      await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${taskId}`, {
        row: { duration_days: newDuration },
      });

      toast({ title: "Duration updated", description: `${newDuration} days` });

      // Refresh data
      loadGanttData();
    } catch (error) {
      console.error('[Gantt] Failed to save duration:', error);
      toast({ title: "Error", description: "Failed to update duration", variant: "destructive" });
    }
  };

  // Gantt: Handle rollover (move tasks off weekends/holidays AND cascade based on dependencies)
  // SSoT: POST /api/v1/sm_schedule_master_templates/:id/validate_dates
  const handleGanttRollover = async () => {
    if (!ganttTemplateId) return null;

    console.log('[Gantt] 🔄 Rollover starting for template:', ganttTemplateId);

    try {
      const result = await api.post<{
        success: boolean;
        updated: number;
        date_map: Record<number, { start_date: string; end_date: string }>;
        debug?: {
          tasks_processed: number;
          tasks_with_predecessors: number;
          cascade_updates: Array<{ task_number: number; name: string; old_start: string; new_start: string; reason: string }>;
        };
      }>(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/validate_dates`);

      console.log('[Gantt] 📦 Rollover result:', JSON.stringify(result, null, 2));

      if (result?.date_map) {
        console.log('[Gantt] 📅 Date map (tasks that changed):');
        Object.entries(result.date_map).forEach(([taskNum, dates]) => {
          console.log(`  Task ${taskNum}: ${dates.start_date} → ${dates.end_date}`);
        });
      }

      if (result?.debug) {
        console.log('[Gantt] 🐛 Debug info:');
        console.log(`  Tasks processed: ${result.debug.tasks_processed}`);
        console.log(`  Tasks with predecessors: ${result.debug.tasks_with_predecessors}`);
        if (result.debug.cascade_updates?.length > 0) {
          console.log('  Cascade updates:');
          result.debug.cascade_updates.forEach(u => {
            console.log(`    ${u.task_number} (${u.name}): ${u.old_start} → ${u.new_start} [${u.reason}]`);
          });
        }
      }

      if (result?.success) {
        toast({
          title: "Schedule Updated",
          description: `${result.updated} task(s) recalculated`,
        });

        // Refresh data to show new dates
        loadGanttData();

        return { rolled_over: result.updated, extended: 0, cascaded: 0 };
      }
      return null;
    } catch (error) {
      console.error('[Gantt] ❌ Rollover failed:', error);
      toast({ title: "Error", description: "Failed to validate dates", variant: "destructive" });
      return null;
    }
  };

  // Gantt: Update a single task (used for unlocking tasks in dependency editor)
  const handleGanttUpdateTask = async (taskId: string, updates: Record<string, unknown>) => {
    if (!ganttTemplateId) return;

    console.log('[Gantt] Updating task:', taskId, 'updates:', updates);

    try {
      await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${taskId}`, {
        row: updates,
      });

      // Refresh data
      loadGanttData();
    } catch (error) {
      console.error('[Gantt] Failed to update task:', error);
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    }
  };

  // Gantt: Handle dependency create
  const handleGanttDependencyCreate = async (fromId: string, toId: string, type: string) => {
    if (!ganttTemplateId) return;

    console.log('[Gantt] Dependency create:', fromId, '->', toId, 'type:', type);

    // Find the target task by task_number (toId is task_number from canvas)
    const targetTask = ganttTasks.find(t => t.rowData?.task_number === parseInt(toId, 10));
    if (!targetTask || !targetTask.rowData) {
      console.error('[Gantt] Target task not found:', toId);
      toast({ title: "Error", description: "Target task not found", variant: "destructive" });
      return;
    }

    // Get current predecessor_ids and add the new one
    const currentPreds = targetTask.rowData.predecessor_ids || [];
    const newPred = {
      id: parseInt(fromId, 10),
      type: type || 'FS',
      lag: 0
    };

    // Check if already exists
    if (currentPreds.some((p: { id: number }) => p.id === newPred.id)) {
      toast({ title: "Info", description: "Dependency already exists" });
      return;
    }

    try {
      // Save to API (cast to GanttSmScheduleMaster since we're in Gantt context)
      const rowData = targetTask.rowData as GanttSmScheduleMaster;
      await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${rowData.id}`, {
        row: {
          predecessor_ids: [...currentPreds, newPred]
        }
      });

      // Refresh data
      loadGanttData();
      toast({ title: "Success", description: "Dependency created" });
    } catch (error) {
      console.error('[Gantt] Failed to create dependency:', error);
      toast({ title: "Error", description: "Failed to create dependency", variant: "destructive" });
    }
  };

  // Gantt: Handle dependency delete
  const handleGanttDependencyDelete = async (dependencyId: string) => {
    if (!ganttTemplateId) return;

    console.log('[Gantt] Dependency delete:', dependencyId);

    // Parse dependency ID: format is "dep-{predecessor_task_number}-{row_id}"
    const match = dependencyId.match(/^dep-(\d+)-(\d+)$/);
    if (!match) {
      console.error('[Gantt] Invalid dependency ID format:', dependencyId);
      toast({ title: "Error", description: "Invalid dependency ID", variant: "destructive" });
      return;
    }

    const predecessorTaskNumber = parseInt(match[1], 10);
    const rowId = parseInt(match[2], 10);

    // Find the target task by row id (cast to GanttSmScheduleMaster since we're in Gantt context)
    const targetTask = ganttTasks.find(t => (t.rowData as GanttSmScheduleMaster | undefined)?.id === rowId);
    if (!targetTask || !targetTask.rowData) {
      console.error('[Gantt] Target task not found for row:', rowId);
      toast({ title: "Error", description: "Target task not found", variant: "destructive" });
      return;
    }

    // Remove the predecessor from predecessor_ids
    const currentPreds = targetTask.rowData.predecessor_ids || [];
    const updatedPreds = currentPreds.filter((p: { id: number }) => p.id !== predecessorTaskNumber);

    if (updatedPreds.length === currentPreds.length) {
      toast({ title: "Info", description: "Dependency not found" });
      return;
    }

    try {
      // Save to API
      await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${rowId}`, {
        row: {
          predecessor_ids: updatedPreds
        }
      });

      // Refresh data
      loadGanttData();
      toast({ title: "Success", description: "Dependency deleted" });
    } catch (error) {
      console.error('[Gantt] Failed to delete dependency:', error);
      toast({ title: "Error", description: "Failed to delete dependency", variant: "destructive" });
    }
  };

  // Gantt: Handle reset manual position (clear hold and hold_date)
  const handleGanttResetManualPosition = async (task: GanttTask) => {
    if (!ganttTemplateId) return;

    console.log('[Gantt] Reset manual position:', task.id);

    const row = task.rowData as GanttSmScheduleMaster | undefined;
    if (!row) {
      console.error('[Gantt] No row data for task:', task.id);
      return;
    }

    try {
      // Clear hold and hold_date
      await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${row.id}`, {
        row: {
          hold: false,
          hold_date: null
        }
      });

      // Refresh data
      loadGanttData();
      toast({ title: "Success", description: "Manual position reset" });
    } catch (error) {
      console.error('[Gantt] Failed to reset manual position:', error);
      toast({ title: "Error", description: "Failed to reset manual position", variant: "destructive" });
    }
  };

  // SSoT: storeGanttUndoState and handleGanttUndo are aliases to gantt.storeUndoState and gantt.handleUndo (see above)

  // Gantt: Open dependency editor
  const handleGanttEditDependencies = (task: GanttTask, visibleTasks: GanttTask[]) => {
    setDependencyEditorState({ isOpen: true, task, visibleTasks });
  };

  // Gantt: Save dependencies from full dependency editor (predecessors + successors)
  const handleDependencyEditorSave = async (
    taskId: string,
    predecessors: Array<{ taskNumber: number; type: string; lag: number }>,
    successors: Array<{ taskNumber: number; type: string; lag: number }>
  ) => {
    console.log('[handleDependencyEditorSave] Called with taskId:', taskId, 'predecessors:', predecessors);
    if (!ganttTemplateId) {
      console.log('[handleDependencyEditorSave] No templateId, returning early');
      return;
    }

    const task = ganttTasks.find(t => t.id === taskId);
    const taskRow = task?.rowData as GanttSmScheduleMaster | undefined;
    if (!taskRow) {
      console.log('[handleDependencyEditorSave] Task not found:', taskId);
      return;
    }

    console.log('[handleDependencyEditorSave] Found task:', taskRow.id, taskRow.name);

    const currentTaskNumber = taskRow.task_number;

    try {
      // 1. Update the current task's predecessors
      const newPredecessorIds = predecessors.map(p => ({
        id: p.taskNumber,
        type: p.type,
        lag: p.lag
      }));

      // When saving predecessors, also clear the broken dependency state
      // This handles restoring previously broken dependencies
      console.log('[handleDependencyEditorSave] Patching row', taskRow.id, 'with predecessor_ids:', newPredecessorIds);
      const result = await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${taskRow.id}`, {
        row: {
          predecessor_ids: newPredecessorIds,
          dependency_broken: false,
          predecessor_ids_backup: []
        }
      });
      console.log('[handleDependencyEditorSave] Patch result:', result);

      // 2. Update successors - each successor needs this task as a predecessor
      // Get current successors (tasks that have this task in their predecessor_ids)
      const currentSuccessors = ganttTasks.filter(t => {
        const r = t.rowData as GanttSmScheduleMaster | undefined;
        return r?.predecessor_ids?.some((p: { id: number }) => p.id === currentTaskNumber);
      });

      // Tasks that should be successors now
      const newSuccessorTaskNumbers = new Set(successors.map(s => s.taskNumber));

      // For each new successor that isn't already a successor, add this task as predecessor
      for (const succ of successors) {
        const succTask = ganttTasks.find(t => {
          const r = t.rowData as GanttSmScheduleMaster | undefined;
          return r?.task_number === succ.taskNumber;
        });
        const succRow = succTask?.rowData as GanttSmScheduleMaster | undefined;
        if (!succRow) continue;

        // Check if this task is already in successor's predecessors
        const alreadyHasPred = succRow.predecessor_ids?.some((p: { id: number }) => p.id === currentTaskNumber);
        if (!alreadyHasPred) {
          // Add this task as a predecessor to the successor
          const updatedPreds = [...(succRow.predecessor_ids || []), {
            id: currentTaskNumber,
            type: succ.type,
            lag: succ.lag
          }];
          await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${succRow.id}`, {
            row: { predecessor_ids: updatedPreds }
          });
        } else {
          // Update the existing predecessor entry (type/lag might have changed)
          const updatedPreds = (succRow.predecessor_ids || []).map((p: { id: number; type?: string; lag?: number }) =>
            p.id === currentTaskNumber ? { id: currentTaskNumber, type: succ.type, lag: succ.lag } : p
          );
          await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${succRow.id}`, {
            row: { predecessor_ids: updatedPreds }
          });
        }
      }

      // For each current successor that is no longer in the new list, remove this task from their predecessors
      for (const currSucc of currentSuccessors) {
        const r = currSucc.rowData as GanttSmScheduleMaster | undefined;
        if (!r) continue;
        if (!newSuccessorTaskNumbers.has(r.task_number)) {
          // Remove this task from successor's predecessors
          const updatedPreds = (r.predecessor_ids || []).filter((p: { id: number }) => p.id !== currentTaskNumber);
          await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${r.id}`, {
            row: { predecessor_ids: updatedPreds }
          });
        }
      }

      // Refresh data
      console.log('[handleDependencyEditorSave] ✅ Save complete for task', taskId, 'predecessor_ids:', newPredecessorIds);
      await loadGanttData();
      toast({ title: "Success", description: "Dependencies updated" });
    } catch (error) {
      console.error('[Gantt] Failed to save dependencies:', error);
      toast({ title: "Error", description: "Failed to save dependencies", variant: "destructive" });
      throw error; // Re-throw so the editor knows it failed
    }
  };

  // Save row from edit sheet (supports both manual and auto-save)
  const handleSaveRow = async (options?: { silent?: boolean }) => {
    if (!editingRow || !activeEditTemplateId) return;

    const silent = options?.silent ?? false;

    if (silent) {
      setAutoSaveStatus('saving');
    } else {
      setSavingRow(true);
    }

    try {
      // Transform document_types to nested attributes format for backend
      // SSoT: sm_schedule_master_document_types join table via accepts_nested_attributes_for
      const rowPayload: Record<string, unknown> = { ...editRowForm };
      if (editRowForm.document_types !== undefined) {
        // Get existing document type IDs to track what to destroy
        const existingDocTypes = editingRow.document_types || [];
        const newDocTypes = editRowForm.document_types || [];
        const newDocTypeIds = new Set(newDocTypes.map(dt => dt.document_type_id));

        // Build attributes array: new/updated items + items to destroy
        const attributes: Array<{
          id?: number;
          document_type_id: number;
          lag_days?: number;
          assigned_role?: string;
          _destroy?: boolean;
        }> = [];

        // Add new/updated document types
        for (const dt of newDocTypes) {
          const existing = existingDocTypes.find(e => e.document_type_id === dt.document_type_id);
          attributes.push({
            id: existing?.id, // Use existing join record ID if updating
            document_type_id: dt.document_type_id,
            lag_days: dt.lag_days || 0,
            assigned_role: dt.assigned_role,
          });
        }

        // Mark removed document types for destruction
        for (const existing of existingDocTypes) {
          if (!newDocTypeIds.has(existing.document_type_id)) {
            attributes.push({
              id: existing.id,
              document_type_id: existing.document_type_id,
              _destroy: true,
            });
          }
        }

        rowPayload.sm_schedule_master_document_types_attributes = attributes;
        delete rowPayload.document_types; // Don't send document_types directly
      }

      await api.patch(`/api/v1/sm_schedule_master_templates/${activeEditTemplateId}/rows/${editingRow.id}`, {
        row: rowPayload,
      });

      if (silent) {
        setAutoSaveStatus('saved');
        // Reset to idle after 2 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
        // SSoT: Refresh TeeemTableView (primary data display via Foundation API)
        setDataViewRefreshKey(prev => prev + 1);
        // Also refresh predecessor selector list (secondary use - still uses custom endpoint)
        loadDataViewRows(dataViewTemplateId);
        // Refresh Gantt if edit was from there
        if (activeEditTemplateId === ganttTemplateId && ganttTemplateId) {
          loadGanttData();
        }
      } else {
        toast({ title: "Success", description: "Row updated" });
        setShowEditSheet(false);
        // SSoT: Refresh TeeemTableView (primary data display via Foundation API)
        setDataViewRefreshKey(prev => prev + 1);
        // Also refresh predecessor selector list (secondary use)
        loadDataViewRows(dataViewTemplateId);
        // Refresh Gantt if edit was from there
        if (activeEditTemplateId === ganttTemplateId && ganttTemplateId) {
          loadGanttData();
        }
      }
    } catch (error) {
      console.error("Failed to save row:", error);
      if (silent) {
        setAutoSaveStatus('error');
        // Reset to idle after 3 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } else {
        toast({ title: "Error", description: "Failed to save row", variant: "destructive" });
      }
    } finally {
      if (!silent) {
        setSavingRow(false);
      }
    }
  };

  // Auto-save effect - debounced save when form changes
  React.useEffect(() => {
    // Skip auto-save on initial form load
    if (initialFormLoadRef.current) {
      initialFormLoadRef.current = false;
      return;
    }

    // Skip if sheet is not open or no row is being edited
    if (!showEditSheet || !editingRow) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for debounced save (500ms delay)
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveRow({ silent: true });
    }, 500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRowForm]);

  // Load suppliers for auto-PO
  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const response = await api.get<{ success: boolean; contacts: Array<{ id: number; display_name: string }> }>(
        "/api/v1/contacts?type=suppliers&limit=500"
      );
      setSuppliers(response.contacts || []);
    } catch (error) {
      console.error("[Auto-PO] Failed to load suppliers:", error);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  // Load price histories for supplier
  const loadPriceHistoriesForSupplier = async (supplierId: string) => {
    if (!supplierId) {
      setPriceHistories([]);
      return;
    }
    setLoadingPriceHistories(true);
    try {
      const response = await api.get<{ success: boolean; data: Array<{
        id: number;
        pricebook_item_id: number;
        pricebook_item_name: string;
        pricebook_item_code: string;
        new_price: number | string;
      }> }>(`/api/v1/pricebook/all_price_histories?supplier_id=${supplierId}&limit=500`);
      setPriceHistories(response.data || []);
    } catch (error) {
      console.error("Failed to load price histories:", error);
    } finally {
      setLoadingPriceHistories(false);
    }
  };

  // Open auto-PO config dialog
  const handleOpenAutoPODialog = () => {
    if (!editingRow) return;
    setSelectedSupplierId(editingRow.po_supplier_id ? String(editingRow.po_supplier_id) : "");
    // Initialize from po_line_items if available
    if (editingRow.po_line_items && editingRow.po_line_items.length > 0) {
      setPoLineItems(editingRow.po_line_items);
    } else {
      setPoLineItems([]);
    }
    setPriceHistories([]);
    setShowAutoPODialog(true);
    loadSuppliers();
    if (editingRow.po_supplier_id) {
      loadPriceHistoriesForSupplier(String(editingRow.po_supplier_id));
    }
  };

  // Handle supplier change
  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    setPoLineItems([]);
    if (supplierId) {
      loadPriceHistoriesForSupplier(supplierId);
    } else {
      setPriceHistories([]);
    }
  };

  // Toggle pricebook item selection (adds with qty=1 or removes)
  const togglePricebookItemSelection = (pricebookItemId: number) => {
    setPoLineItems(prev => {
      const existing = prev.find(item => item.pricebook_item_id === pricebookItemId);
      if (existing) {
        return prev.filter(item => item.pricebook_item_id !== pricebookItemId);
      } else {
        return [...prev, { pricebook_item_id: pricebookItemId, qty: 1 }];
      }
    });
  };

  // Update quantity for a line item
  const updateLineItemQty = (pricebookItemId: number, qty: number) => {
    setPoLineItems(prev =>
      prev.map(item =>
        item.pricebook_item_id === pricebookItemId ? { ...item, qty: Math.max(1, qty) } : item
      )
    );
  };

  // Save auto-PO configuration
  const handleSaveAutoPO = async () => {
    if (!editingRow || !dataViewTemplateId) return;
    setSavingAutoPO(true);
    try {
      await api.patch(`/api/v1/sm_schedule_master_templates/${dataViewTemplateId}/rows/${editingRow.id}`, {
        row: {
          create_po_on_job_start: true,
          po_supplier_id: selectedSupplierId ? parseInt(selectedSupplierId) : null,
          po_line_items: poLineItems,
        },
      });
      toast({ title: "Success", description: "Auto-PO configuration saved" });
      setShowAutoPODialog(false);
      // Update the editing row state
      setEditingRow(prev => prev ? {
        ...prev,
        create_po_on_job_start: true,
        po_supplier_id: selectedSupplierId ? parseInt(selectedSupplierId) : null,
        po_supplier_name: suppliers.find(s => s.id === parseInt(selectedSupplierId))?.display_name || null,
        po_line_items: poLineItems,
      } : null);
      setEditRowForm(prev => ({ ...prev, create_po_on_job_start: true }));
      // SSoT: Refresh TeeemTableView (primary data display via Foundation API)
      setDataViewRefreshKey(prev => prev + 1);
      loadDataViewRows(dataViewTemplateId);
    } catch (error) {
      console.error("Failed to save auto-PO:", error);
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSavingAutoPO(false);
    }
  };

  // Clear auto-PO configuration
  const handleClearAutoPO = async () => {
    if (!editingRow || !dataViewTemplateId) return;
    setSavingAutoPO(true);
    try {
      await api.patch(`/api/v1/sm_schedule_master_templates/${dataViewTemplateId}/rows/${editingRow.id}`, {
        row: {
          create_po_on_job_start: false,
          po_supplier_id: null,
          po_line_items: [],
        },
      });
      toast({ title: "Success", description: "Auto-PO cleared" });
      setShowAutoPODialog(false);
      setEditingRow(prev => prev ? {
        ...prev,
        create_po_on_job_start: false,
        po_supplier_id: null,
        po_supplier_name: null,
        po_line_items: [],
      } : null);
      setEditRowForm(prev => ({ ...prev, create_po_on_job_start: false }));
      // SSoT: Refresh TeeemTableView (primary data display via Foundation API)
      setDataViewRefreshKey(prev => prev + 1);
      loadDataViewRows(dataViewTemplateId);
    } catch (error) {
      console.error("Failed to clear auto-PO:", error);
      toast({ title: "Error", description: "Failed to clear", variant: "destructive" });
    } finally {
      setSavingAutoPO(false);
    }
  };

  // SSoT: Data View fullscreen escape handler removed - now handled by TeeemTableView

  // SSoT: loadGanttData now provided by useGanttDataManager hook (see aliases above)
  // The hook's loadData is automatically triggered when ganttTemplateId changes

  // Load Gantt data when template is selected
  React.useEffect(() => {
    if (ganttTemplateId) {
      console.log('[ScheduleMasterTab] Loading Gantt data for template:', ganttTemplateId);
      gantt.loadData();
    }
  }, [ganttTemplateId, gantt.loadData]);

  // Reload when showAllPOTasks changes (separate effect for clarity)
  // Use ref pattern to avoid stale closure - loadData references apiConfig which includes showAllPOTasks/showClaims
  const loadDataRef = React.useRef(gantt.loadData);
  loadDataRef.current = gantt.loadData; // Always update to latest on every render

  const isFirstRenderForToggles = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRenderForToggles.current) {
      isFirstRenderForToggles.current = false;
      return;
    }
    if (ganttTemplateId) {
      console.log('[ScheduleMasterTab] Toggle changed - showAllPOTasks:', showAllPOTasks, 'showClaims:', showClaims, '- reloading data');
      loadDataRef.current(); // Always calls latest version with correct apiConfig
    }
  }, [showAllPOTasks, showClaims, ganttTemplateId]);

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="h-full w-full flex flex-col">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col relative">
        <TabsList className="shrink-0 justify-start gap-1">
          <TabsTrigger value="schedule-templates">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Templates
          </TabsTrigger>
          <TabsTrigger value="display-settings">
            <Settings className="h-4 w-4 mr-2" />
            Display Settings
          </TabsTrigger>
          <TabsTrigger value="gantt">
            <BarChart3 className="h-4 w-4 mr-2" />
            Gantt
          </TabsTrigger>
          <TabsTrigger value="data-view">
            <TableIcon className="h-4 w-4 mr-2" />
            Data View
          </TabsTrigger>
          <TabsTrigger value="column-reference">
            <BookOpen className="h-4 w-4 mr-2" />
            Column Reference
          </TabsTrigger>
          <TabsTrigger value="recurring-tasks">
            <ClipboardList className="h-4 w-4 mr-2" />
            Recurring Tasks
          </TabsTrigger>
          <TabsTrigger value="tables">
            <TableIcon className="h-4 w-4 mr-2" />
            Tables
          </TabsTrigger>
        </TabsList>

        {/* Tab content container - flex-1 to fill remaining space, relative for absolute children */}
        <div className="flex-1 min-h-0 relative mt-2 h-full">
          <TabsContent value="schedule-templates" className="absolute inset-0 overflow-auto px-4 pt-4 space-y-6 data-[state=inactive]:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Schedule Master Templates</h2>
              <p className="text-sm text-muted-foreground">
                Create and manage schedule templates for different job types.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-inactive"
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
                <Label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer">
                  Show inactive
                </Label>
              </div>
              <Button onClick={handleOpenAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </div>
          </div>

              {templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No templates yet</h3>
                <p className="text-center max-w-md mb-4">
                  Create schedule templates to quickly set up task schedules for new jobs.
                </p>
                <Button onClick={handleOpenAddDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <Card key={template.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => toggleExpand(template.id)}
                      >
                        <ExpandChevron expanded={expandedTemplate === template.id} size={20} className="text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            {!template.is_active && (
                              <Badge variant="outline" className="text-muted-foreground bg-muted">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <CardDescription className="mt-1">{template.description}</CardDescription>
                          )}
                          {template.copied_from_name && (
                            <CardDescription className="mt-1 text-xs text-muted-foreground/70">
                              Copy of: {template.copied_from_name}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {template.row_count || (template.rows?.length ?? 0)} tasks
                        </Badge>
                        <Badge variant="outline">
                          {getTotalDuration(template.rows || [])} days
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditDialog(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(template.id)}
                          disabled={duplicating === template.id}
                        >
                          {duplicating === template.id ? (
                            <Spinner size={16} />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(template.id)}
                          disabled={deleting === template.id}
                        >
                          {deleting === template.id ? (
                            <Spinner size={16} />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {expandedTemplate === template.id && (
                    <CardContent>
                      {loadingRows === template.id ? (
                        <div className="flex items-center justify-center py-8">
                          <Spinner size={24} className="text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          <div className="border rounded-lg divide-y">
                            {[...(template.rows || [])]
                              .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
                              .map((row, index) => (
                                <div
                                  key={row.id}
                                  className="flex items-center gap-4 p-3 hover:bg-muted/50"
                                >
                                  <span className="w-6 text-center text-sm text-muted-foreground">
                                    {row.task_number || index + 1}
                                  </span>
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{row.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {row.trade && (
                                        <span className="text-xs text-muted-foreground">
                                          {typeof row.trade === 'object' && row.trade !== null ? (row.trade as { display?: string }).display : row.trade}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {row.duration_days} days
                                  </Badge>
                                  {row.po_required && (
                                    <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400">
                                      PO
                                    </Badge>
                                  )}
                                  {row.require_photo && (
                                    <Badge variant="outline" className="text-xs text-blue-600 dark:text-blue-400">
                                      <Camera className="h-3 w-3" />
                                    </Badge>
                                  )}
                                </div>
                              ))}
                          </div>

                          <div className="mt-4 flex justify-end">
                            <Button variant="outline" size="sm" asChild>
                              <a href={`/schedule-templates/${template.id}`}>
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit Rows
                              </a>
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

          <TabsContent value="display-settings" className="absolute inset-0 overflow-auto px-4 pt-4 data-[state=inactive]:hidden">
          <SMGanttTab />
        </TabsContent>

          {/* Gantt Tab */}
          <TabsContent value="gantt" className="absolute top-0 right-0 bottom-0 left-4 overflow-hidden data-[state=inactive]:hidden">
          <div className="flex flex-col h-full">
            {/* Template selector header */}
            <div className="flex items-center gap-4 px-4 py-2 border-b bg-background">
              <Select
                value={ganttTemplateId ? String(ganttTemplateId) : ""}
                onValueChange={(value) => {
                  if (value) {
                    setGanttTemplateId(parseInt(value));
                  }
                }}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a template to preview..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={String(template.id)}>
                      {template.name} ({template.row_count} tasks)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ganttTasks.length > 0 && (
                <Badge variant="secondary">
                  {ganttTasks.length} tasks
                </Badge>
              )}
              {/* Toggle switches for visibility filters */}
              <div className="flex items-center gap-4 ml-auto">
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-claims"
                    checked={showClaims}
                    onCheckedChange={setShowClaims}
                  />
                  <Label htmlFor="show-claims" className="text-sm cursor-pointer">
                    Show Claims
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-all-po"
                    checked={showAllPOTasks}
                    onCheckedChange={setShowAllPOTasks}
                  />
                  <Label htmlFor="show-all-po" className="text-sm cursor-pointer">
                    Show All PO Tasks
                  </Label>
                </div>
              </div>
            </div>

            {/* Gantt content */}
            <div className="flex-1 min-h-0">
              {ganttLoading && (
                <div className="flex items-center justify-center h-full">
                  <Spinner size={32} className="text-muted-foreground" />
                </div>
              )}

              {!ganttLoading && !ganttTemplateId && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Select a template</h3>
                  <p className="text-center max-w-md">
                    Choose a schedule template from the dropdown above to preview in Gantt.
                  </p>
                </div>
              )}

              {!ganttLoading && ganttTemplateId && ganttTasks.length > 0 && (
                <GanttUnified
                  tasks={ganttTasks}
                  dependencies={ganttDependencies}
                  templateId={ganttTemplateId}
                  showToolbar={true}
                  showBaselineControls={false}
                  className="h-full"
                  onTaskClick={gantt.handleTaskClick}
                  onTaskDoubleClick={handleGanttTaskDoubleClick}
                  onTaskDrag={gantt.handleTaskDrag}
                  onTaskResize={gantt.handleTaskResize}
                  onCheckboxToggle={gantt.handleCheckboxToggle}
                  onDependencyCreate={gantt.handleDependencyCreate}
                  onDependencyDelete={gantt.handleDependencyDelete}
                  onResetManualPosition={gantt.handleResetManualPosition}
                  onUndo={gantt.handleUndo}
                  onEditDependencies={gantt.openDependencyEditor}
                  onDurationChange={gantt.handleDurationChange}
                  onRollover={handleGanttRollover}
                  onDataChange={gantt.loadData}
                />
              )}
            </div>
          </div>
        </TabsContent>

          {/* Data View Tab - Full TeeemTableView */}
          <TabsContent value="data-view" className="absolute inset-0 flex flex-col data-[state=inactive]:hidden">
          {/* SSoT: Fullscreen now handled by TeeemTableView via enableFullscreen prop */}
          <div className="flex flex-col h-full">
            <TeeemTableView
              key={`${dataViewRefreshKey}-${selectedTagFilter}-${dataViewTemplateId}`}
              foundationId="sm-schedule-master"
              tableName={dataViewTemplateId === -1
                ? "No Template Selected"
                : dataViewTemplateId
                  ? templates.find(t => t.id === dataViewTemplateId)?.name || "PO Schedule Master"
                  : "PO Schedule Master"
              }
              autoFetchRecords={!!dataViewTemplateId || !!effectiveViewSlug}
              initialFilters={dataViewTemplateId ? (() => {
                // SSoT: Template filter is ALWAYS applied, even when a saved view is active
                // Views add additional filters on TOP of the template filter
                // Special case: -1 means "no template selected" - filter for empty sm_template_ids
                if (dataViewTemplateId === -1) {
                  return [
                    { id: "template", column: "sm_template_ids", operator: "is_empty" as const, value: "", label: "No Template" },
                    ...(selectedTagFilter ? [{ id: "tag", column: "tags", operator: "contains" as const, value: selectedTagFilter, label: `Tag: ${selectedTagFilter}` }] : [])
                  ];
                }
                const currentTemplate = templates.find(t => t.id === dataViewTemplateId);
                return [
                  { id: "template", column: "sm_template_ids", operator: "array_contains" as const, value: String(dataViewTemplateId), label: `Template: ${currentTemplate?.name || 'Selected'}` },
                  ...(selectedTagFilter ? [{ id: "tag", column: "tags", operator: "contains" as const, value: selectedTagFilter, label: `Tag: ${selectedTagFilter}` }] : [])
                ];
              })() : []}
              onRefresh={() => {
                setDataViewRefreshKey(prev => prev + 1);
              }}
              onRowUpdate={handleDataViewRowUpdate}
              onRowDoubleClick={handleDataViewRowDoubleClick}
              initialShowTotals={true}
              viewSlug={effectiveViewSlug}
              defaultViewSlug={effectiveViewSlug}
              onViewChange={handleViewChange}
              leftActions={
                <div className="flex items-center gap-2">

                  {/* Template selector */}
                  <Select
                    value={dataViewTemplateId ? String(dataViewTemplateId) : ""}
                    onValueChange={(value) => {
                      if (value) {
                        const newTemplateId = parseInt(value);

                        if (viewSlug) {
                          // ⚠️ DO NOT SIMPLIFY - View must clear BEFORE template applies (v2695, v2711)
                          // ═══════════════════════════════════════════════════════════════════════════
                          // Why: TeeemTableView applies saved view filters when viewSlug is set.
                          //      If we set templateId while viewSlug is active, BOTH filters apply
                          //      → 0 records (template filter conflicts with view filter)
                          // Fix: Use overrideViewSlugClear to immediately tell TeeemTableView
                          //      to ignore the viewSlug. Then update URL (cosmetic).
                          //
                          // v2711: Jotai atom (smDataViewTemplateIdAtom) survives remount.
                          //        No sessionStorage needed - atom persists outside component.
                          // ═══════════════════════════════════════════════════════════════════════════
                          pendingTemplateIdRef.current = newTemplateId; // Guard for handleViewChange
                          setOverrideViewSlugClear(true); // Immediately clear view for TeeemTableView
                          setDataViewTemplateId(newTemplateId);
                          setDataViewRefreshKey(k => k + 1);
                          router.push(`${basePath}/data-view`, { scroll: false });
                          // Clear ref after a tick to allow state to propagate
                          setTimeout(() => {
                            pendingTemplateIdRef.current = null;
                          }, 0);
                        } else {
                          // No view active, apply template immediately
                          setDataViewTemplateId(newTemplateId);
                          setDataViewRefreshKey(k => k + 1);
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select a template to view..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={String(template.id)}>
                          {template.name} ({template.row_count} rows)
                        </SelectItem>
                      ))}
                      {/* Special option to show items with no template */}
                      <SelectItem value="-1" className="text-muted-foreground border-t mt-1 pt-1">
                        No Template Selected ({noTemplateCount} rows)
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Tag filter dropdown */}
                  <Select
                    value={selectedTagFilter || "__all__"}
                    onValueChange={(v) => setSelectedTagFilter(v === "__all__" ? "" : v)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="All Tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Tags</SelectItem>
                      {availableTags.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Tag management menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowTagDialog(true)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Manage Tags
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              }
            />
            {!dataViewTemplateId && !effectiveViewSlug && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <TableIcon className="h-12 w-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select a template</h3>
                <p className="text-center max-w-md">
                  Choose a schedule template from the dropdown above to view its rows.
                </p>
              </div>
            )}
            {dataViewLoading && (
              <div className="flex items-center justify-center py-12">
                <Spinner size={32} className="text-muted-foreground" />
              </div>
            )}
          </div>
        </TabsContent>

          {/* Column Reference Tab */}
          <TabsContent value="column-reference" className="absolute inset-0 overflow-auto p-4 data-[state=inactive]:hidden">
          <div className="space-y-8 max-w-5xl">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Schedule Master Column Reference</h2>
                  <p className="text-sm text-muted-foreground">
                    Complete documentation of all {totalColumns} columns in the sm_schedule_master table.
                  </p>
                </div>
                <div className="flex gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completeCount}</div>
                    <div className="text-muted-foreground">Complete</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{totalColumns - completeCount}</div>
                    <div className="text-muted-foreground">Remaining</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search columns..."
                    value={columnSearch}
                    onChange={(e) => setColumnSearch(e.target.value)}
                    className="pl-9"
                  />
                  {columnSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setColumnSearch("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <Progress value={(completeCount / totalColumns) * 100} className="flex-1" />
                <span className="text-sm font-medium">{Math.round((completeCount / totalColumns) * 100)}%</span>
              </div>
            </div>

            {/* Core Identity */}
            {sectionHasMatches(["task_number", "name", "description", "sequence_order", "header_gantt", "allow_header"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Core Identity</CardTitle>
                <CardDescription>Basic task identification fields</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("task_number") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["task_number"] || false} onCheckedChange={(v) => updateColumnStatus("task_number", !!v)} />
                    <CopyableCode>task_number</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">The unique number shown next to each task (e.g., Task #47). Used when referencing tasks in dependencies like &quot;starts after Task 46&quot;.</span>
                  </div>
                  )}
                  {columnMatchesSearch("name") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["name"] || false} onCheckedChange={(v) => updateColumnStatus("name", !!v)} />
                    <CopyableCode>name</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">The main title of the task that appears in the Gantt chart and lists (e.g., &quot;Slab Pour&quot;, &quot;Frame Inspection&quot;). Keep it short and descriptive.</span>
                  </div>
                  )}
                  {columnMatchesSearch("description") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["description"] || false} onCheckedChange={(v) => updateColumnStatus("description", !!v)} />
                    <CopyableCode>description</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">text</Badge>
                    <span className="text-muted-foreground">Additional notes or instructions for this task. Use this for details like special requirements, contact numbers, or things to watch out for.</span>
                  </div>
                  )}
                  {columnMatchesSearch("sequence_order") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["sequence_order"] || false} onCheckedChange={(v) => updateColumnStatus("sequence_order", !!v)} />
                    <CopyableCode>sequence_order</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">decimal</Badge>
                    <span className="text-muted-foreground">Determines where this task appears in the list. Lower numbers appear first. You can use decimals (e.g., 1.5) to insert tasks between existing ones.</span>
                  </div>
                  )}
                  {columnMatchesSearch("header_gantt") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["header_gantt"] || false} onCheckedChange={(v) => updateColumnStatus("header_gantt", !!v)} />
                    <CopyableCode>header_gantt</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Links this task to a parent header row for grouping in the Gantt chart. Select another task that has &quot;Allow Header&quot; enabled, or set to &quot;Header&quot; to make this row itself a section divider.</span>
                  </div>
                  )}
                  {columnMatchesSearch("allow_header") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["allow_header"] || false} onCheckedChange={(v) => updateColumnStatus("allow_header", !!v)} />
                    <CopyableCode>allow_header</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">When turned on, this task can be selected as a header/parent for other tasks. Use this for major milestones that other tasks should be grouped under.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Scheduling */}
            {sectionHasMatches(["duration_days", "predecessor_ids", "predecessor_ids_backup"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Scheduling</CardTitle>
                <CardDescription>Task timing and dependencies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("duration_days") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["duration_days"] || false} onCheckedChange={(v) => updateColumnStatus("duration_days", !!v)} />
                    <CopyableCode>duration_days</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">How many working days (Mon-Fri) this task takes to complete. Enter 1 for same-day tasks, 5 for a full week, etc. Weekends are automatically skipped.</span>
                  </div>
                  )}
                  {columnMatchesSearch("predecessor_ids") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["predecessor_ids"] || false} onCheckedChange={(v) => updateColumnStatus("predecessor_ids", !!v)} />
                    <CopyableCode>predecessor_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Links to tasks that must finish before this one can start. Format: FS (Finish-to-Start, most common), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish). Lag adds extra waiting days.</span>
                  </div>
                  )}
                  {columnMatchesSearch("predecessor_ids_backup") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["predecessor_ids_backup"] || false} onCheckedChange={(v) => updateColumnStatus("predecessor_ids_backup", !!v)} />
                    <CopyableCode>predecessor_ids_backup</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Stores the original dependencies when a link is broken (e.g., when a locked task can&apos;t move). Used to restore connections later if needed.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Locking & Status */}
            {sectionHasMatches(["hold", "hold_date", "previous_hold_date", "hold_at", "dependency_broken", "started", "confirm", "confirmed_at", "supplier_confirm", "supplier_confirmed_at", "completed", "completed_at"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Locking & Status</CardTitle>
                <CardDescription>Columns that lock/pin tasks and track completion</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("hold") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["hold"] || false} onCheckedChange={(v) => updateColumnStatus("hold", !!v)} />
                    <CopyableCode>hold</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Hold</Badge>When turned on, this task is &quot;pinned&quot; to a specific date and won&apos;t move when other tasks push forward. Use this when a date is fixed (e.g., council inspection scheduled for a specific day).</span>
                  </div>
                  )}
                  {columnMatchesSearch("hold_date") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["hold_date"] || false} onCheckedChange={(v) => updateColumnStatus("hold_date", !!v)} />
                    <CopyableCode>hold_date</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">date</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Hold Date</Badge>The fixed date this task is pinned to. Only used when &quot;hold&quot; is turned on. The task will always start on this date regardless of what happens to other tasks.</span>
                  </div>
                  )}
                  {columnMatchesSearch("previous_hold_date") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["previous_hold_date"] || false} onCheckedChange={(v) => updateColumnStatus("previous_hold_date", !!v)} />
                    <CopyableCode>previous_hold_date</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">date</Badge>
                    <span className="text-muted-foreground">Stores the previous hold date before a change was made. Useful for audit trails when dates are adjusted.</span>
                  </div>
                  )}
                  {columnMatchesSearch("hold_at") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["hold_at"] || false} onCheckedChange={(v) => updateColumnStatus("hold_at", !!v)} />
                    <CopyableCode>hold_at</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">datetime</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Hold At</Badge>Records exactly when the hold was turned on. Useful for audit purposes to see when decisions were made to lock dates.</span>
                  </div>
                  )}
                  {columnMatchesSearch("dependency_broken") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["dependency_broken"] || false} onCheckedChange={(v) => updateColumnStatus("dependency_broken", !!v)} />
                    <CopyableCode>dependency_broken</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Indicates this task was manually removed from the dependency chain. When true, the task schedules independently and won&apos;t be pushed by predecessor tasks.</span>
                  </div>
                  )}
                  {columnMatchesSearch("started") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["started"] || false} onCheckedChange={(v) => updateColumnStatus("started", !!v)} />
                    <CopyableCode>started</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Started</Badge>Marks this task as in progress. Once started, the task is LOCKED and won&apos;t be pushed by predecessor delays. The actual start date is recorded when this is turned on.</span>
                  </div>
                  )}
                  {columnMatchesSearch("confirm") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["confirm"] || false} onCheckedChange={(v) => updateColumnStatus("confirm", !!v)} />
                    <CopyableCode>confirm</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Confirm</Badge>Supervisor has signed off on this task&apos;s dates. Once confirmed, the task is LOCKED - it won&apos;t move even if earlier tasks are delayed. Use this to commit to a supplier.</span>
                  </div>
                  )}
                  {columnMatchesSearch("confirmed_at") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["confirmed_at"] || false} onCheckedChange={(v) => updateColumnStatus("confirmed_at", !!v)} />
                    <CopyableCode>confirmed_at</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">datetime</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Confirmed At</Badge>Records the exact date and time when the supervisor confirmed the task. Helps track when commitments were made.</span>
                  </div>
                  )}
                  {columnMatchesSearch("supplier_confirm") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["supplier_confirm"] || false} onCheckedChange={(v) => updateColumnStatus("supplier_confirm", !!v)} />
                    <CopyableCode>supplier_confirm</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Supplier Confirm</Badge>The supplier has confirmed they can do the work on these dates. Once supplier-confirmed, the task is LOCKED and won&apos;t be pushed by delays.</span>
                  </div>
                  )}
                  {columnMatchesSearch("supplier_confirmed_at") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["supplier_confirmed_at"] || false} onCheckedChange={(v) => updateColumnStatus("supplier_confirmed_at", !!v)} />
                    <CopyableCode>supplier_confirmed_at</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">datetime</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Supplier Confirmed At</Badge>Records when the supplier gave their confirmation. Important for accountability if dates aren&apos;t met.</span>
                  </div>
                  )}
                  {columnMatchesSearch("completed") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["completed"] || false} onCheckedChange={(v) => updateColumnStatus("completed", !!v)} />
                    <CopyableCode>completed</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Completed</Badge>Marks the task as finished. Completed tasks are LOCKED and their dates become permanent. Successor tasks can now start as scheduled.</span>
                  </div>
                  )}
                  {columnMatchesSearch("completed_at") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["completed_at"] || false} onCheckedChange={(v) => updateColumnStatus("completed_at", !!v)} />
                    <CopyableCode>completed_at</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">date</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Completed At</Badge>The actual date the task was marked complete. This may differ from the planned end date if work finished early or late.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Assignment & Supplier */}
            {sectionHasMatches(["trade", "stage", "assigned_role", "cost_centre"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Assignment & Supplier</CardTitle>
                <CardDescription>Who does the work</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("trade") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["trade"] || false} onCheckedChange={(v) => updateColumnStatus("trade", !!v)} />
                    <CopyableCode>trade</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">The type of work for this task (e.g., Plumbing, Electrical, Carpentry). Used to filter the Gantt by trade and helps match tasks to the right suppliers.</span>
                  </div>
                  )}
                  {columnMatchesSearch("stage") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["stage"] || false} onCheckedChange={(v) => updateColumnStatus("stage", !!v)} />
                    <CopyableCode>stage</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Which construction phase this task belongs to (e.g., Foundation, Frame, Lock-up, Fixing, Finishing). Helps organise tasks into major milestones.</span>
                  </div>
                  )}
                  {columnMatchesSearch("assigned_role") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["assigned_role"] || false} onCheckedChange={(v) => updateColumnStatus("assigned_role", !!v)} />
                    <CopyableCode>assigned_role</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Which team member role is responsible for this task (e.g., Site Supervisor, Admin, Project Manager). Used to filter tasks by who needs to action them.</span>
                  </div>
                  )}
                  {columnMatchesSearch("cost_centre") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["cost_centre"] || false} onCheckedChange={(v) => updateColumnStatus("cost_centre", !!v)} />
                    <CopyableCode>cost_centre</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Accounting code for tracking costs. Links this task&apos;s expenses to the correct budget category in your financial reports.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* PO Settings */}
            {sectionHasMatches(["po_required", "critical_po", "create_po_on_job_start", "po_line_items", "order_time_days", "call_time_days", "po_supplier_id"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">PO (Purchase Order) Settings</CardTitle>
                <CardDescription>Purchase order configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("po_required") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["po_required"] || false} onCheckedChange={(v) => updateColumnStatus("po_required", !!v)} />
                    <CopyableCode>po_required</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">This task needs a Purchase Order before it can appear on the job. The task stays hidden in the Gantt until a PO is linked to it. Dependencies automatically skip over hidden PO tasks.</span>
                  </div>
                  )}
                  {columnMatchesSearch("critical_po") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["critical_po"] || false} onCheckedChange={(v) => updateColumnStatus("critical_po", !!v)} />
                    <CopyableCode>critical_po</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Flags this as a critical path task. These tasks are highlighted and easily searchable in the Gantt. Delays to critical tasks will push back the entire project completion date.</span>
                  </div>
                  )}
                  {columnMatchesSearch("create_po_on_job_start") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["create_po_on_job_start"] || false} onCheckedChange={(v) => updateColumnStatus("create_po_on_job_start", !!v)} />
                    <CopyableCode>create_po_on_job_start</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Automatically creates a Purchase Order for this task when the job is started. Uses the line items defined in po_line_items. Great for tasks that always need the same materials.</span>
                  </div>
                  )}
                  {columnMatchesSearch("po_line_items") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center pl-6">
                    <Checkbox checked={columnStatus.complete["po_line_items"] || false} onCheckedChange={(v) => updateColumnStatus("po_line_items", !!v)} />
                    <CopyableCode>po_line_items</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">jsonb</Badge>
                    <span className="text-muted-foreground">↳ The items to include when auto-creating a PO. Each entry specifies a pricebook item and quantity. Example: concrete, timber, or fixtures that are always needed for this task.</span>
                  </div>
                  )}
                  {columnMatchesSearch("order_time_days") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["order_time_days"] || false} onCheckedChange={(v) => updateColumnStatus("order_time_days", !!v)} />
                    <CopyableCode>order_time_days</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">How many working days before the task starts that materials need to be ordered. Helps ensure materials arrive in time. Example: 5 days for custom windows.</span>
                  </div>
                  )}
                  {columnMatchesSearch("call_time_days") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["call_time_days"] || false} onCheckedChange={(v) => updateColumnStatus("call_time_days", !!v)} />
                    <CopyableCode>call_time_days</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">How many working days before the task starts that you should contact the supplier to confirm the booking. Example: Call electrician 3 days ahead to confirm date.</span>
                  </div>
                  )}
                  {columnMatchesSearch("po_supplier_id") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["po_supplier_id"] || false} onCheckedChange={(v) => updateColumnStatus("po_supplier_id", !!v)} />
                    <CopyableCode>po_supplier_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">The default supplier for this task&apos;s Purchase Orders. When a PO is auto-created, it will use this supplier. Pricebook items are filtered to show only this supplier&apos;s prices.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Completion Requirements */}
            {sectionHasMatches(["require_photo", "pass_fail_enabled"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Completion Requirements</CardTitle>
                <CardDescription>Evidence and documentation needed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("require_photo") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["require_photo"] || false} onCheckedChange={(v) => updateColumnStatus("require_photo", !!v)} />
                    <CopyableCode>require_photo</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">A photo must be uploaded before this task can be marked complete. Ensures visual proof of work for quality control and record-keeping.</span>
                  </div>
                  )}
                  {columnMatchesSearch("pass_fail_enabled") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["pass_fail_enabled"] || false} onCheckedChange={(v) => updateColumnStatus("pass_fail_enabled", !!v)} />
                    <CopyableCode>pass_fail_enabled</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Adds Pass/Fail buttons to this task. Useful for inspections or quality checks where work needs to be explicitly approved or rejected.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Subtasks */}
            {sectionHasMatches(["has_subtasks", "subtask_count", "subtask_names", "linked_task_ids"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Subtasks & Linked Tasks</CardTitle>
                <CardDescription>Child tasks and task relationships</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("has_subtasks") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["has_subtasks"] || false} onCheckedChange={(v) => updateColumnStatus("has_subtasks", !!v)} />
                    <CopyableCode>has_subtasks</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Indicates this task has smaller steps (subtasks) within it. Subtasks let you break down complex work into individual checklist items that must all be completed.</span>
                  </div>
                  )}
                  {columnMatchesSearch("subtask_count") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["subtask_count"] || false} onCheckedChange={(v) => updateColumnStatus("subtask_count", !!v)} />
                    <CopyableCode>subtask_count</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">How many subtasks this task contains. The main task can only be completed when all subtasks are ticked off.</span>
                  </div>
                  )}
                  {columnMatchesSearch("subtask_names") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["subtask_names"] || false} onCheckedChange={(v) => updateColumnStatus("subtask_names", !!v)} />
                    <CopyableCode>subtask_names</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string[]</Badge>
                    <span className="text-muted-foreground">The names of each subtask step. These appear as a checklist when viewing the task. Example: [&quot;Frame walls&quot;, &quot;Install noggins&quot;, &quot;Brace frame&quot;].</span>
                  </div>
                  )}
                  {columnMatchesSearch("linked_task_ids") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["linked_task_ids"] || false} onCheckedChange={(v) => updateColumnStatus("linked_task_ids", !!v)} />
                    <CopyableCode>linked_task_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Other tasks that should appear/disappear together with this one. When this PO task is added to a job, all linked tasks also appear automatically.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Completion Cascade */}
            {sectionHasMatches(["completion_linked_task_ids"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Completion Cascade</CardTitle>
                <CardDescription>Tasks that can be completed together</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("completion_linked_task_ids") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["completion_linked_task_ids"] || false} onCheckedChange={(v) => updateColumnStatus("completion_linked_task_ids", !!v)} />
                    <CopyableCode>completion_linked_task_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Tasks that can be completed together when this task completes. Shows a dialog letting user choose which related tasks to also complete (e.g., completing &quot;Sign Contract&quot; can also complete &quot;Give Quote&quot; and &quot;Create Estimate&quot;).</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Documentation */}
            {sectionHasMatches(["documentation_category_ids"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Documentation</CardTitle>
                <CardDescription>Documents and photos linked to tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("documentation_category_ids") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["documentation_category_ids"] || false} onCheckedChange={(v) => updateColumnStatus("documentation_category_ids", !!v)} />
                    <CopyableCode>documentation_category_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer[]</Badge>
                    <span className="text-muted-foreground">Which documentation folders this task&apos;s photos and files should appear under. Photos uploaded to this task will be visible in the selected documentation tabs on the job.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Spawning Tasks */}
            {sectionHasMatches(["spawn_order_task", "spawn_call_task", "spawn_scan_task_id", "spawn_scan_lag_days"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Spawning Tasks</CardTitle>
                <CardDescription>Auto-create related tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("spawn_order_task") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["spawn_order_task"] || false} onCheckedChange={(v) => updateColumnStatus("spawn_order_task", !!v)} />
                    <CopyableCode>spawn_order_task</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Automatically create an &quot;Order Materials&quot; reminder task based on order_time_days. The reminder appears the right number of days before this task starts.</span>
                  </div>
                  )}
                  {columnMatchesSearch("spawn_call_task") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["spawn_call_task"] || false} onCheckedChange={(v) => updateColumnStatus("spawn_call_task", !!v)} />
                    <CopyableCode>spawn_call_task</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Automatically create a &quot;Call Supplier&quot; reminder task based on call_time_days. The reminder appears the right number of days before this task starts.</span>
                  </div>
                  )}
                  {columnMatchesSearch("spawn_scan_task_id") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["spawn_scan_task_id"] || false} onCheckedChange={(v) => updateColumnStatus("spawn_scan_task_id", !!v)} />
                    <CopyableCode>spawn_scan_task_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">bigint</Badge>
                    <span className="text-muted-foreground">When this task is completed, automatically create a follow-up scanning task. Select which task template to use for the scan. Great for tasks that generate paperwork needing to be digitised.</span>
                  </div>
                  )}
                  {columnMatchesSearch("spawn_scan_lag_days") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["spawn_scan_lag_days"] || false} onCheckedChange={(v) => updateColumnStatus("spawn_scan_lag_days", !!v)} />
                    <CopyableCode>spawn_scan_lag_days</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">How many working days after this task completes before the scan task should be scheduled. Example: 2 days gives time for paperwork to reach the office.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Checklists */}
            {sectionHasMatches(["checklist_id"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Checklists</CardTitle>
                <CardDescription>Supervisor checklist templates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("checklist_id") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["checklist_id"] || false} onCheckedChange={(v) => updateColumnStatus("checklist_id", !!v)} />
                    <CopyableCode>checklist_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Links a supervisor inspection checklist to this task. When viewing the task, the checklist items will appear and need to be completed. Used for quality control inspections.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Template Membership */}
            {sectionHasMatches(["sm_template_ids"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Template Membership</CardTitle>
                <CardDescription>Which templates include this task</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("sm_template_ids") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["sm_template_ids"] || false} onCheckedChange={(v) => updateColumnStatus("sm_template_ids", !!v)} />
                    <CopyableCode>sm_template_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Which schedule templates include this task. A single task can be shared across multiple templates (e.g., &quot;Site Clean&quot; in both House and Duplex templates). When you edit the task, changes apply everywhere.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Display */}
            {sectionHasMatches(["tags", "color", "is_active"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Display</CardTitle>
                <CardDescription>Visual and organizational settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("tags") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["tags"] || false} onCheckedChange={(v) => updateColumnStatus("tags", !!v)} />
                    <CopyableCode>tags</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string[]</Badge>
                    <span className="text-muted-foreground">Custom labels for searching and filtering. Add any tags you like (e.g., &quot;exterior&quot;, &quot;council-required&quot;, &quot;final-fix&quot;). Tasks can then be filtered by tag in the Gantt.</span>
                  </div>
                  )}
                  {columnMatchesSearch("color") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["color"] || false} onCheckedChange={(v) => updateColumnStatus("color", !!v)} />
                    <CopyableCode>color</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Override the default bar colour in the Gantt chart. Useful for visually distinguishing special tasks (e.g., red for inspections, green for milestones).</span>
                  </div>
                  )}
                  {columnMatchesSearch("is_active") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["is_active"] || false} onCheckedChange={(v) => updateColumnStatus("is_active", !!v)} />
                    <CopyableCode>is_active</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">When turned off, this task is hidden from templates but not permanently deleted. Useful for temporarily removing tasks or keeping old tasks for reference.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Audit */}
            {sectionHasMatches(["created_by_id", "updated_by_id", "created_at", "updated_at"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Audit</CardTitle>
                <CardDescription>Who created/modified and when</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("created_by_id") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["created_by_id"] || false} onCheckedChange={(v) => updateColumnStatus("created_by_id", !!v)} />
                    <CopyableCode>created_by_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Which user originally created this task in the template. Automatically recorded when a new task is added.</span>
                  </div>
                  )}
                  {columnMatchesSearch("updated_by_id") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["updated_by_id"] || false} onCheckedChange={(v) => updateColumnStatus("updated_by_id", !!v)} />
                    <CopyableCode>updated_by_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Which user most recently made changes to this task. Helps track who modified what.</span>
                  </div>
                  )}
                  {columnMatchesSearch("created_at") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["created_at"] || false} onCheckedChange={(v) => updateColumnStatus("created_at", !!v)} />
                    <CopyableCode>created_at</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">datetime</Badge>
                    <span className="text-muted-foreground">The exact date and time this task was first added to the template. Automatically set by the system.</span>
                  </div>
                  )}
                  {columnMatchesSearch("updated_at") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["updated_at"] || false} onCheckedChange={(v) => updateColumnStatus("updated_at", !!v)} />
                    <CopyableCode>updated_at</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">datetime</Badge>
                    <span className="text-muted-foreground">The date and time of the last change to this task. Updates automatically whenever any field is modified.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Workflow Triggers */}
            {sectionHasMatches(["start_workflow_enabled", "start_workflow_id", "complete_workflow_enabled", "complete_workflow_id"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Workflow Triggers</CardTitle>
                <CardDescription>Automated workflow execution on task events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("start_workflow_enabled") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["start_workflow_enabled"] || false} onCheckedChange={(v) => updateColumnStatus("start_workflow_enabled", !!v)} />
                    <CopyableCode>start_workflow_enabled</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">When enabled, automatically runs a workflow when this task is started. Useful for triggering notifications, creating follow-up tasks, or updating external systems.</span>
                  </div>
                  )}
                  {columnMatchesSearch("start_workflow_id") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center pl-6">
                    <Checkbox checked={columnStatus.complete["start_workflow_id"] || false} onCheckedChange={(v) => updateColumnStatus("start_workflow_id", !!v)} />
                    <CopyableCode>start_workflow_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">↳ The workflow to execute when the task starts. Select from available workflow templates.</span>
                  </div>
                  )}
                  {columnMatchesSearch("complete_workflow_enabled") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["complete_workflow_enabled"] || false} onCheckedChange={(v) => updateColumnStatus("complete_workflow_enabled", !!v)} />
                    <CopyableCode>complete_workflow_enabled</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">When enabled, automatically runs a workflow when this task is completed. Great for triggering invoicing, notifications to next trades, or quality control checks.</span>
                  </div>
                  )}
                  {columnMatchesSearch("complete_workflow_id") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center pl-6">
                    <Checkbox checked={columnStatus.complete["complete_workflow_id"] || false} onCheckedChange={(v) => updateColumnStatus("complete_workflow_id", !!v)} />
                    <CopyableCode>complete_workflow_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">↳ The workflow to execute when the task completes. Select from available workflow templates.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Document Requirements */}
            {sectionHasMatches(["requires_document_to_complete", "completion_document_type_id", "document_types"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Document Requirements</CardTitle>
                <CardDescription>Documents required for task completion and spawned GET tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("requires_document_to_complete") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["requires_document_to_complete"] || false} onCheckedChange={(v) => updateColumnStatus("requires_document_to_complete", !!v)} />
                    <CopyableCode>requires_document_to_complete</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">When enabled, a specific document type must be attached before the task can be marked complete. Ensures critical paperwork is collected.</span>
                  </div>
                  )}
                  {columnMatchesSearch("completion_document_type_id") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center pl-6">
                    <Checkbox checked={columnStatus.complete["completion_document_type_id"] || false} onCheckedChange={(v) => updateColumnStatus("completion_document_type_id", !!v)} />
                    <CopyableCode>completion_document_type_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">↳ The type of document required for completion. Example: &quot;Council Inspection Certificate&quot; for inspection tasks.</span>
                  </div>
                  )}
                  {columnMatchesSearch("document_types") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["document_types"] || false} onCheckedChange={(v) => updateColumnStatus("document_types", !!v)} />
                    <CopyableCode>document_types</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">join</Badge>
                    <span className="text-muted-foreground">Document types that spawn GET (scanning) tasks when this task completes. Each document type can have a lag time and assigned role for the scan task.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Task Groups */}
            {sectionHasMatches(["sm_task_group_id"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Task Groups</CardTitle>
                <CardDescription>Organize tasks into logical groups</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("sm_task_group_id") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["sm_task_group_id"] || false} onCheckedChange={(v) => updateColumnStatus("sm_task_group_id", !!v)} />
                    <CopyableCode>sm_task_group_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Links this task to a task group for organizational purposes. Task groups help categorize PO vs non-PO tasks and enable bulk operations on related tasks.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Related PO Tasks */}
            {sectionHasMatches(["related_po_task_ids"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Related PO Tasks</CardTitle>
                <CardDescription>Supplier coordination between PO tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("related_po_task_ids") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["related_po_task_ids"] || false} onCheckedChange={(v) => updateColumnStatus("related_po_task_ids", !!v)} />
                    <CopyableCode>related_po_task_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">join</Badge>
                    <span className="text-muted-foreground">Links to other PO tasks whose supplier contact info should be included in this task&apos;s PO description. Enables suppliers to coordinate directly (e.g., Carpenter can call Crane hire and Roof Trusses supplier).</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Claim Settings */}
            {sectionHasMatches(["is_claim_task", "is_variation", "claim_percentage", "claim_sequence_number", "claim_invoice_pattern", "claim_invoice_template_id", "claim_trading_name_id"]) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Claim Settings</CardTitle>
                <CardDescription>Progress claim and invoicing configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  {columnMatchesSearch("is_claim_task") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["is_claim_task"] || false} onCheckedChange={(v) => updateColumnStatus("is_claim_task", !!v)} />
                    <CopyableCode>is_claim_task</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Marks this as a progress claim milestone. When completed, this task triggers a claim invoice to the client for the specified percentage of the contract.</span>
                  </div>
                  )}
                  {columnMatchesSearch("is_variation") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["is_variation"] || false} onCheckedChange={(v) => updateColumnStatus("is_variation", !!v)} />
                    <CopyableCode>is_variation</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Indicates this claim task is for a variation (extra work) rather than the original contract. Variations are invoiced separately from scheduled progress claims.</span>
                  </div>
                  )}
                  {columnMatchesSearch("claim_percentage") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["claim_percentage"] || false} onCheckedChange={(v) => updateColumnStatus("claim_percentage", !!v)} />
                    <CopyableCode>claim_percentage</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">decimal</Badge>
                    <span className="text-muted-foreground">The percentage of the total contract value to claim when this task is completed. Example: 10% for slab pour, 15% for frame complete.</span>
                  </div>
                  )}
                  {columnMatchesSearch("claim_sequence_number") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["claim_sequence_number"] || false} onCheckedChange={(v) => updateColumnStatus("claim_sequence_number", !!v)} />
                    <CopyableCode>claim_sequence_number</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">The order this claim appears in the progress claim schedule. Used to generate claim numbering like &quot;Progress Claim #3&quot;.</span>
                  </div>
                  )}
                  {columnMatchesSearch("claim_invoice_pattern") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["claim_invoice_pattern"] || false} onCheckedChange={(v) => updateColumnStatus("claim_invoice_pattern", !!v)} />
                    <CopyableCode>claim_invoice_pattern</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Naming pattern for the generated invoice. Supports variables like {`{job_number}`}, {`{claim_number}`}, {`{date}`}.</span>
                  </div>
                  )}
                  {columnMatchesSearch("claim_invoice_template_id") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["claim_invoice_template_id"] || false} onCheckedChange={(v) => updateColumnStatus("claim_invoice_template_id", !!v)} />
                    <CopyableCode>claim_invoice_template_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">The invoice template to use when generating the claim invoice. Different templates can have different layouts, logos, and terms.</span>
                  </div>
                  )}
                  {columnMatchesSearch("claim_trading_name_id") && (
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["claim_trading_name_id"] || false} onCheckedChange={(v) => updateColumnStatus("claim_trading_name_id", !!v)} />
                    <CopyableCode>claim_trading_name_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Which company trading name to invoice from. Useful when your business operates under multiple trading names for different types of work.</span>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

          </div>
        </TabsContent>

        {/* Recurring Tasks Tab */}
          <TabsContent value="recurring-tasks" className="absolute inset-0 overflow-auto px-4 pt-4 data-[state=inactive]:hidden">
          <RecurringTasksSection />
        </TabsContent>

        {/* Tables Tab - Gold Standard Table pattern for SM lookup tables */}
        <TabsContent value="tables" className="absolute inset-0 flex flex-col data-[state=inactive]:hidden">
          {/* Table selector - horizontal tabs */}
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30 shrink-0">
            {LOOKUP_TABLES.map((table) => (
              <Button
                key={table.id}
                variant={selectedLookupTable === table.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleTableChange(table.id)}
                className="gap-2"
              >
                <TableIcon className="h-4 w-4" />
                {table.name}
              </Button>
            ))}
            <div className="flex-1" />
            <p className="text-sm text-muted-foreground">
              {LOOKUP_TABLES.find(t => t.id === selectedLookupTable)?.description}
            </p>
          </div>

          {/* Full-height Gold Standard Table */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {LOOKUP_TABLES.map((table) => (
              selectedLookupTable === table.id && (
                <div key={`${table.id}-${lookupTableRefreshKey}`} className="h-full">
                  <TeeemTableView
                    entries={[]}
                    foundationId={table.id}
                    tableName={table.name}
                    enableExport={true}
                    autoFetchRecords
                    onRefresh={() => setLookupTableRefreshKey(k => k + 1)}
                  />
                </div>
              )
            ))}
          </div>
        </TabsContent>
        </div>
      </Tabs>

      {/* Schedule Template Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "New Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the schedule template details."
                : "Create a new schedule template for your jobs."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                placeholder="e.g., Standard New Build"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of this template"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : editingTemplate ? (
                "Update Template"
              ) : (
                "Create Template"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SSoT: Row Edit Dialog using shared EditRowDialog component */}
      <EditRowDialog
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        row={selectedRowForEdit}
        onSave={handleEditRowSave}
        onRefresh={handleEditRowRefresh}
        trades={availableTrades}
        roles={availableRoles}
        stages={availableStages}
        costCentres={availableCostCentres}
        checklists={availableChecklists}
        documentTypes={availableDocumentTypes}
        tradingNames={tradingNames}
        invoiceTemplates={claimInvoiceTemplates}
        workflows={availableWorkflows}
        headerRows={availableHeaderRows}
        taskGroups={availableTaskGroups}
        allRows={dataViewRows.map(r => convertToEditRowData(r))}
        showTemplateSection={true}
        templates={templates}
        onCopyToTemplate={handleCopyToTemplate}
        onChildTaskUpdate={handleChildTaskHeaderUpdate}
        onOpenAutoPODialog={() => setShowAutoPODialog(true)}
      />

      {/* Full-Size Invoice Preview Dialog */}
      <Dialog open={showFullPreview} onOpenChange={setShowFullPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Invoice Preview</DialogTitle>
            <DialogDescription>
              {editRowForm.name} • {editRowForm.claim_percentage}% of contract
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-6 bg-muted dark:bg-background">
            {templatePreviewHtml && (
              <div className="bg-white rounded-lg shadow-lg mx-auto" style={{ maxWidth: "800px" }}>
                <div dangerouslySetInnerHTML={{ __html: templatePreviewHtml }} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Auto-PO Configuration Dialog */}
      <Dialog open={showAutoPODialog} onOpenChange={setShowAutoPODialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Configure Auto-PO</DialogTitle>
            <DialogDescription>
              Select a supplier and items to automatically create a PO when this task&apos;s job starts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Supplier Selection */}
            <div className="space-y-2">
              <Label>Supplier</Label>
              {loadingSuppliers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner size={16} />
                  Loading suppliers...
                </div>
              ) : suppliers.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No suppliers found. Check the Contacts page to add suppliers.
                </div>
              ) : (
                <ComboboxDropdown
                  items={suppliers.map((s) => ({ id: String(s.id), label: s.display_name || `Supplier ${s.id}` }))}
                  selectedItem={selectedSupplierId ? { id: selectedSupplierId, label: suppliers.find(s => String(s.id) === selectedSupplierId)?.display_name || "" } : undefined}
                  onSelect={(item) => handleSupplierChange(item.id)}
                  placeholder="Search suppliers..."
                  emptyResults="No supplier found"
                  className="w-full"
                />
              )}
            </div>

            {/* Price History Items */}
            {selectedSupplierId && (
              <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                <Label>Items to Include in PO</Label>
                {loadingPriceHistories ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner size={16} />
                    Loading items...
                  </div>
                ) : priceHistories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No price history found for this supplier.
                  </p>
                ) : (
                  <div className="border rounded-md overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-auto flex-1">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right w-[80px]">Price</TableHead>
                            <TableHead className="text-center w-[70px]">Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {priceHistories.map((ph) => {
                            const lineItem = poLineItems.find(item => item.pricebook_item_id === ph.pricebook_item_id);
                            const isSelected = !!lineItem;
                            return (
                              <TableRow
                                key={ph.id}
                                className={`cursor-pointer ${isSelected ? "bg-accent/50" : ""}`}
                                onClick={() => togglePricebookItemSelection(ph.pricebook_item_id)}
                              >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => togglePricebookItemSelection(ph.pricebook_item_id)}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {ph.pricebook_item_code}
                                </TableCell>
                                <TableCell>{ph.pricebook_item_name}</TableCell>
                                <TableCell className="text-right">
                                  ${(Number(ph.new_price) || 0).toFixed(2)}
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  {isSelected && lineItem && (
                                    <Input
                                      type="number"
                                      min={1}
                                      value={lineItem.qty}
                                      onChange={(e) => updateLineItemQty(ph.pricebook_item_id, parseInt(e.target.value) || 1)}
                                      className="w-16 h-8 text-center"
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {poLineItems.length > 0 && (
                      <div className="border-t bg-muted/50 p-2 text-sm flex justify-between">
                        <span>{poLineItems.length} item{poLineItems.length !== 1 ? "s" : ""} selected</span>
                        <span className="font-medium">
                          Total Qty: {poLineItems.reduce((sum, item) => sum + item.qty, 0)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0">
            {editingRow?.po_supplier_id && (
              <Button variant="destructive" onClick={handleClearAutoPO} disabled={savingAutoPO}>
                Clear Auto-PO
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowAutoPODialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAutoPO}
              disabled={savingAutoPO || !selectedSupplierId}
            >
              {savingAutoPO ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Management Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Create and manage tags for grouping schedule master tasks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add new tag */}
            <div className="flex gap-2">
              <Input
                placeholder="New tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddTag();
                  }
                }}
              />
              <Button onClick={handleAddTag} disabled={savingTag || !newTagName.trim()}>
                {savingTag ? <Spinner size={16} /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {/* Tag list */}
            <div className="border rounded-md max-h-[300px] overflow-y-auto">
              {availableTags.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No tags yet. Add one above.
                </div>
              ) : (
                <div className="divide-y">
                  {availableTags.map((tag) => (
                    <div key={tag} className="flex items-center justify-between p-3">
                      {editingTag === tag ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <Input
                            value={editTagName}
                            onChange={(e) => setEditTagName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleRenameTag();
                              } else if (e.key === "Escape") {
                                setEditingTag(null);
                                setEditTagName("");
                              }
                            }}
                            className="h-8"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" onClick={handleRenameTag} disabled={savingTag}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingTag(null); setEditTagName(""); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <span>{tag}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingTag(tag);
                                setEditTagName(tag);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTag(tag)}
                              disabled={savingTag}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cascade Dependencies Dialog - shown when moving a task with successors (Gantt) */}
      <Dialog open={cascadeDialog.isOpen} onOpenChange={(open) => setCascadeDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              Cascade Dependencies
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {/* Task being moved */}
            <div className="p-2 bg-muted rounded text-xs">
              Moving <span className="font-semibold">{cascadeDialog.task?.name}</span> to{' '}
              <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">
                {cascadeDialog.newStartDate?.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            {/* Affected successors */}
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <p className="text-[10px] font-medium text-yellow-800 dark:text-yellow-200 mb-1.5">
                {cascadeDialog.successors.length} dependent task{cascadeDialog.successors.length > 1 ? 's' : ''}
              </p>

              {/* Unlocked successors - will cascade */}
              {cascadeDialog.unlockedSuccessors.length > 0 && (
                <div className="mb-1.5">
                  <div className="text-[10px] font-semibold text-green-700 dark:text-green-300 flex items-center gap-1 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Will Cascade ({cascadeDialog.unlockedSuccessors.length}):
                  </div>
                  <div className="flex flex-wrap gap-1 ml-2">
                    {cascadeDialog.unlockedSuccessors.map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 rounded text-[9px] text-green-700 dark:text-green-300">
                        #{s.task_number} {s.name.length > 15 ? s.name.slice(0, 15) + '...' : s.name}
                        {s.downstreamCount > 0 && <span className="font-semibold">+{s.downstreamCount}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Locked successors - hierarchical tree view */}
              {cascadeDialog.lockedSuccessors.length > 0 && (() => {
                // Build tree: find which locked tasks depend on other locked tasks
                const lockedTaskNumbers = new Set(cascadeDialog.lockedSuccessors.map(t => t.task_number));
                const movedTaskNumber = (cascadeDialog.task?.rowData as GanttSmScheduleMaster | undefined)?.task_number;

                // Find root locked tasks (depend directly on moved task, not on another locked task)
                const rootLockedTasks = cascadeDialog.lockedSuccessors.filter(task => {
                  const preds = task.predecessor_ids || [];
                  // It's a root if it depends on the moved task OR doesn't depend on any other locked task
                  const dependsOnMovedTask = preds.some((p: { id: number }) => p.id === movedTaskNumber);
                  const dependsOnLockedTask = preds.some((p: { id: number }) => lockedTaskNumbers.has(p.id) && p.id !== task.task_number);
                  return dependsOnMovedTask || !dependsOnLockedTask;
                });

                // Find children for each locked task
                const getChildren = (parentTaskNumber: number): typeof cascadeDialog.lockedSuccessors => {
                  return cascadeDialog.lockedSuccessors.filter(task => {
                    const preds = task.predecessor_ids || [];
                    return preds.some((p: { id: number }) => p.id === parentTaskNumber);
                  });
                };

                // Check if a task's ancestor chain has any "break" decisions
                const isDisabledByAncestor = (task: typeof cascadeDialog.lockedSuccessors[0], visited = new Set<number>()): boolean => {
                  if (visited.has(task.id)) return false;
                  visited.add(task.id);
                  const preds = task.predecessor_ids || [];
                  for (const pred of preds) {
                    const parentTask = cascadeDialog.lockedSuccessors.find(t => t.task_number === pred.id);
                    if (parentTask) {
                      const parentDecision = lockedTaskDecisions[parentTask.id] || 'break';
                      if (parentDecision === 'break') return true;
                      if (isDisabledByAncestor(parentTask, visited)) return true;
                    }
                  }
                  return false;
                };

                // Render a locked task item
                const renderLockedTask = (task: typeof cascadeDialog.lockedSuccessors[0], depth: number) => {
                  const lockType = task.supplier_confirm ? 'Supplier'
                    : task.confirm ? 'Confirmed'
                    : task.is_completed ? 'Done' : 'Locked';
                  const canUnlock = !task.is_completed;
                  const decision = lockedTaskDecisions[task.id] || 'break';
                  const disabledByAncestor = isDisabledByAncestor(task);
                  const children = getChildren(task.task_number).filter(c => c.id !== task.id);

                  return (
                    <div key={task.id} className={depth > 0 ? 'ml-4 border-l-2 border-orange-200 dark:border-orange-700 pl-2' : ''}>
                      <div
                        className={`p-1.5 rounded border mb-1 ${disabledByAncestor ? 'opacity-40 bg-muted dark:bg-card border-border dark:border-border' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'}`}
                      >
                        <div className="flex items-center gap-1 text-[10px] mb-1">
                          <span className="font-medium truncate flex-1">#{task.task_number} {task.name}</span>
                          <span className={`px-1 py-0.5 rounded text-[9px] whitespace-nowrap ${
                            task.supplier_confirm ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 dark:bg-purple-900 dark:text-purple-300'
                            : task.confirm ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900 dark:text-green-300'
                            : 'bg-muted text-foreground dark:bg-card dark:text-muted-foreground'
                          }`}>
                            {lockType}
                          </span>
                        </div>

                        {disabledByAncestor ? (
                          <div className="text-[9px] text-muted-foreground italic">Parent task set to break - won&apos;t be affected</div>
                        ) : (
                          <div className="flex gap-1">
                            <label className={`flex items-center gap-1 cursor-pointer px-1.5 py-0.5 rounded flex-1 border ${decision === 'break' ? 'bg-red-100 dark:bg-red-900/50 border-red-300 dark:border-red-700' : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'}`}>
                              <input
                                type="checkbox"
                                checked={decision === 'break'}
                                className="h-3 w-3 rounded border-border text-red-600 dark:text-red-400 focus:ring-red-500"
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setLockedTaskDecisions(prev => ({ ...prev, [task.id]: 'break' }));
                                  }
                                }}
                              />
                              <span className="text-[9px] font-medium text-red-700 dark:text-red-300">Break</span>
                            </label>

                            <label
                              className={`flex flex-col px-1.5 py-0.5 rounded flex-1 border ${!canUnlock ? 'cursor-not-allowed bg-muted dark:bg-card border-border dark:border-border opacity-50' : decision === 'cascade' ? 'cursor-pointer bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700' : 'cursor-pointer bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'}`}
                              title={canUnlock ? `Will remove ${lockType.toLowerCase()} confirmation and cascade as per dependencies` : 'Completed tasks cannot be cascaded'}
                            >
                              <div className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={decision === 'cascade'}
                                  disabled={!canUnlock}
                                  className="h-3 w-3 rounded border-border text-green-600 dark:text-green-400 focus:ring-green-500 disabled:opacity-50"
                                  onChange={(e) => {
                                    if (e.target.checked && canUnlock) {
                                      setLockedTaskDecisions(prev => ({ ...prev, [task.id]: 'cascade' }));
                                    }
                                  }}
                                />
                                <span className={`text-[9px] font-medium ${canUnlock ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`}>
                                  {lockType === 'Supplier' ? 'Un-Supplier Confirm' : lockType === 'Confirmed' ? 'Un-Confirm' : 'Cascade'}
                                </span>
                              </div>
                              {canUnlock && decision === 'cascade' && (
                                <span className="text-[8px] text-orange-600 dark:text-orange-400 ml-4">will unconfirm and cascade</span>
                              )}
                            </label>
                          </div>
                        )}
                      </div>
                      {/* Render children recursively */}
                      {children.length > 0 && children.map(child => renderLockedTask(child, depth + 1))}
                    </div>
                  );
                };

                return (
                  <div>
                    <div className="text-[10px] font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-1 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      Locked Tasks ({cascadeDialog.lockedSuccessors.length}):
                    </div>
                    <div className="space-y-1">
                      {rootLockedTasks.map(task => renderLockedTask(task, 0))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Legend */}
            <div className="text-[9px] text-muted-foreground flex flex-col gap-0.5 pt-1 border-t">
              <span><span className="text-green-600 dark:text-green-400">●</span> Cascade = moves with parent (removes confirmation if locked)</span>
              <span><span className="text-red-600 dark:text-red-400">●</span> Break = stays in place, dependency removed</span>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => {
              setCascadeDialog(prev => ({ ...prev, isOpen: false }));
              // Restore original task positions by reloading data
              loadGanttData({ silent: true });
            }}>
              Cancel
            </Button>
            <Button size="sm"
              onClick={async () => {
                if (cascadeDialog.task && cascadeDialog.newStartDate) {
                  // For locked tasks with "break" decision, remove the dependency
                  const movedTaskRow = cascadeDialog.task.rowData as GanttSmScheduleMaster | undefined;
                  const movedTaskNumber = movedTaskRow?.task_number;

                  if (movedTaskNumber) {
                    // Process locked successors with "break" decision
                    for (const lockedTask of cascadeDialog.lockedSuccessors) {
                      const decision = lockedTaskDecisions[lockedTask.id] || 'break';
                      if (decision === 'break') {
                        // Remove dependency from this locked task and mark as broken
                        const currentPreds = lockedTask.predecessor_ids || [];
                        const updatedPreds = currentPreds.filter((p: { id: number }) => p.id !== movedTaskNumber);

                        try {
                          await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${lockedTask.id}`, {
                            row: {
                              predecessor_ids: updatedPreds,
                              dependency_broken: true  // Mark task as having broken dependencies
                            }
                          });
                          console.log('[Gantt] Broke dependency for task:', lockedTask.id, lockedTask.name);
                        } catch (err) {
                          console.error('[Gantt] Failed to break dependency for task', lockedTask.id, err);
                        }
                      } else {
                        // Cascade: unlock the task so it can move
                        // Clear hold as well so SSoT can recalculate its position
                        try {
                          await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${lockedTask.id}`, {
                            row: { confirm: false, supplier_confirm: false, hold: false }
                          });
                          console.log('[Gantt] Unlocked task for cascade:', lockedTask.id, lockedTask.name);
                        } catch (err) {
                          console.error('[Gantt] Failed to unlock task for cascade', lockedTask.id, err);
                        }
                      }
                    }
                  }

                  // Also clear hold on unlocked successors so they cascade via SSoT
                  // These are tasks with only hold=true (no confirm/supplier_confirm)
                  for (const unlockedTask of cascadeDialog.unlockedSuccessors) {
                    if (unlockedTask.hold) {
                      try {
                        await api.patch(`/api/v1/sm_schedule_master_templates/${ganttTemplateId}/rows/${unlockedTask.id}`, {
                          row: { hold: false }
                        });
                        console.log('[Gantt] Cleared hold on unlocked successor for cascade:', unlockedTask.id, unlockedTask.name);
                      } catch (err) {
                        console.error('[Gantt] Failed to clear hold on unlocked successor', unlockedTask.id, err);
                      }
                    }
                  }

                  // Execute the actual move
                  await executeGanttDragMove(cascadeDialog.task, cascadeDialog.newStartDate);
                  setCascadeDialog(prev => ({ ...prev, isOpen: false }));
                }
              }}
            >
              Confirm Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog - shown when toggling supplier_confirm or confirm in Gantt */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog.isChecking ? (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  {confirmDialog.type === 'supplierConfirm' ? 'Supplier Confirm' : 'Confirm'} Task
                </>
              ) : (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  Unlock Task
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.isChecking ? (
                <>This will lock the task position. It will no longer move when predecessors change.</>
              ) : (
                <>This will unlock the task. It will move based on its predecessor dependencies.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {/* Task info */}
            <div className="p-2 bg-muted rounded text-sm mb-2">
              <span className="font-medium">{confirmDialog.task?.name}</span>
            </div>

            {/* Affected successors info */}
            {confirmDialog.affectedSuccessors.length > 0 && (
              <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  {confirmDialog.affectedSuccessors.length} successor{confirmDialog.affectedSuccessors.length > 1 ? 's' : ''} will be affected
                </p>
                <div className="flex flex-wrap gap-1">
                  {confirmDialog.affectedSuccessors.slice(0, 5).map(s => (
                    <span key={s.id} className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-800 rounded text-[10px]">
                      #{s.task_number} {s.name.length > 20 ? s.name.slice(0, 20) + '...' : s.name}
                    </span>
                  ))}
                  {confirmDialog.affectedSuccessors.length > 5 && (
                    <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      +{confirmDialog.affectedSuccessors.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={confirmDialog.isChecking ? "default" : "outline"}
              onClick={async () => {
                if (confirmDialog.task) {
                  const field = confirmDialog.type === 'supplierConfirm' ? 'supplier_confirm' : 'confirm';
                  await executeGanttCheckboxToggle(confirmDialog.task.id, field, confirmDialog.isChecking);
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }
              }}
            >
              {confirmDialog.isChecking ? 'Confirm' : 'Unlock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Task Dialog - shown when starting a task that's under a header or has predecessors */}
      <Dialog open={startTaskDialog.isOpen} onOpenChange={(open) => setStartTaskDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              Start Task
            </DialogTitle>
            <DialogDescription>
              Starting this task will set its start date to today and lock its position.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            {/* Task info */}
            <div className="p-2 bg-muted rounded text-sm">
              <span className="font-medium">{startTaskDialog.task?.name}</span>
            </div>

            {/* Context info */}
            {startTaskDialog.headerName && (
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
                <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                  This task is under header:
                </p>
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 rounded text-[11px]">
                  {startTaskDialog.headerName}
                </span>
              </div>
            )}

            {startTaskDialog.hasPredecessors && (
              <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  This task has predecessor dependencies
                </p>
              </div>
            )}

            {/* Non-working day warning */}
            {!startTaskDialog.isTodayWorkingDay && startTaskDialog.lastWorkingDay && (
              <div className="p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-xs">
                <p className="font-medium text-orange-800 dark:text-orange-200">
                  Today is a weekend or holiday
                </p>
              </div>
            )}

            {/* Options - different layout based on working day */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">How do you want to start this task?</p>

              {/* If today is a working day - simple options */}
              {startTaskDialog.isTodayWorkingDay && (
                <>
                  {startTaskDialog.headerName && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-auto py-2"
                      onClick={async () => {
                        if (startTaskDialog.task) {
                          await executeStartTask(startTaskDialog.task, 'break-header', new Date());
                          setStartTaskDialog(prev => ({ ...prev, isOpen: false }));
                        }
                      }}
                    >
                      <GitBranch className="h-4 w-4 rotate-180 shrink-0" />
                      <div className="text-left">
                        <div className="font-medium">Break out of header</div>
                        <div className="text-[10px] text-muted-foreground">Task becomes standalone, start today</div>
                      </div>
                    </Button>
                  )}

                  {startTaskDialog.hasPredecessors && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-auto py-2"
                      onClick={async () => {
                        if (startTaskDialog.task) {
                          await executeStartTask(startTaskDialog.task, 'break-dependency', new Date());
                          setStartTaskDialog(prev => ({ ...prev, isOpen: false }));
                        }
                      }}
                    >
                      <Link2Off className="h-4 w-4 shrink-0" />
                      <div className="text-left">
                        <div className="font-medium">Break dependencies</div>
                        <div className="text-[10px] text-muted-foreground">Clear predecessors, start today</div>
                      </div>
                    </Button>
                  )}
                </>
              )}

              {/* If NOT a working day - show date choice for each action */}
              {!startTaskDialog.isTodayWorkingDay && startTaskDialog.lastWorkingDay && (
                <>
                  {/* Break out of header options */}
                  {startTaskDialog.headerName && (
                    <div className="border rounded-md p-2 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <GitBranch className="h-3.5 w-3.5 rotate-180" />
                        Break out of header
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-8"
                          onClick={async () => {
                            if (startTaskDialog.task && startTaskDialog.lastWorkingDay) {
                              await executeStartTask(startTaskDialog.task, 'break-header', startTaskDialog.lastWorkingDay);
                              setStartTaskDialog(prev => ({ ...prev, isOpen: false }));
                            }
                          }}
                        >
                          {startTaskDialog.lastWorkingDay.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-8 border-orange-300 text-orange-600 dark:text-orange-400 dark:border-orange-700 dark:text-orange-400"
                          onClick={async () => {
                            if (startTaskDialog.task) {
                              await executeStartTask(startTaskDialog.task, 'break-header', new Date());
                              setStartTaskDialog(prev => ({ ...prev, isOpen: false }));
                            }
                          }}
                        >
                          Today (weekend)
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Break dependencies options */}
                  {startTaskDialog.hasPredecessors && (
                    <div className="border rounded-md p-2 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Link2Off className="h-3.5 w-3.5" />
                        Break dependencies
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-8"
                          onClick={async () => {
                            if (startTaskDialog.task && startTaskDialog.lastWorkingDay) {
                              await executeStartTask(startTaskDialog.task, 'break-dependency', startTaskDialog.lastWorkingDay);
                              setStartTaskDialog(prev => ({ ...prev, isOpen: false }));
                            }
                          }}
                        >
                          {startTaskDialog.lastWorkingDay.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-8 border-orange-300 text-orange-600 dark:text-orange-400 dark:border-orange-700 dark:text-orange-400"
                          onClick={async () => {
                            if (startTaskDialog.task) {
                              await executeStartTask(startTaskDialog.task, 'break-dependency', new Date());
                              setStartTaskDialog(prev => ({ ...prev, isOpen: false }));
                            }
                          }}
                        >
                          Today (weekend)
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setStartTaskDialog(prev => ({ ...prev, isOpen: false }))}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Confirm Dialog - quick capture of confirmation method and contact */}
      <Dialog open={supplierConfirmDialog.isOpen} onOpenChange={(open) => setSupplierConfirmDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-purple-500 dark:text-purple-400" />
              {supplierConfirmDialog.isConfirming ? 'Supplier Confirmation' : 'Supplier Confirmed'}
            </DialogTitle>
            <DialogDescription>
              {supplierConfirmDialog.isConfirming
                ? 'Record how the supplier confirmed this task'
                : 'View or update confirmation details'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Task name */}
            <div className="text-sm">
              <span className="text-muted-foreground">Task:</span>{' '}
              <span className="font-medium">{supplierConfirmDialog.task?.name}</span>
            </div>

            {/* Supplier name if available */}
            {supplierConfirmDialog.supplierName && (
              <div className="text-sm">
                <span className="text-muted-foreground">Supplier:</span>{' '}
                <span className="font-medium">{supplierConfirmDialog.supplierName}</span>
              </div>
            )}

            {/* Show previous confirmation info when viewing */}
            {!supplierConfirmDialog.isConfirming && supplierConfirmDialog.previousMethod && (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md p-3 space-y-1">
                <div className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  Previously Confirmed
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Via {supplierConfirmDialog.previousMethod === 'phone' ? 'Phone' : supplierConfirmDialog.previousMethod === 'text' ? 'Text' : 'Email'}
                  {supplierConfirmDialog.previousContactName && ` by ${supplierConfirmDialog.previousContactName}`}
                </div>
              </div>
            )}

            {/* Dependency options - shown when confirming and task has predecessors */}
            {supplierConfirmDialog.isConfirming && supplierConfirmDialog.hasPredecessors && (
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 space-y-2">
                <div className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Link2Off className="h-4 w-4" />
                  This task has dependencies
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant={supplierConfirmDialog.confirmOption === 'current' ? 'default' : 'outline'}
                    size="sm"
                    className="justify-start"
                    onClick={() => setSupplierConfirmDialog(prev => ({ ...prev, confirmOption: 'current' }))}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Confirm at current date ({supplierConfirmDialog.task?.startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })})
                  </Button>
                  <Button
                    variant={supplierConfirmDialog.confirmOption === 'break' ? 'default' : 'outline'}
                    size="sm"
                    className="justify-start border-orange-300 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
                    onClick={() => setSupplierConfirmDialog(prev => ({ ...prev, confirmOption: 'break' }))}
                  >
                    <Link2Off className="h-4 w-4 mr-2" />
                    Break dependencies & confirm at current date
                  </Button>
                </div>
              </div>
            )}

            {/* Confirmation method buttons */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {supplierConfirmDialog.isConfirming ? 'Confirmed via:' : 'Update confirmation method:'}
              </label>
              <div className="flex gap-2">
                <Button
                  variant={supplierConfirmDialog.method === 'phone' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setSupplierConfirmDialog(prev => ({ ...prev, method: 'phone' }))}
                >
                  <Phone className="h-4 w-4 mr-1" />
                  Phone
                </Button>
                <Button
                  variant={supplierConfirmDialog.method === 'text' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setSupplierConfirmDialog(prev => ({ ...prev, method: 'text' }))}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Text
                </Button>
                <Button
                  variant={supplierConfirmDialog.method === 'email' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setSupplierConfirmDialog(prev => ({ ...prev, method: 'email' }))}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Email
                </Button>
              </div>
            </div>

            {/* Contact name input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact name:</label>
              <Input
                placeholder="Who confirmed?"
                value={supplierConfirmDialog.contactName}
                onChange={(e) => setSupplierConfirmDialog(prev => ({ ...prev, contactName: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && supplierConfirmDialog.method && supplierConfirmDialog.contactName) {
                    executeSupplierConfirm(
                      supplierConfirmDialog.task!,
                      supplierConfirmDialog.method,
                      supplierConfirmDialog.contactName
                    );
                    setSupplierConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  }
                }}
              />
            </div>

            {/* Email Supplier checkbox and reason */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendEmailCheckbox"
                  checked={supplierConfirmDialog.sendEmail}
                  onChange={(e) => setSupplierConfirmDialog(prev => ({ ...prev, sendEmail: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 dark:text-orange-400 focus:ring-orange-500"
                />
                <label htmlFor="sendEmailCheckbox" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                  <Mail className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                  Email Supplier
                  {supplierConfirmDialog.supplierEmail && (
                    <span className="text-muted-foreground font-normal">({supplierConfirmDialog.supplierEmail})</span>
                  )}
                </label>
              </div>
              {supplierConfirmDialog.sendEmail && (
                <Input
                  placeholder="Reason / message to supplier..."
                  value={supplierConfirmDialog.reason}
                  onChange={(e) => setSupplierConfirmDialog(prev => ({ ...prev, reason: e.target.value }))}
                  autoFocus
                />
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            {/* Clear Confirmation button (only when viewing existing confirmation) */}
            {!supplierConfirmDialog.isConfirming && (
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                onClick={() => {
                  if (supplierConfirmDialog.task) {
                    executeSupplierUnconfirm(supplierConfirmDialog.task);
                    setSupplierConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  }
                }}
              >
                Clear Confirmation
              </Button>
            )}
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSupplierConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                !supplierConfirmDialog.method ||
                !supplierConfirmDialog.contactName ||
                (supplierConfirmDialog.isConfirming && supplierConfirmDialog.hasPredecessors && !supplierConfirmDialog.confirmOption)
              }
              onClick={async () => {
                if (supplierConfirmDialog.task && supplierConfirmDialog.method && supplierConfirmDialog.contactName) {
                  // Save confirmation (with optional break dependencies)
                  const breakDeps = supplierConfirmDialog.confirmOption === 'break';
                  await executeSupplierConfirm(
                    supplierConfirmDialog.task,
                    supplierConfirmDialog.method,
                    supplierConfirmDialog.contactName,
                    breakDeps
                  );
                  // Send email if checkbox is checked
                  if (supplierConfirmDialog.sendEmail && supplierConfirmDialog.reason.trim()) {
                    await executeEmailSupplier(
                      supplierConfirmDialog.task,
                      supplierConfirmDialog.reason,
                      supplierConfirmDialog.supplierEmail || undefined
                    );
                  }
                  setSupplierConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }
              }}
            >
              {supplierConfirmDialog.confirmOption === 'break'
                ? 'Break & Confirm'
                : supplierConfirmDialog.sendEmail
                  ? (supplierConfirmDialog.isConfirming ? 'Confirm & Email' : 'Update & Email')
                  : (supplierConfirmDialog.isConfirming ? 'Confirm' : 'Update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dependency Editor - shown when editing dependencies in Gantt */}
      {/* SSoT: Always pass ALL tasks (ganttTasks), not just visible tasks
          The editor needs to look up inherited predecessors which might be in collapsed headers */}
      <GanttDependencyEditor
        isOpen={dependencyEditorState.isOpen}
        onClose={() => setDependencyEditorState({ isOpen: false, task: null, visibleTasks: [] })}
        task={dependencyEditorState.task}
        tasks={ganttTasks}
        onSave={handleDependencyEditorSave}
        onUpdateTask={handleGanttUpdateTask}
        pendingPredecessor={dependencyEditorState.pendingPredecessor}
        pendingSuccessor={dependencyEditorState.pendingSuccessor}
      />

      {/* NOTE: Trades/Stages are managed in Tables tab (SSoT: Foundation SM Trades ID 542, SM Stages ID 543) */}
      {/* NOTE: Roles are managed in Admin > System > Company > Security > Roles (SSoT) */}
    </div>
  );
}
