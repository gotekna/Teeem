"use client";

import { useState, useEffect } from "react";
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
  RefreshCw,
  DollarSign,
  Info,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";

interface BudgetItem {
  id: number;
  po_number: string;
  supplier_name: string;
  item_description: string;
  budgeted: number;
  invoiced: number;
  variance: number;
  payment_status: string;
}

interface BudgetTotals {
  budgeted: number;
  invoiced: number;
  variance: number;
  variance_percentage: number | null;
}

interface BudgetData {
  budget_items: BudgetItem[];
  totals: BudgetTotals;
}

interface JobBudgetTabProps {
  jobId: string | number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const STATUS_VARIANTS: Record<string, { variant: string; label: string }> = {
  pending: { variant: "bg-muted text-foreground dark:bg-gray-800 dark:text-muted-foreground", label: "Pending" },
  part_payment: { variant: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Part Payment" },
  complete: { variant: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", label: "Complete" },
  manual_review: { variant: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", label: "Needs Review" },
};

export function JobBudgetTab({ jobId }: JobBudgetTabProps) {
  const [loading, setLoading] = useState(true);
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBudgetData();
     
  }, [jobId]);

  const loadBudgetData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<BudgetData>(`/api/v1/jobs/${jobId}/budget_tracking`);
      setBudgetData(response);
    } catch (err) {
      console.error("Failed to load budget data:", err);
      setError("Failed to load budget tracking data");
    } finally {
      setLoading(false);
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance === 0) return "text-foreground";
    if (variance > 0) return "text-red-600 dark:text-red-400 font-semibold"; // Over budget
    return "text-green-600 dark:text-green-400 font-semibold"; // Under budget
  };

  const getPaymentStatusBadge = (status: string) => {
    const config = STATUS_VARIANTS[status] || STATUS_VARIANTS.pending;
    return <Badge className={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
          <Button variant="outline" className="mt-3" onClick={loadBudgetData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!budgetData || !budgetData.budget_items || budgetData.budget_items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold">Budget Tracking</h3>
          <p className="text-sm text-muted-foreground mt-1">
            No purchase orders yet. Create purchase orders to start tracking your budget.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { budget_items, totals } = budgetData;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Budgeted</p>
            <p className="mt-1 text-2xl font-semibold">{formatCurrency(totals.budgeted)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Invoiced</p>
            <p className="mt-1 text-2xl font-semibold">{formatCurrency(totals.invoiced)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Variance</p>
            <div className="mt-1">
              <p className={`text-2xl font-semibold ${getVarianceColor(totals.variance)}`}>
                {totals.variance >= 0 ? "+" : ""}
                {formatCurrency(totals.variance)}
              </p>
              {totals.budgeted > 0 && totals.variance_percentage != null && (
                <p className={`text-sm ${getVarianceColor(totals.variance)}`}>
                  ({totals.variance_percentage >= 0 ? "+" : ""}
                  {totals.variance_percentage.toFixed(2)}%)
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Purchase Orders vs Invoiced</CardTitle>
          <Button variant="outline" size="sm" onClick={loadBudgetData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Item / Description</TableHead>
                <TableHead className="text-right">Budgeted</TableHead>
                <TableHead className="text-right">Invoiced</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budget_items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.po_number}</TableCell>
                  <TableCell>{item.supplier_name}</TableCell>
                  <TableCell className="max-w-xs truncate">{item.item_description}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.budgeted)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.invoiced)}</TableCell>
                  <TableCell className={`text-right ${getVarianceColor(item.variance)}`}>
                    {item.variance >= 0 ? "+" : ""}
                    {formatCurrency(item.variance)}
                  </TableCell>
                  <TableCell className="text-center">{getPaymentStatusBadge(item.payment_status)}</TableCell>
                </TableRow>
              ))}

              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.budgeted)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totals.invoiced)}</TableCell>
                <TableCell className={`text-right ${getVarianceColor(totals.variance)}`}>
                  {totals.variance >= 0 ? "+" : ""}
                  {formatCurrency(totals.variance)}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info box */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                About Budget Tracking
              </h3>
              <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300 list-disc pl-5 space-y-1">
                <li>Positive variance (red) = over budget</li>
                <li>Negative variance (green) = under budget</li>
                <li>
                  Invoiced amounts are updated when invoices are matched in the Purchase Orders
                  tab
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default JobBudgetTab;
