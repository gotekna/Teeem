"use client";

import { useState, useEffect } from "react";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";

// Types
interface WorkflowStep {
  name: string;
  label: string;
  assignee_value: string;
}

interface WorkflowConfig {
  steps?: WorkflowStep[];
}

interface WorkflowDefinition {
  id: number;
  name: string;
  description?: string;
  workflow_type: string;
  active: boolean;
  config?: WorkflowConfig;
}

export default function WorkflowAdminPage() {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<{
        success: boolean;
        workflow_definitions: WorkflowDefinition[];
      }>("/api/v1/workflow_definitions");

      if (response?.success) {
        setWorkflows(response.workflow_definitions || []);
      } else {
        setError("Failed to load workflows");
      }
    } catch (err) {
      console.error("Failed to load workflows:", err);
      setError("Failed to load workflows");
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    toast({
      title: "Coming soon",
      description: "Workflow editor will be available soon",
    });
  };

  const handleEdit = (workflow: WorkflowDefinition) => {
    toast({
      title: "Coming soon",
      description: `Edit workflow "${workflow.name}" will be available soon`,
    });
  };

  const handleDelete = async (workflow: WorkflowDefinition) => {
    if (!confirm(`Are you sure you want to delete "${workflow.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await api.delete<{ success: boolean; error?: string }>(
        `/api/v1/workflow_definitions/${workflow.id}`
      );

      if (response?.success) {
        toast({ title: "Workflow deleted successfully" });
        loadWorkflows();
      } else {
        toast({
          title: "Error",
          description: response?.error || "Failed to delete workflow",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Failed to delete workflow:", err);
      toast({
        title: "Error",
        description: "Failed to delete workflow",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (workflow: WorkflowDefinition) => {
    try {
      const response = await api.patch<{ success: boolean; error?: string }>(
        `/api/v1/workflow_definitions/${workflow.id}`,
        {
          workflow_definition: {
            active: !workflow.active,
          },
        }
      );

      if (response?.success) {
        toast({
          title: `Workflow ${workflow.active ? "deactivated" : "activated"}`,
        });
        loadWorkflows();
      } else {
        toast({
          title: "Error",
          description: response?.error || "Failed to update workflow",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Failed to update workflow:", err);
      toast({
        title: "Error",
        description: "Failed to update workflow",
        variant: "destructive",
      });
    }
  };

  const getWorkflowTypeLabel = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/4 rounded bg-muted"></div>
          <div className="space-y-3">
            <div className="h-32 rounded bg-muted"></div>
            <div className="h-32 rounded bg-muted"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflow Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage approval workflows for your organization
          </p>
        </div>
        <Button onClick={handleNew}>
          <PlusIcon className="mr-2 h-5 w-5" />
          New Workflow
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Workflow Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {workflows.map((workflow) => (
          <Card key={workflow.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-medium">{workflow.name}</h3>
                    {workflow.active ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircleIcon className="mr-1 h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircleIcon className="mr-1 h-3 w-3" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p>
                  <Badge variant="outline" className="mt-2">
                    {getWorkflowTypeLabel(workflow.workflow_type)}
                  </Badge>
                </div>
              </div>

              {/* Steps Preview */}
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Steps ({workflow.config?.steps?.length || 0})
                </p>
                <div className="mt-2 space-y-2">
                  {(workflow.config?.steps || []).slice(0, 3).map((step, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <span className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {index + 1}
                      </span>
                      <span>{step.label || step.name}</span>
                      <span className="mx-2 text-muted-foreground">→</span>
                      <span className="text-xs text-muted-foreground">{step.assignee_value}</span>
                    </div>
                  ))}
                  {(workflow.config?.steps?.length || 0) > 3 && (
                    <p className="ml-8 text-xs text-muted-foreground">
                      + {(workflow.config?.steps?.length || 0) - 3} more steps
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => handleEdit(workflow)}>
                  <PencilIcon className="mr-1.5 h-4 w-4" />
                  Edit
                </Button>

                <Button variant="outline" size="sm" onClick={() => handleToggleActive(workflow)}>
                  {workflow.active ? "Deactivate" : "Activate"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(workflow)}
                  className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <TrashIcon className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {workflows.length === 0 && !error && (
        <div className="py-12 text-center text-muted-foreground">
          No workflows defined yet. Click "New Workflow" to create one.
        </div>
      )}
    </div>
  );
}
