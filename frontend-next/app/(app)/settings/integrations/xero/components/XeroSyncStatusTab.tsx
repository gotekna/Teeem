"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Users,
  Receipt,
  Building2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Types for sync status per tenant
interface SyncTypeStatus {
  status: string | null;
  health_status: "green" | "yellow" | "red";
  stale: boolean;
  last_synced_at: string | null;
  age_seconds: number | null;
  age_minutes: number | null;
  next_sync_at: string | null;
  records_synced: number | null;
  last_error: string | null;
  message: string;
}

interface TenantSyncHealth {
  invoices?: SyncTypeStatus;
  contacts?: SyncTypeStatus;
  pdfs?: SyncTypeStatus;
  bank_transactions?: SyncTypeStatus;
}

interface TenantStats {
  tenant_id: string;
  tenant_name: string;
  status: string;
  is_primary: boolean;
  sync_health: TenantSyncHealth;
  overall_sync_health: "green" | "yellow" | "red";
  contacts: {
    total_links: number;
    sync_enabled: number;
    pending_review: number;
    with_errors: number;
  };
  documents: {
    invoices: number;
    bills: number;
    total: number;
  };
}

interface SyncStatsResponse {
  success: boolean;
  data: {
    tenant_count: number;
    tenants: TenantStats[];
  };
}

// Format relative time (e.g., "5m", "2h", "3d")
function formatAge(ageMinutes: number | null): string {
  if (ageMinutes === null) return "-";
  if (ageMinutes < 1) return "now";
  if (ageMinutes < 60) return `${Math.round(ageMinutes)}m`;
  if (ageMinutes < 1440) return `${Math.round(ageMinutes / 60)}h`;
  return `${Math.round(ageMinutes / 1440)}d`;
}

// Get health status color classes
function getHealthColor(status: "green" | "yellow" | "red"): string {
  switch (status) {
    case "green":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200";
    case "yellow":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200";
    case "red":
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200";
  }
}

// Get health dot color
function getHealthDot(status: "green" | "yellow" | "red"): string {
  switch (status) {
    case "green":
      return "bg-green-500";
    case "yellow":
      return "bg-amber-500";
    case "red":
      return "bg-red-500";
  }
}

// Sync type display info
const SYNC_TYPES: { key: keyof TenantSyncHealth; label: string; icon: React.ReactNode; description: string }[] = [
  { key: "invoices", label: "Invoices", icon: <Receipt className="h-4 w-4" />, description: "Every 5 min" },
  { key: "contacts", label: "Contacts", icon: <Users className="h-4 w-4" />, description: "Webhooks" },
  { key: "pdfs", label: "PDFs", icon: <FileText className="h-4 w-4" />, description: "Every 2 hours" },
  { key: "bank_transactions", label: "Bank Txns", icon: <Building2 className="h-4 w-4" />, description: "Every 6 hours" },
];

// Individual tenant card component
function TenantSyncCard({ tenant }: { tenant: TenantStats }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium">{tenant.tenant_name}</span>
              {tenant.is_primary && (
                <Badge className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs">
                  Primary
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {tenant.contacts.total_links} contacts &middot; {tenant.documents.total} documents
            </div>
          </div>
        </div>

        {/* Overall health indicator */}
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", getHealthDot(tenant.overall_sync_health))} />
          <span className={cn(
            "text-sm font-medium",
            tenant.overall_sync_health === "green" && "text-green-600 dark:text-green-400",
            tenant.overall_sync_health === "yellow" && "text-amber-600 dark:text-amber-400",
            tenant.overall_sync_health === "red" && "text-red-600 dark:text-red-400"
          )}>
            {tenant.overall_sync_health === "green" ? "Healthy" : tenant.overall_sync_health === "yellow" ? "Warning" : "Stale"}
          </span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t bg-muted/20 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SYNC_TYPES.map(({ key, label, icon, description }) => {
              const status = tenant.sync_health?.[key];
              if (!status) {
                return (
                  <div key={key} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {icon}
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">No data</div>
                  </div>
                );
              }

              return (
                <div
                  key={key}
                  className={cn(
                    "p-3 rounded-lg border",
                    getHealthColor(status.health_status)
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <div className={cn("w-2 h-2 rounded-full", getHealthDot(status.health_status))} />
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      <span>{formatAge(status.age_minutes)} ago</span>
                    </div>
                    {status.records_synced !== null && status.records_synced > 0 && (
                      <div className="text-xs opacity-75">
                        {status.records_synced.toLocaleString()} records
                      </div>
                    )}
                    {status.last_error && (
                      <div className="text-xs text-red-600 dark:text-red-400 truncate" title={status.last_error}>
                        {status.last_error}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs opacity-60">{description}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Main component
export function XeroSyncStatusTab() {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [tenants, setTenants] = React.useState<TenantStats[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const response = await api.get<SyncStatsResponse>("/api/v1/xero/sync_stats");
      if (response.success && response.data?.tenants) {
        setTenants(response.data.tenants);
        setError(null);
      } else {
        setError("Failed to load sync status");
      }
    } catch (err) {
      console.error("Failed to fetch sync stats:", err);
      setError(err instanceof Error ? err.message : "Failed to load sync status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Calculate overall stats
  const overallStats = React.useMemo(() => {
    const healthy = tenants.filter(t => t.overall_sync_health === "green").length;
    const warning = tenants.filter(t => t.overall_sync_health === "yellow").length;
    const stale = tenants.filter(t => t.overall_sync_health === "red").length;
    return { healthy, warning, stale };
  }, [tenants]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Sync Status by Organization</CardTitle>
              <CardDescription>
                Real-time sync health for each connected Xero organization
              </CardDescription>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm" disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm">
                <span className="font-medium">{overallStats.healthy}</span> Healthy
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm">
                <span className="font-medium">{overallStats.warning}</span> Warning
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm">
                <span className="font-medium">{overallStats.stale}</span> Stale
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Tenant Cards */}
      <div className="space-y-3">
        {tenants
          .sort((a, b) => {
            // Primary first, then by health (red > yellow > green), then alphabetically
            if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
            const healthOrder = { red: 0, yellow: 1, green: 2 };
            if (healthOrder[a.overall_sync_health] !== healthOrder[b.overall_sync_health]) {
              return healthOrder[a.overall_sync_health] - healthOrder[b.overall_sync_health];
            }
            return a.tenant_name.localeCompare(b.tenant_name);
          })
          .map((tenant) => (
            <TenantSyncCard key={tenant.tenant_id} tenant={tenant} />
          ))}
      </div>

      {tenants.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No Xero organizations connected</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
