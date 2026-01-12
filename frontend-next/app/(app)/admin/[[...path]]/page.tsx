import { redirect } from "next/navigation";

/**
 * Admin Redirect Catch-All
 *
 * As part of the Settings/Admin merge, this page redirects old admin URLs
 * to their new locations under /settings.
 *
 * The admin section is being deprecated in favor of a unified Settings
 * with Personal and Organization sections.
 *
 * Note: This catch-all only handles paths that don't have more specific
 * page matches. Existing admin pages will still render until they're
 * moved to /settings.
 */

// URL mapping from old admin paths to new settings paths
const URL_MAP: Record<string, string> = {
  // Root redirect
  "": "/settings/users",

  // User management
  users: "/settings/users",
  permissions: "/settings/roles",

  // Training (now part of preferences)
  training: "/settings/preferences",

  // Agents
  agents: "/settings/system/agents",

  // Document templates
  "document-templates": "/settings/documents/templates",

  // Referrers
  referrers: "/settings/operations/referrers",

  // Support tickets
  "support-tickets": "/settings/system/support-tickets",

  // SaaS customers (internal admin)
  "saas-customers": "/settings/system/saas-customers",

  // Site presence
  "site-presence": "/settings/operations/site-presence",

  // System section mappings
  system: "/settings/company",
  "system/company": "/settings/company",
  "system/company/info": "/settings/company/info",
  "system/company/brand": "/settings/company/brand",
  "system/company/holidays": "/settings/company/holidays",
  "system/company/workflows": "/settings/company/workflows",

  // Schedule Master - keep in /admin/system (NOT in settings)
  // Note: This is a fallback; /admin/system/[...slug] should catch first
  "system/schedule-master": "/admin/system/schedule-master/data-view",

  // Navigation
  "system/navigation": "/settings/system/navigation",

  // Components (developer)
  "system/components": "/settings/developer/components",

  // Document types
  "system/document-types": "/settings/documents/types",

  // Email accounts
  "system/email-accounts": "/settings/integrations/email-accounts",

  // Signature register
  "system/signature-register": "/settings/system/signature-register",

  // Extract employees
  "system/extract-employees": "/settings/system/extract-employees",

  // Teeem XL
  "system/teeem-xl": "/settings/developer/teeem-xl",
  "system/teeem-xl/list": "/settings/developer/teeem-xl/list",

  // Health
  "system/health": "/settings/system/health",

  // Jobs config
  "system/jobs": "/settings/operations/jobs",

  // Contacts config
  "system/contacts": "/settings/operations/contacts",

  // Meetings config
  "system/meetings": "/settings/operations/meetings",

  // AI config
  "system/ai": "/settings/system/ai",

  // Data warehouse
  "system/data-warehouse": "/settings/developer/data-warehouse",
};

function getRedirectUrl(path: string): string {
  // Look up the mapped URL
  let targetUrl = URL_MAP[path];

  // If no exact match, try to find a prefix match for nested paths
  if (!targetUrl) {
    // Handle dynamic routes like saas-customers/123/details
    if (path.startsWith("saas-customers/")) {
      const parts = path.split("/");
      if (parts.length >= 2) {
        targetUrl = `/settings/system/saas-customers/${parts.slice(1).join("/")}`;
      }
    } else if (path.startsWith("system/document-types/")) {
      const parts = path.split("/");
      if (parts.length >= 3) {
        targetUrl = `/settings/documents/types/${parts[2]}`;
      }
    } else if (path.startsWith("system/email-accounts/")) {
      const parts = path.split("/");
      if (parts.length >= 3) {
        targetUrl = `/settings/integrations/email-accounts/${parts[2]}`;
      }
    } else if (path.startsWith("site-presence/")) {
      const parts = path.split("/");
      if (parts.length >= 2) {
        targetUrl = `/settings/operations/site-presence/${parts.slice(1).join("/")}`;
      }
    } else if (path.startsWith("system/")) {
      // Generic system/ path - redirect to settings/system
      const subPath = path.replace("system/", "");
      targetUrl = `/settings/system/${subPath}`;
    }
  }

  // Final fallback to settings root
  return targetUrl || "/settings";
}

interface AdminRedirectProps {
  params: Promise<{ path?: string[] }>;
}

export default async function AdminRedirect({ params }: AdminRedirectProps) {
  const resolvedParams = await params;
  const path = resolvedParams.path?.join("/") || "";
  const targetUrl = getRedirectUrl(path);

  redirect(targetUrl);
}
