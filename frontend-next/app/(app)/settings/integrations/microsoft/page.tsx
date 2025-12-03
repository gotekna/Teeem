"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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

export default function MicrosoftIntegrationPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<MicrosoftStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  React.useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.get<MicrosoftStatus>("/api/v1/microsoft/status");
        setStatus(data);
      } catch (error) {
        console.error("Failed to fetch Microsoft status:", error);
        setStatus({
          connected: false,
          services: { outlook: false, onedrive: false, calendar: false },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
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

  return (
    <div className="space-y-6">
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

      {/* Status Card */}
      <Card>
        <CardHeader>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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

              <Separator />

              {/* Service Status */}
              <div className="space-y-3">
                <h4 className="font-medium">Connected Services</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Mail className="h-5 w-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium">Outlook</p>
                      <p className="text-xs text-muted-foreground">Email sync</p>
                    </div>
                    {status.services.outlook ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <FolderOpen className="h-5 w-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium">SharePoint</p>
                      <p className="text-xs text-muted-foreground">File storage</p>
                    </div>
                    {status.services.onedrive ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium">Calendar</p>
                      <p className="text-xs text-muted-foreground">Events sync</p>
                    </div>
                    {status.services.calendar ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  onClick={() => window.open("https://tekaboringmachines.sharepoint.com", "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open SharePoint
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
      </Card>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-base">Outlook Integration</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Send emails from jobs
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Track email history
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Email templates
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FolderOpen className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-base">SharePoint Storage</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Auto-create job folders
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Store documents securely
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Share files with team
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-base">Calendar Sync</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Sync meetings & events
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Schedule site visits
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Team availability
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
