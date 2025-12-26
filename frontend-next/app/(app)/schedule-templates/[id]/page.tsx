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
  RefreshCw,
  SkipForward,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";

// Types
interface SmScheduleMasterTemplate {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  row_count: number;
}

interface SmScheduleMaster {
  id: number;
  task_number: number;
  name: string;
  description: string | null;
  sequence_order: number;
  duration_days: number;
  predecessor_ids: Array<{ id: number; type: string; lag: number }>;
  predecessor_display: string;
  trade: string | null;
  stage: string | null;
  cost_centre: string | null;
  assigned_role: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  checklist_id: number | null;
  require_photo: boolean;
  require_certificate: boolean;
  confirm: boolean;
  po_required: boolean;
  critical_po: boolean;
  create_po_on_job_start: boolean;
  po_supplier_id: number | null;
  po_supplier_name: string | null;
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
  // Schedule Master fields
  auto_include: boolean;
  allow_duplicates: boolean;
  ai_select: boolean;
  plan_type_ids: number[];
  start_entity_tab_ids: number[];
  complete_entity_tab_ids: number[];
  photo_entity_tab_id: number | null;
  linked_po_task_id: number | null;
  linked_po_task_name: string | null;
  supplier_confirm: boolean;
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

interface Job {
  id: number;
  name: string;
  address: string;
  status: string;
}

interface Supplier {
  id: number;
  name: string;
  company_name: string | null;
}


interface SyncResult {
  success: boolean;
  message: string;
  summary: {
    created: number;
    updated: number;
    skipped: number;
    unchanged: number;
    errors: number;
  };
  skipped_tasks: Array<{
    task_id: number;
    task_name: string;
    reason: string;
  }>;
  errors: Array<{
    row_id: number;
    error: string;
  }>;
}

interface CopyResult {
  success: boolean;
  message: string;
  tasks_created: number;
  dependencies_created: number;
  tasks_needing_pos: Array<{
    id: number;
    name: string;
    task_number: number;
  }>;
}

interface CompareResult {
  success: boolean;
  template_id: number;
  template_name: string;
  job_id: number;
  job_name: string;
  summary: {
    will_create: number;
    will_update: number;
    will_skip: number;
    unchanged: number;
    total: number;
  };
  comparisons: Array<{
    template_row: {
      id: number;
      task_number: number;
      name: string;
      description: string | null;
      duration_days: number;
      trade: string | null;
      stage: string | null;
      require_photo: boolean;
      require_certificate: boolean;
      po_required: boolean;
      critical_po: boolean;
    };
    job_task: {
      id: number;
      task_number: number;
      name: string;
      description: string | null;
      duration_days: number;
      trade: string | null;
      stage: string | null;
      status: string;
      require_photo: boolean;
      require_certificate: boolean;
      po_required: boolean;
      critical_po: boolean;
      started_at: string | null;
      completed_at: string | null;
      confirm: boolean;
      supplier_confirm: boolean;
      hold: boolean;
      purchase_order_id: number | null;
    } | null;
    status: "will_create" | "will_update" | "will_skip" | "unchanged";
    skip_reason: string | null;
    differences: Record<string, { template: unknown; task: unknown }>;
  }>;
}

export default function ScheduleTemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const templateId = params.id as string;

  // State
  const [template, setTemplate] = React.useState<SmScheduleMasterTemplate | null>(null);
  const [rows, setRows] = React.useState<SmScheduleMaster[]>([]);
  const [planTypes, setPlanTypes] = React.useState<PlanType[]>([]);
  const [entityTabs, setEntityTabs] = React.useState<EntityTab[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [editingRow, setEditingRow] = React.useState<SmScheduleMaster | null>(null);
  const [editForm, setEditForm] = React.useState<Partial<SmScheduleMaster>>({});

  // Sync to job state
  const [showSyncDialog, setShowSyncDialog] = React.useState(false);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = React.useState<string>("");
  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<SyncResult | null>(null);
  const [loadingJobs, setLoadingJobs] = React.useState(false);
  // Comparison state
  const [comparing, setComparing] = React.useState(false);
  const [compareResult, setCompareResult] = React.useState<CompareResult | null>(null);
  const [syncStep, setSyncStep] = React.useState<"select" | "compare" | "result">("select");

  // Copy to job state
  const [showCopyDialog, setShowCopyDialog] = React.useState(false);
  const [copying, setCopying] = React.useState(false);
  const [copyResult, setCopyResult] = React.useState<CopyResult | null>(null);
  const [copyJobId, setCopyJobId] = React.useState<string>("");
  const [copyStep, setCopyStep] = React.useState<"select" | "result" | "pos">("select");

  // Auto-PO configuration state
  const [showAutoPODialog, setShowAutoPODialog] = React.useState(false);
  const [autoPORow, setAutoPORow] = React.useState<SmScheduleMaster | null>(null);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = React.useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>("");
  const [savingAutoPO, setSavingAutoPO] = React.useState(false);

  // Load data
  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);

      // Load template, rows, plan types, and entity tabs in parallel
      const [templateData, rowsData, planTypesData, entityTabsData] = await Promise.all([
        api.get<{ success: boolean; sm_schedule_master_template: SmScheduleMasterTemplate }>(`/api/v1/sm_schedule_master_templates/${templateId}`),
        api.get<{ success: boolean; rows: SmScheduleMaster[] }>(`/api/v1/sm_schedule_master_templates/${templateId}/rows`),
        api.get<{ success: boolean; data: PlanType[] }>("/api/v1/plan_types"),
        api.get<{ success: boolean; data: { tabs: EntityTab[] } }>("/api/v1/entity_tabs/for_scope/job"),
      ]);

      setTemplate(templateData.sm_schedule_master_template);
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
  const handleEditRow = (row: SmScheduleMaster) => {
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
      supplier_confirm: row.supplier_confirm,
      is_master: row.is_master,
    });
    setShowEditDialog(true);
  };

  // Save row handler
  const handleSaveRow = async () => {
    if (!editingRow) return;

    setSaving(true);
    try {
      await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${editingRow.id}`, {
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

  // Load jobs for sync dialog
  const loadJobs = async () => {
    setLoadingJobs(true);
    try {
      const response = await api.get<{ success: boolean; data: Job[] }>("/api/v1/jobs?status=active&limit=100");
      setJobs(response.data || []);
    } catch (error) {
      console.error("Failed to load jobs:", error);
      toast({
        title: "Error",
        description: "Failed to load jobs",
        variant: "destructive",
      });
    } finally {
      setLoadingJobs(false);
    }
  };

  // Open sync dialog
  const handleOpenSyncDialog = () => {
    setSyncResult(null);
    setCompareResult(null);
    setSelectedJobId("");
    setSyncStep("select");
    setShowSyncDialog(true);
    loadJobs();
  };

  // Compare template with job
  const handleCompare = async () => {
    if (!selectedJobId) return;

    setComparing(true);
    try {
      const response = await api.get<CompareResult>(
        `/api/v1/sm_schedule_master_templates/${templateId}/compare_to_job?job_id=${selectedJobId}`
      );
      if (response) {
        setCompareResult(response);
        setSyncStep("compare");
      }
    } catch (error) {
      console.error("Failed to compare:", error);
      toast({
        title: "Comparison Failed",
        description: "Failed to compare template with job",
        variant: "destructive",
      });
    } finally {
      setComparing(false);
    }
  };

  // Sync template to job
  const handleSyncToJob = async () => {
    if (!selectedJobId) return;

    setSyncing(true);
    try {
      const response = await api.post<SyncResult>(`/api/v1/sm_schedule_master_templates/${templateId}/sync_to_job`, {
        job_id: parseInt(selectedJobId),
      });
      if (response) {
        setSyncResult(response);
        setSyncStep("result");
        toast({
          title: "Sync Complete",
          description: `Created: ${response.summary.created}, Updated: ${response.summary.updated}, Skipped: ${response.summary.skipped}`,
        });
      }
    } catch (error) {
      console.error("Failed to sync:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync template to job",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  // Open copy dialog
  const handleOpenCopyDialog = () => {
    setCopyResult(null);
    setCopyJobId("");
    setCopyStep("select");
    loadJobs();
    setShowCopyDialog(true);
  };

  // Copy template to job (initial copy, creates tasks)
  const handleCopyToJob = async () => {
    if (!copyJobId) return;

    setCopying(true);
    try {
      const response = await api.post<CopyResult>(`/api/v1/sm_schedule_master_templates/${templateId}/copy_to_job`, {
        job_id: parseInt(copyJobId),
        clear_existing: false,
      });
      if (response) {
        setCopyResult(response);
        // If there are tasks needing POs, go to PO step, otherwise show result
        if (response.tasks_needing_pos && response.tasks_needing_pos.length > 0) {
          setCopyStep("pos");
        } else {
          setCopyStep("result");
        }
        toast({
          title: "Copy Complete",
          description: `Created ${response.tasks_created} tasks, ${response.dependencies_created} dependencies`,
        });
      }
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy template to job",
        variant: "destructive",
      });
    } finally {
      setCopying(false);
    }
  };

  // Load suppliers for auto-PO dialog
  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const response = await api.get<{ success: boolean; data: Supplier[] }>("/api/v1/contacts?is_supplier=true&limit=500");
      setSuppliers(response.data || []);
    } catch (error) {
      console.error("Failed to load suppliers:", error);
      toast({
        title: "Error",
        description: "Failed to load suppliers",
        variant: "destructive",
      });
    } finally {
      setLoadingSuppliers(false);
    }
  };

  // Open auto-PO configuration dialog
  const handleOpenAutoPODialog = (row: SmScheduleMaster) => {
    setAutoPORow(row);
    setSelectedSupplierId(row.po_supplier_id ? String(row.po_supplier_id) : "");
    setShowAutoPODialog(true);
    loadSuppliers();
  };

  // Handle supplier selection change
  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
  };

  // Save auto-PO configuration
  const handleSaveAutoPO = async () => {
    if (!autoPORow) return;

    setSavingAutoPO(true);
    try {
      await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${autoPORow.id}`, {
        row: {
          create_po_on_job_start: true,
          po_supplier_id: selectedSupplierId ? parseInt(selectedSupplierId) : null,
        },
      });
      toast({ title: "Success", description: "Auto-PO configuration saved" });
      setShowAutoPODialog(false);
      loadData();
    } catch (error) {
      console.error("Failed to save auto-PO config:", error);
      toast({
        title: "Error",
        description: "Failed to save auto-PO configuration",
        variant: "destructive",
      });
    } finally {
      setSavingAutoPO(false);
    }
  };

  // Clear auto-PO configuration
  const handleClearAutoPO = async () => {
    if (!autoPORow) return;

    setSavingAutoPO(true);
    try {
      await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${autoPORow.id}`, {
        row: {
          create_po_on_job_start: false,
          po_supplier_id: null,
        },
      });
      toast({ title: "Success", description: "Auto-PO configuration cleared" });
      setShowAutoPODialog(false);
      loadData();
    } catch (error) {
      console.error("Failed to clear auto-PO config:", error);
      toast({
        title: "Error",
        description: "Failed to clear auto-PO configuration",
        variant: "destructive",
      });
    } finally {
      setSavingAutoPO(false);
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
            onClick={handleOpenCopyDialog}
          >
            <Plus className="h-4 w-4 mr-2" />
            Copy to Job
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenSyncDialog}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync to Job
          </Button>
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
                        <div className="flex items-center justify-center gap-1">
                          {row.po_required && (
                            <Badge variant="secondary" className="text-xs">Req</Badge>
                          )}
                          {row.create_po_on_job_start && (
                            <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400 border-orange-300">+PO</Badge>
                          )}
                          {!row.po_required && !row.create_po_on_job_start && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
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
                <div className="col-span-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="create_po_on_job_start"
                      checked={editForm.create_po_on_job_start ?? false}
                      onCheckedChange={(checked) => {
                        if (checked && editingRow) {
                          // When checking, open the configuration dialog
                          handleOpenAutoPODialog(editingRow);
                        } else {
                          // When unchecking, just update the form
                          setEditForm({ ...editForm, create_po_on_job_start: false });
                        }
                      }}
                    />
                    <Label htmlFor="create_po_on_job_start" className="text-sm">Create PO on Job Start</Label>
                    {editingRow?.po_supplier_id && (
                      <Badge variant="secondary" className="ml-auto">
                        {editingRow.po_supplier_name}
                      </Badge>
                    )}
                    {editForm.create_po_on_job_start && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => editingRow && handleOpenAutoPODialog(editingRow)}
                      >
                        {editingRow?.po_supplier_id ? 'Edit' : 'Configure'}
                      </Button>
                    )}
                  </div>
                  {editForm.create_po_on_job_start && !editingRow?.po_supplier_id && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Click Configure to set up the supplier and items for auto-PO creation.
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="supplier_confirm"
                    checked={editForm.supplier_confirm ?? false}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, supplier_confirm: !!checked })}
                  />
                  <Label htmlFor="supplier_confirm" className="text-sm">Require Supplier Confirm</Label>
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

      {/* Sync to Job Dialog - 3 Step Flow: Select → Compare → Result */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent className={syncStep === "compare" ? "max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" : "max-w-lg"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              {syncStep === "select" && "Sync Template to Job"}
              {syncStep === "compare" && `Compare: ${compareResult?.job_name || "Job"}`}
              {syncStep === "result" && "Sync Complete"}
            </DialogTitle>
            <DialogDescription>
              {syncStep === "select" && "Select a job to compare and sync template changes."}
              {syncStep === "compare" && "Review the differences before syncing. Tasks with job reality will be skipped."}
              {syncStep === "result" && "Template has been synced to the job."}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Select Job */}
          {syncStep === "select" && (
            <>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label>Select Job</Label>
                  {loadingJobs ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading jobs...
                    </div>
                  ) : (
                    <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a job..." />
                      </SelectTrigger>
                      <SelectContent>
                        {jobs.map((job) => (
                          <SelectItem key={job.id} value={String(job.id)}>
                            {job.name} - {job.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCompare} disabled={comparing || !selectedJobId}>
                  {comparing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Comparing...
                    </>
                  ) : (
                    "Compare"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 2: Compare View */}
          {syncStep === "compare" && compareResult && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-3 py-2 shrink-0">
                <div className="bg-green-50 dark:bg-green-950 rounded-lg p-2 text-center">
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {compareResult.summary.will_create}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300">Will Create</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-2 text-center">
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {compareResult.summary.will_update}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">Will Update</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-2 text-center">
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {compareResult.summary.will_skip}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">Will Skip</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-center">
                  <p className="text-xl font-bold text-gray-600 dark:text-gray-400">
                    {compareResult.summary.unchanged}
                  </p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Unchanged</p>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="flex-1 overflow-auto border rounded-lg min-h-0">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Template Row</TableHead>
                      <TableHead>Job Task</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Differences</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compareResult.comparisons.map((comp) => (
                      <TableRow
                        key={comp.template_row.id}
                        className={
                          comp.status === "will_skip" ? "bg-amber-50/50 dark:bg-amber-950/30" :
                          comp.status === "will_create" ? "bg-green-50/50 dark:bg-green-950/30" :
                          comp.status === "will_update" ? "bg-blue-50/50 dark:bg-blue-950/30" :
                          ""
                        }
                      >
                        <TableCell className="font-mono text-muted-foreground text-sm">
                          {comp.template_row.task_number}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{comp.template_row.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {comp.template_row.trade && <span className="mr-2">{comp.template_row.trade}</span>}
                            {comp.template_row.duration_days}d
                          </div>
                        </TableCell>
                        <TableCell>
                          {comp.job_task ? (
                            <>
                              <div className="font-medium text-sm">{comp.job_task.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {comp.job_task.status}
                                {comp.job_task.started_at && " • Started"}
                                {comp.job_task.completed_at && " • Done"}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground italic text-sm">Not in job</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              comp.status === "will_create" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                              comp.status === "will_update" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                              comp.status === "will_skip" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" :
                              "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            }
                          >
                            {comp.status === "will_create" && "Create"}
                            {comp.status === "will_update" && "Update"}
                            {comp.status === "will_skip" && "Skip"}
                            {comp.status === "unchanged" && "Match"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {comp.status === "will_skip" && comp.skip_reason && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              {comp.skip_reason}
                            </span>
                          )}
                          {comp.status === "will_update" && Object.keys(comp.differences).length > 0 && (
                            <div className="text-xs space-y-0.5">
                              {Object.entries(comp.differences).slice(0, 3).map(([field, diff]) => (
                                <div key={field} className="flex gap-1">
                                  <span className="font-medium">{field}:</span>
                                  <span className="text-red-500 line-through">{String(diff.task ?? "-")}</span>
                                  <span>→</span>
                                  <span className="text-green-600">{String(diff.template)}</span>
                                </div>
                              ))}
                              {Object.keys(comp.differences).length > 3 && (
                                <span className="text-muted-foreground">
                                  +{Object.keys(comp.differences).length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="shrink-0 pt-2">
                <Button variant="outline" onClick={() => setSyncStep("select")}>
                  Back
                </Button>
                <Button
                  onClick={handleSyncToJob}
                  disabled={syncing || (compareResult.summary.will_create === 0 && compareResult.summary.will_update === 0)}
                >
                  {syncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync {compareResult.summary.will_create + compareResult.summary.will_update} Tasks
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 3: Result */}
          {syncStep === "result" && syncResult && (
            <>
              <div className="py-4 space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {syncResult.summary.created}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">Created</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {syncResult.summary.updated}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">Updated</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {syncResult.summary.skipped}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">Skipped</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                      {syncResult.summary.unchanged}
                    </p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">Unchanged</p>
                  </div>
                </div>

                {/* Skipped Tasks */}
                {syncResult.skipped_tasks && syncResult.skipped_tasks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <SkipForward className="h-4 w-4 text-amber-500" />
                      Skipped Tasks ({syncResult.skipped_tasks.length})
                    </h4>
                    <div className="max-h-[200px] overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Task</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {syncResult.skipped_tasks.map((task) => (
                            <TableRow key={task.task_id}>
                              <TableCell className="font-medium text-sm">{task.task_name}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {task.reason}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Errors */}
                {syncResult.errors && syncResult.errors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                      Errors ({syncResult.errors.length})
                    </h4>
                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                      {syncResult.errors.map((err, idx) => (
                        <li key={idx}>Row #{err.row_id}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={() => setShowSyncDialog(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Copy to Job Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {copyStep === "select" && "Copy Template to Job"}
              {copyStep === "result" && "Copy Complete"}
              {copyStep === "pos" && "Create Purchase Orders"}
            </DialogTitle>
            <DialogDescription>
              {copyStep === "select" && "Select a job to copy this template to. This will create new tasks."}
              {copyStep === "result" && "Template has been copied successfully."}
              {copyStep === "pos" && "The following tasks need Purchase Orders. Create them now or do it later."}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Select Job */}
          {copyStep === "select" && (
            <>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label>Select Job</Label>
                  {loadingJobs ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading jobs...
                    </div>
                  ) : (
                    <Select value={copyJobId} onValueChange={setCopyJobId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a job..." />
                      </SelectTrigger>
                      <SelectContent>
                        {jobs.map((job) => (
                          <SelectItem key={job.id} value={String(job.id)}>
                            {job.name} - {job.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950 p-3 rounded-lg">
                  <AlertTriangle className="h-4 w-4 inline mr-1 text-amber-600" />
                  This will create new tasks from the template. Use &quot;Sync to Job&quot; to update existing tasks instead.
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCopyToJob} disabled={copying || !copyJobId}>
                  {copying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Copying...
                    </>
                  ) : (
                    "Copy to Job"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 2: Tasks Needing POs */}
          {copyStep === "pos" && copyResult && (
            <>
              <div className="py-4 space-y-4">
                <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    ✅ Created {copyResult.tasks_created} tasks, {copyResult.dependencies_created} dependencies
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Tasks Needing Purchase Orders ({copyResult.tasks_needing_pos.length})</Label>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {copyResult.tasks_needing_pos.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-2 bg-muted rounded-lg"
                      >
                        <span className="text-sm">
                          #{task.task_number} {task.name}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Navigate to job Gantt or PO creation
                            window.open(`/jobs/${copyJobId}/schedule?task=${task.id}`, '_blank');
                          }}
                        >
                          Create PO
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
                  Create POs Later
                </Button>
                <Button onClick={() => {
                  // Navigate to job schedule
                  router.push(`/jobs/${copyJobId}/schedule`);
                  setShowCopyDialog(false);
                }}>
                  Go to Job Schedule
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 3: Result (no POs needed) */}
          {copyStep === "result" && copyResult && (
            <>
              <div className="py-4">
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg text-center">
                  <CheckCircle className="h-8 w-8 mx-auto text-green-600 dark:text-green-400 mb-2" />
                  <p className="text-lg font-medium text-green-700 dark:text-green-300">
                    Template copied successfully
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Created {copyResult.tasks_created} tasks, {copyResult.dependencies_created} dependencies
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  router.push(`/jobs/${copyJobId}/schedule`);
                  setShowCopyDialog(false);
                }}>
                  Go to Job Schedule
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Auto-PO Configuration Dialog */}
      <Dialog open={showAutoPODialog} onOpenChange={setShowAutoPODialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Configure Auto-PO for: {autoPORow?.name}
            </DialogTitle>
            <DialogDescription>
              When this template is copied to a job, a Purchase Order will be automatically created with the supplier and items selected below.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {/* Supplier Selection */}
            <div className="space-y-2">
              <Label>Supplier</Label>
              {loadingSuppliers ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading suppliers...
                </div>
              ) : (
                <Select value={selectedSupplierId} onValueChange={handleSupplierChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={String(supplier.id)}>
                        {supplier.name}
                        {supplier.company_name && supplier.company_name !== supplier.name && (
                          <span className="text-muted-foreground ml-1">({supplier.company_name})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Info message */}
            <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 inline mr-1 text-blue-600 dark:text-blue-400" />
              When this template is copied to a job, a draft PO will be created automatically with the selected supplier.
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            {autoPORow?.po_supplier_id && (
              <Button
                variant="destructive"
                onClick={handleClearAutoPO}
                disabled={savingAutoPO}
                className="mr-auto"
              >
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save PO Template"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
