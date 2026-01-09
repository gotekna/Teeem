"use client";

import { useState, useEffect } from "react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAtom } from "jotai";
import { currentGroupByColumnsAtom } from "@/lib/table-atoms";

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
 * - Instant grouping mode toggle (client-side, no re-fetch)
 * - Shows PO Total, Amount Paid, Remaining to Pay, Payment Status
 * - Budget tracking context
 *
 * Architecture:
 * - Uses TeeemTableView's built-in multi-level grouping
 * - Foundation API auto-fetches all PO data
 * - Virtual columns (stage_from_task, trade_from_task) expose stage/trade via SmTask
 * - Jotai atoms for grouping state (no component-level useState for state)
 */
export function JobExpensesTab({ jobId }: JobExpensesTabProps) {
  const [, setGroupByColumns] = useAtom(currentGroupByColumnsAtom);
  const [groupingMode, setGroupingMode] = useState<'stage-trade' | 'trade-stage'>('stage-trade');

  // Set initial grouping on mount
  useEffect(() => {
    setGroupByColumns(['stage_from_task', 'trade_from_task']);
  }, [setGroupByColumns]);

  const handleGroupingChange = (value: string) => {
    if (!value) return;
    setGroupingMode(value as 'stage-trade' | 'trade-stage');

    // Update Jotai atom to trigger re-grouping
    if (value === 'stage-trade') {
      setGroupByColumns(['stage_from_task', 'trade_from_task']);
    } else {
      setGroupByColumns(['trade_from_task', 'stage_from_task']);
    }
  };

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId="purchase-orders"
        autoFetchRecords={true}
        initialFilters={[
          { id: crypto.randomUUID(), column: "job_id", operator: "=", value: String(jobId) }
        ]}
        leftActions={
          <RadioGroup
            value={groupingMode}
            onValueChange={handleGroupingChange}
            className="flex items-center gap-4 px-3 py-1.5 border rounded-md bg-white"
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
