"use client";

import * as React from "react";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import operations-related tab components from admin
import { ScheduleMasterTab } from "@/app/(app)/admin/system/components/ScheduleMasterTab";
import { ContactTypesTab } from "@/app/(app)/admin/system/components/ContactTypesTab";
import { MeetingTypesTab } from "@/app/(app)/admin/system/components/MeetingTypesTab";
import { SupervisorChecklistTab } from "@/app/(app)/admin/system/components/SupervisorChecklistTab";
import { SMTasksTab } from "@/app/(app)/admin/system/components/SMTasksTab";
import { CostTab } from "@/app/(app)/admin/system/components/CostTab";
import { PoTemplatesTab } from "@/app/(app)/admin/system/components/PoTemplatesTab";

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
  { id: "po-templates", label: "PO Templates" },
];

const DEFAULT_TAB = "schedule-master";

export default function OperationsSettingsPage() {
  const pathname = usePathname();
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  // Default to DEFAULT_TAB if no tab specified - no redirect needed
  // This allows breadcrumb navigation to /settings/operations to work
  const activeTab = useMemo(() => {
    const parts = (pathname ?? "").replace("/settings/operations", "").split("/").filter(Boolean);
    const tab = parts[0] || DEFAULT_TAB;
    // Validate tab exists
    return OPERATIONS_TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB;
  }, [pathname]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/settings/operations/${tabId}`, { scroll: false });
  }, [router]);

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full">
        <TabsList className="flex-wrap h-auto gap-1 shrink-0">
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

        <div className="flex-1 min-h-0 mt-4 relative">
          <TabsContent value="schedule-master" className="absolute inset-0 h-full">
            <ScheduleMasterTab basePath="/settings/operations/schedule-master" />
          </TabsContent>
          <TabsContent value="sm-tasks" className="absolute inset-0 overflow-auto">
            <SMTasksTab />
          </TabsContent>
          <TabsContent value="contacts" className="absolute inset-0 overflow-auto">
            <ContactTypesTab />
          </TabsContent>
          <TabsContent value="meetings" className="absolute inset-0 overflow-auto">
            <MeetingTypesTab />
          </TabsContent>
          <TabsContent value="supervisor" className="absolute inset-0 overflow-auto">
            <SupervisorChecklistTab />
          </TabsContent>
          <TabsContent value="cost" className="absolute inset-0 overflow-auto">
            <CostTab />
          </TabsContent>
          <TabsContent value="po-templates" className="absolute inset-0 overflow-auto border-4 border-green-500 bg-green-50 dark:bg-green-950">
            <PoTemplatesTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
