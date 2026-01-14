"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SetupTable } from "@/components/ui/setup-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Briefcase,
  ListChecks,
  Layers,
  MapPin,
  Search,
  GitBranch,
} from "lucide-react";
import { WorkflowConfigTab } from "./WorkflowConfigTab";

// DnD Primitives - SSoT for drag and drop UI
import { DragHandle, ItemBadge } from "@/components/ui/dnd";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface JobType {
  id: number;
  name: string;
  color: string;
  position: number;
  active: boolean;
  sm_schedule_master_template_id?: number | null;
  schedule_template_summary?: {
    template_id: number;
    template_name: string;
    version_id: number | null;
    version_number: number | null;
    row_count: number;
  } | null;
}

interface ScheduleMasterTemplate {
  id: number;
  name: string;
}

interface JobStatus {
  id: number;
  name: string;
  color: string;
  position: number;
  active: boolean;
}

interface JobStage {
  id: number;
  name: string;
  color: string;
  position: number;
  active: boolean;
}

interface Suburb {
  id: number;
  name: string;
  postcode: string;
  state: string;
  council: string | null;
  position: number;
  is_active: boolean;
}

// SSoT: Claim stages are now managed via Schedule Master CLAIM tasks
// ClaimStageTemplate system removed - configure claims in Schedule Master templates

const STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"];

const SEQ_COUNCILS = [
  "Brisbane City Council",
  "Gold Coast City Council",
  "Logan City Council",
  "Moreton Bay Regional Council",
  "Redland City Council",
  "Ipswich City Council",
  "Sunshine Coast Council",
  "Noosa Shire Council",
  "Scenic Rim Regional Council",
  "Lockyer Valley Regional Council",
  "Somerset Regional Council",
  "Toowoomba Regional Council",
];


const JOB_SETUP_SUB_TABS = [
  { id: "lists", label: "Lists", icon: ListChecks },
  { id: "workflow", label: "Workflow", icon: GitBranch },
];

const DEFAULT_JOB_SETUP_BASE_PATH = "/settings/company/job-setup";

interface JobSetupTabProps {
  subTab?: string;
  basePath?: string;
}

export function JobSetupTab({ subTab, basePath = DEFAULT_JOB_SETUP_BASE_PATH }: JobSetupTabProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Default to "lists" sub-tab
  const activeSubTab = JOB_SETUP_SUB_TABS.some((t) => t.id === subTab) ? subTab : "lists";

  const handleSubTabChange = (tabId: string) => {
    router.push(`${basePath}/${tabId}`, { scroll: false });
  };
  const [jobTypes, setJobTypes] = React.useState<JobType[]>([]);
  const [jobStatuses, setJobStatuses] = React.useState<JobStatus[]>([]);
  const [jobStages, setJobStages] = React.useState<JobStage[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [showDialog, setShowDialog] = React.useState(false);
  const [dialogType, setDialogType] = React.useState<"type" | "status" | "stage">("type");
  const [editingItem, setEditingItem] = React.useState<JobType | JobStatus | JobStage | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: "",
    color: "#3B82F6",
    sm_schedule_master_template_id: null as number | null,
  });

  // Schedule Master Templates state
  const [scheduleTemplates, setScheduleTemplates] = React.useState<ScheduleMasterTemplate[]>([]);

  // Suburbs state
  const [suburbs, setSuburbs] = React.useState<Suburb[]>([]);
  const [suburbsLoading, setSuburbsLoading] = React.useState(true);
  const [suburbSearch, setSuburbSearch] = React.useState("");
  const [suburbStateFilter, setSuburbStateFilter] = React.useState<string>("all");
  const [suburbCouncilFilter, setSuburbCouncilFilter] = React.useState<string>("all");
  const [showSuburbDialog, setShowSuburbDialog] = React.useState(false);
  const [editingSuburb, setEditingSuburb] = React.useState<Suburb | null>(null);
  const [suburbSaving, setSuburbSaving] = React.useState(false);
  const [suburbFormData, setSuburbFormData] = React.useState({
    name: "",
    postcode: "",
    state: "QLD",
    council: "",
  });

  // SSoT: Claim stages removed - now managed via Schedule Master CLAIM tasks

  const COLORS = [
    "#3B82F6", // Blue
    "#10B981", // Green
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#F97316", // Orange
    "#6366F1", // Indigo
    "#84CC16", // Lime
  ];

  React.useEffect(() => {
    loadData();
    loadSuburbs();
    loadScheduleTemplates();
  }, []);

  const loadScheduleTemplates = async () => {
    try {
      const response = await api.get<{ sm_schedule_master_templates: ScheduleMasterTemplate[] }>(
        "/api/v1/sm_schedule_master_templates"
      );
      setScheduleTemplates(response.sm_schedule_master_templates || []);
    } catch (error) {
      console.error("Failed to load schedule templates:", error);
    }
  };

  const loadData = async () => {
    try {
      const [typesRes, statusesRes, stagesRes] = await Promise.all([
        api.get<{ job_types: JobType[] }>("/api/v1/job_types"),
        api.get<{ job_statuses: JobStatus[] }>("/api/v1/job_status"),
        api.get<{ job_stages: JobStage[] }>("/api/v1/job_stages"),
      ]);
      setJobTypes(typesRes.job_types || []);
      setJobStatuses(statusesRes.job_statuses || []);
      setJobStages(stagesRes.job_stages || []);
    } catch (error) {
      console.error("Failed to load data:", error);
      // Mock data
      setJobTypes([
        { id: 1, name: "New Build", color: "#3B82F6", position: 1, active: true },
        { id: 2, name: "Renovation", color: "#10B981", position: 2, active: true },
        { id: 3, name: "Extension", color: "#F59E0B", position: 3, active: true },
      ]);
      setJobStatuses([
        { id: 1, name: "Quote", color: "#8B5CF6", position: 1, active: true },
        { id: 2, name: "Won", color: "#10B981", position: 2, active: true },
        { id: 3, name: "In Progress", color: "#3B82F6", position: 3, active: true },
        { id: 4, name: "Complete", color: "#84CC16", position: 4, active: true },
        { id: 5, name: "Lost", color: "#EF4444", position: 5, active: true },
      ]);
      setJobStages([
        { id: 1, name: "Pre-Construction", color: "#F59E0B", position: 1, active: true },
        { id: 2, name: "Foundation", color: "#6366F1", position: 2, active: true },
        { id: 3, name: "Frame", color: "#06B6D4", position: 3, active: true },
        { id: 4, name: "Lock Up", color: "#8B5CF6", position: 4, active: true },
        { id: 5, name: "Fit Out", color: "#EC4899", position: 5, active: true },
        { id: 6, name: "Handover", color: "#10B981", position: 6, active: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadSuburbs = async () => {
    try {
      const response = await api.get<{ suburbs: Suburb[] }>("/api/v1/suburbs");
      setSuburbs(response.suburbs || []);
    } catch (error) {
      console.error("Failed to load suburbs:", error);
    } finally {
      setSuburbsLoading(false);
    }
  };

  // Suburb stats
  const suburbStats = React.useMemo(() => {
    const byState: Record<string, number> = {};
    suburbs.forEach((s) => {
      byState[s.state] = (byState[s.state] || 0) + 1;
    });
    return {
      total: suburbs.length,
      withCouncil: suburbs.filter((s) => s.council).length,
      byState,
    };
  }, [suburbs]);

  // Filter suburbs
  const filteredSuburbs = React.useMemo(() => {
    return suburbs.filter((suburb) => {
      if (suburbSearch) {
        const query = suburbSearch.toLowerCase();
        if (
          !suburb.name.toLowerCase().includes(query) &&
          !suburb.postcode.includes(query)
        ) {
          return false;
        }
      }
      if (suburbStateFilter !== "all" && suburb.state !== suburbStateFilter) {
        return false;
      }
      if (suburbCouncilFilter === "with-council" && !suburb.council) {
        return false;
      }
      if (suburbCouncilFilter === "without-council" && suburb.council) {
        return false;
      }
      if (
        suburbCouncilFilter !== "all" &&
        suburbCouncilFilter !== "with-council" &&
        suburbCouncilFilter !== "without-council" &&
        suburb.council !== suburbCouncilFilter
      ) {
        return false;
      }
      return true;
    });
  }, [suburbs, suburbSearch, suburbStateFilter, suburbCouncilFilter]);

  // Get unique councils for filter
  const uniqueCouncils = React.useMemo(() => {
    const councils = new Set<string>();
    suburbs.forEach((s) => {
      if (s.council) councils.add(s.council);
    });
    return Array.from(councils).sort();
  }, [suburbs]);

  const handleEditSuburbClick = (suburb: Suburb) => {
    setEditingSuburb(suburb);
    setSuburbFormData({
      name: suburb.name,
      postcode: suburb.postcode,
      state: suburb.state,
      council: suburb.council || "",
    });
    setShowSuburbDialog(true);
  };

  const handleSaveSuburb = async () => {
    if (!editingSuburb) return;

    setSuburbSaving(true);
    try {
      await api.patch(`/api/v1/suburbs/${editingSuburb.id}`, {
        suburb: suburbFormData,
      });
      toast({ title: "Success", description: "Suburb updated successfully" });
      setShowSuburbDialog(false);
      loadSuburbs();
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "Failed to save suburb", variant: "destructive" });
    } finally {
      setSuburbSaving(false);
    }
  };

  const handleOpenAddDialog = (type: "type" | "status" | "stage") => {
    setDialogType(type);
    setEditingItem(null);
    setFormData({ name: "", color: COLORS[0], sm_schedule_master_template_id: null });
    setShowDialog(true);
  };

  const handleOpenEditDialog = (item: JobType | JobStatus | JobStage, type: "type" | "status" | "stage") => {
    setDialogType(type);
    setEditingItem(item);
    // Include schedule template ID for job types
    const templateId = type === "type" ? (item as JobType).sm_schedule_master_template_id || null : null;
    setFormData({ name: item.name, color: item.color || COLORS[0], sm_schedule_master_template_id: templateId });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const endpoints = {
      type: "/api/v1/job_types",
      status: "/api/v1/job_status",
      stage: "/api/v1/job_stages",
    };

    // Build payload - only include template_id for job types
    const paramKey = dialogType === "type" ? "job_type" : dialogType === "status" ? "job_status" : "job_stage";
    const payload: Record<string, unknown> = {
      name: formData.name,
      color: formData.color,
    };
    if (dialogType === "type") {
      payload.sm_schedule_master_template_id = formData.sm_schedule_master_template_id;
    }

    try {
      if (editingItem) {
        await api.patch(`${endpoints[dialogType]}/${editingItem.id}`, {
          [paramKey]: payload,
        });
        toast({ title: "Success", description: "Item updated successfully" });
      } else {
        await api.post(endpoints[dialogType], {
          [paramKey]: payload,
        });
        toast({ title: "Success", description: "Item created successfully" });
      }
      setShowDialog(false);
      loadData();
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "Failed to save item", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, type: "type" | "status" | "stage") => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    const endpoints = {
      type: "/api/v1/job_types",
      status: "/api/v1/job_status",
      stage: "/api/v1/job_stages",
    };

    try {
      await api.delete(`${endpoints[type]}/${id}`);
      toast({ title: "Success", description: "Item deleted successfully" });
      loadData();
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  };

  const handleReorder = async (items: (JobType | JobStatus | JobStage)[], type: "type" | "status" | "stage") => {
    const endpoints = {
      type: "/api/v1/job_types/reorder",
      status: "/api/v1/job_status/reorder",
      stage: "/api/v1/job_stages/reorder",
    };

    // Backend expects different param names for each type
    const paramKeys = {
      type: "job_type_ids",
      status: "job_status_ids",
      stage: "job_stage_ids",
    };

    // Update local state immediately (optimistic update)
    if (type === "type") setJobTypes(items as JobType[]);
    if (type === "status") setJobStatuses(items as JobStatus[]);
    if (type === "stage") setJobStages(items as JobStage[]);

    try {
      await api.post(endpoints[type], {
        [paramKeys[type]]: items.map((item) => item.id),
      });
      toast({ title: "Order saved", description: "Position order has been updated" });
    } catch (error) {
      console.error("Failed to reorder:", error);
      toast({ title: "Error", description: "Failed to save order", variant: "destructive" });
      // Reload on error to restore correct state
      loadData();
    }
  };

  const getDialogTitle = () => {
    const action = editingItem ? "Edit" : "Add";
    switch (dialogType) {
      case "type":
        return `${action} Job Type`;
      case "status":
        return `${action} Job Status`;
      case "stage":
        return `${action} Job Stage`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <Tabs value={activeSubTab} onValueChange={handleSubTabChange}>
        <TabsList>
          {JOB_SETUP_SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="mt-6">
          {/* Lists Tab */}
          <TabsContent value="lists" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <SetupTable
                items={jobTypes}
                title="Job Types"
                icon={Briefcase}
                getLabel={(item) => item.name}
                getColor={(item) => item.color}
                getIsActive={(item) => item.active}
                onAdd={() => handleOpenAddDialog("type")}
                onEdit={(item) => handleOpenEditDialog(item, "type")}
                onDelete={(item) => handleDelete(item.id, "type")}
                onReorder={(items) => handleReorder(items, "type")}
                loading={loading}
              />
              <SetupTable
                items={jobStatuses}
                title="Job Statuses"
                icon={ListChecks}
                getLabel={(item) => item.name}
                getColor={(item) => item.color}
                getIsActive={(item) => item.active}
                onAdd={() => handleOpenAddDialog("status")}
                onEdit={(item) => handleOpenEditDialog(item, "status")}
                onDelete={(item) => handleDelete(item.id, "status")}
                onReorder={(items) => handleReorder(items, "status")}
                loading={loading}
              />
              <SetupTable
                items={jobStages}
                title="Job Stages"
                icon={Layers}
                getLabel={(item) => item.name}
                getColor={(item) => item.color}
                getIsActive={(item) => item.active}
                onAdd={() => handleOpenAddDialog("stage")}
                onEdit={(item) => handleOpenEditDialog(item, "stage")}
                onDelete={(item) => handleDelete(item.id, "stage")}
                onReorder={(items) => handleReorder(items, "stage")}
                loading={loading}
              />
            </div>

            {/* Suburbs Section */}
            <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Suburbs Lookup</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {suburbStats.total} suburbs
              </Badge>
              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20">
                {suburbStats.withCouncil} with council
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage suburb data for auto-fill on job addresses
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search suburb or postcode..."
                  value={suburbSearch}
                  onChange={(e) => setSuburbSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full sm:w-32">
              <Select value={suburbStateFilter} onValueChange={setSuburbStateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state} ({suburbStats.byState[state] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select value={suburbCouncilFilter} onValueChange={setSuburbCouncilFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Council" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="with-council">With Council</SelectItem>
                  <SelectItem value="without-council">Without Council</SelectItem>
                  {uniqueCouncils.map((council) => (
                    <SelectItem key={council} value={council}>
                      {council}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Suburbs Table */}
          {suburbsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Spinner size={24} className="text-muted-foreground" />
            </div>
          ) : filteredSuburbs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No suburbs found matching your filters.
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
              <Table className="w-full">
                <TableHeader className="sticky top-0 bg-background border-b">
                  <TableRow className="text-left text-xs text-muted-foreground">
                    <TableHead className="p-2 font-medium">Suburb</TableHead>
                    <TableHead className="p-2 font-medium">Postcode</TableHead>
                    <TableHead className="p-2 font-medium">State</TableHead>
                    <TableHead className="p-2 font-medium">Council</TableHead>
                    <TableHead className="p-2 font-medium w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {filteredSuburbs.slice(0, 100).map((suburb) => (
                    <TableRow key={suburb.id} className="hover:bg-muted/50">
                      <TableCell className="p-2 text-sm font-medium">{suburb.name}</TableCell>
                      <TableCell className="p-2 text-sm text-muted-foreground">{suburb.postcode}</TableCell>
                      <TableCell className="p-2">
                        <Badge variant="outline" className="text-xs">
                          {suburb.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-2 text-sm">
                        {suburb.council ? (
                          <span className="text-green-600 dark:text-green-400">{suburb.council}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditSuburbClick(suburb)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredSuburbs.length > 100 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Showing first 100 of {filteredSuburbs.length} results. Use search to narrow down.
                </p>
              )}
            </div>
          )}
            </CardContent>
            </Card>
          </TabsContent>

          {/* Workflow Tab */}
          <TabsContent value="workflow">
            <WorkflowConfigTab />
          </TabsContent>
        </div>
      </Tabs>

      {/* SSoT: Claim stages are now managed via Schedule Master CLAIM tasks */}
      {/* Navigate to Admin > Schedule Master to configure claim stages */}

      {/* Edit Suburb Dialog */}
      <Dialog open={showSuburbDialog} onOpenChange={setShowSuburbDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Suburb</DialogTitle>
            <DialogDescription>
              Update suburb details. Council is used for auto-fill on job addresses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="suburb-name">Suburb Name</Label>
                <Input
                  id="suburb-name"
                  value={suburbFormData.name}
                  onChange={(e) => setSuburbFormData({ ...suburbFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suburb-postcode">Postcode</Label>
                <Input
                  id="suburb-postcode"
                  value={suburbFormData.postcode}
                  onChange={(e) => setSuburbFormData({ ...suburbFormData, postcode: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suburb-state">State</Label>
              <Select
                value={suburbFormData.state}
                onValueChange={(value) => setSuburbFormData({ ...suburbFormData, state: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suburb-council">Council</Label>
              <Select
                value={suburbFormData.council || "none"}
                onValueChange={(value) => setSuburbFormData({ ...suburbFormData, council: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select council" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Council</SelectItem>
                  {SEQ_COUNCILS.map((council) => (
                    <SelectItem key={council} value={council}>
                      {council}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Or type a custom council name:
              </p>
              <Input
                placeholder="Custom council name"
                value={suburbFormData.council}
                onChange={(e) => setSuburbFormData({ ...suburbFormData, council: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuburbDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSuburb} disabled={suburbSaving}>
              {suburbSaving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>
              Configure the name and color for this item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-transform",
                      formData.color === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-8 p-0 border-0"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#000000"
                  className="w-24 font-mono text-sm"
                />
              </div>
            </div>
            {/* Schedule Master Template - only for job types */}
            {dialogType === "type" && scheduleTemplates.length > 0 && (
              <div className="space-y-2">
                <Label>Schedule Master Template</Label>
                <Select
                  value={formData.sm_schedule_master_template_id?.toString() || "none"}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    sm_schedule_master_template_id: value === "none" ? null : parseInt(value, 10)
                  })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">No Template</SelectItem>
                    {scheduleTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Default Schedule Master template for jobs of this type
                </p>
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
              ) : editingItem ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
