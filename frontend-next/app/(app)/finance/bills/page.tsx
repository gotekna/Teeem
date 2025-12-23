"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import type { TableRow } from "@/components/table/types";

const BILL_INBOX_TABLE_NAME = "bill-inbox";

export default function BillInboxPage() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  // Use foundation hook to load data
  const { foundation, records, isLoading, refresh } = useFoundationBySlug(BILL_INBOX_TABLE_NAME);
  const foundationId = foundation?.id;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/api/v1/bill_inbox_sync_job/run");
      refresh();
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  const handleRowClick = useCallback((row: TableRow) => {
    router.push(`/finance/bills/${row.id}`);
  }, [router]);

  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    if (!foundationId) return;
    try {
      await api.patch(`/api/v1/foundations/${foundationId}/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (err) {
      console.error("Failed to update bill:", err);
      throw err;
    }
  }, [foundationId, refresh]);
  // Note: onBulkDelete is auto-enabled by TeeemTableView when foundationIdNumeric is provided

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        entries={records}
        foundationId={foundationId ? String(foundationId) : ""}
        foundationIdNumeric={foundationId || 0}
        tableName="Bill Inbox"
        enableExport={true}
        onRefresh={refresh}
        onRowClick={handleRowClick}
        onRowUpdate={handleRowUpdate}
        leftActions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/finance">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Emails"}
            </Button>
          </>
        }
      />
    </div>
  );
}
