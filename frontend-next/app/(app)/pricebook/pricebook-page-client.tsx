"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";
import { slugifyPricebookCode } from "@/lib/url-utils";
import type { TableRow, TableColumn, SavedView } from "@/components/table/types";
import type { ViewData } from "@/lib/server/foundation-api";

interface PricebookPageClientProps {
  // SSR data from server component
  initialColumns: TableColumn[];
  initialRecords: TableRow[];
  initialHasMore: boolean;
  // SSR view data to prevent CLS on hydration
  initialView?: ViewData | null;
  // SSR all views - for immediate toolbar button rendering
  initialViews?: ViewData[];
  // SSR group counts for grouped views (matches TeeemTableView.initialGroupCounts type)
  initialGroupCounts?: {
    groups: Array<{ key: string | null; count: number; displayValue: string }>;
    totalRecords: number;
    displayValuesMap: Record<string, Record<number, string>>;
  } | null;
  // SSR total count - for "20 of X records" display (prevents CLS from count change)
  initialTotalCount?: number | null;
}

/**
 * Pricebook Page Client Component
 *
 * Receives SSR data from server component for fast LCP.
 * TeeemTableView renders immediately without waiting for client fetch.
 *
 * When initialView is provided, TeeemTableView initializes with the view's
 * column configuration, preventing CLS from view loading on hydration.
 */
export default function PricebookPageClient({
  initialColumns,
  initialRecords,
  initialHasMore,
  initialView,
  initialViews,
  initialGroupCounts,
  initialTotalCount,
}: PricebookPageClientProps) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  // Handle row double-click - navigate to detail page
  const handleRowDoubleClick = useCallback((row: TableRow) => {
    const item = row as { id: number; item_code?: string };
    if (item.item_code) {
      const slug = slugifyPricebookCode(item.item_code);
      router.push(`/pricebook/${slug}`);
    } else {
      router.push(`/pricebook/${item.id}`);
    }
  }, [router]);

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/pricebook-items/records/${rowId}`, {
        record: { [field]: value }
      });
      setRefreshKey(k => k + 1);
    } catch (error) {
      console.error("Failed to update pricebook item:", error);
      throw error;
    }
  }, []);

  // Handle refresh (e.g., after drawer update)
  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // Left actions - Back button only (Add button auto-provided by TeeemTableView)
  const leftActions = (
    <BackButton fallbackHref="/dashboard" />
  );

  return (
    <TablePage>
      <TeeemTableView
        key={refreshKey}
        foundationId="pricebook-items"
        tableName="Pricebook"
        enableExport
        enableImport
        onRefresh={handleRefresh}
        onRowDoubleClick={handleRowDoubleClick}
        onRowUpdate={handleRowUpdate}
        addRowLabel="Add Item"
        leftActions={leftActions}
        // SSR Props - data pre-fetched on server for fast LCP
        initialColumns={initialColumns}
        initialRecords={initialRecords}
        initialHasMore={initialHasMore}
        // SSR View Props - prevents CLS from view loading on hydration
        initialView={initialView}
        // SSR All Views - for immediate toolbar button rendering (no flash)
        // Cast needed because ViewData has slightly different filter structure (handled by component)
        preloadedViews={initialViews as unknown as SavedView[]}
        // SSR Group Counts - prevents CLS from group count loading
        initialGroupCounts={initialGroupCounts}
        // SSR Total Count - prevents CLS from "20 records" → "5,285 records" text change
        totalCount={initialTotalCount ?? undefined}
        // Auto-fetch all records - IndexedDB cache handles large datasets (5,285 items)
        // Records cached locally for instant navigation back
        autoFetchRecords
        // Start with all groups collapsed (user sees categories first)
        initialGroupsCollapsed
      />
    </TablePage>
  );
}
