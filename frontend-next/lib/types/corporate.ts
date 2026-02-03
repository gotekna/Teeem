/**
 * Corporate Entity Types - SSoT for Corporate Company Data
 *
 * These types are used across corporate pages and tab components.
 * Extracted from the corporate company page for reusability.
 */

export interface Director {
  id: number;
  contact_id?: number;
  contact?: {
    id: number;
    display_name: string;
    email?: string;
    mobile_phone?: string;
  };
  formatted_position?: string;
  appointment_date?: string;
  cessation_date?: string;
}

export interface ComplianceItem {
  id: number;
  name: string;
  due_date?: string;
  status: string;
}

export interface Shareholding {
  id: number;
  shareholder_type: string;
  shareholder_id: number;
  shareholder_name: string;
  number_of_shares: number;
  percentage: number;
  share_class?: string;
  beneficially_held?: boolean;
  beneficial_owner?: string;
  acquisition_date?: string;
  disposal_date?: string;
  certificate_number?: string;
  consideration_paid?: number;
}

export interface BankAccount {
  id: number;
  institution_name: string;
  bsb?: string;
  account_number: string;
  account_name?: string;
  bank_code?: string;
  xero_account_id?: string;
  status: "active" | "closed";
  date_opened?: string;
  date_closed?: string;
  display_name: string;
  formatted_bsb?: string;
  masked_account_number?: string;
  linked_to_xero?: boolean;
  last_transaction_date?: string;
}

export interface Corporate {
  id: number;
  name: string;
  previous_names?: string;
  business_names?: string;
  slug?: string;
  code?: string;
  acn?: string;
  abn?: string;
  tfn?: string;
  entity_type?: string;
  contact_id?: number;
  contact?: {
    abn?: string;
    abn_valid?: boolean;
    abn_entity_name?: string;
  };
  status?: string;
  date_incorporated?: string;
  purpose?: string;
  is_trustee?: boolean;
  trust_name?: string;
  registered_office_address?: string;
  principal_place_of_business?: string;
  gst_registration_status?: string;
  accounting_method?: string;
  shares_on_issue?: number;
  carry_forward_losses?: number;
  franking_balance?: number;
  amount_owing?: number;
  review_date?: string;
  formatted_acn?: string;
  formatted_abn?: string;
  has_xero_connection?: boolean;
  sharepoint_folder_url?: string;
  storage_folder_url?: string;
  current_directors?: Director[];
  pending_compliance_items?: ComplianceItem[];
  company_group?: string | { id: number; name: string; code?: string };
  company_group_id?: number;
  group_name?: string;
  parent_company_id?: number;
  parent_company?: { id: number; name: string };
  // Consolidation
  consolidation_parent_id?: number;
  consolidation_parent?: { id: number; name: string };
  has_consolidated_children?: boolean;
  // Corporate details
  corporate_key?: string;
  asic_username?: string;
  has_asic_password?: boolean;
  recovery_question?: string;
  has_recovery_answer?: boolean;
  bank_name?: string;
  bank_bsb?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  bank_start_date?: string;
  bank_end_date?: string;
  corporate_xero_connection?: {
    id: number;
    connection_status: string;
    xero_tenant_name: string;
    xero_tenant_id?: string;
    last_sync_at?: string;
  };
}

/**
 * Trust roles member (beneficiary/appointor)
 */
export interface TrustRolesMember {
  membership_id: number;
  contact_id: number;
  contact_name: string;
  contact_email?: string;
  contact_entity_type?: string;
  membership_type: string;
  beneficiary_type?: "named" | "class" | "default";
  class_description?: string;
  can_view_confidential: boolean;
  is_active: boolean;
}

/**
 * Trust roles data (trustee, beneficiaries, appointors)
 */
export interface TrustRolesData {
  trust: {
    id: number;
    name: string;
    entity_type: string;
    status: string;
    company_group_id: number;
    date_incorporated?: string;
  } | null;
  corporate_trustee: {
    id: number;
    name: string;
    code?: string;
    acn?: string;
    is_trustee: boolean;
    trust_name?: string;
  } | null;
  beneficiaries: TrustRolesMember[];
  appointors: TrustRolesMember[];
  contact_relationships: {
    id: number;
    contact_id: number;
    contact_name: string;
    related_contact_id: number;
    related_contact_name: string;
    relationship_type: string;
    ownership_percentage?: number;
    start_date?: string;
    end_date?: string;
    is_current: boolean;
  }[];
}

/**
 * Officer record for directors/secretaries
 */
export interface OfficerRecord {
  id: number;
  position: string;
  formatted_position: string;
  appointment_date: string;
  resignation_date?: string;
  is_current: boolean;
  notes?: string;
  contact: {
    id: number;
    display_name: string;
    email?: string;
    mobile_phone?: string;
  };
}

/**
 * Props for corporate tab components
 * Extends TabComponentProps with corporate-specific data
 */
export interface CorporateTabProps {
  companyId: string;
  company: Corporate;
  onUpdate?: () => void;
  onRefresh?: () => Promise<void>;
}
