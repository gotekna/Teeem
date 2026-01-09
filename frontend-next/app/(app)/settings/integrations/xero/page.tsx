"use client";

import * as React from "react";
import { useUrlState } from "@/hooks/useUrlState";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Link2,
  ArrowRightLeft,
  Users,
  ChevronDown,
  ChevronRight,
  Activity,
  Database,
  Download,
  Upload,
  FileText,
  Star,
  Clock,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { XeroFieldMapping, XeroContactSync } from "./components/XeroTabs";
import { XeroPdfSyncStatus } from "./components/XeroPdfSyncStatus";
import { XeroSyncStats } from "./components/XeroSyncStats";
import { XeroConnectionsPopup } from "@/components/xero/XeroConnectionsPopup";
import { XeroCommonContacts } from "./components/XeroCommonContacts";
import { DuplicateContactsTab } from "@/components/settings/xero/DuplicateContactsTab";
import { useGetDuplicateCount } from "@/lib/hooks/useDuplicateContacts";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";

interface XeroStatus {
  connected: boolean;
  organization_name?: string;
  tenant_name?: string;
  tenant_id?: string;
  connected_at?: string;
  expires_at?: string;
  expired?: boolean;
}

interface XeroTenant {
  id: number;
  tenant_id: string;
  tenant_name: string;
  connected_at: string;
  is_primary: boolean;
  expires_at?: string;
  expired?: boolean;
  // SSoT: Credential health status fields
  status?: 'connected' | 'degraded' | 'disconnected';
  needs_reauth?: boolean;
  // SSoT: Backend-computed display fields (Option C refactor)
  // Use these instead of calculating from expires_at client-side
  status_display?: 'connected' | 'warning' | 'expired' | 'disconnected';
  expires_in_human?: string;  // "28m", "1h 15m", "Expired"
  needs_attention?: boolean;
}

interface CompanyXeroConnection {
  id: number;
  company_id: number;
  company: {
    id: number;
    name: string;
  };
  xero_tenant_name: string;
  connection_status: string;
}

interface PdfSyncHealth {
  stage1_percentage: number;
  stage2_percentage: number;
  stage3_percentage: number;
  overall_status: "healthy" | "in_progress" | "warning" | "not_started" | "partial";
  stage1_data: { linked: number; total: number };
  stage2_data: { downloaded: number; total: number };
  stage3_data: { uploaded: number; total: number };
}

export default function XeroIntegrationPage() {
  // SSoT: URL state managed by useUrlState hook
  const [urlState, setUrlState] = useUrlState({
    tab: null as string | null,         // null = "connection"
    connections: null as string | null, // null = not showing popup
  });
  const currentTab = urlState.tab || "connection";
  const showConnectionsParam = urlState.connections;
  const [status, setStatus] = React.useState<XeroStatus | null>(null);
  const [tenants, setTenants] = React.useState<XeroTenant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [pdfSyncHealth, setPdfSyncHealth] = React.useState<PdfSyncHealth | null>(null);
  const [showConnectionsPopup, setShowConnectionsPopup] = React.useState(showConnectionsParam === "true");
  const [companyConnections, setCompanyConnections] = React.useState<CompanyXeroConnection[]>([]);
  const [settingPrimary, setSettingPrimary] = React.useState<string | null>(null);
  const [organizationsExpanded, setOrganizationsExpanded] = React.useState<boolean | null>(null);

  // Get duplicate contacts count for badge
  const duplicateCount = useGetDuplicateCount();
  const { toast } = useToast();

  // Compute if any tenant needs attention (for default expanded state)
  // SSoT: Auto-expand when any tenant needs re-auth, is degraded, disconnected, or expired
  const hasExpiredTenants = React.useMemo(() => {
    return tenants.some(t =>
      t.expired ||
      t.needs_reauth ||
      t.status === 'degraded' ||
      t.status === 'disconnected'
    );
  }, [tenants]);

  // Set default expanded state based on health - only once when tenants load
  React.useEffect(() => {
    if (tenants.length > 0 && organizationsExpanded === null) {
      setOrganizationsExpanded(hasExpiredTenants);
    }
  }, [tenants, hasExpiredTenants, organizationsExpanded]);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch status
        const statusResponse = await api.xero.getStatus();
        setStatus(statusResponse.data || { connected: false });

        // Fetch all tenants, PDF sync status, and company connections if connected
        if (statusResponse.data?.connected) {
          const [tenantsResponse, pdfSyncResponse, connectionsResponse] = await Promise.all([
            api.get<{ success: boolean; tenants: XeroTenant[] }>("/api/v1/xero/tenants"),
            api.get<{ success: boolean; data: any }>("/api/v1/xero/pdf_sync_status"),
            api.get<{ success: boolean; companies: CompanyXeroConnection[] }>("/api/v1/company_xero_connections"),
          ]);
          setTenants(tenantsResponse.tenants || []);
          setCompanyConnections(connectionsResponse.companies || []);

          // Extract health data from PDF sync response
          if (pdfSyncResponse.success && pdfSyncResponse.data) {
            const d = pdfSyncResponse.data;
            setPdfSyncHealth({
              stage1_percentage: d.stage1_data_sync?.total_in_database
                ? Math.round((d.stage1_data_sync.linked_to_contacts / d.stage1_data_sync.total_in_database) * 100)
                : 0,
              stage2_percentage: d.stage2_pdf_download?.progress_percentage || d.progress_percentage || 0,
              stage3_percentage: d.stage3_sharepoint?.progress_percentage || 0,
              overall_status: d.health?.status || "not_started",
              stage1_data: {
                linked: d.stage1_data_sync?.linked_to_contacts || 0,
                total: d.stage1_data_sync?.total_in_database || 0
              },
              stage2_data: {
                downloaded: d.stage2_pdf_download?.downloaded || d.pdfs_synced || 0,
                total: d.stage2_pdf_download?.total_to_sync || d.total_invoices || 0
              },
              stage3_data: {
                uploaded: d.stage3_sharepoint?.uploaded || d.sharepoint_uploads || 0,
                total: d.stage3_sharepoint?.total_to_upload || d.pdfs_synced || 0
              },
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch Xero data:", error);
        setStatus({ connected: false });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Note: Auto-refresh happens in backend's connection_status method
  // If it reaches here with expired=true, the auto-refresh failed
  // and user needs to manually reconnect via OAuth flow

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await api.xero.getAuthUrl();
      const authUrl = response.auth_url || response.url; // Handle both response formats
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        throw new Error("No authorization URL received from server");
      }
    } catch (error) {
      console.error("Failed to get Xero auth URL:", error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    console.log("[Xero] Disconnect button clicked, starting disconnect...");
    setDisconnecting(true);
    try {
      console.log("[Xero] Calling api.xero.disconnect()...");
      await api.xero.disconnect();
      console.log("[Xero] Disconnect successful");
      setStatus({ connected: false });
      setTenants([]);
      toast({
        title: "Disconnected from Xero",
        description: "All Xero connections have been removed. You can reconnect anytime.",
      });
    } catch (error) {
      console.error("[Xero] Failed to disconnect:", error);
      toast({
        title: "Failed to disconnect",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
      console.log("[Xero] Disconnect process complete");
    }
  };

  const handleSetPrimary = async (tenantId: string) => {
    setSettingPrimary(tenantId);
    try {
      await api.post("/api/v1/xero/set_primary", { tenant_id: tenantId });
      // Refresh tenants list
      const tenantsResponse = await api.get<{ success: boolean; tenants: XeroTenant[] }>("/api/v1/xero/tenants");
      setTenants(tenantsResponse.tenants || []);
    } catch (error) {
      console.error("Failed to set primary:", error);
    } finally {
      setSettingPrimary(null);
    }
  };

  // Helper to format token expiry with time
  // SSoT: Prefer backend-computed expires_in_human when available (Option C refactor)
  // Falls back to client-side calculation for backwards compatibility
  const formatTokenExpiry = (tenant: XeroTenant) => {
    // SSoT: Use backend-computed value if available
    if (tenant.expires_in_human) {
      return tenant.expires_in_human;
    }

    // Fallback: Client-side calculation (legacy, will be removed eventually)
    if (!tenant.expires_at) return "Unknown";
    const date = new Date(tenant.expires_at);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (tenant.expired || diffMs <= 0) {
      return "Expired";
    }

    if (diffMins < 60) {
      return `${diffMins}m`;
    }

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours}h ${diffMins % 60}m`;
    }

    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // SSoT: Use backend status_display for determining if expired
  // Falls back to expired field for backwards compatibility
  const isExpired = (tenant: XeroTenant) => {
    if (tenant.status_display) {
      return tenant.status_display === 'expired' || tenant.status_display === 'disconnected';
    }
    return tenant.expired || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/settings/integrations" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Xero Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your Xero account for accounting and invoicing
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={currentTab}
        onValueChange={(value) => {
          setUrlState({ tab: value === "connection" ? null : value });
        }}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="connection">
            <Link2 className="h-4 w-4 mr-2" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="stats">
            <Activity className="h-4 w-4 mr-2" />
            Stats
          </TabsTrigger>
          <TabsTrigger value="health">
            <Database className="h-4 w-4 mr-2" />
            Health
          </TabsTrigger>
          <TabsTrigger value="mapping">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Field Mapping
          </TabsTrigger>
          <TabsTrigger value="sync">
            <Users className="h-4 w-4 mr-2" />
            Contact Sync
          </TabsTrigger>
          <TabsTrigger value="common">
            <Users className="h-4 w-4 mr-2" />
            Common
          </TabsTrigger>
          <TabsTrigger value="duplicates">
            <Users className="h-4 w-4 mr-2" />
            Duplicates
            {duplicateCount > 0 && (
              <Badge className="ml-2 bg-red-600 text-white hover:bg-red-600">
                {duplicateCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Connection Tab */}
        <TabsContent value="connection" className="space-y-6">
          {/* Simplified Status Card with Action Buttons */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-100 rounded-lg">
                    <CreditCard className="h-6 w-6 text-cyan-600" />
                  </div>
                  <div>
                    <CardTitle>Xero</CardTitle>
                    <CardDescription>Accounting & invoicing platform</CardDescription>
                  </div>
                </div>
                {status?.connected ? (
                  status?.expired ? (
                    <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Token Expired
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {status?.connected ? (
                <div className="flex items-center gap-2">
                  <Button onClick={() => setShowConnectionsPopup(true)}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Manage Company Connections
                  </Button>
                  <Button variant="outline" onClick={handleConnect} disabled={connecting}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${connecting ? "animate-spin" : ""}`} />
                    Reconnect
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? (
                      <Spinner size={16} className="mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Disconnect
                  </Button>
                </div>
              ) : (
                <>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Not Connected</AlertTitle>
                    <AlertDescription>
                      Connect your Xero account to sync invoices, expenses, and financial data.
                    </AlertDescription>
                  </Alert>
                  <Button onClick={handleConnect} disabled={connecting} className="mt-4">
                    {connecting ? (
                      <Spinner size={16} className="mr-2" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Connect to Xero
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Connected Xero Organizations - Collapsible Section */}
          {status?.connected && tenants.length > 0 && (
            <div className="border rounded-lg bg-card">
              <button
                onClick={() => setOrganizationsExpanded(!organizationsExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {organizationsExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="font-medium">Connected Xero Organizations</span>
                  <Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-100 text-xs">
                    {tenants.length}
                  </Badge>
                  {hasExpiredTenants && (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Reconnection Required
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {organizationsExpanded ? "Click to collapse" : "Click to expand"}
                </span>
              </button>

              {organizationsExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {tenants
                    .sort((a, b) => {
                      // Primary first, then alphabetical
                      if (a.is_primary) return -1;
                      if (b.is_primary) return 1;
                      return a.tenant_name.localeCompare(b.tenant_name);
                    })
                    .map((tenant) => (
                    <div
                      key={tenant.tenant_id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        tenant.is_primary
                          ? "bg-cyan-50 border-cyan-200"
                          : isExpired(tenant)
                          ? "bg-red-50 border-red-200"
                          : "bg-muted border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded ${
                          tenant.is_primary
                            ? "bg-cyan-100"
                            : isExpired(tenant)
                            ? "bg-red-100"
                            : "bg-gray-100"
                        }`}>
                          {tenant.is_primary ? (
                            <Star className="h-4 w-4 text-cyan-600" />
                          ) : (
                            <CreditCard className={`h-4 w-4 ${isExpired(tenant) ? "text-red-600" : "text-gray-600"}`} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{tenant.tenant_name}</p>
                            {tenant.is_primary && (
                              <Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-100 text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              Token: {formatTokenExpiry(tenant)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpired(tenant) ? (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                            <XCircle className="h-3 w-3 mr-1" />
                            Expired
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        {!tenant.is_primary && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetPrimary(tenant.tenant_id);
                            }}
                            disabled={settingPrimary === tenant.tenant_id}
                          >
                            {settingPrimary === tenant.tenant_id ? (
                              <Spinner size={12} />
                            ) : (
                              <Star className="h-3 w-3" />
                            )}
                            <span className="ml-1">Set Primary</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Company Connections Card */}
          {status?.connected && companyConnections.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Connected Companies</CardTitle>
                    <CardDescription>
                      TEEEM companies linked to Xero organizations
                    </CardDescription>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                    {companyConnections.length} {companyConnections.length === 1 ? 'Company' : 'Companies'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {companyConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-100 rounded">
                          <CreditCard className="h-4 w-4 text-cyan-600" />
                        </div>
                        <div>
                          <p className="font-medium">{connection.company.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Linked to: {connection.xero_tenant_name}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {connection.connection_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* PDF Sync Status - Above Health Check */}
          {status?.connected && (
            <XeroPdfSyncStatus tenantId={tenants.find(t => t.is_primary)?.tenant_id} />
          )}

        </TabsContent>

        {/* Stats Tab - Comprehensive sync statistics */}
        <TabsContent value="stats" className="space-y-4">
          {status?.connected ? (
            <XeroSyncStats />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <p className="text-muted-foreground">Connect to Xero to view sync statistics</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Health Tab - All health indicators in one place */}
        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">System Health Overview</CardTitle>
              <CardDescription>
                All Xero integration health indicators at a glance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Document Sync Stages */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Document Sync Pipeline</h4>

                {/* Stage 1: Xero Data (Bills, Invoices, Quotes) */}
                <div
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    (pdfSyncHealth?.stage1_percentage ?? 0) >= 95
                      ? "border-green-500 bg-green-50"
                      : (pdfSyncHealth?.stage1_percentage ?? 0) >= 50
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-300 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${
                      (pdfSyncHealth?.stage1_percentage ?? 0) >= 95
                        ? "bg-green-100 text-green-600"
                        : "bg-purple-100 text-purple-600"
                    }`}>
                      <Database className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Stage 1: Xero Data</div>
                      <div className="text-xs text-muted-foreground">
                        {pdfSyncHealth?.stage1_data.linked.toLocaleString()} / {pdfSyncHealth?.stage1_data.total.toLocaleString()} linked
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={pdfSyncHealth?.stage1_percentage ?? 0} className="w-24 h-2" />
                    <span className={`font-semibold text-sm w-12 text-right ${
                      (pdfSyncHealth?.stage1_percentage ?? 0) >= 95 ? "text-green-600" : ""
                    }`}>
                      {pdfSyncHealth?.stage1_percentage ?? 0}%
                    </span>
                  </div>
                </div>

                {/* Stage 2: PDF Download */}
                <div
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    (pdfSyncHealth?.stage2_percentage ?? 0) >= 95
                      ? "border-green-500 bg-green-50"
                      : (pdfSyncHealth?.stage2_percentage ?? 0) >= 50
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-300 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${
                      (pdfSyncHealth?.stage2_percentage ?? 0) >= 95
                        ? "bg-green-100 text-green-600"
                        : "bg-blue-100 text-blue-600"
                    }`}>
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Stage 2: PDF Download</div>
                      <div className="text-xs text-muted-foreground">
                        {pdfSyncHealth?.stage2_data.downloaded.toLocaleString()} / {pdfSyncHealth?.stage2_data.total.toLocaleString()} downloaded
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={pdfSyncHealth?.stage2_percentage ?? 0} className="w-24 h-2" />
                    <span className={`font-semibold text-sm w-12 text-right ${
                      (pdfSyncHealth?.stage2_percentage ?? 0) >= 95 ? "text-green-600" : ""
                    }`}>
                      {pdfSyncHealth?.stage2_percentage ?? 0}%
                    </span>
                  </div>
                </div>

                {/* Stage 3: SharePoint Upload */}
                <div
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    (pdfSyncHealth?.stage3_percentage ?? 0) >= 95
                      ? "border-green-500 bg-green-50"
                      : (pdfSyncHealth?.stage3_percentage ?? 0) >= 50
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-300 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${
                      (pdfSyncHealth?.stage3_percentage ?? 0) >= 95
                        ? "bg-green-100 text-green-600"
                        : "bg-green-100 text-green-600"
                    }`}>
                      <Upload className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Stage 3: SharePoint Upload</div>
                      <div className="text-xs text-muted-foreground">
                        {pdfSyncHealth?.stage3_data.uploaded.toLocaleString()} / {pdfSyncHealth?.stage3_data.total.toLocaleString()} uploaded
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={pdfSyncHealth?.stage3_percentage ?? 0} className="w-24 h-2" />
                    <span className={`font-semibold text-sm w-12 text-right ${
                      (pdfSyncHealth?.stage3_percentage ?? 0) >= 95 ? "text-green-600" : ""
                    }`}>
                      {pdfSyncHealth?.stage3_percentage ?? 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Overall Status Badge */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Overall Status</span>
                  <Badge className={
                    pdfSyncHealth?.overall_status === "healthy"
                      ? "bg-green-100 text-green-800"
                      : pdfSyncHealth?.overall_status === "in_progress"
                      ? "bg-blue-100 text-blue-800"
                      : pdfSyncHealth?.overall_status === "warning"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-800"
                  }>
                    {pdfSyncHealth?.overall_status === "healthy" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {pdfSyncHealth?.overall_status === "in_progress" && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                    {pdfSyncHealth?.overall_status === "warning" && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {pdfSyncHealth?.overall_status?.replace("_", " ") || "Unknown"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Link to full Document Sync details */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setUrlState({ tab: null })}
          >
            <FileText className="h-4 w-4 mr-2" />
            View Full Document Sync Details
          </Button>
        </TabsContent>

        {/* Field Mapping Tab */}
        <TabsContent value="mapping">
          <XeroFieldMapping />
        </TabsContent>

        {/* Contact Sync Tab */}
        <TabsContent value="sync">
          <XeroContactSync />
        </TabsContent>

        {/* Common Contacts Tab */}
        <TabsContent value="common">
          <XeroCommonContacts />
        </TabsContent>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates">
          <DuplicateContactsTab />
        </TabsContent>
      </Tabs>

      {/* Xero Connections Popup */}
      <XeroConnectionsPopup
        isOpen={showConnectionsPopup}
        onClose={async () => {
          setShowConnectionsPopup(false);
          // Refresh company connections list
          try {
            const connectionsResponse = await api.get<{ success: boolean; companies: CompanyXeroConnection[] }>(
              "/api/v1/company_xero_connections"
            );
            setCompanyConnections(connectionsResponse.companies || []);
          } catch (error) {
            console.error("Failed to refresh connections:", error);
          }
          // Remove the connections parameter from URL
          setUrlState({ connections: null });
        }}
      />
    </div>
  );
}
