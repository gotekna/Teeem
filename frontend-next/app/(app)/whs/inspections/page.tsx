"use client";

import { Button } from "@/components/ui/button";
import TeeemTableView from "@/components/table/TeeemTableView";
import { Plus } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

export default function WHSInspectionsPage() {
  // Left actions - Back button + action buttons
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
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId="whs_inspections"
        autoFetchRecords={true}
        tableName="Site Inspections"
        enableExport={true}
        leftActions={leftActions}
        hideFooter={true}
      />
    </div>
  );
}
