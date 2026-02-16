"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Database,
  Shield,
  Activity,
  Heart,
  Cloud,
  Link,
  Plus,
  ChevronDown,
  UserPlus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/ui/back-button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { SYSTEM_ROLES } from "@/lib/constants/roles";
import { UI_COPY_FEEDBACK_MS } from "@/lib/constants/timeout-constants";
import { API } from "@/lib/constants/api-endpoints";
import useUrlState from "@/hooks/useUrlState";

// ============================================
// Types
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

interface TenantUser {
  id: string;
  name: string;
  email: string;
  account_enabled?: boolean;
  has_license?: boolean;
  license_names?: string[];
  mailbox_type?: "user" | "shared";
}

interface MailboxStat {
  email: string;
  email_count: number;
  unread_count: number;
  attachment_count: number;
  blob_count: number;
  email_blob_count: number;
  content_unavailable_count: number;
  last_synced_at: string | null;
  last_email_received_at: string | null;
}

interface OrgSyncStats {
  id: number;
  type: string;
  name: string;
  total_emails: number;
  mailboxes: MailboxStat[];
  tenant_users?: TenantUser[];
  sync_config?: {
    sync_all: boolean;
    sync_years: number;
    mailbox_synced_at?: Record<string, string>;
    mailbox_error_counts?: Record<string, number>;
    mailbox_errors?: Record<string, {
      message: string;
      type: "permanent" | "transient";
      count: number;
      last_at: string;
    }>;
  };
}

interface SyncDashboard {
  total_emails: number;
  total_mailboxes: number;
  organizations: OrgSyncStats[];
  teeem_user_emails?: string[];
}

interface SharePointStatus {
  connected: boolean;
  source?: string;
  drive_name?: string;
  connected_by?: { name?: string; email?: string };
  token_expires_at?: string;
  error?: string;
}

interface SharePointTestResult {
  success: boolean;
  message: string;
  sites?: { name: string; url: string }[];
}

interface SyncResult {
  success: boolean;
  message: string;
}

// ============================================
// Helpers
// ============================================

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function formatAbsoluteTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function tokenExpiryBadge(expiresAt: string | null): React.ReactNode {
  if (!expiresAt) return null;
  const expires = new Date(expiresAt);
  const now = new Date();
  const hoursLeft = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursLeft <= 0) {
    return <Badge variant="destructive" className="text-xs">Expired</Badge>;
  }
  if (hoursLeft < 1) {
    return (
      <Badge className="bg-status-error text-status-error-foreground dark:bg-red-900 dark:text-red-300 text-xs">
        {Math.round(hoursLeft * 60)}m
      </Badge>
    );
  }
  return (
    <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900 dark:text-green-300 text-xs">
      Valid
    </Badge>
  );
}

function statusBadge(status: string): React.ReactNode {
  if (status === "connected") {
    return (
      <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900 dark:text-green-300">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Connected
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge className="bg-status-warning text-status-warning-foreground dark:bg-yellow-900 dark:text-yellow-300">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <XCircle className="h-3 w-3 mr-1" />
      {status === "dead" ? "Expired" : "Error"}
    </Badge>
  );
}

function overallStatusBadge(status: string): React.ReactNode {
  const config: Record<string, { label: string; className: string }> = {
    healthy: { label: "Healthy", className: "bg-status-success text-status-success-foreground dark:bg-green-900 dark:text-green-300" },
    warning: { label: "Warning", className: "bg-status-warning text-status-warning-foreground dark:bg-yellow-900 dark:text-yellow-300" },
    critical: { label: "Critical", className: "bg-status-error text-status-error-foreground dark:bg-red-900 dark:text-red-300" },
    disconnected: { label: "Disconnected", className: "bg-muted text-foreground dark:bg-card dark:text-muted-foreground" },
  };
  const c = config[status] || config.disconnected;
  return <Badge className={c.className}>{c.label}</Badge>;
}

// ============================================
// Main Page Component
// ============================================

export default function MicrosoftIntegrationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const searchParams = useSearchParams();

  // SSoT: URL state for tab
  const [urlState, setUrlState] = useUrlState({
    tab: null as string | null,
  });
  const currentTab = urlState.tab || "organizations";

  // Core state - loaded on page mount
  const [orgStatus, setOrgStatus] = React.useState<OrgAppStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Add org state
  const [connectingOrg, setConnectingOrg] = React.useState<string | null>(null);
  const [newOrgName, setNewOrgName] = React.useState(currentTenant?.name || "");
  const [consentUrl, setConsentUrl] = React.useState<string | null>(null);
  const [consentOrgName, setConsentOrgName] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);
  const [waitingForConsent, setWaitingForConsent] = React.useState(false);

  // Lazy-loaded tab data
  const [healthData, setHealthData] = React.useState<HealthDashboard | null>(null);
  const [healthLoading, setHealthLoading] = React.useState(false);
  const [syncDashboard, setSyncDashboard] = React.useState<SyncDashboard | null>(null);
  const [syncLoading, setSyncLoading] = React.useState(false);
  const [sharePointStatus, setSharePointStatus] = React.useState<SharePointStatus | null>(null);
  const [sharePointLoading, setSharePointLoading] = React.useState(false);

  // Track which tabs have been loaded (prevent refetch on re-visit)
  const loadedTabsRef = React.useRef<Set<string>>(new Set());

  const isAdmin = user?.permissions?.includes(SYSTEM_ROLES.ADMIN) ||
    (Array.isArray(user?.role_names) && user.role_names.some((r: string) => r.toLowerCase() === SYSTEM_ROLES.ADMIN));

  const configuredOrgs = orgStatus?.organizations || [];
  const connectedCount = configuredOrgs.filter(o => o.status === "connected").length;
  const totalOrgs = configuredOrgs.length;

  // ---- API calls ----

  const fetchStatus = React.useCallback(async () => {
    try {
      const data = await api.get<OrgAppStatus>("/api/v1/microsoft_app/status");
      setOrgStatus(data);
    } catch (err) {
      console.error("Failed to fetch org app status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHealthDashboard = React.useCallback(async () => {
    if (loadedTabsRef.current.has("health")) return;
    setHealthLoading(true);
    try {
      const data = await api.get<HealthDashboard>("/api/v1/microsoft_app/health_dashboard");
      setHealthData(data);
      loadedTabsRef.current.add("health");
    } catch (err) {
      console.error("Failed to fetch health dashboard:", err);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchSyncDashboard = React.useCallback(async () => {
    if (loadedTabsRef.current.has("email-sync")) return;
    setSyncLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: SyncDashboard }>("/api/v1/synced_emails/sync_dashboard");
      setSyncDashboard(response?.data || null);
      loadedTabsRef.current.add("email-sync");
    } catch (err) {
      console.error("Failed to fetch sync dashboard:", err);
    } finally {
      setSyncLoading(false);
    }
  }, []);

  const fetchSharePointStatus = React.useCallback(async () => {
    if (loadedTabsRef.current.has("sharepoint")) return;
    setSharePointLoading(true);
    try {
      const data = await api.get<SharePointStatus>(API.documents.status);
      setSharePointStatus(data);
      loadedTabsRef.current.add("sharepoint");
    } catch (err) {
      console.error("Failed to fetch SharePoint status:", err);
      setSharePointStatus({ connected: false });
    } finally {
      setSharePointLoading(false);
    }
  }, []);

  // Handle consent callback params
  React.useEffect(() => {
    const consentSuccess = searchParams.get("app_consent_success");
    const consentError = searchParams.get("app_consent_error");
    if (consentSuccess) fetchStatus();
    if (consentError) setError(decodeURIComponent(consentError));
  }, [searchParams, fetchStatus]);

  // Initial load
  React.useEffect(() => {
    if (isAdmin) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, [isAdmin, fetchStatus]);

  // Lazy load tab data when tab changes
  React.useEffect(() => {
    if (!isAdmin) return;
    if (currentTab === "email-sync") fetchSyncDashboard();
    if (currentTab === "sharepoint") fetchSharePointStatus();
    if (currentTab === "health") fetchHealthDashboard();
  }, [currentTab, isAdmin, fetchSyncDashboard, fetchSharePointStatus, fetchHealthDashboard]);

  // Poll for consent completion
  React.useEffect(() => {
    if (!waitingForConsent || !consentOrgName) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get<{ configured: boolean; organizations: Array<{ name: string; status: string }> }>(
          "/api/v1/microsoft_app/status"
        );
        const org = res.organizations?.find(o => o.name === consentOrgName);
        if (org?.status === "connected") {
          setWaitingForConsent(false);
          setConsentUrl(null);
          window.location.reload();
        }
      } catch { /* ignore polling errors */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [waitingForConsent, consentOrgName]);

  const handleSetupOrg = async (orgName: string) => {
    setConnectingOrg(orgName);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; admin_consent_url?: string; message?: string; configured?: boolean }>(
        "/api/v1/microsoft_app/setup_from_env",
        { name: orgName }
      );
      if (response?.configured === false) {
        setError(response.message || "Microsoft 365 credentials not configured in environment");
        setConnectingOrg(null);
        return;
      }
      if (response?.admin_consent_url) {
        setConsentUrl(response.admin_consent_url);
        setConsentOrgName(orgName);
        setCopied(false);
      }
      setConnectingOrg(null);
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      setError(e.data?.error || e.message || "Failed to start connection");
      setConnectingOrg(null);
    }
  };

  // ---- Loading & non-admin states ----

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/settings/integrations" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Microsoft 365 Integration</h1>
            <p className="text-sm text-muted-foreground mt-1">Organization-wide Microsoft 365 access</p>
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

  // ---- Main render ----

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/settings/integrations" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight font-serif">Microsoft 365 Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organization-wide Microsoft 365 access
          </p>
        </div>
        {/* Summary badges */}
        <div className="flex items-center gap-2">
          {healthData && overallStatusBadge(healthData.overall_status)}
          <Badge variant="outline" className="text-xs">
            {connectedCount}/{totalOrgs} Connected
          </Badge>
          {healthData?.self_healing.active && (
            <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Self-Healing
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={currentTab}
        onValueChange={(value) => {
          setUrlState({ tab: value === "organizations" ? null : value });
        }}
      >
        <TabsList>
          <TabsTrigger value="organizations">
            <Building2 className="h-4 w-4 mr-2" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="email-sync">
            <Mail className="h-4 w-4 mr-2" />
            Email Sync
          </TabsTrigger>
          <TabsTrigger value="sharepoint">
            <Cloud className="h-4 w-4 mr-2" />
            SharePoint
          </TabsTrigger>
          <TabsTrigger value="health">
            <Heart className="h-4 w-4 mr-2" />
            Health
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Organizations */}
        <TabsContent value="organizations">
          <OrganizationsTab
            orgs={configuredOrgs}
            connectedCount={connectedCount}
            totalOrgs={totalOrgs}
            onRefresh={fetchStatus}
            onSetupOrg={handleSetupOrg}
            connectingOrg={connectingOrg}
            newOrgName={newOrgName}
            setNewOrgName={setNewOrgName}
            consentUrl={consentUrl}
            setConsentUrl={setConsentUrl}
            consentOrgName={consentOrgName}
            copied={copied}
            setCopied={setCopied}
            waitingForConsent={waitingForConsent}
            setWaitingForConsent={setWaitingForConsent}
            healthData={healthData}
          />
        </TabsContent>

        {/* Tab 2: Email Sync */}
        <TabsContent value="email-sync">
          <EmailSyncTab
            syncDashboard={syncDashboard}
            loading={syncLoading}
            orgs={configuredOrgs}
            onRefresh={() => {
              loadedTabsRef.current.delete("email-sync");
              fetchSyncDashboard();
            }}
          />
        </TabsContent>

        {/* Tab 3: SharePoint */}
        <TabsContent value="sharepoint">
          <SharePointTab
            sharePointStatus={sharePointStatus}
            setSharePointStatus={setSharePointStatus}
            loading={sharePointLoading}
            orgs={configuredOrgs}
            onRefreshStatus={() => {
              loadedTabsRef.current.delete("sharepoint");
              fetchSharePointStatus();
            }}
          />
        </TabsContent>

        {/* Tab 4: Health */}
        <TabsContent value="health">
          <HealthTab
            healthData={healthData}
            loading={healthLoading}
            orgs={configuredOrgs}
            onRefresh={() => {
              loadedTabsRef.current.delete("health");
              fetchHealthDashboard();
            }}
            onRefreshStatus={fetchStatus}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// Tab 1: Organizations
// ============================================

function OrganizationsTab({
  orgs,
  connectedCount,
  totalOrgs,
  onRefresh,
  onSetupOrg,
  connectingOrg,
  newOrgName,
  setNewOrgName,
  consentUrl,
  setConsentUrl,
  consentOrgName,
  copied,
  setCopied,
  waitingForConsent,
  setWaitingForConsent,
  healthData,
}: {
  orgs: OrgCredential[];
  connectedCount: number;
  totalOrgs: number;
  onRefresh: () => void;
  onSetupOrg: (name: string) => void;
  connectingOrg: string | null;
  newOrgName: string;
  setNewOrgName: (v: string) => void;
  consentUrl: string | null;
  setConsentUrl: (v: string | null) => void;
  consentOrgName: string;
  copied: boolean;
  setCopied: (v: boolean) => void;
  waitingForConsent: boolean;
  setWaitingForConsent: (v: boolean) => void;
  healthData: HealthDashboard | null;
}) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [disconnectingId, setDisconnectingId] = React.useState<number | null>(null);

  const handleDisconnect = async (org: OrgCredential) => {
    if (!(await confirm(`Are you sure you want to disconnect ${org.name}?`))) return;
    setDisconnectingId(org.id);
    try {
      await api.delete("/api/v1/microsoft_app/disconnect", { params: { organization_id: org.id } });
      onRefresh();
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Org Table */}
      {orgs.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Tenant ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((org) => {
                  const healthOrg = healthData?.organizations?.find(h => h.name === org.name);
                  return (
                    <TableRow
                      key={org.id}
                      className={
                        org.status === "error" || org.status === "dead"
                          ? "bg-red-50/50 dark:bg-red-950/10"
                          : org.status === "pending"
                            ? "bg-yellow-50/50 dark:bg-yellow-950/10"
                            : ""
                      }
                    >
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {org.tenant_id || "—"}
                      </TableCell>
                      <TableCell>{statusBadge(org.status)}</TableCell>
                      <TableCell>
                        {healthOrg ? tokenExpiryBadge(healthOrg.token_expires_at) : (
                          org.token_valid
                            ? <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900 dark:text-green-300 text-xs">Valid</Badge>
                            : <Badge variant="outline" className="text-xs text-muted-foreground">Unknown</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDisconnect(org)}
                          disabled={disconnectingId === org.id}
                        >
                          {disconnectingId === org.id ? (
                            <Spinner size={14} className="mr-1" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                          )}
                          Disconnect
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {orgs.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-lg font-medium">No organizations connected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add a Microsoft 365 organization below to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Consent URL Card */}
      {consentUrl && (
        <Card className="border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="py-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Link className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-base">Admin Consent Link for {consentOrgName}</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Send this link to {consentOrgName}&apos;s Microsoft 365 Global Admin. They click it, sign in, and approve.
              </CardDescription>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={consentUrl}
                  className="text-xs font-mono flex-1 bg-white dark:bg-card"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="sm"
                  variant={copied ? "default" : "outline"}
                  onClick={() => {
                    navigator.clipboard.writeText(consentUrl);
                    setCopied(true);
                    setWaitingForConsent(true);
                    setTimeout(() => setCopied(false), UI_COPY_FEEDBACK_MS);
                  }}
                  className="shrink-0"
                >
                  {copied ? "Copied!" : "Copy Link"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const subject = encodeURIComponent(`Link to Connect ${consentOrgName} to Teeem`);
                    const body = encodeURIComponent(`Hi,\n\nPlease find the link to connect ${consentOrgName} to Teeem's Microsoft 365 integration.\n\nClick the link below, sign in with your Global Admin account, and approve:\n\n${consentUrl}\n\nOnce approved, we'll be able to access your organization's emails and SharePoint.\n\nBest regards`);
                    router.push(`/email?compose_to=&compose_subject=${subject}&compose_body=${body}&compose_from=${encodeURIComponent("setup@teeem.com.au")}`);
                    setWaitingForConsent(true);
                  }}
                  className="shrink-0"
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Send Email
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setConsentUrl(null);
                    setWaitingForConsent(false);
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
              {waitingForConsent && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner size={14} />
                  <span>Waiting for {consentOrgName}&apos;s admin to approve... (checking every 5s)</span>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Add New Organization */}
      <Card className="border-dashed">
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted dark:bg-card">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Add Microsoft 365 Organization</CardTitle>
                <CardDescription className="text-xs">Connect a new Microsoft 365 tenant</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Organization name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="w-48 h-8 text-sm"
                disabled={connectingOrg !== null}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newOrgName.trim()) {
                    onSetupOrg(newOrgName.trim());
                    setNewOrgName("");
                  }
                }}
              />
              {connectingOrg ? (
                <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  <Spinner size={12} className="mr-1" />
                  Connecting...
                </Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    if (newOrgName.trim()) {
                      onSetupOrg(newOrgName.trim());
                      setNewOrgName("");
                    }
                  }}
                  disabled={!newOrgName.trim() || connectingOrg !== null}
                >
                  <Link className="h-4 w-4 mr-1" />
                  Create Link
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

// ============================================
// Tab 2: Email Sync
// ============================================

function EmailSyncTab({
  syncDashboard,
  loading,
  orgs,
  onRefresh,
}: {
  syncDashboard: SyncDashboard | null;
  loading: boolean;
  orgs: OrgCredential[];
  onRefresh: () => void;
}) {
  // Per-org collapsible state - default all expanded
  const [expandedOrgs, setExpandedOrgs] = React.useState<Set<number>>(
    new Set(orgs.filter(o => o.status === "connected").map(o => o.id))
  );
  const [importing, setImporting] = React.useState(false);

  const toggleOrg = (orgId: number) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={24} className="text-muted-foreground mr-2" />
        <span className="text-muted-foreground">Loading email sync data...</span>
      </div>
    );
  }

  if (!syncDashboard) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Mail className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No email sync data available</p>
          <p className="text-sm text-muted-foreground mt-1">
            Connect an organization first to start syncing emails.
          </p>
        </CardContent>
      </Card>
    );
  }

  const connectedOrgs = orgs.filter(o => o.status === "connected");

  // Compute importable user count: licensed M365 users not already in TEEEM
  const teeemEmails = new Set(
    (syncDashboard?.teeem_user_emails || []).map(e => e.toLowerCase())
  );
  const importableByOrg = new Map<number, number>();
  for (const org of connectedOrgs) {
    const orgStats = syncDashboard?.organizations?.find(o => o.id === org.id);
    const count = (orgStats?.tenant_users || []).filter(
      u => u.has_license && u.mailbox_type === "user" && u.email && !teeemEmails.has(u.email.toLowerCase())
    ).length;
    if (count > 0) importableByOrg.set(org.id, count);
  }
  const totalImportable = Array.from(importableByOrg.values()).reduce((a, b) => a + b, 0);

  const handleImport = async (orgId: number) => {
    setImporting(true);
    try {
      const result = await api.post<{ success: boolean; imported: number; skipped: number; errors: string[] }>(
        "/api/v1/users/import_from_microsoft",
        { organization_id: orgId }
      );
      if (result?.imported) {
        alert(`Imported ${result.imported} user${result.imported !== 1 ? "s" : ""} successfully.${result.skipped ? ` ${result.skipped} skipped.` : ""}`);
      } else if (result?.errors?.length) {
        alert(`Import failed:\n${result.errors.slice(0, 5).join("\n")}${result.errors.length > 5 ? `\n...and ${result.errors.length - 5} more` : ""}`);
      } else {
        alert("No new users to import.");
      }
      onRefresh();
    } catch (err) {
      console.error("Import failed:", err);
      alert("Failed to import users. Check console for details.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Overview */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{(syncDashboard.total_emails ?? 0).toLocaleString()}</span> emails across{" "}
          <span className="font-medium text-foreground">{syncDashboard.total_mailboxes ?? 0}</span> mailboxes
        </p>
        <div className="flex items-center gap-2">
          {totalImportable > 0 && connectedOrgs.length === 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleImport(connectedOrgs[0].id)}
              disabled={importing}
            >
              {importing ? (
                <Spinner size={14} className="mr-1" />
              ) : (
                <UserPlus className="h-3.5 w-3.5 mr-1" />
              )}
              Import {totalImportable} User{totalImportable !== 1 ? "s" : ""}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Per-org sections */}
      {connectedOrgs.map((org) => {
        const orgStats = syncDashboard.organizations?.find(o => o.id === org.id);
        const isExpanded = expandedOrgs.has(org.id);

        // Build unified row list: merge tenant users with synced mailbox stats
        const tenantUsers = orgStats?.tenant_users || [];
        const syncedEmailMap = new Map(
          (orgStats?.mailboxes || []).map(m => [m.email.toLowerCase(), m])
        );
        // FRC (Feb 2026): Use per-mailbox sync tracking (SSoT) to determine "synced" status.
        // A mailbox is "synced" if it has email records OR has been processed by the sync job.
        // Without this, mailboxes with 0 emails (room mailboxes, service accounts) show as
        // "not synced" forever, making the X/Y counter misleading.
        const mailboxSyncedAt: Record<string, string> = orgStats?.sync_config?.mailbox_synced_at || {};

        const mailboxErrors = orgStats?.sync_config?.mailbox_errors || {};
        const mailboxErrorCounts = orgStats?.sync_config?.mailbox_error_counts || {};

        type CombinedRow = {
          email: string;
          name: string;
          synced: boolean;
          mailboxStat: MailboxStat | null;
          tenantUser: TenantUser | null;
          errorInfo: { message: string; type: string; count: number; last_at: string } | null;
        };

        const combined: CombinedRow[] = [];
        const seenEmails = new Set<string>();

        // Add all tenant users (with sync data merged in)
        for (const user of tenantUsers) {
          if (!user.email) continue;
          const emailLower = user.email.toLowerCase();
          seenEmails.add(emailLower);
          combined.push({
            email: user.email,
            name: user.name,
            synced: syncedEmailMap.has(emailLower) || !!mailboxSyncedAt[emailLower],
            mailboxStat: syncedEmailMap.get(emailLower) || null,
            tenantUser: user,
            errorInfo: mailboxErrors[emailLower] || null,
          });
        }

        // Add synced mailboxes that aren't in tenant users (edge case: external/removed users)
        for (const m of orgStats?.mailboxes || []) {
          const emailLower = m.email.toLowerCase();
          if (!seenEmails.has(emailLower)) {
            combined.push({
              email: m.email,
              name: m.email.split("@")[0],
              synced: true,
              mailboxStat: m,
              tenantUser: null,
              errorInfo: mailboxErrors[emailLower] || null,
            });
          }
        }

        // Sort: synced first, then errored (by error count desc), then unsynced (alphabetical)
        combined.sort((a, b) => {
          if (a.synced && !b.synced) return -1;
          if (!a.synced && b.synced) return 1;
          if (a.synced && b.synced) return (b.mailboxStat?.email_count ?? 0) - (a.mailboxStat?.email_count ?? 0);
          return a.email.localeCompare(b.email);
        });

        const syncedCount = combined.filter(r => r.synced).length;
        const erroredCount = combined.filter(r => r.errorInfo?.type === "permanent").length;
        const totalCount = combined.length;

        return (
          <Card key={org.id}>
            <CardHeader
              className="py-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => toggleOrg(org.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                  <CardTitle className="text-base">{org.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {syncedCount}/{totalCount} synced
                  </Badge>
                  {erroredCount > 0 && (
                    <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                      {erroredCount} errored
                    </Badge>
                  )}
                  {orgStats && (
                    <span className="text-xs text-muted-foreground">
                      {(orgStats.total_emails ?? 0).toLocaleString()} emails
                    </span>
                  )}
                </div>
                {importableByOrg.has(org.id) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleImport(org.id); }}
                    disabled={importing}
                    className="shrink-0"
                  >
                    {importing ? (
                      <Spinner size={14} className="mr-1" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5 mr-1" />
                    )}
                    Import {importableByOrg.get(org.id)} User{(importableByOrg.get(org.id) ?? 0) !== 1 ? "s" : ""}
                  </Button>
                )}
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="pt-0">
                {combined.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <TooltipProvider>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>License</TableHead>
                            <TableHead className="text-right">Emails</TableHead>
                            <TableHead className="text-right">Upload .eml Body</TableHead>
                            <TableHead className="text-right">Download Attachments</TableHead>
                            <TableHead className="text-right">Last Synced</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {combined.map((row) => (
                            <TableRow key={row.email} className={row.synced ? "" : row.errorInfo?.type === "permanent" ? "opacity-80 bg-red-500/5" : "opacity-60"}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{row.name}</span>
                                  <span className="font-mono text-xs text-muted-foreground">{row.email}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {row.errorInfo?.type === "permanent" ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 cursor-help">
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Sync Error
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p className="font-medium">Permanently failing ({row.errorInfo.count}x)</p>
                                      <p className="text-xs mt-1 opacity-80">{row.errorInfo.message}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : row.errorInfo?.type === "transient" ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 cursor-help">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        Retrying
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p className="font-medium">Transient error (will retry)</p>
                                      <p className="text-xs mt-1 opacity-80">{row.errorInfo.message}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : row.tenantUser ? (
                                  row.tenantUser.account_enabled !== false ? (
                                    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                      Active
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                                      Disabled
                                    </Badge>
                                  )
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {row.tenantUser?.mailbox_type === "shared" ? (
                                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                                    Shared
                                  </Badge>
                                ) : row.tenantUser ? (
                                  <span className="text-xs text-muted-foreground">User</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {row.tenantUser?.license_names && row.tenantUser.license_names.length > 0 ? (
                                  <span className="text-xs">{row.tenantUser.license_names.join(", ")}</span>
                                ) : row.tenantUser ? (
                                  <span className="text-xs text-muted-foreground">None</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.synced ? (row.mailboxStat?.email_count ?? 0).toLocaleString() : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {row.synced && row.mailboxStat ? (() => {
                                  const total = row.mailboxStat.email_count;
                                  const uploaded = row.mailboxStat.email_blob_count ?? 0;
                                  const unavailable = row.mailboxStat.content_unavailable_count ?? 0;
                                  const pending = total - uploaded - unavailable;
                                  if (total === 0) return <span className="text-muted-foreground">—</span>;
                                  const isComplete = pending <= 0;
                                  return (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={isComplete ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                                          {isComplete ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <RefreshCw className="h-3 w-3 inline mr-1 animate-spin" />}
                                          {uploaded.toLocaleString()}/{total.toLocaleString()}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{uploaded.toLocaleString()} .eml files uploaded to storage</p>
                                        {unavailable > 0 && <p>{unavailable.toLocaleString()} permanently unavailable</p>}
                                        {pending > 0 && <p>{pending.toLocaleString()} pending upload (runs every 5 min)</p>}
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })() : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {row.synced && row.mailboxStat ? (() => {
                                  const total = row.mailboxStat.attachment_count ?? 0;
                                  const downloaded = row.mailboxStat.blob_count ?? 0;
                                  const pending = total - downloaded;
                                  if (total === 0) return <span className="text-muted-foreground">—</span>;
                                  const isComplete = pending <= 0;
                                  return (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={isComplete ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                                          {isComplete ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <AlertTriangle className="h-3 w-3 inline mr-1" />}
                                          {downloaded.toLocaleString()}/{total.toLocaleString()}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{downloaded.toLocaleString()} attachment files downloaded</p>
                                        {pending > 0 && <p>{pending.toLocaleString()} pending download</p>}
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })() : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {row.synced && row.mailboxStat?.last_synced_at ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-muted-foreground cursor-default">
                                        {formatRelativeTime(row.mailboxStat.last_synced_at)}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{formatAbsoluteTime(row.mailboxStat.last_synced_at)}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : row.synced ? (
                                  <span className="text-muted-foreground">Never</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TooltipProvider>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No mailbox data available for this organization.
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {connectedOrgs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No connected organizations. Connect an organization in the Organizations tab first.
        </p>
      )}
    </div>
  );
}

// ============================================
// Tab 3: SharePoint
// ============================================

function SharePointTab({
  sharePointStatus,
  setSharePointStatus,
  loading,
  orgs,
  onRefreshStatus,
}: {
  sharePointStatus: SharePointStatus | null;
  setSharePointStatus: (v: SharePointStatus | null) => void;
  loading: boolean;
  orgs: OrgCredential[];
  onRefreshStatus: () => void;
}) {
  const { confirm } = useConfirm();
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  // Per-org SharePoint test/sync state
  const [testResults, setTestResults] = React.useState<Record<number, SharePointTestResult>>({});
  const [syncResults, setSyncResults] = React.useState<Record<number, SyncResult>>({});
  const [testingOrgId, setTestingOrgId] = React.useState<number | null>(null);
  const [syncingOrgId, setSyncingOrgId] = React.useState<number | null>(null);

  const isDelegated = sharePointStatus?.source === "organization_credential" || sharePointStatus?.source === "microsoft_credential";

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const data = await api.get<{ auth_url: string }>("/api/v1/documents/authorize");
      window.location.href = data.auth_url;
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!(await confirm("Disconnect SharePoint delegated access?"))) return;
    setDisconnecting(true);
    try {
      await api.delete("/api/v1/documents/disconnect");
      setSharePointStatus({ connected: false });
    } catch (error) {
      console.error("Failed to disconnect:", error);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTestSharePoint = async (orgId: number) => {
    setTestingOrgId(orgId);
    try {
      const response = await api.post<{ success: boolean; message: string; sample_sites?: { name: string; url: string }[]; error?: string }>(
        "/api/v1/microsoft_app/test_sharepoint",
        { organization_id: orgId }
      );
      setTestResults(prev => ({
        ...prev,
        [orgId]: {
          success: response?.success || false,
          message: response?.success ? response.message : (response?.error || "Test failed"),
          sites: response?.sample_sites,
        },
      }));
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      setTestResults(prev => ({
        ...prev,
        [orgId]: { success: false, message: e.data?.error || e.message || "Test failed" },
      }));
    } finally {
      setTestingOrgId(null);
    }
  };

  const handleSyncToSharePoint = async (orgId: number) => {
    setSyncingOrgId(orgId);
    try {
      const response = await api.post<{ success: boolean; message: string; error?: string }>(
        "/api/v1/microsoft_app/sync_to_sharepoint",
        { organization_id: orgId }
      );
      setSyncResults(prev => ({
        ...prev,
        [orgId]: {
          success: response?.success || false,
          message: response?.success ? response.message : (response?.error || "Sync failed"),
        },
      }));
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      setSyncResults(prev => ({
        ...prev,
        [orgId]: { success: false, message: e.data?.error || e.message || "Sync failed" },
      }));
    } finally {
      setSyncingOrgId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={24} className="text-muted-foreground mr-2" />
        <span className="text-muted-foreground">Loading SharePoint status...</span>
      </div>
    );
  }

  const connectedOrgs = orgs.filter(o => o.status === "connected");

  return (
    <div className="flex flex-col gap-4">
      {/* Delegated Connection Card */}
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
            <Badge className={sharePointStatus?.connected && isDelegated
              ? "bg-status-success text-status-success-foreground dark:bg-green-900 dark:text-green-300"
              : "bg-muted text-foreground dark:bg-card dark:text-muted-foreground"}>
              {sharePointStatus?.connected && isDelegated ? (
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
          {sharePointStatus?.connected && isDelegated ? (
            <>
              <div className="p-3 bg-white dark:bg-background rounded-lg border">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Drive</p>
                    <p className="font-medium">{sharePointStatus.drive_name || "Cloud Storage"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Connected By</p>
                    <p className="font-medium">{sharePointStatus.connected_by?.name || sharePointStatus.connected_by?.email || "Unknown"}</p>
                  </div>
                  {sharePointStatus.token_expires_at && (
                    <div>
                      <p className="text-xs text-muted-foreground">Token Expires</p>
                      <p className="font-medium">
                        {new Date(sharePointStatus.token_expires_at).toLocaleString("en-AU", {
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
                <Button variant="outline" size="sm" onClick={onRefreshStatus}>
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

      {/* Per-org test/sync */}
      {connectedOrgs.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Per-Organization SharePoint Access</CardTitle>
            <CardDescription className="text-xs">Test or sync SharePoint for each connected organization</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectedOrgs.map((org) => {
                  const testResult = testResults[org.id];
                  const syncResult = syncResults[org.id];
                  const resultMsg = testResult || syncResult;

                  return (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>
                        {resultMsg && (
                          <span className={`text-xs ${resultMsg.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {resultMsg.success ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <XCircle className="h-3 w-3 inline mr-1" />}
                            {resultMsg.message}
                            {testResult?.sites && testResult.sites.length > 0 && (
                              <span className="text-muted-foreground ml-1">({testResult.sites.length} sites)</span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestSharePoint(org.id)}
                            disabled={testingOrgId === org.id}
                          >
                            {testingOrgId === org.id ? (
                              <Spinner size={14} className="mr-1" />
                            ) : (
                              <FolderOpen className="h-3.5 w-3.5 mr-1" />
                            )}
                            Test
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSyncToSharePoint(org.id)}
                            disabled={syncingOrgId === org.id}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {syncingOrgId === org.id ? (
                              <Spinner size={14} className="mr-1" />
                            ) : (
                              <Database className="h-3.5 w-3.5 mr-1" />
                            )}
                            Sync
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// Tab 4: Health
// ============================================

function HealthTab({
  healthData,
  loading,
  orgs,
  onRefresh,
  onRefreshStatus,
}: {
  healthData: HealthDashboard | null;
  loading: boolean;
  orgs: OrgCredential[];
  onRefresh: () => void;
  onRefreshStatus: () => void;
}) {
  const [retryingOrgId, setRetryingOrgId] = React.useState<number | null>(null);
  const [testingOrgId, setTestingOrgId] = React.useState<number | null>(null);
  const [testErrors, setTestErrors] = React.useState<Record<number, string | null>>({});

  const handleRetryConsent = async (org: OrgCredential) => {
    setRetryingOrgId(org.id);
    try {
      const response = await api.post<{ success: boolean; admin_consent_url?: string; message?: string; configured?: boolean }>(
        "/api/v1/microsoft_app/setup_from_env",
        { name: org.name }
      );
      if (response?.configured === false) {
        setTestErrors(prev => ({ ...prev, [org.id]: response.message || "Credentials not configured" }));
        setRetryingOrgId(null);
        return;
      }
      if (response?.admin_consent_url) {
        window.location.href = response.admin_consent_url;
      }
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      setTestErrors(prev => ({ ...prev, [org.id]: e.data?.error || e.message || "Failed" }));
      setRetryingOrgId(null);
    }
  };

  const handleTestEmail = async (orgId: number) => {
    setTestingOrgId(orgId);
    setTestErrors(prev => ({ ...prev, [orgId]: null }));
    try {
      const response = await api.post<{ success: boolean; error?: string }>("/api/v1/microsoft_app/test", {
        organization_id: orgId,
      });
      if (!response?.success) {
        setTestErrors(prev => ({ ...prev, [orgId]: response?.error || "Test failed" }));
      }
      onRefreshStatus();
    } catch (err: unknown) {
      const e = err as { data?: { error?: string }; message?: string };
      setTestErrors(prev => ({ ...prev, [orgId]: e.data?.error || e.message || "Test failed" }));
    } finally {
      setTestingOrgId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={24} className="text-muted-foreground mr-2" />
        <span className="text-muted-foreground">Loading health data...</span>
      </div>
    );
  }

  if (!healthData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Heart className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No health data available</p>
          <p className="text-sm text-muted-foreground mt-1">
            Connect an organization first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* System health summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {overallStatusBadge(healthData.overall_status)}
          <span className="text-sm text-muted-foreground">
            {healthData.connected_count}/{healthData.total_count} connected
          </span>
          {healthData.self_healing.active ? (
            <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Self-Healing Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Self-Healing Inactive
            </Badge>
          )}
          {healthData.self_healing.last_refresh_at && (
            <span className="text-xs text-muted-foreground">
              Last refresh: {new Date(healthData.self_healing.last_refresh_at).toLocaleTimeString("en-AU", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Per-org health cards */}
      {healthData.organizations.map((healthOrg) => {
        const org = orgs.find(o => o.name === healthOrg.name);
        const isError = healthOrg.status === "error" || healthOrg.status === "dead";
        const isPending = healthOrg.status === "pending";
        const testError = testErrors[healthOrg.id];

        return (
          <Card
            key={healthOrg.id}
            className={
              isError ? "border-red-200 dark:border-red-800" :
              isPending ? "border-yellow-200 dark:border-yellow-800" :
              ""
            }
          >
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{healthOrg.name}</CardTitle>
                  {statusBadge(healthOrg.status)}
                </div>
                <div className="flex items-center gap-2">
                  {/* Action buttons for error/pending/dead orgs */}
                  {(isError || isPending) && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => org && handleRetryConsent(org)}
                      disabled={retryingOrgId === healthOrg.id}
                    >
                      {retryingOrgId === healthOrg.id ? (
                        <Spinner size={14} className="mr-1" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      )}
                      {isError ? "Reconnect" : "Retry Consent"}
                    </Button>
                  )}
                  {healthOrg.status === "connected" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestEmail(healthOrg.id)}
                      disabled={testingOrgId === healthOrg.id}
                    >
                      {testingOrgId === healthOrg.id ? (
                        <Spinner size={14} className="mr-1" />
                      ) : (
                        <Mail className="h-3.5 w-3.5 mr-1" />
                      )}
                      Test Email
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {testError && (
                <Alert variant="destructive" className="mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{testError}</AlertDescription>
                </Alert>
              )}

              {healthOrg.last_error && (isError || isPending) && (
                <Alert variant="destructive" className="mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{healthOrg.status === "dead" ? "Token Expired" : "Error"}</AlertTitle>
                  <AlertDescription>{healthOrg.last_error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Token</p>
                  <p className={`font-medium ${healthOrg.token_valid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {healthOrg.token_valid ? "Valid" : "Invalid"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Token Expires</p>
                  <p className="font-medium">
                    {healthOrg.token_expires_at
                      ? new Date(healthOrg.token_expires_at).toLocaleString("en-AU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Self-Healing</p>
                  <p className={`font-medium ${healthOrg.self_healing_available ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                    {healthOrg.self_healing_available ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Consecutive Failures</p>
                  <p className={`font-medium ${healthOrg.consecutive_failures > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                    {healthOrg.consecutive_failures}
                  </p>
                </div>
                {org?.admin_consent_granted_by && (
                  <div>
                    <p className="text-xs text-muted-foreground">Consent Granted By</p>
                    <p className="font-medium">{org.admin_consent_granted_by}</p>
                  </div>
                )}
                {org?.admin_consent_granted_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Consent Granted</p>
                    <p className="font-medium">
                      {new Date(org.admin_consent_granted_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
                {org?.last_sync_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Last Sync</p>
                    <p className="font-medium">{formatRelativeTime(org.last_sync_at)}</p>
                  </div>
                )}
                {healthOrg.last_refresh_attempt_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Last Refresh Attempt</p>
                    <p className="font-medium">{formatRelativeTime(healthOrg.last_refresh_attempt_at)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
