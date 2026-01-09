"use client";

import * as React from "react";
import { ComboboxDropdown, ComboboxItem } from "./combobox-dropdown";
import { api } from "@/lib/api";
import { Building2, AlertTriangle } from "lucide-react";
import { Switch } from "./switch";
import { Label } from "./label";
import { cn } from "@/lib/utils";

export interface Supplier {
  id: number;
  display_name?: string;
  name?: string;
  /** Pricebook item IDs this supplier has price histories for (when filtered by forPricebookItemIds) */
  supplied_pricebook_item_ids?: number[];
  /** Employee names that matched the search term (for company-aware search) */
  matched_employees?: string[];
}

interface SupplierComboboxItem extends ComboboxItem {
  supplier: Supplier;
  /** Number of requested items this supplier covers */
  coveredCount?: number;
  /** Total items requested */
  totalRequested?: number;
  /** Employee names that matched the search term */
  matchedEmployees?: string[];
}

interface SupplierPickerProps {
  /** Currently selected supplier */
  value?: Supplier | null;
  /** Called when supplier is selected */
  onSelect: (supplier: Supplier | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Allow clearing the selection */
  clearable?: boolean;
  /** Additional className */
  className?: string;
  /**
   * Filter to suppliers that have price histories for these pricebook item IDs.
   * When provided, only shows suppliers that sell at least one of these items.
   * Each supplier result will include `supplied_pricebook_item_ids`.
   */
  forPricebookItemIds?: number[];
  /**
   * Show a toggle to switch between filtered (suppliers for items) and all suppliers.
   * Only applicable when forPricebookItemIds is provided.
   */
  showAllToggle?: boolean;
}

/**
 * Standard supplier picker component (SSoT)
 *
 * Uses ComboboxDropdown with server-side search against /api/v1/contacts?type=suppliers
 *
 * @example Basic usage:
 * ```tsx
 * <SupplierPicker
 *   value={selectedSupplier}
 *   onSelect={(supplier) => setSelectedSupplier(supplier)}
 *   clearable
 * />
 * ```
 *
 * @example Filter by pricebook items (for Purchase Orders):
 * ```tsx
 * <SupplierPicker
 *   value={selectedSupplier}
 *   onSelect={(supplier) => {
 *     setSelectedSupplier(supplier);
 *     // supplier.supplied_pricebook_item_ids contains IDs this supplier covers
 *   }}
 *   forPricebookItemIds={lineItems.map(li => li.pricebook_item_id).filter(Boolean)}
 *   showAllToggle
 * />
 * ```
 */
export function SupplierPicker({
  value,
  onSelect,
  placeholder = "Search suppliers...",
  disabled = false,
  clearable = false,
  className,
  forPricebookItemIds,
  showAllToggle = false,
}: SupplierPickerProps) {
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Memoize the pricebook item IDs to prevent unnecessary re-fetches
  const pricebookItemIdsKey = React.useMemo(
    () => forPricebookItemIds?.sort().join(",") || "",
    [forPricebookItemIds]
  );

  // Load suppliers on first interaction or when search/filter changes
  const loadSuppliers = React.useCallback(async (search?: string) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ type: "suppliers" });
      if (search) {
        params.set("search", search);
      }

      // Add pricebook item filter if provided and not showing all
      if (forPricebookItemIds?.length && !showAll) {
        params.set("for_pricebook_items", forPricebookItemIds.join(","));
      }

      const response = await api.get<{ success: boolean; contacts: Supplier[] }>(
        `/api/v1/contacts?${params.toString()}`
      );

      if (response?.success && Array.isArray(response.contacts)) {
        setSuppliers(response.contacts);
      } else {
        setSuppliers([]);
      }
    } catch (err) {
      console.error("[SupplierPicker] Failed to load suppliers:", err);
      setSuppliers([]);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, [forPricebookItemIds, showAll]);

  // Reload when showAll changes
  React.useEffect(() => {
    if (hasLoaded) {
      loadSuppliers(searchQuery);
    }
  }, [showAll]);

  // Handle search with debounce
  const handleInputChange = React.useCallback((query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      loadSuppliers(query);
    }, 300);
  }, [loadSuppliers]);

  // Load on first interaction
  const handleFocus = React.useCallback(() => {
    if (!hasLoaded) {
      loadSuppliers();
    }
  }, [hasLoaded, loadSuppliers]);

  // Convert suppliers to combobox items
  const items: SupplierComboboxItem[] = React.useMemo(() => {
    const totalRequested = forPricebookItemIds?.length || 0;

    return suppliers.map((supplier) => {
      const coveredCount = supplier.supplied_pricebook_item_ids?.length || 0;

      return {
        id: String(supplier.id),
        label: supplier.display_name || supplier.name || `Supplier ${supplier.id}`,
        supplier,
        coveredCount,
        totalRequested,
        matchedEmployees: supplier.matched_employees,
      };
    });
  }, [suppliers, forPricebookItemIds]);

  // Find selected item
  const selectedItem = React.useMemo(() => {
    if (!value) return undefined;
    const found = items.find((item) => item.supplier.id === value.id);
    if (found) return found;

    // Value not in current items list - create a placeholder
    return {
      id: String(value.id),
      label: value.display_name || value.name || `Supplier ${value.id}`,
      supplier: value,
      coveredCount: value.supplied_pricebook_item_ids?.length || 0,
      totalRequested: forPricebookItemIds?.length || 0,
    };
  }, [value, items, forPricebookItemIds]);

  const hasItemFilter = forPricebookItemIds && forPricebookItemIds.length > 0;

  return (
    <div className="space-y-2">
      {/* Toggle for showing all suppliers */}
      {showAllToggle && hasItemFilter && (
        <div className="flex items-center gap-2">
          <Switch
            id="show-all-suppliers"
            checked={showAll}
            onCheckedChange={(checked) => {
              setShowAll(checked);
              setHasLoaded(false); // Force reload
            }}
          />
          <Label htmlFor="show-all-suppliers" className="text-xs text-muted-foreground cursor-pointer">
            Show all suppliers
          </Label>
        </div>
      )}

      <div onFocus={handleFocus}>
        <ComboboxDropdown
          items={items}
          selectedItem={selectedItem}
          onSelect={(item: SupplierComboboxItem) => onSelect(item.supplier)}
          placeholder={placeholder}
          disabled={disabled}
          isLoading={isLoading}
          clearable={clearable}
          onClear={() => onSelect(null)}
          onInputChange={handleInputChange}
          disableInternalFilter
          className={className}
          renderListItem={({ isChecked, item }) => {
            const totalRequested = item.totalRequested ?? 0;
            const showCoverage = hasItemFilter && totalRequested > 0;
            const isPartial = showCoverage && item.coveredCount !== undefined && item.coveredCount < totalRequested;
            const hasMatchedEmployees = item.matchedEmployees && item.matchedEmployees.length > 0;

            return (
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {hasMatchedEmployees && (
                    <div className="text-xs text-muted-foreground ml-6 truncate">
                      ↳ Employee: {item.matchedEmployees!.join(", ")}
                    </div>
                  )}
                </div>
                {showCoverage && (
                  <div className={cn(
                    "flex items-center gap-1 text-xs shrink-0",
                    isPartial ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                  )}>
                    {isPartial && <AlertTriangle className="h-3 w-3" />}
                    <span>{item.coveredCount}/{totalRequested} items</span>
                  </div>
                )}
              </div>
            );
          }}
          renderSelectedItem={(item) => {
            const totalRequested = item.totalRequested ?? 0;
            const showCoverage = hasItemFilter && totalRequested > 0;
            const isPartial = showCoverage && item.coveredCount !== undefined && item.coveredCount < totalRequested;

            if (isPartial) {
              return `${item.label} (${item.coveredCount}/${totalRequested} items)`;
            }
            return item.label;
          }}
          emptyResults={
            isLoading
              ? "Loading..."
              : searchQuery
                ? "No suppliers found"
                : hasItemFilter && !showAll
                  ? "No suppliers for these items"
                  : "Type to search suppliers..."
          }
        />
      </div>

      {/* Warning when selected supplier doesn't cover all items */}
      {value && hasItemFilter && selectedItem && selectedItem.coveredCount !== undefined && selectedItem.coveredCount < (selectedItem.totalRequested || 0) && (
        <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md p-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            This supplier only has prices for {selectedItem.coveredCount} of {selectedItem.totalRequested} items.
            Items without prices from this supplier are highlighted below.
          </span>
        </div>
      )}
    </div>
  );
}
