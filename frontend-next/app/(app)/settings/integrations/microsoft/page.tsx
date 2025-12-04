"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
} from "lucide-react";
import { api } from "@/lib/api";

interface MicrosoftStatus {
  connected: boolean;
  email?: string;
  connected_at?: string;
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

      {/* Main Status Card - Collapsible */}
      <Collapsible open={mainOpen} onOpenChange={setMainOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
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
          </CollapsibleTrigger>
          <CollapsibleContent>
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
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Connected Services - Collapsible */}
      {connections && (
        <Collapsible open={servicesOpen} onOpenChange={setServicesOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
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
            </CollapsibleTrigger>
            <CollapsibleContent>
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
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* My Data - Collapsible */}
      {status?.connected && myDataStats && (
        <Collapsible open={myDataOpen} onOpenChange={setMyDataOpen}>
          <Card>
            <CollapsibleTrigger className="w-full text-left">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
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
            </CollapsibleTrigger>
            <CollapsibleContent>
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
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
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
