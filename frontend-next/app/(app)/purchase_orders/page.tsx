"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";
import type { TableRow } from "@/components/table/types";

/**
 * Purchase Orders Page - Gold Standard Pattern
 *
 * Uses autoFetchRecords to let TeeemTableView fetch data directly from Foundation API.
 * Foundation API automatically resolves all lookup columns to { id, display } format.
 */
export default function PurchaseOrdersPage() {
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
        autoFetchRecords
        tableName="Purchase Orders"
        enableExport
        onRowClick={handleRowClick}
        hideFooter
        leftActions={<BackButton fallbackHref="/dashboard" />}
      />
    </TablePage>
  );
}
