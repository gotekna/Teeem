"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ExpensesSummaryBar } from "@/components/expenses/ExpensesSummaryBar";
import { ExpensesTree } from "@/components/expenses/ExpensesTree";
import {
  groupExpensesByHierarchy,
  calculateJobTotals,
  type PurchaseOrderRecord,
} from "@/lib/expenses-utils";

interface JobExpensesTabProps {
  jobId: string | number;
  jobTitle?: string;
  onUpdate?: () => Promise<void>;
}

type GroupingMode = "stage-trade" | "trade-stage";

/**
 * JobExpensesTab - Custom Cost Control Visualization
 *
 * Displays all Purchase Orders for a job with hierarchical grouping,
 * visual budget indicators, and overrun warnings.
 *
 * Features:
 * - Two-level hierarchical tree (Stage → Trade or Trade → Stage)
 * - Visual budget progress bars with color coding
 * - Rolling totals at each level
 * - Over-budget warnings (red), warning zone (yellow), on-track (green)
 * - Toggle between grouping modes
 *
 * Architecture:
 * - Fetches data directly from Foundation API
 * - Client-side grouping and aggregation
 * - Custom tree components (not TeeemTableView)
 */
export function JobExpensesTab({ jobId }: JobExpensesTabProps) {
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("stage-trade");
  const [records, setRecords] = useState<PurchaseOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch purchase orders for this job
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First get the foundation to get its numeric ID
      const foundationRes = await api.get<{ foundation: { id: number } }>(
        "/api/v1/foundations/purchase-orders"
      );
      const foundationId = foundationRes.foundation.id;

      // Fetch records filtered by job_id
      const recordsRes = await api.get<{ records: PurchaseOrderRecord[] }>(
        `/api/v1/foundations/${foundationId}/records`,
        {
          params: {
            filters: JSON.stringify([
              { column: "job_id", operator: "=", value: String(jobId) }
            ]),
            per_page: 500,
          },
        }
      );

      setRecords(recordsRes.records || []);
    } catch (err) {
      console.error("Failed to load expenses:", err);
      setError(err instanceof Error ? err : new Error("Failed to load data"));
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  // Load data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group data by hierarchy based on mode
  const groupedData = useMemo(() => {
    if (groupingMode === "stage-trade") {
      return groupExpensesByHierarchy(records, "stage_from_task", "trade_from_task");
    } else {
      return groupExpensesByHierarchy(records, "trade_from_task", "stage_from_task");
    }
  }, [records, groupingMode]);

  // Calculate job-level totals
  const totals = useMemo(() => {
    return calculateJobTotals(groupedData);
  }, [groupedData]);

  const handleGroupingChange = useCallback((value: string) => {
    if (value) {
      setGroupingMode(value as GroupingMode);
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <LoadingOverlay />
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-8 text-center">
        <div className="flex flex-col items-center gap-2 text-destructive">
          <AlertCircle className="h-12 w-12" />
          <p className="text-lg font-medium">Failed to Load Expenses</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Grouping Toggle */}
      <div className="flex items-center justify-between">
        <RadioGroup
          value={groupingMode}
          onValueChange={handleGroupingChange}
          className="flex items-center gap-4 px-3 py-1.5 border rounded-md bg-card"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="stage-trade" id="expense-stage-trade" />
            <Label
              htmlFor="expense-stage-trade"
              className="text-sm font-normal cursor-pointer"
            >
              Stage → Trade
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="trade-stage" id="expense-trade-stage" />
            <Label
              htmlFor="expense-trade-stage"
              className="text-sm font-normal cursor-pointer"
            >
              Trade → Stage
            </Label>
          </div>
        </RadioGroup>

        <div className="text-sm text-muted-foreground">
          {records.length} Purchase Order{records.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Summary Bar */}
      <ExpensesSummaryBar
        totalBudget={totals.totalBudget}
        totalSpent={totals.totalSpent}
        totalPaid={totals.totalPaid}
        totalRemaining={totals.totalRemaining}
        totalVariance={totals.totalVariance}
        poCount={totals.poCount}
      />

      {/* Expenses Tree */}
      <ExpensesTree data={groupedData} />
    </div>
  );
}
