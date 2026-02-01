/**
 * PolarisMail Reseller Types
 *
 * TypeScript interfaces for email subscription management.
 * SSoT for all email reseller frontend types.
 */

// ============================================================================
// EMAIL SUBSCRIPTION
// ============================================================================

export type SubscriptionStatus = 'pending' | 'active' | 'suspended' | 'cancelled';

export interface EmailSubscription {
  id: number;
  contact_id: number;
  contact_name: string;
  organization_id: number;
  domain: string;
  status: SubscriptionStatus;
  dns_status?: DnsStatus;
  polaris_account_id: string | null;

  // Billing
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  billing_interval: 'monthly' | 'annual';
  retail_price: number;
  wholesale_cost: number;
  current_period_start: string | null;
  current_period_end: string | null;

  // Counts
  mailbox_count: number;
  total_storage_gb: number;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Computed (from API)
  monthly_retail?: number;
  monthly_wholesale?: number;
  margin?: number;
  margin_percentage?: number;
}

// ============================================================================
// EMAIL MAILBOX
// ============================================================================

export type MailboxType = 'user' | 'shared' | 'resource';
export type MailboxStatus = 'pending' | 'provisioning' | 'active' | 'suspended' | 'deleted' | 'failed';

export interface EmailMailbox {
  id: number;
  email_subscription_id: number;
  email_address: string;
  display_name: string | null;
  mailbox_type: MailboxType;
  status: MailboxStatus;

  // PolarisMail
  polaris_mailbox_id: string | null;

  // Migration source
  source_email: string | null;

  // Storage
  storage_quota_gb: number;
  storage_used_gb: number | null;
  storage_used_percentage?: number;

  // Timestamps
  provisioned_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// EMAIL MIGRATION
// ============================================================================

export type MigrationType = 'full_mailbox' | 'emails_only' | 'calendar_only' | 'contacts_only';
export type MigrationStatus =
  | 'pending'
  | 'queued'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface EmailMigration {
  id: number;
  email_subscription_id: number;
  email_mailbox_id: number;
  source_email: string;
  migration_type: MigrationType;
  status: MigrationStatus;

  // Progress
  progress: number; // 0-100
  processed_items: number;
  total_items: number;
  failed_items: number;
  processed_bytes: number;
  total_bytes: number;

  // Timestamps
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;

  // Error info
  error_message: string | null;

  // Self-service flag
  is_self_service: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Computed (for display)
  subscription_domain?: string;
  contact_name?: string;
  estimated_completion?: string;
}

// ============================================================================
// EMAIL ALIAS
// ============================================================================

export type AliasType = 'alias' | 'catchall';

export interface EmailAlias {
  id: number;
  email_subscription_id: number;
  alias_address: string;
  target_address: string;
  alias_type: AliasType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// EMAIL SUBSCRIPTION INVOICE
// ============================================================================

export type InvoiceStatus = 'pending' | 'invoiced' | 'paid' | 'failed' | 'refunded';

export interface EmailSubscriptionInvoice {
  id: number;
  email_subscription_id: number;
  stripe_invoice_id: string | null;
  billing_period_start: string;
  billing_period_end: string;
  retail_amount: number;
  wholesale_amount: number;
  status: InvoiceStatus;
  created_at: string;

  // Computed
  margin_amount?: number;
  margin_percentage?: number;
}

// ============================================================================
// MIGRATION INVITE
// ============================================================================

export type InviteStatus =
  | 'pending'
  | 'payment_pending'
  | 'payment_complete'
  | 'migrating'
  | 'completed'
  | 'expired'
  | 'cancelled';

export interface EmailMigrationInvite {
  id: number;
  email_subscription_id: number;
  contact_id: number;
  token: string;
  status: InviteStatus;
  total_monthly: number;
  mailboxes_data: {
    email: string;
    type: MailboxType;
    price: number;
  }[];
  expires_at: string;
  view_count: number;
  viewed_at: string | null;
  payment_completed_at: string | null;
  migration_started_at: string | null;
  completed_at: string | null;
  created_at: string;

  // Computed
  portal_url?: string;
  is_expired?: boolean;
}

// ============================================================================
// PROFIT REPORT
// ============================================================================

export interface ProfitReportSummary {
  total_retail: number;
  total_wholesale: number;
  total_margin: number;
  margin_percentage: number;
  subscription_count: number;
  mailbox_count: number;
  invoice_count: number;
}

export interface ProfitReportBySubscription {
  subscription_id: number;
  domain: string;
  contact_name: string;
  mailbox_count: number;
  retail: number;
  wholesale: number;
  margin: number;
  margin_percentage: number;
}

export interface ProfitReport {
  period: {
    start: string;
    end: string;
  };
  summary: ProfitReportSummary;
  by_subscription: ProfitReportBySubscription[];
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export interface EmailResellerDashboardStats {
  active_subscriptions: number;
  total_mailboxes: number;
  monthly_revenue: number;
  margin_percentage: number;
  pending_migrations: number;
  active_migrations: number;
  completed_migrations_today: number;
}

// ============================================================================
// O365 DISCOVERY
// ============================================================================

export interface DiscoveredMailbox {
  email: string;
  display_name: string;
  mailbox_type: MailboxType;
  message_count: number;
  size_bytes: number;
  size_display: string;
}

// ============================================================================
// PRICING
// ============================================================================

export interface EmailPricing {
  user: { wholesale: number; retail: number };
  shared: { wholesale: number; retail: number };
  resource: { wholesale: number; retail: number };
  storage_per_gb: { wholesale: number; retail: number };
  markup_percentage: number;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface EmailSubscriptionsListResponse {
  success: boolean;
  data: EmailSubscription[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface EmailSubscriptionDetailResponse {
  success: boolean;
  data: EmailSubscription & {
    mailboxes: EmailMailbox[];
    aliases: EmailAlias[];
    migrations: EmailMigration[];
    invoices: EmailSubscriptionInvoice[];
  };
}

export interface ProfitReportResponse {
  success: boolean;
  data: ProfitReport;
}

export interface DashboardStatsResponse {
  success: boolean;
  data: EmailResellerDashboardStats;
}

// ============================================================================
// WEBSOCKET EVENTS
// ============================================================================

export type MigrationWebSocketEventType =
  | 'migration_started'
  | 'migration_progress'
  | 'migration_completed'
  | 'migration_failed'
  | 'migration_paused'
  | 'migration_resumed';

export interface MigrationWebSocketEvent {
  type: MigrationWebSocketEventType;
  migration_id: number;
  subscription_id?: number;
  progress?: number;
  processed_items?: number;
  total_items?: number;
  status?: MigrationStatus;
  error_message?: string;
}

// ============================================================================
// FORM DATA
// ============================================================================

export interface CreateSubscriptionData {
  contact_id: number;
  domain: string;
  mailboxes: {
    email: string;
    display_name?: string;
    mailbox_type: MailboxType;
    source_email?: string;
  }[];
  billing_interval?: 'monthly' | 'annual';
  send_invite?: boolean;
}

export interface AddMailboxData {
  email_address: string;
  display_name?: string;
  mailbox_type: MailboxType;
  source_email?: string;
  start_migration?: boolean;
}

// ============================================================================
// DNS RECORDS (Cloudflare Integration)
// ============================================================================

export type DnsRecordType = 'mx' | 'txt' | 'cname';
export type DnsRecordStatus = 'pending' | 'created' | 'verified' | 'error' | 'missing';
export type DnsStatus = 'pending' | 'provisioning' | 'provisioned' | 'verified' | 'missing' | 'error' | 'zone_not_found' | 'not_configured';

export interface EmailDnsRecord {
  id: number;
  record_type: DnsRecordType;
  name: string;
  full_name: string;
  content: string;
  priority: number | null;
  status: DnsRecordStatus;
  purpose: string;
  cloudflare_record_id: string | null;
  error_message: string | null;
  last_verified_at: string | null;
  provisioned_at: string | null;
}

export interface DnsRecordsResponse {
  success: boolean;
  data: {
    dns_status: DnsStatus;
    domain: string;
    records: EmailDnsRecord[];
    cloudflare_configured: boolean;
  };
}

export interface DnsVerifyResponse {
  success: boolean;
  data: {
    status: 'verified' | 'missing' | 'incorrect';
    verified: number;
    missing: number;
    incorrect: number;
    dns_status: DnsStatus;
  };
}

// ============================================================================
// CLOUDFLARE CREDENTIALS
// ============================================================================

export type CloudflareStatus = 'pending' | 'connected' | 'error';

export interface CloudflareCredential {
  id: number;
  account_id: string;
  email: string | null;
  status: CloudflareStatus;
  is_active: boolean;
  last_connected_at: string | null;
  last_error_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  name_servers?: string[];
}

export interface CloudflareCredentialResponse {
  success: boolean;
  data: CloudflareCredential | null;
  configured?: boolean;
}

export interface CloudflareZonesResponse {
  success: boolean;
  data: CloudflareZone[];
}

export interface CloudflareTestResponse {
  success: boolean;
  data?: {
    connected: boolean;
    zones_count: number;
    zones: CloudflareZone[];
  };
  error?: string;
}
