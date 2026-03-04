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
import { API_TIMEOUT_HEAVY_SYNC } from "@/lib/constants/timeout-constants";
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
  { key: "sm_schedule_masters", label: "Schedule Master", defaultMode: "two_way" as const },
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
  { key: "foundation_views", label: "Global Views", defaultMode: "one_way" as const },
] as const;

// Parent → child table links: changing parent mode also changes children
const LINKED_CHILDREN: Record<string, string[]> = {
  claim_stage_templates: ["claim_stage_template_lines"],
  po_template_packs: ["po_template_items", "po_template_line_items"],
  tender_headers: ["tenders"],
  // Bidirectional: template ↔ tasks (setting one cascades to same-named record in the other)
  sm_schedule_master_templates: ["sm_schedule_masters"],
  sm_schedule_masters: ["sm_schedule_master_templates"],
};

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
  // Per-tenant sync mode settings (master-only): { tenantSlug: { modeKey: mode } }
  const [allTenantModes, setAllTenantModes] = useState<Record<string, Record<string, string>>>({});
  const [isMasterTenant, setIsMasterTenant] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [cascading, setCascading] = useState(false);
  type SkippedOrphan = { id: number; sync_key: string; name: string; referenced_by: string };
  type CascadeTableResult = { imported: number; updated: number; skipped: number; deleted_orphans?: number; skipped_orphans?: SkippedOrphan[]; promoted_to_master?: number };
  type Phase0TenantResult = { pulled: number; imported: number; unchanged: number; failed: { name: string; reason: string }[]; errors: string[] };
  const [cascadeResults, setCascadeResults] = useState<Record<string, Record<string, CascadeTableResult>>>({});
  const [phase0Results, setPhase0Results] = useState<Record<string, Record<string, Phase0TenantResult>>>({});
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
  type RecordBreakdown = { id: number; name: string; synced: boolean; count?: number; master_count?: number };
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

  // Reconcile state
  type ReconcileMode = "verify" | "report" | "fix";
  type ReconcileTableResult = {
    status: string;
    counts?: Record<string, number>;
    issues?: string[];
    master_count?: number;
    master_no_sync_key?: number;
    tenants?: Record<string, {
      count: number;
      missing?: { sync_key: string; name: string }[];
      extra?: { sync_key: string; name: string }[];
      diffs?: { sync_key: string; name: string; fields: { field: string; master: string; customer: string }[] }[];
      no_sync_key?: number;
      duplicates?: { sync_key: string; count: number; ids: number[] }[];
    }>;
  };
  type ReconcileResult = {
    pass?: boolean;
    tables: Record<string, ReconcileTableResult>;
    phases?: Record<string, Record<string, Record<string, unknown>>>;
    verification?: { pass: boolean; tables: Record<string, ReconcileTableResult> };
  };
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMode, setReconcileMode] = useState<ReconcileMode | null>(null);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [expandedReconcileTables, setExpandedReconcileTables] = useState<Set<string>>(new Set());

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
        all_tenant_modes?: Record<string, Record<string, string>>;
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
          if (response.all_tenant_modes) setAllTenantModes(response.all_tenant_modes);

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

  const handleReconcile = useCallback(async (mode: ReconcileMode) => {
    try {
      setReconciling(true);
      setReconcileMode(mode);
      setReconcileError(null);
      setReconcileResult(null);
      setExpandedReconcileTables(new Set());

      const response = await api.post<{
        success: boolean;
        mode: string;
        pass?: boolean;
        tables?: Record<string, ReconcileTableResult>;
        phases?: Record<string, Record<string, Record<string, unknown>>>;
        verification?: { pass: boolean; tables: Record<string, ReconcileTableResult> };
        error?: string;
      }>("/api/v1/config_sync/reconcile", { mode }, { timeout: API_TIMEOUT_HEAVY_SYNC });

      if (response?.success) {
        setReconcileResult(response as ReconcileResult);
        if (mode === "fix") await fetchCounts();
      } else {
        setReconcileError(response?.error || "Unknown error");
      }
    } catch (err) {
      setReconcileError(err instanceof Error ? err.message : "Failed to reconcile");
    } finally {
      setReconciling(false);
    }
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

  // Get effective sync mode for a specific record (per-record override > table mode > default)
  // Master-only records (negative IDs) use name-based keys: "table:master:lowercase_name"
  const getRecordMode = (tableKey: string, recordId: number, defaultMode: string, recordName?: string): SyncMode => {
    if (recordId < 0 && recordName) {
      const nameKey = `${tableKey}:master:${recordName.toLowerCase()}`;
      if (tableModes[nameKey]) return tableModes[nameKey] as SyncMode;
    }
    return tableModes[`${tableKey}:${recordId}`] || tableModes[tableKey] || (defaultMode as SyncMode);
  };

  // Get a specific non-master tenant's configured mode for a table (for master tenant display)
  const getTenantTableMode = (tenantSlug: string, tableKey: string, defaultMode: string): SyncMode => {
    const explicit = allTenantModes[tenantSlug]?.[tableKey];
    return (explicit || defaultMode) as SyncMode;
  };

  // Get a specific non-master tenant's configured mode for a specific record (for master tenant display)
  const getTenantRecordMode = (tenantSlug: string, tableKey: string, recordId: number, defaultMode: string, recordName?: string): SyncMode => {
    const modes = allTenantModes[tenantSlug] || {};
    if (recordId < 0 && recordName) {
      const nameKey = `${tableKey}:master:${recordName.toLowerCase()}`;
      if (modes[nameKey]) return modes[nameKey] as SyncMode;
    }
    const recordKey = `${tableKey}:${recordId}`;
    if (modes[recordKey]) return modes[recordKey] as SyncMode;
    return (modes[tableKey] || defaultMode) as SyncMode;
  };

  // Master tenant: cycle mode for a specific tenant's table setting.
  // Writes to that tenant's config_sync_table_modes via target_tenant_id.
  const handleCycleTenantMode = async (tenant: TenantInfo, tableKey: string, currentMode: SyncMode) => {
    const nextMode = SYNC_MODES[(SYNC_MODES.indexOf(currentMode) + 1) % SYNC_MODES.length];
    const childKeys = LINKED_CHILDREN[tableKey] || [];
    // Optimistic update for this tenant
    setAllTenantModes((prev) => {
      const tenantModes = { ...(prev[tenant.slug] || {}), [tableKey]: nextMode };
      for (const child of childKeys) tenantModes[child] = nextMode;
      return { ...prev, [tenant.slug]: tenantModes };
    });
    try {
      await Promise.all([
        api.put("/api/v1/config_sync/update_table_mode", { table: tableKey, mode: nextMode, cascade: true, target_tenant_id: tenant.id }),
        ...childKeys.map((child) =>
          api.put("/api/v1/config_sync/update_table_mode", { table: child, mode: nextMode, cascade: true, target_tenant_id: tenant.id })
        ),
      ]);
    } catch (err) {
      console.error("[SMSync] Failed to update tenant table mode:", err);
      setAllTenantModes((prev) => {
        const tenantModes = { ...(prev[tenant.slug] || {}) };
        delete tenantModes[tableKey];
        for (const child of childKeys) delete tenantModes[child];
        return { ...prev, [tenant.slug]: tenantModes };
      });
    }
  };

  // Master tenant: cycle mode for a specific tenant's per-record setting.
  const handleCycleTenantRecordMode = async (tenant: TenantInfo, tableKey: string, recordId: number, currentMode: SyncMode, recordName?: string) => {
    const nextMode = SYNC_MODES[(SYNC_MODES.indexOf(currentMode) + 1) % SYNC_MODES.length];
    const isMasterOnly = recordId < 0;
    const modeKey = isMasterOnly && recordName
      ? `${tableKey}:master:${recordName.toLowerCase()}`
      : `${tableKey}:${recordId}`;
    // Optimistic update
    setAllTenantModes((prev) => ({
      ...prev,
      [tenant.slug]: { ...(prev[tenant.slug] || {}), [modeKey]: nextMode },
    }));
    try {
      await api.put("/api/v1/config_sync/update_table_mode", {
        table: tableKey, mode: nextMode, target_tenant_id: tenant.id,
        ...(isMasterOnly && recordName ? { record_name: recordName } : { record_id: recordId }),
      });
    } catch (err) {
      console.error("[SMSync] Failed to update tenant record mode:", err);
      setAllTenantModes((prev) => {
        const tenantModes = { ...(prev[tenant.slug] || {}) };
        delete tenantModes[modeKey];
        return { ...prev, [tenant.slug]: tenantModes };
      });
    }
  };

  // Cycle sync mode: two_way → one_way → independent → two_way
  // Cascades to child records: independent clears sync_keys, two_way/one_way regenerates them
  // Also cascades mode to linked child tables (e.g. Claim Templates → Claim Template Lines)
  const handleCycleSyncMode = async (tableKey: string, currentMode: SyncMode) => {
    const currentIndex = SYNC_MODES.indexOf(currentMode);
    const nextMode = SYNC_MODES[(currentIndex + 1) % SYNC_MODES.length];
    const childKeys = LINKED_CHILDREN[tableKey] || [];
    // Optimistic update - header mode + linked children
    setTableModes((prev) => {
      const updated = { ...prev, [tableKey]: nextMode };
      for (const child of childKeys) updated[child] = nextMode;
      return updated;
    });
    try {
      // Update parent + all linked children in parallel
      await Promise.all([
        api.put("/api/v1/config_sync/update_table_mode", { table: tableKey, mode: nextMode, cascade: true }),
        ...childKeys.map((child) =>
          api.put("/api/v1/config_sync/update_table_mode", { table: child, mode: nextMode, cascade: true })
        ),
      ]);
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
      setTableModes((prev) => {
        const reverted = { ...prev, [tableKey]: currentMode };
        for (const child of childKeys) delete reverted[child];
        return reverted;
      });
    }
  };

  // Cycle sync mode for a specific record (per-record override)
  // Cascades to same-named records in LINKED_CHILDREN tables
  // e.g. "Standard House" in po_template_packs → also sets in po_template_items + po_template_line_items
  // Master-only records (negative IDs) use name-based keys stored as "table:master:lowercase_name"
  const handleCycleRecordMode = async (tableKey: string, recordId: number, currentMode: SyncMode, recordName?: string) => {
    const currentIndex = SYNC_MODES.indexOf(currentMode);
    const nextMode = SYNC_MODES[(currentIndex + 1) % SYNC_MODES.length];
    const isMasterOnly = recordId < 0;
    const modeKey = isMasterOnly && recordName
      ? `${tableKey}:master:${recordName.toLowerCase()}`
      : `${tableKey}:${recordId}`;

    // Find matching records by name in linked child tables
    // Supports both local records (positive IDs) and master-only records (negative IDs)
    const childUpdates: { tableKey: string; recordId: number; modeKey: string; recordName?: string }[] = [];
    const childKeys = LINKED_CHILDREN[tableKey] || [];

    // Resolve the name of the record being changed (needed for child name matching)
    const parentName = recordName ?? (() => {
      const cov = syncCoverage[tableKey] as CoverageEntry | undefined;
      const allItems = [...(cov?.records || []), ...(cov?.templates || [])];
      return allItems.find((r) => r.id === recordId)?.name;
    })();

    if (parentName && childKeys.length > 0) {
      for (const childKey of childKeys) {
        const childCov = syncCoverage[childKey] as CoverageEntry | undefined;
        const allChildItems = [...(childCov?.records || []), ...(childCov?.templates || [])];
        for (const childRec of allChildItems) {
          if (childRec.name === parentName) {
            const childIsMasterOnly = childRec.id < 0;
            childUpdates.push({
              tableKey: childKey,
              recordId: childRec.id,
              modeKey: childIsMasterOnly
                ? `${childKey}:master:${childRec.name.toLowerCase()}`
                : `${childKey}:${childRec.id}`,
              recordName: childIsMasterOnly ? childRec.name : undefined,
            });
          }
        }
      }
    }

    // Optimistic update - parent + matched children
    setTableModes((prev) => {
      const updated = { ...prev, [modeKey]: nextMode };
      for (const child of childUpdates) updated[child.modeKey] = nextMode;
      return updated;
    });
    try {
      await Promise.all([
        api.put("/api/v1/config_sync/update_table_mode", {
          table: tableKey, mode: nextMode,
          ...(isMasterOnly && recordName
            ? { record_name: recordName }
            : { record_id: recordId }),
        }),
        ...childUpdates.map((child) =>
          api.put("/api/v1/config_sync/update_table_mode", {
            table: child.tableKey, mode: nextMode,
            ...(child.recordName
              ? { record_name: child.recordName }
              : { record_id: child.recordId }),
          })
        ),
      ]);
    } catch (err) {
      console.error("[SMSync] Failed to update record mode:", err);
      setTableModes((prev) => {
        const reverted = { ...prev, [modeKey]: currentMode };
        for (const child of childUpdates) delete reverted[child.modeKey];
        return reverted;
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

      // Skip tables set to "independent" - they should not be synced
      const mode = getTableMode(table.key, table.defaultMode);
      if (mode === "independent") {
        setTableStatus((prev) => ({ ...prev, [table.key]: "skipped" }));
        continue;
      }

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

    // Refresh counts + coverage (so +N differences update after sync)
    try {
      const refreshed = await api.get<{
        success: boolean;
        counts?: Record<string, { master: number; tenant: number }>;
        all_tenant_counts?: Record<string, Record<string, number>>;
        sync_coverage?: Record<string, CoverageEntry | Record<string, CoverageEntry>>;
      }>("/api/v1/config_sync/tables");
      if (refreshed?.success) {
        if (refreshed.all_tenant_counts) {
          setAllTenantCounts(refreshed.all_tenant_counts);
        } else if (refreshed.counts) {
          setSimpleCounts(refreshed.counts);
        }
        if (refreshed.sync_coverage) {
          setSyncCoverage(refreshed.sync_coverage);
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

  // Sync All: for each table, backend pulls from ALL tenants → TEEEM, then pushes TEEEM → ALL tenants.
  // Single cascade_push_table call per table handles the full round-trip.
  const handleCascadeSync = async () => {
    setCascading(true);
    setCascadeResults({});
    setPhase0Results({});
    setError(null);

    const initialStatus = {} as Record<TableKey, TableSyncStatus>;
    SM_SYNC_TABLES.forEach((t) => { initialStatus[t.key] = "pending"; });
    setTableStatus(initialStatus);
    setTableResults({} as Record<TableKey, TableResult>);

    for (let i = 0; i < SM_SYNC_TABLES.length; i++) {
      const table = SM_SYNC_TABLES[i];
      setCurrentTableIndex(i);
      setBatchProgress(null);

      const mode = getTableMode(table.key, table.defaultMode);
      if (mode === "independent") {
        setTableStatus((prev) => ({ ...prev, [table.key]: "skipped" }));
        continue;
      }

      setTableStatus((prev) => ({ ...prev, [table.key]: "syncing" }));

      const res = await api.post<{
        success: boolean;
        table: string;
        queued?: boolean;
        job_key?: string;
        error?: string;
      }>("/api/v1/config_sync/cascade_push_table", { table: table.key }, { timeout: API_TIMEOUT_HEAVY_SYNC });

      if (res?.queued && res?.job_key) {
        // Background job queued — poll until it finishes
        const jobKey = res.job_key;
        let done = false;
        const maxAttempts = 150; // 5 min max (150 × 2s)
        let attempts = 0;

        while (!done && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2000));
          attempts++;
          try {
            const status = await api.get<{ done: boolean; status?: string; error?: string }>(
              `/api/v1/config_sync/cascade_push_status?job_key=${jobKey}`
            );
            if (status?.done) {
              done = true;
              if (status.status === "completed") {
                setTableStatus((prev) => ({ ...prev, [table.key]: "done" }));
              } else {
                setTableStatus((prev) => ({ ...prev, [table.key]: "error" }));
              }
            }
          } catch {
            // Network blip — keep polling
          }
        }

        if (!done) {
          // Timed out waiting for job
          setTableStatus((prev) => ({ ...prev, [table.key]: "error" }));
        }
        continue;
      }

      if (!res?.success) {
        setTableStatus((prev) => ({ ...prev, [table.key]: "error" }));
      } else {
        setTableStatus((prev) => ({ ...prev, [table.key]: "done" }));
      }
    }

    setCurrentTableIndex(-1);
    setBatchProgress(null);
    setCascading(false);
    await fetchCounts();
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

          {/* Master tenant: single Sync All button — backend handles all tenants automatically */}
          {isMasterTenant && (
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={handleCascadeSync}
                disabled={cascading || syncing || reconciling}
                variant="default"
              >
                {cascading ? (
                  <><Spinner className="h-4 w-4 mr-2" />Syncing all tenants...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Sync All</>
                )}
              </Button>
              <Button
                onClick={() => handleReconcile("verify")}
                disabled={cascading || syncing || reconciling}
                variant="outline"
              >
                {reconciling && reconcileMode === "verify" ? (
                  <><Spinner className="h-4 w-4 mr-2" />Verifying...</>
                ) : (
                  <><GitCompare className="h-4 w-4 mr-2" />Verify</>
                )}
              </Button>
              <Button
                onClick={() => handleReconcile("report")}
                disabled={cascading || syncing || reconciling}
                variant="outline"
              >
                {reconciling && reconcileMode === "report" ? (
                  <><Spinner className="h-4 w-4 mr-2" />Reporting...</>
                ) : (
                  <><GitCompare className="h-4 w-4 mr-2" />Report</>
                )}
              </Button>
              <Button
                onClick={() => handleReconcile("fix")}
                disabled={cascading || syncing || reconciling}
                variant="destructive"
              >
                {reconciling && reconcileMode === "fix" ? (
                  <><Spinner className="h-4 w-4 mr-2" />Fixing...</>
                ) : (
                  <><GitCompare className="h-4 w-4 mr-2" />Fix All</>
                )}
              </Button>
              <span className="text-sm text-muted-foreground">Syncs all tenants ↔ TEEEM</span>
            </div>
          )}

          {/* Reconcile results panel */}
          {reconcileError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Reconcile error: {reconcileError}</span>
                <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => setReconcileError(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
          {reconcileResult && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {reconcileMode === "fix" ? "Fix" : reconcileMode === "report" ? "Report" : "Verify"} Results
                  </span>
                  {(() => {
                    const passResult = reconcileMode === "fix" ? reconcileResult.verification?.pass : reconcileResult.pass;
                    return passResult !== undefined ? (
                      <Badge variant={passResult ? "default" : "destructive"} className={passResult ? "bg-green-600" : ""}>
                        {passResult ? "PASS" : "FAIL"}
                      </Badge>
                    ) : null;
                  })()}
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setReconcileResult(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>

              {/* Fix mode: show phase summary */}
              {reconcileMode === "fix" && reconcileResult.phases && Object.keys(reconcileResult.phases).length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {Object.entries(reconcileResult.phases).map(([tableKey, phases]) => (
                    <div key={tableKey}>
                      <span className="font-medium">{tableKey}:</span>{" "}
                      {Object.entries(phases).map(([phaseName, data]) => {
                        const summary = Object.entries(data as Record<string, unknown>)
                          .map(([tenant, val]) => `${tenant}: ${typeof val === "object" ? JSON.stringify(val) : val}`)
                          .join(", ");
                        return <span key={phaseName} className="mr-2">{phaseName}({summary})</span>;
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* Table-level results */}
              {(() => {
                const tables = reconcileMode === "fix"
                  ? reconcileResult.verification?.tables
                  : reconcileResult.tables;
                if (!tables) return null;

                return (
                  <div className="space-y-1">
                    {Object.entries(tables).map(([tableKey, data]) => {
                      const isExpanded = expandedReconcileTables.has(tableKey);
                      const hasTenantDetails = data.tenants && Object.values(data.tenants).some(
                        (td) => td.missing || td.extra || td.diffs || td.duplicates || td.no_sync_key
                      );
                      const isExpandable = data.status === "fail" && (hasTenantDetails || data.issues);

                      return (
                        <div key={tableKey}>
                          <div
                            className={cn(
                              "flex items-center gap-2 text-sm py-0.5",
                              isExpandable && "cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
                            )}
                            onClick={() => {
                              if (!isExpandable) return;
                              setExpandedReconcileTables(prev => {
                                const next = new Set(prev);
                                if (next.has(tableKey)) next.delete(tableKey);
                                else next.add(tableKey);
                                return next;
                              });
                            }}
                          >
                            {isExpandable && (
                              isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
                            )}
                            <Badge
                              variant={data.status === "pass" ? "default" : "destructive"}
                              className={cn("text-[10px] px-1 py-0", data.status === "pass" && "bg-green-600")}
                            >
                              {data.status === "pass" ? "OK" : "FAIL"}
                            </Badge>
                            <span className="font-mono">{tableKey}</span>
                            {data.counts && (
                              <span className="text-muted-foreground text-xs">
                                ({Object.entries(data.counts).map(([t, c]) => `${t}: ${c}`).join(", ")})
                              </span>
                            )}
                            {data.issues && !isExpanded && (
                              <span className="text-destructive text-xs ml-auto">{data.issues.length} issue{data.issues.length !== 1 ? "s" : ""}</span>
                            )}
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="ml-6 text-xs space-y-1 pb-1">
                              {/* Verify mode: issues list */}
                              {data.issues?.map((issue, i) => (
                                <div key={i} className="text-amber-600 dark:text-amber-400">! {issue}</div>
                              ))}

                              {/* Report mode: per-tenant details */}
                              {data.tenants && Object.entries(data.tenants).map(([tenantName, td]) => (
                                <div key={tenantName} className="space-y-0.5">
                                  <div className="font-medium">{tenantName} ({td.count} records)</div>
                                  {td.missing && (
                                    <div className="text-destructive ml-2">
                                      Missing {td.missing.length}: {td.missing.slice(0, 5).map(m => m.name).join(", ")}
                                      {td.missing.length > 5 && ` +${td.missing.length - 5} more`}
                                    </div>
                                  )}
                                  {td.extra && (
                                    <div className="text-amber-600 dark:text-amber-400 ml-2">
                                      Extra {td.extra.length}: {td.extra.slice(0, 5).map(e => e.name).join(", ")}
                                      {td.extra.length > 5 && ` +${td.extra.length - 5} more`}
                                    </div>
                                  )}
                                  {td.diffs && (
                                    <div className="text-blue-600 dark:text-blue-400 ml-2">
                                      Diffs {td.diffs.length}: {td.diffs.slice(0, 3).map(d =>
                                        `${d.name} (${d.fields.map(f => f.field).join(", ")})`
                                      ).join("; ")}
                                      {td.diffs.length > 3 && ` +${td.diffs.length - 3} more`}
                                    </div>
                                  )}
                                  {td.duplicates && (
                                    <div className="text-destructive ml-2">
                                      Duplicate sync_keys: {td.duplicates.map(d => `${d.sync_key} (${d.count}x)`).join(", ")}
                                    </div>
                                  )}
                                  {td.no_sync_key && (
                                    <div className="text-amber-600 dark:text-amber-400 ml-2">
                                      {td.no_sync_key} records without sync_key
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
                              // Non-master: use own coverage; master: use source tenant's coverage
                              const cov = isMasterTenant
                                ? (() => {
                                    const perTenant = syncCoverage[table.key] as Record<string, CoverageEntry> | undefined;
                                    return sourceTenant ? perTenant?.[sourceTenant.slug] : undefined;
                                  })()
                                : (syncCoverage[table.key] as CoverageEntry | undefined);
                              const teeemTemplates = cov && "templates" in cov && cov.templates ? cov.templates.filter((t) => t.name.toLowerCase().startsWith("teeem")) : [];
                              const hasTemplates = teeemTemplates.length > 1;
                              const teeemRecords = cov && "records" in cov && cov.records ? cov.records.filter((r) => r.name.toLowerCase().startsWith("teeem")) : [];
                              const hasRecords = teeemRecords.length > 0;
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
                                {count.toLocaleString()}
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
                                        title={`${cov.local_only} local-only record${cov.local_only !== 1 ? "s" : ""} (not in source)`}
                                      >
                                        +{cov.local_only}
                                      </span>
                                    </div>
                                  );
                                }
                                // Show delta when local has more than source (e.g. tasks pending propagation)
                                const localDelta = localCount - sourceCount;
                                if (localDelta > 0) {
                                  return (
                                    <div className="flex items-center justify-end gap-1">
                                      <span>{localCount.toLocaleString()}</span>
                                      <span
                                        className="text-muted-foreground text-[10px]"
                                        title={`${localDelta} local record${localDelta !== 1 ? "s" : ""} not yet in source (propagating to other tenants)`}
                                      >
                                        +{localDelta}
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
                          {isMasterTenant && nonMasterTenants.length > 0 ? (
                            // Master view: each tenant's mode — clickable to change that tenant's setting
                            <div className="flex flex-col items-center gap-0.5">
                              {nonMasterTenants.map((t) => {
                                const mode = getTenantTableMode(t.slug, table.key, table.defaultMode);
                                const st = SYNC_MODE_LABELS[mode];
                                return (
                                  <button
                                    key={t.slug}
                                    type="button"
                                    className={cn("text-[10px] font-medium whitespace-nowrap cursor-pointer hover:underline transition-colors", st.color)}
                                    onClick={() => handleCycleTenantMode(t, table.key, mode)}
                                    title={`${t.name}: click to change sync direction`}
                                  >
                                    {t.name.split(" ")[0]}: {st.label}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            (() => {
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
                            })()
                          )}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <div className="flex flex-col items-end gap-1">
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
                                  {result.updated > 0 && (
                                    <span
                                      className="text-blue-600 dark:text-blue-400"
                                      title={[
                                        `${result.updated} record${result.updated !== 1 ? "s" : ""} updated`,
                                        result.skipped > 0 ? `${result.skipped} already up to date` : null,
                                        result.imported > 0 ? `${result.imported} created` : null,
                                      ].filter(Boolean).join(" · ")}
                                    >
                                      {result.updated} upd
                                    </span>
                                  )}
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
                            {/* Promoted-to-master: orphaned records that are in-use, so we sync them up to TEEEM */}
                            {isMasterTenant && cascadeResults[table.key] && (() => {
                              const totalPromoted = Object.values(cascadeResults[table.key]).reduce((sum, r) => sum + (r.promoted_to_master || 0), 0);
                              if (totalPromoted === 0) return null;
                              return (
                                <span
                                  className="text-[10px] text-blue-600 dark:text-blue-400 cursor-help"
                                  title="Tenant-only records promoted to TEEEM — will be distributed to all tenants on the next cascade sync"
                                >
                                  ↑ {totalPromoted} promoted to TEEEM
                                </span>
                              );
                            })()}
                            {/* Skipped orphans warning — records that couldn't be deleted because they're still referenced */}
                            {isMasterTenant && cascadeResults[table.key] && (() => {
                              const allSkipped = Object.entries(cascadeResults[table.key]).flatMap(([tenantSlug, r]) =>
                                (r.skipped_orphans || []).map((o) => ({ ...o, tenantSlug }))
                              );
                              if (allSkipped.length === 0) return null;
                              const tooltip = allSkipped
                                .map((o) => `${o.tenantSlug}: "${o.name}" still used by ${o.referenced_by} — remove that reference first`)
                                .join("\n");
                              return (
                                <span
                                  className="text-[10px] text-amber-600 dark:text-amber-400 cursor-help"
                                  title={tooltip}
                                >
                                  ⚠ {allSkipped.length} can&apos;t delete (hover)
                                </span>
                              );
                            })()}
                            {/* Phase 0 failed — records that failed to pull into TEEEM (FK remap failures) */}
                            {isMasterTenant && phase0Results[table.key] && (() => {
                              const allFailed = Object.entries(phase0Results[table.key]).flatMap(([tenantSlug, r]) =>
                                (r.failed || []).map((s) => ({ ...s, tenantSlug }))
                              );
                              if (allFailed.length === 0) return null;
                              const tooltip = allFailed
                                .map((s) => `${s.tenantSlug}: "${s.name}" — ${s.reason}`)
                                .join("\n");
                              return (
                                <span
                                  className="text-[10px] text-red-600 dark:text-red-400 cursor-help"
                                  title={tooltip}
                                >
                                  ⚠ {allFailed.length} failed to pull (hover)
                                </span>
                              );
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Template breakdown sub-rows */}
                      {expandedTables.has(table.key) && (() => {
                        const cov = isMasterTenant
                          ? (() => {
                              const perTenant = syncCoverage[table.key] as Record<string, CoverageEntry> | undefined;
                              return sourceTenant ? perTenant?.[sourceTenant.slug] : undefined;
                            })()
                          : (syncCoverage[table.key] as CoverageEntry | undefined);
                        const allTemplates = cov && "templates" in cov ? cov.templates : undefined;
                        // Only show Teeem-prefixed templates (others are tenant-specific/independent)
                        const templates = allTemplates?.filter((t) => t.name.toLowerCase().startsWith("teeem"));
                        if (!templates || templates.length === 0) return null;

                        return templates.map((tmpl) => {
                          const recMode = getRecordMode(table.key, tmpl.id, table.defaultMode);
                          return (
                            <TableRow key={`${table.key}-tmpl-${tmpl.id}`} className="bg-muted/30">
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
                                {isMasterTenant && nonMasterTenants.length > 0 ? (
                                  <div className="flex flex-col items-center gap-0">
                                    {nonMasterTenants.map((t) => {
                                      const mode = getTenantRecordMode(t.slug, table.key, tmpl.id, table.defaultMode);
                                      const st = SYNC_MODE_LABELS[mode];
                                      return (
                                        <button
                                          key={t.slug}
                                          type="button"
                                          className={cn("text-[10px] font-medium whitespace-nowrap cursor-pointer hover:underline transition-colors", st.color)}
                                          onClick={() => handleCycleTenantRecordMode(t, table.key, tmpl.id, mode)}
                                          title={`${t.name}: click to change sync direction`}
                                        >
                                          {t.name.split(" ")[0]}: {st.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <button
                                    className={cn(
                                      "text-[11px] font-medium cursor-pointer hover:underline",
                                      SYNC_MODE_LABELS[recMode].color,
                                    )}
                                    title="Click to change sync direction for this record"
                                    onClick={() => handleCycleRecordMode(table.key, tmpl.id, recMode)}
                                  >
                                    {SYNC_MODE_LABELS[recMode].label}
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className="py-1.5" />
                            </TableRow>
                          );
                        });
                      })()}

                      {/* Records breakdown sub-rows (Quote Templates, PO Packs, PO Items, PO Line Items) */}
                      {expandedTables.has(table.key) && (() => {
                        const cov = isMasterTenant
                          ? (() => {
                              const perTenant = syncCoverage[table.key] as Record<string, CoverageEntry> | undefined;
                              return sourceTenant ? perTenant?.[sourceTenant.slug] : undefined;
                            })()
                          : (syncCoverage[table.key] as CoverageEntry | undefined);
                        const allRecords = cov && "records" in cov ? cov.records : undefined;
                        // Only show Teeem-prefixed records (others are tenant-specific/independent)
                        const records = allRecords?.filter((r) => r.name.toLowerCase().startsWith("teeem"));
                        if (!records || records.length === 0) return null;

                        return records.map((rec) => {
                          // Master-only records have negative IDs (exist in TEEEM but not locally)
                          const isMasterOnly = rec.id < 0;
                          // Master-only records use name-based mode keys to survive ID changes
                          const recMode = getRecordMode(table.key, rec.id, table.defaultMode, isMasterOnly ? rec.name : undefined);
                          // Use name-based key for master-only records to avoid collisions
                          const rowKey = isMasterOnly
                            ? `${table.key}-master-${rec.name}`
                            : `${table.key}-rec-${rec.id}`;
                          return (
                            <TableRow key={rowKey} className="bg-muted/30">
                              <TableCell className="py-1.5" />
                              <TableCell className="py-1.5 pl-10">
                                <span className="text-xs text-muted-foreground">{rec.name}</span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-xs text-muted-foreground py-1.5">
                                {rec.master_count != null && rec.master_count > 0 ? rec.master_count.toLocaleString() : ""}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-xs text-muted-foreground py-1.5">
                                {rec.count != null && rec.count > 0 ? rec.count.toLocaleString() : "0"}
                              </TableCell>
                              <TableCell className="text-center py-1.5">
                                {isMasterTenant && nonMasterTenants.length > 0 ? (
                                  <div className="flex flex-col items-center gap-0">
                                    {nonMasterTenants.map((t) => {
                                      const mode = getTenantRecordMode(t.slug, table.key, rec.id, table.defaultMode, isMasterOnly ? rec.name : undefined);
                                      const st = SYNC_MODE_LABELS[mode];
                                      return (
                                        <button
                                          key={t.slug}
                                          type="button"
                                          className={cn("text-[10px] font-medium whitespace-nowrap cursor-pointer hover:underline transition-colors", st.color)}
                                          onClick={() => handleCycleTenantRecordMode(t, table.key, rec.id, mode, isMasterOnly ? rec.name : undefined)}
                                          title={`${t.name}: click to change sync direction`}
                                        >
                                          {t.name.split(" ")[0]}: {st.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <button
                                    className={cn(
                                      "text-[11px] font-medium cursor-pointer hover:underline",
                                      SYNC_MODE_LABELS[recMode].color,
                                    )}
                                    title={isMasterOnly
                                      ? "Click to change sync direction (not yet synced locally)"
                                      : "Click to change sync direction for this record"}
                                    onClick={() => handleCycleRecordMode(table.key, rec.id, recMode, isMasterOnly ? rec.name : undefined)}
                                  >
                                    {SYNC_MODE_LABELS[recMode].label}
                                  </button>
                                )}
                              </TableCell>
                              <TableCell className="py-1.5" />
                            </TableRow>
                          );
                        });
                      })()}

                      {/* Skipped orphan sub-rows — tenant records that couldn't be deleted (FK violation) — now auto-promoted to TEEEM */}
                      {expandedTables.has(table.key) && isMasterTenant && cascadeResults[table.key] && (() => {
                        const allSkipped = Object.entries(cascadeResults[table.key]).flatMap(([tenantSlug, r]) =>
                          (r.skipped_orphans || []).map((o) => ({ ...o, tenantSlug }))
                        );
                        if (allSkipped.length === 0) return null;
                        const colSpan = allTenants.length > 0 ? allTenants.length + 4 : 6;
                        return (
                          <React.Fragment key={`${table.key}-orphans`}>
                            <TableRow className="bg-blue-50/20 dark:bg-blue-950/10">
                              <TableCell colSpan={colSpan} className="py-1 px-4">
                                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                                  ↑ {allSkipped.length} tenant-only record{allSkipped.length !== 1 ? "s" : ""} still referenced — promoted to TEEEM (run cascade again to distribute)
                                </span>
                              </TableCell>
                            </TableRow>
                            {allSkipped.map((o, i) => (
                              <TableRow key={`${table.key}-orphan-${o.tenantSlug}-${o.id}-${i}`} className="bg-amber-50/10 dark:bg-amber-950/5">
                                <TableCell className="py-1" />
                                <TableCell className="py-1 pl-10">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{o.name}</span>
                                    <span className="text-[10px] text-muted-foreground">({o.tenantSlug})</span>
                                  </div>
                                </TableCell>
                                {allTenants.map((t) => (
                                  <TableCell key={t.slug} className="py-1" />
                                ))}
                                <TableCell className="py-1" />
                                <TableCell className="py-1 text-right">
                                  <span
                                    className="text-[10px] text-amber-600 dark:text-amber-400"
                                    title={`Remove the reference in ${o.referenced_by} first, then re-sync to clean this up`}
                                  >
                                    used by {o.referenced_by}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        );
                      })()}

                      {/* Phase 0 failed sub-rows — records that failed to pull into TEEEM (FK remap failures) */}
                      {expandedTables.has(table.key) && isMasterTenant && phase0Results[table.key] && (() => {
                        const allFailed = Object.entries(phase0Results[table.key]).flatMap(([tenantSlug, r]) =>
                          (r.failed || []).map((s) => ({ ...s, tenantSlug }))
                        );
                        if (allFailed.length === 0) return null;
                        const colSpan = allTenants.length > 0 ? allTenants.length + 4 : 6;
                        return (
                          <React.Fragment key={`${table.key}-phase0`}>
                            <TableRow className="bg-red-50/20 dark:bg-red-950/10">
                              <TableCell colSpan={colSpan} className="py-1 px-4">
                                <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                                  ⚠ {allFailed.length} record{allFailed.length !== 1 ? "s" : ""} failed to pull into TEEEM (FK remap failures)
                                </span>
                              </TableCell>
                            </TableRow>
                            {allFailed.map((s, i) => (
                              <TableRow key={`${table.key}-phase0-${s.tenantSlug}-${i}`} className="bg-red-50/10 dark:bg-red-950/5">
                                <TableCell className="py-1" />
                                <TableCell className="py-1 pl-10">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">{s.name}</span>
                                    <span className="text-[10px] text-muted-foreground">({s.tenantSlug})</span>
                                  </div>
                                </TableCell>
                                {allTenants.map((t) => (
                                  <TableCell key={t.slug} className="py-1" />
                                ))}
                                <TableCell className="py-1" />
                                <TableCell className="py-1 text-right">
                                  <span
                                    className="text-[10px] text-red-600 dark:text-red-400"
                                    title={s.reason}
                                  >
                                    {s.reason.length > 60 ? s.reason.slice(0, 60) + "..." : s.reason}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        );
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
            {!isMasterTenant && (
              <Button
                onClick={handleSync}
                disabled={syncing || cascading}
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
            )}
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
