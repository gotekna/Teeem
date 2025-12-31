 
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow as TableRowType } from "@/components/table/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Check,
  X,
  RefreshCw,
  Settings,
  AlertTriangle,
  ArrowRightLeft,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { XeroLinkToContactSheet } from "./XeroLinkToContactSheet";

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
  xero_name: string | null;  // Name from Xero for comparison
  xero_tenant_name: string | null;  // Which Xero company this is synced to
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

// Type for selected row data for the link sheet
interface SelectedRowForLinkSheet {
  xeroName: string;
  xeroId: string | null;
  xeroTenantName: string | null;
  xeroLinkId: number | null;
  currentContactId: number | null;
  currentContactName: string | null;
  synced: boolean;
  matchConfidence: number | null;
}

// Contact Sync Component - Gold Standard Foundation-backed table
export function XeroContactSync() {
  const router = useRouter();
  const { toast } = useToast();
  const [syncing, setSyncing] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("all");

  // State for Xero link management sheet
  const [showLinkSheet, setShowLinkSheet] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<SelectedRowForLinkSheet | null>(null);

  // Handle sync button
  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await api.post<{ success: boolean; data: { contacts_created: number; contacts_updated: number } }>("/api/v1/xero/sync_contacts");
      if (response?.success) {
        toast({
          title: "Success",
          description: `Synced ${(response.data?.contacts_created || 0) + (response.data?.contacts_updated || 0)} contacts`,
        });
        // Trigger table refresh
        setRefreshKey(prev => prev + 1);
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

  // Build initial filters based on filterStatus
  // Show ALL Xero links so user can review and clean up unused ones
  const initialFilters = React.useMemo(() => {
    switch (filterStatus) {
      case "synced":
        return [{ id: "status-filter", column: "synced", operator: "=" as const, value: true }];
      case "not-synced":
        return [{ id: "status-filter", column: "synced", operator: "=" as const, value: false }];
      case "errors":
        return [{ id: "status-filter", column: "has_error", operator: "=" as const, value: true }];
      default:
        return [];
    }
  }, [filterStatus]);

  // Custom cell renderer for special columns
  const customCellRenderer = React.useCallback((entry: TableRowType, columnKey: string) => {
    // CONTACT column - clickable link to contact page (only if linked)
    if (columnKey === "display_name") {
      const contactId = entry.contact_id as number | null;
      const displayName = entry.display_name as string | null;

      // If no linked contact, show placeholder
      if (!contactId || !displayName) {
        return <span className="text-muted-foreground">—</span>;
      }

      return (
        <button
          className="text-left hover:underline text-primary font-medium"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/contacts/${contactId}`);
          }}
        >
          {displayName}
        </button>
      );
    }

    // XERO NAME column - clickable to open link management sheet
    if (columnKey === "xero_name") {
      const hasXeroName = entry.xero_name && (entry.xero_name as string) !== "";
      return (
        <button
          className={cn(
            "text-left w-full",
            hasXeroName
              ? "hover:underline text-blue-600 dark:text-blue-400"
              : "text-muted-foreground cursor-default"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (hasXeroName) {
              setSelectedRow({
                xeroName: entry.xero_name as string,
                xeroId: entry.xero_id as string | null,
                xeroTenantName: entry.xero_tenant_name as string | null,
                xeroLinkId: entry.id as number,  // id is now xero_link_id in the view
                currentContactId: entry.contact_id as number | null,
                currentContactName: entry.display_name as string | null,
                synced: entry.synced as boolean,
                matchConfidence: entry.match_confidence as number | null,
              });
              setShowLinkSheet(true);
            }
          }}
        >
          {hasXeroName ? (entry.xero_name as string) : "—"}
        </button>
      );
    }

    // Synced icon (for "synced" column)
    if (columnKey === "synced") {
      return entry.synced ? (
        <Check className="h-4 w-4 text-green-600 mx-auto" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground mx-auto" />
      );
    }

    // Entity type badge
    if (columnKey === "entity_type") {
      const isPriceOnly = entry.entity_type === "price_only";
      return (
        <Badge variant="outline" className={cn("text-xs", isPriceOnly && "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30")}>
          {(entry.entity_type as string) || "?"}
        </Badge>
      );
    }

    // Role badge
    if (columnKey === "contact_role") {
      const role = entry.contact_role as string | null;
      if (!role) return <span className="text-muted-foreground">-</span>;
      const colors: Record<string, string> = {
        "Both": "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30",
        "Customer": "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30",
        "Supplier": "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30",
      };
      return (
        <Badge variant="outline" className={cn("text-xs", colors[role])}>
          {role}
        </Badge>
      );
    }

    // Invoices count
    if (columnKey === "invoices_count") {
      const count = entry.invoices_count as number;
      return count > 0 ? (
        <span className="font-medium">{count}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    }

    // Bills count
    if (columnKey === "bills_count") {
      const count = entry.bills_count as number;
      return count > 0 ? (
        <span className="font-medium">{count}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    }

    // Match confidence - stored as decimal (0-1), display as percentage
    if (columnKey === "match_confidence") {
      const confidence = entry.match_confidence as number | null;
      if (confidence === null || confidence === undefined) return <span className="text-muted-foreground">-</span>;
      const percent = Math.round(confidence * 100);
      const color = percent === 100 ? "text-green-600" :
                   percent >= 80 ? "text-amber-600" : "text-red-600";
      return <span className={cn("font-medium", color)}>{percent}%</span>;
    }

    // PDF sync percent with color coding
    if (columnKey === "pdf_sync_percent") {
      const percent = entry.pdf_sync_percent as number | null;
      if (percent === null || percent === undefined) return <span className="text-muted-foreground">-</span>;
      const color = percent === 100 ? "text-green-600" :
                   percent >= 50 ? "text-amber-600" : "text-red-600";
      return <span className={cn("font-medium", color)}>{percent}%</span>;
    }

    // Has error indicator
    if (columnKey === "has_error") {
      return entry.has_error ? (
        <div className="flex items-center gap-1 text-red-600">
          <AlertTriangle className="h-3 w-3" />
          <span className="text-xs font-medium">Error</span>
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    }

    return null; // Use default rendering
  }, [router]);

  // Handle row click to navigate to contact
  const handleRowClick = React.useCallback((row: TableRowType) => {
    // Only navigate if there's a linked TEEEM contact
    const contactId = row.contact_id as number | null;
    if (contactId) {
      router.push(`/contacts/${contactId}`);
    }
  }, [router]);

  return (
    <div className="flex flex-col h-full">
      {/* Gold Standard Table - Foundation backed */}
      <div className="flex-1 -mx-4">
        <TeeemTableView
          key={refreshKey}
          foundationId="xero-sync-contacts"
          autoFetchRecords={true}
          onRowClick={handleRowClick}
          customCellRenderer={customCellRenderer}
          initialFilters={initialFilters}
          viewOnly={true}
          leftActions={
            <>
              <Button onClick={handleSync} disabled={syncing} size="sm">
                <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
              <Select value={filterStatus} onValueChange={(value: FilterStatus) => setFilterStatus(value)}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contacts</SelectItem>
                  <SelectItem value="synced">Synced Only</SelectItem>
                  <SelectItem value="not-synced">Not Synced</SelectItem>
                  <SelectItem value="errors">With Errors</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
        />
      </div>

      {/* Xero Link Management Sheet */}
      {selectedRow && (
        <XeroLinkToContactSheet
          isOpen={showLinkSheet}
          onClose={() => {
            setShowLinkSheet(false);
            setSelectedRow(null);
          }}
          xeroName={selectedRow.xeroName}
          xeroId={selectedRow.xeroId}
          xeroTenantName={selectedRow.xeroTenantName}
          xeroLinkId={selectedRow.xeroLinkId}
          currentContactId={selectedRow.currentContactId}
          currentContactName={selectedRow.currentContactName}
          synced={selectedRow.synced}
          matchConfidence={selectedRow.matchConfidence}
          onLinkChanged={() => setRefreshKey((prev) => prev + 1)}
        />
      )}
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

// Calculate string similarity using Levenshtein distance
function calculateSimilarity(str1: string | null, str2: string | null): number | null {
  if (!str1 || !str2) return null;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0;

  // Create distance matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill in the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return Math.round(similarity);
}
