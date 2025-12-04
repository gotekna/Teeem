"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, ToggleLeft, ToggleRight, ChevronRight, ChevronDown, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

interface Membership {
  id: number;
  contact_id: number;
  contact_name: string;
  contact_email: string | null;
  contact_entity_type: string | null;
  company_group_id: number;
  company_group_name?: string;
  membership_type: string;
  company_id: number | null;
  company_name: string | null;
  can_view_confidential: boolean;
  can_edit: boolean;
  is_active: boolean;
  has_linked_company: boolean;
  linked_company_id: number | null;
}

interface CompanyGroup {
  id: number;
  name: string;
}

interface GroupedContact {
  contact_id: number;
  contact_name: string;
  contact_email: string | null;
  contact_entity_type: string | null;
  has_linked_company: boolean;
  linked_company_id: number | null;
  memberships: Membership[];
}

export default function CGNewPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [groups, setGroups] = React.useState<CompanyGroup[]>([]);
  const [groupsMap, setGroupsMap] = React.useState<Record<number, string>>({});
  const [selectedGroupId, setSelectedGroupId] = React.useState<number | null>(null);
  const [memberships, setMemberships] = React.useState<Membership[]>([]);
  const [loadingMemberships, setLoadingMemberships] = React.useState(false);
  const [groupByEntityType, setGroupByEntityType] = React.useState(false);
  const [expandedContacts, setExpandedContacts] = React.useState<Set<number>>(new Set());

  // Load groups
  React.useEffect(() => {
    const loadGroups = async () => {
      try {
        const response = await api.get<{ success: boolean; data: CompanyGroup[] }>("/api/v1/company_groups");
        const groupsList = response.data || [];
        setGroups(groupsList);
        // Build a map for quick lookup
        const map: Record<number, string> = {};
        groupsList.forEach(g => { map[g.id] = g.name; });
        setGroupsMap(map);
      } catch (error) {
        console.error("Failed to load company groups:", error);
      } finally {
        setLoading(false);
      }
    };
    loadGroups();
  }, []);

  // Load memberships when group changes
  React.useEffect(() => {
    const loadMemberships = async () => {
      try {
        setLoadingMemberships(true);
        if (selectedGroupId === null) {
          // Load all memberships from all groups
          const allMemberships: Membership[] = [];
          for (const group of groups) {
            const response = await api.get<{ success: boolean; data: Membership[] }>(
              `/api/v1/company_groups/${group.id}/contacts`
            );
            const groupMemberships = (response.data || []).map(m => ({
              ...m,
              company_group_name: group.name
            }));
            allMemberships.push(...groupMemberships);
          }
          setMemberships(allMemberships);
        } else {
          const response = await api.get<{ success: boolean; data: Membership[] }>(
            `/api/v1/company_groups/${selectedGroupId}/contacts`
          );
          const groupName = groupsMap[selectedGroupId] || "";
          setMemberships((response.data || []).map(m => ({ ...m, company_group_name: groupName })));
        }
      } catch (error) {
        console.error("Failed to load memberships:", error);
        setMemberships([]);
      } finally {
        setLoadingMemberships(false);
      }
    };

    if (groups.length > 0) {
      loadMemberships();
    }
  }, [selectedGroupId, groups, groupsMap]);

  const getEntityTypeBadgeColor = (type: string | null) => {
    switch (type?.toLowerCase()) {
      case "person":
        return "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300";
      case "company":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "trust":
        return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const getMembershipTypeBadgeColor = (type: string) => {
    switch (type) {
      case "director":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "shareholder":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
      case "company_entity":
      case "trust_entity":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  // Group memberships by contact (so each contact appears once)
  const groupedByContact = React.useMemo(() => {
    const contactMap = new Map<number, GroupedContact>();

    memberships.forEach((m) => {
      if (!contactMap.has(m.contact_id)) {
        contactMap.set(m.contact_id, {
          contact_id: m.contact_id,
          contact_name: m.contact_name,
          contact_email: m.contact_email,
          contact_entity_type: m.contact_entity_type,
          has_linked_company: m.has_linked_company || false,
          linked_company_id: m.linked_company_id || null,
          memberships: [],
        });
      }
      contactMap.get(m.contact_id)!.memberships.push(m);
    });

    return Array.from(contactMap.values()).sort((a, b) =>
      a.contact_name.localeCompare(b.contact_name)
    );
  }, [memberships]);

  // Group contacts by entity type
  const groupedByEntityType = React.useMemo(() => {
    const grouped: Record<string, GroupedContact[]> = {
      person: [],
      company: [],
      trust: [],
      unknown: [],
    };
    groupedByContact.forEach((contact) => {
      const type = contact.contact_entity_type?.toLowerCase() || "unknown";
      if (grouped[type]) {
        grouped[type].push(contact);
      } else {
        grouped.unknown.push(contact);
      }
    });
    return grouped;
  }, [groupedByContact]);

  const entityTypeLabels: Record<string, string> = {
    person: "People",
    company: "Companies",
    trust: "Trusts",
    unknown: "Unknown",
  };

  const toggleExpanded = (contactId: number) => {
    setExpandedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedContacts(new Set(groupedByContact.map(c => c.contact_id)));
  };

  const collapseAll = () => {
    setExpandedContacts(new Set());
  };

  // Render a contact row with expandable memberships
  const renderContactRow = (contact: GroupedContact) => {
    const isExpanded = expandedContacts.has(contact.contact_id);
    const hasMultipleMemberships = contact.memberships.length > 1;

    return (
      <React.Fragment key={contact.contact_id}>
        <tr
          className={`border-b hover:bg-muted/50 ${hasMultipleMemberships ? 'cursor-pointer' : ''}`}
          onClick={() => hasMultipleMemberships && toggleExpanded(contact.contact_id)}
        >
          <td className="py-2 px-3">
            <div className="flex items-center gap-2">
              {hasMultipleMemberships ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )
              ) : (
                <span className="w-4" />
              )}
              <div>
                <div className="font-medium">{contact.contact_name}</div>
                <div className="text-xs text-muted-foreground">
                  Contact ID: {contact.contact_id}
                  {contact.contact_email && ` · ${contact.contact_email}`}
                </div>
              </div>
            </div>
          </td>
          <td className="py-2 px-3">
            <Badge className={getEntityTypeBadgeColor(contact.contact_entity_type)}>
              {contact.contact_entity_type || "unknown"}
            </Badge>
          </td>
          <td className="py-2 px-3">
            {contact.has_linked_company && contact.linked_company_id ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/corporate/companies/${contact.linked_company_id}`);
                }}
                className="flex items-center gap-1 text-green-600 hover:text-green-800 hover:underline"
                title="View linked Company"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs">View</span>
              </button>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </td>
          <td className="py-2 px-3">
            {hasMultipleMemberships ? (
              <span className="text-muted-foreground text-sm">
                {contact.memberships.length} memberships
              </span>
            ) : (
              <Badge className={getMembershipTypeBadgeColor(contact.memberships[0].membership_type)}>
                {contact.memberships[0].membership_type}
              </Badge>
            )}
          </td>
          <td className="py-2 px-3">
            {hasMultipleMemberships ? (
              <span className="text-muted-foreground text-sm">—</span>
            ) : contact.memberships[0].company_group_name ? (
              <span className="text-sm">{contact.memberships[0].company_group_name}</span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </td>
          <td className="py-2 px-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/contacts/${contact.contact_id}`);
              }}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" />
              View
            </button>
          </td>
        </tr>
        {/* Expanded memberships */}
        {isExpanded && contact.memberships.map((m, idx) => (
          <tr key={`${contact.contact_id}-${m.id}`} className="bg-muted/20 border-b">
            <td className="py-1.5 px-3 pl-10">
              <span className="text-muted-foreground text-sm">└</span>
            </td>
            <td className="py-1.5 px-3">
              <span className="text-xs text-muted-foreground">Membership {idx + 1}</span>
            </td>
            <td className="py-1.5 px-3">
              {/* Empty cell for Linked column alignment */}
            </td>
            <td className="py-1.5 px-3">
              <Badge className={getMembershipTypeBadgeColor(m.membership_type)}>
                {m.membership_type}
              </Badge>
            </td>
            <td className="py-1.5 px-3">
              <span className="text-sm">{m.company_group_name || "-"}</span>
            </td>
            <td className="py-1.5 px-3">
              {m.company_name && (
                <button
                  onClick={() => router.push(`/corporate/companies/${m.company_id}`)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  {m.company_name}
                </button>
              )}
            </td>
          </tr>
        ))}
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const uniqueContactCount = groupedByContact.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight font-serif">Company Group Memberships (SSoT)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ContactCompanyGroupMembership table - links Contacts to Company Groups
        </p>
      </div>

      {/* Group Selector */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedGroupId(null)}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            selectedGroupId === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          All
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => setSelectedGroupId(group.id)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              selectedGroupId === group.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {group.name}
          </button>
        ))}
      </div>

      {/* Contacts Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Contacts ({uniqueContactCount}) · {memberships.length} memberships
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Expand All
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                onClick={collapseAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Collapse All
              </button>
            </div>
            <button
              onClick={() => setGroupByEntityType(!groupByEntityType)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {groupByEntityType ? (
                <ToggleRight className="h-5 w-5 text-primary" />
              ) : (
                <ToggleLeft className="h-5 w-5" />
              )}
              Group by Entity Type
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMemberships ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : groupedByContact.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No contacts in this group
            </div>
          ) : groupByEntityType ? (
            // Grouped by Entity Type view
            <div className="space-y-6">
              {["person", "company", "trust", "unknown"].map((entityType) => {
                const contacts = groupedByEntityType[entityType];
                if (contacts.length === 0) return null;
                return (
                  <div key={entityType}>
                    <h3 className={`font-medium mb-2 flex items-center gap-2 ${
                      entityType === "person" ? "text-teal-600" :
                      entityType === "company" ? "text-blue-600" :
                      entityType === "trust" ? "text-rose-500" : "text-gray-600"
                    }`}>
                      {entityTypeLabels[entityType]} ({contacts.length})
                    </h3>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left py-2 px-3 font-medium">Contact</th>
                            <th className="text-left py-2 px-3 font-medium">Entity Type</th>
                            <th className="text-left py-2 px-3 font-medium">Company</th>
                            <th className="text-left py-2 px-3 font-medium">Membership</th>
                            <th className="text-left py-2 px-3 font-medium">Group</th>
                            <th className="text-left py-2 px-3 font-medium">Contact</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contacts.map(renderContactRow)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Flat table view (contacts listed once, expandable)
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Contact</th>
                    <th className="text-left py-2 px-3 font-medium">Entity Type</th>
                    <th className="text-left py-2 px-3 font-medium">Company</th>
                    <th className="text-left py-2 px-3 font-medium">Membership</th>
                    <th className="text-left py-2 px-3 font-medium">Group</th>
                    <th className="text-left py-2 px-3 font-medium">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedByContact.map(renderContactRow)}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
