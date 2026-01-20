"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  Mail,
  Server,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PolarisCredential {
  id: number;
  admin_username: string;
  status: "pending" | "connected" | "error" | "disconnected";
  is_active: boolean;
  last_connected_at: string | null;
  last_error_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface CredentialResponse {
  success: boolean;
  data: PolarisCredential | null;
  configured: boolean;
  message?: string;
  error?: string;
}

export function EmailResellerSettings() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [credential, setCredential] = React.useState<PolarisCredential | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Form state
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  const fetchCredential = React.useCallback(async () => {
    try {
      const response = await api.get<CredentialResponse>("/api/v1/polaris_credentials");
      if (response.success && response.data) {
        setCredential(response.data);
        setUsername(response.data.admin_username || "");
      } else {
        setCredential(null);
      }
    } catch (err) {
      console.error("Failed to fetch credentials:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCredential();
  }, [fetchCredential]);

  const handleSave = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<CredentialResponse>("/api/v1/polaris_credentials", {
        admin_username: username.trim(),
        admin_password: password.trim(),
      });

      if (!response) {
        setError("Failed to save credentials. Please try again.");
        return;
      }

      if (response.success) {
        setCredential(response.data);
        setPassword(""); // Clear password after save
        setSuccess(response.message || "Credentials saved successfully");
      } else {
        setError(response.error || "Failed to save credentials");
      }
    } catch (err) {
      setError("Failed to save credentials. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!credential) return;

    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/polaris_credentials/${credential.id}/test`
      );

      if (!response) {
        setError("Connection test failed. Please try again.");
        return;
      }

      if (response.success) {
        setSuccess("Connection successful!");
        fetchCredential(); // Refresh to get updated status
      } else {
        setError(response.error || "Connection test failed");
      }
    } catch (err) {
      setError("Connection test failed. Please check your credentials.");
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = () => {
    if (!credential) return null;

    switch (credential.status) {
      case "connected":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <RefreshCw className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                EmailArray Connection
              </CardTitle>
              <CardDescription>
                Connect to EmailArray (PolarisMail) to manage email subscriptions
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                {success}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Admin Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Your EmailArray admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The username you use to log into admin.emailarray.com
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Admin Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={credential ? "Enter new password to update" : "Your EmailArray admin password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {credential
                  ? "Leave blank to keep existing password, or enter new password to update"
                  : "Your password is encrypted and stored securely"}
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : credential ? (
                "Update Credentials"
              ) : (
                "Save & Connect"
              )}
            </Button>

            {credential && (
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            )}
          </div>

          {credential?.error_message && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-md">
              <p className="text-sm text-red-700 dark:text-red-300">
                <strong>Last Error:</strong> {credential.error_message}
              </p>
              {credential.last_error_at && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  {new Date(credential.last_error_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {credential?.last_connected_at && credential.status === "connected" && (
            <p className="text-xs text-muted-foreground">
              Last connected: {new Date(credential.last_connected_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            How Email Reseller Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="font-medium">1. Connect</div>
              <p className="text-sm text-muted-foreground">
                Enter your EmailArray admin credentials above to connect TEEEM to your reseller account.
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-medium">2. Add Domains</div>
              <p className="text-sm text-muted-foreground">
                Create subscriptions for client domains. DNS records are automatically provisioned via Cloudflare.
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-medium">3. Create Mailboxes</div>
              <p className="text-sm text-muted-foreground">
                Add mailboxes with one click. Users get automatic setup instructions and webmail access.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              <strong>Need an EmailArray account?</strong>{" "}
              <a
                href="https://www.emailarray.com/reseller"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Sign up for EmailArray Reseller
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
