"use client";

import * as React from "react";
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
 */

export function WarehouseTablesTab() {
  const [activeTab, setActiveTab] = React.useState("warehouse_types");

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
