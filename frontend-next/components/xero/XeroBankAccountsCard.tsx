"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Landmark,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import type { XeroBankAccount, XeroBankTransaction } from "./types";

// Safe date formatter
const safeFormatDate = (dateValue: string | Date | null | undefined, formatStr: string, fallback = "—"): string => {
  if (!dateValue) return fallback;
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  return isValid(date) ? format(date, formatStr) : fallback;
};

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
 * - Spent/Received columns with color coding
 */
export function XeroBankAccountsCard({ companyId }: XeroBankAccountsCardProps) {
  const [bankAccounts, setBankAccounts] = React.useState<XeroBankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = React.useState<string | null>(null);
  const [transactions, setTransactions] = React.useState<XeroBankTransaction[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [transactionsLoading, setTransactionsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

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
        const mapped = response.xero_accounts.map(acc => ({
          account_id: acc.xero_account_id,
          name: acc.xero_account_name,
          code: acc.xero_bank_account_type || "",
          type: acc.xero_bank_account_type || "BANK",
          bank_account_number: acc.xero_account_number,
          currency_code: "AUD",
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
      const response = await api.get<{
        success: boolean;
        transactions?: XeroBankTransaction[];
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/bank_transactions`, {
        params: {
          bank_account_id: accountId,
          from_date: dateRange.from,
          to_date: dateRange.to,
        }
      });

      if (response?.success && response.transactions) {
        setTransactions(response.transactions);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      setTransactions([]);
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Bank Account Transactions</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-36"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-36"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
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

        {/* Selected Account Info */}
        {selectedAccountDetails && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="font-medium">{selectedAccountDetails.name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedAccountDetails.bank_account_number || "No account number"}
                {selectedAccountDetails.code && ` • Code: ${selectedAccountDetails.code}`}
              </p>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        {transactionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No transactions found for this date range</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-2 px-3 text-left font-medium">Date</th>
                  <th className="py-2 px-3 text-left font-medium">Description</th>
                  <th className="py-2 px-3 text-left font-medium">Reference</th>
                  <th className="py-2 px-3 text-left font-medium">Contact</th>
                  <th className="py-2 px-3 text-right font-medium">Spent</th>
                  <th className="py-2 px-3 text-right font-medium">Received</th>
                  <th className="py-2 px-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isSpend = tx.amount < 0;
                  return (
                    <tr key={tx.transaction_id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 whitespace-nowrap">
                        {safeFormatDate(tx.date, "dd MMM yyyy")}
                      </td>
                      <td className="py-2 px-3">
                        <div className="max-w-xs truncate" title={tx.description}>
                          {tx.description}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {tx.reference || "—"}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {tx.contact_name || "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-red-600">
                        {isSpend ? formatCurrency(Math.abs(tx.amount)) : ""}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-green-600">
                        {!isSpend ? formatCurrency(tx.amount) : ""}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {tx.balance !== undefined ? formatCurrency(tx.balance) : "—"}
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
