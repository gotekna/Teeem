"use client";

export type GanttRange = "daily" | "monthly" | "quarterly";

export type GanttStatus = {
  id: string;
  name: string;
  color: string;
};

// Dependency types:
// - finish-to-start (FS): Task B can't start until Task A finishes (most common)
// - start-to-start (SS): Task B can't start until Task A starts
// - finish-to-finish (FF): Task B can't finish until Task A finishes
// - start-to-finish (SF): Task B can't finish until Task A starts (rare)
export type DependencyType = "FS" | "SS" | "FF" | "SF";

// Lock types - prevent automatic cascading of date changes
// - supplierConfirmed: Supplier committed to this date (strongest lock)
// - started: Task already in progress
// - manuallyPositioned: User explicitly locked this task in place
export type LockType = "supplierConfirmed" | "started" | "manuallyPositioned";

// Hold reasons - why a job is placed on hold
export type HoldReason =
  | "whs_incident"      // WHS/Safety incident
  | "weather"           // Weather delay
  | "permit_delay"      // Awaiting permits
  | "client_request"    // Client requested pause
  | "material_delay"    // Materials not available
  | "subcontractor"     // Subcontractor issues
  | "other";            // Other reason

export type HoldReasonConfig = {
  id: HoldReason;
  label: string;
  description?: string;
};

export const holdReasons: HoldReasonConfig[] = [
  { id: "whs_incident", label: "WHS Incident", description: "Safety incident requiring investigation" },
  { id: "weather", label: "Weather Delay", description: "Adverse weather conditions" },
  { id: "permit_delay", label: "Permit Delay", description: "Awaiting council/authority approval" },
  { id: "client_request", label: "Client Request", description: "Client has requested a pause" },
  { id: "material_delay", label: "Material Delay", description: "Materials not yet available" },
  { id: "subcontractor", label: "Subcontractor Issue", description: "Subcontractor unavailable or delayed" },
  { id: "other", label: "Other", description: "Other reason" },
];

// Hold state for a job
export type HoldState = {
  isOnHold: boolean;
  reason?: HoldReason;
  notes?: string;
  heldAt?: Date;
  heldBy?: string;
};

export type GanttDependency = {
  id: string;
  fromId: string;  // Source task ID (predecessor)
  toId: string;    // Target task ID (successor)
  type: DependencyType;
  lag?: number;    // Lag time in working days (positive = delay, negative = lead)
};

export type GanttFeature = {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date;
  status: GanttStatus;
  progress?: number;
  dependencies?: string[];  // Array of task IDs this task depends on (finish-to-start by default)
  lock?: LockType;  // If set, task is locked and will block cascading
};

export type GanttMarker = {
  id: string;
  date: Date;
  label: string;
  color?: string;
};

export type GanttGroup = {
  id: string;
  name: string;
  features: GanttFeature[];
};

// Using design system status colors from globals.css
export const defaultStatuses: GanttStatus[] = [
  { id: "not-started", name: "Not Started", color: "bg-secondary text-secondary-foreground" },
  { id: "in-progress", name: "In Progress", color: "bg-status-info text-status-info-foreground" },
  { id: "completed", name: "Completed", color: "bg-status-success text-status-success-foreground" },
  { id: "on-hold", name: "On Hold", color: "bg-status-warning text-status-warning-foreground" },
  { id: "at-risk", name: "At Risk", color: "bg-status-error text-status-error-foreground" },
];
