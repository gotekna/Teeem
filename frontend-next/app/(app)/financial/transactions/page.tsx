"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUrlState } from "@/hooks/useUrlState";
import { PlusIcon, BanknotesIcon, CreditCardIcon } from "@heroicons/react/24/outline";
import TeeemTableView from "@/components/table/TeeemTableView";
import TransactionForm from "@/components/financial/TransactionForm";
import { XeroStatementView } from "@/components/corporate/XeroStatementView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { TablePage } from "@/components/ui/page-wrappers";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/contexts/ConfirmationContext";
import type { TableRow } from "@/components/table/types";

// SSoT: Columns are now fetched from Foundation API (ID: 199)
// Removed hardcoded TRANSACTION_COLUMNS - 2024-12-27

interface Construction {
  id: number;
  name?: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
}

interface Transaction {
  id: number;
  transaction_type: string;
  amount: number;
  transaction_date: string;
  description?: string;
  category?: string;
  job_id?: number;
  status: string;
  job?: Construction;
  user?: User;
  job_name?: string;
  user_name?: string;
  [key: string]: unknown; // Index signature for TableRow compatibility
}

interface Summary {
  total_income: number;
  total_expenses: number;
  net_profit: number;
}

export default function FinancialTransactionsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // Path-based tab: /financial/transactions/xero, /financial/transactions/internal
  const activeTab = useMemo(() => {
    const parts = (pathname ?? "").replace("/financial/transactions", "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname]);

  // Redirect to default tab if none specified
  useEffect(() => {
    if (activeTab === null) {
      router.replace("/financial/transactions/xero", { scroll: false });
    }
  }, [activeTab, router]);

  const setActiveTab = useCallback((tab: string) => {
    router.push(`/financial/transactions/${tab}`, { scroll: false });
  }, [router]);

  // SSoT: Modal state managed by useUrlState hook
  const [urlState, setUrlState, clearUrlState] = useUrlState({
    new: null as string | null,  // "income" | "expense"
    edit: null as string | null, // transaction ID
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionType, setTransactionType] = useState<"income" | "expense">("expense");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [summary, setSummary] = useState<Summary>({
    total_income: 0,
    total_expenses: 0,
    net_profit: 0,
  });

  // Clear modal URL params (uses SSoT hook)
  const clearModalUrl = useCallback(() => {
    clearUrlState(["new", "edit"]);
  }, [clearUrlState]);

  // Read URL params to open modal on mount/URL change
  useEffect(() => {
    const newType = urlState.new;
    const editId = urlState.edit;

    if (newType === "income" || newType === "expense") {
      setTransactionType(newType);
      setEditingTransaction(null);
      setShowTransactionForm(true);
    } else if (editId) {
      // Find the transaction to edit
      const transaction = transactions.find(t => t.id === parseInt(editId, 10));
      if (transaction) {
        setEditingTransaction(transaction);
        setTransactionType(transaction.transaction_type as "income" | "expense");
        setShowTransactionForm(true);
      }
    } else {
      // No modal params - ensure modal is closed
      setShowTransactionForm(false);
      setEditingTransaction(null);
    }
  }, [urlState.new, urlState.edit, transactions]);

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; transactions: Transaction[] }>(
        "/api/v1/financial_transactions"
      );
      if (response?.success) {
        // Transform data to include computed fields for TeeemTableView
        const transformedData = response.transactions.map((t) => ({
          ...t,
          job_name: t.job?.name || "N/A",
          user_name: t.user
            ? `${t.user.first_name} ${t.user.last_name}`
            : "Unknown",
        }));
        setTransactions(transformedData);
      }
    } catch (err) {
      console.error("Failed to load transactions:", err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await api.get<{ success: boolean; summary: Summary }>(
        "/api/v1/financial_transactions/summary"
      );
      if (response?.success) {
        setSummary(response.summary);
      }
    } catch (err) {
      console.error("Failed to load summary:", err);
    }
  };

  const handleEdit = async (row: TableRow) => {
    const entry = row as Transaction;
    // For inline edits from TeeemTableView
    try {
      const response = await api.put<{ success: boolean; transaction: Transaction }>(
        `/api/v1/financial_transactions/${entry.id}`,
        {
          transaction: {
            description: entry.description,
            category: entry.category,
          },
        }
      );

      if (response?.success) {
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === response.transaction.id
              ? {
                  ...response.transaction,
                  job_name:
                    response.transaction.job?.name || "N/A",
                  user_name: response.transaction.user
                    ? `${response.transaction.user.first_name} ${response.transaction.user.last_name}`
                    : "Unknown",
                }
              : t
          )
        );
        await fetchSummary();
      }
    } catch (err: any) {
      console.error("Error updating transaction:", err);
      toast({ title: "Error", description: `Failed to update transaction: ${err.message}`, variant: "destructive" });
    }
  };

  const handleDelete = async (row: TableRow) => {
    const entry = row as Transaction;
    const confirmed = await confirm({
      title: "Delete Transaction",
      description: `Are you sure you want to delete this ${entry.transaction_type} transaction?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      const response = await api.delete<{ success: boolean }>(
        `/api/v1/financial_transactions/${entry.id}`
      );

      if (response && response.success) {
        setTransactions((prev) => prev.filter((t) => t.id !== entry.id));
        await fetchSummary();
        toast({ title: "Success", description: "Transaction deleted successfully" });
      }
    } catch (err: any) {
      console.error("Error deleting transaction:", err);
      toast({ title: "Error", description: `Failed to delete transaction: ${err.message}`, variant: "destructive" });
    }
  };

  const handleAddIncome = () => {
    setUrlState({ new: "income", edit: null });
  };

  const handleAddExpense = () => {
    setUrlState({ new: "expense", edit: null });
  };

  const handleTransactionSuccess = async () => {
    await fetchTransactions();
    await fetchSummary();
    clearModalUrl(); // This will trigger useEffect to close modal
  };

  const handleImport = () => {
    toast({ title: "Coming Soon", description: "Import functionality will open a file picker to import transactions from CSV" });
  };

  const handleExport = async () => {
    try {
      // SSoT: Use api.getBlob() for authenticated blob downloads
      const blob = await api.getBlob("/financial_exports/transactions");

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `transactions_${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error exporting transactions:", err);
      toast({ title: "Error", description: "Failed to export transactions", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Spinner size={48} className="mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <TablePage>
      <Tabs value={activeTab || "xero"} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="px-4 shrink-0">
          <TabsList className="mb-4">
            <TabsTrigger value="xero">Xero Bank Transactions</TabsTrigger>
            <TabsTrigger value="teeem">TEEEM Transactions</TabsTrigger>
          </TabsList>
        </div>

        {/* Xero Bank Transactions Tab */}
        <TabsContent value="xero" className="flex-1 px-4 mt-0">
          <XeroStatementView />
        </TabsContent>

        {/* TEEEM Internal Transactions Tab */}
        <TabsContent value="teeem" className="flex-1 flex flex-col mt-0">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 px-4 shrink-0">
            {/* Total Income */}
            <div className="bg-card rounded-lg shadow p-6 border border-border dark:border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">Total Income</p>
                  <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">
                    $
                    {summary.total_income?.toLocaleString("en-AU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <BanknotesIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            {/* Total Expenses */}
            <div className="bg-card rounded-lg shadow p-6 border border-border dark:border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">Total Expenses</p>
                  <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                    $
                    {summary.total_expenses?.toLocaleString("en-AU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <CreditCardIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </div>

            {/* Net Profit */}
            <div className="bg-card rounded-lg shadow p-6 border border-border dark:border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">Net Profit</p>
                  <p
                    className={`mt-2 text-3xl font-bold ${
                      (summary.net_profit || 0) >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    $
                    {summary.net_profit?.toLocaleString("en-AU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-full ${
                    (summary.net_profit || 0) >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
                  }`}
                >
                  <BanknotesIcon
                    className={`h-8 w-8 ${
                      (summary.net_profit || 0) >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <TeeemTableView
            category="financial"
            foundationId="financial_transactions"
            tableName="Financial Transactions"
            entries={transactions}
            // columns prop removed - TeeemTableView auto-fetches from Foundation API (SSoT)
            onEdit={handleEdit}
            onDelete={handleDelete}
            enableImport={true}
            enableExport={true}
            onImport={handleImport}
            onExport={handleExport}
            leftActions={
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddIncome}
                  className="inline-flex items-center gap-2 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
                >
                  <PlusIcon className="h-5 w-5" />
                  Record Income
                </button>
                <button
                  onClick={handleAddExpense}
                  className="inline-flex items-center gap-2 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
                >
                  <PlusIcon className="h-5 w-5" />
                  Record Expense
                </button>
              </div>
            }
            hideFooter={true}
          />
        </TabsContent>
      </Tabs>

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={showTransactionForm}
        onClose={clearModalUrl}
        onSuccess={handleTransactionSuccess}
        transaction={editingTransaction}
        type={transactionType}
      />
    </TablePage>
  );
}
