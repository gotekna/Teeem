"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/ui/back-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, CheckCircle2, XCircle, GitBranch, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface XeroStatus {
  connected: boolean;
  organization_name?: string;
  tenant_name?: string;
}

interface TenantEnvironment {
  environment: "staging" | "beta" | "production";
  name: string;
}

interface TenantResponse {
  tenant: {
    environment?: "staging" | "beta" | "production";
    name: string;
  };
}

export default function IntegrationsPage() {
  const [xeroStatus, setXeroStatus] = React.useState<XeroStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tenantEnv, setTenantEnv] = React.useState<TenantEnvironment | null>(null);
  const [envLoading, setEnvLoading] = React.useState(true);
  const [envSaving, setEnvSaving] = React.useState(false);

  React.useEffect(() => {
    const fetchXeroStatus = async () => {
      try {
        const response = await api.xero.getStatus();
        setXeroStatus(response.data || { connected: false });
      } catch (error) {
        console.error("Failed to fetch Xero status:", error);
        setXeroStatus({ connected: false });
      } finally {
        setLoading(false);
      }
    };
    fetchXeroStatus();
  }, []);

  // Fetch current tenant environment
  React.useEffect(() => {
    const fetchTenantEnv = async () => {
      try {
        const response = await api.get<TenantResponse>("/api/v1/admin/tenants/current");
        if (response.tenant) {
          setTenantEnv({
            environment: response.tenant.environment || "staging",
            name: response.tenant.name,
          });
        }
      } catch (error) {
        console.error("Failed to fetch tenant environment:", error);
      } finally {
        setEnvLoading(false);
      }
    };
    fetchTenantEnv();
  }, []);

  const handleEnvironmentChange = async (newEnv: string) => {
    if (!tenantEnv) return;
    setEnvSaving(true);
    try {
      await api.patch("/api/v1/admin/tenants/environment", {
        environment: newEnv,
      });
      setTenantEnv({ ...tenantEnv, environment: newEnv as TenantEnvironment["environment"] });
      toast.success(`Environment changed to ${newEnv}`);
    } catch (error) {
      console.error("Failed to update environment:", error);
      toast.error("Failed to update environment");
    } finally {
      setEnvSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/settings" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect your external services to Teeem
          </p>
        </div>
      </div>

      {/* Environment Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <GitBranch className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Environment</CardTitle>
              <CardDescription>Choose which version of TEEEM to use</CardDescription>
            </div>
            {envLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Select
                value={tenantEnv?.environment || "staging"}
                onValueChange={handleEnvironmentChange}
                disabled={envSaving}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-500" />
                      Staging
                    </div>
                  </SelectItem>
                  <SelectItem value="beta">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      Beta
                    </div>
                  </SelectItem>
                  <SelectItem value="production">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      Live
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Staging:</strong> Latest features, may have bugs. For testing.</p>
            <p><strong>Beta:</strong> Pre-release features, more stable. For early access.</p>
            <p><strong>Live:</strong> Production-ready, fully tested. Recommended.</p>
          </div>
        </CardContent>
      </Card>

      {/* Integration Cards */}
      {/* Microsoft 365 org-wide access is managed in Admin System → Connections */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Xero */}
        <Card className="hover:bg-accent/50 transition-colors">
          <Link href="/settings/integrations/xero">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 dark:bg-cyan-900 rounded-lg">
                    <FileSpreadsheet className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Xero</CardTitle>
                    <CardDescription>Accounting Software</CardDescription>
                  </div>
                </div>
                {!loading && (
                  xeroStatus?.connected ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" />
                      Not Connected
                    </Badge>
                  )
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sync invoices, bills, and contacts with your Xero accounting system.
              </p>
              {!loading && xeroStatus?.connected && xeroStatus.tenant_name && (
                <p className="text-sm font-medium mt-2 text-cyan-700 dark:text-cyan-400">
                  {xeroStatus.tenant_name}
                </p>
              )}
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
