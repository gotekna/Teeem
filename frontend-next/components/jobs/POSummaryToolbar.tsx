"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";
import { useFoundationViewState } from "@/lib/view-state";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import type { BOQGroup } from "@/components/ui/bill-of-quantities";

type GroupMode = "flat" | "supplier" | "stage" | "trade" | "cost_centre" | "profit_centre";

const GROUP_MODE_CONFIG: Record<GroupMode, { label: string; columns: string[] }> = {
  flat: { label: "PO / Task", columns: [] },
  supplier: { label: "Supplier", columns: ["supplier_id"] },
  stage: { label: "Stage", columns: ["stage_from_task"] },
  trade: { label: "Trade", columns: ["trade_from_task"] },
  cost_centre: { label: "Cost Centre", columns: ["cost_centre_from_task"] },
  profit_centre: { label: "Profit Centre", columns: ["profit_centre_from_line_items"] },
};

interface BOQSummary {
  po_count: number;
  po_subtotal: number;
  po_gst: number;
  po_total: number;
}

interface POSummaryToolbarProps {
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

export function POSummaryToolbar({ jobId }: POSummaryToolbarProps) {
  const [summary, setSummary] = useState<BOQSummary | null>(null);
  const [groups, setGroups] = useState<BOQGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<GroupMode>("flat");

  // Stage/Trade/Cost Centre filter state (local - drives cascadeFilters on the atom)
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set());
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [selectedCostCentres, setSelectedCostCentres] = useState<Set<string>>(new Set());

  // Write to the shared view state atom that TTV reads from
  const {
    setGroupByColumns,
    setCascadeFilters,
  } = useFoundationViewState(FOUNDATION_SLUGS.PURCHASE_ORDERS);

  // Fetch BOQ summary data (po_count, po_total, groups for filter values)
  useEffect(() => {
    let cancelled = false;
    async function fetchSummary() {
      try {
        setLoading(true);
        const response = await api.get<{
          summary: BOQSummary;
          groups: BOQGroup[];
        }>(`/api/v1/jobs/${jobId}/boq`);
        if (!cancelled) {
          setSummary(response?.summary || null);
          setGroups(response?.groups || []);
        }
      } catch (err) {
        console.error("Failed to load PO summary:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSummary();
    return () => { cancelled = true; };
  }, [jobId]);

  // Extract unique Stage and Trade values from BOQ groups
  const uniqueStages = useMemo(() =>
    [...new Set(groups.map((g) => g.stageName).filter(Boolean) as string[])].sort(),
    [groups]
  );
  const uniqueTrades = useMemo(() =>
    [...new Set(groups.map((g) => g.tradeName).filter(Boolean) as string[])].sort(),
    [groups]
  );
  const uniqueCostCentres = useMemo(() =>
    [...new Set(groups.map((g) => g.costCentreName).filter(Boolean) as string[])].sort(),
    [groups]
  );
  const uniqueProfitCentres = useMemo(() =>
    [...new Set(groups.map((g) => g.profitCentreName).filter(Boolean) as string[])].sort(),
    [groups]
  );

  const hasStages = uniqueStages.length > 0;
  const hasTrades = uniqueTrades.length > 0;
  const hasCostCentres = uniqueCostCentres.length > 0;
  const hasProfitCentres = uniqueProfitCentres.length > 0;
  const hasActiveFilters = selectedStages.size > 0 || selectedTrades.size > 0 || selectedCostCentres.size > 0;

  // Toggle filter helper
  const toggleSetFilter = useCallback((value: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  // Sync group mode to atom
  const handleGroupToggle = useCallback((mode: GroupMode) => {
    setActiveGroup(mode);
    setGroupByColumns(GROUP_MODE_CONFIG[mode].columns);
  }, [setGroupByColumns]);

  // Sync filters to cascade filters on atom
  useEffect(() => {
    const filters: Array<{ id: string; column: string; operator: "=" | "contains"; value: string }> = [];
    selectedStages.forEach((stage) => {
      filters.push({ id: `po-stage-${stage}`, column: "stage_from_task", operator: "=", value: stage });
    });
    selectedTrades.forEach((trade) => {
      filters.push({ id: `po-trade-${trade}`, column: "trade_from_task", operator: "=", value: trade });
    });
    selectedCostCentres.forEach((cc) => {
      filters.push({ id: `po-cc-${cc}`, column: "cost_centre_from_task", operator: "=", value: cc });
    });
    setCascadeFilters(filters);
  }, [selectedStages, selectedTrades, selectedCostCentres, setCascadeFilters]);

  // Reset atom state on unmount to avoid stale grouping
  useEffect(() => {
    return () => {
      setGroupByColumns([]);
      setCascadeFilters([]);
    };
  }, [setGroupByColumns, setCascadeFilters]);

  const clearAllFilters = useCallback(() => {
    setSelectedStages(new Set());
    setSelectedTrades(new Set());
    setSelectedCostCentres(new Set());
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30 shrink-0">
      {/* Summary badges */}
      <div className="flex items-center gap-2">
        {loading ? (
          <Spinner size={14} />
        ) : summary ? (
          <>
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {summary.po_count} POs
            </Badge>
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-muted-foreground whitespace-nowrap">
                Ex: {formatCurrency(summary.po_subtotal)}
              </span>
              <span className="text-muted-foreground/60">+</span>
              <span className="text-muted-foreground whitespace-nowrap">
                GST: {formatCurrency(summary.po_gst)}
              </span>
              <span className="text-muted-foreground/60">=</span>
              <Badge variant="outline" className="text-xs font-mono whitespace-nowrap">
                {formatCurrency(summary.po_total)}
              </Badge>
            </div>
          </>
        ) : null}
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-border" />

      {/* Group-by toggles */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Group:</span>
        <div className="flex items-center rounded-md border border-input bg-background">
          {(Object.keys(GROUP_MODE_CONFIG) as GroupMode[]).map((mode, idx) => {
            return (
              <button
                key={mode}
                onClick={() => handleGroupToggle(mode)}
                className={cn(
                  "px-2.5 py-1 text-xs transition-colors",
                  idx === 0 && "rounded-l-md",
                  // Last visible button gets right rounding
                  "last:rounded-r-md",
                  activeGroup === mode
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                {GROUP_MODE_CONFIG[mode].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter dropdowns */}
      {hasStages && (
        <div className="w-28">
          <MultiSelectFilter
            values={uniqueStages}
            selected={selectedStages}
            onToggle={(v) => toggleSetFilter(v, setSelectedStages)}
            placeholder="Stage..."
            label="Stage"
          />
        </div>
      )}
      {hasTrades && (
        <div className="w-28">
          <MultiSelectFilter
            values={uniqueTrades}
            selected={selectedTrades}
            onToggle={(v) => toggleSetFilter(v, setSelectedTrades)}
            placeholder="Trade..."
            label="Trade"
          />
        </div>
      )}
      {hasCostCentres && (
        <div className="w-36">
          <MultiSelectFilter
            values={uniqueCostCentres}
            selected={selectedCostCentres}
            onToggle={(v) => toggleSetFilter(v, setSelectedCostCentres)}
            placeholder="Cost Centre..."
            label="Cost Centre"
          />
        </div>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="gap-1 h-7 text-xs text-muted-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
