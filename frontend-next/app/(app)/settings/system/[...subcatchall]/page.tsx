/**
 * Settings System Catch-All Route
 *
 * SSoT: Handles both:
 * 1. Tab navigation: /settings/system/navigation, /settings/system/agents, etc.
 * 2. Legacy redirects: /settings/system/entity-config/* → /admin/system/entity-config/*
 *
 * Tab navigation re-exports the parent page, allowing URL-based tab state.
 */

import { redirect } from "next/navigation";
import SystemSettingsPage from "../page";

// Valid tab IDs that should render the system settings page
const VALID_TABS = [
  "navigation",
  "agents",
  "scheduled-jobs",
  "email-accounts",
  "ai-processing",
  "health",
  "user-manual",
  "inspiring-quotes",
];

// Legacy paths that should redirect to admin
const PATH_REDIRECTS: Record<string, string> = {
  "entity-config": "/admin/system/entity-config",
  "schedule-master": "/admin/system/schedule-master",
};

interface SystemCatchAllProps {
  params: Promise<{ subcatchall: string[] }>;
}

export default async function SystemSettingsCatchAll({ params }: SystemCatchAllProps) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.subcatchall || [];
  const firstSegment = pathSegments[0];

  // If it's a valid tab, render the system settings page (URL is SSoT for tab state)
  if (firstSegment && VALID_TABS.includes(firstSegment)) {
    return <SystemSettingsPage />;
  }

  // Handle legacy redirects to admin pages
  if (firstSegment && PATH_REDIRECTS[firstSegment]) {
    const additionalPath = pathSegments.slice(1).join("/");
    const basePath = PATH_REDIRECTS[firstSegment];
    const targetUrl = additionalPath ? `${basePath}/${additionalPath}` : basePath;
    redirect(targetUrl);
  }

  // Unknown path - redirect to system settings root
  redirect("/settings/system");
}
