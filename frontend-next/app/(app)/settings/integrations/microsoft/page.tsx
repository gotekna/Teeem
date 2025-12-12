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
  ArrowLeft,
  Mail,
  FolderOpen,
  Calendar,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Building2,
  User,
  Cloud,
  ChevronDown,
  Database,
  Clock,
  Shield,
  Settings,
  Users,
  Key,
  Filter,
  Trash2,
  Timer,
  ShieldCheck,
  AlertOctagon,
  Megaphone,
  Receipt,
  Github,
  Bell,
  Package,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface MicrosoftStatus {
  connected: boolean;
  email?: string;
  connected_at?: string;
  needs_reconnect?: boolean;
  sync_error?: string;
  services: {
    outlook: boolean;
    onedrive: boolean;
    calendar: boolean;
  };
}

interface ConnectionInfo {
  connected: boolean;
  name: string;
  url?: string;
  document_library?: string;
  root_folder?: string;
  authenticated_as?: string;
  auth_type: "organization" | "personal";
  drive_id?: string;
}

interface ConnectionsResponse {
  sharepoint: ConnectionInfo;
  onedrive: ConnectionInfo;
  email: ConnectionInfo;
  calendar: ConnectionInfo;
}

interface MyDataStats {
  user_email: string;
  connected: boolean;
  connected_at?: string;
  email: {
    total_synced: number;
    last_sync?: string;
    sync_status: string;
    emails_in_warehouse: number;
  };
  calendar: {
    upcoming_events: number;
    last_sync?: string;
  };
  onedrive: {
    files_accessed: number;
    last_activity?: string;
  };
}

export default function MicrosoftIntegrationPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<MicrosoftStatus | null>(null);
  const [connections, setConnections] = React.useState<ConnectionsResponse | null>(null);
  const [myDataStats, setMyDataStats] = React.useState<MyDataStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [mainOpen, setMainOpen] = React.useState(true);
  const [servicesOpen, setServicesOpen] = React.useState(true);
  const [myDataOpen, setMyDataOpen] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusData, connectionsData, myDataStatsData] = await Promise.all([
          api.get<MicrosoftStatus>("/api/v1/microsoft/status"),
          api.get<ConnectionsResponse>("/api/v1/microsoft/connections"),
          api.get<MyDataStats>("/api/v1/microsoft/my_data_stats"),
        ]);

        // Auto-reconnect if token refresh failed (user won't even notice)
        if (statusData.needs_reconnect) {
          console.log("Microsoft token needs reconnect, redirecting to auth...");
          const { url } = await api.get<{ url: string }>("/api/v1/microsoft/auth_url");
          window.location.href = url;
          return; // Don't update state, we're redirecting
        }

        setStatus(statusData);
        setConnections(connectionsData);
        setMyDataStats(myDataStatsData);
      } catch (error) {
        console.error("Failed to fetch Microsoft data:", error);
        setStatus({
          connected: false,
          services: { outlook: false, onedrive: false, calendar: false },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await api.get<{ url: string }>("/api/v1/microsoft/auth_url");
      window.location.href = url;
    } catch (error) {
      console.error("Failed to get Microsoft auth URL:", error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.delete("/api/v1/microsoft/disconnect");
      setStatus({
        connected: false,
        services: { outlook: false, onedrive: false, calendar: false },
      });
      setConnections(null);
    } catch (error) {
      console.error("Failed to disconnect Microsoft:", error);
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

  // Count connected services
  const connectedCount = connections
    ? [connections.sharepoint, connections.onedrive, connections.email, connections.calendar].filter(
        (c) => c.connected
      ).length
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/settings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Microsoft 365 Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your Microsoft account for email, files, and calendar
          </p>
        </div>
      </div>

      {/* Main Status Card - Accordion */}
      <Accordion
        type="single"
        collapsible
        value={mainOpen ? "main" : ""}
        onValueChange={(v) => setMainOpen(v === "main")}
      >
        <AccordionItem value="main" className="border-none">
          <Card>
            <AccordionTrigger className="w-full text-left p-0 hover:no-underline [&>svg]:hidden">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Mail className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle>Microsoft 365</CardTitle>
                      <CardDescription>Outlook, SharePoint, Calendar</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {status?.connected ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Connected
                      </Badge>
                    )}
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${
                        mainOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
            <CardContent className="space-y-6 pt-0">
              {status?.connected ? (
                <>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Connected Account</p>
                    <p className="font-medium">{status.email || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Connected{" "}
                      {status.connected_at
                        ? new Date(status.connected_at).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
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
                      Connect your Microsoft 365 account to sync emails, store documents in SharePoint,
                      and sync calendar events.
                    </AlertDescription>
                  </Alert>

                  <Button onClick={handleConnect} disabled={connecting}>
                    {connecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Connect to Microsoft 365
                  </Button>
                </>
              )}
            </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>

      {/* Connected Services - Accordion */}
      {connections && (
        <Accordion
          type="single"
          collapsible
          value={servicesOpen ? "services" : ""}
          onValueChange={(v) => setServicesOpen(v === "services")}
        >
          <AccordionItem value="services" className="border-none">
            <Card>
              <AccordionTrigger className="w-full text-left p-0 hover:no-underline [&>svg]:hidden">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4 w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">Connected Services</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {connectedCount}/4
                      </Badge>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${
                        servicesOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* SharePoint Card */}
                    <ConnectionCard
                      connection={connections.sharepoint}
                      icon={<Cloud className="h-5 w-5 text-blue-600" />}
                      iconBg="bg-blue-100"
                    />

                    {/* OneDrive Card */}
                    <ConnectionCard
                      connection={connections.onedrive}
                      icon={<FolderOpen className="h-5 w-5 text-green-600" />}
                      iconBg="bg-green-100"
                    />

                    {/* Email Card */}
                    <ConnectionCard
                      connection={connections.email}
                      icon={<Mail className="h-5 w-5 text-purple-600" />}
                      iconBg="bg-purple-100"
                    />

                    {/* Calendar Card */}
                    <ConnectionCard
                      connection={connections.calendar}
                      icon={<Calendar className="h-5 w-5 text-orange-600" />}
                      iconBg="bg-orange-100"
                    />
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      )}

      {/* My Data - Accordion */}
      {status?.connected && myDataStats && (
        <Accordion
          type="single"
          collapsible
          value={myDataOpen ? "myData" : ""}
          onValueChange={(v) => setMyDataOpen(v === "myData")}
        >
          <AccordionItem value="myData" className="border-none">
            <Card>
              <AccordionTrigger className="w-full text-left p-0 hover:no-underline [&>svg]:hidden">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4 w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Database className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">My Data</CardTitle>
                        <CardDescription className="text-xs">
                          Your personal sync activity
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${
                        myDataOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Email Stats */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Mail className="h-4 w-4 text-purple-600" />
                      </div>
                      <h3 className="font-medium text-sm">Email Sync</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Emails Synced</span>
                        <span className="text-lg font-bold text-purple-600">
                          {myDataStats.email.total_synced.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">In Warehouse</span>
                        <span className="text-sm font-medium">
                          {myDataStats.email.emails_in_warehouse.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                        <Clock className="h-3 w-3" />
                        <span>
                          {myDataStats.email.last_sync
                            ? `Last sync: ${new Date(myDataStats.email.last_sync).toLocaleDateString("en-AU", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : "Never synced"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Calendar Stats */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Calendar className="h-4 w-4 text-orange-600" />
                      </div>
                      <h3 className="font-medium text-sm">Calendar</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Upcoming Events</span>
                        <span className="text-lg font-bold text-orange-600">
                          {myDataStats.calendar.upcoming_events}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                        <Clock className="h-3 w-3" />
                        <span>
                          {myDataStats.calendar.last_sync
                            ? `Last sync: ${new Date(myDataStats.calendar.last_sync).toLocaleDateString("en-AU", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : "Not synced yet"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* OneDrive Stats */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <FolderOpen className="h-4 w-4 text-green-600" />
                      </div>
                      <h3 className="font-medium text-sm">OneDrive</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Files Accessed</span>
                        <span className="text-lg font-bold text-green-600">
                          {myDataStats.onedrive.files_accessed}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                        <Clock className="h-3 w-3" />
                        <span>
                          {myDataStats.onedrive.last_activity
                            ? `Last activity: ${new Date(myDataStats.onedrive.last_activity).toLocaleDateString("en-AU", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : "No activity yet"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      )}

      {/* Email Rules Section */}
      {status?.connected && <EmailRulesSection />}

      {/* Organization-Wide Access - Admin Only */}
      <OrgWideAccessSection />
    </div>
  );
}

function ConnectionCard({
  connection,
  icon,
  iconBg,
}: {
  connection: ConnectionInfo;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className={`p-2 ${iconBg} rounded-lg flex-shrink-0`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-medium text-sm">{connection.name}</h3>
            {connection.connected ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>

          {connection.url && (
            <a
              href={connection.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline break-all flex items-start gap-1"
            >
              <span className="break-all">{connection.url}</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5" />
            </a>
          )}

          {connection.authenticated_as && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
              {connection.auth_type === "organization" ? (
                <Building2 className="h-3 w-3" />
              ) : (
                <User className="h-3 w-3" />
              )}
              <span>
                {connection.auth_type === "organization" ? "Org" : "Personal"}:{" "}
                {connection.authenticated_as}
              </span>
            </div>
          )}

          {connection.connected && connection.url && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={() => window.open(connection.url, "_blank")}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Email Rules Section
// ============================================

interface EmailRulesData {
  user_stats: {
    total_emails: number;
    by_classification: {
      business: number;
      transactional: number;
      marketing: number;
      spam: number;
      unclassified: number;
    };
    ephemeral: {
      total: number;
      expired: number;
    };
  };
  rules: {
    spam_detection: {
      description: string;
      indicators: { name: string; description: string }[];
      trusted_domains: string[];
      note: string;
    };
    marketing_detection: {
      description: string;
      indicators: { name: string; description: string }[];
      marketing_domains: string[];
    };
    ephemeral_rules: {
      description: string;
      categories: {
        type: string;
        retention_days: number;
        from_pattern: string;
        examples: string[];
      }[];
    };
    transactional_detection: {
      description: string;
      keywords: string[];
    };
  };
  cleanup_preview: {
    spam_pending_delete: number;
    ephemeral_expired: number;
  };
}

function EmailRulesSection() {
  const [rulesData, setRulesData] = React.useState<EmailRulesData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [rulesOpen, setRulesOpen] = React.useState(true);

  React.useEffect(() => {
    const fetchRules = async () => {
      try {
        const data = await api.get<EmailRulesData>("/api/v1/email_warehouse/rules");
        setRulesData(data);
      } catch (err) {
        console.error("Failed to fetch email rules:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!rulesData) return null;

  const stats = rulesData.user_stats;
  const rules = rulesData.rules;

  return (
    <Accordion
      type="single"
      collapsible
      value={rulesOpen ? "rules" : ""}
      onValueChange={(v) => setRulesOpen(v === "rules")}
    >
      <AccordionItem value="rules" className="border-none">
        <Card>
          <AccordionTrigger className="w-full text-left p-0 hover:no-underline [&>svg]:hidden">
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4 w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Filter className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Email Rules & Classification</CardTitle>
                    <CardDescription className="text-xs">
                      How your emails are categorized and cleaned up
                    </CardDescription>
                  </div>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    rulesOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </CardHeader>
          </AccordionTrigger>
          <AccordionContent>
          <CardContent className="pt-0 space-y-6">
            {/* Your Email Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.by_classification.business}</div>
                <div className="text-xs text-muted-foreground">Business</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.by_classification.transactional}</div>
                <div className="text-xs text-muted-foreground">Transactional</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.by_classification.marketing}</div>
                <div className="text-xs text-muted-foreground">Marketing</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{stats.by_classification.spam}</div>
                <div className="text-xs text-muted-foreground">Spam</div>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-600">{stats.by_classification.unclassified}</div>
                <div className="text-xs text-muted-foreground">Unclassified</div>
              </div>
            </div>

            {/* Rule Categories */}
            <div className="space-y-4">
              {/* Spam Rules */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertOctagon className="h-5 w-5 text-red-500" />
                  <h3 className="font-medium">Spam Detection</h3>
                  {rulesData.cleanup_preview.spam_pending_delete > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {rulesData.cleanup_preview.spam_pending_delete} pending
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">{rules.spam_detection.description}</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Spam Indicators</h4>
                    <ul className="text-sm space-y-1">
                      {rules.spam_detection.indicators.map((ind, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <XCircle className="h-3 w-3 text-red-500 mt-1 flex-shrink-0" />
                          <span><strong>{ind.name}:</strong> {ind.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">
                      <ShieldCheck className="h-3 w-3 inline mr-1" />
                      Trusted Domains (never spam)
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {rules.spam_detection.trusted_domains.map((domain, i) => (
                        <Badge key={i} variant="secondary" className="text-xs font-mono">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ephemeral/Auto-Cleanup Rules */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="h-5 w-5 text-amber-500" />
                  <h3 className="font-medium">Auto-Cleanup Rules</h3>
                  {stats.ephemeral.expired > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 text-xs">
                      {stats.ephemeral.expired} expired
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">{rules.ephemeral_rules.description}</p>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {rules.ephemeral_rules.categories.map((cat, i) => (
                    <div key={i} className="border rounded p-3 bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        {cat.type === "github_notifications" && <Github className="h-4 w-4 text-gray-700" />}
                        {cat.type === "calendar_notifications" && <Bell className="h-4 w-4 text-orange-500" />}
                        {cat.type === "system_alerts" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        {cat.type === "shipping_tracking" && <Package className="h-4 w-4 text-blue-500" />}
                        <span className="font-medium text-sm capitalize">{cat.type.replace(/_/g, " ")}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <Clock className="h-3 w-3" />
                        <span>Keep for {cat.retention_days} days</span>
                      </div>
                      <ul className="text-xs text-muted-foreground">
                        {cat.examples.map((ex, j) => (
                          <li key={j}>• {ex}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Marketing Rules */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Megaphone className="h-5 w-5 text-orange-500" />
                  <h3 className="font-medium">Marketing Detection</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{rules.marketing_detection.description}</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Detection Signals</h4>
                    <ul className="text-sm space-y-1">
                      {rules.marketing_detection.indicators.map((ind, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Megaphone className="h-3 w-3 text-orange-500 mt-1 flex-shrink-0" />
                          <span><strong>{ind.name}:</strong> {ind.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Known Marketing Platforms</h4>
                    <div className="flex flex-wrap gap-1">
                      {rules.marketing_detection.marketing_domains.slice(0, 8).map((domain, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-mono">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactional Rules */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="h-5 w-5 text-green-500" />
                  <h3 className="font-medium">Transactional Detection</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{rules.transactional_detection.description}</p>
                <p className="text-xs text-muted-foreground">
                  Detected by keywords: order confirmations, receipts, payment notifications, shipping updates
                </p>
              </div>
            </div>

            {/* Cleanup Actions */}
            {(rulesData.cleanup_preview.spam_pending_delete > 0 || rulesData.cleanup_preview.ephemeral_expired > 0) && (
              <Alert>
                <Trash2 className="h-4 w-4" />
                <AlertTitle>Cleanup Available</AlertTitle>
                <AlertDescription>
                  {rulesData.cleanup_preview.spam_pending_delete > 0 && (
                    <span>{rulesData.cleanup_preview.spam_pending_delete} spam emails can be deleted. </span>
                  )}
                  {rulesData.cleanup_preview.ephemeral_expired > 0 && (
                    <span>{rulesData.cleanup_preview.ephemeral_expired} expired automated emails can be cleaned up. </span>
                  )}
                  <span className="text-muted-foreground">Cleanup runs automatically at 3am daily.</span>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
}

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

// Pre-defined organizations that can be connected
const AVAILABLE_ORGANIZATIONS = [
  { name: "Tekna", description: "Tekna Group Microsoft 365" },
  { name: "100xBestLife", description: "100x Best Life Microsoft 365" },
  { name: "Homes of Hope", description: "Homes of Hope Microsoft 365" },
  { name: "Love Your World", description: "Love Your World Microsoft 365" },
];

function OrgWideAccessSection() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [orgStatus, setOrgStatus] = React.useState<OrgAppStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Track which org is currently being connected (null = none, string = org name)
  const [connectingOrg, setConnectingOrg] = React.useState<string | null>(null);

  // Check if user is admin
  const isAdmin = user?.permissions?.includes("admin") || user?.role === "admin";

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

  React.useEffect(() => {
    if (isAdmin) {
      fetchStatus();
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
      const response = await api.post<{ success: boolean; admin_consent_url: string; message: string }>(
        "/api/v1/microsoft_app/setup_from_env",
        { name: orgName }
      );

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

  // Don't show for non-admins
  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get configured orgs and available orgs for setup
  const configuredOrgs = orgStatus?.organizations || [];
  const configuredOrgNames = new Set(configuredOrgs.map(o => o.name));
  const unconfiguredOrgs = AVAILABLE_ORGANIZATIONS.filter(o => !configuredOrgNames.has(o.name));

  // Count connected orgs
  const connectedCount = configuredOrgs.filter(o => o.status === "connected").length;

  return (
    <>
      {/* Header Card */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Shield className="h-5 w-5 text-amber-600" />
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
            <Badge className={connectedCount > 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
              {connectedCount}/{AVAILABLE_ORGANIZATIONS.length} Connected
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Organization Cards - Show each org as a separate card */}
      <div className="space-y-3">
        {/* Configured Organizations */}
        {configuredOrgs.map((org) => (
          <OrganizationCard
            key={org.id}
            org={org}
            onRefresh={fetchStatus}
            envConfigured={orgStatus?.env_configured || false}
          />
        ))}

        {/* Unconfigured Organizations - Show as setup cards */}
        {unconfiguredOrgs.map((org) => {
          const isThisOneConnecting = connectingOrg === org.name;

          return (
            <Card key={org.name} className={isThisOneConnecting ? "border-blue-200 bg-blue-50/30" : "border-dashed"}>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isThisOneConnecting ? "bg-blue-100" : "bg-gray-100"}`}>
                      {isThisOneConnecting ? (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
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
                      <Badge className="bg-blue-100 text-blue-800">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
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
    </>
  );
}

// Individual Organization Card Component
function OrganizationCard({
  org,
  onRefresh,
  envConfigured
}: {
  org: OrgCredential;
  onRefresh: () => void;
  envConfigured: boolean;
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
      const response = await api.post<{ success: boolean; admin_consent_url: string; message: string }>(
        "/api/v1/microsoft_app/setup_from_env",
        { name: org.name }
      );
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
        <Card className={org.status === "connected" ? "border-green-200 bg-green-50/30" : org.status === "error" ? "border-red-200 bg-red-50/30" : "border-yellow-200 bg-yellow-50/30"}>
          <AccordionTrigger className="w-full text-left p-0 hover:no-underline [&>svg]:hidden">
            <CardHeader className="cursor-pointer hover:bg-opacity-50 transition-colors py-4 w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${org.status === "connected" ? "bg-green-100" : org.status === "error" ? "bg-red-100" : "bg-yellow-100"}`}>
                    <Shield className={`h-5 w-5 ${org.status === "connected" ? "text-green-600" : org.status === "error" ? "text-red-600" : "text-yellow-600"}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{org.name}</CardTitle>
                    <CardDescription className="text-xs font-mono">{org.tenant_id}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {org.status === "connected" ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  ) : org.status === "pending" ? (
                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
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
                <div className="p-4 bg-white rounded-lg border">
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
                </div>

                {/* Tenant Users */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Tenant Users
                    </h4>
                    <Button variant="outline" size="sm" onClick={handleLoadUsers} disabled={loadingUsers}>
                      {loadingUsers ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                  </div>
                  {tenantUsers.length > 0 && (
                    <div className="max-h-32 overflow-y-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium">Name</th>
                            <th className="text-left p-2 font-medium">Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tenantUsers.map((u) => (
                            <tr key={u.id} className="border-t">
                              <td className="p-2">{u.name}</td>
                              <td className="p-2 text-muted-foreground">{u.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {sharePointResult && (
                  <Alert variant={sharePointResult.success ? "default" : "destructive"} className={sharePointResult.success ? "bg-green-50 border-green-200" : ""}>
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
                  <Alert variant={syncResult.success ? "default" : "destructive"} className={syncResult.success ? "bg-green-50 border-green-200" : ""}>
                    {syncResult.success ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertTitle>{syncResult.success ? "Sync Started" : "Sync Error"}</AlertTitle>
                    <AlertDescription>{syncResult.message}</AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                    {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                    Test Email
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleTestSharePoint} disabled={testingSharePoint}>
                    {testingSharePoint ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FolderOpen className="h-4 w-4 mr-1" />}
                    Test SharePoint
                  </Button>
                  <Button variant="default" size="sm" onClick={handleSyncToSharePoint} disabled={syncing} className="bg-blue-600 hover:bg-blue-700">
                    {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Database className="h-4 w-4 mr-1" />}
                    Sync to SharePoint
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
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
                    {retrying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Retry Consent
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
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
