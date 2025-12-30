"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  FolderOpen,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Building2,
  ChevronDown,
  Database,
  Shield,
  Users,
  Key,
  Activity,
  Heart,
  Cloud,
  Link,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Organization-Wide Access Section (Admin Only)
// ============================================

interface OrgCredential {
  id: number;
  name: string;
  configured: boolean;
  status: string;
  tenant_id?: string;
  admin_consent_granted_at?: string;
  admin_consent_granted_by?: string;
  last_sync_at?: string;
  last_error?: string;
  token_valid?: boolean;
}

// Health info for per-org indicators (from health_dashboard endpoint)
interface OrgHealthInfo {
  token_valid: boolean;
  token_expires_at: string | null;
  consecutive_failures: number;
  last_refresh_attempt_at: string | null;
  last_error: string | null;
  self_healing_available: boolean;
}

interface OrgAppStatus {
  configured: boolean;
  status: string;
  tenant_id?: string;
  admin_consent_granted_at?: string;
  admin_consent_granted_by?: string;
  last_sync_at?: string;
  last_error?: string;
  token_valid?: boolean;
  env_configured?: boolean;
  organizations?: OrgCredential[];
}

interface TenantUser {
  id: string;
  name: string;
  email: string;
}

// Health dashboard data for 4-square display
interface HealthDashboard {
  overall_status: "healthy" | "warning" | "critical" | "disconnected";
  connected_count: number;
  total_count: number;
  needs_attention_count: number;
  warning_count: number;
  self_healing: {
    active: boolean;
    last_refresh_at: string | null;
    status: "active" | "inactive";
  };
  organizations: Array<{
    id: number;
    name: string;
    status: string;
    token_valid: boolean;
    token_expires_at: string | null;
    consecutive_failures: number;
    last_refresh_attempt_at: string | null;
    last_error: string | null;
    self_healing_available: boolean;
  }>;
}

// Pre-defined organizations that can be connected
const AVAILABLE_ORGANIZATIONS = [
  { name: "Tekna", description: "Tekna Group Microsoft 365" },
  { name: "100xBestLife", description: "100x Best Life Microsoft 365" },
  { name: "Homes of Hope", description: "Homes of Hope Microsoft 365" },
  { name: "Love Your World", description: "Love Your World Microsoft 365" },
];

// ============================================
// SharePoint Delegated Connection Component
// This creates an org-level delegated credential via OAuth
// which bypasses Azure AD Conditional Access issues
// ============================================
function SharePointDelegatedConnection() {
  const [status, setStatus] = React.useState<{
    connected: boolean;
    source?: string;
    drive_name?: string;
    connected_by?: { name?: string; email?: string };
    token_expires_at?: string;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  React.useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await api.get<typeof status>("/api/v1/organization_onedrive/status");
      setStatus(data);
    } catch (error) {
      console.error("Failed to load SharePoint status:", error);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const data = await api.get<{ auth_url: string }>("/api/v1/organization_onedrive/authorize");
      window.location.href = data.auth_url;
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect SharePoint delegated access?")) return;
    setDisconnecting(true);
    try {
      await api.delete("/api/v1/organization_onedrive/disconnect");
      setStatus({ connected: false });
    } catch (error) {
      console.error("Failed to disconnect:", error);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="flex items-center justify-center h-24">
          <Spinner size={24} className="text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isDelegated = status?.source === "organization_credential" || status?.source === "microsoft_credential";

  return (
    <Card className="border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20">
      <CardHeader className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                SharePoint Delegated Access
                <Badge variant="outline" className="text-xs font-normal bg-blue-100 dark:bg-blue-900">
                  Recommended
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                OAuth connection that bypasses Azure AD Conditional Access blocking
              </CardDescription>
            </div>
          </div>
          <Badge className={status?.connected && isDelegated
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}>
            {status?.connected && isDelegated ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {status?.connected && isDelegated ? (
          <>
            <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Drive</p>
                  <p className="font-medium">{status.drive_name || "SharePoint"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Connected By</p>
                  <p className="font-medium">{status.connected_by?.name || status.connected_by?.email || "Unknown"}</p>
                </div>
                {status.token_expires_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Token Expires</p>
                    <p className="font-medium">
                      {new Date(status.token_expires_at).toLocaleString("en-AU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadStatus}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleConnect} disabled={connecting}>
                {connecting ? <Spinner size={16} className="mr-2" /> : <Link className="h-4 w-4 mr-2" />}
                Reconnect
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? <Spinner size={16} className="mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-300">Why use this?</AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                App credentials (below) are blocked by Azure AD Conditional Access from Heroku.
                This OAuth flow creates a <strong>delegated credential</strong> from your trusted device
                that can be refreshed from anywhere.
              </AlertDescription>
            </Alert>
            <Button onClick={handleConnect} disabled={connecting} className="bg-blue-600 hover:bg-blue-700">
              {connecting ? (
                <Spinner size={16} className="mr-2" />
              ) : (
                <Cloud className="h-4 w-4 mr-2" />
              )}
              Connect SharePoint (OAuth)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MicrosoftIntegrationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [orgStatus, setOrgStatus] = React.useState<OrgAppStatus | null>(null);
  const [healthData, setHealthData] = React.useState<HealthDashboard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Track which org is currently being connected (null = none, string = org name)
  const [connectingOrg, setConnectingOrg] = React.useState<string | null>(null);

  // Check if user is admin (SSoT: backend returns role_names array, not role string)
  const isAdmin = user?.permissions?.includes("admin") ||
    (Array.isArray(user?.role_names) && user.role_names.some((r: string) => r.toLowerCase() === "admin"));

  // Check for callback params
  React.useEffect(() => {
    const consentSuccess = searchParams.get("app_consent_success");
    const consentError = searchParams.get("app_consent_error");

    if (consentSuccess) {
      // Refresh status after successful consent
      fetchStatus();
    }
    if (consentError) {
      setError(decodeURIComponent(consentError));
    }
  }, [searchParams]);

  const fetchStatus = async () => {
    try {
      const data = await api.get<OrgAppStatus>("/api/v1/microsoft_app/status");
      setOrgStatus(data);
    } catch (err) {
      console.error("Failed to fetch org app status:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthDashboard = async () => {
    try {
      const data = await api.get<HealthDashboard>("/api/v1/microsoft_app/health_dashboard");
      setHealthData(data);
    } catch (err) {
      console.error("Failed to fetch health dashboard:", err);
    }
  };

  React.useEffect(() => {
    if (isAdmin) {
      fetchStatus();
      fetchHealthDashboard();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const handleSetupOrg = async (orgName: string) => {
    // All orgs use the same Azure AD app credentials from env vars
    // Just redirect to Microsoft login with the org name
    setConnectingOrg(orgName);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; admin_consent_url?: string; message?: string; configured?: boolean }>(
        "/api/v1/microsoft_app/setup_from_env",
        { name: orgName }
      );

      // Check if credentials are not configured (local dev without env vars)
      if (response?.configured === false) {
        setError(response.message || "Microsoft 365 credentials not configured in environment");
        setConnectingOrg(null);
        return;
      }

      // Redirect to Microsoft login
      if (response?.admin_consent_url) {
        window.location.href = response.admin_consent_url;
      }
    } catch (err: unknown) {
      const error = err as { data?: { error?: string }; message?: string };
      setError(error.data?.error || error.message || "Failed to start connection");
      setConnectingOrg(null);
    }
  };

  // Get configured orgs and available orgs for setup
  const configuredOrgs = orgStatus?.organizations || [];
  const configuredOrgNames = new Set(configuredOrgs.map(o => o.name));
  const unconfiguredOrgs = AVAILABLE_ORGANIZATIONS.filter(o => !configuredOrgNames.has(o.name));

  // Count connected orgs
  const connectedCount = configuredOrgs.filter(o => o.status === "connected").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  // Don't show for non-admins
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/settings/integrations" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Microsoft 365 Integration</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organization-wide Microsoft 365 access
            </p>
          </div>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Admin Access Required</AlertTitle>
          <AlertDescription>
            Organization-wide Microsoft 365 access can only be configured by administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/settings/integrations" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Microsoft 365 Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organization-wide Microsoft 365 access
          </p>
        </div>
      </div>

      {/* Header Card */}
      <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800">
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Organization-Wide Microsoft Access
                  <Badge variant="outline" className="text-xs font-normal">
                    Admin Only
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Access emails and SharePoint/OneDrive from multiple Microsoft 365 organizations
                </CardDescription>
              </div>
            </div>
            <Badge className={connectedCount > 0 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}>
              {connectedCount}/{AVAILABLE_ORGANIZATIONS.length} Connected
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Health Dashboard - 4 Squares */}
      {healthData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Overall Status */}
          <Card className={`p-4 ${
            healthData.overall_status === "healthy" ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30" :
            healthData.overall_status === "warning" ? "border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/30" :
            healthData.overall_status === "critical" ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30" :
            "border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-950/30"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Heart className={`h-4 w-4 ${
                healthData.overall_status === "healthy" ? "text-green-600 dark:text-green-400" :
                healthData.overall_status === "warning" ? "text-yellow-600 dark:text-yellow-400" :
                healthData.overall_status === "critical" ? "text-red-600 dark:text-red-400" :
                "text-gray-400"
              }`} />
              <span className="text-xs text-muted-foreground font-medium">Overall Status</span>
            </div>
            <div className={`text-lg font-semibold capitalize ${
              healthData.overall_status === "healthy" ? "text-green-700 dark:text-green-300" :
              healthData.overall_status === "warning" ? "text-yellow-700 dark:text-yellow-300" :
              healthData.overall_status === "critical" ? "text-red-700 dark:text-red-300" :
              "text-gray-600 dark:text-gray-400"
            }`}>
              {healthData.overall_status === "healthy" ? "Healthy" :
               healthData.overall_status === "warning" ? "Warning" :
               healthData.overall_status === "critical" ? "Critical" :
               "Disconnected"}
            </div>
          </Card>

          {/* Connected Count */}
          <Card className="p-4 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-muted-foreground font-medium">Connected</span>
            </div>
            <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
              {healthData.connected_count}/{healthData.total_count} Orgs
            </div>
          </Card>

          {/* Needs Attention */}
          <Card className={`p-4 ${
            healthData.needs_attention_count > 0
              ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30"
              : "border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-950/30"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`h-4 w-4 ${
                healthData.needs_attention_count > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-400"
              }`} />
              <span className="text-xs text-muted-foreground font-medium">Needs Attention</span>
            </div>
            <div className={`text-lg font-semibold ${
              healthData.needs_attention_count > 0
                ? "text-red-700 dark:text-red-300"
                : "text-gray-600 dark:text-gray-400"
            }`}>
              {healthData.needs_attention_count} credential{healthData.needs_attention_count !== 1 ? "s" : ""}
            </div>
          </Card>

          {/* Self-Healing Status */}
          <Card className={`p-4 ${
            healthData.self_healing.active
              ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30"
              : "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Activity className={`h-4 w-4 ${
                healthData.self_healing.active
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`} />
              <span className="text-xs text-muted-foreground font-medium">Self-Healing</span>
            </div>
            <div className={`text-lg font-semibold ${
              healthData.self_healing.active
                ? "text-green-700 dark:text-green-300"
                : "text-red-700 dark:text-red-300"
            }`}>
              {healthData.self_healing.active ? "Active" : "Inactive"}
            </div>
            {healthData.self_healing.last_refresh_at && (
              <div className="text-xs text-muted-foreground mt-1">
                Last: {new Date(healthData.self_healing.last_refresh_at).toLocaleTimeString("en-AU", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* SharePoint Delegated Connection - Bypasses CA blocking */}
      <SharePointDelegatedConnection />

      {/* Organization Cards - Show each org as a separate card */}
      <div className="space-y-3">
        {/* Configured Organizations */}
        {configuredOrgs.map((org) => {
          // Find matching health info from health dashboard
          const healthInfo = healthData?.organizations?.find(h => h.name === org.name);
          return (
            <OrganizationCard
              key={org.id}
              org={org}
              onRefresh={fetchStatus}
              healthInfo={healthInfo}
            />
          );
        })}

        {/* Unconfigured Organizations - Show as setup cards */}
        {unconfiguredOrgs.map((org) => {
          const isThisOneConnecting = connectingOrg === org.name;

          return (
            <Card key={org.name} className={isThisOneConnecting ? "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20" : "border-dashed"}>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isThisOneConnecting ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"}`}>
                      {isThisOneConnecting ? (
                        <Spinner size={20} className="text-blue-500" />
                      ) : (
                        <Building2 className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{org.name}</CardTitle>
                      <CardDescription className="text-xs">{org.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isThisOneConnecting ? (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        <Spinner size={12} className="mr-1" />
                        Connecting...
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Connected
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => handleSetupOrg(org.name)}
                          disabled={connectingOrg !== null}
                        >
                          <Shield className="h-4 w-4 mr-1" />
                          Connect
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Individual Organization Card Component
function OrganizationCard({
  org,
  onRefresh,
  healthInfo,
}: {
  org: OrgCredential;
  onRefresh: () => void;
  healthInfo?: OrgHealthInfo;
}) {
  const [open, setOpen] = React.useState(org.status === "connected" || org.status === "pending");
  const [testing, setTesting] = React.useState(false);
  const [testingSharePoint, setTestingSharePoint] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);
  const [tenantUsers, setTenantUsers] = React.useState<TenantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [sharePointResult, setSharePointResult] = React.useState<{ success: boolean; message: string; sites?: { name: string; url: string }[] } | null>(null);
  const [syncResult, setSyncResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleRetryConsent = async () => {
    setRetrying(true);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; admin_consent_url?: string; message?: string; configured?: boolean }>(
        "/api/v1/microsoft_app/setup_from_env",
        { name: org.name }
      );

      // Check if credentials are not configured (local dev without env vars)
      if (response?.configured === false) {
        setError(response.message || "Microsoft 365 credentials not configured in environment");
        setRetrying(false);
        return;
      }

      if (response?.admin_consent_url) {
        window.location.href = response.admin_consent_url;
      }
    } catch (err: unknown) {
      const error = err as { data?: { error?: string }; message?: string };
      setError(error.data?.error || error.message || "Failed to retry consent");
      setRetrying(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; error?: string }>("/api/v1/microsoft_app/test", {
        organization_id: org.id
      });
      if (response?.success) {
        onRefresh();
      } else {
        setError(response?.error || "Connection test failed");
      }
    } catch (err: unknown) {
      const error = err as { data?: { error?: string }; message?: string };
      setError(error.data?.error || error.message || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleTestSharePoint = async () => {
    setTestingSharePoint(true);
    setSharePointResult(null);
    try {
      const response = await api.post<{ success: boolean; message: string; sample_sites?: { name: string; url: string }[]; error?: string }>(
        "/api/v1/microsoft_app/test_sharepoint",
        { organization_id: org.id }
      );
      setSharePointResult({
        success: response?.success || false,
        message: response?.success ? response.message : (response?.error || "SharePoint test failed"),
        sites: response?.sample_sites
      });
    } catch (err: unknown) {
      const error = err as { data?: { error?: string }; message?: string };
      setSharePointResult({
        success: false,
        message: error.data?.error || error.message || "SharePoint test failed"
      });
    } finally {
      setTestingSharePoint(false);
    }
  };

  const handleSyncToSharePoint = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await api.post<{ success: boolean; message: string; error?: string }>(
        "/api/v1/microsoft_app/sync_to_sharepoint",
        { organization_id: org.id }
      );
      setSyncResult({
        success: response?.success || false,
        message: response?.success ? response.message : (response?.error || "Sync failed")
      });
    } catch (err: unknown) {
      const error = err as { data?: { error?: string }; message?: string };
      setSyncResult({
        success: false,
        message: error.data?.error || error.message || "Sync failed"
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${org.name}?`)) return;

    setDisconnecting(true);
    try {
      await api.delete("/api/v1/microsoft_app/disconnect", {
        params: { organization_id: org.id }
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleLoadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await api.get<{ users: TenantUser[] }>("/api/v1/microsoft_app/users", {
        params: { organization_id: org.id }
      });
      setTenantUsers(response?.users || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  return (
    <Accordion
      type="single"
      collapsible
      value={open ? "org" : ""}
      onValueChange={(v) => setOpen(v === "org")}
    >
      <AccordionItem value="org" className="border-none">
        <Card className={org.status === "connected" ? "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20" : org.status === "error" ? "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20" : "border-yellow-200 bg-yellow-50/30 dark:border-yellow-800 dark:bg-yellow-950/20"}>
          <AccordionTrigger className="w-full text-left p-0 hover:no-underline [&>svg]:hidden">
            <CardHeader className="cursor-pointer hover:bg-opacity-50 transition-colors py-4 w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${org.status === "connected" ? "bg-green-100 dark:bg-green-900" : org.status === "error" ? "bg-red-100 dark:bg-red-900" : "bg-yellow-100 dark:bg-yellow-900"}`}>
                    <Shield className={`h-5 w-5 ${org.status === "connected" ? "text-green-600 dark:text-green-400" : org.status === "error" ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{org.name}</CardTitle>
                    <CardDescription className="text-xs font-mono">{org.tenant_id}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Health indicators from health dashboard */}
                  {healthInfo && healthInfo.consecutive_failures > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {healthInfo.consecutive_failures} failures
                    </Badge>
                  )}
                  {healthInfo?.token_expires_at && (() => {
                    const expiresAt = new Date(healthInfo.token_expires_at);
                    const now = new Date();
                    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
                    if (hoursUntilExpiry < 1 && hoursUntilExpiry > 0) {
                      return (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 text-xs">
                          Expires in {Math.round(hoursUntilExpiry * 60)}m
                        </Badge>
                      );
                    } else if (hoursUntilExpiry <= 0) {
                      return (
                        <Badge variant="destructive" className="text-xs">
                          Token expired
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                  {healthInfo?.self_healing_available && healthInfo.last_refresh_attempt_at && (() => {
                    const lastRefresh = new Date(healthInfo.last_refresh_attempt_at);
                    const now = new Date();
                    const minutesSinceRefresh = (now.getTime() - lastRefresh.getTime()) / (1000 * 60);
                    if (minutesSinceRefresh < 5) {
                      return (
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-xs">
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Self-healing
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                  {/* Status badge */}
                  {org.status === "connected" ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  ) : org.status === "pending" ? (
                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Pending Consent
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                  )}
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                </div>
              </div>
            </CardHeader>
          </AccordionTrigger>
          <AccordionContent>
          <CardContent className="pt-0 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {org.status === "connected" && (
              <>
                <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Consent Granted By</p>
                      <p className="text-sm">{org.admin_consent_granted_by || "Unknown"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Consent Granted</p>
                      <p className="text-sm">
                        {org.admin_consent_granted_at
                          ? new Date(org.admin_consent_granted_at).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last Sync</p>
                      <p className="text-sm">
                        {org.last_sync_at
                          ? new Date(org.last_sync_at).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Never"}
                      </p>
                    </div>
                    {/* Token Health Info */}
                    {healthInfo && (
                      <div>
                        <p className="text-xs text-muted-foreground">Token Status</p>
                        <p className={`text-sm font-medium ${healthInfo.token_valid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {healthInfo.token_valid ? "Valid" : "Invalid"}
                          {healthInfo.token_expires_at && (
                            <span className="font-normal text-muted-foreground ml-1">
                              (expires {new Date(healthInfo.token_expires_at).toLocaleDateString("en-AU", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })})
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Self-Healing Status Row */}
                  {healthInfo && (
                    <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                          Self-Healing: <span className={healthInfo.self_healing_available ? "text-green-600 dark:text-green-400" : "text-gray-400"}>
                            {healthInfo.self_healing_available ? "Enabled" : "Disabled"}
                          </span>
                        </span>
                        {healthInfo.last_refresh_attempt_at && (
                          <span className="text-muted-foreground">
                            Last refresh: {new Date(healthInfo.last_refresh_attempt_at).toLocaleTimeString("en-AU", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        {healthInfo.consecutive_failures > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            {healthInfo.consecutive_failures} consecutive failure{healthInfo.consecutive_failures !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {healthInfo.self_healing_available && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                          <Activity className="h-3 w-3 mr-1" />
                          Auto-refresh active
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Tenant Users */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Tenant Users
                    </h4>
                    <Button variant="outline" size="sm" onClick={handleLoadUsers} disabled={loadingUsers}>
                      {loadingUsers ? <Spinner size={12} /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                  </div>
                  {tenantUsers.length > 0 && (
                    <div className="max-h-32 overflow-y-auto border rounded-lg">
                      <Table className="w-full text-sm">
                        <TableHeader className="bg-muted sticky top-0">
                          <TableRow>
                            <TableHead className="text-left p-2 font-medium">Name</TableHead>
                            <TableHead className="text-left p-2 font-medium">Email</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tenantUsers.map((u) => (
                            <TableRow key={u.id} className="border-t">
                              <TableCell className="p-2">{u.name}</TableCell>
                              <TableCell className="p-2 text-muted-foreground">{u.email}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {sharePointResult && (
                  <Alert variant={sharePointResult.success ? "default" : "destructive"} className={sharePointResult.success ? "bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800" : ""}>
                    {sharePointResult.success ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertTitle>{sharePointResult.success ? "SharePoint Connected" : "SharePoint Error"}</AlertTitle>
                    <AlertDescription>
                      {sharePointResult.message}
                      {sharePointResult.sites && sharePointResult.sites.length > 0 && (
                        <ul className="mt-2 text-xs">
                          {sharePointResult.sites.map((site, i) => (
                            <li key={i}>• {site.name}</li>
                          ))}
                        </ul>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {syncResult && (
                  <Alert variant={syncResult.success ? "default" : "destructive"} className={syncResult.success ? "bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800" : ""}>
                    {syncResult.success ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertTitle>{syncResult.success ? "Sync Started" : "Sync Error"}</AlertTitle>
                    <AlertDescription>{syncResult.message}</AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                    {testing ? <Spinner size={16} className="mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                    Test Email
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleTestSharePoint} disabled={testingSharePoint}>
                    {testingSharePoint ? <Spinner size={16} className="mr-1" /> : <FolderOpen className="h-4 w-4 mr-1" />}
                    Test SharePoint
                  </Button>
                  <Button variant="default" size="sm" onClick={handleSyncToSharePoint} disabled={syncing} className="bg-blue-600 hover:bg-blue-700">
                    {syncing ? <Spinner size={16} className="mr-1" /> : <Database className="h-4 w-4 mr-1" />}
                    Sync to SharePoint
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? <Spinner size={16} className="mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                    Disconnect
                  </Button>
                </div>
              </>
            )}

            {org.status === "pending" && (
              <>
                <Alert>
                  <Key className="h-4 w-4" />
                  <AlertTitle>Admin Consent Required</AlertTitle>
                  <AlertDescription>
                    An Azure AD admin needs to grant organization-wide consent for {org.name}.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleRetryConsent} disabled={retrying}>
                    {retrying ? <Spinner size={16} className="mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Retry Consent
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? <Spinner size={16} className="mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {org.status === "error" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Connection Error</AlertTitle>
                <AlertDescription>{org.last_error || "Unknown error"}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
}
