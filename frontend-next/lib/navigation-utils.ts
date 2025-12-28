/**
 * Navigation Utilities - SSoT for route parent relationships
 *
 * This file defines the canonical parent routes for back navigation.
 * Used by BackButton component to determine where to go when there's
 * no browser history (external links, bookmarks, direct URLs).
 */

/**
 * Route parent mappings for predictable back navigation.
 *
 * Format: "child-route-pattern" -> "parent-route"
 *
 * Patterns support:
 * - [id] for numeric IDs
 * - [code] for string codes (like pricebook)
 * - [slug] for dynamic slugs
 *
 * When adding new routes, add the parent mapping here to ensure
 * consistent back navigation behavior.
 */
export const ROUTE_PARENTS: Record<string, string> = {
  // ============================================================
  // JOBS HIERARCHY
  // ============================================================
  "/jobs/[id]": "/jobs",
  "/jobs/[id]/colours": "/jobs/[id]",
  "/jobs/[id]/specifications": "/jobs/[id]",
  "/jobs/[id]/schedule": "/jobs/[id]",
  "/jobs/[id]/analytics": "/jobs/[id]",
  "/jobs/[id]/dashboard": "/jobs/[id]",
  "/jobs/[id]/field": "/jobs/[id]",
  "/jobs/[id]/resources": "/jobs/[id]",
  "/jobs/[id]/setup": "/jobs/[id]",
  "/jobs/new": "/jobs",

  // ============================================================
  // CONTACTS HIERARCHY
  // ============================================================
  "/contacts/[id]": "/contacts",
  "/contacts/new": "/contacts",
  "/contacts/duplicates": "/contacts",
  "/contacts/quality-review": "/contacts",

  // ============================================================
  // LEADS HIERARCHY
  // ============================================================
  "/leads/[id]": "/leads",
  "/leads/emails": "/leads",

  // ============================================================
  // CASES HIERARCHY
  // ============================================================
  "/cases/[id]": "/cases",
  "/cases/new": "/cases",

  // ============================================================
  // PURCHASE ORDERS HIERARCHY
  // ============================================================
  "/purchase_orders/[id]": "/purchase_orders",
  "/purchase_orders/new": "/purchase_orders",

  // ============================================================
  // PRICEBOOK HIERARCHY
  // ============================================================
  "/pricebook/[code]": "/pricebook",
  "/pricebook/health": "/pricebook",

  // ============================================================
  // CORPORATE HIERARCHY
  // ============================================================
  "/corporate/companies/[id]": "/corporate",
  "/corporate/companies/new": "/corporate",
  "/corporate/assets": "/corporate",
  "/corporate/assets/[id]": "/corporate/assets",
  "/corporate/assets/new": "/corporate/assets",
  "/corporate/assets/reports": "/corporate/assets",
  "/corporate/structure/[id]": "/corporate",
  "/corporate/directors": "/corporate",
  "/corporate/asic-logins": "/corporate",
  "/corporate/compliance-calendar": "/corporate",
  "/corporate/health": "/corporate",
  "/corporate/minute-templates": "/corporate",
  "/corporate/consolidation": "/corporate",
  "/corporate/document-types": "/corporate",

  // ============================================================
  // FINANCE HIERARCHY
  // ============================================================
  "/finance/bills/[id]": "/finance",
  "/finance/invoices/[id]": "/finance",
  "/finance/payments": "/finance",
  "/finance/settings": "/finance",
  "/financial/transactions": "/financial",
  "/financial/reports": "/financial",
  "/financial/tas": "/financial",

  // ============================================================
  // WHS HIERARCHY
  // ============================================================
  "/whs/inductions": "/whs",
  "/whs/inspections": "/whs",
  "/whs/incidents": "/whs",
  "/whs/swms": "/whs",
  "/whs/action-items": "/whs",
  "/whs/dashboard": "/whs",

  // ============================================================
  // SCHEDULE TEMPLATES HIERARCHY
  // ============================================================
  "/schedule-templates/[id]": "/schedule-templates",
  "/schedule-templates/[id]/gantt": "/schedule-templates/[id]",
  "/schedule-templates/editor": "/schedule-templates",

  // ============================================================
  // E-SIGNATURE HIERARCHY
  // ============================================================
  "/e-signature/[id]": "/e-signature",
  "/e-signature/prepare": "/e-signature",

  // ============================================================
  // WORKFLOWS HIERARCHY
  // ============================================================
  "/workflows/designer/[id]": "/workflows",
  "/workflows/designer-v2/[id]": "/workflows",
  "/workflows/processes": "/workflows",

  // ============================================================
  // SETTINGS HIERARCHY
  // ============================================================
  "/settings/integrations": "/settings",
  "/settings/integrations/xero": "/settings/integrations",
  "/settings/integrations/microsoft": "/settings/integrations",
  "/settings/documents": "/settings",

  // ============================================================
  // EMAIL HIERARCHY
  // ============================================================
  "/email/rules": "/email",
  "/email/settings": "/email",

  // ============================================================
  // ADMIN HIERARCHY
  // ============================================================
  "/admin/saas-customers/[id]": "/admin",
  "/admin/document-templates": "/admin",
  "/admin/training": "/admin",
  "/admin/referrers": "/admin",
  "/admin/permissions": "/admin",
  "/admin/site-presence": "/admin",
  "/admin/support-tickets": "/admin",
  "/admin/users": "/admin",
  "/admin/system/document-types/[id]": "/admin/system?tab=document-types",
  "/admin/system/extract-employees": "/admin/system",

  // ============================================================
  // TRAINING HIERARCHY
  // ============================================================
  "/training/[sessionId]": "/training",

  // ============================================================
  // MEETINGS HIERARCHY
  // ============================================================
  "/meetings/new": "/meetings",

  // ============================================================
  // DESIGNER HIERARCHY
  // ============================================================
  "/designer/new": "/designer",

  // ============================================================
  // RECIPES HIERARCHY
  // ============================================================
  "/recipes/[id]": "/recipes",

  // ============================================================
  // FOUNDATION / DYNAMIC PAGES
  // ============================================================
  // Dynamic [slug] pages - handled by fallback logic
  "/t/[id]": "/dashboard",

  // ============================================================
  // DEFAULT FALLBACK
  // ============================================================
  "__default__": "/dashboard",
};

/**
 * Normalizes a pathname by replacing numeric IDs with [id],
 * URL-encoded segments with [code], etc.
 *
 * @param pathname - The current URL pathname
 * @returns Normalized pattern for lookup
 */
function normalizePathname(pathname: string): string {
  // Remove trailing slash
  let normalized = pathname.replace(/\/$/, "");

  // Replace numeric IDs with [id]
  normalized = normalized.replace(/\/\d+(?=\/|$)/g, "/[id]");

  // For pricebook, the code segment might be URL-encoded
  // Replace the segment after /pricebook/ with [code]
  if (normalized.startsWith("/pricebook/")) {
    const parts = normalized.split("/");
    if (parts.length === 3 && parts[2] !== "[id]") {
      parts[2] = "[code]";
      normalized = parts.join("/");
    }
  }

  return normalized;
}

/**
 * Gets the parent route for a given pathname.
 *
 * Lookup order:
 * 1. Exact match in ROUTE_PARENTS (normalized)
 * 2. Fallback: go up one level in the path
 * 3. Default: /dashboard
 *
 * @param pathname - The current URL pathname
 * @returns The parent route to navigate to
 */
export function getParentRoute(pathname: string): string {
  const normalized = normalizePathname(pathname);

  // Check for exact match in our mapping
  if (ROUTE_PARENTS[normalized]) {
    let parent = ROUTE_PARENTS[normalized];

    // If parent contains [id], replace with actual ID from pathname
    if (parent.includes("[id]")) {
      const idMatch = pathname.match(/\/(\d+)/);
      if (idMatch) {
        parent = parent.replace("[id]", idMatch[1]);
      }
    }

    return parent;
  }

  // Fallback: go up one level
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) {
    return ROUTE_PARENTS["__default__"];
  }

  // Remove last segment
  segments.pop();

  const parentPath = "/" + segments.join("/");

  // If parent is empty or just "/", go to dashboard
  return parentPath || ROUTE_PARENTS["__default__"];
}

/**
 * Checks if a route should have a back button.
 *
 * Top-level entry points (dashboard, admin, corporate, etc.)
 * should NOT have a back button.
 *
 * @param pathname - The current URL pathname
 * @returns Whether the route should show a back button
 */
export function shouldShowBackButton(pathname: string): boolean {
  const topLevelRoutes = [
    "/dashboard",
    "/admin",
    "/corporate",
    "/finance",
    "/financial",
    "/whs",
    "/training",
    "/xero",
    "/workflows",
    "/e-signature",
    "/documents",
    "/designer",
    "/profile",
    "/schedule-master",
    "/data-warehouse",
    "/chat",
    "/plans",
    "/meeting-types",
    "/company-groups",
    "/system-performance",
    "/system-health",
    "/gantt-schedule",
    "/public-holidays",
    "/import",
    "/design-system",
    "/brand-guidelines",
  ];

  // Remove trailing slash for comparison
  const cleanPath = pathname.replace(/\/$/, "");

  return !topLevelRoutes.includes(cleanPath);
}
