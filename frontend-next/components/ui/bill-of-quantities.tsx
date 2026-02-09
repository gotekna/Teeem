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
import { Save, Undo2, Search, Plus, X, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  supplierName?: string | null;
  taskName?: string | null;
  tradeName?: string | null;
  stageName?: string | null;
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
}

export interface BOQSavePayload {
  quantityChanges: BOQChanges;
  newLines: BOQNewLine[];
}

export type BOQGroupMode = "po" | "supplier" | "stage" | "trade";

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
  { bg: "bg-slate-50/60 dark:bg-slate-800/20", side: "bg-slate-100/80 dark:bg-slate-800/30" },
  { bg: "bg-sky-50/60 dark:bg-sky-900/20", side: "bg-sky-100/80 dark:bg-sky-900/30" },
  { bg: "bg-amber-50/50 dark:bg-amber-900/15", side: "bg-amber-100/70 dark:bg-amber-900/25" },
  { bg: "bg-emerald-50/50 dark:bg-emerald-900/15", side: "bg-emerald-100/70 dark:bg-emerald-900/25" },
  { bg: "bg-rose-50/50 dark:bg-rose-900/15", side: "bg-rose-100/70 dark:bg-rose-900/25" },
  { bg: "bg-violet-50/50 dark:bg-violet-900/15", side: "bg-violet-100/70 dark:bg-violet-900/25" },
  { bg: "bg-cyan-50/50 dark:bg-cyan-900/15", side: "bg-cyan-100/70 dark:bg-cyan-900/25" },
  { bg: "bg-orange-50/50 dark:bg-orange-900/15", side: "bg-orange-100/70 dark:bg-orange-900/25" },
];

let tempIdCounter = 0;
function nextTempId(): string {
  return `new_${++tempIdCounter}`;
}

const GROUP_MODE_LABELS: Record<BOQGroupMode, string> = {
  po: "PO / Task",
  supplier: "Supplier",
  stage: "Stage",
  trade: "Trade",
};

/** Regroup flat line items by a different key (supplier, stage, trade) */
function regroupBy(groups: BOQGroup[], mode: BOQGroupMode): BOQGroup[] {
  if (mode === "po") return groups;

  const buckets = new Map<string, BOQGroup>();

  for (const group of groups) {
    const key =
      mode === "supplier"
        ? group.supplierName || "No Supplier"
        : mode === "stage"
          ? group.stageName || "No Stage"
          : group.tradeName || "No Trade";

    if (!buckets.has(key)) {
      buckets.set(key, {
        // Use a synthetic ID so change keys still reference original group:line
        id: `${mode}:${key}`,
        name: key,
        supplierName: mode === "supplier" ? key : null,
        taskName: null,
        tradeName: mode === "trade" ? key : null,
        stageName: mode === "stage" ? key : null,
        items: [],
      });
    }

    // Items keep their original IDs for change tracking
    // Prefix with original group ID so save payload can resolve back
    for (const item of group.items) {
      buckets.get(key)!.items.push({
        ...item,
        // Encode original groupId into the item ID for save resolution
        id: `${group.id}:${item.id}`,
        description: `${item.description}`,
      });
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.name.localeCompare(b.name));
}

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
  const [groupMode, setGroupMode] = useState<BOQGroupMode>("po");

  // Editing only supported in PO mode (original grouping preserves save keys)
  const canEdit = !readOnly && !!onSave && groupMode === "po";
  const hasChanges = changes.size > 0 || newLines.length > 0;
  const changeCount = changes.size + newLines.length;

  // Check if alternate groupings have data
  const hasStages = useMemo(() => groups.some((g) => g.stageName), [groups]);
  const hasTrades = useMemo(() => groups.some((g) => g.tradeName), [groups]);
  const hasSuppliers = useMemo(() => groups.some((g) => g.supplierName), [groups]);

  // Sort + column filter state
  const [sortState, setSortState] = useState<{ column: SortColumn; direction: SortDirection } | null>(null);
  const [columnFilters, setColumnFilters] = useState({ group: "", supplier: "", description: "", code: "", gst: "" });

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

  const hasActiveFilters = useMemo(
    () => Object.values(columnFilters).some((v) => v.trim()),
    [columnFilters]
  );

  const clearAllFilters = useCallback(() => {
    setColumnFilters({ group: "", supplier: "", description: "", code: "", gst: "" });
    setSortState(null);
  }, []);

  // Reset filters when group mode changes
  const handleGroupModeChange = useCallback((mode: BOQGroupMode) => {
    setGroupMode(mode);
    setColumnFilters({ group: "", supplier: "", description: "", code: "", gst: "" });
    setSortState(null);
  }, []);

  // Regroup when mode changes
  const displayGroups = useMemo(
    () => regroupBy(groups, groupMode),
    [groups, groupMode]
  );

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
    if (columnFilters.supplier.trim()) {
      const term = columnFilters.supplier.toLowerCase();
      result = result.filter((g) =>
        (g.supplierName || "").toLowerCase().includes(term)
      );
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
              !item.description.toLowerCase().includes(columnFilters.description.toLowerCase())
            )
              return false;
            if (
              columnFilters.code.trim() &&
              !(item.pricebookItemCode || "").toLowerCase().includes(columnFilters.code.toLowerCase())
            )
              return false;
            if (
              columnFilters.gst.trim() &&
              !item.gstCode.toLowerCase().includes(columnFilters.gst.toLowerCase())
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
                return a.description.localeCompare(b.description) * dir;
              case "code":
                return (a.pricebookItemCode || "").localeCompare(b.pricebookItemCode || "") * dir;
              case "qty":
                return (getQty(group.id, a) - getQty(group.id, b)) * dir;
              case "unitPrice":
                return (a.unitPrice - b.unitPrice) * dir;
              case "gst":
                return a.gstCode.localeCompare(b.gstCode) * dir;
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
  }, [displayGroups, searchTerm, columnFilters, sortState, getQty]);

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
            <span className="text-xs text-muted-foreground whitespace-nowrap">Group by:</span>
            <div className="flex items-center rounded-md border border-input bg-background">
              {(["po", "supplier", "stage", "trade"] as BOQGroupMode[]).map((mode) => {
                // Hide options with no data
                if (mode === "stage" && !hasStages) return null;
                if (mode === "trade" && !hasTrades) return null;
                if (mode === "supplier" && !hasSuppliers) return null;
                return (
                  <button
                    key={mode}
                    onClick={() => handleGroupModeChange(mode)}
                    className={cn(
                      "px-2.5 py-1 text-xs transition-colors first:rounded-l-md last:rounded-r-md",
                      groupMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {GROUP_MODE_LABELS[mode]}
                  </button>
                );
              })}
            </div>
          </div>
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
        style={{ scrollSnapType: "y proximity" }}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <SortableHead column="group" sort={sortState} onSort={toggleSort} className="w-[220px]">
                {GROUP_MODE_LABELS[groupMode]}
              </SortableHead>
              <SortableHead column="supplier" sort={sortState} onSort={toggleSort} className="w-[160px]">
                {groupMode === "supplier" ? "PO / Task" : "Supplier"}
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
                <Input
                  value={columnFilters.supplier}
                  onChange={(e) => updateFilter("supplier", e.target.value)}
                  placeholder="Filter..."
                  className="h-6 text-xs px-1.5 font-normal"
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
            {filteredGroups.map((group, groupIndex) => (
              <BOQGroupRows
                key={group.id}
                group={group}
                groupIndex={groupIndex}
                groupMode={groupMode}
                canEdit={canEdit}
                changes={changes}
                newLines={getNewLinesForGroup(group.id)}
                getQty={getQty}
                onQtyChange={handleQtyChange}
                onAddLine={handleAddLine}
                onNewLineChange={handleNewLineChange}
                onRemoveNewLine={handleRemoveNewLine}
              />
            ))}
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
  groupMode,
  canEdit,
  changes,
  newLines,
  getQty,
  onQtyChange,
  onAddLine,
  onNewLineChange,
  onRemoveNewLine,
}: {
  group: BOQGroup;
  groupIndex: number;
  groupMode: BOQGroupMode;
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
                className={cn("align-top font-medium text-sm border-r", color.side)}
              >
                <div className="sticky top-10">
                  {group.name}
                  {/* Show extra context based on group mode */}
                  {groupMode === "po" && (
                    <>
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
                    </>
                  )}
                </div>
              </TableCell>
            )}
            {idx === 0 && (
              <TableCell
                rowSpan={totalDataRows}
                className={cn("align-top text-sm text-muted-foreground border-r", color.side)}
              >
                <div className="sticky top-10">
                  {groupMode === "supplier" ? (
                    // When grouped by supplier, show PO count
                    <span className="italic text-xs">{group.items.length} items</span>
                  ) : (
                    group.supplierName || (
                      <span className="italic text-xs">No supplier</span>
                    )
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
            <Input
              value={nl.description}
              onChange={(e) =>
                onNewLineChange(nl.tempId, "description", e.target.value)
              }
              placeholder="Line item description..."
              className="h-7 text-sm"
              autoFocus
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
        <TableCell colSpan={2} className={cn("border-r py-1", color.side)}>
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
