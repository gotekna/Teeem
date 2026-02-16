// SSoT: Role type definitions
// Import from @/lib/types - NEVER define locally

export interface Role {
  id: number;
  name: string;
  display_name?: string;
  description?: string;
  users_count?: number;
  tasks_count?: number;
  settings?: {
    default_task_view?: "list" | "board" | "gantt";
  };
  default_task_view?: "list" | "board" | "gantt";
}
