"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  // Fetch available tables on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get<{
          success: boolean;
          tables: ConfigTable[];
          tenant: TenantInfo | null;
        }>("/api/v1/config_sync/tables");

        if (response?.success) {
          setTables(response.tables);
          if (response.tenant) {
            setTenantInfo(response.tenant);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
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
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Your tenant:</span>
            <Badge variant="outline">{tenantInfo?.name || "Unknown"}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Configuration Type</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Choose a configuration to sync..." />
            </SelectTrigger>
            <SelectContent className="max-h-[400px]" position="popper" sideOffset={4}>
              {tables.map((table) => (
                <SelectItem key={table.key} value={table.key}>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {table.model.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {table.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
