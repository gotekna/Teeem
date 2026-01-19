"use client";

import { Button } from "@/components/ui/button";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TablePage } from "@/components/ui/page-wrappers";
import { Plus } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

export default function WHSInspectionsPage() {
  const leftActions = (
    <div className="flex items-center gap-2">
      <BackButton fallbackHref="/whs" />
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        New Inspection
      </Button>
    </div>
  );

  return (
    <TablePage>
      <TeeemTableView
        foundationId="whs_inspections"
        autoFetchRecords
        tableName="Site Inspections"
        enableExport
        leftActions={leftActions}
        hideFooter
      />
    </TablePage>
  );
}
