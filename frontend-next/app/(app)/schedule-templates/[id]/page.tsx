"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultipleSelector, { Option } from "@/components/ui/multiple-selector";
import {
  ArrowLeft,
  Edit,
  Loader2,
  Plus,
  ListTodo,
  Clock,
  FileText,
  Camera,
  CheckCircle,
  AlertCircle,
  GanttChartSquare,
} from "lucide-react";
import { api } from "@/lib/api";

// Types
interface SmTemplate {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  row_count: number;
}

interface SmTemplateRow {
  id: number;
  task_number: number;
  name: string;
  description: string | null;
  sequence_order: number;
  duration_days: number;
  start_day_offset: number | null;
  predecessor_ids: Array<{ id: number; type: string; lag: number }>;
  predecessor_display: string;
  trade: string | null;
  stage: string | null;
  cost_centre: string | null;
  assigned_role: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  checklist_id: number | null;
  parent_row_id: number | null;
  require_photo: boolean;
  require_certificate: boolean;
  require_supervisor_check: boolean;
  po_required: boolean;
  critical_po: boolean;
  create_po_on_job_start: boolean;
  cert_lag_days: number | null;
  has_subtasks: boolean;
  subtask_count: number | null;
  subtask_names: string[] | null;
  spawn_photo_task: boolean;
  spawn_scan_task: boolean;
  pass_fail_enabled: boolean;
  order_time_days: number | null;
  call_time_days: number | null;
  documentation_category_ids: number[];
  show_in_docs_tab: boolean;
  linked_task_ids: number[];
  price_book_item_ids: number[];
  tags: string[];
  color: string | null;
  is_active: boolean;
  // New Schedule Master fields
  auto_include: boolean;
  allow_duplicates: boolean;
  ai_select: boolean;
  plan_type_ids: number[];
  start_entity_tab_ids: number[];
  complete_entity_tab_ids: number[];
  photo_entity_tab_id: number | null;
  linked_po_task_id: number | null;
  linked_po_task_name: string | null;
  require_supplier_confirm: boolean;
  is_master: boolean;
  // Multi-template support
  sm_template_ids: number[];
}

interface PlanType {
  id: number;
  code: string;
  name: string;
  display_name: string;
}

interface EntityTab {
  id: number;
  tab_key: string;
  display_name: string;
  hierarchy_path: string;
}

export default function ScheduleTemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const templateId = params.id as string;

  // State
  const [template, setTemplate] = React.useState<SmTemplate | null>(null);
  const [rows, setRows] = React.useState<SmTemplateRow[]>([]);
  const [planTypes, setPlanTypes] = React.useState<PlanType[]>([]);
  const [entityTabs, setEntityTabs] = React.useState<EntityTab[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [editingRow, setEditingRow] = React.useState<SmTemplateRow | null>(null);
  const [editForm, setEditForm] = React.useState<Partial<SmTemplateRow>>({});

  // Load data
  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);

      // Load template, rows, plan types, and entity tabs in parallel
      const [templateData, rowsData, planTypesData, entityTabsData] = await Promise.all([
        api.get<{ success: boolean; sm_template: SmTemplate }>(`/api/v1/sm_templates/${templateId}`),
        api.get<{ success: boolean; rows: SmTemplateRow[] }>(`/api/v1/sm_templates/${templateId}/rows`),
        api.get<{ success: boolean; data: PlanType[] }>("/api/v1/plan_types"),
        api.get<{ success: boolean; data: { tabs: EntityTab[] } }>("/api/v1/entity_tabs/for_scope/job"),
      ]);

      setTemplate(templateData.sm_template);
      setRows(rowsData.rows || []);
      setPlanTypes(planTypesData.data || []);
      setEntityTabs(entityTabsData.data?.tabs || []);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        title: "Error",
        description: "Failed to load template data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [templateId, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Edit row handler
  const handleEditRow = (row: SmTemplateRow) => {
    setEditingRow(row);
    setEditForm({
      name: row.name,
      description: row.description,
      duration_days: row.duration_days,
      trade: row.trade,
      stage: row.stage,
      cost_centre: row.cost_centre,
      po_required: row.po_required,
      critical_po: row.critical_po,
      require_photo: row.require_photo,
      require_certificate: row.require_certificate,
      cert_lag_days: row.cert_lag_days,
      auto_include: row.auto_include,
      allow_duplicates: row.allow_duplicates,
      ai_select: row.ai_select,
      plan_type_ids: row.plan_type_ids || [],
      start_entity_tab_ids: row.start_entity_tab_ids || [],
      complete_entity_tab_ids: row.complete_entity_tab_ids || [],
      photo_entity_tab_id: row.photo_entity_tab_id,
      linked_po_task_id: row.linked_po_task_id,
      require_supplier_confirm: row.require_supplier_confirm,
      is_master: row.is_master,
    });
    setShowEditDialog(true);
  };

  // Save row handler
  const handleSaveRow = async () => {
    if (!editingRow) return;

    setSaving(true);
    try {
      await api.patch(`/api/v1/sm_templates/${templateId}/rows/${editingRow.id}`, {
        row: editForm,
      });
      toast({ title: "Success", description: "Row updated successfully" });
      setShowEditDialog(false);
      loadData();
    } catch (error) {
      console.error("Failed to save row:", error);
      toast({
        title: "Error",
        description: "Failed to save row",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Convert arrays to MultipleSelector options
  const planTypeOptions: Option[] = planTypes.map((pt) => ({
    value: String(pt.id),
    label: pt.display_name || pt.name,
  }));

  const entityTabOptions: Option[] = entityTabs.map((tab) => ({
    value: String(tab.id),
    label: tab.display_name || tab.tab_key,
  }));

  // Get other rows for linked_po_task dropdown
  const otherRowOptions = rows
    .filter((r) => editingRow && r.id !== editingRow.id)
    .map((r) => ({ id: r.id, name: `${r.task_number}. ${r.name}` }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Template not found</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pb-4 flex items-center justify-between border-b mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/schedule-templates")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{template.name}</h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} rows • {template.description || "No description"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {template.is_default && (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              Default
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => router.push(`/schedule-templates/${templateId}/gantt`)}
          >
            <GanttChartSquare className="h-4 w-4 mr-2" />
            Canvas Gantt
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Rows</span>
            </div>
            <p className="text-2xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">PO Required</span>
            </div>
            <p className="text-2xl font-bold">{rows.filter((r) => r.po_required).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Photo Required</span>
            </div>
            <p className="text-2xl font-bold">{rows.filter((r) => r.require_photo).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Auto Include</span>
            </div>
            <p className="text-2xl font-bold">{rows.filter((r) => r.auto_include).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Manual Only</span>
            </div>
            <p className="text-2xl font-bold">{rows.filter((r) => !r.auto_include).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rows Table */}
      <div className="flex-1 overflow-auto px-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-lg">Template Rows</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[100px]">Trade</TableHead>
                    <TableHead className="w-[100px]">Stage</TableHead>
                    <TableHead className="w-[120px]">Cost Centre</TableHead>
                    <TableHead className="w-[80px]">Days</TableHead>
                    <TableHead className="w-[100px]">Predecessors</TableHead>
                    <TableHead className="w-[80px] text-center">PO</TableHead>
                    <TableHead className="w-[80px] text-center">Photo</TableHead>
                    <TableHead className="w-[80px] text-center">Cert</TableHead>
                    <TableHead className="w-[80px] text-center">Auto</TableHead>
                    <TableHead className="w-[80px] text-center">Multi</TableHead>
                    <TableHead className="w-[120px]">Plan Types</TableHead>
                    <TableHead className="w-[100px]">Start Docs</TableHead>
                    <TableHead className="w-[100px]">Complete Docs</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEditRow(row)}>
                      <TableCell className="font-mono text-muted-foreground">
                        {row.task_number}
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.trade || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.stage || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.cost_centre || "-"}
                      </TableCell>
                      <TableCell>{row.duration_days}d</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.predecessor_display !== "None" ? row.predecessor_display : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.po_required ? (
                          <Badge variant="secondary" className="text-xs">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.require_photo ? (
                          <Camera className="h-4 w-4 mx-auto text-blue-500" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.require_certificate ? (
                          <Badge variant="secondary" className="text-xs">
                            {row.cert_lag_days ? `+${row.cert_lag_days}d` : "Yes"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.auto_include ? (
                          <CheckCircle className="h-4 w-4 mx-auto text-green-500" />
                        ) : (
                          <span className="text-muted-foreground text-xs">Manual</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.allow_duplicates ? (
                          <Badge variant="outline" className="text-xs">Multi</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.plan_type_ids?.length > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            {row.plan_type_ids.length}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.start_entity_tab_ids?.length > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            {row.start_entity_tab_ids.length}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.complete_entity_tab_ids?.length > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            {row.complete_entity_tab_ids.length}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditRow(row); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Row Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Row: {editingRow?.task_number}. {editingRow?.name}
            </DialogTitle>
            <DialogDescription>
              Configure task settings and document linking
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Basic Info
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (days)</Label>
                  <Input
                    type="number"
                    value={editForm.duration_days || ""}
                    onChange={(e) => setEditForm({ ...editForm, duration_days: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trade</Label>
                  <Input
                    value={editForm.trade || ""}
                    onChange={(e) => setEditForm({ ...editForm, trade: e.target.value })}
                    placeholder="e.g., Carpentry, Plumbing"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Input
                    value={editForm.stage || ""}
                    onChange={(e) => setEditForm({ ...editForm, stage: e.target.value })}
                    placeholder="e.g., Frame, Lock-up"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Cost Centre</Label>
                  <Input
                    value={editForm.cost_centre || ""}
                    onChange={(e) => setEditForm({ ...editForm, cost_centre: e.target.value })}
                    placeholder="e.g., Door, Windows, Framing"
                  />
                  <p className="text-xs text-muted-foreground">
                    Filter POs by category - e.g., show all Door-related POs
                  </p>
                </div>
              </div>
            </div>

            {/* Task Behavior */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Task Behavior
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto_include"
                    checked={editForm.auto_include ?? true}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, auto_include: !!checked })}
                  />
                  <Label htmlFor="auto_include" className="text-sm">Auto Include</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allow_duplicates"
                    checked={editForm.allow_duplicates ?? false}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, allow_duplicates: !!checked })}
                  />
                  <Label htmlFor="allow_duplicates" className="text-sm">Allow Duplicates</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ai_select"
                    checked={editForm.ai_select ?? false}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, ai_select: !!checked })}
                  />
                  <Label htmlFor="ai_select" className="text-sm">AI Select</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_master"
                    checked={editForm.is_master ?? false}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, is_master: !!checked })}
                  />
                  <Label htmlFor="is_master" className="text-sm">Master Task</Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Master Task: When completed, auto-completes all prior tasks (except in-progress photo/scan tasks)
              </p>
            </div>

            {/* PO & Certification */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                PO & Certification
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="po_required"
                    checked={editForm.po_required ?? false}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, po_required: !!checked })}
                  />
                  <Label htmlFor="po_required" className="text-sm">PO Required</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="critical_po"
                    checked={editForm.critical_po ?? false}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, critical_po: !!checked })}
                  />
                  <Label htmlFor="critical_po" className="text-sm">Critical PO</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="require_supplier_confirm"
                    checked={editForm.require_supplier_confirm ?? false}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, require_supplier_confirm: !!checked })}
                  />
                  <Label htmlFor="require_supplier_confirm" className="text-sm">Require Supplier Confirm</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="require_photo"
                    checked={editForm.require_photo ?? false}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, require_photo: !!checked })}
                  />
                  <Label htmlFor="require_photo" className="text-sm">Require Photo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="require_certificate"
                    checked={editForm.require_certificate ?? false}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, require_certificate: !!checked })}
                  />
                  <Label htmlFor="require_certificate" className="text-sm">Require Certificate</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cert Lag Days</Label>
                  <Input
                    type="number"
                    value={editForm.cert_lag_days ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, cert_lag_days: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Days after task completion"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Link to PO Task</Label>
                  <Select
                    value={editForm.linked_po_task_id ? String(editForm.linked_po_task_id) : "none"}
                    onValueChange={(value) => setEditForm({ ...editForm, linked_po_task_id: value === "none" ? null : parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent PO task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {otherRowOptions.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Plan Types */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Plan Types (Attach to PO)
              </h4>
              <MultipleSelector
                value={planTypeOptions.filter((opt) =>
                  (editForm.plan_type_ids || []).includes(parseInt(opt.value))
                )}
                onChange={(selected) =>
                  setEditForm({
                    ...editForm,
                    plan_type_ids: selected.map((s) => parseInt(s.value)),
                  })
                }
                options={planTypeOptions}
                placeholder="Select plan types..."
                emptyIndicator={<span className="text-muted-foreground">No plan types found</span>}
              />
            </div>

            {/* Document EntityTabs - START */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Documents Sent on START
              </h4>
              <MultipleSelector
                value={entityTabOptions.filter((opt) =>
                  (editForm.start_entity_tab_ids || []).includes(parseInt(opt.value))
                )}
                onChange={(selected) =>
                  setEditForm({
                    ...editForm,
                    start_entity_tab_ids: selected.map((s) => parseInt(s.value)),
                  })
                }
                options={entityTabOptions}
                placeholder="Select document tabs..."
                emptyIndicator={<span className="text-muted-foreground">No tabs found</span>}
              />
            </div>

            {/* Document EntityTabs - COMPLETE */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Documents Received on COMPLETE
              </h4>
              <MultipleSelector
                value={entityTabOptions.filter((opt) =>
                  (editForm.complete_entity_tab_ids || []).includes(parseInt(opt.value))
                )}
                onChange={(selected) =>
                  setEditForm({
                    ...editForm,
                    complete_entity_tab_ids: selected.map((s) => parseInt(s.value)),
                  })
                }
                options={entityTabOptions}
                placeholder="Select document tabs..."
                emptyIndicator={<span className="text-muted-foreground">No tabs found</span>}
              />
            </div>

            {/* Photo Storage */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Photo Storage Location
              </h4>
              <Select
                value={editForm.photo_entity_tab_id ? String(editForm.photo_entity_tab_id) : "none"}
                onValueChange={(value) => setEditForm({ ...editForm, photo_entity_tab_id: value === "none" ? null : parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select photo storage tab" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {entityTabs.map((tab) => (
                    <SelectItem key={tab.id} value={String(tab.id)}>
                      {tab.display_name || tab.tab_key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRow} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
