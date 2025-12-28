"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TeeemTableView } from "@/components/table";
import type { TableRow } from "@/components/table/types";
import { TablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";
import { Plus } from "lucide-react";

/**
 * Jobs Page - Gold Standard Pattern
 *
 * Uses autoFetchRecords to let TeeemTableView fetch data directly from Foundation API.
 * Foundation API automatically resolves all lookup columns to { id, display } format.
 *
 * Navigation handlers (view, edit) still use router.push for page navigation.
 * CRUD operations (add, update, delete) are handled by TeeemTableView's built-in modals.
 */
export default function JobsPage() {
  const router = useRouter();

  // Navigation handlers - only for page navigation, not CRUD
  const handleView = useCallback((row: TableRow) => {
    router.push(`/jobs/${row.id}`);
  }, [router]);

  const handleRowDoubleClick = useCallback((row: TableRow) => {
    router.push(`/jobs/${row.id}`);
  }, [router]);

  const handleEdit = useCallback((row: TableRow) => {
    router.push(`/jobs/${row.id}?edit=true`);
  }, [router]);

  return (
    <TablePage>
      <TeeemTableView
        foundationId="jobs"
        autoFetchRecords
        tableName="Jobs"
        onView={handleView}
        onEdit={handleEdit}
        onRowDoubleClick={handleRowDoubleClick}
        enableExport
        enableImport
        enableSchemaEditor
        leftActions={
          <div className="flex items-center gap-2">
            <BackButton fallbackHref="/dashboard" />
            <Button variant="default" size="sm" asChild>
              <Link href="/jobs/new">
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Link>
            </Button>
          </div>
        }
      />
    </TablePage>
  );
}
