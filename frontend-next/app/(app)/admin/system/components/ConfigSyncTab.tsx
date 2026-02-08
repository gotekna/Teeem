"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  X,
  Plus,
  Minus,
  Equal,
  ChevronRight,
  Briefcase,
  FileText,
  Users,
  Calendar,
  Settings,
  Calculator,
  DollarSign,
  Warehouse,
  ShieldCheck,
  Mail,
  Map
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * ConfigSyncTab - Side-by-Side Configuration Comparison & Sync
 *
 * Shows TEEEM master vs Current Tenant side-by-side with:
 * - Records only in TEEEM (can pull)
 * - Records only in Tenant (can push to TEEEM if master tenant)
 * - Records in both (matching or different)
 * - Selective sync with checkboxes
 */

interface ConfigTable {
  key: string;
  model: string;
  description: string;
  name_field: string;
  group: string;
}

interface ConfigGroup {
  key: string;
  label: string;
}

// Icons for each group
const GROUP_ICONS: Record<string, React.ReactNode> = {
  jobs: <Briefcase className="h-4 w-4" />,
  documents: <FileText className="h-4 w-4" />,
  contacts: <Users className="h-4 w-4" />,
  schedule: <Calendar className="h-4 w-4" />,
  operations: <Settings className="h-4 w-4" />,
  estimating: <Calculator className="h-4 w-4" />,
  finance: <DollarSign className="h-4 w-4" />,
  warehouse: <Warehouse className="h-4 w-4" />,
  whs: <ShieldCheck className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  plans: <Map className="h-4 w-4" />,
};

interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  is_master_tenant: boolean;
}

interface TableCounts {
  [key: string]: {
    master: number;
    tenant: number;
  };
}

// All tenant counts by table key → tenant slug → count
interface AllTenantCounts {
  [tableKey: string]: {
    [tenantSlug: string]: number;
  };
}

// Tenant summary info
interface TenantSummary {
  id: number;
  name: string;
  slug: string;
  is_master: boolean;
}

interface ConfigRecord {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface ComparisonRow {
  name: string;
  teeemRecord: ConfigRecord | null;
  tenantRecord: ConfigRecord | null;
  status: "only_teeem" | "only_tenant" | "same" | "different";
  changes?: Record<string, { master: unknown; tenant: unknown }>;
}

type SyncMode = "add_new" | "replace_existing" | "skip_existing";

export function ConfigSyncTab() {
  const [tables, setTables] = useState<ConfigTable[]>([]);
  const [tableCounts, setTableCounts] = useState<TableCounts>({});
  const [allTenantCounts, setAllTenantCounts] = useState<AllTenantCounts>({});
  const [allTenants, setAllTenants] = useState<TenantSummary[]>([]);
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  // Start with all groups collapsed (empty array = none expanded)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [masterTenant, setMasterTenant] = useState<TenantInfo | null>(null);
  const [currentTenant, setCurrentTenant] = useState<TenantInfo | null>(null);
  const [isMasterTenant, setIsMasterTenant] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [comparison, setComparison] = useState<ComparisonRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyPriceMarkup, setApplyPriceMarkup] = useState(false);


  // Fetch available tables on mount
  const fetchTables = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{
        success: boolean;
        tables: ConfigTable[];
        counts: TableCounts;
        all_tenant_counts: AllTenantCounts;
        all_tenants: TenantSummary[];
        groups: ConfigGroup[];
        master_tenant: TenantInfo | null;
        tenant: TenantInfo | null;
        is_master_tenant: boolean;
      }>("/api/v1/config_sync/tables");

      if (response?.success) {
        setTables(response.tables);
        setTableCounts(response.counts || {});
        setAllTenantCounts(response.all_tenant_counts || {});
        setAllTenants(response.all_tenants || []);
        setGroups(response.groups || []);
        setMasterTenant(response.master_tenant);
        setCurrentTenant(response.tenant);
        setIsMasterTenant(response.is_master_tenant);
      }
    } catch (err) {
      console.error("Failed to fetch config tables:", err);
      setError("Failed to load configuration tables");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Fetch comparison when table changes
  const fetchComparison = useCallback(async () => {
    if (!selectedTable) {
      setComparison([]);
      return;
    }

    try {
      setComparing(true);
      setError(null);
      setSyncResult(null);
      setSelectedRows(new Set());

      const response = await api.get<{
        success: boolean;
        table: string;
        master_tenant: TenantInfo;
        tenant: TenantInfo;
        summary: { new: number; modified: number; deleted: number; unchanged: number };
        new_records: ConfigRecord[];
        modified_records: Array<{
          master: ConfigRecord;
          tenant: ConfigRecord;
          changes: Record<string, { master: unknown; tenant: unknown }>;
        }>;
        deleted_records: ConfigRecord[];
        unchanged_records: ConfigRecord[];
      }>(`/api/v1/config_sync/diff/${selectedTable}`);

      if (response?.success) {
        // Build comparison rows
        const rows: ComparisonRow[] = [];

        // Records only in TEEEM (new to tenant)
        response.new_records.forEach((record) => {
          rows.push({
            name: record.name,
            teeemRecord: record,
            tenantRecord: null,
            status: "only_teeem",
          });
        });

        // Records only in tenant (not in TEEEM)
        response.deleted_records.forEach((record) => {
          rows.push({
            name: record.name,
            teeemRecord: null,
            tenantRecord: record,
            status: "only_tenant",
          });
        });

        // Records that differ
        response.modified_records.forEach((mod) => {
          rows.push({
            name: mod.master.name,
            teeemRecord: mod.master,
            tenantRecord: mod.tenant,
            status: "different",
            changes: mod.changes,
          });
        });

        // Records that match
        response.unchanged_records.forEach((record) => {
          rows.push({
            name: record.name,
            teeemRecord: record,
            tenantRecord: record,
            status: "same",
          });
        });

        // Sort by status then name
        rows.sort((a, b) => {
          const statusOrder = { only_teeem: 0, only_tenant: 1, different: 2, same: 3 };
          const statusDiff = statusOrder[a.status] - statusOrder[b.status];
          if (statusDiff !== 0) return statusDiff;
          return a.name.localeCompare(b.name);
        });

        setComparison(rows);
      }
    } catch (err) {
      console.error("Failed to fetch comparison:", err);
      setError("Failed to compare configuration");
    } finally {
      setComparing(false);
    }
  }, [selectedTable]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  // Toggle row selection
  const toggleRow = (name: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Select all syncable rows (only_teeem, different, or only_tenant)
  const selectAllSyncable = () => {
    const syncable = comparison
      .filter((r) => r.status === "only_teeem" || r.status === "different" || r.status === "only_tenant")
      .map((r) => r.name);
    setSelectedRows(new Set(syncable));
  };

  const clearSelection = () => {
    setSelectedRows(new Set());
  };

  // Pull selected records from TEEEM
  const handlePull = async (mode: SyncMode = "add_new") => {
    const rowsToPull = comparison.filter(
      (r) => selectedRows.has(r.name) && r.teeemRecord
    );

    if (rowsToPull.length === 0) return;

    try {
      setSyncing(true);
      setError(null);

      // Prepare request body
      const requestBody: {
        table: string;
        record_ids: number[];
        mode: SyncMode;
        price_markup_percent?: number;
      } = {
        table: selectedTable,
        record_ids: rowsToPull.map((r) => r.teeemRecord!.id),
        mode: mode,
      };

      // Add price markup for pricebook-related tables
      if (applyPriceMarkup && (selectedTable === "pricebook_items" || selectedTable === "price_histories")) {
        requestBody.price_markup_percent = 5; // 5% markup
      }

      const response = await api.post<{
        success: boolean;
        imported?: ConfigRecord[];
        updated?: ConfigRecord[];
        skipped?: Array<{ name: string; reason: string }>;
        error?: string;
        price_markup_applied?: number;
      }>("/api/v1/config_sync/pull", requestBody);

      if (response?.success) {
        const imported = response.imported?.length || 0;
        const updated = response.updated?.length || 0;
        const markupNote = response.price_markup_applied ? ` (${response.price_markup_applied}% markup applied)` : "";
        setSyncResult(`Pulled: ${imported} added, ${updated} updated${markupNote}`);
        // Refresh comparison
        await fetchComparison();
      } else {
        setError(response?.error || "Sync failed");
      }
    } catch (err) {
      console.error("Sync failed:", err);
      setError("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  // Push selected records TO TEEEM (TEEEM staff only)
  const handlePush = async () => {
    const rowsToPush = comparison.filter(
      (r) => selectedRows.has(r.name) && r.tenantRecord && r.status === "only_tenant"
    );

    if (rowsToPush.length === 0) return;

    try {
      setPushing(true);
      setError(null);

      const response = await api.post<{
        success: boolean;
        imported?: ConfigRecord[];
        skipped?: Array<{ name: string; reason: string }>;
        error?: string;
      }>("/api/v1/config_sync/push", {
        table: selectedTable,
        record_ids: rowsToPush.map((r) => r.tenantRecord!.id),
      });

      if (response?.success) {
        const imported = response.imported?.length || 0;
        setSyncResult(`Pushed to TEEEM: ${imported} records`);
        // Refresh comparison
        await fetchComparison();
      } else {
        setError(response?.error || "Push failed");
      }
    } catch (err) {
      console.error("Push failed:", err);
      setError("Push failed. Please try again.");
    } finally {
      setPushing(false);
    }
  };

  // Count by status
  const counts = {
    onlyTeeem: comparison.filter((r) => r.status === "only_teeem").length,
    onlyTenant: comparison.filter((r) => r.status === "only_tenant").length,
    different: comparison.filter((r) => r.status === "different").length,
    same: comparison.filter((r) => r.status === "same").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!masterTenant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuration Sync</CardTitle>
          <CardDescription>No master tenant configured</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Contact your administrator to configure a TEEEM master tenant.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header - only shown when comparing a specific table */}
      {selectedTable && (
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedTable("");
              setComparison([]);
              fetchTables(); // Refresh counts
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-sm font-medium">
            {tables.find(t => t.key === selectedTable)?.model.replace(/([A-Z])/g, " $1").trim()}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="default" className="text-xs">{masterTenant.name}</Badge>
            <RefreshCw className="h-3 w-3 text-muted-foreground" />
            <Badge variant="secondary" className="text-xs">{currentTenant?.name}</Badge>
          </div>
        </div>
      )}

      {/* Error/Success messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {syncResult && (
        <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-lg">
          <Check className="h-4 w-4" />
          <span>{syncResult}</span>
        </div>
      )}

      {/* Summary counts */}
      {selectedTable && !comparing && comparison.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="flex items-center gap-2 p-2 bg-green-100 dark:bg-green-950/30 rounded text-sm">
            <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="font-medium">{counts.onlyTeeem}</span>
            <span className="text-muted-foreground">in TEEEM only</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-yellow-100 dark:bg-yellow-950/30 rounded text-sm">
            <Minus className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <span className="font-medium">{counts.onlyTenant}</span>
            <span className="text-muted-foreground">in Tenant only</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-blue-100 dark:bg-blue-950/30 rounded text-sm">
            <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="font-medium">{counts.different}</span>
            <span className="text-muted-foreground">different</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
            <Equal className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{counts.same}</span>
            <span className="text-muted-foreground">same</span>
          </div>
        </div>
      )}

      {/* Sync controls */}
      {selectedTable && !comparing && (counts.onlyTeeem > 0 || counts.different > 0 || counts.onlyTenant > 0) && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <span className="text-sm">
              <strong>{selectedRows.size}</strong> selected
            </span>
            <Button variant="outline" size="sm" onClick={selectAllSyncable}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            {/* Price markup checkbox for pricebook tables */}
            {(selectedTable === "pricebook_items" || selectedTable === "price_histories") && (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l">
                <Checkbox
                  id="apply-markup"
                  checked={applyPriceMarkup}
                  onCheckedChange={(checked) => setApplyPriceMarkup(checked === true)}
                />
                <Label htmlFor="apply-markup" className="text-sm cursor-pointer">
                  Apply 5% markup to prices
                </Label>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Pull from TEEEM controls */}
            {(counts.onlyTeeem > 0 || counts.different > 0) && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedRows.size === 0 || syncing || pushing}
                  onClick={() => handlePull("add_new")}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Pull New Only
                </Button>
                <Button
                  size="sm"
                  disabled={selectedRows.size === 0 || syncing || pushing}
                  onClick={() => handlePull("replace_existing")}
                >
                  {syncing ? (
                    <Spinner className="h-4 w-4 mr-1" />
                  ) : (
                    <ArrowLeft className="h-4 w-4 mr-1" />
                  )}
                  Pull & Replace
                </Button>
              </>
            )}

            {/* Push to TEEEM control (for records only in tenant) */}
            {counts.onlyTenant > 0 && (
              <Button
                size="sm"
                variant="secondary"
                disabled={selectedRows.size === 0 || syncing || pushing}
                onClick={handlePush}
                title="Push selected records to TEEEM master (TEEEM staff only)"
              >
                {pushing ? (
                  <Spinner className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-1" />
                )}
                Push to TEEEM
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {comparing && (
        <div className="flex items-center justify-center p-8">
          <Spinner className="h-6 w-6 mr-2" />
          <span>Comparing configurations...</span>
        </div>
      )}

      {/* Side-by-side comparison table */}
      {selectedTable && !comparing && comparison.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10 p-2"></th>
                <th className="p-2 text-left w-1/3 border-r">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs">{masterTenant.name}</Badge>
                  </div>
                </th>
                <th className="p-2 text-center w-12">Status</th>
                <th className="p-2 text-left w-1/3 border-l">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{currentTenant?.name}</Badge>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr
                  key={row.name}
                  className={cn(
                    "border-t hover:bg-muted/30",
                    selectedRows.has(row.name) && "bg-primary/5"
                  )}
                >
                  {/* Checkbox */}
                  <td className="p-2 text-center">
                    {(row.status === "only_teeem" || row.status === "different" || row.status === "only_tenant") && (
                      <Checkbox
                        checked={selectedRows.has(row.name)}
                        onCheckedChange={() => toggleRow(row.name)}
                      />
                    )}
                  </td>

                  {/* TEEEM side */}
                  <td className={cn(
                    "p-2 border-r",
                    row.status === "only_teeem" && "bg-green-50 dark:bg-green-950/20"
                  )}>
                    {row.teeemRecord ? (
                      <div>
                        <div className="font-medium">{row.teeemRecord.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(row.teeemRecord.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </td>

                  {/* Status indicator */}
                  <td className="p-2 text-center" title={
                    row.status === "only_teeem" ? "Only in TEEEM" :
                    row.status === "only_tenant" ? "Only in Tenant" :
                    row.status === "different" ? "Different" : "Same"
                  }>
                    {row.status === "only_teeem" && (
                      <Plus className="h-4 w-4 mx-auto text-green-600 dark:text-green-400" />
                    )}
                    {row.status === "only_tenant" && (
                      <Minus className="h-4 w-4 mx-auto text-yellow-600 dark:text-yellow-400" />
                    )}
                    {row.status === "different" && (
                      <RefreshCw className="h-4 w-4 mx-auto text-blue-600 dark:text-blue-400" />
                    )}
                    {row.status === "same" && (
                      <Check className="h-4 w-4 mx-auto text-muted-foreground" />
                    )}
                  </td>

                  {/* Tenant side */}
                  <td className={cn(
                    "p-2 border-l",
                    row.status === "only_tenant" && "bg-yellow-50 dark:bg-yellow-950/20"
                  )}>
                    {row.tenantRecord ? (
                      <div>
                        <div className="font-medium">{row.tenantRecord.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(row.tenantRecord.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {selectedTable && !comparing && comparison.length === 0 && (
        <div className="text-center p-8 text-muted-foreground">
          No configuration records found for this table
        </div>
      )}

      {/* Overview with accordion groups (shown when no table selected) */}
      {!selectedTable && (
        <Accordion
          type="multiple"
          value={expandedGroups}
          onValueChange={setExpandedGroups}
          className="space-y-2"
        >
          {groups.map((group) => {
            const groupTables = tables.filter((t) => t.group === group.key);
            if (groupTables.length === 0) return null;

            // Calculate group totals
            // Use allTenants if available (master tenant view), otherwise use master vs current
            const showAllTenants = allTenants.length > 0;
            const groupMasterTotal = groupTables.reduce(
              (sum, t) => sum + (tableCounts[t.key]?.master || 0),
              0
            );
            const groupTenantTotal = groupTables.reduce(
              (sum, t) => sum + (tableCounts[t.key]?.tenant || 0),
              0
            );
            const groupTotals: Record<string, number> = {};
            if (showAllTenants) {
              allTenants.forEach((tenant) => {
                const slug = tenant.slug || tenant.id.toString();
                groupTotals[slug] = groupTables.reduce(
                  (sum, t) => sum + (allTenantCounts[t.key]?.[slug] || 0),
                  0
                );
              });
            }

            return (
              <AccordionItem key={group.key} value={group.key} className="border rounded-lg overflow-hidden">
                {/* Group Header */}
                <AccordionTrigger className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted/70 hover:no-underline [&[data-state=open]>div>svg]:rotate-90">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200" />
                    {GROUP_ICONS[group.key]}
                    <span className="font-medium">{group.label}</span>
                    <span className="text-xs text-muted-foreground">
                      ({groupTables.length} {groupTables.length === 1 ? "table" : "tables"})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {showAllTenants ? (
                      // Master tenant: show all tenants
                      allTenants.map((tenant) => {
                        const slug = tenant.slug || tenant.id.toString();
                        return (
                          <div key={tenant.id} className="flex items-center gap-1">
                            <Badge
                              variant={tenant.is_master ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {tenant.name}
                            </Badge>
                            <span className="font-mono w-8 text-right">{groupTotals[slug] || 0}</span>
                          </div>
                        );
                      })
                    ) : (
                      // Other tenants: show master vs current only
                      <>
                        <div className="flex items-center gap-1">
                          <Badge variant="default" className="text-xs">{masterTenant?.name || "TEEEM"}</Badge>
                          <span className="font-mono w-8 text-right">{groupMasterTotal}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">{currentTenant?.name || "Tenant"}</Badge>
                          <span className="font-mono w-8 text-right">{groupTenantTotal}</span>
                        </div>
                      </>
                    )}
                  </div>
                </AccordionTrigger>

                {/* Group Content */}
                <AccordionContent>
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="p-2 pl-10 text-left font-medium text-xs text-muted-foreground">Table</th>
                        {showAllTenants ? (
                          // Master tenant: show all tenant columns
                          allTenants.map((tenant) => (
                            <th
                              key={tenant.id}
                              className="p-2 text-center font-medium text-xs text-muted-foreground w-20"
                            >
                              {tenant.name}
                            </th>
                          ))
                        ) : (
                          // Other tenants: show master vs current + diff
                          <>
                            <th className="p-2 text-center font-medium text-xs text-muted-foreground w-24">
                              {masterTenant?.name || "TEEEM"}
                            </th>
                            <th className="p-2 text-center font-medium text-xs text-muted-foreground w-24">
                              {currentTenant?.name || "Tenant"}
                            </th>
                            <th className="p-2 text-center font-medium text-xs text-muted-foreground w-20">Diff</th>
                          </>
                        )}
                        <th className="p-2 text-right font-medium text-xs text-muted-foreground w-28">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupTables.map((table) => {
                        const counts = tableCounts[table.key] || { master: 0, tenant: 0 };
                        const diff = counts.tenant - counts.master;
                        const tableTenantCounts = allTenantCounts[table.key] || {};
                        return (
                          <tr key={table.key} className="border-t hover:bg-muted/30">
                            <td className="p-2 pl-10">
                              <div className="font-medium">{table.model.replace(/([A-Z])/g, " $1").trim()}</div>
                              <div className="text-xs text-muted-foreground">{table.description}</div>
                            </td>
                            {showAllTenants ? (
                              // Master tenant: show all tenant counts
                              allTenants.map((tenant) => {
                                const slug = tenant.slug || tenant.id.toString();
                                const count = tableTenantCounts[slug] || 0;
                                return (
                                  <td key={tenant.id} className="p-2 text-center">
                                    <span className={cn(
                                      "font-mono font-medium",
                                      count === 0 && "text-red-500 dark:text-red-400"
                                    )}>
                                      {count}
                                    </span>
                                  </td>
                                );
                              })
                            ) : (
                              // Other tenants: show master vs current + diff
                              <>
                                <td className="p-2 text-center">
                                  <span className={cn(
                                    "font-mono font-medium",
                                    counts.master === 0 && "text-red-500 dark:text-red-400"
                                  )}>
                                    {counts.master}
                                  </span>
                                </td>
                                <td className="p-2 text-center">
                                  <span className="font-mono font-medium">{counts.tenant}</span>
                                </td>
                                <td className="p-2 text-center">
                                  {diff !== 0 && (
                                    <span className={cn(
                                      "font-mono text-xs px-2 py-1 rounded",
                                      diff > 0 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 dark:bg-yellow-950/30 dark:text-yellow-400" :
                                      "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-950/30 dark:text-green-400"
                                    )}>
                                      {diff > 0 ? `+${diff}` : diff}
                                    </span>
                                  )}
                                  {diff === 0 && counts.master > 0 && (
                                    <Check className="h-4 w-4 mx-auto text-green-600 dark:text-green-400" />
                                  )}
                                </td>
                              </>
                            )}
                            <td className="p-2 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedTable(table.key)}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Compare
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
