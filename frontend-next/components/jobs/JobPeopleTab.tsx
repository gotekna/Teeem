"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Star,
  X,
  Search,
  Users,
  User,
  Building2,
  Wrench,
  Calculator,
  DollarSign,
  ClipboardList,
  Link as LinkIcon,
  Mail,
  Phone,
  ChevronDown,
  ChevronRight,
  Briefcase,
  MapPin,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { PAGE_SIZE_AUTOCOMPLETE } from "@/lib/constants/pagination-constants";

interface Contact {
  id: number;
  display_name?: string;
  company_name?: string;
  company_name_or_trust?: string;
  email?: string;
  mobile_phone?: string;
  phone?: string;
  office_phone?: string;
  address?: string;
  postcode?: string;
  entity_type?: string;
  abn?: string;
  acn?: string;
}

interface RelatedJob {
  id: number;
  address: string;
  job_status?: string;
  contract_value?: number;
}

interface JobContact {
  id: number;
  contact_id?: number;
  user_id?: number;
  primary: boolean;
  role: string;
  contact?: Contact;
  user?: {
    id: number;
    name: string;
    email: string;
  };
  relationships?: Array<{
    id: number;
    relationship_type: string;
    related_contact: Contact;
  }>;
  relationships_count?: number;
  related_jobs?: RelatedJob[];
  related_jobs_count?: number;
}

interface User {
  id: number;
  name: string;
  email: string;
}

interface JobPeopleTabProps {
  jobId: string | number;
  onUpdate?: () => void;
}

// Role definitions with labels and icons
const ROLE_GROUPS = [
  {
    key: "client",
    label: "Client Roles",
    icon: Building2,
    roles: [
      { key: "client", label: "Client", icon: Building2, color: "indigo" },
      { key: "client_representative", label: "Client Representative", icon: User, color: "blue" },
      { key: "client_broker", label: "Client Broker", icon: User, color: "cyan" },
      { key: "client_bank", label: "Client Bank", icon: Building2, color: "slate" },
    ],
  },
  {
    key: "referral",
    label: "Referral",
    icon: User,
    roles: [{ key: "referral", label: "Referral", icon: User, color: "green" }],
  },
  {
    key: "external",
    label: "External Team",
    icon: Users,
    roles: [{ key: "external_sales", label: "External Sales", icon: DollarSign, color: "pink" }],
  },
  {
    key: "internal",
    label: "Internal Team",
    icon: Users,
    roles: [
      { key: "supervisor", label: "Supervisor", icon: Wrench, color: "orange" },
      { key: "site_coordinator", label: "Site Coordinator", icon: ClipboardList, color: "amber" },
      { key: "estimator", label: "Estimator", icon: Calculator, color: "green" },
      { key: "internal_sales", label: "Internal Sales", icon: DollarSign, color: "purple" },
      { key: "coordinator", label: "Client Coordinator", icon: ClipboardList, color: "teal" },
    ],
  },
];

const ROLE_TYPES = ROLE_GROUPS.flatMap((g) => g.roles);
const INTERNAL_ROLES = ["supervisor", "site_coordinator", "estimator", "internal_sales", "coordinator"];

const getRoleConfig = (roleKey: string) => {
  return ROLE_TYPES.find((r) => r.key === roleKey) || { label: roleKey || "Contact", icon: User, color: "gray" };
};

const getRoleBadgeClasses = (color: string) => {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
    slate: "bg-muted text-foreground dark:bg-slate-900/30 dark:text-muted-foreground",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    pink: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
    teal: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
    gray: "bg-muted text-foreground dark:bg-background/30 dark:text-muted-foreground",
  };
  return colorMap[color] || colorMap.gray;
};

export function JobPeopleTab({ jobId, onUpdate }: JobPeopleTabProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<JobContact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingRole, setAddingRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // Track if a search has completed
  const [error, setError] = useState<string | null>(null);
  const [expandedContacts, setExpandedContacts] = useState<Set<number>>(new Set());

  const isInternalRole = (role: string) => INTERNAL_ROLES.includes(role);

  useEffect(() => {
    loadContacts();
    loadUsers();
     
  }, [jobId]);

  // Auto-focus search input when adding
  useEffect(() => {
    if (addingRole && !isInternalRole(addingRole) && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [addingRole]);

  const loadUsers = async () => {
    try {
      const response = await api.get<{ users?: User[] } | User[]>("/api/v1/users");
      setUsers(Array.isArray(response) ? response : response.users || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ job_contacts?: JobContact[] }>(
        `/api/v1/jobs/${jobId}/job_contacts`
      );
      setContacts(response.job_contacts || []);
    } catch (err) {
      console.error("Failed to load contacts:", err);
      setError("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (addingRole && searchQuery.length >= 2) {
        searchContacts(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
     
  }, [searchQuery, addingRole]);

  const searchContacts = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setHasSearched(false); // Reset when query is cleared/too short
      return;
    }

    try {
      setSearching(true);
      console.log("[JobPeopleTab] Searching contacts with query:", query);
      // SSoT: Uses PAGE_SIZE_AUTOCOMPLETE from pagination-constants.ts
      const response = await api.get<{ contacts?: Contact[] }>("/api/v1/contacts", {
        params: { search: query, per_page: PAGE_SIZE_AUTOCOMPLETE },
        dedupe: false, // Disable deduplication for search
      });

      console.log("[JobPeopleTab] API response:", response);
      console.log("[JobPeopleTab] Contacts returned:", response.contacts?.length || 0);

      const existingForRole = contacts.filter((c) => c.role === addingRole).map((c) => c.contact_id);
      console.log("[JobPeopleTab] Existing contacts for role", addingRole, ":", existingForRole);

      const filtered = (response.contacts || []).filter(
        (contact) => !existingForRole.includes(contact.id)
      );
      console.log("[JobPeopleTab] Filtered results:", filtered.length);
      setSearchResults(filtered);
      setHasSearched(true); // Mark that a search has completed
    } catch (err) {
      console.error("[JobPeopleTab] Failed to search contacts:", err);
      setHasSearched(true); // Also set on error so user knows search ran
    } finally {
      setSearching(false);
    }
  };

  const handleAddContact = async (contactId: number) => {
    try {
      setError(null);
      const isFirstClient = addingRole === "client" && !contacts.some((c) => c.role === "client");

      const response = await api.post<JobContact>(`/api/v1/jobs/${jobId}/job_contacts`, {
        job_contact: {
          contact_id: contactId,
          primary: isFirstClient,
          role: addingRole,
        },
      });

      if (response) {
        setContacts([...contacts, response]);
      }
      setAddingRole(null);
      setSearchQuery("");
      setSearchResults([]);
      onUpdate?.();
    } catch (err) {
      console.error("Failed to add contact:", err);
      setError("Failed to add contact");
    }
  };

  const handleAddUser = async (userId: number) => {
    try {
      setError(null);
      const response = await api.post<JobContact>(`/api/v1/jobs/${jobId}/job_contacts`, {
        job_contact: {
          user_id: userId,
          primary: false,
          role: addingRole,
        },
      });

      if (response) {
        setContacts([...contacts, response]);
      }
      setAddingRole(null);
      onUpdate?.();
    } catch (err) {
      console.error("Failed to add user:", err);
      setError("Failed to add user");
    }
  };

  const handleRemoveContact = async (jobContactId: number) => {
    const contact = contacts.find((c) => c.id === jobContactId);
    const clientContacts = contacts.filter((c) => c.role === "client");

    if (contact?.role === "client" && clientContacts.length === 1) {
      alert("Cannot remove the last client. At least one client is required.");
      return;
    }

    if (!confirm("Are you sure you want to remove this person from the job?")) return;

    try {
      setError(null);
      await api.delete(`/api/v1/jobs/${jobId}/job_contacts/${jobContactId}`);
      setContacts(contacts.filter((c) => c.id !== jobContactId));
      onUpdate?.();
    } catch (err) {
      console.error("Failed to remove contact:", err);
      setError("Failed to remove contact");
    }
  };

  const handleSetPrimary = async (jobContactId: number) => {
    try {
      setError(null);
      await api.put(`/api/v1/jobs/${jobId}/job_contacts/${jobContactId}`, {
        job_contact: { primary: true },
      });

      setContacts(
        contacts.map((c) => ({
          ...c,
          primary: c.id === jobContactId,
        }))
      );
      onUpdate?.();
    } catch (err) {
      console.error("Failed to set primary contact:", err);
      setError("Failed to set primary contact");
    }
  };

  const toggleExpanded = (contactId: number) => {
    setExpandedContacts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const getContactDisplayName = (contact?: Contact) => {
    if (!contact) return "Unknown";
    return (
      contact.display_name ||
      contact.company_name ||
      "Unnamed Contact"
    );
  };

  // Group contacts by role
  const contactsByRole: Record<string, JobContact[]> = ROLE_TYPES.reduce((acc, role) => {
    acc[role.key] = contacts.filter((c) => c.role === role.key);
    return acc;
  }, {} as Record<string, JobContact[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Add Person Modal - for external roles */}
      {addingRole && !isInternalRole(addingRole) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Add {getRoleConfig(addingRole).label}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setAddingRole(null);
                setSearchQuery("");
                setSearchResults([]);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts by name, email, or company..."
                className="pl-9"
              />
            </div>

            {searching && (
              <div className="mt-2 text-sm text-muted-foreground text-center py-2">
                Searching...
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
                {searchResults.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleAddContact(contact.id)}
                    className="w-full text-left px-3 py-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <div className="font-medium text-sm">{getContactDisplayName(contact)}</div>
                    {contact.email && (
                      <div className="text-xs text-muted-foreground mt-0.5">{contact.email}</div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {!searching && hasSearched && searchResults.length === 0 && (
              <div className="mt-2 text-sm text-muted-foreground text-center py-2">
                No contacts found
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Internal Team User Selection */}
      {addingRole && isInternalRole(addingRole) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Select {getRoleConfig(addingRole).label}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setAddingRole(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {users
                .filter(
                  (user) => !contacts.some((c) => c.user_id === user.id && c.role === addingRole)
                )
                .map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleAddUser(user.id)}
                    className="w-full text-left px-3 py-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <div className="font-medium text-sm">{user.name || user.email}</div>
                    {user.name && user.email && (
                      <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                    )}
                  </button>
                ))}
              {users.filter(
                (user) => !contacts.some((c) => c.user_id === user.id && c.role === addingRole)
              ).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-2">
                  All users have already been assigned this role
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* People by Role Group */}
      {ROLE_GROUPS.map((group) => {
        const isInternalGroup = group.key === "internal";

        if (isInternalGroup) {
          // Internal Team - grid layout
          const GroupIcon = group.icon;
          return (
            <div key={group.key} className="space-y-2">
              <div className="flex items-center gap-2 pb-1 border-b">
                <GroupIcon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">{group.label}</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {group.roles.map((role) => {
                  const roleContacts = contactsByRole[role.key] || [];
                  const RoleIcon = role.icon;

                  return (
                    <Card key={role.key} className="p-2">
                      <div className="flex items-center gap-1 mb-1 pb-1 border-b">
                        <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <h4 className="font-medium text-xs">{role.label}</h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-5 w-5"
                          onClick={() => setAddingRole(role.key)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {roleContacts.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Not assigned</p>
                      ) : (
                        <div className="space-y-1">
                          {roleContacts.map((contact) => (
                            <div
                              key={contact.id}
                              className="flex items-start justify-between gap-1"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-xs block truncate">
                                  {contact.user?.name || contact.user?.email || "Unknown"}
                                </span>
                                {contact.user?.email && (
                                  <a
                                    href={`mailto:${contact.user.email}`}
                                    className="text-xs text-muted-foreground hover:text-primary truncate block"
                                  >
                                    {contact.user.email}
                                  </a>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveContact(contact.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        }

        // External roles - collapsible rows
        return group.roles.map((role) => {
          const roleContacts = contactsByRole[role.key] || [];
          // Always show client and client_representative (needed for QBCC contracts)
          // Hide other client sub-roles (broker, bank) when empty
          const alwaysShowRoles = ["client", "client_representative"];
          if (roleContacts.length === 0 && group.key === "client" && !alwaysShowRoles.includes(role.key)) return null;

          const RoleIcon = role.icon;
          return (
            <div key={role.key} className="space-y-2">
              <div className="flex items-center gap-2 pb-1 border-b">
                <RoleIcon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">{role.label}</h3>
                <Badge variant="secondary" className={getRoleBadgeClasses(role.color)}>
                  {roleContacts.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setAddingRole(role.key);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>

              {roleContacts.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No {role.label.toLowerCase()} assigned
                </p>
              )}

              {roleContacts.map((contact) => {
                const isExpanded = expandedContacts.has(contact.id);
                const displayName =
                  contact.contact?.display_name || contact.contact?.company_name || "Unknown";
                const email = contact.contact?.email;
                const mobile = contact.contact?.phone || contact.contact?.mobile_phone;
                const isPrimary = contact.primary;

                return (
                  <Card key={contact.id} className="overflow-hidden">
                    {/* Header Row */}
                    <div
                      className="px-3 py-2 cursor-pointer hover:bg-muted/50 flex items-center gap-2"
                      onClick={() => toggleExpanded(contact.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}

                      {role.key === "client" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isPrimary) handleSetPrimary(contact.id);
                          }}
                          className={`${
                            isPrimary
                              ? "text-yellow-500 cursor-default"
                              : "text-muted-foreground hover:text-yellow-500"
                          }`}
                        >
                          <Star className={`h-4 w-4 ${isPrimary ? "fill-current" : ""}`} />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/contacts/${contact.contact_id}`);
                        }}
                        className="font-medium text-sm text-primary hover:underline"
                      >
                        {displayName}
                      </button>

                      {isPrimary && (
                        <Badge variant="secondary" className="text-xs">
                          Primary
                        </Badge>
                      )}

                      <div className="flex-1" />

                      <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                        {email && (
                          <a
                            href={`mailto:${email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 hover:text-primary"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {mobile && (
                          <a
                            href={`tel:${mobile}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 hover:text-primary"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveContact(contact.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="p-4 border-t bg-muted/20">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Contact Details */}
                          <div>
                            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Contact Details
                            </h4>
                            <Card>
                              <CardContent className="p-4 space-y-2">
                                <p className="font-medium text-sm">{displayName}</p>
                                <Badge className={getRoleBadgeClasses(role.color)}>{role.label}</Badge>
                                {contact.contact?.entity_type && contact.contact.entity_type !== 'person' && (
                                  <Badge variant="outline" className="text-xs">
                                    {contact.contact.entity_type.replace('_', ' ')}
                                  </Badge>
                                )}
                                {email && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5 shrink-0" />
                                    <a href={`mailto:${email}`} className="hover:text-primary">
                                      {email}
                                    </a>
                                  </div>
                                )}
                                {mobile && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5 shrink-0" />
                                    <a href={`tel:${mobile}`} className="hover:text-primary">
                                      {mobile}
                                    </a>
                                  </div>
                                )}
                                {contact.contact?.address && (
                                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                    <span>
                                      {contact.contact.address}
                                      {contact.contact.postcode && ` ${contact.contact.postcode}`}
                                    </span>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>

                          {/* Contract Info (for clients) */}
                          {role.key === 'client' && (
                            <div>
                              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Contract Info
                              </h4>
                              <Card>
                                <CardContent className="p-4 space-y-2 text-xs">
                                  {contact.contact?.entity_type === 'company' && (
                                    <>
                                      {contact.contact.acn && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">ACN:</span>
                                          <span className="font-mono">{contact.contact.acn}</span>
                                        </div>
                                      )}
                                      {contact.contact.abn && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">ABN:</span>
                                          <span className="font-mono">{contact.contact.abn}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                  {contact.contact?.entity_type === 'trust' && (
                                    <div className="text-muted-foreground">
                                      Trust - check trustee in Related Contacts
                                    </div>
                                  )}
                                  {(!contact.contact?.address) && (
                                    <div className="text-amber-600 dark:text-amber-400">
                                      ⚠️ No address - required for contract
                                    </div>
                                  )}
                                  {(!contact.contact?.entity_type || contact.contact.entity_type === 'person') &&
                                   !contact.contact?.abn && !contact.contact?.acn && (
                                    <div className="text-muted-foreground">
                                      Individual (person)
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </div>
                          )}

                          {/* Related Contacts */}
                          <div>
                            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                              <LinkIcon className="h-4 w-4" />
                              Related Contacts
                              <Badge variant="secondary">{contact.relationships_count || 0}</Badge>
                            </h4>
                            {contact.relationships && contact.relationships.length > 0 ? (
                              <div className="space-y-2">
                                {contact.relationships.slice(0, 3).map((rel) => (
                                  <Card key={rel.id}>
                                    <CardContent className="p-3">
                                      <button
                                        onClick={() =>
                                          router.push(`/contacts/${rel.related_contact.id}`)
                                        }
                                        className="font-medium text-xs text-primary hover:underline"
                                      >
                                        {rel.related_contact.display_name ||
                                          rel.related_contact.company_name}
                                      </button>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {rel.relationship_type.replace(/_/g, " ")}
                                      </p>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                No related contacts
                              </p>
                            )}
                          </div>

                          {/* Related Jobs - shows other jobs this contact is associated with */}
                          <div>
                            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                              <Briefcase className="h-4 w-4" />
                              Related Jobs
                              <Badge variant="secondary">{contact.related_jobs_count || 0}</Badge>
                            </h4>
                            {contact.related_jobs && contact.related_jobs.length > 0 ? (
                              <div className="space-y-2">
                                {contact.related_jobs.map((relJob) => (
                                  <Card key={relJob.id}>
                                    <CardContent className="p-3">
                                      <button
                                        onClick={() => router.push(`/jobs/${relJob.id}`)}
                                        className="font-medium text-xs text-primary hover:underline text-left"
                                      >
                                        {relJob.address}
                                      </button>
                                      <div className="flex items-center gap-2 mt-1">
                                        {relJob.job_status && (
                                          <Badge variant="outline" className="text-xs">
                                            {relJob.job_status}
                                          </Badge>
                                        )}
                                        {relJob.contract_value && relJob.contract_value > 0 && (
                                          <span className="text-xs text-muted-foreground">
                                            ${relJob.contract_value.toLocaleString()}
                                          </span>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                                {(contact.related_jobs_count || 0) > 5 && (
                                  <button
                                    onClick={() => router.push(`/contacts/${contact.contact_id}`)}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    View all {contact.related_jobs_count} jobs →
                                  </button>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                No other jobs for this contact
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          );
        });
      })}

      {/* Empty State */}
      {contacts.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <h3 className="text-sm font-medium">No people added</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Use the + Add buttons above to add people.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default JobPeopleTab;
