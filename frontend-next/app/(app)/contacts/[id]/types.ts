// Contact Detail Page Types - SSoT for all contact-related interfaces

export interface ContactPerson {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  mobile: string | null;
  role: string | null;
  is_primary: boolean;
  include_in_emails: boolean;
}

export interface ContactGroup {
  id: number;
  name: string;
}

export interface ContactEmail {
  id?: number;
  email: string;
  is_primary: boolean;
  label: string | null;
  position: number;
  _destroy?: boolean;
}

export interface ContactPhone {
  id?: number;
  phone_number: string;
  phone_type: 'mobile' | 'office' | 'fax' | 'home';
  is_primary: boolean;
  label: string | null;
  position: number;
  _destroy?: boolean;
}

export interface ContactAddress {
  id?: number;
  address_type: 'STREET' | 'POBOX' | 'DELIVERY';
  line1: string;
  line2: string | null;
  line3: string | null;
  line4: string | null;
  city: string; // Suburb in Australian context
  region: string; // State
  postal_code: string;
  country: string;
  attention_to: string | null;
  is_primary: boolean;
  _destroy?: boolean;
}

export interface DirectorCompany {
  id: number;
  company_id: number;
  company_name: string;
  position: string;
  appointed_date: string | null;
  resigned_date: string | null;
  is_current: boolean;
}

export interface AdditionalCompany {
  id: number;
  name: string;
  entity_type: string | null;
  relationship_type: string;
  role_in_relationship: string | null;
  ownership_percentage: number | null;
  context: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

// SSoT: Linked Company data for company-type contacts
export interface LinkedCompanyDirector {
  id: number;
  contact_id: number;
  contact_name: string | null;
  position: string;
  formatted_position: string;
  appointment_date: string | null;
  resignation_date: string | null;
  is_current: boolean;
}

export interface LinkedCompanyShareholder {
  id: number;
  shareholder_type: string;
  shareholder_id: number;
  shareholder_name: string | null;
  share_class: string | null;
  number_of_shares: number | null;
  beneficially_held: boolean | null;
  date_acquired: string | null;
}

// SSoT: Bank account data from bank_accounts table
export interface LinkedCompanyBankAccount {
  id: number;
  institution_name: string;
  bsb: string | null;
  account_number: string;
  account_name: string | null;
  bank_code: string | null;
  xero_account_id: string | null;
  status: "active" | "closed";
  display_name: string;
  formatted_bsb: string | null;
  linked_to_xero: boolean;
}

export interface LinkedCompany {
  id: number;
  name: string;
  acn: string | null;
  abn: string | null;
  status: string | null;
  entity_type: string | null;
  is_trustee: boolean;
  trust_name: string | null;
  date_incorporated: string | null;
  registered_office_address: string | null;
  principal_place_of_business: string | null;
  company_group_id: number | null;
  company_group_name: string | null;
  directors: LinkedCompanyDirector[];
  shareholdings: LinkedCompanyShareholder[];
  directors_count: number;
  shareholdings_count: number;
  documents_count: number;
  // SSoT: Bank accounts from bank_accounts table
  bank_accounts?: LinkedCompanyBankAccount[];
  bank_accounts_count?: number;
}

export interface CompanyGroupMembership {
  id: number;
  contact_id: number;
  company_group_id: number;
  company_group_name: string;
  membership_type: string;
  company_id: number | null;
  company_name: string | null;
  can_view_confidential: boolean;
  can_edit: boolean;
  is_active: boolean;
}

// SSoT: Directorship from CompanyDirector table
export interface Directorship {
  id: number;
  company_id: number;
  company_name: string;
  company_acn: string | null;
  company_abn: string | null;
  company_status: string | null;
  company_entity_type: string | null;
  company_group_id: number | null;
  company_group_name: string | null;
  position: string;
  formatted_position: string;
  appointment_date: string | null;
  resignation_date: string | null;
  is_current: boolean;
  din: string | null;
}

// SSoT: Shareholding from CompanyShareholding table
export interface Shareholding {
  id: number;
  company_id: number;
  company_name: string;
  company_acn: string | null;
  company_abn: string | null;
  company_status: string | null;
  company_entity_type: string | null;
  company_group_id: number | null;
  company_group_name: string | null;
  share_class: string | null;
  number_of_shares: number | null;
  percentage_of_total: number | null;
  beneficially_held: boolean | null;
  acquisition_date: string | null;
  disposal_date: string | null;
  consideration_paid: number | null;
}

// SSoT: Trust role (trustee, beneficiary, appointor)
export interface TrustRole {
  id: number;
  role_type: "trustee" | "beneficiary" | "appointor";
  trust_id: number;
  trust_name: string;
  trust_entity_type: string | null;
  ownership_percentage?: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface TrustRolesData {
  trustee_roles: TrustRole[];
  beneficiary_roles: TrustRole[];
  appointor_roles: TrustRole[];
  total_count: number;
}

// Ownership chain for corporate structure visualization
export interface OwnershipNode {
  company_id: number;
  company_name: string;
  percentage: number;
  entity_type?: string;
  is_trustee?: boolean;
  trust_name?: string;
  trust_id?: number;
  trust_entity_type?: string;
  children?: OwnershipNode[];
}

// Email from EmailWarehouse
export interface EmailMessage {
  id: number;
  subject: string | null;
  from_email: string;
  display_from?: string;
  to_emails: string[];
  cc_emails?: string[];
  preview_body?: string;
  received_at: string;
  has_attachments?: boolean;
  attachment_count?: number;
}

export interface EmailsPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

// Case relationship (from case_contacts join)
export interface CaseRelationship {
  id: number;
  case_id: number;
  case_number?: string;
  case_title?: string;
  relationship_type?: string;
  formatted_relationship_type?: string;
  alignment?: 'friendly' | 'opposing' | 'neutral' | null;
  role?: string | null;
  reason?: string | null;
  notes?: string | null;
  is_primary?: boolean;
  added_at?: string | null;
  added_by?: string | null;
}

// Contact relationship for related entities
export interface ContactRelationship {
  id: number;
  source_contact_id: number;
  target_contact_id: number;
  related_contact_id?: number;
  relationship_type: string;
  relationship_type_label?: string;
  direction?: 'outgoing' | 'incoming';
  role_in_relationship?: string | null;
  ownership_percentage?: number | null;
  context?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  notes?: string | null;
  other_contact?: {
    id: number;
    name: string;
    entity_type: string;
    email?: string;
    phone?: string;
    roles?: string[];
  };
  related_contact?: {
    id: number;
    display_name: string;
    email?: string;
    phone?: string;
    roles?: string[];
  };
}

// API response for relationships
export interface RelationshipsResponse {
  success: boolean;
  relationships: {
    outgoing: ContactRelationship[];
    incoming: ContactRelationship[];
  };
}

// Relationship type metadata from API (SSoT)
export interface RelationshipTypeMetadata {
  value: string;
  label: string;
  category: string;
  source_types: string[];
  target_types: string[];
  description: string;
  syncs_to_corporate: boolean;
}

// Main Contact interface
export interface Contact {
  id: number;
  display_name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  office_phone: string | null;
  website: string | null;
  tax_number: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  // Multiple emails, phones, and addresses
  contact_emails?: ContactEmail[];
  contact_phones?: ContactPhone[];
  contact_addresses?: ContactAddress[];
  "is_supplier?": boolean;
  "is_customer?": boolean;
  "is_director?": boolean;
  is_family_member: boolean;
  is_team_contact: boolean;
  xero_contact_id: string | null;
  xero_id?: string | null;
  xero_contact_number?: string | null;
  xero_contact_status?: string | null;
  xero_account_number?: string | null;
  xero_synced?: boolean | null;
  xero_invoice_count?: number | null;
  xero_contact_types: string[];
  sync_with_xero: boolean;
  created_at: string;
  updated_at: string;
  contact_persons: ContactPerson[];
  contact_groups: ContactGroup[];
  jobs_count: number;
  purchase_orders_count: number;
  quotes_count: number;
  // Company/Business fields
  company_name: string | null;
  company_name_or_trust: string | null;
  position: string | null;
  department: string | null;
  // Director details
  director_id: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  birth_state: string | null;
  birth_country: string | null;
  residential_address: string | null;
  drivers_licence: string | null;
  passport_number: string | null;
  photo_url: string | null;
  // Bank details
  bank_bsb: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  // LGAs
  lgas: string[];
  // Entity type for SSoT
  entity_type: string | null;
  // Company/Employee linking
  primary_company_id?: number | null;
  primary_company?: {
    id: number;
    name: string;
    email?: string;
    website?: string;
    address?: string;
    abn?: string;
    acn?: string;
    contact_emails?: ContactEmail[];
    contact_phones?: ContactPhone[];
  } | null;
  employees?: Array<{
    id: number;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    mobile_phone: string | null;
    primary_role: string | null;
  }>;
  // Director companies
  director_companies?: DirectorCompany[];
  // Additional companies via relationships
  additional_companies?: AdditionalCompany[];
  // SSoT permission indicators
  can_view_confidential?: boolean;
  can_view_corporate?: boolean;
  can_edit_corporate?: boolean;
  can_view_cases?: boolean;
  // SSoT: Linked company data for company-type contacts
  linked_company?: LinkedCompany;
  // Financial fields
  accounts_receivable_outstanding?: number | null;
  accounts_receivable_overdue?: number | null;
  accounts_payable_outstanding?: number | null;
  accounts_payable_overdue?: number | null;
  default_discount?: number | null;
  bill_due_day?: number | null;
  bill_due_type?: string | null;
  sales_due_day?: number | null;
  sales_due_type?: string | null;
  // ABN verification fields
  abn_valid?: boolean | null;
  abn_entity_name?: string | null;
  abn_entity_type?: string | null;
  abn_gst_registered?: boolean | null;
  abn_verified_at?: string | null;
}

// Helper function types
export const formatABN = (abn: string | null): string => {
  if (!abn) return "";
  const digits = abn.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
  }
  return abn;
};

export const formatACN = (acn: string | null): string => {
  if (!acn) return "";
  const digits = acn.replace(/\D/g, "");
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  }
  return acn;
};

export const validateABN = (abn: string | null): { isValid: boolean; error?: string } => {
  if (!abn || abn.trim() === "") return { isValid: true };
  const digits = abn.replace(/\D/g, "");
  if (digits.length === 0) return { isValid: true };
  if (digits.length !== 11) {
    return { isValid: false, error: `ABN must be 11 digits (got ${digits.length})` };
  }
  return { isValid: true };
};

export const formatPhoneNumber = (phone: string | null): string => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return "";
  // Mobile: 04XX XXX XXX
  if (digits.length === 10 && digits.startsWith("04")) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  }
  // Landline: 0X XXXX XXXX
  if (digits.length === 10 && digits.startsWith("0")) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;
  }
  // International or other
  if (digits.length >= 8) {
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  }
  return phone;
};

export const validatePhoneNumber = (phone: string | null): { isValid: boolean; error?: string } => {
  if (!phone || phone.trim() === "") return { isValid: true };
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return { isValid: true };
  if (digits.length < 8) {
    return { isValid: false, error: `Phone must be at least 8 digits (got ${digits.length})` };
  }
  if (digits.length > 15) {
    return { isValid: false, error: `Phone must be at most 15 digits (got ${digits.length})` };
  }
  return { isValid: true };
};
