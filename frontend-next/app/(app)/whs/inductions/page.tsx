"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Plus,
  Search,
  ArrowLeft,
  Loader2,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Building2,
  Mail,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";

interface Induction {
  id: number;
  worker_name: string;
  worker_email?: string;
  company_name?: string;
  job_id: number;
  job_title: string;
  template_name: string;
  status: "pending" | "completed" | "expired";
  inducted_at?: string;
  expires_at?: string;
  inducted_by?: string;
  score?: number;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
    case "pending":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "expired":
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Expired</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function WHSInductionsPage() {
  const [inductions, setInductions] = React.useState<Induction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  React.useEffect(() => {
    const fetchInductions = async () => {
      try {
        const response = await api.get<{ inductions: Induction[] }>("/api/v1/whs/inductions");
        setInductions(response.inductions || []);
      } catch (error) {
        // Mock data
        setInductions([
          {
            id: 1,
            worker_name: "James Wilson",
            worker_email: "james.wilson@buildco.com",
            company_name: "BuildCo Contractors",
            job_id: 42,
            job_title: "Smith Residence - Foundation",
            template_name: "General Site Induction",
            status: "completed",
            inducted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() + 360 * 24 * 60 * 60 * 1000).toISOString(),
            inducted_by: "Sarah Wilson",
            score: 95,
          },
          {
            id: 2,
            worker_name: "Mark Thompson",
            worker_email: "mark@steelworks.com",
            company_name: "SteelWorks Ltd",
            job_id: 42,
            job_title: "Smith Residence - Foundation",
            template_name: "General Site Induction",
            status: "pending",
          },
          {
            id: 3,
            worker_name: "Lisa Chen",
            worker_email: "lisa.chen@electrical.com",
            company_name: "Premier Electrical",
            job_id: 67,
            job_title: "Commercial Fitout - Level 3",
            template_name: "Electrical Safety Induction",
            status: "completed",
            inducted_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
            inducted_by: "Mike Johnson",
            score: 100,
          },
          {
            id: 4,
            worker_name: "Tom Bradley",
            worker_email: "tom@concrete.com",
            company_name: "Concrete Solutions",
            job_id: 42,
            job_title: "Smith Residence - Foundation",
            template_name: "General Site Induction",
            status: "expired",
            inducted_at: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
            inducted_by: "David Brown",
            score: 88,
          },
          {
            id: 5,
            worker_name: "Sophie Adams",
            company_name: "Paint Pro",
            job_id: 67,
            job_title: "Commercial Fitout - Level 3",
            template_name: "General Site Induction",
            status: "pending",
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchInductions();
  }, []);

  const filteredInductions = inductions.filter((induction) => {
    const matchesSearch =
      induction.worker_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      induction.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      induction.job_title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || induction.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: inductions.length,
    completed: inductions.filter((i) => i.status === "completed").length,
    pending: inductions.filter((i) => i.status === "pending").length,
    expired: inductions.filter((i) => i.status === "expired").length,
  };

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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/whs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Site Inductions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage worker inductions and site access
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Mail className="h-4 w-4 mr-2" />
            Send Reminders
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Induction
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Workers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-sm text-muted-foreground">Inducted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
            <p className="text-sm text-muted-foreground">Expired</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inductions Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Job Site</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInductions.length > 0 ? (
              filteredInductions.map((induction) => (
                <TableRow key={induction.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{getInitials(induction.worker_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{induction.worker_name}</p>
                        {induction.worker_email && (
                          <p className="text-xs text-muted-foreground">{induction.worker_email}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {induction.company_name ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {induction.company_name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{induction.job_title}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{induction.template_name}</p>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {getStatusBadge(induction.status)}
                      {induction.inducted_at && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(induction.inducted_at).toLocaleDateString("en-AU")}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {induction.status === "pending" ? (
                      <Button size="sm">Start Induction</Button>
                    ) : induction.status === "expired" ? (
                      <Button size="sm" variant="outline">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Re-induct
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm">View</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No inductions found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
