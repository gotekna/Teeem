"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, AlertCircle, RefreshCw, Minus, Ban } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * ScheduleMasterSyncTab - One-button Schedule Master config sync
 *
 * Syncs all SM-related configuration tables from TEEEM master tenant
 * in the correct dependency order. Designed for simplicity:
 * one button, live progress, clear results.
 *
 * SSoT: TenantConfigSyncService handles all backend sync logic.
 * This component reuses the same pull_one_table API as TenantSyncPullTab.
 */

// Tables to sync in dependency order
// Dependencies come first so FK references resolve correctly
const SM_SYNC_TABLES = [
  { key: "sm_trades", label: "Trades", description: "Trade categories for SM tasks" },
  { key: "sm_stages", label: "Stages", description: "Build stages" },
  { key: "cost_centres", label: "Cost Centres", description: "Cost centre assignments" },
  { key: "supervisor_checklist_templates", label: "Checklists", description: "Supervisor checklist templates" },
  { key: "document_types", label: "Document Types", description: "Document type definitions" },
  { key: "sm_schedule_master_templates", label: "SM Templates", description: "Schedule master templates" },
  { key: "sm_task_groups", label: "Task Groups", description: "Task group categories" },
  { key: "bpmn_processes", label: "Workflows", description: "Start/complete workflow definitions" },
  { key: "sm_schedule_masters", label: "SM Tasks", description: "The main schedule master tasks" },
  { key: "sm_schedule_master_document_types", label: "SM Document Types", description: "SM task \u2192 document type links" },
  { key: "sm_schedule_master_related_pos", label: "Related PO Links", description: "SM task \u2192 related PO task links" },
  { key: "sm_hold_reasons", label: "Hold Reasons", description: "Reasons for holding tasks" },
  { key: "sm_resources", label: "Resources", description: "Resource definitions (depend on trades)" },
] as const;

type TableKey = typeof SM_SYNC_TABLES[number]["key"];
type TableSyncStatus = "pending" | "syncing" | "done" | "error" | "skipped";

interface TableResult {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  error?: string;
}

const BATCH_SIZE = 500;

export function ScheduleMasterSyncTab() {
  // Counts from server
  const [counts, setCounts] = useState<Record<string, { master: number; tenant: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [tableStatus, setTableStatus] = useState<Record<TableKey, TableSyncStatus>>({} as Record<TableKey, TableSyncStatus>);
  const [tableResults, setTableResults] = useState<Record<TableKey, TableResult>>({} as Record<TableKey, TableResult>);
  const [currentTableIndex, setCurrentTableIndex] = useState(-1);
  const [batchProgress, setBatchProgress] = useState<{ processed: number; total: number } | null>(null);

  // Audit trail
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncBy, setLastSyncBy] = useState<string | null>(null);

  // Whether we've completed at least one sync this session
  const [syncComplete, setSyncComplete] = useState(false);

  // Fetch counts on mount
  const fetchCounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        counts?: Record<string, { master: number; tenant: number }>;
        last_config_sync_at?: string | null;
        last_config_sync_by?: string | null;
      }>("/api/v1/config_sync/tables");

      if (response?.success && response.counts) {
        setCounts(response.counts);
        setLastSyncAt(response.last_config_sync_at || null);
        setLastSyncBy(response.last_config_sync_by || null);
      }
    } catch (err) {
      console.error("[SMSync] Failed to fetch counts:", err);
      setError("Failed to load table counts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Pull a single table with auto-batching (same pattern as TenantSyncPullTab)
  const pullOneTable = async (tableKey: string): Promise<TableResult> => {
    type PullResponse = {
      success: boolean;
      imported: number;
      updated: number;
      skipped: number;
      total: number;
      total_records: number;
      has_more: boolean;
      next_offset?: number;
      error?: string;
    };

    let totalImported = 0, totalUpdated = 0, totalSkipped = 0, totalProcessed = 0;
    let totalRecords = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await api.post<PullResponse>(
        "/api/v1/config_sync/pull_one_table",
        { table: tableKey, batch_size: BATCH_SIZE, offset }
      );

      if (!response?.success) {
        return {
          imported: totalImported,
          updated: totalUpdated,
          skipped: totalSkipped,
          total: totalProcessed,
          error: response?.error || "Unknown error",
        };
      }

      totalImported += response.imported || 0;
      totalUpdated += response.updated || 0;
      totalSkipped += response.skipped || 0;
      totalProcessed += response.total || 0;
      totalRecords = response.total_records || totalProcessed;
      hasMore = response.has_more;
      offset = response.next_offset || 0;

      // Update batch progress for large tables
      if (hasMore || totalRecords > BATCH_SIZE) {
        setBatchProgress({ processed: totalProcessed, total: totalRecords });
      }
    }

    return {
      imported: totalImported,
      updated: totalUpdated,
      skipped: totalSkipped,
      total: totalRecords,
    };
  };

  // Main sync handler - syncs all tables in order
  const handleSync = async () => {
    setSyncing(true);
    setSyncComplete(false);
    setError(null);
    setBatchProgress(null);

    // Initialize all tables as pending
    const initialStatus = {} as Record<TableKey, TableSyncStatus>;
    SM_SYNC_TABLES.forEach((t) => { initialStatus[t.key] = "pending"; });
    setTableStatus(initialStatus);
    setTableResults({} as Record<TableKey, TableResult>);

    let totalImported = 0;
    let totalUpdated = 0;

    for (let i = 0; i < SM_SYNC_TABLES.length; i++) {
      const table = SM_SYNC_TABLES[i];
      setCurrentTableIndex(i);
      setBatchProgress(null);
      setTableStatus((prev) => ({ ...prev, [table.key]: "syncing" }));

      try {
        const result = await pullOneTable(table.key);
        setTableResults((prev) => ({ ...prev, [table.key]: result }));
        totalImported += result.imported;
        totalUpdated += result.updated;

        if (result.error) {
          setTableStatus((prev) => ({ ...prev, [table.key]: "error" }));
        } else if (result.imported > 0 || result.updated > 0) {
          setTableStatus((prev) => ({ ...prev, [table.key]: "done" }));
        } else {
          setTableStatus((prev) => ({ ...prev, [table.key]: "skipped" }));
        }
      } catch (err) {
        setTableResults((prev) => ({
          ...prev,
          [table.key]: {
            imported: 0, updated: 0, skipped: 0, total: 0,
            error: err instanceof Error ? err.message : "Request failed",
          },
        }));
        setTableStatus((prev) => ({ ...prev, [table.key]: "error" }));
      }
    }

    // Record sync timestamp
    try {
      const syncRecord = await api.post<{
        success: boolean;
        last_config_sync_at?: string;
        last_config_sync_by?: string;
      }>("/api/v1/config_sync/record_sync", {});
      if (syncRecord?.success) {
        setLastSyncAt(syncRecord.last_config_sync_at || null);
        setLastSyncBy(syncRecord.last_config_sync_by || null);
      }
    } catch {
      // Non-critical
    }

    // Refresh counts
    try {
      const refreshed = await api.get<{
        success: boolean;
        counts?: Record<string, { master: number; tenant: number }>;
      }>("/api/v1/config_sync/tables");
      if (refreshed?.success && refreshed.counts) {
        setCounts(refreshed.counts);
      }
    } catch {
      // Non-critical
    }

    setCurrentTableIndex(-1);
    setBatchProgress(null);
    setSyncing(false);
    setSyncComplete(true);
  };

  // Compute totals from results
  const totals = Object.values(tableResults).reduce(
    (acc, r) => ({
      imported: acc.imported + (r.imported || 0),
      updated: acc.updated + (r.updated || 0),
      skipped: acc.skipped + (r.skipped || 0),
    }),
    { imported: 0, updated: 0, skipped: 0 }
  );

  const hasResults = syncComplete || syncing;
  const hasErrors = Object.values(tableStatus).some((s) => s === "error");

  // Progress calculation
  const completedCount = Object.values(tableStatus).filter(
    (s) => s === "done" || s === "error" || s === "skipped"
  ).length;
  const progressPercent = SM_SYNC_TABLES.length > 0
    ? (completedCount / SM_SYNC_TABLES.length) * 100
    : 0;

  // Format last sync date
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Australia/Brisbane",
      });
    } catch {
      return iso;
    }
  };

  const renderStatusIcon = (status: TableSyncStatus | undefined, result: TableResult | undefined) => {
    if (!status || status === "pending") {
      return <Minus className="h-4 w-4 text-muted-foreground/40" />;
    }
    if (status === "syncing") {
      return <Spinner className="h-4 w-4" />;
    }
    if (status === "done") {
      return <Check className="h-4 w-4 text-green-600 dark:text-green-400" />;
    }
    if (status === "error") {
      return <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />;
    }
    if (status === "skipped") {
      return <Ban className="h-4 w-4 text-muted-foreground/40" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Schedule Master Sync</CardTitle>
          <CardDescription>
            Sync all Schedule Master configuration from the TEEEM master template.
            Tables are synced in dependency order so references resolve correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error banner */}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Table list */}
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] text-center">#</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead className="text-right w-[70px]">TEEEM</TableHead>
                  <TableHead className="text-right w-[70px]">Yours</TableHead>
                  <TableHead className="w-[180px] text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SM_SYNC_TABLES.map((table, index) => {
                  const status = tableStatus[table.key];
                  const result = tableResults[table.key];
                  const tableCounts = counts[table.key];
                  const masterCount = tableCounts?.master ?? 0;
                  const tenantCount = tableCounts?.tenant ?? 0;
                  const countsDiffer = masterCount !== tenantCount && masterCount > 0;

                  return (
                    <TableRow
                      key={table.key}
                      className={cn(
                        status === "syncing" && "bg-blue-50/50 dark:bg-blue-950/20",
                        status === "done" && "bg-green-50/30 dark:bg-green-950/10",
                        status === "error" && "bg-red-50/30 dark:bg-red-950/10",
                      )}
                    >
                      <TableCell className="text-center text-xs text-muted-foreground tabular-nums py-2">
                        {index + 1}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="text-sm font-medium">{table.label}</div>
                        {status === "error" && result?.error && (
                          <div className="text-xs text-red-500 dark:text-red-400 mt-0.5 truncate max-w-[250px]" title={result.error}>
                            {result.error}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm py-2">
                        {masterCount.toLocaleString()}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right tabular-nums text-sm py-2",
                        countsDiffer && !hasResults && "text-amber-600 dark:text-amber-400 font-medium"
                      )}>
                        {tenantCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          {renderStatusIcon(status, result)}
                          {status === "syncing" && batchProgress && currentTableIndex === index && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {batchProgress.processed.toLocaleString()}/{batchProgress.total.toLocaleString()}
                            </span>
                          )}
                          {status === "done" && result && (
                            <span className="text-xs text-muted-foreground">
                              {result.imported > 0 && <span className="text-green-600 dark:text-green-400">+{result.imported}</span>}
                              {result.imported > 0 && result.updated > 0 && ", "}
                              {result.updated > 0 && <span className="text-blue-600 dark:text-blue-400">{result.updated} upd</span>}
                              {result.imported === 0 && result.updated === 0 && "up to date"}
                            </span>
                          )}
                          {status === "skipped" && (
                            <span className="text-xs text-muted-foreground">no changes</span>
                          )}
                          {status === "error" && result && (result.imported > 0 || result.updated > 0) && (
                            <span className="text-xs text-green-600 dark:text-green-400">
                              {result.imported + result.updated} ok
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Progress bar (visible during sync) */}
          {syncing && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {completedCount}/{SM_SYNC_TABLES.length} — Syncing {SM_SYNC_TABLES[currentTableIndex]?.label || "..."}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Results summary (after sync) */}
          {syncComplete && (
            <div className={cn(
              "rounded-md border p-3",
              hasErrors
                ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                : "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
            )}>
              <div className="flex items-center gap-2 text-sm">
                {hasErrors ? (
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                ) : (
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                )}
                <span className={hasErrors ? "text-amber-800 dark:text-amber-200" : "text-green-800 dark:text-green-200"}>
                  Sync complete: {totals.imported} imported, {totals.updated} updated
                  {totals.skipped > 0 && `, ${totals.skipped} skipped`}
                  {hasErrors && " (some tables had errors)"}
                </span>
              </div>
            </div>
          )}

          {/* Last sync info + action button */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              {lastSyncAt ? (
                <>Last synced: {formatDate(lastSyncAt)}{lastSyncBy ? ` by ${lastSyncBy}` : ""}</>
              ) : (
                "Never synced"
              )}
            </div>
            <Button
              onClick={handleSync}
              disabled={syncing}
              size="default"
            >
              {syncing ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Schedule Master
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
