"use client";

/**
 * XeroContactsTable - Self-contained Xero contacts component
 *
 * SSoT: Follows the same pattern as other Xero components (XeroInvoicesCard, etc.)
 * - Accepts companyId as required prop
 * - Fetches its own data via API
 * - Manages its own loading/error states
 */

import * as React from "react";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronDown,
  ChevronRight,
  User,
  Building2,
  Pencil,
  Plus,
  Search,
  Globe,
  Download,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface XeroContact {
  id: number;
  display_name: string;
  entity_type: string;
  email?: string;
  mobile?: string;
  xero_linked_count?: number;
  xero_tenant_names?: string[];
  xero_contact_number?: string;
  xero_contact_types?: string[];
  xero_contact_status?: string;
}

type FilterType = "all" | "supplier" | "customer" | "person" | "company";

interface XeroContactsTableProps {
  /** Company ID - required for self-contained data loading */
  companyId: string;
  /** Entity ID alias for companyId (TabComponentProps compatibility) */
  entityId?: string;
  /** Optional tenant ID if already known (avoids extra API call) */
  tenantId?: string;
  /** Optional callback when row is clicked */
  onRowClick?: (contact: XeroContact) => void;
  /** Optional callback for add contact action */
  onAddContact?: () => void;
  /** Optional callback for export action */
  onExport?: () => void;
  /** Optional callback after data refresh */
  onRefresh?: () => Promise<void>;
}

interface GroupedContacts {
  person: XeroContact[];
  company: XeroContact[];
  other: XeroContact[];
}

export function XeroContactsTable({
  companyId,
  entityId,
  tenantId: propTenantId,
  onRowClick,
  onAddContact,
  onExport,
  onRefresh,
}: XeroContactsTableProps) {
  const router = useRouter();
  const effectiveCompanyId = companyId || entityId;

  // Data loading state
  const [contacts, setContacts] = useState<XeroContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(propTenantId || null);

  // UI state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    person: true,
    company: true,
    other: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch Xero tenant ID from company connection
  const fetchTenantId = useCallback(async (): Promise<string | null> => {
    if (propTenantId) return propTenantId;
    if (!effectiveCompanyId) return null;

    try {
      const response = await api.get<{
        success: boolean;
        connection?: { xero_tenant_id: string };
      }>(`/api/v1/companies/${effectiveCompanyId}/xero/connection`);

      if (response?.success && response.connection?.xero_tenant_id) {
        setTenantId(response.connection.xero_tenant_id);
        return response.connection.xero_tenant_id;
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch Xero connection:", err);
      return null;
    }
  }, [effectiveCompanyId, propTenantId]);

  // Fetch contacts linked to this company's Xero tenant
  const fetchContacts = useCallback(async () => {
    if (!effectiveCompanyId) {
      setError("No company ID provided");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get tenant ID if not already known
      const tid = tenantId || await fetchTenantId();

      if (!tid) {
        setContacts([]);
        setLoading(false);
        return;
      }

      const response = await api.get<{ success: boolean; contacts: XeroContact[] }>(
        `/api/v1/contacts?xero_tenant_id=${tid}`
      );

      if (response.success) {
        setContacts(response.contacts || []);
      } else {
        setError("Failed to load contacts");
      }
    } catch (err) {
      console.error("Failed to load Xero contacts:", err);
      setError("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, tenantId, fetchTenantId]);

  // Load data on mount
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await fetchContacts();
    if (onRefresh) {
      await onRefresh();
    }
  }, [fetchContacts, onRefresh]);

  // Filter contacts based on search and filter type
  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.display_name?.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.mobile?.includes(query)
      );
    }

    // Apply type filter
    if (activeFilter !== "all") {
      filtered = filtered.filter((c) => {
        const entityType = c.entity_type?.toLowerCase();
        const xeroTypes = c.xero_contact_types || [];

        switch (activeFilter) {
          case "supplier":
            return xeroTypes.includes("Supplier");
          case "customer":
            return xeroTypes.includes("Customer");
          case "person":
            return entityType === "person";
          case "company":
            return entityType === "company" || entityType === "trust";
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [contacts, searchQuery, activeFilter]);

  // Group contacts by entity_type
  const groupedContacts = useMemo(() => {
    const groups: GroupedContacts = {
      person: [],
      company: [],
      other: [],
    };

    filteredContacts.forEach((contact) => {
      const type = contact.entity_type?.toLowerCase() || "other";
      if (type === "person") {
        groups.person.push(contact);
      } else if (type === "company" || type === "trust") {
        groups.company.push(contact);
      } else {
        groups.other.push(contact);
      }
    });

    return groups;
  }, [filteredContacts]);

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "supplier", label: "Supplier" },
    { key: "customer", label: "Customer" },
    { key: "person", label: "People" },
    { key: "company", label: "Company" },
  ];

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const handleRowClick = (contact: XeroContact) => {
    if (onRowClick) {
      onRowClick(contact);
    } else {
      router.push(`/contacts/${contact.id}`);
    }
  };

  const renderContactRow = (contact: XeroContact) => (
    <TableRow
      key={contact.id}
      className="cursor-pointer hover:bg-muted/50 dark:hover:bg-muted/20"
      onClick={() => handleRowClick(contact)}
    >
      {/* Display Name */}
      <TableCell className="font-medium">
        {contact.display_name || "—"}
      </TableCell>

      {/* Xero Links Count - format: X/10 */}
      <TableCell>
        {contact.xero_linked_count ? (
          <Badge
            variant="outline"
            className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
          >
            <span className="mr-1">✓</span>
            {contact.xero_linked_count}/10
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">0/10</span>
        )}
      </TableCell>

      {/* Xero Orgs - org names */}
      <TableCell className="text-muted-foreground text-sm">
        {contact.xero_tenant_names?.join(", ") || "—"}
      </TableCell>

      {/* Email */}
      <TableCell className="text-muted-foreground">
        {contact.email || "—"}
      </TableCell>

      {/* Mobile */}
      <TableCell className="text-muted-foreground">
        {contact.mobile || "—"}
      </TableCell>

      {/* Xero Type (Customer/Supplier) */}
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {contact.xero_contact_types?.map((type) => (
            <Badge
              key={type}
              variant={type === "Customer" ? "default" : "secondary"}
              className="text-[10px] px-1.5 py-0"
            >
              {type}
            </Badge>
          ))}
          {(!contact.xero_contact_types || contact.xero_contact_types.length === 0) && "—"}
        </div>
      </TableCell>
    </TableRow>
  );

  const renderGroup = (
    groupKey: keyof GroupedContacts,
    label: string,
    icon: React.ReactNode
  ) => {
    const groupContacts = groupedContacts[groupKey];
    if (groupContacts.length === 0) return null;

    const isExpanded = expandedGroups[groupKey];

    return (
      <React.Fragment key={groupKey}>
        <TableRow
          className="bg-muted/30 dark:bg-muted/10 cursor-pointer hover:bg-muted/50 dark:hover:bg-muted/20"
          onClick={() => toggleGroup(groupKey)}
        >
          <TableCell colSpan={6} className="py-2">
            <div className="flex items-center gap-2 font-medium text-sm">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {icon}
              <span>{label}</span>
              <Badge variant="secondary" className="text-xs ml-1">
                {groupContacts.length}
              </Badge>
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && groupContacts.map(renderContactRow)}
      </React.Fragment>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400 mb-2" />
            <p className="font-medium text-red-600 dark:text-red-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="mt-4 gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (contacts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p className="text-sm font-medium mb-2">No Contacts Linked</p>
            <p className="text-sm">No contacts are linked to this Xero account yet.</p>
            <p className="text-sm mt-2">Link contacts to Xero in the Contacts module.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Edit Button */}
        <Button
          variant={isEditMode ? "default" : "outline"}
          size="sm"
          onClick={() => setIsEditMode(!isEditMode)}
          className="gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>

        {/* Add Contact Button */}
        {onAddContact && (
          <Button size="sm" onClick={onAddContact} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </Button>
        )}

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>

        {/* Record Count Badge */}
        <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-300 dark:border-green-700">
          {filteredContacts.length} records
        </Badge>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search across all fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Export Button */}
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5 ml-auto">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterButtons.map((filter) => (
          <Button
            key={filter.key}
            variant={activeFilter === filter.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(filter.key)}
            className="gap-1.5 h-7 text-xs"
          >
            <Globe className="h-3 w-3" />
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border dark:border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 dark:bg-muted/20">
            <TableHead className="w-[220px]">Display Name</TableHead>
            <TableHead className="w-[90px]">Xero Links</TableHead>
            <TableHead className="w-[180px]">Xero Orgs</TableHead>
            <TableHead className="w-[180px]">Email</TableHead>
            <TableHead className="w-[120px]">Mobile</TableHead>
            <TableHead className="w-[100px]">Xero Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {renderGroup("person", "Person", <User className="h-4 w-4 text-blue-500 dark:text-blue-400" />)}
          {renderGroup("company", "Company", <Building2 className="h-4 w-4 text-green-500 dark:text-green-400" />)}
          {renderGroup("other", "Other", null)}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

export default XeroContactsTable;
