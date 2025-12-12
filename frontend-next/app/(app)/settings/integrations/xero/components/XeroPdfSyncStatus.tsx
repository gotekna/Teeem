"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Cloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Database,
  Download,
  Upload,
  ExternalLink,
  Gauge,
  Activity,
} from "lucide-react";
import { api } from "@/lib/api";

// Rate limit types
interface RateLimitUsage {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
}

interface TenantRateLimit {
  tenant_id: string;
  tenant_name: string;
  minute: RateLimitUsage | null;
  daily: RateLimitUsage | null;
  total_7d: number;
  can_make_request: boolean;
  // SSoT: Credential status from backend
  status?: 'connected' | 'degraded' | 'disconnected';
  needs_reauth?: boolean;
  expired?: boolean;
  degraded?: boolean;
}

interface RateLimitsData {
  limits: {
    minute: number;
    daily: number;
    concurrent: number;
  };
  // SSoT: Rate limit reset time
  resets_at?: string;
  resets_at_display?: string;
  tenants: TenantRateLimit[];
  aggregate: {
    minute_requests: number;
    daily_requests: number;
    total_7d_requests: number;
  };
}

interface Blocker {
  reason: string;
  detail: string;
  unlinked_count?: number;
  pending_count?: number;
  estimated_hours?: number;
  estimated_days?: number | null;
  sample_unlinked?: { xero_id: string; contact_name: string }[];
  // SSoT: Sync mode for accurate status display
  sync_mode?: 'catching_up' | 'almost_done' | 'rate_limited';
  daily_percentage?: number;
  resets_at?: string;
  resets_at_display?: string;
}

interface Stage1DataSync {
  total_in_database: number;
  linked_to_contacts: number;
  unlinked_count: number;
  last_synced_at?: string | null;  // SSoT: Preferred field name
  last_sync_at?: string | null;    // Deprecated: Kept for backwards compatibility
  next_sync_at: string | null;
  schedule: string;
  breakdown: {
    bills: number;
    sales_invoices: number;
    credit_notes: number;
    quotes: number;
  };
  blocker: Blocker | null;
}

interface Stage2PdfDownload {
  total_to_sync: number;
  downloaded: number;
  pending: number;
  progress_percentage: number;
  last_synced_at?: string | null;  // SSoT: Preferred field name
  last_sync_at?: string | null;    // Deprecated: Kept for backwards compatibility
  next_sync_at: string | null;
  schedule: string;
  synced_last_24h: number;
  breakdown: {
    bills: { total: number; synced: number };
    sales_invoices: { total: number; synced: number };
    credit_notes: { total: number; synced: number };
    quotes: { total: number; synced: number };
  };
  blocker: Blocker | null;
}

interface SsotViolation {
  type: string;
  count: number;
  severity: "info" | "warning" | "error";
  description: string;
  action_required: string | null;
}

interface Stage3Sharepoint {
  total_to_upload: number;
  uploaded: number;
  pending: number;
  progress_percentage: number;
  blocker: Blocker | null;
  sharepoint_url: string | null;
  last_synced_at?: string | null;  // SSoT: When last SharePoint upload occurred
  violations?: SsotViolation[];  // SSoT: Data quality issues detected
}

interface PdfSyncStatus {
  stage1_data_sync: Stage1DataSync;
  stage2_pdf_download: Stage2PdfDownload;
  stage3_sharepoint: Stage3Sharepoint;
  total_invoices: number;
  pdfs_synced: number;
  pending: number;
  progress_percentage: number;
  sharepoint_uploads: number;
  synced_last_24h: number;
  last_synced_at?: string | null;  // SSoT: Preferred field name
  last_sync_at?: string | null;    // Deprecated: Kept for backwards compatibility
  breakdown: {
    bills: { total: number; synced: number };
    sales_invoices: { total: number; synced: number };
    credit_notes: { total: number; synced: number };
    quotes: { total: number; synced: number };
  };
  estimated_remaining_minutes: number;
  health: {
    status: "healthy" | "in_progress" | "warning" | "not_started" | "partial";
    message: string;
    color: string;
  };
}

export function XeroPdfSyncStatus({ tenantId }: { tenantId?: string }) {
  const [data, setData] = React.useState<PdfSyncStatus | null>(null);
  const [rateLimits, setRateLimits] = React.useState<RateLimitsData | null>(null);
  const [health, setHealth] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rateLimitsLoading, setRateLimitsLoading] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    try {
      const url = tenantId
        ? `/api/v1/xero/pdf_sync_status?tenant_id=${tenantId}`
        : "/api/v1/xero/pdf_sync_status";
      const [statusResponse, healthResponse] = await Promise.all([
        api.get<{ success: boolean; data: PdfSyncStatus }>(url),
        api.get<{ success: boolean; data: any }>("/api/v1/xero/sync_health")
      ]);

      if (statusResponse.success) {
        setData(statusResponse.data);
        setError(null);
      } else {
        setError("Failed to load PDF sync status");
      }

      if (healthResponse.success) {
        setHealth(healthResponse.data);
      }
    } catch (err) {
      console.error("Failed to fetch PDF sync status:", err);
      setError("Failed to load PDF sync status");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const fetchRateLimits = React.useCallback(async () => {
    setRateLimitsLoading(true);
    try {
      const response = await api.get<{ success: boolean; rate_limits: RateLimitsData }>("/api/v1/xero/rate_limits");
      if (response.success) {
        setRateLimits(response.rate_limits);
      }
    } catch (err) {
      console.error("Failed to fetch rate limits:", err);
    } finally {
      setRateLimitsLoading(false);
    }
  }, []);

  // Check if any tenant is approaching rate limits (>= 95%)
  const isApproachingLimit = React.useMemo(() => {
    if (!rateLimits) return false;
    return rateLimits.tenants.some(
      (t) => (t.minute?.percentage || 0) >= 95 || (t.daily?.percentage || 0) >= 95
    );
  }, [rateLimits]);

  const isAtLimit = React.useMemo(() => {
    if (!rateLimits) return false;
    return rateLimits.tenants.some((t) => !t.can_make_request);
  }, [rateLimits]);

  React.useEffect(() => {
    fetchStatus();
    fetchRateLimits();
    // Auto-refresh every 5 seconds to show live syncing activity
    const refreshInterval = setInterval(() => {
      fetchStatus();
      fetchRateLimits();
    }, 5000);
    return () => {
      clearInterval(refreshInterval);
    };
  }, [fetchStatus, fetchRateLimits]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error || "Unable to load PDF sync status"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getHealthBadge = () => {
    switch (data.health.status) {
      case "healthy":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Up to Date
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Recently Active
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            <Clock className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Stale
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Not Started
          </Badge>
        );
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `~${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `~${hours}h ${mins}m`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format time for next sync display (Brisbane time)
  // If next_sync_at is in the past, we need to calculate when the NEXT scheduled run should be
  const formatNextSync = (dateString: string | null, schedule?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    // If the scheduled time is in the past, calculate when the next one should be
    if (diffMins < -5) {
      // More than 5 minutes overdue - show as overdue
      const overdueMinutes = Math.abs(diffMins);
      if (overdueMinutes < 60) {
        return `overdue ${overdueMinutes}m`;
      } else {
        const hours = Math.floor(overdueMinutes / 60);
        return `overdue ${hours}h`;
      }
    }

    if (diffMins <= 0) return "Starting soon";
    if (diffMins < 60) return `in ${diffMins} min`;

    // Show time in Brisbane format
    return date.toLocaleString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Australia/Brisbane",
    }) + " AEST";
  };

  // Stage progress component
  const StageProgress = ({
    stage,
    title,
    icon: Icon,
    completed,
    total,
    percentage,
    lastSync,
    nextSync,
    schedule,
    color,
    blocker,
  }: {
    stage: number;
    title: string;
    icon: React.ElementType;
    completed: number;
    total: number;
    percentage: number;
    lastSync: string | null;
    nextSync?: string | null;
    schedule?: string;
    color: string;
    blocker?: Blocker | null;
  }) => (
    <div className="p-3 border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${color}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Stage {stage}</div>
            <div className="text-sm font-medium">{title}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">{percentage}%</div>
          <div className="text-xs text-muted-foreground">
            {completed.toLocaleString()} / {total.toLocaleString()}
          </div>
        </div>
      </div>
      <Progress value={percentage} className="h-1.5" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Last: {formatDate(lastSync)}</span>
        {nextSync && (
          <span className={`font-medium ${
            formatNextSync(nextSync)?.startsWith("overdue")
              ? "text-red-600"
              : "text-blue-600"
          }`}>
            Next: {formatNextSync(nextSync)}
          </span>
        )}
      </div>
      {schedule && (
        <div className="text-xs text-muted-foreground/70 italic">
          {schedule}
        </div>
      )}
      {blocker && (
        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-amber-800">{blocker.reason}</div>
              {blocker.estimated_days && blocker.estimated_days > 1 && (
                <div className="text-amber-700 mt-0.5">
                  ~{blocker.estimated_days} days to complete
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Xero Document Sync</CardTitle>
              <CardDescription>
                Invoice data, PDFs, and SharePoint uploads
              </CardDescription>
            </div>
          </div>
          {getHealthBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 3-Stage Progress */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Stage 1: Xero Data Sync (Bills, Invoices, Quotes) */}
          <StageProgress
            stage={1}
            title="Xero Data"
            icon={Database}
            completed={data.stage1_data_sync?.linked_to_contacts || 0}
            total={data.stage1_data_sync?.total_in_database || 0}
            percentage={
              data.stage1_data_sync?.total_in_database
                ? Math.round(
                    (data.stage1_data_sync.linked_to_contacts /
                      data.stage1_data_sync.total_in_database) *
                      100
                  )
                : 0
            }
            lastSync={data.stage1_data_sync?.last_synced_at || data.stage1_data_sync?.last_sync_at || null}
            nextSync={data.stage1_data_sync?.next_sync_at}
            schedule={data.stage1_data_sync?.schedule}
            color="bg-purple-100 text-purple-600"
            blocker={data.stage1_data_sync?.blocker}
          />

          {/* Stage 2: PDF Download */}
          <StageProgress
            stage={2}
            title="PDF Download"
            icon={Download}
            completed={data.stage2_pdf_download?.downloaded || data.pdfs_synced}
            total={data.stage2_pdf_download?.total_to_sync || data.total_invoices}
            percentage={data.stage2_pdf_download?.progress_percentage || data.progress_percentage}
            lastSync={data.stage2_pdf_download?.last_synced_at || data.stage2_pdf_download?.last_sync_at || data.last_synced_at || data.last_sync_at || null}
            nextSync={data.stage2_pdf_download?.next_sync_at}
            schedule={data.stage2_pdf_download?.schedule}
            color="bg-blue-100 text-blue-600"
            blocker={data.stage2_pdf_download?.blocker}
          />

          {/* Stage 3: SharePoint Upload */}
          <div className="space-y-2">
            {data.stage3_sharepoint?.sharepoint_url && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.open(data.stage3_sharepoint?.sharepoint_url!, '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                Open SharePoint
              </Button>
            )}
            <StageProgress
              stage={3}
              title="SharePoint"
              icon={Upload}
              completed={data.stage3_sharepoint?.uploaded || data.sharepoint_uploads}
              total={data.stage3_sharepoint?.total_to_upload || data.pdfs_synced}
              percentage={data.stage3_sharepoint?.progress_percentage || 0}
              lastSync={data.stage3_sharepoint?.last_synced_at || null}
              schedule="Uploads with PDF sync"
              color="bg-green-100 text-green-600"
              blocker={data.stage3_sharepoint?.blocker}
            />
            {/* SSoT Violations Display */}
            {data.stage3_sharepoint?.violations && data.stage3_sharepoint.violations.length > 0 && (
              <div className="p-2 border rounded-lg space-y-1">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Data Quality ({data.stage3_sharepoint.violations.length})
                </div>
                {data.stage3_sharepoint.violations.map((violation, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded text-xs ${
                      violation.severity === "error"
                        ? "bg-red-50 border border-red-200"
                        : violation.severity === "warning"
                        ? "bg-amber-50 border border-amber-200"
                        : "bg-blue-50 border border-blue-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div
                          className={`font-medium ${
                            violation.severity === "error"
                              ? "text-red-800"
                              : violation.severity === "warning"
                              ? "text-amber-800"
                              : "text-blue-800"
                          }`}
                        >
                          {violation.count.toLocaleString()} {violation.description}
                        </div>
                        {violation.action_required && (
                          <div className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                            {violation.action_required}
                          </div>
                        )}
                      </div>
                      <Badge
                        className={`text-[10px] ${
                          violation.severity === "error"
                            ? "bg-red-100 text-red-700"
                            : violation.severity === "warning"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {violation.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Database className="h-3 w-3" />
              Total Invoices
            </div>
            <div className="text-lg font-semibold">
              {data.stage1_data_sync?.total_in_database?.toLocaleString() || data.total_invoices.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <FileText className="h-3 w-3" />
              PDFs Downloaded
            </div>
            <div className="text-lg font-semibold text-blue-600">
              {data.pdfs_synced.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Cloud className="h-3 w-3" />
              On SharePoint
            </div>
            <div className="text-lg font-semibold text-green-600">
              {data.sharepoint_uploads.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              Pending
            </div>
            <div className="text-lg font-semibold text-amber-600">
              {data.pending.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Breakdown by Type */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">PDF Progress by Type</div>
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2 border rounded-lg">
              <div className="text-xs text-muted-foreground">Bills</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold">{data.breakdown.bills.synced}</span>
                <span className="text-xs text-muted-foreground">/ {data.breakdown.bills.total}</span>
              </div>
              <Progress
                value={data.breakdown.bills.total > 0 ? (data.breakdown.bills.synced / data.breakdown.bills.total) * 100 : 0}
                className="h-1 mt-1"
              />
            </div>
            <div className="p-2 border rounded-lg">
              <div className="text-xs text-muted-foreground">Invoices</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold">{data.breakdown.sales_invoices.synced}</span>
                <span className="text-xs text-muted-foreground">/ {data.breakdown.sales_invoices.total}</span>
              </div>
              <Progress
                value={data.breakdown.sales_invoices.total > 0 ? (data.breakdown.sales_invoices.synced / data.breakdown.sales_invoices.total) * 100 : 0}
                className="h-1 mt-1"
              />
            </div>
            <div className="p-2 border rounded-lg">
              <div className="text-xs text-muted-foreground">Credit Notes</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold">{data.breakdown.credit_notes?.synced || 0}</span>
                <span className="text-xs text-muted-foreground">/ {data.breakdown.credit_notes?.total || 0}</span>
              </div>
              <Progress
                value={(data.breakdown.credit_notes?.total || 0) > 0 ? ((data.breakdown.credit_notes?.synced || 0) / (data.breakdown.credit_notes?.total || 1)) * 100 : 0}
                className="h-1 mt-1"
              />
            </div>
            <div className="p-2 border rounded-lg">
              <div className="text-xs text-muted-foreground">Quotes</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold">{data.breakdown.quotes.synced}</span>
                <span className="text-xs text-muted-foreground">/ {data.breakdown.quotes.total}</span>
              </div>
              <Progress
                value={data.breakdown.quotes.total > 0 ? (data.breakdown.quotes.synced / data.breakdown.quotes.total) * 100 : 0}
                className="h-1 mt-1"
              />
            </div>
          </div>
        </div>

        {/* Live API Activity - Prominent Section */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Activity className="h-5 w-5 text-blue-600" />
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-green-500 rounded-full animate-pulse" />
              </div>
              <span className="font-semibold text-blue-900">Smart Rate-Limited Sync</span>
              <Badge className="bg-blue-100 text-blue-700 text-xs">
                Live • 5s refresh
              </Badge>
            </div>
            {rateLimits && (
              <div className="text-sm text-blue-700">
                <span className="font-semibold">{rateLimits.aggregate.daily_requests}</span>
                <span className="text-blue-500"> / {rateLimits.limits.daily} API calls today</span>
              </div>
            )}
          </div>

          {/* Sync Mode Indicator */}
          {data.pending > 0 && (
            <div className="mb-3 p-3 bg-white/80 border border-blue-100 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* SSoT: Use sync_mode from backend blocker if available */}
                  {data.stage2_pdf_download?.blocker?.sync_mode === 'rate_limited' ? (
                    <>
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="font-medium text-amber-900">Rate Limited</span>
                      <Badge className="bg-amber-100 text-amber-700 text-xs">
                        {data.stage2_pdf_download?.blocker?.daily_percentage?.toFixed(0)}% daily used
                      </Badge>
                    </>
                  ) : data.pending > 100 ? (
                    <>
                      <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                      <span className="font-medium text-blue-900">Catching Up Mode</span>
                      <Badge className="bg-blue-500 text-white text-xs">
                        Max speed
                      </Badge>
                    </>
                  ) : data.pending > 0 ? (
                    <>
                      <RefreshCw className="h-4 w-4 text-green-600 animate-spin" />
                      <span className="font-medium text-green-900">Almost Caught Up</span>
                      <Badge className="bg-green-500 text-white text-xs">
                        Slowing down
                      </Badge>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-900">Near-Live</span>
                      <Badge className="bg-green-100 text-green-700 text-xs">
                        30min checks
                      </Badge>
                    </>
                  )}
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold text-blue-900">{data.pending.toLocaleString()} pending</div>
                  <div className="text-xs text-muted-foreground">
                    {data.stage2_pdf_download?.blocker?.sync_mode === 'rate_limited'
                      ? `Resets at ${data.stage2_pdf_download?.blocker?.resets_at_display || 'midnight'}`
                      : data.pending > 100
                        ? "Batch every 1 min"
                        : data.pending > 0
                          ? "Batch every 10 min"
                          : "Checking every 30 min"}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <Gauge className="h-3 w-3 inline mr-1" />
                Auto-scaling: Uses up to 50 API calls/min, 4500/day while staying under Xero limits
              </div>
            </div>
          )}

          {/* Rate Limit Warning Banners */}
          {isAtLimit && (
            <div className="p-2 mb-3 bg-red-100 border border-red-300 rounded text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-800">
                  Rate limit reached - syncing paused until reset
                </span>
              </div>
            </div>
          )}
          {!isAtLimit && isApproachingLimit && (
            <div className="p-2 mb-3 bg-amber-100 border border-amber-300 rounded text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-800">
                  Approaching 95% rate limit - sync slowing down
                </span>
              </div>
            </div>
          )}

          {/* Per-Tenant Rate Limits */}
          {rateLimits && rateLimits.tenants.length > 0 ? (
            <div className="space-y-2">
              {rateLimits.tenants.map((tenant) => (
                <div key={tenant.tenant_id} className="p-3 bg-white/80 border border-blue-100 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{tenant.tenant_name}</span>
                    <div className="flex items-center gap-2">
                      {/* SSoT: Show credential status FIRST (priority over rate limits) */}
                      {tenant.needs_reauth || tenant.status === 'degraded' || tenant.status === 'disconnected' ? (
                        <>
                          <Badge className="bg-orange-100 text-orange-700 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Needs Re-auth
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                            onClick={async () => {
                              try {
                                const response = await api.xero.getAuthUrl();
                                const authUrl = response.auth_url || response.url;
                                if (authUrl) {
                                  window.location.href = authUrl;
                                }
                              } catch (error) {
                                console.error("Failed to get Xero auth URL:", error);
                              }
                            }}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Reconnect
                          </Button>
                        </>
                      ) : !tenant.can_make_request ? (
                        <Badge className="bg-red-100 text-red-700 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Throttled
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Per-minute */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">This minute</span>
                        <span className="font-mono font-medium">
                          {tenant.minute?.used || 0}/{rateLimits.limits.minute}
                        </span>
                      </div>
                      <Progress
                        value={tenant.minute?.percentage || 0}
                        className={`h-2 ${(tenant.minute?.percentage || 0) > 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-blue-500'} ${(tenant.minute?.percentage || 0) > 95 ? '[&>div]:bg-red-500' : ''}`}
                      />
                    </div>
                    {/* Daily - SSoT: Xero resets at midnight UTC (10 AM Brisbane) */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground" title="Resets at 10:00 AM Brisbane (midnight UTC)">Today</span>
                        <span className="font-mono font-medium">
                          {tenant.daily?.used || 0}/{rateLimits.limits.daily}
                        </span>
                      </div>
                      <Progress
                        value={tenant.daily?.percentage || 0}
                        className={`h-2 ${(tenant.daily?.percentage || 0) > 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-purple-500'} ${(tenant.daily?.percentage || 0) > 95 ? '[&>div]:bg-red-500' : ''}`}
                      />
                    </div>
                  </div>
                  {/* Bottom row: 7-day total on left, reset time on right */}
                  {(tenant.total_7d > 0 || (tenant.daily?.used || 0) > 0) && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                      <span>
                        {tenant.total_7d > 0 ? `${tenant.total_7d.toLocaleString()} total requests (7 days)` : ''}
                      </span>
                      {(tenant.daily?.used || 0) > 0 && rateLimits.resets_at_display && (
                        <span>Resets at {rateLimits.resets_at_display}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <Gauge className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No Xero tenants connected
            </div>
          )}
        </div>

        {/* Time Estimate & Activity */}
        <div className="flex items-center justify-between text-sm border-t pt-3">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>
              <RefreshCw className="h-3 w-3 inline mr-1" />
              {data.synced_last_24h} synced in 24h
            </span>
            {data.pending > 0 && (
              <span>
                <Clock className="h-3 w-3 inline mr-1" />
                {formatTime(data.estimated_remaining_minutes)} remaining
              </span>
            )}
          </div>
          {(data.last_synced_at || data.last_sync_at) && (
            <span className="text-muted-foreground">
              Last: {formatDate(data.last_synced_at || data.last_sync_at || null)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
