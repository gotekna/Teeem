/**
 * Table Routes Configuration
 *
 * CRITICAL: This is the single source of truth for table routing in Trapid.
 *
 * WHY THIS EXISTS:
 * - Prevents duplicate custom table implementations
 * - Ensures all tables inherit TrapidTableView features (schema editor, filters, saved views, etc.)
 * - Makes table routing easy to maintain and audit
 *
 * RULES:
 * 1. ALL tables MUST use TablePage via /tables/:id/:slug route
 * 2. Legacy routes (e.g., /contacts, /purchase-orders) redirect to table routes
 * 3. Detail pages (e.g., /contacts/:id) can remain custom for specific UX needs
 * 4. NEVER create a new custom table page - add a redirect here instead
 *
 * HOW TO ADD A NEW TABLE:
 * 1. Create the table in the database
 * 2. Add an entry to this config with tableId and legacyRoute
 * 3. The redirect will be automatically created in App.jsx
 * 4. Users navigate to /your-route → automatically redirected to /tables/:id/:slug
 *
 * RELATED DOCS:
 * - See Trinity Bible Rule #20.XX (TrapidTableView - The One Table Standard)
 * - See TRAPID_DOCS/TEACHER/CHAPTER_19_UI_UX.md
 */

export const TABLE_ROUTES = [
  {
    tableId: 1,
    slug: 'gold-standard-reference',
    name: 'Gold Standard Reference',
    legacyRoute: null, // Accessed via System Admin only
    hasCustomDetailPage: false
  },
  {
    tableId: 214,
    slug: 'contacts',
    name: 'Contacts',
    legacyRoute: '/contacts',
    hasCustomDetailPage: true, // /contacts/:id uses ContactDetailPage
    description: 'Business contacts and relationships'
  },
  {
    tableId: 215,
    slug: 'suppliers',
    name: 'Suppliers',
    legacyRoute: '/suppliers',
    redirectTo: '/contacts', // Suppliers redirect to contacts (filtered view)
    hasCustomDetailPage: true // /suppliers/:id uses SupplierDetailPage
  },
  {
    tableId: 205,
    slug: 'price-books',
    name: 'Price Books',
    legacyRoute: '/price-books',
    hasCustomDetailPage: true, // /price-books/:id uses PriceBookItemDetailPage
    description: 'Product pricing and supplier information'
  },
  {
    tableId: 217,
    slug: 'purchase-orders',
    name: 'Purchase Orders',
    legacyRoute: '/purchase-orders',
    hasCustomDetailPage: true, // /purchase-orders/:id has edit and detail pages
    description: 'Purchase orders for suppliers'
  },
  {
    tableId: 212,
    slug: 'user-management',
    name: 'User Management',
    legacyRoute: '/users',
    hasCustomDetailPage: false,
    description: 'System users and permissions'
  },
  {
    tableId: 204,
    slug: 'jobs',
    name: 'Jobs',
    legacyRoute: '/jobs',
    hasCustomDetailPage: true, // /jobs/:id uses JobDetailPage
    description: 'Active construction jobs and projects'
  },
  // WHS (Workplace Health & Safety) Tables
  {
    tableId: 206,
    slug: 'whs-swms',
    name: 'WHS SWMS',
    legacyRoute: '/whs/swms',
    hasCustomDetailPage: false,
    description: 'Safe Work Method Statements'
  },
  {
    tableId: 207,
    slug: 'whs-action-items',
    name: 'WHS Action Items',
    legacyRoute: '/whs/action-items',
    hasCustomDetailPage: false,
    description: 'WHS action items and follow-ups'
  },
  {
    tableId: 208,
    slug: 'whs-inductions',
    name: 'WHS Inductions',
    legacyRoute: '/whs/inductions',
    hasCustomDetailPage: false,
    description: 'Worker safety inductions'
  },
  {
    tableId: 209,
    slug: 'whs-inspections',
    name: 'WHS Inspections',
    legacyRoute: '/whs/inspections',
    hasCustomDetailPage: false,
    description: 'Workplace safety inspections'
  },
  {
    tableId: 210,
    slug: 'whs-incidents',
    name: 'WHS Incidents',
    legacyRoute: '/whs/incidents',
    hasCustomDetailPage: false,
    description: 'Workplace incidents and near-misses'
  }
]

/**
 * Get table route configuration by table ID
 */
export function getTableRoute(tableId) {
  return TABLE_ROUTES.find(route => route.tableId === tableId)
}

/**
 * Get table route configuration by legacy route
 */
export function getTableByLegacyRoute(legacyRoute) {
  return TABLE_ROUTES.find(route => route.legacyRoute === legacyRoute)
}

/**
 * Get the canonical table URL for a given table ID
 */
export function getTableUrl(tableId) {
  const route = getTableRoute(tableId)
  if (!route) {
    console.warn(`No route configuration found for table ID ${tableId}`)
    return `/tables/${tableId}`
  }
  return `/tables/${route.tableId}/${route.slug}`
}

/**
 * Generate all legacy route redirects for React Router
 * Used in App.jsx to automatically create redirects
 */
export function generateLegacyRedirects() {
  return TABLE_ROUTES
    .filter(route => route.legacyRoute && !route.redirectTo)
    .map(route => ({
      from: route.legacyRoute,
      to: getTableUrl(route.tableId)
    }))
}

/**
 * Audit helper: Check if a route should be using TablePage
 * Run this in console: import { auditRoutes } from './config/tableRoutes'
 */
export function auditRoutes() {
  const customPages = [
    'ContactsPage',
    'PriceBooksPageWithTabs',
    'PurchaseOrdersPage',
    'UsersPage',
    'WhsSwmsPage',
    'WhsInspectionsPage',
    'WhsIncidentsPage',
    'WhsInductionsPage',
    'WhsActionItemsPage'
  ]

  console.log('🔍 Table Routing Audit')
  console.log('=====================')
  console.log(`✅ ${TABLE_ROUTES.length} tables configured`)
  console.log(`⚠️  ${customPages.length} legacy custom pages should be removed after migration`)
  console.log('\nLegacy redirects:')
  generateLegacyRedirects().forEach(redirect => {
    console.log(`  ${redirect.from} → ${redirect.to}`)
  })

  return {
    configuredTables: TABLE_ROUTES.length,
    legacyPages: customPages,
    redirects: generateLegacyRedirects()
  }
}
