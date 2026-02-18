// SSoT: Job and related type definitions
// Import from @/lib/types - NEVER define locally

export interface JobType {
  id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  position?: number;
  is_active?: boolean;
  sm_schedule_master_template_id?: number | null;
  schedule_template_summary?: {
    template_id: number;
    template_name: string;
    version_id: number | null;
    version_number: number | null;
    row_count: number;
  } | null;
}

export interface JobStatus {
  id: number;
  name: string;
  color?: string;
  position?: number;
  is_active?: boolean;
}

export interface JobStage {
  id: number;
  name: string;
  color?: string;
  position?: number;
  is_active?: boolean;
}

export interface Job {
  id: number;
  name: string;
  title?: string;
  job_code?: string;
  job_number?: string;

  // Client & Contacts
  client_name?: string;
  contacts?: Array<{
    id?: number;
    contact_id?: number;
    name?: string;
    display_name?: string;
    company?: string;
    is_primary?: boolean;
    role?: string;
    contact?: { id?: number; display_name?: string; [key: string]: unknown };
    [key: string]: unknown;
  }>;
  employee_names?: string;
  matched_contact?: { id: number; name?: string; display_name?: string; [key: string]: unknown };

  // Status & Stage
  status?: string;
  stage?: string;
  job_type?: JobType;
  job_type_id?: number;
  job_status?: JobStatus;
  job_status_id?: number;
  job_stage?: JobStage;
  job_stage_id?: number;

  // Financial
  contract_value?: number;
  contract_price?: number;
  live_profit?: number;
  profit_percentage?: number;
  deposit?: number;
  prime_cost?: number;
  provisional_sums?: number;
  external_sales_fee?: number;
  prime_cost_details?: string;
  provisional_sums_details?: string;

  // Contract Details
  has_special_conditions?: boolean;
  special_conditions?: string;
  construction_days?: number;
  liquidated_damages?: number;
  certification_by_owner?: boolean;
  finance_approval_required?: boolean;
  finance_approval_date?: string;

  // Certification & Tracking
  certifier_job_no?: string;
  design_name?: string;
  job_design_id?: number | null;
  job_design?: { id: number; name: string; size?: number; frontage_required?: number; description?: string; is_active?: boolean } | null;
  xero_tracking_option_id?: string;
  xero_tracking_option_name?: string;
  plan_number?: string;

  // Location & Address
  location?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  lot_number?: string;
  street_number?: string;
  street_name?: string;
  street_type?: string;
  suburb?: string;
  postcode?: string;
  state?: string;
  council?: string;

  // Site Supervisor
  site_supervisor_name?: string;
  site_supervisor_email?: string;
  site_supervisor_phone?: string;

  // Dates
  start_date?: string;
  contract_date?: string;
  plan_date?: string;
  spec_date?: string;
  practical_completion_date?: string;
  warranty_end_date?: string;
  arrived_at?: string;
  completed_at?: string;

  // Build Schedule
  build_period?: string;
  stage_slab?: string;
  stage_frame?: string;
  stage_enclosed?: string;
  stage_fixing?: string;
  stage_practical?: string;
  stage_weather?: string;
  weekend_work?: string;

  // Construction
  level?: string;
  dwelling_type?: string;

  // Portal/Inventory
  po_number?: string;
  total?: number;
  is_arrived?: boolean;
  is_completed?: boolean;
  days_on_site?: number;
  invoice_status?: string;

  // Storage
  storage_folder_status?: "not_requested" | "pending" | "processing" | "completed" | "failed";

  // Estimator
  estimator_analysis?: string;

  // Timestamps
  created_at?: string;
  updated_at?: string;

}
