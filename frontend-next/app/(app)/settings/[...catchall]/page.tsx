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
const PATH_REDIRECTS: Record<string, string> = {
  // Entity Configuration deep links → Developer tab
  "system/entity-config": "/settings/developer?tab=entity-config",
  "system/entity-configuration": "/settings/developer?tab=entity-config",
  "developer/entity-config": "/settings/developer?tab=entity-config",

  // Component deep links → Developer tab
  "system/components": "/settings/developer?tab=components",
  "developer/components": "/settings/developer?tab=components",

  // Navigation deep links → System tab
  "system/navigation": "/settings/system?tab=navigation",

  // Schedule Master deep links → Operations tab
  "system/schedule-master": "/settings/operations?tab=schedule-master",

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

  // Check for prefix matches (handles deep links like system/entity-config/sharepoint_config)
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
