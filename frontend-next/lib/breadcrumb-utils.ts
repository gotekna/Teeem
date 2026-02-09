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

  // File Warehouse
  "/warehouse": "File Warehouse",
  "/warehouse/templates": "Templates",

  // Admin (legacy paths - display as Settings for consistency)
  "/admin": "Settings",
  "/admin/system": "Operations",
  "/admin/system/schedule-master": "Schedule Master",
  "/admin/users": "Users",
  "/admin/resources": "Resources",

  // Settings - Main sections
  "/settings": "Settings",
  "/settings/profile": "Profile",
  "/settings/notifications": "Notifications",
  "/settings/security": "Security",
  "/settings/preferences": "Preferences",
  "/settings/users": "Users",
  "/settings/roles": "Access Control",
  "/settings/corporate": "Corporate",
  "/settings/company": "Company",
  "/settings/integrations": "Integrations",
  "/settings/documents": "Documents",
  "/settings/operations": "Operations",
  "/settings/system": "System",
  "/settings/developer": "Developer",

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
  "/warehouse": "Warehouse",
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
  // General tabs
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

  // Settings > Company tabs
  "info": "Info",
  "brand-colors": "Brand Colors",
  "brand-guidelines": "Brand Guidelines",
  "doc-templates": "Doc Templates",
  "security": "Security",
  "corporate": "Corporate",
  "holidays": "Holidays",
  "workflows": "Workflows",
  "connections": "Connections",
  "job-setup": "Job Setup",
  "workflow-config": "Workflow Config",
  "warehouse-config": "Warehouse Config",
  "offline": "Offline",

  // Settings > Company > Warehouse Config sub-tabs
  "warehouse_folders": "Warehouse Folders",
  "warehouse_tables": "Warehouse Tables",
  "warehouse_types": "Warehouse Types",  // Sub-tab within warehouse_tables
  "document_types": "Document Types",
  // Note: "corporate" already defined above for Settings tabs
  "job": "Jobs",
  "contact": "Contacts",
  "email_config": "Email Config",
  "config_sync": "Sync",

  // Settings > Developer tabs
  "api-keys": "API Keys",
  "webhooks": "Webhooks",
  "logs": "Logs",
  "components": "Components Lab",
  "tools": "Developer Tools",
  "unreal-engine": "Unreal Engine",

  // Settings > Developer > Components Lab subtabs (GoldStandardTab)
  "table": "Gold Standard Table",
  "document-types": "Gold Document Types",
  "invoice": "Gold Bills/Invoice Viewer",
  "column-info": "Column Info",
  "sync-check": "Sync Check",
  "ui-components": "UI Components",
  "column-types-ssot": "Column Types (SSoT)",
  "view-table-demo": "ViewTable Demo",
  "setup-table-demo": "SetupTable Demo",

  // Settings > Company > Connections sub-tabs
  "provider": "Storage Provider",
  "migration": "Migration",
  "costs": "Cost Comparison",

  // Settings > Company > Security sub-tabs
  "users": "Users",
  "roles": "User Roles",
  // "groups" already defined above

  // Settings > Company > Corporate sub-tabs
  "groups": "Groups",
  "companies": "Companies",
  "company-tabs": "Storage Locations",

  // Settings > Operations tabs
  "job-types": "Job Types",
  "categories": "Categories",
  "statuses": "Statuses",
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

  // 4b. Check for Settings path-based tab pattern (e.g., /settings/company/connections)
  // Pattern: /settings/{section}/{tab}
  if (segments.length === 3 && segments[0] === "settings") {
    const tabKey = lastSegment;
    const tabName = TAB_DISPLAY_NAMES[tabKey] || humanizeSegment(tabKey);
    return tabName;
  }

  // 4c. Check for Settings nested sub-tab pattern (e.g., /settings/company/connections/migration)
  // Pattern: /settings/{section}/{tab}/{subtab}
  if (segments.length === 4 && segments[0] === "settings") {
    const subtabKey = lastSegment;
    const subtabName = TAB_DISPLAY_NAMES[subtabKey] || humanizeSegment(subtabKey);
    // If there's a ?tab= query param, append it (e.g., warehouse_tables?tab=warehouse_folders)
    if (effectiveTab && effectiveTab !== subtabKey) {
      const tabName = TAB_DISPLAY_NAMES[effectiveTab] || humanizeSegment(effectiveTab);
      return `${subtabName} › ${tabName}`;
    }
    return subtabName;
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
 * Settings sections that have path-based tabs
 * These are recognized for sibling tab detection
 */
const SETTINGS_TABBED_SECTIONS = [
  "company",
  "integrations",
  "documents",
  "operations",
  "system",
  "developer",
];

/**
 * Settings tabs that have nested sub-tabs
 * e.g., /settings/company/connections has sub-tabs: provider, migration, costs
 */
const SETTINGS_NESTED_TABS: Record<string, string[]> = {
  "connections": ["provider", "migration", "costs"],
  "security": ["users", "roles", "groups"],
  "corporate": ["groups", "companies", "company-tabs"],
  "warehouse-config": ["warehouse_folders", "document_types", "corporate", "job", "contact", "email_config", "config_sync"],
};

/**
 * Check if two pathnames are sibling tabs (same parent entity, different tab)
 * e.g., /jobs/123/overview and /jobs/123/plans are siblings
 * e.g., /settings/users and /settings/profile are siblings
 * e.g., /settings/company/info and /settings/company/connections are siblings
 * e.g., /settings/company/connections/provider and /settings/company/connections/migration are siblings
 * Used to replace tab in breadcrumb instead of adding new item
 */
export function isSiblingTab(path1: string, path2: string): boolean {
  const segments1 = path1.split('/').filter(Boolean);
  const segments2 = path2.split('/').filter(Boolean);

  // Check for top-level Settings tabs: /settings/{tab}
  // e.g., /settings/users and /settings/profile are siblings
  if (segments1.length === 2 && segments2.length === 2 &&
      segments1[0] === "settings" && segments2[0] === "settings") {
    return true;
  }

  // Both need at least 3 segments for deeper checks
  if (segments1.length < 3 || segments2.length < 3) return false;

  // Check for Settings nested sub-tab pattern: /settings/{section}/{tab}/{subtab}
  // e.g., /settings/company/connections/provider and /settings/company/connections/migration
  if (segments1.length === 4 && segments2.length === 4 &&
      segments1[0] === "settings" && segments2[0] === "settings") {
    const tab1 = segments1[2];
    const tab2 = segments2[2];
    const nestedTabs = SETTINGS_NESTED_TABS[tab1] || SETTINGS_NESTED_TABS[tab2];

    if (nestedTabs && tab1 === tab2) {
      // Compare parent paths (settings/section/tab)
      const parent1 = segments1.slice(0, 3).join('/');
      const parent2 = segments2.slice(0, 3).join('/');
      return parent1 === parent2;
    }
  }

  // Check for Settings section/tab pattern: /settings/{section}/{tab}
  // Both must be exactly 3 segments to be siblings at this level
  if (segments1.length === 3 && segments2.length === 3) {
    const isSettingsTabs1 = segments1[0] === "settings" && SETTINGS_TABBED_SECTIONS.includes(segments1[1]);
    const isSettingsTabs2 = segments2[0] === "settings" && SETTINGS_TABBED_SECTIONS.includes(segments2[1]);

    if (isSettingsTabs1 && isSettingsTabs2) {
      // Compare parent paths (settings/section)
      const parent1 = segments1.slice(0, 2).join('/');
      const parent2 = segments2.slice(0, 2).join('/');
      return parent1 === parent2;
    }
  }

  // Check for entity/id/tab pattern (second-to-last is numeric)
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
 * Entity detail pages that can be navigated to from job detail pages
 * When navigating from /jobs/{id}/* to any of these, preserve breadcrumb context
 */
const ENTITY_DETAIL_SECTIONS = [
  'purchase_orders',  // /purchase_orders/{id}
  'estimates',        // /estimates/{id}
  'contacts',         // /contacts/{id}
  'leads',            // /leads/{id}
  'companies',        // /companies/{id}
];

/**
 * Check if two paths are related
 * Used to detect stale breadcrumb state when navigating across sections
 *
 * A path is considered "related" if:
 * 1. They share the same first-level ancestor (e.g., both under /jobs)
 * 2. Navigating FROM a job detail page TO an entity detail page
 *    (e.g., /jobs/123/finance/expenses → /purchase_orders/456)
 *
 * @example
 * isRelatedPath('/jobs/123/schedule', '/jobs/456/plans')       // true - both under /jobs
 * isRelatedPath('/jobs/123', '/purchase_orders/456')           // true - job to PO
 * isRelatedPath('/jobs/123/finance/expenses', '/purchase_orders/456') // true - job tab to PO
 * isRelatedPath('/contacts/123', '/purchase_orders/456')       // false - different entities
 */
export function isRelatedPath(path1: string, path2: string): boolean {
  const segments1 = path1.split('/').filter(Boolean);
  const segments2 = path2.split('/').filter(Boolean);

  // Both need at least one segment
  if (segments1.length === 0 || segments2.length === 0) return false;

  // Special handling for Settings navigation:
  // When navigating from a deeper Settings path (3+ segments) to a top-level
  // Settings tab (2 segments), treat as unrelated to force trail rebuild.
  // e.g., /settings/documents/types → /settings/users should rebuild trail
  if (segments1[0] === "settings" && segments2[0] === "settings") {
    const isDeepSettings = segments1.length >= 3;
    const isTopLevelSettingsTab = segments2.length === 2;
    if (isDeepSettings && isTopLevelSettingsTab) {
      return false; // Force trail rebuild
    }

    // Also handle navigating from a deeper sub-tab to a different main tab
    // e.g., /settings/developer/components/table → /settings/developer/tools
    // These have the same parent (/settings/developer) but different depths
    if (segments1.length >= 4 && segments2.length === 3) {
      const parent1 = segments1.slice(0, 2).join('/'); // settings/developer
      const parent2 = segments2.slice(0, 2).join('/'); // settings/developer
      if (parent1 === parent2 && segments1[2] !== segments2[2]) {
        return false; // Force trail rebuild when switching between tabs at different depths
      }
    }

    // Detect navigation between different settings sections
    // e.g., /settings/profile → /settings/integrations/xero
    // Without this check, both paths share "settings" as first segment,
    // so they'd incorrectly be marked as "related" and trail wouldn't rebuild
    if (segments1.length >= 2 && segments2.length >= 2) {
      const section1 = segments1[1];
      const section2 = segments2[1];

      // Different settings sections = unrelated, force trail rebuild
      if (section1 !== section2) {
        return false;
      }
    }
  }

  // Check if first segment matches (e.g., both under /jobs)
  if (segments1[0] === segments2[0]) return true;

  // Check if navigating FROM a job detail page TO an entity detail page
  // This preserves breadcrumb context when opening POs, estimates, contacts from job pages
  const isFromJobDetail = segments1[0] === 'jobs' && segments1.length >= 2 && /^\d+$/.test(segments1[1]);
  const isToEntityDetail = ENTITY_DETAIL_SECTIONS.includes(segments2[0]) && segments2.length >= 2;

  if (isFromJobDetail && isToEntityDetail) {
    return true;
  }

  return false;
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

    // Handle "view" segment - skip "view" but show the view name
    // e.g., /settings/users/view/settings → breadcrumbs show Settings > Users > Settings (view)
    if (segment === 'view') {
      // Skip the "view" segment itself, but process the view slug next
      continue;
    }

    // Check if previous segment was "view" - this is the view slug
    const prevSegment = i > 0 ? segments[i - 1] : null;
    if (prevSegment === 'view') {
      // Format view slug as readable name (e.g., "po-tasks-only" → "PO Tasks Only")
      const viewName = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const item = {
        id: `view-${segment}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pathname: currentPath + '/view/' + segment, // Full path including view
        searchParams: isLast ? searchParams?.toString() : undefined,
        displayName: viewName,
        icon: undefined, // Views don't need icons
        timestamp: Date.now(),
      };
      trail.push(item);
      continue;
    }

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
