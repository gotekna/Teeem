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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  FileQuestion,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Users,
  MoreHorizontal,
  Eye,
  Check,
  X,
  Send,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";

interface QuoteRequest {
  id: number;
  title: string;
  description: string;
  job_id: number;
  job_name: string;
  status: "draft" | "sent" | "responded" | "accepted" | "rejected" | "expired";
  suppliers_count: number;
  responses_count: number;
  due_date: string;
  budget_estimate: number | null;
  created_at: string;
  accepted_quote_id: number | null;
  accepted_supplier_name: string | null;
  accepted_amount: number | null;
  category: string;
}

interface QuoteResponse {
  id: number;
  quote_request_id: number;
  supplier_id: number;
  supplier_name: string;
  amount: number;
  notes: string;
  submitted_at: string;
  status: "pending" | "accepted" | "rejected";
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  responded: "bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500",
  accepted: "bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400",
  expired: "bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400",
};

export default function QuoteRequestsPage() {
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const response = await api.get<{ quote_requests: QuoteRequest[] }>("/api/v1/quote_requests");
        setRequests(response.quote_requests || []);
      } catch (error) {
        console.error("Failed to load quote requests:", error);
        setRequests(getMockRequests());
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "sent" || r.status === "responded").length,
    accepted: requests.filter((r) => r.status === "accepted").length,
    totalSavings: requests
      .filter((r) => r.status === "accepted" && r.budget_estimate && r.accepted_amount)
      .reduce((sum, r) => sum + ((r.budget_estimate || 0) - (r.accepted_amount || 0)), 0),
  };

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.job_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "pending" && (request.status === "sent" || request.status === "responded")) ||
      (activeTab === "accepted" && request.status === "accepted") ||
      (activeTab === "draft" && request.status === "draft");
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
          <h1 className="text-2xl font-bold tracking-tight font-serif">Quote Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Request and compare quotes from suppliers
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Quote Request
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Total Requests</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2 text-yellow-600">
              {stats.pending}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Accepted</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2 text-green-600">
              {stats.accepted}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Total Savings</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2 text-green-600">
              ${stats.totalSavings.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Search */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Requests</TabsTrigger>
            <TabsTrigger value="pending">
              Pending
              {stats.pending > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="draft">Drafts</TabsTrigger>
          </TabsList>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px]"
            />
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Responses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Budget / Accepted</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <Link
                          href={`/quote-requests/${request.id}`}
                          className="font-medium hover:underline"
                        >
                          {request.title}
                        </Link>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {request.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/jobs/${request.job_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {request.job_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{request.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          new Date(request.due_date) < new Date() && request.status === "sent"
                            ? "text-red-600"
                            : ""
                        }
                      >
                        {new Date(request.due_date).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {request.responses_count} / {request.suppliers_count}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[request.status]}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        {request.budget_estimate && (
                          <div className="text-muted-foreground text-sm">
                            Budget: ${request.budget_estimate.toLocaleString()}
                          </div>
                        )}
                        {request.accepted_amount && (
                          <div className="font-mono font-medium text-green-600">
                            ${request.accepted_amount.toLocaleString()}
                          </div>
                        )}
                        {request.accepted_supplier_name && (
                          <div className="text-xs text-muted-foreground">
                            {request.accepted_supplier_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {request.status === "draft" && (
                            <DropdownMenuItem>
                              <Send className="h-4 w-4 mr-2" />
                              Send to Suppliers
                            </DropdownMenuItem>
                          )}
                          {request.status === "responded" && (
                            <>
                              <DropdownMenuItem>
                                <Check className="h-4 w-4 mr-2" />
                                Accept Quote
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <FileText className="h-4 w-4 mr-2" />
                                Convert to PO
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem className="text-destructive">
                            <X className="h-4 w-4 mr-2" />
                            Cancel Request
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getMockRequests(): QuoteRequest[] {
  return [
    {
      id: 1,
      title: "Structural Steel for 2nd Floor",
      description: "200UB beams and columns for second floor structure",
      job_id: 1,
      job_name: "Harrison Residence",
      status: "responded",
      suppliers_count: 3,
      responses_count: 2,
      due_date: "2024-12-05",
      budget_estimate: 45000,
      created_at: "2024-11-20",
      accepted_quote_id: null,
      accepted_supplier_name: null,
      accepted_amount: null,
      category: "Steel",
    },
    {
      id: 2,
      title: "Concrete for Slab Pour",
      description: "N25 concrete for ground floor slab - 85m3 required",
      job_id: 2,
      job_name: "Coastal Views Duplex",
      status: "accepted",
      suppliers_count: 2,
      responses_count: 2,
      due_date: "2024-11-25",
      budget_estimate: 25000,
      created_at: "2024-11-15",
      accepted_quote_id: 5,
      accepted_supplier_name: "Hanson Concrete",
      accepted_amount: 22500,
      category: "Concrete",
    },
    {
      id: 3,
      title: "Roofing Materials",
      description: "Colorbond roofing sheets and flashings",
      job_id: 1,
      job_name: "Harrison Residence",
      status: "sent",
      suppliers_count: 4,
      responses_count: 1,
      due_date: "2024-12-10",
      budget_estimate: 18000,
      created_at: "2024-11-28",
      accepted_quote_id: null,
      accepted_supplier_name: null,
      accepted_amount: null,
      category: "Roofing",
    },
    {
      id: 4,
      title: "Electrical First Fix",
      description: "Complete electrical rough-in for single story home",
      job_id: 3,
      job_name: "Thompson Family Home",
      status: "accepted",
      suppliers_count: 3,
      responses_count: 3,
      due_date: "2024-11-20",
      budget_estimate: 12000,
      created_at: "2024-11-10",
      accepted_quote_id: 8,
      accepted_supplier_name: "L&H Electrical",
      accepted_amount: 10500,
      category: "Electrical",
    },
    {
      id: 5,
      title: "Kitchen Cabinetry",
      description: "Custom kitchen cabinets and island bench",
      job_id: 1,
      job_name: "Harrison Residence",
      status: "draft",
      suppliers_count: 0,
      responses_count: 0,
      due_date: "2024-12-15",
      budget_estimate: 35000,
      created_at: "2024-11-29",
      accepted_quote_id: null,
      accepted_supplier_name: null,
      accepted_amount: null,
      category: "Joinery",
    },
  ];
}
