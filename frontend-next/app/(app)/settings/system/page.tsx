"use client";

import * as React from "react";
import { useCallback, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import system-related tab components from admin
import { NavigationTab } from "@/app/(app)/admin/system/components/NavigationTab";
import { AgentsTab } from "@/app/(app)/admin/system/components/AgentsTab";
import { ScheduledJobsTab } from "@/app/(app)/admin/system/components/ScheduledJobsTab";
import { AiProcessingTab } from "@/app/(app)/admin/system/components/AiProcessingTab";
import { XeroHealthTab } from "@/app/(app)/admin/system/components/XeroHealthTab";
import { EmailAccountsTab } from "@/app/(app)/admin/system/components/EmailAccountsTab";
import { UserManualTab } from "@/app/(app)/admin/system/components/UserManualTab";
import { InspiringQuotesTab } from "@/app/(app)/admin/system/components/InspiringQuotesTab";

/**
 * System Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for system-level configuration.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/system/[tab]
 */

const SYSTEM_TABS = [
  { id: "navigation", label: "Navigation" },
  { id: "agents", label: "AI Agents" },
  { id: "scheduled-jobs", label: "Scheduled Jobs" },
  { id: "email-accounts", label: "Email Accounts" },
  { id: "ai-processing", label: "AI Processing" },
  { id: "health", label: "System Health" },
  { id: "user-manual", label: "User Manual" },
  { id: "inspiring-quotes", label: "Inspiring Quotes" },
];

const DEFAULT_TAB = "navigation";

export default function SystemSettingsPage() {
  const pathname = usePathname();
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  const activeTab = useMemo(() => {
    const parts = pathname.replace("/settings/system", "").split("/").filter(Boolean);
    const tab = parts[0] || DEFAULT_TAB;
    // Validate tab exists
    return SYSTEM_TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB;
  }, [pathname]);

  // Redirect to default tab if no tab in URL
  useEffect(() => {
    if (!pathname.includes("/settings/system/")) {
      router.replace(`/settings/system/${DEFAULT_TAB}`, { scroll: false });
    }
  }, [pathname, router]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/settings/system/${tabId}`, { scroll: false });
  }, [router]);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          {SYSTEM_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="text-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="navigation">
            <NavigationTab />
          </TabsContent>
          <TabsContent value="agents">
            <AgentsTab />
          </TabsContent>
          <TabsContent value="scheduled-jobs">
            <ScheduledJobsTab />
          </TabsContent>
          <TabsContent value="email-accounts">
            <EmailAccountsTab />
          </TabsContent>
          <TabsContent value="ai-processing">
            <AiProcessingTab />
          </TabsContent>
          <TabsContent value="health">
            <XeroHealthTab />
          </TabsContent>
          <TabsContent value="user-manual">
            <UserManualTab />
          </TabsContent>
          <TabsContent value="inspiring-quotes">
            <InspiringQuotesTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
