"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { usePathTabs } from "@/hooks/usePathTabs";

// Import operations-related tab components from admin
import { ContactTypesTab } from "@/app/(app)/admin/system/components/ContactTypesTab";
import { MeetingTypesTab } from "@/app/(app)/admin/system/components/MeetingTypesTab";
import { SupervisorChecklistTab } from "@/app/(app)/admin/system/components/SupervisorChecklistTab";
import { SMTasksTab } from "@/app/(app)/admin/system/components/SMTasksTab";
import { CostTab } from "@/app/(app)/admin/system/components/CostTab";
import { PoTemplatesTab } from "@/app/(app)/admin/system/components/PoTemplatesTab";
import { ClaimTemplatesTab } from "@/app/(app)/admin/system/components/ClaimTemplatesTab";
import { ProfitCentresTab } from "./components/ProfitCentresTab";
import { TenderHeadersTab } from "./components/TenderHeadersTab";
import { TenderSectionsTab } from "./components/TenderSectionsTab";

/**
 * Operations Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for operations configuration.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/operations/[tab]
 *
 * Schedule Master and PO Templates open as full-page routes
 * (handled by fullPageRoutes in settings/layout.tsx).
 */

const OPERATIONS_TABS = [
  { id: "schedule-master", label: "Schedule Master" },
  { id: "sm-tasks", label: "SM Tasks" },
  { id: "contacts", label: "Contact Types" },
  { id: "meetings", label: "Meeting Types" },
  { id: "supervisor", label: "Supervisor Checklist" },
  { id: "cost", label: "Cost" },
  { id: "po-templates", label: "PO Templates" },
  { id: "claim-templates", label: "Claim Templates" },
  { id: "profit-centres", label: "Profit Centres" },
  { id: "tender-headers", label: "Tender Headers" },
  { id: "tender-sections", label: "Tender Sections" },
];

const DEFAULT_TAB = "schedule-master";

// Tabs that navigate to their own full-page route instead of rendering inline
const FULL_PAGE_TABS: Record<string, string> = {
  "schedule-master": "/settings/operations/schedule-master",
  "po-templates": "/settings/operations/po-templates",
};

export default function OperationsSettingsPage() {
  const router = useRouter();

  // Tab panels use absolute inset-0 positioning, which requires full-height layout
  useSetLayoutMode("full-height");

  // URL is SSoT for tab state (path-based navigation)
  // redirectToDefault ensures URL always includes tab for breadcrumb visibility
  const [activeTab, setActiveTab] = usePathTabs(
    "/settings/operations",
    DEFAULT_TAB,
    OPERATIONS_TABS.map(t => t.id),
    { redirectToDefault: true }
  );

  const handleTabChange = React.useCallback((value: string) => {
    const fullPageRoute = FULL_PAGE_TABS[value];
    if (fullPageRoute) {
      router.push(fullPageRoute);
    } else {
      setActiveTab(value);
    }
  }, [router, setActiveTab]);

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
          <TabsContent value="po-templates" className="absolute inset-0 overflow-auto">
            <PoTemplatesTab />
          </TabsContent>
          <TabsContent value="claim-templates" className="absolute inset-0 overflow-auto">
            <ClaimTemplatesTab />
          </TabsContent>
          <TabsContent value="profit-centres" className="absolute inset-0 h-full">
            <ProfitCentresTab />
          </TabsContent>
          <TabsContent value="tender-headers" className="absolute inset-0 h-full">
            <TenderHeadersTab />
          </TabsContent>
          <TabsContent value="tender-sections" className="absolute inset-0 h-full">
            <TenderSectionsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
