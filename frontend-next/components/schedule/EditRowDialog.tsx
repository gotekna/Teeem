"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import MultipleSelector from "@/components/ui/multiple-selector";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Check, AlertCircle, Copy, FileText, Package, Plus, RefreshCw, X } from "lucide-react";
import { DependencyInfoPanel, DEPENDENCY_GRID_COLS, DEPENDENCY_GRID_COLS_EDITABLE } from "./DependencyInfoPanel";
import { DocumentTypeTreePicker } from "@/components/jobs/custom-quotes/DocumentTypeTreePicker";
import { api } from "@/lib/api";
import { UI_AUTOSAVE_FEEDBACK_MS, UI_SUCCESS_MESSAGE_MS } from "@/lib/constants/timeout-constants";

// ============================================================================
// TENDER TREE TYPES
// ============================================================================

interface TenderTreeSection {
  id: number;
  code: string;
  name: string;
  sortOrder: number | null;
  sectionType: string;
  defaultNote?: string;
  description?: string;
  attachedDocumentTypes: string[];
}

interface TenderTreeHeader {
  id: number;
  code: string;
  name: string;
  sortOrder: number | null;
  description?: string;
  headerType: string;
  children: TenderTreeSection[];
}

// ============================================================================
// TYPES - Extracted from ScheduleMasterTab.tsx (SSoT)
// ============================================================================

export interface EditRowData {
  id: number;
  task_number: number;
  task_code?: string | null;
  name: string;
  description?: string;
  duration_days: number;
  sequence_order: number;
  predecessor_ids?: Array<{ id: number; type?: string; lag?: number }>;
  predecessor_display?: string;
  predecessor_display_names?: string;
  trade?: string;
  stage?: string;
  trade_name?: string;
  stage_name?: string;
  assigned_role?: string | null;
  cost_centre?: string;
  cost_centre_name?: string;
  tender_id?: string;
  header_gantt?: string | { id: number; display: string } | null;
  allow_header?: boolean;
  is_active?: boolean;
  tags?: string[];
  po_required?: boolean;
  critical_po?: boolean;
  create_po_on_job_start?: boolean;
  spawn_order_task?: boolean;
  spawn_call_task?: boolean;
  order_time_days?: number;
  call_time_days?: number;
  require_photo?: boolean;
  pass_fail_enabled?: boolean;
  po_supplier_id?: number | null;
  po_supplier_name?: string | null;
  po_line_items?: Array<{ pricebook_item_id: number; qty: number }>;
  // Related PO tasks for supplier coordination info in auto-created PO descriptions
  related_po_task_ids?: number[];
  related_po_task_names?: string[];
  linked_task_ids?: number[];
  // Completion linked tasks - tasks that can be completed together when this task completes
  completion_linked_task_ids?: number[];
  checklist_id?: number | { id: number; display: string } | null;
  spawn_scan_task_id?: number | { id: number; display: string } | null;
  document_types?: Array<{
    id: number;
    document_type_id: number;
    document_type_name: string;
    lag_days?: number;
    assigned_role?: string;
  }>;
  sm_template_ids?: number[];
  is_claim_task?: boolean;
  is_variation?: boolean;
  claim_percentage?: number | null;
  claim_sequence_number?: number | null;
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
  // Completion document requirement
  requires_document_to_complete?: boolean;
  completion_document_type_id?: number | null;
  completion_document_type_name?: string | null;
  // Task group - for grouping PO and non-PO tasks
  sm_task_group_id?: number | null;
  sm_task_group_name?: string | null;
  // PO/Quote SSoT fields (SM is the source; templates delegate here)
  tender_description?: string | null;
  po_description?: string | null;
  rfq_instructions?: string | null;
  budget_amount?: number | null;
  // Plan and document reference types (JSONB arrays of document_type IDs)
  plan_type_ids?: number[];
  plan_type_names?: string[];
  document_ref_type_ids?: number[];
  document_ref_type_names?: string[];
}

export type EditRowFormData = Partial<EditRowData>;

interface ClaimInvoiceTemplate {
  id: number;
  name: string;
  description: string;
  primary_color: string;
  secondary_color: string;
  is_default?: boolean;
}

interface TradingName {
  id: number;
  name: string;
}

// ============================================================================
// HELPER FUNCTIONS - Extracted from ScheduleMasterTab.tsx (SSoT)
// ============================================================================

function extractLookupId(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (obj.id !== undefined) return String(obj.id);
    if (obj.value !== undefined) return String(obj.value);
    return undefined;
  }
  return String(value);
}

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

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface EditRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: EditRowData | null;
  onSave: (rowId: number, data: EditRowFormData) => Promise<void>;
  onRefresh?: () => void;
  // Reference data (loaded by parent)
  trades: Array<{ id: number; name: string }>;
  roles: Array<{ id: number; name: string; display_name: string }>;
  stages: Array<{ id: number; name: string }>;
  costCentres: Array<{ id: number; name: string }>;
  tenderSections?: Array<{ id: number; name: string }>;
  checklists: Array<{ id: number; name: string }>;
  documentTypes: Array<{ id: number; name: string; display_name?: string; abbreviation?: string; form_number_mapping?: Record<string, string>; folder?: string; primary_folder_name?: string }>;
  tradingNames: Array<{ id: number; name: string }>;
  invoiceTemplates: ClaimInvoiceTemplate[];
  workflows?: Array<{ id: number; name: string }>;
  // For header/child relationships
  allRows?: EditRowData[];
  headerRows?: Array<{ id: number; task_number: number; name: string }>;
  taskGroups?: Array<{ id: number; name: string }>;
  onChildTaskUpdate?: (childId: number, headerGantt: number | null) => Promise<void>;
  // Schedule Master specific (optional)
  showTemplateSection?: boolean;
  templates?: Array<{ id: number; name: string }>;
  onCopyToTemplate?: (templateId: number, rowId: number) => Promise<void>;
  // Auto-PO dialog trigger (optional)
  onOpenAutoPODialog?: () => void;
  // Duplicate row (optional - only in Schedule Master template context)
  onDuplicate?: (rowId: number) => Promise<void>;
  // Job context for template preview (optional)
  jobId?: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EditRowDialog({
  open,
  onOpenChange,
  row,
  onSave,
  onRefresh,
  trades,
  roles,
  stages,
  costCentres,
  tenderSections = [],
  checklists,
  documentTypes,
  tradingNames,
  invoiceTemplates,
  workflows = [],
  allRows = [],
  headerRows = [],
  taskGroups = [],
  onChildTaskUpdate,
  showTemplateSection = false,
  templates = [],
  onCopyToTemplate,
  onOpenAutoPODialog,
  onDuplicate,
  jobId,
}: EditRowDialogProps) {
  // Form state
  const [editRowForm, setEditRowForm] = React.useState<EditRowFormData>({});

  // Duplicate state
  const [duplicating, setDuplicating] = React.useState(false);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const initialFormLoadRef = React.useRef(true);

  // Template preview state
  const [templatePreviewHtml, setTemplatePreviewHtml] = React.useState<string | null>(null);
  const [loadingTemplatePreview, setLoadingTemplatePreview] = React.useState(false);
  const [showFullPreview, setShowFullPreview] = React.useState(false);

  // Tender tree state (lazy-loaded when Tender & Quotes tab is opened)
  const [tenderTree, setTenderTree] = React.useState<TenderTreeHeader[]>([]);
  const [tenderTreeLoaded, setTenderTreeLoaded] = React.useState(false);
  const [loadingTenderTree, setLoadingTenderTree] = React.useState(false);

  // Template links state (lazy-loaded when Tender & Quotes tab is opened)
  const [templateLinks, setTemplateLinks] = React.useState<{
    current_tenant?: string;
    sync_tenants?: Array<{ id: number; name: string }>;
    po_template_packs: Array<{ id: number; pack_name: string; description?: string | null; item_count?: number; estimated_total?: number | null; is_primary?: boolean; synced_tenants?: string[] }>;
    custom_quote_templates: Array<{ id: number; template_name: string; description?: string | null; line_count?: number; is_primary?: boolean; synced_tenants?: string[] }>;
  } | null>(null);
  const [templateLinksLoaded, setTemplateLinksLoaded] = React.useState(false);
  // Available templates for "Add to" dropdowns (lazy-loaded)
  const [availablePoPacksLoaded, setAvailablePoPacksLoaded] = React.useState(false);
  const [availablePoPacks, setAvailablePoPacks] = React.useState<Array<{ id: number; name: string }>>([]);
  const [availableCqTemplates, setAvailableCqTemplates] = React.useState<Array<{ id: number; name: string }>>([]);
  const [addingToTemplate, setAddingToTemplate] = React.useState(false);

  // Filter document types: "Plans" folder vs everything else
  const planDocTypes = React.useMemo(
    () => documentTypes
      .filter(dt => dt.folder === "Plans" || dt.primary_folder_name === "Plans")
      .sort((a, b) => (a.abbreviation || "").localeCompare(b.abbreviation || "")),
    [documentTypes]
  );
  const nonPlanDocTypes = React.useMemo(
    () => documentTypes
      .filter(dt => dt.folder !== "Plans" && dt.primary_folder_name !== "Plans")
      .sort((a, b) => (a.abbreviation || "").localeCompare(b.abbreviation || "")),
    [documentTypes]
  );

  // Initialize form when row changes
  React.useEffect(() => {
    if (row) {
      initialFormLoadRef.current = true;
      setAutoSaveStatus('idle');
      setTemplateLinksLoaded(false);
      setTemplateLinks(null);
      setEditRowForm({
        name: row.name,
        description: row.description,
        duration_days: row.duration_days,
        sequence_order: row.sequence_order,
        trade: row.trade,
        stage: row.stage,
        assigned_role: row.assigned_role,
        cost_centre: row.cost_centre,
        cost_centre_name: row.cost_centre_name,
        tender_id: row.tender_id,
        header_gantt: row.header_gantt as string | null,
        po_required: row.po_required,
        critical_po: row.critical_po,
        create_po_on_job_start: row.create_po_on_job_start,
        require_photo: row.require_photo,
        pass_fail_enabled: row.pass_fail_enabled,
        spawn_order_task: row.spawn_order_task,
        spawn_call_task: row.spawn_call_task,
        order_time_days: row.order_time_days,
        call_time_days: row.call_time_days,
        // Related PO tasks for supplier coordination
        related_po_task_ids: row.related_po_task_ids || [],
        related_po_task_names: row.related_po_task_names || [],
        linked_task_ids: row.linked_task_ids,
        completion_linked_task_ids: row.completion_linked_task_ids || [],
        allow_header: row.allow_header,
        is_active: row.is_active,
        document_types: row.document_types || [],
        checklist_id: typeof row.checklist_id === 'object' ? (row.checklist_id as { id: number })?.id : row.checklist_id,
        is_claim_task: row.is_claim_task || false,
        is_variation: row.is_variation || false,
        claim_percentage: row.claim_percentage,
        claim_sequence_number: row.claim_sequence_number,
        claim_invoice_pattern: row.claim_invoice_pattern,
        claim_invoice_template_id: row.claim_invoice_template_id,
        claim_trading_name_id: row.claim_trading_name_id,
        sm_template_ids: row.sm_template_ids || [],
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
        // PO/Quote SSoT fields
        tender_description: row.tender_description || '',
        po_description: row.po_description || '',
        rfq_instructions: row.rfq_instructions || '',
        budget_amount: row.budget_amount || null,
        // Plan and document reference types
        plan_type_ids: row.plan_type_ids || [],
        document_ref_type_ids: row.document_ref_type_ids || [],
        // Dependencies (predecessor_ids JSONB)
        predecessor_ids: row.predecessor_ids || [],
      });

      // Load template preview if claim task with template
      if (row.is_claim_task && row.claim_invoice_template_id) {
        loadTemplatePreview(row.claim_invoice_template_id, {
          tradingName: row.claim_trading_name_id
            ? tradingNames.find(tn => tn.id === row.claim_trading_name_id)?.name
            : undefined,
          claimPercentage: row.claim_percentage || undefined,
          taskName: row.name,
        });
      }
    }
  }, [row, tradingNames]);

  // Load template preview
  const loadTemplatePreview = async (
    templateId: number,
    options?: {
      tradingName?: string;
      claimPercentage?: number;
      taskName?: string;
    }
  ) => {
    setLoadingTemplatePreview(true);
    try {
      const params = new URLSearchParams();
      if (options?.tradingName) params.set('trading_name', options.tradingName);
      if (options?.claimPercentage) params.set('claim_percentage', String(options.claimPercentage));
      if (options?.taskName) params.set('task_name', options.taskName);
      params.set('job_id', String(jobId || 201));

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

  // Lazy-load tender tree when Tender & Quotes tab is first opened
  const loadTenderTree = React.useCallback(async () => {
    if (tenderTreeLoaded || loadingTenderTree) return;
    setLoadingTenderTree(true);
    try {
      const data = await api.get<{ success: boolean; data: TenderTreeHeader[] }>("/api/v1/tenders/tree");
      if (data?.data) {
        setTenderTree(data.data);
      }
    } catch (error) {
      console.error("Failed to load tender tree:", error);
    } finally {
      setTenderTreeLoaded(true);
      setLoadingTenderTree(false);
    }
  }, [tenderTreeLoaded, loadingTenderTree]);

  // Lazy-load template links (PO Packs + Quote Templates referencing this SM task)
  const loadTemplateLinks = React.useCallback(async () => {
    if (templateLinksLoaded || !row?.id) return;
    try {
      const data = await api.get<{
        success: boolean;
        data: {
          current_tenant?: string;
          sync_tenants?: Array<{ id: number; name: string }>;
          po_template_packs: Array<{ id: number; pack_name: string; description?: string | null; item_count?: number; estimated_total?: number | null; is_primary?: boolean; synced_tenants?: string[] }>;
          custom_quote_templates: Array<{ id: number; template_name: string; description?: string | null; line_count?: number; is_primary?: boolean; synced_tenants?: string[] }>;
        };
      }>(`/api/v1/sm_schedule_master/template_links/${row.id}`);
      if (data?.data) {
        setTemplateLinks(data.data);
      }
    } catch (error) {
      console.error("Failed to load template links:", error);
    } finally {
      setTemplateLinksLoaded(true);
    }
  }, [templateLinksLoaded, row?.id]);

  // Load available PO Packs and CQ Templates for "Add to" dropdowns
  const loadAvailableTemplates = React.useCallback(async () => {
    if (availablePoPacksLoaded) return;
    try {
      const [poRes, cqRes] = await Promise.all([
        api.get<{ success: boolean; data: Array<{ id: number; name: string }> }>("/api/v1/po_template_packs"),
        api.get<{ success: boolean; data: Array<{ id: number; name: string }> }>("/api/v1/custom_quote_templates"),
      ]);
      setAvailablePoPacks((poRes?.data || []).map(p => ({ id: p.id, name: p.name })));
      setAvailableCqTemplates((cqRes?.data || []).map(t => ({ id: t.id, name: t.name })));
    } catch (error) {
      console.error("Failed to load available templates:", error);
    } finally {
      setAvailablePoPacksLoaded(true);
    }
  }, [availablePoPacksLoaded]);

  // Add this task to a PO Template Pack or Custom Quote Template
  const addToTemplate = async (type: "po_template_pack" | "custom_quote_template", templateId: number) => {
    if (!row?.id || addingToTemplate) return;
    setAddingToTemplate(true);
    try {
      await api.post(`/api/v1/sm_schedule_master/template_links/${row.id}/add`, {
        type,
        template_id: templateId,
      });
      // Reload template links directly (bypass the loaded guard)
      const data = await api.get<{
        success: boolean;
        data: {
          current_tenant?: string;
          sync_tenants?: Array<{ id: number; name: string }>;
          po_template_packs: Array<{ id: number; pack_name: string; description?: string | null; item_count?: number; estimated_total?: number | null; is_primary?: boolean; synced_tenants?: string[] }>;
          custom_quote_templates: Array<{ id: number; template_name: string; description?: string | null; line_count?: number; is_primary?: boolean; synced_tenants?: string[] }>;
        };
      }>(`/api/v1/sm_schedule_master/template_links/${row.id}`);
      if (data?.data) {
        setTemplateLinks(data.data);
      }
    } catch (error) {
      console.error("Failed to add to template:", error);
    } finally {
      setAddingToTemplate(false);
    }
  };

  // Handle save (supports both manual and auto-save)
  const handleSaveRow = async (options?: { silent?: boolean }) => {
    if (!row) return;

    const silent = options?.silent ?? false;

    // Skip auto-save when name is blank (backend validates presence)
    if (silent && !editRowForm.name?.trim()) return;

    if (silent) {
      setAutoSaveStatus('saving');
    }

    try {
      await onSave(row.id, editRowForm);

      if (silent) {
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), UI_AUTOSAVE_FEEDBACK_MS);
        onRefresh?.();
      } else {
        onOpenChange(false);
        onRefresh?.();
      }
    } catch (error) {
      console.error("Failed to save row:", error);
      if (silent) {
        setAutoSaveStatus('error');
        setTimeout(() => setAutoSaveStatus('idle'), UI_SUCCESS_MESSAGE_MS);
      }
    }
  };

  // Auto-save effect - debounced save when form changes
  React.useEffect(() => {
    if (initialFormLoadRef.current) {
      initialFormLoadRef.current = false;
      return;
    }

    if (!open || !row) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveRow({ silent: true });
    }, 500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [editRowForm]);

  if (!row) return null;

  return (
    <>
      {/* Row Edit Dialog - Full-screen modal (90%) for better UX */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[90vw] h-[95vh] flex flex-col p-0 overflow-hidden">
          {/* Sticky Header - Compact single line */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-3 flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              Edit Row
              <span className="text-muted-foreground font-normal">•</span>
              <span className="font-normal">{row.name}</span>
              {row.task_code ? (
                <span className="text-muted-foreground text-sm font-normal">({row.task_code})</span>
              ) : (
                <span className="text-muted-foreground text-sm font-normal">(#{row.task_number})</span>
              )}
              {/* Show parent header badge if this task is part of one */}
              {row.header_gantt && (() => {
                const parentTaskNumber = extractLookupId(row.header_gantt);
                const parentHeader = parentTaskNumber ? allRows.find(r => String(r.task_number) === String(parentTaskNumber)) : null;
                if (parentHeader) {
                  return (
                    <Badge variant="outline" className="text-xs font-normal ml-1">
                      Part of: {parentHeader.name}
                    </Badge>
                  );
                }
                return null;
              })()}
              {/* Template badges with sync indicator */}
              {row.sm_template_ids && row.sm_template_ids.length > 0 && templates.length > 0 && (
                <>
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                  {row.sm_template_ids.map((item: number | { id: number; display?: string }) => {
                    const id = typeof item === 'object' ? item.id : item;
                    const name = templates.find(t => t.id === id)?.name || `#${id}`;
                    return (
                      <Badge key={id} variant="secondary" className="text-xs font-normal">
                        {name}
                      </Badge>
                    );
                  })}
                </>
              )}
            </DialogTitle>
            <div className="flex items-center gap-4">
              {/* Auto-save status indicator */}
              <div className="flex items-center text-sm">
                {autoSaveStatus === 'saving' ? (
                  <span className="flex items-center text-muted-foreground">
                    <Spinner size={16} className="mr-2" />
                    Saving...
                  </span>
                ) : null}
                {autoSaveStatus === 'saved' ? (
                  <span className="flex items-center text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4 mr-2" />
                    Saved
                  </span>
                ) : null}
                {autoSaveStatus === 'error' ? (
                  <span className="flex items-center text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Save failed
                  </span>
                ) : null}
                {autoSaveStatus === 'idle' ? (
                  <span className="text-muted-foreground">Auto-save enabled</span>
                ) : null}
              </div>
              {onDuplicate && row && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={duplicating}
                  onClick={async () => {
                    setDuplicating(true);
                    try {
                      await onDuplicate(row.id);
                    } finally {
                      setDuplicating(false);
                    }
                  }}
                >
                  {duplicating ? <Spinner size={14} className="mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                  Duplicate
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3">
            {/* Template sync banner - shown when task belongs to templates */}
            {row.sm_template_ids && row.sm_template_ids.length > 0 && templates.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <RefreshCw className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <p className="text-[11px] text-blue-700 dark:text-blue-300">
                  Changes here sync to {row.sm_template_ids.length === 1 ? 'this template' : 'these templates'}:{' '}
                  <span className="font-medium">
                    {row.sm_template_ids.map((item: number | { id: number; display?: string }) => {
                      const id = typeof item === 'object' ? item.id : item;
                      return templates.find(t => t.id === id)?.name || `#${id}`;
                    }).join(', ')}
                  </span>
                  . Editing in either place updates both.
                </p>
              </div>
            )}
            {/* Row 1: Code + Name + Duration + Sequence - always visible above tabs */}
            <div className="grid grid-cols-[100px_1fr_80px_80px] gap-3">
              <div className="space-y-1">
                <Label htmlFor="row-task-code" className="text-xs">Code</Label>
                <Input
                  id="row-task-code"
                  value={editRowForm.task_code || ""}
                  onChange={(e) => setEditRowForm({ ...editRowForm, task_code: e.target.value })}
                  className="h-8"
                  placeholder="Optional"
                  maxLength={50}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="row-name" className="text-xs">Name</Label>
                <Input
                  id="row-name"
                  value={editRowForm.name || ""}
                  onChange={(e) => setEditRowForm({ ...editRowForm, name: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="row-duration" className="text-xs">Days</Label>
                <Input
                  id="row-duration"
                  type="number"
                  value={editRowForm.duration_days || 0}
                  onChange={(e) => setEditRowForm({ ...editRowForm, duration_days: parseInt(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="row-sequence" className="text-xs">Seq</Label>
                <Input
                  id="row-sequence"
                  type="number"
                  step="0.1"
                  value={editRowForm.sequence_order || 0}
                  onChange={(e) => setEditRowForm({ ...editRowForm, sequence_order: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
            </div>

            {/* Description - full width, always visible above tabs */}
            <div className="space-y-1">
              <Label htmlFor="row-description" className="text-xs">Description</Label>
              <Input
                id="row-description"
                value={editRowForm.description || ""}
                onChange={(e) => setEditRowForm({ ...editRowForm, description: e.target.value })}
                className="h-8"
                placeholder="Optional description..."
              />
            </div>

            {/* ================================================================
                4-TAB LAYOUT: Task | PO & Claims | Documents | Relationships
               ================================================================ */}
            <Tabs defaultValue="task" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="task">Task</TabsTrigger>
                <TabsTrigger value="po-claims">PO & Claims</TabsTrigger>
                <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
                <TabsTrigger value="tender-quotes">Tender & Quotes</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="relationships">Relationships</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>

              {/* ============================================================
                  TAB 1: TASK - Basic settings, classification, toggles
                 ============================================================ */}
              <TabsContent value="task" className="mt-3">
                <div className="grid grid-cols-2 gap-6">
                  {/* Left column: Trade, Role, Stage, Cost Centre, Tender */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Trade</Label>
                      <ComboboxDropdown
                        items={trades.map(t => ({ id: String(t.id), label: t.name }))}
                        selectedItem={editRowForm.trade ? { id: editRowForm.trade, label: trades.find(t => String(t.id) === editRowForm.trade)?.name || row.trade_name || editRowForm.trade } : undefined}
                        onSelect={(item) => setEditRowForm({ ...editRowForm, trade: item.id })}
                        placeholder="Select trade..."
                        emptyResults="No trades found"
                        clearable
                        onClear={() => setEditRowForm({ ...editRowForm, trade: "" })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Assigned Role</Label>
                      <ComboboxDropdown
                        items={roles.map(r => ({ id: String(r.id), label: r.display_name }))}
                        selectedItem={editRowForm.assigned_role ? { id: editRowForm.assigned_role, label: roles.find(r => String(r.id) === editRowForm.assigned_role)?.display_name || editRowForm.assigned_role } : undefined}
                        onSelect={(item) => setEditRowForm({ ...editRowForm, assigned_role: item.id })}
                        placeholder="Select role..."
                        emptyResults="No roles found"
                        clearable
                        onClear={() => setEditRowForm({ ...editRowForm, assigned_role: null })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Stage</Label>
                      <ComboboxDropdown
                        items={stages.map(s => ({ id: String(s.id), label: s.name }))}
                        selectedItem={editRowForm.stage ? { id: editRowForm.stage, label: stages.find(s => String(s.id) === editRowForm.stage)?.name || row.stage_name || editRowForm.stage } : undefined}
                        onSelect={(item) => setEditRowForm({ ...editRowForm, stage: item.id })}
                        placeholder="Select stage..."
                        emptyResults="No stages found"
                        clearable
                        onClear={() => setEditRowForm({ ...editRowForm, stage: "" })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cost Centre</Label>
                      <ComboboxDropdown
                        items={costCentres.map(c => ({ id: String(c.id), label: c.name }))}
                        selectedItem={editRowForm.cost_centre ? { id: editRowForm.cost_centre, label: costCentres.find(c => String(c.id) === editRowForm.cost_centre)?.name || editRowForm.cost_centre_name || editRowForm.cost_centre } : undefined}
                        onSelect={(item) => setEditRowForm({ ...editRowForm, cost_centre: item.id })}
                        placeholder="Cost centre..."
                        emptyResults="No cost centres found"
                        clearable
                        onClear={() => setEditRowForm({ ...editRowForm, cost_centre: "" })}
                      />
                    </div>
                    {tenderSections.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs">Tender Section</Label>
                        <ComboboxDropdown
                          items={tenderSections.map(t => ({ id: String(t.id), label: t.name }))}
                          selectedItem={editRowForm.tender_id ? { id: editRowForm.tender_id, label: tenderSections.find(t => String(t.id) === editRowForm.tender_id)?.name || editRowForm.tender_id } : undefined}
                          onSelect={(item) => setEditRowForm({ ...editRowForm, tender_id: item.id })}
                          placeholder="Tender section..."
                          emptyResults="No tender sections found"
                          clearable
                          onClear={() => setEditRowForm({ ...editRowForm, tender_id: "" })}
                        />
                      </div>
                    )}
                  </div>

                  {/* Right column: Toggles */}
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="row-require-photo"
                          checked={editRowForm.require_photo || false}
                          onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, require_photo: checked })}
                        />
                        <Label htmlFor="row-require-photo" className="text-xs">Require Photo</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="row-pass-fail"
                          checked={editRowForm.pass_fail_enabled || false}
                          onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, pass_fail_enabled: checked })}
                        />
                        <div>
                          <Label htmlFor="row-pass-fail" className="text-xs">Pass/Fail</Label>
                          <p className="text-[10px] text-muted-foreground">Spawns re-inspect if failed</p>
                        </div>
                      </div>
                    </div>

                    {/* Allow Header */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Switch
                        id="row-allow-header"
                        checked={editRowForm.allow_header || false}
                        disabled={editRowForm.po_required || editRowForm.create_po_on_job_start}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditRowForm({ ...editRowForm, allow_header: checked, header_gantt: null });
                          } else {
                            setEditRowForm({ ...editRowForm, allow_header: checked });
                          }
                        }}
                      />
                      <div>
                        <Label htmlFor="row-allow-header" className={`text-xs ${(editRowForm.po_required || editRowForm.create_po_on_job_start) ? "text-muted-foreground" : ""}`}>
                          Allow Header
                        </Label>
                        <p className="text-[10px] text-muted-foreground">Can be selected as parent for other tasks</p>
                      </div>
                      {editRowForm.allow_header && row ? (() => {
                        const children = allRows.filter(r => {
                          const parentId = extractLookupId(r.header_gantt);
                          return parentId && String(parentId) === String(row.task_number);
                        });
                        const childCount = children.length;
                        const subHeaderCount = children.filter(c => c.allow_header).length;

                        return (
                          <div className="flex items-center gap-1">
                            <Badge className="text-[10px] bg-blue-500">Header</Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {childCount} {childCount === 1 ? 'child' : 'children'}
                            </Badge>
                            {subHeaderCount > 0 ? (
                              <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-500 dark:text-blue-400">
                                {subHeaderCount} sub-header{subHeaderCount !== 1 ? 's' : ''}
                              </Badge>
                            ) : null}
                          </div>
                        );
                      })() : null}
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Switch
                        id="row-is-active"
                        checked={editRowForm.is_active !== false}
                        onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, is_active: checked })}
                      />
                      <div>
                        <Label htmlFor="row-is-active" className="text-xs">
                          Active
                        </Label>
                        <p className="text-[10px] text-muted-foreground">Inactive tasks won&apos;t appear in new jobs</p>
                      </div>
                      {editRowForm.is_active === false ? (
                        <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ============================================================
                  TAB 2: PO & CLAIMS
                 ============================================================ */}
              <TabsContent value="po-claims" className="mt-3">
                <div className="grid grid-cols-2 gap-6">
                  {/* Left: PO Settings */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">PO Settings</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="row-po-required"
                          checked={editRowForm.po_required || false}
                          onCheckedChange={(checked) => {
                            if (!checked && !editRowForm.create_po_on_job_start) {
                              setEditRowForm({
                                ...editRowForm,
                                po_required: checked,
                                spawn_order_task: false,
                                spawn_call_task: false,
                                order_time_days: undefined,
                                call_time_days: undefined,
                              });
                            } else {
                              setEditRowForm({ ...editRowForm, po_required: checked });
                            }
                          }}
                        />
                        <Label htmlFor="row-po-required" className="text-xs">PO Required</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="row-critical-po"
                          checked={editRowForm.critical_po || false}
                          onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, critical_po: checked })}
                        />
                        <Label htmlFor="row-critical-po" className="text-xs">Critical PO</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="row-create-po"
                          checked={editRowForm.create_po_on_job_start || false}
                          onCheckedChange={(checked) => {
                            if (!checked && !editRowForm.po_required) {
                              setEditRowForm({
                                ...editRowForm,
                                create_po_on_job_start: checked,
                                spawn_order_task: false,
                                spawn_call_task: false,
                                order_time_days: undefined,
                                call_time_days: undefined,
                              });
                            } else {
                              setEditRowForm({ ...editRowForm, create_po_on_job_start: checked });
                            }
                            if (checked && onOpenAutoPODialog) {
                              onOpenAutoPODialog();
                            }
                          }}
                        />
                        <div className="flex items-center gap-1">
                          <Label htmlFor="row-create-po" className="text-xs">Auto-PO on Start</Label>
                          {editRowForm.create_po_on_job_start && onOpenAutoPODialog ? (
                            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={onOpenAutoPODialog}>
                              Edit
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="row-spawn-order"
                          checked={editRowForm.spawn_order_task || false}
                          disabled={!(editRowForm.po_required || editRowForm.create_po_on_job_start)}
                          onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, spawn_order_task: checked })}
                        />
                        <Label htmlFor="row-spawn-order" className={`text-xs ${!(editRowForm.po_required || editRowForm.create_po_on_job_start) ? "text-muted-foreground" : ""}`}>
                          Spawn Order Task
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="row-spawn-call"
                          checked={editRowForm.spawn_call_task || false}
                          disabled={!(editRowForm.po_required || editRowForm.create_po_on_job_start)}
                          onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, spawn_call_task: checked })}
                        />
                        <Label htmlFor="row-spawn-call" className={`text-xs ${!(editRowForm.po_required || editRowForm.create_po_on_job_start) ? "text-muted-foreground" : ""}`}>
                          Spawn Call Task
                        </Label>
                      </div>
                      {/* Related PO Tasks - for supplier coordination info */}
                      {(editRowForm.po_required || editRowForm.create_po_on_job_start) && (
                        <div className="pt-2 border-t">
                          <Label className="text-xs">Related PO Tasks (for supplier coordination)</Label>
                          <MultipleSelector
                            value={(editRowForm.related_po_task_ids || []).map(id => {
                              const relatedRow = allRows.find(r => r.id === id && r.po_required);
                              return { value: String(id), label: relatedRow?.name || `Task ${id}` };
                            })}
                            options={allRows
                              .filter(r => r.po_required && r.id !== row?.id)
                              .map(r => ({ value: String(r.id), label: r.name }))
                            }
                            onChange={(selected) => {
                              setEditRowForm({
                                ...editRowForm,
                                related_po_task_ids: selected.map(s => Number(s.value))
                              });
                            }}
                            placeholder="Select related PO tasks..."
                            emptyIndicator="No PO tasks available"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            When this PO is created, supplier contact info for these tasks will be included in the description.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Claim Settings + Invoice Preview */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">Claim Settings</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="row-is-claim-task"
                          checked={editRowForm.is_claim_task || false}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const defaultTemplate = invoiceTemplates.find(t => t.is_default);
                              const templateId = editRowForm.claim_invoice_template_id || defaultTemplate?.id || null;
                              setEditRowForm({
                                ...editRowForm,
                                is_claim_task: checked,
                                claim_invoice_template_id: templateId,
                              });
                              if (templateId) {
                                loadTemplatePreview(templateId, { taskName: editRowForm.name });
                              }
                            } else {
                              setEditRowForm({
                                ...editRowForm,
                                is_claim_task: false,
                                is_variation: false,
                                claim_percentage: null,
                                claim_sequence_number: null,
                                claim_invoice_pattern: null,
                                claim_invoice_template_id: null,
                                claim_trading_name_id: null,
                              });
                              setTemplatePreviewHtml(null);
                            }
                          }}
                        />
                        <div>
                          <Label htmlFor="row-is-claim-task" className="text-xs">Is Claim Task</Label>
                          <p className="text-[10px] text-muted-foreground">Creates JobClaimStage on job</p>
                        </div>
                      </div>
                      {editRowForm.is_claim_task ? (
                        <div className="space-y-3 pl-6 border-l-2 border-muted">
                          {/* Variation checkbox */}
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="row-is-variation"
                              checked={editRowForm.is_variation || false}
                              onCheckedChange={(checked) => {
                                setEditRowForm({
                                  ...editRowForm,
                                  is_variation: checked === true,
                                  claim_percentage: checked === true ? null : editRowForm.claim_percentage,
                                });
                              }}
                            />
                            <div>
                              <Label htmlFor="row-is-variation" className="text-xs">Variation</Label>
                              <p className="text-[10px] text-muted-foreground">Amount entered later (no % needed)</p>
                            </div>
                          </div>

                          {/* Percentage */}
                          {!editRowForm.is_variation ? (
                          <div className="space-y-1">
                            <Label htmlFor="row-claim-percentage" className="text-xs">Claim Percentage *</Label>
                            <div className="flex items-center gap-1">
                              <Input
                                id="row-claim-percentage"
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                value={editRowForm.claim_percentage || ""}
                                onChange={(e) => setEditRowForm({ ...editRowForm, claim_percentage: e.target.value ? parseFloat(e.target.value) : null })}
                                className="h-8 w-24"
                                placeholder="15.00"
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Percentage of contract price</p>
                          </div>
                          ) : null}

                          {/* Trading Name */}
                          <div className="space-y-1">
                            <Label className="text-xs">Trading Name</Label>
                            <ComboboxDropdown
                              items={tradingNames.map(tn => ({ id: String(tn.id), label: tn.name }))}
                              selectedItem={editRowForm.claim_trading_name_id ? {
                                id: String(editRowForm.claim_trading_name_id),
                                label: tradingNames.find(tn => tn.id === editRowForm.claim_trading_name_id)?.name || `ID ${editRowForm.claim_trading_name_id}`
                              } : undefined}
                              onSelect={(item) => setEditRowForm({ ...editRowForm, claim_trading_name_id: parseInt(item.id) })}
                              placeholder="Select trading name..."
                              emptyResults="No trading names found"
                              clearable
                              onClear={() => setEditRowForm({ ...editRowForm, claim_trading_name_id: null })}
                            />
                            <p className="text-[10px] text-muted-foreground">Company name shown on claim invoice</p>
                          </div>

                          {/* Claim Sequence Number */}
                          <div className="space-y-1">
                            <Label htmlFor="row-claim-sequence-number" className="text-xs">Claim Sequence Number</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="row-claim-sequence-number"
                                type="number"
                                min={1}
                                step={1}
                                value={editRowForm.claim_sequence_number || ""}
                                onChange={(e) => setEditRowForm({ ...editRowForm, claim_sequence_number: e.target.value ? parseInt(e.target.value) : null })}
                                className="h-8 w-20"
                                placeholder="1"
                              />
                              <span className="text-xs text-muted-foreground">→ J{"{job}"}-{editRowForm.claim_sequence_number || "?"}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Matches invoices with reference J{"{job_number}"}-{"{sequence}"} (e.g., J201-1)</p>
                          </div>

                          {/* Invoice Match Pattern */}
                          <div className="space-y-1">
                            <Label htmlFor="row-claim-invoice-pattern" className="text-xs">Invoice Match Pattern</Label>
                            <Input
                              id="row-claim-invoice-pattern"
                              type="text"
                              value={editRowForm.claim_invoice_pattern || ""}
                              onChange={(e) => setEditRowForm({ ...editRowForm, claim_invoice_pattern: e.target.value || null })}
                              className="h-8"
                              placeholder="e.g., Deposit, Slab, Frame..."
                            />
                            <p className="text-[10px] text-muted-foreground">Fallback: Pattern to match Xero invoice descriptions</p>
                          </div>

                          {/* Invoice Template Selector */}
                          <div className="space-y-2">
                            <Label className="text-xs">Invoice Template</Label>
                            <div className="grid grid-cols-1 gap-2">
                              {invoiceTemplates.map((template) => (
                                <div
                                  key={template.id}
                                  onClick={() => {
                                    setEditRowForm({ ...editRowForm, claim_invoice_template_id: template.id });
                                    const tradingName = editRowForm.claim_trading_name_id
                                      ? tradingNames.find(tn => tn.id === editRowForm.claim_trading_name_id)?.name
                                      : undefined;
                                    loadTemplatePreview(template.id, {
                                      tradingName,
                                      claimPercentage: editRowForm.claim_percentage || undefined,
                                      taskName: editRowForm.name,
                                    });
                                  }}
                                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                    editRowForm.claim_invoice_template_id === template.id
                                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                                      : "border-border hover:border-primary/50"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="w-8 h-8 rounded flex-shrink-0"
                                      style={{
                                        background: `linear-gradient(135deg, ${template.primary_color} 0%, ${template.primary_color} 60%, ${template.secondary_color} 100%)`
                                      }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{template.name}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">{template.description}</p>
                                    </div>
                                    {template.is_default ? (
                                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">Default</Badge>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {invoiceTemplates.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground">No templates available</p>
                            ) : null}
                          </div>

                          {/* Invoice Preview */}
                          {editRowForm.claim_invoice_template_id ? (
                            <div className="pt-3 border-t space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Invoice Preview</Label>
                                {loadingTemplatePreview ? <Spinner size={14} /> : null}
                              </div>
                              {templatePreviewHtml && !loadingTemplatePreview ? (
                                <div
                                  className="border rounded-lg bg-white overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                                  style={{ height: "280px", overflow: "hidden" }}
                                  onDoubleClick={() => setShowFullPreview(true)}
                                  title="Double-click for full size"
                                >
                                  <div
                                    style={{ transform: "scale(0.35)", transformOrigin: "top left", width: "286%", pointerEvents: "none" }}
                                    dangerouslySetInnerHTML={{ __html: templatePreviewHtml }}
                                  />
                                </div>
                              ) : null}
                              {templatePreviewHtml && !loadingTemplatePreview ? (
                                <p className="text-[10px] text-muted-foreground text-center">Double-click to enlarge</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ============================================================
                  TAB 3: DEPENDENCIES - Predecessors & Successors
                  Uses shared DependencyInfoPanel for consistency with Gantt
                  Fully editable: add/remove predecessors, change type/lag
                 ============================================================ */}
              <TabsContent value="dependencies" className="mt-3">
                <div className="flex gap-4">
                  {/* Left Sidebar - Shared Info Panel (same as Gantt) */}
                  <DependencyInfoPanel showDragGuide={false} />

                  {/* Main Content - Predecessors & Successors */}
                  <div className="flex-1 overflow-y-auto space-y-4 min-w-0">
                    {/* Predecessors Section - EDITABLE */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <h3 className="text-sm font-semibold">Predecessors</h3>
                        <span className="text-xs text-muted-foreground">
                          ({(editRowForm.predecessor_ids || []).length})
                        </span>
                      </div>

                      {/* Header row */}
                      <div className={`grid ${DEPENDENCY_GRID_COLS_EDITABLE} gap-2 text-xs font-medium text-muted-foreground px-1`}>
                        <span>Row #</span>
                        <span>ID</span>
                        <span>Task</span>
                        <span>Type</span>
                        <span>Lag</span>
                        <span></span>
                      </div>

                      <div className="space-y-2">
                        {(editRowForm.predecessor_ids || []).map((pred, index) => {
                          const predTask = allRows.find(r => r.task_number === pred.id || r.id === pred.id);
                          return (
                            <div key={`pred-${pred.id}-${index}`} className={`grid ${DEPENDENCY_GRID_COLS_EDITABLE} gap-2 items-center`}>
                              {/* Row # input */}
                              <Input
                                type="number"
                                min={1}
                                value={predTask?.task_number || pred.id}
                                onChange={(e) => {
                                  const taskNum = parseInt(e.target.value, 10);
                                  const found = allRows.find(r => r.task_number === taskNum);
                                  if (found && found.id !== row.id) {
                                    const updated = [...(editRowForm.predecessor_ids || [])];
                                    updated[index] = { ...updated[index], id: found.task_number };
                                    setEditRowForm({ ...editRowForm, predecessor_ids: updated });
                                  }
                                }}
                                className="h-8 text-center"
                                placeholder="#"
                              />
                              {/* ID display */}
                              <div className="h-8 flex items-center justify-center text-xs text-muted-foreground rounded-md border border-input bg-background">
                                {predTask?.id || ""}
                              </div>
                              {/* Task dropdown */}
                              <ComboboxDropdown
                                items={allRows
                                  .filter(r => r.id !== row.id)
                                  .map(r => ({ id: String(r.task_number), label: r.name, description: `#${r.task_number}` }))}
                                selectedItem={predTask ? { id: String(predTask.task_number), label: predTask.name, description: `#${predTask.task_number}` } : undefined}
                                onSelect={(item) => {
                                  const updated = [...(editRowForm.predecessor_ids || [])];
                                  updated[index] = { ...updated[index], id: Number(item.id) };
                                  setEditRowForm({ ...editRowForm, predecessor_ids: updated });
                                }}
                                placeholder="Select task..."
                                searchPlaceholder="Search tasks..."
                                className="h-8"
                              />
                              {/* Type dropdown */}
                              <select
                                value={pred.type || "FS"}
                                onChange={(e) => {
                                  const updated = [...(editRowForm.predecessor_ids || [])];
                                  updated[index] = { ...updated[index], type: e.target.value };
                                  setEditRowForm({ ...editRowForm, predecessor_ids: updated });
                                }}
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
                                value={pred.lag || 0}
                                onChange={(e) => {
                                  const updated = [...(editRowForm.predecessor_ids || [])];
                                  updated[index] = { ...updated[index], lag: parseInt(e.target.value, 10) || 0 };
                                  setEditRowForm({ ...editRowForm, predecessor_ids: updated });
                                }}
                                className="h-8 text-center"
                                placeholder="0"
                              />
                              {/* Remove button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  const updated = (editRowForm.predecessor_ids || []).filter((_, i) => i !== index);
                                  setEditRowForm({ ...editRowForm, predecessor_ids: updated });
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}

                        {/* Empty row to add new predecessor */}
                        <div className={`grid ${DEPENDENCY_GRID_COLS_EDITABLE} gap-2 items-center opacity-60`}>
                          <Input
                            type="number"
                            min={1}
                            value=""
                            onChange={(e) => {
                              const taskNum = parseInt(e.target.value, 10);
                              const found = allRows.find(r => r.task_number === taskNum);
                              if (found && found.id !== row.id &&
                                !(editRowForm.predecessor_ids || []).some(p => p.id === found.task_number)) {
                                setEditRowForm({
                                  ...editRowForm,
                                  predecessor_ids: [...(editRowForm.predecessor_ids || []), { id: found.task_number, type: "FS", lag: 0 }]
                                });
                              }
                            }}
                            className="h-8 text-center"
                            placeholder="#"
                          />
                          <div className="h-8 flex items-center justify-center text-xs text-muted-foreground rounded-md border border-input bg-background" />
                          <ComboboxDropdown
                            items={allRows
                              .filter(r => r.id !== row.id && !(editRowForm.predecessor_ids || []).some(p => p.id === r.task_number))
                              .map(r => ({ id: String(r.task_number), label: r.name, description: `#${r.task_number}` }))}
                            selectedItem={undefined}
                            onSelect={(item) => {
                              setEditRowForm({
                                ...editRowForm,
                                predecessor_ids: [...(editRowForm.predecessor_ids || []), { id: Number(item.id), type: "FS", lag: 0 }]
                              });
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

                    {/* Successors Section - READ-ONLY (computed from other rows' predecessor_ids) */}
                    <div className="space-y-2 border-t pt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <h3 className="text-sm font-semibold">Successors</h3>
                        {(() => {
                          const successorCount = allRows.filter(r =>
                            r.predecessor_ids?.some(p => p.id === row?.task_number || p.id === row?.id)
                          ).length;
                          return <span className="text-xs text-muted-foreground">({successorCount})</span>;
                        })()}
                      </div>

                      {/* Header row */}
                      <div className={`grid ${DEPENDENCY_GRID_COLS} gap-2 text-xs font-medium text-muted-foreground px-1`}>
                        <span>Row #</span>
                        <span>ID</span>
                        <span>Task</span>
                        <span>Type</span>
                        <span>Lag</span>
                      </div>

                      {(() => {
                        const successors = allRows.filter(r =>
                          r.predecessor_ids?.some(p => p.id === row?.task_number || p.id === row?.id)
                        );
                        if (successors.length === 0) {
                          return <p className="text-xs text-muted-foreground italic py-2">No successors — no tasks depend on this one</p>;
                        }
                        return (
                          <div className="space-y-2">
                            {successors.map((succ) => {
                              const pred = succ.predecessor_ids?.find(p => p.id === row?.task_number || p.id === row?.id);
                              return (
                                <div key={`succ-${succ.id}`} className={`grid ${DEPENDENCY_GRID_COLS} gap-2 items-center`}>
                                  <div className="h-8 flex items-center justify-center text-sm rounded-md border border-input bg-background">
                                    {succ.task_number}
                                  </div>
                                  <div className="h-8 flex items-center justify-center text-xs text-muted-foreground rounded-md border border-input bg-background">
                                    {succ.id}
                                  </div>
                                  <div className="h-8 flex items-center px-2 text-sm rounded-md border border-input bg-background truncate">
                                    {succ.name}
                                  </div>
                                  <div className="h-8 flex items-center px-2 text-sm rounded-md border border-input bg-background">
                                    {pred?.type === "FS" ? "Finish-to-Start (FS)"
                                      : pred?.type === "SS" ? "Start-to-Start (SS)"
                                      : pred?.type === "FF" ? "Finish-to-Finish (FF)"
                                      : pred?.type === "SF" ? "Start-to-Finish (SF)"
                                      : "Finish-to-Start (FS)"}
                                  </div>
                                  <div className="h-8 flex items-center justify-center text-sm rounded-md border border-input bg-background">
                                    {pred?.lag || 0}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ============================================================
                  TAB: TENDER & QUOTES - Tender section mapping + quote flow
                 ============================================================ */}
              <TabsContent value="tender-quotes" className="mt-3" onFocusCapture={loadTenderTree}>
                {/* Trigger lazy loads when tab becomes visible */}
                <div ref={(el) => { if (el) { loadTenderTree(); loadTemplateLinks(); } }} />

                {/* SSoT Info Banner */}
                <div className="mb-4 p-2.5 rounded-md border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    <span className="font-semibold">Two-way sync</span> &mdash; Changes here sync to linked PO Templates and Custom Quote Templates. Editing in either place updates both.
                  </p>
                </div>

                {/* SSoT Editable Fields */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Tender Description</Label>
                      <p className="text-[10px] text-muted-foreground mb-1">Scope text for tender documents</p>
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                        value={editRowForm.tender_description || ''}
                        onChange={(e) => setEditRowForm({ ...editRowForm, tender_description: e.target.value })}
                        placeholder="Description for tender document section..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">PO Description</Label>
                      <p className="text-[10px] text-muted-foreground mb-1">Scope of work / narrative for the Purchase Order</p>
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                        value={editRowForm.po_description || ''}
                        onChange={(e) => setEditRowForm({ ...editRowForm, po_description: e.target.value })}
                        placeholder="PO scope of work..."
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">RFQ Instructions</Label>
                      <p className="text-[10px] text-muted-foreground mb-1">Default instructions sent to suppliers with quote requests</p>
                      <textarea
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                        value={editRowForm.rfq_instructions || ''}
                        onChange={(e) => setEditRowForm({ ...editRowForm, rfq_instructions: e.target.value })}
                        placeholder="Instructions for supplier RFQ..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Budget Amount</Label>
                      <p className="text-[10px] text-muted-foreground mb-1">Budget estimate for this PO task</p>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editRowForm.budget_amount ?? ''}
                        onChange={(e) => setEditRowForm({ ...editRowForm, budget_amount: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="0.00"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Linked Templates (read-only) */}
                {templateLinks && (templateLinks.po_template_packs.length > 0 || templateLinks.custom_quote_templates.length > 0) && (
                  <div className="mb-5 p-3 rounded-md border bg-muted/30 dark:bg-muted/10">
                    <Label className="text-xs font-medium">Linked Templates</Label>
                    <p className="text-[10px] text-muted-foreground mb-2">These templates read their shared fields from this task</p>
                    <div className="grid grid-cols-2 gap-3">
                      {templateLinks.po_template_packs.length > 0 && (
                        <div>
                          <div className="text-[10px] font-medium text-muted-foreground mb-1">PO Template Packs</div>
                          <div className="space-y-1">
                            {templateLinks.po_template_packs.map(pack => (
                              <div key={pack.id} className="flex items-center gap-1.5 text-[11px]">
                                <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="truncate">{pack.pack_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {templateLinks.custom_quote_templates.length > 0 && (
                        <div>
                          <div className="text-[10px] font-medium text-muted-foreground mb-1">Custom Quote Templates</div>
                          <div className="space-y-1">
                            {templateLinks.custom_quote_templates.map(tmpl => (
                              <div key={tmpl.id} className="flex items-center gap-1.5 text-[11px]">
                                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="truncate">{tmpl.template_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  {/* Left: Tender Section Context */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-medium">Tender Section Assignment</Label>
                      <p className="text-[10px] text-muted-foreground mb-2">Which tender section this task belongs to</p>

                      {editRowForm.tender_id ? (() => {
                        // Find this section in the tender tree for full context
                        const tenderId = Number(editRowForm.tender_id);
                        const sectionName = tenderSections.find(t => t.id === tenderId)?.name || `Section ${tenderId}`;
                        let headerName: string | undefined;
                        let sectionType: string | undefined;
                        let attachedDocs: string[] = [];

                        for (const header of tenderTree) {
                          const section = header.children.find(s => s.id === tenderId);
                          if (section) {
                            headerName = header.name;
                            sectionType = section.sectionType;
                            attachedDocs = section.attachedDocumentTypes || [];
                            break;
                          }
                        }

                        return (
                          <div className="space-y-2">
                            <div className="p-3 rounded-md border bg-muted/30 dark:bg-muted/10">
                              {headerName && (
                                <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {headerName}
                                </div>
                              )}
                              <div className="text-sm font-medium">{sectionName}</div>
                              <div className="flex items-center gap-2 mt-1">
                                {sectionType && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 capitalize">
                                    {sectionType}
                                  </Badge>
                                )}
                                {attachedDocs.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {attachedDocs.length} doc type{attachedDocs.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              {attachedDocs.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {attachedDocs.map(dt => (
                                    <Badge key={dt} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                      {dt}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Other tasks in the same tender section */}
                            {(() => {
                              const siblingTasks = allRows.filter(r =>
                                r.id !== row?.id && r.tender_id === editRowForm.tender_id
                              );
                              if (siblingTasks.length === 0) return null;
                              return (
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">
                                    Other tasks in this section ({siblingTasks.length})
                                  </Label>
                                  <div className="space-y-1 mt-1 max-h-32 overflow-y-auto">
                                    {siblingTasks.map(t => (
                                      <div key={t.id} className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-muted/20 dark:bg-muted/5">
                                        <span className="text-muted-foreground/60">#{t.task_number}</span>
                                        <span className="truncate">{t.name}</span>
                                        {t.po_required && (
                                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 ml-auto shrink-0">PO</Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })() : (
                        <p className="text-xs text-muted-foreground italic py-2">
                          No tender section assigned. Set the Tender field on the Task tab to assign this task to a tender section.
                        </p>
                      )}
                    </div>

                    {/* Tender Tree Overview */}
                    {loadingTenderTree ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Spinner className="h-3 w-3" />
                        Loading tender structure...
                      </div>
                    ) : tenderTree.length > 0 ? (
                      <div className="pt-2 border-t">
                        <Label className="text-[10px] text-muted-foreground">Tender Structure</Label>
                        <div className="space-y-1.5 mt-1 max-h-48 overflow-y-auto">
                          {tenderTree.map(header => (
                            <div key={header.id}>
                              <div className="text-[10px] font-medium text-muted-foreground px-1">
                                {header.code} {header.name}
                              </div>
                              {header.children.map(section => {
                                const isCurrentSection = editRowForm.tender_id && Number(editRowForm.tender_id) === section.id;
                                const taskCount = allRows.filter(r => r.tender_id === String(section.id)).length;
                                return (
                                  <div
                                    key={section.id}
                                    className={`flex items-center gap-2 px-2 py-0.5 rounded text-[11px] ml-3 ${
                                      isCurrentSection
                                        ? 'bg-primary/10 dark:bg-primary/20 font-medium'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    <span className="truncate">{section.name}</span>
                                    {taskCount > 0 && (
                                      <span className="text-[9px] text-muted-foreground/60 ml-auto shrink-0">
                                        {taskCount} task{taskCount !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Right: Quote Mapping */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-medium">Quote Mapping</Label>
                      <p className="text-[10px] text-muted-foreground mb-2">How this task maps into quotes and tenders</p>

                      {/* Mode indicator */}
                      <div className="space-y-2">
                        <div className="p-3 rounded-md border bg-muted/30 dark:bg-muted/10">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {row?.po_required ? 'PO-Level Task' : 'Non-PO Task'}
                            </span>
                          </div>

                          {row?.po_required ? (
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-muted-foreground">
                                This task generates a Purchase Order. In tenders, it maps as a direct line item — each PO task creates its own tender line.
                              </p>
                              {editRowForm.cost_centre && (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="text-muted-foreground">Cost Centre:</span>
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    {costCentres.find(cc => String(cc.id) === editRowForm.cost_centre)?.name || editRowForm.cost_centre_name || `CC ${editRowForm.cost_centre}`}
                                  </Badge>
                                </div>
                              )}
                              {row.po_supplier_name && (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="text-muted-foreground">Default Supplier:</span>
                                  <span>{row.po_supplier_name}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">
                              Non-PO tasks don&apos;t appear directly in tender documents but contribute to the schedule timeline.
                            </p>
                          )}
                        </div>

                        {/* Cost Centre Grouping - shows tasks that share the same CC */}
                        {editRowForm.cost_centre && (() => {
                          const ccId = editRowForm.cost_centre;
                          const ccName = costCentres.find(cc => String(cc.id) === ccId)?.name || editRowForm.cost_centre_name || `CC ${ccId}`;
                          const ccTasks = allRows.filter(r =>
                            r.id !== row?.id && r.cost_centre === ccId && r.po_required
                          );

                          return (
                            <div className="p-3 rounded-md border bg-muted/30 dark:bg-muted/10">
                              <div className="text-xs font-medium mb-1">
                                Cost Centre: {ccName}
                              </div>
                              <p className="text-[10px] text-muted-foreground mb-2">
                                When quoting by Cost Centre, these PO tasks merge into one quote line. Suppliers quote on the group, and amounts are allocated back to individual POs.
                              </p>
                              {ccTasks.length > 0 ? (
                                <div className="space-y-1 max-h-28 overflow-y-auto">
                                  {ccTasks.map(t => (
                                    <div key={t.id} className="flex items-center gap-2 px-2 py-0.5 rounded text-[11px] bg-muted/20 dark:bg-muted/5">
                                      <span className="text-muted-foreground/60">#{t.task_number}</span>
                                      <span className="truncate">{t.name}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-muted-foreground italic">
                                  No other PO tasks share this cost centre
                                </p>
                              )}
                            </div>
                          );
                        })()}

                        {/* Quote Flow Summary */}
                        {row?.po_required && (
                          <div className="pt-2 border-t">
                            <Label className="text-[10px] text-muted-foreground">Quote Flow</Label>
                            <div className="mt-1 space-y-1">
                              <div className="flex items-start gap-2 text-[11px]">
                                <div className="w-4 h-4 rounded-full bg-primary/20 dark:bg-primary/30 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">1</div>
                                <span>
                                  {editRowForm.cost_centre
                                    ? 'Tasks in same Cost Centre are grouped into one quote line'
                                    : 'Task maps directly as a PO-level quote line'}
                                </span>
                              </div>
                              <div className="flex items-start gap-2 text-[11px]">
                                <div className="w-4 h-4 rounded-full bg-primary/20 dark:bg-primary/30 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">2</div>
                                <span>Suppliers are invited to quote (RFQ sent via email)</span>
                              </div>
                              <div className="flex items-start gap-2 text-[11px]">
                                <div className="w-4 h-4 rounded-full bg-primary/20 dark:bg-primary/30 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">3</div>
                                <span>Accepted quote creates Purchase Order linked to this task</span>
                              </div>
                              <div className="flex items-start gap-2 text-[11px]">
                                <div className="w-4 h-4 rounded-full bg-primary/20 dark:bg-primary/30 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">4</div>
                                <span>PO appears in tender document under assigned section</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ============================================================
                  TAB 4: DOCUMENTS - Plans, Doc Refs, Spawn Scan, Completion Doc
                 ============================================================ */}
              <TabsContent value="documents" className="mt-3">
                <div className="grid grid-cols-2 gap-6">
                  {/* Left: Attached Plans + Spawn Scan Task */}
                  <div className="space-y-4">
                    {/* Attached Plans */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Attached Plans</Label>
                      <MultipleSelector
                        value={(editRowForm.plan_type_ids || []).map(id => {
                          const dt = planDocTypes.find(d => d.id === id);
                          const label = dt ? (dt.abbreviation ? `${dt.abbreviation} - ${dt.display_name || dt.name}` : dt.display_name || dt.name) : `Type ${id}`;
                          return { value: String(id), label };
                        })}
                        onChange={(options) => {
                          setEditRowForm({
                            ...editRowForm,
                            plan_type_ids: options.map(o => parseInt(o.value))
                          });
                        }}
                        defaultOptions={planDocTypes.map(dt => ({
                          value: String(dt.id),
                          label: dt.abbreviation ? `${dt.abbreviation} - ${dt.display_name || dt.name}` : dt.display_name || dt.name
                        }))}
                        onSearchSync={(search) => {
                          const lower = search.toLowerCase();
                          return planDocTypes
                            .filter(dt => {
                              const label = dt.abbreviation ? `${dt.abbreviation} - ${dt.display_name || dt.name}` : dt.display_name || dt.name;
                              return label.toLowerCase().includes(lower);
                            })
                            .map(dt => ({
                              value: String(dt.id),
                              label: dt.abbreviation ? `${dt.abbreviation} - ${dt.display_name || dt.name}` : dt.display_name || dt.name
                            }));
                        }}
                        placeholder="Select plan types..."
                        emptyIndicator={
                          <p className="text-center text-xs text-muted-foreground">
                            No plan document types available
                          </p>
                        }
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Plan types associated with this task for reference when working on jobs
                      </p>
                    </div>

                    {/* Spawn Scan Task */}
                    <div className="space-y-1 pt-3 border-t">
                      <Label className="text-xs font-medium">Spawn Scan Task</Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <ComboboxDropdown
                            items={documentTypes.map(dt => ({ id: String(dt.id), label: dt.abbreviation ? `${dt.abbreviation} - ${dt.display_name || dt.name}` : dt.display_name || dt.name }))}
                            selectedItem={(() => {
                              const firstDocType = editRowForm.document_types?.[0];
                              if (!firstDocType) return undefined;
                              const docType = documentTypes.find(dt => dt.id === firstDocType.document_type_id);
                              const label = docType ? (docType.abbreviation ? `${docType.abbreviation} - ${docType.display_name || docType.name}` : docType.display_name || docType.name) : firstDocType.document_type_name;
                              return {
                                id: String(firstDocType.document_type_id),
                                label
                              };
                            })()}
                            onSelect={(item) => setEditRowForm({
                              ...editRowForm,
                              document_types: [{
                                id: editRowForm.document_types?.[0]?.id || 0,
                                document_type_id: Number(item.id),
                                document_type_name: item.label,
                                lag_days: editRowForm.document_types?.[0]?.lag_days || 0
                              }]
                            })}
                            placeholder="Select document type..."
                            emptyResults="No document types found"
                            clearable
                            onClear={() => setEditRowForm({ ...editRowForm, document_types: [] })}
                          />
                        </div>
                        <div className="w-16">
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            title="Days after task completion before spawning document task"
                            value={editRowForm.document_types?.[0]?.lag_days || 0}
                            onChange={(e) => {
                              const lagDays = parseInt(e.target.value) || 0;
                              const currentDocType = editRowForm.document_types?.[0];
                              if (currentDocType) {
                                setEditRowForm({
                                  ...editRowForm,
                                  document_types: [{
                                    ...currentDocType,
                                    lag_days: lagDays
                                  }]
                                });
                              }
                            }}
                            disabled={!editRowForm.document_types?.[0]}
                          />
                        </div>
                      </div>
                      {/* Preview of spawn behavior */}
                      {editRowForm.document_types?.[0]?.document_type_id ? (() => {
                        const docType = documentTypes.find(dt => dt.id === editRowForm.document_types![0].document_type_id);
                        const formNumbers = docType?.form_number_mapping ? Object.values(docType.form_number_mapping) : [];
                        const uniqueFormNumbers = [...new Set(formNumbers)].filter(Boolean);
                        const formNumberDisplay = uniqueFormNumbers.length > 0
                          ? ` ${uniqueFormNumbers.join('/')}`
                          : '';

                        return (
                          <div className="text-xs bg-muted/50 rounded px-2 py-1.5 border border-dashed">
                            <span className="text-muted-foreground">When completed → </span>
                            <span className="font-medium text-foreground">
                              GET - {(editRowForm.document_types![0].document_type_name || 'Scan task')
                                .replace(/\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*/g, '')
                                .replace(/\s*\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\s*/g, '')
                                .replace(/\s*\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{2,4}\s*/gi, '')
                                .trim()}{formNumberDisplay}
                            </span>
                            {(editRowForm.document_types![0].lag_days || 0) > 0 ? (
                              <span className="text-muted-foreground">
                                {' '}spawns in {editRowForm.document_types![0].lag_days} day{editRowForm.document_types![0].lag_days !== 1 ? 's' : ''}
                              </span>
                            ) : null}
                            {(editRowForm.document_types![0].lag_days || 0) === 0 ? (
                              <span className="text-muted-foreground"> spawns immediately</span>
                            ) : null}
                          </div>
                        );
                      })() : (
                        <p className="text-xs text-muted-foreground">Select a document type to spawn a scan task on completion</p>
                      )}
                    </div>
                  </div>

                  {/* Right: Attached Documents + Completion Doc Requirement */}
                  <div className="space-y-4">
                    {/* Attached Documents */}
                    <div>
                      <DocumentTypeTreePicker
                        selectedIds={editRowForm.document_ref_type_ids || []}
                        onChange={(ids) => setEditRowForm({ ...editRowForm, document_ref_type_ids: ids })}
                      />
                    </div>

                    {/* Completion Document Requirement */}
                    <div className="space-y-1 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="row-requires-document"
                          checked={editRowForm.requires_document_to_complete || false}
                          onCheckedChange={(checked) => setEditRowForm({
                            ...editRowForm,
                            requires_document_to_complete: checked,
                            completion_document_type_id: checked ? editRowForm.completion_document_type_id : null
                          })}
                        />
                        <Label htmlFor="row-requires-document" className="text-xs">Requires Document to Complete</Label>
                      </div>
                      {editRowForm.requires_document_to_complete && (
                        <>
                          <ComboboxDropdown
                            items={documentTypes.map(dt => ({ id: String(dt.id), label: dt.abbreviation ? `${dt.abbreviation} - ${dt.display_name || dt.name}` : dt.display_name || dt.name }))}
                            selectedItem={editRowForm.completion_document_type_id ? {
                              id: String(editRowForm.completion_document_type_id),
                              label: (() => { const dt = documentTypes.find(d => d.id === editRowForm.completion_document_type_id); return dt ? (dt.abbreviation ? `${dt.abbreviation} - ${dt.display_name || dt.name}` : dt.display_name || dt.name) : editRowForm.completion_document_type_name || ''; })()
                            } : undefined}
                            onSelect={(item) => setEditRowForm({
                              ...editRowForm,
                              completion_document_type_id: Number(item.id),
                              completion_document_type_name: item.label
                            })}
                            placeholder="Select required document type..."
                            emptyResults="No document types found"
                            clearable
                            onClear={() => setEditRowForm({ ...editRowForm, completion_document_type_id: null, completion_document_type_name: null })}
                          />
                          <p className="text-xs text-muted-foreground">Task cannot be completed until a document of this type is attached</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ============================================================
                  TAB 4: RELATIONSHIPS
                 ============================================================ */}
              <TabsContent value="relationships" className="mt-3">
                <div className="grid grid-cols-2 gap-6">
                  {/* Left: Header, Checklist, Child Tasks, Workflows */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Header Gantt</Label>
                      <ComboboxDropdown
                        items={headerRows.map(h => ({ id: String(h.task_number), label: h.name }))}
                        selectedItem={(() => {
                          const headerTaskNum = extractLookupId(editRowForm.header_gantt);
                          if (!headerTaskNum || headerTaskNum === 'Header') return undefined;
                          const headerName = headerRows.find(h => String(h.task_number) === headerTaskNum)?.name
                            || extractLookupDisplay(row.header_gantt)
                            || headerTaskNum;
                          return { id: headerTaskNum, label: headerName };
                        })()}
                        onSelect={(item) => setEditRowForm({ ...editRowForm, header_gantt: item.id })}
                        placeholder="Select header..."
                        emptyResults="No header rows found"
                        clearable
                        onClear={() => setEditRowForm({ ...editRowForm, header_gantt: null })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Checklist</Label>
                      <ComboboxDropdown
                        items={checklists.map(c => ({ id: String(c.id), label: c.name }))}
                        selectedItem={(() => {
                          const checklistId = extractLookupId(editRowForm.checklist_id);
                          if (!checklistId) return undefined;
                          const checklistName = checklists.find(c => String(c.id) === checklistId)?.name
                            || extractLookupDisplay(row.checklist_id)
                            || checklistId;
                          return { id: checklistId, label: checklistName };
                        })()}
                        onSelect={(item) => setEditRowForm({ ...editRowForm, checklist_id: Number(item.id) })}
                        placeholder="Select checklist..."
                        emptyResults="No checklists found"
                        clearable
                        onClear={() => setEditRowForm({ ...editRowForm, checklist_id: null })}
                      />
                    </div>

                    {/* Child Tasks - shown when Allow Header is enabled */}
                    {editRowForm.allow_header && row && onChildTaskUpdate ? (
                      <div className="pt-2 border-t">
                        <Label className="text-xs">Child Tasks ({allRows.filter(r => {
                          const parentId = extractLookupId(r.header_gantt);
                          return parentId && String(parentId) === String(row.task_number);
                        }).length} grouped under this header)</Label>
                        <MultipleSelector
                          value={allRows
                            .filter(r => {
                              const parentId = extractLookupId(r.header_gantt);
                              return parentId && String(parentId) === String(row.task_number);
                            })
                            .map(r => ({ value: String(r.id), label: r.name }))}
                          onChange={async (options) => {
                            const currentChildIds = allRows
                              .filter(r => {
                                const parentId = extractLookupId(r.header_gantt);
                                return parentId && String(parentId) === String(row.task_number);
                              })
                              .map(r => r.id);
                            const newChildIds = options.map(o => parseInt(o.value));

                            const addedIds = newChildIds.filter(id => !currentChildIds.includes(id));
                            const removedIds = currentChildIds.filter(id => !newChildIds.includes(id));

                            try {
                              for (const childId of addedIds) {
                                await onChildTaskUpdate(childId, row.task_number);
                              }
                              for (const childId of removedIds) {
                                await onChildTaskUpdate(childId, null);
                              }
                              onRefresh?.();
                            } catch (error) {
                              console.error("Failed to update child tasks:", error);
                            }
                          }}
                          defaultOptions={allRows
                            .filter(r => {
                              if (r.id === row.id) return false;
                              const parentId = extractLookupId(r.header_gantt);
                              return !parentId || String(parentId) === String(row.task_number);
                            })
                            .map(r => ({
                              value: String(r.id),
                              label: r.name
                            }))}
                          placeholder="Select child tasks..."
                          emptyIndicator={
                            <p className="text-center text-xs text-muted-foreground">
                              No available tasks to add as children
                            </p>
                          }
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          These tasks will be grouped under this header in the Gantt chart
                        </p>
                      </div>
                    ) : null}

                    {/* Workflow Triggers */}
                    {workflows.length > 0 && (
                      <div className="pt-2 border-t space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Switch
                              id="row-start-workflow-enabled"
                              checked={editRowForm.start_workflow_enabled || false}
                              onCheckedChange={(checked) => setEditRowForm({
                                ...editRowForm,
                                start_workflow_enabled: checked,
                                start_workflow_id: checked ? editRowForm.start_workflow_id : null
                              })}
                            />
                            <Label htmlFor="row-start-workflow-enabled" className="text-xs">Start Workflow</Label>
                          </div>
                          {editRowForm.start_workflow_enabled && (
                            <ComboboxDropdown
                              items={workflows.map(w => ({ id: String(w.id), label: w.name }))}
                              selectedItem={editRowForm.start_workflow_id ? {
                                id: String(editRowForm.start_workflow_id),
                                label: editRowForm.start_workflow_name || workflows.find(w => w.id === editRowForm.start_workflow_id)?.name || ''
                              } : undefined}
                              onSelect={(item) => setEditRowForm({
                                ...editRowForm,
                                start_workflow_id: Number(item.id),
                                start_workflow_name: item.label
                              })}
                              placeholder="Select workflow to run on task start..."
                              emptyResults="No workflows found"
                              clearable
                              onClear={() => setEditRowForm({ ...editRowForm, start_workflow_id: null, start_workflow_name: null })}
                            />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Switch
                              id="row-complete-workflow-enabled"
                              checked={editRowForm.complete_workflow_enabled || false}
                              onCheckedChange={(checked) => setEditRowForm({
                                ...editRowForm,
                                complete_workflow_enabled: checked,
                                complete_workflow_id: checked ? editRowForm.complete_workflow_id : null
                              })}
                            />
                            <Label htmlFor="row-complete-workflow-enabled" className="text-xs">Complete Workflow</Label>
                          </div>
                          {editRowForm.complete_workflow_enabled && (
                            <ComboboxDropdown
                              items={workflows.map(w => ({ id: String(w.id), label: w.name }))}
                              selectedItem={editRowForm.complete_workflow_id ? {
                                id: String(editRowForm.complete_workflow_id),
                                label: editRowForm.complete_workflow_name || workflows.find(w => w.id === editRowForm.complete_workflow_id)?.name || ''
                              } : undefined}
                              onSelect={(item) => setEditRowForm({
                                ...editRowForm,
                                complete_workflow_id: Number(item.id),
                                complete_workflow_name: item.label
                              })}
                              placeholder="Select workflow to run on task completion..."
                              emptyResults="No workflows found"
                              clearable
                              onClear={() => setEditRowForm({ ...editRowForm, complete_workflow_id: null, complete_workflow_name: null })}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Linked Tasks, Complete Together, Templates, Task Group */}
                  <div className="space-y-3">
                    {/* Linked Tasks (Visibility) */}
                    <div className="space-y-1">
                      <Label className="text-xs">Linked Tasks (Visibility)</Label>
                      <MultipleSelector
                        value={(editRowForm.linked_task_ids || []).map(id => {
                          const linkedRow = allRows.find(r => r.id === id);
                          return { value: String(id), label: linkedRow?.name || `Task ${id}` };
                        })}
                        onChange={(options) => {
                          setEditRowForm({
                            ...editRowForm,
                            linked_task_ids: options.map(o => parseInt(o.value))
                          });
                        }}
                        defaultOptions={allRows
                          .filter(r => r.id !== row?.id)
                          .map(r => ({
                            value: String(r.id),
                            label: r.name
                          }))}
                        onSearchSync={(search) => {
                          const lower = search.toLowerCase();
                          return allRows
                            .filter(r => r.id !== row?.id && r.name.toLowerCase().includes(lower))
                            .map(r => ({ value: String(r.id), label: r.name }));
                        }}
                        placeholder="Search and select tasks..."
                        emptyIndicator={
                          <p className="text-center text-xs text-muted-foreground">
                            No tasks available
                          </p>
                        }
                      />
                      <p className="text-[10px] text-muted-foreground">
                        These tasks appear/disappear together with this task on a job
                      </p>
                    </div>

                    {/* Completion Linked Tasks (Cascade) */}
                    <div className="pt-2 border-t space-y-1">
                      <Label className="text-xs">Complete Together (Cascade)</Label>
                      <MultipleSelector
                        value={(editRowForm.completion_linked_task_ids || []).map(id => {
                          const linkedRow = allRows.find(r => r.id === id);
                          return { value: String(id), label: linkedRow?.name || `Task ${id}` };
                        })}
                        onChange={(options) => {
                          setEditRowForm({
                            ...editRowForm,
                            completion_linked_task_ids: options.map(o => parseInt(o.value))
                          });
                        }}
                        defaultOptions={allRows
                          .filter(r => r.id !== row?.id)
                          .map(r => ({
                            value: String(r.id),
                            label: r.name
                          }))}
                        onSearchSync={(search) => {
                          const lower = search.toLowerCase();
                          return allRows
                            .filter(r => r.id !== row?.id && r.name.toLowerCase().includes(lower))
                            .map(r => ({ value: String(r.id), label: r.name }));
                        }}
                        placeholder="Search and select tasks..."
                        emptyIndicator={
                          <p className="text-center text-xs text-muted-foreground">
                            No tasks available
                          </p>
                        }
                      />
                      <p className="text-[10px] text-muted-foreground">
                        When completing this task, user can choose to also complete these tasks
                      </p>
                    </div>

                    {/* Template Membership */}
                    {showTemplateSection && templates.length > 0 ? (
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs">Template Membership</Label>
                          {onCopyToTemplate ? (
                            <div className="flex items-center gap-2">
                              <ComboboxDropdown
                                items={templates
                                  .filter(t => !(editRowForm.sm_template_ids || []).includes(t.id))
                                  .map(t => ({ id: String(t.id), label: t.name }))}
                                onSelect={async (item) => {
                                  if (row && onCopyToTemplate) {
                                    await onCopyToTemplate(parseInt(item.id), row.id);
                                  }
                                }}
                                placeholder="Copy to template..."
                                emptyResults="No other templates"
                                className="w-48 h-7 text-xs"
                              />
                            </div>
                          ) : null}
                        </div>
                        <MultipleSelector
                          value={(editRowForm.sm_template_ids || []).map(id => {
                            const template = templates.find(t => t.id === id);
                            return { value: String(id), label: template?.name || `Template ${id}` };
                          })}
                          onChange={(options) => {
                            setEditRowForm({
                              ...editRowForm,
                              sm_template_ids: options.map(o => parseInt(o.value))
                            });
                          }}
                          defaultOptions={templates.map(t => ({
                            value: String(t.id),
                            label: t.name
                          }))}
                          placeholder="Select templates this task belongs to..."
                          emptyIndicator={
                            <p className="text-center text-xs text-muted-foreground">
                              No templates available
                            </p>
                          }
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          This task will appear in all selected templates. Changes sync across templates.
                        </p>
                      </div>
                    ) : null}

                    {/* Task Group */}
                    <div className="pt-2 border-t">
                      <Label className="text-xs">Task Group</Label>
                      <ComboboxDropdown
                        items={taskGroups.map(g => ({
                          id: String(g.id),
                          label: g.name
                        }))}
                        selectedItem={editRowForm.sm_task_group_id
                          ? {
                              id: String(editRowForm.sm_task_group_id),
                              label: editRowForm.sm_task_group_name || taskGroups.find(g => g.id === editRowForm.sm_task_group_id)?.name || `Group ${editRowForm.sm_task_group_id}`
                            }
                          : undefined}
                        onSelect={(item) => {
                          setEditRowForm({
                            ...editRowForm,
                            sm_task_group_id: item ? Number(item.id) : null,
                            sm_task_group_name: item?.label || null
                          });
                        }}
                        placeholder="Select task group..."
                        clearable
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Tasks in the same group appear together when any PO from the group is on a job
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ============================================================
                  TAB 7: TEMPLATES - Which PO Packs & Quote Templates link here
                 ============================================================ */}
              <TabsContent value="templates" className="mt-3">
                {/* Trigger lazy-load of template links + available templates when this tab renders */}
                <div ref={(el) => { if (el) { loadTemplateLinks(); loadAvailableTemplates(); } }} />

                {!templateLinksLoaded && (
                  <div className="flex items-center justify-center py-8">
                    <Spinner className="h-5 w-5 mr-2" />
                    <span className="text-sm text-muted-foreground">Loading linked templates...</span>
                  </div>
                )}

                {templateLinksLoaded && templateLinks && templateLinks.po_template_packs.length === 0 && templateLinks.custom_quote_templates.length === 0 && (
                  <div className="text-center py-8">
                    <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No linked templates</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This task is not referenced by any PO Template Pack or Custom Quote Template
                    </p>
                  </div>
                )}

                {templateLinksLoaded && templateLinks && (templateLinks.po_template_packs.length > 0 || templateLinks.custom_quote_templates.length > 0) && (
                  <div className="space-y-5">
                    {/* Sync Status Banner */}
                    <div className="flex items-start gap-2 p-3 rounded-md border border-primary/30 bg-primary/5 dark:bg-primary/10 text-xs">
                      <RefreshCw className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-primary">
                          Single source — always in sync
                          {templateLinks.sync_tenants && templateLinks.sync_tenants.length > 0 && (
                            <span className="font-normal text-muted-foreground ml-1">
                              with {templateLinks.sync_tenants.map(t => t.name).join(", ")}
                            </span>
                          )}
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          Templates read directly from Schedule Master. No copies, no drift.
                          {templateLinks.sync_tenants && templateLinks.sync_tenants.length > 0 && (
                            <> ConfigSync keeps {templateLinks.current_tenant} and {templateLinks.sync_tenants.map(t => t.name).join(", ")} aligned automatically.</>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* PO Template Packs */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-blue-500" />
                          PO Template Packs ({templateLinks.po_template_packs.length})
                        </Label>
                        {availablePoPacks.length > 0 && (
                          <div className="w-[200px]">
                            <ComboboxDropdown
                              items={availablePoPacks
                                .filter(p => !templateLinks.po_template_packs.some(linked => linked.id === p.id))
                                .map(p => ({ id: String(p.id), label: p.name }))}
                              onSelect={(item) => addToTemplate("po_template_pack", Number(item.id))}
                              placeholder="+ Add to pack..."
                              searchPlaceholder="Search packs..."
                              disabled={addingToTemplate}
                              className="h-7 text-xs"
                            />
                          </div>
                        )}
                      </div>
                      {templateLinks.po_template_packs.length > 0 ? (
                        <>
                          <div className="space-y-1.5">
                            {templateLinks.po_template_packs.map(pack => (
                              <div key={pack.id} className="flex items-center gap-2 p-2.5 rounded-md border bg-muted/20 dark:bg-muted/10 text-sm">
                                <Package className="h-4 w-4 text-blue-500 shrink-0" />
                                <span className="font-medium flex-1">{pack.pack_name}</span>
                                {pack.is_primary && (
                                  <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Primary</span>
                                )}
                                {pack.synced_tenants && pack.synced_tenants.length > 0 && (
                                  <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <RefreshCw className="h-2.5 w-2.5" />
                                    {pack.synced_tenants.join(", ")}
                                  </span>
                                )}
                                {pack.item_count != null && (
                                  <span className="text-xs text-muted-foreground">{pack.item_count} items</span>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1.5 ml-1">
                            Fields synced: Name, PO Supplier, Budget, PO Description
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground italic ml-1">Not linked to any PO Template Pack</p>
                      )}
                    </div>

                    {/* Custom Quote Templates */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-green-500" />
                          Custom Quote Templates ({templateLinks.custom_quote_templates.length})
                        </Label>
                        {availableCqTemplates.length > 0 && (
                          <div className="w-[220px]">
                            <ComboboxDropdown
                              items={availableCqTemplates
                                .filter(t => !templateLinks.custom_quote_templates.some(linked => linked.id === t.id))
                                .map(t => ({ id: String(t.id), label: t.name }))}
                              onSelect={(item) => addToTemplate("custom_quote_template", Number(item.id))}
                              placeholder="+ Add to template..."
                              searchPlaceholder="Search templates..."
                              disabled={addingToTemplate}
                              className="h-7 text-xs"
                            />
                          </div>
                        )}
                      </div>
                      {templateLinks.custom_quote_templates.length > 0 ? (
                        <>
                          <div className="space-y-1.5">
                            {templateLinks.custom_quote_templates.map(tmpl => (
                              <div key={tmpl.id} className="flex items-center gap-2 p-2.5 rounded-md border bg-muted/20 dark:bg-muted/10 text-sm">
                                <FileText className="h-4 w-4 text-green-500 shrink-0" />
                                <span className="font-medium flex-1">{tmpl.template_name}</span>
                                {tmpl.is_primary && (
                                  <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Primary</span>
                                )}
                                {tmpl.synced_tenants && tmpl.synced_tenants.length > 0 && (
                                  <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <RefreshCw className="h-2.5 w-2.5" />
                                    {tmpl.synced_tenants.join(", ")}
                                  </span>
                                )}
                                {tmpl.line_count != null && (
                                  <span className="text-xs text-muted-foreground">{tmpl.line_count} lines</span>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1.5 ml-1">
                            Fields synced: Name, Cost Centre, Supplier, Budget, Tender Description, PO Description, RFQ Instructions
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground italic ml-1">Not linked to any Custom Quote Template</p>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

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
            {templatePreviewHtml ? (
              <div className="bg-white rounded-lg shadow-lg mx-auto" style={{ maxWidth: "800px" }}>
                <div dangerouslySetInnerHTML={{ __html: templatePreviewHtml }} />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default EditRowDialog;
