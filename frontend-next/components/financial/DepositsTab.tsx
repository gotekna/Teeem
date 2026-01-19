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
  Wallet,
  CheckCircle,
  Clock,
  DollarSign,
  ArrowRight,
  RotateCcw,
  Building2,
  FileText,
  Briefcase,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/utils/formatters";

interface Deposit {
  id: number;
  contact: { id: number; name: string } | null;
  job: { id: number; name: string } | null;
  deposit_type: string;
  deposit_type_label: string;
  reference: string;
  description: string | null;
  amount: number;
  applied_amount: number;
  balance: number;
  status: string;
  status_badge: string;
  received_date: string;
  applied_invoices: Array<{ id: number; number: string; amount: number }>;
  can_apply: boolean;
  can_refund: boolean;
  created_at: string;
}

interface DepositSummary {
  total_deposits: number;
  total_amount: number;
  applied_amount: number;
  unapplied_amount: number;
  refunded_amount: number;
  by_type: Array<{ type: string; count: number; amount: number }>;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function DepositsTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [summary, setSummary] = useState<DepositSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      const queryString = params.toString() ? `?${params.toString()}` : "";

      const [depositsRes, summaryRes] = await Promise.all([
        api.get<{ success: boolean; data: Deposit[] }>(`/api/v1/gl/deposits${queryString}`),
        api.get<{ success: boolean; data: DepositSummary }>("/api/v1/gl/deposits/summary"),
      ]);

      if (depositsRes?.success) setDeposits(depositsRes.data || []);
      if (summaryRes?.success) setSummary(summaryRes.data || null);
    } catch (error) {
      console.error("Failed to fetch deposits:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleRefund = async (deposit: Deposit) => {
    try {
      await api.post(`/api/v1/gl/deposits/${deposit.id}/refund`);
      fetchData();
    } catch (error) {
      console.error("Failed to refund deposit:", error);
    }
  };

  const getStatusBadge = (deposit: Deposit) => {
    switch (deposit.status) {
      case "unapplied":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            Unapplied
          </Badge>
        );
      case "partially_applied":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <ArrowRight className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case "fully_applied":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Applied
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="secondary">
            <RotateCcw className="h-3 w-3 mr-1" />
            Refunded
          </Badge>
        );
      default:
        return <Badge variant="secondary">{deposit.status}</Badge>;
    }
  };

  const getTypeBadge = (deposit: Deposit) => {
    switch (deposit.deposit_type) {
      case "customer_deposit":
        return (
          <Badge variant="outline" className="border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-400">
            <DollarSign className="h-3 w-3 mr-1" />
            Deposit
          </Badge>
        );
      case "retainer":
        return (
          <Badge variant="outline" className="border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-400">
            <Briefcase className="h-3 w-3 mr-1" />
            Retainer
          </Badge>
        );
      case "prepayment":
        return (
          <Badge variant="outline" className="border-cyan-200 text-cyan-700 dark:border-cyan-800 dark:text-cyan-400">
            <Wallet className="h-3 w-3 mr-1" />
            Prepayment
          </Badge>
        );
      default:
        return <Badge variant="outline">{deposit.deposit_type_label}</Badge>;
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deposits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_deposits || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(summary?.total_amount || 0)} received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unapplied Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(summary?.unapplied_amount || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">available to apply</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Applied Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.applied_amount || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">to invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Refunded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {formatCurrency(summary?.refunded_amount || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">returned to customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              By Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {summary?.by_type?.slice(0, 3).map((t) => (
                <div key={t.type} className="flex justify-between text-xs">
                  <span className="text-muted-foreground capitalize">{t.type.replace("_", " ")}</span>
                  <span className="font-medium">{t.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deposits List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Customer Deposits
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="customer_deposit">Deposit</SelectItem>
                <SelectItem value="retainer">Retainer</SelectItem>
                <SelectItem value="prepayment">Prepayment</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unapplied">Unapplied</SelectItem>
                <SelectItem value="partially_applied">Partial</SelectItem>
                <SelectItem value="fully_applied">Applied</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deposits.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No deposits found</p>
              <p className="text-sm mt-1">Customer deposits and retainers will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Applied</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.map((deposit) => (
                  <TableRow key={deposit.id}>
                    <TableCell>
                      <div className="font-medium">{deposit.reference}</div>
                      {deposit.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {deposit.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {deposit.contact ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{deposit.contact.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {deposit.job ? (
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{deposit.job.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getTypeBadge(deposit)}</TableCell>
                    <TableCell>{formatDate(deposit.received_date)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(deposit.amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(deposit.applied_amount)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${deposit.balance > 0 ? "text-yellow-600" : ""}`}>
                      {formatCurrency(deposit.balance)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(deposit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {deposit.can_apply && deposit.balance > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="Apply to Invoice"
                          >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Apply
                          </Button>
                        )}
                        {deposit.can_refund && deposit.balance > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRefund(deposit)}
                            title="Refund"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        {deposit.applied_invoices.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title={`Applied to ${deposit.applied_invoices.length} invoice(s)`}
                          >
                            <FileText className="h-4 w-4" />
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
