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
import { ChevronDown, ChevronRight, Download, Save, Link2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";

// ============================================
// Types
// ============================================

interface SmPoTask {
  id: number;
  name: string;
  task_code?: string | null;
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

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Spinner size={32} className="text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl px-4 pt-4">
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

                    {/* Markup Rates (with PO link) */}
                    <div className="space-y-3">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Markup Rates</Label>
                      {MARKUP_RATES.map(rate => {
                        const hasSmField = rate.smField !== null;
                        const smIds = hasSmField ? (((edits as Record<string, unknown>)[rate.smField!] as number[]) || []) : [];
                        const rateAllocs = allocs[rate.chargeType] || {};
                        const hasMultiplePOs = smIds.length > 1;

                        return (
                          <div key={rate.key} className="space-y-1.5">
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
                                <div className="flex-1 min-w-0">
                                  <ComboboxMultiSelect
                                    items={tasks.map(t => ({ id: t.id.toString(), label: t.task_code ? `${t.task_code} — ${t.name}` : t.name, searchText: t.task_code || undefined }))}
                                    selectedIds={smIds.map(v => v.toString())}
                                    onChange={ids => updateField(tmpl.id, rate.smField!, ids.map(id => parseInt(id, 10)))}
                                    placeholder="Link to PO..."
                                    searchPlaceholder="Search tasks..."
                                  />
                                </div>
                              )}
                              {!hasSmField && (
                                <span className="text-xs text-muted-foreground pt-2 italic">Applied to tenders (smart roundup)</span>
                              )}
                            </div>

                            {hasMultiplePOs && tasks.length > 0 && (
                              <div className="ml-36 pl-3 flex flex-wrap gap-2 items-center">
                                <span className="text-xs text-muted-foreground">Split:</span>
                                {smIds.map(smId => {
                                  const task = tasks.find(t => t.id === smId);
                                  const taskName = task?.name || `#${smId}`;
                                  const claimMatch = claimPoMap[taskName];
                                  const pct = claimMatch
                                    ? claimMatch.percentage
                                    : (rateAllocs[smId.toString()] ?? Math.round(100 / smIds.length));
                                  return (
                                    <div key={smId} className="flex items-center gap-1">
                                      <span className="text-xs truncate max-w-[120px]">{taskName}</span>
                                      {claimMatch ? (
                                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded" title={`From claim stage: ${claimMatch.stageName}`}>
                                          {claimMatch.percentage}%
                                        </span>
                                      ) : (
                                        <Input
                                          type="number"
                                          min={0}
                                          max={100}
                                          step={1}
                                          value={pct}
                                          onChange={e => updateAllocation(tmpl.id, rate.chargeType, smId.toString(), parseFloat(e.target.value) || 0)}
                                          onFocus={e => e.target.select()}
                                          className="h-6 text-xs w-14 px-1"
                                        />
                                      )}
                                      {!claimMatch && <span className="text-xs text-muted-foreground">%</span>}
                                    </div>
                                  );
                                })}
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

                              {/* PO Multi-select */}
                              {tasks.length > 0 && (
                                <div className="flex-1 min-w-0">
                                  <ComboboxMultiSelect
                                    items={tasks.map(t => ({ id: t.id.toString(), label: t.task_code ? `${t.task_code} — ${t.name}` : t.name, searchText: t.task_code || undefined }))}
                                    selectedIds={smIds.map(v => v.toString())}
                                    onChange={ids => updateField(tmpl.id, charge.smField, ids.map(id => parseInt(id, 10)))}
                                    placeholder="Link to PO..."
                                    searchPlaceholder="Search tasks..."
                                  />
                                </div>
                              )}
                            </div>

                            {/* Per-PO allocation % (when multiple POs or claim-linked overheads) */}
                            {smIds.length > 0 && tasks.length > 0 && (hasMultiplePOs || (charge.chargeType === "overheads" && linkedClaimTemplate)) && (
                              <div className="ml-36 pl-3 space-y-1">
                                <span className="text-xs text-muted-foreground">
                                  {linkedClaimTemplate && charge.chargeType === "overheads" ? "Claim stage split:" : "Split:"}
                                </span>
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  {smIds.map(smId => {
                                    const task = tasks.find(t => t.id === smId);
                                    const taskName = task?.name || `#${smId}`;
                                    const claimMatch = claimPoMap[taskName];
                                    const pct = claimMatch
                                      ? claimMatch.percentage
                                      : (chargeAllocs[smId.toString()] ?? Math.round(100 / smIds.length));
                                    return (
                                      <div key={smId} className="flex items-center gap-1">
                                        <span className="text-xs truncate max-w-[140px]">{taskName}</span>
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
                                    );
                                  })}
                                </div>
                              </div>
                            )}
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

                    <div className="border-t pt-3">
                      <Button size="sm" onClick={() => handleSave(tmpl.id)} disabled={savingId === tmpl.id}>
                        {savingId === tmpl.id ? (
                          <><Spinner size={14} className="mr-1.5" /> Saving...</>
                        ) : (
                          <><Save className="h-3.5 w-3.5 mr-1.5" /> Save Template</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
