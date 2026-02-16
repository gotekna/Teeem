"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathTabs } from "@/hooks/usePathTabs";

// Import system-related tab components from admin
import { NavigationTab } from "@/app/(app)/admin/system/components/NavigationTab";
import { AgentsTab } from "@/app/(app)/admin/system/components/AgentsTab";
import { ScheduledJobsTab } from "@/app/(app)/admin/system/components/ScheduledJobsTab";
import { AiProcessingTab } from "@/app/(app)/admin/system/components/AiProcessingTab";
import { XeroHealthTab } from "@/app/(app)/admin/system/components/XeroHealthTab";
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
  { id: "ai-processing", label: "AI Processing" },
  { id: "health", label: "System Health" },
  { id: "user-manual", label: "User Manual" },
  { id: "inspiring-quotes", label: "Inspiring Quotes" },
];

const DEFAULT_TAB = "navigation";

export default function SystemSettingsPage() {
  // URL is SSoT for tab state (path-based navigation)
  // redirectToDefault ensures URL always includes tab for breadcrumb visibility
  const [activeTab, setActiveTab] = usePathTabs(
    "/settings/system",
    DEFAULT_TAB,
    SYSTEM_TABS.map(t => t.id),
    { redirectToDefault: true }
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
