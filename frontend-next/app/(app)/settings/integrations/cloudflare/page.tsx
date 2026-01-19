'use client';

import * as React from 'react';
import { useConfirm } from "@/contexts/ConfirmationContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Cloud,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Eye,
  EyeOff,
  Globe,
  Settings2,
} from 'lucide-react';
import { BackButton } from '@/components/ui/back-button';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type {
  CloudflareCredential,
  CloudflareZone,
  CloudflareCredentialResponse,
  CloudflareTestResponse,
  CloudflareZonesResponse,
} from '@/lib/email-reseller-types';

export default function CloudflareSettingsPage() {
  const { confirm } = useConfirm();
  const [credential, setCredential] = React.useState<CloudflareCredential | null>(null);
  const [zones, setZones] = React.useState<CloudflareZone[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [showToken, setShowToken] = React.useState(false);

  // Form state
  const [apiToken, setApiToken] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [email, setEmail] = React.useState('');

  // Load current credential
  React.useEffect(() => {
    const loadCredential = async () => {
      try {
        const response = await api.get<CloudflareCredentialResponse>('/api/v1/cloudflare_credentials');
        if (response?.success && response.data) {
          setCredential(response.data);
          setAccountId(response.data.account_id || '');
          setEmail(response.data.email || '');

          // If connected, load zones
          if (response.data.status === 'connected') {
            loadZones();
          }
        }
      } catch (error) {
        console.error('Failed to load Cloudflare credential:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCredential();
  }, []);

  const loadZones = async () => {
    try {
      const response = await api.get<CloudflareZonesResponse>('/api/v1/cloudflare_credentials/zones');
      if (response?.success && response.data) {
        setZones(response.data);
      }
    } catch (error) {
      console.error('Failed to load zones:', error);
    }
  };

  const handleSave = async () => {
    if (!apiToken && !credential) {
      toast.error('API token is required');
      return;
    }
    if (!accountId) {
      toast.error('Account ID is required');
      return;
    }

    setSaving(true);
    try {
      const payload: { api_token?: string; account_id: string; email?: string } = {
        account_id: accountId,
        email: email || undefined,
      };

      // Only include token if it was changed (not empty)
      if (apiToken) {
        payload.api_token = apiToken;
      }

      const response = await api.post<CloudflareCredentialResponse>('/api/v1/cloudflare_credentials', payload);

      if (response?.success && response.data) {
        setCredential(response.data);
        setApiToken(''); // Clear token after save
        toast.success('Cloudflare credentials saved', {
          description: 'Testing connection in background...',
        });

        // Reload after a short delay to get updated status
        setTimeout(async () => {
          const updated = await api.get<CloudflareCredentialResponse>('/api/v1/cloudflare_credentials');
          if (updated?.success && updated.data) {
            setCredential(updated.data);
            if (updated.data.status === 'connected') {
              loadZones();
            }
          }
        }, 2000);
      } else {
        toast.error('Failed to save credentials', {
          description: (response as { error?: string })?.error || 'Unknown error',
        });
      }
    } catch (error) {
      toast.error('Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!credential?.id) {
      toast.error('Save credentials first');
      return;
    }

    setTesting(true);
    try {
      const response = await api.post<CloudflareTestResponse>(
        `/api/v1/cloudflare_credentials/${credential.id}/test`
      );

      if (response?.success && response.data?.connected) {
        toast.success('Connection successful', {
          description: `Found ${response.data.zones_count} zones in your Cloudflare account.`,
        });

        // Reload credential to get updated status
        const updated = await api.get<CloudflareCredentialResponse>('/api/v1/cloudflare_credentials');
        if (updated?.success && updated.data) {
          setCredential(updated.data);
          loadZones();
        }
      } else {
        toast.error('Connection failed', {
          description: response?.error || 'Could not connect to Cloudflare',
        });
      }
    } catch (error) {
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!credential?.id) return;

    if (!(await confirm('Are you sure you want to disconnect Cloudflare?'))) return;

    try {
      await api.delete(`/api/v1/cloudflare_credentials/${credential.id}`);
      setCredential(null);
      setZones([]);
      setApiToken('');
      setAccountId('');
      setEmail('');
      toast.success('Cloudflare disconnected');
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const isConnected = credential?.status === 'connected';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/settings/company/connections/integrations" />
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
            <Cloud className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Cloudflare</h1>
            <p className="text-muted-foreground">DNS Management for Email Reseller</p>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Connection Status</CardTitle>
            {isConnected ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : credential?.status === 'error' ? (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Error
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
          <CardDescription>
            Connect your Cloudflare account to enable automatic DNS provisioning for email domains.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {credential?.error_message && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>{credential.error_message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="accountId">Account ID *</Label>
                <Input
                  id="accountId"
                  placeholder="Enter your Cloudflare Account ID"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Found in Cloudflare Dashboard → Manage Account → Account ID
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Account Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">For reference only</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiToken">
                API Token {credential ? '(leave empty to keep current)' : '*'}
              </Label>
              <div className="relative">
                <Input
                  id="apiToken"
                  type={showToken ? 'text' : 'password'}
                  placeholder={credential ? '••••••••••••••••' : 'Enter your Cloudflare API Token'}
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Create a scoped API token with Zone:Read and DNS:Edit permissions.{' '}
                <a
                  href="https://dash.cloudflare.com/profile/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Create Token <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                {credential ? 'Update Credentials' : 'Save Credentials'}
              </Button>
              {credential && (
                <>
                  <Button variant="outline" onClick={handleTest} disabled={testing}>
                    {testing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Settings2 className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                  <Button variant="destructive" onClick={handleDisconnect}>
                    Disconnect
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zones List */}
      {isConnected && zones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Available Zones ({zones.length})
            </CardTitle>
            <CardDescription>
              Domains in your Cloudflare account that can be used for email DNS management.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-mono text-sm">{zone.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{zone.status}</p>
                  </div>
                  <Badge
                    variant={zone.status === 'active' ? 'default' : 'secondary'}
                    className="ml-2"
                  >
                    {zone.status === 'active' ? 'Active' : zone.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              Go to{' '}
              <a
                href="https://dash.cloudflare.com/profile/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Cloudflare API Tokens
              </a>
            </li>
            <li>Click "Create Token"</li>
            <li>Use "Edit zone DNS" template or create custom with:</li>
            <ul className="list-disc list-inside ml-4 space-y-1 text-muted-foreground">
              <li>Permissions: Zone → Zone → Read</li>
              <li>Permissions: Zone → DNS → Edit</li>
              <li>Zone Resources: Include → All zones (or specific zones)</li>
            </ul>
            <li>Copy the token and paste above</li>
            <li>Find your Account ID in the Cloudflare dashboard sidebar</li>
          </ol>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="font-medium">What this enables:</p>
            <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground space-y-1">
              <li>Automatic MX record creation for email delivery</li>
              <li>SPF, DKIM, and DMARC records for email authentication</li>
              <li>Autodiscover records for email client configuration</li>
              <li>DNS verification and health monitoring</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
