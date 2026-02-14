// SSoT: All API endpoint paths
// Import from @/lib/constants/api-endpoints - NEVER hardcode API paths
//
// Usage:
//   import { API } from "@/lib/constants/api-endpoints";
//   api.get(API.contacts.list)
//   api.get(API.contacts.get(id))
//   api.post(API.contacts.create, data)

export const API = {
  // Authentication & Session
  auth: {
    login: "/api/v1/auth/login",
    logout: "/api/v1/auth/logout",
    me: "/api/v1/users/me",
    refresh: "/api/v1/auth/refresh",
    forgotPassword: "/api/v1/auth/forgot_password",
    resetPassword: "/api/v1/auth/reset_password",
    acceptInvitation: "/api/v1/auth/accept_invitation",
  },

  // Users
  users: {
    list: "/api/v1/users",
    get: (id: number | string) => `/api/v1/users/${id}`,
    create: "/api/v1/users",
    update: (id: number | string) => `/api/v1/users/${id}`,
    delete: (id: number | string) => `/api/v1/users/${id}`,
    me: "/api/v1/users/me",
    notifications: "/api/v1/notifications",
    notificationPreferences: "/api/v1/notification_preferences",
  },

  // Contacts
  contacts: {
    list: "/api/v1/contacts",
    get: (id: number | string) => `/api/v1/contacts/${id}`,
    create: "/api/v1/contacts",
    update: (id: number | string) => `/api/v1/contacts/${id}`,
    delete: (id: number | string) => `/api/v1/contacts/${id}`,
    merge: "/api/v1/contacts/merge",
    bulkUpdate: "/api/v1/contacts/bulk_update",
    roles: "/api/v1/contacts/roles",
    entityTypes: "/api/v1/contact_entity_types",
    contactTypes: "/api/v1/contact_types",
    qualityReview: (id: number | string) => `/api/v1/contacts/${id}/quality_review`,
  },

  // Companies
  companies: {
    list: "/api/v1/companies",
    get: (id: number | string) => `/api/v1/companies/${id}`,
    create: "/api/v1/companies",
    update: (id: number | string) => `/api/v1/companies/${id}`,
    delete: (id: number | string) => `/api/v1/companies/${id}`,
  },

  // Company Groups
  companyGroups: {
    list: "/api/v1/company_groups",
    get: (id: number | string) => `/api/v1/company_groups/${id}`,
    create: "/api/v1/company_groups",
    update: (id: number | string) => `/api/v1/company_groups/${id}`,
  },

  // Company Settings
  companySettings: {
    get: "/api/v1/company_settings",
    update: "/api/v1/company_settings",
  },

  // Jobs
  jobs: {
    list: "/api/v1/jobs",
    get: (id: number | string) => `/api/v1/jobs/${id}`,
    create: "/api/v1/jobs",
    update: (id: number | string) => `/api/v1/jobs/${id}`,
    delete: (id: number | string) => `/api/v1/jobs/${id}`,
    types: "/api/v1/job_types",
    statuses: "/api/v1/job_statuses",
    stages: "/api/v1/job_stages",
    suburbs: "/api/v1/job_suburbs",
  },

  // Foundations (THE SSoT for record queries)
  foundations: {
    list: "/api/v1/foundations",
    bySlug: (slug: string) => `/api/v1/foundations/${slug}`,
    records: (slug: string) => `/api/v1/foundations/${slug}/records`,
    record: (slug: string, id: number | string) => `/api/v1/foundations/${slug}/records/${id}`,
    views: (slug: string) => `/api/v1/foundations/${slug}/views`,
    view: (slug: string, viewId: number | string) => `/api/v1/foundations/${slug}/views/${viewId}`,
    columns: (slug: string) => `/api/v1/foundations/${slug}/columns`,
    column: (slug: string, colId: number | string) => `/api/v1/foundations/${slug}/columns/${colId}`,
    groups: (slug: string) => `/api/v1/foundations/${slug}/groups`,
  },

  // Documents & Storage
  documents: {
    list: "/api/v1/documents",
    status: "/api/v1/documents/status",
    all: "/api/v1/documents/all",
    warehouse: "/api/v1/documents/warehouse",
    browseFolders: "/api/v1/documents/browse_folders",
    browseFiles: "/api/v1/documents/browse_files",
    upload: "/api/v1/documents/upload",
    presignedUrl: "/api/v1/documents/presigned_url",
    get: (id: number | string) => `/api/v1/documents/${id}`,
    delete: (id: number | string) => `/api/v1/documents/${id}`,
    types: "/api/v1/document_types",
  },

  // Warehouse Provider
  warehouseProvider: {
    get: "/api/v1/warehouse_provider",
    update: "/api/v1/warehouse_provider",
    test: "/api/v1/warehouse_provider/test_connection",
    sync: "/api/v1/warehouse_provider/sync",
  },

  // Warehouse Folders
  warehouseFolders: {
    list: "/api/v1/warehouse_folders",
    get: (id: number | string) => `/api/v1/warehouse_folders/${id}`,
    create: "/api/v1/warehouse_folders",
    update: (id: number | string) => `/api/v1/warehouse_folders/${id}`,
    delete: (id: number | string) => `/api/v1/warehouse_folders/${id}`,
  },

  // Emails
  emails: {
    list: "/api/v1/synced_emails",
    get: (id: number | string) => `/api/v1/synced_emails/${id}`,
    drafts: "/api/v1/email_drafts",
    draft: (id: number | string) => `/api/v1/email_drafts/${id}`,
    send: "/api/v1/email_drafts/send",
    templates: "/api/v1/email_templates",
    credentials: "/api/v1/microsoft_credentials",
    imapCredentials: "/api/v1/imap_credentials",
  },

  // Purchase Orders
  purchaseOrders: {
    list: "/api/v1/purchase_orders",
    get: (id: number | string) => `/api/v1/purchase_orders/${id}`,
    create: "/api/v1/purchase_orders",
    update: (id: number | string) => `/api/v1/purchase_orders/${id}`,
    delete: (id: number | string) => `/api/v1/purchase_orders/${id}`,
    template: "/api/v1/purchase_orders/template",
  },

  // Pricebook
  pricebook: {
    items: "/api/v1/pricebook_items",
    item: (id: number | string) => `/api/v1/pricebook_items/${id}`,
    categories: "/api/v1/pricebook_categories",
    priceHistories: "/api/v1/price_histories",
  },

  // Schedule Master
  scheduleMaster: {
    tasks: "/api/v1/sm_tasks",
    task: (id: number | string) => `/api/v1/sm_tasks/${id}`,
    resources: "/api/v1/sm_resources",
    resource: (id: number | string) => `/api/v1/sm_resources/${id}`,
    templates: "/api/v1/sm_schedule_master_templates",
    template: (id: number | string) => `/api/v1/sm_schedule_master_templates/${id}`,
  },

  // Xero Integration
  xero: {
    status: "/api/v1/xero/status",
    tenants: "/api/v1/xero/tenants",
    contacts: "/api/v1/xero/contacts",
    invoices: "/api/v1/xero/invoices",
    bankTransactions: "/api/v1/xero/bank_transactions",
    accounts: "/api/v1/xero/accounts",
    syncContacts: "/api/v1/xero/sync_contacts",
    health: "/api/v1/xero/health",
    connect: "/api/v1/xero/connect",
    disconnect: "/api/v1/xero/disconnect",
  },

  // Microsoft / SharePoint
  microsoft: {
    credentials: "/api/v1/microsoft_credentials",
    credential: (id: number | string) => `/api/v1/microsoft_credentials/${id}`,
    authorize: "/api/v1/microsoft_credentials/authorize",
    sharepoint: {
      health: "/api/v1/sharepoint/health",
      browse: "/api/v1/sharepoint/browse",
      upload: "/api/v1/sharepoint/upload",
    },
  },

  // Financial / General Ledger
  financial: {
    invoices: "/api/v1/external_invoices",
    invoice: (id: number | string) => `/api/v1/external_invoices/${id}`,
    payments: "/api/v1/payments",
    bankAccounts: "/api/v1/xero_accounts",
    bankTransactions: "/api/v1/bank_transactions",
    journalEntries: "/api/v1/gl/journal_entries",
    chartOfAccounts: "/api/v1/gl/chart_of_accounts",
    billInbox: "/api/v1/bill_inbox",
    billInboxItem: (id: number | string) => `/api/v1/bill_inbox/${id}`,
    stripePayments: "/api/v1/stripe_payments",
    paymentLinks: "/api/v1/payment_links",
  },

  // Roles & Permissions
  roles: {
    list: "/api/v1/roles",
    get: (id: number | string) => `/api/v1/roles/${id}`,
    create: "/api/v1/roles",
    update: (id: number | string) => `/api/v1/roles/${id}`,
    delete: (id: number | string) => `/api/v1/roles/${id}`,
  },

  // Admin / System
  admin: {
    health: "/api/v1/health",
    backgroundJobs: "/api/v1/background_jobs",
    systemSettings: "/api/v1/system_settings",
    columnTypeDefinitions: "/api/v1/column_type_definitions",
  },

  // Heroku / Infrastructure
  heroku: {
    infrastructure: "/api/v1/heroku/infrastructure",
    vercelBilling: "/api/v1/heroku/vercel_billing",
    vercelUsageBreakdown: "/api/v1/heroku/vercel_usage_breakdown",
    storageBilling: "/api/v1/heroku/storage_billing",
    scale: "/api/v1/heroku/scale",
  },

  // WHS
  whs: {
    incidents: "/api/v1/whs_incidents",
    incident: (id: number | string) => `/api/v1/whs_incidents/${id}`,
    toolboxTalks: "/api/v1/toolbox_talks",
    swms: "/api/v1/swms",
  },

  // Leads
  leads: {
    list: "/api/v1/leads",
    get: (id: number | string) => `/api/v1/leads/${id}`,
    create: "/api/v1/leads",
    update: (id: number | string) => `/api/v1/leads/${id}`,
  },

  // Chat / AI
  chat: {
    messages: "/api/v1/chat_messages",
    agents: "/api/v1/agent_definitions",
  },

  // Notifications
  notifications: {
    list: "/api/v1/notifications",
    markRead: (id: number | string) => `/api/v1/notifications/${id}/mark_read`,
    markAllRead: "/api/v1/notifications/mark_all_read",
    preferences: "/api/v1/notification_preferences",
  },

  // Signup & Trials
  signup: {
    create: "/api/v1/signup",
    checkEmail: "/api/v1/signup/check_email",
  },

  // BPMN Workflows
  workflows: {
    processes: "/api/v1/bpmn_processes",
    process: (id: number | string) => `/api/v1/bpmn_processes/${id}`,
  },

  // Holidays
  holidays: {
    list: "/api/v1/public_holidays",
    create: "/api/v1/public_holidays",
    update: (id: number | string) => `/api/v1/public_holidays/${id}`,
    delete: (id: number | string) => `/api/v1/public_holidays/${id}`,
  },

  // S3 Compatible Credentials
  s3Credentials: {
    list: "/api/v1/s3_compatible_credentials",
    get: (id: number | string) => `/api/v1/s3_compatible_credentials/${id}`,
    create: "/api/v1/s3_compatible_credentials",
    update: (id: number | string) => `/api/v1/s3_compatible_credentials/${id}`,
  },

  // Corporate
  corporate: {
    minutes: "/api/v1/corporate_minutes",
    shareTransfers: "/api/v1/share_transfers",
    assets: "/api/v1/corporate_assets",
  },

  // Portal (public-facing)
  portal: {
    auth: "/api/v1/portal/auth",
    dashboard: "/api/v1/portal/dashboard",
    jobs: "/api/v1/portal/jobs",
    documents: "/api/v1/portal/documents",
    invoices: "/api/v1/portal/invoices",
    quotes: "/api/v1/portal/quotes",
    siteLog: "/api/v1/portal/site_log",
    variations: "/api/v1/portal/variations",
  },
} as const;
