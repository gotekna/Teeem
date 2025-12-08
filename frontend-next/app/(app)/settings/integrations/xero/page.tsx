"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Link2,
  ArrowRightLeft,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { XeroFieldMapping, XeroContactSync } from "./components/XeroTabs";
import { XeroPdfSyncStatus } from "./components/XeroPdfSyncStatus";

interface XeroStatus {
  connected: boolean;
  organization_name?: string;
  tenant_name?: string;
  tenant_id?: string;
  connected_at?: string;
  expires_at?: string;
  expired?: boolean;
}

interface XeroTenant {
  id: number;
  tenant_id: string;
  tenant_name: string;
  connected_at: string;
  is_primary: boolean;
  expires_at?: string;
  expired?: boolean;
}

interface ValidationTest {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "passed" | "failed";
  error?: string;
}

export default function XeroIntegrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "connection";
  const [status, setStatus] = React.useState<XeroStatus | null>(null);
  const [tenants, setTenants] = React.useState<XeroTenant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [validationTests, setValidationTests] = React.useState<ValidationTest[]>([]);
  const [runningTests, setRunningTests] = React.useState(false);
  const [healthCheckExpanded, setHealthCheckExpanded] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch status
        const statusResponse = await api.xero.getStatus();
        setStatus(statusResponse.data || { connected: false });

        // Fetch all tenants
        if (statusResponse.data?.connected) {
          const tenantsResponse = await api.get<{ success: boolean; tenants: XeroTenant[] }>("/api/v1/xero/tenants");
          setTenants(tenantsResponse.tenants || []);
        }
      } catch (error) {
        console.error("Failed to fetch Xero data:", error);
        setStatus({ connected: false });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Note: Auto-refresh happens in backend's connection_status method
  // If it reaches here with expired=true, the auto-refresh failed
  // and user needs to manually reconnect via OAuth flow

  const runValidationTests = async () => {
    setRunningTests(true);

    const tests: ValidationTest[] = [
      {
        id: "oauth_connection",
        name: "OAuth Connection",
        description: "Verify OAuth token is valid and not expired",
        status: "pending",
      },
      {
        id: "organisation_access",
        name: "Organisation Access",
        description: "Fetch organisation details from Xero API",
        status: "pending",
      },
      {
        id: "contacts_read",
        name: "Contacts Read Access",
        description: "Test reading contacts from Xero",
        status: "pending",
      },
      {
        id: "invoices_read",
        name: "Invoices Read Access",
        description: "Test reading invoices from Xero",
        status: "pending",
      },
      {
        id: "warehouse_sync",
        name: "Warehouse Sync Status",
        description: "Check local warehouse has synced data",
        status: "pending",
      },
      {
        id: "tracking_categories",
        name: "Tracking Categories Access",
        description: "Verify job tracking categories are accessible",
        status: "pending",
      },
      {
        id: "contact_validation",
        name: "Contact Data Validation",
        description: "Check contacts for Xero sync compatibility",
        status: "pending",
      },
    ];

    setValidationTests(tests);

    // Run tests sequentially
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];

      // Mark as running
      setValidationTests(prev => prev.map((t, idx) =>
        idx === i ? { ...t, status: "running" } : t
      ));

      try {
        let passed = false;
        let errorMsg = "";

        switch (test.id) {
          case "oauth_connection": {
            const statusRes = await api.xero.getStatus();
            passed = statusRes.data?.connected && !statusRes.data?.expired;
            if (!passed) {
              errorMsg = statusRes.data?.expired ? "Token expired" : "Not connected";
            }
            break;
          }

          case "organisation_access": {
            try {
              const orgRes = await api.get<{ success: boolean; data: any }>("/api/v1/xero/organisation");
              passed = orgRes.success && orgRes.data?.Organisations?.length > 0;
              if (!passed) errorMsg = "Could not fetch organisation data";
            } catch (err: any) {
              errorMsg = err.message || "API call failed";
            }
            break;
          }

          case "contacts_read": {
            try {
              const contactsRes = await api.get<{ success: boolean; data: any }>("/api/v1/xero/contacts?page=1");
              passed = contactsRes.success;
              if (!passed) errorMsg = "Could not fetch contacts";
            } catch (err: any) {
              errorMsg = err.message || "API call failed";
            }
            break;
          }

          case "invoices_read": {
            try {
              const invoicesRes = await api.get<{ success: boolean; data: any }>("/api/v1/xero/invoices?page=1");
              passed = invoicesRes.success;
              if (!passed) errorMsg = "Could not fetch invoices";
            } catch (err: any) {
              errorMsg = err.message || "API call failed";
            }
            break;
          }

          case "warehouse_sync": {
            try {
              const warehouseRes = await api.get<{ success: boolean; meta: any }>("/api/v1/external_invoices?type=invoice&per_page=1");
              passed = warehouseRes.success && warehouseRes.meta?.last_synced_at !== null;
              if (!passed) errorMsg = "Warehouse not synced - run sync first";
            } catch (err: any) {
              errorMsg = err.message || "API call failed";
            }
            break;
          }

          case "tracking_categories": {
            try {
              const trackingRes = await api.get<{ success: boolean; data: any }>("/api/v1/xero/tracking_categories");
              passed = trackingRes.success;
              if (!passed) errorMsg = "Could not fetch tracking categories";
            } catch (err: any) {
              errorMsg = err.message || "API call failed";
            }
            break;
          }

          case "contact_validation": {
            try {
              const validationRes = await api.get<{
                success: boolean;
                data: {
                  total_contacts: number;
                  valid_contacts: number;
                  invalid_contacts: number;
                  errors_by_type: Record<string, number>;
                  sample_errors: Array<{
                    contact_id: number;
                    contact_name: string;
                    errors: Array<{ field: string; message: string }>;
                  }>;
                }
              }>("/api/v1/xero/validate_contacts");

              if (validationRes.success) {
                const { invalid_contacts, total_contacts, errors_by_type } = validationRes.data;

                if (invalid_contacts === 0) {
                  passed = true;
                } else {
                  // Show summary of issues
                  const errorTypes = Object.entries(errors_by_type)
                    .map(([field, count]) => `${field}: ${count}`)
                    .join(", ");
                  errorMsg = `${invalid_contacts}/${total_contacts} contacts have issues (${errorTypes})`;
                  passed = false;
                }
              } else {
                errorMsg = "Could not validate contacts";
              }
            } catch (err: any) {
              errorMsg = err.message || "API call failed";
            }
            break;
          }
        }

        // Mark as passed or failed
        setValidationTests(prev => prev.map((t, idx) =>
          idx === i ? {
            ...t,
            status: passed ? "passed" : "failed",
            error: passed ? undefined : errorMsg
          } : t
        ));

      } catch (error: any) {
        // Mark as failed
        setValidationTests(prev => prev.map((t, idx) =>
          idx === i ? {
            ...t,
            status: "failed",
            error: error.message || "Test failed"
          } : t
        ));
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setRunningTests(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await api.xero.getAuthUrl();
      const authUrl = response.auth_url || response.url; // Handle both response formats
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        throw new Error("No authorization URL received from server");
      }
    } catch (error) {
      console.error("Failed to get Xero auth URL:", error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.xero.disconnect();
      setStatus({ connected: false });
    } catch (error) {
      console.error("Failed to disconnect Xero:", error);
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
          <h1 className="text-2xl font-bold tracking-tight font-serif">Xero Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your Xero account for accounting and invoicing
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={currentTab}
        onValueChange={(value) => {
          router.push(`/settings/integrations/xero?tab=${value}`);
        }}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connection">
            <Link2 className="h-4 w-4 mr-2" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="mapping">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Field Mapping
          </TabsTrigger>
          <TabsTrigger value="sync">
            <Users className="h-4 w-4 mr-2" />
            Contact Sync
          </TabsTrigger>
        </TabsList>

        {/* Connection Tab */}
        <TabsContent value="connection" className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-100 rounded-lg">
                    <CreditCard className="h-6 w-6 text-cyan-600" />
                  </div>
                  <div>
                    <CardTitle>Xero</CardTitle>
                    <CardDescription>Accounting & invoicing platform</CardDescription>
                  </div>
                </div>
                {status?.connected ? (
                  status?.expired ? (
                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Token Expired
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Organization</p>
                      <p className="font-medium">{status.tenant_name || status.organization_name || "Unknown"}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Tenant ID</p>
                      <p className="font-medium text-xs">{status.tenant_id || "Unknown"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Token Expires</p>
                      <p className="font-medium">
                        {status.expires_at
                          ? new Date(status.expires_at).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "Unknown"}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-medium">
                        {status.expired ? (
                          <span className="text-red-600">Expired - Reconnect Required</span>
                        ) : (
                          <span className="text-green-600">Active</span>
                        )}
                      </p>
                    </div>
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
                      Connect your Xero account to sync invoices, expenses, and financial data.
                    </AlertDescription>
                  </Alert>

                  <Button onClick={handleConnect} disabled={connecting}>
                    {connecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Connect to Xero
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* PDF Sync Status - Above Health Check */}
          {status?.connected && (
            <XeroPdfSyncStatus />
          )}

          {/* Health Check Button - Compact with % indicator */}
          {status?.connected && (
            <>
              {/* Compact Health Check Button */}
              {!healthCheckExpanded && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHealthCheckExpanded(true);
                    if (validationTests.length === 0) {
                      runValidationTests();
                    }
                  }}
                  className={`w-full justify-between ${
                    validationTests.length > 0
                      ? validationTests.every(t => t.status === "passed")
                        ? "border-green-500 bg-green-50 hover:bg-green-100 text-green-700"
                        : validationTests.some(t => t.status === "failed")
                        ? "border-red-500 bg-red-50 hover:bg-red-100 text-red-700"
                        : "border-gray-300"
                      : "border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {validationTests.length > 0 ? (
                      validationTests.every(t => t.status === "passed") ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : validationTests.some(t => t.status === "failed") ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span>Health Check</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {validationTests.length > 0 ? (
                      <span className="font-semibold">
                        {Math.round((validationTests.filter(t => t.status === "passed").length / validationTests.length) * 100)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Not run</span>
                    )}
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </Button>
              )}

              {/* Expanded Health Check Panel */}
              {healthCheckExpanded && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHealthCheckExpanded(false)}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <CardTitle className="text-base">Integration Health Check</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {validationTests.length > 0 && (
                          <Badge className={
                            validationTests.every(t => t.status === "passed")
                              ? "bg-green-100 text-green-800"
                              : validationTests.some(t => t.status === "failed")
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }>
                            {validationTests.filter(t => t.status === "passed").length}/{validationTests.length} Passed
                          </Badge>
                        )}
                        <Button
                          onClick={runValidationTests}
                          disabled={runningTests}
                          variant="outline"
                          size="sm"
                        >
                          {runningTests ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {validationTests.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {validationTests.map((test) => (
                          <div
                            key={test.id}
                            className={`flex items-center justify-between p-3 border rounded-lg text-sm ${
                              test.status === "passed"
                                ? "border-green-500 bg-green-50/50 dark:bg-green-900/10"
                                : test.status === "failed"
                                ? "border-red-500 bg-red-50/50 dark:bg-red-900/10"
                                : "border-gray-200"
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="flex-shrink-0">
                                {test.status === "passed" && (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                )}
                                {test.status === "failed" && (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                )}
                                {test.status === "running" && (
                                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                )}
                                {test.status === "pending" && (
                                  <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{test.name}</p>
                                {test.error && (
                                  <p className="text-xs text-red-600 mt-0.5">{test.error}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Connected Organizations */}
          {tenants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Connected Organizations ({tenants.length})</CardTitle>
                <CardDescription>
                  Xero organizations connected to TEEEM. Primary org is used for contact sync.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tenants.map((tenant) => (
                    <div
                      key={tenant.tenant_id}
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        tenant.is_primary ? "border-green-500 bg-green-50/50" : ""
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{tenant.tenant_name}</p>
                          {tenant.is_primary && (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              Primary
                            </Badge>
                          )}
                          {tenant.expired && (
                            <Badge variant="destructive">Expired</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Tenant ID: {tenant.tenant_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Connected</p>
                          <p className="text-sm font-medium">
                            {new Date(tenant.connected_at).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        {!tenant.is_primary && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await api.post("/api/v1/xero/set_primary", {
                                  tenant_id: tenant.tenant_id,
                                });
                                // Refresh the data
                                window.location.reload();
                              } catch (error) {
                                console.error("Failed to set primary:", error);
                              }
                            }}
                          >
                            Set as Primary
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>What is "Primary"?</AlertTitle>
                  <AlertDescription>
                    The primary Xero organization is used for contact sync and general operations.
                    Company-specific accounting can use different Xero orgs via Corporate → Companies.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

        </TabsContent>

        {/* Field Mapping Tab */}
        <TabsContent value="mapping">
          <XeroFieldMapping />
        </TabsContent>

        {/* Contact Sync Tab */}
        <TabsContent value="sync">
          <XeroContactSync />
        </TabsContent>
      </Tabs>
    </div>
  );
}
