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
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
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
import { RefreshCw, Upload, Building2, Check, AlertCircle, ChevronDown, ChevronUp, Eye, Star, CircleDot, X } from "lucide-react";
import { api } from "@/lib/api";
import { API_TIMEOUT_HEAVY_SYNC } from "@/lib/constants/timeout-constants";
import { cn } from "@/lib/utils";
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
    deleted?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"browse" | "compare" | "manage">("browse");
  const [compareOpen, setCompareOpen] = useState(false);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [filterExistingContacts, setFilterExistingContacts] = useState<boolean>(true);
  const [latestOnlyFilter, setLatestOnlyFilter] = useState<boolean>(true);
  const [replaceExistingPrices, setReplaceExistingPrices] = useState<boolean>(true);
  const [totalUnfiltered, setTotalUnfiltered] = useState<number>(0);
  const [recordsExpanded, setRecordsExpanded] = useState<boolean>(true);
  // Sync preferences: { recordId: 'compulsory' | 'choice' | null }
  const [syncPreferences, setSyncPreferences] = useState<Record<number, string | null>>({});
  const [updatingSyncMode, setUpdatingSyncMode] = useState(false);

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
          // Sort tables alphabetically by display name
          const sortedTables = [...response.tables].sort((a, b) => {
            const nameA = a.model.replace(/([A-Z])/g, " $1").trim().toLowerCase();
            const nameB = b.model.replace(/([A-Z])/g, " $1").trim().toLowerCase();
            return nameA.localeCompare(nameB);
          });
          setTables(sortedTables);
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
      setEntityTypeFilter("all");

      // For price_histories, add filter parameters
      const params = new URLSearchParams();
      if (selectedTable === "price_histories") {
        if (filterExistingContacts) params.append("filter_existing_contacts", "true");
        if (latestOnlyFilter) params.append("latest_only", "true");
      }
      const queryString = params.toString() ? `?${params.toString()}` : "";

      const response = await api.get<{
        success: boolean;
        records: ConfigRecord[];
        source_tenant: TenantInfo;
        total_unfiltered?: number;
      }>(`/api/v1/admin/config_sync/tenants/${selectedTenant}/config/${selectedTable}${queryString}`);

      if (response?.success) {
        setRecords(response.records);
        setTotalUnfiltered(response.total_unfiltered || response.records.length);
      }
    } catch (err) {
      console.error("Failed to fetch records:", err);
      setError("Failed to load records from tenant");
    } finally {
      setRecordsLoading(false);
    }
  }, [selectedTenant, selectedTable, filterExistingContacts, latestOnlyFilter]);

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

  // Fetch master tenant records with sync preferences (for "Manage" mode)
  const fetchMasterRecords = useCallback(async () => {
    if (!selectedTable || !masterTenant) {
      setRecords([]);
      setSyncPreferences({});
      return;
    }

    try {
      setRecordsLoading(true);
      setError(null);
      setImportResult(null);
      setSelectedRecords(new Set());
      setEntityTypeFilter("all");

      // Fetch master tenant records
      const recordsResponse = await api.get<{
        success: boolean;
        records: ConfigRecord[];
        source_tenant: TenantInfo;
      }>(`/api/v1/admin/config_sync/tenants/${masterTenant.id}/config/${selectedTable}`);

      // Fetch sync preferences
      const prefsResponse = await api.get<{
        success: boolean;
        preferences: Record<number, string | null>;
      }>(`/api/v1/admin/config_sync/sync_preferences?table=${selectedTable}`);

      if (recordsResponse?.success) {
        setRecords(recordsResponse.records);
      }
      if (prefsResponse?.success) {
        setSyncPreferences(prefsResponse.preferences || {});
      }
    } catch (err) {
      console.error("Failed to fetch master records:", err);
      setError("Failed to load master tenant records");
    } finally {
      setRecordsLoading(false);
    }
  }, [selectedTable, masterTenant]);

  useEffect(() => {
    if (viewMode === "manage" && selectedTable && masterTenant) {
      fetchMasterRecords();
    }
  }, [fetchMasterRecords, viewMode, selectedTable, masterTenant]);

  // Update sync preferences for selected records
  const updateSyncMode = useCallback(async (mode: string | null) => {
    if (selectedRecords.size === 0 || !selectedTable) return;

    try {
      setUpdatingSyncMode(true);
      setError(null);

      const response = await api.post<{
        success: boolean;
        message?: string;
        error?: string;
      }>("/api/v1/admin/config_sync/sync_preferences", {
        table: selectedTable,
        record_ids: Array.from(selectedRecords),
        sync_mode: mode,
      });

      if (response?.success) {
        // Update local state
        setSyncPreferences((prev) => {
          const next = { ...prev };
          selectedRecords.forEach((id) => {
            if (mode) {
              next[id] = mode;
            } else {
              delete next[id];
            }
          });
          return next;
        });
        setSelectedRecords(new Set());
      } else {
        setError(response?.error || "Failed to update sync preferences");
      }
    } catch (err) {
      console.error("Failed to update sync preferences:", err);
      setError("Failed to update sync preferences");
    } finally {
      setUpdatingSyncMode(false);
    }
  }, [selectedRecords, selectedTable]);

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
    setSelectedRecords(new Set(filteredRecords.map((r) => r.id)));
  };

  const clearSelection = useCallback(() => {
    setSelectedRecords(new Set());
  }, []);

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
        deleted_count?: number;
      }>("/api/v1/admin/config_sync/import", {
        source_tenant_id: parseInt(selectedTenant),
        table: selectedTable,
        record_ids: Array.from(selectedRecords),
        replace_existing_prices: selectedTable === "price_histories" && replaceExistingPrices,
      }, { timeout: API_TIMEOUT_HEAVY_SYNC });

      if (response?.success) {
        setImportResult({
          imported: response.imported?.length || 0,
          skipped: response.skipped?.length || 0,
          deleted: response.deleted_count,
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

  // Get display name for a record - handles tables like price_histories where name is just ID
  const getRecordDisplayName = useCallback((record: ConfigRecord): string => {
    // If we have a meaningful name (not just a number), use it
    if (record.name && typeof record.name === "string" && isNaN(Number(record.name))) {
      return record.name;
    }

    // For price_histories, show more useful info
    if (selectedTable === "price_histories") {
      const price = record.new_price as number | undefined;
      const quoteRef = record.quote_reference as string | undefined;
      const lga = record.lga as string | undefined;
      const dateEffective = record.date_effective as string | undefined;

      const parts: string[] = [];
      if (quoteRef) parts.push(quoteRef);
      if (lga) parts.push(lga);
      if (price !== undefined && price !== null) parts.push(`$${Number(price).toFixed(2)}`);
      if (dateEffective) parts.push(new Date(dateEffective).toLocaleDateString());

      return parts.length > 0 ? parts.join(" - ") : `Record #${record.id}`;
    }

    // For job_type_statuses (join table), show IDs with labels
    if (selectedTable === "job_type_statuses") {
      const jobTypeId = record.job_type_id as number | undefined;
      const jobStatusId = record.job_status_id as number | undefined;
      return `Type #${jobTypeId || "?"} → Status #${jobStatusId || "?"}`;
    }

    // For job_status_stages (join table), show IDs with labels
    if (selectedTable === "job_status_stages") {
      const jobTypeId = record.job_type_id as number | undefined;
      const jobStatusId = record.job_status_id as number | undefined;
      const jobStageId = record.job_stage_id as number | undefined;
      return `Type #${jobTypeId || "?"} / Status #${jobStatusId || "?"} → Stage #${jobStageId || "?"}`;
    }

    // For public_holidays, show name + date to distinguish different years
    if (selectedTable === "public_holidays") {
      const name = record.name as string | undefined;
      const date = record.date as string | undefined;
      const dateStr = date ? new Date(date).toLocaleDateString() : "";
      return name ? `${name} (${dateStr})` : `Record #${record.id}`;
    }

    // Fallback to showing the name or ID
    return record.name?.toString() || `Record #${record.id}`;
  }, [selectedTable]);

  // Get unique entity types for filtering (when contacts table is selected)
  const uniqueEntityTypes = React.useMemo(() => {
    if (selectedTable !== "contacts") return [];
    const types = new Set<string>();
    records.forEach((r) => {
      const entityType = r.entity_type as string | undefined;
      if (entityType) types.add(entityType);
    });
    return Array.from(types).sort();
  }, [records, selectedTable]);

  // Filter records by entity type
  const filteredRecords = React.useMemo(() => {
    if (selectedTable !== "contacts" || entityTypeFilter === "all") return records;
    return records.filter((r) => r.entity_type === entityTypeFilter);
  }, [records, selectedTable, entityTypeFilter]);

  // ComboboxDropdown items for table and tenant selectors
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

  const tenantComboItems = React.useMemo(() =>
    tenants.map((t) => ({
      id: t.id.toString(),
      label: `${t.name} (${t.slug})`,
    })),
    [tenants]
  );
  const selectedTenantItem = tenantComboItems.find((t) => t.id === selectedTenant);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // For non-TEEEM staff users, silently hide this admin-only section
  // The "Tenant Configuration Overview" section below will still show
  if (error && !tables.length) {
    return null;
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
          <Upload className="h-4 w-4 mr-2" />
          Import from Tenant
        </Button>
        <Button
          variant={viewMode === "manage" ? "default" : "outline"}
          onClick={() => setViewMode("manage")}
        >
          <Star className="h-4 w-4 mr-2" />
          Manage TEEEM Records
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
            <ComboboxDropdown<TableComboItem>
              items={tableComboItems}
              selectedItem={selectedTableItem}
              onSelect={(item) => setSelectedTable(item.id)}
              placeholder="Choose a configuration table..."
              searchPlaceholder="Search tables..."
              clearable
              onClear={() => setSelectedTable("")}
              renderListItem={({ item, isChecked }) => (
                <div className="flex flex-col">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </div>
              )}
              className="w-full max-w-md"
            />

            {viewMode === "browse" && (
              <ComboboxDropdown
                items={tenantComboItems}
                selectedItem={selectedTenantItem}
                onSelect={(item) => setSelectedTenant(item.id)}
                placeholder="Choose a tenant to import from..."
                searchPlaceholder="Search tenants..."
                clearable
                onClear={() => setSelectedTenant("")}
                className="w-full max-w-md"
              />
            )}

            {/* Entity Type Filter - only show for contacts table in browse/manage mode */}
            {(viewMode === "browse" || viewMode === "manage") && selectedTable === "contacts" && uniqueEntityTypes.length > 0 && (
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Filter by entity type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Types ({records.length})
                  </SelectItem>
                  {uniqueEntityTypes.map((type) => {
                    const count = records.filter((r) => r.entity_type === type).length;
                    return (
                      <SelectItem key={type} value={type}>
                        {type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} ({count})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            {/* Price History Filters */}
            {viewMode === "browse" && selectedTable === "price_histories" && selectedTenant && (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="filter-existing-contacts"
                    checked={filterExistingContacts}
                    onCheckedChange={(checked) => setFilterExistingContacts(!!checked)}
                  />
                  <label htmlFor="filter-existing-contacts" className="text-sm cursor-pointer">
                    Only for TEEEM contacts
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="filter-latest-only"
                    checked={latestOnlyFilter}
                    onCheckedChange={(checked) => setLatestOnlyFilter(!!checked)}
                  />
                  <label htmlFor="filter-latest-only" className="text-sm cursor-pointer">
                    Latest price only
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="replace-existing-prices"
                    checked={replaceExistingPrices}
                    onCheckedChange={(checked) => setReplaceExistingPrices(!!checked)}
                  />
                  <label htmlFor="replace-existing-prices" className="text-sm cursor-pointer">
                    Replace existing prices
                  </label>
                </div>
                {(filterExistingContacts || latestOnlyFilter) && totalUnfiltered > 0 && records.length !== totalUnfiltered && (
                  <span className="text-sm text-muted-foreground">
                    ({records.length} of {totalUnfiltered})
                  </span>
                )}
              </div>
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
                Import complete: {importResult.imported} imported, {importResult.skipped} skipped
                {importResult.deleted !== undefined && importResult.deleted > 0 && (
                  <>, {importResult.deleted} old prices deleted</>
                )}
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

          {!recordsLoading && filteredRecords.length > 0 && (
            <>
              {/* Import Controls */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">
                        {selectedRecords.size} of {filteredRecords.length} records selected
                        {entityTypeFilter !== "all" && ` (filtered from ${records.length} total)`}
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

              {/* Records Table - Collapsible */}
              <Card>
                <CardHeader
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setRecordsExpanded(!recordsExpanded)}
                >
                  <CardTitle className="text-lg flex items-center gap-2">
                    {recordsExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                    Records from {sourceTenant?.name}
                    <Badge variant="secondary">{filteredRecords.length}</Badge>
                    {entityTypeFilter !== "all" && (
                      <Badge variant="outline" className="ml-1">
                        {entityTypeFilter.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {selectedRecords.size > 0 && (
                      <Badge variant="default" className="ml-1">
                        {selectedRecords.size} selected
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                {recordsExpanded && (
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Name</TableHead>
                        {selectedTable === "contacts" && <TableHead>Type</TableHead>}
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => (
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
                          {selectedTable === "contacts" && (
                            <TableCell className="text-muted-foreground text-xs">
                              {(record.entity_type as string)?.replace(/_/g, " ") || "-"}
                            </TableCell>
                          )}
                          <TableCell className="text-muted-foreground">
                            {new Date(record.updated_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                                <DialogHeader>
                                  <DialogTitle>{getRecordDisplayName(record)}</DialogTitle>
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
                )}
              </Card>
            </>
          )}

          {!recordsLoading && selectedTable && selectedTenant && filteredRecords.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  {records.length > 0 && entityTypeFilter !== "all"
                    ? `No ${entityTypeFilter.replace(/_/g, " ")} contacts found (${records.length} total contacts available)`
                    : "No records found in this tenant for the selected table"}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Manage Mode - Set compulsory/choice flags for TEEEM records */}
      {viewMode === "manage" && (
        <>
          {recordsLoading && (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center gap-2">
                  <Spinner className="h-5 w-5" />
                  <span>Loading TEEEM records...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {!recordsLoading && filteredRecords.length > 0 && (
            <>
              {/* Sync Mode Controls */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">
                        {selectedRecords.size} of {filteredRecords.length} records selected
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

                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => updateSyncMode("compulsory")}
                        disabled={selectedRecords.size === 0 || updatingSyncMode}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Set Compulsory
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateSyncMode("choice")}
                        disabled={selectedRecords.size === 0 || updatingSyncMode}
                      >
                        <CircleDot className="h-4 w-4 mr-1" />
                        Set Choice
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateSyncMode(null)}
                        disabled={selectedRecords.size === 0 || updatingSyncMode}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Clear Flag
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Records Table with Sync Mode */}
              <Card>
                <CardHeader
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setRecordsExpanded(!recordsExpanded)}
                >
                  <CardTitle className="text-lg flex items-center gap-2">
                    {recordsExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                    TEEEM Records
                    <Badge variant="secondary">{filteredRecords.length}</Badge>
                    {entityTypeFilter !== "all" && (
                      <Badge variant="outline" className="ml-1">
                        {entityTypeFilter.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                {recordsExpanded && (
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-32">Sync Mode</TableHead>
                        {selectedTable === "contacts" && <TableHead>Type</TableHead>}
                        <TableHead>Last Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => {
                        const syncMode = syncPreferences[record.id];
                        return (
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
                                id={`manage-record-${record.id}`}
                                checked={selectedRecords.has(record.id)}
                                onCheckedChange={() => toggleRecord(record.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{getRecordDisplayName(record)}</TableCell>
                            <TableCell>
                              {syncMode === "compulsory" && (
                                <Badge className="bg-amber-600">
                                  <Star className="h-3 w-3 mr-1" />
                                  Compulsory
                                </Badge>
                              )}
                              {syncMode === "choice" && (
                                <Badge variant="outline">
                                  <CircleDot className="h-3 w-3 mr-1" />
                                  Choice
                                </Badge>
                              )}
                              {!syncMode && (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            {selectedTable === "contacts" && (
                              <TableCell className="text-muted-foreground text-xs">
                                {(record.entity_type as string)?.replace(/_/g, " ") || "-"}
                              </TableCell>
                            )}
                            <TableCell className="text-muted-foreground">
                              {new Date(record.updated_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
                )}
              </Card>
            </>
          )}

          {!recordsLoading && selectedTable && filteredRecords.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  {records.length > 0 && entityTypeFilter !== "all"
                    ? `No ${entityTypeFilter.replace(/_/g, " ")} records found`
                    : "No records found in TEEEM for the selected table. Import some first!"}
                </p>
              </CardContent>
            </Card>
          )}

          {!selectedTable && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  Select a configuration table to manage sync preferences
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
                                <Check className="h-4 w-4 mx-auto text-green-500 dark:text-green-400" />
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
                                  <Check className="h-4 w-4 mx-auto text-green-500 dark:text-green-400" />
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
