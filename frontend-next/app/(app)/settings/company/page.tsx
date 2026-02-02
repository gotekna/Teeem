"use client";

import * as React from "react";
import { useCallback, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  { id: "offline", label: "Offline" },
];

const DEFAULT_TAB = "info";

export default function CompanySettingsPage() {
  const pathname = usePathname();
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  // Default to DEFAULT_TAB if no tab specified - no redirect needed
  // This allows breadcrumb navigation to /settings/company to work
  // SSoT (Jan 2026): Connections moved to top-level /settings/connections
  const { activeTab, subTab } = useMemo(() => {
    const parts = (pathname ?? "").replace("/settings/company", "").split("/").filter(Boolean);
    const tab = parts[0] || DEFAULT_TAB;
    const sub = parts[1] || undefined;
    // Validate tab exists
    // For warehouse-config tab without subTab, default to "warehouse_folders"
    const validTab = COMPANY_TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB;
    let effectiveSubTab = sub;
    if (validTab === "warehouse-config" && !sub) effectiveSubTab = "warehouse_folders";
    return {
      activeTab: validTab,
      subTab: effectiveSubTab,
    };
  }, [pathname]);

  // Redirect to include default sub-tab in URL for breadcrumb visibility
  // This keeps URL as SSoT for current tab state
  // SSoT (Jan 2026): Connections redirect removed - now at /settings/connections
  useEffect(() => {
    const parts = (pathname ?? "").replace("/settings/company", "").split("/").filter(Boolean);
    const urlHasSubTab = parts.length >= 2;

    // Redirect tabs with default sub-tabs to full URL
    if (!urlHasSubTab) {
      if (activeTab === "warehouse-config") {
        router.replace(`/settings/company/warehouse-config/warehouse_folders`, { scroll: false });
      }
    }
  }, [pathname, activeTab, router]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/settings/company/${tabId}`, { scroll: false });
  }, [router]);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
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

        <div className="mt-6">
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
            <JobSetupTab subTab={subTab} basePath="/settings/company/job-setup" />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab subTab={subTab} basePath="/settings/company/documents" />
          </TabsContent>
          <TabsContent value="warehouse-config">
            <EntityConfigurationTab subTab={subTab} basePath="/settings/company/warehouse-config" />
          </TabsContent>
          <TabsContent value="offline">
            <OfflineTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
