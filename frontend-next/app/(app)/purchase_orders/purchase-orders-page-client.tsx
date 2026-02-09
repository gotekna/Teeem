"use client";

import { useCallback } from "react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";
import type { TableRow, TableColumn, SavedView } from "@/components/table/types";
import type { ViewData } from "@/lib/server/foundation-api";
import { usePOInvoiceModal } from "@/hooks/use-po-invoice-modal";

interface PurchaseOrdersPageClientProps {
  // SSR data from server component
  initialColumns: TableColumn[];
  initialRecords: TableRow[];
  initialHasMore: boolean;
  // SSR view config - eliminates flash when loading views
  initialView?: ViewData | null;
  // SSR all views - for immediate toolbar button rendering
  initialViews?: ViewData[];
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
  initialView,
  initialViews,
}: PurchaseOrdersPageClientProps) {
  const { open: openPOInvoice } = usePOInvoiceModal();

  // Row click opens PO vs Invoice side-by-side modal
  const handleRowClick = useCallback((row: TableRow) => {
    const poNumber = row.purchase_order_number as string | undefined;
    const slug = poNumber?.replace('PO-', '') || row.id;
    if (slug) {
      openPOInvoice(slug, poNumber);
    }
  }, [openPOInvoice]);

  return (
    <TablePage>
      <TeeemTableView
        foundationId="purchase-orders"
        tableName="Purchase Orders"
        enableExport
        onRowClick={handleRowClick}
        hideFooter
        leftActions={<BackButton fallbackHref="/dashboard" />}
        // SSR Props - data pre-fetched on server for fast LCP
        initialColumns={initialColumns}
        initialRecords={initialRecords}
        initialHasMore={initialHasMore}
        // SSR View - pre-fetched to eliminate flash on views
        initialView={initialView}
        // SSR All Views - for immediate toolbar button rendering (no flash)
        preloadedViews={initialViews as unknown as SavedView[]}
        // After refresh, autoFetchRecords takes over
        autoFetchRecords
      />
    </TablePage>
  );
}
