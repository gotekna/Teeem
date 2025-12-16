"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useCorporateTable } from "@/hooks/use-corporate-table";
import type { TableRow } from "@/components/table/types";

export default function AssetsPage() {
  const router = useRouter();

  // Use the corporate table hook for assets
  const {
    columns,
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
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId="assets"
        foundationIdNumeric={foundationId || 0}
        tableName="Assets"
        entries={assets}
        // columns prop removed - TeeemTableView auto-fetches from Foundation API (SSoT)
        onEdit={handleEdit}
        onDelete={handleDeleteWithConfirm}
        onBulkDelete={handleBulkDeleteWithConfirm}
        onRowDoubleClick={(asset) => router.push(`/corporate/assets/${asset.id}`)}
        enableExport={true}
        enableSchemaEditor={false} // Assets don't have a Foundation for schema editing
        hideUpdateViewButton={true}
        onColumnUpdate={refreshColumns}
        leftActions={
          <Button onClick={() => router.push("/corporate/assets/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        }
        hideFooter={true}
      />
    </div>
  );
}
