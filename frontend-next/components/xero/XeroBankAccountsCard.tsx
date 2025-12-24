"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Landmark,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import type { XeroBankAccount, XeroBankTransaction } from "./types";

// Parse Xero's .NET date format: /Date(1738540800000+0000)/
const parseXeroDate = (dateValue: string | Date | null | undefined): Date | null => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;

  // Handle .NET date format: /Date(1738540800000+0000)/
  const netDateMatch = dateValue.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
  if (netDateMatch) {
    const ms = parseInt(netDateMatch[1], 10);
    return new Date(ms);
  }

  // Try standard date parsing
  const date = new Date(dateValue);
  return isValid(date) ? date : null;
};

// Safe date formatter
const safeFormatDate = (dateValue: string | Date | null | undefined, formatStr: string, fallback = "—"): string => {
  const date = parseXeroDate(dateValue);
  if (!date || !isValid(date)) return fallback;
  return format(date, formatStr);
};

// Get financial year from date (July 1 - June 30)
const getFinancialYear = (date: Date): string => {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  // FY starts July 1st, so Jan-June is previous FY
  if (month < 6) { // Jan-June
    return `FY${(year - 1).toString().slice(-2)}/${year.toString().slice(-2)}`;
  } else { // July-Dec
    return `FY${year.toString().slice(-2)}/${(year + 1).toString().slice(-2)}`;
  }
};

interface AccountBalance {
  statement_balance?: number;
  xero_balance?: number;
}

interface XeroBankAccountsCardProps {
  companyId: string;
}

/**
 * XeroBankAccountsCard - Shows bank accounts as tabs with transactions
 *
 * Features:
 * - Display bank accounts from Xero as horizontal tabs
 * - Show transactions for selected account
 * - Date range filtering for transactions
 * - Search/filter panel like Xero
 * - Spent/Received columns with color coding
 */
export function XeroBankAccountsCard({ companyId }: XeroBankAccountsCardProps) {
  const [bankAccounts, setBankAccounts] = React.useState<XeroBankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = React.useState<string | null>(null);
  const [transactions, setTransactions] = React.useState<XeroBankTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = React.useState<XeroBankTransaction[]>([]);
  const [accountBalance, setAccountBalance] = React.useState<AccountBalance>({});
  const [loading, setLoading] = React.useState(false);
  const [transactionsLoading, setTransactionsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  // Search/Filter state
  const [showFilters, setShowFilters] = React.useState(false);
  const [searchText, setSearchText] = React.useState("");
  const [minAmount, setMinAmount] = React.useState("");
  const [maxAmount, setMaxAmount] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [monthFilter, setMonthFilter] = React.useState<string>("all");
  const [fyFilter, setFyFilter] = React.useState<string>("all");

  // Meta info for debugging
  const [meta, setMeta] = React.useState<{
    from_date?: string;
    to_date?: string;
    count?: number;
  }>({});

  // Load bank accounts on mount
  React.useEffect(() => {
    loadBankAccounts();
  }, [companyId]);

  // Load transactions when account is selected
  React.useEffect(() => {
    if (selectedAccount) {
      loadTransactions(selectedAccount);
    }
  }, [selectedAccount, dateRange]);

  // Apply filters when transactions or filter criteria change
  React.useEffect(() => {
    applyFilters();
  }, [transactions, searchText, minAmount, maxAmount, statusFilter, monthFilter, fyFilter]);

  // Get unique months and FYs from transactions
  const availableMonths = React.useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(tx => {
      const date = parseXeroDate(tx.date);
      if (date) {
        months.add(format(date, "MMMM yyyy"));
      }
    });
    return Array.from(months).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [transactions]);

  const availableFYs = React.useMemo(() => {
    const fys = new Set<string>();
    transactions.forEach(tx => {
      const date = parseXeroDate(tx.date);
      if (date) {
        fys.add(getFinancialYear(date));
      }
    });
    return Array.from(fys).sort().reverse();
  }, [transactions]);

  // Calculate running balance for each transaction (sorted by date, newest first)
  // IMPORTANT: This useMemo must be BEFORE all early returns to satisfy React's rules of hooks
  const transactionsWithBalance = React.useMemo(() => {
    const endBalance = accountBalance.xero_balance || 0;

    // Sort by date descending (newest first)
    const sorted = [...filteredTransactions].sort((a, b) => {
      const dateA = parseXeroDate(a.date);
      const dateB = parseXeroDate(b.date);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime(); // Descending
    });

    // Calculate running balance backwards from the end balance
    let runningBalance = endBalance;
    return sorted.map(tx => {
      const balanceAfter = runningBalance;
      runningBalance -= tx.amount; // Go backwards
      return { ...tx, balance: balanceAfter };
    });
  }, [filteredTransactions, accountBalance.xero_balance]);

  const applyFilters = () => {
    let filtered = [...transactions];

    // Search text filter (description, reference, contact)
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(tx =>
        (tx.description || "").toLowerCase().includes(search) ||
        (tx.reference || "").toLowerCase().includes(search) ||
        (tx.contact_name || "").toLowerCase().includes(search)
      );
    }

    // Min amount filter
    if (minAmount) {
      const min = parseFloat(minAmount);
      if (!isNaN(min)) {
        filtered = filtered.filter(tx => Math.abs(tx.amount) >= min);
      }
    }

    // Max amount filter
    if (maxAmount) {
      const max = parseFloat(maxAmount);
      if (!isNaN(max)) {
        filtered = filtered.filter(tx => Math.abs(tx.amount) <= max);
      }
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(tx => {
        if (statusFilter === "reconciled") {
          return tx.status === "AUTHORISED" || tx.status === "RECONCILED";
        }
        return tx.status === statusFilter;
      });
    }

    // Month filter
    if (monthFilter !== "all") {
      filtered = filtered.filter(tx => {
        const date = parseXeroDate(tx.date);
        if (!date) return false;
        return format(date, "MMMM yyyy") === monthFilter;
      });
    }

    // FY filter
    if (fyFilter !== "all") {
      filtered = filtered.filter(tx => {
        const date = parseXeroDate(tx.date);
        if (!date) return false;
        return getFinancialYear(date) === fyFilter;
      });
    }

    setFilteredTransactions(filtered);
  };

  const clearFilters = () => {
    setSearchText("");
    setMinAmount("");
    setMaxAmount("");
    setStatusFilter("all");
    setMonthFilter("all");
    setFyFilter("all");
  };

  const loadBankAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        xero_accounts?: Array<{
          xero_account_id: string;
          xero_account_name: string;
          xero_account_number?: string;
          xero_bank_account_type?: string;
          local_bank_account_id?: number;
          local_bank_account_name?: string;
          matched: boolean;
          linked: boolean;
        }>;
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/bank_accounts`);

      if (response?.success && response.xero_accounts) {
        // Map backend response to our interface
        const mapped: XeroBankAccount[] = response.xero_accounts.map(acc => ({
          account_id: acc.xero_account_id,
          name: acc.xero_account_name,
          code: acc.xero_bank_account_type || "",
          type: acc.xero_bank_account_type || "BANK",
          bank_account_number: acc.xero_account_number,
          currency_code: "AUD",
          status: "ACTIVE",
          linked: true,
        }));
        setBankAccounts(mapped);
        // Auto-select first account
        if (mapped.length > 0 && !selectedAccount) {
          setSelectedAccount(mapped[0].account_id);
        }
      } else {
        setError(response?.error || "Failed to load bank accounts");
      }
    } catch (err: unknown) {
      // Extract error message from API response
      const axiosError = err as { response?: { data?: { error?: string } } };
      const errorMessage = axiosError?.response?.data?.error || "Failed to load bank accounts from Xero";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (accountId: string) => {
    try {
      setTransactionsLoading(true);
      console.log(`[XeroBankTransactions] Loading transactions for account ${accountId}, date range: ${dateRange.from} to ${dateRange.to}`);

      const response = await api.get<{
        success: boolean;
        transactions?: XeroBankTransaction[];
        balance?: AccountBalance;
        meta?: {
          from_date?: string;
          to_date?: string;
          count?: number;
        };
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/bank_transactions`, {
        params: {
          bank_account_id: accountId,
          from_date: dateRange.from,
          to_date: dateRange.to,
        }
      });

      console.log(`[XeroBankTransactions] Response:`, {
        success: response?.success,
        transactionCount: response?.transactions?.length,
        meta: response?.meta,
        balance: response?.balance,
      });

      if (response?.success && response.transactions) {
        setTransactions(response.transactions);
        setFilteredTransactions(response.transactions);

        // Log first few transactions for debugging
        if (response.transactions.length > 0) {
          console.log(`[XeroBankTransactions] First transaction:`, response.transactions[0]);
        }
      } else {
        setTransactions([]);
        setFilteredTransactions([]);
      }

      // Set meta info
      if (response?.meta) {
        setMeta(response.meta);
      }

      // Set balance if provided
      if (response?.balance) {
        setAccountBalance(response.balance);
      }
    } catch (err) {
      console.error(`[XeroBankTransactions] Error loading transactions:`, err);
      setTransactions([]);
      setFilteredTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const isNotConnected = error.toLowerCase().includes("not connected");
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">{error}</p>
            {isNotConnected && (
              <p className="text-sm mt-2">Go to the Connection tab to connect this company to Xero.</p>
            )}
            <Button variant="outline" size="sm" className="mt-4" onClick={loadBankAccounts}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bankAccounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Landmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No Bank Accounts Found in Xero</p>
            <p className="text-sm mt-2">Connect a bank account in Xero to see transactions here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedAccountDetails = bankAccounts.find(a => a.account_id === selectedAccount);
  const hasActiveFilters = searchText || minAmount || maxAmount || statusFilter !== "all" || monthFilter !== "all" || fyFilter !== "all";

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Bank Account Tabs */}
        <div className="flex gap-1 mb-4 border-b overflow-x-auto">
          {bankAccounts.map((account) => (
            <button
              key={account.account_id}
              onClick={() => setSelectedAccount(account.account_id)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                selectedAccount === account.account_id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {account.name}
              {account.bank_account_number && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (...{account.bank_account_number.slice(-4)})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Account Controls - Compact Layout */}
        {selectedAccountDetails && (
          <div className="mb-4">
            {/* Balance & Controls Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-muted-foreground text-sm">Statement Balance</span>
                  <p className="text-lg font-semibold">
                    {accountBalance.statement_balance !== undefined
                      ? formatCurrency(accountBalance.statement_balance)
                      : "—"}
                  </p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <span className="text-muted-foreground text-sm">Balance in Xero</span>
                  <p className="text-lg font-semibold">
                    {accountBalance.xero_balance !== undefined
                      ? formatCurrency(accountBalance.xero_balance)
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Date Range & Search */}
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="w-36 h-8 text-sm px-2 border rounded-md bg-background cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="w-36 h-8 text-sm px-2 border rounded-md bg-background cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button
                  variant={showFilters ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Search className="h-4 w-4 mr-1" />
                  {hasActiveFilters && (
                    <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center">
                      !
                    </span>
                  )}
                </Button>
              </div>
            </div>

            {/* Search/Filter Panel - Xero Style */}
            {showFilters && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                  {/* Description/Contact Search */}
                  <div className="col-span-2">
                    <label className="text-sm text-muted-foreground mb-1 block">Description</label>
                    <Input
                      type="text"
                      placeholder="Search..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                    />
                  </div>

                  {/* Month Filter */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Month</label>
                    <Select value={monthFilter} onValueChange={setMonthFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Months</SelectItem>
                        {availableMonths.map(month => (
                          <SelectItem key={month} value={month}>{month}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* FY Filter */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">FY</label>
                    <Select value={fyFilter} onValueChange={setFyFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All FYs</SelectItem>
                        {availableFYs.map(fy => (
                          <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Min Amount */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Min $</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  {/* Max Amount */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Max $</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="reconciled">Reconciled</SelectItem>
                        <SelectItem value="AUTHORISED">Authorised</SelectItem>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Filter Actions */}
                <div className="flex justify-end gap-2 mt-3">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Debug Info (only in dev) */}
        {process.env.NODE_ENV === 'development' && meta.count !== undefined && (
          <div className="text-xs text-muted-foreground mb-2 p-2 bg-muted/30 rounded">
            API returned {meta.count} transactions for {meta.from_date} to {meta.to_date}
            {hasActiveFilters && ` (showing ${filteredTransactions.length} after filters)`}
          </div>
        )}

        {/* Transactions Table */}
        {transactionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : transactionsWithBalance.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{hasActiveFilters ? "No transactions match your filters" : "No transactions found for this date range"}</p>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-2 px-3 text-left font-medium">
                    <span className="flex items-center gap-1">
                      Date <ChevronDown className="h-3 w-3 opacity-50" />
                    </span>
                  </th>
                  <th className="py-2 px-3 text-left font-medium">Description</th>
                  <th className="py-2 px-3 text-left font-medium">Reference</th>
                  <th className="py-2 px-3 text-right font-medium">Spent</th>
                  <th className="py-2 px-3 text-right font-medium">Received</th>
                  <th className="py-2 px-3 text-right font-medium">Balance</th>
                  <th className="py-2 px-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactionsWithBalance.map((tx) => {
                  const isSpend = tx.amount < 0;
                  const isReconciled = tx.status === "AUTHORISED" || tx.status === "RECONCILED";

                  return (
                    <tr key={tx.transaction_id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 whitespace-nowrap">
                        {safeFormatDate(tx.date, "d MMM yyyy")}
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                          {tx.description || "No description"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {tx.reference || ""}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {isSpend ? formatCurrency(Math.abs(tx.amount)) : ""}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {!isSpend && tx.amount > 0 ? formatCurrency(tx.amount) : ""}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium">
                        {formatCurrency(tx.balance)}
                      </td>
                      <td className="py-2 px-3">
                        {isReconciled ? (
                          <span className="text-green-600 dark:text-green-400 text-sm">
                            Reconciled
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {tx.status || "Pending"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default XeroBankAccountsCard;
