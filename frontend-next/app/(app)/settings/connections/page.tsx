"use client";

import * as React from "react";
import { useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();

  // URL is SSoT for sub-tab state
  // Supports deep tabs: /settings/connections/email-accounts/sync-dashboard
  const { subTab, deepTab } = useMemo(() => {
    const parts = (pathname ?? "").replace("/settings/connections", "").split("/").filter(Boolean);
    return { subTab: parts[0] || "provider", deepTab: parts[1] || undefined };
  }, [pathname]);

  // Redirect to default sub-tab when on email-accounts without a deep tab
  // This ensures the URL always reflects the active tab for breadcrumbs
  useEffect(() => {
    if (subTab === "email-accounts" && !deepTab) {
      router.replace("/settings/connections/email-accounts/configuration", { scroll: false });
    }
  }, [subTab, deepTab, router]);

  return (
    <div className="space-y-6">
      <ConnectionsTab subTab={subTab} deepTab={deepTab} basePath="/settings/connections" />
    </div>
  );
}
