"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ComboboxMultiSelect } from "@/components/ui/combobox-multi-select";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { ChevronDown, ChevronRight, Download, Save, Link2, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import Link from "next/link";
import { EditRowDialog, type EditRowData, type EditRowFormData } from "@/components/schedule/EditRowDialog";

// ============================================
// Types
// ============================================

interface SmPoTask {
  id: number;
  name: string;
  task_code?: string | null;
  stage_name?: string | null;
  trade_name?: string | null;
  cost_centre_name?: string | null;
  tender_name?: string | null;
  assigned_role_name?: string | null;
}

interface ClaimTemplateLine {
  id: number;
  name: string;
  percentage: number;
  overheadPoName: string | null;
}

interface ClaimTemplate {
  id: number;
  name: string;
  lines: ClaimTemplateLine[];
}

interface TemplateMarkup {
  id: number;
  name: string;
  is_default: boolean;
  row_count: number;
  // Charge → SM task auto-link (arrays for multi-PO)
  charge_construction_insurance_sm_ids: number[];
  charge_qleave_sm_ids: number[];
  charge_overheads_sm_ids: number[];
  charge_qbcc_insurance_sm_ids: number[];
  charge_builds_contingency_sm_ids: number[];
  charge_project_prelims_sm_ids: number[];
  charge_project_management_sm_ids: number[];
  charge_maintenance_fee_sm_ids: number[];
  // Markup rate → PO auto-link
  charge_builder_margin_sm_ids: number[];
  charge_escalation_sm_ids: number[];
  charge_pc_ps_cap_sm_ids: number[];
  charge_tender_markup_sm_ids: number[];
  // Per-template markup rate overrides
  defaultBuilderMarginPercent: number | null;
  defaultEscalationPercent: number | null;
  pcPsMarkupCapPercent: number | null;
  defaultConstructionInsurancePercent: number | null;
  defaultOverheadsPercent: number | null;
  defaultQleaveRatePercent: number | null;
  defaultBuildsContingencyPercent: number | null;
  defaultProjectPrelimsPercent: number | null;
  defaultProjectManagementPercent: number | null;
  defaultMaintenanceFeePercent: number | null;
  defaultTenderMarkupPercent: number | null;
  // Per-PO allocation percentages
  chargePoAllocations: Record<string, Record<string, number>>;
  // Claim stage template link
  claimStageTemplateId: number | null;
}

// Lookup option for edit dialog dropdowns
// Charge type config for unified row rendering
const MARKUP_RATES = [
  { key: "defaultBuilderMarginPercent", label: "Builder Margin", smField: "charge_builder_margin_sm_ids", chargeType: "builder_margin", step: 0.5 },
  { key: "defaultEscalationPercent", label: "Escalation", smField: "charge_escalation_sm_ids", chargeType: "escalation", step: 0.5 },
  { key: "pcPsMarkupCapPercent", label: "PC/PS Cap", smField: "charge_pc_ps_cap_sm_ids", chargeType: "pc_ps_cap", step: 0.5 },
  { key: "defaultTenderMarkupPercent", label: "Tender Markup", smField: null, chargeType: "tender_markup", step: 0.5 },
] as const;

const CHARGE_TYPES = [
  { key: "defaultConstructionInsurancePercent", label: "Constr. Insurance", smField: "charge_construction_insurance_sm_ids", chargeType: "construction_insurance", step: 0.1 },
  { key: "defaultOverheadsPercent", label: "Overheads", smField: "charge_overheads_sm_ids", chargeType: "overheads", step: 0.1 },
  { key: "defaultQleaveRatePercent", label: "QLeave Rate", smField: "charge_qleave_sm_ids", chargeType: "qleave", step: 0.001 },
  { key: null, label: "QBCC Insurance", smField: "charge_qbcc_insurance_sm_ids", chargeType: "qbcc_insurance", step: 0 },
  { key: "defaultBuildsContingencyPercent", label: "Build Contingency", smField: "charge_builds_contingency_sm_ids", chargeType: "builds_contingency", step: 0.1 },
  { key: "defaultProjectPrelimsPercent", label: "Project Prelims", smField: "charge_project_prelims_sm_ids", chargeType: "project_prelims", step: 0.1 },
  { key: "defaultProjectManagementPercent", label: "Project Management", smField: "charge_project_management_sm_ids", chargeType: "project_management", step: 0.1 },
  { key: "defaultMaintenanceFeePercent", label: "Maintenance Fee", smField: "charge_maintenance_fee_sm_ids", chargeType: "maintenance_fee", step: 0.1 },
] as const;

// Metadata badge → settings page mapping
const METADATA_FIELDS: { field: keyof SmPoTask; prefix: string }[] = [
  { field: "stage_name", prefix: "Stage" },
  { field: "trade_name", prefix: "Trade" },
  { field: "cost_centre_name", prefix: "CC" },
  { field: "tender_name", prefix: "Tender" },
  { field: "assigned_role_name", prefix: "Role" },
];

// Helper: render inline clickable metadata badges for a task (opens edit dialog)
// Shows ALL fields — missing values shown in orange as warning
function TaskMetadataBadges({ task, onEdit }: { task: SmPoTask; onEdit?: (task: SmPoTask) => void }) {
  return (
    <span className="text-xs inline-flex items-center gap-0.5 flex-wrap">
      {METADATA_FIELDS.map((m, i) => {
        const value = task[m.field] as string | null | undefined;
        const missing = !value;
        return (
          <React.Fragment key={m.field}>
            {i > 0 && <span className="mx-0.5 text-muted-foreground">|</span>}
            <span
              role="button"
              tabIndex={0}
              onClick={() => onEdit?.(task)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit?.(task); } }}
              className={missing
                ? "text-orange-500 hover:text-orange-600 hover:underline transition-colors cursor-pointer"
                : "text-muted-foreground hover:text-foreground hover:underline transition-colors cursor-pointer"
              }
              title={missing ? `${m.prefix}: Not selected — click to edit` : `Edit ${m.prefix}`}
            >
              {m.prefix}: {value || "Not Selected"}
            </span>
          </React.Fragment>
        );
      })}
    </span>
  );
}

// ============================================
// Component
// ============================================

export function MarkupTemplatesTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState<TemplateMarkup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [poTasksMap, setPoTasksMap] = React.useState<Record<number, SmPoTask[]>>({});
  const [editState, setEditState] = React.useState<Record<number, Partial<TemplateMarkup>>>({});
  const [savingId, setSavingId] = React.useState<number | null>(null);
  const [globalDefaults, setGlobalDefaults] = React.useState<Record<string, number> | null>(null);
  const [claimTemplates, setClaimTemplates] = React.useState<ClaimTemplate[]>([]);

  // EditRowDialog state (SSoT: same component as Schedule Master table)
  const [editRowOpen, setEditRowOpen] = React.useState(false);
  const [editRowData, setEditRowData] = React.useState<EditRowData | null>(null);
  const [editRowLookups, setEditRowLookups] = React.useState<{
    trades: Array<{ id: number; name: string }>;
    roles: Array<{ id: number; name: string; display_name: string }>;
    stages: Array<{ id: number; name: string }>;
    costCentres: Array<{ id: number; name: string }>;
    tenderSections: Array<{ id: number; name: string }>;
  } | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [templatesRes, settingsRes, claimRes] = await Promise.all([
          api.get<{ sm_schedule_master_templates: TemplateMarkup[] }>("/api/v1/sm_schedule_master_templates"),
          api.get<{ settings: Record<string, number> }>("/api/v1/sm_settings"),
          api.get<{ success: boolean; data: ClaimTemplate[] }>("/api/v1/claim_stage_templates"),
        ]);
        setTemplates(templatesRes?.sm_schedule_master_templates || []);
        if (settingsRes?.settings) setGlobalDefaults(settingsRes.settings);
        setClaimTemplates(claimRes?.data || []);
      } catch {
        toast({ title: "Failed to load templates", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  // Auto-populate overheads PO links when template already has a claim template linked on load
  React.useEffect(() => {
    if (!expandedId) return;
    const edits = editState[expandedId];
    const tasks = poTasksMap[expandedId];
    if (!edits || !tasks || tasks.length === 0) return;
    if (!edits.claimStageTemplateId) return;

    // Only auto-populate if overheads PO links are empty (not yet populated)
    const currentOverheadIds = edits.charge_overheads_sm_ids || [];
    if (currentOverheadIds.length > 0) return;

    const ct = claimTemplates.find(c => c.id === edits.claimStageTemplateId);
    if (!ct) return;

    const matchedIds: number[] = [];
    const overheadAllocs: Record<string, number> = {};
    for (const line of ct.lines) {
      if (line.overheadPoName) {
        const matchTask = tasks.find(t => t.name === line.overheadPoName);
        if (matchTask) {
          matchedIds.push(matchTask.id);
          overheadAllocs[matchTask.id.toString()] = line.percentage;
        }
      }
    }
    if (matchedIds.length > 0) {
      setEditState(prev => {
        const current = prev[expandedId] || {};
        const existingAllocs = { ...(current.chargePoAllocations || {}) };
        existingAllocs["overheads"] = overheadAllocs;
        return {
          ...prev,
          [expandedId]: {
            ...current,
            charge_overheads_sm_ids: matchedIds,
            chargePoAllocations: existingAllocs,
          },
        };
      });
    }
  }, [expandedId, poTasksMap, claimTemplates, editState]);

  const importGlobalDefaults = (templateId: number) => {
    if (!globalDefaults) return;
    setEditState(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        defaultBuilderMarginPercent: globalDefaults.defaultBuilderMarginPercent ?? null,
        defaultEscalationPercent: globalDefaults.defaultEscalationPercent ?? null,
        pcPsMarkupCapPercent: globalDefaults.pcPsMarkupCapPercent ?? null,
        defaultConstructionInsurancePercent: globalDefaults.defaultConstructionInsurancePercent ?? null,
        defaultOverheadsPercent: globalDefaults.defaultOverheadsPercent ?? null,
        defaultQleaveRatePercent: globalDefaults.defaultQleaveRatePercent ?? null,
        defaultBuildsContingencyPercent: globalDefaults.defaultBuildsContingencyPercent ?? null,
        defaultProjectPrelimsPercent: globalDefaults.defaultProjectPrelimsPercent ?? null,
        defaultProjectManagementPercent: globalDefaults.defaultProjectManagementPercent ?? null,
        defaultMaintenanceFeePercent: globalDefaults.defaultMaintenanceFeePercent ?? null,
        defaultTenderMarkupPercent: globalDefaults.defaultTenderMarkupPercent ?? null,
      },
    }));
    toast({ title: "Global defaults imported — adjust and save" });
  };

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    // Initialize edit state from template
    const tmpl = templates.find(t => t.id === id);
    if (tmpl && !editState[id]) {
      setEditState(prev => ({
        ...prev,
        [id]: {
          charge_construction_insurance_sm_ids: tmpl.charge_construction_insurance_sm_ids || [],
          charge_qleave_sm_ids: tmpl.charge_qleave_sm_ids || [],
          charge_overheads_sm_ids: tmpl.charge_overheads_sm_ids || [],
          charge_qbcc_insurance_sm_ids: tmpl.charge_qbcc_insurance_sm_ids || [],
          charge_builds_contingency_sm_ids: tmpl.charge_builds_contingency_sm_ids || [],
          charge_project_prelims_sm_ids: tmpl.charge_project_prelims_sm_ids || [],
          charge_project_management_sm_ids: tmpl.charge_project_management_sm_ids || [],
          charge_maintenance_fee_sm_ids: tmpl.charge_maintenance_fee_sm_ids || [],
          charge_builder_margin_sm_ids: tmpl.charge_builder_margin_sm_ids || [],
          charge_escalation_sm_ids: tmpl.charge_escalation_sm_ids || [],
          charge_pc_ps_cap_sm_ids: tmpl.charge_pc_ps_cap_sm_ids || [],
          charge_tender_markup_sm_ids: tmpl.charge_tender_markup_sm_ids || [],
          defaultBuilderMarginPercent: tmpl.defaultBuilderMarginPercent,
          defaultEscalationPercent: tmpl.defaultEscalationPercent,
          pcPsMarkupCapPercent: tmpl.pcPsMarkupCapPercent,
          defaultConstructionInsurancePercent: tmpl.defaultConstructionInsurancePercent,
          defaultOverheadsPercent: tmpl.defaultOverheadsPercent,
          defaultQleaveRatePercent: tmpl.defaultQleaveRatePercent,
          defaultBuildsContingencyPercent: tmpl.defaultBuildsContingencyPercent,
          defaultProjectPrelimsPercent: tmpl.defaultProjectPrelimsPercent,
          defaultProjectManagementPercent: tmpl.defaultProjectManagementPercent,
          defaultMaintenanceFeePercent: tmpl.defaultMaintenanceFeePercent,
          defaultTenderMarkupPercent: tmpl.defaultTenderMarkupPercent,
          chargePoAllocations: tmpl.chargePoAllocations || {},
          claimStageTemplateId: tmpl.claimStageTemplateId,
        },
      }));
    }

    // Fetch PO tasks for this template if not cached
    if (!poTasksMap[id]) {
      try {
        const res = await api.get<{ tasks: SmPoTask[] }>(
          `/api/v1/sm_schedule_master_templates/${id}/po_tasks`
        );
        setPoTasksMap(prev => ({ ...prev, [id]: res?.tasks || [] }));
      } catch {
        setPoTasksMap(prev => ({ ...prev, [id]: [] }));
      }
    }
  };

  const updateField = (templateId: number, field: string, value: number | null | number[] | Record<string, Record<string, number>>) => {
    setEditState(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], [field]: value },
    }));
  };

  const updateAllocation = (templateId: number, chargeType: string, smId: string, pct: number) => {
    setEditState(prev => {
      const current = prev[templateId] || {};
      const allocs = { ...(current.chargePoAllocations || {}) };
      const chargeAllocs = { ...(allocs[chargeType] || {}) };
      chargeAllocs[smId] = pct;
      allocs[chargeType] = chargeAllocs;
      return { ...prev, [templateId]: { ...current, chargePoAllocations: allocs } };
    });
  };

  const handleSave = async (templateId: number) => {
    const edits = editState[templateId];
    if (!edits) return;

    setSavingId(templateId);
    try {
      await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}`, {
        sm_schedule_master_template: {
          charge_construction_insurance_sm_ids: edits.charge_construction_insurance_sm_ids || [],
          charge_qleave_sm_ids: edits.charge_qleave_sm_ids || [],
          charge_overheads_sm_ids: edits.charge_overheads_sm_ids || [],
          charge_qbcc_insurance_sm_ids: edits.charge_qbcc_insurance_sm_ids || [],
          charge_builds_contingency_sm_ids: edits.charge_builds_contingency_sm_ids || [],
          charge_project_prelims_sm_ids: edits.charge_project_prelims_sm_ids || [],
          charge_project_management_sm_ids: edits.charge_project_management_sm_ids || [],
          charge_maintenance_fee_sm_ids: edits.charge_maintenance_fee_sm_ids || [],
          charge_builder_margin_sm_ids: edits.charge_builder_margin_sm_ids || [],
          charge_escalation_sm_ids: edits.charge_escalation_sm_ids || [],
          charge_pc_ps_cap_sm_ids: edits.charge_pc_ps_cap_sm_ids || [],
          charge_tender_markup_sm_ids: edits.charge_tender_markup_sm_ids || [],
          default_builder_margin_percent: edits.defaultBuilderMarginPercent,
          default_escalation_percent: edits.defaultEscalationPercent,
          pc_ps_markup_cap_percent: edits.pcPsMarkupCapPercent,
          default_construction_insurance_percent: edits.defaultConstructionInsurancePercent,
          default_overheads_percent: edits.defaultOverheadsPercent,
          default_qleave_rate_percent: edits.defaultQleaveRatePercent,
          default_builds_contingency_percent: edits.defaultBuildsContingencyPercent,
          default_project_prelims_percent: edits.defaultProjectPrelimsPercent,
          default_project_management_percent: edits.defaultProjectManagementPercent,
          default_maintenance_fee_percent: edits.defaultMaintenanceFeePercent,
          default_tender_markup_percent: edits.defaultTenderMarkupPercent,
          charge_po_allocations: edits.chargePoAllocations || {},
          claim_stage_template_id: edits.claimStageTemplateId || null,
        },
      });
      toast({ title: "Template markup saved" });

      // Refresh templates
      const res = await api.get<{ sm_schedule_master_templates: TemplateMarkup[] }>(
        "/api/v1/sm_schedule_master_templates"
      );
      setTemplates(res?.sm_schedule_master_templates || []);
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  // Open EditRowDialog (SSoT: same component as Schedule Master table)
  const openEditDialog = async (task: SmPoTask) => {
    if (!expandedId) return;
    try {
      // Fetch lookups once (cached in state)
      if (!editRowLookups) {
        const res = await api.get<{
          stages: Array<{ id: number; name: string }>;
          trades: Array<{ id: number; name: string }>;
          cost_centres: Array<{ id: number; name: string }>;
          tenders: Array<{ id: number; name: string }>;
          roles: Array<{ id: number; name: string }>;
        }>(`/api/v1/sm_schedule_master_templates/${expandedId}/po_task_lookups`);
        setEditRowLookups({
          trades: res?.trades || [],
          stages: res?.stages || [],
          costCentres: res?.cost_centres || [],
          tenderSections: res?.tenders || [],
          roles: (res?.roles || []).map(r => ({ ...r, display_name: r.name })),
        });
      }
      // Fetch full row data from the SM template rows endpoint
      const rowRes = await api.get<{ row: Record<string, unknown> }>(
        `/api/v1/sm_schedule_master_templates/${expandedId}/rows/${task.id}`
      );
      const row = rowRes?.row;
      if (!row) throw new Error("Row not found");
      // Extract IDs from lookup objects ({ id, display }) or raw values
      const extractId = (val: unknown): string | undefined => {
        if (!val) return undefined;
        if (typeof val === "object" && val !== null && "id" in val) return String((val as { id: number }).id);
        if (typeof val === "number") return val.toString();
        if (typeof val === "string") return val;
        return undefined;
      };
      const extractDisplay = (val: unknown): string | undefined => {
        if (!val) return undefined;
        if (typeof val === "object" && val !== null && "display" in val) return String((val as { display: string }).display);
        return undefined;
      };
      setEditRowData({
        id: task.id,
        task_number: (row.task_number as number) || 0,
        task_code: row.task_code as string | null,
        name: (row.name as string) || task.name,
        description: row.description as string | undefined,
        duration_days: (row.duration_days as number) || 1,
        sequence_order: (row.sequence_order as number) || 0,
        trade: extractId(row.trade),
        trade_name: extractDisplay(row.trade) || task.trade_name || undefined,
        stage: extractId(row.stage),
        stage_name: extractDisplay(row.stage) || task.stage_name || undefined,
        assigned_role: extractId(row.assigned_role),
        cost_centre: extractId(row.cost_centre),
        cost_centre_name: extractDisplay(row.cost_centre) || task.cost_centre_name || undefined,
        tender_id: extractId(row.tender_id),
        is_active: row.is_active as boolean | undefined,
        exclude_from_gantt: row.exclude_from_gantt as boolean | undefined,
        allow_header: row.allow_header as boolean | undefined,
        require_photo: row.require_photo as boolean | undefined,
        pass_fail_enabled: row.pass_fail_enabled as boolean | undefined,
      });
      setEditRowOpen(true);
    } catch {
      toast({ title: "Failed to load task details", variant: "destructive" });
    }
  };

  // Save handler for EditRowDialog
  const handleEditRowSave = async (rowId: number, data: EditRowFormData) => {
    if (!expandedId) return;
    await api.patch(`/api/v1/sm_schedule_master_templates/${expandedId}/rows/${rowId}`, {
      row: {
        ...(data.trade !== undefined && { trade: data.trade || null }),
        ...(data.stage !== undefined && { stage: data.stage || null }),
        ...(data.assigned_role !== undefined && { assigned_role: data.assigned_role || null }),
        ...(data.cost_centre !== undefined && { cost_centre: data.cost_centre || null }),
        ...(data.tender_id !== undefined && { tender_id: data.tender_id || null }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.task_code !== undefined && { task_code: data.task_code }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.duration_days !== undefined && { duration_days: data.duration_days }),
        ...(data.sequence_order !== undefined && { sequence_order: data.sequence_order }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
        ...(data.exclude_from_gantt !== undefined && { exclude_from_gantt: data.exclude_from_gantt }),
        ...(data.allow_header !== undefined && { allow_header: data.allow_header }),
        ...(data.require_photo !== undefined && { require_photo: data.require_photo }),
        ...(data.pass_fail_enabled !== undefined && { pass_fail_enabled: data.pass_fail_enabled }),
      },
    });
    toast({ title: "Task updated" });
    // Refresh PO tasks to get updated metadata badges
    try {
      const res = await api.get<{ tasks: SmPoTask[] }>(
        `/api/v1/sm_schedule_master_templates/${expandedId}/po_tasks`
      );
      setPoTasksMap(prev => ({ ...prev, [expandedId!]: res?.tasks || [] }));
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Spinner size={32} className="text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl px-4 pt-4">
      <div>
        <h2 className="text-lg font-semibold">Template Markup Overrides</h2>
        <p className="text-sm text-muted-foreground">
          Each template can override global markup defaults and link charges to specific PO tasks.
          Blank fields use the global defaults from the Defaults tab.
        </p>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No schedule templates found. Create templates in Schedule Templates first.
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map(tmpl => {
            const isExpanded = expandedId === tmpl.id;
            const edits = editState[tmpl.id] || {};
            const tasks = poTasksMap[tmpl.id] || [];
            const allocs = (edits.chargePoAllocations || {}) as Record<string, Record<string, number>>;

            // Build claim-derived PO name → percentage map when a claim template is linked
            const linkedClaimTemplate = edits.claimStageTemplateId
              ? claimTemplates.find(ct => ct.id === edits.claimStageTemplateId)
              : null;
            // Map: task name → { stageName, percentage } from claim template lines
            const claimPoMap: Record<string, { stageName: string; percentage: number }> = {};
            if (linkedClaimTemplate) {
              for (const line of linkedClaimTemplate.lines) {
                if (line.overheadPoName) {
                  claimPoMap[line.overheadPoName] = { stageName: line.name, percentage: line.percentage };
                }
              }
            }

            return (
              <Card key={tmpl.id}>
                <button
                  onClick={() => toggleExpand(tmpl.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium flex-1">{tmpl.name}</span>
                  {tmpl.is_default && <Badge variant="secondary">Default</Badge>}
                  <span className="text-xs text-muted-foreground">{tmpl.row_count} rows</span>
                </button>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4 px-4 space-y-4">
                    {/* Import button + Claim template link */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Label className="text-xs shrink-0">Claim Template</Label>
                        <div className="w-64">
                          <ComboboxDropdown
                            items={claimTemplates.map(ct => ({ id: ct.id.toString(), label: ct.name }))}
                            selectedItem={
                              edits.claimStageTemplateId
                                ? { id: edits.claimStageTemplateId.toString(), label: claimTemplates.find(ct => ct.id === edits.claimStageTemplateId)?.name || "" }
                                : undefined
                            }
                            onSelect={(item) => {
                              const ctId = parseInt(item.id, 10);
                              updateField(tmpl.id, "claimStageTemplateId", ctId);
                              // Auto-populate overheads PO links from claim template
                              const ct = claimTemplates.find(c => c.id === ctId);
                              if (ct && tasks.length > 0) {
                                const matchedIds: number[] = [];
                                const overheadAllocs: Record<string, number> = {};
                                for (const line of ct.lines) {
                                  if (line.overheadPoName) {
                                    const matchTask = tasks.find(t => t.name === line.overheadPoName);
                                    if (matchTask) {
                                      matchedIds.push(matchTask.id);
                                      overheadAllocs[matchTask.id.toString()] = line.percentage;
                                    }
                                  }
                                }
                                if (matchedIds.length > 0) {
                                  setEditState(prev => {
                                    const current = prev[tmpl.id] || {};
                                    const existingAllocs = { ...(current.chargePoAllocations || {}) };
                                    existingAllocs["overheads"] = overheadAllocs;
                                    return {
                                      ...prev,
                                      [tmpl.id]: {
                                        ...current,
                                        claimStageTemplateId: ctId,
                                        charge_overheads_sm_ids: matchedIds,
                                        chargePoAllocations: existingAllocs,
                                      },
                                    };
                                  });
                                }
                              }
                            }}
                            onClear={() => {
                              // Clear claim link but keep PO selections for manual editing
                              updateField(tmpl.id, "claimStageTemplateId", null);
                            }}
                            clearable
                            placeholder="Link claim template..."
                            searchPlaceholder="Search claim templates..."
                          />
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs shrink-0"
                        onClick={() => importGlobalDefaults(tmpl.id)}
                        disabled={!globalDefaults}
                      >
                        <Download className="h-3 w-3 mr-1" /> Import Global Defaults
                      </Button>
                    </div>

                    {/* Markup Rates (with single-select PO link) */}
                    <div className="space-y-3">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Markup Rates</Label>
                      {MARKUP_RATES.map(rate => {
                        const hasSmField = rate.smField !== null;
                        const smIds = hasSmField ? (((edits as Record<string, unknown>)[rate.smField!] as number[]) || []) : [];
                        const selectedTaskId = smIds[0] ?? null;
                        const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;

                        return (
                          <div key={rate.key} className="space-y-1">
                            <div className="flex items-start gap-3">
                              <div className="w-36 shrink-0 pt-1">
                                <span className="text-sm">{rate.label}</span>
                              </div>
                              <Input
                                type="number"
                                min={0}
                                step={rate.step}
                                value={(edits[rate.key] as number | null) ?? ""}
                                placeholder="Global default"
                                onChange={e => {
                                  const raw = e.target.value;
                                  updateField(tmpl.id, rate.key, raw === "" ? null : parseFloat(raw) || 0);
                                }}
                                onFocus={e => e.target.select()}
                                className="h-8 text-sm w-20 shrink-0"
                              />
                              <span className="text-xs text-muted-foreground pt-2 shrink-0">%</span>

                              {hasSmField && tasks.length > 0 && (
                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                  <div className="flex-1 min-w-0">
                                    <ComboboxDropdown
                                      items={tasks.map(t => ({
                                        id: t.id.toString(),
                                        label: t.task_code ? `${t.task_code} — ${t.name}` : t.name,
                                      }))}
                                      selectedItem={
                                        selectedTask
                                          ? { id: selectedTask.id.toString(), label: selectedTask.task_code ? `${selectedTask.task_code} — ${selectedTask.name}` : selectedTask.name }
                                          : undefined
                                      }
                                      onSelect={item => updateField(tmpl.id, rate.smField!, [parseInt(item.id, 10)])}
                                      onClear={() => updateField(tmpl.id, rate.smField!, [])}
                                      clearable
                                      placeholder="Link to PO..."
                                      searchPlaceholder="Search tasks..."
                                    />
                                  </div>
                                </div>
                              )}
                              {!hasSmField && (
                                <span className="text-xs text-muted-foreground pt-2 italic">Applied to tenders (smart roundup)</span>
                              )}
                            </div>

                            {/* Inline metadata for linked task */}
                            {selectedTask && (
                              <div className="ml-36 pl-3">
                                <TaskMetadataBadges task={selectedTask} onEdit={openEditDialog} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Charges (rate + PO link per row) */}
                    <div className="border-t pt-3 space-y-3">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Charges — Rate % &amp; PO Link</Label>
                      {CHARGE_TYPES.map(charge => {
                        const smIds = ((edits as Record<string, unknown>)[charge.smField] as number[]) || [];
                        const chargeAllocs = allocs[charge.chargeType] || {};
                        const isOverheads = charge.chargeType === "overheads";

                        // For non-overheads: single select (first ID only)
                        const selectedTaskId = !isOverheads ? (smIds[0] ?? null) : null;
                        const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;

                        // For overheads: keep multi-select with splits
                        const hasMultiplePOs = smIds.length > 1;

                        return (
                          <div key={charge.chargeType} className="space-y-1.5">
                            <div className="flex items-start gap-3">
                              {/* Label + Rate */}
                              <div className="w-36 shrink-0 pt-1">
                                <span className="text-sm">{charge.label}</span>
                              </div>
                              {charge.key ? (
                                <Input
                                  type="number"
                                  min={0}
                                  step={charge.step}
                                  value={(edits[charge.key] as number | null) ?? ""}
                                  placeholder="0"
                                  onChange={e => {
                                    const raw = e.target.value;
                                    updateField(tmpl.id, charge.key!, raw === "" ? null : parseFloat(raw) || 0);
                                  }}
                                  onFocus={e => e.target.select()}
                                  className="h-8 text-sm w-20 shrink-0"
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground w-20 shrink-0 pt-1.5">Bracket</span>
                              )}
                              <span className="text-xs text-muted-foreground pt-2 shrink-0">%</span>

                              {/* PO selector */}
                              {tasks.length > 0 && (
                                isOverheads ? (
                                  // Overheads: multi-select (supports splits)
                                  <div className="flex-1 min-w-0">
                                    <ComboboxMultiSelect
                                      items={tasks.map(t => {
                                        const baseLabel = t.task_code ? `${t.task_code} — ${t.name}` : t.name;
                                        const claimMatch = claimPoMap[t.name];
                                        const alloc = chargeAllocs[t.id.toString()];
                                        const pct = claimMatch?.percentage ?? (smIds.includes(t.id) && smIds.length > 1 ? alloc : undefined);
                                        return {
                                          id: t.id.toString(),
                                          label: pct !== undefined ? `${baseLabel} (${pct}%)` : baseLabel,
                                          searchText: t.task_code || t.name,
                                        };
                                      })}
                                      selectedIds={smIds.map(v => v.toString())}
                                      onChange={ids => updateField(tmpl.id, charge.smField, ids.map(id => parseInt(id, 10)))}
                                      placeholder="Link to PO(s)..."
                                      searchPlaceholder="Search tasks..."
                                    />
                                  </div>
                                ) : (
                                  // Non-overheads: single-select
                                  <div className="flex items-center gap-1 flex-1 min-w-0">
                                    <div className="flex-1 min-w-0">
                                      <ComboboxDropdown
                                        items={tasks.map(t => ({
                                          id: t.id.toString(),
                                          label: t.task_code ? `${t.task_code} — ${t.name}` : t.name,
                                        }))}
                                        selectedItem={
                                          selectedTask
                                            ? { id: selectedTask.id.toString(), label: selectedTask.task_code ? `${selectedTask.task_code} — ${selectedTask.name}` : selectedTask.name }
                                            : undefined
                                        }
                                        onSelect={item => updateField(tmpl.id, charge.smField, [parseInt(item.id, 10)])}
                                        onClear={() => updateField(tmpl.id, charge.smField, [])}
                                        clearable
                                        placeholder="Link to PO..."
                                        searchPlaceholder="Search tasks..."
                                      />
                                    </div>
                                  </div>
                                )
                              )}
                            </div>

                            {/* Inline metadata for single-select linked task (non-overheads) */}
                            {!isOverheads && selectedTask && (
                              <div className="ml-36 pl-3">
                                <TaskMetadataBadges task={selectedTask} onEdit={openEditDialog} />
                              </div>
                            )}

                            {/* Overheads: per-PO allocation % (when multiple POs or claim-linked) */}
                            {isOverheads && smIds.length > 0 && tasks.length > 0 && (hasMultiplePOs || linkedClaimTemplate) && (
                              <div className="ml-36 pl-3 space-y-1">
                                <span className="text-xs text-muted-foreground">
                                  {linkedClaimTemplate ? "Claim stage split:" : "Split:"}
                                </span>
                                <div className="space-y-1.5">
                                  {smIds.map(smId => {
                                    const task = tasks.find(t => t.id === smId);
                                    const taskName = task?.name || `#${smId}`;
                                    const claimMatch = claimPoMap[taskName];
                                    const pct = claimMatch
                                      ? claimMatch.percentage
                                      : (chargeAllocs[smId.toString()] ?? Math.round(100 / smIds.length));
                                    return (
                                      <div key={smId} className="space-y-0.5">
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs font-medium truncate max-w-[200px]">{taskName}</span>
                                          {claimMatch ? (
                                            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded" title={`From claim stage: ${claimMatch.stageName} (${claimMatch.percentage}%)`}>
                                              {claimMatch.percentage}%
                                            </span>
                                          ) : (
                                            <>
                                              <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={1}
                                                value={pct}
                                                onChange={e => updateAllocation(tmpl.id, charge.chargeType, smId.toString(), parseFloat(e.target.value) || 0)}
                                                onFocus={e => e.target.select()}
                                                className="h-6 text-xs w-14 px-1"
                                              />
                                              <span className="text-xs text-muted-foreground">%</span>
                                            </>
                                          )}
                                        </div>
                                        {task && <div className="pl-1"><TaskMetadataBadges task={task} onEdit={openEditDialog} /></div>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Overheads: single PO metadata (when only 1 PO and no claim template) */}
                            {isOverheads && smIds.length === 1 && !linkedClaimTemplate && (() => {
                              const task = tasks.find(t => t.id === smIds[0]);
                              return task ? (
                                <div className="ml-36 pl-3 flex items-center gap-1">
                                  <TaskMetadataBadges task={task} onEdit={openEditDialog} />
                                </div>
                              ) : null;
                            })()}
                          </div>
                        );
                      })}
                    </div>

                    {tasks.length === 0 && !loading && (
                      <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground">
                          No PO-required tasks on this template. Add tasks with PO Required enabled to configure charge PO linking.
                        </p>
                      </div>
                    )}

                    <div className="border-t pt-3 flex items-center gap-3">
                      <Button size="sm" onClick={() => handleSave(tmpl.id)} disabled={savingId === tmpl.id}>
                        {savingId === tmpl.id ? (
                          <><Spinner size={14} className="mr-1.5" /> Saving...</>
                        ) : (
                          <><Save className="h-3.5 w-3.5 mr-1.5" /> Save Template</>
                        )}
                      </Button>
                      <Link
                        href="/settings/operations/schedule-master"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open Schedule Master
                      </Link>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* SSoT: Same EditRowDialog used by Schedule Master table */}
      <EditRowDialog
        open={editRowOpen}
        onOpenChange={setEditRowOpen}
        row={editRowData}
        onSave={handleEditRowSave}
        trades={editRowLookups?.trades || []}
        roles={editRowLookups?.roles || []}
        stages={editRowLookups?.stages || []}
        costCentres={editRowLookups?.costCentres || []}
        tenderSections={editRowLookups?.tenderSections || []}
        checklists={[]}
        documentTypes={[]}
        tradingNames={[]}
        invoiceTemplates={[]}
      />
    </div>
  );
}
