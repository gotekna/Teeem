export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "contract_sent"
  | "won"
  | "lost";

export type LeadSource =
  | "referral"
  | "website"
  | "advertisement"
  | "social_media"
  | "cold_call"
  | "repeat_client"
  | "other";

export type ProjectType =
  | "new_dwelling"
  | "renovation"
  | "extension"
  | "demolition_rebuild"
  | "other";

export type DwellingType =
  | "detached_house"
  | "townhouse"
  | "duplex"
  | "unit"
  | "granny_flat";

export interface Lead {
  id: number;
  lead_number: string;

  // Basic Info
  title: string;
  status: LeadStatus;
  source?: LeadSource;

  // Contact
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_company?: string;

  // Site Address
  site_address: string;
  site_suburb: string;
  site_state: string;
  site_postcode: string;
  lot_plan_number?: string;

  // Building Details
  project_type: ProjectType;
  dwelling_type?: DwellingType;
  number_of_storeys?: number;
  estimated_floor_area?: number;

  // Financial
  estimated_value: number;

  // Timeline & Notes
  expected_start_date?: string;
  decision_timeline?: string;
  notes?: string;

  // Relationships
  job_id?: number;
  contract_id?: number;

  // Audit
  created_at: string;
  updated_at: string;
}

export const LEAD_STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; color: string; bgColor: string }
> = {
  new: {
    label: "Priced Up",
    color: "text-gray-700 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  contacted: {
    label: "Contacted",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  qualified: {
    label: "Qualified",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  proposal: {
    label: "Proposal",
    color: "text-yellow-700 dark:text-yellow-300",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  contract_sent: {
    label: "Contract Sent",
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  won: {
    label: "Won",
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  lost: {
    label: "Lost",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  new_dwelling: "New Dwelling",
  renovation: "Renovation",
  extension: "Extension",
  demolition_rebuild: "Demolition & Rebuild",
  other: "Other",
};

export const DWELLING_TYPE_LABELS: Record<DwellingType, string> = {
  detached_house: "Detached House",
  townhouse: "Townhouse",
  duplex: "Duplex",
  unit: "Unit",
  granny_flat: "Granny Flat",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  referral: "Referral",
  website: "Website",
  advertisement: "Advertisement",
  social_media: "Social Media",
  cold_call: "Cold Call",
  repeat_client: "Repeat Client",
  other: "Other",
};

// Pipeline Job - Job with Enquiry status displayed in pipeline view
export interface PipelineJob {
  id: number;
  title: string;
  location?: string;
  contract_value: number;
  job_type?: string;
  job_status?: string;
  job_stage?: string;
  job_stage_id?: number;
  client_name?: string;
  client_email?: string;
  client_company?: string;
  created_at: string;
  updated_at: string;
}

// Pipeline stage names (match backend JobStage names for Enquiry status)
export type PipelineStage =
  | "needs_pricing"
  | "needs_drafting"
  | "priced_up"
  | "contacted"
  | "qualified"
  | "contract_sent"
  | "won"
  | "lost";

// Config for pipeline stages (similar to lead status config)
export const PIPELINE_STAGE_CONFIG: Record<
  PipelineStage,
  { label: string; color: string; bgColor: string }
> = {
  needs_pricing: {
    label: "Needs Pricing",
    color: "text-yellow-700 dark:text-yellow-300",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  needs_drafting: {
    label: "Needs Drafting",
    color: "text-pink-700 dark:text-pink-300",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
  },
  priced_up: {
    label: "Priced Up",
    color: "text-gray-700 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  contacted: {
    label: "Contacted",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  qualified: {
    label: "Qualified",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  contract_sent: {
    label: "Contract Sent",
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  won: {
    label: "Won",
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  lost: {
    label: "Lost",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
};
