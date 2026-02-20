"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Check, X, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { applyRounding, ROUNDING_OPTIONS, type RoundingMode } from "./PricebookBulkActions";
import { QLD_COUNCILS, formatLga } from "@/lib/constants/lga-constants";

interface Supplier {
  id: number;
  name: string;
  priceOnly?: boolean;
}

interface PriceOnlyContact {
  id: number;
  name: string;
}

interface SupplierPrice {
  price: number;
  dateEffective: string | null;
}

interface ComparisonItem {
  id: number;
  itemCode: string;
  itemName: string;
  currentPrice: number | null;
  defaultSupplierId: number | null;
  defaultSupplierName: string | null;
  prices: Record<string, SupplierPrice>;
  highestPrice: number | null;
  highestSupplierId: number | null;
  priceOnlySupplierId: number | null;
  priceOnlySupplierName: string | null;
  lga: string[];
  onPo?: boolean;
}

interface CompareResponse {
  success: boolean;
  suppliers: Supplier[];
  items: ComparisonItem[];
  priceOnlyContacts: PriceOnlyContact[];
  allSupplierContacts?: PriceOnlyContact[];
}

interface PriceComparisonSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: (number | string)[];
  clearSelection: () => void;
  onRefresh: () => void;
  /** Optional supplier IDs to always include as columns (even if they have no prices for the items) */
  includeSupplierIds?: number[];
  /** Callback to update the PO supplier from comparison view. Supplier id + name passed. */
  onUpdateSupplier?: (supplierId: number, supplierName: string) => void;
  /** Label for the current PO supplier column (shows which supplier is currently selected) */
  currentSupplierLabel?: string;
  /** When true, fetch ALL pricebook items that have prices from discovered suppliers (not just selected IDs) */
  expandToSupplierItems?: boolean;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return `$${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact multi-select popover for LGA values */
function LgaMultiSelect({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (lga: string[]) => void;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`justify-between font-normal ${className ?? "h-8 text-xs w-full"}`}
        >
          <span className="truncate">{formatLga(value)}</span>
          <ChevronDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <div className="flex items-center gap-1 mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2"
            onClick={() => onChange(QLD_COUNCILS.slice())}
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2"
            onClick={() => onChange([])}
          >
            None
          </Button>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {QLD_COUNCILS.map((council) => {
            const isChecked = value.includes(council);
            const short = council.replace(/ (City |Regional )?Council/g, "").trim();
            return (
              <label
                key={council}
                className="flex items-center gap-2 px-1 py-0.5 hover:bg-muted rounded cursor-pointer text-xs"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => {
                    onChange(
                      isChecked
                        ? value.filter((l) => l !== council)
                        : [...value, council]
                    );
                  }}
                />
                <span>{short}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function PriceComparisonSheet({
  open,
  onOpenChange,
  selectedIds,
  clearSelection,
  onRefresh,
  includeSupplierIds,
  onUpdateSupplier,
  currentSupplierLabel,
  expandToSupplierItems,
}: PriceComparisonSheetProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [priceOnlyContacts, setPriceOnlyContacts] = useState<PriceOnlyContact[]>([]);
  const [allSupplierContacts, setAllSupplierContacts] = useState<PriceOnlyContact[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedPrices, setSelectedPrices] = useState<Record<number, string>>({});
  const [selectedPriceSource, setSelectedPriceSource] = useState<Record<number, number>>({});
  const [selectedPriceOnlyContact, setSelectedPriceOnlyContact] = useState<Record<number, string>>({});
  const [selectedLga, setSelectedLga] = useState<Record<number, string[]>>({});
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [priceAdjustment, setPriceAdjustment] = useState<string>("");
  const [roundingMode, setRoundingMode] = useState<RoundingMode>("none");

  // Stabilize selectedIds - parent passes Array.from(selectedRows) which creates
  // a new array reference every render, causing useEffect to re-fire infinitely.
  // Use a serialized key for the dependency and a ref for the actual values.
  const selectedIdsKey = useMemo(() => selectedIds.map(Number).sort((a, b) => a - b).join(","), [selectedIds]);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  // Fetch comparison data when sheet opens
  // Note: toast excluded from deps - it's a new reference every render and would cause infinite loop
  useEffect(() => {
    if (!open || selectedIdsRef.current.length === 0) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const response = await api.post<CompareResponse>(
          "/api/v1/pricebook/compare_all_prices",
          {
            pricebook_item_ids: selectedIdsRef.current.map(Number),
            ...(includeSupplierIds?.length ? { include_supplier_ids: includeSupplierIds } : {}),
            ...(expandToSupplierItems ? { expand_to_supplier_items: true } : {}),
          }
        );

        if (cancelled) return;

        if (response?.success) {
          setSuppliers(response.suppliers);
          setItems(response.items);
          setPriceOnlyContacts(response.priceOnlyContacts || []);
          setAllSupplierContacts(response.allSupplierContacts || []);

          // Auto-select PO rows (or all if no PO context) and pre-fill:
          // 1. Price: default supplier's price > highest price > empty
          // 2. Checkbox: ticked on whichever supplier the price came from
          // 3. Record For: PO supplier (if from PO) > default supplier > price_only contact
          const rows = new Set<number>();
          const prices: Record<number, string> = {};
          const sources: Record<number, number> = {};
          const poContacts: Record<number, string> = {};
          const lgas: Record<number, string[]> = {};
          const poSupplierId = includeSupplierIds?.[0]; // PO supplier if from PO context

          for (const item of response.items) {
            // Only auto-select PO items; additional items start unselected
            if (expandToSupplierItems && item.onPo === false) continue;
            rows.add(item.id);

            // Pick price: prefer default supplier's price, fall back to highest
            const defaultSupplierPrice = item.defaultSupplierId
              ? item.prices[String(item.defaultSupplierId)]
              : null;

            if (defaultSupplierPrice) {
              prices[item.id] = defaultSupplierPrice.price.toFixed(2);
              sources[item.id] = item.defaultSupplierId!;
            } else if (item.highestPrice != null && item.highestSupplierId != null) {
              prices[item.id] = item.highestPrice.toFixed(2);
              sources[item.id] = item.highestSupplierId;
            } else {
              prices[item.id] = "";
            }

            // Record For: PO supplier > default supplier > price_only contact
            if (poSupplierId) {
              poContacts[item.id] = String(poSupplierId);
            } else if (item.defaultSupplierId != null) {
              poContacts[item.id] = String(item.defaultSupplierId);
            } else if (item.priceOnlySupplierId != null) {
              poContacts[item.id] = String(item.priceOnlySupplierId);
            }

            // Pre-fill LGA from existing price history (default to all if has values, empty if not)
            lgas[item.id] = item.lga?.length > 0 ? item.lga : QLD_COUNCILS.slice();
          }
          setSelectedRows(rows);
          setSelectedPrices(prices);
          setSelectedPriceSource(sources);
          setSelectedPriceOnlyContact(poContacts);
          setSelectedLga(lgas);
        }
      } catch (err) {
        console.error("Failed to fetch comparison data:", err);
        toast({
          title: "Failed to Load Prices",
          description: err instanceof Error ? err.message : "An error occurred",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedIdsKey]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setSuppliers([]);
      setItems([]);
      setPriceOnlyContacts([]);
      setAllSupplierContacts([]);
      setSelectedRows(new Set());
      setSelectedPrices({});
      setSelectedPriceSource({});
      setSelectedPriceOnlyContact({});
      setSelectedLga({});
      setEffectiveDate(new Date().toISOString().split("T")[0]);
      setPriceAdjustment("");
      setRoundingMode("none");
    }
  }, [open]);

  const toggleRow = useCallback((id: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedRows(prev => {
      if (prev.size === items.length) return new Set();
      return new Set(items.map(i => i.id));
    });
  }, [items]);

  const setPrice = useCallback((itemId: number, value: string) => {
    setSelectedPrices(prev => ({ ...prev, [itemId]: value }));
  }, []);

  const selectSupplierPrice = useCallback((itemId: number, price: number, supplierId: number) => {
    setSelectedPrices(prev => ({ ...prev, [itemId]: price.toFixed(2) }));
    setSelectedPriceSource(prev => ({ ...prev, [itemId]: supplierId }));
    setSelectedPriceOnlyContact(prev => ({ ...prev, [itemId]: String(supplierId) }));
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  }, []);

  const setPriceOnlyForItem = useCallback((itemId: number, contactId: string) => {
    setSelectedPriceOnlyContact(prev => ({ ...prev, [itemId]: contactId }));
  }, []);

  const setLgaForItem = useCallback((itemId: number, lga: string[]) => {
    setSelectedLga(prev => ({ ...prev, [itemId]: lga }));
  }, []);

  // Mass update: set price_only contact for all selected rows
  const massSetPriceOnly = useCallback((contactId: string) => {
    const clearValue = contactId === "__clear__" ? "" : contactId;
    setSelectedPriceOnlyContact(prev => {
      const next = { ...prev };
      for (const id of selectedRows) {
        next[id] = clearValue;
      }
      return next;
    });
  }, [selectedRows]);

  // Mass update: set LGA for all selected rows
  const massSetLga = useCallback((lga: string[]) => {
    setSelectedLga(prev => {
      const next = { ...prev };
      for (const id of selectedRows) {
        next[id] = lga;
      }
      return next;
    });
  }, [selectedRows]);

  // Parse percentage
  const adjustmentPercent = useMemo(() => {
    const val = parseFloat(priceAdjustment);
    return isNaN(val) ? 0 : val;
  }, [priceAdjustment]);

  // Apply price adjustment % and rounding to all selected prices
  const applyAdjustmentToSelected = useCallback(() => {
    if (adjustmentPercent === 0 && roundingMode === "none") return;
    setSelectedPrices(prev => {
      const next = { ...prev };
      for (const id of selectedRows) {
        const val = parseFloat(next[id]);
        if (isNaN(val) || val === 0) continue;
        let adjusted = val;
        if (adjustmentPercent !== 0) {
          adjusted = val * (1 + adjustmentPercent / 100);
        }
        if (roundingMode !== "none") {
          adjusted = applyRounding(adjusted, roundingMode);
        }
        next[id] = adjusted.toFixed(2);
      }
      return next;
    });
  }, [adjustmentPercent, roundingMode, selectedRows]);

  // "Use All Prices" from a single supplier - fills prices, checkboxes, AND Record For
  const useAllPricesFromSupplier = useCallback((supplierId: number, supplierName: string) => {
    const newPrices = { ...selectedPrices };
    const newSources = { ...selectedPriceSource };
    const newContacts = { ...selectedPriceOnlyContact };
    const newRows = new Set(selectedRows);

    for (const item of items) {
      const sp = item.prices[String(supplierId)];
      if (sp) {
        newPrices[item.id] = sp.price.toFixed(2);
        newSources[item.id] = supplierId;
        newContacts[item.id] = String(supplierId);
        newRows.add(item.id);
      }
    }

    setSelectedPrices(newPrices);
    setSelectedPriceSource(newSources);
    setSelectedPriceOnlyContact(newContacts);
    setSelectedRows(newRows);
    toast({ title: `Selected all prices from ${supplierName}` });
  }, [items, selectedPrices, selectedPriceSource, selectedPriceOnlyContact, selectedRows, toast]);

  // "Record For All" - sets Record For to this supplier for all selected rows (doesn't change prices)
  const recordForAllSupplier = useCallback((supplierId: number, supplierName: string) => {
    setSelectedPriceOnlyContact(prev => {
      const next = { ...prev };
      for (const id of selectedRows) {
        next[id] = String(supplierId);
      }
      return next;
    });
    toast({ title: `Recording all prices for ${supplierName}` });
  }, [selectedRows, toast]);

  // Bulk set default supplier for all selected items
  const [settingDefault, setSettingDefault] = useState(false);
  const bulkSetDefault = useCallback(async (supplierId: number, supplierName: string) => {
    const itemIds = Array.from(selectedRows);
    if (itemIds.length === 0) return;

    setSettingDefault(true);
    try {
      const response = await api.post<{ success: boolean; updated_count: number }>(
        "/api/v1/pricebook/bulk_set_default_supplier",
        { pricebook_item_ids: itemIds, supplier_id: supplierId }
      );
      if (response?.success) {
        toast({ title: `Set ${supplierName} as default supplier for ${response.updated_count} items` });
        // Update local items to reflect the new default supplier
        setItems(prev => prev.map(item =>
          itemIds.includes(item.id)
            ? { ...item, defaultSupplierId: supplierId, defaultSupplierName: supplierName }
            : item
        ));
        // Reset checkboxes, prices, and Record For to the new default supplier
        const newPrices: Record<number, string> = { ...selectedPrices };
        const newSources: Record<number, number> = { ...selectedPriceSource };
        const newContacts: Record<number, string> = { ...selectedPriceOnlyContact };
        for (const item of items) {
          if (!itemIds.includes(item.id)) continue;
          const sp = item.prices[String(supplierId)];
          if (sp) {
            newPrices[item.id] = sp.price.toFixed(2);
            newSources[item.id] = supplierId;
          }
          newContacts[item.id] = String(supplierId);
        }
        setSelectedPrices(newPrices);
        setSelectedPriceSource(newSources);
        setSelectedPriceOnlyContact(newContacts);
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to set default supplier:", err);
      toast({
        title: "Failed to Set Default Supplier",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setSettingDefault(false);
    }
  }, [selectedRows, items, selectedPrices, selectedPriceSource, selectedPriceOnlyContact, toast, onRefresh]);

  // Delete all price histories for a supplier across selected items
  const [deletingPrices, setDeletingPrices] = useState(false);
  const bulkDeletePriceHistories = useCallback(async (supplierId: number, supplierName: string) => {
    const itemIds = Array.from(selectedRows);
    if (itemIds.length === 0) return;

    if (!window.confirm(`Delete all price history from ${supplierName} for ${itemIds.length} selected item(s)?`)) return;

    setDeletingPrices(true);
    try {
      const response = await api.post<{ success: boolean; deleted_count: number }>(
        "/api/v1/pricebook/bulk_delete_price_histories",
        { pricebook_item_ids: itemIds, supplier_id: supplierId }
      );
      if (response?.success) {
        toast({ title: `Deleted ${response.deleted_count} price history record(s) from ${supplierName}` });
        // Remove this supplier's prices from local state
        const updatedItems = items.map(item => {
          if (!itemIds.includes(item.id)) return item;
          const newPrices = { ...item.prices };
          delete newPrices[String(supplierId)];
          // Recalculate highest
          const entries = Object.entries(newPrices);
          const highest = entries.length > 0 ? entries.reduce((max, [, v]) => v.price > max.price ? v : max, entries[0][1]) : null;
          const highestSid = highest ? entries.find(([, v]) => v.price === highest.price)?.[0] : null;
          return {
            ...item,
            prices: newPrices,
            highestPrice: highest?.price ?? null,
            highestSupplierId: highestSid ? parseInt(highestSid) : null,
            priceOnlySupplierId: item.priceOnlySupplierId === supplierId ? null : item.priceOnlySupplierId,
            priceOnlySupplierName: item.priceOnlySupplierId === supplierId ? null : item.priceOnlySupplierName,
          };
        });
        setItems(updatedItems);
        // Remove supplier column if no items have prices from them anymore
        const supplierStillHasPrices = updatedItems.some(item => item.prices[String(supplierId)]);
        if (!supplierStillHasPrices) {
          setSuppliers(prev => prev.filter(s => s.id !== supplierId));
        }
        // Clear selected price/source if it came from this supplier
        setSelectedPrices(prev => {
          const next = { ...prev };
          for (const id of itemIds) {
            if (selectedPriceSource[id] === supplierId) next[id] = "";
          }
          return next;
        });
        setSelectedPriceSource(prev => {
          const next = { ...prev };
          for (const id of itemIds) {
            if (next[id] === supplierId) delete next[id];
          }
          return next;
        });
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to delete price histories:", err);
      toast({
        title: "Failed to Delete Prices",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setDeletingPrices(false);
    }
  }, [selectedRows, selectedPriceSource, toast, onRefresh]);

  // ComboboxDropdown items for "Record For": all supplier contacts (full list), with comparison suppliers first
  const supplierComboItems = useMemo<ComboboxItem[]>(() => {
    const seen = new Set<string>();
    const items: ComboboxItem[] = [];
    // Comparison suppliers first (they're most relevant)
    for (const s of suppliers) {
      const key = String(s.id);
      if (!seen.has(key)) { seen.add(key); items.push({ id: key, label: s.name }); }
    }
    // Then all other supplier contacts from the full list
    for (const c of allSupplierContacts) {
      const key = String(c.id);
      if (!seen.has(key)) { seen.add(key); items.push({ id: key, label: c.name }); }
    }
    // Finally any price-only contacts not already included
    for (const poc of priceOnlyContacts) {
      const key = String(poc.id);
      if (!seen.has(key)) { seen.add(key); items.push({ id: key, label: poc.name }); }
    }
    return items;
  }, [suppliers, allSupplierContacts, priceOnlyContacts]);

  // Sort items: PO items first, then additional supplier items
  const sortedItems = useMemo(() => {
    if (!expandToSupplierItems) return items;
    const poItems = items.filter(i => i.onPo !== false);
    const extraItems = items.filter(i => i.onPo === false);
    return [...poItems, ...extraItems];
  }, [items, expandToSupplierItems]);

  const poItemCount = useMemo(() => items.filter(i => i.onPo !== false).length, [items]);
  const extraItemCount = useMemo(() => items.filter(i => i.onPo === false).length, [items]);

  // Count of rows with valid selected prices
  const applyCount = useMemo(() => {
    let count = 0;
    for (const id of selectedRows) {
      const val = selectedPrices[id];
      if (val && !isNaN(parseFloat(val))) count++;
    }
    return count;
  }, [selectedRows, selectedPrices]);

  const handleApply = useCallback(async (keepOpen = false) => {
    const updates: { item_id: number; new_price: number; price_only_contact_id?: number; lga?: string[] }[] = [];
    for (const id of selectedRows) {
      const val = selectedPrices[id];
      if (val && !isNaN(parseFloat(val))) {
        const update: { item_id: number; new_price: number; price_only_contact_id?: number; lga?: string[] } = {
          item_id: id,
          new_price: parseFloat(val),
        };
        const poContactId = selectedPriceOnlyContact[id];
        if (poContactId) {
          update.price_only_contact_id = Number(poContactId);
        }
        const lga = selectedLga[id];
        if (lga && lga.length > 0) {
          update.lga = lga;
        }
        updates.push(update);
      }
    }

    if (updates.length === 0) return;

    setApplying(true);
    try {
      const response = await api.post<{
        success: boolean;
        updated_count: number;
        unchanged_count: number;
      }>("/api/v1/pricebook/apply_selected_prices", { updates, effective_date: effectiveDate });

      if (response?.success) {
        const parts: string[] = [];
        if (response.updated_count > 0) parts.push(`${response.updated_count} updated`);
        if (response.unchanged_count > 0) parts.push(`${response.unchanged_count} unchanged`);

        toast({
          title: "Prices Applied",
          description: parts.join(", ") || "No changes needed",
        });
        onRefresh();

        if (keepOpen) {
          // Re-fetch comparison data to show updated prices
          try {
            const refreshed = await api.post<CompareResponse>(
              "/api/v1/pricebook/compare_all_prices",
              {
                pricebook_item_ids: selectedIdsRef.current.map(Number),
                ...(includeSupplierIds?.length ? { include_supplier_ids: includeSupplierIds } : {}),
                ...(expandToSupplierItems ? { expand_to_supplier_items: true } : {}),
              }
            );
            if (refreshed?.success) {
              setSuppliers(refreshed.suppliers);
              setItems(refreshed.items);
              setPriceOnlyContacts(refreshed.priceOnlyContacts || []);
              setAllSupplierContacts(refreshed.allSupplierContacts || []);
              // Reset source tracking since prices have been saved
              setSelectedPriceSource({});
            }
          } catch {
            // Ignore refresh errors - data was already saved
          }
        } else {
          onOpenChange(false);
          clearSelection();
        }
      }
    } catch (err) {
      console.error("Failed to apply prices:", err);
      toast({
        title: "Apply Failed",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  }, [selectedRows, selectedPrices, selectedPriceOnlyContact, selectedLga, effectiveDate, toast, onOpenChange, clearSelection, onRefresh, includeSupplierIds]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right-95"
        title="Compare All Supplier Prices"
        className="flex flex-col !p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-4 pb-2 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Compare All Supplier Prices</h2>
              <SheetDescription>
                {expandToSupplierItems && extraItemCount > 0
                  ? `${poItemCount} PO item${poItemCount !== 1 ? "s" : ""} + ${extraItemCount} additional`
                  : `${items.length} item${items.length !== 1 ? "s" : ""}`
                }
                {" "}&middot; {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}
                {" "}&middot; {selectedRows.size} selected
              </SheetDescription>
            </div>
            <div className="flex items-center gap-4">
              {onUpdateSupplier && items.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">PO Supplier</label>
                  <ComboboxDropdown
                    items={supplierComboItems}
                    placeholder="Select supplier..."
                    searchPlaceholder="Search all suppliers..."
                    selectedItem={supplierComboItems.find(i => i.id === String(includeSupplierIds?.[0]))}
                    onSelect={(selected) => onUpdateSupplier(Number(selected.id), selected.label)}
                    className="w-56 h-8 text-sm"
                  />
                </div>
              )}
              {items.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Effective Date</label>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={e => setEffectiveDate(e.target.value)}
                    className="w-40 h-8 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Price Adjustment & Rounding - compact row */}
          {items.length > 0 && (
            <div className="flex items-center gap-4 pt-2 flex-wrap">
              {/* Price Adjustment % */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Adjust %</label>
                <div className="relative w-20">
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="0"
                    value={priceAdjustment}
                    onChange={(e) => setPriceAdjustment(e.target.value)}
                    className="h-7 text-sm pr-6"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                </div>
                {[3, 5, 10].map((pct) => (
                  <Button
                    key={pct}
                    variant="outline"
                    size="sm"
                    onClick={() => setPriceAdjustment(String(pct))}
                    className={`h-7 px-2 text-xs ${adjustmentPercent === pct ? "border-primary bg-primary/5" : ""}`}
                  >
                    +{pct}%
                  </Button>
                ))}
              </div>

              {/* Divider */}
              <div className="w-px h-5 bg-border" />

              {/* Round Up */}
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap mr-1">Round Up</label>
                {ROUNDING_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant="outline"
                    size="sm"
                    onClick={() => setRoundingMode(opt.value)}
                    className={`h-7 px-2 text-xs ${roundingMode === opt.value ? "border-primary bg-primary/5" : ""}`}
                    title={opt.description}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>

              {/* Divider */}
              <div className="w-px h-5 bg-border" />

              {/* Apply button */}
              <Button
                size="sm"
                variant="default"
                className="h-7 px-3 text-xs"
                disabled={adjustmentPercent === 0 && roundingMode === "none"}
                onClick={applyAdjustmentToSelected}
              >
                Apply to Selected
              </Button>

              {/* Status text */}
              {(adjustmentPercent !== 0 || roundingMode !== "none") && (
                <span className="text-xs text-muted-foreground">
                  {adjustmentPercent !== 0 && `${adjustmentPercent > 0 ? "+" : ""}${adjustmentPercent}%`}
                  {adjustmentPercent !== 0 && roundingMode !== "none" && " + "}
                  {roundingMode !== "none" && (
                    roundingMode === "smart"
                      ? "Smart round"
                      : `Round to ${ROUNDING_OPTIONS.find(o => o.value === roundingMode)?.label}`
                  )}
                </span>
              )}
            </div>
          )}
        </SheetHeader>

        {/* Table area */}
        <div className="flex-1 min-h-0 overflow-auto px-6">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner size={32} />
              <span className="ml-3 text-muted-foreground">Loading supplier prices...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              No items to compare
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b">
                    <th className="text-left p-2 w-10 sticky left-0 bg-background z-20">
                      <Checkbox
                        checked={selectedRows.size === items.length}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th className="text-left p-2 min-w-[100px] sticky left-10 bg-background z-20 font-medium">
                      Code
                    </th>
                    <th className="text-left p-2 min-w-[200px] sticky left-[180px] bg-background z-20 font-medium">
                      Item Name
                    </th>
                    <th className="text-right p-2 min-w-[100px] font-medium">
                      Current
                    </th>
                    <th className="text-left p-2 min-w-[140px] font-medium">
                      Default Supplier
                    </th>
                    {suppliers.map(s => {
                      const isCurrentPOSupplier = includeSupplierIds?.includes(s.id);
                      return (
                        <th key={s.id} className={`text-right p-2 min-w-[120px] font-medium align-bottom ${isCurrentPOSupplier ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}>
                          <div className="flex flex-col items-end gap-0.5 h-full">
                            {/* Name + tags - grows to push buttons to bottom */}
                            <div className="flex-1 flex flex-col items-end justify-end gap-0.5">
                              <span>{s.name}</span>
                              {s.priceOnly && (
                                <span className="text-[10px] font-normal text-orange-500 dark:text-orange-400">price only</span>
                              )}
                              {isCurrentPOSupplier && (
                                <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400">
                                  {currentSupplierLabel || "PO supplier"}
                                </span>
                              )}
                            </div>
                            {/* Action buttons - always aligned at bottom across all columns */}
                            <div className="flex flex-col items-end gap-px mt-1 shrink-0">
                              <button
                                className="text-[10px] font-normal text-primary hover:underline cursor-pointer"
                                onClick={() => useAllPricesFromSupplier(s.id, s.name)}
                              >
                                Use All Prices
                              </button>
                              <button
                                className="text-[10px] font-normal text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                                onClick={() => recordForAllSupplier(s.id, s.name)}
                              >
                                Record For All
                              </button>
                              <button
                                className="text-[10px] font-normal text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                                disabled={settingDefault}
                                onClick={() => bulkSetDefault(s.id, s.name)}
                              >
                                Set as Default
                              </button>
                              {onUpdateSupplier && (
                                <button
                                  className={`text-[10px] font-normal hover:underline cursor-pointer ${isCurrentPOSupplier ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"}`}
                                  disabled={!!isCurrentPOSupplier}
                                  onClick={() => onUpdateSupplier(s.id, s.name)}
                                >
                                  {isCurrentPOSupplier ? "PO Supplier ✓" : "Set as PO Supplier"}
                                </button>
                              )}
                              <button
                                className="text-[10px] font-normal text-red-500 dark:text-red-400 hover:underline cursor-pointer"
                                disabled={deletingPrices}
                                onClick={() => bulkDeletePriceHistories(s.id, s.name)}
                              >
                                Delete Prices
                              </button>
                            </div>
                          </div>
                        </th>
                      );
                    })}
                    <th className="text-right p-2 min-w-[130px] font-medium border-l">
                      Selected Price
                    </th>
                    <th className="text-left p-2 min-w-[140px] font-medium border-l">
                      <div className="flex flex-col gap-1">
                        <span>LGA</span>
                        {selectedRows.size > 0 && (
                          <div className="font-normal">
                            <LgaMultiSelect
                              value={QLD_COUNCILS.slice()}
                              onChange={massSetLga}
                              className="h-6 text-[10px] w-full"
                            />
                          </div>
                        )}
                      </div>
                    </th>
                    <th className="text-left p-2 min-w-[200px] sticky right-0 bg-background z-20 font-medium border-l">
                      <div className="flex flex-col gap-1">
                        <span>Record For</span>
                        {supplierComboItems.length > 0 && selectedRows.size > 0 ? (
                          <div className="font-normal">
                            <ComboboxDropdown
                              items={supplierComboItems}
                              placeholder={`Set all ${selectedRows.size} selected...`}
                              searchPlaceholder="Search suppliers..."
                              onSelect={(item) => massSetPriceOnly(item.id)}
                              clearable
                              onClear={() => massSetPriceOnly("__clear__")}
                              className="h-6 text-[10px]"
                            />
                          </div>
                        ) : (
                          <span className="text-[10px] font-normal text-muted-foreground">set for selected rows</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item, idx) => {
                    const isSelected = selectedRows.has(item.id);
                    const selectedVal = selectedPrices[item.id] ?? "";
                    const selectedPoContact = selectedPriceOnlyContact[item.id] ?? "";
                    const itemLga = selectedLga[item.id] ?? [];
                    // Show separator between PO items and additional items
                    const showSeparator = expandToSupplierItems && extraItemCount > 0 &&
                      item.onPo === false && (idx === 0 || sortedItems[idx - 1]?.onPo !== false);

                    return (
                      <React.Fragment key={item.id}>
                      {showSeparator && (
                        <tr className="bg-muted/30">
                          <td colSpan={5 + suppliers.length + 3} className="px-2 py-1 text-xs font-medium text-muted-foreground">
                            Additional price list items (not on PO)
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`border-b hover:bg-muted/50 ${!isSelected ? "opacity-50" : ""}`}
                      >
                        <td className="p-2 sticky left-0 bg-background">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(item.id)}
                          />
                        </td>
                        <td className="p-2 sticky left-10 bg-background font-mono text-xs">
                          {item.itemCode}
                        </td>
                        <td className="p-2 sticky left-[180px] bg-background max-w-[300px] truncate" title={item.itemName}>
                          {item.itemName}
                        </td>
                        <td className="p-2 text-right text-muted-foreground">
                          {formatCurrency(item.currentPrice)}
                        </td>
                        <td className="p-2 text-left text-xs truncate max-w-[180px]" title={item.defaultSupplierName || "None"}>
                          {item.defaultSupplierName || <span className="text-muted-foreground/40">&mdash;</span>}
                        </td>
                        {suppliers.map(s => {
                          const supplierPrice = item.prices[String(s.id)];
                          const isHighest = item.highestSupplierId === s.id && supplierPrice;
                          const isDefault = item.defaultSupplierId === s.id;
                          const isPriceOnly = item.priceOnlySupplierId === s.id;
                          const isCurrentPOSupplier = includeSupplierIds?.includes(s.id);
                          const isSelectedSource = selectedPriceSource[item.id] === s.id;

                          return (
                            <td
                              key={s.id}
                              className={`p-2 text-right cursor-pointer hover:bg-primary/10 transition-colors ${
                                isSelectedSource
                                  ? "bg-emerald-100 dark:bg-emerald-900/40"
                                  : isHighest ? "font-semibold text-green-600 dark:text-green-400" : ""
                              } ${isPriceOnly && !isSelectedSource ? "bg-orange-50 dark:bg-orange-950/30" : ""} ${isCurrentPOSupplier && !isSelectedSource ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                              onClick={() => supplierPrice && selectSupplierPrice(item.id, supplierPrice.price, s.id)}
                              title={
                                supplierPrice
                                  ? `Click to select ${formatCurrency(supplierPrice.price)}${supplierPrice.dateEffective ? ` (effective ${supplierPrice.dateEffective})` : ""}${isDefault ? " (default supplier)" : ""}${isPriceOnly ? " (current price only)" : ""}`
                                  : "No price"
                              }
                            >
                              {supplierPrice ? (
                                <div className="flex flex-col items-end">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Checkbox
                                      checked={isSelectedSource}
                                      className="h-4 w-4 shrink-0"
                                      tabIndex={-1}
                                    />
                                    <span className={isSelectedSource ? "font-semibold" : ""}>
                                      {formatCurrency(supplierPrice.price)}
                                    </span>
                                    {isDefault && (
                                      <span className="text-[10px] text-blue-500 dark:text-blue-400" title="Default supplier">*</span>
                                    )}
                                    {isPriceOnly && (
                                      <span className="text-[10px] text-orange-500 dark:text-orange-400" title="Current price only">PO</span>
                                    )}
                                  </span>
                                  {supplierPrice.dateEffective && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(supplierPrice.dateEffective + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "2-digit" })}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40">&mdash;</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 border-l">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center justify-end">
                              <span className="text-muted-foreground mr-1">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={selectedVal}
                                onChange={e => setPrice(item.id, e.target.value)}
                                className="w-24 h-8 text-right text-sm"
                                placeholder="0.00"
                              />
                            </div>
                            {selectedPriceSource[item.id] != null && (
                              <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                                from {suppliers.find(s => s.id === selectedPriceSource[item.id])?.name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 border-l">
                          <LgaMultiSelect
                            value={itemLga}
                            onChange={(lga) => setLgaForItem(item.id, lga)}
                            className="h-8 text-xs w-full"
                          />
                        </td>
                        <td className="p-2 sticky right-0 bg-background border-l">
                          {supplierComboItems.length > 0 ? (
                            <ComboboxDropdown
                              items={supplierComboItems}
                              placeholder="Select supplier..."
                              searchPlaceholder="Search suppliers..."
                              selectedItem={supplierComboItems.find(i => i.id === selectedPoContact)}
                              onSelect={(selected) => setPriceOnlyForItem(item.id, selected.id)}
                              clearable
                              onClear={() => setPriceOnlyForItem(item.id, "")}
                              className="h-8 text-xs"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground/40">No suppliers available</span>
                          )}
                        </td>
                      </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="px-6 py-4 border-t shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {applyCount} of {selectedRows.size} selected will be updated{selectedRows.size > applyCount && ` (${selectedRows.size - applyCount} have no price)`}
              {suppliers.length > 0 && (
                <span className="ml-2">&middot; <span className="text-green-600 dark:text-green-400 font-medium">Green</span> = highest price</span>
              )}
              {suppliers.length > 0 && (
                <span className="ml-2">&middot; <span className="text-blue-500 dark:text-blue-400">*</span> = default supplier</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button variant="outline" onClick={() => handleApply(true)} disabled={applyCount === 0 || applying}>
                {applying ? (
                  <>
                    <Spinner size={16} className="mr-1" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Apply &amp; Keep Open
                  </>
                )}
              </Button>
              <Button onClick={() => handleApply(false)} disabled={applyCount === 0 || applying}>
                {applying ? (
                  <>
                    <Spinner size={16} className="mr-1" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Apply {applyCount} Price{applyCount !== 1 ? "s" : ""} &amp; Close
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
