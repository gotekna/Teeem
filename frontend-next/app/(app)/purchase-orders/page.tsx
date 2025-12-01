"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  MoreHorizontal,
  FileText,
  Send,
  CheckCircle,
  Clock,
  DollarSign,
  ShoppingCart,
  Building2,
  Loader2,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_name: string;
  job_title: string;
  job_id: number;
  total_amount: number;
  status: string;
  created_at: string;
  sent_at?: string;
  approved_at?: string;
  approved_by?: string;
}

interface POStats {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  sent: number;
  total_value: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusBadge(status: string) {
  switch (status?.toLowerCase()) {
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    case "pending":
      return <Badge variant="secondary">Pending Approval</Badge>;
    case "approved":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
    case "sent":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Sent</Badge>;
    case "received":
      return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Received</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>([]);
  const [stats, setStats] = React.useState<POStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchPurchaseOrders = async () => {
      try {
        const data = await api.get<{ purchase_orders: PurchaseOrder[]; stats: POStats }>(
          "/api/v1/purchase_orders"
        );
        setPurchaseOrders(data.purchase_orders || []);
        setStats(data.stats || null);
      } catch (error) {
        console.error("Failed to fetch purchase orders:", error);
        // Mock data for development
        setPurchaseOrders([]);
        setStats({
          total: 0,
          draft: 0,
          pending: 0,
          approved: 0,
          sent: 0,
          total_value: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPurchaseOrders();
  }, []);

  const filteredPOs = React.useMemo(() => {
    return purchaseOrders.filter((po) => {
      const matchesSearch =
        !searchQuery ||
        po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.job_title.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = !statusFilter || po.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Purchase Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage purchase orders across all jobs
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total POs</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.total || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Draft</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.draft || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.pending || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Approved</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.approved || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Value</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(stats?.total_value || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search POs, suppliers, jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  {statusFilter || "All Status"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                  All Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("draft")}>
                  Draft
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>
                  Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("approved")}>
                  Approved
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("sent")}>
                  Sent
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPOs.length > 0 ? (
              filteredPOs.map((po) => (
                <TableRow
                  key={po.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/jobs/${po.job_id}?tab=purchase-orders`)}
                >
                  <TableCell className="font-medium">{po.po_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {po.supplier_name}
                    </div>
                  </TableCell>
                  <TableCell>{po.job_title}</TableCell>
                  <TableCell>{formatCurrency(po.total_amount)}</TableCell>
                  <TableCell>{getStatusBadge(po.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(po.created_at).toLocaleDateString("en-AU")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Send className="h-4 w-4 mr-2" />
                          Send to Supplier
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No purchase orders found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
