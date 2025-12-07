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
  Mail,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// Types
interface FieldMapping {
  field: string;
  label: string;
  xero_field: string;
  group: string;
  description: string;
  default_direction: string;
  read_only?: boolean;
}

interface FieldGroup {
  label: string;
  description: string;
  order: number;
}

interface SyncDirection {
  value: string;
  label: string;
  description: string;
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


// Field Mapping Component
export function XeroFieldMapping() {
  const { toast } = useToast();
  const [availableFields, setAvailableFields] = React.useState<FieldMapping[]>([]);
  const [fieldGroups, setFieldGroups] = React.useState<Record<string, FieldGroup>>({});
  const [directions, setDirections] = React.useState<SyncDirection[]>([]);
  const [fieldMappings, setFieldMappings] = React.useState<Record<string, { direction: string }>>({});
  const [tenants, setTenants] = React.useState<XeroTenant[]>([]);
  const [selectedTenant, setSelectedTenant] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [lastSyncAt, setLastSyncAt] = React.useState<string | null>(null);
  const [validationRules, setValidationRules] = React.useState({
    skip_sync_employees: false,
    skip_sync_default_suppliers: false
  });

  React.useEffect(() => {
    loadData();
  }, []);

  React.useEffect(() => {
    if (selectedTenant) {
      loadTenantConfig(selectedTenant);
    }
  }, [selectedTenant]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load available field mappings from API
      const fieldMappingsResponse = await api.get<{
        success: boolean;
        available_fields: FieldMapping[];
        field_groups: Record<string, FieldGroup>;
        directions: SyncDirection[];
      }>("/api/v1/sync_configurations/field_mappings");

      if (fieldMappingsResponse.success) {
        setAvailableFields(fieldMappingsResponse.available_fields);
        setFieldGroups(fieldMappingsResponse.field_groups);
        setDirections(fieldMappingsResponse.directions);
      }

      // Load tenants
      const tenantsResponse = await api.get<{ success: boolean; tenants: XeroTenant[] }>("/api/v1/xero/tenants");
      if (tenantsResponse.tenants && tenantsResponse.tenants.length > 0) {
        setTenants(tenantsResponse.tenants);
        setSelectedTenant(tenantsResponse.tenants[0].tenant_id);
      }

      // Load sync status for last sync time
      const statusResponse = await api.get<{ success: boolean; data: { last_sync_at: string | null } }>("/api/v1/xero/sync_status");
      setLastSyncAt(statusResponse.data?.last_sync_at || null);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTenantConfig = async (tenantId: string) => {
    try {
      const configResponse = await api.get<{
        success: boolean;
        sync_configuration: {
          field_mappings: Record<string, { direction: string }>;
          validation_rules?: { skip_sync_employees: boolean; skip_sync_default_suppliers: boolean };
        };
      }>(`/api/v1/sync_configurations/${tenantId}`);

      if (configResponse.sync_configuration?.field_mappings) {
        setFieldMappings(configResponse.sync_configuration.field_mappings);
      }
      if (configResponse.sync_configuration?.validation_rules) {
        setValidationRules(configResponse.sync_configuration.validation_rules);
      }
    } catch (error) {
      console.error("Failed to load tenant config:", error);
    }
  };

  const handleSyncDirectionChange = async (field: string, direction: string) => {
    if (!selectedTenant) return;

    const mapping = availableFields.find(m => m.field === field);
    if (mapping?.read_only) {
      toast({
        title: "Read Only",
        description: "This field's sync direction cannot be changed.",
        variant: "default"
      });
      return;
    }

    // Update local state immediately
    const newMappings = {
      ...fieldMappings,
      [field]: { ...fieldMappings[field], direction }
    };
    setFieldMappings(newMappings);

    // Save to backend
    try {
      await api.put(`/api/v1/sync_configurations/${selectedTenant}`, {
        sync_configuration: {
          field_mappings: newMappings
        }
      });
    } catch {
      toast({ title: "Error", description: "Failed to save field mapping", variant: "destructive" });
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

  // Group mappings by group, sorted by group order
  const groupedMappings = React.useMemo(() => {
    const groups: Record<string, FieldMapping[]> = {};
    availableFields.forEach(mapping => {
      if (!groups[mapping.group]) {
        groups[mapping.group] = [];
      }
      groups[mapping.group].push(mapping);
    });
    return groups;
  }, [availableFields]);

  // Sort groups by order
  const sortedGroups = React.useMemo(() => {
    return Object.entries(fieldGroups)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key]) => key);
  }, [fieldGroups]);

  const getFieldDirection = (field: string) => {
    return fieldMappings[field]?.direction ||
      availableFields.find(f => f.field === field)?.default_direction ||
      "none";
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
            Configure sync direction for each field. {availableFields.length} fields available from Xero API.
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

          {/* Sections - sorted by group order */}
          {sortedGroups.map((groupKey) => {
            const groupInfo = fieldGroups[groupKey];
            const groupMappings = groupedMappings[groupKey] || [];
            if (groupMappings.length === 0) return null;

            return (
              <div key={groupKey}>
                {/* Section Header */}
                <div className="px-6 py-2 bg-muted/30 border-b">
                  <span className="text-xs font-semibold text-muted-foreground tracking-wide">
                    {groupInfo?.label || groupKey}
                  </span>
                  {groupInfo?.description && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({groupInfo.description})
                    </span>
                  )}
                </div>

                {/* Section Rows */}
                {groupMappings.map((mapping) => {
                  const direction = getFieldDirection(mapping.field);
                  const isEnabled = direction !== "none";

                  return (
                    <div
                      key={mapping.field}
                      className={cn(
                        "grid grid-cols-4 gap-4 px-6 py-3 border-b items-center hover:bg-muted/20 transition-colors",
                        !isEnabled && "opacity-50"
                      )}
                    >
                      <div>
                        <div className="font-mono text-sm">{mapping.xero_field}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{mapping.description}</div>
                      </div>
                      <div className="font-mono text-sm">{mapping.field}</div>
                      <div>
                        {isEnabled ? (
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
                          value={direction}
                          onValueChange={(value) => handleSyncDirectionChange(mapping.field, value)}
                          disabled={mapping.read_only}
                        >
                          <SelectTrigger className="w-[180px] h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {directions.map(dir => (
                              <SelectItem key={dir.value} value={dir.value}>
                                {dir.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {mapping.read_only && (
                          <p className="text-xs text-muted-foreground mt-1">Read-only field</p>
                        )}
                      </div>
                    </div>
                  );
                })}
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
              <div className="text-sm font-medium">Skip Price-Only Contacts</div>
              <div className="text-sm text-muted-foreground">
                Don't sync contacts marked as price_only in Xero
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

// Xero data stats interface (invoices, bills, quotes synced from Xero)
interface XeroDataStats {
  sales_invoices: { count: number; total: number };
  bills: { count: number; total: number };
  quotes: { count: number; total: number };
  credit_notes: number;
  contacts_with_data: number;
  unpaid_count: number;
  synced_today: number;
  last_sync_at: string | null;
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
  const [xeroDataStats, setXeroDataStats] = React.useState<XeroDataStats | null>(null);

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
        xero_data?: XeroDataStats;
      }>("/api/v1/xero/contacts_sync_list");

      if (response.success) {
        setContacts(response.contacts);
        setTotalContacts(response.total);
        setSyncedCount(response.synced_count);
        setErrorCount(response.error_count);
        if (response.xero_data) {
          setXeroDataStats(response.xero_data);
        }
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

      {/* Email Warehouse Stats Card */}
      {emailWarehouseStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Warehouse
            </CardTitle>
            <CardDescription>
              Emails synced from Microsoft 365 and their relationship to contacts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Total Emails</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {emailWarehouseStats.total_emails.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
                <div className="text-sm text-muted-foreground">With Xero Contacts</div>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                  {emailWarehouseStats.emails_with_xero_contacts.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-cyan-50 dark:bg-cyan-900/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Linked to Jobs</div>
                <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">
                  {emailWarehouseStats.emails_linked_to_jobs.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Synced Today</div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {emailWarehouseStats.emails_synced_today.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
