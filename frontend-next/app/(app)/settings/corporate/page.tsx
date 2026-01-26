"use client";

import * as React from "react";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { CorporateTab } from "@/app/(app)/admin/system/components/CorporateTab";

/**
 * Corporate Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for corporate structure management.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/corporate/[tab]
 */

const DEFAULT_TAB = "groups";

export default function CorporateSettingsPage() {
  const pathname = usePathname();

  // URL is SSoT for tab state (path-based navigation)
  // Default to DEFAULT_TAB if no tab specified - no redirect needed
  // This allows breadcrumb navigation to /settings/corporate to work
  const subTab = useMemo(() => {
    const parts = pathname.replace("/settings/corporate", "").split("/").filter(Boolean);
    return parts[0] || DEFAULT_TAB;
  }, [pathname]);

  return <CorporateTab subTab={subTab} basePath="/settings/corporate" />;
}
