import { redirect } from "next/navigation";

/**
 * Settings System Catch-All Route
 *
 * SSoT: Handles invalid/legacy paths under /settings/system/* that don't
 * have explicit pages. Without this, Next.js would fall through to the
 * root [slug] route and try to load "settings" as a Foundation.
 *
 * Path mappings:
 * - /settings/system/entity-config/* → /admin/system/entity-config/*
 * - /settings/system/schedule-master/* → /admin/system/schedule-master/*
 * - Other paths → /settings/system (main system settings page)
 */

// Map paths to their correct locations
// NOTE: Base paths should NOT include default sub-paths like /data-view
// because getRedirectUrl() appends additional path segments
const PATH_REDIRECTS: Record<string, string> = {
  // Entity configuration still lives under admin (developer tools)
  "entity-config": "/admin/system/entity-config",

  // Schedule Master stays under admin (default to data-view if no sub-path)
  "schedule-master": "/admin/system/schedule-master",
};

function getRedirectUrl(pathSegments: string[]): string {
  if (pathSegments.length === 0) {
    return "/settings/system";
  }

  const firstSegment = pathSegments[0];

  // Check for known paths that should go to admin
  if (PATH_REDIRECTS[firstSegment]) {
    // Preserve any additional path segments
    const additionalPath = pathSegments.slice(1).join("/");
    const basePath = PATH_REDIRECTS[firstSegment];
    return additionalPath ? `${basePath}/${additionalPath}` : basePath;
  }

  // Unknown path - go to system settings root
  return "/settings/system";
}

interface SystemCatchAllProps {
  params: Promise<{ subcatchall: string[] }>;
}

export default async function SystemSettingsCatchAll({ params }: SystemCatchAllProps) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.subcatchall || [];
  const targetUrl = getRedirectUrl(pathSegments);

  redirect(targetUrl);
}
