"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { RefreshCw, Upload, Building2, Check, AlertCircle, ChevronDown, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * AdminConfigSyncTab - TEEEM Admin Master Tenant Configuration
 *
 * TEEEM staff can:
 * - Browse any tenant's configuration
 * - Import selected records into master tenant
 * - Compare configurations across tenants
 *
 * SSoT: TenantConfigSyncService handles all backend sync logic
 */

interface ConfigTable {
  key: string;
  model: string;
  description: string;
  name_field: string;
}

interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  is_master_tenant: boolean;
}

interface ConfigRecord {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface CompareRecord {
  name: string;
  tenants: Record<string, { id?: number; exists: boolean; updated_at?: string }>;
}

export function AdminConfigSyncTab() {
  const [tables, setTables] = useState<ConfigTable[]>([]);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [masterTenant, setMasterTenant] = useState<TenantInfo | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [records, setRecords] = useState<ConfigRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<Set<number>>(new Set());
  const [compareData, setCompareData] = useState<CompareRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"browse" | "compare">("browse");
  const [compareOpen, setCompareOpen] = useState(false);

  // Fetch available tables and tenants on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get<{
          success: boolean;
          tables: ConfigTable[];
          master_tenant: TenantInfo | null;
          available_tenants: TenantInfo[];
        }>("/api/v1/admin/config_sync/tables");

        if (response?.success) {
          setTables(response.tables);
          setMasterTenant(response.master_tenant);
          // Filter out master tenant from list
          setTenants(
            response.available_tenants.filter((t) => !t.is_master_tenant)
          );
        }
      } catch (err) {
        console.error("Failed to fetch config data:", err);
        setError("Failed to load configuration. Make sure you have TEEEM staff access.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch records when tenant and table are selected
  const fetchRecords = useCallback(async () => {
    if (!selectedTenant || !selectedTable) {
      setRecords([]);
      return;
    }

    try {
      setRecordsLoading(true);
      setError(null);
      setImportResult(null);
      setSelectedRecords(new Set());

      const response = await api.get<{
        success: boolean;
        records: ConfigRecord[];
        source_tenant: TenantInfo;
      }>(`/api/v1/admin/config_sync/tenants/${selectedTenant}/config/${selectedTable}`);

      if (response?.success) {
        setRecords(response.records);
      }
    } catch (err) {
      console.error("Failed to fetch records:", err);
      setError("Failed to load records from tenant");
    } finally {
      setRecordsLoading(false);
    }
  }, [selectedTenant, selectedTable]);

  useEffect(() => {
    if (viewMode === "browse") {
      fetchRecords();
    }
  }, [fetchRecords, viewMode]);

  // Fetch comparison data
  const fetchComparison = useCallback(async () => {
    if (!selectedTable) {
      setCompareData(null);
      return;
    }

    try {
      setCompareLoading(true);
      setError(null);

      const response = await api.get<{
        success: boolean;
        records: CompareRecord[];
        tenants: TenantInfo[];
      }>(`/api/v1/admin/config_sync/compare?table=${selectedTable}`);

      if (response?.success) {
        setCompareData(response.records);
      }
    } catch (err) {
      console.error("Failed to fetch comparison:", err);
      setError("Failed to load comparison data");
    } finally {
      setCompareLoading(false);
    }
  }, [selectedTable]);

  useEffect(() => {
    if (viewMode === "compare" && selectedTable) {
      fetchComparison();
    }
  }, [fetchComparison, viewMode, selectedTable]);

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

  const selectAll = () => {
    setSelectedRecords(new Set(records.map((r) => r.id)));
  };

  const clearSelection = () => {
    setSelectedRecords(new Set());
  };

  // Handle import
  const handleImport = async () => {
    if (selectedRecords.size === 0 || !selectedTenant || !selectedTable) return;

    try {
      setImporting(true);
      setError(null);

      const response = await api.post<{
        success: boolean;
        imported?: ConfigRecord[];
        skipped?: Array<{ name: string; reason: string }>;
        errors?: string[];
        error?: string;
      }>("/api/v1/admin/config_sync/import", {
        source_tenant_id: parseInt(selectedTenant),
        table: selectedTable,
        record_ids: Array.from(selectedRecords),
      });

      if (response?.success) {
        setImportResult({
          imported: response.imported?.length || 0,
          skipped: response.skipped?.length || 0,
        });
        setSelectedRecords(new Set());
        // Refresh records
        await fetchRecords();
      } else {
        setError(response?.error || "Import failed");
      }
    } catch (err) {
      console.error("Import failed:", err);
      setError("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  // Get source tenant info
  const sourceTenant = tenants.find((t) => t.id.toString() === selectedTenant);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && !tables.length) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Master Tenant Config Sync
          </CardTitle>
          <CardDescription>
            Import configuration from customer tenants into TEEEM master
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Master tenant:</span>
            <Badge variant="default">{masterTenant?.name || "Not configured"}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Mode Selection */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === "browse" ? "default" : "outline"}
          onClick={() => setViewMode("browse")}
        >
          <Eye className="h-4 w-4 mr-2" />
          Browse & Import
        </Button>
        <Button
          variant={viewMode === "compare" ? "default" : "outline"}
          onClick={() => setViewMode("compare")}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Compare Tenants
        </Button>
      </div>

      {/* Table Selection (common to both modes) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Configuration Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Choose a configuration table..." />
              </SelectTrigger>
              <SelectContent>
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

            {viewMode === "browse" && (
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Choose a tenant to import from..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id.toString()}>
                      {tenant.name} ({tenant.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
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
      {importResult && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="h-5 w-5" />
              <span>
                Import complete: {importResult.imported} imported, {importResult.skipped}{" "}
                skipped
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Browse Mode */}
      {viewMode === "browse" && (
        <>
          {recordsLoading && (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center gap-2">
                  <Spinner className="h-5 w-5" />
                  <span>Loading records from tenant...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {!recordsLoading && records.length > 0 && (
            <>
              {/* Import Controls */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">
                        {selectedRecords.size} of {records.length} records selected
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={selectAll}>
                          Select All
                        </Button>
                        <Button variant="ghost" size="sm" onClick={clearSelection}>
                          Clear
                        </Button>
                      </div>
                    </div>

                    <Button
                      onClick={handleImport}
                      disabled={selectedRecords.size === 0 || importing}
                    >
                      {importing ? (
                        <>
                          <Spinner className="h-4 w-4 mr-2" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Import to Master
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
                    Records from {sourceTenant?.name}
                    <Badge variant="secondary">{records.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => (
                        <TableRow
                          key={record.id}
                          className={cn(
                            selectedRecords.has(record.id) && "bg-primary/5"
                          )}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedRecords.has(record.id)}
                              onCheckedChange={() => toggleRecord(record.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{record.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(record.updated_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                                <DialogHeader>
                                  <DialogTitle>{record.name}</DialogTitle>
                                  <DialogDescription>
                                    Full record details
                                  </DialogDescription>
                                </DialogHeader>
                                <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                                  {JSON.stringify(record, null, 2)}
                                </pre>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {!recordsLoading && selectedTable && selectedTenant && records.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No records found in this tenant for the selected table
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Compare Mode */}
      {viewMode === "compare" && (
        <>
          {compareLoading && (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center gap-2">
                  <Spinner className="h-5 w-5" />
                  <span>Comparing across tenants...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {!compareLoading && compareData && compareData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Configuration Comparison
                  <Badge variant="secondary" className="ml-2">
                    {compareData.length} unique records
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Records across all tenants for{" "}
                  {tables.find((t) => t.key === selectedTable)?.model || selectedTable}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background">
                          Record Name
                        </TableHead>
                        {masterTenant && (
                          <TableHead className="text-center bg-primary/10">
                            {masterTenant.name}
                          </TableHead>
                        )}
                        {tenants.map((tenant) => (
                          <TableHead key={tenant.id} className="text-center">
                            {tenant.name}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compareData.map((record) => (
                        <TableRow key={record.name}>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            {record.name}
                          </TableCell>
                          {masterTenant && (
                            <TableCell className="text-center bg-primary/5">
                              {record.tenants[masterTenant.slug]?.exists ? (
                                <Check className="h-4 w-4 mx-auto text-green-500" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          )}
                          {tenants.map((tenant) => {
                            const key = tenant.slug || tenant.id.toString();
                            const data = record.tenants[key];
                            return (
                              <TableCell key={tenant.id} className="text-center">
                                {data?.exists ? (
                                  <Check className="h-4 w-4 mx-auto text-green-500" />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {!compareLoading && selectedTable && (!compareData || compareData.length === 0) && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No records found across tenants for this table
                </p>
              </CardContent>
            </Card>
          )}

          {!compareLoading && !selectedTable && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  Select a configuration table to compare across tenants
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
