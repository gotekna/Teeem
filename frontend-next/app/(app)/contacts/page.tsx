"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MergeContactsModal } from "@/components/contacts/merge-contacts-modal";
import {
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  Users,
  AlertTriangle,
  Merge,
  Building2,
  User,
  Truck,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { slugifyContactName } from "@/lib/url-utils";

interface Contact {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  office_phone: string | null;
  entity_type: string | null;
  is_active: boolean;
  portal_enabled: boolean;
  xero_id: string | null;
  xero_synced: boolean;
  teeem_rating: number | null;
  supplier_code: string | null;
  address: string | null;
  created_at: string;
  updated_at?: string;
  // Legacy compatibility
  name?: string;
  phone?: string;
  company?: string;
  type?: string;
  jobs_count?: number;
  purchase_orders_count?: number;
  completeness_score?: number;
}

interface DuplicateGroup {
  key: string;
  contacts: Contact[];
}

const entityTypeColors: Record<string, string> = {
  person: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  company: "bg-purple-100 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400",
  default_supplier: "bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400",
};

const entityTypeLabels: Record<string, string> = {
  person: "Person",
  company: "Company",
  default_supplier: "Supplier",
};

const entityTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  person: User,
  company: Building2,
  default_supplier: Truck,
};

export default function ContactsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showDuplicates = searchParams.get("duplicates") === "true";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(showDuplicates ? "duplicates" : "all");
  const [selectedForMerge, setSelectedForMerge] = useState<Contact[]>([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  const loadContacts = async () => {
    try {
      const response = await api.get<{ contacts: Contact[] }>("/api/v1/contacts");
      setContacts(response.contacts || []);
    } catch (error) {
      console.error("Failed to load contacts:", error);
      setContacts([]);
    }
  };

  const loadDuplicates = async () => {
    try {
      const response = await api.get<{ duplicate_groups: DuplicateGroup[] }>("/api/v1/contacts/duplicates");
      setDuplicateGroups(response.duplicate_groups || []);
    } catch (error) {
      console.error("Failed to load duplicates:", error);
      setDuplicateGroups([]);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadContacts(), loadDuplicates()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleMergeComplete = () => {
    setSelectedForMerge([]);
    loadContacts();
    loadDuplicates();
  };

  const toggleContactForMerge = (contact: Contact) => {
    setSelectedForMerge((prev) => {
      const exists = prev.find((c) => c.id === contact.id);
      if (exists) {
        return prev.filter((c) => c.id !== contact.id);
      }
      return [...prev, contact];
    });
  };

  const stats = {
    total: contacts.length,
    active: contacts.filter((c) => c.is_active).length,
    persons: contacts.filter((c) => c.entity_type === "person").length,
    companies: contacts.filter((c) => c.entity_type === "company").length,
    suppliers: contacts.filter((c) => c.entity_type === "default_supplier").length,
    withXero: contacts.filter((c) => c.xero_id || c.xero_synced).length,
  };

  const filteredContacts = contacts.filter((contact) => {
    const name = contact.full_name || contact.name || "";
    const email = contact.email || "";
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.supplier_code?.toLowerCase() || "").includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === "all" ||
      activeTab === "duplicates" ||
      (activeTab === "persons" && contact.entity_type === "person") ||
      (activeTab === "companies" && contact.entity_type === "company") ||
      (activeTab === "suppliers" && contact.entity_type === "default_supplier");

    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total.toLocaleString()} contacts - {stats.active.toLocaleString()} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedForMerge.length >= 2 && (
            <Button variant="outline" onClick={() => setMergeModalOpen(true)}>
              <Merge className="h-4 w-4 mr-2" />
              Merge ({selectedForMerge.length})
            </Button>
          )}
          <Button asChild>
            <Link href="/contacts/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2 text-green-600">
              {stats.active.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Persons</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.persons}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Companies</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.companies}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Suppliers</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.suppliers}</div>
          </CardContent>
        </Card>
        <Card className={duplicateGroups.length > 0 ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">Duplicates</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2 text-yellow-600">
              {duplicateGroups.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="persons">Persons</TabsTrigger>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            <TabsTrigger value="duplicates" className="relative">
              Duplicates
              {duplicateGroups.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                  {duplicateGroups.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[280px]"
              />
            </div>
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          {activeTab === "duplicates" ? (
            duplicateGroups.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-green-600 mb-4" />
                  <p className="font-medium">No duplicate contacts found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your contact list is clean
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Found {duplicateGroups.length} groups of possible duplicate contacts.
                    Review and merge to keep your CRM clean.
                  </AlertDescription>
                </Alert>

                {duplicateGroups.map((group) => (
                  <Card key={group.key}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium">
                            {group.contacts.length} similar contacts
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedForMerge(group.contacts);
                            setMergeModalOpen(true);
                          }}
                        >
                          <Merge className="h-4 w-4 mr-2" />
                          Merge These
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.contacts.map((contact) => (
                            <TableRow key={contact.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">
                                      {(contact.full_name || contact.name || "?")
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")}
                                    </AvatarFallback>
                                  </Avatar>
                                  {contact.full_name || contact.name}
                                  {contact.xero_id && (
                                    <Badge variant="outline" className="text-xs">Xero</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{contact.email || "-"}</TableCell>
                              <TableCell>
                                {contact.entity_type && (
                                  <Badge className={entityTypeColors[contact.entity_type] || ""}>
                                    {entityTypeLabels[contact.entity_type] || contact.entity_type}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {contact.is_active ? (
                                  <Badge className="bg-green-100 text-green-700">Active</Badge>
                                ) : (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.slice(0, 100).map((contact) => {
                    const displayName = contact.full_name || contact.name || "Unknown";
                    const Icon = contact.entity_type
                      ? entityTypeIcons[contact.entity_type] || User
                      : User;

                    return (
                      <TableRow
                        key={contact.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50",
                          !contact.is_active && "opacity-50"
                        )}
                        onDoubleClick={() => router.push(`/contacts/${slugifyContactName(contact.first_name || undefined, contact.last_name || undefined, contact.full_name || contact.name)}`)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedForMerge.some((c) => c.id === contact.id)}
                            onCheckedChange={() => toggleContactForMerge(contact)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src="" />
                              <AvatarFallback>
                                {displayName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Link
                                href={`/contacts/${slugifyContactName(contact.first_name || undefined, contact.last_name || undefined, contact.full_name || contact.name)}`}
                                className="font-medium hover:underline"
                              >
                                {displayName}
                              </Link>
                              {contact.supplier_code && (
                                <div className="text-xs text-muted-foreground">
                                  Code: {contact.supplier_code}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.entity_type && (
                            <Badge className={entityTypeColors[contact.entity_type] || "bg-gray-100 text-gray-700"}>
                              <Icon className="h-3 w-3 mr-1" />
                              {entityTypeLabels[contact.entity_type] || contact.entity_type}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {contact.email && (
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                {contact.email}
                              </div>
                            )}
                            {(contact.mobile_phone || contact.phone) && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {contact.mobile_phone || contact.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {contact.is_active ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                            {contact.xero_id && (
                              <Badge variant="outline" className="text-xs">Xero</Badge>
                            )}
                            {contact.portal_enabled && (
                              <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Portal</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/contacts/${slugifyContactName(contact.first_name || undefined, contact.last_name || undefined, contact.full_name || contact.name)}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredContacts.length > 100 && (
                <div className="p-4 text-center text-sm text-muted-foreground border-t">
                  Showing 100 of {filteredContacts.length.toLocaleString()} contacts. Use search to filter.
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Merge Modal */}
      <MergeContactsModal
        open={mergeModalOpen}
        onOpenChange={setMergeModalOpen}
        contacts={selectedForMerge}
        onMergeComplete={handleMergeComplete}
      />
    </div>
  );
}

