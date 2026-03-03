"use client";

import * as React from "react";
import { ComboboxDropdown, ComboboxItem } from "./combobox-dropdown";
import { api } from "@/lib/api";
import { Tag, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

// Module-level cache - shared across ALL PricebookCodePicker instances on the page.
// ~5,400 items ≈ 1MB. One fetch on first open, then instant client-side filtering.
let _cachedItems: PricebookItem[] | null = null;
let _cacheTimestamp = 0;
let _loadPromise: Promise<PricebookItem[]> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min TTL

function isCacheValid(): boolean {
  return _cachedItems !== null && Date.now() - _cacheTimestamp < CACHE_TTL_MS;
}

async function loadAllPricebookItems(): Promise<PricebookItem[]> {
  if (isCacheValid()) return _cachedItems!;
  // Deduplicate concurrent fetches (multiple pickers opening at once)
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data?: PricebookItem[];
        items?: PricebookItem[];
        pricebook_items?: PricebookItem[];
      }>("/api/v1/pricebook?for=select");
      const items = response?.data || response?.items || response?.pricebook_items || [];
      _cachedItems = Array.isArray(items) ? items : [];
      _cacheTimestamp = Date.now();
    } catch (err) {
      console.error("[PricebookCodePicker] Cache load failed:", err);
      _cachedItems = [];
    } finally {
      _loadPromise = null;
    }
    return _cachedItems!;
  })();

  return _loadPromise;
}

function filterPricebookItems(allItems: PricebookItem[], query: string, supplierId?: number | null): PricebookItem[] {
  let filtered = allItems;

  // Filter by supplier first if provided
  if (supplierId) {
    filtered = filtered.filter(
      (item) => item.default_supplier_id === supplierId || item.default_supplier?.id === supplierId
    );
  }

  if (!query) return filtered.slice(0, 100);
  const q = query.toLowerCase();
  return filtered
    .filter(
      (item) =>
        item.item_code?.toLowerCase().includes(q) ||
        item.item_name?.toLowerCase().includes(q) ||
        item.default_supplier?.display_name?.toLowerCase().includes(q) ||
        item.default_supplier?.name?.toLowerCase().includes(q)
    )
    .slice(0, 100);
}

/** Invalidate the pricebook cache (call after price refresh or pricebook edits) */
export function invalidatePricebookCache() {
  _cachedItems = null;
  _cacheTimestamp = 0;
}

export interface PricebookItem {
  id: number;
  item_code: string;
  item_name: string;
  current_price?: number;
  active_price?: number;
  unit_of_measure?: string;
  gst_code?: string;
  category?: string;
  default_supplier_id?: number;
  default_supplier?: {
    id: number;
    display_name?: string;
    name?: string;
  };
}

interface PricebookComboboxItem extends ComboboxItem {
  pricebookItem: PricebookItem;
}

interface PricebookCodePickerProps {
  /** Currently selected pricebook item */
  value?: PricebookItem | null;
  /** Called when pricebook item is selected */
  onSelect: (item: PricebookItem | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Allow clearing the selection */
  clearable?: boolean;
  /** Additional className */
  className?: string;
  /** Show price in the list items */
  showPrice?: boolean;
  /** Show price in the selected display */
  showPriceInSelection?: boolean;
  /** Supplier ID to filter by (shows Sup/All toggle when provided) */
  supplierId?: number | null;
  /** What to display when an item is selected: "code" (default) or "description" */
  displayMode?: "code" | "description";
}

/**
 * Standard pricebook code/item picker component (SSoT)
 *
 * Uses ComboboxDropdown with client-side filtering against cached pricebook data.
 * When supplierId is provided, shows Sup/All toggle to filter by supplier (like BOQ).
 *
 * @example
 * ```tsx
 * <PricebookCodePicker
 *   value={selectedItem}
 *   onSelect={(item) => {
 *     setSelectedItem(item);
 *     if (item) {
 *       setPrice(item.current_price);
 *       setGstCode(item.gst_code);
 *     }
 *   }}
 *   supplierId={selectedSupplier?.id}
 *   showPrice
 *   clearable
 * />
 * ```
 */
export function PricebookCodePicker({
  value,
  onSelect,
  placeholder = "Search pricebook...",
  disabled = false,
  clearable = false,
  className,
  showPrice = true,
  showPriceInSelection = false,
  supplierId,
  displayMode = "code",
}: PricebookCodePickerProps) {
  const [items, setItems] = React.useState<PricebookItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  // When supplierId is provided, default to filtering by supplier ("Sup" mode)
  const [showAllSuppliers, setShowAllSuppliers] = React.useState(!supplierId);

  // Reset supplier filter mode when supplierId changes
  React.useEffect(() => {
    setShowAllSuppliers(!supplierId);
  }, [supplierId]);

  const effectiveSupplierId = showAllSuppliers ? null : supplierId;

  // Handle search: load cache on first open, then filter client-side (instant)
  const handleInputChange = React.useCallback(async (query: string) => {
    setSearchQuery(query);

    if (!isCacheValid()) {
      setIsLoading(true);
      const allItems = await loadAllPricebookItems();
      setItems(filterPricebookItems(allItems, query, effectiveSupplierId));
      setIsLoading(false);
    } else {
      setItems(filterPricebookItems(_cachedItems!, query, effectiveSupplierId));
    }
  }, [effectiveSupplierId]);

  // Re-filter when supplier toggle changes
  const handleToggleSupplier = React.useCallback(() => {
    const newShowAll = !showAllSuppliers;
    setShowAllSuppliers(newShowAll);
    const newSupplierId = newShowAll ? null : supplierId;
    if (isCacheValid()) {
      setItems(filterPricebookItems(_cachedItems!, searchQuery, newSupplierId));
    }
  }, [showAllSuppliers, supplierId, searchQuery]);

  // Format price for display
  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return null;
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(price);
  };

  // Convert pricebook items to combobox items
  const comboboxItems: PricebookComboboxItem[] = React.useMemo(() => {
    return items.map((item) => ({
      id: item.item_code,
      label: `${item.item_code} - ${item.item_name}`,
      pricebookItem: item,
    }));
  }, [items]);

  // Find selected item
  const selectedComboboxItem = React.useMemo(() => {
    if (!value) return undefined;
    return comboboxItems.find((item) => item.pricebookItem.item_code === value.item_code) || {
      id: value.item_code,
      label: `${value.item_code} - ${value.item_name}`,
      pricebookItem: value,
    };
  }, [value, comboboxItems]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <ComboboxDropdown
        items={comboboxItems}
        selectedItem={selectedComboboxItem}
        onSelect={(item: PricebookComboboxItem) => onSelect(item.pricebookItem)}
        placeholder={placeholder}
        disabled={disabled}
        isLoading={isLoading}
        clearable={clearable}
        onClear={() => onSelect(null)}
        onInputChange={handleInputChange}
        disableInternalFilter
        className="flex-1"
        popoverProps={{ className: "w-[800px]" }}
        renderListItem={({ isChecked, item }) => {
          const price = item.pricebookItem.active_price ?? item.pricebookItem.current_price;
          return (
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2 min-w-0">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{item.pricebookItem.item_code}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.pricebookItem.item_name}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {showPrice && price !== undefined && price !== null && (
                  <div className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                    <DollarSign className="h-3 w-3" />
                    {formatPrice(price)?.replace("$", "")}
                  </div>
                )}
                {item.pricebookItem.default_supplier && (
                  <span className="text-xs text-muted-foreground">
                    · {item.pricebookItem.default_supplier.display_name || item.pricebookItem.default_supplier.name}
                  </span>
                )}
              </div>
            </div>
          );
        }}
        renderSelectedItem={(item) => {
          if (showPriceInSelection) {
            const price = item.pricebookItem.active_price ?? item.pricebookItem.current_price;
            return `${item.pricebookItem.item_code} - ${formatPrice(price) || ""}`;
          }
          return displayMode === "description"
            ? item.pricebookItem.item_name
            : item.pricebookItem.item_code;
        }}
        emptyResults={
          searchQuery && !isLoading
            ? "No pricebook items found"
            : "Type to search pricebook..."
        }
      />
      {supplierId ? (
        <button
          type="button"
          onClick={handleToggleSupplier}
          className={cn(
            "shrink-0 text-[10px] px-1.5 h-7 rounded border transition-colors whitespace-nowrap",
            showAllSuppliers
              ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
              : "bg-muted border-input text-muted-foreground hover:text-foreground"
          )}
          title={
            showAllSuppliers
              ? "Showing all suppliers - click to filter by this PO's supplier"
              : "Showing this supplier only - click to show all"
          }
        >
          {showAllSuppliers ? "All" : "Sup"}
        </button>
      ) : (
        <span
          className="shrink-0 text-[10px] px-1.5 h-7 rounded border border-input bg-muted text-muted-foreground flex items-center"
          title="All suppliers (no supplier selected on PO)"
        >
          All
        </span>
      )}
    </div>
  );
}
