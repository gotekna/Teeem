/**
 * SSoT: Route Path Constants
 *
 * Centralized route definitions for the TEEEM application.
 * Use these constants instead of hardcoded strings to:
 * - Prevent typos and broken links
 * - Enable easier refactoring
 * - Provide type safety for dynamic routes
 * - Document all available routes in one place
 */

export const ROUTES = {
  // ===== Public Routes =====
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  TERMS: "/terms",
  PRIVACY: "/privacy",

  // Get Started Flow
  GET_STARTED: {
    ROOT: "/get-started",
    PLAN: "/get-started/plan",
    TEMPLATES: "/get-started/templates",
    COMPLETE: "/get-started/complete",
  },

  // ===== Main Navigation =====
  DASHBOARD: "/dashboard",
  JOBS: "/jobs",
  JOB_DETAIL: (id: string | number) => `/jobs/${id}`,
  JOB_NEW: "/jobs/new",
  JOB_NEW_STATUS: (status: string) => `/jobs/new/status/${status}`,
  JOB_PHOTOS: "/jobs/photos",

  CONTACTS: "/contacts",
  CONTACT_DETAIL: (id: string | number) => `/contacts/${id}`,
  CONTACT_NEW: "/contacts/new",
  CONTACT_SYNC_CONFIG: "/contacts/sync-config",
  CONTACT_QUALITY_REVIEW: "/contacts/quality-review",

  ESTIMATES: "/estimates",
  ESTIMATING: "/estimating",

  PURCHASE_ORDERS: "/purchase_orders",
  PURCHASE_ORDER_NEW: "/purchase_orders/new",

  CALENDAR: "/calendar",

  EMAIL: "/email",
  EMAIL_ACCOUNT: (account?: string) => account ? `/email/${account}` : "/email",
  EMAIL_RULES: "/email/rules",
  EMAIL_SETTINGS: "/email/settings",
  EMAIL_PROPOSALS: "/email-proposals",

  TASKS: "/tasks",
  SM_TASKS: "/sm_tasks", // Redirects to /tasks

  SCHEDULE_MASTER: {
    ROOT: "/schedule-master",
    GANTT: "/schedule-master/gantt",
  },
  GANTT: "/gantt", // Redirects to /schedule-master/gantt

  MEETINGS: "/meetings",
  MEETING_NEW: "/meetings/new",

  LEADS: "/leads",
  LEADS_EMAILS: "/leads/emails",

  WORKFLOWS: "/workflows",
  WORKFLOW_TASKS: "/workflows/tasks",
  WORKFLOW_TASK_DETAIL: (id: string | number) => `/workflows/tasks/${id}`,
  WORKFLOW_PROCESSES: "/workflows/processes",
  WORKFLOW_PROCESS_INSTANCES: "/workflows/processes/instances",

  CASES: "/cases",
  CASE_DETAIL: (id: string | number) => `/cases/${id}`,
  CASE_NEW: "/cases/new",

  // ===== Corporate & Financial =====
  CORPORATE: "/corporate",
  CORPORATE_GROUPS: "/corporate/groups",
  CORPORATE_DIRECTORS: "/corporate/directors",
  CORPORATE_COMPANIES_NEW: "/corporate/companies/new",
  CORPORATE_COMPLIANCE_CALENDAR: "/corporate/compliance-calendar",
  CORPORATE_MINUTE_TEMPLATES: "/corporate/minute-templates",
  CORPORATE_DOCUMENT_TYPES: "/corporate/document-types",
  CORPORATE_CONSOLIDATION: "/corporate/consolidation",
  CORPORATE_ASIC_LOGINS: "/corporate/asic-logins",
  CORPORATE_ASSETS: "/corporate/assets",
  CORPORATE_ASSETS_NEW: "/corporate/assets/new",
  CORPORATE_ASSETS_REPORTS: "/corporate/assets/reports",

  COMPANY_GROUPS: "/company-groups",

  FINANCIAL: "/financial",
  FINANCIAL_REPORTS: "/financial/reports",
  FINANCIAL_TRANSACTIONS: "/financial/transactions",
  FINANCIAL_TAS: "/financial/tas",

  FINANCE: "/finance",
  FINANCE_SETTINGS: "/finance/settings",
  FINANCE_BILLS: "/finance/bills",
  FINANCE_PAYMENTS: "/finance/payments",

  ACCOUNTS: "/accounts",

  XERO: "/xero",
  XERO_SYNC: "/xero/sync",
  XERO_CALLBACK: "/xero/callback",
  XERO_SYNC_CONTACTS: "/xero-sync-contacts",

  // ===== Work Health & Safety =====
  WHS: "/whs",
  WHS_DASHBOARD: "/whs/dashboard",
  WHS_SWMS: "/whs/swms",
  WHS_SWMS_NEW: "/whs/swms/new",
  WHS_INSPECTIONS: "/whs/inspections",
  WHS_INCIDENTS: "/whs/incidents",
  WHS_INDUCTIONS: "/whs/inductions",
  WHS_LICENSES: "/whs/licenses",
  WHS_ACTION_ITEMS: "/whs/action-items",

  // ===== Settings =====
  SETTINGS: {
    ROOT: "/settings",

    // Personal
    PROFILE: "/settings/profile",
    NOTIFICATIONS: "/settings/notifications",
    SECURITY: "/settings/security",
    PREFERENCES: "/settings/preferences",
    ASSISTANT: "/settings/assistant",

    // Organization
    USERS: "/settings/users",
    ROLES: "/settings/roles",
    CORPORATE: "/settings/corporate",
    COMPANY: "/settings/company",
    OPERATIONS: "/settings/operations",
    SYSTEM: "/settings/system",
    DEVELOPER: "/settings/developer",

    // Connections
    CONNECTIONS: "/settings/connections",
    CONNECTIONS_PROVIDER: "/settings/connections/provider",
    CONNECTIONS_INTEGRATIONS: "/settings/connections/integrations",
    CONNECTIONS_MIGRATION: "/settings/connections/migration",
    CONNECTIONS_COSTS: "/settings/connections/costs",
    CONNECTIONS_BACKUPS: "/settings/connections/backups",
    CONNECTIONS_AI_ASSISTANT: "/settings/connections/ai-assistant",
    CONNECTIONS_EMAIL_ACCOUNTS: "/settings/connections/email-accounts/configuration",

    // Integrations (legacy redirects)
    INTEGRATIONS: "/settings/integrations",
    INTEGRATIONS_MICROSOFT: "/settings/integrations/microsoft",
    INTEGRATIONS_XERO: "/settings/integrations/xero",
    INTEGRATIONS_CLOUDFLARE: "/settings/integrations/cloudflare",
    INTEGRATIONS_STORAGE: "/settings/integrations/storage",

    // Email Reseller
    EMAIL_RESELLER: "/settings/email-reseller",
    EMAIL_RESELLER_SUBSCRIPTIONS: "/settings/email-reseller/subscriptions",
    EMAIL_RESELLER_SUBSCRIPTION_DETAIL: (id: string | number) => `/settings/email-reseller/subscriptions/${id}`,
    EMAIL_RESELLER_MIGRATIONS: "/settings/email-reseller/migrations",

    // System sub-tabs
    SYSTEM_EMAIL_ACCOUNTS: "/settings/system/email-accounts",

    // Company sub-tabs
    COMPANY_INFO: "/settings/company/info",
    COMPANY_BRAND_COLORS: "/settings/company/brand-colors",
    COMPANY_DOCUMENTS: "/settings/company/documents",
    COMPANY_HOLIDAYS: "/settings/company/holidays",
    COMPANY_WORKFLOWS: "/settings/company/workflows",
    COMPANY_JOB_SETUP: "/settings/company/job-setup",
    COMPANY_JOB_SETUP_WORKFLOW: "/settings/company/job-setup/workflow",
    COMPANY_WAREHOUSE_CONFIG: "/settings/company/warehouse-config",
    COMPANY_WAREHOUSE_CONFIG_FOLDERS: "/settings/company/warehouse-config/warehouse_folders",
    COMPANY_OFFLINE: "/settings/company/offline",
    COMPANY_CONNECTIONS: "/settings/company/connections", // Deprecated - redirects to /settings/connections
  },

  // ===== Admin =====
  ADMIN: {
    TENANTS: "/admin/tenants",
    SITE_PRESENCE: "/admin/site-presence",

    SYSTEM: "/admin/system",
    SYSTEM_COMPONENTS: "/admin/system/components",
    SYSTEM_DEVELOPER_TOOLS: "/admin/system/developer-tools",
    SYSTEM_EXTRACT_EMPLOYEES: "/admin/system/extract-employees",
    SYSTEM_DOCUMENT_TYPES: "/admin/system/document-types",
    SYSTEM_DOCUMENT_TYPE_DETAIL: (id: string | number) => `/admin/system/document-types/${id}`,

    // Company Admin
    SYSTEM_COMPANY_GROUPS: "/admin/system/company/groups",
    SYSTEM_COMPANY_COMPANIES: "/admin/system/company/companies",
    SYSTEM_COMPANY_SECURITY: "/admin/system/company/security",
    SYSTEM_WAREHOUSE_CONFIG: "/admin/system/warehouse-config",

    // Scheduled Jobs
    SYSTEM_SCHEDULED_JOBS: "/admin/system?tab=scheduled-jobs",

    // TEEEM Office Suite
    TEEEM_XL: "/admin/system/teeem-xl",
    TEEEM_XL_LIST: "/admin/system/teeem-xl/list",
    TEEEM_WORD: "/admin/system/teeem-word",
    TEEEM_WORD_LIST: "/admin/system/teeem-word/list",
    TEEEM_POWERPOINT: "/admin/system/teeem-powerpoint",
    TEEEM_POWERPOINT_LIST: "/admin/system/teeem-powerpoint/list",
    TEEEM_PDF: "/admin/system/teeem-pdf",
    TEEEM_PDF_LIST: "/admin/system/teeem-pdf/list",
  },

  // ===== Tools & Features =====
  CHAT: "/chat",
  TRAINING: "/training",
  TRAINING_SESSION: (sessionId: string | number) => `/training/${sessionId}`,

  NOTEBOOKS: "/notebooks",

  PRICEBOOK: "/pricebook",
  PRICEBOOK_HEALTH: "/pricebook/health",
  PRICEBOOK_ITEMS: "/pricebook-items",
  PRICE_HISTORIES: "/price-histories",

  RECIPES: "/recipes",

  E_SIGNATURE: "/e-signature",
  E_SIGNATURE_PREPARE: "/e-signature/prepare",

  DESIGNER: "/designer",
  DESIGNER_NEW: "/designer/new",

  DESIGN_SYSTEM: "/design-system",
  DESIGN_SYSTEM_KANBAN: "/design-system/kanban",

  TASK_TEMPLATES: "/task-templates", // Redirects to /schedule-templates
  SCHEDULE_TEMPLATES: "/schedule-templates",

  // ===== Data & System =====
  DATA_WAREHOUSE: "/data-warehouse",
  WAREHOUSE: "/warehouse",
  DOCUMENTS: "/documents",
  SHAREPOINT: "/sharepoint", // Redirects to /warehouse

  SYSTEM_HEALTH: "/system-health",
  SYSTEM_HEALTH_HEALTH: "/system-health/health",

  FEATURE_REQUESTS: "/feature-requests",

  // Site Presence
  SITE_PRESENCE_SESSIONS: "/site_presence_sessions",
  WORKER_PROFILES: "/worker_profiles",
  COST_CENTRES: "/cost_centres",
  LABOUR_COST_ENTRIES: "/labour_cost_entries",
  JOB_COST_BUDGETS: "/job_cost_budgets",
  AI_TIMESHEET_SUGGESTIONS: "/ai_timesheet_suggestions",

  // ===== Portal (Customer/Vendor) =====
  PORTAL: {
    ROOT: "/portal",
    LOGIN: "/portal/login",
    DASHBOARD: "/portal/dashboard",
    JOBS: "/portal/jobs",
    QUOTES: "/portal/quotes",
    INVOICES: "/portal/invoices",
    PAYNOW: "/portal/paynow",
    KUDOS: "/portal/kudos",
    SCHEDULE: "/portal/schedule",
    OFFLINE: "/portal?tab=offline",
    PREVIEW: "/portal/preview",
  },

  // ===== Onboarding =====
  ONBOARDING: "/onboarding",
  ONBOARDING_IMPORT: (type: string) => `/onboarding/import/${type}`,

  // ===== Documentation =====
  DOCS: "/docs",
  DOCS_USER_MANUAL: "/docs?doc=user-manual",

  // ===== Device/Offline =====
  DEVICE: "/device",

  // ===== Legacy/Deprecated (kept for backwards compatibility) =====
  PROFILE: "/profile",
} as const;

/**
 * Helper to check if a pathname matches a route
 */
export const isActiveRoute = (pathname: string, route: string): boolean => {
  if (route === ROUTES.DASHBOARD) {
    return pathname === ROUTES.DASHBOARD;
  }
  return pathname.startsWith(route);
};

/**
 * Helper to get a dynamic route with type safety
 */
export const getRoute = {
  jobDetail: (id: string | number) => ROUTES.JOB_DETAIL(id),
  contactDetail: (id: string | number) => ROUTES.CONTACT_DETAIL(id),
  caseDetail: (id: string | number) => ROUTES.CASE_DETAIL(id),
  workflowTaskDetail: (id: string | number) => ROUTES.WORKFLOW_TASK_DETAIL(id),
  trainingSession: (sessionId: string | number) => ROUTES.TRAINING_SESSION(sessionId),
  emailAccount: (account?: string) => ROUTES.EMAIL_ACCOUNT(account),
  jobNewStatus: (status: string) => ROUTES.JOB_NEW_STATUS(status),
  emailResellerSubscription: (id: string | number) => ROUTES.SETTINGS.EMAIL_RESELLER_SUBSCRIPTION_DETAIL(id),
  documentTypeDetail: (id: string | number) => ROUTES.ADMIN.SYSTEM_DOCUMENT_TYPE_DETAIL(id),
  onboardingImport: (type: string) => ROUTES.ONBOARDING_IMPORT(type),
} as const;
