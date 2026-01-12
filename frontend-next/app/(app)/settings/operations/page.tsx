"use client";

import * as React from "react";
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
 */

const OPERATIONS_TABS = [
  { id: "schedule-master", label: "Schedule Master" },
  { id: "sm-tasks", label: "SM Tasks" },
  { id: "contacts", label: "Contact Types" },
  { id: "meetings", label: "Meeting Types" },
  { id: "supervisor", label: "Supervisor Checklist" },
  { id: "cost", label: "Cost" },
];

export default function OperationsSettingsPage() {
  const [activeTab, setActiveTab] = React.useState("schedule-master");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Operations Configuration</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure Schedule Master, contacts, meetings, and operational workflows
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
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
