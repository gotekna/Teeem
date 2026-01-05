"use client";

import * as React from "react";
import { useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { WAREHOUSE_PAGE_SIZE } from "@/lib/constants/pagination-constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Database,
  HardDrive,
  FileText,
  Cloud,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCcw,
  ExternalLink,
  BarChart3,
  FolderOpen,
  Mail,
  Box,
  Activity,
  Download,
  Table2,
  Play,
  Eye,
  ChevronLeft,
  ChevronRight,
  Building2,
  X,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface WarehouseViewStatus {
  key: string;
  name: string;
  concurrent_refresh: boolean;
  last_refresh: string | null;
  last_failure: string | null;
  row_count: number | null;
  avg_duration_seconds: number | null;
  success_rate_24h: number | null;
}

interface WarehouseHealthSummary {
  total_views: number;
  healthy: number;
  stale: number;
  warning: number;
  error: number;
  unknown: number;
}

interface WarehouseStatus {
  success: boolean;
  generated_at: string;
  health: WarehouseHealthSummary;
  views: WarehouseViewStatus[];
  recent_activity: Array<{
    id: number;
    view_name: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    duration_seconds: number | null;
    row_count: number | null;
    error_message: string | null;
  }>;
}

interface OrgDataStats {
  organization: {
    name: string;
    total_companies: number;
    total_jobs: number;
  };
  documents: {
    total_documents: number;
    by_source: Record<string, number>;
    by_folder: Record<string, number>;
    by_ai_status: Record<string, number>;
    verified_count: number;
    needs_review_count: number;
    total_file_size: number;
    latest_upload: string | null;
  };
  document_types: Array<{ type: string; abbreviation: string; count: number }>;
  emails: {
    total_emails: number;
    total_size: number;
    linked_to_contact: number;
    linked_to_job: number;
    linked_to_company: number;
    linked_to_company_group: number;
    junk_emails: number;
    unprocessed: number;
    last_sync: string | null;
    size_by_contact: number;
    size_by_job: number;
    size_by_company: number;
    size_junk: number;
    ai_classification?: {
      spam: number;
      marketing: number;
      transactional: number;
      business: number;
      unclassified: number;
      classified_count: number;
      classification_rate: number;
    };
    ssot_migration?: {
      with_direction: number;
      with_body_preview: number;
      direction_rate: number;
      body_preview_rate: number;
    };
  };
  sharepoint: {
    connected: boolean;
    site_url: string | null;
    site_path: string | null;
    total_synced: number;
    last_sync: string | null;
  };
  xero: {
    connected: boolean;
    tenant_name: string | null;
    companies_connected: number;
    last_sync: string | null;
  };
  corporate?: {
    total: number;
    active: number;
    missing_abn: number;
    missing_acn: number;
    missing_review_date: number;
    overdue_review: number;
    by_entity_type: Record<string, number>;
    health_rate: number;
  };
  job_documents: {
    total_files: number;
    revit_files: number;
    autocad_files: number;
    pdf_files: number;
    image_files: number;
    total_size: number;
  };
  last_updated: string;
}

interface WarehouseMetadata {
  success: boolean;
  generated_at: string;
  materialized_views: Array<{
    name: string;
    description: string;
    refresh_frequency: string;
    has_unique_index: boolean;
    primary_key: string;
    row_count: number | null;
    last_refreshed: string | null;
    columns: Array<{ name: string; type: string; nullable: boolean }>;
  }>;
  fact_tables: Array<{
    name: string;
    description: string;
    granularity: string;
    retention: string;
    primary_key: string;
    row_count: number | null;
    columns: Array<{ name: string; type: string; nullable: boolean }>;
  }>;
  warehouse_tables: Array<{
    name: string;
    description: string;
    source: string;
    sync_type: string;
    row_count: number | null;
    columns: Array<{ name: string; type: string; nullable: boolean }>;
  }>;
}

interface ViewData {
  success: boolean;
  view: string;
  row_count: number;
  data: Record<string, unknown>[];
}

// Microsoft 365 organization stats
interface MicrosoftOrgStats {
  name: string;
  connected: boolean;
  credential_id?: number;
  tenant_id?: string;
  status: string;
  last_sync_at?: string;
  admin_consent_granted_at?: string;
  admin_consent_granted_by?: string;
  stats: {
    emails: number;
    email_storage_bytes: number;
    linked_to_job: number;
    size_by_job: number;
    junk_emails: number;
    unprocessed: number;
    last_email_received?: string;
    last_sync?: string;
    per_mailbox: Array<{
      mailbox: string;
      email_count: number;
      last_sync: string | null;
    }>;
    ai_classification: {
      spam: number;
      marketing: number;
      transactional: number;
      business: number;
      unclassified: number;
      classified_count: number;
      classification_rate: number;
    };
    ssot_migration: {
      with_direction: number;
      with_body_preview: number;
      direction_rate: number;
      body_preview_rate: number;
    };
  };
}

interface MicrosoftOrgStatsResponse {
  success: boolean;
  organizations: MicrosoftOrgStats[];
  total_connected: number;
  total_emails: number;
  generated_at: string;
}

export function DataWarehouseTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const companyId = searchParams.get("company_id");
  const subtabFromUrl = searchParams.get("subtab");
  const activeTab = subtabFromUrl || "overview";

  const handleTabChange = useCallback((tabId: string) => {
    // Use query params for subtabs (not path segments) since DataWarehouseTab
    // is rendered at /data-warehouse, not within /admin/system/[...slug] route
    const params = new URLSearchParams();
    if (tabId !== "overview") {
      params.set("subtab", tabId);
    }
    if (companyId) {
      params.set("company_id", companyId);
    }
    const queryString = params.toString();
    const url = `/data-warehouse${queryString ? `?${queryString}` : ""}`;
    router.push(url, { scroll: false });
  }, [router, companyId]);

  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<OrgDataStats | null>(null);
  const [warehouseStatus, setWarehouseStatus] = React.useState<WarehouseStatus | null>(null);
  const [warehouseMetadata, setWarehouseMetadata] = React.useState<WarehouseMetadata | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshingViews, setRefreshingViews] = React.useState(false);
  const [selectedView, setSelectedView] = React.useState<string | null>(null);
  const [viewData, setViewData] = React.useState<ViewData | null>(null);
  const [loadingViewData, setLoadingViewData] = React.useState(false);
  const [viewOffset, setViewOffset] = React.useState(0);
  const [companyName, setCompanyName] = React.useState<string | null>(null);
  const [microsoftOrgStats, setMicrosoftOrgStats] = React.useState<MicrosoftOrgStatsResponse | null>(null);
  // SSoT: Uses WAREHOUSE_PAGE_SIZE from pagination-constants.ts
  const PAGE_SIZE = WAREHOUSE_PAGE_SIZE;

  // Load company name if filtering by company
  React.useEffect(() => {
    if (companyId) {
      api.get<{ id: number; name: string }>(`/api/v1/companies/${companyId}`)
        .then((res) => {
          if (res?.name) {
            setCompanyName(res.name);
          }
        })
        .catch(console.error);
    } else {
      setCompanyName(null);
    }
  }, [companyId]);

  React.useEffect(() => {
    loadStats();
    loadWarehouseStatus();
    loadWarehouseMetadata();
    loadMicrosoftOrgStats();
  }, [companyId]);

  const clearCompanyFilter = () => {
    router.push("/admin/system/data-warehouse");
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      // Use company-specific endpoint if filtering by company
      const endpoint = companyId
        ? `/api/v1/companies/${companyId}/data_stats`
        : "/api/v1/organization/data_stats";
      const response = await api.get<{ success: boolean; data: OrgDataStats }>(endpoint);
      if (response?.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Failed to load data stats:", error);
      // Set mock data for now
      setStats({
        organization: {
          name: "Tekna Homes",
          total_companies: 45,
          total_jobs: 127,
        },
        documents: {
          total_documents: 2847,
          by_source: { onedrive: 1532, upload: 987, xero: 328 },
          by_folder: { ASIC: 234, ATO: 456, Bank: 189, Company: 567 },
          by_ai_status: { verified: 2102, pending: 412, mismatch: 89, needs_review: 244 },
          verified_count: 2102,
          needs_review_count: 333,
          total_file_size: 15728640000,
          latest_upload: new Date().toISOString(),
        },
        document_types: [
          { type: "Financial Statements", abbreviation: "FS", count: 234 },
          { type: "Company Tax Return", abbreviation: "CTR", count: 189 },
          { type: "BAS", abbreviation: "BAS", count: 156 },
          { type: "Bank Statement", abbreviation: "BS", count: 432 },
        ],
        emails: {
          total_emails: 12453,
          total_size: 524288000,
          linked_to_contact: 8234,
          linked_to_job: 5123,
          linked_to_company: 3456,
          linked_to_company_group: 1234,
          junk_emails: 892,
          unprocessed: 127,
          last_sync: new Date().toISOString(),
          size_by_contact: 312000000,
          size_by_job: 198000000,
          size_by_company: 156000000,
          size_junk: 45000000,
        },
        sharepoint: {
          connected: true,
          site_url: "gotekna.sharepoint.com/sites/TEEEM",
          site_path: "/Shared Documents",
          total_synced: 1532,
          last_sync: new Date().toISOString(),
        },
        xero: {
          connected: true,
          tenant_name: "Tekna Homes",
          companies_connected: 12,
          last_sync: new Date().toISOString(),
        },
        job_documents: {
          total_files: 847,
          revit_files: 64,
          autocad_files: 23,
          pdf_files: 523,
          image_files: 237,
          total_size: 4521984000,
        },
        last_updated: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouseStatus = async () => {
    try {
      const response = await api.get<WarehouseStatus>("/api/v1/warehouse/status");
      if (response?.success) {
        setWarehouseStatus(response);
      }
    } catch (error) {
      console.error("Failed to load warehouse status:", error);
    }
  };

  const loadWarehouseMetadata = async () => {
    try {
      const response = await api.get<WarehouseMetadata>("/api/v1/warehouse/metadata");
      if (response?.success) {
        setWarehouseMetadata(response);
      }
    } catch (error) {
      console.error("Failed to load warehouse metadata:", error);
    }
  };

  const loadMicrosoftOrgStats = async () => {
    try {
      const response = await api.get<MicrosoftOrgStatsResponse>("/api/v1/organization/microsoft_org_stats");
      if (response?.success) {
        setMicrosoftOrgStats(response);
      }
    } catch (error) {
      console.error("Failed to load Microsoft org stats:", error);
    }
  };

  const loadViewData = async (viewName: string, offset: number = 0) => {
    setLoadingViewData(true);
    try {
      const response = await api.get<ViewData>(
        `/api/v1/warehouse/export/${viewName}.json?limit=${PAGE_SIZE}&offset=${offset}`
      );
      if (response?.success) {
        setViewData(response);
        setSelectedView(viewName);
        setViewOffset(offset);
      }
    } catch (error) {
      console.error("Failed to load view data:", error);
    } finally {
      setLoadingViewData(false);
    }
  };

  const handleViewClick = (viewName: string) => {
    setViewOffset(0);
    loadViewData(viewName, 0);
    handleTabChange("data");
  };

  const handleNextPage = () => {
    if (selectedView) {
      loadViewData(selectedView, viewOffset + PAGE_SIZE);
    }
  };

  const handlePrevPage = () => {
    if (selectedView && viewOffset >= PAGE_SIZE) {
      loadViewData(selectedView, viewOffset - PAGE_SIZE);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadWarehouseStatus()]);
    setRefreshing(false);
  };

  const handleRefreshViews = async () => {
    setRefreshingViews(true);
    try {
      await api.post("/api/v1/warehouse/refresh", { view_name: "all" });
      // Wait a bit then reload status
      setTimeout(() => {
        loadWarehouseStatus();
        setRefreshingViews(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to trigger view refresh:", error);
      setRefreshingViews(false);
    }
  };

  const handleExportView = (viewName: string, format: "csv" | "xlsx") => {
    window.open(`/api/v1/warehouse/export/${viewName}.${format}`, "_blank");
  };


  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return format(new Date(dateStr), "MMM d, yyyy h:mm a");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Failed to load data warehouse statistics
      </div>
    );
  }

  const verificationRate = stats.documents.total_documents > 0
    ? Math.round((stats.documents.verified_count / stats.documents.total_documents) * 100)
    : 0;

  // Format cell value for display
  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        return format(new Date(value), "MMM d, yyyy h:mm a");
      } catch {
        return String(value);
      }
    }
    if (typeof value === "number") {
      if (Number.isInteger(value)) return value.toLocaleString();
      return value.toFixed(2);
    }
    return String(value);
  };

  return (
    <div className="space-y-6">
      {/* Company Filter Banner */}
      {companyId && (
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Filtered by Company: {companyName || `ID ${companyId}`}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCompanyFilter}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          >
            <X className="h-4 w-4 mr-1" />
            Clear Filter
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Data Warehouse</h2>
          <p className="text-sm text-muted-foreground">
            {companyId
              ? `Document storage and data statistics for ${companyName || "this company"}`
              : "Organization-wide document storage, sync status, and data statistics"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCcw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {/* Microsoft 365 Organization Tabs */}
          {microsoftOrgStats?.organizations.map((org) => (
            <TabsTrigger key={org.name} value={`org-${org.name}`} className="gap-1">
              {org.name}
              {org.connected ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <XCircle className="h-3 w-3 text-muted-foreground" />
              )}
            </TabsTrigger>
          ))}
          <TabsTrigger value="browse">Browse Views</TabsTrigger>
          <TabsTrigger value="data">View Data</TabsTrigger>
        </TabsList>

        {/* Browse Views Tab */}
        <TabsContent value="browse" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Available Views & Tables
              </CardTitle>
            </CardHeader>
            <CardContent>
              {warehouseMetadata ? (
                <div className="space-y-6">
                  {/* Materialized Views */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Table2 className="h-4 w-4" />
                      Materialized Views ({warehouseMetadata.materialized_views.length})
                    </h3>
                    <div className="grid gap-2">
                      {warehouseMetadata.materialized_views.map((view) => (
                        <div
                          key={view.name}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{view.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{view.description}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <Badge variant="outline" className="text-xs">
                              {view.row_count?.toLocaleString() ?? "?"} rows
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {view.refresh_frequency}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewClick(view.name)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExportView(view.name, "csv")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fact Tables */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Fact Tables ({warehouseMetadata.fact_tables.length})
                    </h3>
                    <div className="grid gap-2">
                      {warehouseMetadata.fact_tables.map((table) => (
                        <div
                          key={table.name}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{table.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{table.description}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <Badge variant="outline" className="text-xs">
                              {table.row_count?.toLocaleString() ?? "?"} rows
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {table.granularity}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewClick(table.name)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExportView(table.name, "csv")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Warehouse Tables */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      Warehouse Tables ({warehouseMetadata.warehouse_tables.length})
                    </h3>
                    <div className="grid gap-2">
                      {warehouseMetadata.warehouse_tables.map((table) => (
                        <div
                          key={table.name}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{table.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {table.description} • Source: {table.source}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <Badge variant="outline" className="text-xs">
                              {table.row_count?.toLocaleString() ?? "?"} rows
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {table.sync_type}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewClick(table.name)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExportView(table.name, "csv")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Spinner size={24} className="text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* View Data Tab */}
        <TabsContent value="data" className="space-y-4">
          {selectedView ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Table2 className="h-4 w-4" />
                    {selectedView}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportView(selectedView, "csv")}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportView(selectedView, "xlsx")}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Excel
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingViewData ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner size={32} className="text-muted-foreground" />
                  </div>
                ) : viewData && viewData.data.length > 0 ? (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Showing rows {viewOffset + 1} - {viewOffset + viewData.data.length} of {viewData.row_count.toLocaleString()}
                    </div>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(viewData.data[0] || {}).map((col) => (
                              <TableHead key={col} className="text-xs whitespace-nowrap">
                                {col}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewData.data.map((row, idx) => (
                            <TableRow key={idx}>
                              {Object.values(row).map((val, colIdx) => (
                                <TableCell key={colIdx} className="text-xs whitespace-nowrap max-w-[300px] truncate">
                                  {formatCellValue(val)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevPage}
                        disabled={viewOffset === 0}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {Math.floor(viewOffset / PAGE_SIZE) + 1} of {Math.ceil(viewData.row_count / PAGE_SIZE)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={viewOffset + PAGE_SIZE >= viewData.row_count}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No data found in this view
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a view from the Browse Views tab to see its data</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Microsoft 365 Organization Tabs */}
        {microsoftOrgStats?.organizations.map((org) => (
          <TabsContent key={org.name} value={`org-${org.name}`} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      org.connected ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-800"
                    )}>
                      <Building2 className={cn(
                        "h-5 w-5",
                        org.connected ? "text-green-600 dark:text-green-400" : "text-gray-400"
                      )} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{org.name} Microsoft 365</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {org.connected
                          ? `Connected since ${org.admin_consent_granted_at ? format(new Date(org.admin_consent_granted_at), "PPP") : "unknown"}`
                          : "Not connected to Microsoft 365"
                        }
                      </p>
                    </div>
                  </div>
                  <Badge variant={org.connected ? "default" : "secondary"}>
                    {org.connected ? (
                      <><CheckCircle className="h-3 w-3 mr-1" /> Connected</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> Not Connected</>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {org.connected ? (
                  <div className="space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">Emails</span>
                        </div>
                        <p className="text-2xl font-bold">{org.stats.emails.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <HardDrive className="h-4 w-4 text-purple-500" />
                          <span className="text-sm font-medium">Storage</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {org.stats.email_storage_bytes > 1073741824
                            ? `${(org.stats.email_storage_bytes / 1073741824).toFixed(1)} GB`
                            : `${(org.stats.email_storage_bytes / 1048576).toFixed(0)} MB`
                          }
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <FolderOpen className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">Linked to Jobs</span>
                        </div>
                        <p className="text-2xl font-bold">{org.stats.linked_to_job.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium">Last Sync</span>
                        </div>
                        <p className="text-lg font-medium">
                          {org.last_sync_at
                            ? format(new Date(org.last_sync_at), "PPp")
                            : "Never"
                          }
                        </p>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="text-sm text-muted-foreground">
                      {org.stats.last_email_received && (
                        <p>Last email received: {format(new Date(org.stats.last_email_received), "PPp")}</p>
                      )}
                      {org.admin_consent_granted_by && (
                        <p>Admin consent by: {org.admin_consent_granted_by}</p>
                      )}
                    </div>

                    {/* Per-Person Email Stats */}
                    {org.stats.per_mailbox?.length > 0 && (
                      <div className="pt-4 border-t">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Emails by Person ({org.stats.per_mailbox.length})
                        </h4>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Mailbox</TableHead>
                                <TableHead className="text-right">Emails</TableHead>
                                <TableHead className="text-right">Last Sync</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {org.stats.per_mailbox.map((mb) => (
                                <TableRow key={mb.mailbox}>
                                  <TableCell className="font-medium">{mb.mailbox}</TableCell>
                                  <TableCell className="text-right">{mb.email_count.toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {mb.last_sync ? format(new Date(mb.last_sync), "PPp") : "Never"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* AI Classification (same as Overview) */}
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        AI Classification
                      </h4>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Classification Rate</span>
                        <span className="text-xs font-medium">{org.stats.ai_classification?.classification_rate || 0}%</span>
                      </div>
                      <Progress
                        value={org.stats.ai_classification?.classification_rate || 0}
                        className="h-1.5 mb-3"
                      />
                      <div className="grid grid-cols-5 gap-2">
                        <div className="text-center p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                          <p className="text-sm font-bold text-red-600">{(org.stats.ai_classification?.spam || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Spam</p>
                        </div>
                        <div className="text-center p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                          <p className="text-sm font-bold text-orange-600">{(org.stats.ai_classification?.marketing || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Marketing</p>
                        </div>
                        <div className="text-center p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <p className="text-sm font-bold text-blue-600">{(org.stats.ai_classification?.transactional || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Transactional</p>
                        </div>
                        <div className="text-center p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <p className="text-sm font-bold text-green-600">{(org.stats.ai_classification?.business || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Business</p>
                        </div>
                        <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                          <p className="text-sm font-bold text-gray-600">{(org.stats.ai_classification?.unclassified || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Unclassified</p>
                        </div>
                      </div>
                    </div>

                    {/* SSoT Migration Progress (same as Overview) */}
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-3">SSoT Migration Progress</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Direction Field</span>
                            <span className="text-xs font-medium">{org.stats.ssot_migration?.direction_rate || 0}%</span>
                          </div>
                          <Progress value={org.stats.ssot_migration?.direction_rate || 0} className="h-1.5" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {(org.stats.ssot_migration?.with_direction || 0).toLocaleString()} of {org.stats.emails.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Body Preview</span>
                            <span className="text-xs font-medium">{org.stats.ssot_migration?.body_preview_rate || 0}%</span>
                          </div>
                          <Progress value={org.stats.ssot_migration?.body_preview_rate || 0} className="h-1.5" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {(org.stats.ssot_migration?.with_body_preview || 0).toLocaleString()} of {org.stats.emails.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Email Storage Breakdown */}
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <HardDrive className="h-4 w-4" />
                        Email Storage
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <p className="text-xl font-bold text-purple-600">{org.stats.emails.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Total Emails</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatBytes(org.stats.email_storage_bytes)}</p>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <p className="text-xl font-bold text-green-600">{org.stats.linked_to_job.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Linked to Jobs</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatBytes(org.stats.size_by_job)}</p>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <p className="text-xl font-bold text-red-600">{org.stats.junk_emails.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Spam</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Unclassified: {org.stats.unprocessed.toLocaleString()}</span>
                        <span>Last Sync: {org.stats.last_sync ? format(new Date(org.stats.last_sync), "PPp") : "Never"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Not Connected</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This organization is not yet connected to Microsoft 365.<br />
                      Connect it from Settings to sync emails and files.
                    </p>
                    <Button asChild>
                      <Link href="/settings/integrations/microsoft">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Go to Microsoft Settings
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.documents.total_documents.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{verificationRate}%</p>
                <p className="text-xs text-muted-foreground">AI Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Mail className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emails.total_emails.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Emails Stored</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <HardDrive className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatBytes(stats.documents.total_file_size + stats.job_documents.total_size)}</p>
                <p className="text-xs text-muted-foreground">Total Storage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integrations Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SharePoint */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              SharePoint
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              {stats.sharepoint.connected ? (
                <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
            {stats.sharepoint.site_url && (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Site</span>
                <span className="text-xs font-mono bg-muted px-2 py-1 rounded truncate">
                  {stats.sharepoint.site_url}
                </span>
              </div>
            )}
            {stats.sharepoint.site_path && (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Path</span>
                <span className="text-xs font-mono bg-muted px-2 py-1 rounded truncate">
                  {stats.sharepoint.site_path}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Synced Files</span>
              <span className="font-medium">{stats.sharepoint.total_synced.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Sync</span>
              <span className="text-sm">{formatDate(stats.sharepoint.last_sync)}</span>
            </div>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/settings/integrations/microsoft" className="flex items-center justify-center">
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Integration
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Xero */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Xero Accounting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              {stats.xero.connected ? (
                <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
            {stats.xero.tenant_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Organization</span>
                <span className="font-medium">{stats.xero.tenant_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Companies Connected</span>
              <span className="font-medium">{stats.xero.companies_connected}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Sync</span>
              <span className="text-sm">{formatDate(stats.xero.last_sync)}</span>
            </div>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/settings/integrations/xero" className="flex items-center justify-center">
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Integration
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Materialized Views Status */}
      {warehouseStatus && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Materialized Views Status
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshViews}
                  disabled={refreshingViews}
                >
                  <Play className={cn("h-4 w-4 mr-1", refreshingViews && "animate-pulse")} />
                  {refreshingViews ? "Refreshing..." : "Refresh All"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Health Summary */}
            <div className="grid grid-cols-5 gap-2">
              <div className="text-center p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <p className="text-xl font-bold text-green-600">{warehouseStatus.health.healthy}</p>
                <p className="text-xs text-muted-foreground">Healthy</p>
              </div>
              <div className="text-center p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <p className="text-xl font-bold text-yellow-600">{warehouseStatus.health.stale}</p>
                <p className="text-xs text-muted-foreground">Stale</p>
              </div>
              <div className="text-center p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <p className="text-xl font-bold text-orange-600">{warehouseStatus.health.warning}</p>
                <p className="text-xs text-muted-foreground">Warning</p>
              </div>
              <div className="text-center p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <p className="text-xl font-bold text-red-600">{warehouseStatus.health.error}</p>
                <p className="text-xs text-muted-foreground">Error</p>
              </div>
              <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-xl font-bold text-gray-600">{warehouseStatus.health.unknown}</p>
                <p className="text-xs text-muted-foreground">Unknown</p>
              </div>
            </div>

            {/* Views List */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {warehouseStatus.views.map((view) => (
                <div
                  key={view.key}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Table2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{view.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {view.row_count?.toLocaleString() ?? "?"} rows
                        {view.avg_duration_seconds && ` • ${view.avg_duration_seconds.toFixed(1)}s avg`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {view.last_refresh ? (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {format(new Date(view.last_refresh), "MMM d, h:mm a")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Never refreshed</Badge>
                    )}
                    {view.last_failure && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleExportView(view.name, "csv")}
                        title="Export CSV"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            {warehouseStatus.recent_activity.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Activity
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {warehouseStatus.recent_activity.slice(0, 5).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between text-xs py-1"
                    >
                      <div className="flex items-center gap-2">
                        {activity.status === "success" ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : activity.status === "failed" ? (
                          <XCircle className="h-3 w-3 text-red-500" />
                        ) : (
                          <Spinner size={12} className="text-blue-500" />
                        )}
                        <span className="font-mono">{activity.view_name}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {format(new Date(activity.started_at), "h:mm a")}
                        {activity.duration_seconds && ` (${activity.duration_seconds.toFixed(1)}s)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Email AI Pipeline - Classification & Migration Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email AI Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Classification Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">AI Classification</span>
              <span className="text-sm text-muted-foreground">
                {stats.emails.ai_classification?.classification_rate || 0}% classified
              </span>
            </div>
            <Progress
              value={stats.emails.ai_classification?.classification_rate || 0}
              className="h-2 mb-3"
            />
            <div className="grid grid-cols-5 gap-2">
              <div className="text-center p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <p className="text-lg font-bold text-red-600">{(stats.emails.ai_classification?.spam || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Spam</p>
              </div>
              <div className="text-center p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <p className="text-lg font-bold text-orange-600">{(stats.emails.ai_classification?.marketing || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Marketing</p>
              </div>
              <div className="text-center p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <p className="text-lg font-bold text-blue-600">{(stats.emails.ai_classification?.transactional || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Transactional</p>
              </div>
              <div className="text-center p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <p className="text-lg font-bold text-green-600">{(stats.emails.ai_classification?.business || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Business</p>
              </div>
              <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-lg font-bold text-gray-600">{(stats.emails.ai_classification?.unclassified || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Unclassified</p>
              </div>
            </div>
          </div>

          {/* SSoT Migration Progress */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">SSoT Migration Progress</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Direction Field</span>
                  <span className="text-xs font-medium">{stats.emails.ssot_migration?.direction_rate || 0}%</span>
                </div>
                <Progress value={stats.emails.ssot_migration?.direction_rate || 0} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">
                  {(stats.emails.ssot_migration?.with_direction || 0).toLocaleString()} of {stats.emails.total_emails.toLocaleString()}
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Body Preview</span>
                  <span className="text-xs font-medium">{stats.emails.ssot_migration?.body_preview_rate || 0}%</span>
                </div>
                <Progress value={stats.emails.ssot_migration?.body_preview_rate || 0} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">
                  {(stats.emails.ssot_migration?.with_body_preview || 0).toLocaleString()} of {stats.emails.total_emails.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Warehouse Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Storage Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{stats.emails.total_emails.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Emails</p>
              <p className="text-xs text-muted-foreground mt-1">{formatBytes(stats.emails.total_size)}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{stats.emails.linked_to_contact.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Linked to Contact</p>
              <p className="text-xs text-muted-foreground mt-1">{formatBytes(stats.emails.size_by_contact)}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{stats.emails.linked_to_job.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Linked to Job</p>
              <p className="text-xs text-muted-foreground mt-1">{formatBytes(stats.emails.size_by_job)}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{stats.emails.linked_to_company.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Linked to Company</p>
              <p className="text-xs text-muted-foreground mt-1">{formatBytes(stats.emails.size_by_company)}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-cyan-600">{stats.emails.linked_to_company_group.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Linked to Group</p>
              <p className="text-xs text-muted-foreground mt-1">-</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{stats.emails.junk_emails.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Spam Emails</p>
              <p className="text-xs text-muted-foreground mt-1">{formatBytes(stats.emails.size_junk)}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Unclassified: {stats.emails.unprocessed.toLocaleString()}</span>
            <span>Last Sync: {formatDate(stats.emails.last_sync)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Corporate (Companies) Health */}
      {stats.corporate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Corporate Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Data Completeness</span>
              <span className="text-sm text-muted-foreground">
                {stats.corporate.health_rate}% healthy
              </span>
            </div>
            <Progress value={stats.corporate.health_rate} className="h-2 mb-3" />

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <p className="text-xl font-bold text-blue-600">{stats.corporate.total}</p>
                <p className="text-xs text-muted-foreground">Total Companies</p>
              </div>
              <div className="text-center p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <p className="text-xl font-bold text-yellow-600">{stats.corporate.missing_abn}</p>
                <p className="text-xs text-muted-foreground">Missing ABN</p>
              </div>
              <div className="text-center p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <p className="text-xl font-bold text-orange-600">{stats.corporate.missing_acn}</p>
                <p className="text-xs text-muted-foreground">Missing ACN</p>
              </div>
              <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-xl font-bold text-gray-600">{stats.corporate.missing_review_date}</p>
                <p className="text-xs text-muted-foreground">No Review Date</p>
              </div>
              <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <p className="text-xl font-bold text-red-600">{stats.corporate.overdue_review}</p>
                <p className="text-xs text-muted-foreground">Overdue Review</p>
              </div>
            </div>

            {/* Entity Type Breakdown */}
            {Object.keys(stats.corporate.by_entity_type).length > 0 && (
              <div className="pt-3 border-t">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">By Entity Type</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.corporate.by_entity_type)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 8)
                    .map(([type, count]) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}: {count}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Verification Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI Document Verification Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {stats.documents.verified_count.toLocaleString()} of {stats.documents.total_documents.toLocaleString()} documents verified
            </span>
            <span className="font-medium">{verificationRate}%</span>
          </div>
          <Progress value={verificationRate} className="h-2" />
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.documents.by_ai_status).map(([status, count]) => {
              const config: Record<string, { color: string; icon: React.ElementType }> = {
                verified: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
                mismatch: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
                needs_review: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: AlertTriangle },
                pending: { color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Clock },
              };
              const { color, icon: Icon } = config[status] || { color: "bg-gray-100 text-gray-600", icon: FileText };
              return (
                <Badge key={status} variant="outline" className={cn("text-sm py-1 px-3", color)}>
                  <Icon className="h-3 w-3 mr-1" />
                  {status.replace("_", " ")}: {count.toLocaleString()}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* CAD/BIM Files (Job Documents) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Box className="h-4 w-4" />
            CAD/BIM Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{stats.job_documents.revit_files}</p>
              <p className="text-xs text-muted-foreground">Revit (.rvt)</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{stats.job_documents.autocad_files}</p>
              <p className="text-xs text-muted-foreground">AutoCAD (.dwg)</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{stats.job_documents.pdf_files}</p>
              <p className="text-xs text-muted-foreground">PDF (.pdf)</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{stats.job_documents.image_files}</p>
              <p className="text-xs text-muted-foreground">Images</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{formatBytes(stats.job_documents.total_size)}</p>
              <p className="text-xs text-muted-foreground">Total Size</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Types Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Document Types</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.document_types.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents yet</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {stats.document_types.slice(0, 10).map((dt) => (
                  <div key={dt.type || "unknown"} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {dt.abbreviation && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {dt.abbreviation}
                        </Badge>
                      )}
                      <span className="text-sm truncate">{dt.type || "Unclassified"}</span>
                    </div>
                    <Badge variant="secondary">{dt.count.toLocaleString()}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Documents by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.documents.by_source).map(([source, count]) => {
                const isSharePoint = source === "onedrive";
                const sharePointUrl = isSharePoint && stats.sharepoint.site_url
                  ? `https://${stats.sharepoint.site_url}${stats.sharepoint.site_path || ''}`
                  : null;

                return (
                  <div key={source} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isSharePoint && <Cloud className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                      {source === "upload" && <FolderOpen className="h-4 w-4 text-green-500 flex-shrink-0" />}
                      {source === "xero" && <BarChart3 className="h-4 w-4 text-cyan-500 flex-shrink-0" />}
                      {source === "email" && <Mail className="h-4 w-4 text-purple-500 flex-shrink-0" />}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium">
                          {isSharePoint ? "SharePoint" : source.charAt(0).toUpperCase() + source.slice(1)}
                        </span>
                        {isSharePoint && stats.sharepoint.site_url && (
                          <a
                            href={sharePointUrl || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate flex items-center gap-1"
                          >
                            {stats.sharepoint.site_url}{stats.sharepoint.site_path}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0 ml-2">{count.toLocaleString()}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Updated */}
      <div className="text-xs text-muted-foreground text-right">
        Last updated: {formatDate(stats.last_updated)}
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
