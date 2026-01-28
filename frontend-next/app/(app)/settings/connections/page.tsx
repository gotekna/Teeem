"use client";

import * as React from "react";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ConnectionsTab } from "@/app/(app)/admin/system/components/ConnectionsTab";

/**
 * Connections Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for all external connections:
 * - Storage Provider (SharePoint, S3/Wasabi, etc.)
 * - Integrations (Xero, Cloudflare)
 * - Migration tools
 * - Cost Comparison
 *
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/connections/[tab]
 *
 * SSoT Note (Jan 2026): Connections is now top-level in Settings.
 * Previously was under /settings/company/connections.
 */

export default function ConnectionsSettingsPage() {
  const pathname = usePathname();

  // URL is SSoT for sub-tab state
  const subTab = useMemo(() => {
    const parts = pathname.replace("/settings/connections", "").split("/").filter(Boolean);
    return parts[0] || "provider";
  }, [pathname]);

  return (
    <div className="space-y-6">
      <ConnectionsTab subTab={subTab} basePath="/settings/connections" />
    </div>
  );
}
