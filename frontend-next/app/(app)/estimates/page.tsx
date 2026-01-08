"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TablePage } from "@/components/ui/page-wrappers";
import { Plus } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import type { TableRow } from "@/components/table/types";

export default function EstimatesPage() {
  const router = useRouter();

  // Handle row click - navigate to job with estimates tab
  const handleRowClick = useCallback((row: TableRow) => {
    const jobId = row.job_id || (row.job as { id?: number })?.id;
    if (jobId) {
      router.push(`/jobs/${jobId}/estimates`);
    }
  }, [router]);

  // Left actions - Back button + Upload Estimate button
  const leftActions = (
    <div className="flex items-center gap-2">
      <BackButton fallbackHref="/dashboard" />
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        Upload Estimate
      </Button>
    </div>
  );

  return (
    <TablePage>
      <TeeemTableView
        foundationId="estimates"
        autoFetchRecords={true}
        tableName="Estimates"
        enableExport={true}
        onRowClick={handleRowClick}
        leftActions={leftActions}
        hideFooter={true}
      />
    </TablePage>
  );
}
