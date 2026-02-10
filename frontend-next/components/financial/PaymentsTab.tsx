"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
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
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Landmark,
  Link2,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface Payment {
  id: number;
  payment_number: string;
  payment_type: string;
  type_badge: string;
  payment_date: string;
  reference: string | null;
  contact_id: number | null;
  contact_name: string | null;
  amount: number;
  allocated_amount: number;
  unallocated_amount: number;
  fully_allocated: boolean;
  gl_account_id: number | null;
  bank_account_code: string | null;
  bank_account_name: string | null;
  currency_code: string;
  status: string;
  status_badge: string;
  external_provider: string | null;
  journalized: boolean;
  created_at: string;
}

interface PaymentSummary {
  customer_payments: { count: number; total: number };
  supplier_payments: { count: number; total: number };
  refunds: { count: number; total: number };
  by_status: Record<string, number>;
}

export default function PaymentsTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("payment_type", typeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const [paymentsRes, summaryRes] = await Promise.all([
        api.get<{ success: boolean; data: Payment[] }>(`/api/v1/gl/payments?${params}`),
        api.get<{ success: boolean; data: PaymentSummary }>("/api/v1/gl/payments/summary"),
      ]);

      if (paymentsRes?.success) setPayments(paymentsRes.data || []);
      if (summaryRes?.success) setSummary(summaryRes.data || null);
    } catch (error) {
      console.error("Failed to fetch payments:", error);
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

  const handleComplete = async (payment: Payment) => {
    try {
      await api.post(`/api/v1/gl/payments/${payment.id}/complete`);
      fetchData();
    } catch (error) {
      console.error("Failed to complete payment:", error);
    }
  };

  const handleVoid = async (payment: Payment) => {
    try {
      await api.post(`/api/v1/gl/payments/${payment.id}/void`);
      fetchData();
    } catch (error) {
      console.error("Failed to void payment:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-status-warning text-status-warning-foreground dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "voided":
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            Voided
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "customer":
      case "receive":
        return (
          <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
            <ArrowDownLeft className="h-3 w-3 mr-1" />
            Received
          </Badge>
        );
      case "supplier":
      case "spend":
        return (
          <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 dark:bg-orange-900/30 dark:text-orange-400">
            <ArrowUpRight className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "refund":
        return (
          <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 dark:bg-purple-900/30 dark:text-purple-400">
            <RotateCcw className="h-3 w-3 mr-1" />
            Refund
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
              Customer Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(summary?.customer_payments?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.customer_payments?.count || 0} payments received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              Supplier Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(summary?.supplier_payments?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.supplier_payments?.count || 0} payments made
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              Refunds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(summary?.refunds?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.refunds?.count || 0} refunds processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Cash Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                (summary?.customer_payments?.total || 0) -
                (summary?.supplier_payments?.total || 0) -
                (summary?.refunds?.total || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">received - paid - refunds</p>
          </CardContent>
        </Card>
      </div>

      {/* Payments List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payments
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
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
          {payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No payments found</p>
              <p className="text-sm mt-1">Payments will appear here once recorded</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Allocated</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.payment_number}</TableCell>
                    <TableCell>{getTypeBadge(payment.payment_type)}</TableCell>
                    <TableCell>
                      {payment.contact_name ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{payment.contact_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(payment.payment_date)}</TableCell>
                    <TableCell>
                      {payment.bank_account_name ? (
                        <div className="flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{payment.bank_account_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {payment.fully_allocated ? (
                        <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
                          <Link2 className="h-3 w-3 mr-1" />
                          Full
                        </Badge>
                      ) : payment.allocated_amount > 0 ? (
                        <Badge className="bg-status-warning text-status-warning-foreground dark:bg-yellow-900/30 dark:text-yellow-400">
                          Partial
                        </Badge>
                      ) : (
                        <Badge variant="outline">Unallocated</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(payment.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {payment.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleComplete(payment)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        {payment.status !== "voided" && payment.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVoid(payment)}
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
