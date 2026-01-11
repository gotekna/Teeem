"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  FileText,
  Cloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Database,
  Download,
  Upload,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";

/**
 * XeroCompanyDocSyncCard - Shows Xero document sync status for a specific company
 *
 * This is a company-specific version of XeroPdfSyncStatus that:
 * 1. Loads the company's Xero tenant_id from the company xero status endpoint
 * 2. Fetches PDF sync status filtered by that tenant_id
 * 3. Displays a simplified 3-stage progress view
 */

interface PdfSyncStatus {
  stage1_data_sync: {
    total_in_database: number;
    linked_to_contacts: number;
    last_synced_at?: string | null;
    schedule: string;
  };
  stage2_pdf_download: {
    total_to_sync: number;
    downloaded: number;
    progress_percentage: number;
    last_synced_at?: string | null;
    schedule: string;
  };
  stage3_sharepoint: {
    total_to_upload: number;
    uploaded: number;
    progress_percentage: number;
    sharepoint_url: string | null;
    last_synced_at?: string | null;
  };
  total_invoices: number;
  pdfs_synced: number;
  pending: number;
  sharepoint_uploads: number;
  breakdown: {
    bills: { total: number; synced: number };
    sales_invoices: { total: number; synced: number };
    credit_notes: { total: number; synced: number };
    quotes: { total: number; synced: number };
  };
  health: {
    status: "healthy" | "in_progress" | "warning" | "not_started" | "partial";
    message: string;
  };
}

interface XeroCompanyDocSyncCardProps {
  companyId: string;
}

export function XeroCompanyDocSyncCard({ companyId }: XeroCompanyDocSyncCardProps) {
  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [data, setData] = React.useState<PdfSyncStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // First, load the company's Xero status to get the tenant_id
  React.useEffect(() => {
    const loadTenantId = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          connected: boolean;
          xero_tenant_id?: string;
        }>(`/api/v1/companies/${companyId}/xero/status`);

        if (response.connected && response.xero_tenant_id) {
          setTenantId(response.xero_tenant_id);
        } else {
          setError("Company not connected to Xero");
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load company Xero status:", err);
        setError("Failed to load Xero status");
        setLoading(false);
      }
    };
    loadTenantId();
  }, [companyId]);

  // Once we have tenant_id, load the PDF sync status
  React.useEffect(() => {
    if (!tenantId) return;

    const fetchStatus = async () => {
      try {
        const response = await api.get<{ success: boolean; data: PdfSyncStatus }>(
          `/api/v1/xero/pdf_sync_status?tenant_id=${tenantId}`
        );

        if (response.success) {
          setData(response.data);
          setError(null);
        } else {
          setError("Failed to load sync status");
        }
      } catch (err) {
        console.error("Failed to fetch PDF sync status:", err);
        setError("Failed to load sync status");
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    // Auto-refresh every 10 seconds
    const refreshInterval = setInterval(fetchStatus, 10000);
    return () => clearInterval(refreshInterval);
  }, [tenantId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner size={24} className="text-muted-foreground" />
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
            <p>{error || "Unable to load document sync status"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getHealthBadge = () => {
    switch (data.health.status) {
      case "healthy":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Up to Date
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Syncing
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300">
            <Clock className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300">
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

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
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
    schedule,
    color,
  }: {
    stage: number;
    title: string;
    icon: React.ElementType;
    completed: number;
    total: number;
    percentage: number;
    lastSync: string | null | undefined;
    schedule?: string;
    color: string;
  }) => (
    <div className="p-3 border rounded-lg space-y-2 dark:border-border">
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
      </div>
      {schedule && (
        <div className="text-xs text-muted-foreground/70 italic">
          {schedule}
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
          {/* Stage 1: Xero Data Sync */}
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
            lastSync={data.stage1_data_sync?.last_synced_at}
            schedule={data.stage1_data_sync?.schedule}
            color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          />

          {/* Stage 2: PDF Download */}
          <StageProgress
            stage={2}
            title="PDF Download"
            icon={Download}
            completed={data.stage2_pdf_download?.downloaded || data.pdfs_synced}
            total={data.stage2_pdf_download?.total_to_sync || data.total_invoices}
            percentage={data.stage2_pdf_download?.progress_percentage || 0}
            lastSync={data.stage2_pdf_download?.last_synced_at}
            schedule={data.stage2_pdf_download?.schedule}
            color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
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
              lastSync={data.stage3_sharepoint?.last_synced_at}
              schedule="Uploads with PDF sync"
              color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            />
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
              {(data.stage1_data_sync?.total_in_database || data.total_invoices).toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <FileText className="h-3 w-3" />
              PDFs Downloaded
            </div>
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {data.pdfs_synced.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Cloud className="h-3 w-3" />
              On SharePoint
            </div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {data.sharepoint_uploads.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              Pending
            </div>
            <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
              {data.pending.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Breakdown by Type */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">PDF Progress by Type</div>
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2 border rounded-lg dark:border-border">
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
            <div className="p-2 border rounded-lg dark:border-border">
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
            <div className="p-2 border rounded-lg dark:border-border">
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
            <div className="p-2 border rounded-lg dark:border-border">
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
      </CardContent>
    </Card>
  );
}

export default XeroCompanyDocSyncCard;
