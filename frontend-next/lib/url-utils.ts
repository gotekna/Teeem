// URL Utility Functions
// All URLs in TEEEM use format: /{tableId}/{slug}_GOD_LOVES_YOU_?tab={tab}

const URL_SUFFIX = "_GOD_LOVES_YOU_";

// Table ID mappings - Single Source of Truth
export const TABLE_IDS = {
  GOLD_STANDARD: 1,
  JOBS: 204,
  PRICEBOOK: 205,
  CONTACTS: 214,
  COMPANIES: 353,
  FEATURES_TRACKING: 375,
} as const;

// Table names for URL slugs
export const TABLE_SLUGS: Record<number, string> = {
  1: "gold-standard",
  204: "jobs",
  205: "pricebook",
  214: "contacts",
  353: "companies",
  375: "features",
};

// Legacy route mappings (for backwards compatibility)
export const TABLE_ROUTES: Record<number, string> = {
  1: "admin/system",
  204: "jobs",
  205: "pricebook",
  214: "contacts",
  353: "corporate",
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
 * Build a table URL with the format: /{tableId}/{slug}_GOD_LOVES_YOU_?tab={tab}
 * @param tableId - The table ID (e.g., 204 for Jobs)
 * @param slug - The slug (e.g., "jobs" or "job-123-smith-st")
 * @param tab - Optional tab name
 */
export function buildTableUrl(tableId: number, slug: string, tab?: string): string {
  const baseSlug = slugify(slug);
  const base = `/${tableId}/${baseSlug}${URL_SUFFIX}`;
  return tab ? `${base}?tab=${tab}` : base;
}

/**
 * Build a table item URL: /{tableId}/{itemSlug}_GOD_LOVES_YOU_?tab={tab}
 * @param tableId - The table ID
 * @param itemId - The item ID or slug
 * @param itemName - Optional item name for readable URL
 * @param tab - Optional tab name
 */
export function buildItemUrl(
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
  return buildTableUrl(tableId, slug, tab);
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
  // Match /{tableId}/{slug}_GOD_LOVES_YOU_
  const match = pathname.match(/^\/(\d+)\/(.+)_GOD_LOVES_YOU_$/i);
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
 * Strips the _GOD_LOVES_YOU_ suffix from a slug
 */
export function stripUrlSuffix(slug: string): string {
  return slug.replace(new RegExp(`${URL_SUFFIX}$`, "i"), "");
}

/**
 * Checks if a string is a numeric ID
 */
export function isNumericId(value: string): boolean {
  return /^\d+$/.test(value);
}

/**
 * URL builder helpers for common routes
 * Format: /{tableId}/{slug}_GOD_LOVES_YOU_?tab={tab}
 */
export const urls = {
  // === TABLE LIST PAGES ===

  jobs: (tab?: string) => buildTableUrl(TABLE_IDS.JOBS, "jobs", tab),
  contacts: (tab?: string) => buildTableUrl(TABLE_IDS.CONTACTS, "contacts", tab),
  pricebook: (tab?: string) => buildTableUrl(TABLE_IDS.PRICEBOOK, "pricebook", tab),
  companies: (tab?: string) => buildTableUrl(TABLE_IDS.COMPANIES, "companies", tab),
  goldStandard: (tab?: string) => buildTableUrl(TABLE_IDS.GOLD_STANDARD, "gold-standard", tab),
  features: (tab?: string) => buildTableUrl(TABLE_IDS.FEATURES_TRACKING, "features", tab),

  // === ITEM DETAIL PAGES ===

  job: (idOrTitle: number | string, title?: string, tab?: string) => {
    if (typeof idOrTitle === "number") {
      return buildItemUrl(TABLE_IDS.JOBS, idOrTitle, title, tab);
    }
    // If string, it might be a title - slugify it
    const slug = slugify(String(idOrTitle)
      .replace(/\s+(qld|nsw|vic|sa|wa|tas|nt|act)$/i, ""));
    return buildTableUrl(TABLE_IDS.JOBS, slug, tab);
  },

  contact: (idOrName: number | string, name?: string, tab?: string) => {
    if (typeof idOrName === "number") {
      return buildItemUrl(TABLE_IDS.CONTACTS, idOrName, name, tab);
    }
    const slug = slugify(String(idOrName));
    return buildTableUrl(TABLE_IDS.CONTACTS, slug, tab);
  },

  pricebookItem: (idOrCode: number | string, code?: string, tab?: string) => {
    if (typeof idOrCode === "number") {
      return buildItemUrl(TABLE_IDS.PRICEBOOK, idOrCode, code, tab);
    }
    const slug = slugify(String(idOrCode));
    return buildTableUrl(TABLE_IDS.PRICEBOOK, slug, tab);
  },

  company: (idOrName: number | string, name?: string, tab?: string) => {
    if (typeof idOrName === "number") {
      return buildItemUrl(TABLE_IDS.COMPANIES, idOrName, name, tab);
    }
    const slug = slugify(String(idOrName));
    return buildTableUrl(TABLE_IDS.COMPANIES, slug, tab);
  },

  // === GENERIC TABLE URL ===

  table: (tableId: number, slug?: string, tab?: string) => {
    const tableName = TABLE_SLUGS[tableId] || `table-${tableId}`;
    return buildTableUrl(tableId, slug || tableName, tab);
  },

  tableItem: (tableId: number, itemId: number | string, itemName?: string, tab?: string) => {
    return buildItemUrl(tableId, itemId, itemName, tab);
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
  return `${slug}${URL_SUFFIX}`;
}

export function slugifyContactName(firstName?: string, lastName?: string, companyName?: string): string {
  const name = [firstName, lastName].filter(Boolean).join(" ") || companyName || "unknown";
  return `${slugify(name)}${URL_SUFFIX}`;
}

export function slugifyPricebookCode(code: string): string {
  return `${slugify(code)}${URL_SUFFIX}`;
}

export default urls;
