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
    message?: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  React.useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, []);

  const loadStatus = async () => {
    try {
      const response = await api.get<{ success: boolean; data: {
        connected: boolean;
        tenant_name?: string;
        tenant_id?: string;
        expires_at?: string;
        needs_refresh?: boolean;
        message?: string;
      } }>("/api/v1/xero/status");
      setStatus(response.data || (response as unknown as typeof status));
    } catch (error) {
      console.error("Failed to load Xero status:", error);
      setStatus({
        connected: false,
        message: "Unable to check Xero connection status"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await api.get<{ success: boolean; auth_url: string; url?: string }>("/api/v1/xero/auth_url");
      const authUrl = response.auth_url || response.url;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        throw new Error("No authorization URL received from server");
      }
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
              {status?.message === "Xero integration not configured" ? (
                <>
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-900 dark:text-amber-100">
                        Xero OAuth credentials not configured
                      </p>
                      <p className="text-amber-700 dark:text-amber-300 mt-1">
                        Contact your system administrator to configure XERO_CLIENT_ID and XERO_CLIENT_SECRET
                        environment variables in the backend.
                      </p>
                    </div>
                  </div>
                  <Button onClick={handleConnect} disabled={true} variant="secondary">
                    <Link2 className="h-4 w-4 mr-2" />
                    Connect to Xero (Not Available)
                  </Button>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Field Mapping Types
interface FieldMapping {
  id: string;
  xero_field: string;
  teeem_field: string;
  section: string;
  sync_direction: "both" | "xero-to-teeem" | "teeem-to-xero";
  enabled: boolean;
  read_only?: boolean;
  description?: string;
}

interface XeroTenant {
  tenant_id: string;
  tenant_name: string;
}

// Comprehensive field mappings organized by section
const DEFAULT_FIELD_MAPPINGS: FieldMapping[] = [
  // BASIC INFORMATION
  { id: "name", xero_field: "Name", teeem_field: "full_name", section: "basic", sync_direction: "both", enabled: true },
  { id: "first_name", xero_field: "FirstName", teeem_field: "first_name", section: "basic", sync_direction: "both", enabled: true },
  { id: "last_name", xero_field: "LastName", teeem_field: "last_name", section: "basic", sync_direction: "both", enabled: true },
  { id: "email", xero_field: "EmailAddress", teeem_field: "email", section: "basic", sync_direction: "both", enabled: true },
  { id: "is_supplier_customer", xero_field: "IsSupplier/IsCustomer", teeem_field: "xero_contact_types", section: "basic", sync_direction: "xero-to-teeem", enabled: true, description: "Multiple values: Customer, Supplier, or both" },
  { id: "contact_id", xero_field: "ContactID", teeem_field: "xero_id", section: "basic", sync_direction: "xero-to-teeem", enabled: true, read_only: true },

  // CONTACT DETAILS
  { id: "mobile", xero_field: "PhoneNumber (Mobile)", teeem_field: "mobile_phone", section: "contact_details", sync_direction: "both", enabled: true },
  { id: "office", xero_field: "PhoneNumber (Office)", teeem_field: "office_phone", section: "contact_details", sync_direction: "both", enabled: true },
  { id: "fax", xero_field: "PhoneNumber (Fax)", teeem_field: "fax_phone", section: "contact_details", sync_direction: "both", enabled: true },
  { id: "website", xero_field: "Website", teeem_field: "website", section: "contact_details", sync_direction: "both", enabled: true },

  // ADDRESSES
  { id: "address_street", xero_field: "Address (STREET)", teeem_field: "address_street", section: "addresses", sync_direction: "both", enabled: true },
  { id: "address_pobox", xero_field: "Address (POBOX)", teeem_field: "address_pobox", section: "addresses", sync_direction: "both", enabled: true },
  { id: "address_delivery", xero_field: "Address (DELIVERY)", teeem_field: "address_delivery", section: "addresses", sync_direction: "both", enabled: true },

  // TAX & REGISTRATION
  { id: "tax_number", xero_field: "TaxNumber", teeem_field: "tax_number", section: "tax", sync_direction: "both", enabled: true, description: "Synced from Xero - Edit in Xero to update" },
  { id: "account_number", xero_field: "AccountNumber", teeem_field: "xero_account_number", section: "tax", sync_direction: "xero-to-teeem", enabled: true },
  { id: "contact_number", xero_field: "ContactNumber", teeem_field: "xero_contact_number", section: "tax", sync_direction: "xero-to-teeem", enabled: true },
  { id: "contact_status", xero_field: "ContactStatus", teeem_field: "xero_contact_status", section: "tax", sync_direction: "xero-to-teeem", enabled: true },
  { id: "company_number", xero_field: "CompanyNumber", teeem_field: "company_number", section: "tax", sync_direction: "xero-to-teeem", enabled: true },

  // PURCHASE (ACCOUNTS PAYABLE)
  { id: "purchase_account", xero_field: "DefaultPurchaseAccount", teeem_field: "default_purchase_account", section: "purchase", sync_direction: "xero-to-teeem", enabled: true, description: "Synced from Xero - Edit in Xero to update" },
  { id: "bill_due_day", xero_field: "PurchaseTerms (Days)", teeem_field: "bill_due_day", section: "purchase", sync_direction: "xero-to-teeem", enabled: true },
  { id: "bill_due_type", xero_field: "PurchaseTerms (Type)", teeem_field: "bill_due_type", section: "purchase", sync_direction: "xero-to-teeem", enabled: true },
  { id: "ap_outstanding", xero_field: "AccountsPayable Outstanding", teeem_field: "accounts_payable_outstanding", section: "purchase", sync_direction: "xero-to-teeem", enabled: true },
  { id: "ap_overdue", xero_field: "AccountsPayable Overdue", teeem_field: "accounts_payable_overdue", section: "purchase", sync_direction: "xero-to-teeem", enabled: true },

  // SALES (ACCOUNTS RECEIVABLE)
  { id: "sales_account", xero_field: "DefaultSalesAccount", teeem_field: "default_sales_account", section: "sales", sync_direction: "xero-to-teeem", enabled: true, description: "Synced from Xero - Edit in Xero to update" },
  { id: "default_discount", xero_field: "DefaultDiscount", teeem_field: "default_discount", section: "sales", sync_direction: "xero-to-teeem", enabled: true },
  { id: "sales_due_day", xero_field: "SalesTerms (Days)", teeem_field: "sales_due_day", section: "sales", sync_direction: "xero-to-teeem", enabled: true },
  { id: "sales_due_type", xero_field: "SalesTerms (Type)", teeem_field: "sales_due_type", section: "sales", sync_direction: "xero-to-teeem", enabled: true },
  { id: "ar_outstanding", xero_field: "AccountsReceivable Outstanding", teeem_field: "accounts_receivable_outstanding", section: "sales", sync_direction: "xero-to-teeem", enabled: true },
  { id: "ar_overdue", xero_field: "AccountsReceivable Overdue", teeem_field: "accounts_receivable_overdue", section: "sales", sync_direction: "xero-to-teeem", enabled: true },

  // BANK DETAILS
  { id: "bank_bsb", xero_field: "BankAccountBSB", teeem_field: "bank_bsb", section: "bank", sync_direction: "xero-to-teeem", enabled: true, description: "Synced from Xero - Edit in Xero to update" },
  { id: "bank_account", xero_field: "BankAccountNumber", teeem_field: "bank_account_number", section: "bank", sync_direction: "xero-to-teeem", enabled: true },
  { id: "bank_name", xero_field: "BankAccountName", teeem_field: "bank_account_name", section: "bank", sync_direction: "xero-to-teeem", enabled: true },
];

const SECTION_LABELS: Record<string, { title: string; description: string }> = {
  basic: { title: "BASIC INFORMATION", description: "" },
  contact_details: { title: "CONTACT DETAILS", description: "" },
  addresses: { title: "ADDRESSES", description: "" },
  tax: { title: "TAX & REGISTRATION", description: "Synced from Xero - Edit in Xero to update" },
  purchase: { title: "PURCHASE (ACCOUNTS PAYABLE)", description: "Synced from Xero - Edit in Xero to update" },
  sales: { title: "SALES (ACCOUNTS RECEIVABLE)", description: "Synced from Xero - Edit in Xero to update" },
  bank: { title: "BANK DETAILS", description: "Synced from Xero - Edit in Xero to update" },
};

// Field Mapping Component - Comprehensive version matching old UI
function XeroFieldMapping() {
  const { toast } = useToast();
  const [mappings, setMappings] = React.useState<FieldMapping[]>(DEFAULT_FIELD_MAPPINGS);
  const [tenants, setTenants] = React.useState<XeroTenant[]>([]);
  const [selectedTenant, setSelectedTenant] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [lastSyncAt, setLastSyncAt] = React.useState<string | null>(null);
  const [validationRules, setValidationRules] = React.useState({
    skip_sync_employees: false,
    skip_sync_default_suppliers: false
  });

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load tenants
      const tenantsResponse = await api.get<{ success: boolean; tenants: XeroTenant[] }>("/api/v1/xero/tenants");
      if (tenantsResponse.tenants && tenantsResponse.tenants.length > 0) {
        setTenants(tenantsResponse.tenants);
        setSelectedTenant(tenantsResponse.tenants[0].tenant_id);
      }

      // Load sync status for last sync time
      const statusResponse = await api.get<{ success: boolean; data: { last_sync_at: string | null } }>("/api/v1/xero/sync_status");
      setLastSyncAt(statusResponse.data?.last_sync_at || null);

      // Load validation rules for selected tenant
      if (tenantsResponse.tenants && tenantsResponse.tenants.length > 0) {
        const tenantId = tenantsResponse.tenants[0].tenant_id;
        const configResponse = await api.get<{ success: boolean; sync_configuration: { validation_rules?: { skip_sync_employees: boolean; skip_sync_default_suppliers: boolean } } }>(`/api/v1/sync_configurations/${tenantId}`);
        if (configResponse.sync_configuration?.validation_rules) {
          setValidationRules(configResponse.sync_configuration.validation_rules);
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncDirectionChange = (id: string, direction: "both" | "xero-to-teeem" | "teeem-to-xero") => {
    const mapping = mappings.find(m => m.id === id);
    if (mapping?.read_only) {
      toast({
        title: "Read Only",
        description: "This field's sync direction cannot be changed.",
        variant: "default"
      });
      return;
    }
    setMappings(mappings.map(m =>
      m.id === id ? { ...m, sync_direction: direction } : m
    ));
  };

  const getSyncDirectionLabel = (direction: string) => {
    switch (direction) {
      case "both": return "Both Ways";
      case "xero-to-teeem": return "Xero → TEEEM";
      case "teeem-to-xero": return "TEEEM → Xero";
      default: return direction;
    }
  };

  const handleSaveValidationRules = async (rules: typeof validationRules) => {
    if (!selectedTenant) return;

    try {
      setValidationRules(rules);

      await api.put(`/api/v1/sync_configurations/${selectedTenant}`, {
        sync_configuration: {
          cleanup_options: {
            skip_sync_employees: rules.skip_sync_employees,
            skip_sync_default_suppliers: rules.skip_sync_default_suppliers
          }
        }
      });

      toast({ title: "Success", description: "Validation rules updated" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update rules", variant: "destructive" });
    }
  };

  // Group mappings by section
  const groupedMappings = React.useMemo(() => {
    const groups: Record<string, FieldMapping[]> = {};
    mappings.forEach(mapping => {
      if (!groups[mapping.section]) {
        groups[mapping.section] = [];
      }
      groups[mapping.section].push(mapping);
    });
    return groups;
  }, [mappings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tenant Selector & Sync Direction Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Settings className="h-4 w-4" />
            <span>Sync Direction</span>
            {selectedTenant && tenants.length > 0 && (
              <>
                <span className="mx-2">•</span>
                <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                  <SelectTrigger className="w-[200px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map(tenant => (
                      <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>
                        {tenant.tenant_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                XERO
              </Badge>
              <span className="font-medium">
                {tenants.find(t => t.tenant_id === selectedTenant)?.tenant_name || "No Organization Selected"}
              </span>
            </div>
            {lastSyncAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4" />
                <span>Last Sync: {new Date(lastSyncAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Field Mappings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Field Mappings</CardTitle>
          <CardDescription>
            Configure sync direction for each field. Read-only fields can only sync from Xero.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="grid grid-cols-4 gap-4 px-6 py-3 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
            <div>XERO FIELD</div>
            <div>TEEEM FIELD</div>
            <div>STATUS</div>
            <div>SYNC</div>
          </div>

          {/* Sections */}
          {Object.entries(SECTION_LABELS).map(([sectionKey, sectionInfo]) => {
            const sectionMappings = groupedMappings[sectionKey] || [];
            if (sectionMappings.length === 0) return null;

            return (
              <div key={sectionKey}>
                {/* Section Header */}
                <div className="px-6 py-2 bg-muted/30 border-b">
                  <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                    {sectionInfo.title}
                  </span>
                  {sectionInfo.description && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({sectionInfo.description})
                    </span>
                  )}
                </div>

                {/* Section Rows */}
                {sectionMappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    className={cn(
                      "grid grid-cols-4 gap-4 px-6 py-3 border-b items-center hover:bg-muted/20 transition-colors",
                      !mapping.enabled && "opacity-50"
                    )}
                  >
                    {/* Xero Field */}
                    <div className="text-sm">{mapping.xero_field}</div>

                    {/* TEEEM Field */}
                    <div className="text-sm font-mono text-muted-foreground">
                      {mapping.teeem_field}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      {mapping.enabled ? (
                        <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
                          <Check className="h-3 w-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <X className="h-3 w-3" />
                          Disabled
                        </Badge>
                      )}
                    </div>

                    {/* Sync Direction */}
                    <div>
                      {mapping.read_only ? (
                        <span className="text-sm text-muted-foreground">
                          {getSyncDirectionLabel(mapping.sync_direction)}
                        </span>
                      ) : (
                        <Select
                          value={mapping.sync_direction}
                          onValueChange={(value) => handleSyncDirectionChange(mapping.id, value as "both" | "xero-to-teeem" | "teeem-to-xero")}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="both">
                              <div className="flex items-center gap-2">
                                <ArrowRightLeft className="h-3 w-3" />
                                Both Ways
                              </div>
                            </SelectItem>
                            <SelectItem value="xero-to-teeem">
                              <div className="flex items-center gap-2">
                                Xero → TEEEM
                              </div>
                            </SelectItem>
                            <SelectItem value="teeem-to-xero">
                              <div className="flex items-center gap-2">
                                TEEEM → Xero
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Validation Rules Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div>
              <CardTitle className="text-base">Sync Validation Rules</CardTitle>
              <CardDescription>
                Prevent certain contact types from syncing to Xero
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Employee Rule */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-orange-50 text-orange-700">RULE</Badge>
                <span className="font-medium">Don&apos;t sync employees to Xero</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Contacts with the &quot;Employee&quot; role will be skipped during export to Xero
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={validationRules.skip_sync_employees}
                onCheckedChange={(checked) => handleSaveValidationRules({
                  ...validationRules,
                  skip_sync_employees: checked
                })}
              />
              {validationRules.skip_sync_employees && <Badge>Active</Badge>}
            </div>
          </div>

          {/* Default Supplier Rule */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-orange-50 text-orange-700">RULE</Badge>
                <span className="font-medium">Don&apos;t sync default suppliers to Xero</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Contacts marked as default suppliers in pricebook will be skipped
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={validationRules.skip_sync_default_suppliers}
                onCheckedChange={(checked) => handleSaveValidationRules({
                  ...validationRules,
                  skip_sync_default_suppliers: checked
                })}
              />
              {validationRules.skip_sync_default_suppliers && <Badge>Active</Badge>}
            </div>
          </div>

          {/* Info box */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              ℹ️ Rules only apply to export (TEEEM → Xero). Imports from Xero are never blocked.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer Note */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Badge variant="secondary" className="h-4 text-[10px] bg-green-100 text-green-700">Enabled</Badge>
            Field syncs during contact sync
          </span>
          <span className="flex items-center gap-1">
            <Badge variant="outline" className="h-4 text-[10px]">Disabled</Badge>
            Field is skipped during sync
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Contacts: {mappings.filter(m => m.enabled).length} fields enabled</span>
        </div>
      </div>
    </div>
  );
}

// Types for sync data
interface SyncStatus {
  last_sync_at: string | null;
  total_contacts: number;
  synced_contacts: number;
  sync_enabled_contacts: number;
  contacts_with_errors: number;
  sync_percentage: number;
  active_job?: {
    job_id: string;
    status: string;
    queued_at: string;
    total: number;
    processed: number;
  };
}

interface SyncHistoryItem {
  id: number;
  contact_name: string;
  email: string | null;
  synced_at: string;
  has_error: boolean;
  error_message: string | null;
  action: string;
  xero_id: string | null;
}

interface ContactForSync {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  xero_id: string | null;
  sync_with_xero: boolean;
  last_synced_at: string | null;
  xero_sync_error: string | null;
}

// Contact Sync Dashboard Component
function XeroContactSync() {
  const { toast } = useToast();
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus | null>(null);
  const [syncHistory, setSyncHistory] = React.useState<SyncHistoryItem[]>([]);
  const [contacts, setContacts] = React.useState<ContactForSync[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [syncingContactId, setSyncingContactId] = React.useState<number | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Load all data on mount
  React.useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSyncStatus(),
        loadSyncHistory(),
        loadContacts(),
      ]);
    } catch (error) {
      console.error("Failed to load sync data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const response = await api.get<{ success: boolean; data: SyncStatus }>("/api/v1/xero/sync_status");
      setSyncStatus(response.data);
    } catch (error) {
      console.error("Failed to load sync status:", error);
    }
  };

  const loadSyncHistory = async () => {
    try {
      const response = await api.get<{ success: boolean; history: SyncHistoryItem[] }>("/api/v1/xero/sync_history");
      setSyncHistory(response.history || []);
    } catch (error) {
      console.error("Failed to load sync history:", error);
    }
  };

  const loadContacts = async () => {
    try {
      const response = await api.get<{ contacts: ContactForSync[] }>("/api/v1/contacts", {
        params: { per_page: 500 }
      });
      setContacts(response.contacts || []);
    } catch (error) {
      console.error("Failed to load contacts:", error);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const response = await api.post<{ success: boolean; message: string; data?: { job_id: string } }>("/api/v1/xero/sync_contacts");
      toast({
        title: "Sync Started",
        description: response?.message || "Contact sync job has been queued",
      });
      // Refresh status after a short delay
      setTimeout(() => {
        loadAllData();
      }, 2000);
    } catch (error) {
      console.error("Failed to sync:", error);
      toast({ title: "Error", description: "Failed to start sync", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncContact = async (contactId: number, direction: "to_xero" | "from_xero") => {
    setSyncingContactId(contactId);
    try {
      if (direction === "to_xero") {
        await api.post(`/api/v1/contacts/${contactId}/sync_to_xero`);
        toast({ title: "Success", description: "Contact synced to Xero" });
      } else {
        await api.post(`/api/v1/contacts/${contactId}/sync_from_xero`);
        toast({ title: "Success", description: "Contact synced from Xero" });
      }
      await loadContacts();
    } catch (error) {
      console.error("Failed to sync contact:", error);
      toast({ title: "Error", description: "Failed to sync contact", variant: "destructive" });
    } finally {
      setSyncingContactId(null);
    }
  };

  // Filter contacts
  const filteredContacts = React.useMemo(() => {
    return contacts.filter((contact) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        contact.full_name?.toLowerCase().includes(searchLower) ||
        contact.email?.toLowerCase().includes(searchLower) ||
        `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchLower);

      // Status filter
      let matchesStatus = true;
      if (statusFilter === "linked") {
        matchesStatus = !!contact.xero_id;
      } else if (statusFilter === "not_linked") {
        matchesStatus = !contact.xero_id;
      } else if (statusFilter === "errors") {
        matchesStatus = !!contact.xero_sync_error;
      } else if (statusFilter === "sync_enabled") {
        matchesStatus = contact.sync_with_xero;
      }

      return matchesSearch && matchesStatus;
    });
  }, [contacts, searchQuery, statusFilter]);

  // Calculate stats
  const stats = React.useMemo(() => {
    const linked = contacts.filter((c) => c.xero_id).length;
    const notLinked = contacts.filter((c) => !c.xero_id && c.sync_with_xero).length;
    const errors = contacts.filter((c) => c.xero_sync_error).length;
    return { linked, notLinked, errors, total: contacts.length };
  }, [contacts]);

  const getContactStatus = (contact: ContactForSync) => {
    if (contact.xero_sync_error) {
      return { label: "Error", variant: "destructive" as const, icon: AlertTriangle };
    }
    if (contact.xero_id) {
      return { label: "Linked", variant: "default" as const, icon: Check };
    }
    if (contact.sync_with_xero) {
      return { label: "Pending", variant: "secondary" as const, icon: RefreshCw };
    }
    return { label: "Not Synced", variant: "outline" as const, icon: X };
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
      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Linked</p>
                <p className="text-2xl font-bold text-green-600">{stats.linked}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <Check className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Sync</p>
                <p className="text-2xl font-bold text-blue-600">{stats.notLinked}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <RefreshCw className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sync Errors</p>
                <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Contacts</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full">
                <Settings className="h-5 w-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Sync Info & Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Sync Actions</CardTitle>
              <CardDescription>
                {syncStatus?.last_sync_at
                  ? `Last synced: ${new Date(syncStatus.last_sync_at).toLocaleString()}`
                  : "No sync performed yet"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadAllData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleSyncAll} disabled={syncing}>
                {syncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Sync All Contacts
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {syncStatus?.active_job && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-blue-800 dark:text-blue-200">
                Sync in progress: {syncStatus.active_job.processed}/{syncStatus.active_job.total} contacts processed
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Contact List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Contacts</CardTitle>
              <CardDescription>
                Showing {filteredContacts.length} of {contacts.length} contacts
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-[200px] px-3 py-2 text-sm border rounded-md bg-background"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contacts</SelectItem>
                  <SelectItem value="linked">Linked to Xero</SelectItem>
                  <SelectItem value="not_linked">Not Linked</SelectItem>
                  <SelectItem value="errors">With Errors</SelectItem>
                  <SelectItem value="sync_enabled">Sync Enabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.slice(0, 50).map((contact) => {
                  const status = getContactStatus(contact);
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {contact.full_name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unnamed"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contact.email || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                        {contact.xero_sync_error && (
                          <p className="text-xs text-red-600 mt-1 max-w-[200px] truncate" title={contact.xero_sync_error}>
                            {contact.xero_sync_error}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {contact.last_synced_at
                          ? new Date(contact.last_synced_at).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {contact.xero_id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSyncContact(contact.id, "from_xero")}
                                disabled={syncingContactId === contact.id}
                                title="Pull from Xero"
                              >
                                {syncingContactId === contact.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSyncContact(contact.id, "to_xero")}
                                disabled={syncingContactId === contact.id}
                                title="Push to Xero"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSyncContact(contact.id, "to_xero")}
                              disabled={syncingContactId === contact.id}
                              title="Create in Xero"
                            >
                              {syncingContactId === contact.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Link2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No contacts found
                    </TableCell>
                  </TableRow>
                )}
                {filteredContacts.length > 50 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                      Showing first 50 contacts. Use search to find specific contacts.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Sync Activity</CardTitle>
          <CardDescription>Last 50 sync operations</CardDescription>
        </CardHeader>
        <CardContent>
          {syncHistory.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Synced At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncHistory.slice(0, 20).map((item) => (
                    <TableRow key={`${item.id}-${item.synced_at}`}>
                      <TableCell className="font-medium">{item.contact_name}</TableCell>
                      <TableCell>{item.action}</TableCell>
                      <TableCell>
                        {item.has_error ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Error
                          </Badge>
                        ) : (
                          <Badge variant="default" className="gap-1">
                            <Check className="h-3 w-3" />
                            Success
                          </Badge>
                        )}
                        {item.error_message && (
                          <p className="text-xs text-red-600 mt-1 max-w-[200px] truncate" title={item.error_message}>
                            {item.error_message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(item.synced_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No sync history yet
            </div>
          )}
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
