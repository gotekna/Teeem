"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";
import { CreatePropertyFromJobDialog } from "@/components/properties/CreatePropertyFromJobDialog";
import type { TableRow, TableColumn, SavedView } from "@/components/table/types";
import type { ViewData } from "@/lib/server/foundation-api";

interface PropertiesPageClientProps {
  initialColumns: TableColumn[];
  initialRecords: TableRow[];
  initialHasMore: boolean;
  initialTotalCount?: number | null;
  initialView?: ViewData | null;
  initialViews?: ViewData[];
  initialGroupCounts?: {
    groups: Array<{ key: string | null; count: number; displayValue: string }>;
    totalRecords: number;
    displayValuesMap: Record<string, Record<number, string>>;
  } | null;
  viewSlug?: string;
}

export default function PropertiesPageClient({
  initialColumns,
  initialRecords,
  initialHasMore,
  initialTotalCount,
  initialView,
  initialViews,
  initialGroupCounts,
  viewSlug,
}: PropertiesPageClientProps) {
  const router = useRouter();
  const [showFromJobDialog, setShowFromJobDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRowDoubleClick = useCallback((row: TableRow) => {
    router.push(`/properties/${row.id}`);
  }, [router]);

  const leftActions = (
    <>
      <BackButton fallbackHref="/dashboard" />
      <Button variant="outline" size="sm" onClick={() => setShowFromJobDialog(true)}>
        <Building2 className="h-3.5 w-3.5 mr-1.5" />
        Create from Job
      </Button>
    </>
  );

  return (
    <TablePage>
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.PROPERTIES}
        tableName="Property Management"
        enableExport
        onRowClick={handleRowDoubleClick}
        onRowDoubleClick={handleRowDoubleClick}
        leftActions={leftActions}
        autoFetchRecords
        initialColumns={initialColumns}
        initialRecords={initialRecords}
        initialHasMore={initialHasMore}
        initialTotalCount={initialTotalCount ?? undefined}
        initialView={initialView}
        preloadedViews={initialViews as unknown as SavedView[]}
        initialGroupCounts={initialGroupCounts}
        viewSlug={viewSlug}
        key={refreshKey}
      />
      <CreatePropertyFromJobDialog
        open={showFromJobDialog}
        onOpenChange={setShowFromJobDialog}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />
    </TablePage>
  );
}
