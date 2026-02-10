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
import { Download, Check, Star, CircleDot, AlertCircle, RefreshCw } from "lucide-react";
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
    results: Record<string, { imported: number; updated: number; skipped: number; total: number; error?: string; source?: string }>;
  } | null>(null);
  const [tenants, setTenants] = useState<TenantCount[]>([]);
  const [tableCounts, setTableCounts] = useState<Record<string, Record<string, number>>>({});
  const [isMasterTenant, setIsMasterTenant] = useState(false);
  const [tableSyncStatus, setTableSyncStatus] = useState<Record<string, TableSyncStatus>>({});

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

  // Handle pull ALL tables one-by-one with live progress
  const handlePullAll = async () => {
    try {
      setPullingAll(true);
      setError(null);
      setPullAllResult(null);
      setPullResult(null);

      // Initialize all tables as pending
      const initialStatus: Record<string, TableSyncStatus> = {};
      tables.forEach((t) => { initialStatus[t.key] = "pending"; });
      setTableSyncStatus(initialStatus);

      setPullAllProgress({ current: 0, total: tables.length, currentTable: "Starting..." });

      const allResults: Record<string, { imported: number; updated: number; skipped: number; total: number; error?: string; source?: string }> = {};
      let totalImported = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const displayName = table.model.replace(/([A-Z])/g, " $1").trim();
        setPullAllProgress({ current: i + 1, total: tables.length, currentTable: displayName });
        setTableSyncStatus((prev) => ({ ...prev, [table.key]: "syncing" }));

        try {
          const response = await api.post<{
            success: boolean;
            table: string;
            imported: number;
            updated: number;
            skipped: number;
            total: number;
            source?: string;
            error?: string;
            message?: string;
          }>("/api/v1/config_sync/pull_one_table", { table: table.key });

          if (response?.success) {
            const imported = response.imported || 0;
            const updated = response.updated || 0;
            const skipped = response.skipped || 0;

            allResults[table.key] = {
              imported, updated, skipped,
              total: response.total || 0,
              source: response.source,
            };
            totalImported += imported;
            totalUpdated += updated;
            totalSkipped += skipped;

            setTableSyncStatus((prev) => ({
              ...prev,
              [table.key]: (imported > 0 || updated > 0) ? "done" : "skipped",
            }));
          } else {
            allResults[table.key] = {
              imported: 0, updated: 0, skipped: 0, total: 0,
              error: response?.error || "Unknown error",
            };
            setTableSyncStatus((prev) => ({ ...prev, [table.key]: "error" }));
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
          tables_processed: tables.length,
        },
        results: allResults,
      });

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
        <CardContent>
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

      {/* Counts Table with Live Sync Progress */}
      {tables.length > 0 && Object.keys(tableCounts).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Configuration Counts
              {pullAllResult && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {pullAllResult.totals.imported} added, {pullAllResult.totals.updated} updated
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Table</TableHead>
                  {tenants.map((t) => (
                    <TableHead key={t.slug} className="text-right w-[100px]">
                      {t.name}
                    </TableHead>
                  ))}
                  {(pullingAll || pullAllResult) && (
                    <TableHead className="w-[180px] text-right">Sync Status</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => {
                  const counts = tableCounts[table.key] || {};
                  const status = tableSyncStatus[table.key];
                  const result = pullAllResult?.results[table.key];

                  return (
                    <TableRow
                      key={table.key}
                      className={cn(
                        status === "syncing" && "bg-blue-50/50 dark:bg-blue-950/20",
                        status === "done" && "bg-green-50/30 dark:bg-green-950/10",
                      )}
                    >
                      <TableCell className="font-medium py-1.5">
                        {table.model.replace(/([A-Z])/g, " $1").trim()}
                      </TableCell>
                      {tenants.map((t) => (
                        <TableCell key={t.slug} className="text-right tabular-nums py-1.5">
                          {(counts[t.slug] ?? counts[t.is_master ? "master" : "tenant"] ?? 0).toLocaleString()}
                        </TableCell>
                      ))}
                      {(pullingAll || pullAllResult) && (
                        <TableCell className="text-right py-1.5">
                          {status === "syncing" && (
                            <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs">
                              <Spinner className="h-3 w-3" />
                              Syncing...
                            </span>
                          )}
                          {status === "pending" && (
                            <span className="text-xs text-muted-foreground">Waiting</span>
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
                            <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                              <Check className="h-3 w-3" />
                              no changes
                            </span>
                          )}
                          {status === "error" && (
                            <span className="text-xs text-destructive flex items-center justify-end gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Error
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
