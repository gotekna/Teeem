"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";

export default function BillInboxPage() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/api/v1/bill_inbox_sync_job/run");
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  const handleRowClick = useCallback((row: TableRow) => {
    router.push(`/finance/bills/${row.id}`);
  }, [router]);

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId="bill-inbox"
        autoFetchRecords={true}
        tableName="Bill Inbox"
        enableExport={true}
        onRowClick={handleRowClick}
        refreshTrigger={refreshTrigger}
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
