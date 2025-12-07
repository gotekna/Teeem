"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Settings,
  AlertTriangle,
  ArrowRightLeft,
  Users,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// Types
interface FieldMapping {
  id: string;
  xero_field: string;
  teeem_field: string;
  sync_direction: "both" | "xero-to-teeem" | "teeem-to-xero";
  enabled: boolean;
  read_only?: boolean;
  section: string;
}

interface XeroTenant {
  id: number;
  tenant_id: string;
  tenant_name: string;
  is_primary: boolean;
}

interface ContactSyncItem {
  id: number;
  display_name: string;
  email: string | null;
  contact_type: string;
  xero_id: string | null;
  synced: boolean;
  last_synced_at: string | null;
  sync_enabled: boolean;
  sync_error: string | null;
  has_error: boolean;
}

// Default field mappings
const DEFAULT_FIELD_MAPPINGS: FieldMapping[] = [
  // Basic Info
  { id: "1", xero_field: "Name", teeem_field: "display_name", sync_direction: "both", enabled: true, section: "basic" },
  { id: "2", xero_field: "FirstName", teeem_field: "first_name", sync_direction: "both", enabled: true, section: "basic" },
  { id: "3", xero_field: "LastName", teeem_field: "last_name", sync_direction: "both", enabled: true, section: "basic" },
  { id: "4", xero_field: "EmailAddress", teeem_field: "email", sync_direction: "both", enabled: true, section: "basic" },

  // Contact Details
  { id: "5", xero_field: "PhoneNumber", teeem_field: "phone", sync_direction: "both", enabled: true, section: "contact" },
  { id: "6", xero_field: "MobilePhone", teeem_field: "mobile_phone", sync_direction: "both", enabled: true, section: "contact" },
  { id: "7", xero_field: "Website", teeem_field: "website", sync_direction: "both", enabled: true, section: "contact" },

  // Address
  { id: "8", xero_field: "AddressLine1", teeem_field: "address", sync_direction: "both", enabled: true, section: "address" },
  { id: "9", xero_field: "City", teeem_field: "city", sync_direction: "both", enabled: true, section: "address" },
  { id: "10", xero_field: "PostalCode", teeem_field: "postcode", sync_direction: "both", enabled: true, section: "address" },

  // Financial
  { id: "11", xero_field: "TaxNumber", teeem_field: "tax_number", sync_direction: "both", enabled: true, section: "financial" },
  { id: "12", xero_field: "AccountNumber", teeem_field: "xero_account_number", sync_direction: "xero-to-teeem", enabled: true, read_only: true, section: "financial" },
  { id: "13", xero_field: "AccountsReceivableOutstanding", teeem_field: "accounts_receivable_outstanding", sync_direction: "xero-to-teeem", enabled: true, read_only: true, section: "financial" },
  { id: "14", xero_field: "AccountsPayableOutstanding", teeem_field: "accounts_payable_outstanding", sync_direction: "xero-to-teeem", enabled: true, read_only: true, section: "financial" },
];

const SECTION_LABELS: Record<string, { title: string; description?: string }> = {
  basic: { title: "Basic Information", description: "Name and core details" },
  contact: { title: "Contact Details", description: "Phone, email, website" },
  address: { title: "Address Information", description: "Physical address" },
  financial: { title: "Financial Data", description: "Tax numbers and balances" },
};

// Field Mapping Component
export function XeroFieldMapping() {
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
    } catch {
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
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                TEEEM
              </Badge>
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
                    <div className="font-mono text-sm">{mapping.xero_field}</div>
                    <div className="font-mono text-sm">{mapping.teeem_field}</div>
                    <div>
                      {mapping.enabled ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Check className="h-3 w-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          <X className="h-3 w-3 mr-1" />
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <div>
                      <Select
                        value={mapping.sync_direction}
                        onValueChange={(value) => handleSyncDirectionChange(mapping.id, value as any)}
                        disabled={mapping.read_only}
                      >
                        <SelectTrigger className="w-[180px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">Both Ways ↔</SelectItem>
                          <SelectItem value="xero-to-teeem">Xero → TEEEM</SelectItem>
                          <SelectItem value="teeem-to-xero">TEEEM → Xero</SelectItem>
                        </SelectContent>
                      </Select>
                      {mapping.read_only && (
                        <p className="text-xs text-muted-foreground mt-1">Read-only field</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Validation Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Validation Rules</CardTitle>
          <CardDescription>
            Configure which contacts should be excluded from sync
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Skip Employees</div>
              <div className="text-sm text-muted-foreground">
                Don't sync contacts marked as employees in Xero
              </div>
            </div>
            <Switch
              checked={validationRules.skip_sync_employees}
              onCheckedChange={(checked) => handleSaveValidationRules({ ...validationRules, skip_sync_employees: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Skip Default Suppliers</div>
              <div className="text-sm text-muted-foreground">
                Don't sync Xero's default suppliers
              </div>
            </div>
            <Switch
              checked={validationRules.skip_sync_default_suppliers}
              onCheckedChange={(checked) => handleSaveValidationRules({ ...validationRules, skip_sync_default_suppliers: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Contact Sync Component
export function XeroContactSync() {
  const { toast } = useToast();
  const [syncing, setSyncing] = React.useState(false);
  const [lastSync, setLastSync] = React.useState<{
    synced_at: string;
    contacts_created: number;
    contacts_updated: number;
    errors: string[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [contacts, setContacts] = React.useState<ContactSyncItem[]>([]);
  const [totalContacts, setTotalContacts] = React.useState(0);
  const [syncedCount, setSyncedCount] = React.useState(0);
  const [errorCount, setErrorCount] = React.useState(0);
  const [filterStatus, setFilterStatus] = React.useState<"all" | "synced" | "not-synced" | "errors">("all");

  React.useEffect(() => {
    loadSyncStatus();
    loadContacts();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const response = await api.get<{ success: boolean; data: typeof lastSync }>("/api/v1/xero/sync_status");
      setLastSync(response.data);
    } catch (error) {
      console.error("Failed to load sync status:", error);
    }
  };

  const loadContacts = async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        contacts: ContactSyncItem[];
        total: number;
        synced_count: number;
        error_count: number;
      }>("/api/v1/xero/contacts_sync_list");

      if (response.success) {
        setContacts(response.contacts);
        setTotalContacts(response.total);
        setSyncedCount(response.synced_count);
        setErrorCount(response.error_count);
      }
    } catch (error) {
      console.error("Failed to load contacts:", error);
      toast({
        title: "Error",
        description: "Failed to load contacts list",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await api.post<{ success: boolean; data: typeof lastSync }>("/api/v1/xero/sync_contacts");
      if (response?.data) {
        setLastSync(response.data);
        toast({
          title: "Success",
          description: `Synced ${response.data.contacts_created + response.data.contacts_updated} contacts`,
        });
        // Reload contacts after sync
        loadContacts();
      }
    } catch (error) {
      console.error("Sync failed:", error);
      toast({
        title: "Error",
        description: "Failed to sync contacts from Xero",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  const filteredContacts = React.useMemo(() => {
    switch (filterStatus) {
      case "synced":
        return contacts.filter(c => c.synced);
      case "not-synced":
        return contacts.filter(c => !c.synced);
      case "errors":
        return contacts.filter(c => c.has_error);
      default:
        return contacts;
    }
  }, [contacts, filterStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sync Stats Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contact Sync
              </CardTitle>
              <CardDescription>
                View all contacts and their Xero sync status
              </CardDescription>
            </div>
            <Button onClick={handleSync} disabled={syncing}>
              <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Total Contacts</div>
              <div className="text-2xl font-bold">{totalContacts}</div>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg">
              <div className="text-sm text-muted-foreground">Synced</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {syncedCount}
              </div>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
              <div className="text-sm text-muted-foreground">Not Synced</div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {totalContacts - syncedCount}
              </div>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg">
              <div className="text-sm text-muted-foreground">Errors</div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {errorCount}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Contacts</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contacts</SelectItem>
                  <SelectItem value="synced">Synced Only</SelectItem>
                  <SelectItem value="not-synced">Not Synced</SelectItem>
                  <SelectItem value="errors">With Errors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Contact Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No contacts found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.display_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.email || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{contact.contact_type || "Unknown"}</Badge>
                      </TableCell>
                      <TableCell>
                        {contact.has_error ? (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        ) : contact.synced ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <Check className="h-3 w-3 mr-1" />
                            Synced
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <X className="h-3 w-3 mr-1" />
                            Not Synced
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.last_synced_at
                          ? new Date(contact.last_synced_at).toLocaleString()
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
