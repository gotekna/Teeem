"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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
 * URL is SSoT for tab state: /settings/tables/{tab}/{subtab}
 *
 * Top-level tabs:
 * - pricebook: Pricebook tables
 *   - categories (default): Pricebook Categories (TeeemTableView)
 *   - brands: Pricebook Brands (TeeemTableView)
 *   - ranges: Pricebook Ranges (TeeemTableView)
 *   - uom: Units of Measure (custom table)
 * - accounts: Accounting tables
 *   - gst (default): GST Codes (custom table)
 */

const TOP_TABS = [
  { id: "pricebook", label: "Pricebook" },
  { id: "accounts", label: "Accounts" },
];

const PRICEBOOK_SUB_TABS = [
  { id: "categories", label: "Categories" },
  { id: "brands", label: "Brands" },
  { id: "ranges", label: "Ranges" },
  { id: "uom", label: "UOM" },
];

const ACCOUNTS_SUB_TABS = [
  { id: "gst", label: "GST" },
];

const DEFAULT_TAB = "pricebook";

export default function TablesSettingsPage() {
  useSetLayoutMode("full-height");
  const router = useRouter();

  const [activeTab, , subTab] = usePathTabs(
    "/settings/tables",
    DEFAULT_TAB,
    TOP_TABS.map((t) => t.id),
    { redirectToDefault: true }
  );

  // Default sub-tabs per top-level tab
  const DEFAULT_SUB_TABS: Record<string, string> = useMemo(() => ({
    pricebook: "categories",
    accounts: "gst",
  }), []);

  // Override top-level tab setter to navigate directly to default sub-tab
  const setActiveTab = useCallback((tab: string) => {
    const defaultSub = DEFAULT_SUB_TABS[tab] || "";
    router.push(`/settings/tables/${tab}/${defaultSub}`, { scroll: false });
  }, [router, DEFAULT_SUB_TABS]);

  // Determine active sub-tab based on parent tab
  const activeSubTab = useMemo(() => {
    if (activeTab === "pricebook") {
      const validSubs = PRICEBOOK_SUB_TABS.map(s => s.id);
      return subTab && validSubs.includes(subTab) ? subTab : "categories";
    }
    if (activeTab === "accounts") {
      const validSubs = ACCOUNTS_SUB_TABS.map(s => s.id);
      return subTab && validSubs.includes(subTab) ? subTab : "gst";
    }
    return undefined;
  }, [activeTab, subTab]);

  // Redirect to default sub-tab if URL is missing it (e.g., direct nav to /settings/tables/pricebook)
  useEffect(() => {
    if (!subTab && DEFAULT_SUB_TABS[activeTab]) {
      router.replace(`/settings/tables/${activeTab}/${DEFAULT_SUB_TABS[activeTab]}`, { scroll: false });
    }
  }, [activeTab, subTab, router, DEFAULT_SUB_TABS]);

  // Navigate sub-tabs via URL
  const setSubTab = useCallback((tab: string) => {
    router.push(`/settings/tables/${activeTab}/${tab}`, { scroll: false });
  }, [router, activeTab]);

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <TabsList className="flex-wrap h-auto gap-1 shrink-0">
          {TOP_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 min-h-0 mt-4 relative">
          {/* Pricebook Tab */}
          <TabsContent value="pricebook" className="absolute inset-0 flex flex-col">
            <Tabs value={activeSubTab} onValueChange={setSubTab} className="flex flex-col h-full">
              <TabsList className="flex-wrap h-auto gap-1 shrink-0">
                {PRICEBOOK_SUB_TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} className="text-sm">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 min-h-0 mt-2 relative">
                <TabsContent value="categories" className="absolute inset-0 overflow-auto">
                  <div className="flex flex-col h-full -mx-4">
                    <TeeemTableView
                      foundationId={FOUNDATION_SLUGS.PRICEBOOK_CATEGORIES}
                      tableName="Categories"
                      autoFetchRecords={true}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="brands" className="absolute inset-0 overflow-auto">
                  <div className="flex flex-col h-full -mx-4">
                    <TeeemTableView
                      foundationId={FOUNDATION_SLUGS.PRICEBOOK_BRANDS}
                      tableName="Brands"
                      autoFetchRecords={true}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="ranges" className="absolute inset-0 overflow-auto">
                  <div className="flex flex-col h-full -mx-4">
                    <TeeemTableView
                      foundationId={FOUNDATION_SLUGS.PRICEBOOK_RANGES}
                      tableName="Ranges"
                      autoFetchRecords={true}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="uom" className="absolute inset-0 overflow-auto">
                  <UomTab />
                </TabsContent>
              </div>
            </Tabs>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="absolute inset-0 flex flex-col">
            <Tabs value={activeSubTab} onValueChange={setSubTab} className="flex flex-col h-full">
              <TabsList className="flex-wrap h-auto gap-1 shrink-0">
                {ACCOUNTS_SUB_TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} className="text-sm">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 min-h-0 mt-2 relative">
                <TabsContent value="gst" className="absolute inset-0 overflow-auto">
                  <GstCodesTab />
                </TabsContent>
              </div>
            </Tabs>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
