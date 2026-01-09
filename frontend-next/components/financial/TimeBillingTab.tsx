"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  RefreshCw,
  Clock,
  DollarSign,
  User,
  Briefcase,
  CheckCircle,
  XCircle,
  FileText,
  AlertCircle,
  Timer,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";

interface BillableRate {
  id: number;
  rate_type: "user" | "role" | "job" | "default";
  role_name: string | null;
  user: { id: number; name: string } | null;
  job: { id: number; name: string } | null;
  contact: { id: number; name: string } | null;
  hourly_rate: number;
  overtime_rate: number | null;
  weekend_rate: number | null;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
}

interface TimeEntry {
  id: number;
  user: { id: number; name: string };
  job: { id: number; name: string } | null;
  entry_date: string;
  hours: number;
  billable_hours: number;
  hourly_rate: number;
  amount: number;
  description: string;
  task_type: string | null;
  status: "draft" | "pending_approval" | "approved" | "billed";
  billable: boolean;
}

interface TimeBatch {
  id: number;
  contact: { id: number; name: string };
  job: { id: number; name: string } | null;
  period_start: string;
  period_end: string;
  total_hours: number;
  total_amount: number;
  status: "draft" | "approved" | "invoiced";
  invoice: { id: number; invoice_number: string } | null;
}

interface TimeSummary {
  period: { start: string; end: string };
  by_status: {
    unbilled: number;
    pending: number;
    approved: number;
    billed: number;
  };
  totals: {
    total_hours: number;
    total_amount: number;
    billable_amount: number;
  };
}

interface UnbilledData {
  entries: TimeEntry[];
  totals: {
    total_hours: number;
    total_amount: number;
    entry_count: number;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export default function TimeBillingTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("entries");
  const [rates, setRates] = useState<BillableRate[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [batches, setBatches] = useState<TimeBatch[]>([]);
  const [summary, setSummary] = useState<TimeSummary | null>(null);
  const [unbilled, setUnbilled] = useState<UnbilledData | null>(null);
  const [entryFilter, setEntryFilter] = useState<"all" | "pending_approval" | "approved" | "billed">("all");

  const fetchData = useCallback(async () => {
    try {
      const statusParam = entryFilter === "all" ? "" : `?status=${entryFilter}`;
      const [ratesRes, entriesRes, batchesRes, summaryRes, unbilledRes] = await Promise.all([
        api.get<{ success: boolean; data: BillableRate[] }>("/api/v1/gl/time_billing/rates"),
        api.get<{ success: boolean; data: TimeEntry[] }>(`/api/v1/gl/time_billing/entries${statusParam}`),
        api.get<{ success: boolean; data: TimeBatch[] }>("/api/v1/gl/time_billing/batches"),
        api.get<{ success: boolean; data: TimeSummary }>("/api/v1/gl/time_billing/summary"),
        api.get<{ success: boolean; data: UnbilledData }>("/api/v1/gl/time_billing/unbilled"),
      ]);

      if (ratesRes?.success) setRates(ratesRes.data || []);
      if (entriesRes?.success) setEntries(entriesRes.data || []);
      if (batchesRes?.success) setBatches(batchesRes.data || []);
      if (summaryRes?.success) setSummary(summaryRes.data);
      if (unbilledRes?.success) setUnbilled(unbilledRes.data);
    } catch (error) {
      console.error("Failed to fetch time billing data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [entryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleApproveEntry = async (entry: TimeEntry) => {
    try {
      await api.post(`/api/v1/gl/time_billing/entries/${entry.id}/approve`);
      fetchData();
    } catch (error) {
      console.error("Failed to approve entry:", error);
    }
  };

  const handleApproveBatch = async (batch: TimeBatch) => {
    try {
      await api.post(`/api/v1/gl/time_billing/batches/${batch.id}/approve`);
      fetchData();
    } catch (error) {
      console.error("Failed to approve batch:", error);
    }
  };

  const handleGenerateInvoice = async (batch: TimeBatch) => {
    try {
      await api.post(`/api/v1/gl/time_billing/batches/${batch.id}/generate_invoice`);
      fetchData();
    } catch (error) {
      console.error("Failed to generate invoice:", error);
    }
  };

  const getEntryStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" />Draft</Badge>;
      case "pending_approval":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "billed":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><DollarSign className="h-3 w-3 mr-1" />Billed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getBatchStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Approved</Badge>;
      case "invoiced":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Invoiced</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Total Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatHours(summary.totals.total_hours)}</div>
              <p className="text-xs text-muted-foreground mt-1">this period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totals.total_amount)}</div>
              <p className="text-xs text-muted-foreground mt-1">billable time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                Unbilled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(summary.by_status.unbilled)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">ready to bill</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(summary.by_status.pending)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Billed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.by_status.billed)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">invoiced</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unbilled Summary */}
      {unbilled && unbilled.totals.entry_count > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-4 w-4" />
              Unbilled Time Ready to Invoice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div>
                <span className="text-2xl font-bold">{unbilled.totals.entry_count}</span>
                <span className="text-muted-foreground ml-2">entries</span>
              </div>
              <div>
                <span className="text-2xl font-bold">{formatHours(unbilled.totals.total_hours)}</span>
                <span className="text-muted-foreground ml-2">hours</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-green-600">{formatCurrency(unbilled.totals.total_amount)}</span>
                <span className="text-muted-foreground ml-2">value</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Billing
          </CardTitle>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="entries" className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Time Entries
              </TabsTrigger>
              <TabsTrigger value="rates" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Billable Rates
              </TabsTrigger>
              <TabsTrigger value="batches" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Billing Batches
              </TabsTrigger>
            </TabsList>

            {/* Time Entries Tab */}
            <TabsContent value="entries" className="mt-4">
              <div className="flex justify-end mb-4">
                <Select value={entryFilter} onValueChange={(v) => setEntryFilter(v as typeof entryFilter)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending_approval">Pending Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="billed">Billed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {entries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Timer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No time entries found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.entry_date)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {entry.user?.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.job ? (
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                              {entry.job.name}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={entry.description}>
                          {entry.description || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatHours(entry.billable_hours)}
                          {!entry.billable && (
                            <Badge variant="outline" className="ml-2 text-xs">Non-billable</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.hourly_rate)}/h</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(entry.amount)}</TableCell>
                        <TableCell>{getEntryStatusBadge(entry.status)}</TableCell>
                        <TableCell className="text-right">
                          {entry.status === "pending_approval" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveEntry(entry)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Billable Rates Tab */}
            <TabsContent value="rates" className="mt-4">
              {rates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No billable rates configured</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>User / Role</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Hourly Rate</TableHead>
                      <TableHead className="text-right">Overtime</TableHead>
                      <TableHead className="text-right">Weekend</TableHead>
                      <TableHead>Effective</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((rate) => (
                      <TableRow key={rate.id}>
                        <TableCell>
                          <Badge variant="outline">{rate.rate_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {rate.user ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {rate.user.name}
                            </div>
                          ) : rate.role_name ? (
                            <span>{rate.role_name}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {rate.job ? (
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                              {rate.job.name}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">All</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {rate.contact?.name || <span className="text-muted-foreground">All</span>}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(rate.hourly_rate)}</TableCell>
                        <TableCell className="text-right">
                          {rate.overtime_rate ? formatCurrency(rate.overtime_rate) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {rate.weekend_rate ? formatCurrency(rate.weekend_rate) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            From {formatDate(rate.effective_from)}
                          </div>
                          {rate.effective_to && (
                            <div className="text-xs text-muted-foreground">
                              to {formatDate(rate.effective_to)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {rate.active ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Billing Batches Tab */}
            <TabsContent value="batches" className="mt-4">
              {batches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No billing batches found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.contact?.name}</TableCell>
                        <TableCell>
                          {batch.job ? (
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                              {batch.job.name}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">All</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDate(batch.period_start)} - {formatDate(batch.period_end)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatHours(batch.total_hours)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(batch.total_amount)}</TableCell>
                        <TableCell>{getBatchStatusBadge(batch.status)}</TableCell>
                        <TableCell>
                          {batch.invoice ? (
                            <Badge variant="outline">{batch.invoice.invoice_number}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {batch.status === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveBatch(batch)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          )}
                          {batch.status === "approved" && !batch.invoice && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleGenerateInvoice(batch)}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Invoice
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
