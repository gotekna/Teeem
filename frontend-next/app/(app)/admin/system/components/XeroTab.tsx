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
    message?: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);

  React.useEffect(() => {
    loadStatus();
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

// Field Mapping Component
function XeroFieldMapping() {
  const { toast } = useToast();
  const [mappings, setMappings] = React.useState<
    Array<{
      id: number;
      teeem_field: string;
      xero_field: string;
      entity_type: string;
      sync_direction: string;
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
      // Note: This endpoint doesn't exist yet in the backend
      // Using default field mappings until field mapping API is implemented
      // const data = await api.get<typeof mappings>("/api/v1/xero/field_mappings");
      // setMappings(data);
      throw new Error("Endpoint not implemented");
    } catch (error) {
      // console.error("Failed to load mappings:", error);
      // Comprehensive field mappings from production system
      setMappings([
        // Contact Field Mappings (19 fields)
        { id: 1, teeem_field: "full_name", xero_field: "Name", entity_type: "contact", sync_direction: "two-way", enabled: true },
        { id: 2, teeem_field: "email", xero_field: "EmailAddress", entity_type: "contact", sync_direction: "two-way", enabled: true },
        { id: 3, teeem_field: "supplier_code", xero_field: "ContactNumber", entity_type: "contact", sync_direction: "two-way", enabled: false },
        { id: 4, teeem_field: "first_name", xero_field: "FirstName", entity_type: "contact", sync_direction: "two-way", enabled: true },
        { id: 5, teeem_field: "last_name", xero_field: "LastName", entity_type: "contact", sync_direction: "two-way", enabled: true },
        { id: 6, teeem_field: "mobile_phone", xero_field: "Phones[DDI].PhoneNumber", entity_type: "contact", sync_direction: "two-way", enabled: true },
        { id: 7, teeem_field: "office_phone", xero_field: "Phones[DEFAULT].PhoneNumber", entity_type: "contact", sync_direction: "two-way", enabled: true },
        { id: 8, teeem_field: "address", xero_field: "Addresses[POBOX].AddressLine1", entity_type: "contact", sync_direction: "two-way", enabled: true },
        { id: 9, teeem_field: "city", xero_field: "Addresses[POBOX].City", entity_type: "contact", sync_direction: "two-way", enabled: true },
        { id: 10, teeem_field: "state", xero_field: "Addresses[POBOX].Region", entity_type: "contact", sync_direction: "two-way", enabled: true },
        { id: 11, teeem_field: "postcode", xero_field: "Addresses[POBOX].PostalCode", entity_type: "contact", sync_direction: "two-way", enabled: true },
        { id: 12, teeem_field: "tax_number (ABN/GST)", xero_field: "TaxNumber", entity_type: "contact", sync_direction: "two-way", enabled: true },
        { id: 13, teeem_field: "xero_account_number", xero_field: "AccountNumber", entity_type: "contact", sync_direction: "xero-to-teeem", enabled: false },
        { id: 14, teeem_field: "bank_bsb", xero_field: "BankAccountDetails.BSB", entity_type: "contact", sync_direction: "xero-to-teeem", enabled: true },
        { id: 15, teeem_field: "bank_account_number", xero_field: "BankAccountDetails.AccountNumber", entity_type: "contact", sync_direction: "xero-to-teeem", enabled: true },
        { id: 16, teeem_field: "bank_account_name", xero_field: "BankAccountDetails.AccountName", entity_type: "contact", sync_direction: "xero-to-teeem", enabled: true },
        { id: 17, teeem_field: "website", xero_field: "Website", entity_type: "contact", sync_direction: "two-way", enabled: true },
        { id: 18, teeem_field: "default_purchase_account", xero_field: "PurchaseDetails.AccountCode", entity_type: "contact", sync_direction: "xero-to-teeem", enabled: true },
        { id: 19, teeem_field: "bill_due_day", xero_field: "PaymentTerms.Bills.Day", entity_type: "contact", sync_direction: "xero-to-teeem", enabled: true },
        { id: 20, teeem_field: "bill_due_type", xero_field: "PaymentTerms.Bills.Type", entity_type: "contact", sync_direction: "xero-to-teeem", enabled: true },

        // Price Book Item Field Mappings (6 fields)
        { id: 21, teeem_field: "item_code", xero_field: "Item.Code", entity_type: "pricebook_item", sync_direction: "two-way", enabled: false },
        { id: 22, teeem_field: "item_name", xero_field: "Item.Name", entity_type: "pricebook_item", sync_direction: "two-way", enabled: false },
        { id: 23, teeem_field: "notes", xero_field: "Item.Description", entity_type: "pricebook_item", sync_direction: "two-way", enabled: false },
        { id: 24, teeem_field: "current_price", xero_field: "Item.SalesDetails.UnitPrice", entity_type: "pricebook_item", sync_direction: "xero-to-teeem", enabled: false },
        { id: 25, teeem_field: "gst_code", xero_field: "Item.SalesDetails.TaxType", entity_type: "pricebook_item", sync_direction: "xero-to-teeem", enabled: true },
        { id: 26, teeem_field: "supplier_price", xero_field: "Item.PurchaseDetails.UnitPrice", entity_type: "pricebook_item", sync_direction: "xero-to-teeem", enabled: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleMapping = async (id: number) => {
    const mapping = mappings.find((m) => m.id === id);
    if (!mapping) return;

    // Note: Field mapping updates are not yet implemented in the backend
    // For now, just toggle in the UI
    toast({
      title: "Not Available",
      description: "Field mapping configuration is not yet editable",
      variant: "default"
    });

    // Uncomment when backend endpoint is implemented:
    // try {
    //   await api.patch(`/api/v1/xero/field_mappings/${id}`, {
    //     field_mapping: { enabled: !mapping.enabled },
    //   });
    //   setMappings(mappings.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)));
    // } catch (error) {
    //   console.error("Failed to update mapping:", error);
    //   toast({ title: "Error", description: "Failed to update mapping", variant: "destructive" });
    // }
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

  const getSyncDirectionDisplay = (direction: string) => {
    if (direction === "two-way") {
      return (
        <div className="flex items-center justify-center gap-x-2">
          <ArrowRightLeft className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs text-gray-600 dark:text-gray-400">Two-way</span>
        </div>
      );
    } else if (direction === "xero-to-teeem") {
      return (
        <div className="flex items-center justify-center gap-x-2">
          <span className="text-xs text-gray-600 dark:text-gray-400">Xero → TEEEM</span>
        </div>
      );
    } else if (direction === "teeem-to-xero") {
      return (
        <div className="flex items-center justify-center gap-x-2">
          <span className="text-xs text-gray-600 dark:text-gray-400">TEEEM → Xero</span>
        </div>
      );
    }
    return null;
  };

  const getEntityTypeLabel = (entityType: string) => {
    if (entityType === "contact") return "Contact Fields";
    if (entityType === "pricebook_item") return "Price Book Item Fields";
    return `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Fields`;
  };

  return (
    <div className="space-y-6">
      {Object.entries(groupedMappings).map(([entityType, entityMappings]) => (
        <Card key={entityType}>
          <CardHeader>
            <CardTitle className="text-base">{getEntityTypeLabel(entityType)}</CardTitle>
            <CardDescription>
              {entityType === "contact" && "Configure which fields sync between Xero contacts and TEEEM contacts."}
              {entityType === "pricebook_item" && "Potential field mappings if full item sync from Xero Items is implemented. Currently only tax rates are synced."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Xero Field</TableHead>
                  <TableHead className="text-center">Sync Direction</TableHead>
                  <TableHead>TEEEM Field</TableHead>
                  <TableHead className="w-[100px] text-center">Enabled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entityMappings.map((mapping) => (
                  <TableRow key={mapping.id} className={mapping.enabled ? "" : "opacity-50"}>
                    <TableCell className="font-mono text-sm">{mapping.xero_field}</TableCell>
                    <TableCell className="text-center">
                      {getSyncDirectionDisplay(mapping.sync_direction)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{mapping.teeem_field}</TableCell>
                    <TableCell className="text-center">
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

      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> Field mappings are currently configured in code and cannot be modified through this UI yet.
          Enabled fields sync automatically when contacts are synced. Bank account details, purchase accounts,
          and payment terms sync from Xero to TEEEM. GST codes are managed through the Tax Rates sync.
        </p>
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
        description: response.message || "Contact sync job has been queued",
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
