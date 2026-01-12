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

  // File Warehouse (formerly Documents)
  "/documents": "File Warehouse",
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
  "/documents": "Warehouse",
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
  "plans": "Plans",
  "whs": "WHS",
  "contract": "Contract",
  "budget": "Budget",
  "claims": "Claims",
  "profit": "Profit",
  "people": "People",
  "purchase-orders": "Purchase Orders",
  "estimates": "Estimates",
  "boq": "BOQ",
  "coms": "Communications",
  "rain-log": "Rain Log",
  "site-presence": "Site Presence",
  "colours": "Colours",
  "specifications": "Specifications",
};

/**
 * Pages that have tabs - show default tab when no tab param
 */
const PAGES_WITH_DEFAULT_TAB: Record<string, string> = {
  "/dashboard": "Overview",
};

/**
 * Default tabs for entity detail pages
 * When navigating to these, don't add to breadcrumb (they're implicit)
 * Key: entity type, Value: default tab name
 */
const ENTITY_DEFAULT_TABS: Record<string, string> = {
  jobs: "overview",
  contacts: "overview",
  leads: "overview",
  purchase_orders: "overview",
  estimates: "overview",
  companies: "overview",
};

/**
 * Default child views for nested paths
 * Key: parent path pattern, Value: default child segment
 * e.g., /jobs/123/schedule defaults to /jobs/123/schedule/setup
 */
const DEFAULT_CHILD_VIEWS: Record<string, string> = {
  "schedule": "setup",  // /jobs/*/schedule/setup is default
};

/**
 * Resolve a display name for a pathname
 *
 * @param pathname - URL pathname (e.g., "/jobs/123")
 * @param searchParams - Optional query params
 * @param skipDefaultTab - If true, don't append default tab (used when tab is separate breadcrumb)
 * @returns Human-readable display name
 */
export function resolveDisplayName(
  pathname: string,
  searchParams?: URLSearchParams | null,
  skipDefaultTab?: boolean
): string {
  // Get tab or view from query params, or use default tab for known pages
  // Some pages use ?tab=xxx, others use ?view=xxx
  const tab = searchParams?.get('tab') || searchParams?.get('view');
  const defaultTab = skipDefaultTab ? undefined : PAGES_WITH_DEFAULT_TAB[pathname];
  const effectiveTab = tab || defaultTab;

  // 1. Check exact match in known routes
  if (ROUTE_DISPLAY_NAMES[pathname]) {
    const baseName = ROUTE_DISPLAY_NAMES[pathname];
    // If there's a tab (explicit or default), append it
    if (effectiveTab) {
      const tabName = TAB_DISPLAY_NAMES[effectiveTab] || humanizeSegment(effectiveTab);
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
    if (effectiveTab) {
      const tabName = TAB_DISPLAY_NAMES[effectiveTab] || humanizeSegment(effectiveTab);
      return `${baseName} › ${tabName}`;
    }
    return baseName;
  }

  // 4. Check for path-based tab pattern (e.g., /jobs/123/plans)
  // Pattern: /entity/id/tab where second-to-last segment is numeric ID
  // Just returns tab name - entity context comes from parent in trail
  if (segments.length >= 3 && /^\d+$/.test(segments[segments.length - 2])) {
    const tabKey = lastSegment;
    const tabName = TAB_DISPLAY_NAMES[tabKey] || humanizeSegment(tabKey);
    return tabName;
  }

  // 5. Humanize last segment as fallback
  const baseName = humanizeSegment(lastSegment);
  if (effectiveTab) {
    const tabName = TAB_DISPLAY_NAMES[effectiveTab] || humanizeSegment(effectiveTab);
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

/**
 * Check if two pathnames are sibling tabs (same parent entity, different tab)
 * e.g., /jobs/123/overview and /jobs/123/plans are siblings
 * Used to replace tab in breadcrumb instead of adding new item
 */
export function isSiblingTab(path1: string, path2: string): boolean {
  const segments1 = path1.split('/').filter(Boolean);
  const segments2 = path2.split('/').filter(Boolean);

  // Both need at least 3 segments: entity/id/tab (e.g., jobs/123/plans)
  if (segments1.length < 3 || segments2.length < 3) return false;

  // Check if it's an entity/id/tab pattern (second-to-last is numeric)
  const hasNumericId1 = /^\d+$/.test(segments1[segments1.length - 2]);
  const hasNumericId2 = /^\d+$/.test(segments2[segments2.length - 2]);
  if (!hasNumericId1 || !hasNumericId2) return false;

  // Compare parent paths (everything except last segment/tab)
  const parent1 = segments1.slice(0, -1).join('/');
  const parent2 = segments2.slice(0, -1).join('/');

  return parent1 === parent2;
}

/**
 * Check if a pathname is a default view that should be skipped in breadcrumb
 * Default views are implicit - no need to clutter the trail
 *
 * Examples:
 * - /jobs/123/overview -> true (overview is default for jobs)
 * - /jobs/123/schedule/setup -> true (setup is default for schedule)
 * - /jobs/123/plans -> false (not a default)
 */
export function isDefaultView(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 3) return false;

  const lastSegment = segments[segments.length - 1];

  // Check for entity/id/tab pattern where tab is default
  // e.g., /jobs/123/overview
  if (segments.length === 3 && /^\d+$/.test(segments[1])) {
    const entityType = segments[0];
    const defaultTab = ENTITY_DEFAULT_TABS[entityType];
    if (defaultTab && lastSegment === defaultTab) {
      return true;
    }
  }

  // Check for nested default views
  // e.g., /jobs/123/schedule/setup where setup is default for schedule
  if (segments.length >= 4) {
    const parentSegment = segments[segments.length - 2];
    const defaultChild = DEFAULT_CHILD_VIEWS[parentSegment];
    if (defaultChild && lastSegment === defaultChild) {
      return true;
    }
  }

  return false;
}

/**
 * Check if two paths are related (share common first-level ancestor)
 * Used to detect stale breadcrumb state when navigating across sections
 *
 * @example
 * isRelatedPath('/jobs/123/schedule', '/jobs/456/plans') // true - both under /jobs
 * isRelatedPath('/jobs/123', '/purchase_orders/456')     // false - different sections
 */
export function isRelatedPath(path1: string, path2: string): boolean {
  const segments1 = path1.split('/').filter(Boolean);
  const segments2 = path2.split('/').filter(Boolean);

  // Both need at least one segment
  if (segments1.length === 0 || segments2.length === 0) return false;

  // First segment must match (e.g., both under /jobs)
  return segments1[0] === segments2[0];
}

/**
 * Build a breadcrumb trail from URL hierarchy
 * Used when trail is empty or stale (doesn't match current URL)
 *
 * @example
 * buildBreadcrumbsFromUrl('/jobs/46/schedule/po-tasks-only')
 * Returns: [
 *   { pathname: '/jobs', displayName: 'Jobs' },
 *   { pathname: '/jobs/46', displayName: 'Job #46' },
 *   { pathname: '/jobs/46/schedule', displayName: 'Schedule' },
 *   { pathname: '/jobs/46/schedule/po-tasks-only', displayName: 'Po Tasks Only' }
 * ]
 */
export function buildBreadcrumbsFromUrl(
  pathname: string,
  searchParams?: URLSearchParams | null
): Array<{
  id: string;
  pathname: string;
  searchParams?: string;
  displayName: string;
  icon?: string;
  timestamp: number;
}> {
  const segments = pathname.split('/').filter(Boolean);
  const trail: Array<{
    id: string;
    pathname: string;
    searchParams?: string;
    displayName: string;
    icon?: string;
    timestamp: number;
  }> = [];

  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isNumericId = /^\d+$/.test(segment);
    const isLast = i === segments.length - 1;
    const nextSegment = i < segments.length - 1 ? segments[i + 1] : null;

    // Build path up to this point
    currentPath += '/' + segment;

    // Check if next segment is the default tab for this path
    // e.g., /dashboard when next segment is "overview"
    // In this case, don't append the default tab to display name (it will be a separate breadcrumb)
    const defaultTab = PAGES_WITH_DEFAULT_TAB[currentPath];
    const skipDefaultTab = !isLast && !!defaultTab && nextSegment === defaultTab.toLowerCase();

    // If this is a numeric ID, create combined "Entity #ID" item
    // e.g., segment "46" after "jobs" → "Job #46" with path /jobs/46
    if (isNumericId) {
      const item = {
        id: `${currentPath}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pathname: currentPath,
        searchParams: isLast ? searchParams?.toString() : undefined,
        displayName: resolveDisplayName(currentPath, isLast ? searchParams : null, skipDefaultTab),
        icon: resolveIcon(currentPath),
        timestamp: Date.now(),
      };
      trail.push(item);
      continue;
    }

    // Non-numeric segment (e.g., /jobs, /schedule, /setup)
    // Add as separate breadcrumb item
    const item = {
      id: `${currentPath}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pathname: currentPath,
      searchParams: isLast ? searchParams?.toString() : undefined,
      displayName: resolveDisplayName(currentPath, isLast ? searchParams : null, skipDefaultTab),
      icon: resolveIcon(currentPath),
      timestamp: Date.now(),
    };
    trail.push(item);
  }

  return trail;
}
