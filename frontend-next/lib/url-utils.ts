// URL Utility Functions
// All URLs in TEEEM use clean format: /{slug}?tab={tab}
// Note: tableId has been removed from URLs - we use slug-based routing now

import { getTableIds, getTableSlug, initTableIds } from '@/hooks/useTableIds';

// Initialize table IDs from API on module load
// This runs once when the module is first imported
if (typeof window !== 'undefined') {
  initTableIds();
}

/**
 * Table ID mappings - fetched from API with fallback defaults
 *
 * IMPORTANT: These values come from the database via /api/v1/foundations/table_ids
 * Do NOT hardcode table IDs - they are auto-incrementing and may differ between environments
 *
 * Use getTableIds() for dynamic access, or TABLE_IDS for static references
 * (TABLE_IDS uses cached values that are populated on app load)
 */
export const TABLE_IDS = {
  get GOLD_STANDARD() { return getTableIds().GOLD_STANDARD; },
  get JOBS() { return getTableIds().JOBS; },
  get TASKS() { return getTableIds().TASKS; },
  get PRICEBOOK() { return getTableIds().PRICEBOOK; },
  get CONTACTS() { return getTableIds().CONTACTS; },
  get COMPANIES() { return getTableIds().COMPANIES; },
  get FEATURES_TRACKING() { return getTableIds().FEATURES_TRACKING; },
} as const;

// Table names for URL slugs - dynamically resolved
export const TABLE_SLUGS: Record<number, string> = new Proxy({} as Record<number, string>, {
  get(_, prop) {
    if (typeof prop === 'string' && !isNaN(Number(prop))) {
      return getTableSlug(Number(prop));
    }
    return undefined;
  },
});

// Legacy route mappings (for backwards compatibility)
// NOTE: 353 is a route hint for corporate, but Foundation 353 doesn't exist.
// Corporate uses Rails models (CorporateCompany) directly.
export const TABLE_ROUTES: Record<number, string> = {
  1: "admin/system",
  204: "jobs",
  205: "pricebook",
  214: "contacts",
  // 353: "corporate", // Removed - Foundation 353 doesn't exist
  375: "dashboard",
};

/**
 * Creates a URL-friendly slug from text
 */
export function slugify(text: string, maxLength = 50): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, maxLength);
}

/**
 * Build a table URL with the format: /{slug}?tab={tab}
 * @param slug - The database_table_name (e.g., "jobs", "sm_tasks", "gold_standard_items")
 * @param tab - Optional tab name
 */
export function buildTableUrl(slug: string, tab?: string): string {
  // Use the slug directly - it should already be a database_table_name (lowercase with underscores)
  const baseSlug = slug.toLowerCase();
  const base = `/${baseSlug}`;
  return tab ? `${base}?tab=${tab}` : base;
}

/**
 * @deprecated Use buildTableUrl(slug, tab) instead - tableId removed from URLs
 */
export function buildTableUrlLegacy(tableId: number, slug: string, tab?: string): string {
  const baseSlug = slugify(slug);
  const base = `/${tableId}/${baseSlug}`;
  return tab ? `${base}?tab=${tab}` : base;
}

/**
 * Build a table item URL: /{tableSlug}/{itemId}?tab={tab}
 * @param tableSlug - The table slug (e.g., "jobs", "contacts")
 * @param itemId - The item ID or slug
 * @param itemName - Optional item name for readable URL
 * @param tab - Optional tab name
 */
export function buildItemUrl(
  tableSlug: string,
  itemId: number | string,
  itemName?: string,
  tab?: string
): string {
  // For item URLs, we use /{tableSlug}/{itemId}
  const base = `/${slugify(tableSlug)}/${itemId}`;
  return tab ? `${base}?tab=${tab}` : base;
}

/**
 * @deprecated Use buildItemUrl(tableSlug, itemId, itemName, tab) instead
 */
export function buildItemUrlLegacy(
  tableId: number,
  itemId: number | string,
  itemName?: string,
  tab?: string
): string {
  let slug: string;
  if (itemName) {
    slug = `${slugify(itemName)}-${itemId}`;
  } else {
    slug = `item-${itemId}`;
  }
  return buildTableUrlLegacy(tableId, slug, tab);
}

/**
 * Parse a TEEEM URL to extract tableId, slug, and tab
 */
export function parseTableUrl(pathname: string, searchParams?: URLSearchParams): {
  tableId: number | null;
  slug: string | null;
  tab: string | null;
  itemId: string | null;
} {
  // Match /{tableId}/{slug}
  const match = pathname.match(/^\/(\d+)\/(.+)$/i);
  if (!match) {
    return { tableId: null, slug: null, tab: null, itemId: null };
  }

  const tableId = parseInt(match[1], 10);
  const slug = match[2];
  const tab = searchParams?.get("tab") || null;

  // Extract item ID from slug if present (e.g., "job-123-smith-st" -> "123")
  const itemMatch = slug.match(/-(\d+)(?:-|$)/);
  const itemId = itemMatch ? itemMatch[1] : null;

  return { tableId, slug, tab, itemId };
}

/**
 * Strips any legacy URL suffix from a slug (for backwards compatibility)
 * @deprecated No longer needed - URLs are clean now
 */
export function stripUrlSuffix(slug: string): string {
  return slug.replace(/_GOD_LOVES_YOU_$/i, "");
}

/**
 * Checks if a string is a numeric ID
 */
export function isNumericId(value: string): boolean {
  return /^\d+$/.test(value);
}

/**
 * URL builder helpers for common routes
 * Format: /{slug}?tab={tab}
 */
export const urls = {
  // === TABLE LIST PAGES ===
  // All slugs use database_table_name format (underscores, lowercase)

  jobs: (tab?: string) => buildTableUrl("jobs", tab),
  tasks: (tab?: string) => buildTableUrl("tasks", tab),
  contacts: (tab?: string) => buildTableUrl("contacts", tab),
  pricebook: (tab?: string) => tab ? `/pricebook?tab=${tab}` : "/pricebook", // Custom route, not using _GOD_LOVES_YOU_ suffix
  companies: (tab?: string) => buildTableUrl("companies", tab),
  goldStandard: (tab?: string) => buildTableUrl("gold_standard_items", tab),
  features: (tab?: string) => buildTableUrl("features_tracking", tab),

  // === ITEM DETAIL PAGES ===

  job: (idOrTitle: number | string, title?: string, tab?: string) => {
    if (typeof idOrTitle === "number") {
      return buildItemUrl("jobs", idOrTitle, title, tab);
    }
    // If string, it might be a title - slugify it
    const slug = slugify(String(idOrTitle)
      .replace(/\s+(qld|nsw|vic|sa|wa|tas|nt|act)$/i, ""));
    return buildTableUrl(slug, tab);
  },

  contact: (idOrName: number | string, name?: string, tab?: string) => {
    if (typeof idOrName === "number") {
      return buildItemUrl("contacts", idOrName, name, tab);
    }
    const slug = slugify(String(idOrName));
    return buildTableUrl(slug, tab);
  },

  pricebookItem: (idOrCode: number | string, code?: string, tab?: string) => {
    if (typeof idOrCode === "number") {
      return buildItemUrl("pricebook", idOrCode, code, tab);
    }
    const slug = slugify(String(idOrCode));
    return buildTableUrl(slug, tab);
  },

  company: (idOrName: number | string, name?: string, tab?: string) => {
    if (typeof idOrName === "number") {
      return buildItemUrl("companies", idOrName, name, tab);
    }
    const slug = slugify(String(idOrName));
    return buildTableUrl(slug, tab);
  },

  // === GENERIC TABLE URL ===

  table: (tableId: number, slug?: string, tab?: string) => {
    const tableName = TABLE_SLUGS[tableId] || `table-${tableId}`;
    return buildTableUrl(slug || tableName, tab);
  },

  tableItem: (tableId: number, itemId: number | string, itemName?: string, tab?: string) => {
    const tableName = TABLE_SLUGS[tableId] || `table-${tableId}`;
    return buildItemUrl(tableName, itemId, itemName, tab);
  },
};

// Legacy exports for backwards compatibility
export function slugifyJobTitle(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/\s+(qld|nsw|vic|sa|wa|tas|nt|act)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
  return slug;
}

export function slugifyContactName(firstName?: string, lastName?: string, companyName?: string): string {
  const name = [firstName, lastName].filter(Boolean).join(" ") || companyName || "unknown";
  return slugify(name);
}

export function slugifyPricebookCode(code: string): string {
  // Use URL encoding instead of slugify to preserve periods and special characters
  // Backend will decode this and search by exact item_code
  return encodeURIComponent(code);
}

export default urls;
