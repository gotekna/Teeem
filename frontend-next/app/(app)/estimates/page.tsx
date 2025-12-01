"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  Download,
  Sparkles,
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Building2,
} from "lucide-react";
import { api } from "@/lib/api";

interface Estimate {
  id: number;
  estimate_number: string;
  name: string;
  job_title: string;
  job_id: number;
  supplier_name?: string;
  total_amount: number;
  status: string;
  created_at: string;
  line_items_count: number;
  po_generated: boolean;
}

interface EstimateStats {
  total: number;
  pending_review: number;
  approved: number;
  po_generated: number;
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

function getStatusBadge(status: string, poGenerated: boolean) {
  if (poGenerated) {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">PO Generated</Badge>;
  }
  switch (status?.toLowerCase()) {
    case "pending":
      return <Badge variant="secondary">Pending Review</Badge>;
    case "approved":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Approved</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function EstimatesPage() {
  const router = useRouter();
  const [estimates, setEstimates] = React.useState<Estimate[]>([]);
  const [stats, setStats] = React.useState<EstimateStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    const fetchEstimates = async () => {
      try {
        const data = await api.get<{ estimates: Estimate[]; stats: EstimateStats }>(
          "/api/v1/estimates"
        );
        setEstimates(data.estimates || []);
        setStats(data.stats || null);
      } catch (error) {
        console.error("Failed to fetch estimates:", error);
        setEstimates([]);
        setStats({
          total: 0,
          pending_review: 0,
          approved: 0,
          po_generated: 0,
          total_value: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEstimates();
  }, []);

  const filteredEstimates = React.useMemo(() => {
    if (!searchQuery) return estimates;

    return estimates.filter(
      (est) =>
        est.estimate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        est.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        est.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        est.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [estimates, searchQuery]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Estimates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and manage estimates from suppliers
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Upload Estimate
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Estimates</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.total || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Pending Review</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.pending_review || 0}</p>
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
              <CheckCircle className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">PO Generated</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.po_generated || 0}</p>
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

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search estimates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estimate #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEstimates.length > 0 ? (
              filteredEstimates.map((estimate) => (
                <TableRow
                  key={estimate.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/jobs/${estimate.job_id}?tab=estimates`)}
                >
                  <TableCell className="font-medium">{estimate.estimate_number}</TableCell>
                  <TableCell>{estimate.name}</TableCell>
                  <TableCell>
                    {estimate.supplier_name ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {estimate.supplier_name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{estimate.job_title}</TableCell>
                  <TableCell>{estimate.line_items_count} items</TableCell>
                  <TableCell>{formatCurrency(estimate.total_amount)}</TableCell>
                  <TableCell>{getStatusBadge(estimate.status, estimate.po_generated)}</TableCell>
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
                          <Sparkles className="h-4 w-4 mr-2" />
                          AI Review
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Generate POs
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No estimates found</p>
                  <Button className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Upload First Estimate
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
