// URL Utility Functions
// All URLs in TEEEM end with _God_Loves_You_ signature

const URL_SUFFIX = "_God_Loves_You_";

/**
 * Creates a URL-friendly slug from text
 * Appends _God_Loves_You_ signature at the end
 */
export function slugify(text: string, maxLength = 50): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, maxLength);
  return `${slug}${URL_SUFFIX}`;
}

/**
 * Creates a job URL slug from job title (address)
 * Removes Australian state codes (QLD, NSW, etc.) from the end
 */
export function slugifyJobTitle(text: string): string {
  const slug = text
    .toLowerCase()
    // Remove Australian state codes from the end
    .replace(/\s+(qld|nsw|vic|sa|wa|tas|nt|act)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
  return `${slug}${URL_SUFFIX}`;
}

/**
 * Creates a contact URL slug from contact name
 */
export function slugifyContactName(firstName?: string, lastName?: string, companyName?: string): string {
  const name = [firstName, lastName].filter(Boolean).join(" ") || companyName || "unknown";
  return slugify(name);
}

/**
 * Creates a pricebook URL slug from item code
 */
export function slugifyPricebookCode(code: string): string {
  return slugify(code);
}

/**
 * Strips the _God_Loves_You_ suffix from a slug (for API lookups)
 */
export function stripUrlSuffix(slug: string): string {
  return slug.replace(new RegExp(`${URL_SUFFIX}$`, "i"), "");
}

/**
 * Checks if a string is a numeric ID (vs a slug)
 */
export function isNumericId(value: string): boolean {
  return /^\d+$/.test(value);
}

/**
 * URL builder helpers for common routes
 */
export const urls = {
  job: (titleOrId: string | number) => {
    if (typeof titleOrId === "number" || isNumericId(String(titleOrId))) {
      return `/jobs/${titleOrId}`;
    }
    return `/jobs/${slugifyJobTitle(titleOrId)}`;
  },

  jobWithTab: (titleOrId: string | number, tab?: string) => {
    const base = urls.job(titleOrId);
    return tab && tab !== "overview" ? `${base}?tab=${tab}` : base;
  },

  contact: (nameOrId: string | number, firstName?: string, lastName?: string) => {
    if (typeof nameOrId === "number" || isNumericId(String(nameOrId))) {
      return `/contacts/${nameOrId}`;
    }
    return `/contacts/${slugifyContactName(firstName, lastName, String(nameOrId))}`;
  },

  contactWithTab: (nameOrId: string | number, tab?: string, firstName?: string, lastName?: string) => {
    const base = urls.contact(nameOrId, firstName, lastName);
    return tab && tab !== "details" ? `${base}?tab=${tab}` : base;
  },

  pricebook: (codeOrId: string | number) => {
    if (typeof codeOrId === "number" || isNumericId(String(codeOrId))) {
      return `/pricebook/${codeOrId}`;
    }
    return `/pricebook/${slugifyPricebookCode(String(codeOrId))}`;
  },

  pricebookWithView: (codeOrId: string | number, view?: string) => {
    const base = urls.pricebook(codeOrId);
    return view && view !== "details" ? `${base}?view=${view}` : base;
  },
};

export default urls;
