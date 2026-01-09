/**
 * Xero Component Types
 * SSoT for all Xero-related TypeScript types used across components
 */

// Connection status from XeroConnectionHealth service
export interface XeroConnectionStatus {
  connected: boolean;
  // SSoT: Unified status from XeroConnectionHealth service
  display_status?: 'connected' | 'warning' | 'error' | 'disconnected';
  message?: string;
  needs_attention?: boolean;
  action_required?: string;
  xero_tenant_name?: string;
  xero_tenant_id?: string;
  last_sync_at?: string;
  days_since_sync?: number;
  // Legacy fields (for backwards compatibility)
  connection_status?: string;
  last_sync_error?: string;
  token_expires_at?: string;
}

// Tenant statistics from sync_stats endpoint
export interface TenantStats {
  tenant_id: string;
  tenant_name: string;
  status: string;
  contacts: {
    total_links: number;
    pending_review: number;
    last_synced_at: string | null;
  };
  documents: {
    invoices: number;
    bills: number;
    quotes: number;
    total: number;
    last_synced_at: string | null;
  };
  rate_limits: {
    daily_percentage: number;
  } | null;
}

// Setup wizard status from setup_status endpoint
export interface XeroSetupStatus {
  connected: boolean;
  accounts_imported: boolean;
  accounts_count: number;
  bank_accounts_linked: boolean;
  bank_accounts_count: number;
  contacts_synced: boolean;
  contacts_count: number;
  setup_complete: boolean;
}

// Xero tab from SSoT API
export interface XeroTab {
  id: string;
  name: string;
  type: 'functional' | 'document';
  component?: string;
  folderId?: number;
  description?: string;
  group?: string;
  enabled?: boolean;
}

// Chart of Accounts entry
export interface XeroAccount {
  account_id: string;
  code: string;
  name: string;
  type: string;
  class: string;
  status: string;
  tax_type?: string;
  description?: string;
  bank_account_number?: string;
  currency_code?: string;
  reporting_code?: string;
  reporting_code_name?: string;
  system_account?: string;
  enable_payments?: boolean;
  show_in_expense_claims?: boolean;
}

// Xero Report Row (for P&L, Balance Sheet)
export interface XeroReportRow {
  row_type: 'Header' | 'Section' | 'Row' | 'SummaryRow';
  title?: string;
  cells?: { value: string }[];
  depth?: number;
}

// Bank Account from Xero
export interface XeroBankAccount {
  account_id: string;
  name: string;
  code?: string;
  status: string;
  type: string;
  currency_code?: string;
  bank_account_number?: string;
  // Local link info
  local_bank_account_id?: number;
  linked: boolean;
}

// Bank Transaction from Xero
export interface XeroBankTransaction {
  transaction_id: string;
  date: string;
  type: string;
  reference?: string;
  description: string;
  amount: number;
  balance?: number;
  contact_name?: string;
  status: string;
  line_items?: {
    description: string;
    amount: number;
    account_code?: string;
  }[];
}
