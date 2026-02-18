"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { usePathTabs } from "@/hooks/usePathTabs";
import { GstCodesTab } from "./components/GstCodesTab";

/**
 * Accounts Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for accounting configuration.
 * URL is SSoT for tab state: /settings/accounts/[tab]
 */

const ACCOUNTS_TABS = [
  { id: "gst-table", label: "GST Table" },
];

const DEFAULT_TAB = "gst-table";

export default function AccountsSettingsPage() {
  useSetLayoutMode("full-height");

  const [activeTab, setActiveTab] = usePathTabs(
    "/settings/accounts",
    DEFAULT_TAB,
    ACCOUNTS_TABS.map((t) => t.id),
    { redirectToDefault: true }
  );

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <TabsList className="flex-wrap h-auto gap-1 shrink-0">
          {ACCOUNTS_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 min-h-0 mt-4 relative">
          <TabsContent value="gst-table" className="absolute inset-0 overflow-auto">
            <GstCodesTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
