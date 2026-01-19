"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { BackButton } from "@/components/ui/back-button";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import { TablePage } from "@/components/ui/page-wrappers";

/**
 * Assets Page - Corporate Assets Management
 *
 * SSoT: Uses Foundation API via autoFetchRecords (Jan 2026 refactor)
 * Foundation: "assets" (ID 530)
 *
 * Previous pattern used useCorporateTable hook with entries prop.
 * Refactored to use autoFetchRecords for SSR hydration, caching, infinite scroll.
 */
export default function AssetsPage() {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Delete confirmation wrapper
  const handleDeleteWithConfirm = async (entry: TableRow) => {
    if (!(await confirm(`Delete asset "${entry.name}"? This cannot be undone.`))) {
      throw new Error("Cancelled"); // Prevents TeeemTableView from proceeding
    }
    // TeeemTableView handles the actual delete via Foundation API
  };

  const handleBulkDeleteWithConfirm = async (ids: (string | number)[]) => {
    if (!(await confirm(`Delete ${ids.length} assets? This cannot be undone.`))) {
      throw new Error("Cancelled");
    }
    // TeeemTableView handles the actual delete via Foundation API
  };

  return (
    <TablePage>
      <TeeemTableView
        foundationId="assets"
        autoFetchRecords={true}
        refreshTrigger={refreshKey}
        tableName="Assets"
        onDelete={handleDeleteWithConfirm}
        onBulkDelete={handleBulkDeleteWithConfirm}
        onRowDoubleClick={(asset) => router.push(`/corporate/assets/${asset.id}`)}
        onAddRow={() => router.push("/corporate/assets/new")}
        enableExport={true}
        enableSchemaEditor={true}
        leftActions={<BackButton fallbackHref="/corporate" />}
        hideFooter={true}
      />
    </TablePage>
  );
}
