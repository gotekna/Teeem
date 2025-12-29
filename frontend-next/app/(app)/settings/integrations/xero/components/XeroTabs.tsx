 
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check,
  X,
  RefreshCw,
  Settings,
  AlertTriangle,
  ArrowRightLeft,
  Users,
  Filter,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useUrlState } from "@/hooks/useUrlState";

// Types
type FilterStatus = "all" | "synced" | "not-synced" | "errors";

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

// Per-contact sync status for all 3 sync types (SSoT)
interface SyncStatusPerContact {
  contact_synced_at: string | null;
  invoices_synced_at: string | null;
  pdfs_synced_at: string | null;
}

interface ContactSyncItem {
  id: number;
  display_name: string;
  email: string | null;
  contact_type: string;
  entity_type: string | null;
  primary_company_id: number | null;
  primary_company_name: string | null;
  is_team_contact: boolean;
  is_customer: boolean;
  is_supplier: boolean;
  xero_id: string | null;
  synced: boolean;
  last_synced_at: string | null;
  sync_enabled: boolean;
  sync_error: string | null;
  has_error: boolean;
  invoices_count: number;
  bills_count: number;
  pdfs_synced: number;
  pdf_sync_percent: number | null;
  // SSoT: All 3 sync timestamps per contact
  sync_status: SyncStatusPerContact;
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

      // Load sync status for last sync time (SSoT: use last_synced_at)
      const statusResponse = await api.get<{ success: boolean; data: { last_synced_at: string | null; last_sync_at?: string | null } }>("/api/v1/xero/sync_status");
      setLastSyncAt(statusResponse.data?.last_synced_at || statusResponse.data?.last_sync_at || null);
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
        <Spinner size={32} className="text-muted-foreground" />
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
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("all");
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
        <Spinner size={32} className="text-muted-foreground" />
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

      {/* Xero Data Stats Card */}
      {xeroDataStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Xero Data Synced
            </CardTitle>
            <CardDescription>
              Financial data synced from Xero for these contacts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Sales Invoices</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {xeroDataStats.sales_invoices.count.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ${xeroDataStats.sales_invoices.total.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Bills</div>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                  {xeroDataStats.bills.count.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ${xeroDataStats.bills.total.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-cyan-50 dark:bg-cyan-900/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Quotes</div>
                <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">
                  {xeroDataStats.quotes.count.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ${xeroDataStats.quotes.total.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Unpaid</div>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {xeroDataStats.unpaid_count.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  invoices &amp; bills
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Credit Notes</div>
                <div className="text-lg font-semibold">{xeroDataStats.credit_notes}</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Contacts with Data</div>
                <div className="text-lg font-semibold">{xeroDataStats.contacts_with_data}</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Synced Today</div>
                <div className="text-lg font-semibold">{xeroDataStats.synced_today}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contacts Table Card */}
      <ContactsGroupedTable contacts={filteredContacts} filterStatus={filterStatus} setFilterStatus={setFilterStatus} />
    </div>
  );
}

// Helper to format relative time compactly - always show relative (Xd, Xh, Xm)
function formatRelativeTime(dateString: string | null): { text: string; isRecent: boolean; isOld: boolean } {
  if (!dateString) return { text: "-", isRecent: false, isOld: false };

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Is recent = synced within 1 hour
  const isRecent = diffMins < 60;
  // Is old = synced more than 24 hours ago
  const isOld = diffHours > 24;

  let text: string;
  if (diffMins < 1) {
    text = "now";
  } else if (diffMins < 60) {
    text = `${diffMins}m`;
  } else if (diffHours < 24) {
    text = `${diffHours}h`;
  } else {
    // Always show relative days, even for older dates
    text = `${diffDays}d`;
  }

  return { text, isRecent, isOld };
}

// Helper to format last sync date compactly (legacy, for backwards compatibility)
function formatLastSync(dateString: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const time = date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });

  if (diffDays === 0) {
    // Today - show time only
    return time;
  } else if (diffDays === 1) {
    return `Yest ${time}`;
  } else if (diffDays < 7) {
    return `${diffDays}d ${time}`;
  } else {
    // Show date and time
    const dateStr = date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    return `${dateStr} ${time}`;
  }
}

// SSoT: Compact 3-type sync status display (C:5m I:6d P:-)
function SyncStatusCell({ syncStatus, hasError }: { syncStatus: SyncStatusPerContact; hasError?: boolean }) {
  const contact = formatRelativeTime(syncStatus.contact_synced_at);
  const invoices = formatRelativeTime(syncStatus.invoices_synced_at);
  const pdfs = formatRelativeTime(syncStatus.pdfs_synced_at);

  const getDotColor = (info: { text: string; isRecent: boolean; isOld: boolean }) => {
    if (info.text === "-") return "bg-gray-300";
    if (info.isRecent) return "bg-green-500";
    if (info.isOld) return "bg-amber-500";
    return "bg-green-400";
  };

  const getTextColor = (info: { text: string; isRecent: boolean; isOld: boolean }) => {
    if (info.text === "-") return "text-muted-foreground";
    if (info.isRecent) return "text-green-700 dark:text-green-400";
    if (info.isOld) return "text-amber-700 dark:text-amber-400";
    return "text-green-600 dark:text-green-400";
  };

  // If there's an error, show error indicator
  if (hasError) {
    return (
      <div className="text-xs text-red-600 font-medium flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Error
      </div>
    );
  }

  return (
    <div className="text-xs font-mono whitespace-nowrap">
      <span className={cn("inline-flex items-center gap-0.5", getTextColor(contact))}>
        <span className={cn("w-1.5 h-1.5 rounded-full inline-block", getDotColor(contact))} />
        C:{contact.text}
      </span>
      {" "}
      <span className={cn("inline-flex items-center gap-0.5", getTextColor(invoices))}>
        <span className={cn("w-1.5 h-1.5 rounded-full inline-block", getDotColor(invoices))} />
        I:{invoices.text}
      </span>
      {" "}
      <span className={cn("inline-flex items-center gap-0.5", getTextColor(pdfs))}>
        <span className={cn("w-1.5 h-1.5 rounded-full inline-block", getDotColor(pdfs))} />
        P:{pdfs.text}
      </span>
    </div>
  );
}

// Helper to get role display
function getRoleDisplay(contact: ContactSyncItem): { text: string; color: string } {
  const isCustomer = contact.is_customer;
  const isSupplier = contact.is_supplier;

  if (isCustomer && isSupplier) {
    return { text: "Both", color: "bg-purple-100 text-purple-700 border-purple-300" };
  } else if (isCustomer) {
    return { text: "Customer", color: "bg-blue-100 text-blue-700 border-blue-300" };
  } else if (isSupplier) {
    return { text: "Supplier", color: "bg-orange-100 text-orange-700 border-orange-300" };
  }
  return { text: "-", color: "" };
}

// Helper component for rendering contact rows
function ContactRow({ contact, onClick }: { contact: ContactSyncItem; onClick: () => void }) {
  const isPriceOnly = contact.entity_type === "price_only";
  const isPersonWithCompany = contact.entity_type === "person" && contact.primary_company_id != null;
  const shouldHighlight = isPriceOnly || isPersonWithCompany;

  const getPdfSyncColor = (percent: number | null) => {
    if (percent === null) return "";
    if (percent === 100) return "text-green-600";
    if (percent >= 50) return "text-amber-600";
    return "text-red-600";
  };

  const role = getRoleDisplay(contact);

  return (
    <TableRow
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors",
        shouldHighlight ? "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30" : ""
      )}
      onClick={onClick}
    >
      <TableCell className="font-medium py-2">
        <div className="truncate max-w-[180px]" title={contact.display_name}>
          {contact.display_name}
        </div>
        {contact.primary_company_name && (
          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
            {contact.primary_company_name}
          </div>
        )}
      </TableCell>
      <TableCell className="py-2">
        <Badge variant="outline" className={cn("text-xs", isPriceOnly ? "bg-red-100 text-red-700 border-red-300" : "")}>
          {contact.entity_type || "?"}
        </Badge>
      </TableCell>
      <TableCell className="text-center py-2">
        {contact.xero_id ? (
          <Check className="h-4 w-4 text-green-600 mx-auto" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground mx-auto" />
        )}
      </TableCell>
      <TableCell className="py-2">
        {role.text !== "-" ? (
          <Badge variant="outline" className={cn("text-xs", role.color)}>
            {role.text}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </TableCell>
      <TableCell className="text-center text-sm py-2">
        {contact.invoices_count > 0 ? (
          <span className="font-medium">{contact.invoices_count}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-center text-sm py-2">
        {contact.bills_count > 0 ? (
          <span className="font-medium">{contact.bills_count}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-center text-sm py-2">
        {contact.pdf_sync_percent !== null ? (
          <span className={cn("font-medium", getPdfSyncColor(contact.pdf_sync_percent))}>
            {contact.pdf_sync_percent}%
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="py-2">
        {contact.sync_status ? (
          <SyncStatusCell syncStatus={contact.sync_status} hasError={contact.has_error} />
        ) : (
          <span className="text-xs text-muted-foreground">{formatLastSync(contact.last_synced_at)}</span>
        )}
      </TableCell>
    </TableRow>
  );
}

// Grouped table with collapsible sections
function ContactsGroupedTable({
  contacts,
  filterStatus,
  setFilterStatus,
}: {
  contacts: ContactSyncItem[];
  filterStatus: FilterStatus;
  setFilterStatus: React.Dispatch<React.SetStateAction<FilterStatus>>;
}) {
  const router = useRouter();

  // URL state for accordion expanded state (back button works, bookmarkable)
  const [urlState, setUrlState] = useUrlState({
    accordions: ["normal", "flagged"] as string[], // Both open by default
  });
  const normalOpen = urlState.accordions.includes("normal");
  const flaggedOpen = urlState.accordions.includes("flagged");

  const toggleAccordion = (section: "normal" | "flagged") => {
    const current = urlState.accordions;
    if (current.includes(section)) {
      setUrlState({ accordions: current.filter(s => s !== section) });
    } else {
      setUrlState({ accordions: [...current, section] });
    }
  };

  // Split contacts into normal and flagged (price_only or person with company)
  const normalContacts = contacts
    .filter((c) => {
      const isPriceOnly = c.entity_type === "price_only";
      const isPersonWithCompany = c.entity_type === "person" && c.primary_company_id != null;
      return !isPriceOnly && !isPersonWithCompany;
    })
    .sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""));

  const flaggedContacts = contacts
    .filter((c) => {
      const isPriceOnly = c.entity_type === "price_only";
      const isPersonWithCompany = c.entity_type === "person" && c.primary_company_id != null;
      return isPriceOnly || isPersonWithCompany;
    })
    .sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""));

  const handleContactClick = (contactId: number) => {
    router.push(`/contacts/${contactId}`);
  };

  const TableHeaders = () => (
    <TableHeader className="sticky top-0 bg-background z-10">
      <TableRow>
        <TableHead>Contact</TableHead>
        <TableHead>Type</TableHead>
        <TableHead className="text-center w-12">Linked</TableHead>
        <TableHead className="w-20">Role</TableHead>
        <TableHead className="text-center w-12">Inv</TableHead>
        <TableHead className="text-center w-12">Bills</TableHead>
        <TableHead className="text-center w-12">PDF</TableHead>
        <TableHead>Sync Status</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
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
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No contacts found
          </div>
        ) : (
          <div className="max-h-[700px] overflow-y-auto">
            {/* Normal Contacts Group */}
            {normalContacts.length > 0 && (
              <Accordion
                type="single"
                collapsible
                value={normalOpen ? "normal" : ""}
                onValueChange={() => toggleAccordion("normal")}
              >
                <AccordionItem value="normal" className="border-none">
                  <AccordionTrigger
                    className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b cursor-pointer hover:bg-muted/70 transition-colors hover:no-underline [&>svg]:hidden"
                  >
                    {normalOpen ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                    <span className="font-medium">Active Contacts</span>
                    <Badge variant="secondary" className="ml-2">
                      {normalContacts.length}
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeaders />
                      <TableBody>
                        {normalContacts.map((contact) => (
                          <ContactRow
                            key={contact.id}
                            contact={contact}
                            onClick={() => handleContactClick(contact.id)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Flagged Contacts Group (Price Only + Person with Company) */}
            {flaggedContacts.length > 0 && (
              <Accordion
                type="single"
                collapsible
                value={flaggedOpen ? "flagged" : ""}
                onValueChange={() => toggleAccordion("flagged")}
              >
                <AccordionItem value="flagged" className="border-none">
                  <AccordionTrigger
                    className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors hover:no-underline [&>svg]:hidden"
                  >
                    {flaggedOpen ? (
                      <ChevronDown className="h-5 w-5 text-red-600" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium text-red-700 dark:text-red-400">
                      Flagged Contacts (Price Only / Person with Company)
                    </span>
                    <Badge variant="outline" className="ml-2 bg-red-100 text-red-700 border-red-300">
                      {flaggedContacts.length}
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeaders />
                      <TableBody>
                        {flaggedContacts.map((contact) => (
                          <ContactRow
                            key={contact.id}
                            contact={contact}
                            onClick={() => handleContactClick(contact.id)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
