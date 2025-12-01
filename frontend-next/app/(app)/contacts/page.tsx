"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { Plus, Search, Filter, Mail, Phone, Users, AlertTriangle, Merge } from "lucide-react";
import { api } from "@/lib/api";

interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  type: "customer" | "supplier" | "both";
  created_at: string;
  xero_contact_id?: string;
  jobs_count: number;
  purchase_orders_count: number;
  completeness_score: number;
}

interface DuplicateGroup {
  key: string;
  contacts: Contact[];
}

const typeColors: Record<string, string> = {
  customer: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  supplier: "bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  both: "bg-purple-100 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400",
};

export default function ContactsPage() {
  const searchParams = useSearchParams();
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
      // Mock data for demo
      setContacts(getMockContacts());
    }
  };

  const loadDuplicates = async () => {
    try {
      const response = await api.get<{ duplicate_groups: DuplicateGroup[] }>("/api/v1/contacts/duplicates");
      setDuplicateGroups(response.duplicate_groups || []);
    } catch (error) {
      console.error("Failed to load duplicates:", error);
      // Mock data for demo
      setDuplicateGroups(getMockDuplicates());
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

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            Manage your customers, suppliers, and business contacts
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono">{contacts.length}</div>
            <p className="text-xs text-muted-foreground">Total Contacts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono text-blue-600">
              {contacts.filter((c) => c.type === "customer").length}
            </div>
            <p className="text-xs text-muted-foreground">Customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono text-green-600">
              {contacts.filter((c) => c.type === "supplier").length}
            </div>
            <p className="text-xs text-muted-foreground">Suppliers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono text-purple-600">
              {contacts.filter((c) => c.type === "both").length}
            </div>
            <p className="text-xs text-muted-foreground">Both</p>
          </CardContent>
        </Card>
        <Card className={duplicateGroups.length > 0 ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10" : ""}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono text-yellow-600">
              {duplicateGroups.length}
            </div>
            <p className="text-xs text-muted-foreground">Possible Duplicates</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Contacts</TabsTrigger>
            <TabsTrigger value="duplicates" className="relative">
              Possible Duplicates
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
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="all" className="mt-4">
          {/* Contacts Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
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
                            {contact.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="font-medium hover:underline"
                        >
                          {contact.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>{contact.company}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {contact.email}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={typeColors[contact.type]}>{contact.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/contacts/${contact.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="duplicates" className="mt-4 space-y-4">
          {duplicateGroups.length === 0 ? (
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
            <>
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
                          <TableHead>Company</TableHead>
                          <TableHead>Jobs</TableHead>
                          <TableHead>Completeness</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.contacts.map((contact) => (
                          <TableRow key={contact.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {contact.name.split(" ").map((n) => n[0]).join("")}
                                  </AvatarFallback>
                                </Avatar>
                                {contact.name}
                                {contact.xero_contact_id && (
                                  <Badge variant="outline" className="text-xs">Xero</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{contact.email || "-"}</TableCell>
                            <TableCell>{contact.company || "-"}</TableCell>
                            <TableCell>{contact.jobs_count}</TableCell>
                            <TableCell>
                              <Badge
                                variant={contact.completeness_score >= 80 ? "default" : "secondary"}
                              >
                                {contact.completeness_score}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </>
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

// Mock data functions
function getMockContacts(): Contact[] {
  return [
    {
      id: 1,
      name: "John Smith",
      email: "john.smith@acme.com",
      phone: "+61 412 345 678",
      company: "Acme Corporation",
      type: "customer",
      created_at: "2024-01-15",
      jobs_count: 5,
      purchase_orders_count: 12,
      completeness_score: 95,
    },
    {
      id: 2,
      name: "Jon Smith",
      email: "jon.smith@acme.com",
      phone: "+61 412 345 679",
      company: "Acme Corp",
      type: "customer",
      created_at: "2024-02-20",
      jobs_count: 1,
      purchase_orders_count: 2,
      completeness_score: 60,
    },
    {
      id: 3,
      name: "Sarah Johnson",
      email: "sarah@steelsupply.com",
      phone: "+61 423 456 789",
      company: "Steel Supply Co",
      type: "supplier",
      created_at: "2024-02-20",
      xero_contact_id: "xero-123",
      jobs_count: 8,
      purchase_orders_count: 24,
      completeness_score: 100,
    },
    {
      id: 4,
      name: "Mike Williams",
      email: "mike@buildright.com",
      phone: "+61 434 567 890",
      company: "BuildRight Contractors",
      type: "both",
      created_at: "2024-03-01",
      jobs_count: 3,
      purchase_orders_count: 6,
      completeness_score: 85,
    },
    {
      id: 5,
      name: "Emma Davis",
      email: "emma@concreteworks.com",
      phone: "+61 445 678 901",
      company: "Concrete Works",
      type: "supplier",
      created_at: "2024-01-05",
      jobs_count: 2,
      purchase_orders_count: 8,
      completeness_score: 90,
    },
  ];
}

function getMockDuplicates(): DuplicateGroup[] {
  return [
    {
      key: "john-smith",
      contacts: [
        {
          id: 1,
          name: "John Smith",
          email: "john.smith@acme.com",
          phone: "+61 412 345 678",
          company: "Acme Corporation",
          type: "customer",
          created_at: "2024-01-15",
          xero_contact_id: "xero-456",
          jobs_count: 5,
          purchase_orders_count: 12,
          completeness_score: 95,
        },
        {
          id: 2,
          name: "Jon Smith",
          email: "jon.smith@acme.com",
          phone: "+61 412 345 679",
          company: "Acme Corp",
          type: "customer",
          created_at: "2024-02-20",
          jobs_count: 1,
          purchase_orders_count: 2,
          completeness_score: 60,
        },
      ],
    },
  ];
}
