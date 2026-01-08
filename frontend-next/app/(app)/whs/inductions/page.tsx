"use client";

import { Button } from "@/components/ui/button";
import TeeemTableView from "@/components/table/TeeemTableView";
import { Plus, Mail } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

export default function WHSInductionsPage() {
  // Left actions - Back button + action buttons
  const leftActions = (
    <div className="flex items-center gap-2">
      <BackButton fallbackHref="/whs" />
      <Button variant="outline">
        <Mail className="h-4 w-4 mr-2" />
        Send Reminders
      </Button>
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        New Induction
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId="whs_inductions"
        autoFetchRecords={true}
        tableName="Site Inductions"
        enableExport={true}
        leftActions={leftActions}
        hideFooter={true}
      />
    </div>
  );
}
