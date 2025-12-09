"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
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
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { XeroFieldMapping, XeroContactSync } from "./components/XeroTabs";
import { XeroPdfSyncStatus } from "./components/XeroPdfSyncStatus";
import { XeroConnectionsPopup } from "@/components/xero/XeroConnectionsPopup";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "connection";
  const showConnectionsParam = searchParams.get("connections");
  const [status, setStatus] = React.useState<XeroStatus | null>(null);
  const [tenants, setTenants] = React.useState<XeroTenant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [pdfSyncHealth, setPdfSyncHealth] = React.useState<PdfSyncHealth | null>(null);
  const [showConnectionsPopup, setShowConnectionsPopup] = React.useState(showConnectionsParam === "true");
  const [companyConnections, setCompanyConnections] = React.useState<CompanyXeroConnection[]>([]);

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
            api.get<{ success: boolean; companies: CompanyXeroConnection[] }>("/api/v1/xero/corporate_company_xero_connections"),
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
    setDisconnecting(true);
    try {
      await api.xero.disconnect();
      setStatus({ connected: false });
    } catch (error) {
      console.error("Failed to disconnect Xero:", error);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/settings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
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
          router.push(`/settings/integrations/xero?tab=${value}`);
        }}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connection">
            <Link2 className="h-4 w-4 mr-2" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="h-4 w-4 mr-2" />
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
        </TabsList>

        {/* Connection Tab */}
        <TabsContent value="connection" className="space-y-6">
          {/* Status Card */}
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
                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
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
            <CardContent className="space-y-6">
              {status?.connected ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Organization</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{status.tenant_name || status.organization_name || "Unknown"}</p>
                        {tenants.find(t => t.is_primary) && (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                            Primary
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Connected</p>
                      <p className="font-medium">
                        {tenants.find(t => t.is_primary)?.connected_at
                          ? new Date(tenants.find(t => t.is_primary)!.connected_at).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Unknown"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Token Expires</p>
                      <p className="font-medium">
                        {status.expires_at
                          ? new Date(status.expires_at).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "Unknown"}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-medium">
                        {status.expired ? (
                          <span className="text-red-600">Expired - Reconnect Required</span>
                        ) : (
                          <span className="text-green-600">Active</span>
                        )}
                      </p>
                    </div>
                  </div>

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
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Disconnect
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Not Connected</AlertTitle>
                    <AlertDescription>
                      Connect your Xero account to sync invoices, expenses, and financial data.
                    </AlertDescription>
                  </Alert>

                  <Button onClick={handleConnect} disabled={connecting}>
                    {connecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Connect to Xero
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

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
            <XeroPdfSyncStatus />
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
            onClick={() => router.push("/settings/integrations/xero?tab=connection")}
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
      </Tabs>

      {/* Xero Connections Popup */}
      <XeroConnectionsPopup
        isOpen={showConnectionsPopup}
        onClose={async () => {
          setShowConnectionsPopup(false);
          // Refresh company connections list
          try {
            const connectionsResponse = await api.get<{ success: boolean; companies: CompanyXeroConnection[] }>(
              "/api/v1/xero/corporate_company_xero_connections"
            );
            setCompanyConnections(connectionsResponse.companies || []);
          } catch (error) {
            console.error("Failed to refresh connections:", error);
          }
          // Remove the connections parameter from URL
          const params = new URLSearchParams(searchParams.toString());
          params.delete("connections");
          router.push(`/settings/integrations/xero?${params.toString()}`);
        }}
      />
    </div>
  );
}
