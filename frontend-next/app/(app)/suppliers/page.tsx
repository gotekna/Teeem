"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Plus,
  Search,
  Building2,
  CheckCircle,
  ExternalLink,
  Star,
  Phone,
  Mail,
  MoreHorizontal,
  Edit,
  Trash,
  FileText,
  Layers,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";

// Suppliers are contacts with entity_type = 'default_supplier'
interface Supplier {
  id: number;
  full_name: string;
  email: string | null;
  mobile_phone: string | null;
  office_phone: string | null;
  address: string | null;
  entity_type: string;
  is_active: boolean;
  portal_enabled: boolean;
  xero_id: string | null;
  xero_synced: boolean;
  teeem_rating: number | null;
  supplier_code: string | null;
  tax_number: string | null; // ABN
  lgas: string[] | null;
  rating: number | null;
  response_rate: number | null;
  avg_response_time: number | null;
  accounts_payable_outstanding: number | null;
  accounts_payable_overdue: number | null;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Suppliers are contacts filtered by entity_type
        const response = await api.get<{ contacts: Supplier[] }>("/api/v1/contacts?entity_type=default_supplier");
        setSuppliers(response.contacts || []);
      } catch (error) {
        console.error("Failed to load suppliers:", error);
        // Fallback: try to get all contacts and filter client-side
        try {
          const allContacts = await api.get<{ contacts: Supplier[] }>("/api/v1/contacts");
          setSuppliers((allContacts.contacts || []).filter(c => c.entity_type === "default_supplier"));
        } catch {
          setSuppliers(getMockSuppliers());
        }
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const stats = {
    total: suppliers.length,
    active: suppliers.filter((s) => s.is_active).length,
    withXero: suppliers.filter((s) => s.xero_id || s.xero_synced).length,
    withPortal: suppliers.filter((s) => s.portal_enabled).length,
    withRating: suppliers.filter((s) => s.teeem_rating && s.teeem_rating > 0).length,
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesSearch =
      supplier.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.supplier_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.tax_number?.includes(searchQuery);
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "active" && supplier.is_active) ||
      (activeTab === "portal" && supplier.portal_enabled) ||
      (activeTab === "xero" && (supplier.xero_id || supplier.xero_synced));
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
          <h1 className="text-2xl font-bold tracking-tight font-serif">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total} default suppliers for pricebook items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/pricebook">
              <Layers className="h-4 w-4 mr-2" />
              View Price Book
            </Link>
          </Button>
          <Button asChild>
            <Link href="/contacts/new?type=supplier">
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Total Suppliers</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2 text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">In Xero</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.withXero}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Portal Access</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.withPortal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Rated</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.withRating}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Search */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="all">All Suppliers</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="portal">
              Portal Access
              {stats.withPortal > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats.withPortal}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="xero">In Xero</TabsTrigger>
          </TabsList>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, ABN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[280px]"
            />
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>ABN</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id} className={!supplier.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {supplier.full_name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")
                              .substring(0, 2) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Link
                            href={`/contacts/${supplier.id}`}
                            className="font-medium hover:underline flex items-center gap-2"
                          >
                            {supplier.full_name}
                          </Link>
                          {supplier.supplier_code && (
                            <span className="text-xs text-muted-foreground font-mono">
                              Code: {supplier.supplier_code}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {supplier.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {supplier.email}
                          </div>
                        )}
                        {(supplier.mobile_phone || supplier.office_phone) && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {supplier.mobile_phone || supplier.office_phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{supplier.tax_number || "-"}</span>
                    </TableCell>
                    <TableCell>
                      {supplier.teeem_rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-mono">{supplier.teeem_rating.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {supplier.is_active ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        {supplier.xero_id && (
                          <Badge variant="outline" className="text-xs">Xero</Badge>
                        )}
                        {supplier.portal_enabled && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                            Portal
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {supplier.accounts_payable_outstanding ? (
                        <div>
                          <div className="font-mono font-medium">
                            ${supplier.accounts_payable_outstanding.toLocaleString()}
                          </div>
                          {supplier.accounts_payable_overdue && supplier.accounts_payable_overdue > 0 && (
                            <div className="text-xs text-red-600">
                              ${supplier.accounts_payable_overdue.toLocaleString()} overdue
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/contacts/${supplier.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              View / Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/pricebook?supplier=${supplier.id}`}>
                              <FileText className="h-4 w-4 mr-2" />
                              View Price Book Items
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredSuppliers.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No suppliers found. Suppliers are contacts with entity type "default_supplier".
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getMockSuppliers(): Supplier[] {
  return [
    {
      id: 1809,
      full_name: "AVID",
      email: null,
      mobile_phone: null,
      office_phone: null,
      address: null,
      entity_type: "default_supplier",
      is_active: true,
      portal_enabled: false,
      xero_id: null,
      xero_synced: false,
      teeem_rating: null,
      supplier_code: null,
      tax_number: null,
      lgas: null,
      rating: null,
      response_rate: null,
      avg_response_time: null,
      accounts_payable_outstanding: null,
      accounts_payable_overdue: null,
    },
    {
      id: 1825,
      full_name: "TWS TRADE",
      email: null,
      mobile_phone: null,
      office_phone: null,
      address: null,
      entity_type: "default_supplier",
      is_active: true,
      portal_enabled: false,
      xero_id: null,
      xero_synced: false,
      teeem_rating: null,
      supplier_code: null,
      tax_number: null,
      lgas: null,
      rating: null,
      response_rate: null,
      avg_response_time: null,
      accounts_payable_outstanding: null,
      accounts_payable_overdue: null,
    },
    {
      id: 1320,
      full_name: "NAB",
      email: null,
      mobile_phone: null,
      office_phone: null,
      address: null,
      entity_type: "default_supplier",
      is_active: true,
      portal_enabled: false,
      xero_id: null,
      xero_synced: false,
      teeem_rating: null,
      supplier_code: null,
      tax_number: null,
      lgas: null,
      rating: null,
      response_rate: null,
      avg_response_time: null,
      accounts_payable_outstanding: null,
      accounts_payable_overdue: null,
    },
    {
      id: 1980,
      full_name: "WET SEAL",
      email: null,
      mobile_phone: null,
      office_phone: null,
      address: null,
      entity_type: "default_supplier",
      is_active: true,
      portal_enabled: false,
      xero_id: null,
      xero_synced: false,
      teeem_rating: null,
      supplier_code: null,
      tax_number: null,
      lgas: null,
      rating: null,
      response_rate: null,
      avg_response_time: null,
      accounts_payable_outstanding: null,
      accounts_payable_overdue: null,
    },
    {
      id: 1986,
      full_name: "TRUSSES",
      email: null,
      mobile_phone: null,
      office_phone: null,
      address: null,
      entity_type: "default_supplier",
      is_active: true,
      portal_enabled: false,
      xero_id: null,
      xero_synced: false,
      teeem_rating: null,
      supplier_code: null,
      tax_number: null,
      lgas: null,
      rating: null,
      response_rate: null,
      avg_response_time: null,
      accounts_payable_outstanding: null,
      accounts_payable_overdue: null,
    },
  ];
}
