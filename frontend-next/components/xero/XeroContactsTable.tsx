"use client";

import { useMemo } from "react";
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
import { ChevronDown, ChevronRight, User, Building2 } from "lucide-react";
import { useState } from "react";
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

interface XeroContactsTableProps {
  contacts: XeroContact[];
  onRowClick?: (contact: XeroContact) => void;
}

interface GroupedContacts {
  person: XeroContact[];
  company: XeroContact[];
  other: XeroContact[];
}

export function XeroContactsTable({ contacts, onRowClick }: XeroContactsTableProps) {
  const router = useRouter();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    person: true,
    company: true,
    other: true,
  });

  // Group contacts by entity_type
  const groupedContacts = useMemo(() => {
    const groups: GroupedContacts = {
      person: [],
      company: [],
      other: [],
    };

    contacts.forEach((contact) => {
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
  }, [contacts]);

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

      {/* Xero Contact Number */}
      <TableCell className="text-muted-foreground text-xs">
        {contact.xero_contact_number || "—"}
      </TableCell>

      {/* Xero Info (tenant names + types) */}
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {contact.xero_tenant_names?.map((name) => (
            <Badge key={name} variant="outline" className="text-[10px] px-1.5 py-0">
              {name}
            </Badge>
          ))}
          {contact.xero_contact_types?.map((type) => (
            <Badge
              key={type}
              variant={type === "Customer" ? "default" : "secondary"}
              className="text-[10px] px-1.5 py-0"
            >
              {type}
            </Badge>
          ))}
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
    <div className="rounded-md border dark:border-gray-800">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 dark:bg-muted/20">
            <TableHead className="w-[200px]">Display Name</TableHead>
            <TableHead className="w-[80px]">Xero Links</TableHead>
            <TableHead className="w-[180px]">Email</TableHead>
            <TableHead className="w-[120px]">Mobile</TableHead>
            <TableHead className="w-[120px]">Xero Contact</TableHead>
            <TableHead>Xero Info</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {renderGroup("person", "Person", <User className="h-4 w-4 text-blue-500" />)}
          {renderGroup("company", "Company", <Building2 className="h-4 w-4 text-green-500" />)}
          {renderGroup("other", "Other", null)}
        </TableBody>
      </Table>
    </div>
  );
}

export default XeroContactsTable;
