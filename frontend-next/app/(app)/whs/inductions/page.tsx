"use client";

import { Button } from "@/components/ui/button";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TablePage } from "@/components/ui/page-wrappers";
import { Plus, Mail } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

export default function WHSInductionsPage() {
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
    <TablePage>
      <TeeemTableView
        foundationId="whs_inductions"
        autoFetchRecords
        tableName="Site Inductions"
        enableExport
        leftActions={leftActions}
        hideFooter
      />
    </TablePage>
  );
}
