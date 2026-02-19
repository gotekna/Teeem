"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { usePathTabs } from "@/hooks/usePathTabs";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";
import { GstCodesTab } from "./components/GstCodesTab";
import { UomTab } from "./components/UomTab";
import TeeemTableView from "@/components/table/TeeemTableView";

/**
 * Tables Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for table/lookup data configuration.
 * URL is SSoT for tab state: /settings/tables/[tab]
 *
 * Sub-tabs:
 * - pricebook: Pricebook Categories (TeeemTableView)
 * - brands: Pricebook Brands (TeeemTableView)
 * - ranges: Pricebook Ranges (TeeemTableView)
 * - accounts: GST Codes (custom table)
 * - uom: Units of Measure (custom table)
 */

const TABLES_TABS = [
  { id: "pricebook", label: "Pricebook" },
  { id: "brands", label: "Brands" },
  { id: "ranges", label: "Ranges" },
  { id: "accounts", label: "Accounts" },
  { id: "uom", label: "UOM" },
];

const DEFAULT_TAB = "pricebook";

export default function TablesSettingsPage() {
  useSetLayoutMode("full-height");

  const [activeTab, setActiveTab] = usePathTabs(
    "/settings/tables",
    DEFAULT_TAB,
    TABLES_TABS.map((t) => t.id),
    { redirectToDefault: true }
  );

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <TabsList className="flex-wrap h-auto gap-1 shrink-0">
          {TABLES_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 min-h-0 mt-4 relative">
          <TabsContent value="pricebook" className="absolute inset-0 overflow-auto">
            <div className="flex flex-col h-full -mx-4">
              <TeeemTableView
                foundationId={FOUNDATION_SLUGS.PRICEBOOK_CATEGORIES}
                autoFetchRecords={true}
              />
            </div>
          </TabsContent>

          <TabsContent value="brands" className="absolute inset-0 overflow-auto">
            <div className="flex flex-col h-full -mx-4">
              <TeeemTableView
                foundationId={FOUNDATION_SLUGS.PRICEBOOK_BRANDS}
                autoFetchRecords={true}
              />
            </div>
          </TabsContent>

          <TabsContent value="ranges" className="absolute inset-0 overflow-auto">
            <div className="flex flex-col h-full -mx-4">
              <TeeemTableView
                foundationId={FOUNDATION_SLUGS.PRICEBOOK_RANGES}
                autoFetchRecords={true}
              />
            </div>
          </TabsContent>

          <TabsContent value="accounts" className="absolute inset-0 overflow-auto">
            <GstCodesTab />
          </TabsContent>

          <TabsContent value="uom" className="absolute inset-0 overflow-auto">
            <UomTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
