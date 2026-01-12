"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import developer-related tab components from admin
import { GoldStandardTab } from "@/app/(app)/admin/system/components/GoldStandardTab";
import { DeveloperToolsTab } from "@/app/(app)/admin/system/components/DeveloperToolsTab";
import { EntityConfigurationTab } from "@/app/(app)/admin/system/components/EntityConfigurationTab";

/**
 * Developer Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for developer tools and configuration.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 */

const DEVELOPER_TABS = [
  { id: "components", label: "Components Lab" },
  { id: "tools", label: "Developer Tools" },
  { id: "entity-config", label: "Entity Config" },
];

export default function DeveloperSettingsPage() {
  const [activeTab, setActiveTab] = React.useState("components");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Developer Tools</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Component library, developer utilities, and entity configuration
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 p-1">
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
        </div>
      </Tabs>
    </div>
  );
}
