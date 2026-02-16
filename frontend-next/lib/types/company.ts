// SSoT: Company and CompanyGroup type definitions
// Import from @/lib/types - NEVER define locally

export interface CompanyGroup {
  id: number;
  name: string;
  code?: string;
  description?: string;
  active?: boolean;
  companies_count?: number;
  default_registered_office?: string;
  default_principal_place?: string;
  default_accountant?: string;
  default_accountant_contact?: string;
}

export interface Company {
  id: number;
  name: string;
  code?: string;
  acn?: string;
  abn?: string;
  entity_type?: string;
  is_trustee?: boolean;
  trust_name?: string;
  is_trust_of_trustee?: boolean;

  // Contact Information
  address?: string;
  email?: string;
  phone?: string;

  // Ownership
  ownership_percentage?: number;
  shareholders?: unknown[];
  investments?: unknown[];
  children?: Company[];

  // Relationships
  parent_company_id?: number;
  parent_company?: { id: number; name: string };
  company_group_id?: number;
  company_group?: string | { id: number; name: string; code?: string };
  group_name?: string;
  group?: string; // Legacy field, prefer company_group

  // Integration
  xero_connected?: boolean;

  // Counts
  document_count?: number;

  // Status
  status?: string;
  type?: string; // Legacy field, prefer entity_type

  // Storage
  storage_folder_url?: string;

}
