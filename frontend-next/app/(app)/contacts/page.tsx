"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MergeContactsModal } from "@/components/contacts/merge-contacts-modal";
import { ContactDetailDrawer } from "@/components/contacts/ContactDetailDrawer";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import {
  Plus,
  Users,
  AlertTriangle,
  Merge,
  Building2,
  User,
  Truck,
  CheckCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { slugifyContactName } from "@/lib/url-utils";
import type { TableColumn, TableRow as TTableRow } from "@/components/table/types";

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
  company: "bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  trust: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400",
  default_supplier: "bg-purple-100 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400",
};

const entityTypeLabels: Record<string, string> = {
  person: "Person",
  company: "Company",
  trust: "Trust",
  default_supplier: "Supplier",
};

export default function ContactsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showDuplicates = searchParams.get("duplicates") === "true";

  // Use foundation hook for TeeemTableView
  const { foundation, columns, records, isLoading, error, refresh } = useFoundationBySlug("contacts");

  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(showDuplicates ? "duplicates" : "all");
  const [selectedForMerge, setSelectedForMerge] = useState<Contact[]>([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load duplicates
  const loadDuplicates = async () => {
    try {
      setDuplicatesLoading(true);
      const response = await api.get<{ duplicate_groups: DuplicateGroup[] }>("/api/v1/contacts/duplicates");
      setDuplicateGroups(response.duplicate_groups || []);
    } catch (error) {
      console.error("Failed to load duplicates:", error);
      setDuplicateGroups([]);
    } finally {
      setDuplicatesLoading(false);
    }
  };

  useEffect(() => {
    loadDuplicates();
  }, []);

  const handleMergeComplete = () => {
    setSelectedForMerge([]);
    refresh();
    loadDuplicates();
  };

  // Handle row click - navigate to contact detail
  const handleRowClick = useCallback((row: TTableRow) => {
    const contact = row as unknown as Contact;
    const slug = slugifyContactName(
      contact.first_name || undefined,
      contact.last_name || undefined,
      contact.full_name || contact.name
    );
    router.push(`/contacts/${slug}`);
  }, [router]);

  // Handle row double-click - navigate to contact detail page
  const handleRowDoubleClick = useCallback((row: TTableRow) => {
    const contact = row as unknown as Contact;
    const slug = slugifyContactName(
      contact.first_name || undefined,
      contact.last_name || undefined,
      contact.full_name || contact.name
    );
    router.push(`/contacts/${slug}`);
  }, [router]);

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/contacts/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update contact:", error);
      throw error;
    }
  }, [refresh]);

  // Calculate stats from records - memoized to prevent recalculating on every render
  const stats = useMemo(() => ({
    total: records.length,
    active: records.filter((c) => c.is_active).length,
    persons: records.filter((c) => c.entity_type === "person").length,
    companies: records.filter((c) => c.entity_type === "company").length,
    trusts: records.filter((c) => c.entity_type === "trust").length,
    suppliers: records.filter((c) => c.entity_type === "default_supplier").length,
    withXero: records.filter((c) => c.xero_id || c.xero_synced).length,
  }), [records]);

  // Filter records based on active tab - memoized to prevent re-filtering on every render
  const filteredRecords = useMemo(() => {
    switch (activeTab) {
      case "persons":
        return records.filter((c) => c.entity_type === "person");
      case "companies":
        return records.filter((c) => c.entity_type === "company");
      case "trusts":
        return records.filter((c) => c.entity_type === "trust");
      case "suppliers":
        return records.filter((c) => c.entity_type === "default_supplier");
      default:
        return records;
    }
  }, [records, activeTab]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  // Left actions - Add Contact button
  const leftActions = (
    <Button asChild>
      <Link href="/contacts/new">
        <Plus className="h-4 w-4 mr-2" />
        Add Contact
      </Link>
    </Button>
  );

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
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="persons">Persons</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="trusts">Trusts</TabsTrigger>
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

        {/* Duplicates Tab Content */}
        <TabsContent value="duplicates" className="mt-4">
          {duplicatesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader />
            </div>
          ) : duplicateGroups.length === 0 ? (
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
          )}
        </TabsContent>

        {/* All/Persons/Companies/Suppliers Tab Content - Single TeeemTableView for performance */}
        {activeTab !== "duplicates" && (
          <TabsContent value={activeTab} className="mt-4" forceMount>
            <TeeemTableView
              entries={filteredRecords}
              columns={columns}
              foundationId="contacts"
              foundationIdNumeric={foundation?.id}
              tableName={foundation?.name || "Contacts"}
              enableExport={true}
              enableImport={true}
              showDataHealth={true}
              onRefresh={refresh}
              onRowClick={handleRowClick}
              onRowDoubleClick={handleRowDoubleClick}
              onRowUpdate={handleRowUpdate}
              leftActions={leftActions}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Merge Modal */}
      <MergeContactsModal
        open={mergeModalOpen}
        onOpenChange={setMergeModalOpen}
        contacts={selectedForMerge}
        onMergeComplete={handleMergeComplete}
      />

      {/* Contact Detail Drawer */}
      <ContactDetailDrawer
        contactId={selectedContactId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
