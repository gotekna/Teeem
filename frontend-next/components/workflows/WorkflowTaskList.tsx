"use client";

import { useState, useEffect } from "react";
import {
  ClockIcon,
  DocumentTextIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

interface WorkflowSubject {
  construction_id?: number;
}

interface WorkflowDefinition {
  name: string;
  workflow_type: string;
}

interface WorkflowInstance {
  subject_type: string;
  subject_id: number;
  subject: WorkflowSubject;
  workflow_definition: WorkflowDefinition;
}

interface WorkflowTask {
  id: number;
  step_name: string;
  status: string;
  created_at: string;
  data?: {
    description?: string;
  };
  workflow_instance: WorkflowInstance;
}

export default function WorkflowTaskList() {
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<{
        success: boolean;
        workflow_steps: WorkflowTask[];
      }>("/api/v1/workflow_steps");

      if (response.success) {
        setTasks(response.workflow_steps || []);
      } else {
        setError("Failed to load workflow tasks");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load workflow tasks");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskClick = (task: WorkflowTask) => {
    // Navigate to the appropriate page based on subject type
    const subjectType = task.workflow_instance?.subject_type;
    const subjectId = task.workflow_instance?.subject_id;

    if (subjectType === "PurchaseOrder") {
      router.push(
        `/jobs/${task.workflow_instance.subject.construction_id}/purchase-orders/${subjectId}`
      );
    } else if (subjectType === "Construction") {
      router.push(`/jobs/${subjectId}`);
    } else if (subjectType === "Estimate") {
      router.push(
        `/jobs/${task.workflow_instance.subject.construction_id}/estimates/${subjectId}`
      );
    }
  };

  const getStepLabel = (stepName: string): string => {
    return stepName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getWorkflowTypeBadge = (workflowType: string): string => {
    const colors: Record<string, string> = {
      purchase_order_approval: "bg-blue-100 text-blue-800",
      job_approval: "bg-green-100 text-green-800",
      estimate_review: "bg-purple-100 text-purple-800",
      quote_approval: "bg-indigo-100 text-indigo-800",
      contract_approval: "bg-pink-100 text-pink-800",
      document_approval: "bg-yellow-100 text-yellow-800",
      change_order_approval: "bg-orange-100 text-orange-800",
      invoice_approval: "bg-teal-100 text-teal-800",
    };

    return colors[workflowType] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <ClockIcon className="h-5 w-5 mr-2 text-gray-400" />
            Pending Approvals
          </h3>
          {tasks.length > 0 && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {tasks.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">No pending approvals</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getWorkflowTypeBadge(
                        task.workflow_instance?.workflow_definition
                          ?.workflow_type
                      )}`}
                    >
                      {task.workflow_instance?.workflow_definition?.name}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-gray-900">
                    {getStepLabel(task.step_name)}
                  </p>

                  {task.data?.description && (
                    <p className="mt-1 text-sm text-gray-500">
                      {task.data.description}
                    </p>
                  )}

                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span className="flex items-center">
                      <DocumentTextIcon className="h-4 w-4 mr-1" />
                      {task.workflow_instance?.subject_type}
                    </span>
                    <span>
                      Created{" "}
                      {new Date(task.created_at).toLocaleDateString("en-AU")}
                    </span>
                  </div>
                </div>

                <div className="ml-4 flex-shrink-0">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {task.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
