/**
 * Breadcrumb Display Name Utilities
 *
 * Resolves human-readable names for routes.
 * Priority:
 * 1. Page-provided name (via setDisplayName)
 * 2. Known route mapping
 * 3. Humanized path segment
 */

/**
 * Known route to display name mappings
 * These are top-level/static routes with predictable names
 */
const ROUTE_DISPLAY_NAMES: Record<string, string> = {
  // Main sections
  "/dashboard": "Dashboard",
  "/jobs": "Jobs",
  "/jobs/new": "New Job",
  "/contacts": "Contacts",
  "/contacts/new": "New Contact",
  "/contacts/quality-review": "Quality Review",
  "/purchase_orders": "Purchase Orders",
  "/purchase_orders/new": "New PO",
  "/pricebook": "Pricebook",
  "/estimates": "Estimates",
  "/leads": "Leads",
  "/leads/new": "New Lead",

  // Finance
  "/finance": "Finance",
  "/finance/bills": "Bills",
  "/finance/invoices": "Invoices",
  "/finance/bank-transactions": "Bank Transactions",
  "/financial": "Financial",

  // Corporate
  "/corporate": "Corporate",
  "/corporate/companies": "Companies",
  "/corporate/asic-logins": "ASIC Logins",

  // WHS
  "/whs": "WHS",
  "/whs/swms": "SWMS",
  "/whs/incidents": "Incidents",
  "/whs/inspections": "Inspections",

  // Documents
  "/documents": "Documents",
  "/documents/templates": "Templates",

  // Admin
  "/admin": "Admin",
  "/admin/system": "System Settings",
  "/admin/users": "Users",
  "/admin/resources": "Resources",

  // Settings
  "/settings": "Settings",
  "/settings/profile": "Profile",
  "/settings/notifications": "Notifications",
  "/settings/security": "Security",

  // Other
  "/xero": "Xero",
  "/data-warehouse": "Data Warehouse",
  "/training": "Training",
};

/**
 * Icon mappings for known routes
 * Uses lucide-react icon names
 */
const ROUTE_ICONS: Record<string, string> = {
  "/dashboard": "LayoutDashboard",
  "/jobs": "Building2",
  "/contacts": "Users",
  "/purchase_orders": "ShoppingCart",
  "/pricebook": "BookOpen",
  "/estimates": "Calculator",
  "/leads": "Target",
  "/finance": "DollarSign",
  "/financial": "DollarSign",
  "/corporate": "Building",
  "/whs": "Shield",
  "/documents": "FileText",
  "/admin": "Settings",
  "/settings": "Settings",
  "/xero": "Link",
  "/data-warehouse": "Database",
  "/training": "GraduationCap",
};

/**
 * Entity type labels for detail pages
 */
const ENTITY_LABELS: Record<string, string> = {
  jobs: "Job",
  contacts: "Contact",
  purchase_orders: "PO",
  leads: "Lead",
  companies: "Company",
  estimates: "Estimate",
  bills: "Bill",
  invoices: "Invoice",
};

/**
 * Known tab display names for better formatting
 */
const TAB_DISPLAY_NAMES: Record<string, string> = {
  "overview": "Overview",
  "competitor": "Competitor Comparison",
  "details": "Details",
  "photos": "Photos",
  "documents": "Documents",
  "notes": "Notes",
  "activity": "Activity",
  "history": "History",
  "timeline": "Timeline",
  "schedule": "Schedule",
  "invoices": "Invoices",
  "bills": "Bills",
  "payments": "Payments",
  "contacts": "Contacts",
  "items": "Items",
  "settings": "Settings",
  "permissions": "Permissions",
  "integrations": "Integrations",
};

/**
 * Resolve a display name for a pathname
 *
 * @param pathname - URL pathname (e.g., "/jobs/123")
 * @param searchParams - Optional query params
 * @returns Human-readable display name
 */
export function resolveDisplayName(
  pathname: string,
  searchParams?: URLSearchParams | null
): string {
  // Get tab from query params
  const tab = searchParams?.get('tab');

  // 1. Check exact match in known routes
  if (ROUTE_DISPLAY_NAMES[pathname]) {
    const baseName = ROUTE_DISPLAY_NAMES[pathname];
    // If there's a tab, append it
    if (tab) {
      const tabName = TAB_DISPLAY_NAMES[tab] || humanizeSegment(tab);
      return `${baseName} › ${tabName}`;
    }
    return baseName;
  }

  // 2. Parse path segments
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return "Home";

  const lastSegment = segments[segments.length - 1];
  const parentSegment = segments.length > 1 ? segments[segments.length - 2] : null;

  // 3. Check for detail page pattern (e.g., /jobs/123)
  if (/^\d+$/.test(lastSegment)) {
    // It's a numeric ID - show entity type + ID
    const entityType = parentSegment || segments[0];
    const label = ENTITY_LABELS[entityType] || humanizeSegment(entityType);
    const baseName = `${label} #${lastSegment}`;
    // If there's a tab, append it
    if (tab) {
      const tabName = TAB_DISPLAY_NAMES[tab] || humanizeSegment(tab);
      return `${baseName} › ${tabName}`;
    }
    return baseName;
  }

  // 4. Humanize last segment as fallback
  const baseName = humanizeSegment(lastSegment);
  if (tab) {
    const tabName = TAB_DISPLAY_NAMES[tab] || humanizeSegment(tab);
    return `${baseName} › ${tabName}`;
  }
  return baseName;
}

/**
 * Get icon name for a pathname
 */
export function resolveIcon(pathname: string): string | undefined {
  // Check exact match
  if (ROUTE_ICONS[pathname]) {
    return ROUTE_ICONS[pathname];
  }

  // Check parent route (e.g., /jobs/123 -> /jobs icon)
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0) {
    const parentPath = `/${segments[0]}`;
    return ROUTE_ICONS[parentPath];
  }

  return undefined;
}

/**
 * Convert a URL segment to human-readable text
 * e.g., "purchase_orders" -> "Purchase Orders"
 */
function humanizeSegment(segment: string): string {
  return segment
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Check if two pathnames represent the same route
 * (ignoring query params)
 */
export function isSameRoute(path1: string, path2: string): boolean {
  return path1.split('?')[0] === path2.split('?')[0];
}
