"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Check, X } from "lucide-react";
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
import { useToast } from "@/components/ui/use-toast";

interface Supplier {
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
}

interface CompareResponse {
  success: boolean;
  suppliers: Supplier[];
  items: ComparisonItem[];
}

interface PriceComparisonSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: (number | string)[];
  clearSelection: () => void;
  onRefresh: () => void;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return `$${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PriceComparisonSheet({
  open,
  onOpenChange,
  selectedIds,
  clearSelection,
  onRefresh,
}: PriceComparisonSheetProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedPrices, setSelectedPrices] = useState<Record<number, string>>({});

  // Fetch comparison data when sheet opens
  // Note: toast excluded from deps - it's a new reference every render and would cause infinite loop
  useEffect(() => {
    if (!open || selectedIds.length === 0) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const response = await api.post<CompareResponse>(
          "/api/v1/pricebook/compare_all_prices",
          { pricebook_item_ids: selectedIds.map(Number) }
        );

        if (cancelled) return;

        if (response?.success) {
          setSuppliers(response.suppliers);
          setItems(response.items);

          // Auto-select all rows and pre-fill with highest price
          const rows = new Set<number>();
          const prices: Record<number, string> = {};
          for (const item of response.items) {
            rows.add(item.id);
            if (item.highestPrice != null) {
              prices[item.id] = item.highestPrice.toFixed(2);
            } else {
              prices[item.id] = "";
            }
          }
          setSelectedRows(rows);
          setSelectedPrices(prices);
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
  }, [open, selectedIds]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setSuppliers([]);
      setItems([]);
      setSelectedRows(new Set());
      setSelectedPrices({});
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

  const selectSupplierPrice = useCallback((itemId: number, price: number) => {
    setSelectedPrices(prev => ({ ...prev, [itemId]: price.toFixed(2) }));
    // Also make sure the row is selected
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  }, []);

  // Count of rows with valid selected prices
  const applyCount = useMemo(() => {
    let count = 0;
    for (const id of selectedRows) {
      const val = selectedPrices[id];
      if (val && !isNaN(parseFloat(val))) count++;
    }
    return count;
  }, [selectedRows, selectedPrices]);

  const handleApply = useCallback(async () => {
    const updates: { item_id: number; new_price: number }[] = [];
    for (const id of selectedRows) {
      const val = selectedPrices[id];
      if (val && !isNaN(parseFloat(val))) {
        updates.push({ item_id: id, new_price: parseFloat(val) });
      }
    }

    if (updates.length === 0) return;

    setApplying(true);
    try {
      const response = await api.post<{
        success: boolean;
        updated_count: number;
        unchanged_count: number;
      }>("/api/v1/pricebook/apply_selected_prices", { updates });

      if (response?.success) {
        const parts: string[] = [];
        if (response.updated_count > 0) parts.push(`${response.updated_count} updated`);
        if (response.unchanged_count > 0) parts.push(`${response.unchanged_count} unchanged`);

        toast({
          title: "Prices Applied",
          description: parts.join(", ") || "No changes needed",
        });
        onOpenChange(false);
        clearSelection();
        onRefresh();
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
  }, [selectedRows, selectedPrices, toast, onOpenChange, clearSelection, onRefresh]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right-95"
        title="Compare All Supplier Prices"
        className="flex flex-col !p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-4 pb-2 shrink-0">
          <h2 className="text-lg font-semibold">Compare All Supplier Prices</h2>
          <SheetDescription>
            {items.length} item{items.length !== 1 ? "s" : ""} &middot; {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}
          </SheetDescription>
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
                    {suppliers.map(s => (
                      <th key={s.id} className="text-right p-2 min-w-[120px] font-medium">
                        {s.name}
                      </th>
                    ))}
                    <th className="text-right p-2 min-w-[130px] sticky right-0 bg-background z-20 font-medium border-l">
                      Selected Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const isSelected = selectedRows.has(item.id);
                    const selectedVal = selectedPrices[item.id] ?? "";

                    return (
                      <tr
                        key={item.id}
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

                          return (
                            <td
                              key={s.id}
                              className={`p-2 text-right cursor-pointer hover:bg-primary/10 transition-colors ${
                                isHighest ? "font-semibold text-green-600 dark:text-green-400" : ""
                              }`}
                              onClick={() => supplierPrice && selectSupplierPrice(item.id, supplierPrice.price)}
                              title={
                                supplierPrice
                                  ? `Click to select ${formatCurrency(supplierPrice.price)}${isDefault ? " (default supplier)" : ""}`
                                  : "No price"
                              }
                            >
                              {supplierPrice ? (
                                <span className="inline-flex items-center gap-1">
                                  {formatCurrency(supplierPrice.price)}
                                  {isDefault && (
                                    <span className="text-[10px] text-blue-500 dark:text-blue-400" title="Default supplier">*</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">&mdash;</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 sticky right-0 bg-background border-l">
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
                        </td>
                      </tr>
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
              {applyCount} of {items.length} item{items.length !== 1 ? "s" : ""} will be updated
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
              <Button onClick={handleApply} disabled={applyCount === 0 || applying}>
                {applying ? (
                  <>
                    <Spinner size={16} className="mr-1" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Apply {applyCount} Price{applyCount !== 1 ? "s" : ""}
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
