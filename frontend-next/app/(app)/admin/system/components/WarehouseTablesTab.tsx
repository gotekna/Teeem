"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
 * URL State: Path-based via basePath prop (e.g., .../warehouse_tables/warehouse_types)
 */

interface WarehouseTablesTabProps {
  activeSubTab?: string;
  basePath?: string;
}

export function WarehouseTablesTab({ activeSubTab = "warehouse_types", basePath }: WarehouseTablesTabProps) {
  const router = useRouter();

  const activeTab = activeSubTab;

  const handleTabChange = (newTab: string) => {
    if (basePath) {
      router.push(`${basePath}/${newTab}`, { scroll: false });
    }
  };

  return (
    <div className="space-y-4">
      <Tabs expandKey="warehouse-tables-tabs" value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="warehouse_types">
            Warehouse Types
          </TabsTrigger>
          <TabsTrigger value="warehouse_folders">
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
