/**
 * Foundation Slugs - SSoT for all Foundation identifiers
 *
 * CRITICAL: Foundation slugs use MIXED conventions (historical reasons).
 * ALWAYS use these constants - NEVER guess or hardcode slugs.
 *
 * Pattern: Most use snake_case, but some use kebab-case (purchase-orders, sm-*, etc.)
 *
 * Usage:
 *   import { FOUNDATION_SLUGS } from '@/lib/constants/foundation-slugs';
 *   <TeeemTableView foundationId={FOUNDATION_SLUGS.PURCHASE_ORDERS} />
 *
 * To add a new slug: Check the database first with:
 *   rails runner "puts Foundation.find_by(slug: 'your-slug')&.slug"
 */

export const FOUNDATION_SLUGS = {
  // ═══════════════════════════════════════════════════════════════════════════
  // Core Business
  // ═══════════════════════════════════════════════════════════════════════════
  JOBS: 'jobs',
  CONTACTS: 'contacts',
  LEADS: 'leads',
  ESTIMATES: 'estimates',
  ESTIMATE_LINE_ITEMS: 'estimate_line_items',
  ESTIMATE_REVIEWS: 'estimate_reviews',

  // ═══════════════════════════════════════════════════════════════════════════
  // Purchase Orders (NOTE: Uses HYPHEN not underscore!)
  // ═══════════════════════════════════════════════════════════════════════════
  PURCHASE_ORDERS: 'purchase-orders',  // ⚠️ HYPHEN - not purchase_orders
  PURCHASE_ORDER_DOCUMENTS: 'purchase_order_documents',
  PURCHASE_ORDER_LINE_ITEMS: 'purchase_order_line_items',

  // ═══════════════════════════════════════════════════════════════════════════
  // Finance & Accounting
  // ═══════════════════════════════════════════════════════════════════════════
  FINANCIAL_TRANSACTIONS: 'financial_transactions',
  PAYMENTS: 'payments',
  BANK_ACCOUNTS: 'bank_accounts',
  BILL_INBOX: 'bill-inbox',  // ⚠️ HYPHEN
  ACCOUNT_MAPPINGS: 'account_mappings',
  ACCOUNTING_INTEGRATIONS: 'accounting_integrations',
  COST_CENTRES: 'cost_centres',
  GL_RECURRING_INVOICES: 'gl_recurring_invoices',
  PAY_NOW_REQUESTS: 'pay_now_requests',
  PAY_NOW_WEEKLY_LIMITS: 'pay_now_weekly_limits',

  // ═══════════════════════════════════════════════════════════════════════════
  // Xero Integration
  // ═══════════════════════════════════════════════════════════════════════════
  XERO_ACCOUNTS: 'xero_accounts',
  XERO_CHART_OF_ACCOUNTS: 'xero_chart_of_accounts',
  XERO_CREDENTIALS: 'xero_credentials',
  XERO_TAX_RATES: 'xero_tax_rates',
  XERO_SYNC_CONTACTS: 'xero-sync-contacts',  // ⚠️ HYPHEN
  EXTERNAL_INVOICES: 'external_invoices',
  EXTERNAL_INTEGRATIONS: 'external_integrations',
  BALANCE_SHEET_REPORTS: 'balance_sheet_reports',
  BANK_STATEMENT_REPORTS: 'bank_statement_reports',
  PROFIT_LOSS_REPORTS: 'profit_loss_reports',
  CORPORATE_COMPANY_XERO_ACCOUNTS: 'corporate_company_xero_accounts',
  SUBCONTRACTOR_ACCOUNTS: 'subcontractor_accounts',
  SUBCONTRACTOR_INVOICES: 'subcontractor_invoices',

  // ═══════════════════════════════════════════════════════════════════════════
  // Schedule Master (NOTE: sm-* uses HYPHENS!)
  // ═══════════════════════════════════════════════════════════════════════════
  SM_SCHEDULE_MASTER: 'sm-schedule-master',  // ⚠️ HYPHEN
  SM_TASKS: 'sm-tasks',  // ⚠️ HYPHEN
  SM_RESOURCES: 'sm-resources',  // ⚠️ HYPHEN
  SM_DEPENDENCIES: 'sm_dependencies',  // underscore
  SM_HOLD_LOGS: 'sm_hold_logs',
  SM_HOLD_REASONS: 'sm_hold_reasons',
  SM_RESOURCE_ALLOCATIONS: 'sm_resource_allocations',
  SM_ROLLOVER_LOGS: 'sm_rollover_logs',
  SM_SETTINGS: 'sm_settings',
  SM_SPAWN_LOGS: 'sm_spawn_logs',
  SM_STAGES: 'sm_stages',
  SM_TASK_GROUPS: 'sm_task_groups',
  SM_TEMPLATES: 'sm_templates',
  SM_TIME_ENTRIES: 'sm_time_entries',
  SM_TRADES: 'sm_trades',
  SM_WORKING_DRAWING_PAGES: 'sm_working_drawing_pages',

  // ═══════════════════════════════════════════════════════════════════════════
  // Contacts & People
  // ═══════════════════════════════════════════════════════════════════════════
  CONTACT_ACTIVITIES: 'contact_activities',
  CONTACT_ADDRESSES: 'contact_addresses',
  CONTACT_GROUP_MEMBERSHIPS: 'contact_group_memberships',
  CONTACT_GROUPS: 'contact_groups',
  CONTACT_PERSONS: 'contact_persons',
  CONTACT_RELATIONSHIPS: 'contact_relationships',
  CONTACT_TYPES: 'contact_types',
  WORKER_PROFILES: 'worker_profiles',

  // ═══════════════════════════════════════════════════════════════════════════
  // Jobs & Projects
  // ═══════════════════════════════════════════════════════════════════════════
  JOB_CONTACTS: 'job_contacts',
  JOB_COST_BUDGETS: 'job_cost_budgets',
  JOB_DOCUMENTATION_TABS: 'job_documentation_tabs',
  JOB_PEOPLE: 'job_people',
  JOB_STAGES: 'job_stages',
  JOB_STATUS: 'job_status',
  JOB_STATUS_STAGES: 'job_status_stages',
  JOB_TYPE_STATUSES: 'job_type_statuses',
  JOB_TYPES: 'job_types',
  LABOUR_COST_ENTRIES: 'labour_cost_entries',
  PROJECTS: 'projects',
  PROJECT_TASKS: 'project_tasks',
  PROJECT_TASK_CHECKLIST_ITEMS: 'project_task_checklist_items',

  // ═══════════════════════════════════════════════════════════════════════════
  // Documents & Templates
  // ═══════════════════════════════════════════════════════════════════════════
  COMPANY_DOCUMENTS: 'company_documents',
  DOCUMENT_TASKS: 'document_tasks',
  DOCUMENT_TYPES: 'document_types',
  DOCUMENTATION_CATEGORIES: 'documentation_categories',
  FOLDER_TEMPLATES: 'folder_templates',
  FOLDER_TEMPLATE_ITEMS: 'folder_template_items',

  // ═══════════════════════════════════════════════════════════════════════════
  // Pricebook & Recipes (NOTE: pricebook-* uses HYPHENS!)
  // ═══════════════════════════════════════════════════════════════════════════
  PRICEBOOK_ITEMS: 'pricebook-items',  // ⚠️ HYPHEN
  PRICEBOOK_CATEGORIES: 'pricebook_categories',  // underscore
  PRICE_HISTORIES: 'price-histories',  // ⚠️ HYPHEN
  RECIPES: 'recipes',
  RECIPE_CATEGORIES: 'recipe_categories',

  // ═══════════════════════════════════════════════════════════════════════════
  // Scheduling & Tasks
  // ═══════════════════════════════════════════════════════════════════════════
  SCHEDULE_TASKS: 'schedule_tasks',
  SCHEDULE_TASK_CHECKLIST_ITEMS: 'schedule_task_checklist_items',
  SCHEDULE_TEMPLATES: 'schedule_templates',
  SCHEDULE_TEMPLATE_ROWS: 'schedule_template_rows',
  SCHEDULE_TEMPLATE_ROW_AUDITS: 'schedule_template_row_audits',
  TASK_DEPENDENCIES: 'task_dependencies',
  TASK_TEMPLATES: 'task_templates',
  TASK_UPDATES: 'task_updates',

  // ═══════════════════════════════════════════════════════════════════════════
  // Quotes & Requests
  // ═══════════════════════════════════════════════════════════════════════════
  QUOTE_TRACKER: 'quote-tracker',  // ⚠️ HYPHEN - PreCon quote tracking
  QUOTE_REQUESTS: 'quote_requests',
  QUOTE_REQUEST_CONTACTS: 'quote_request_contacts',
  QUOTE_RESPONSES: 'quote_responses',

  // ═══════════════════════════════════════════════════════════════════════════
  // WHS (Workplace Health & Safety)
  // ═══════════════════════════════════════════════════════════════════════════
  WHS_ACTION_ITEMS: 'whs_action_items',
  WHS_INCIDENTS: 'whs_incidents',
  WHS_INDUCTION_TEMPLATES: 'whs_induction_templates',
  WHS_INDUCTIONS: 'whs_inductions',
  WHS_INSPECTION_ITEMS: 'whs_inspection_items',
  WHS_INSPECTION_TEMPLATES: 'whs_inspection_templates',
  WHS_INSPECTIONS: 'whs_inspections',
  WHS_SETTINGS: 'whs_settings',
  WHS_SWMS: 'whs_swms',
  WHS_SWMS_ACKNOWLEDGMENTS: 'whs_swms_acknowledgments',
  WHS_SWMS_CONTROLS: 'whs_swms_controls',
  WHS_SWMS_HAZARDS: 'whs_swms_hazards',

  // ═══════════════════════════════════════════════════════════════════════════
  // Meetings
  // ═══════════════════════════════════════════════════════════════════════════
  MEETINGS: 'meetings',
  MEETING_AGENDA_ITEMS: 'meeting_agenda_items',
  MEETING_PARTICIPANTS: 'meeting_participants',
  MEETING_TYPES: 'meeting_types',

  // ═══════════════════════════════════════════════════════════════════════════
  // Communication
  // ═══════════════════════════════════════════════════════════════════════════
  EMAILS: 'emails',
  EMAIL_PROPOSALS: 'email-proposals',  // ⚠️ HYPHEN
  SMS_MESSAGES: 'sms_messages',
  CHAT_MESSAGES: 'chat_messages',

  // ═══════════════════════════════════════════════════════════════════════════
  // Users & Permissions
  // ═══════════════════════════════════════════════════════════════════════════
  USER_MANAGEMENT: 'user-management',  // ⚠️ HYPHEN
  USER_PERMISSIONS: 'user_permissions',
  ROLES: 'roles',
  ROLE_PERMISSIONS: 'role_permissions',
  PERMISSIONS: 'permissions',
  PORTAL_USERS: 'portal_users',
  PORTAL_ACCESS_LOGS: 'portal_access_logs',

  // ═══════════════════════════════════════════════════════════════════════════
  // Microsoft Integration
  // ═══════════════════════════════════════════════════════════════════════════
  ONE_DRIVE_CREDENTIALS: 'one_drive_credentials',
  ORGANIZATION_ONE_DRIVE_CREDENTIALS: 'organization_one_drive_credentials',
  ORGANIZATION_OUTLOOK_CREDENTIALS: 'organization_outlook_credentials',

  // ═══════════════════════════════════════════════════════════════════════════
  // Admin & System
  // ═══════════════════════════════════════════════════════════════════════════
  AGENT_DEFINITIONS: 'agent_definitions',
  AI_TIMESHEET_SUGGESTIONS: 'ai_timesheet_suggestions',
  BUG_HUNTER_TEST_RUNS: 'bug_hunter_test_runs',
  FEATURE_TRACKERS: 'feature_trackers',
  GOLD_STANDARD_TABLE: 'gold_standard_table',
  GROK_PLANS: 'grok_plans',
  IMPLEMENTATION_PATTERNS: 'implementation_patterns',
  IMPORT_SESSIONS: 'import_sessions',
  INSPIRING_QUOTES: 'inspiring-quotes',  // ⚠️ HYPHEN
  KUDOS_EVENTS: 'kudos_events',
  MAINTENANCE_REQUESTS: 'maintenance_requests',
  PUBLIC_HOLIDAYS: 'public_holidays',
  RAIN_LOGS: 'rain_logs',
  SITE_PRESENCE_SESSIONS: 'site_presence_sessions',
  SUPERVISOR_CHECKLIST_TEMPLATES: 'supervisor_checklist_templates',
  TRADING_NAMES: 'trading_names',
  TRINITIES: 'trinities',
  UNREAL_VARIABLES: 'unreal_variables',
  WAREHOUSE_DOCUMENTS: 'warehouse-documents',  // ⚠️ HYPHEN
  DESIGNS: 'designs',
} as const;

// Type for Foundation slug values
export type FoundationSlug = typeof FOUNDATION_SLUGS[keyof typeof FOUNDATION_SLUGS];

/**
 * Helper to check if a string is a valid Foundation slug
 */
export function isValidFoundationSlug(slug: string): slug is FoundationSlug {
  return Object.values(FOUNDATION_SLUGS).includes(slug as FoundationSlug);
}

/**
 * Get all slugs that use hyphens (for documentation/awareness)
 */
export const HYPHENATED_SLUGS = [
  'bill-inbox',
  'email-proposals',
  'inspiring-quotes',
  'price-histories',
  'pricebook-items',
  'purchase-orders',
  'quote-tracker',
  'sm-resources',
  'sm-schedule-master',
  'sm-tasks',
  'user-management',
  'warehouse-documents',
  'xero-sync-contacts',
] as const;
