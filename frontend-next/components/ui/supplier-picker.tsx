"use client";

import * as React from "react";
import { ComboboxDropdown, ComboboxItem } from "./combobox-dropdown";
import { api } from "@/lib/api";
import { Building2 } from "lucide-react";

export interface Supplier {
  id: number;
  display_name?: string;
  name?: string;
}

interface SupplierComboboxItem extends ComboboxItem {
  supplier: Supplier;
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
}

/**
 * Standard supplier picker component (SSoT)
 *
 * Uses ComboboxDropdown with server-side search against /api/v1/contacts?type=suppliers
 *
 * @example
 * ```tsx
 * <SupplierPicker
 *   value={selectedSupplier}
 *   onSelect={(supplier) => setSelectedSupplier(supplier)}
 *   clearable
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
}: SupplierPickerProps) {
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Load suppliers on first interaction or when search changes
  const loadSuppliers = React.useCallback(async (search?: string) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ type: "suppliers" });
      if (search) {
        params.set("search", search);
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
  }, []);

  // Initial load on first focus
  React.useEffect(() => {
    if (!hasLoaded && suppliers.length === 0) {
      // Don't auto-load, wait for user interaction
    }
  }, [hasLoaded, suppliers.length]);

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
    return suppliers.map((supplier) => ({
      id: String(supplier.id),
      label: supplier.display_name || supplier.name || `Supplier ${supplier.id}`,
      supplier,
    }));
  }, [suppliers]);

  // Find selected item
  const selectedItem = React.useMemo(() => {
    if (!value) return undefined;
    return items.find((item) => item.supplier.id === value.id) || {
      id: String(value.id),
      label: value.display_name || value.name || `Supplier ${value.id}`,
      supplier: value,
    };
  }, [value, items]);

  return (
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
        renderListItem={({ isChecked, item }) => (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{item.label}</span>
          </div>
        )}
        renderSelectedItem={(item) => item.label}
        emptyResults={
          searchQuery && !isLoading
            ? "No suppliers found"
            : "Type to search suppliers..."
        }
      />
    </div>
  );
}
