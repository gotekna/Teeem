"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Ticket,
  AlertTriangle,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { TASK_STATUS } from "@/lib/constants/task-status";
import { TablePage } from "@/components/ui/page-wrappers";
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

interface SupportTicket {
  id: number;
  task_number: number;
  name: string;
  description: string | null;
  status: string;
  ticket_priority: string;
  ticket_category: string;
  customer_visible: boolean;
  submitted_via_portal: boolean;
  created_at: string;
  updated_at: string;
  customer: { id: number; name: string } | null;
  assigned_to: { id: number; name: string } | null;
  sla_status: string;
}

interface DashboardData {
  total_open: number;
  total_today: number;
  by_priority: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  by_category: Record<string, number>;
  by_status: Record<string, number>;
  sla_breached: number;
  sla_at_risk: number;
  avg_resolution_time: number | null;
  recent_tickets: SupportTicket[];
}

export default function SupportTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [slaFilter, setSlaFilter] = useState<string>("all");
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      if (slaFilter !== "all") params.append("sla_status", slaFilter);

      const [ticketsRes, dashboardRes] = await Promise.all([
        api.get<{ success: boolean; data: SupportTicket[] }>(
          `/api/v1/support_tickets?${params.toString()}`
        ),
        api.get<{ success: boolean; data: DashboardData }>(
          "/api/v1/support_tickets/dashboard"
        ),
      ]);

      if (ticketsRes?.success) setTickets(ticketsRes.data);
      if (dashboardRes?.success) setDashboard(dashboardRes.data);
      setError(null);
    } catch (err) {
      console.error("Failed to load tickets:", err);
      setError("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, slaFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      urgent: { variant: "destructive" },
      high: { variant: "destructive", className: "bg-orange-500" },
      medium: { variant: "secondary" },
      low: { variant: "outline" },
    };
    const { variant, className } = config[priority] || { variant: "outline" };
    return <Badge variant={variant} className={className}>{priority}</Badge>;
  };

  const getSlaStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon?: React.ReactNode }> = {
      on_track: { variant: "default", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      at_risk: { variant: "secondary", icon: <AlertCircle className="h-3 w-3 mr-1" /> },
      breached: { variant: "destructive", icon: <AlertTriangle className="h-3 w-3 mr-1" /> },
      completed: { variant: "outline", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      "n/a": { variant: "outline" },
    };
    const { variant, icon } = config[status] || { variant: "outline" };
    return (
      <Badge variant={variant} className="flex items-center">
        {icon}
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      not_started: "outline",
      started: "secondary",
      completed: "default",
    };
    return <Badge variant={variants[status] || "outline"}>{status.replace("_", " ")}</Badge>;
  };

  const formatDuration = (hours: number | null) => {
    if (hours === null) return "N/A";
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading tickets...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive">{error}</div>
        <Button onClick={loadData} variant="outline" className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <TablePage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Support Tickets</h1>
            <p className="text-muted-foreground">
              Manage customer support requests and track SLA compliance
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </div>
        </div>

        {/* Dashboard Stats */}
        {dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Ticket className="h-4 w-4" />
                  Open Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.total_open}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  +{dashboard.total_today}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  SLA Breached
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  dashboard.sla_breached > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                }`}>
                  {dashboard.sla_breached}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  At Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  dashboard.sla_at_risk > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"
                }`}>
                  {dashboard.sla_at_risk}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Avg Resolution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(dashboard.avg_resolution_time)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  By Priority
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 text-xs">
                  <span className="text-red-600 dark:text-red-400">U:{dashboard.by_priority.urgent}</span>
                  <span className="text-orange-600 dark:text-orange-400">H:{dashboard.by_priority.high}</span>
                  <span className="text-yellow-600 dark:text-yellow-400">M:{dashboard.by_priority.medium}</span>
                  <span className="text-gray-600 dark:text-gray-400">L:{dashboard.by_priority.low}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value={TASK_STATUS.NOT_STARTED}>Not Started</SelectItem>
              <SelectItem value={TASK_STATUS.STARTED}>In Progress</SelectItem>
              <SelectItem value={TASK_STATUS.COMPLETED}>Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={slaFilter} onValueChange={setSlaFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="SLA Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SLA</SelectItem>
              <SelectItem value="breached">Breached</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tickets Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets ({tickets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No tickets found
                    </TableCell>
                  </TableRow>
                ) : (
                  tickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/admin/support-tickets/${ticket.id}`)}
                    >
                      <TableCell className="font-mono">#{ticket.task_number}</TableCell>
                      <TableCell className="font-medium max-w-xs truncate">
                        {ticket.name}
                        {ticket.submitted_via_portal && (
                          <Badge variant="outline" className="ml-2 text-xs">Portal</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {ticket.customer?.name || (
                          <span className="text-muted-foreground">Internal</span>
                        )}
                      </TableCell>
                      <TableCell>{getPriorityBadge(ticket.ticket_priority)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ticket.ticket_category || "other"}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                      <TableCell>{getSlaStatusBadge(ticket.sla_status)}</TableCell>
                      <TableCell>
                        {ticket.assigned_to?.name || (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString("en-AU")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TablePage>
  );
}
