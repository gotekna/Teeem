import { redirect } from "next/navigation";

/**
 * Settings Catch-All Route
 *
 * SSoT: Handles ALL invalid/legacy settings paths before they fall through
 * to the root [slug]/[...tab] catch-all (which treats them as foundations).
 *
 * This is the SSoT for settings URL resolution:
 * 1. Specific settings pages match first (/settings/profile, /settings/system, etc.)
 * 2. This catch-all handles everything else under /settings/*
 * 3. Redirects to appropriate locations based on path patterns
 *
 * Why this exists:
 * - Prevents "/settings/system/entity-config/foo" from being treated as foundation "settings"
 * - Maps legacy admin-style URLs to new settings structure
 * - Provides graceful handling of invalid settings URLs
 */

// Map legacy/deep paths to their correct settings locations
// SSoT: All redirects use path-based URLs (not query params)
const PATH_REDIRECTS: Record<string, string> = {
  // Entity Configuration deep links → Admin System (where EntityConfigurationTab lives)
  // These need to go to admin/system, not settings/developer
  "system/entity-config": "/admin/system/entity-config/corporate_entity",
  "system/entity-configuration": "/admin/system/entity-config/corporate_entity",
  "developer/entity-config": "/admin/system/entity-config/corporate_entity",

  // Component deep links → Developer tab (path-based)
  "system/components": "/settings/developer/components",
  "developer/components": "/settings/developer/components",

  // Navigation deep links → System tab (path-based)
  "system/navigation": "/settings/system/navigation",

  // Schedule Master deep links → Admin System (correct location)
  "system/schedule-master": "/admin/system/schedule-master/data-view",

  // Legacy admin-style paths
  "admin": "/settings/users",
  "users/new": "/settings/users",
  "roles/new": "/settings/roles",
};

function getRedirectUrl(pathSegments: string[]): string {
  const fullPath = pathSegments.join("/");

  // Check for exact match first
  if (PATH_REDIRECTS[fullPath]) {
    return PATH_REDIRECTS[fullPath];
  }

  // Special handling for entity-config deep links (preserve the scope)
  // e.g., system/entity-config/storage_config → /admin/system/entity-config/storage_config
  if (fullPath.startsWith("system/entity-config/") || fullPath.startsWith("system/entity-configuration/")) {
    const scope = pathSegments[2] || "corporate_entity";
    return `/admin/system/entity-config/${scope}`;
  }

  // Special handling for schedule-master deep links (preserve sub-paths)
  // e.g., system/schedule-master/tables/sm_trades → /admin/system/schedule-master/tables/sm_trades
  if (fullPath.startsWith("system/schedule-master/")) {
    const subPath = pathSegments.slice(2).join("/") || "data-view";
    return `/admin/system/schedule-master/${subPath}`;
  }

  // Check for prefix matches (handles deep links)
  for (const [pattern, target] of Object.entries(PATH_REDIRECTS)) {
    if (fullPath.startsWith(pattern + "/") || fullPath.startsWith(pattern)) {
      return target;
    }
  }

  // Route to appropriate section based on first segment
  const firstSegment = pathSegments[0];
  switch (firstSegment) {
    case "system":
      return "/settings/system";
    case "developer":
      return "/settings/developer";
    case "operations":
      return "/settings/operations";
    case "company":
      return "/settings/company";
    case "documents":
      return "/settings/documents";
    case "integrations":
      return "/settings/integrations";
    case "users":
      return "/settings/users";
    case "roles":
      return "/settings/roles";
    case "profile":
      return "/settings/profile";
    case "security":
      return "/settings/security";
    case "notifications":
      return "/settings/notifications";
    case "preferences":
      return "/settings/preferences";
    default:
      // Unknown path - go to settings root (which redirects to profile)
      return "/settings";
  }
}

interface SettingsCatchAllProps {
  params: Promise<{ catchall: string[] }>;
}

export default async function SettingsCatchAll({ params }: SettingsCatchAllProps) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.catchall || [];
  const targetUrl = getRedirectUrl(pathSegments);

  redirect(targetUrl);
}
