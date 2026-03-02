"use client";

import { useState, useCallback, useEffect } from "react";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Clock,
  Copy,
  Star,
  MoreHorizontal,
  Edit,
  Trash,
  Eye,
  ListTodo,
  LayoutGrid,
  List,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxMultiSelect } from "@/components/ui/combobox-multi-select";
import { api } from "@/lib/api";

interface SmScheduleMasterTemplate {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  row_count: number;
  created_at: string;
  updated_at: string;
  charge_construction_insurance_sm_ids: number[];
  charge_construction_insurance_sm_tasks: { id: number; name: string }[];
  charge_qleave_sm_ids: number[];
  charge_qleave_sm_tasks: { id: number; name: string }[];
  charge_overheads_sm_ids: number[];
  charge_overheads_sm_tasks: { id: number; name: string }[];
  charge_qbcc_insurance_sm_ids: number[];
  charge_qbcc_insurance_sm_tasks: { id: number; name: string }[];
  charge_builds_contingency_sm_ids: number[];
  charge_builds_contingency_sm_tasks: { id: number; name: string }[];
  charge_project_prelims_sm_ids: number[];
  charge_project_prelims_sm_tasks: { id: number; name: string }[];
  charge_project_management_sm_ids: number[];
  charge_project_management_sm_tasks: { id: number; name: string }[];
  charge_maintenance_fee_sm_ids: number[];
  charge_maintenance_fee_sm_tasks: { id: number; name: string }[];
  // Per-template markup rate overrides (null = use global default)
  defaultBuilderMarginPercent: number | null;
  defaultEscalationPercent: number | null;
  pcPsMarkupCapPercent: number | null;
  defaultConstructionInsurancePercent: number | null;
  defaultOverheadsPercent: number | null;
  defaultQleaveRatePercent: number | null;
  // Sync status - null if not synced, object if synced with other tenants
  sync_status: {
    is_canonical: boolean;
    synced_tenants: string[];
    dependent_tables: { name: string; count: number; sync_type: string }[];
  } | null;
}

interface SmPoTask {
  id: number;
  name: string;
}

export default function ScheduleTemplatesPage() {
  useSetLayoutMode("full-height");
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [templates, setTemplates] = useState<SmScheduleMasterTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SmScheduleMasterTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [settingDefault, setSettingDefault] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    charge_construction_insurance_sm_ids: [] as number[],
    charge_qleave_sm_ids: [] as number[],
    charge_overheads_sm_ids: [] as number[],
    charge_qbcc_insurance_sm_ids: [] as number[],
    charge_builds_contingency_sm_ids: [] as number[],
    charge_project_prelims_sm_ids: [] as number[],
    charge_project_management_sm_ids: [] as number[],
    charge_maintenance_fee_sm_ids: [] as number[],
    default_builder_margin_percent: null as number | null,
    default_escalation_percent: null as number | null,
    pc_ps_markup_cap_percent: null as number | null,
    default_construction_insurance_percent: null as number | null,
    default_overheads_percent: null as number | null,
    default_qleave_rate_percent: null as number | null,
  });
  const [poTasks, setPoTasks] = useState<SmPoTask[]>([]);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await api.get<{ success: boolean; sm_schedule_master_templates: SmScheduleMasterTemplate[] }>("/api/v1/sm_schedule_master_templates");
      setTemplates(data?.sm_schedule_master_templates || []);
    } catch (error) {
      console.error("Failed to load templates:", error);
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const refresh = useCallback(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Create template handler
  const handleCreate = () => {
    setFormData({
      name: "", description: "",
      charge_construction_insurance_sm_ids: [],
      charge_qleave_sm_ids: [],
      charge_overheads_sm_ids: [],
      charge_qbcc_insurance_sm_ids: [],
      charge_builds_contingency_sm_ids: [],
      charge_project_prelims_sm_ids: [],
      charge_project_management_sm_ids: [],
      charge_maintenance_fee_sm_ids: [],
      default_builder_margin_percent: null,
      default_escalation_percent: null,
      pc_ps_markup_cap_percent: null,
      default_construction_insurance_percent: null,
      default_overheads_percent: null,
      default_qleave_rate_percent: null,
    });
    setPoTasks([]);
    setEditingTemplate(null);
    setShowDialog(true);
  };

  // Edit template handler
  const handleEdit = async (template: SmScheduleMasterTemplate) => {
    setFormData({
      name: template.name,
      description: template.description || "",
      charge_construction_insurance_sm_ids: template.charge_construction_insurance_sm_ids || [],
      charge_qleave_sm_ids: template.charge_qleave_sm_ids || [],
      charge_overheads_sm_ids: template.charge_overheads_sm_ids || [],
      charge_qbcc_insurance_sm_ids: template.charge_qbcc_insurance_sm_ids || [],
      charge_builds_contingency_sm_ids: template.charge_builds_contingency_sm_ids || [],
      charge_project_prelims_sm_ids: template.charge_project_prelims_sm_ids || [],
      charge_project_management_sm_ids: template.charge_project_management_sm_ids || [],
      charge_maintenance_fee_sm_ids: template.charge_maintenance_fee_sm_ids || [],
      default_builder_margin_percent: template.defaultBuilderMarginPercent,
      default_escalation_percent: template.defaultEscalationPercent,
      pc_ps_markup_cap_percent: template.pcPsMarkupCapPercent,
      default_construction_insurance_percent: template.defaultConstructionInsurancePercent,
      default_overheads_percent: template.defaultOverheadsPercent,
      default_qleave_rate_percent: template.defaultQleaveRatePercent,
    });
    setEditingTemplate(template);
    setShowDialog(true);

    // Fetch PO-required tasks for this template
    try {
      const res = await api.get<{ tasks: SmPoTask[] }>(
        `/api/v1/sm_schedule_master_templates/${template.id}/po_tasks`
      );
      setPoTasks(res?.tasks || []);
    } catch {
      setPoTasks([]);
    }
  };

  // Save template handler
  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Template name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        await api.patch(`/api/v1/sm_schedule_master_templates/${editingTemplate.id}`, { sm_schedule_master_template: formData });
        toast({ title: "Success", description: "Template updated successfully" });
      } else {
        await api.post("/api/v1/sm_schedule_master_templates", { sm_schedule_master_template: formData });
        toast({ title: "Success", description: "Template created successfully" });
      }
      setShowDialog(false);
      refresh();
    } catch (error) {
      console.error("Failed to save template:", error);
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Duplicate template handler
  const handleDuplicate = async (id: number) => {
    setDuplicating(id);
    try {
      await api.post(`/api/v1/sm_schedule_master_templates/${id}/duplicate`);
      toast({ title: "Success", description: "Template duplicated successfully" });
      refresh();
    } catch (error) {
      console.error("Failed to duplicate template:", error);
      toast({ title: "Error", description: "Failed to duplicate template", variant: "destructive" });
    } finally {
      setDuplicating(null);
    }
  };

  // Set default template handler
  const handleSetDefault = async (id: number) => {
    setSettingDefault(id);
    try {
      await api.post(`/api/v1/sm_schedule_master_templates/${id}/set_default`);
      toast({ title: "Success", description: "Template set as default" });
      refresh();
    } catch (error) {
      console.error("Failed to set default template:", error);
      toast({ title: "Error", description: "Failed to set default template", variant: "destructive" });
    } finally {
      setSettingDefault(null);
    }
  };

  // Delete template handler
  const handleDelete = async (id: number) => {
    if (!(await confirm("Are you sure you want to delete this template?"))) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/sm_schedule_master_templates/${id}`);
      toast({ title: "Success", description: "Template archived successfully" });
      refresh();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast({ title: "Error", description: "Failed to archive template", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  // Stats from templates
  const defaultTemplate = templates.find((t) => t.is_default);
  const stats = {
    total: templates.length,
    defaultTemplate: defaultTemplate?.name || "None",
    totalTasks: templates.reduce((sum, t) => sum + (t.row_count || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  // Left actions - Create button + View Toggle
  const leftActionsWithToggle = (
    <div className="flex items-center gap-2">
      <Button onClick={handleCreate}>
        <Plus className="h-4 w-4 mr-2" />
        Create Template
      </Button>
      <div className="flex items-center gap-1 ml-4">
        <Button
          variant={viewMode === "cards" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("cards")}
        >
          <LayoutGrid className="h-4 w-4 mr-1" />
          Cards
        </Button>
        <Button
          variant={viewMode === "table" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("table")}
        >
          <List className="h-4 w-4 mr-1" />
          Table
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/dashboard" />
          <div>
            <h1 className="text-2xl font-bold">Schedule Templates</h1>
            <p className="text-sm text-muted-foreground">
              {stats.total} templates • {stats.totalTasks} total rows • Default: {stats.defaultTemplate}
            </p>
          </div>
        </div>
        {leftActionsWithToggle}
      </div>

      {/* Templates Grid - Card View */}
      <div className="px-4 flex-1 overflow-auto">
        {templates.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12">
            <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No templates yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create schedule templates to quickly set up task schedules for new jobs.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Template
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer transition-all hover:shadow-md"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {template.name}
                        {template.is_default && (
                          <Star className="h-4 w-4 text-yellow-500 dark:text-yellow-400 fill-yellow-500" />
                        )}
                        {template.sync_status && (
                          <Badge variant="outline" className="text-xs font-normal text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600">
                            Synced
                          </Badge>
                        )}
                      </CardTitle>
                      {template.description && (
                        <CardDescription className="mt-1">{template.description}</CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          {(duplicating === template.id || settingDefault === template.id || deleting === template.id) ? (
                            <Spinner size={16} />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a href={`/schedule-templates/${template.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Rows
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(template.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {!template.is_default && (
                          <DropdownMenuItem onClick={() => handleSetDefault(template.id)}>
                            <Star className="h-4 w-4 mr-2" />
                            Set as Default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className={template.sync_status ? "text-muted-foreground cursor-not-allowed" : "text-destructive"}
                          disabled={!!template.sync_status}
                          onClick={() => !template.sync_status && handleDelete(template.id)}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          {template.sync_status ? "Synced — cannot delete" : "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <ListTodo className="h-4 w-4" />
                      {template.row_count || 0} rows
                    </div>
                  </div>

                  {template.is_active ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}

                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                    Updated {new Date(template.updated_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
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

            {/* Per-template Markup Rate Overrides */}
            <div className="border-t pt-4 space-y-3">
              <div>
                <Label className="text-sm font-semibold">Markup Defaults</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Override global defaults for this template. Leave blank to use global settings.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MarkupRateField
                  label="Builder Margin %"
                  value={formData.default_builder_margin_percent}
                  onChange={v => setFormData(f => ({ ...f, default_builder_margin_percent: v }))}
                  step={0.5}
                />
                <MarkupRateField
                  label="Escalation %"
                  value={formData.default_escalation_percent}
                  onChange={v => setFormData(f => ({ ...f, default_escalation_percent: v }))}
                  step={0.5}
                />
                <MarkupRateField
                  label="PC/PS Markup Cap %"
                  value={formData.pc_ps_markup_cap_percent}
                  onChange={v => setFormData(f => ({ ...f, pc_ps_markup_cap_percent: v }))}
                  step={0.5}
                />
                <MarkupRateField
                  label="Construction Insurance %"
                  value={formData.default_construction_insurance_percent}
                  onChange={v => setFormData(f => ({ ...f, default_construction_insurance_percent: v }))}
                  step={0.1}
                />
                <MarkupRateField
                  label="Overheads %"
                  value={formData.default_overheads_percent}
                  onChange={v => setFormData(f => ({ ...f, default_overheads_percent: v }))}
                  step={0.1}
                />
                <MarkupRateField
                  label="QLeave Rate %"
                  value={formData.default_qleave_rate_percent}
                  onChange={v => setFormData(f => ({ ...f, default_qleave_rate_percent: v }))}
                  step={0.001}
                />
              </div>
            </div>

            {/* Charge Auto-Link PO - only show when editing (need tasks loaded) */}
            {editingTemplate && poTasks.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <div>
                  <Label className="text-sm font-semibold">Charge Auto-Link to PO</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    When markup is calculated, auto-link each charge to the PO on the selected SM task.
                  </p>
                </div>
                <ChargeSmTaskMultiSelect
                  label="Construction Insurance"
                  values={formData.charge_construction_insurance_sm_ids}
                  onChange={v => setFormData(f => ({ ...f, charge_construction_insurance_sm_ids: v }))}
                  tasks={poTasks}
                />
                <ChargeSmTaskMultiSelect
                  label="Overheads"
                  values={formData.charge_overheads_sm_ids}
                  onChange={v => setFormData(f => ({ ...f, charge_overheads_sm_ids: v }))}
                  tasks={poTasks}
                />
                <ChargeSmTaskMultiSelect
                  label="QLeave"
                  values={formData.charge_qleave_sm_ids}
                  onChange={v => setFormData(f => ({ ...f, charge_qleave_sm_ids: v }))}
                  tasks={poTasks}
                />
                <ChargeSmTaskMultiSelect
                  label="QBCC Insurance"
                  values={formData.charge_qbcc_insurance_sm_ids}
                  onChange={v => setFormData(f => ({ ...f, charge_qbcc_insurance_sm_ids: v }))}
                  tasks={poTasks}
                />
                <ChargeSmTaskMultiSelect
                  label="Build Contingency"
                  values={formData.charge_builds_contingency_sm_ids}
                  onChange={v => setFormData(f => ({ ...f, charge_builds_contingency_sm_ids: v }))}
                  tasks={poTasks}
                />
                <ChargeSmTaskMultiSelect
                  label="Project Prelims"
                  values={formData.charge_project_prelims_sm_ids}
                  onChange={v => setFormData(f => ({ ...f, charge_project_prelims_sm_ids: v }))}
                  tasks={poTasks}
                />
                <ChargeSmTaskMultiSelect
                  label="Project Management"
                  values={formData.charge_project_management_sm_ids}
                  onChange={v => setFormData(f => ({ ...f, charge_project_management_sm_ids: v }))}
                  tasks={poTasks}
                />
                <ChargeSmTaskMultiSelect
                  label="Maintenance Fee"
                  values={formData.charge_maintenance_fee_sm_ids}
                  onChange={v => setFormData(f => ({ ...f, charge_maintenance_fee_sm_ids: v }))}
                  tasks={poTasks}
                />
              </div>
            )}
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
    </div>
  );
}

// ── Per-template markup rate field ──
function MarkupRateField({
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

// ── Charge → SM Task multi-select ──
function ChargeSmTaskMultiSelect({
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
  const items = tasks.map(t => ({ id: t.id.toString(), label: t.name }));
  const selectedIds = values.map(v => v.toString());

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <ComboboxMultiSelect
        items={items}
        selectedIds={selectedIds}
        onChange={ids => onChange(ids.map(id => parseInt(id, 10)))}
        placeholder="Select tasks..."
        searchPlaceholder="Search tasks..."
      />
    </div>
  );
}
