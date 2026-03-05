"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";
import { TablePage } from "@/components/ui/page-wrappers";

/**
 * Property Settings Tab - configures Property Types and Property Statuses.
 * Uses TeeemTableView backed by Foundation for inline editing.
 */
export function PropertySettingsTab() {
  const [subTab, setSubTab] = React.useState("types");

  return (
    <div className="flex flex-col h-full">
      <Tabs value={subTab} onValueChange={setSubTab} className="flex flex-col h-full">
        <div className="flex items-center gap-2 mx-4 mt-2">
          <TabsList className="w-fit">
            <TabsTrigger value="types">Property Types</TabsTrigger>
            <TabsTrigger value="statuses">Property Statuses</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 min-h-0 mt-2">
          <TabsContent value="types" className="h-full overflow-auto">
            <TablePage>
              <TeeemTableView
                foundationId={FOUNDATION_SLUGS.PROPERTY_TYPES}
                tableName="Property Types"
                autoFetchRecords
                hideFooter
              />
            </TablePage>
          </TabsContent>
          <TabsContent value="statuses" className="h-full overflow-auto">
            <TablePage>
              <TeeemTableView
                foundationId={FOUNDATION_SLUGS.PROPERTY_STATUSES}
                tableName="Property Statuses"
                autoFetchRecords
                hideFooter
              />
            </TablePage>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
