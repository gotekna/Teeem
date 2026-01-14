"use client";

import * as React from "react";
import { useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  const subTab = useMemo(() => {
    const parts = pathname.replace("/settings/corporate", "").split("/").filter(Boolean);
    return parts[0] || undefined;
  }, [pathname]);

  // Redirect to default tab if no tab in URL
  useEffect(() => {
    if (!pathname.includes("/settings/corporate/")) {
      router.replace(`/settings/corporate/${DEFAULT_TAB}`, { scroll: false });
    }
  }, [pathname, router]);

  return <CorporateTab subTab={subTab} basePath="/settings/corporate" />;
}
