"use client";

import { useState, useEffect } from "react";
import { PlusIcon, BanknotesIcon, CreditCardIcon } from "@heroicons/react/24/outline";
import TeeemTableView from "@/components/table/TeeemTableView";
import TransactionForm from "@/components/financial/TransactionForm";
import { XeroStatementView } from "@/components/corporate/XeroStatementView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import type { TableColumn, TableRow } from "@/components/table/types";

// Define columns for financial transactions table
const TRANSACTION_COLUMNS: TableColumn[] = [
  {
    key: "select",
    label: "",
    resizable: false,
    sortable: false,
    filterable: false,
    width: 32,
  },
  {
    key: "transaction_date",
    label: "Date",
    resizable: true,
    sortable: true,
    filterable: false,
    width: 140,
    tooltip: "Transaction date",
  },
  {
    key: "transaction_type",
    label: "Type",
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: "dropdown",
    width: 100,
    tooltip: "Income or Expense",
  },
  {
    key: "category",
    label: "Category",
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: "dropdown",
    width: 150,
    tooltip: "Transaction category",
  },
  {
    key: "description",
    label: "Description",
    resizable: true,
    sortable: false,
    filterable: true,
    filterType: "text",
    width: 300,
    tooltip: "Transaction description",
  },
  {
    key: "construction_name",
    label: "Job",
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: "dropdown",
    width: 180,
    tooltip: "Linked construction job",
  },
  {
    key: "amount",
    label: "Amount",
    resizable: true,
    sortable: true,
    filterable: false,
    width: 120,
    showSum: true,
    sumType: "currency",
    tooltip: "Transaction amount",
  },
  {
    key: "status",
    label: "Status",
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: "dropdown",
    width: 100,
    tooltip: "Draft, Posted, or Synced",
  },
  {
    key: "user_name",
    label: "Created By",
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: "dropdown",
    width: 150,
    tooltip: "User who created this transaction",
  },
];

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
  construction_id?: number;
  status: string;
  construction?: Construction;
  user?: User;
  construction_name?: string;
  user_name?: string;
  [key: string]: unknown; // Index signature for TableRow compatibility
}

interface Summary {
  total_income: number;
  total_expenses: number;
  net_profit: number;
}

export default function FinancialTransactionsPage() {
  useSetLayoutMode("full-height");
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
          construction_name: t.construction?.name || "N/A",
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
                  construction_name:
                    response.transaction.construction?.name || "N/A",
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
      alert(`Failed to update transaction: ${err.message}`);
    }
  };

  const handleDelete = async (row: TableRow) => {
    const entry = row as Transaction;
    if (
      !confirm(
        `Are you sure you want to delete this ${entry.transaction_type} transaction?`
      )
    )
      return;

    try {
      const response = await api.delete<{ success: boolean }>(
        `/api/v1/financial_transactions/${entry.id}`
      );

      if (response && response.success) {
        setTransactions((prev) => prev.filter((t) => t.id !== entry.id));
        await fetchSummary();
      }
    } catch (err: any) {
      console.error("Error deleting transaction:", err);
      alert(`Failed to delete transaction: ${err.message}`);
    }
  };

  const handleAddIncome = () => {
    setEditingTransaction(null);
    setTransactionType("income");
    setShowTransactionForm(true);
  };

  const handleAddExpense = () => {
    setEditingTransaction(null);
    setTransactionType("expense");
    setShowTransactionForm(true);
  };

  const handleTransactionSuccess = async () => {
    await fetchTransactions();
    await fetchSummary();
    setShowTransactionForm(false);
    setEditingTransaction(null);
  };

  const handleImport = () => {
    alert("Import - This would open a file picker to import transactions from CSV");
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/financial_exports/transactions");
      const blob = await response.blob();

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
      alert("Failed to export transactions");
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4">
      <Tabs defaultValue="xero" className="flex flex-col h-full">
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Income</p>
                  <p className="mt-2 text-3xl font-bold text-green-600">
                    $
                    {summary.total_income?.toLocaleString("en-AU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <BanknotesIcon className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </div>

            {/* Total Expenses */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</p>
                  <p className="mt-2 text-3xl font-bold text-red-600">
                    $
                    {summary.total_expenses?.toLocaleString("en-AU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <CreditCardIcon className="h-8 w-8 text-red-600" />
                </div>
              </div>
            </div>

            {/* Net Profit */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Profit</p>
                  <p
                    className={`mt-2 text-3xl font-bold ${
                      (summary.net_profit || 0) >= 0
                        ? "text-green-600"
                        : "text-red-600"
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
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <TeeemTableView
            category="financial"
            foundationId="financial-transactions"
            foundationIdNumeric={199}
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
        onClose={() => {
          setShowTransactionForm(false);
          setEditingTransaction(null);
        }}
        onSuccess={handleTransactionSuccess}
        transaction={editingTransaction}
        type={transactionType}
      />
    </div>
  );
}
