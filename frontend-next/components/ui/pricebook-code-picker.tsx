"use client";

import * as React from "react";
import { ComboboxDropdown, ComboboxItem } from "./combobox-dropdown";
import { api } from "@/lib/api";
import { Tag, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

/**
 * Standard pricebook code/item picker component (SSoT)
 *
 * Uses ComboboxDropdown with server-side search against /api/v1/pricebook
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
}: PricebookCodePickerProps) {
  const [items, setItems] = React.useState<PricebookItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Load pricebook items
  const loadItems = React.useCallback(async (search?: string) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ per_page: "100" });
      if (search) {
        params.set("search", search);
      }

      const response = await api.get<{
        success: boolean;
        data?: PricebookItem[];
        items?: PricebookItem[];
        pricebook_items?: PricebookItem[];
      }>(
        `/api/v1/pricebook?${params.toString()}`
      );

      // Handle different API response formats
      const responseItems = response?.data || response?.items || response?.pricebook_items || [];
      if (Array.isArray(responseItems)) {
        setItems(responseItems);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error("[PricebookCodePicker] Failed to load items:", err);
      setItems([]);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, []);

  // Handle search with debounce
  const handleInputChange = React.useCallback((query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If no items loaded yet, load immediately (first interaction)
    // Otherwise debounce the search
    if (!hasLoaded) {
      loadItems(query);
    } else {
      searchTimeoutRef.current = setTimeout(() => {
        loadItems(query);
      }, 300);
    }
  }, [loadItems, hasLoaded]);

  // Load items when dropdown opens (triggered by onInputChange with empty string)
  // This is now handled by the ComboboxDropdown's focus mechanism

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
      className={className}
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
        return item.pricebookItem.item_code;
      }}
      emptyResults={
        searchQuery && !isLoading
          ? "No pricebook items found"
          : "Type to search pricebook..."
      }
    />
  );
}
