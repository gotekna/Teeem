"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  AlertTriangle,
  Users,
  FileText,
  Database,
  Upload,
  Building2,
  ChevronRight,
  RefreshCw,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types matching what page.tsx already provides
interface XeroTenant {
  id: number;
  tenant_id: string;
  tenant_name: string;
  connected_at: string;
  is_primary: boolean;
  expires_at?: string;
  expired?: boolean;
  status?: "connected" | "degraded" | "disconnected";
  needs_reauth?: boolean;
  status_display?: "connected" | "warning" | "expired" | "disconnected";
  daily_used?: number;
  daily_limit?: number;
}

interface PdfSyncHealth {
  stage1_percentage: number;
  stage2_percentage: number;
  stage3_percentage: number;
  overall_status:
    | "healthy"
    | "in_progress"
    | "warning"
    | "not_started"
    | "partial";
  stage1_data: { linked: number; total: number };
  stage2_data: { downloaded: number; total: number };
  stage3_data: { uploaded: number; total: number };
}

interface SyncStatusData {
  tenants: Array<{
    tenant_id: string;
    tenant_name: string;
    overall_sync_health: "green" | "yellow" | "red";
    contacts: { total_links: number; pending_review: number; unlinked: number };
    sync_health?: {
      contacts?: { age_minutes: number | null; health_status: "green" | "yellow" | "red" };
      invoices?: { age_minutes: number | null; health_status: "green" | "yellow" | "red" };
      bank_transactions?: { age_minutes: number | null; health_status: "green" | "yellow" | "red" };
    };
  }>;
}

interface XeroOverviewProps {
  tenants: XeroTenant[];
  pdfSyncHealth: PdfSyncHealth | null;
  duplicateCount: number;
  onNavigateTab: (tab: string) => void;
}

// Health color for sync age
function getSyncHealthColor(
  ageMinutes: number | null,
  thresholds: { green: number; yellow: number }
): "green" | "yellow" | "red" {
  if (ageMinutes === null) return "red";
  if (ageMinutes <= thresholds.green) return "green";
  if (ageMinutes <= thresholds.yellow) return "yellow";
  return "red";
}

function formatAge(ageMinutes: number | null): string {
  if (ageMinutes === null) return "-";
  if (ageMinutes < 1) return "now";
  if (ageMinutes < 60) return `${Math.round(ageMinutes)}m ago`;
  if (ageMinutes < 1440) return `${Math.round(ageMinutes / 60)}h ago`;
  return `${Math.round(ageMinutes / 1440)}d ago`;
}

function getHealthDotClass(status: "green" | "yellow" | "red"): string {
  switch (status) {
    case "green":
      return "bg-green-500";
    case "yellow":
      return "bg-amber-500";
    case "red":
      return "bg-red-500";
  }
}

function getOrgPillClass(tenant: XeroTenant): string {
  if (
    tenant.expired ||
    tenant.needs_reauth ||
    tenant.status === "disconnected" ||
    tenant.status_display === "expired" ||
    tenant.status_display === "disconnected"
  ) {
    return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800";
  }
  if (
    tenant.status === "degraded" ||
    tenant.status_display === "warning"
  ) {
    return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800";
  }
  return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800";
}

function getOrgDotClass(tenant: XeroTenant): string {
  if (
    tenant.expired ||
    tenant.needs_reauth ||
    tenant.status === "disconnected" ||
    tenant.status_display === "expired" ||
    tenant.status_display === "disconnected"
  ) {
    return "bg-red-500";
  }
  if (tenant.status === "degraded" || tenant.status_display === "warning") {
    return "bg-amber-500";
  }
  return "bg-green-500";
}

function getApiUsagePercent(tenant: XeroTenant): number | null {
  if (tenant.daily_used == null || tenant.daily_limit == null) return null;
  return Math.round((tenant.daily_used / tenant.daily_limit) * 100);
}

export function XeroOverview({
  tenants,
  pdfSyncHealth,
  duplicateCount,
  onNavigateTab,
}: XeroOverviewProps) {
  // Fetch sync status data for the overview cards
  const [syncData, setSyncData] = React.useState<SyncStatusData | null>(null);

  React.useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        const { api } = await import("@/lib/api");
        const response = await api.get<{ success: boolean; data: SyncStatusData }>(
          "/api/v1/xero/sync_stats"
        );
        if (response.success && response.data) {
          setSyncData(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch sync stats for overview:", err);
      }
    };
    fetchSyncStatus();
  }, []);

  // Aggregate sync health from sync status data
  const syncSummary = React.useMemo(() => {
    if (!syncData?.tenants?.length) return null;

    let totalContacts = 0;
    let totalUnlinked = 0;
    let totalPendingReview = 0;
    let contactsAgeMin: number | null = null;
    let invoicesAgeMin: number | null = null;
    let bankAgeMin: number | null = null;

    for (const t of syncData.tenants) {
      totalContacts += t.contacts?.total_links || 0;
      totalUnlinked += t.contacts?.unlinked || 0;
      totalPendingReview += t.contacts?.pending_review || 0;

      // Track latest (smallest) age for each sync type
      const cAge = t.sync_health?.contacts?.age_minutes;
      if (cAge != null && (contactsAgeMin === null || cAge < contactsAgeMin)) {
        contactsAgeMin = cAge;
      }
      const iAge = t.sync_health?.invoices?.age_minutes;
      if (iAge != null && (invoicesAgeMin === null || iAge < invoicesAgeMin)) {
        invoicesAgeMin = iAge;
      }
      const bAge = t.sync_health?.bank_transactions?.age_minutes;
      if (bAge != null && (bankAgeMin === null || bAge < bankAgeMin)) {
        bankAgeMin = bAge;
      }
    }

    return {
      totalContacts,
      totalUnlinked,
      totalPendingReview,
      contactsAgeMin,
      invoicesAgeMin,
      bankAgeMin,
    };
  }, [syncData]);

  // Build action items
  const actionItems = React.useMemo(() => {
    const items: Array<{
      label: string;
      tab: string;
      variant: "warning" | "error" | "info";
    }> = [];

    // Pending review contacts
    const pendingReview = syncSummary?.totalPendingReview || 0;
    if (pendingReview > 0) {
      items.push({
        label: `${pendingReview} contact${pendingReview !== 1 ? "s" : ""} need review`,
        tab: "sync",
        variant: "warning",
      });
    }

    // Duplicates
    if (duplicateCount > 0) {
      items.push({
        label: `${duplicateCount} duplicate${duplicateCount !== 1 ? "s" : ""} found`,
        tab: "duplicates",
        variant: "warning",
      });
    }

    // Expired tenants
    const expiredTenants = tenants.filter(
      (t) =>
        t.expired ||
        t.needs_reauth ||
        t.status === "disconnected" ||
        t.status_display === "expired" ||
        t.status_display === "disconnected"
    );
    for (const t of expiredTenants) {
      items.push({
        label: `Reconnection required for ${t.tenant_name}`,
        tab: "connection",
        variant: "error",
      });
    }

    // Rate limited orgs
    const rateLimitedOrgs = tenants.filter(
      (t) => {
        const pct = getApiUsagePercent(t);
        return pct !== null && pct >= 90;
      }
    );
    for (const t of rateLimitedOrgs) {
      items.push({
        label: `API rate at ${getApiUsagePercent(t)}% for ${t.tenant_name}`,
        tab: "status",
        variant: "warning",
      });
    }

    // Unlinked contacts blocking PDF sync
    const totalUnlinked = syncSummary?.totalUnlinked || 0;
    if (totalUnlinked > 0) {
      items.push({
        label: `${totalUnlinked} unlinked contact${totalUnlinked !== 1 ? "s" : ""} blocking PDF sync`,
        tab: "sync",
        variant: "warning",
      });
    }

    return items;
  }, [tenants, duplicateCount, syncSummary]);

  // Health card data
  const contactsHealth = syncSummary
    ? getSyncHealthColor(syncSummary.contactsAgeMin, { green: 30, yellow: 45 })
    : "red";
  const invoicesHealth = syncSummary
    ? getSyncHealthColor(syncSummary.invoicesAgeMin, { green: 10, yellow: 15 })
    : "red";
  const bankHealth = syncSummary
    ? getSyncHealthColor(syncSummary.bankAgeMin, { green: 720, yellow: 1080 })
    : "red";

  // Pipeline health based on stage completion
  const pipelineHealth: "green" | "yellow" | "red" = pdfSyncHealth
    ? pdfSyncHealth.overall_status === "healthy"
      ? "green"
      : pdfSyncHealth.overall_status === "in_progress"
        ? "yellow"
        : pdfSyncHealth.overall_status === "warning"
          ? "red"
          : "yellow"
    : "red";

  return (
    <div className="space-y-6">
      {/* Section A - Connection Health Strip */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Connected Organizations</CardTitle>
            <Badge variant="outline" className="text-xs">
              {tenants.length} org{tenants.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {tenants
              .sort((a, b) => {
                if (a.is_primary) return -1;
                if (b.is_primary) return 1;
                return a.tenant_name.localeCompare(b.tenant_name);
              })
              .map((tenant) => {
                const apiPct = getApiUsagePercent(tenant);
                return (
                  <button
                    key={tenant.tenant_id}
                    onClick={() => onNavigateTab("connection")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors hover:opacity-80",
                      getOrgPillClass(tenant)
                    )}
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        getOrgDotClass(tenant)
                      )}
                    />
                    <span className="truncate max-w-[160px]">
                      {tenant.tenant_name}
                    </span>
                    {apiPct !== null && (
                      <span className="text-xs opacity-70">{apiPct}%</span>
                    )}
                  </button>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Section B - Sync Health Cards (2x2 grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Contacts Card */}
        <button
          onClick={() => onNavigateTab("status")}
          className="text-left"
        >
          <Card className="h-full hover:bg-accent/30 transition-colors cursor-pointer">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="font-medium text-sm">Contacts</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      getHealthDotClass(contactsHealth)
                    )}
                  />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="text-2xl font-bold">
                {syncSummary?.totalContacts?.toLocaleString() || "..."}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Last sync{" "}
                {syncSummary?.contactsAgeMin != null
                  ? formatAge(syncSummary.contactsAgeMin)
                  : "unknown"}
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Invoices & Bills Card */}
        <button
          onClick={() => onNavigateTab("status")}
          className="text-left"
        >
          <Card className="h-full hover:bg-accent/30 transition-colors cursor-pointer">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded">
                    <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="font-medium text-sm">Invoices & Bills</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      getHealthDotClass(invoicesHealth)
                    )}
                  />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="text-2xl font-bold">
                {pdfSyncHealth
                  ? pdfSyncHealth.stage1_data.total.toLocaleString()
                  : "..."}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {pdfSyncHealth
                  ? `${pdfSyncHealth.stage1_data.linked.toLocaleString()} linked`
                  : "Loading..."}{" "}
                &middot; Last sync{" "}
                {syncSummary?.invoicesAgeMin != null
                  ? formatAge(syncSummary.invoicesAgeMin)
                  : "unknown"}
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Document Pipeline Card */}
        <button
          onClick={() => onNavigateTab("status")}
          className="text-left"
        >
          <Card className="h-full hover:bg-accent/30 transition-colors cursor-pointer">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded">
                    <Database className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="font-medium text-sm">
                    Document Pipeline
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      getHealthDotClass(pipelineHealth)
                    )}
                  />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              {pdfSyncHealth ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Database className="h-3 w-3 text-purple-500" />
                    <span className="w-12 text-muted-foreground">Data</span>
                    <Progress
                      value={pdfSyncHealth.stage1_percentage}
                      className="h-1.5 flex-1"
                    />
                    <span className="w-8 text-right font-medium">
                      {pdfSyncHealth.stage1_percentage}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <FileText className="h-3 w-3 text-blue-500" />
                    <span className="w-12 text-muted-foreground">PDF</span>
                    <Progress
                      value={pdfSyncHealth.stage2_percentage}
                      className="h-1.5 flex-1"
                    />
                    <span className="w-8 text-right font-medium">
                      {pdfSyncHealth.stage2_percentage}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Upload className="h-3 w-3 text-green-500" />
                    <span className="w-12 text-muted-foreground">Upload</span>
                    <Progress
                      value={pdfSyncHealth.stage3_percentage}
                      className="h-1.5 flex-1"
                    />
                    <span className="w-8 text-right font-medium">
                      {pdfSyncHealth.stage3_percentage}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Loading...</div>
              )}
            </CardContent>
          </Card>
        </button>

        {/* Bank Transactions Card */}
        <button
          onClick={() => onNavigateTab("status")}
          className="text-left"
        >
          <Card className="h-full hover:bg-accent/30 transition-colors cursor-pointer">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded">
                    <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="font-medium text-sm">
                    Bank Transactions
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      getHealthDotClass(bankHealth)
                    )}
                  />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Last sync{" "}
                {syncSummary?.bankAgeMin != null
                  ? formatAge(syncSummary.bankAgeMin)
                  : "unknown"}
              </div>
              <div className="text-xs text-muted-foreground/70 mt-0.5">
                Synced every 6 hours
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Section C - Action Items */}
      {actionItems.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Action Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actionItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => onNavigateTab(item.tab)}
                  className={cn(
                    "flex items-center justify-between w-full p-3 rounded-lg border text-sm transition-colors text-left",
                    item.variant === "error" &&
                      "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40",
                    item.variant === "warning" &&
                      "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40",
                    item.variant === "info" &&
                      "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4 shrink-0",
                        item.variant === "error" &&
                          "text-red-600 dark:text-red-400",
                        item.variant === "warning" &&
                          "text-amber-600 dark:text-amber-400",
                        item.variant === "info" &&
                          "text-blue-600 dark:text-blue-400"
                      )}
                    />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full mb-3">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg font-medium text-green-700 dark:text-green-300">
              All systems healthy
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              No action items at this time
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
