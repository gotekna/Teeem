"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow, TableColumn, SavedView } from "@/components/table/types";
import { TablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";
import { Plus } from "lucide-react";
import type { ViewData } from "@/lib/server/foundation-api";

interface JobsPageClientProps {
  // SSR data from server component
  initialColumns: TableColumn[];
  initialRecords: TableRow[];
  initialHasMore: boolean;
  // SSR view config - eliminates flash when loading grouped views
  initialView?: ViewData | null;
  // SSR all views - for immediate toolbar button rendering
  initialViews?: ViewData[];
  // SSR group counts - eliminates CLS when group counts load
  initialGroupCounts?: {
    groups: Array<{ key: string | null; count: number; displayValue: string }>;
    totalRecords: number;
    displayValuesMap: Record<string, Record<number, string>>;
  } | null;
  // View slug from URL path (e.g., "live" from /jobs/view/live)
  viewSlug?: string;
}

/**
 * Jobs Page Client Component
 *
 * Receives SSR data from server component for fast LCP.
 * TeeemTableView renders immediately without waiting for client fetch.
 *
 * SSR View Loading:
 * When initialView is provided, TeeemTableView initializes with the view's
 * grouping/filters applied immediately, eliminating the flash that occurs
 * when switching from flat table to grouped view on hydration.
 */
export default function JobsPageClient({
  initialColumns,
  initialRecords,
  initialHasMore,
  initialView,
  initialViews,
  initialGroupCounts,
  viewSlug,
}: JobsPageClientProps) {
  const router = useRouter();

  // Navigation handlers - only for page navigation, not CRUD
  const handleView = useCallback((row: TableRow) => {
    router.push(`/jobs/${row.id}`);
  }, [router]);

  const handleRowDoubleClick = useCallback((row: TableRow) => {
    router.push(`/jobs/${row.id}`);
  }, [router]);

  const handleEdit = useCallback((row: TableRow) => {
    router.push(`/jobs/${row.id}/edit`);
  }, [router]);

  return (
    <TablePage data-tour="jobs-table">
      <TeeemTableView
        foundationId="jobs"
        tableName="Jobs"
        onView={handleView}
        onEdit={handleEdit}
        onRowClick={handleView}
        onRowDoubleClick={handleRowDoubleClick}
        enableExport
        enableImport
        enableSchemaEditor
        leftActions={
          <div className="flex items-center gap-2">
            <BackButton fallbackHref="/dashboard" />
            <Button variant="default" size="sm" asChild data-tour="jobs-add">
              <Link href="/jobs/new">
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Link>
            </Button>
          </div>
        }
        // SSR Props - data pre-fetched on server for fast LCP
        initialColumns={initialColumns}
        initialRecords={initialRecords}
        initialHasMore={initialHasMore}
        // SSR View - pre-fetched to eliminate flash on grouped views
        initialView={initialView}
        // SSR All Views - for immediate toolbar button rendering (no flash)
        // Cast needed because ViewData has slightly different filter structure (handled by component)
        preloadedViews={initialViews as unknown as SavedView[]}
        // SSR Group Counts - pre-fetched to eliminate CLS on grouped views
        initialGroupCounts={initialGroupCounts}
        // View slug from URL path (e.g., "live" from /jobs/view/live)
        viewSlug={viewSlug}
        // After refresh, autoFetchRecords takes over
        autoFetchRecords
      />
    </TablePage>
  );
}
