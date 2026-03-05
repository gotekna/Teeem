"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { usePathTabs } from "@/hooks/usePathTabs";
import { ExpandableSection, ExpandButton, useExpandedState } from "@/components/ui/expandable-section";

// Import operations-related tab components from admin
import { ScheduleMasterTab } from "@/app/(app)/admin/system/components/ScheduleMasterTab";
import { ContactTypesTab } from "@/app/(app)/admin/system/components/ContactTypesTab";
import { MeetingTypesTab } from "@/app/(app)/admin/system/components/MeetingTypesTab";
import { SupervisorChecklistTab } from "@/app/(app)/admin/system/components/SupervisorChecklistTab";
import { SMTasksTab } from "@/app/(app)/admin/system/components/SMTasksTab";
import { CostTab } from "@/app/(app)/admin/system/components/CostTab";
import { PoTemplatesTab } from "@/app/(app)/admin/system/components/PoTemplatesTab";
import { QuoteTemplatesTab } from "./components/QuoteTemplatesTab";
import { CustomQuoteTemplatesTab } from "./components/CustomQuoteTemplatesTab";
import { ClaimTemplatesTab } from "@/app/(app)/admin/system/components/ClaimTemplatesTab";
import { ProfitCentresTab } from "./components/ProfitCentresTab";
import { CostCentresTab } from "./components/CostCentresTab";
import { TenderHeadersTab } from "./components/TenderHeadersTab";
import { TenderSectionsTab } from "./components/TenderSectionsTab";
import { TenderDocumentTemplatesTab } from "./components/TenderDocumentTemplatesTab";
import { MarkupDefaultsTab } from "./components/MarkupDefaultsTab";
import { QbccBracketsTab } from "./components/QbccBracketsTab";
import { MarkupTemplatesTab } from "./components/MarkupTemplatesTab";
import { PropertySettingsTab } from "./components/PropertySettingsTab";


/**
 * Operations Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for operations configuration.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/operations/[tab]
 *
 * All tabs render inline with expand-to-fullscreen button.
 */

const OPERATIONS_TABS = [
  { id: "schedule-master", label: "Schedule Master" },
  { id: "sm-tasks", label: "SM Tasks" },
  { id: "contacts", label: "Contact Types" },
  { id: "meetings", label: "Meeting Types" },
  { id: "supervisor", label: "Supervisor Checklist" },
  { id: "cost", label: "Cost" },
  { id: "po-templates", label: "PO Templates" },
  { id: "quote-templates", label: "Quote Templates" },
  { id: "claim-templates", label: "Claim Templates" },
  { id: "profit-centres", label: "Profit Centres" },
  { id: "cost-centres", label: "Cost Centres" },
  { id: "tender-headers", label: "Tender Headers" },
  { id: "tender-sections", label: "Tender Sections" },
  { id: "tender-documents", label: "Tender Documents" },
  { id: "markup", label: "Markup" },
  { id: "properties", label: "Properties" },
];

const DEFAULT_TAB = "schedule-master";

/** Sub-tabs within Quote Templates: Std + Custom */
function QuoteTemplatesWrapper() {
  const [subTab, setSubTab] = React.useState("std");
  const [subExpanded, toggleSubExpanded] = useExpandedState("quote-templates");

  return (
    <ExpandableSection expanded={subExpanded} onToggle={toggleSubExpanded}>
      <Tabs value={subTab} onValueChange={setSubTab} className="flex flex-col h-full">
        <div className="flex items-center gap-2 mx-4 mt-2">
          <TabsList className="w-fit">
            <TabsTrigger value="std">Std Quote Templates</TabsTrigger>
            <TabsTrigger value="custom">Custom Quote Templates</TabsTrigger>
          </TabsList>
          {!subExpanded && <ExpandButton expanded={subExpanded} onToggle={toggleSubExpanded} />}
        </div>
        <div className="flex-1 min-h-0 mt-2">
          <TabsContent value="std" className="h-full overflow-auto">
            <QuoteTemplatesTab />
          </TabsContent>
          <TabsContent value="custom" className="h-full overflow-auto">
            <CustomQuoteTemplatesTab />
          </TabsContent>
        </div>
      </Tabs>
    </ExpandableSection>
  );
}

/** Sub-tabs within Markup: Defaults + QBCC Brackets */
function MarkupWrapper() {
  const [subTab, setSubTab] = React.useState("defaults");
  const [subExpanded, toggleSubExpanded] = useExpandedState("markup");

  return (
    <ExpandableSection expanded={subExpanded} onToggle={toggleSubExpanded}>
      <Tabs value={subTab} onValueChange={setSubTab} className="flex flex-col h-full">
        <div className="flex items-center gap-2 mx-4 mt-2">
          <TabsList className="w-fit">
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="qbcc">QBCC Brackets</TabsTrigger>
          </TabsList>
          {!subExpanded && <ExpandButton expanded={subExpanded} onToggle={toggleSubExpanded} />}
        </div>
        <div className="flex-1 min-h-0 mt-2">
          <TabsContent value="defaults" className="h-full overflow-auto">
            <MarkupDefaultsTab />
          </TabsContent>
          <TabsContent value="templates" className="h-full overflow-auto">
            <MarkupTemplatesTab />
          </TabsContent>
          <TabsContent value="qbcc" className="h-full overflow-auto">
            <QbccBracketsTab />
          </TabsContent>
        </div>
      </Tabs>
    </ExpandableSection>
  );
}

export default function OperationsSettingsPage() {
  const [expanded, toggleExpanded] = useExpandedState("operations");

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

  return (
    <ExpandableSection expanded={expanded} onToggle={toggleExpanded}>
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className={expanded ? "flex flex-col h-full flex-1 min-h-0" : "flex flex-col h-full"}>
        <div className={expanded ? "px-4 pt-3 pb-2 shrink-0" : ""}>
          <div className="flex items-start gap-2">
            <TabsList className="flex-wrap h-auto gap-1 shrink-0 flex-1 min-w-0">
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
            {!expanded && <ExpandButton expanded={expanded} onToggle={toggleExpanded} />}
          </div>
        </div>

        <div className={expanded ? "flex-1 min-h-0 relative" : "flex-1 min-h-0 mt-4 relative"}>
          <TabsContent value="schedule-master" className="absolute inset-0 overflow-auto">
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
          <TabsContent value="po-templates" className="absolute inset-0 overflow-auto">
            <PoTemplatesTab />
          </TabsContent>
          <TabsContent value="quote-templates" className="absolute inset-0 overflow-auto">
            <QuoteTemplatesWrapper />
          </TabsContent>
          <TabsContent value="claim-templates" className="absolute inset-0 overflow-auto">
            <ClaimTemplatesTab />
          </TabsContent>
          <TabsContent value="profit-centres" className="absolute inset-0 h-full">
            <ProfitCentresTab />
          </TabsContent>
          <TabsContent value="cost-centres" className="absolute inset-0 h-full">
            <CostCentresTab />
          </TabsContent>
          <TabsContent value="tender-headers" className="absolute inset-0 h-full">
            <TenderHeadersTab />
          </TabsContent>
          <TabsContent value="tender-sections" className="absolute inset-0 h-full">
            <TenderSectionsTab />
          </TabsContent>
          <TabsContent value="tender-documents" className="absolute inset-0 overflow-auto">
            <TenderDocumentTemplatesTab />
          </TabsContent>
          <TabsContent value="markup" className="absolute inset-0 overflow-auto">
            <MarkupWrapper />
          </TabsContent>
          <TabsContent value="properties" className="absolute inset-0 overflow-auto">
            <PropertySettingsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
    </ExpandableSection>
  );
}
