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
import { Spinner } from "@/components/ui/spinner";
import { Check, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

// ============================================================================
// TYPES - Extracted from ScheduleMasterTab.tsx (SSoT)
// ============================================================================

export interface EditRowData {
  id: number;
  task_number: number;
  name: string;
  description?: string;
  duration_days: number;
  sequence_order: number;
  predecessor_ids?: Array<{ id: number; type?: string; lag?: number }>;
  trade?: string;
  stage?: string;
  trade_name?: string;
  stage_name?: string;
  assigned_role?: string | null;
  cost_centre?: string;
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
  checklists: Array<{ id: number; name: string }>;
  documentTypes: Array<{ id: number; name: string; display_name?: string; form_number_mapping?: Record<string, string> }>;
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
  jobId,
}: EditRowDialogProps) {
  // Form state
  const [editRowForm, setEditRowForm] = React.useState<EditRowFormData>({});

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const initialFormLoadRef = React.useRef(true);

  // Template preview state
  const [templatePreviewHtml, setTemplatePreviewHtml] = React.useState<string | null>(null);
  const [loadingTemplatePreview, setLoadingTemplatePreview] = React.useState(false);
  const [showFullPreview, setShowFullPreview] = React.useState(false);

  // Initialize form when row changes
  React.useEffect(() => {
    if (row) {
      initialFormLoadRef.current = true;
      setAutoSaveStatus('idle');
      setEditRowForm({
        name: row.name,
        description: row.description,
        duration_days: row.duration_days,
        sequence_order: row.sequence_order,
        trade: row.trade,
        stage: row.stage,
        assigned_role: row.assigned_role,
        cost_centre: row.cost_centre,
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

  // Handle save (supports both manual and auto-save)
  const handleSaveRow = async (options?: { silent?: boolean }) => {
    if (!row) return;

    const silent = options?.silent ?? false;

    if (silent) {
      setAutoSaveStatus('saving');
    }

    try {
      await onSave(row.id, editRowForm);

      if (silent) {
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
        onRefresh?.();
      } else {
        onOpenChange(false);
        onRefresh?.();
      }
    } catch (error) {
      console.error("Failed to save row:", error);
      if (silent) {
        setAutoSaveStatus('error');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRowForm]);

  if (!row) return null;

  return (
    <>
      {/* Row Edit Dialog - Full-screen modal (90%) for better UX */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Sticky Header - Compact single line */}
          <div className="sticky top-0 z-10 bg-background border-b px-6 py-3 flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              Edit Row
              <span className="text-muted-foreground font-normal">•</span>
              <span className="font-normal">{row.name}</span>
              <span className="text-muted-foreground text-sm font-normal">(#{row.task_number})</span>
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
              {/* Template badge if in templates */}
              {row.sm_template_ids && row.sm_template_ids.length > 0 && templates.length > 0 && (
                <Badge variant="secondary" className="text-xs font-normal ml-1">
                  {row.sm_template_ids
                    .map((item: number | { id: number; display?: string }) => {
                      const id = typeof item === 'object' ? item.id : item;
                      return templates.find(t => t.id === id)?.name || `#${id}`;
                    })
                    .join(', ')}
                </Badge>
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
                  <span className="flex items-center text-green-600 dark:text-green-500">
                    <Check className="h-4 w-4 mr-2" />
                    Saved
                  </span>
                ) : null}
                {autoSaveStatus === 'error' ? (
                  <span className="flex items-center text-red-600 dark:text-red-500">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Save failed
                  </span>
                ) : null}
                {autoSaveStatus === 'idle' ? (
                  <span className="text-muted-foreground">Auto-save enabled</span>
                ) : null}
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3">
            {/* Row 1: Name + Duration + Sequence - full width */}
            <div className="grid grid-cols-[1fr_80px_80px] gap-3">
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

            {/* Description - full width */}
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

            {/* Three-column layout for wider modal */}
            <div className="grid grid-cols-3 gap-6">
              {/* Column 1: Basic Settings */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">Basic Settings</h4>
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
                <div className="pt-2 border-t">
                  <h4 className="font-medium text-sm mb-2">PO Settings</h4>
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
                <div className="pt-2 border-t">
                  <h4 className="font-medium text-sm mb-2">Completion</h4>
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
                </div>
                {/* Claim Settings - SSoT: Schedule Master defines job claims */}
                <div className="pt-2 border-t">
                  <h4 className="font-medium text-sm mb-2">Claim Settings</h4>
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
                        {/* Variation checkbox - skips percentage requirement */}
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

                        {/* Percentage - only shown if not a variation */}
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

                        {/* Trading Name Selector */}
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

                        {/* Claim Sequence Number - SSoT: Used for J{job}-{seq} matching */}
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
                                  {/* Color swatch preview */}
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

                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Column 2: Classification + Invoice Preview */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">Classification</h4>
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
                    selectedItem={editRowForm.cost_centre ? { id: editRowForm.cost_centre, label: costCentres.find(c => String(c.id) === editRowForm.cost_centre)?.name || editRowForm.cost_centre } : undefined}
                    onSelect={(item) => setEditRowForm({ ...editRowForm, cost_centre: item.id })}
                    placeholder="Cost centre..."
                    emptyResults="No cost centres found"
                    clearable
                    onClear={() => setEditRowForm({ ...editRowForm, cost_centre: "" })}
                  />
                </div>

                {/* Invoice Template Preview - shown when claim task has template selected */}
                {editRowForm.is_claim_task && editRowForm.claim_invoice_template_id ? (
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

              {/* Column 3: Relationships & Header */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">Relationships</h4>
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
                <div className="space-y-1">
                  <Label className="text-xs">Spawn Scan Task</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <ComboboxDropdown
                        items={documentTypes.map(dt => ({ id: String(dt.id), label: dt.name }))}
                        selectedItem={(() => {
                          const firstDocType = editRowForm.document_types?.[0];
                          if (!firstDocType) return undefined;
                          const docType = documentTypes.find(dt => dt.id === firstDocType.document_type_id);
                          return {
                            id: String(firstDocType.document_type_id),
                            label: docType?.name || firstDocType.document_type_name
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

                {/* Workflow Triggers */}
                {workflows.length > 0 && (
                  <>
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
                  </>
                )}

                {/* Completion Document Requirement */}
                <div className="space-y-1">
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
                        items={documentTypes.map(dt => ({ id: String(dt.id), label: dt.display_name || dt.name }))}
                        selectedItem={editRowForm.completion_document_type_id ? {
                          id: String(editRowForm.completion_document_type_id),
                          label: editRowForm.completion_document_type_name || documentTypes.find(dt => dt.id === editRowForm.completion_document_type_id)?.name || ''
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
                          <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-500">
                            {subHeaderCount} sub-header{subHeaderCount !== 1 ? 's' : ''}
                          </Badge>
                        ) : null}
                      </div>
                    );
                  })() : null}
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

            {/* Template Membership - Multi-template support (Schedule Master only) */}
            {showTemplateSection && templates.length > 0 ? (
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Template Membership</Label>
                  {/* Copy to Template dropdown */}
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
            <div className="border-t pt-3">
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

            {/* Linked Tasks */}
            <div className="border-t pt-3">
              <Label className="text-xs">Linked Tasks</Label>
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
            </div>
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
          <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-gray-900">
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
