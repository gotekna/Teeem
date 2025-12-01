"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  Link2,
  ArrowRightLeft,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// Xero Connection Component
function XeroConnection() {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<{
    connected: boolean;
    tenant_name?: string;
    tenant_id?: string;
    expires_at?: string;
    needs_refresh?: boolean;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  React.useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await api.get<typeof status>("/api/v1/xero/status");
      setStatus(data);
    } catch (error) {
      console.error("Failed to load Xero status:", error);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const data = await api.get<{ auth_url: string }>("/api/v1/xero/auth_url");
      window.location.href = data.auth_url;
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      toast({ title: "Error", description: "Failed to initiate Xero connection", variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Xero? This will remove all sync settings.")) return;
    setDisconnecting(true);
    try {
      await api.delete("/api/v1/xero/disconnect");
      toast({ title: "Success", description: "Xero disconnected successfully" });
      setStatus({ connected: false });
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast({ title: "Error", description: "Failed to disconnect Xero", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22.5C6.201 22.5 1.5 17.799 1.5 12S6.201 1.5 12 1.5 22.5 6.201 22.5 12 17.799 22.5 12 22.5zm-2.25-6h4.5L12 7.5l-2.25 9z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-base">Xero Integration</CardTitle>
                <CardDescription>Connect to Xero for accounting sync</CardDescription>
              </div>
            </div>
            <Badge
              variant={status?.connected ? (status?.needs_refresh ? "outline" : "default") : "secondary"}
              className={cn(status?.needs_refresh && "border-yellow-500 text-yellow-600")}
            >
              {status?.connected ? (
                status?.needs_refresh ? (
                  <>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Needs Reconnection
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
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Organization:</span>
                  <p className="font-medium">{status.tenant_name || "Unknown"}</p>
                </div>
                {status.expires_at && (
                  <div>
                    <span className="text-muted-foreground">Token Expires:</span>
                    <p className="font-medium">
                      {new Date(status.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
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
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Xero account to sync invoices, contacts, and payments.
              </p>
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Connect to Xero
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Field Mapping Component
function XeroFieldMapping() {
  const { toast } = useToast();
  const [mappings, setMappings] = React.useState<
    Array<{
      id: number;
      teeem_field: string;
      xero_field: string;
      entity_type: string;
      enabled: boolean;
    }>
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      const data = await api.get<typeof mappings>("/api/v1/xero/field_mappings");
      setMappings(data);
    } catch (error) {
      console.error("Failed to load mappings:", error);
      // Mock data
      setMappings([
        { id: 1, teeem_field: "contact.name", xero_field: "Contact.Name", entity_type: "contact", enabled: true },
        { id: 2, teeem_field: "contact.email", xero_field: "Contact.EmailAddress", entity_type: "contact", enabled: true },
        { id: 3, teeem_field: "contact.phone", xero_field: "Contact.Phones[0].PhoneNumber", entity_type: "contact", enabled: true },
        { id: 4, teeem_field: "invoice.number", xero_field: "Invoice.InvoiceNumber", entity_type: "invoice", enabled: true },
        { id: 5, teeem_field: "invoice.amount", xero_field: "Invoice.Total", entity_type: "invoice", enabled: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleMapping = async (id: number) => {
    const mapping = mappings.find((m) => m.id === id);
    if (!mapping) return;

    try {
      await api.patch(`/api/v1/xero/field_mappings/${id}`, {
        field_mapping: { enabled: !mapping.enabled },
      });
      setMappings(mappings.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)));
    } catch (error) {
      console.error("Failed to update mapping:", error);
      toast({ title: "Error", description: "Failed to update mapping", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const groupedMappings = mappings.reduce((acc, mapping) => {
    if (!acc[mapping.entity_type]) {
      acc[mapping.entity_type] = [];
    }
    acc[mapping.entity_type].push(mapping);
    return acc;
  }, {} as Record<string, typeof mappings>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedMappings).map(([entityType, entityMappings]) => (
        <Card key={entityType}>
          <CardHeader>
            <CardTitle className="text-base capitalize">{entityType} Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>TEEEM Field</TableHead>
                  <TableHead>
                    <ArrowRightLeft className="h-4 w-4" />
                  </TableHead>
                  <TableHead>Xero Field</TableHead>
                  <TableHead className="w-[100px]">Enabled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entityMappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell className="font-mono text-sm">{mapping.teeem_field}</TableCell>
                    <TableCell>
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{mapping.xero_field}</TableCell>
                    <TableCell>
                      <Switch
                        checked={mapping.enabled}
                        onCheckedChange={() => toggleMapping(mapping.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Contact Sync Component
function XeroContactSync() {
  const { toast } = useToast();
  const [config, setConfig] = React.useState<{
    sync_enabled: boolean;
    sync_direction: string;
    auto_sync: boolean;
    sync_interval_minutes: number;
    last_sync_at?: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await api.get<typeof config>("/api/v1/xero/sync_config");
      setConfig(data);
    } catch (error) {
      console.error("Failed to load config:", error);
      // Mock data
      setConfig({
        sync_enabled: true,
        sync_direction: "bidirectional",
        auto_sync: false,
        sync_interval_minutes: 60,
        last_sync_at: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api.put("/api/v1/xero/sync_config", { sync_config: config });
      toast({ title: "Success", description: "Sync configuration saved" });
    } catch (error) {
      console.error("Failed to save config:", error);
      toast({ title: "Error", description: "Failed to save configuration", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/api/v1/xero/sync_contacts");
      toast({ title: "Success", description: "Contact sync completed" });
      loadConfig();
    } catch (error) {
      console.error("Failed to sync:", error);
      toast({ title: "Error", description: "Sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Configuration</CardTitle>
          <CardDescription>Configure how contacts are synced with Xero</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Contact Sync</Label>
              <p className="text-sm text-muted-foreground">
                Sync contacts between TEEEM and Xero
              </p>
            </div>
            <Switch
              checked={config?.sync_enabled || false}
              onCheckedChange={(checked) =>
                setConfig(config ? { ...config, sync_enabled: checked } : null)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Sync Direction</Label>
            <Select
              value={config?.sync_direction || "bidirectional"}
              onValueChange={(value) =>
                setConfig(config ? { ...config, sync_direction: value } : null)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="to_xero">TEEEM → Xero only</SelectItem>
                <SelectItem value="from_xero">Xero → TEEEM only</SelectItem>
                <SelectItem value="bidirectional">Bidirectional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Automatic Sync</Label>
              <p className="text-sm text-muted-foreground">
                Automatically sync contacts at regular intervals
              </p>
            </div>
            <Switch
              checked={config?.auto_sync || false}
              onCheckedChange={(checked) =>
                setConfig(config ? { ...config, auto_sync: checked } : null)
              }
            />
          </div>

          {config?.auto_sync && (
            <div className="space-y-2">
              <Label>Sync Interval (minutes)</Label>
              <Select
                value={String(config?.sync_interval_minutes || 60)}
                onValueChange={(value) =>
                  setConfig(config ? { ...config, sync_interval_minutes: Number(value) } : null)
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                  <SelectItem value="360">Every 6 hours</SelectItem>
                  <SelectItem value="1440">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {config?.last_sync_at && (
            <p className="text-sm text-muted-foreground">
              Last synced: {new Date(config.last_sync_at).toLocaleString()}
            </p>
          )}

          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Xero Tab
export function XeroTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const xeroTab = searchParams.get("xeroTab") || "connection";

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("xeroTab", value);
    router.push(`/admin/system?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <Tabs value={xeroTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="connection" className="gap-2">
            <Link2 className="h-4 w-4" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="mapping" className="gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Field Mapping
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Contact Sync
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="connection">
            <XeroConnection />
          </TabsContent>
          <TabsContent value="mapping">
            <XeroFieldMapping />
          </TabsContent>
          <TabsContent value="sync">
            <XeroContactSync />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
