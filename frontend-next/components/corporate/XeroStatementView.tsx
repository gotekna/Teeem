"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Search, Download, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// Types
interface BankTransaction {
  id: number;
  xero_id: string;
  bank_account_id: string;
  bank_account_name: string;
  transaction_type: string;
  type_display: string;
  transaction_date: string;
  reference: string;
  status: string;
  is_reconciled: boolean;
  contact_id: number | null;
  contact_name: string | null;
  description: string;
  total: number;
  signed_total: number;
  currency_code: string;
  financial_year: string;
  transaction_month: number;
  transaction_year: number;
  has_attachments: boolean;
  last_synced_at: string;
}

interface BankAccount {
  id: string;
  code: string;
  name: string;
}

interface MonthlySummaryItem {
  year: number;
  month: number;
  type: string;
  total_amount: number;
  count: number;
}

interface SyncStatus {
  total_transactions: number;
  receives_count: number;
  spends_count: number;
  reconciled_count: number;
  by_bank_account: Record<string, number>;
  by_financial_year: Record<string, number>;
  last_synced_at: string | null;
  next_sync_at: string | null;
  sync_status: string | null;
}

interface Props {
  companyId?: string;
}

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export function XeroStatementView({ companyId }: Props) {
  // State
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [financialYears, setFinancialYears] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryItem[]>([]);

  // Filters
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedFY, setSelectedFY] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Loading states
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const perPage = 50;

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load transactions when filters change
  useEffect(() => {
    loadTransactions();
  }, [selectedAccount, selectedFY, selectedMonth, searchQuery, page]);

  const loadInitialData = async () => {
    try {
      // Load bank accounts, financial years, and sync status in parallel
      const [accountsRes, yearsRes, statusRes] = await Promise.all([
        api.get<{ success: boolean; data: BankAccount[] }>("/api/v1/warehouse_bank_transactions/bank_accounts"),
        api.get<{ success: boolean; data: string[] }>("/api/v1/warehouse_bank_transactions/financial_years"),
        api.get<{ success: boolean; data: SyncStatus }>("/api/v1/warehouse_bank_transactions/sync_status"),
      ]);

      if (accountsRes?.success) {
        setBankAccounts(accountsRes.data);
      }
      if (yearsRes?.success) {
        setFinancialYears(yearsRes.data);
        // Default to most recent FY if available
        if (yearsRes.data.length > 0) {
          setSelectedFY(yearsRes.data[0]);
        }
      }
      if (statusRes?.success) {
        setSyncStatus(statusRes.data);
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  };

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));

      if (selectedAccount !== "all") {
        params.set("bank_account_id", selectedAccount);
      }
      if (selectedFY !== "all") {
        params.set("financial_year", selectedFY);
      }
      if (selectedMonth !== "all") {
        // Get current year or year from selected FY
        const year = selectedFY !== "all"
          ? parseInt("20" + selectedFY.replace("FY", "")) - (parseInt(selectedMonth) >= 7 ? 0 : 1)
          : new Date().getFullYear();
        params.set("year", String(year));
        params.set("month", selectedMonth);
      }
      if (searchQuery) {
        params.set("q", searchQuery);
      }

      const response = await api.get<{
        success: boolean;
        data: BankTransaction[];
        meta: {
          total_count: number;
          page: number;
          per_page: number;
          total_pages: number;
        };
      }>(`/api/v1/warehouse_bank_transactions?${params.toString()}`);

      if (response?.success) {
        setTransactions(response.data);
        setTotalCount(response.meta.total_count);
        setTotalPages(response.meta.total_pages);
      }
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, selectedFY, selectedMonth, searchQuery, page]);

  const loadMonthlySummary = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedAccount !== "all") {
        params.set("bank_account_id", selectedAccount);
      }
      if (selectedFY !== "all") {
        params.set("financial_year", selectedFY);
      }

      const response = await api.get<{ success: boolean; data: MonthlySummaryItem[] }>(
        `/api/v1/warehouse_bank_transactions/monthly_summary?${params.toString()}`
      );

      if (response?.success) {
        setMonthlySummary(response.data);
      }
    } catch (error) {
      console.error("Failed to load monthly summary:", error);
    }
  };

  useEffect(() => {
    if (selectedFY !== "all" || selectedAccount !== "all") {
      loadMonthlySummary();
    }
  }, [selectedFY, selectedAccount]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post("/api/v1/warehouse_bank_transactions/trigger_sync");
      await Promise.all([loadInitialData(), loadTransactions()]);
    } catch (error) {
      console.error("Failed to sync:", error);
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  // Calculate totals for current view
  const totals = transactions.reduce(
    (acc, txn) => {
      if (txn.transaction_type === "RECEIVE") {
        acc.receives += txn.total;
        acc.receivesCount++;
      } else {
        acc.spends += txn.total;
        acc.spendsCount++;
      }
      return acc;
    },
    { receives: 0, spends: 0, receivesCount: 0, spendsCount: 0 }
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium">Xero Statement</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Bank transactions from Xero warehouse ({totalCount.toLocaleString()} total)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {syncStatus?.last_synced_at && (
              <span className="text-xs text-muted-foreground">
                Last sync: {formatDate(syncStatus.last_synced_at)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync from Xero
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Bank Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bank Accounts</SelectItem>
              {bankAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name || account.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedFY} onValueChange={(v) => { setSelectedFY(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Financial Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {financialYears.map((fy) => (
                <SelectItem key={fy} value={fy}>
                  {fy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {MONTHS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search description, contact, reference..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowDownLeft className="h-3 w-3 text-green-600" />
              Money In
            </div>
            <div className="text-lg font-semibold text-green-600">
              {formatCurrency(totals.receives)}
            </div>
            <div className="text-xs text-muted-foreground">{totals.receivesCount} transactions</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowUpRight className="h-3 w-3 text-red-600" />
              Money Out
            </div>
            <div className="text-lg font-semibold text-red-600">
              {formatCurrency(totals.spends)}
            </div>
            <div className="text-xs text-muted-foreground">{totals.spendsCount} transactions</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground">Net Change</div>
            <div className={cn(
              "text-lg font-semibold",
              totals.receives - totals.spends >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(totals.receives - totals.spends)}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground">Showing</div>
            <div className="text-lg font-semibold">{transactions.length}</div>
            <div className="text-xs text-muted-foreground">of {totalCount.toLocaleString()}</div>
          </div>
        </div>

        {/* Transactions Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No transactions found.</p>
            <p className="text-sm mt-1">
              {syncStatus?.total_transactions === 0
                ? 'Click "Sync from Xero" to import bank transactions.'
                : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-left py-2 px-3 font-medium">Description</th>
                    <th className="text-left py-2 px-3 font-medium">Contact</th>
                    <th className="text-left py-2 px-3 font-medium">Account</th>
                    <th className="text-left py-2 px-3 font-medium">Reference</th>
                    <th className="text-right py-2 px-3 font-medium">Amount</th>
                    <th className="text-center py-2 px-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 whitespace-nowrap">
                        {formatDate(txn.transaction_date)}
                      </td>
                      <td className="py-2 px-3 max-w-[250px] truncate" title={txn.description}>
                        {txn.description || "-"}
                      </td>
                      <td className="py-2 px-3 max-w-[150px] truncate" title={txn.contact_name || ""}>
                        {txn.contact_name || "-"}
                      </td>
                      <td className="py-2 px-3 max-w-[150px] truncate" title={txn.bank_account_name}>
                        {txn.bank_account_name || "-"}
                      </td>
                      <td className="py-2 px-3 max-w-[100px] truncate" title={txn.reference}>
                        {txn.reference || "-"}
                      </td>
                      <td className={cn(
                        "py-2 px-3 text-right font-mono whitespace-nowrap",
                        txn.transaction_type === "RECEIVE" ? "text-green-600" : "text-red-600"
                      )}>
                        {txn.transaction_type === "RECEIVE" ? "+" : "-"}
                        {formatCurrency(txn.total)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {txn.is_reconciled ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                            Reconciled
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Pending
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
