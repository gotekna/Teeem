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
  HardDrive,
  Plus,
  Trash2,
  Edit3,
  TestTube,
  ChevronDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { StorageCostTab } from "./StorageCostTab";

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

// S3-Compatible Storage Types
interface S3Provider {
  id: string;
  name: string;
  description: string;
  endpoint_template: string | null;
  region_hint: string;
  help_url: string | null;
}

interface S3Credential {
  id: number;
  name: string;
  provider_type: string;
  provider_display_name: string;
  endpoint: string | null;
  region: string;
  bucket: string;
  bucket_url: string;
  root_path: string;
  is_active: boolean;
  status: string;
  access_key_id_masked: string;
  created_at: string;
}

// Provider presets with defaults
const PROVIDER_PRESETS: Record<string, { name: string; description: string; endpoint: string; regionHint: string; helpUrl: string }> = {
  backblaze_b2: {
    name: "Backblaze B2",
    description: "Low-cost cloud storage (~$0.006/GB)",
    endpoint: "https://s3.us-west-004.backblazeb2.com",
    regionHint: "us-west-004",
    helpUrl: "https://www.backblaze.com/docs/cloud-storage-s3-compatible-api",
  },
  aws_s3: {
    name: "Amazon S3",
    description: "AWS cloud storage",
    endpoint: "",
    regionHint: "ap-southeast-2",
    helpUrl: "https://docs.aws.amazon.com/s3/",
  },
  wasabi: {
    name: "Wasabi",
    description: "Hot cloud storage, no egress fees",
    endpoint: "https://s3.ap-southeast-2.wasabisys.com",
    regionHint: "ap-southeast-2",
    helpUrl: "https://docs.wasabi.com/docs/s3-api",
  },
  minio: {
    name: "MinIO (Self-Hosted)",
    description: "Free, self-hosted S3 storage",
    endpoint: "https://your-server:9000",
    regionHint: "us-east-1",
    helpUrl: "https://min.io/docs/minio/linux/index.html",
  },
  synology: {
    name: "Synology NAS",
    description: "S3 Server on your NAS",
    endpoint: "https://your-nas-ip:5001",
    regionHint: "us-east-1",
    helpUrl: "https://kb.synology.com/en-global/DSM/help/S3Server/S3Server_desc",
  },
};

// S3 Storage Connection Component - Simplified
function S3StorageConnection() {
  const { toast } = useToast();
  const [credentials, setCredentials] = React.useState<S3Credential[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [selectedProvider, setSelectedProvider] = React.useState<string>("");
  const [showForm, setShowForm] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    endpoint: "",
    region: "",
    bucket: "",
    access_key_id: "",
    secret_access_key: "",
  });

  React.useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const data = await api.get<{ success: boolean; data: S3Credential[] }>("/api/v1/s3_credentials");
      setCredentials(data.data || []);
    } catch (error) {
      console.error("Failed to load S3 credentials:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    const preset = PROVIDER_PRESETS[providerId];
    if (preset) {
      setFormData({
        name: `${preset.name} Storage`,
        endpoint: preset.endpoint,
        region: preset.regionHint,
        bucket: "",
        access_key_id: "",
        secret_access_key: "",
      });
      setShowForm(true);
      setTestResult(null);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<{ success: boolean; message?: string; error?: string }>(
        "/api/v1/s3_credentials/test",
        { s3_credential: { ...formData, provider_type: selectedProvider } }
      );
      if (result) {
        setTestResult({
          success: result.success,
          message: result.success ? "Connection successful!" : result.error || "Connection failed",
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setTestResult({ success: false, message: err?.response?.data?.error || "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/api/v1/s3_credentials", {
        s3_credential: { ...formData, provider_type: selectedProvider },
      });
      toast({ title: "Success", description: "Storage connected successfully" });
      setShowForm(false);
      setSelectedProvider("");
      loadCredentials();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({ title: "Error", description: err?.response?.data?.error || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cred: S3Credential) => {
    if (!confirm(`Delete "${cred.name}"?`)) return;
    try {
      await api.delete(`/api/v1/s3_credentials/${cred.id}`);
      toast({ title: "Deleted", description: "Storage removed" });
      loadCredentials();
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const preset = selectedProvider ? PROVIDER_PRESETS[selectedProvider] : null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
            <HardDrive className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <CardTitle className="text-base">S3-Compatible Storage</CardTitle>
            <CardDescription>Alternative to SharePoint for document storage</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing credentials */}
        {credentials.length > 0 && (
          <div className="space-y-2">
            {credentials.map((cred) => (
              <div key={cred.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Badge variant={cred.status === "connected" ? "default" : "secondary"}>
                    {cred.status === "connected" ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                    {cred.status}
                  </Badge>
                  <div>
                    <p className="font-medium text-sm">{cred.name}</p>
                    <p className="text-xs text-muted-foreground">{cred.bucket} • {cred.region}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(cred)} className="text-red-600">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Provider Selection Dropdown */}
        {!showForm && (
          <div className="space-y-2">
            <Label>Add Storage Provider</Label>
            <Select value={selectedProvider} onValueChange={handleProviderSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a provider..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backblaze_b2">Backblaze B2 (~$0.006/GB)</SelectItem>
                <SelectItem value="aws_s3">Amazon S3</SelectItem>
                <SelectItem value="wasabi">Wasabi (no egress fees)</SelectItem>
                <SelectItem value="minio">MinIO (self-hosted, free)</SelectItem>
                <SelectItem value="synology">Synology NAS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Configuration Form - shows after provider selected */}
        {showForm && preset && (
          <div className="space-y-4 p-4 rounded-lg border bg-muted/20">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{preset.name} Configuration</h4>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setSelectedProvider(""); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3">
              <div>
                <Label htmlFor="name" className="text-xs">Display Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Storage"
                />
              </div>

              {selectedProvider !== "aws_s3" && (
                <div>
                  <Label htmlFor="endpoint" className="text-xs">Endpoint URL</Label>
                  <Input
                    id="endpoint"
                    value={formData.endpoint}
                    onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                    placeholder={preset.endpoint}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="region" className="text-xs">Region</Label>
                  <Input
                    id="region"
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    placeholder={preset.regionHint}
                  />
                </div>
                <div>
                  <Label htmlFor="bucket" className="text-xs">Bucket Name</Label>
                  <Input
                    id="bucket"
                    value={formData.bucket}
                    onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
                    placeholder="my-bucket"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="access_key_id" className="text-xs">Access Key ID</Label>
                  <Input
                    id="access_key_id"
                    value={formData.access_key_id}
                    onChange={(e) => setFormData({ ...formData, access_key_id: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="secret_access_key" className="text-xs">Secret Access Key</Label>
                  <Input
                    id="secret_access_key"
                    type="password"
                    value={formData.secret_access_key}
                    onChange={(e) => setFormData({ ...formData, secret_access_key: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={cn(
                "p-2 rounded text-sm",
                testResult.success ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}>
                {testResult.success ? <Check className="h-4 w-4 inline mr-1" /> : <X className="h-4 w-4 inline mr-1" />}
                {testResult.message}
              </div>
            )}

            {/* Help Link */}
            <a href={preset.helpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
              {preset.name} Setup Guide <ExternalLink className="h-3 w-3 inline" />
            </a>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || !formData.bucket || !formData.access_key_id}
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4 mr-1" />}
                Test
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.bucket || !formData.access_key_id}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Organization document provider config type
interface OrgDocumentProvider {
  document_provider: string;
  document_provider_credential_id: number | null;
  available_providers: string[];
  s3_credentials: Array<{
    id: number;
    name: string;
    provider_type: string;
    bucket: string;
    status: string;
    connected: boolean;
  }>;
  sharepoint_configured: boolean;
  can_switch: boolean;
}

// Document Storage Provider Selection (SSoT)
function DocumentStorageProvider() {
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] = React.useState<string>("sharepoint");
  const [selectedCredentialId, setSelectedCredentialId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showConfig, setShowConfig] = React.useState(false);
  const [orgConfig, setOrgConfig] = React.useState<OrgDocumentProvider | null>(null);
  const [s3Credentials, setS3Credentials] = React.useState<S3Credential[]>([]);
  const [savingProvider, setSavingProvider] = React.useState(false);

  // S3 form state
  const [s3Form, setS3Form] = React.useState({
    name: "",
    endpoint: "",
    region: "",
    bucket: "",
    access_key_id: "",
    secret_access_key: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null);

  React.useEffect(() => {
    loadOrgConfig();
    loadS3Credentials();
  }, []);

  const loadOrgConfig = async () => {
    try {
      const response = await api.get<{ success: boolean; data: OrgDocumentProvider }>("/api/v1/organization/document_provider");
      if (response.data) {
        setOrgConfig(response.data);
        setSelectedProvider(response.data.document_provider || "sharepoint");
        setSelectedCredentialId(response.data.document_provider_credential_id);
      }
    } catch (error) {
      console.error("Failed to load organization document provider:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadS3Credentials = async () => {
    try {
      const data = await api.get<{ success: boolean; data: S3Credential[] }>("/api/v1/s3_credentials");
      setS3Credentials(data.data || []);
    } catch (error) {
      console.error("Failed to load S3 credentials:", error);
    }
  };

  const handleSaveProviderSelection = async () => {
    setSavingProvider(true);
    try {
      const response = await api.put<{ success: boolean; message?: string; error?: string }>(
        "/api/v1/organization/document_provider",
        {
          document_provider: selectedProvider === "sharepoint" ? "sharepoint" : "s3_compatible",
          document_provider_credential_id: selectedProvider !== "sharepoint" ? selectedCredentialId : null,
        }
      );
      if (response.success) {
        toast({ title: "Success", description: response.message || "Document provider updated" });
        loadOrgConfig();
      } else {
        toast({ title: "Error", description: response.error || "Failed to update provider", variant: "destructive" });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({ title: "Error", description: err?.response?.data?.error || "Failed to update provider", variant: "destructive" });
    } finally {
      setSavingProvider(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setShowConfig(true);
    setTestResult(null);

    // Pre-fill S3 form based on provider
    if (provider !== "sharepoint") {
      const preset = PROVIDER_PRESETS[provider];
      if (preset) {
        setS3Form({
          name: `${preset.name} Storage`,
          endpoint: preset.endpoint,
          region: preset.regionHint,
          bucket: "",
          access_key_id: "",
          secret_access_key: "",
        });
      }
    }
  };

  const handleS3Test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<{ success: boolean; message?: string; error?: string }>(
        "/api/v1/s3_credentials/test",
        { s3_credential: { ...s3Form, provider_type: selectedProvider } }
      );
      if (result) {
        setTestResult({
          success: result.success,
          message: result.success ? "Connection successful!" : result.error || "Connection failed",
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setTestResult({ success: false, message: err?.response?.data?.error || "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleS3Save = async () => {
    setSaving(true);
    try {
      await api.post("/api/v1/s3_credentials", {
        s3_credential: { ...s3Form, provider_type: selectedProvider },
      });
      toast({ title: "Success", description: "Storage connected successfully" });
      setShowConfig(false);
      loadS3Credentials();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({ title: "Error", description: err?.response?.data?.error || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cred: S3Credential) => {
    if (!confirm(`Delete "${cred.name}"?`)) return;
    try {
      await api.delete(`/api/v1/s3_credentials/${cred.id}`);
      toast({ title: "Deleted", description: "Storage removed" });
      loadS3Credentials();
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const preset = selectedProvider !== "sharepoint" ? PROVIDER_PRESETS[selectedProvider] : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
            <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-base">Document Storage</CardTitle>
            <CardDescription>Choose where to store job and company documents</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Selection */}
        <div className="space-y-2">
          <Label>Storage Provider</Label>
          <Select value={selectedProvider} onValueChange={handleProviderChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sharepoint">SharePoint (Microsoft 365)</SelectItem>
              <SelectItem value="backblaze_b2">Backblaze B2 (~$0.006/GB)</SelectItem>
              <SelectItem value="aws_s3">Amazon S3</SelectItem>
              <SelectItem value="wasabi">Wasabi (no egress fees)</SelectItem>
              <SelectItem value="minio">MinIO (self-hosted, free)</SelectItem>
              <SelectItem value="synology">Synology NAS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Existing S3 credentials */}
        {s3Credentials.length > 0 && selectedProvider !== "sharepoint" && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Saved Credentials</Label>
            {s3Credentials.map((cred) => (
              <div key={cred.id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Badge variant={cred.status === "connected" ? "default" : "secondary"} className="text-xs">
                    {cred.status}
                  </Badge>
                  <span className="text-sm">{cred.name}</span>
                  <span className="text-xs text-muted-foreground">{cred.bucket}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(cred)} className="h-6 w-6 p-0 text-red-600">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* SharePoint Config */}
        {showConfig && selectedProvider === "sharepoint" && (
          <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
            <p className="text-sm text-muted-foreground">
              SharePoint uses Microsoft 365 OAuth. Click below to connect.
            </p>
            <SharePointConnection />
          </div>
        )}

        {/* S3 Config */}
        {showConfig && selectedProvider !== "sharepoint" && preset && (
          <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{preset.name} Configuration</h4>
              <Button variant="ghost" size="sm" onClick={() => setShowConfig(false)} className="h-6 w-6 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3">
              <div>
                <Label className="text-xs">Display Name</Label>
                <Input
                  value={s3Form.name}
                  onChange={(e) => setS3Form({ ...s3Form, name: e.target.value })}
                  placeholder="My Storage"
                  className="h-8"
                />
              </div>

              {selectedProvider !== "aws_s3" && (
                <div>
                  <Label className="text-xs">Endpoint URL</Label>
                  <Input
                    value={s3Form.endpoint}
                    onChange={(e) => setS3Form({ ...s3Form, endpoint: e.target.value })}
                    placeholder={preset.endpoint}
                    className="h-8"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Region</Label>
                  <Input
                    value={s3Form.region}
                    onChange={(e) => setS3Form({ ...s3Form, region: e.target.value })}
                    placeholder={preset.regionHint}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Bucket</Label>
                  <Input
                    value={s3Form.bucket}
                    onChange={(e) => setS3Form({ ...s3Form, bucket: e.target.value })}
                    placeholder="my-bucket"
                    className="h-8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Access Key ID</Label>
                  <Input
                    value={s3Form.access_key_id}
                    onChange={(e) => setS3Form({ ...s3Form, access_key_id: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Secret Access Key</Label>
                  <Input
                    type="password"
                    value={s3Form.secret_access_key}
                    onChange={(e) => setS3Form({ ...s3Form, secret_access_key: e.target.value })}
                    className="h-8"
                  />
                </div>
              </div>
            </div>

            {testResult && (
              <div className={cn(
                "p-2 rounded text-xs",
                testResult.success ? "bg-green-50 text-green-700 dark:bg-green-900/30" : "bg-red-50 text-red-700 dark:bg-red-900/30"
              )}>
                {testResult.success ? <Check className="h-3 w-3 inline mr-1" /> : <X className="h-3 w-3 inline mr-1" />}
                {testResult.message}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <a href={preset.helpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                Setup Guide <ExternalLink className="h-3 w-3 inline" />
              </a>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleS3Test} disabled={testing || !s3Form.bucket}>
                  {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Test"}
                </Button>
                <Button size="sm" onClick={handleS3Save} disabled={saving || !s3Form.name || !s3Form.bucket}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main Connections Tab
export function ConnectionsTab() {
  const [activeTab, setActiveTab] = React.useState("provider");

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("provider")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "provider"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Storage Provider
        </button>
        <button
          onClick={() => setActiveTab("costs")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "costs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Cost Comparison
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "provider" && <DocumentStorageProvider />}
      {activeTab === "costs" && <StorageCostTab />}
    </div>
  );
}
