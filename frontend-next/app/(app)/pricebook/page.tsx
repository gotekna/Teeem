"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import { TablePage } from "@/components/ui/page-wrappers";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { slugifyPricebookCode } from "@/lib/url-utils";
import { PricebookDetailDrawer } from "@/components/pricebook/PricebookDetailDrawer";
import type { TableRow } from "@/components/table/types";

export default function PriceBookPage() {
  const router = useRouter();

  // Use foundation hook for TeeemTableView with server-side stats
  const { foundation, records, totalCount, isLoading, refresh, serverSearch, isSearching } = useFoundationBySlug("pricebook-items");

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Handle row double-click - open drawer
  const handleRowDoubleClick = useCallback((row: TableRow) => {
    setSelectedItemId(row.id as number);
    setDrawerOpen(true);
  }, []);

  // Handle row click - navigate to detail page
  const handleRowClick = useCallback((row: TableRow) => {
    console.log("[PricebookPage] Row clicked:", row);
    const item = row as { id: number; item_code?: string };
    console.log("[PricebookPage] item_code:", item.item_code, "id:", item.id);
    if (item.item_code) {
      const slug = slugifyPricebookCode(item.item_code);
      console.log("[PricebookPage] Navigating to:", `/pricebook/${slug}`);
      router.push(`/pricebook/${slug}`);
    } else {
      console.warn("[PricebookPage] No item_code found, falling back to ID:", item.id);
      router.push(`/pricebook/${item.id}`);
    }
  }, [router]);

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/pricebook-items/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update pricebook item:", error);
      throw error;
    }
  }, [refresh]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  // Left actions - Add Item button
  const leftActions = (
    <Button variant="default" size="sm" onClick={() => router.push('/pricebook/new')}>
      <Plus className="h-4 w-4 mr-2" />
      Add Item
    </Button>
  );

  return (
    <TablePage>
      {/* TeeemTableView handles header, count, and table (SSoT) */}
      <TeeemTableView
        entries={records}
        totalCount={totalCount}
        foundationId="pricebook-items"
        foundationIdNumeric={foundation?.id}
        tableName={foundation?.name || "Pricebook"}
        enableExport={true}
        enableImport={true}
        onRefresh={refresh}
        onRowClick={handleRowClick}
        onRowDoubleClick={handleRowDoubleClick}
        onRowUpdate={handleRowUpdate}
        onServerSearch={serverSearch}
        serverSearchLoading={isSearching}
        leftActions={leftActions}
      />

      {/* Pricebook Detail Drawer */}
      <PricebookDetailDrawer
        itemId={selectedItemId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </TablePage>
  );
}
