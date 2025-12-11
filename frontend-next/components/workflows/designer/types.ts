// BPMN Types for the visual designer

export type BpmnNodeType =
  | "start_event"
  | "end_event"
  | "user_task"
  | "service_task"
  | "exclusive_gateway"
  | "parallel_gateway"
  | "timer_event"
  | "data_store_reference"
  | "intermediate_event"
  | "sub_process"
  | "annotation"
  | "pool"
  | "lane";

export interface BpmnNodeConfig {
  // User task config
  assignee_type?: "user" | "role" | "variable" | "subject_field";
  assignee_value?: string;
  form_schema?: Record<string, unknown>;
  due_days?: number;

  // Service task config
  task_type?: string;
  template_id?: number;
  output_destination?: "job_documents" | "sharepoint" | "email_attachment";
  recipient_type?: string;
  recipient_value?: string;
  subject?: string;
  body?: string;
  updates?: Record<string, unknown>;
  variables?: Record<string, unknown>;

  // Timer config
  duration?: string;

  // Gateway config
  default_edge_key?: string;

  // Intermediate event config
  eventType?: "message" | "timer" | "signal" | "conditional";
  isThrowing?: boolean;

  // Sub-process config
  isExpanded?: boolean;
}

export interface BpmnNodeData extends Record<string, unknown> {
  nodeKey: string;
  nodeType: BpmnNodeType;
  name: string;
  description?: string;
  config: BpmnNodeConfig;
}

export interface BpmnEdgeData extends Record<string, unknown> {
  edgeKey: string;
  name?: string;
  conditionExpression?: string;
  isDefault?: boolean;
}

export interface BpmnTrigger {
  id?: number;
  triggerType: "manual" | "status_change" | "scheduled" | "field_change";
  name: string;
  isActive: boolean;
  config: Record<string, unknown>;
}

export interface BpmnProcess {
  id?: number;
  name: string;
  description?: string;
  isPublished: boolean;
  publishedAt?: string;
  version?: number;
  canvasData: {
    viewport?: { x: number; y: number; zoom: number };
  };
  nodes: Array<BpmnNodeData & { id: string; position: { x: number; y: number } }>;
  edges: Array<BpmnEdgeData & { id: string; source: string; target: string }>;
  triggers: BpmnTrigger[];
  createdAt?: string;
  updatedAt?: string;
}

// Service task types available
export const SERVICE_TASK_TYPES = [
  { value: "send_email", label: "Send Email", icon: "mail" },
  { value: "update_record", label: "Update Record", icon: "database" },
  { value: "set_variable", label: "Set Variable", icon: "variable" },
  { value: "generate_document", label: "Generate Document", icon: "file-text" },
  { value: "create_xero_invoice", label: "Create Xero Invoice", icon: "receipt" },
  { value: "call_webhook", label: "Call Webhook", icon: "globe" },
] as const;

// Node type metadata
export const NODE_TYPE_META: Record<
  BpmnNodeType,
  { label: string; icon: string; color: string; description: string }
> = {
  start_event: {
    label: "Start Event",
    icon: "play",
    color: "green",
    description: "Beginning of the workflow",
  },
  end_event: {
    label: "End Event",
    icon: "square",
    color: "red",
    description: "Completion of the workflow",
  },
  user_task: {
    label: "User Task",
    icon: "user",
    color: "blue",
    description: "Manual task assigned to a user",
  },
  service_task: {
    label: "Service Task",
    icon: "cog",
    color: "purple",
    description: "Automated task execution",
  },
  exclusive_gateway: {
    label: "Exclusive Gateway",
    icon: "git-branch",
    color: "amber",
    description: "Decision point - one path",
  },
  parallel_gateway: {
    label: "Parallel Gateway",
    icon: "git-merge",
    color: "emerald",
    description: "Split/join parallel paths",
  },
  timer_event: {
    label: "Timer Event",
    icon: "clock",
    color: "cyan",
    description: "Wait for time duration",
  },
  data_store_reference: {
    label: "Data Store",
    icon: "database",
    color: "slate",
    description: "Reference to a data store",
  },
  intermediate_event: {
    label: "Intermediate Event",
    icon: "circle-dot",
    color: "amber",
    description: "Mid-process event (catch/throw)",
  },
  sub_process: {
    label: "Sub-Process",
    icon: "layers",
    color: "indigo",
    description: "Collapsed or expanded sub-workflow",
  },
  annotation: {
    label: "Annotation",
    icon: "sticky-note",
    color: "yellow",
    description: "Comment or note",
  },
  pool: {
    label: "Pool",
    icon: "users",
    color: "teal",
    description: "Swimlane container for participants",
  },
  lane: {
    label: "Lane",
    icon: "user",
    color: "sky",
    description: "Swimlane row for a role",
  },
};
