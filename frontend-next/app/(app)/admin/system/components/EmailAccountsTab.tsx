"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Mail,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface ImapCredential {
  id: number;
  name: string;
  email_address: string;
  provider: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  sync_interval_minutes: number;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
}

interface Provider {
  id: string;
  name: string;
  settings: {
    imap_host: string;
    imap_port: number;
    imap_ssl: boolean;
    smtp_host: string;
    smtp_port: number;
    smtp_auth: string;
  } | null;
}

const DEFAULT_FORM = {
  name: "",
  email_address: "",
  provider: "",
  imap_host: "",
  imap_port: 993,
  smtp_host: "",
  smtp_port: 587,
  username: "",
  password: "",
};

export function EmailAccountsTab() {
  const [credentials, setCredentials] = useState<ImapCredential[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  // Fetch credentials and providers on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [credResponse, providerResponse] = await Promise.all([
        api.get<{ success: boolean; data: ImapCredential[] }>("/api/v1/imap_credentials"),
        api.get<{ success: boolean; data: Provider[] }>("/api/v1/imap_credentials/providers"),
      ]);
      setCredentials(credResponse.data || []);
      setProviders(providerResponse.data || []);
    } catch (error) {
      console.error("Failed to fetch email accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (provider?.settings) {
      setFormData((prev) => ({
        ...prev,
        provider: providerId,
        imap_host: provider.settings!.imap_host,
        imap_port: provider.settings!.imap_port,
        smtp_host: provider.settings!.smtp_host,
        smtp_port: provider.settings!.smtp_port,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        provider: providerId,
      }));
    }
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await api.post<{ success: boolean; error?: string }>("/api/v1/imap_credentials/test", {
        imap_credential: formData,
      });
      setTestResult(response);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setTestResult({
        success: false,
        error: err.response?.data?.error || "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.post("/api/v1/imap_credentials", {
        imap_credential: formData,
      });
      setDialogOpen(false);
      setFormData(DEFAULT_FORM);
      setTestResult(null);
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setTestResult({
        success: false,
        error: err.response?.data?.error || "Failed to add account",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this email account?")) return;

    try {
      await api.delete(`/api/v1/imap_credentials/${id}`);
      fetchData();
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  };

  const handleSync = async (id: number) => {
    setSyncingId(id);
    try {
      await api.post(`/api/v1/imap_credentials/${id}/sync`);
      // Refresh after a short delay
      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error("Failed to trigger sync:", error);
    } finally {
      setSyncingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Email Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Connect email accounts to sync and send emails from TEEEM.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Email Account</DialogTitle>
              <DialogDescription>
                Connect an email account using IMAP/SMTP. Your password is encrypted.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>Email Provider</Label>
                <Select value={formData.provider} onValueChange={handleProviderChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account Name */}
              <div className="space-y-2">
                <Label>Account Name (optional)</Label>
                <Input
                  placeholder="Work Email, Personal, etc."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* Email Address */}
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email_address}
                  onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                />
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  placeholder="Usually your email address"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label>Password / App Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  For Gmail/Outlook, use an App Password instead of your regular password.
                </p>
              </div>

              {/* Server Settings (shown for custom) */}
              {formData.provider === "custom" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>IMAP Host</Label>
                      <Input
                        placeholder="imap.example.com"
                        value={formData.imap_host}
                        onChange={(e) => setFormData({ ...formData, imap_host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IMAP Port</Label>
                      <Input
                        type="number"
                        value={formData.imap_port}
                        onChange={(e) =>
                          setFormData({ ...formData, imap_port: parseInt(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP Host</Label>
                      <Input
                        placeholder="smtp.example.com"
                        value={formData.smtp_host}
                        onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Port</Label>
                      <Input
                        type="number"
                        value={formData.smtp_port}
                        onChange={(e) =>
                          setFormData({ ...formData, smtp_port: parseInt(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Test Result */}
              {testResult && (
                <div
                  className={`p-3 rounded-md ${
                    testResult.success
                      ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                      : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Connection successful!</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        <span>{testResult.error}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !formData.email_address || !formData.password}
              >
                {testing ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !testResult?.success}
              >
                {saving ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Adding...
                  </>
                ) : (
                  "Add Account"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Account List */}
      {credentials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-medium mb-2">No email accounts connected</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Add an email account to start syncing and sending emails from TEEEM.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {credentials.map((cred) => (
            <Card key={cred.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {cred.name || cred.email_address}
                      </CardTitle>
                      <CardDescription>{cred.email_address}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={cred.is_active ? "default" : "secondary"}>
                      {cred.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {cred.provider && (
                      <Badge variant="outline">{cred.provider}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {/* Sync Status */}
                    <div className="flex items-center gap-1.5">
                      {cred.last_sync_status === "success" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : cred.last_sync_status === "error" ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                      <span>
                        {cred.last_synced_at
                          ? `Synced ${formatDistanceToNow(new Date(cred.last_synced_at), { addSuffix: true })}`
                          : "Never synced"}
                      </span>
                    </div>

                    {/* Server Info */}
                    <span className="hidden sm:inline">
                      IMAP: {cred.imap_host}:{cred.imap_port}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(cred.id)}
                      disabled={syncingId === cred.id}
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-1 ${syncingId === cred.id ? "animate-spin" : ""}`}
                      />
                      Sync
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(cred.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                {/* Error Message */}
                {cred.last_sync_error && (
                  <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 text-sm">
                    {cred.last_sync_error}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
