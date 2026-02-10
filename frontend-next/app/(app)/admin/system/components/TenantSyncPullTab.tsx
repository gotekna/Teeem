"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Check, Star, CircleDot, AlertCircle, AlertTriangle, RefreshCw, X, SkipForward } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * TenantSyncPullTab - Tenant view of TEEEM's shared configuration
 *
 * Tenants can:
 * - See what TEEEM has marked as compulsory (must sync) or choice (optional)
 * - See which records they already have
 * - Pull selected records from TEEEM
 *
 * SSoT: TenantConfigSyncService handles all backend sync logic
 */

interface ConfigTable {
  key: string;
  model: string;
  description: string;
  group: string;
}

interface TenantCount {
  id: number;
  name: string;
  slug: string;
  is_master: boolean;
}

type TableSyncStatus = "pending" | "syncing" | "done" | "error" | "skipped";

interface MasterRecord {
  id: number;
  name: string;
  sync_mode: "compulsory" | "choice" | null;
  exists_in_tenant: boolean;
  tenant_record_id?: number;
  updated_at: string;
  [key: string]: unknown;
}

interface TenantInfo {
  id: number;
  name: string;
  slug: string;
}

export function TenantSyncPullTab() {
  const [tables, setTables] = useState<ConfigTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<{ imported: number; updated: number; skipped: number; markupApplied?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [priceMarkupPercent, setPriceMarkupPercent] = useState<number>(5); // Default 5% markup
  const [pullingAll, setPullingAll] = useState(false);
  const [pullAllProgress, setPullAllProgress] = useState<{
    current: number;
    total: number;
    currentTable: string;
  } | null>(null);
  const [pullAllResult, setPullAllResult] = useState<{
    totals: { imported: number; updated: number; skipped: number; tables_processed: number };
    results: Record<string, { imported: number; updated: number; skipped: number; total: number; error?: string; source?: string; errors?: string[]; skipped_reasons?: string[]; message?: string }>;
  } | null>(null);
  const [tenants, setTenants] = useState<TenantCount[]>([]);
  const [tableCounts, setTableCounts] = useState<Record<string, Record<string, number>>>({});
  const [isMasterTenant, setIsMasterTenant] = useState(false);
  const [tableSyncStatus, setTableSyncStatus] = useState<Record<string, TableSyncStatus>>({});
  const [tableBatchProgress, setTableBatchProgress] = useState<Record<string, { processed: number; total: number }>>({});
  const [tableSyncErrors, setTableSyncErrors] = useState<Record<string, string[]>>({});
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  // Per-table source tenant selection (master tenant only)
  // Maps table key → tenant ID to import from
  const [tableSources, setTableSources] = useState<Record<string, number>>({});
  // Tables the user has chosen to skip during pull all
  const [skippedTables, setSkippedTables] = useState<Set<string>>(new Set());
  // Contacts: price_only filter (checked by default, matching backend scope)
  const [contactsPriceOnly, setContactsPriceOnly] = useState(true);

  // Fetch available tables on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get<{
          success: boolean;
          tables: ConfigTable[];
          tenant: TenantInfo | null;
          counts?: Record<string, { master: number; tenant: number }>;
          is_master_tenant?: boolean;
          all_tenant_counts?: Record<string, Record<string, number>>;
          all_tenants?: TenantCount[];
        }>("/api/v1/config_sync/tables");

        if (response?.success) {
          setTables(response.tables);
          if (response.tenant) {
            setTenantInfo(response.tenant);
          }
          setIsMasterTenant(response.is_master_tenant || false);
          if (response.all_tenants && response.all_tenant_counts) {
            setTenants(response.all_tenants);
            setTableCounts(response.all_tenant_counts);
            // Compute default source tenant per table (largest non-master)
            const nonMasterTenants = response.all_tenants.filter((t) => !t.is_master);
            const defaults: Record<string, number> = {};
            for (const [tableKey, counts] of Object.entries(response.all_tenant_counts)) {
              let bestId = 0;
              let bestCount = 0;
              for (const t of nonMasterTenants) {
                const count = counts[t.slug] || 0;
                if (count > bestCount) {
                  bestCount = count;
                  bestId = t.id;
                }
              }
              if (bestId > 0) defaults[tableKey] = bestId;
            }
            setTableSources(defaults);
          } else if (response.counts) {
            // Non-master: build a simple 2-column view
            const masterName = "TEEEM";
            const tenantName = response.tenant?.name || "Your Tenant";
            setTenants([
              { id: 0, name: masterName, slug: "master", is_master: true },
              { id: 1, name: tenantName, slug: "tenant", is_master: false },
            ]);
            const counts: Record<string, Record<string, number>> = {};
            for (const [key, val] of Object.entries(response.counts)) {
              counts[key] = { master: val.master, tenant: val.tenant };
            }
            setTableCounts(counts);
          }
        }
      } catch (err) {
        console.error("Failed to fetch config data:", err);
        setError("Failed to load configuration tables");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch records from master tenant with sync status
  const fetchRecords = useCallback(async () => {
    if (!selectedTable) {
      setRecords([]);
      return;
    }

    try {
      setRecordsLoading(true);
      setError(null);
      setPullResult(null);
      setSelectedRecords(new Set());

      const response = await api.get<{
        success: boolean;
        records: MasterRecord[];
        table: string;
      }>(`/api/v1/config_sync/master_records/${selectedTable}`);

      if (response?.success) {
        setRecords(response.records);
      }
    } catch (err) {
      console.error("Failed to fetch records:", err);
      setError("Failed to load records from TEEEM");
    } finally {
      setRecordsLoading(false);
    }
  }, [selectedTable]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Handle record selection
  const toggleRecord = (id: number) => {
    setSelectedRecords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllNew = () => {
    // Select all records that don't exist in tenant yet
    const newRecordIds = records.filter((r) => !r.exists_in_tenant).map((r) => r.id);
    setSelectedRecords(new Set(newRecordIds));
  };

  const selectCompulsory = () => {
    // Select all compulsory records
    const compulsoryIds = records.filter((r) => r.sync_mode === "compulsory").map((r) => r.id);
    setSelectedRecords(new Set(compulsoryIds));
  };

  const clearSelection = useCallback(() => {
    setSelectedRecords(new Set());
  }, []);

  // Handle pull from master
  const handlePull = async () => {
    if (selectedRecords.size === 0 || !selectedTable) return;

    try {
      setPulling(true);
      setError(null);

      const response = await api.post<{
        success: boolean;
        imported?: Array<{ id: number; name: string }>;
        updated?: Array<{ id: number; name: string }>;
        skipped?: Array<{ name: string; reason: string }>;
        errors?: string[];
        error?: string;
      }>("/api/v1/config_sync/pull", {
        table: selectedTable,
        record_ids: Array.from(selectedRecords),
        mode: "replace_existing", // Update if exists, create if new
      });

      if (response?.success) {
        setPullResult({
          imported: response.imported?.length || 0,
          updated: response.updated?.length || 0,
          skipped: response.skipped?.length || 0,
        });
        setSelectedRecords(new Set());
        // Refresh to show updated status
        await fetchRecords();
      } else {
        setError(response?.error || "Pull failed");
      }
    } catch (err) {
      console.error("Pull failed:", err);
      setError("Pull failed. Please try again.");
    } finally {
      setPulling(false);
    }
  };

  // Batch size for large tables (prevents Heroku 30s timeout)
  const BATCH_SIZE = 500;

  // Pull a single table, auto-batching if needed
  const pullOneTable = async (tableKey: string): Promise<{
    imported: number; updated: number; skipped: number;
    total: number; source?: string; error?: string;
    errors?: string[]; skipped_reasons?: string[];
    message?: string;
  }> => {
    type PullResponse = {
      success: boolean; table: string;
      imported: number; updated: number; skipped: number;
      total: number; total_records: number;
      has_more: boolean; next_offset?: number;
      source?: string; error?: string; message?: string;
      errors?: string[]; skipped_reasons?: string[];
    };

    let totalImported = 0, totalUpdated = 0, totalSkipped = 0, totalProcessed = 0;
    let totalRecords = 0;
    let source: string | undefined;
    let lastMessage: string | undefined;
    let allErrors: string[] = [];
    let allSkippedReasons: string[] = [];
    let offset = 0;
    let hasMore = true;

    // Pass explicit source tenant if selected (master tenant only)
    const sourceTenantId = tableSources[tableKey];
    // For contacts/price_histories: pass price_only flag
    const priceOnly = (tableKey === "contacts" || tableKey === "price_histories") ? contactsPriceOnly : undefined;

    while (hasMore) {
      const response = await api.post<PullResponse>(
        "/api/v1/config_sync/pull_one_table",
        {
          table: tableKey, batch_size: BATCH_SIZE, offset,
          ...(sourceTenantId ? { source_tenant_id: sourceTenantId } : {}),
          ...(priceOnly !== undefined ? { price_only: priceOnly } : {}),
        }
      );

      if (!response?.success) {
        return { imported: totalImported, updated: totalUpdated, skipped: totalSkipped, total: totalProcessed, source, error: response?.error || "Unknown error" };
      }

      totalImported += response.imported || 0;
      totalUpdated += response.updated || 0;
      totalSkipped += response.skipped || 0;
      totalProcessed += response.total || 0;
      totalRecords = response.total_records || totalProcessed;
      source = response.source;
      lastMessage = response.message;
      hasMore = response.has_more;
      offset = response.next_offset || 0;
      if (response.errors?.length) allErrors = [...allErrors, ...response.errors];
      if (response.skipped_reasons?.length) allSkippedReasons = [...allSkippedReasons, ...response.skipped_reasons];

      // Update progress for large tables
      if (hasMore || totalRecords > BATCH_SIZE) {
        setTableBatchProgress((prev) => ({ ...prev, [tableKey]: { processed: totalProcessed, total: totalRecords } }));
        setPullAllProgress((prev) => prev ? {
          ...prev,
          currentTable: `${prev.currentTable.split(" (")[0]} (${totalProcessed.toLocaleString()}/${totalRecords.toLocaleString()})`,
        } : null);
      }
    }

    // Track errors for display in dialog
    if (allErrors.length > 0 || allSkippedReasons.length > 0) {
      setTableSyncErrors((prev) => ({ ...prev, [tableKey]: [...allErrors, ...allSkippedReasons].slice(0, 5) }));
    }

    return { imported: totalImported, updated: totalUpdated, skipped: totalSkipped, total: totalRecords, source, errors: allErrors, skipped_reasons: allSkippedReasons, message: lastMessage };
  };

  // Handle pull ALL tables one-by-one with live progress + auto-batching
  const handlePullAll = async () => {
    try {
      setPullingAll(true);
      setShowSyncDialog(true);
      setError(null);
      setPullAllResult(null);
      setPullResult(null);
      setTableSyncErrors({});

      // Initialize all tables as pending (or pre-skipped)
      const initialStatus: Record<string, TableSyncStatus> = {};
      tables.forEach((t) => {
        initialStatus[t.key] = skippedTables.has(t.key) ? "skipped" : "pending";
      });
      setTableSyncStatus(initialStatus);

      const activeTables = tables.filter((t) => !skippedTables.has(t.key));
      setPullAllProgress({ current: 0, total: activeTables.length, currentTable: "Starting..." });

      const allResults: Record<string, { imported: number; updated: number; skipped: number; total: number; error?: string; source?: string; errors?: string[]; skipped_reasons?: string[]; message?: string }> = {};
      let totalImported = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;

      for (let i = 0; i < activeTables.length; i++) {
        const table = activeTables[i];
        const displayName = table.model.replace(/([A-Z])/g, " $1").trim();
        setPullAllProgress({ current: i + 1, total: activeTables.length, currentTable: displayName });
        setTableSyncStatus((prev) => ({ ...prev, [table.key]: "syncing" }));

        try {
          const result = await pullOneTable(table.key);

          allResults[table.key] = result;
          totalImported += result.imported;
          totalUpdated += result.updated;
          totalSkipped += result.skipped;

          const hasErrors = result.error || result.skipped > 0
            || (result.errors && result.errors.length > 0)
            || (result.skipped_reasons && result.skipped_reasons.length > 0);

          if (result.error) {
            setTableSyncStatus((prev) => ({ ...prev, [table.key]: "error" }));
          } else if (hasErrors && (result.imported > 0 || result.updated > 0)) {
            // Some succeeded but some failed - show as error so user sees the failures
            setTableSyncStatus((prev) => ({ ...prev, [table.key]: "error" }));
          } else if (result.imported > 0 || result.updated > 0) {
            setTableSyncStatus((prev) => ({ ...prev, [table.key]: "done" }));
          } else if (result.skipped > 0) {
            setTableSyncStatus((prev) => ({ ...prev, [table.key]: "error" }));
          } else {
            setTableSyncStatus((prev) => ({ ...prev, [table.key]: "skipped" }));
          }
        } catch (tableErr) {
          allResults[table.key] = {
            imported: 0, updated: 0, skipped: 0, total: 0,
            error: tableErr instanceof Error ? tableErr.message : "Request failed",
          };
          setTableSyncStatus((prev) => ({ ...prev, [table.key]: "error" }));
        }
      }

      setPullAllResult({
        totals: {
          imported: totalImported,
          updated: totalUpdated,
          skipped: totalSkipped,
          tables_processed: activeTables.length,
        },
        results: allResults,
      });

      // Refresh counts so tenant columns show updated numbers
      try {
        const refreshed = await api.get<{
          success: boolean;
          counts?: Record<string, { master: number; tenant: number }>;
          all_tenant_counts?: Record<string, Record<string, number>>;
        }>("/api/v1/config_sync/tables");
        if (refreshed?.success) {
          if (refreshed.all_tenant_counts) {
            setTableCounts(refreshed.all_tenant_counts);
          } else if (refreshed.counts) {
            const counts: Record<string, Record<string, number>> = {};
            for (const [key, val] of Object.entries(refreshed.counts)) {
              counts[key] = { master: val.master, tenant: val.tenant };
            }
            setTableCounts(counts);
          }
        }
      } catch {
        // Non-critical - counts just won't refresh
      }

      // Refresh current table view if one is selected
      if (selectedTable) {
        await fetchRecords();
      }
    } catch (err) {
      console.error("Pull all failed:", err);
      setError("Pull all failed. Please try again.");
    } finally {
      setPullingAll(false);
      setPullAllProgress(null);
    }
  };

  // Get display name for record
  const getRecordDisplayName = useCallback((record: MasterRecord): string => {
    if (record.name && typeof record.name === "string" && isNaN(Number(record.name))) {
      return record.name;
    }

    // For public_holidays, show name + date
    if (selectedTable === "public_holidays") {
      const name = record.name as string | undefined;
      const date = record.date as string | undefined;
      const dateStr = date ? new Date(date).toLocaleDateString() : "";
      return name ? `${name} (${dateStr})` : `Record #${record.id}`;
    }

    return record.name?.toString() || `Record #${record.id}`;
  }, [selectedTable]);

  // Count stats
  const compulsoryCount = records.filter((r) => r.sync_mode === "compulsory").length;
  const choiceCount = records.filter((r) => r.sync_mode === "choice").length;
  const missingCompulsory = records.filter((r) => r.sync_mode === "compulsory" && !r.exists_in_tenant).length;

  // ComboboxDropdown items for table selector
  type TableComboItem = ComboboxItem & { description: string };
  const tableComboItems: TableComboItem[] = React.useMemo(() =>
    tables.map((t) => ({
      id: t.key,
      label: t.model.replace(/([A-Z])/g, " $1").trim(),
      description: t.description,
      searchText: t.description,
    })),
    [tables]
  );
  const selectedTableItem = tableComboItems.find((t) => t.id === selectedTable);

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Sync from TEEEM
          </CardTitle>
          <CardDescription>
            Pull configuration records from TEEEM master tenant to keep your settings in sync
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">This is typically used for initial tenant setup</p>
                <p className="text-xs mt-1 text-amber-700 dark:text-amber-300">
                  Syncing will overwrite existing records with the source tenant&apos;s data. Any custom changes you&apos;ve made
                  (renamed statuses, modified templates, etc.) will be replaced. Use &quot;Skip&quot; to exclude tables with custom data,
                  or sync only the specific tables you need.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Your tenant:</span>
              <Badge variant="outline">{tenantInfo?.name || "Unknown"}</Badge>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button
                onClick={handlePullAll}
                disabled={pullingAll}
                variant="default"
              >
                {pullingAll ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Fresh Pull All Tables
                  </>
                )}
              </Button>
              {pullAllProgress && (
                <div className="flex flex-col items-end gap-1">
                  <div className="text-xs text-muted-foreground">
                    {pullAllProgress.current}/{pullAllProgress.total}: {pullAllProgress.currentTable}
                  </div>
                  <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${(pullAllProgress.current / pullAllProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Progress Dialog */}
      <Dialog open={showSyncDialog} onOpenChange={(open) => { if (!pullingAll) setShowSyncDialog(open); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {pullingAll ? (
                <>
                  <Spinner className="h-5 w-5" />
                  Syncing Configuration
                </>
              ) : pullAllResult ? (
                <>
                  <Check className="h-5 w-5 text-green-600" />
                  Sync Complete
                </>
              ) : (
                "Configuration Sync"
              )}
              {pullAllResult && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ml-auto">
                  {pullAllResult.totals.imported} added, {pullAllResult.totals.updated} updated
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Progress bar */}
          {pullAllProgress && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {pullAllProgress.current}/{pullAllProgress.total}: {pullAllProgress.currentTable}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {Math.round((pullAllProgress.current / pullAllProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(pullAllProgress.current / pullAllProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Counts table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                {isMasterTenant && <TableHead className="w-[130px]">Source</TableHead>}
                {tenants.map((t) => (
                  <TableHead key={t.slug} className="text-right w-[80px]">
                    {t.name}
                  </TableHead>
                ))}
                <TableHead className="w-[160px] text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((table) => {
                const counts = tableCounts[table.key] || {};
                const status = tableSyncStatus[table.key];
                const result = pullAllResult?.results[table.key];
                const batch = tableBatchProgress[table.key];
                const syncErrors = tableSyncErrors[table.key];
                const errorTooltip = result?.error || syncErrors?.join("; ") || "";
                const nonMasterTenants = tenants.filter((t) => !t.is_master);
                const selectedSourceId = tableSources[table.key];
                const selectedSourceName = nonMasterTenants.find((t) => t.id === selectedSourceId)?.name;

                const isSkipped = skippedTables.has(table.key);
                const isContacts = table.key === "contacts";
                const isPriceHistories = table.key === "price_histories";

                return (
                  <TableRow
                    key={table.key}
                    className={cn(
                      status === "syncing" && "bg-blue-50/50 dark:bg-blue-950/20",
                      status === "done" && "bg-green-50/30 dark:bg-green-950/10",
                      status === "error" && "bg-red-50/30 dark:bg-red-950/10",
                      isSkipped && !pullAllResult && "opacity-40",
                    )}
                  >
                    <TableCell className="font-medium py-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{table.model.replace(/([A-Z])/g, " $1").trim()}</span>
                        {/* Price only checkbox for contacts */}
                        {isContacts && !pullAllResult && (
                          <label className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-pointer ml-1">
                            <Checkbox
                              checked={contactsPriceOnly}
                              onCheckedChange={(checked) => setContactsPriceOnly(!!checked)}
                              className="h-3 w-3"
                              disabled={pullingAll}
                            />
                            <span>Price only</span>
                          </label>
                        )}
                        {isContacts && pullAllResult && contactsPriceOnly && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">price only</Badge>
                        )}
                        {isPriceHistories && pullAllResult && contactsPriceOnly && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">price only</Badge>
                        )}
                      </div>
                    </TableCell>
                    {isMasterTenant && (
                      <TableCell className="py-1.5">
                        {pullingAll || pullAllResult ? (
                          // During/after sync: show source name (read-only)
                          <span className="text-xs text-muted-foreground">
                            {result?.source || selectedSourceName || "-"}
                          </span>
                        ) : (
                          // Before sync: editable dropdown
                          <select
                            value={selectedSourceId || ""}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : 0;
                              setTableSources((prev) => ({ ...prev, [table.key]: val }));
                            }}
                            className="text-xs border rounded px-1.5 py-0.5 bg-background text-foreground w-full max-w-[120px]"
                          >
                            <option value="">Auto (largest)</option>
                            {nonMasterTenants.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({(counts[t.slug] || 0).toLocaleString()})
                              </option>
                            ))}
                          </select>
                        )}
                      </TableCell>
                    )}
                    {tenants.map((t) => (
                      <TableCell key={t.slug} className="text-right tabular-nums py-1.5 text-sm">
                        {(counts[t.slug] ?? counts[t.is_master ? "master" : "tenant"] ?? 0).toLocaleString()}
                      </TableCell>
                    ))}
                    <TableCell className="text-right py-1.5">
                      {status === "syncing" && (
                        <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs">
                          <Spinner className="h-3 w-3" />
                          {batch ? (
                            <span className="tabular-nums">{batch.processed.toLocaleString()}/{batch.total.toLocaleString()}</span>
                          ) : (
                            "Syncing..."
                          )}
                        </span>
                      )}
                      {status === "pending" && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          Waiting
                          <button
                            onClick={() => setSkippedTables((prev) => { const next = new Set(prev); next.add(table.key); return next; })}
                            className="hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted"
                            title="Skip this table"
                          >
                            <SkipForward className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {status === "done" && result && (
                        <span className="text-xs flex items-center justify-end gap-1.5">
                          <Check className="h-3 w-3 text-green-600" />
                          {result.total > 0 && <span className="text-muted-foreground">{result.total.toLocaleString()} synced</span>}
                          {result.imported > 0 && <span className="text-green-600">+{result.imported}</span>}
                          {result.updated > 0 && <span className="text-blue-600">{result.updated} upd</span>}
                          {result.total === 0 && <span className="text-muted-foreground">no records</span>}
                        </span>
                      )}
                      {status === "skipped" && (
                        <span className="text-xs text-muted-foreground flex items-center justify-end gap-1" title={result?.message || ""}>
                          {isSkipped && !pullAllResult ? (
                            // User-skipped before sync started: allow un-skip
                            <>
                              <SkipForward className="h-3 w-3" />
                              <span>Skipped</span>
                              <button
                                onClick={() => setSkippedTables((prev) => { const next = new Set(prev); next.delete(table.key); return next; })}
                                className="hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted ml-1"
                                title="Undo skip"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          ) : isSkipped ? (
                            // User-skipped during sync
                            <>
                              <SkipForward className="h-3 w-3" />
                              <span>Skipped by user</span>
                            </>
                          ) : (
                            // No changes from server
                            <>
                              <Check className="h-3 w-3" />
                              {result?.message || "no changes"}
                            </>
                          )}
                        </span>
                      )}
                      {status === "error" && (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs flex items-center gap-1.5">
                            <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            {result && (result.imported > 0 || result.updated > 0) && (
                              <span className="text-green-600">{result.imported + result.updated} ok</span>
                            )}
                            <span className="text-amber-600 dark:text-amber-400">
                              {result?.skipped ? `${result.skipped} failed` : result?.error || "Error"}
                            </span>
                          </span>
                          {/* Show first error detail from syncErrors, result.errors, result.skipped_reasons, or result.error */}
                          {(() => {
                            const firstError = syncErrors?.[0]
                              || result?.errors?.[0]
                              || result?.skipped_reasons?.[0]
                              || (result?.error && !result?.skipped ? result.error : null)
                              || null;
                            const allErrorText = [
                              ...(syncErrors || []),
                              ...(result?.errors || []),
                              ...(result?.skipped_reasons || []),
                            ].join("\n");
                            return firstError ? (
                              <span className="text-[10px] text-muted-foreground max-w-[300px] truncate" title={allErrorText}>
                                {firstError}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      )}
                      {!status && (
                        isSkipped ? (
                          <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                            <SkipForward className="h-3 w-3" />
                            <span>Skipped</span>
                            <button
                              onClick={() => setSkippedTables((prev) => { const next = new Set(prev); next.delete(table.key); return next; })}
                              className="hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted"
                              title="Undo skip"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                            -
                            <button
                              onClick={() => setSkippedTables((prev) => { const next = new Set(prev); next.add(table.key); return next; })}
                              className="hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted"
                              title="Skip this table"
                            >
                              <SkipForward className="h-3 w-3" />
                            </button>
                          </span>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Close button when done */}
          {!pullingAll && pullAllResult && (
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Table Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Configuration Type</CardTitle>
        </CardHeader>
        <CardContent>
          <ComboboxDropdown<TableComboItem>
            items={tableComboItems}
            selectedItem={selectedTableItem}
            onSelect={(item) => setSelectedTable(item.id)}
            placeholder="Choose a configuration to sync..."
            searchPlaceholder="Search configurations..."
            clearable
            onClear={() => setSelectedTable("")}
            renderListItem={({ item }) => (
              <div className="flex flex-col">
                <span className="font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">
                  {item.description}
                </span>
              </div>
            )}
            className="w-full max-w-md"
          />
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success State */}
      {pullResult && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="h-5 w-5" />
              <span>
                Sync complete: {pullResult.imported} added, {pullResult.updated} updated, {pullResult.skipped} skipped
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Records */}
      {recordsLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2">
              <Spinner className="h-5 w-5" />
              <span>Loading TEEEM configuration...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!recordsLoading && records.length > 0 && (
        <>
          {/* Stats & Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-600">
                      <Star className="h-3 w-3 mr-1" />
                      {compulsoryCount} Compulsory
                    </Badge>
                    {missingCompulsory > 0 && (
                      <Badge variant="destructive">{missingCompulsory} missing</Badge>
                    )}
                  </div>
                  <Badge variant="outline">
                    <CircleDot className="h-3 w-3 mr-1" />
                    {choiceCount} Optional
                  </Badge>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    {selectedRecords.size} selected
                  </span>
                  <div className="flex gap-2">
                    {missingCompulsory > 0 && (
                      <Button variant="outline" size="sm" onClick={selectCompulsory}>
                        Select Compulsory
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={selectAllNew}>
                      Select All New
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pull Button */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Select records below and click "Pull from TEEEM" to sync them to your tenant
                </p>
                <Button
                  onClick={handlePull}
                  disabled={selectedRecords.size === 0 || pulling}
                >
                  {pulling ? (
                    <>
                      <Spinner className="h-4 w-4 mr-2" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Pull from TEEEM ({selectedRecords.size})
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Records Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                TEEEM Records
                <Badge variant="secondary">{records.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-32">Sync Mode</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow
                      key={record.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50",
                        selectedRecords.has(record.id) && "bg-primary/5"
                      )}
                      onClick={() => toggleRecord(record.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          id={`record-${record.id}`}
                          checked={selectedRecords.has(record.id)}
                          onCheckedChange={() => toggleRecord(record.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{getRecordDisplayName(record)}</TableCell>
                      <TableCell>
                        {record.sync_mode === "compulsory" && (
                          <Badge className="bg-amber-600">
                            <Star className="h-3 w-3 mr-1" />
                            Compulsory
                          </Badge>
                        )}
                        {record.sync_mode === "choice" && (
                          <Badge variant="outline">
                            <CircleDot className="h-3 w-3 mr-1" />
                            Optional
                          </Badge>
                        )}
                        {!record.sync_mode && (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.exists_in_tenant ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <Check className="h-3 w-3 mr-1" />
                            Synced
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Not synced
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(record.updated_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {!recordsLoading && selectedTable && records.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No records available from TEEEM for this configuration type
            </p>
          </CardContent>
        </Card>
      )}

      {!selectedTable && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Select a configuration type above to see available records from TEEEM
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
