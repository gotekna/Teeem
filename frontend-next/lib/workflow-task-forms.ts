/**
 * Workflow Task Form Registry (SSoT)
 *
 * Maps BPMN form_type values to React form components.
 * When a user task has form_schema.form_type, the task detail page
 * looks up the component here and renders it.
 *
 * To add a new workflow form:
 * 1. Create component in components/workflows/forms/
 * 2. Register it here with a lazy import
 * 3. Backend: set form_schema.form_type on the user task node config
 */

import { type ComponentType, lazy } from "react";

export interface TaskFormProps {
  taskId: number;
  formSchema: Record<string, unknown>;
  formData: Record<string, unknown>;
  processVariables: Record<string, unknown>;
  subject: { type: string; id: number; name: string };
  onComplete: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

// SSoT: form_type → React component
const TASK_FORM_REGISTRY: Record<string, ComponentType<TaskFormProps>> = {
  director_change: lazy(
    () => import("@/components/workflows/forms/DirectorChangeForm")
  ),
};

export function getFormComponent(
  formType: string
): ComponentType<TaskFormProps> | null {
  return TASK_FORM_REGISTRY[formType] || null;
}
