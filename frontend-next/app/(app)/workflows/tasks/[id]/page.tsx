"use client";

/**
 * Workflow Task Detail Page
 *
 * Universal page for completing BPMN user tasks. Fetches the task's form_schema,
 * looks up the form component from the task form registry, and renders it.
 *
 * URL: /workflows/tasks/[id]
 */

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getFormComponent, type TaskFormProps } from "@/lib/workflow-task-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { BackButton } from "@/components/ui/back-button";
import { AlertCircle, CheckCircle, Pen, Workflow } from "lucide-react";
import { WorkflowProgress } from "@/components/workflows/WorkflowProgress";

interface TaskDetail {
  id: number;
  node_name: string;
  task_type: string;
  status: string;
  process_id: number;
  process_name: string;
  instance_id: number;
  subject_type: string;
  subject_id: number;
  subject_name: string;
  assigned_to_name: string | null;
  due_date: string | null;
  is_overdue: boolean;
  form_schema: Record<string, unknown> | null;
  form_data: Record<string, unknown> | null;
  process_variables: Record<string, unknown>;
  subject: { id: number; type: string; name: string };
  completed_at: string | null;
  created_at: string;
}

export default function WorkflowTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.id as string;

  const queryClient = useQueryClient();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [workflowProcessing, setWorkflowProcessing] = useState(false);

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: boolean; task: TaskDetail }>(
        `/api/v1/bpmn_tasks/${taskId}`
      );
      if (res.success) {
        setTask(res.task);
        if (res.task.status === "completed") setCompleted(true);
      } else {
        setError("Failed to load task");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleComplete = useCallback(
    async (formData: Record<string, unknown>) => {
      if (!task) return;
      setCompleting(true);
      setError(null);
      try {
        const res = await api.post<{ success: boolean; error?: string }>(
          `/api/v1/bpmn_tasks/${task.id}/complete`,
          { form_data: formData }
        );
        if (res?.success) {
          // Show processing state while background jobs execute (PDF generation, e-signature creation)
          setWorkflowProcessing(true);

          // Poll process variables until esign_result appears (background job creates it)
          const maxAttempts = 40; // 40 * 3s = 2 min max wait
          let esignRequestId: number | null = null;

          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, 3000));
            try {
              const pollRes = await api.get<{ success: boolean; task: TaskDetail }>(
                `/api/v1/bpmn_tasks/${task.id}`
              );
              if (pollRes?.success) {
                const vars = pollRes.task.process_variables || {};
                const esignResult = vars.esign_result as { request_id?: number } | undefined;
                if (esignResult?.request_id) {
                  esignRequestId = esignResult.request_id;
                  break;
                }
              }
            } catch {
              // Ignore poll errors, keep trying
            }
          }

          setWorkflowProcessing(false);
          queryClient.invalidateQueries({ queryKey: ["e-signature-requests"] });

          if (esignRequestId) {
            // Auto-navigate to the specific e-signature request
            router.push(`/e-signature/${esignRequestId}`);
          } else {
            // Fallback: show completion page if polling timed out
            setCompleted(true);
          }
        } else {
          setError(res?.error || "Failed to complete task");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to complete task");
      } finally {
        setCompleting(false);
      }
    },
    [task, queryClient, router]
  );

  const handleCancel = useCallback(() => {
    router.push("/workflows");
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="p-6 space-y-4">
        <BackButton fallbackHref="/workflows" label="Back to Workflows" />
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">Error loading task</p>
            <p className="text-muted-foreground mt-1">{error}</p>
            <Button variant="outline" onClick={fetchTask} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!task) return null;

  // Processing state - polling while background jobs run
  if (workflowProcessing) {
    return (
      <div className="p-6 space-y-4">
        <BackButton fallbackHref="/workflows" label="Back to Workflows" />
        <Card>
          <CardContent className="py-12 text-center">
            <Spinner className="h-10 w-10 mx-auto mb-4" />
            <p className="text-lg font-medium">Processing Workflow...</p>
            <p className="text-muted-foreground mt-1">
              Generating documents and preparing for e-signature. This may take up to a minute.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              You&apos;ll be redirected automatically when ready.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completed state
  if (completed) {
    return (
      <div className="p-6 space-y-4">
        <BackButton fallbackHref="/workflows" label="Back to Workflows" />
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">Task Completed</p>
            <p className="text-muted-foreground mt-1">
              {task.node_name} for {task.subject_name} has been completed.
              The workflow will continue automatically.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <Button variant="outline" onClick={() => router.push("/workflows")}>
                View Workflows
              </Button>
              {task.subject_type === "Corporate" && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/corporate/companies/${task.subject_id}`)}
                >
                  View Company
                </Button>
              )}
              <Button onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["e-signature-requests"] });
                router.push("/e-signature");
              }}>
                <Pen className="w-4 h-4 mr-1.5" />
                E-Signature
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Look up form component from registry
  const formType = (task.form_schema?.form_type as string) || "";
  const FormComponent = formType ? getFormComponent(formType) : null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/workflows" label="Back to Workflows" />
      </div>

      {/* Task header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                <Workflow className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg">{task.node_name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {task.process_name} &bull; {task.subject_name}
                </p>
              </div>
            </div>
            <Badge
              variant={
                task.is_overdue
                  ? "destructive"
                  : task.status === "pending"
                  ? "outline"
                  : "secondary"
              }
            >
              {task.is_overdue ? "Overdue" : task.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Form content */}
      {FormComponent ? (
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <Spinner className="h-8 w-8" />
            </div>
          }
        >
          <FormComponent
            taskId={task.id}
            formSchema={task.form_schema || {}}
            formData={task.form_data || {}}
            processVariables={task.process_variables || {}}
            subject={task.subject}
            onComplete={handleComplete}
            onCancel={handleCancel}
          />
        </Suspense>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <p className="text-lg font-medium">No form configured</p>
            <p className="text-muted-foreground mt-1">
              {formType
                ? `Form type "${formType}" is not registered in the task form registry.`
                : "This task does not have a form_type configured."}
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                onClick={() => handleComplete({})}
                disabled={completing}
              >
                {completing ? <Spinner className="h-4 w-4 mr-2" /> : null}
                Complete Without Form
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
