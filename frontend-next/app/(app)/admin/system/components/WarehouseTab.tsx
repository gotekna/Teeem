"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Folder } from "lucide-react";
import { DocumentTypesTab } from "./DocumentTypesTab";
import { FoldersTabsConfigTab } from "./FoldersTabsConfigTab";

const WAREHOUSE_TABS = [
  { id: "document-types", label: "Document Types", icon: FileText },
  { id: "folders-tabs", label: "Folders & Tabs", icon: Folder },
];

export function WarehouseTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subtab = searchParams.get("subtab") || "document-types";

  const handleSubtabChange = (value: string) => {
    router.push(`/admin/system?tab=warehouse&subtab=${value}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Data Warehouse Configuration</h2>
      </div>

      <Tabs value={subtab} onValueChange={handleSubtabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {WAREHOUSE_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="text-xs sm:text-sm whitespace-nowrap gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="document-types" className="mt-6">
          <DocumentTypesTab />
        </TabsContent>

        <TabsContent value="folders-tabs" className="mt-6">
          <FoldersTabsConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
