"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, AlertCircle, AlertTriangle, RefreshCw, X, SkipForward } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * TenantSyncPullTab - Bulk sync from TEEEM master tenant
 *
 * Provides the "Sync Tables" button and dialog for bulk-pulling
 * all configuration tables from TEEEM to the current tenant.
 *
 * For per-table comparison and selective sync, see ConfigSyncTab's Compare button.
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

interface TenantInfo {
  id: number;
  name: string;
  slug: string;
}

interface TenantSyncPullTabProps {
  onSyncComplete?: (syncAt: string | null, syncBy: string | null) => void;
}

export function TenantSyncPullTab({ onSyncComplete }: TenantSyncPullTabProps) {
  const [tables, setTables] = useState<ConfigTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
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
  // Table dependency map: { table_key: [required_table_keys] }
  const [dependencies, setDependencies] = useState<Record<string, string[]>>({});
  // Dependency warnings returned from backend during sync
  const [tableDependencyWarnings, setTableDependencyWarnings] = useState<Record<string, string[]>>({});
  // Last config sync audit trail
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncBy, setLastSyncBy] = useState<string | null>(null);

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
          dependencies?: Record<string, string[]>;
          is_master_tenant?: boolean;
          all_tenant_counts?: Record<string, Record<string, number>>;
          all_tenants?: TenantCount[];
          last_config_sync_at?: string | null;
          last_config_sync_by?: string | null;
        }>("/api/v1/config_sync/tables");

        if (response?.success) {
          setTables(response.tables);
          if (response.tenant) {
            setTenantInfo(response.tenant);
          }
          if (response.dependencies) {
            setDependencies(response.dependencies);
          }
          setLastSyncAt(response.last_config_sync_at || null);
          setLastSyncBy(response.last_config_sync_by || null);
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

  // Batch size for large tables (prevents Heroku 30s timeout)
  const BATCH_SIZE = 500;

  // Pull a single table, auto-batching if needed
  const pullOneTable = async (tableKey: string): Promise<{
    imported: number; updated: number; skipped: number;
    total: number; source?: string; error?: string;
    errors?: string[]; skipped_reasons?: string[];
    message?: string; dependency_warnings?: string[];
  }> => {
    type PullResponse = {
      success: boolean; table: string;
      imported: number; updated: number; skipped: number;
      total: number; total_records: number;
      has_more: boolean; next_offset?: number;
      source?: string; error?: string; message?: string;
      errors?: string[]; skipped_reasons?: string[];
      dependency_warnings?: string[];
    };

    let totalImported = 0, totalUpdated = 0, totalSkipped = 0, totalProcessed = 0;
    let totalRecords = 0;
    let source: string | undefined;
    let lastMessage: string | undefined;
    let allErrors: string[] = [];
    let allSkippedReasons: string[] = [];
    let depWarnings: string[] = [];
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
      if (response.dependency_warnings?.length) depWarnings = [...depWarnings, ...response.dependency_warnings];

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

    // Track dependency warnings for display
    if (depWarnings.length > 0) {
      setTableDependencyWarnings((prev) => ({ ...prev, [tableKey]: depWarnings }));
    }

    return { imported: totalImported, updated: totalUpdated, skipped: totalSkipped, total: totalRecords, source, errors: allErrors, skipped_reasons: allSkippedReasons, message: lastMessage, dependency_warnings: depWarnings };
  };

  // Handle pull ALL tables one-by-one with live progress + auto-batching
  const handlePullAll = async () => {
    try {
      setPullingAll(true);
      setError(null);
      setPullAllResult(null);
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

      // Record sync timestamp (audit trail)
      try {
        const syncRecord = await api.post<{
          success: boolean;
          last_config_sync_at?: string;
          last_config_sync_by?: string;
        }>("/api/v1/config_sync/record_sync", {});
        if (syncRecord?.success) {
          setLastSyncAt(syncRecord.last_config_sync_at || null);
          setLastSyncBy(syncRecord.last_config_sync_by || null);
          onSyncComplete?.(syncRecord.last_config_sync_at || null, syncRecord.last_config_sync_by || null);
        }
      } catch (err) {
        console.error("[TenantSyncPull] sync record timestamp error:", err);
        // Non-critical - timestamp just won't update
      }

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
      } catch (err) {
        console.error("[TenantSyncPull] table counts refresh error:", err);
        // Non-critical - counts just won't refresh
      }

    } catch (err) {
      console.error("Pull all failed:", err);
      setError("Pull all failed. Please try again.");
    } finally {
      setPullingAll(false);
      setPullAllProgress(null);
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-6">
      {/* Warning + Actions */}
      <div className="space-y-3">
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
          <Button
            onClick={() => {
              setPullAllResult(null);
              setTableSyncStatus({});
              setTableSyncErrors({});
              setTableBatchProgress({});
              setShowSyncDialog(true);
            }}
            disabled={pullingAll}
            variant="default"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Tables
          </Button>
        </div>
      </div>

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
                "Configure Sync"
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

          {/* Dependency warnings: show when user skips tables that others depend on */}
          {!pullingAll && !pullAllResult && (() => {
            const warnings: string[] = [];
            for (const [tableKey, deps] of Object.entries(dependencies)) {
              if (skippedTables.has(tableKey)) continue; // This table is skipped anyway
              const missingDeps = deps.filter((dep) => skippedTables.has(dep));
              if (missingDeps.length > 0) {
                const tableName = tables.find((t) => t.key === tableKey)?.model.replace(/([A-Z])/g, " $1").trim() || tableKey;
                const depNames = missingDeps.map((d) => tables.find((t) => t.key === d)?.model.replace(/([A-Z])/g, " $1").trim() || d);
                warnings.push(`${tableName} requires ${depNames.join(", ")} to be synced first`);
              }
            }
            if (warnings.length === 0) return null;
            return (
              <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-2.5">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
                    <p className="font-medium">Sync order warning</p>
                    {warnings.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                </div>
              </div>
            );
          })()}

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
                <TableHead className="w-[160px] text-right">{pullAllResult || pullingAll ? "Status" : "Include"}</TableHead>
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
                const depWarnings = tableDependencyWarnings[table.key];
                // Pre-sync: check if any required deps are skipped
                const tableDeps = dependencies[table.key] || [];
                const skippedDeps = !pullingAll && !pullAllResult
                  ? tableDeps.filter((d) => skippedTables.has(d))
                  : [];

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
                        <label className="inline-flex items-center justify-end gap-1.5 text-xs cursor-pointer">
                          <Checkbox
                            checked={!isSkipped}
                            onCheckedChange={(checked) => {
                              setSkippedTables((prev) => {
                                const next = new Set(prev);
                                if (checked) next.delete(table.key); else next.add(table.key);
                                return next;
                              });
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <span className={cn("text-muted-foreground", isSkipped && "line-through")}>
                            {isSkipped ? "Skipped" : "Include"}
                          </span>
                        </label>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            {!pullingAll && !pullAllResult && (
              <>
                <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePullAll}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Start Sync
                </Button>
              </>
            )}
            {!pullingAll && pullAllResult && (
              <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
                Close
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Error State */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
