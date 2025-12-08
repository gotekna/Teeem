"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Loader2,
  Briefcase,
  Building2,
  FileText,
  Users,
  DollarSign,
  AlertCircle,
  Layers,
  Cloud,
  HardDrive,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";

// API response from /api/v1/system/health (SSoT for system health)
interface SystemHealthApiResponse {
  success: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  overall_health: number;
  infrastructure: Record<string, { status: string; message?: string }>;
  data_health: {
    overall_health: number;
    status: string;
    summary: {
      total_checks: number;
      passed_checks: number;
      failed_checks: number;
      total_issues: number;
      critical_issues: number;
      warning_issues: number;
    };
    checks: Array<{
      foundation_id: number;
      foundation_name: string;
      route_slug: string | null;
      health_score: number;
      total_issues: number;
      critical_issues: number;
      warning_issues: number;
      checks_count: number;
    }>;
  };
  stats: {
    jobs_count: number;
    contacts_count: number;
    pricebook_items_count: number;
    companies_count: number;
    pending_jobs: number;
    failed_jobs: number;
  };
}

interface XeroSyncHealth {
  connected: boolean;
  organisation_name?: string;
  contacts: {
    synced: number;
    total: number;
    percentage: number;
    last_synced_at?: string;
  };
  invoices: {
    synced: number;
    total: number;
    percentage: number;
    last_synced_at?: string;
  };
  pdf_pipeline: {
    stage1_percentage: number;
    stage2_percentage: number;
    stage3_percentage: number;
  };
}

interface IntegrationsHealth {
  xero?: XeroSyncHealth;
  microsoft?: {
    connected: boolean;
    sharepoint_enabled: boolean;
  };
}

const iconMap: Record<string, React.ReactNode> = {
  jobs: <Briefcase className="h-5 w-5" />,
  companies: <Building2 className="h-5 w-5" />,
  documents: <FileText className="h-5 w-5" />,
  contacts: <Users className="h-5 w-5" />,
  purchase_orders: <DollarSign className="h-5 w-5" />,
};

function getHealthColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  return "text-red-600";
}

function getHealthBg(score: number): string {
  if (score >= 90) return "bg-green-100 dark:bg-green-900/20";
  if (score >= 70) return "bg-yellow-100 dark:bg-yellow-900/20";
  return "bg-red-100 dark:bg-red-900/20";
}

export default function SystemHealthPage() {
  const [systemHealth, setSystemHealth] = React.useState<SystemHealthApiResponse | null>(null);
  const [integrationsHealth, setIntegrationsHealth] = React.useState<IntegrationsHealth | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchHealthData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.get<SystemHealthApiResponse>("/api/v1/system/health");
      setSystemHealth(data);
    } catch (error) {
      console.error("Failed to fetch health data:", error);
      setSystemHealth(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchIntegrationsHealth = React.useCallback(async () => {
    try {
      // Fetch Xero status
      const xeroStatus = await api.get<{
        connected: boolean;
        organisation_name?: string;
      }>("/api/v1/xero/status");

      let xeroHealth: XeroSyncHealth | undefined;

      if (xeroStatus.connected) {
        // Fetch PDF sync health
        const pdfHealth = await api.get<{
          stage1_percentage: number;
          stage2_percentage: number;
          stage3_percentage: number;
          stage1_data: { linked: number; total: number };
          stage2_data: { downloaded: number; total: number };
          stage3_data: { uploaded: number; total: number };
        }>("/api/v1/xero/pdf_sync_status");

        // Fetch sync status for contacts/invoices
        const syncStatus = await api.get<{
          invoices?: { last_synced_at?: string; records_synced?: number };
          contacts?: { last_synced_at?: string; records_synced?: number };
        }>("/api/v1/xero/sync_health");

        xeroHealth = {
          connected: true,
          organisation_name: xeroStatus.organisation_name,
          contacts: {
            synced: syncStatus.contacts?.records_synced || 0,
            total: syncStatus.contacts?.records_synced || 0,
            percentage: 100,
            last_synced_at: syncStatus.contacts?.last_synced_at,
          },
          invoices: {
            synced: syncStatus.invoices?.records_synced || 0,
            total: syncStatus.invoices?.records_synced || 0,
            percentage: 100,
            last_synced_at: syncStatus.invoices?.last_synced_at,
          },
          pdf_pipeline: {
            stage1_percentage: pdfHealth.stage1_percentage || 0,
            stage2_percentage: pdfHealth.stage2_percentage || 0,
            stage3_percentage: pdfHealth.stage3_percentage || 0,
          },
        };
      } else {
        xeroHealth = {
          connected: false,
          contacts: { synced: 0, total: 0, percentage: 0 },
          invoices: { synced: 0, total: 0, percentage: 0 },
          pdf_pipeline: { stage1_percentage: 0, stage2_percentage: 0, stage3_percentage: 0 },
        };
      }

      setIntegrationsHealth({ xero: xeroHealth });
    } catch (error) {
      console.error("Failed to fetch integrations health:", error);
      // Set default disconnected state
      setIntegrationsHealth({
        xero: {
          connected: false,
          contacts: { synced: 0, total: 0, percentage: 0 },
          invoices: { synced: 0, total: 0, percentage: 0 },
          pdf_pipeline: { stage1_percentage: 0, stage2_percentage: 0, stage3_percentage: 0 },
        },
      });
    }
  }, []);

  React.useEffect(() => {
    fetchHealthData();
    fetchIntegrationsHealth();
  }, [fetchHealthData, fetchIntegrationsHealth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!systemHealth) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Failed to load health data</p>
        <Button onClick={() => fetchHealthData()}>Retry</Button>
      </div>
    );
  }

  const dataHealth = systemHealth.data_health;
  const overallScore = dataHealth?.overall_health ?? 0;
  const criticalIssues = dataHealth?.summary?.critical_issues ?? 0;
  const warningIssues = dataHealth?.summary?.warning_issues ?? 0;
  const totalIssues = dataHealth?.summary?.total_issues ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">System Health</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor data quality and identify issues across the system
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            fetchHealthData(true);
            fetchIntegrationsHealth();
          }}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Health Score */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={`md:col-span-2 ${getHealthBg(overallScore)}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`text-5xl font-bold font-mono ${getHealthColor(overallScore)}`}>
                {overallScore}%
              </div>
              <div>
                <p className="font-medium">Data Health Score</p>
                <p className="text-sm text-muted-foreground">
                  {dataHealth?.summary?.total_checks ?? 0} health checks • {totalIssues} issues
                </p>
              </div>
            </div>
            <Progress value={overallScore} className="mt-4 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">{criticalIssues}</div>
                <p className="text-sm text-muted-foreground">Critical Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">{warningIssues}</div>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integrations Health */}
      {integrationsHealth && (
        <Card>
          <CardHeader>
            <CardTitle>Integrations Health</CardTitle>
            <CardDescription>
              Monitor sync status for connected services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Xero Integration */}
              <Link href="/settings/integrations/xero">
                <div className={cn(
                  "p-4 rounded-lg border hover:bg-secondary/50 cursor-pointer transition-colors",
                  integrationsHealth.xero?.connected ? "border-green-200 dark:border-green-800" : "border-gray-200 dark:border-gray-700"
                )}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn(
                      "p-2 rounded",
                      integrationsHealth.xero?.connected
                        ? "bg-green-100 dark:bg-green-900/20"
                        : "bg-gray-100 dark:bg-gray-800"
                    )}>
                      <Layers className={cn(
                        "h-5 w-5",
                        integrationsHealth.xero?.connected ? "text-green-600" : "text-gray-400"
                      )} />
                    </div>
                    <div>
                      <p className="font-medium">Xero</p>
                      <p className="text-xs text-muted-foreground">
                        {integrationsHealth.xero?.connected
                          ? integrationsHealth.xero.organisation_name || "Connected"
                          : "Not connected"}
                      </p>
                    </div>
                  </div>

                  {integrationsHealth.xero?.connected && (
                    <div className="space-y-2">
                      {/* Contacts Sync */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Contacts</span>
                        </div>
                        <span className={cn(
                          "font-mono font-medium",
                          integrationsHealth.xero.contacts.percentage >= 90 ? "text-green-600" :
                          integrationsHealth.xero.contacts.percentage >= 50 ? "text-yellow-600" : "text-gray-400"
                        )}>
                          {integrationsHealth.xero.contacts.synced > 0 ? "100%" : "-"}
                        </span>
                      </div>

                      {/* Invoice Sync */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Invoices</span>
                        </div>
                        <span className={cn(
                          "font-mono font-medium",
                          integrationsHealth.xero.invoices.percentage >= 90 ? "text-green-600" :
                          integrationsHealth.xero.invoices.percentage >= 50 ? "text-yellow-600" : "text-gray-400"
                        )}>
                          {integrationsHealth.xero.invoices.synced > 0 ? "100%" : "-"}
                        </span>
                      </div>

                      {/* PDF Pipeline */}
                      <div className="pt-2 border-t border-border mt-2">
                        <p className="text-xs text-muted-foreground mb-2">Document Pipeline</p>
                        <div className="flex items-center gap-1">
                          <div className="flex-1 flex items-center gap-1">
                            <Cloud className="h-3 w-3 text-muted-foreground" />
                            <Progress
                              value={integrationsHealth.xero.pdf_pipeline.stage1_percentage}
                              className="h-1.5 flex-1"
                            />
                            <span className="text-[10px] font-mono w-8 text-right">
                              {integrationsHealth.xero.pdf_pipeline.stage1_percentage}%
                            </span>
                          </div>
                          <div className="flex-1 flex items-center gap-1">
                            <HardDrive className="h-3 w-3 text-muted-foreground" />
                            <Progress
                              value={integrationsHealth.xero.pdf_pipeline.stage2_percentage}
                              className="h-1.5 flex-1"
                            />
                            <span className="text-[10px] font-mono w-8 text-right">
                              {integrationsHealth.xero.pdf_pipeline.stage2_percentage}%
                            </span>
                          </div>
                          <div className="flex-1 flex items-center gap-1">
                            <Upload className="h-3 w-3 text-muted-foreground" />
                            <Progress
                              value={integrationsHealth.xero.pdf_pipeline.stage3_percentage}
                              className="h-1.5 flex-1"
                            />
                            <span className="text-[10px] font-mono w-8 text-right">
                              {integrationsHealth.xero.pdf_pipeline.stage3_percentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!integrationsHealth.xero?.connected && (
                    <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Click to connect
                    </div>
                  )}
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Quality by Module - SSoT from backend health checks */}
      {dataHealth?.checks && dataHealth.checks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data Quality by Module</CardTitle>
            <CardDescription>
              Click on a module to view detailed health checks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dataHealth.checks.filter(check => check.foundation_name).map((check) => {
                // Use route_slug from backend, or derive from foundation_name as fallback
                const href = check.route_slug ? `/${check.route_slug}` : null;

                return (
                  <Link key={check.foundation_id} href={href}>
                    <div className={cn(
                      "p-4 rounded-lg border hover:bg-secondary/50 cursor-pointer transition-colors",
                      check.health_score >= 90 ? "border-green-200 dark:border-green-800" :
                      check.health_score >= 70 ? "border-yellow-200 dark:border-yellow-800" :
                      "border-red-200 dark:border-red-800"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded",
                            check.health_score >= 90 ? "bg-green-100 dark:bg-green-900/20" :
                            check.health_score >= 70 ? "bg-yellow-100 dark:bg-yellow-900/20" :
                            "bg-red-100 dark:bg-red-900/20"
                          )}>
                            {iconMap[(check.foundation_name || '').toLowerCase()] || <FileText className="h-4 w-4" />}
                          </div>
                          <span className="font-medium">{check.foundation_name}</span>
                        </div>
                        <span className={cn(
                          "text-lg font-bold font-mono",
                          getHealthColor(check.health_score)
                        )}>
                          {check.health_score}%
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{check.checks_count} checks</span>
                        {check.total_issues > 0 && (
                          <>
                            <span>•</span>
                            <span className={cn(
                              check.critical_issues > 0 ? "text-red-600" : "text-yellow-600"
                            )}>
                              {check.total_issues} issues
                            </span>
                          </>
                        )}
                        {check.total_issues === 0 && (
                          <>
                            <span>•</span>
                            <span className="text-green-600 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              All passed
                            </span>
                          </>
                        )}
                      </div>

                      <Progress
                        value={check.health_score}
                        className="h-1.5 mt-2"
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Stats */}
      {systemHealth.stats && (
        <Card>
          <CardHeader>
            <CardTitle>System Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-secondary/50 rounded-lg">
                <div className="text-2xl font-bold font-mono">{systemHealth.stats.jobs_count}</div>
                <div className="text-xs text-muted-foreground">Jobs</div>
              </div>
              <div className="text-center p-3 bg-secondary/50 rounded-lg">
                <div className="text-2xl font-bold font-mono">{systemHealth.stats.contacts_count}</div>
                <div className="text-xs text-muted-foreground">Contacts</div>
              </div>
              <div className="text-center p-3 bg-secondary/50 rounded-lg">
                <div className="text-2xl font-bold font-mono">{systemHealth.stats.companies_count}</div>
                <div className="text-xs text-muted-foreground">Companies</div>
              </div>
              <div className="text-center p-3 bg-secondary/50 rounded-lg">
                <div className="text-2xl font-bold font-mono">{systemHealth.stats.pricebook_items_count}</div>
                <div className="text-xs text-muted-foreground">Pricebook Items</div>
              </div>
              <div className="text-center p-3 bg-secondary/50 rounded-lg">
                <div className="text-2xl font-bold font-mono">{systemHealth.stats.pending_jobs}</div>
                <div className="text-xs text-muted-foreground">Pending Jobs</div>
              </div>
              <div className="text-center p-3 bg-secondary/50 rounded-lg">
                <div className="text-2xl font-bold font-mono">{systemHealth.stats.failed_jobs}</div>
                <div className="text-xs text-muted-foreground">Failed Jobs</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
