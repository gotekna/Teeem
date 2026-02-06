"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WarehouseTypesTab } from "./WarehouseTypesTab";
import { WarehouseFoldersTab } from "./WarehouseFoldersTab";
import { Database, FolderOpen } from "lucide-react";

/**
 * WarehouseTablesTab - Combined view for warehouse database tables
 *
 * SSoT: Database-driven warehouse configuration (Feb 2026)
 * Contains sub-tabs for:
 * - Warehouse Types: The types of warehouse storage (job, contact, email, etc.)
 * - Warehouse Folders: The folder configurations for each warehouse type
 *
 * URL State: Uses ?tab= query param to persist active sub-tab
 */

interface WarehouseTablesTabProps {
  defaultTab?: string;
}

export function WarehouseTablesTab({ defaultTab = "warehouse_types" }: WarehouseTablesTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get active tab from URL query param, fallback to default
  const activeTab = searchParams.get("tab") || defaultTab;

  const handleTabChange = (newTab: string) => {
    // Update URL with new tab value
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="h-9 bg-muted/50">
          <TabsTrigger
            value="warehouse_types"
            className="h-7 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Database className="h-3.5 w-3.5 mr-1.5" />
            Warehouse Types
          </TabsTrigger>
          <TabsTrigger
            value="warehouse_folders"
            className="h-7 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
            Warehouse Folders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="warehouse_types" className="mt-4">
          <WarehouseTypesTab />
        </TabsContent>

        <TabsContent value="warehouse_folders" className="mt-4">
          <WarehouseFoldersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
