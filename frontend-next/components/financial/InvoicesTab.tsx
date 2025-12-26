"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
  FileText,
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  DollarSign,
  Send,
  Ban,
} from "lucide-react";
import { api } from "@/lib/api";

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_type: string;
  type_badge: string;
  reference: string | null;
  invoice_date: string;
  due_date: string;
  contact_id: number | null;
  contact_name: string | null;
  job_id: number | null;
  job_name: string | null;
  subtotal: number;
  total_tax: number;
  total: number;
  amount_due: number;
  amount_paid: number;
  currency_code: string;
  status: string;
  status_badge: string;
  overdue: boolean;
  days_overdue: number;
  external_provider: string | null;
  journalized: boolean;
  created_at: string;
}

interface InvoiceSummary {
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  totals: {
    sales_invoices: {
      count: number;
      total: number;
      due: number;
      overdue: number;
    };
    bills: {
      count: number;
      total: number;
      due: number;
      overdue: number;
    };
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

export default function InvoicesTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("invoice_type", typeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const [invoicesRes, summaryRes] = await Promise.all([
        api.get<{ success: boolean; data: Invoice[] }>(`/api/v1/gl/invoices?${params}`),
        api.get<{ success: boolean; data: InvoiceSummary }>("/api/v1/gl/invoices/summary"),
      ]);

      if (invoicesRes?.success) setInvoices(invoicesRes.data || []);
      if (summaryRes?.success) setSummary(summaryRes.data || null);
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleApprove = async (invoice: Invoice) => {
    try {
      await api.post(`/api/v1/gl/invoices/${invoice.id}/approve`);
      fetchData();
    } catch (error) {
      console.error("Failed to approve invoice:", error);
    }
  };

  const handleVoid = async (invoice: Invoice) => {
    try {
      await api.post(`/api/v1/gl/invoices/${invoice.id}/void`);
      fetchData();
    } catch (error) {
      console.error("Failed to void invoice:", error);
    }
  };

  const getStatusBadge = (invoice: Invoice) => {
    if (invoice.overdue) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Overdue ({invoice.days_overdue}d)
        </Badge>
      );
    }

    switch (invoice.status) {
      case "draft":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case "submitted":
      case "sent":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <Send className="h-3 w-3 mr-1" />
            Sent
          </Badge>
        );
      case "authorised":
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "paid":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            <DollarSign className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "voided":
        return (
          <Badge variant="secondary">
            <Ban className="h-3 w-3 mr-1" />
            Voided
          </Badge>
        );
      default:
        return <Badge variant="outline">{invoice.status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "sales":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <FileText className="h-3 w-3 mr-1" />
            Sales
          </Badge>
        );
      case "bill":
        return (
          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
            <Receipt className="h-3 w-3 mr-1" />
            Bill
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Sales Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totals?.sales_invoices?.count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(summary?.totals?.sales_invoices?.total || 0)} total
            </p>
            {(summary?.totals?.sales_invoices?.overdue || 0) > 0 && (
              <p className="text-xs text-red-600 mt-1">
                {formatCurrency(summary.totals.sales_invoices.overdue)} overdue
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totals?.bills?.count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(summary?.totals?.bills?.total || 0)} total
            </p>
            {(summary?.totals?.bills?.overdue || 0) > 0 && (
              <p className="text-xs text-red-600 mt-1">
                {formatCurrency(summary.totals.bills.overdue)} overdue
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receivable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.totals?.sales_invoices?.due || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">amount due from customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Payable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(summary?.totals?.bills?.due || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">amount owed to suppliers</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoices & Bills
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="bill">Bills</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="authorised">Authorised</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No invoices found</p>
              <p className="text-sm mt-1">Invoices will appear here once synced</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id} className={invoice.overdue ? "bg-red-50 dark:bg-red-900/10" : ""}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{getTypeBadge(invoice.invoice_type)}</TableCell>
                    <TableCell>
                      {invoice.contact_name ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{invoice.contact_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                    <TableCell>
                      <span className={invoice.overdue ? "text-red-600 font-medium" : ""}>
                        {formatDate(invoice.due_date)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.amount_due > 0 ? (
                        <span className={invoice.overdue ? "text-red-600 font-medium" : ""}>
                          {formatCurrency(invoice.amount_due)}
                        </span>
                      ) : (
                        <span className="text-green-600">Paid</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(invoice)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {invoice.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(invoice)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        )}
                        {invoice.status !== "voided" && invoice.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVoid(invoice)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
