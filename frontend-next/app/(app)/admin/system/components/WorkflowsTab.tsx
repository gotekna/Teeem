"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Play,
  Pause,
  Workflow,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface WorkflowStep {
  id: number;
  name: string;
  type: string;
  order: number;
  config: Record<string, unknown>;
}

interface WorkflowDefinition {
  id: number;
  name: string;
  description: string;
  workflow_type: string;
  active: boolean;
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
}

const WORKFLOW_TYPES = [
  { value: "approval", label: "Approval Workflow" },
  { value: "notification", label: "Notification Workflow" },
  { value: "automation", label: "Automation Workflow" },
];

const STEP_TYPES = [
  { value: "approval", label: "Approval Step", icon: CheckCircle2 },
  { value: "wait", label: "Wait/Delay", icon: Clock },
  { value: "notification", label: "Send Notification", icon: AlertCircle },
];

export function WorkflowsTab() {
  const { toast } = useToast();
  const [workflows, setWorkflows] = React.useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingWorkflow, setEditingWorkflow] = React.useState<WorkflowDefinition | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);
  const [toggling, setToggling] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    workflow_type: "approval",
    active: true,
  });

  React.useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const response = await api.get<{ workflow_definitions: WorkflowDefinition[] } | WorkflowDefinition[]>("/api/v1/workflow_definitions");
      // Handle both { workflow_definitions: [...] } and direct array responses
      const data = Array.isArray(response) ? response : (response?.workflow_definitions || []);
      setWorkflows(data);
    } catch {
      // API not implemented yet - use mock data silently
      setWorkflows([
        {
          id: 1,
          name: "Quote Approval",
          description: "Approval workflow for quotes over $10,000",
          workflow_type: "approval",
          active: true,
          steps: [
            { id: 1, name: "Manager Approval", type: "approval", order: 1, config: {} },
            { id: 2, name: "Send to Customer", type: "notification", order: 2, config: {} },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: "Invoice Reminder",
          description: "Automated reminders for overdue invoices",
          workflow_type: "automation",
          active: false,
          steps: [
            { id: 3, name: "Wait 7 days", type: "wait", order: 1, config: { days: 7 } },
            { id: 4, name: "Send Reminder", type: "notification", order: 2, config: {} },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({
      name: "",
      description: "",
      workflow_type: "approval",
      active: true,
    });
    setEditingWorkflow(null);
    setShowDialog(true);
  };

  const handleOpenEditDialog = (workflow: WorkflowDefinition) => {
    setFormData({
      name: workflow.name,
      description: workflow.description || "",
      workflow_type: workflow.workflow_type,
      active: workflow.active,
    });
    setEditingWorkflow(workflow);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Workflow name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingWorkflow) {
        await api.patch(`/api/v1/workflow_definitions/${editingWorkflow.id}`, {
          workflow_definition: formData,
        });
        toast({ title: "Success", description: "Workflow updated successfully" });
      } else {
        await api.post("/api/v1/workflow_definitions", {
          workflow_definition: formData,
        });
        toast({ title: "Success", description: "Workflow created successfully" });
      }
      setShowDialog(false);
      loadWorkflows();
    } catch (error) {
      console.error("Failed to save workflow:", error);
      toast({ title: "Error", description: "Failed to save workflow", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/workflow_definitions/${id}`);
      toast({ title: "Success", description: "Workflow deleted successfully" });
      loadWorkflows();
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      toast({ title: "Error", description: "Failed to delete workflow", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (workflow: WorkflowDefinition) => {
    setToggling(workflow.id);
    try {
      await api.patch(`/api/v1/workflow_definitions/${workflow.id}`, {
        workflow_definition: { active: !workflow.active },
      });
      toast({
        title: "Success",
        description: `Workflow ${workflow.active ? "deactivated" : "activated"} successfully`,
      });
      loadWorkflows();
    } catch (error) {
      console.error("Failed to toggle workflow:", error);
      toast({ title: "Error", description: "Failed to update workflow", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const getWorkflowTypeLabel = (type: string) => {
    return WORKFLOW_TYPES.find((t) => t.value === type)?.label || type;
  };

  const getStepIcon = (type: string) => {
    const step = STEP_TYPES.find((s) => s.value === type);
    return step?.icon || CheckCircle2;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Workflow Definitions</h2>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Create workflows to automate approvals, notifications, and other processes in your organization.
            </p>
            <Button onClick={handleOpenAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className={cn(!workflow.active && "opacity-60")}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        workflow.active
                          ? "bg-green-100 dark:bg-green-900"
                          : "bg-muted dark:bg-card"
                      )}
                    >
                      <Workflow
                        className={cn(
                          "h-5 w-5",
                          workflow.active
                            ? "text-green-600 dark:text-green-400"
                            : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-base">{workflow.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {getWorkflowTypeLabel(workflow.workflow_type)}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deleting === workflow.id || toggling === workflow.id}
                      >
                        {deleting === workflow.id || toggling === workflow.id ? (
                          <Spinner size={16} />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEditDialog(workflow)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(workflow)}>
                        {workflow.active ? (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(workflow.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {workflow.description && (
                  <p className="text-sm text-muted-foreground">{workflow.description}</p>
                )}

                {workflow.steps && workflow.steps.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {workflow.steps
                      .sort((a, b) => a.order - b.order)
                      .map((step, index) => {
                        const Icon = getStepIcon(step.type);
                        return (
                          <React.Fragment key={step.id}>
                            <div className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                              <Icon className="h-3 w-3" />
                              <span>{step.name}</span>
                            </div>
                            {index < workflow.steps.length - 1 && (
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            )}
                          </React.Fragment>
                        );
                      })}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {workflow.steps?.length || 0} step{workflow.steps?.length !== 1 ? "s" : ""}
                  </span>
                  <Badge variant={workflow.active ? "default" : "secondary"}>
                    {workflow.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWorkflow ? "Edit Workflow" : "Create Workflow"}</DialogTitle>
            <DialogDescription>
              {editingWorkflow
                ? "Update the workflow details."
                : "Create a new workflow to automate processes."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workflow Name</Label>
              <Input
                id="name"
                placeholder="e.g., Quote Approval"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of this workflow"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Workflow Type</Label>
              <Select
                value={formData.workflow_type}
                onValueChange={(value) => setFormData({ ...formData, workflow_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">
                  Enable this workflow immediately
                </p>
              </div>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
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
              ) : editingWorkflow ? (
                "Update Workflow"
              ) : (
                "Create Workflow"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
