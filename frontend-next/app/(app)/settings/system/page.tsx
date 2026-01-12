"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import system-related tab components from admin
import { NavigationTab } from "@/app/(app)/admin/system/components/NavigationTab";
import { AgentsTab } from "@/app/(app)/admin/system/components/AgentsTab";
import { ScheduledJobsTab } from "@/app/(app)/admin/system/components/ScheduledJobsTab";
import { AiProcessingTab } from "@/app/(app)/admin/system/components/AiProcessingTab";
import { XeroHealthTab } from "@/app/(app)/admin/system/components/XeroHealthTab";

/**
 * System Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for system-level configuration.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 */

const SYSTEM_TABS = [
  { id: "navigation", label: "Navigation" },
  { id: "agents", label: "AI Agents" },
  { id: "scheduled-jobs", label: "Scheduled Jobs" },
  { id: "ai-processing", label: "AI Processing" },
  { id: "health", label: "System Health" },
];

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = React.useState("navigation");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">System Configuration</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure navigation, AI agents, scheduled jobs, and system health monitoring
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
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
        </div>
      </Tabs>
    </div>
  );
}
