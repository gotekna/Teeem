"use client";

import * as React from "react";
import { useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ConnectionsTab } from "@/app/(app)/admin/system/components/ConnectionsTab";
import { ROUTES } from "@/lib/constants/route-paths";

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

  // Redirect to include default tab/sub-tab in URL for breadcrumb visibility
  useEffect(() => {
    const parts = (pathname ?? "").replace("/settings/connections", "").split("/").filter(Boolean);
    if (parts.length === 0) {
      // No tab specified - redirect to default
      router.replace(ROUTES.SETTINGS.CONNECTIONS_PROVIDER, { scroll: false });
    } else if (subTab === "email-accounts" && !deepTab) {
      // email-accounts has deep tabs - redirect to default deep tab
      router.replace(ROUTES.SETTINGS.CONNECTIONS_EMAIL_ACCOUNTS, { scroll: false });
    }
  }, [pathname, subTab, deepTab, router]);

  return (
    <div className="space-y-6">
      <ConnectionsTab subTab={subTab} deepTab={deepTab} basePath="/settings/connections" />
    </div>
  );
}
