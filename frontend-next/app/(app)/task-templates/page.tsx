"use client";

import { Button } from "@/components/ui/button";
import TeeemTableView from "@/components/table/TeeemTableView";
import { Plus } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { TablePage } from "@/components/ui/page-wrappers";

/**
 * Task Templates Page - Gold Standard Pattern
 *
 * Uses autoFetchRecords to let TeeemTableView fetch data directly from Foundation API.
 * Foundation API automatically resolves all lookup columns to { id, display } format.
 */
export default function TaskTemplatesPage() {
  return (
    <TablePage>
      <TeeemTableView
        foundationId="task_templates"
        autoFetchRecords
        tableName="Task Templates"
        enableExport
        hideFooter
        leftActions={
          <div className="flex items-center gap-2">
            <BackButton fallbackHref="/dashboard" />
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        }
      />
    </TablePage>
  );
}
