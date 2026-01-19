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
import { Checkbox } from "@/components/ui/checkbox";
import {
  RefreshCw,
  Receipt,
  CheckCircle,
  Clock,
  DollarSign,
  Building2,
  Briefcase,
  User,
  FileText,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface Expense {
  id: number;
  job_id: number | null;
  job: { id: number; name: string } | null;
  contact_id: number | null;
  contact: { id: number; name: string } | null;
  user_id: number | null;
  user: { id: number; name: string } | null;
  expense_date: string;
  expense_type: string;
  description: string;
  vendor_name: string | null;
  receipt_reference: string | null;
  cost_amount: number;
  markup_percent: number;
  billable_amount: number;
  markup_amount: number;
  billable: boolean;
  reimbursable: boolean;
  status: string;
  notes: string | null;
  created_at: string;
}

interface ExpenseSummary {
  by_status: {
    pending: number;
    approved: number;
    billed: number;
  };
  by_type: Record<string, number>;
  total_markup: number;
  unbilled_count: number;
}

export default function ExpensesTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);

      const [expensesRes, summaryRes] = await Promise.all([
        api.get<{ success: boolean; data: Expense[] }>(`/api/v1/gl/expenses?${params}`),
        api.get<{ success: boolean; data: ExpenseSummary }>("/api/v1/gl/expenses/summary"),
      ]);

      if (expensesRes?.success) setExpenses(expensesRes.data || []);
      if (summaryRes?.success) setSummary(summaryRes.data || null);
    } catch (error) {
      console.error("Failed to fetch expenses:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleApprove = async (expense: Expense) => {
    try {
      await api.post(`/api/v1/gl/expenses/${expense.id}/approve`);
      fetchData();
    } catch (error) {
      console.error("Failed to approve expense:", error);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      await api.post("/api/v1/gl/expenses/batch_approve", { expense_ids: selectedIds });
      setSelectedIds([]);
      fetchData();
    } catch (error) {
      console.error("Failed to batch approve:", error);
    }
  };

  const handleCreateInvoice = async () => {
    if (selectedIds.length === 0) return;
    try {
      await api.post("/api/v1/gl/expenses/create_invoice", { expense_ids: selectedIds });
      setSelectedIds([]);
      fetchData();
    } catch (error) {
      console.error("Failed to create invoice:", error);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const approvedExpenses = expenses.filter((e) => e.status === "approved");
    if (selectedIds.length === approvedExpenses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(approvedExpenses.map((e) => e.id));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "billed":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <FileText className="h-3 w-3 mr-1" />
            Billed
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            Rejected
          </Badge>
        );
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

  const pendingExpenses = expenses.filter((e) => e.status === "pending");
  const approvedExpenses = expenses.filter((e) => e.status === "approved");

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(summary?.by_status?.pending || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingExpenses.length} expenses awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Approved (Unbilled)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.by_status?.approved || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.unbilled_count || 0} ready to invoice
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Billed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary?.by_status?.billed || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">invoiced to clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Markup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(summary?.total_markup || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">profit from billable expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Billable Expenses
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="billed">Billed</SelectItem>
              </SelectContent>
            </Select>
            {selectedIds.length > 0 && (
              <>
                <Button variant="outline" onClick={handleBatchApprove}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve ({selectedIds.length})
                </Button>
                <Button onClick={handleCreateInvoice}>
                  <FileText className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </>
            )}
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No expenses found</p>
              <p className="text-sm mt-1">Billable expenses will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === approvedExpenses.length && approvedExpenses.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Markup</TableHead>
                  <TableHead className="text-right">Billable</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(expense.id)}
                        onCheckedChange={() => toggleSelection(expense.id)}
                        disabled={expense.status !== "approved"}
                      />
                    </TableCell>
                    <TableCell>{formatDate(expense.expense_date)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">{expense.expense_type}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {expense.job ? (
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{expense.job.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {expense.vendor_name ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{expense.vendor_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {expense.user ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{expense.user.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(expense.cost_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600">+{expense.markup_percent}%</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(expense.billable_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(expense.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      {expense.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(expense)}
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
        </CardContent>
      </Card>
    </div>
  );
}
