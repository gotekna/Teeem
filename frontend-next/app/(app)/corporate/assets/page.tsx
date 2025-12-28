"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Plus, Loader2 } from "lucide-react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useCorporateTable } from "@/hooks/use-corporate-table";
import type { TableRow } from "@/components/table/types";
import { TablePage } from "@/components/ui/page-wrappers";

export default function AssetsPage() {
  const router = useRouter();

  // Use the corporate table hook for assets (Gold Standard Table - Foundation ID 526)
  const {
    foundationId,
    entries: assets,
    isLoading,
    error,
    refreshColumns,
    refreshData,
    handleEdit,
    handleDelete,
    handleBulkDelete,
  } = useCorporateTable('assets');

  // Wrap handlers to show confirmation for deletes
  const handleDeleteWithConfirm = async (entry: TableRow) => {
    if (!confirm(`Delete asset "${entry.name}"? This cannot be undone.`)) return;
    await handleDelete(entry);
  };

  const handleBulkDeleteWithConfirm = async (ids: (string | number)[]) => {
    if (!confirm(`Delete ${ids.length} assets? This cannot be undone.`)) return;
    // Convert IDs to entries for the hook's handleBulkDelete
    const entriesToDelete = assets.filter(a => ids.includes(a.id));
    await handleBulkDelete(entriesToDelete);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={refreshData}>Retry</Button>
      </div>
    );
  }

  return (
    <TablePage>
      <TeeemTableView
        foundationId="assets"
        foundationIdNumeric={foundationId || 0}
        tableName="Assets"
        entries={assets}
        onEdit={handleEdit}
        onDelete={handleDeleteWithConfirm}
        onBulkDelete={handleBulkDeleteWithConfirm}
        onRowDoubleClick={(asset) => router.push(`/corporate/assets/${asset.id}`)}
        enableExport={true}
        enableSchemaEditor={true}
        onColumnUpdate={refreshColumns}
        leftActions={
          <div className="flex items-center gap-2">
            <BackButton fallbackHref="/corporate" />
            <Button onClick={() => router.push("/corporate/assets/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </Button>
          </div>
        }
        hideFooter={true}
      />
    </TablePage>
  );
}
