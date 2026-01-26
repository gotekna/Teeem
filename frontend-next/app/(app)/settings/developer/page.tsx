"use client";

import * as React from "react";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import developer-related tab components from admin
// SSoT: Entity Config moved to Company settings
import { GoldStandardTab } from "@/app/(app)/admin/system/components/GoldStandardTab";
import { DeveloperToolsTab } from "@/app/(app)/admin/system/components/DeveloperToolsTab";
import { UnrealEngineTab } from "@/app/(app)/admin/system/components/UnrealEngineTab";
import { BrandGuidelinesTab } from "@/app/(app)/admin/system/components/BrandGuidelinesTab";
import EmailResellerDashboard from "@/app/(app)/settings/email-reseller/page";

/**
 * Developer Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for developer tools and configuration.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/developer/[tab]
 */

// SSoT: Entity Config moved to Company settings
const DEVELOPER_TABS = [
  { id: "components", label: "Components Lab" },
  { id: "tools", label: "Developer Tools" },
  { id: "email-reseller", label: "Email Reseller" },
  { id: "brand-guidelines", label: "Brand Guidelines" },
  { id: "unreal-engine", label: "Unreal Engine" },
];

const DEFAULT_TAB = "components";

export default function DeveloperSettingsPage() {
  const pathname = usePathname();
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  // Default to DEFAULT_TAB if no tab specified - no redirect needed
  // This allows breadcrumb navigation to /settings/developer to work
  const { activeTab, subtab } = useMemo(() => {
    const parts = pathname.replace("/settings/developer", "").split("/").filter(Boolean);
    const tab = parts[0] || DEFAULT_TAB;
    const sub = parts[1] || undefined;  // e.g., "document-types" from /settings/developer/components/document-types
    // Validate tab exists
    const validTab = DEVELOPER_TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB;
    return { activeTab: validTab, subtab: sub };
  }, [pathname]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/settings/developer/${tabId}`, { scroll: false });
  }, [router]);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          {DEVELOPER_TABS.map((tab) => (
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
          <TabsContent value="components" className="h-full">
            <GoldStandardTab subtab={subtab} basePath="/settings/developer/components" />
          </TabsContent>
          <TabsContent value="tools">
            <DeveloperToolsTab />
          </TabsContent>
          <TabsContent value="email-reseller">
            <EmailResellerDashboard />
          </TabsContent>
          <TabsContent value="brand-guidelines">
            <BrandGuidelinesTab />
          </TabsContent>
          <TabsContent value="unreal-engine">
            <UnrealEngineTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
