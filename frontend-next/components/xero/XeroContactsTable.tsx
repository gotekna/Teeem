"use client";

import { useMemo, useState } from "react";
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
import {
  ChevronDown,
  ChevronRight,
  User,
  Building2,
  Pencil,
  Plus,
  Search,
  Globe,
  Download
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  contacts: XeroContact[];
  onRowClick?: (contact: XeroContact) => void;
  onAddContact?: () => void;
  onExport?: () => void;
}

interface GroupedContacts {
  person: XeroContact[];
  company: XeroContact[];
  other: XeroContact[];
}

export function XeroContactsTable({ contacts, onRowClick, onAddContact, onExport }: XeroContactsTableProps) {
  const router = useRouter();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    person: true,
    company: true,
    other: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isEditMode, setIsEditMode] = useState(false);

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

      {/* Xero Links Count */}
      <TableCell>
        {contact.xero_linked_count ? (
          <Badge variant="secondary" className="text-xs">
            {contact.xero_linked_count}
          </Badge>
        ) : (
          "—"
        )}
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
      <>
        <TableRow
          className="bg-muted/30 dark:bg-muted/10 cursor-pointer hover:bg-muted/50 dark:hover:bg-muted/20"
          onClick={() => toggleGroup(groupKey)}
        >
          <TableCell colSpan={5} className="py-2">
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
      </>
    );
  };

  if (contacts.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No Xero-linked contacts found
      </div>
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

        {/* Record Count Badge */}
        <Badge variant="outline" className="text-green-600 border-green-300 dark:border-green-700">
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
      <div className="rounded-md border dark:border-gray-800">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 dark:bg-muted/20">
            <TableHead className="w-[250px]">Display Name</TableHead>
            <TableHead className="w-[100px]">Xero Links</TableHead>
            <TableHead className="w-[200px]">Email</TableHead>
            <TableHead className="w-[130px]">Mobile</TableHead>
            <TableHead className="w-[120px]">Xero Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {renderGroup("person", "Person", <User className="h-4 w-4 text-blue-500" />)}
          {renderGroup("company", "Company", <Building2 className="h-4 w-4 text-green-500" />)}
          {renderGroup("other", "Other", null)}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

export default XeroContactsTable;
