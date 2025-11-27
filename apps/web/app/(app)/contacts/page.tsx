"use client";

import { useEffect, useState } from "react";
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
import { Plus, Search, Filter, Mail, Phone } from "lucide-react";

interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  type: "customer" | "supplier" | "both";
  created_at: string;
}

const typeColors: Record<string, string> = {
  customer: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  supplier: "bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  both: "bg-purple-100 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadContacts = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await api.get('/api/v1/contacts');
        // setContacts(response.contacts);

        // Mock data for now
        setContacts([
          {
            id: 1,
            name: "John Smith",
            email: "john.smith@acme.com",
            phone: "+61 412 345 678",
            company: "Acme Corporation",
            type: "customer",
            created_at: "2024-01-15",
          },
          {
            id: 2,
            name: "Sarah Johnson",
            email: "sarah@steelsupply.com",
            phone: "+61 423 456 789",
            company: "Steel Supply Co",
            type: "supplier",
            created_at: "2024-02-20",
          },
          {
            id: 3,
            name: "Mike Williams",
            email: "mike@buildright.com",
            phone: "+61 434 567 890",
            company: "BuildRight Contractors",
            type: "both",
            created_at: "2024-03-01",
          },
          {
            id: 4,
            name: "Emma Davis",
            email: "emma@concreteworks.com",
            phone: "+61 445 678 901",
            company: "Concrete Works",
            type: "supplier",
            created_at: "2024-01-05",
          },
          {
            id: 5,
            name: "David Brown",
            email: "david@smithholdings.com",
            phone: "+61 456 789 012",
            company: "Smith Holdings",
            type: "customer",
            created_at: "2024-02-10",
          },
        ]);
      } catch (error) {
        console.error("Failed to load contacts:", error);
      } finally {
        setLoading(false);
      }
    };

    loadContacts();
  }, []);

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
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
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

      {/* Contacts Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
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
    </div>
  );
}
