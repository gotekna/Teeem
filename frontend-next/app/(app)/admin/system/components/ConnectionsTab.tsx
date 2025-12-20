"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Cloud,
  Mail,
  MessageSquare,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// SharePoint Connection Component
function SharePointConnection() {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<{
    connected: boolean;
    driveName?: string;
    rootFolderPath?: string;
    email?: string;
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
      toast({ title: "Error", description: "Failed to initiate connection", variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect SharePoint?")) return;
    setDisconnecting(true);
    try {
      await api.delete("/api/v1/organization_onedrive/disconnect");
      toast({ title: "Success", description: "SharePoint disconnected successfully" });
      setStatus({ connected: false });
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast({ title: "Error", description: "Failed to disconnect SharePoint", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">SharePoint</CardTitle>
              <CardDescription>Organization file storage and sync</CardDescription>
            </div>
          </div>
          <Badge variant={status?.connected ? "default" : "secondary"}>
            {status?.connected ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <X className="h-3 w-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.connected ? (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Drive:</span>
                <p className="font-medium">{status.driveName || "Default Drive"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Root Folder:</span>
                <p className="font-medium">{status.rootFolderPath || "/"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadStatus}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Cloud className="h-4 w-4 mr-2" />
            )}
            Connect SharePoint
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Outlook Connection Component
function OutlookConnection() {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<{
    connected: boolean;
    email?: string;
    services?: string[];
    needs_refresh?: boolean;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);

  React.useEffect(() => {
    loadStatus();
     
  }, []);

  // Auto-refresh token if it needs refresh
  React.useEffect(() => {
    const autoRefreshToken = async () => {
      if (status?.needs_refresh && status?.connected) {
        console.log("Token needs refresh, attempting auto-refresh...");
        try {
          const result = await api.post<{ success: boolean; error?: string }>("/api/v1/microsoft/refresh");
          if (result?.success) {
            toast({ title: "Success", description: "Microsoft connection refreshed automatically" });
            loadStatus(); // Reload status after successful refresh
          } else if (result) {
            // Auto-refresh failed, redirect to re-auth
            console.log("Auto-refresh failed, redirecting to auth...");
            const data = await api.get<{ auth_url: string }>("/api/v1/microsoft/auth_url");
            window.location.href = data.auth_url;
          }
        } catch (error) {
          console.error("Auto-refresh failed:", error);
          // Silently fail - user can manually reconnect
        }
      }
    };
    autoRefreshToken();
     
  }, [status?.needs_refresh, status?.connected]);

  const loadStatus = async () => {
    try {
      const data = await api.get<typeof status>("/api/v1/microsoft/status");
      setStatus(data);
    } catch (error) {
      console.error("Failed to load Microsoft status:", error);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const data = await api.get<{ auth_url: string }>("/api/v1/microsoft/auth_url");
      window.location.href = data.auth_url;
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      toast({ title: "Error", description: "Failed to initiate connection", variant: "destructive" });
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">Microsoft 365</CardTitle>
              <CardDescription>Outlook, OneDrive, and SharePoint integration</CardDescription>
            </div>
          </div>
          <Badge
            variant={status?.connected ? (status?.needs_refresh ? "outline" : "default") : "secondary"}
            className={cn(status?.needs_refresh && "border-orange-500 text-orange-600")}
          >
            {status?.connected ? (
              status?.needs_refresh ? (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Needs Refresh
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Connected
                </>
              )
            ) : (
              <>
                <X className="h-3 w-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.connected ? (
          <>
            <div className="text-sm">
              <span className="text-muted-foreground">Account:</span>
              <p className="font-medium">{status.email || "Unknown"}</p>
            </div>
            {status.services && status.services.length > 0 && (
              <div className="flex gap-2">
                {status.services.map((service) => (
                  <Badge key={service} variant="outline">
                    {service}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadStatus}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {status.needs_refresh && (
                <Button size="sm" onClick={handleConnect}>
                  Reconnect
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Connect Microsoft 365
            </Button>
            <div className="text-sm text-muted-foreground">
              <p>
                Requires Azure AD app registration.{" "}
                <a
                  href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Azure Portal <ExternalLink className="h-3 w-3 inline" />
                </a>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Twilio Configuration Component
function TwilioConfiguration() {
  const { toast } = useToast();
  const [formData, setFormData] = React.useState({
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_phone_number: "",
    twilio_enabled: false,
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    success: boolean;
    message: string;
  } | null>(null);

  React.useEffect(() => {
    loadSettings();
     
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get<typeof formData>("/api/v1/company_settings");
      setFormData({
        twilio_account_sid: data.twilio_account_sid || "",
        twilio_auth_token: data.twilio_auth_token || "",
        twilio_phone_number: data.twilio_phone_number || "",
        twilio_enabled: data.twilio_enabled || false,
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/api/v1/company_settings", { company_setting: formData });
      toast({ title: "Success", description: "Twilio settings saved successfully" });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<typeof testResult>("/api/v1/company_settings/test_twilio");
      setTestResult(result);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setTestResult({
        success: false,
        message: err?.response?.data?.message || "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900">
            <MessageSquare className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <CardTitle className="text-base">Twilio SMS</CardTitle>
            <CardDescription>Configure SMS messaging for notifications</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="twilio_account_sid">Account SID</Label>
            <Input
              id="twilio_account_sid"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={formData.twilio_account_sid}
              onChange={(e) => setFormData({ ...formData, twilio_account_sid: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twilio_auth_token">Auth Token</Label>
            <Input
              id="twilio_auth_token"
              type="password"
              placeholder="Your auth token"
              value={formData.twilio_auth_token}
              onChange={(e) => setFormData({ ...formData, twilio_auth_token: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twilio_phone_number">Phone Number</Label>
            <Input
              id="twilio_phone_number"
              placeholder="+1234567890"
              value={formData.twilio_phone_number}
              onChange={(e) => setFormData({ ...formData, twilio_phone_number: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">E.164 format (e.g., +61412345678)</p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="twilio_enabled"
              checked={formData.twilio_enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, twilio_enabled: checked as boolean })
              }
            />
            <Label htmlFor="twilio_enabled" className="cursor-pointer">
              Enable Twilio SMS
            </Label>
          </div>
        </div>

        {testResult && (
          <div
            className={cn(
              "p-3 rounded-md text-sm",
              testResult.success
                ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
            )}
          >
            {testResult.success ? (
              <Check className="h-4 w-4 inline mr-2" />
            ) : (
              <X className="h-4 w-4 inline mr-2" />
            )}
            {testResult.message}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !formData.twilio_account_sid}
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground border-t pt-4">
          <p>
            Get your credentials from the{" "}
            <a
              href="https://console.twilio.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Twilio Console <ExternalLink className="h-3 w-3 inline" />
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Connections Tab
export function ConnectionsTab() {
  return (
    <div className="space-y-6">
      <SharePointConnection />
      <OutlookConnection />
      <TwilioConfiguration />
    </div>
  );
}
