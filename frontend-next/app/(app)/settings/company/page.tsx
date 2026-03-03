"use client";

import * as React from "react";
import { useMemo, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathTabs } from "@/hooks/usePathTabs";
import { ExpandableSection, ExpandButton, useExpandedState } from "@/components/ui/expandable-section";

// Import company-related tab components from admin
// SSoT: Security & Permissions moved to /settings/roles (consolidated Access Control page)
// SSoT: Corporate moved to /settings/corporate (top-level Organization tab)
import { HolidaysTab } from "@/app/(app)/admin/system/components/HolidaysTab";
import { WorkflowsTab } from "@/app/(app)/admin/system/components/WorkflowsTab";
import { BrandColorsTab } from "@/app/(app)/admin/system/components/BrandColorsTab";
// SSoT (Jan 2026): ConnectionsTab moved to top-level /settings/connections
import { JobSetupTab } from "@/app/(app)/admin/system/components/JobSetupTab";
import { DocumentsTab } from "@/app/(app)/admin/system/components/DocumentsTab";
import { EntityConfigurationTab } from "@/app/(app)/admin/system/components/EntityConfigurationTab";
import CompanyInfoTab from "@/app/(app)/admin/system/components/CompanyInfoTab";
import { OfflineTab } from "@/app/(app)/admin/system/components/OfflineTab";
import { DataHealthTab } from "@/components/settings/DataHealthTab";

/**
 * Company Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for company configuration.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/company/[tab]
 *
 * SSoT Note: Security & Permissions have been consolidated into /settings/roles
 * SSoT Note: Corporate moved to /settings/corporate (top-level Organization tab)
 */

// SSoT: Brand Guidelines moved to /settings/developer (developer tool)
// SSoT: Workflow Config moved under Job Setup as sub-tab
// SSoT: Documents consolidated here (was separate Organization tab)
// SSoT: Warehouse Config (was Entity Config) moved here from Developer
// SSoT (Jan 2026): Connections moved to top-level /settings/connections
// SSoT (Feb 2026): entity-config renamed to warehouse-config for consistency
const COMPANY_TABS = [
  { id: "info", label: "Info" },
  { id: "brand-colors", label: "Brand Colors" },
  { id: "documents", label: "Documents" },
  { id: "holidays", label: "Holidays" },
  { id: "workflows", label: "Workflows" },
  { id: "job-setup", label: "Job Setup" },
  { id: "warehouse-config", label: "Warehouse Config" },
  { id: "data-health", label: "Data Health" },
  { id: "offline", label: "Offline" },
];

const DEFAULT_TAB = "info";

export default function CompanySettingsPage() {
  const router = useRouter();
  const [expanded, toggleExpanded] = useExpandedState("company");

  // URL is SSoT for tab state (path-based navigation)
  // redirectToDefault ensures URL always includes tab for breadcrumb visibility
  // SSoT (Jan 2026): Connections moved to top-level /settings/connections
  const [activeTab, setActiveTab, subTab] = usePathTabs(
    "/settings/company",
    DEFAULT_TAB,
    COMPANY_TABS.map(t => t.id),
    { redirectToDefault: true }
  );

  // Parse deepTab from URL for warehouse-config (third level)
  // Must use usePathname() for reactivity - window.location doesn't trigger re-renders
  const pathname = usePathname();
  const deepTab = useMemo(() => {
    const parts = (pathname ?? "").replace("/settings/company", "").split("/").filter(Boolean);
    return parts[2] || undefined;
  }, [pathname]);

  // Apply default sub-tab for tabs that have sub-tabs
  const effectiveSubTab = useMemo(() => {
    let sub = subTab;
    if (activeTab === "warehouse-config" && !sub) sub = "warehouse_folders";
    if (activeTab === "data-health" && !sub) sub = "overview";
    if (activeTab === "job-setup" && !sub) sub = "lists";
    if (activeTab === "documents" && !sub) sub = "types";
    return sub;
  }, [activeTab, subTab]);

  // Redirect to include default sub-tab in URL for breadcrumb visibility
  // This keeps URL as SSoT for current tab state
  useEffect(() => {
    const parts = (pathname ?? "").replace("/settings/company", "").split("/").filter(Boolean);
    const urlHasSubTab = parts.length >= 2;

    // Redirect tabs with default sub-tabs to full URL
    if (!urlHasSubTab) {
      if (activeTab === "warehouse-config") {
        router.replace(`/settings/company/warehouse-config/warehouse_folders`, { scroll: false });
      } else if (activeTab === "data-health") {
        router.replace(`/settings/company/data-health/overview`, { scroll: false });
      } else if (activeTab === "job-setup") {
        router.replace(`/settings/company/job-setup/lists`, { scroll: false });
      } else if (activeTab === "documents") {
        router.replace(`/settings/company/documents/types`, { scroll: false });
      }
    }
  }, [activeTab, router, pathname]);

  return (
    <ExpandableSection expanded={expanded} onToggle={toggleExpanded}>
      <div className={expanded ? "flex flex-col h-full" : "flex flex-col gap-6 pb-8"}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className={expanded ? "flex flex-col h-full flex-1 min-h-0" : ""}>
          <div className={expanded ? "px-4 pt-3 pb-2 shrink-0" : ""}>
            <div className="flex items-start gap-2">
              <TabsList className="flex-wrap h-auto gap-1 flex-1 min-w-0">
                {COMPANY_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="text-xs sm:text-sm whitespace-nowrap"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {!expanded && <ExpandButton expanded={expanded} onToggle={toggleExpanded} />}
            </div>
          </div>

          <div className={expanded ? "flex-1 overflow-auto p-4" : "mt-6"}>
            <TabsContent value="info">
              <CompanyInfoTab />
            </TabsContent>
            <TabsContent value="brand-colors">
              <BrandColorsTab />
            </TabsContent>
            <TabsContent value="holidays">
              <HolidaysTab />
            </TabsContent>
            <TabsContent value="workflows">
              <WorkflowsTab />
            </TabsContent>
            {/* SSoT (Jan 2026): Connections moved to top-level /settings/connections */}
            <TabsContent value="job-setup">
              <JobSetupTab subTab={effectiveSubTab} basePath="/settings/company/job-setup" />
            </TabsContent>
            <TabsContent value="documents">
              <DocumentsTab subTab={effectiveSubTab} deepTab={deepTab} basePath="/settings/company/documents" />
            </TabsContent>
            <TabsContent value="warehouse-config">
              <EntityConfigurationTab subTab={effectiveSubTab} deepTab={deepTab} basePath="/settings/company/warehouse-config" />
            </TabsContent>
            <TabsContent value="data-health">
              <DataHealthTab subTab={effectiveSubTab} basePath="/settings/company/data-health" />
            </TabsContent>
            <TabsContent value="offline">
              <OfflineTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </ExpandableSection>
  );
}
