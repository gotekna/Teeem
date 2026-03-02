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
import { Check, AlertCircle, RefreshCw, Minus, Ban, ArrowRight, GitCompare, X, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * ScheduleMasterSyncTab - SM config sync with Compare & Pick Winner mode
 *
 * Three capabilities:
 * 1. Blind sync (existing) - pull from source to target
 * 2. Compare mode (NEW) - see field-level diffs across ALL tenants
 * 3. Pick winners (NEW) - choose which tenant's version wins per record, push to all
 *
 * SSoT: TenantConfigSyncService handles all backend sync logic.
 */

// Tables to sync in dependency order
// defaultMode: default sync direction — admin can override per-table
const SM_SYNC_TABLES = [
  { key: "sm_trades", label: "Trades", defaultMode: "two_way" as const },
  { key: "sm_stages", label: "Stages", defaultMode: "two_way" as const },
  { key: "cost_centres", label: "Cost Centres", defaultMode: "one_way" as const },
  { key: "supervisor_checklist_templates", label: "Checklists", defaultMode: "one_way" as const },
  { key: "document_types", label: "Document Types", defaultMode: "one_way" as const },
  { key: "sm_schedule_master_templates", label: "SM Templates", defaultMode: "two_way" as const },
  { key: "sm_task_groups", label: "Task Groups", defaultMode: "two_way" as const },
  { key: "bpmn_processes", label: "Workflows", defaultMode: "two_way" as const },
  { key: "sm_schedule_masters", label: "SM Tasks", defaultMode: "two_way" as const },
  { key: "sm_schedule_master_document_types", label: "SM Document Types", defaultMode: "two_way" as const },
  { key: "sm_schedule_master_related_pos", label: "Related PO Links", defaultMode: "one_way" as const },
  { key: "sm_hold_reasons", label: "Hold Reasons", defaultMode: "two_way" as const },
  { key: "sm_resources", label: "Resources", defaultMode: "two_way" as const },
  { key: "po_template_packs", label: "PO Template Packs", defaultMode: "one_way" as const },
  { key: "po_template_items", label: "PO Template Items", defaultMode: "one_way" as const },
  { key: "po_template_line_items", label: "PO Line Items", defaultMode: "one_way" as const },
  { key: "quote_templates", label: "Quote Templates (Std)", defaultMode: "one_way" as const },
  { key: "custom_quote_templates", label: "Quote Templates (Custom)", defaultMode: "one_way" as const },
  { key: "tender_headers", label: "Tender Headers", defaultMode: "one_way" as const },
  { key: "tenders", label: "Tender Sections", defaultMode: "one_way" as const },
  { key: "claim_stage_templates", label: "Claim Templates", defaultMode: "one_way" as const },
  { key: "claim_stage_template_lines", label: "Claim Template Lines", defaultMode: "two_way" as const },
] as const;

type SyncMode = "two_way" | "one_way" | "independent";
const SYNC_MODES: SyncMode[] = ["two_way", "one_way", "independent"];

const SYNC_MODE_LABELS: Record<SyncMode, { label: string; color: string }> = {
  two_way: { label: "Two-way", color: "text-green-600 dark:text-green-400" },
  one_way: { label: "One-way", color: "text-blue-600 dark:text-blue-400" },
  independent: { label: "Independent", color: "text-muted-foreground" },
};

type TableKey = typeof SM_SYNC_TABLES[number]["key"];
type TableSyncStatus = "pending" | "syncing" | "done" | "error" | "skipped";

interface TableResult {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  error?: string;
}

interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  is_master: boolean;
}

// Diff types
interface DiffRecord {
  match_key: string;
  name: string;
  status: "identical" | "different" | "partial";
  values: Record<string, Record<string, unknown>>;
  changed_fields: string[];
  present_in: string[];
}

interface DiffResponse {
  success: boolean;
  table: string;
  tenants: { id: number; name: string; slug: string }[];
  records: DiffRecord[];
  summary: { identical: number; different: number; partial: number };
}

const BATCH_SIZE = 500;

export function ScheduleMasterSyncTab() {
  // Non-master: { master: N, tenant: N }
  const [simpleCounts, setSimpleCounts] = useState<Record<string, { master: number; tenant: number }>>({});
  // Master: all tenant counts keyed by slug { table: { slug: count } }
  const [allTenantCounts, setAllTenantCounts] = useState<Record<string, Record<string, number>>>({});
  const [allTenants, setAllTenants] = useState<TenantInfo[]>([]);
  const [isMasterTenant, setIsMasterTenant] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<number>(0);

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
  const [syncComplete, setSyncComplete] = useState(false);

  // Per-table sync direction modes (admin-configurable)
  const [tableModes, setTableModes] = useState<Record<string, SyncMode>>({});

  // Expandable template breakdown rows
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  // Sync coverage: linked vs local-only vs master-only per table
  // Non-master: { table: { linked, local_only, master_only } }
  // Master: { table: { tenantSlug: { linked, local_only, master_only } } }
  type TemplateBreakdown = { id: number; name: string; tasks: number; master_tasks?: number; synced: boolean };
  type RecordBreakdown = { id: number; name: string; synced: boolean; count?: number };
  type CoverageEntry = { linked: number; local_only: number; master_only: number; templates?: TemplateBreakdown[]; records?: RecordBreakdown[] };
  const [syncCoverage, setSyncCoverage] = useState<Record<string, CoverageEntry | Record<string, CoverageEntry>>>({});

  // Compare mode state
  const [diffTable, setDiffTable] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [winners, setWinners] = useState<Record<string, string>>({}); // match_key → tenant slug
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ applied: number; errors: string[] } | null>(null);
  const [showIdentical, setShowIdentical] = useState(false);

  // Fetch counts on mount
  const fetchCounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        counts?: Record<string, { master: number; tenant: number }>;
        is_master_tenant?: boolean;
        all_tenants?: TenantInfo[];
        all_tenant_counts?: Record<string, Record<string, number>>;
        last_config_sync_at?: string | null;
        last_config_sync_by?: string | null;
        sync_coverage?: Record<string, CoverageEntry | Record<string, CoverageEntry>>;
      }>("/api/v1/config_sync/tables");

      // Also fetch saved table modes
      const modesResponse = await api.get<{ success: boolean; modes: Record<string, SyncMode> }>("/api/v1/config_sync/table_modes");
      if (modesResponse?.success && modesResponse.modes) {
        setTableModes(modesResponse.modes);
      }

      if (response?.success) {
        setLastSyncAt(response.last_config_sync_at || null);
        setLastSyncBy(response.last_config_sync_by || null);
        setIsMasterTenant(response.is_master_tenant || false);
        if (response.sync_coverage) {
          setSyncCoverage(response.sync_coverage);
        }

        if (response.is_master_tenant && response.all_tenants && response.all_tenant_counts) {
          setAllTenants(response.all_tenants);
          setAllTenantCounts(response.all_tenant_counts);

          // Auto-select the non-master tenant with the most SM tasks
          const nonMaster = response.all_tenants.filter((t) => !t.is_master);
          const smKey = "sm_schedule_masters";
          let bestId = 0;
          let bestCount = 0;
          for (const t of nonMaster) {
            const count = response.all_tenant_counts[smKey]?.[t.slug] || 0;
            if (count > bestCount) {
              bestCount = count;
              bestId = t.id;
            }
          }
          if (bestId > 0) setSelectedSourceId(bestId);
        } else if (response.counts) {
          setSimpleCounts(response.counts);
        }
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

  // Derived: selected source tenant info
  const sourceTenant = allTenants.find((t) => t.id === selectedSourceId);
  const nonMasterTenants = allTenants.filter((t) => !t.is_master);

  // Get counts for a table
  const getSourceCount = (tableKey: string): number => {
    if (isMasterTenant) {
      if (!sourceTenant) return 0;
      return allTenantCounts[tableKey]?.[sourceTenant.slug] || 0;
    }
    return simpleCounts[tableKey]?.master ?? 0;
  };

  const getLocalCount = (tableKey: string): number => {
    if (isMasterTenant) {
      const masterTenant = allTenants.find((t) => t.is_master);
      if (!masterTenant) return 0;
      return allTenantCounts[tableKey]?.[masterTenant.slug] || 0;
    }
    return simpleCounts[tableKey]?.tenant ?? 0;
  };

  // Get effective sync mode for a table (admin override > default)
  const getTableMode = (tableKey: string, defaultMode: string): SyncMode => {
    return tableModes[tableKey] || (defaultMode as SyncMode);
  };

  // Cycle sync mode: two_way → one_way → independent → two_way
  // Cascades to child records: independent clears sync_keys, two_way/one_way regenerates them
  const handleCycleSyncMode = async (tableKey: string, currentMode: SyncMode) => {
    const currentIndex = SYNC_MODES.indexOf(currentMode);
    const nextMode = SYNC_MODES[(currentIndex + 1) % SYNC_MODES.length];
    // Optimistic update - header mode
    setTableModes((prev) => ({ ...prev, [tableKey]: nextMode }));
    try {
      await api.put("/api/v1/config_sync/update_table_mode", { table: tableKey, mode: nextMode, cascade: true });
      // Mode saved - refresh coverage from server to get accurate child sync states
      try {
        const res = await api.get<{ success: boolean; sync_coverage?: Record<string, CoverageEntry | Record<string, CoverageEntry>> }>("/api/v1/config_sync/tables");
        if (res?.sync_coverage) setSyncCoverage(res.sync_coverage);
      } catch {
        // Coverage refresh failed but mode is saved - don't revert
      }
    } catch (err) {
      console.error("[SMSync] Failed to update table mode:", err);
      // Only revert mode if the PUT itself failed
      setTableModes((prev) => ({ ...prev, [tableKey]: currentMode }));
    }
  };

  // Toggle a SM template between synced (Two-way) and independent
  const handleToggleTemplateSync = async (templateId: number, currentlySynced: boolean) => {
    // Optimistic update
    setSyncCoverage((prev) => {
      const entry = prev["sm_schedule_masters"] as CoverageEntry | undefined;
      if (!entry || !entry.templates) return prev;
      const updatedTemplates = entry.templates.map((t) =>
        t.id === templateId ? { ...t, synced: !currentlySynced } : t,
      );
      const synced = updatedTemplates.filter((t) => t.synced);
      const independent = updatedTemplates.filter((t) => !t.synced);
      return {
        ...prev,
        sm_schedule_masters: {
          ...entry,
          linked: synced.reduce((s, t) => s + t.tasks, 0),
          local_only: independent.reduce((s, t) => s + t.tasks, 0),
          templates: updatedTemplates,
        },
      };
    });
    try {
      await api.post("/api/v1/config_sync/toggle_template_sync", { template_id: templateId });
    } catch (err) {
      console.error("[SMSync] Failed to toggle template sync:", err);
      // Revert on failure
      setSyncCoverage((prev) => {
        const entry = prev["sm_schedule_masters"] as CoverageEntry | undefined;
        if (!entry || !entry.templates) return prev;
        const revertedTemplates = entry.templates.map((t) =>
          t.id === templateId ? { ...t, synced: currentlySynced } : t,
        );
        return { ...prev, sm_schedule_masters: { ...entry, templates: revertedTemplates } };
      });
    }
  };

  // Toggle any ConfigSyncable record between synced and independent
  const handleToggleRecordSync = async (tableKey: string, recordId: number, currentlySynced: boolean) => {
    // Optimistic update
    setSyncCoverage((prev) => {
      const entry = prev[tableKey] as CoverageEntry | undefined;
      if (!entry || !entry.records) return prev;
      const updatedRecords = entry.records.map((r) =>
        r.id === recordId ? { ...r, synced: !currentlySynced } : r,
      );
      return {
        ...prev,
        [tableKey]: {
          ...entry,
          linked: updatedRecords.filter((r) => r.synced).length,
          local_only: updatedRecords.filter((r) => !r.synced).length,
          records: updatedRecords,
        },
      };
    });
    try {
      await api.post("/api/v1/config_sync/toggle_record_sync", { table_key: tableKey, record_id: recordId });
      // Silent refresh — update coverage without blanking the screen
      const res = await api.get<{ success: boolean; sync_coverage?: Record<string, CoverageEntry | Record<string, CoverageEntry>> }>("/api/v1/config_sync/tables");
      if (res?.sync_coverage) setSyncCoverage(res.sync_coverage);
    } catch (err) {
      console.error("[SMSync] Failed to toggle record sync:", err);
      // Revert on failure
      setSyncCoverage((prev) => {
        const entry = prev[tableKey] as CoverageEntry | undefined;
        if (!entry || !entry.records) return prev;
        const revertedRecords = entry.records.map((r) =>
          r.id === recordId ? { ...r, synced: currentlySynced } : r,
        );
        return { ...prev, [tableKey]: { ...entry, records: revertedRecords } };
      });
    }
  };

  // Pull a single table with auto-batching
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
      const body: Record<string, unknown> = {
        table: tableKey,
        batch_size: BATCH_SIZE,
        offset,
      };
      // Master tenant: pass explicit source
      if (isMasterTenant && selectedSourceId) {
        body.source_tenant_id = selectedSourceId;
      }

      const response = await api.post<PullResponse>(
        "/api/v1/config_sync/pull_one_table",
        body
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

  // Main sync handler
  const handleSync = async () => {
    setSyncing(true);
    setSyncComplete(false);
    setError(null);
    setBatchProgress(null);

    const initialStatus = {} as Record<TableKey, TableSyncStatus>;
    SM_SYNC_TABLES.forEach((t) => { initialStatus[t.key] = "pending"; });
    setTableStatus(initialStatus);
    setTableResults({} as Record<TableKey, TableResult>);

    for (let i = 0; i < SM_SYNC_TABLES.length; i++) {
      const table = SM_SYNC_TABLES[i];
      setCurrentTableIndex(i);
      setBatchProgress(null);
      setTableStatus((prev) => ({ ...prev, [table.key]: "syncing" }));

      try {
        const result = await pullOneTable(table.key);
        setTableResults((prev) => ({ ...prev, [table.key]: result }));

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
        all_tenant_counts?: Record<string, Record<string, number>>;
      }>("/api/v1/config_sync/tables");
      if (refreshed?.success) {
        if (refreshed.all_tenant_counts) {
          setAllTenantCounts(refreshed.all_tenant_counts);
        } else if (refreshed.counts) {
          setSimpleCounts(refreshed.counts);
        }
      }
    } catch {
      // Non-critical
    }

    setCurrentTableIndex(-1);
    setBatchProgress(null);
    setSyncing(false);
    setSyncComplete(true);
  };

  // Compare mode: fetch diff for a table
  const handleCompare = async (tableKey: string) => {
    if (diffTable === tableKey) {
      // Toggle off
      setDiffTable(null);
      setDiffData(null);
      setDiffError(null);
      setWinners({});
      setApplyResult(null);
      return;
    }

    setDiffTable(tableKey);
    setDiffLoading(true);
    setDiffError(null);
    setDiffData(null);
    setWinners({});
    setApplyResult(null);
    setShowIdentical(false);

    try {
      const response = await api.get<DiffResponse>(
        `/api/v1/config_sync/diff_all/${tableKey}`
      );
      if (response?.success) {
        setDiffData(response);
      } else {
        setDiffError("Failed to load diff");
      }
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : "Failed to load diff");
    } finally {
      setDiffLoading(false);
    }
  };

  // Apply winners
  const handleApplyWinners = async () => {
    if (!diffTable || Object.keys(winners).length === 0) return;

    setApplying(true);
    setApplyResult(null);

    const selections = Object.entries(winners).map(([match_key, winner_slug]) => ({
      match_key,
      winner_slug,
    }));

    try {
      const response = await api.post<{
        success: boolean;
        applied: { match_key: string; winner: string }[];
        errors: string[];
      }>("/api/v1/config_sync/apply_winners", {
        table: diffTable,
        selections,
      });

      setApplyResult({
        applied: response?.applied?.length || 0,
        errors: response?.errors || [],
      });

      // Refresh diff to show updated state
      if (response?.success) {
        setTimeout(() => handleCompare(diffTable), 500);
      }
    } catch (err) {
      setApplyResult({
        applied: 0,
        errors: [err instanceof Error ? err.message : "Request failed"],
      });
    } finally {
      setApplying(false);
    }
  };

  // Compute totals
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

  const completedCount = Object.values(tableStatus).filter(
    (s) => s === "done" || s === "error" || s === "skipped"
  ).length;
  const progressPercent = SM_SYNC_TABLES.length > 0
    ? (completedCount / SM_SYNC_TABLES.length) * 100
    : 0;

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

  const renderStatusIcon = (status: TableSyncStatus | undefined) => {
    if (!status || status === "pending") {
      return <Minus className="h-4 w-4 text-muted-foreground/40" />;
    }
    if (status === "syncing") return <Spinner className="h-4 w-4" />;
    if (status === "done") return <Check className="h-4 w-4 text-green-600 dark:text-green-400" />;
    if (status === "error") return <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />;
    if (status === "skipped") return <Ban className="h-4 w-4 text-muted-foreground/40" />;
    return null;
  };

  // Format field value for display
  const formatFieldValue = (value: unknown): string => {
    if (value === null || value === undefined) return "\u2014";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.length === 0 ? "\u2014" : value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  // Column headers depend on mode
  const sourceLabel = isMasterTenant ? (sourceTenant?.name || "Source") : "TEEEM";
  const localLabel = isMasterTenant ? "TEEEM" : "Yours";

  // Diff panel: filter records to show
  const diffRecords = diffData?.records || [];
  const visibleDiffRecords = showIdentical
    ? diffRecords
    : diffRecords.filter((r) => r.status !== "identical");
  const selectedWinnerCount = Object.keys(winners).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Schedule Master Sync</CardTitle>
          <CardDescription>
            {isMasterTenant
              ? "Import Schedule Master config from a tenant, or Compare across all tenants to pick winners."
              : "Sync all Schedule Master configuration from the TEEEM master template."
            }
            {" "}Tables are synced in dependency order so references resolve correctly.
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

          {/* Master tenant: source selector */}
          {isMasterTenant && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border">
              <span className="text-sm text-muted-foreground">Import from:</span>
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(Number(e.target.value))}
                disabled={syncing}
                className="text-sm border rounded px-2 py-1 bg-background text-foreground"
              >
                <option value={0}>Select tenant...</option>
                {nonMasterTenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary">TEEEM</Badge>
            </div>
          )}

          {/* Table list */}
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] text-center">#</TableHead>
                  <TableHead>Table</TableHead>
                  {/* Show per-tenant counts for master tenant */}
                  {isMasterTenant && allTenants.length > 0 ? (
                    allTenants.map((t) => (
                      <TableHead key={t.slug} className="text-right w-[70px]">
                        {t.name.length > 8 ? t.slug : t.name}
                      </TableHead>
                    ))
                  ) : (
                    <>
                      <TableHead className="text-right w-[70px]">{sourceLabel}</TableHead>
                      <TableHead className="text-right w-[70px]">{localLabel}</TableHead>
                    </>
                  )}
                  <TableHead className="w-[80px] text-center">Sync</TableHead>
                  <TableHead className="w-[180px] text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SM_SYNC_TABLES.map((table, index) => {
                  const status = tableStatus[table.key];
                  const result = tableResults[table.key];
                  const sourceCount = getSourceCount(table.key);
                  const localCount = getLocalCount(table.key);
                  const isComparing = diffTable === table.key;

                  // Check if counts differ across tenants (for master mode)
                  let countsDiffer = false;
                  if (isMasterTenant && allTenants.length > 0) {
                    const counts = allTenants.map((t) => allTenantCounts[table.key]?.[t.slug] || 0);
                    countsDiffer = new Set(counts).size > 1;
                  } else {
                    countsDiffer = sourceCount !== localCount && sourceCount > 0;
                  }

                  return (
                    <React.Fragment key={table.key}>
                      <TableRow
                        className={cn(
                          status === "syncing" && "bg-blue-50/50 dark:bg-blue-950/20",
                          status === "done" && "bg-green-50/30 dark:bg-green-950/10",
                          status === "error" && "bg-red-50/30 dark:bg-red-950/10",
                          isComparing && "bg-blue-50/30 dark:bg-blue-950/10",
                        )}
                      >
                        <TableCell className="text-center text-xs text-muted-foreground tabular-nums py-2">
                          {index + 1}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            {/* Expandable chevron for tables with template breakdown */}
                            {(() => {
                              const cov = !isMasterTenant
                                ? (syncCoverage[table.key] as CoverageEntry | undefined)
                                : undefined;
                              const hasTemplates = cov && "templates" in cov && cov.templates && cov.templates.length > 1;
                              const hasRecords = cov && "records" in cov && cov.records && cov.records.length > 0;
                              if (hasTemplates || hasRecords) {
                                const isExpanded = expandedTables.has(table.key);
                                return (
                                  <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground transition-colors -ml-1"
                                    onClick={() => {
                                      setExpandedTables(prev => {
                                        const next = new Set(prev);
                                        if (next.has(table.key)) next.delete(table.key);
                                        else next.add(table.key);
                                        return next;
                                      });
                                    }}
                                  >
                                    {isExpanded
                                      ? <ChevronDown className="h-4 w-4" />
                                      : <ChevronRight className="h-4 w-4" />
                                    }
                                  </button>
                                );
                              }
                              return null;
                            })()}
                            <span className="text-sm font-medium">{table.label}</span>
                            {isMasterTenant && !syncing && (
                              <Button
                                variant={isComparing ? "secondary" : "ghost"}
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleCompare(table.key)}
                                disabled={diffLoading && diffTable === table.key}
                              >
                                {diffLoading && diffTable === table.key ? (
                                  <Spinner className="h-3 w-3" />
                                ) : isComparing ? (
                                  <X className="h-3 w-3" />
                                ) : (
                                  <GitCompare className="h-3 w-3" />
                                )}
                                <span className="ml-1">{isComparing ? "Close" : "Compare"}</span>
                              </Button>
                            )}
                          </div>
                          {status === "error" && result?.error && (
                            <div className="text-xs text-red-500 dark:text-red-400 mt-0.5 truncate max-w-[250px]" title={result.error}>
                              {result.error}
                            </div>
                          )}
                        </TableCell>
                        {/* Per-tenant counts */}
                        {isMasterTenant && allTenants.length > 0 ? (
                          allTenants.map((t) => {
                            const count = allTenantCounts[table.key]?.[t.slug] || 0;
                            // For non-master tenants, show linked+unlinked breakdown
                            const tenantCov = !t.is_master
                              ? (syncCoverage[table.key] as Record<string, CoverageEntry> | undefined)?.[t.slug]
                              : undefined;
                            return (
                              <TableCell key={t.slug} className={cn(
                                "text-right tabular-nums text-sm py-2",
                                countsDiffer && !hasResults && "text-amber-600 dark:text-amber-400 font-medium"
                              )}>
                                {tenantCov && tenantCov.local_only > 0 ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <span>{tenantCov.linked.toLocaleString()}</span>
                                    <span
                                      className="text-amber-600 dark:text-amber-400"
                                      title={`${tenantCov.local_only} local-only (not in TEEEM)`}
                                    >
                                      +{tenantCov.local_only}
                                    </span>
                                  </div>
                                ) : (
                                  count.toLocaleString()
                                )}
                              </TableCell>
                            );
                          })
                        ) : (
                          <>
                            <TableCell className="text-right tabular-nums text-sm py-2">
                              {sourceCount.toLocaleString()}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right tabular-nums text-sm py-2",
                              countsDiffer && !hasResults && "text-amber-600 dark:text-amber-400 font-medium"
                            )}>
                              {(() => {
                                const cov = syncCoverage[table.key] as CoverageEntry | undefined;
                                if (cov && "local_only" in cov && cov.local_only > 0) {
                                  return (
                                    <div className="flex items-center justify-end gap-1">
                                      <span>{cov.linked.toLocaleString()}</span>
                                      <span
                                        className="text-amber-600 dark:text-amber-400"
                                        title={`${cov.local_only} local-only record${cov.local_only !== 1 ? "s" : ""} (not in TEEEM)`}
                                      >
                                        +{cov.local_only}
                                      </span>
                                    </div>
                                  );
                                }
                                return localCount.toLocaleString();
                              })()}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-center py-2">
                          {(() => {
                            const mode = getTableMode(table.key, table.defaultMode);
                            const st = SYNC_MODE_LABELS[mode];
                            if (!st) return null;

                            return (
                              <button
                                type="button"
                                className={cn(
                                  "text-xs font-medium cursor-pointer hover:underline transition-colors",
                                  st.color,
                                )}
                                onClick={() => handleCycleSyncMode(table.key, mode)}
                                title={`Click to change sync direction (${SYNC_MODES.map(m => SYNC_MODE_LABELS[m].label).join(" → ")})`}
                              >
                                {st.label}
                              </button>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            {renderStatusIcon(status)}
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

                      {/* Template breakdown sub-rows */}
                      {expandedTables.has(table.key) && (() => {
                        const mode = getTableMode(table.key, table.defaultMode);
                        const cov = !isMasterTenant
                          ? (syncCoverage[table.key] as CoverageEntry | undefined)
                          : undefined;
                        const templates = cov && "templates" in cov ? cov.templates : undefined;
                        if (!templates || templates.length === 0) return null;

                        return templates.map((tmpl) => (
                          <TableRow key={`${table.key}-tmpl-${tmpl.name}`} className="bg-muted/30">
                            <TableCell className="py-1.5" />
                            <TableCell className="py-1.5 pl-10">
                              <span className="text-xs text-muted-foreground">{tmpl.name}</span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs text-muted-foreground py-1.5">
                              {tmpl.master_tasks != null ? tmpl.master_tasks.toLocaleString() : ""}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs text-muted-foreground py-1.5">
                              {tmpl.tasks.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-center py-1.5">
                              <button
                                type="button"
                                className={cn(
                                  "text-[11px] font-medium cursor-pointer hover:underline transition-colors",
                                  tmpl.synced
                                    ? SYNC_MODE_LABELS[mode].color
                                    : "text-muted-foreground",
                                )}
                                onClick={() => handleToggleTemplateSync(tmpl.id, tmpl.synced)}
                                title={tmpl.synced
                                  ? "Click to disconnect — make this template independent"
                                  : "Click to reconnect — sync this template with TEEEM"
                                }
                              >
                                {tmpl.synced ? SYNC_MODE_LABELS[mode].label : "Independent"}
                              </button>
                            </TableCell>
                            <TableCell className="py-1.5" />
                          </TableRow>
                        ));
                      })()}

                      {/* Records breakdown sub-rows (Quote Templates, PO Packs, PO Items, PO Line Items) */}
                      {expandedTables.has(table.key) && (() => {
                        const mode = getTableMode(table.key, table.defaultMode);
                        const cov = !isMasterTenant
                          ? (syncCoverage[table.key] as CoverageEntry | undefined)
                          : undefined;
                        const records = cov && "records" in cov ? cov.records : undefined;
                        if (!records || records.length === 0) return null;

                        // Child tables are read-only (grouped by parent, toggle is on parent row)
                        const isReadOnly = table.key === "po_template_line_items" || table.key === "po_template_items" || table.key === "claim_stage_template_lines";

                        return records.map((rec) => (
                          <TableRow key={`${table.key}-rec-${rec.id}`} className="bg-muted/30">
                            <TableCell className="py-1.5" />
                            <TableCell className="py-1.5 pl-10">
                              <span className="text-xs text-muted-foreground">{rec.name}</span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs text-muted-foreground py-1.5" />
                            <TableCell className="text-right tabular-nums text-xs text-muted-foreground py-1.5">
                              {rec.count != null && (
                                <span className="text-xs text-muted-foreground">{rec.count}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center py-1.5">
                              {isReadOnly ? (
                                <span className={cn(
                                  "text-[11px] font-medium",
                                  rec.synced
                                    ? SYNC_MODE_LABELS[mode].color
                                    : "text-muted-foreground",
                                )}>
                                  {rec.synced ? SYNC_MODE_LABELS[mode].label : "Independent"}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className={cn(
                                    "text-[11px] font-medium cursor-pointer hover:underline transition-colors",
                                    rec.synced
                                      ? SYNC_MODE_LABELS[mode].color
                                      : "text-muted-foreground",
                                  )}
                                  onClick={() => handleToggleRecordSync(table.key, rec.id, rec.synced)}
                                  title={rec.synced
                                    ? "Click to disconnect — make independent"
                                    : "Click to reconnect — sync with TEEEM"
                                  }
                                >
                                  {rec.synced ? SYNC_MODE_LABELS[mode].label : "Independent"}
                                </button>
                              )}
                            </TableCell>
                            <TableCell className="py-1.5" />
                          </TableRow>
                        ));
                      })()}

                      {/* Inline diff panel */}
                      {isComparing && diffData && (
                        <TableRow>
                          <TableCell colSpan={isMasterTenant && allTenants.length > 0 ? allTenants.length + 4 : 6} className="p-0">
                            <DiffPanel
                              diffData={diffData}
                              diffError={diffError}
                              winners={winners}
                              setWinners={setWinners}
                              showIdentical={showIdentical}
                              setShowIdentical={setShowIdentical}
                              visibleRecords={visibleDiffRecords}
                              selectedCount={selectedWinnerCount}
                              applying={applying}
                              applyResult={applyResult}
                              onApply={handleApplyWinners}
                              formatFieldValue={formatFieldValue}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Progress bar */}
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

          {/* Results summary */}
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

          {/* Last sync + action button */}
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
              disabled={syncing || (isMasterTenant && !selectedSourceId)}
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
                  {isMasterTenant ? `Import from ${sourceTenant?.name || "Tenant"}` : "Sync Schedule Master"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Diff Panel — shows field-level comparison across tenants with winner selection
// ============================================================================

interface DiffPanelProps {
  diffData: DiffResponse;
  diffError: string | null;
  winners: Record<string, string>;
  setWinners: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  showIdentical: boolean;
  setShowIdentical: React.Dispatch<React.SetStateAction<boolean>>;
  visibleRecords: DiffRecord[];
  selectedCount: number;
  applying: boolean;
  applyResult: { applied: number; errors: string[] } | null;
  onApply: () => void;
  formatFieldValue: (value: unknown) => string;
}

function DiffPanel({
  diffData,
  diffError,
  winners,
  setWinners,
  showIdentical,
  setShowIdentical,
  visibleRecords,
  selectedCount,
  applying,
  applyResult,
  onApply,
  formatFieldValue,
}: DiffPanelProps) {
  const { tenants, summary } = diffData;

  return (
    <div className="border-t bg-muted/20 p-4 space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">{diffData.table.replace(/_/g, " ")}</span>
          <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
            {summary.identical} identical
          </Badge>
          {summary.different > 0 && (
            <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
              {summary.different} different
            </Badge>
          )}
          {summary.partial > 0 && (
            <Badge variant="outline" className="text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700">
              {summary.partial} partial
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setShowIdentical(!showIdentical)}
        >
          {showIdentical ? "Hide" : "Show"} identical ({summary.identical})
        </Button>
      </div>

      {diffError && (
        <div className="text-sm text-destructive">{diffError}</div>
      )}

      {/* Record cards */}
      {visibleRecords.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">
          All records are identical across tenants.
        </div>
      )}

      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {visibleRecords.map((record) => (
          <DiffRecordCard
            key={record.match_key}
            record={record}
            tenants={tenants}
            winner={winners[record.match_key]}
            onSelectWinner={(slug) => {
              setWinners((prev) => {
                const next = { ...prev };
                if (next[record.match_key] === slug) {
                  delete next[record.match_key];
                } else {
                  next[record.match_key] = slug;
                }
                return next;
              });
            }}
            formatFieldValue={formatFieldValue}
          />
        ))}
      </div>

      {/* Apply button */}
      {(summary.different > 0 || summary.partial > 0) && (
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedCount > 0
              ? `${selectedCount} winner${selectedCount !== 1 ? "s" : ""} selected`
              : "Select winners to apply"}
          </div>
          <Button
            onClick={onApply}
            disabled={selectedCount === 0 || applying}
            size="sm"
          >
            {applying ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Applying...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Apply {selectedCount} Winner{selectedCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Apply result */}
      {applyResult && (
        <div className={cn(
          "rounded-md border p-3 text-sm",
          applyResult.errors.length > 0
            ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
            : "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
        )}>
          {applyResult.errors.length > 0 ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Applied {applyResult.applied} with {applyResult.errors.length} error(s)
              </div>
              {applyResult.errors.map((e, i) => (
                <div key={i} className="text-xs text-amber-700 dark:text-amber-300 pl-6">{e}</div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <Check className="h-4 w-4 shrink-0" />
              Successfully applied {applyResult.applied} winner{applyResult.applied !== 1 ? "s" : ""} to all tenants
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Single diff record card — shows per-field values across tenants
// ============================================================================

interface DiffRecordCardProps {
  record: DiffRecord;
  tenants: { id: number; name: string; slug: string }[];
  winner: string | undefined;
  onSelectWinner: (slug: string) => void;
  formatFieldValue: (value: unknown) => string;
}

function DiffRecordCard({ record, tenants, winner, onSelectWinner, formatFieldValue }: DiffRecordCardProps) {
  const [expanded, setExpanded] = useState(record.status !== "identical");

  const statusBadge = record.status === "different" ? (
    <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-xs">
      Modified
    </Badge>
  ) : record.status === "partial" ? (
    <Badge variant="outline" className="text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 text-xs">
      Partial
    </Badge>
  ) : (
    <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 text-xs">
      Identical
    </Badge>
  );

  return (
    <div className={cn(
      "rounded-md border",
      winner && "ring-2 ring-primary/50",
      record.status === "identical" && "opacity-60"
    )}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">{record.name || record.match_key}</span>
          {statusBadge}
          {record.status === "partial" && (
            <span className="text-xs text-muted-foreground">
              Only in: {record.present_in.join(", ")}
            </span>
          )}
        </div>
        {winner && (
          <Badge variant="secondary" className="text-xs">
            Winner: {tenants.find((t) => t.slug === winner)?.name || winner}
          </Badge>
        )}
      </div>

      {/* Expanded: field comparison table + winner selection */}
      {expanded && (
        <div className="border-t px-3 pb-3 space-y-3">
          {/* Field comparison */}
          {record.changed_fields.length > 0 && (
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Field</th>
                    {tenants.map((t) => (
                      <th key={t.slug} className="text-left py-1.5 px-2 font-medium text-muted-foreground min-w-[100px]">
                        {t.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {record.changed_fields.map((field) => (
                    <tr key={field} className="border-b border-dashed last:border-0">
                      <td className="py-1.5 pr-3 font-mono text-muted-foreground">{field}</td>
                      {tenants.map((t) => {
                        const val = record.values[t.slug]?.[field];
                        const formatted = formatFieldValue(val);
                        const isPresent = record.present_in.includes(t.slug);
                        return (
                          <td
                            key={t.slug}
                            className={cn(
                              "py-1.5 px-2 max-w-[200px] truncate",
                              !isPresent && "text-muted-foreground/30 italic",
                            )}
                            title={formatted}
                          >
                            {isPresent ? formatted : "\u2014"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Winner selection */}
          {record.status !== "identical" && (
            <div className="flex items-center gap-3 pt-2">
              <span className="text-xs font-medium text-muted-foreground">Winner:</span>
              {record.status === "partial" ? (
                // For partial records, show "Add to all" or "Skip"
                <>
                  {record.present_in.map((slug) => {
                    const t = tenants.find((t) => t.slug === slug);
                    return (
                      <label key={slug} className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name={`winner-${record.match_key}`}
                          checked={winner === slug}
                          onChange={() => onSelectWinner(slug)}
                          className="accent-primary"
                        />
                        Add from {t?.name || slug}
                      </label>
                    );
                  })}
                </>
              ) : (
                // For different records, pick which tenant's version wins
                tenants.map((t) => {
                  if (!record.present_in.includes(t.slug)) return null;
                  return (
                    <label key={t.slug} className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name={`winner-${record.match_key}`}
                        checked={winner === t.slug}
                        onChange={() => onSelectWinner(t.slug)}
                        className="accent-primary"
                      />
                      {t.name}
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
