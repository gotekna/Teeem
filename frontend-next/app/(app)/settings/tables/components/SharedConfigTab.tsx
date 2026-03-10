"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronDown, ChevronRight, Database, ChevronsUpDown, ChevronsDownUp } from "lucide-react";

interface TableCounts {
  total: number;
  global: number;
  tenant_specific: number;
  per_tenant: Record<string, number>;
}

interface SharedTable {
  key: string;
  model: string;
  table_name: string;
  description: string;
  group: string;
  uses_global_records: boolean;
  counts: TableCounts;
}

interface TableGroup {
  key: string;
  label: string;
  tables: SharedTable[];
}

interface SharedConfigData {
  groups: TableGroup[];
  summary: {
    total_tables: number;
    global_enabled: number;
    total_records: number;
    total_global: number;
    total_tenant_specific: number;
  };
}

/**
 * SharedConfigTab - Dashboard of all shared config tables
 *
 * Shows tables with has_global_records: true, grouped by category.
 * Displays total, global, and per-tenant record counts.
 *
 * SSoT: TenantConfigSyncService::CONFIG_TABLES (backend)
 */
export function SharedConfigTab() {
  const [data, setData] = useState<SharedConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ success: boolean; data: SharedConfigData; error?: string }>("/api/v1/shared_config/tables");
      if (response?.success) {
        setData(response.data);
        // Default: all groups collapsed
        setCollapsedGroups((prev) => prev ?? new Set(response.data.groups.map((g) => g.key)));
      } else {
        setError(response?.error || "Failed to load shared config data");
      }
    } catch (err) {
      setError("Failed to load shared config data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
        <span className="ml-2 text-sm text-muted-foreground">Loading shared config tables...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { groups, summary } = data;
  const tenantNames = Array.from(
    new Set(
      groups.flatMap((g) =>
        g.tables.flatMap((t) => Object.keys(t.counts.per_tenant))
      )
    )
  ).sort();

  return (
    <div className="space-y-4 p-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <Badge variant="outline">{summary.total_tables} tables</Badge>
            <Badge variant="secondary">{summary.total_records.toLocaleString()} total records</Badge>
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
              {summary.total_global.toLocaleString()} global
            </Badge>
            {summary.total_tenant_specific > 0 && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                {summary.total_tenant_specific.toLocaleString()} tenant-specific
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCollapsedGroups(new Set())}
            disabled={collapsedGroups?.size === 0}
          >
            <ChevronsUpDown className="h-4 w-4 mr-1" /> Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCollapsedGroups(new Set(groups.map((g) => g.key)))}
            disabled={collapsedGroups?.size === groups.length}
          >
            <ChevronsDownUp className="h-4 w-4 mr-1" /> Collapse All
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Groups */}
      {groups.map((group) => {
        const isCollapsed = collapsedGroups?.has(group.key) ?? true;
        const groupTotal = group.tables.reduce((sum, t) => sum + t.counts.total, 0);
        const groupGlobal = group.tables.reduce((sum, t) => sum + t.counts.global, 0);

        return (
          <div key={group.key} className="border rounded-lg dark:border-zinc-700">
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group.key)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 rounded-t-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-semibold text-sm">{group.label}</span>
                <Badge variant="outline" className="text-xs">
                  {group.tables.length} {group.tables.length === 1 ? "table" : "tables"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{groupGlobal.toLocaleString()} global</span>
                <span>/</span>
                <span>{groupTotal.toLocaleString()} total</span>
              </div>
            </button>

            {/* Table rows */}
            {!isCollapsed && (
              <div className="border-t dark:border-zinc-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-zinc-700 bg-muted/30">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Table</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Description</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Global</th>
                      {tenantNames.map((name) => (
                        <th key={name} className="text-right px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">
                          {name}
                        </th>
                      ))}
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.tables.map((table) => {
                      const allGlobal = table.counts.tenant_specific === 0 && table.counts.global > 0;
                      const hasTenantSpecific = table.counts.tenant_specific > 0;

                      return (
                        <tr key={table.key} className="border-b last:border-b-0 dark:border-zinc-700 hover:bg-muted/20">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded dark:bg-zinc-800">
                                {table.table_name}
                              </code>
                              {table.uses_global_records && (
                                <Badge className="text-[10px] px-1 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  global
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground text-xs max-w-[300px] truncate">
                            {table.description}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {table.counts.global > 0 ? (
                              <span className={allGlobal ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                                {table.counts.global.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          {tenantNames.map((name) => {
                            const count = table.counts.per_tenant[name] || 0;
                            return (
                              <td key={name} className="px-4 py-2 text-right tabular-nums">
                                {count > 0 ? (
                                  <span className="text-amber-600 dark:text-amber-400">
                                    {count.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-2 text-right tabular-nums font-medium">
                            {table.counts.total.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
