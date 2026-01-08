"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import TeeemTableView from "@/components/table/TeeemTableView";
import { Plus } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import type { TableRow } from "@/components/table/types";

export default function QuoteRequestsPage() {
  const router = useRouter();

  // Handle row click - navigate to quote request detail
  const handleRowClick = useCallback((row: TableRow) => {
    router.push(`/quote-requests/${row.id}`);
  }, [router]);

  // Left actions - Back button + New Quote Request button
  const leftActions = (
    <div className="flex items-center gap-2">
      <BackButton fallbackHref="/dashboard" />
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        New Quote Request
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId="quote_requests"
        autoFetchRecords={true}
        tableName="Quote Requests"
        enableExport={true}
        onRowClick={handleRowClick}
        leftActions={leftActions}
        hideFooter={true}
      />
    </div>
  );
}
