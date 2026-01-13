"use client";

import * as React from "react";
import { useCallback, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import company-related tab components from admin
import { SecurityTab } from "@/app/(app)/admin/system/components/SecurityTab";
import { PermissionsTab } from "@/app/(app)/admin/system/components/PermissionsTab";
import { CorporateTab } from "@/app/(app)/admin/system/components/CorporateTab";
import { HolidaysTab } from "@/app/(app)/admin/system/components/HolidaysTab";
import { WorkflowsTab } from "@/app/(app)/admin/system/components/WorkflowsTab";
import { BrandColorsTab } from "@/app/(app)/admin/system/components/BrandColorsTab";
import { BrandGuidelinesTab } from "@/app/(app)/admin/system/components/BrandGuidelinesTab";
import { DocumentTemplatesTab } from "@/app/(app)/admin/system/components/DocumentTemplatesTab";
import { ConnectionsTab } from "@/app/(app)/admin/system/components/ConnectionsTab";
import { JobSetupTab } from "@/app/(app)/admin/system/components/JobSetupTab";
import { WorkflowConfigTab } from "@/app/(app)/admin/system/components/WorkflowConfigTab";
import CompanyInfoTab from "@/app/(app)/admin/system/components/CompanyInfoTab";

/**
 * Company Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for company configuration.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/company/[tab]
 */

const COMPANY_TABS = [
  { id: "info", label: "Info" },
  { id: "brand-colors", label: "Brand Colors" },
  { id: "brand-guidelines", label: "Brand Guidelines" },
  { id: "doc-templates", label: "Doc Templates" },
  { id: "security", label: "Security" },
  { id: "permissions", label: "Permissions" },
  { id: "corporate", label: "Corporate" },
  { id: "holidays", label: "Holidays" },
  { id: "workflows", label: "Workflows" },
  { id: "connections", label: "Connections" },
  { id: "job-setup", label: "Job Setup" },
  { id: "workflow-config", label: "Workflow Config" },
];

const DEFAULT_TAB = "info";

export default function CompanySettingsPage() {
  const pathname = usePathname();
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  const { activeTab, subTab } = useMemo(() => {
    const parts = pathname.replace("/settings/company", "").split("/").filter(Boolean);
    const tab = parts[0] || DEFAULT_TAB;
    const sub = parts[1] || undefined;
    // Validate tab exists
    return {
      activeTab: COMPANY_TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB,
      subTab: sub,
    };
  }, [pathname]);

  // Redirect to default tab if no tab in URL
  useEffect(() => {
    if (!pathname.includes("/settings/company/")) {
      router.replace(`/settings/company/${DEFAULT_TAB}`, { scroll: false });
    }
  }, [pathname, router]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/settings/company/${tabId}`, { scroll: false });
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Company Settings</h2>
        <Link
          href="/corporate"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Go to Corporate Dashboard
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

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
          <TabsContent value="brand-guidelines">
            <BrandGuidelinesTab />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>
          <TabsContent value="permissions">
            <PermissionsTab />
          </TabsContent>
          <TabsContent value="corporate">
            <CorporateTab />
          </TabsContent>
          <TabsContent value="holidays">
            <HolidaysTab />
          </TabsContent>
          <TabsContent value="workflows">
            <WorkflowsTab />
          </TabsContent>
          <TabsContent value="connections">
            <ConnectionsTab subTab={subTab} />
          </TabsContent>
          <TabsContent value="job-setup">
            <JobSetupTab />
          </TabsContent>
          <TabsContent value="workflow-config">
            <WorkflowConfigTab />
          </TabsContent>
          <TabsContent value="doc-templates">
            <DocumentTemplatesTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
