"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
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
  Activity,
  ShieldCheck,
  Zap,
  Database,
  Download,
  Upload,
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

// Contact Sync Pipeline types
interface RateLimitInfo {
  tenant_id: string;
  tenant_name: string;
  daily_used: number;
  daily_limit: number;
  daily_percentage: number;
  minute_used: number;
  minute_limit: number;
  can_make_request: boolean;
  locked_out: boolean;
}

interface RecentSession {
  id: number;
  tenant_id: string;
  status: string;
  sync_mode: string;
  fetched_count: number;
  processed_count: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  duration_human: string | null;
}

interface ContactSyncPipelineData {
  pipeline_status: "healthy" | "syncing" | "rate_limited" | "near_daily_limit";
  active_sessions: number;
  completed_24h: number;
  failed_24h: number;
  auto_cancelled_24h: number;
  daily_max_percentage: number;
  rate_limits: RateLimitInfo[];
  recent_sessions: RecentSession[];
}

// Pipeline status display config
const PIPELINE_STATUS_CONFIG = {
  healthy: {
    label: "All Clear",
    description: "Contact sync pipeline is healthy",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
    icon: ShieldCheck,
    dot: "bg-green-500",
  },
  syncing: {
    label: "Syncing",
    description: "Contact sync is actively running",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    icon: Activity,
    dot: "bg-blue-500 animate-pulse",
  },
  rate_limited: {
    label: "Rate Limited",
    description: "One or more orgs are temporarily rate limited by Xero",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    icon: AlertTriangle,
    dot: "bg-amber-500",
  },
  near_daily_limit: {
    label: "Near Daily Limit",
    description: "Approaching Xero's 5,000 calls/day limit",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    icon: Zap,
    dot: "bg-amber-500",
  },
} as const;

// Contact Sync Pipeline card
function ContactSyncPipelineCard({ data }: { data: ContactSyncPipelineData | null }) {
  const [showDetails, setShowDetails] = React.useState(false);

  if (!data) return null;

  const config = PIPELINE_STATUS_CONFIG[data.pipeline_status];
  const StatusIcon = config.icon;

  return (
    <Card className={cn("border", config.bg)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-3 h-3 rounded-full", config.dot)} />
            <div>
              <CardTitle className={cn("text-base", config.color)}>
                Contact Sync Pipeline: {config.label}
              </CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </div>
          </div>
          <StatusIcon className={cn("h-5 w-5", config.color)} />
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <div className="flex flex-col items-center p-2 rounded-md bg-background/60">
            <span className="text-lg font-semibold">{data.active_sessions}</span>
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-md bg-background/60">
            <span className="text-lg font-semibold text-green-600 dark:text-green-400">{data.completed_24h}</span>
            <span className="text-xs text-muted-foreground">Completed (24h)</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-md bg-background/60">
            <span className={cn("text-lg font-semibold", data.failed_24h > 0 ? "text-red-600 dark:text-red-400" : "")}>{data.failed_24h}</span>
            <span className="text-xs text-muted-foreground">Failed (24h)</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-md bg-background/60">
            <span className={cn("text-lg font-semibold", data.auto_cancelled_24h > 0 ? "text-amber-600 dark:text-amber-400" : "")}>{data.auto_cancelled_24h}</span>
            <span className="text-xs text-muted-foreground">Auto-Healed</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-md bg-background/60">
            <span className={cn(
              "text-lg font-semibold",
              data.daily_max_percentage >= 90 ? "text-red-600 dark:text-red-400" :
              data.daily_max_percentage >= 70 ? "text-amber-600 dark:text-amber-400" : ""
            )}>
              {data.daily_max_percentage}%
            </span>
            <span className="text-xs text-muted-foreground">Daily API Used</span>
          </div>
        </div>

        {/* Rate limit bars per tenant */}
        {data.rate_limits.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDetails ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              API usage per org ({data.rate_limits.length})
            </button>

            {showDetails && (
              <div className="mt-2 space-y-2">
                {data.rate_limits.map((rl) => (
                  <div key={rl.tenant_id} className="flex items-center gap-3">
                    <span className="text-xs w-32 truncate" title={rl.tenant_name}>
                      {rl.tenant_name}
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          rl.daily_percentage >= 90 ? "bg-red-500" :
                          rl.daily_percentage >= 70 ? "bg-amber-500" :
                          "bg-green-500"
                        )}
                        style={{ width: `${Math.min(rl.daily_percentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums w-20 text-right">
                      {rl.daily_used}/{rl.daily_limit}
                    </span>
                    {rl.locked_out && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0">
                        Locked
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent sessions */}
        {data.recent_sessions.length > 0 && showDetails && (
          <div className="mt-4">
            <span className="text-xs text-muted-foreground">Recent sessions</span>
            <div className="mt-1 space-y-1">
              {data.recent_sessions.map((session) => (
                <div key={session.id} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    session.status === "completed" ? "bg-green-500" :
                    session.status === "failed" ? "bg-red-500" :
                    "bg-blue-500 animate-pulse"
                  )} />
                  <span className="truncate flex-1">
                    {session.sync_mode} &middot; {session.fetched_count} fetched
                    {session.error_message && (
                      <span className="text-red-500 dark:text-red-400" title={session.error_message}>
                        {" "}&middot; {session.error_message.substring(0, 60)}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {session.duration_human || "running"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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

        {/* Compact sync type indicators + overall health */}
        <div className="flex items-center gap-4">
          {/* 4 sync type mini indicators */}
          <div className="hidden sm:flex items-center gap-2">
            {SYNC_TYPES.map(({ key, label }) => {
              const status = tenant.sync_health?.[key];
              const health = status?.health_status || "red";
              const age = status?.age_minutes;
              const hasError = !!status?.last_error;
              const shortLabel = key === "invoices" ? "I" : key === "contacts" ? "C" : key === "pdfs" ? "P" : "B";
              const tooltipText = hasError
                ? `${label}: ${status?.last_error}`
                : `${label}: ${formatAge(age ?? null)} ago`;

              return (
                <div
                  key={key}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium",
                    health === "green" && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
                    health === "yellow" && "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
                    health === "red" && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  )}
                  title={tooltipText}
                >
                  <span>{shortLabel}</span>
                  {hasError ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <span className="opacity-75">{formatAge(age ?? null)}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Overall health indicator with problem details */}
          {(() => {
            // Find which sync types are causing issues
            const problemTypes = SYNC_TYPES
              .filter(({ key }) => {
                const status = tenant.sync_health?.[key];
                return status?.health_status === "red" || status?.health_status === "yellow";
              })
              .map(({ key }) => key === "invoices" ? "I" : key === "contacts" ? "C" : key === "pdfs" ? "P" : "B");

            const healthLabel = tenant.overall_sync_health === "green"
              ? "Healthy"
              : tenant.overall_sync_health === "yellow"
                ? `Warning: ${problemTypes.join(", ")}`
                : `Stale: ${problemTypes.join(", ")}`;

            return (
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", getHealthDot(tenant.overall_sync_health))} />
                <span className={cn(
                  "text-sm font-medium",
                  tenant.overall_sync_health === "green" && "text-green-600 dark:text-green-400",
                  tenant.overall_sync_health === "yellow" && "text-amber-600 dark:text-amber-400",
                  tenant.overall_sync_health === "red" && "text-red-600 dark:text-red-400"
                )}>
                  {healthLabel}
                </span>
              </div>
            );
          })()}
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

// Document pipeline health (3-stage: Data → PDF → Upload)
interface DocPipelineHealth {
  stage1_percentage: number;
  stage2_percentage: number;
  stage3_percentage: number;
  overall_status: "healthy" | "in_progress" | "warning" | "not_started" | "partial";
  stage1_data: { linked: number; total: number };
  stage2_data: { downloaded: number; total: number };
  stage3_data: { uploaded: number; total: number };
}

// Main component
export function XeroSyncStatusTab() {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [tenants, setTenants] = React.useState<TenantStats[]>([]);
  const [pipelineData, setPipelineData] = React.useState<ContactSyncPipelineData | null>(null);
  const [docPipeline, setDocPipeline] = React.useState<DocPipelineHealth | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const [statsResponse, pipelineResponse, pdfSyncResponse] = await Promise.all([
        api.get<SyncStatsResponse>("/api/v1/xero/sync_stats"),
        api.get<{ success: boolean; data: ContactSyncPipelineData }>("/api/v1/xero/contact_sync_sessions"),
        api.get<{ success: boolean; data: any }>("/api/v1/xero/pdf_sync_status"),
      ]);

      if (statsResponse.success && statsResponse.data?.tenants) {
        setTenants(statsResponse.data.tenants);
        setError(null);
      } else {
        setError("Failed to load sync status");
      }

      if (pipelineResponse.success && pipelineResponse.data) {
        setPipelineData(pipelineResponse.data);
      }

      // Extract document pipeline health from PDF sync response
      if (pdfSyncResponse.success && pdfSyncResponse.data) {
        const d = pdfSyncResponse.data;
        const dq = d.stage1_data_sync?.data_quality;
        const linked = d.stage1_data_sync?.linked_to_contacts || 0;
        const stage1Completed = dq?.needs_backfill
          ? Math.max(linked - (dq.bills_missing_line_items || 0), 0)
          : linked;
        const stage1Total = d.stage1_data_sync?.total_in_database || 0;
        setDocPipeline({
          stage1_percentage: stage1Total > 0 ? Math.round((stage1Completed / stage1Total) * 100) : 0,
          stage2_percentage: d.stage2_pdf_download?.progress_percentage || d.progress_percentage || 0,
          stage3_percentage: d.stage3_sharepoint?.progress_percentage || 0,
          overall_status: d.health?.status || "not_started",
          stage1_data: { linked, total: stage1Total },
          stage2_data: {
            downloaded: d.stage2_pdf_download?.downloaded || d.pdfs_synced || 0,
            total: d.stage2_pdf_download?.total_to_sync || d.total_invoices || 0,
          },
          stage3_data: {
            uploaded: d.stage3_sharepoint?.uploaded || d.sharepoint_uploads || 0,
            total: d.stage3_sharepoint?.total_to_upload || d.pdfs_synced || 0,
          },
        });
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

  // FRC (Feb 2026): Refresh now triggers actual sync, not just refetch
  // This ensures clicking Refresh actually triggers recovery when syncs are stale
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // First trigger all sync jobs
      await api.post("/api/v1/xero/trigger_sync_all");
      // Then refetch status after a short delay to show jobs were queued
      setTimeout(() => {
        fetchData();
      }, 1000);
    } catch (err) {
      console.error("Failed to trigger sync:", err);
      // Still refetch data even if trigger fails
      fetchData();
    }
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
      <LoadingOverlay />
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
      {/* Document Sync Pipeline (3-stage: Data → PDF → Upload) */}
      {docPipeline && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Document Sync Pipeline</CardTitle>
                <CardDescription>
                  Three-stage pipeline: Xero data → PDF download → Cloud upload
                </CardDescription>
              </div>
              <Badge className={
                docPipeline.overall_status === "healthy"
                  ? "bg-status-success text-status-success-foreground"
                  : docPipeline.overall_status === "in_progress"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                  : docPipeline.overall_status === "warning"
                  ? "bg-status-warning text-status-warning-foreground"
                  : "bg-muted text-foreground"
              }>
                {docPipeline.overall_status === "healthy" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {docPipeline.overall_status === "in_progress" && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                {docPipeline.overall_status === "warning" && <AlertTriangle className="h-3 w-3 mr-1" />}
                {docPipeline.overall_status?.replace("_", " ") || "Unknown"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Stage 1: Xero Data */}
            <div className={cn(
              "flex items-center justify-between p-3 rounded-lg border",
              docPipeline.stage1_percentage >= 95
                ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
                : docPipeline.stage1_percentage >= 50
                ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
                : "border-border bg-muted/50"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded",
                  docPipeline.stage1_percentage >= 95
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300"
                    : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300"
                )}>
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium text-sm">Stage 1: Xero Data</div>
                  <div className="text-xs text-muted-foreground">
                    {docPipeline.stage1_data.linked.toLocaleString()} / {docPipeline.stage1_data.total.toLocaleString()} linked
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={docPipeline.stage1_percentage} className="w-24 h-2" />
                <span className={cn(
                  "font-semibold text-sm w-12 text-right",
                  docPipeline.stage1_percentage >= 95 && "text-green-600 dark:text-green-400"
                )}>
                  {docPipeline.stage1_percentage}%
                </span>
              </div>
            </div>

            {/* Stage 2: PDF Download */}
            <div className={cn(
              "flex items-center justify-between p-3 rounded-lg border",
              docPipeline.stage2_percentage >= 95
                ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
                : docPipeline.stage2_percentage >= 50
                ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
                : "border-border bg-muted/50"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded",
                  docPipeline.stage2_percentage >= 95
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                )}>
                  <Download className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium text-sm">Stage 2: PDF Download</div>
                  <div className="text-xs text-muted-foreground">
                    {docPipeline.stage2_data.downloaded.toLocaleString()} / {docPipeline.stage2_data.total.toLocaleString()} downloaded
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={docPipeline.stage2_percentage} className="w-24 h-2" />
                <span className={cn(
                  "font-semibold text-sm w-12 text-right",
                  docPipeline.stage2_percentage >= 95 && "text-green-600 dark:text-green-400"
                )}>
                  {docPipeline.stage2_percentage}%
                </span>
              </div>
            </div>

            {/* Stage 3: Cloud Upload */}
            <div className={cn(
              "flex items-center justify-between p-3 rounded-lg border",
              docPipeline.stage3_percentage >= 95
                ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
                : docPipeline.stage3_percentage >= 50
                ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
                : "border-border bg-muted/50"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded",
                  docPipeline.stage3_percentage >= 95
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300"
                    : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300"
                )}>
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium text-sm">Stage 3: Cloud Upload</div>
                  <div className="text-xs text-muted-foreground">
                    {docPipeline.stage3_data.uploaded.toLocaleString()} / {docPipeline.stage3_data.total.toLocaleString()} uploaded
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={docPipeline.stage3_percentage} className="w-24 h-2" />
                <span className={cn(
                  "font-semibold text-sm w-12 text-right",
                  docPipeline.stage3_percentage >= 95 && "text-green-600 dark:text-green-400"
                )}>
                  {docPipeline.stage3_percentage}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Sync Pipeline Status */}
      <ContactSyncPipelineCard data={pipelineData} />

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
