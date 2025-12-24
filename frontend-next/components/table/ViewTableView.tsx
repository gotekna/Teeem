"use client";

/**
 * ViewTableView
 *
 * A view-only table component with TeeemTableView styling.
 * Use this when you need a table that:
 * - Works with local data (no Foundation API required)
 * - Supports sorting + filtering
 * - Is view-only (no CRUD operations)
 *
 * For editable tables backed by Foundation, use TeeemTableView instead.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import {
  Search,
  X,
  Download,
  Filter,
  Plus,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export interface ViewTableColumn {
  key: string;
  label: string;
  type?: "text" | "number" | "currency" | "date" | "badge" | "boolean" | "choice";
  align?: "left" | "center" | "right";
  width?: number;
  choices?: string[]; // For filter dropdowns
  filterable?: boolean; // Default true
  sortable?: boolean; // Default true
}

export interface ViewTableRow {
  id: number | string;
  [key: string]: unknown;
}

interface CascadeFilter {
  id: string | number;
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "not_contains" | "starts_with" | "ends_with" | "is_empty" | "is_not_empty";
  value: unknown;
}

export interface ViewTableViewProps<T extends ViewTableRow> {
  tableName: string;
  entries: T[];
  columns: ViewTableColumn[];
  onRowClick?: (row: T) => void;
  enableExport?: boolean;
  enableSearch?: boolean;
  enableFilters?: boolean;
  leftActions?: React.ReactNode;
  recordCount?: number; // Override displayed count (e.g., for server-side pagination)
}

// =============================================================================
// Filter Evaluation (inline for simplicity)
// =============================================================================

function evaluateFilter(entry: ViewTableRow, filter: CascadeFilter): boolean {
  const rawValue = entry[filter.column];
  const filterValue = filter.value;

  // Handle objects (like lookups)
  const value =
    typeof rawValue === "object" && rawValue !== null
      ? (rawValue as { display?: string; name?: string; id?: number }).display ||
        (rawValue as { display?: string; name?: string; id?: number }).name ||
        (rawValue as { display?: string; name?: string; id?: number }).id
      : rawValue;

  switch (filter.operator) {
    case "=":
      return value == filterValue;
    case "!=":
      return value != filterValue;
    case ">":
      return Number(value) > Number(filterValue);
    case "<":
      return Number(value) < Number(filterValue);
    case ">=":
      return Number(value) >= Number(filterValue);
    case "<=":
      return Number(value) <= Number(filterValue);
    case "contains":
      return String(value ?? "")
        .toLowerCase()
        .includes(String(filterValue).toLowerCase());
    case "not_contains":
      return !String(value ?? "")
        .toLowerCase()
        .includes(String(filterValue).toLowerCase());
    case "starts_with":
      return String(value ?? "")
        .toLowerCase()
        .startsWith(String(filterValue).toLowerCase());
    case "ends_with":
      return String(value ?? "")
        .toLowerCase()
        .endsWith(String(filterValue).toLowerCase());
    case "is_empty":
      return value == null || value === "";
    case "is_not_empty":
      return value != null && value !== "";
    default:
      return true;
  }
}

// =============================================================================
// Value Formatting
// =============================================================================

function formatValue(
  type: ViewTableColumn["type"],
  value: unknown
): React.ReactNode {
  if (value == null) return <span className="text-muted-foreground">—</span>;

  switch (type) {
    case "currency":
      return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
      }).format(Number(value));

    case "number":
      return new Intl.NumberFormat("en-AU").format(Number(value));

    case "date":
      if (typeof value === "string") {
        const date = new Date(value);
        return date.toLocaleDateString("en-AU");
      }
      return String(value);

    case "boolean":
      return (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5",
            value
              ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
              : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
          )}
        >
          {value ? "Yes" : "No"}
        </Badge>
      );

    case "badge":
      const badgeColors: Record<string, string> = {
        active: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
        pending: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
        completed: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
        archived: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400",
        error: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
        failed: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
      };
      const statusKey = String(value).toLowerCase();
      const colorClass = badgeColors[statusKey] || "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400";
      return (
        <Badge variant="outline" className={cn("text-[10px] px-1.5", colorClass)}>
          {String(value).toUpperCase()}
        </Badge>
      );

    default:
      return String(value);
  }
}

// =============================================================================
// Filter Item Component
// =============================================================================

interface FilterItemProps {
  filter: CascadeFilter;
  columns: ViewTableColumn[];
  onUpdate: (id: string | number, updates: Partial<CascadeFilter>) => void;
  onRemove: (id: string | number) => void;
}

function FilterItem({ filter, columns, onUpdate, onRemove }: FilterItemProps) {
  const column = columns.find((c) => c.key === filter.column);
  const isBooleanColumn = column?.type === "boolean";
  const isChoiceColumn = column?.type === "choice" || column?.type === "badge";
  const isNumericColumn = column?.type === "number" || column?.type === "currency";

  // Build column items for searchable dropdown
  const columnItems: ComboboxItem[] = columns
    .filter((c) => c.filterable !== false)
    .map((col) => ({
      id: col.key,
      label: col.label,
    }));

  const selectedColumn = columnItems.find((item) => item.id === filter.column);

  // Render value input based on column type (matches TeeemTableView's ViewManagerSheet)
  const renderValueInput = () => {
    if (["is_empty", "is_not_empty"].includes(filter.operator)) {
      return null;
    }

    // Boolean column - show Yes/No dropdown
    if (isBooleanColumn) {
      return (
        <Select
          value={filter.value === true || filter.value === "true" ? "true" : filter.value === false || filter.value === "false" ? "false" : ""}
          onValueChange={(value) => onUpdate(filter.id, { value: value === "true" })}
        >
          <SelectTrigger className="w-[80px] h-8">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // Choice/Badge column - show searchable choices dropdown (like TeeemTableView)
    if (isChoiceColumn && column?.choices && column.choices.length > 0) {
      const choiceItems: ComboboxItem[] = column.choices.map((choice) => ({
        id: choice,
        label: choice,
      }));
      const selectedChoice = choiceItems.find((item) => item.id === String(filter.value || ""));

      return (
        <div className="w-[140px]">
          <ComboboxDropdown
            items={choiceItems}
            selectedItem={selectedChoice}
            onSelect={(item) => onUpdate(filter.id, { value: item.id })}
            placeholder="Search value..."
            searchInTrigger={true}
            popoverProps={{ className: "min-w-[200px] w-auto" }}
          />
        </div>
      );
    }

    // Default text input
    return (
      <Input
        className="w-[140px] h-8"
        value={String(filter.value || "")}
        onChange={(e) => onUpdate(filter.id, { value: e.target.value })}
        placeholder="Value..."
      />
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-background rounded border">
      {/* Column selector - searchable dropdown like TeeemTableView */}
      <div className="w-[140px]">
        <ComboboxDropdown
          items={columnItems}
          selectedItem={selectedColumn}
          onSelect={(item) => onUpdate(filter.id, { column: item.id, value: "" })}
          placeholder="Search column..."
          searchInTrigger={true}
          popoverProps={{ className: "min-w-[200px] w-auto" }}
        />
      </div>

      {/* Operator selector - matches TeeemTableView style */}
      <Select
        value={filter.operator}
        onValueChange={(value) =>
          onUpdate(filter.id, { operator: value as CascadeFilter["operator"] })
        }
      >
        <SelectTrigger className="w-[90px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="contains">contains</SelectItem>
          <SelectItem value="=">=</SelectItem>
          <SelectItem value="!=">≠</SelectItem>
          {isNumericColumn && (
            <>
              <SelectItem value=">">{">"}</SelectItem>
              <SelectItem value="<">{"<"}</SelectItem>
              <SelectItem value=">=">≥</SelectItem>
              <SelectItem value="<=">≤</SelectItem>
            </>
          )}
          <SelectItem value="is_empty">empty</SelectItem>
          <SelectItem value="is_not_empty">not empty</SelectItem>
        </SelectContent>
      </Select>

      {/* Value input */}
      {renderValueInput()}

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(filter.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ViewTableView<T extends ViewTableRow>({
  tableName,
  entries,
  columns,
  onRowClick,
  enableExport = true,
  enableSearch = true,
  enableFilters = true,
  leftActions,
  recordCount,
}: ViewTableViewProps<T>) {
  // State
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<CascadeFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [searchValue, setSearchValue] = useState("");

  // Debounced search
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setSearch(value);
    }, 300);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchValue("");
    setSearch("");
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Filter handlers
  const addFilter = useCallback(() => {
    const firstColumn = columns.find((c) => c.filterable !== false);
    if (!firstColumn) return;

    setFilters((prev) => [
      ...prev,
      {
        id: `filter-${Date.now()}`,
        column: firstColumn.key,
        operator: "contains",
        value: "",
      },
    ]);
    setShowFilters(true);
  }, [columns]);

  const updateFilter = useCallback(
    (id: string | number, updates: Partial<CascadeFilter>) => {
      setFilters((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      );
    },
    []
  );

  const removeFilter = useCallback((id: string | number) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters([]);
    setSearch("");
    setSearchValue("");
  }, []);

  // Sort handler
  const handleSort = useCallback((columnKey: string) => {
    setSortColumn((prev) => {
      if (prev === columnKey) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        return columnKey;
      }
      setSortDirection("asc");
      return columnKey;
    });
  }, []);

  // Filter and sort entries
  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((entry) =>
        columns.some((col) => {
          const value = entry[col.key];
          if (value == null) return false;
          return String(value).toLowerCase().includes(searchLower);
        })
      );
    }

    // Apply cascade filters
    if (filters.length > 0) {
      result = result.filter((entry) =>
        filters.every((filter) => {
          // Skip filters without a value (except is_empty/is_not_empty)
          if (
            !["is_empty", "is_not_empty"].includes(filter.operator) &&
            (filter.value === "" || filter.value == null)
          ) {
            return true;
          }
          return evaluateFilter(entry, filter);
        })
      );
    }

    // Apply sorting
    if (sortColumn) {
      const column = columns.find((c) => c.key === sortColumn);
      result.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        // Handle nulls
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDirection === "asc" ? 1 : -1;
        if (bVal == null) return sortDirection === "asc" ? -1 : 1;

        // Numeric comparison for number/currency
        if (column?.type === "number" || column?.type === "currency") {
          const aNum = Number(aVal);
          const bNum = Number(bVal);
          return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
        }

        // String comparison
        const aStr = String(aVal);
        const bStr = String(bVal);
        const comparison = aStr.localeCompare(bStr);
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [entries, search, filters, sortColumn, sortDirection, columns]);

  // Export to CSV
  const handleExport = useCallback(() => {
    const csvContent = [
      columns.map((c) => c.label).join(","),
      ...filteredAndSortedEntries.map((row) =>
        columns
          .map((col) => {
            const value = row[col.key];
            if (value == null) return "";
            // Escape quotes and wrap in quotes if contains comma
            const str = String(value);
            if (str.includes(",") || str.includes('"')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${tableName.toLowerCase().replace(/\s+/g, "-")}-export.csv`;
    link.click();
  }, [tableName, columns, filteredAndSortedEntries]);

  const activeFilterCount = filters.length + (search ? 1 : 0);
  const displayCount = recordCount ?? filteredAndSortedEntries.length;
  const totalCount = recordCount ?? entries.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header - matches TeeemTableView layout */}
      <div className="px-4 py-2 border-b flex items-center justify-between shrink-0">
        {/* Left side: leftActions + search */}
        <div className="flex items-center gap-2 flex-1">
          {leftActions}
          {enableSearch && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={handleSearchChange}
                placeholder="Search across all fields..."
                className="pl-9 pr-9 h-9"
              />
              {searchValue && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right side: title + count + Filters button + Export */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{tableName}</h3>
            <span className="text-sm text-muted-foreground">
              {displayCount} {displayCount !== totalCount && `of ${totalCount}`} records
            </span>
          </div>

          <div className="flex items-center gap-2">
            {enableFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(true)}
                className={cn(filters.length > 0 && "border-primary")}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {filters.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {filters.length}
                  </Badge>
                )}
              </Button>
            )}
            {enableExport && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filters Sheet - matches TeeemTableView's ViewManagerSheet pattern */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              View Filter
              {filters.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filters.length} active
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            <div className="border rounded-lg p-3">
              {/* Header with +Rule and Clear All */}
              <div className="flex items-center gap-2 mb-3">
                <Button variant="outline" size="sm" onClick={addFilter}>
                  <Plus className="h-3 w-3 mr-1" />
                  Rule
                </Button>
                {filters.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive"
                    onClick={clearAllFilters}
                  >
                    Clear All
                  </Button>
                )}
              </div>

              {/* Rules */}
              <div className="space-y-2">
                {filters.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2 italic">
                    No rules. Click +Rule to add one.
                  </p>
                ) : (
                  filters.map((filter) => (
                    <FilterItem
                      key={filter.id}
                      filter={filter}
                      columns={columns}
                      onUpdate={updateFilter}
                      onRemove={removeFilter}
                    />
                  ))
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="h-8 bg-muted/30">
              {columns.map((col) => {
                const isSortable = col.sortable !== false;
                const isSorted = sortColumn === col.key;

                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "h-7 text-[11px] font-medium select-none",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      isSortable && "cursor-pointer hover:bg-muted/50"
                    )}
                    style={{ width: col.width }}
                    onClick={() => isSortable && handleSort(col.key)}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-1",
                        col.align === "right" && "justify-end",
                        col.align === "center" && "justify-center"
                      )}
                    >
                      {col.label}
                      {isSortable && (
                        <span className="text-muted-foreground">
                          {isSorted ? (
                            sortDirection === "asc" ? (
                              <ChevronUp className="h-3 w-3 text-primary" />
                            ) : (
                              <ChevronDown className="h-3 w-3 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </span>
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedEntries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {search || filters.length > 0
                    ? "No results match your filters"
                    : "No data available"}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedEntries.map((row, index) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "h-7 hover:bg-accent/50",
                    onRowClick && "cursor-pointer",
                    index % 2 === 1 && "bg-muted/20"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "py-1 text-[11px]",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center"
                      )}
                    >
                      {formatValue(col.type, row[col.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t text-xs text-muted-foreground shrink-0">
        Showing {filteredAndSortedEntries.length} of {entries.length} records
        {(search || filters.length > 0) && " (filtered)"}
      </div>
    </div>
  );
}
