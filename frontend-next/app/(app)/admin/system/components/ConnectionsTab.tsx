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

// S3 Storage Connection Component
function S3StorageConnection() {
  const { toast } = useToast();
  const [credentials, setCredentials] = React.useState<S3Credential[]>([]);
  const [providers, setProviders] = React.useState<S3Provider[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [editingCredential, setEditingCredential] = React.useState<S3Credential | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    provider_type: "backblaze_b2",
    endpoint: "",
    region: "",
    bucket: "",
    access_key_id: "",
    secret_access_key: "",
    root_path: "",
  });

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [credsData, providersData] = await Promise.all([
        api.get<{ success: boolean; data: S3Credential[] }>("/api/v1/s3_credentials"),
        api.get<{ success: boolean; data: S3Provider[] }>("/api/v1/s3_credentials/providers"),
      ]);
      setCredentials(credsData.data || []);
      setProviders(providersData.data || []);
    } catch (error) {
      console.error("Failed to load S3 data:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      provider_type: "backblaze_b2",
      endpoint: "",
      region: "",
      bucket: "",
      access_key_id: "",
      secret_access_key: "",
      root_path: "",
    });
    setTestResult(null);
    setEditingCredential(null);
  };

  const handleProviderChange = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    setFormData({
      ...formData,
      provider_type: providerId,
      endpoint: provider?.endpoint_template || "",
    });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<{
        success: boolean;
        message?: string;
        error?: string;
      }>("/api/v1/s3_credentials/test", {
        s3_credential: formData,
      });
      if (result) {
        setTestResult({
          success: result.success,
          message: result.success ? result.message || "Connection successful" : result.error || "Connection failed",
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setTestResult({
        success: false,
        message: err?.response?.data?.error || "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingCredential) {
        await api.patch(`/api/v1/s3_credentials/${editingCredential.id}`, {
          s3_credential: formData,
        });
        toast({ title: "Success", description: "S3 credential updated" });
      } else {
        await api.post("/api/v1/s3_credentials", {
          s3_credential: formData,
        });
        toast({ title: "Success", description: "S3 storage connected successfully" });
      }
      setShowAddDialog(false);
      resetForm();
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        title: "Error",
        description: err?.response?.data?.error || "Failed to save credential",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (credential: S3Credential) => {
    setEditingCredential(credential);
    setFormData({
      name: credential.name,
      provider_type: credential.provider_type,
      endpoint: credential.endpoint || "",
      region: credential.region,
      bucket: credential.bucket,
      access_key_id: "",
      secret_access_key: "",
      root_path: credential.root_path || "",
    });
    setTestResult(null);
    setShowAddDialog(true);
  };

  const handleDelete = async (credential: S3Credential) => {
    if (!confirm(`Delete "${credential.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/v1/s3_credentials/${credential.id}`);
      toast({ title: "Success", description: "S3 credential deleted" });
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete credential", variant: "destructive" });
    }
  };

  const handleTestExisting = async (credential: S3Credential) => {
    try {
      const result = await api.post<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/v1/s3_credentials/${credential.id}/test_connection`);
      if (result) {
        toast({
          title: result.success ? "Success" : "Error",
          description: result.success ? "Connection successful" : result.error || "Connection failed",
          variant: result.success ? "default" : "destructive",
        });
        loadData();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        title: "Error",
        description: err?.response?.data?.error || "Connection test failed",
        variant: "destructive",
      });
    }
  };

  const selectedProvider = providers.find((p) => p.id === formData.provider_type);
  const hasConnected = credentials.some((c) => c.status === "connected");

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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                <HardDrive className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-base">S3-Compatible Storage</CardTitle>
                <CardDescription>
                  Alternative document storage (Backblaze B2, AWS S3, MinIO, etc.)
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={hasConnected ? "default" : "secondary"}>
                {hasConnected ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    {credentials.filter((c) => c.status === "connected").length} Connected
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3 mr-1" />
                    Not Connected
                  </>
                )}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setShowAddDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {credentials.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <HardDrive className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No S3 storage configured</p>
              <p className="text-sm">Add a storage provider to use as alternative to SharePoint</p>
            </div>
          ) : (
            <div className="space-y-3">
              {credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={cred.status === "connected" ? "default" : "secondary"}
                      className={cn(
                        cred.status === "error" && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      )}
                    >
                      {cred.status === "connected" ? (
                        <Check className="h-3 w-3 mr-1" />
                      ) : cred.status === "error" ? (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      ) : (
                        <X className="h-3 w-3 mr-1" />
                      )}
                      {cred.status}
                    </Badge>
                    <div>
                      <p className="font-medium">{cred.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {cred.provider_display_name} • {cred.bucket} • {cred.region}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestExisting(cred)}
                      title="Test Connection"
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(cred)}
                      title="Edit"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(cred)}
                      title="Delete"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
            <p className="font-medium mb-1">Supported Providers:</p>
            <p>
              Backblaze B2 (~$0.006/GB) • AWS S3 • Wasabi • MinIO (self-hosted, free) • Synology NAS
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit S3 Credential Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCredential ? "Edit S3 Storage" : "Add S3 Storage"}
            </DialogTitle>
            <DialogDescription>
              Connect an S3-compatible storage provider for document storage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label htmlFor="provider_type">Provider</Label>
              <Select
                value={formData.provider_type}
                onValueChange={handleProviderChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      <div className="flex flex-col">
                        <span>{provider.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {provider.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                placeholder="e.g., Job Documents Storage"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Endpoint (not for AWS) */}
            {formData.provider_type !== "aws_s3" && (
              <div className="space-y-2">
                <Label htmlFor="endpoint">Endpoint URL</Label>
                <Input
                  id="endpoint"
                  placeholder={selectedProvider?.endpoint_template || "https://..."}
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {selectedProvider?.region_hint}
                </p>
              </div>
            )}

            {/* Region */}
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                placeholder={selectedProvider?.region_hint || "e.g., us-east-1"}
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              />
            </div>

            {/* Bucket */}
            <div className="space-y-2">
              <Label htmlFor="bucket">Bucket Name</Label>
              <Input
                id="bucket"
                placeholder="my-teeem-documents"
                value={formData.bucket}
                onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
              />
            </div>

            {/* Credentials */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="access_key_id">Access Key ID</Label>
                <Input
                  id="access_key_id"
                  placeholder={editingCredential ? "(unchanged)" : "Your access key"}
                  value={formData.access_key_id}
                  onChange={(e) => setFormData({ ...formData, access_key_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret_access_key">Secret Access Key</Label>
                <Input
                  id="secret_access_key"
                  type="password"
                  placeholder={editingCredential ? "(unchanged)" : "Your secret key"}
                  value={formData.secret_access_key}
                  onChange={(e) => setFormData({ ...formData, secret_access_key: e.target.value })}
                />
              </div>
            </div>

            {/* Root Path (Advanced) */}
            <Accordion type="single" collapsible>
              <AccordionItem value="advanced">
                <AccordionTrigger className="text-sm">Advanced Settings</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="root_path">Root Path (Optional)</Label>
                    <Input
                      id="root_path"
                      placeholder="e.g., teeem/documents"
                      value={formData.root_path}
                      onChange={(e) => setFormData({ ...formData, root_path: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      All files will be stored under this prefix in the bucket
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Test Result */}
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

            {/* Help Link */}
            {selectedProvider?.help_url && (
              <div className="text-sm text-muted-foreground">
                <a
                  href={selectedProvider.help_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {selectedProvider.name} Documentation{" "}
                  <ExternalLink className="h-3 w-3 inline" />
                </a>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !formData.bucket || !formData.region || (!editingCredential && (!formData.access_key_id || !formData.secret_access_key))}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test
                </>
              )}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.name || !formData.bucket || !formData.region || (!editingCredential && (!formData.access_key_id || !formData.secret_access_key))}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Main Connections Tab
export function ConnectionsTab() {
  return (
    <div className="space-y-6">
      <SharePointConnection />
      <S3StorageConnection />
      <OutlookConnection />
      <TwilioConfiguration />
    </div>
  );
}
