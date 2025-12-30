"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";
import type { TableRow, TableColumn } from "@/components/table/types";

interface PurchaseOrdersPageClientProps {
  // SSR data from server component
  initialColumns: TableColumn[];
  initialRecords: TableRow[];
  initialHasMore: boolean;
}

/**
 * Purchase Orders Page Client Component
 *
 * Receives SSR data from server component for fast LCP.
 * TeeemTableView renders immediately without waiting for client fetch.
 */
export default function PurchaseOrdersPageClient({
  initialColumns,
  initialRecords,
  initialHasMore,
}: PurchaseOrdersPageClientProps) {
  const router = useRouter();

  // Navigation handler - navigate to PO detail page
  const handleRowClick = useCallback((row: TableRow) => {
    const poNumber = row.purchase_order_number as string | undefined;
    const slug = poNumber?.replace('PO-', '') || row.id;
    if (slug) {
      router.push(`/purchase_orders/${slug}`);
    }
  }, [router]);

  return (
    <TablePage>
      <TeeemTableView
        foundationId="purchase_orders"
        tableName="Purchase Orders"
        enableExport
        onRowClick={handleRowClick}
        hideFooter
        leftActions={<BackButton fallbackHref="/dashboard" />}
        // SSR Props - data pre-fetched on server for fast LCP
        initialColumns={initialColumns}
        initialRecords={initialRecords}
        initialHasMore={initialHasMore}
        // After refresh, autoFetchRecords takes over
        autoFetchRecords
      />
    </TablePage>
  );
}
