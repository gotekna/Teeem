"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { ChevronDown, ChevronRight, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";

// ============================================
// Types
// ============================================

interface SmPoTask {
  id: number;
  name: string;
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
  // Per-template markup rate overrides
  defaultBuilderMarginPercent: number | null;
  defaultEscalationPercent: number | null;
  pcPsMarkupCapPercent: number | null;
  defaultConstructionInsurancePercent: number | null;
  defaultOverheadsPercent: number | null;
  defaultQleaveRatePercent: number | null;
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

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ sm_schedule_master_templates: TemplateMarkup[] }>(
          "/api/v1/sm_schedule_master_templates"
        );
        setTemplates(res?.sm_schedule_master_templates || []);
      } catch {
        toast({ title: "Failed to load templates", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

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
          defaultBuilderMarginPercent: tmpl.defaultBuilderMarginPercent,
          defaultEscalationPercent: tmpl.defaultEscalationPercent,
          pcPsMarkupCapPercent: tmpl.pcPsMarkupCapPercent,
          defaultConstructionInsurancePercent: tmpl.defaultConstructionInsurancePercent,
          defaultOverheadsPercent: tmpl.defaultOverheadsPercent,
          defaultQleaveRatePercent: tmpl.defaultQleaveRatePercent,
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

  const updateField = (templateId: number, field: string, value: number | null | number[]) => {
    setEditState(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], [field]: value },
    }));
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
          default_builder_margin_percent: edits.defaultBuilderMarginPercent,
          default_escalation_percent: edits.defaultEscalationPercent,
          pc_ps_markup_cap_percent: edits.pcPsMarkupCapPercent,
          default_construction_insurance_percent: edits.defaultConstructionInsurancePercent,
          default_overheads_percent: edits.defaultOverheadsPercent,
          default_qleave_rate_percent: edits.defaultQleaveRatePercent,
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
    <div className="space-y-6 max-w-3xl px-4 pt-4">
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
                  <CardContent className="pt-0 pb-4 px-4 space-y-5">
                    {/* Markup Rate Overrides */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">Markup Rate Overrides</Label>
                      <div className="grid grid-cols-3 gap-3">
                        <RateField
                          label="Builder Margin %"
                          value={edits.defaultBuilderMarginPercent ?? null}
                          onChange={v => updateField(tmpl.id, "defaultBuilderMarginPercent", v)}
                          step={0.5}
                        />
                        <RateField
                          label="Escalation %"
                          value={edits.defaultEscalationPercent ?? null}
                          onChange={v => updateField(tmpl.id, "defaultEscalationPercent", v)}
                          step={0.5}
                        />
                        <RateField
                          label="PC/PS Cap %"
                          value={edits.pcPsMarkupCapPercent ?? null}
                          onChange={v => updateField(tmpl.id, "pcPsMarkupCapPercent", v)}
                          step={0.5}
                        />
                        <RateField
                          label="Constr. Insurance %"
                          value={edits.defaultConstructionInsurancePercent ?? null}
                          onChange={v => updateField(tmpl.id, "defaultConstructionInsurancePercent", v)}
                          step={0.1}
                        />
                        <RateField
                          label="Overheads %"
                          value={edits.defaultOverheadsPercent ?? null}
                          onChange={v => updateField(tmpl.id, "defaultOverheadsPercent", v)}
                          step={0.1}
                        />
                        <RateField
                          label="QLeave Rate %"
                          value={edits.defaultQleaveRatePercent ?? null}
                          onChange={v => updateField(tmpl.id, "defaultQleaveRatePercent", v)}
                          step={0.001}
                        />
                      </div>
                    </div>

                    {/* Charge → PO Task Links */}
                    {tasks.length > 0 && (
                      <div className="border-t pt-4 space-y-3">
                        <div>
                          <Label className="text-sm font-semibold">Charge Auto-Link to PO</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Auto-link each charge to the PO on the selected SM task when markup is calculated.
                          </p>
                        </div>
                        <ChargeTaskMultiSelect
                          label="Construction Insurance"
                          values={(edits.charge_construction_insurance_sm_ids as number[]) || []}
                          onChange={v => updateField(tmpl.id, "charge_construction_insurance_sm_ids", v)}
                          tasks={tasks}
                        />
                        <ChargeTaskMultiSelect
                          label="Overheads"
                          values={(edits.charge_overheads_sm_ids as number[]) || []}
                          onChange={v => updateField(tmpl.id, "charge_overheads_sm_ids", v)}
                          tasks={tasks}
                        />
                        <ChargeTaskMultiSelect
                          label="QLeave"
                          values={(edits.charge_qleave_sm_ids as number[]) || []}
                          onChange={v => updateField(tmpl.id, "charge_qleave_sm_ids", v)}
                          tasks={tasks}
                        />
                        <ChargeTaskMultiSelect
                          label="QBCC Insurance"
                          values={(edits.charge_qbcc_insurance_sm_ids as number[]) || []}
                          onChange={v => updateField(tmpl.id, "charge_qbcc_insurance_sm_ids", v)}
                          tasks={tasks}
                        />
                      </div>
                    )}

                    {tasks.length === 0 && !loading && (
                      <div className="border-t pt-4">
                        <p className="text-xs text-muted-foreground">
                          No PO-required tasks on this template. Add tasks with PO Required enabled to configure charge auto-linking.
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

// ============================================
// Sub-components
// ============================================

function RateField({
  label,
  value,
  onChange,
  step = 0.5,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        step={step}
        value={value ?? ""}
        placeholder="Global default"
        onChange={e => {
          const raw = e.target.value;
          onChange(raw === "" ? null : parseFloat(raw) || 0);
        }}
        className="h-8 text-sm"
      />
    </div>
  );
}

function ChargeTaskMultiSelect({
  label,
  values,
  onChange,
  tasks,
}: {
  label: string;
  values: number[];
  onChange: (v: number[]) => void;
  tasks: SmPoTask[];
}) {
  const available: ComboboxItem[] = tasks
    .filter(t => !values.includes(t.id))
    .map(t => ({ id: t.id.toString(), label: t.name }));

  const selectedTasks = values
    .map(id => tasks.find(t => t.id === id))
    .filter(Boolean) as SmPoTask[];

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {selectedTasks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTasks.map(task => (
            <span
              key={task.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs"
            >
              {task.name}
              <button
                type="button"
                onClick={() => onChange(values.filter(id => id !== task.id))}
                className="text-muted-foreground hover:text-foreground ml-0.5"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <ComboboxDropdown
          items={available}
          onSelect={item => onChange([...values, parseInt(item.id, 10)])}
          placeholder={values.length > 0 ? "Add another task..." : "Select task..."}
          searchPlaceholder="Search tasks..."
        />
      )}
    </div>
  );
}
