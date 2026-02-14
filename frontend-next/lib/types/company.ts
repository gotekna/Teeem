// SSoT: Company and CompanyGroup type definitions
// Import from @/lib/types - NEVER define locally

export interface CompanyGroup {
  id: number;
  name: string;
  code?: string;
  description?: string;
  active?: boolean;
  companies_count?: number;
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

  // Integration
  xero_connected?: boolean;

  // Counts
  document_count?: number;

  // Status
  status?: string;

  [key: string]: unknown;
}
