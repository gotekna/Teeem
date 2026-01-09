"use client";

import { useState, useCallback, useMemo } from "react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface JobExpensesTabProps {
  jobId: string | number;
  jobTitle?: string;
  onUpdate?: () => Promise<void>;
}

/**
 * Expenses Tab - Purchase Orders grouped by Stage and Trade
 *
 * Displays all Purchase Orders for a job with hierarchical grouping.
 * Users can toggle between Stage→Trade or Trade→Stage grouping modes.
 *
 * Features:
 * - Two-level hierarchical grouping (expandable/collapsible)
 * - Instant grouping mode toggle via key remount
 * - Shows PO Total, Amount Paid, Remaining to Pay, Payment Status
 * - Budget tracking context
 *
 * Architecture:
 * - Uses TeeemTableView's initialView prop for multi-level grouping
 * - Foundation API auto-fetches all PO data
 * - Virtual columns (stage_from_task, trade_from_task) expose stage/trade via SmTask
 * - Key-based remount for grouping toggle (simple, reliable)
 */
export function JobExpensesTab({ jobId }: JobExpensesTabProps) {
  const [groupingMode, setGroupingMode] = useState<'stage-trade' | 'trade-stage'>('stage-trade');

  const handleGroupingChange = useCallback((value: string) => {
    if (!value) return;
    setGroupingMode(value as 'stage-trade' | 'trade-stage');
  }, []);

  // Memoize the grouping columns to prevent unnecessary re-renders
  const groupByColumns = useMemo(() => {
    return groupingMode === 'stage-trade'
      ? ['stage_from_task', 'trade_from_task']
      : ['trade_from_task', 'stage_from_task'];
  }, [groupingMode]);

  // Use initialView to set grouping - TeeemTableView reads group_by_columns from this
  const initialView = useMemo(() => ({
    id: -1, // Synthetic view ID
    name: 'Expenses Grouped View',
    view_display_type: 'grouped' as const,
    group_by_columns: groupByColumns,
  }), [groupByColumns]);

  // Filter for this job's POs only
  const initialFilters = useMemo(() => [
    { id: crypto.randomUUID(), column: "job_id", operator: "=" as const, value: String(jobId) }
  ], [jobId]);

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        key={groupingMode} // Remount when grouping changes for clean state reset
        foundationId="purchase-orders"
        autoFetchRecords={true}
        initialFilters={initialFilters}
        initialView={initialView}
        disableSavedViews={true} // Don't show saved views dropdown for this embedded table
        leftActions={
          <RadioGroup
            value={groupingMode}
            onValueChange={handleGroupingChange}
            className="flex items-center gap-4 px-3 py-1.5 border rounded-md bg-white dark:bg-gray-800"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="stage-trade" id="stage-trade" />
              <Label htmlFor="stage-trade" className="text-xs font-normal cursor-pointer">
                Stage → Trade
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="trade-stage" id="trade-stage" />
              <Label htmlFor="trade-stage" className="text-xs font-normal cursor-pointer">
                Trade → Stage
              </Label>
            </div>
          </RadioGroup>
        }
      />
    </div>
  );
}
