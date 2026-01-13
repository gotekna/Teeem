"use client";

import * as React from "react";
import { useCallback, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import operations-related tab components from admin
import { ScheduleMasterTab } from "@/app/(app)/admin/system/components/ScheduleMasterTab";
import { ContactTypesTab } from "@/app/(app)/admin/system/components/ContactTypesTab";
import { MeetingTypesTab } from "@/app/(app)/admin/system/components/MeetingTypesTab";
import { SupervisorChecklistTab } from "@/app/(app)/admin/system/components/SupervisorChecklistTab";
import { SMTasksTab } from "@/app/(app)/admin/system/components/SMTasksTab";
import { CostTab } from "@/app/(app)/admin/system/components/CostTab";

/**
 * Operations Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for operations configuration.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/operations/[tab]
 */

const OPERATIONS_TABS = [
  { id: "schedule-master", label: "Schedule Master" },
  { id: "sm-tasks", label: "SM Tasks" },
  { id: "contacts", label: "Contact Types" },
  { id: "meetings", label: "Meeting Types" },
  { id: "supervisor", label: "Supervisor Checklist" },
  { id: "cost", label: "Cost" },
];

const DEFAULT_TAB = "schedule-master";

export default function OperationsSettingsPage() {
  const pathname = usePathname();
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  const activeTab = useMemo(() => {
    const parts = pathname.replace("/settings/operations", "").split("/").filter(Boolean);
    const tab = parts[0] || DEFAULT_TAB;
    // Validate tab exists
    return OPERATIONS_TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB;
  }, [pathname]);

  // Redirect to default tab if no tab in URL
  useEffect(() => {
    if (!pathname.includes("/settings/operations/")) {
      router.replace(`/settings/operations/${DEFAULT_TAB}`, { scroll: false });
    }
  }, [pathname, router]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/settings/operations/${tabId}`, { scroll: false });
  }, [router]);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          {OPERATIONS_TABS.map((tab) => (
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
          <TabsContent value="schedule-master" className="h-full">
            <ScheduleMasterTab />
          </TabsContent>
          <TabsContent value="sm-tasks" className="h-full">
            <SMTasksTab />
          </TabsContent>
          <TabsContent value="contacts">
            <ContactTypesTab />
          </TabsContent>
          <TabsContent value="meetings">
            <MeetingTypesTab />
          </TabsContent>
          <TabsContent value="supervisor">
            <SupervisorChecklistTab />
          </TabsContent>
          <TabsContent value="cost">
            <CostTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
