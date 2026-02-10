"use client";

import * as React from "react";
import { useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Save, Undo2, Search, Plus, X, ArrowUp, ArrowDown, ArrowUpDown, Check, ChevronsUpDown, ChevronRight, ChevronDown, ChevronsDownUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { CommandList } from "cmdk";

// ============================================================================
// Bill of Quantities - Reusable Component
// ============================================================================
// Generic BOQ table showing line items grouped by parent (PO/template/etc).
// Supports inline quantity editing, adding new lines, and batch save.
//
// Usage contexts:
//   - PO Template Packs: edit quantities before stamping onto a job
//   - Jobs: view/adjust BOQ for existing purchase orders
// ============================================================================

export interface BOQLineItem {
  id: number | string;
  description: string;
  quantity: number;
  unitPrice: number;
  gstCode: string;
  subtotal: number;
  pricebookItemCode?: string | null;
}

export interface BOQGroup {
  id: number | string;
  name: string;
  supplierId?: number | null;
  supplierName?: string | null;
  taskName?: string | null;
  tradeName?: string | null;
  stageName?: string | null;
  stagePosition?: number | null;
  items: BOQLineItem[];
}

/** Map of "groupId:lineItemId" → new quantity */
export type BOQChanges = Map<string, number>;

export interface BOQNewLine {
  tempId: string;
  groupId: number | string;
  description: string;
  quantity: number;
  unitPrice: number;
  gstCode: string;
  pricebookItemId?: number | null;
  pricebookItemCode?: string | null;
}

export interface BOQSavePayload {
  quantityChanges: BOQChanges;
  newLines: BOQNewLine[];
}

type SortColumn = "group" | "supplier" | "description" | "code" | "qty" | "unitPrice" | "gst" | "subtotal";
type SortDirection = "asc" | "desc";

export interface BillOfQuantitiesProps {
  groups: BOQGroup[];
  /** Called with all pending changes when user clicks Save */
  onSave?: (payload: BOQSavePayload) => Promise<void>;
  /** Disables editing */
  readOnly?: boolean;
  /** Loading state */
  loading?: boolean;
  className?: string;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "$0.00";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(value);
}

function changeKey(groupId: number | string, lineId: number | string): string {
  return `${groupId}:${lineId}`;
}

// Subtle alternating group colors (light / dark)
const GROUP_COLORS = [
  { bg: "bg-slate-50/60 dark:bg-slate-800/20" },
  { bg: "bg-sky-50/60 dark:bg-sky-900/20" },
  { bg: "bg-amber-50/50 dark:bg-amber-900/15" },
  { bg: "bg-emerald-50/50 dark:bg-emerald-900/15" },
  { bg: "bg-rose-50/50 dark:bg-rose-900/15" },
  { bg: "bg-violet-50/50 dark:bg-violet-900/15" },
  { bg: "bg-cyan-50/50 dark:bg-cyan-900/15" },
  { bg: "bg-orange-50/50 dark:bg-orange-900/15" },
];

let tempIdCounter = 0;
function nextTempId(): string {
  return `new_${++tempIdCounter}`;
}

type GroupSortBy = "supplier" | "stage" | "trade";

const GROUP_SORT_LABELS: Record<GroupSortBy, string> = {
  supplier: "Supplier",
  stage: "Stage",
  trade: "Trade",
};

export function BillOfQuantities({
  groups,
  onSave,
  readOnly = false,
  loading = false,
  className,
}: BillOfQuantitiesProps) {
  const [changes, setChanges] = useState<BOQChanges>(new Map());
  const [newLines, setNewLines] = useState<BOQNewLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // PO/Task is always the primary grouping; optionally sort groups by a secondary dimension
  const [groupSortBy, setGroupSortBy] = useState<GroupSortBy | null>(null);
  // Expanded cascade sections (by label) - empty = all collapsed by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const canEdit = !readOnly && !!onSave;
  const hasChanges = changes.size > 0 || newLines.length > 0;

  // Stable color assignment: each group keeps its original color regardless of sort/filter
  const groupColorIndex = useMemo(() => {
    const map = new Map<number | string, number>();
    groups.forEach((g, i) => map.set(g.id, i));
    return map;
  }, [groups]);
  const changeCount = changes.size + newLines.length;

  // Extract unique values for multi-select filters
  const uniqueSuppliers = useMemo(() =>
    [...new Set(groups.map((g) => g.supplierName).filter(Boolean) as string[])].sort(),
    [groups]
  );
  const uniqueStages = useMemo(() =>
    [...new Set(groups.map((g) => g.stageName).filter(Boolean) as string[])].sort(),
    [groups]
  );
  const uniqueTrades = useMemo(() =>
    [...new Set(groups.map((g) => g.tradeName).filter(Boolean) as string[])].sort(),
    [groups]
  );
  const hasStages = uniqueStages.length > 0;
  const hasTrades = uniqueTrades.length > 0;
  const hasSuppliers = uniqueSuppliers.length > 0;

  // Sort + column filter state
  const [sortState, setSortState] = useState<{ column: SortColumn; direction: SortDirection } | null>(null);
  const [columnFilters, setColumnFilters] = useState({ group: "", description: "", code: "", gst: "" });
  // Multi-select set filters for supplier, stage, trade
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set());
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());

  const toggleSort = useCallback((column: SortColumn) => {
    setSortState((prev) => {
      if (prev?.column !== column) return { column, direction: "asc" };
      if (prev.direction === "asc") return { column, direction: "desc" };
      return null;
    });
  }, []);

  const updateFilter = useCallback((key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSetFilter = useCallback((set: Set<string>, value: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      Object.values(columnFilters).some((v) => v.trim()) ||
      selectedSuppliers.size > 0 ||
      selectedStages.size > 0 ||
      selectedTrades.size > 0,
    [columnFilters, selectedSuppliers, selectedStages, selectedTrades]
  );

  const clearAllFilters = useCallback(() => {
    setColumnFilters({ group: "", description: "", code: "", gst: "" });
    setSelectedSuppliers(new Set());
    setSelectedStages(new Set());
    setSelectedTrades(new Set());
    setSortState(null);
  }, []);

  // Toggle secondary group sort (click again to deselect)
  const handleSortToggle = useCallback((dim: GroupSortBy) => {
    setGroupSortBy((prev) => (prev === dim ? null : dim));
    setExpandedSections(new Set()); // Reset to all-collapsed when switching dimension
  }, []);

  const toggleSection = useCallback((label: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  // Sort PO groups by selected dimension (groups always stay as POs)
  const displayGroups = useMemo(() => {
    if (!groupSortBy) return groups;
    return [...groups].sort((a, b) => {
      // Stage: sort by schedule master sequence order
      if (groupSortBy === "stage") {
        const aPos = a.stagePosition ?? Infinity;
        const bPos = b.stagePosition ?? Infinity;
        if (aPos !== bPos) return aPos - bPos;
        return (a.stageName || "").localeCompare(b.stageName || "");
      }
      const aVal = groupSortBy === "supplier" ? (a.supplierName || "") : (a.tradeName || "");
      const bVal = groupSortBy === "supplier" ? (b.supplierName || "") : (b.tradeName || "");
      return aVal.localeCompare(bVal);
    });
  }, [groups, groupSortBy]);

  // Get current quantity (edited or original)
  const getQty = useCallback(
    (groupId: number | string, item: BOQLineItem): number => {
      const key = changeKey(groupId, item.id);
      return changes.has(key) ? changes.get(key)! : item.quantity;
    },
    [changes]
  );

  // Handle quantity change
  const handleQtyChange = useCallback(
    (groupId: number | string, lineId: number | string, originalQty: number, value: string) => {
      const parsed = parseFloat(value);
      const newQty = isNaN(parsed) || parsed < 0 ? 0 : parsed;
      const key = changeKey(groupId, lineId);

      setChanges((prev) => {
        const next = new Map(prev);
        if (newQty === originalQty) {
          next.delete(key);
        } else {
          next.set(key, newQty);
        }
        return next;
      });
    },
    []
  );

  // Add a new empty line to a group
  const handleAddLine = useCallback((groupId: number | string) => {
    setNewLines((prev) => [
      ...prev,
      {
        tempId: nextTempId(),
        groupId,
        description: "",
        quantity: 1,
        unitPrice: 0,
        gstCode: "GST",
      },
    ]);
  }, []);

  // Update a pending new line field
  const handleNewLineChange = useCallback(
    (tempId: string, field: keyof BOQNewLine, value: string | number) => {
      setNewLines((prev) =>
        prev.map((nl) => (nl.tempId === tempId ? { ...nl, [field]: value } : nl))
      );
    },
    []
  );

  // Remove a pending new line
  const handleRemoveNewLine = useCallback((tempId: string) => {
    setNewLines((prev) => prev.filter((nl) => nl.tempId !== tempId));
  }, []);

  // Batch update a new line when a pricebook item is selected
  const handleNewLinePricebookSelect = useCallback(
    (tempId: string, item: {
      description: string;
      unitPrice: number;
      gstCode: string;
      pricebookItemId: number;
      pricebookItemCode: string;
    }) => {
      setNewLines((prev) =>
        prev.map((nl) =>
          nl.tempId === tempId
            ? {
                ...nl,
                description: item.description,
                unitPrice: item.unitPrice,
                gstCode: item.gstCode,
                pricebookItemId: item.pricebookItemId,
                pricebookItemCode: item.pricebookItemCode,
              }
            : nl
        )
      );
    },
    []
  );

  // Save all changes
  const handleSave = useCallback(async () => {
    if (!onSave || !hasChanges) return;
    // Validate new lines have descriptions
    const validNewLines = newLines.filter((nl) => nl.description.trim());
    if (newLines.length > 0 && validNewLines.length !== newLines.length) {
      return; // Don't save if there are new lines without descriptions
    }
    try {
      setSaving(true);
      await onSave({ quantityChanges: changes, newLines: validNewLines });
      setChanges(new Map());
      setNewLines([]);
    } finally {
      setSaving(false);
    }
  }, [onSave, changes, newLines, hasChanges]);

  // Discard all changes
  const handleDiscard = useCallback(() => {
    setChanges(new Map());
    setNewLines([]);
  }, []);

  // Get new lines for a specific group
  const getNewLinesForGroup = useCallback(
    (groupId: number | string) => newLines.filter((nl) => nl.groupId === groupId),
    [newLines]
  );

  // Filter + sort groups/items
  const filteredGroups = useMemo(() => {
    let result = displayGroups;

    // 1. Global search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              item.description.toLowerCase().includes(term) ||
              item.pricebookItemCode?.toLowerCase().includes(term) ||
              group.name.toLowerCase().includes(term) ||
              group.supplierName?.toLowerCase().includes(term)
          ),
        }))
        .filter((group) => group.items.length > 0);
    }

    // 2. Column-level filters
    if (columnFilters.group.trim()) {
      const term = columnFilters.group.toLowerCase();
      result = result.filter((g) => g.name.toLowerCase().includes(term));
    }
    // Multi-select set filters (supplier, stage, trade)
    if (selectedSuppliers.size > 0) {
      result = result.filter((g) => g.supplierName && selectedSuppliers.has(g.supplierName));
    }
    if (selectedStages.size > 0) {
      result = result.filter((g) => g.stageName && selectedStages.has(g.stageName));
    }
    if (selectedTrades.size > 0) {
      result = result.filter((g) => g.tradeName && selectedTrades.has(g.tradeName));
    }
    const hasItemFilters =
      columnFilters.description.trim() || columnFilters.code.trim() || columnFilters.gst.trim();
    if (hasItemFilters) {
      result = result
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (
              columnFilters.description.trim() &&
              !(item.description || "").toLowerCase().includes(columnFilters.description.toLowerCase())
            )
              return false;
            if (
              columnFilters.code.trim() &&
              !(item.pricebookItemCode || "").toLowerCase().includes(columnFilters.code.toLowerCase())
            )
              return false;
            if (
              columnFilters.gst.trim() &&
              !(item.gstCode || "").toLowerCase().includes(columnFilters.gst.toLowerCase())
            )
              return false;
            return true;
          }),
        }))
        .filter((group) => group.items.length > 0);
    }

    // 3. Sort
    if (sortState) {
      const { column, direction } = sortState;
      const dir = direction === "asc" ? 1 : -1;

      if (column === "group" || column === "supplier") {
        // Sort groups themselves
        result = [...result].sort((a, b) => {
          const aVal = column === "group" ? a.name : (a.supplierName || "");
          const bVal = column === "group" ? b.name : (b.supplierName || "");
          return aVal.localeCompare(bVal) * dir;
        });
      } else {
        // Sort items within each group
        result = result.map((group) => ({
          ...group,
          items: [...group.items].sort((a, b) => {
            switch (column) {
              case "description":
                return (a.description || "").localeCompare(b.description || "") * dir;
              case "code":
                return (a.pricebookItemCode || "").localeCompare(b.pricebookItemCode || "") * dir;
              case "qty":
                return (getQty(group.id, a) - getQty(group.id, b)) * dir;
              case "unitPrice":
                return (a.unitPrice - b.unitPrice) * dir;
              case "gst":
                return (a.gstCode || "").localeCompare(b.gstCode || "") * dir;
              case "subtotal": {
                const aT = getQty(group.id, a) * a.unitPrice;
                const bT = getQty(group.id, b) * b.unitPrice;
                return (aT - bT) * dir;
              }
              default:
                return 0;
            }
          }),
        }));
      }
    }

    return result;
  }, [displayGroups, searchTerm, columnFilters, selectedSuppliers, selectedStages, selectedTrades, sortState, getQty]);

  // Cascade sections: group POs under Stage/Supplier/Trade headers
  const cascadeSections = useMemo(() => {
    if (!groupSortBy) return null;
    const buckets = new Map<string, { groups: BOQGroup[]; total: number; sortOrder: number }>();
    for (const group of filteredGroups) {
      const key =
        groupSortBy === "supplier" ? (group.supplierName || "No Supplier")
          : groupSortBy === "stage" ? (group.stageName || "No Stage")
            : (group.tradeName || "No Trade");
      if (!buckets.has(key)) buckets.set(key, { groups: [], total: 0, sortOrder: Infinity });
      const bucket = buckets.get(key)!;
      bucket.groups.push(group);
      // For stages, use stagePosition (min sequence_order from schedule master)
      if (groupSortBy === "stage" && group.stagePosition != null) {
        bucket.sortOrder = Math.min(bucket.sortOrder, group.stagePosition);
      }
      for (const item of group.items) {
        bucket.total += getQty(group.id, item) * item.unitPrice;
      }
    }
    return [...buckets.entries()]
      .sort((a, b) => {
        // Stage: sort by schedule master sequence order; others: alphabetical
        if (groupSortBy === "stage") {
          return a[1].sortOrder - b[1].sortOrder;
        }
        return a[0].localeCompare(b[0]);
      })
      .map(([label, { groups: g, total }]) => ({ label, groups: g, total }));
  }, [filteredGroups, groupSortBy, getQty]);

  // Totals (includes new lines)
  const totals = useMemo(() => {
    let totalLines = 0;
    let grandTotal = 0;

    for (const group of groups) {
      for (const item of group.items) {
        totalLines++;
        const qty = getQty(group.id, item);
        grandTotal += qty * item.unitPrice;
      }
    }
    for (const nl of newLines) {
      totalLines++;
      grandTotal += nl.quantity * nl.unitPrice;
    }
    return { totalLines, grandTotal };
  }, [groups, getQty, newLines]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
        <span className="ml-2 text-muted-foreground">Loading bill of quantities...</span>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No line items to display.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-2 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 w-64 text-sm"
            />
          </div>
          <Badge variant="secondary" className="text-xs whitespace-nowrap">
            {totals.totalLines} lines
          </Badge>
          <Badge variant="outline" className="text-xs font-mono whitespace-nowrap">
            {formatCurrency(totals.grandTotal)}
          </Badge>
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Sort by:</span>
            <div className="flex items-center rounded-md border border-input bg-background">
              {/* PO/Task always active */}
              <span className="px-2.5 py-1 text-xs bg-primary text-primary-foreground rounded-l-md">
                PO / Task
              </span>
              {(["supplier", "stage", "trade"] as GroupSortBy[]).map((dim) => {
                if (dim === "stage" && !hasStages) return null;
                if (dim === "trade" && !hasTrades) return null;
                if (dim === "supplier" && !hasSuppliers) return null;
                return (
                  <button
                    key={dim}
                    onClick={() => handleSortToggle(dim)}
                    className={cn(
                      "px-2.5 py-1 text-xs transition-colors last:rounded-r-md",
                      groupSortBy === dim
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {GROUP_SORT_LABELS[dim]}
                  </button>
                );
              })}
            </div>
            {/* Expand/Collapse all cascade sections */}
            {cascadeSections && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={expandedSections.size === cascadeSections.length ? "Collapse all" : "Expand all"}
                onClick={() => {
                  if (expandedSections.size === cascadeSections.length) {
                    setExpandedSections(new Set());
                  } else {
                    setExpandedSections(new Set(cascadeSections.map((s) => s.label)));
                  }
                }}
              >
                {expandedSections.size === cascadeSections.length ? (
                  <ChevronsDownUp className="h-4 w-4" />
                ) : (
                  <ChevronsUpDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          {/* Multi-select dimension filters */}
          {hasStages && (
            <MultiSelectFilter
              values={uniqueStages}
              selected={selectedStages}
              onToggle={(v) => toggleSetFilter(selectedStages, v, setSelectedStages)}
              placeholder="Stage..."
              label="Stage"
            />
          )}
          {hasTrades && (
            <MultiSelectFilter
              values={uniqueTrades}
              selected={selectedTrades}
              onToggle={(v) => toggleSetFilter(selectedTrades, v, setSelectedTrades)}
              placeholder="Trade..."
              label="Trade"
            />
          )}
          {(hasActiveFilters || sortState) && (
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

        {canEdit && hasChanges && (
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs">
              {changeCount} changed
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={saving}
              className="gap-1 h-8"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Discard
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1 h-8"
            >
              {saving ? <Spinner size={14} /> : <Save className="h-3.5 w-3.5" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div
        className="flex-1 min-h-0 overflow-auto border rounded-md"
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <SortableHead column="group" sort={sortState} onSort={toggleSort} className="w-[220px]">
                PO / Task
              </SortableHead>
              <SortableHead column="supplier" sort={sortState} onSort={toggleSort} className="w-[160px]">
                Supplier
              </SortableHead>
              <SortableHead column="description" sort={sortState} onSort={toggleSort}>
                Description
              </SortableHead>
              <SortableHead column="code" sort={sortState} onSort={toggleSort} className="w-[90px]">
                Code
              </SortableHead>
              <SortableHead column="qty" sort={sortState} onSort={toggleSort} className="w-[100px]" align="right">
                Qty
              </SortableHead>
              <SortableHead column="unitPrice" sort={sortState} onSort={toggleSort} className="w-[100px]" align="right">
                Unit Price
              </SortableHead>
              <SortableHead column="gst" sort={sortState} onSort={toggleSort} className="w-[60px]" align="center">
                GST
              </SortableHead>
              <SortableHead column="subtotal" sort={sortState} onSort={toggleSort} className="w-[110px]" align="right">
                Subtotal
              </SortableHead>
            </TableRow>
            {/* Filter row */}
            <TableRow className="bg-muted/30 border-b">
              <TableHead className="py-1 px-2">
                <Input
                  value={columnFilters.group}
                  onChange={(e) => updateFilter("group", e.target.value)}
                  placeholder="Filter..."
                  className="h-6 text-xs px-1.5 font-normal"
                />
              </TableHead>
              <TableHead className="py-1 px-2">
                <MultiSelectFilter
                  values={uniqueSuppliers}
                  selected={selectedSuppliers}
                  onToggle={(v) => toggleSetFilter(selectedSuppliers, v, setSelectedSuppliers)}
                  placeholder="Supplier..."
                />
              </TableHead>
              <TableHead className="py-1 px-2">
                <Input
                  value={columnFilters.description}
                  onChange={(e) => updateFilter("description", e.target.value)}
                  placeholder="Filter..."
                  className="h-6 text-xs px-1.5 font-normal"
                />
              </TableHead>
              <TableHead className="py-1 px-2">
                <Input
                  value={columnFilters.code}
                  onChange={(e) => updateFilter("code", e.target.value)}
                  placeholder="Filter..."
                  className="h-6 text-xs px-1.5 font-normal"
                />
              </TableHead>
              <TableHead className="py-1" />
              <TableHead className="py-1" />
              <TableHead className="py-1 px-1">
                <Input
                  value={columnFilters.gst}
                  onChange={(e) => updateFilter("gst", e.target.value)}
                  placeholder="..."
                  className="h-6 text-xs px-1 font-normal"
                />
              </TableHead>
              <TableHead className="py-1" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cascadeSections ? (
              // Cascade view: collapsible section headers + PO groups within each
              cascadeSections.map((section) => {
                const isExpanded = expandedSections.has(section.label);
                return (
                  <React.Fragment key={section.label}>
                    <TableRow
                      className="bg-muted border-y-2 border-primary/20 cursor-pointer select-none hover:bg-muted/80 transition-colors"
                      onClick={() => toggleSection(section.label)}
                    >
                      <TableCell colSpan={6} className="py-2 px-4 font-semibold text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          )}
                          {section.label}
                        </span>
                        <Badge variant="secondary" className="ml-2 text-xs font-normal">
                          {section.groups.length} PO{section.groups.length !== 1 ? "s" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell colSpan={2} className="py-2 px-4 text-right text-sm font-mono font-semibold">
                        {formatCurrency(section.total)}
                      </TableCell>
                    </TableRow>
                    {isExpanded && section.groups.map((group) => (
                      <BOQGroupRows
                        key={group.id}
                        group={group}
                        groupIndex={groupColorIndex.get(group.id) ?? 0}
                        canEdit={canEdit}
                        changes={changes}
                        newLines={getNewLinesForGroup(group.id)}
                        getQty={getQty}
                        onQtyChange={handleQtyChange}
                        onAddLine={handleAddLine}
                        onNewLineChange={handleNewLineChange}
                        onNewLinePricebookSelect={handleNewLinePricebookSelect}
                        onRemoveNewLine={handleRemoveNewLine}
                      />
                    ))}
                  </React.Fragment>
                );
              })
            ) : (
              // Flat view: PO groups only
              filteredGroups.map((group) => (
                <BOQGroupRows
                  key={group.id}
                  group={group}
                  groupIndex={groupColorIndex.get(group.id) ?? 0}
                  canEdit={canEdit}
                  changes={changes}
                  newLines={getNewLinesForGroup(group.id)}
                  getQty={getQty}
                  onQtyChange={handleQtyChange}
                  onAddLine={handleAddLine}
                  onNewLineChange={handleNewLineChange}
                  onNewLinePricebookSelect={handleNewLinePricebookSelect}
                  onRemoveNewLine={handleRemoveNewLine}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Group rendering with support for new lines
const BOQGroupRows = React.memo(function BOQGroupRows({
  group,
  groupIndex,
  canEdit,
  changes,
  newLines,
  getQty,
  onQtyChange,
  onAddLine,
  onNewLineChange,
  onNewLinePricebookSelect,
  onRemoveNewLine,
}: {
  group: BOQGroup;
  groupIndex: number;
  canEdit: boolean;
  changes: BOQChanges;
  newLines: BOQNewLine[];
  getQty: (groupId: number | string, item: BOQLineItem) => number;
  onQtyChange: (
    groupId: number | string,
    lineId: number | string,
    originalQty: number,
    value: string
  ) => void;
  onAddLine: (groupId: number | string) => void;
  onNewLineChange: (tempId: string, field: keyof BOQNewLine, value: string | number) => void;
  onNewLinePricebookSelect: (tempId: string, item: {
    description: string;
    unitPrice: number;
    gstCode: string;
    pricebookItemId: number;
    pricebookItemCode: string;
  }) => void;
  onRemoveNewLine: (tempId: string) => void;
}) {
  // Total rows that share the PO name/supplier cells (existing + new lines)
  const totalDataRows = group.items.length + newLines.length;
  const color = GROUP_COLORS[groupIndex % GROUP_COLORS.length];

  // Group subtotal (existing + new lines)
  const groupTotal = useMemo(() => {
    let total = group.items.reduce((sum, item) => {
      const qty = getQty(group.id, item);
      return sum + qty * item.unitPrice;
    }, 0);
    for (const nl of newLines) {
      total += nl.quantity * nl.unitPrice;
    }
    return total;
  }, [group, getQty, newLines]);

  return (
    <>
      {/* Existing line items */}
      {group.items.map((item, idx) => {
        const key = changeKey(group.id, item.id);
        const isDirty = changes.has(key);
        const qty = getQty(group.id, item);
        const subtotal = qty * item.unitPrice;

        return (
          <TableRow
            key={item.id}
            className={cn(
              color.bg,
              isDirty && "!bg-amber-50 dark:!bg-amber-950/30"
            )}
            style={idx === 0 ? { scrollSnapAlign: "start" } : undefined}
          >
            {idx === 0 && (
              <TableCell
                rowSpan={totalDataRows}
                className={cn("align-top font-medium text-sm border-r", color.bg)}
              >
                <div className="sticky top-10">
                  {group.name}
                  {group.taskName && group.taskName !== group.name && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {group.taskName}
                    </div>
                  )}
                  {(group.stageName || group.tradeName) && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                      {group.stageName && <span>{group.stageName}</span>}
                      {group.tradeName && <span>{group.tradeName}</span>}
                    </div>
                  )}
                </div>
              </TableCell>
            )}
            {idx === 0 && (
              <TableCell
                rowSpan={totalDataRows}
                className={cn("align-top text-sm text-muted-foreground border-r", color.bg)}
              >
                <div className="sticky top-10">
                  {group.supplierName || (
                    <span className="italic text-xs">No supplier</span>
                  )}
                </div>
              </TableCell>
            )}
            <TableCell className="text-sm py-1.5">{item.description}</TableCell>
            <TableCell className="text-xs text-muted-foreground font-mono py-1.5">
              {item.pricebookItemCode || "—"}
            </TableCell>
            <TableCell className="text-right py-1">
              {canEdit ? (
                <QtyInput
                  value={qty}
                  originalValue={item.quantity}
                  isDirty={isDirty}
                  onChange={(val) =>
                    onQtyChange(group.id, item.id, item.quantity, val)
                  }
                />
              ) : (
                <span className="text-sm font-mono">{qty}</span>
              )}
            </TableCell>
            <TableCell className="text-right text-sm font-mono py-1.5">
              {formatCurrency(item.unitPrice)}
            </TableCell>
            <TableCell className="text-center text-xs py-1.5">
              {item.gstCode}
            </TableCell>
            <TableCell
              className={cn(
                "text-right text-sm font-mono py-1.5",
                isDirty && "font-semibold text-amber-700 dark:text-amber-400"
              )}
            >
              {formatCurrency(subtotal)}
            </TableCell>
          </TableRow>
        );
      })}

      {/* Pending new line items */}
      {newLines.map((nl) => (
        <TableRow key={nl.tempId} className="!bg-green-50 dark:!bg-green-950/30">
          {/* PO/Supplier cells already covered by rowSpan */}
          <TableCell className="py-1">
            <PricebookLineSearch
              value={nl.description}
              supplierId={group.supplierId}
              onChange={(val) =>
                onNewLineChange(nl.tempId, "description", val)
              }
              onSelect={(item) =>
                onNewLinePricebookSelect(nl.tempId, item)
              }
            />
          </TableCell>
          <TableCell className="py-1">
            <Input
              value={nl.gstCode === "GST" ? "" : nl.gstCode}
              onChange={(e) =>
                onNewLineChange(nl.tempId, "gstCode", e.target.value || "GST")
              }
              placeholder="—"
              className="h-7 text-xs font-mono w-full"
            />
          </TableCell>
          <TableCell className="text-right py-1">
            <Input
              type="number"
              min={0}
              step="any"
              value={nl.quantity}
              onChange={(e) =>
                onNewLineChange(
                  nl.tempId,
                  "quantity",
                  parseFloat(e.target.value) || 0
                )
              }
              className="h-7 w-20 text-right text-sm font-mono ml-auto border-green-500"
            />
          </TableCell>
          <TableCell className="text-right py-1">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={nl.unitPrice}
              onChange={(e) =>
                onNewLineChange(
                  nl.tempId,
                  "unitPrice",
                  parseFloat(e.target.value) || 0
                )
              }
              className="h-7 w-24 text-right text-sm font-mono ml-auto border-green-500"
            />
          </TableCell>
          <TableCell className="text-center text-xs py-1.5">
            {nl.gstCode}
          </TableCell>
          <TableCell className="text-right py-1">
            <div className="flex items-center justify-end gap-1">
              <span className="text-sm font-mono font-semibold text-green-700 dark:text-green-400">
                {formatCurrency(nl.quantity * nl.unitPrice)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => onRemoveNewLine(nl.tempId)}
                title="Remove new line"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}

      {/* Group total row with Add Line button */}
      <TableRow className={cn(color.bg, "border-b-2 border-border")}>
        <TableCell colSpan={2} className={cn("border-r py-1", color.bg)}>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddLine(group.id)}
              className="gap-1 h-6 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Add Line
            </Button>
          )}
        </TableCell>
        <TableCell
          colSpan={5}
          className="text-right text-xs font-medium text-muted-foreground py-1"
        >
          {group.name} total:
        </TableCell>
        <TableCell className="text-right text-sm font-mono font-semibold py-1">
          {formatCurrency(groupTotal)}
        </TableCell>
      </TableRow>
    </>
  );
});

// Inline quantity input with highlight on dirty
function QtyInput({
  value,
  originalValue,
  isDirty,
  onChange,
}: {
  value: number;
  originalValue: number;
  isDirty: boolean;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Input
      ref={inputRef}
      type="number"
      min={0}
      step="any"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-7 w-20 text-right text-sm font-mono ml-auto",
        isDirty && "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
      )}
      title={isDirty ? `Original: ${originalValue}` : undefined}
    />
  );
}

// Sortable table header cell
function SortableHead({
  column,
  sort,
  onSort,
  className,
  align,
  children,
}: {
  column: SortColumn;
  sort: { column: SortColumn; direction: SortDirection } | null;
  onSort: (column: SortColumn) => void;
  className?: string;
  align?: "left" | "right" | "center";
  children: React.ReactNode;
}) {
  const isActive = sort?.column === column;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(column)}
        className={cn(
          "group/sort flex items-center gap-1 hover:text-foreground transition-colors w-full",
          align === "right" && "justify-end",
          align === "center" && "justify-center"
        )}
      >
        <span>{children}</span>
        {isActive ? (
          sort.direction === "asc" ? (
            <ArrowUp className="h-3 w-3 text-primary shrink-0" />
          ) : (
            <ArrowDown className="h-3 w-3 text-primary shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover/sort:opacity-40 shrink-0 transition-opacity" />
        )}
      </button>
    </TableHead>
  );
}

// Pricebook item search result from API
interface PricebookSearchResult {
  id: number;
  item_code: string;
  item_name: string;
  current_price: number | null;
  gst_code?: string | null;
  default_supplier_id?: number | null;
  default_supplier?: {
    id: number;
    display_name?: string;
    name?: string;
  } | null;
}

// Inline pricebook search for new line items
// Shows autocomplete dropdown of pricebook items filtered by supplier
function PricebookLineSearch({
  value,
  supplierId,
  onSelect,
  onChange,
}: {
  value: string;
  supplierId?: number | null;
  onSelect: (item: {
    description: string;
    unitPrice: number;
    gstCode: string;
    pricebookItemId: number;
    pricebookItemCode: string;
  }) => void;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<PricebookSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(!supplierId);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchPricebook = useCallback(
    async (query: string, allSuppliers: boolean) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          per_page: "20",
          include_risk: "false",
        });
        if (query.trim()) params.set("search", query);
        if (supplierId && !allSuppliers) {
          params.set("supplier_id", String(supplierId));
        }

        const response = await api.get<{ items?: PricebookSearchResult[] }>(
          `/api/v1/pricebook?${params.toString()}`
        );
        const items = response?.items || [];
        setResults(items);
        setIsOpen(true);
      } catch (err) {
        console.error("[PricebookLineSearch] Search failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [supplierId]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onChange(val);

      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        searchPricebook(val, showAll);
      }, 300);
    },
    [onChange, searchPricebook, showAll]
  );

  const handleFocus = useCallback(() => {
    searchPricebook(value, showAll);
  }, [searchPricebook, value, showAll]);

  const handleSelectItem = useCallback(
    (item: PricebookSearchResult) => {
      onSelect({
        description: item.item_name,
        unitPrice: item.current_price || 0,
        gstCode: item.gst_code || "GST",
        pricebookItemId: item.id,
        pricebookItemCode: item.item_code,
      });
      setIsOpen(false);
    },
    [onSelect]
  );

  const toggleShowAll = useCallback(() => {
    const newVal = !showAll;
    setShowAll(newVal);
    searchPricebook(value, newVal);
  }, [showAll, value, searchPricebook]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Cleanup timeout
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-1">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder="Search pricebook or type description..."
          className="h-7 text-sm"
          autoFocus
        />
        {supplierId && (
          <button
            type="button"
            onClick={toggleShowAll}
            className={cn(
              "shrink-0 text-[10px] px-1.5 h-7 rounded border transition-colors whitespace-nowrap",
              showAll
                ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                : "bg-muted border-input text-muted-foreground hover:text-foreground"
            )}
            title={
              showAll
                ? "Showing all suppliers - click to show only this supplier"
                : "Showing this supplier only - click to show all"
            }
          >
            {showAll ? "All" : "Supplier"}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-popover border rounded-md shadow-lg max-h-[240px] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center p-3">
              <Spinner size={14} />
              <span className="ml-2 text-xs text-muted-foreground">
                Searching pricebook...
              </span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">
              No pricebook items found
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectItem(item)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors border-b last:border-b-0 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-muted-foreground shrink-0">
                    {item.item_code}
                  </span>
                  <span className="truncate">{item.item_name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.current_price != null && (
                    <span className="font-mono text-green-600 dark:text-green-400">
                      ${item.current_price.toFixed(2)}
                    </span>
                  )}
                  {item.default_supplier && (
                    <span className="text-muted-foreground text-[10px] max-w-[100px] truncate">
                      {item.default_supplier.display_name ||
                        item.default_supplier.name}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Multi-select filter popover (used for Supplier, Stage, Trade)
function MultiSelectFilter({
  values,
  selected,
  onToggle,
  placeholder,
  label,
}: {
  values: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  placeholder: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const count = selected.size;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 h-6 px-1.5 text-xs rounded border border-input bg-background hover:bg-muted transition-colors w-full min-w-0",
            count > 0 && "border-primary/50 bg-primary/5"
          )}
        >
          {count > 0 ? (
            <span className="truncate font-medium">
              {label ? `${label}: ` : ""}{count} selected
            </span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label || ""}...`} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
              No matches.
            </CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-auto">
              {values.map((value) => (
                <CommandItem
                  key={value}
                  value={value}
                  onSelect={() => onToggle(value)}
                  className="text-xs gap-2"
                >
                  <Check
                    className={cn(
                      "h-3 w-3 shrink-0",
                      selected.has(value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{value}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
