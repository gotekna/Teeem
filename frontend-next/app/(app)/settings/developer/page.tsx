"use client";

import * as React from "react";
import { useCallback, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import developer-related tab components from admin
import { GoldStandardTab } from "@/app/(app)/admin/system/components/GoldStandardTab";
import { DeveloperToolsTab } from "@/app/(app)/admin/system/components/DeveloperToolsTab";
import { EntityConfigurationTab } from "@/app/(app)/admin/system/components/EntityConfigurationTab";
import { UnrealEngineTab } from "@/app/(app)/admin/system/components/UnrealEngineTab";

/**
 * Developer Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for developer tools and configuration.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/developer/[tab]
 */

const DEVELOPER_TABS = [
  { id: "components", label: "Components Lab" },
  { id: "tools", label: "Developer Tools" },
  { id: "entity-config", label: "Entity Config" },
  { id: "unreal-engine", label: "Unreal Engine" },
];

const DEFAULT_TAB = "components";

export default function DeveloperSettingsPage() {
  const pathname = usePathname();
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  const activeTab = useMemo(() => {
    const parts = pathname.replace("/settings/developer", "").split("/").filter(Boolean);
    const tab = parts[0] || DEFAULT_TAB;
    // Validate tab exists
    return DEVELOPER_TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB;
  }, [pathname]);

  // Redirect to default tab if no tab in URL
  useEffect(() => {
    if (!pathname.includes("/settings/developer/")) {
      router.replace(`/settings/developer/${DEFAULT_TAB}`, { scroll: false });
    }
  }, [pathname, router]);

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
            <GoldStandardTab />
          </TabsContent>
          <TabsContent value="tools">
            <DeveloperToolsTab />
          </TabsContent>
          <TabsContent value="entity-config">
            <EntityConfigurationTab />
          </TabsContent>
          <TabsContent value="unreal-engine">
            <UnrealEngineTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
