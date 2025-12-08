"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
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

interface HealthIssue {
  id: number;
  record_id: number;
  record_name: string;
  issue_type: string;
  issue_description: string;
  severity: "critical" | "warning" | "info";
  fix_url?: string;
  created_at: string;
}

interface TableHealth {
  table_name: string;
  display_name: string;
  icon: string;
  total_records: number;
  issues_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  health_score: number;
  issues: HealthIssue[];
}

interface SystemHealthData {
  overall_score: number;
  total_issues: number;
  critical_issues: number;
  warning_issues: number;
  tables: TableHealth[];
  last_checked: string;
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

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "critical":
      return <Badge variant="destructive">Critical</Badge>;
    case "warning":
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">Warning</Badge>;
    default:
      return <Badge variant="secondary">Info</Badge>;
  }
}

export default function SystemHealthPage() {
  const [healthData, setHealthData] = React.useState<SystemHealthData | null>(null);
  const [integrationsHealth, setIntegrationsHealth] = React.useState<IntegrationsHealth | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [expandedTables, setExpandedTables] = React.useState<Set<string>>(new Set());

  const fetchHealthData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.get<SystemHealthData>("/api/v1/health/system");
      setHealthData(data);
      // Auto-expand tables with critical issues
      const criticalTables = data.tables
        .filter((t) => t.critical_count > 0)
        .map((t) => t.table_name);
      setExpandedTables(new Set(criticalTables));
    } catch (error) {
      console.error("Failed to fetch health data:", error);
      // Use mock data for demo
      setHealthData(getMockHealthData());
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

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Failed to load health data</p>
        <Button onClick={() => fetchHealthData()}>Retry</Button>
      </div>
    );
  }

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
        <Card className={`md:col-span-2 ${getHealthBg(healthData.overall_score)}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`text-5xl font-bold font-mono ${getHealthColor(healthData.overall_score)}`}>
                {healthData.overall_score}%
              </div>
              <div>
                <p className="font-medium">Overall Health Score</p>
                <p className="text-sm text-muted-foreground">
                  Last checked: {new Date(healthData.last_checked).toLocaleString("en-AU")}
                </p>
              </div>
            </div>
            <Progress value={healthData.overall_score} className="mt-4 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">{healthData.critical_issues}</div>
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
                <div className="text-2xl font-bold font-mono">{healthData.warning_issues}</div>
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

      {/* Tables Health */}
      <Card>
        <CardHeader>
          <CardTitle>Data Quality by Module</CardTitle>
          <CardDescription>
            Click on a module to view and fix individual issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {healthData.tables.map((table) => (
            <Collapsible
              key={table.table_name}
              open={expandedTables.has(table.table_name)}
              onOpenChange={() => toggleTable(table.table_name)}
            >
              <CollapsibleTrigger className="flex items-center justify-between p-4 rounded-lg border hover:bg-secondary/50 cursor-pointer transition-colors w-full">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary rounded">
                      {iconMap[table.table_name] || <FileText className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium">{table.display_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {table.total_records} records
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {table.critical_count > 0 && (
                        <Badge variant="destructive">{table.critical_count} critical</Badge>
                      )}
                      {table.warning_count > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                          {table.warning_count} warnings
                        </Badge>
                      )}
                      {table.issues_count === 0 && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          All good
                        </Badge>
                      )}
                    </div>
                    <div className={`text-lg font-bold font-mono ${getHealthColor(table.health_score)}`}>
                      {table.health_score}%
                    </div>
                    {expandedTables.has(table.table_name) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {table.issues.length > 0 ? (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Record</TableHead>
                          <TableHead>Issue</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead className="w-[100px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {table.issues.map((issue) => (
                          <TableRow key={issue.id}>
                            <TableCell className="font-medium">
                              {issue.record_name}
                            </TableCell>
                            <TableCell>{issue.issue_description}</TableCell>
                            <TableCell>{getSeverityBadge(issue.severity)}</TableCell>
                            <TableCell>
                              {issue.fix_url && (
                                <Link href={issue.fix_url}>
                                  <Button variant="ghost" size="sm">
                                    Fix
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                  </Button>
                                </Link>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="mt-2 p-8 border rounded-lg text-center">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-muted-foreground">No issues found</p>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Mock data for demo/development
function getMockHealthData(): SystemHealthData {
  return {
    overall_score: 78,
    total_issues: 12,
    critical_issues: 3,
    warning_issues: 9,
    last_checked: new Date().toISOString(),
    tables: [
      {
        table_name: "jobs",
        display_name: "Jobs",
        icon: "briefcase",
        total_records: 156,
        issues_count: 5,
        critical_count: 2,
        warning_count: 3,
        info_count: 0,
        health_score: 72,
        issues: [
          {
            id: 1,
            record_id: 42,
            record_name: "Job #1042 - Smith Residence",
            issue_type: "missing_start_date",
            issue_description: "Missing scheduled start date",
            severity: "critical",
            fix_url: "/jobs/42",
            created_at: new Date().toISOString(),
          },
          {
            id: 2,
            record_id: 67,
            record_name: "Job #1067 - Commercial Fitout",
            issue_type: "missing_contract_value",
            issue_description: "Contract value not set",
            severity: "critical",
            fix_url: "/jobs/67",
            created_at: new Date().toISOString(),
          },
          {
            id: 3,
            record_id: 89,
            record_name: "Job #1089 - Office Renovation",
            issue_type: "overdue_review",
            issue_description: "Review date overdue by 14 days",
            severity: "warning",
            fix_url: "/jobs/89",
            created_at: new Date().toISOString(),
          },
        ],
      },
      {
        table_name: "companies",
        display_name: "Companies",
        icon: "building",
        total_records: 89,
        issues_count: 4,
        critical_count: 1,
        warning_count: 3,
        info_count: 0,
        health_score: 85,
        issues: [
          {
            id: 4,
            record_id: 12,
            record_name: "Acme Corporation",
            issue_type: "missing_abn",
            issue_description: "ABN not recorded",
            severity: "critical",
            fix_url: "/companies/12",
            created_at: new Date().toISOString(),
          },
          {
            id: 5,
            record_id: 34,
            record_name: "BuildRight Pty Ltd",
            issue_type: "review_due",
            issue_description: "Annual review due in 7 days",
            severity: "warning",
            fix_url: "/companies/34",
            created_at: new Date().toISOString(),
          },
        ],
      },
      {
        table_name: "contacts",
        display_name: "Contacts",
        icon: "users",
        total_records: 312,
        issues_count: 3,
        critical_count: 0,
        warning_count: 3,
        info_count: 0,
        health_score: 91,
        issues: [
          {
            id: 6,
            record_id: 156,
            record_name: "John Smith",
            issue_type: "possible_duplicate",
            issue_description: "Possible duplicate of 'Jon Smith'",
            severity: "warning",
            fix_url: "/contacts?duplicates=true",
            created_at: new Date().toISOString(),
          },
        ],
      },
      {
        table_name: "documents",
        display_name: "Company Documents",
        icon: "file",
        total_records: 1240,
        issues_count: 0,
        critical_count: 0,
        warning_count: 0,
        info_count: 0,
        health_score: 100,
        issues: [],
      },
      {
        table_name: "purchase_orders",
        display_name: "Purchase Orders",
        icon: "dollar",
        total_records: 478,
        issues_count: 0,
        critical_count: 0,
        warning_count: 0,
        info_count: 0,
        health_score: 100,
        issues: [],
      },
    ],
  };
}
