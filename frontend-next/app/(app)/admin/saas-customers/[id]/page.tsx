"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import {
  DollarSign,
  TrendingUp,
  Clock,
  Ticket,
  Users,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatPercentageWithFallback } from "@/utils/formatters";

interface SaasCustomer {
  id: number;
  name: string;
  display_name: string;
  annual_turnover: number | null;
  saas_status: string;
  saas_started_at: string | null;
  saas_churned_at: string | null;
  monthly_fee: number;
  annual_fee: number;
  effective_rate: number | null;
  support_contact: { id: number; name: string } | null;
  upline_contact: { id: number; name: string } | null;
  cost_to_serve: number;
  tickets_count: number;
  open_tickets_count: number;
  billing_records_count: number;
  last_billing: string | null;
  tier_breakdown: Array<{ tier: number; turnover: number; rate: number; cost: number }>;
}

interface ProfitabilityData {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

interface BillingRecord {
  id: number;
  billing_period_start: string;
  billing_period_end: string;
  turnover_reported: number;
  fee_calculated: number;
  effective_rate: number;
  status: string;
  invoice_id: number | null;
  invoice_number: string | null;
  created_at: string;
}

interface Ticket {
  id: number;
  task_number: number;
  name: string;
  status: string;
  ticket_priority: string;
  ticket_category: string;
  sla_status: string;
  created_at: string;
}

export default function SaasCustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const customerId = params.id as string;

  // Path-based tab navigation
  const activeTab = useMemo(() => {
    const parts = pathname.replace(`/admin/saas-customers/${customerId}`, "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname, customerId]);

  useEffect(() => {
    if (activeTab === null) {
      router.replace(`/admin/saas-customers/${customerId}/billing`, { scroll: false });
    }
  }, [activeTab, router, customerId]);

  const setActiveTab = useCallback((tab: string) => {
    router.push(`/admin/saas-customers/${customerId}/${tab}`, { scroll: false });
  }, [router, customerId]);

  const [customer, setCustomer] = useState<SaasCustomer | null>(null);
  const [profitability, setProfitability] = useState<ProfitabilityData | null>(null);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [customerRes, profitRes, billingRes, ticketsRes] = await Promise.all([
        api.get<{ success: boolean; data: SaasCustomer }>(`/api/v1/saas_customers/${customerId}`),
        api.get<{ success: boolean; data: ProfitabilityData }>(`/api/v1/saas_customers/${customerId}/profitability`),
        api.get<{ success: boolean; data: BillingRecord[] }>(`/api/v1/saas_customers/${customerId}/billing_history`),
        api.get<{ success: boolean; data: Ticket[] }>(`/api/v1/support_tickets/for_customer/${customerId}`),
      ]);

      if (customerRes?.success) setCustomer(customerRes.data);
      if (profitRes?.success) setProfitability(profitRes.data);
      if (billingRes?.success) setBillingRecords(billingRes.data);
      if (ticketsRes?.success) setTickets(ticketsRes.data);
      setError(null);
    } catch (err) {
      console.error("Failed to load customer data:", err);
      setError("Failed to load customer data");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trial: "secondary",
      suspended: "destructive",
      churned: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      urgent: "destructive",
      high: "destructive",
      medium: "secondary",
      low: "outline",
    };
    return <Badge variant={variants[priority] || "outline"}>{priority}</Badge>;
  };

  const getSlaStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      on_track: "default",
      at_risk: "secondary",
      breached: "destructive",
      completed: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status.replace("_", " ")}</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive">{error || "Customer not found"}</div>
        <BackButton fallbackHref="/admin/saas-customers" label="Go Back" className="mt-4" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/admin" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{customer.display_name || customer.name}</h1>
              {getStatusBadge(customer.saas_status)}
            </div>
            <p className="text-muted-foreground">
              Customer since {customer.saas_started_at
                ? new Date(customer.saas_started_at).toLocaleDateString("en-AU", {
                    year: "numeric",
                    month: "long",
                  })
                : "Unknown"}
            </p>
          </div>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Monthly Fee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(customer.monthly_fee)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(customer.annual_fee)}/year
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Cost to Serve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(customer.cost_to_serve)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Time spent supporting
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              profitability && profitability.margin > 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {profitability ? formatPercentageWithFallback(profitability.margin, "N/A", 2) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Profit: {profitability ? formatCurrency(profitability.profit) : "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Open Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              customer.open_tickets_count > 0
                ? "text-orange-600 dark:text-orange-400"
                : "text-green-600 dark:text-green-400"
            }`}>
              {customer.open_tickets_count}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {customer.tickets_count} total tickets
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Support Network */}
      {(customer.support_contact || customer.upline_contact) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Support Network
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">L1 Support (20%)</p>
                <p className="font-medium">
                  {customer.support_contact?.name || (
                    <span className="text-muted-foreground">Not assigned</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">L2 Upline (10%)</p>
                <p className="font-medium">
                  {customer.upline_contact?.name || (
                    <span className="text-muted-foreground">Not assigned</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab || "billing"} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="billing">Billing History</TabsTrigger>
          <TabsTrigger value="tickets">
            Tickets
            {customer.open_tickets_count > 0 && (
              <Badge variant="destructive" className="ml-2">
                {customer.open_tickets_count}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pricing">Pricing Tiers</TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>
                Monthly billing records and invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Turnover</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billingRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No billing records yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    billingRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {new Date(record.billing_period_start).toLocaleDateString("en-AU", {
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(record.turnover_reported)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(record.fee_calculated)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercentageWithFallback(record.effective_rate, "0%", 2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={record.status === "paid" ? "default" : "secondary"}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.invoice_number || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Support Tickets</CardTitle>
              <CardDescription>
                Customer support requests and issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No tickets yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    tickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono">#{ticket.task_number}</TableCell>
                        <TableCell className="font-medium">{ticket.name}</TableCell>
                        <TableCell>{getPriorityBadge(ticket.ticket_priority)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ticket.ticket_category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ticket.status === "completed" ? "default" : "secondary"}>
                            {ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{getSlaStatusBadge(ticket.sla_status)}</TableCell>
                        <TableCell>
                          {new Date(ticket.created_at).toLocaleDateString("en-AU")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Tier Breakdown</CardTitle>
              <CardDescription>
                How the fee is calculated based on annual turnover of {formatCurrency(customer.annual_turnover)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {customer.tier_breakdown && customer.tier_breakdown.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Turnover in Tier</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.tier_breakdown.map((tier, index) => (
                      <TableRow key={index}>
                        <TableCell>Tier {tier.tier}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(tier.turnover)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercentageWithFallback(tier.rate, "0%", 2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(tier.cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={3}>Total Annual Fee</TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400">
                        {formatCurrency(customer.annual_fee)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No turnover data available for tier calculation
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
