"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Package, Copy, TrendingUp, Star } from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { useToast } from "@/components/ui/use-toast";

interface SupplierComboItem extends ComboboxItem {
  supplierId: number;
}

interface PricebookItem {
  id: number;
  item_code: string;
  item_name: string;
  category: string | null;
  unit_of_measure: string | null;
  current_price: number | null;
  supplier_price: number | null;
  brand: string | null;
  is_active: boolean;
  needs_pricing_review: boolean;
  price_last_updated_at: string | null;
  default_supplier?: { id: number; name: string } | null;
}

interface PricebookResponse {
  items: PricebookItem[];
  pagination: {
    total_count: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

interface ContactPriceBookTabProps {
  contactId: number;
  contactName: string;
}

type RoundingMode = "none" | "smart" | "0.10" | "0.50" | "1" | "5" | "10";

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return `$${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Local date string in YYYY-MM-DD format (avoids UTC timezone offset) */
function getLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Must match backend apply_price_rounding exactly
function applyRounding(price: number, mode: RoundingMode): number {
  if (mode === "none") return price;

  let increment: number;
  if (mode === "smart") {
    if (price < 10) increment = 0.1;
    else if (price < 100) increment = 0.5;
    else if (price < 1000) increment = 1;
    else increment = 10;
  } else {
    increment = parseFloat(mode);
  }

  return Math.ceil(price / increment) * increment;
}

const ROUNDING_OPTIONS: { value: RoundingMode; label: string; description: string }[] = [
  { value: "none", label: "None", description: "No rounding" },
  { value: "smart", label: "Smart", description: "Auto: 10c / 50c / $1 / $10 based on price" },
  { value: "0.10", label: "$0.10", description: "Round up to nearest 10 cents" },
  { value: "0.50", label: "$0.50", description: "Round up to nearest 50 cents" },
  { value: "1", label: "$1", description: "Round up to nearest dollar" },
  { value: "5", label: "$5", description: "Round up to nearest $5" },
  { value: "10", label: "$10", description: "Round up to nearest $10" },
];

export function ContactPriceBookTab({ contactId, contactName }: ContactPriceBookTabProps) {
  const [items, setItems] = useState<PricebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Copy prices modal state
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySelectedIds, setCopySelectedIds] = useState<(number | string)[]>([]);
  const [copyClearSelection, setCopyClearSelection] = useState<(() => void) | null>(null);
  const [targetSupplier, setTargetSupplier] = useState<{ id: number; name: string } | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierComboItem[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [priceAdjustment, setPriceAdjustment] = useState<string>("");
  const [roundingMode, setRoundingMode] = useState<RoundingMode>("none");
  const [effectiveDate, setEffectiveDate] = useState<string>(getLocalDateString);
  const [copying, setCopying] = useState(false);
  const [targetPrices, setTargetPrices] = useState<Record<number, number>>({});
  const [loadingTargetPrices, setLoadingTargetPrices] = useState(false);
  const [priceOverrides, setPriceOverrides] = useState<Record<number, number>>({});

  const { toast } = useToast();

  // Inline edit handler - saves single field updates to the pricebook API
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/pricebook/${rowId}`, {
        pricebook_item: { [field]: value },
      });
      // Update local state to reflect the change without full reload
      setItems(prev => prev.map(item =>
        item.id === Number(rowId) ? { ...item, [field]: value } : item
      ));
    } catch (err) {
      console.error("Failed to update pricebook item:", err);
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Failed to save change",
        variant: "destructive",
      });
      throw err; // Re-throw so TeeemTableView can revert the cell
    }
  }, [toast]);

  useEffect(() => {
    loadPricebookItems();
  }, [contactId]);

  const loadPricebookItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<PricebookResponse>(
        `/api/v1/pricebook?supplier_id=${contactId}&limit=0`
      );

      if (response?.items) {
        setItems(response.items);
        setTotal(response.pagination?.total_count || response.items.length);
      } else {
        setError("Failed to load price book items");
      }
    } catch (err) {
      console.error("Failed to load price book:", err);
      setError(err instanceof Error ? err.message : "Failed to load price book");
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = useCallback(async () => {
    if (suppliers.length > 0) return;
    setLoadingSuppliers(true);
    try {
      const response = await api.get<{ contacts: { id: number; display_name?: string; name?: string }[] }>(
        "/api/v1/contacts?entity_type=company,trust,sole_trader"
      );
      const list = (response?.contacts || []).map((c) => ({
        id: String(c.id),
        label: c.display_name || c.name || `Contact ${c.id}`,
        supplierId: c.id,
      }));
      setSuppliers(list);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setLoadingSuppliers(false);
    }
  }, [suppliers.length]);

  const columns: TableColumn[] = useMemo(() => [
    { key: "item_code", label: "Code", width: 120, sortable: true, column_type: "single_line_text" },
    { key: "item_name", label: "Item Name", width: 300, sortable: true, column_type: "single_line_text" },
    { key: "category", label: "Category", width: 150, sortable: true, column_type: "single_line_text" },
    { key: "brand", label: "Brand", width: 120, sortable: true, column_type: "single_line_text" },
    { key: "unit_of_measure", label: "UOM", width: 80, sortable: true, column_type: "single_line_text" },
    { key: "current_price", label: "Current Price", width: 120, sortable: true, column_type: "currency" },
    { key: "supplier_price", label: "Supplier Price", width: 120, sortable: true, column_type: "currency" },
    { key: "price_last_updated_at", label: "Price Updated", width: 120, sortable: true, column_type: "date" },
    { key: "needs_pricing_review", label: "Review", width: 80, sortable: true, column_type: "boolean" },
  ], []);

  const rows: TableRow[] = useMemo(() => {
    return items.map((item) => ({
      id: item.id,
      item_code: item.item_code,
      item_name: item.item_name,
      category: item.category,
      brand: item.brand,
      unit_of_measure: item.unit_of_measure,
      current_price: item.current_price,
      supplier_price: item.supplier_price,
      price_last_updated_at: item.price_last_updated_at,
      needs_pricing_review: item.needs_pricing_review,
    }));
  }, [items]);

  // Fetch target supplier's current prices when target is selected
  useEffect(() => {
    if (!targetSupplier || copySelectedIds.length === 0) {
      setTargetPrices({});
      return;
    }

    let cancelled = false;
    const fetchTargetPrices = async () => {
      setLoadingTargetPrices(true);
      try {
        const itemIds = copySelectedIds.map(Number);
        const params = itemIds.map((id) => `pricebook_item_ids[]=${id}`).join("&");
        const response = await api.get<{ success: boolean; prices: Record<string, number> }>(
          `/api/v1/contacts/supplier_pricing/${targetSupplier.id}/prices?${params}`
        );
        if (!cancelled && response?.success) {
          // Convert string keys to numbers
          const pricesMap: Record<number, number> = {};
          for (const [key, val] of Object.entries(response.prices)) {
            pricesMap[Number(key)] = val;
          }
          setTargetPrices(pricesMap);
        }
      } catch (err) {
        console.error("Failed to fetch target supplier prices:", err);
        if (!cancelled) setTargetPrices({});
      } finally {
        if (!cancelled) setLoadingTargetPrices(false);
      }
    };

    fetchTargetPrices();
    return () => { cancelled = true; };
  }, [targetSupplier, copySelectedIds]);

  // Selected items for the preview table
  const selectedItems = useMemo(() => {
    const idSet = new Set(copySelectedIds.map(Number));
    return items.filter((item) => idSet.has(item.id));
  }, [items, copySelectedIds]);

  // Parse percentage
  const adjustmentPercent = useMemo(() => {
    const val = parseFloat(priceAdjustment);
    return isNaN(val) ? 0 : val;
  }, [priceAdjustment]);

  // Whether the new price column should show
  const hasAdjustment = adjustmentPercent !== 0 || roundingMode !== "none";

  // Calculate new price for a given current price (matches backend logic)
  const calcNewPrice = useCallback((currentPrice: number | null): number | null => {
    if (currentPrice == null) return null;
    let price = currentPrice;
    if (adjustmentPercent !== 0) {
      price = Math.round(price * (1 + adjustmentPercent / 100) * 100) / 100;
    }
    if (roundingMode !== "none") {
      price = applyRounding(price, roundingMode);
    }
    return price;
  }, [adjustmentPercent, roundingMode]);

  const handleOpenCopyModal = useCallback((selectedIds: (number | string)[], clearSelection: () => void) => {
    setCopySelectedIds(selectedIds);
    setCopyClearSelection(() => clearSelection);
    setTargetSupplier(null);
    setTargetPrices({});
    setPriceAdjustment("");
    setRoundingMode("none");
    setEffectiveDate(getLocalDateString());
    setPriceOverrides({});
    setCopyModalOpen(true);
    loadSuppliers();
  }, [loadSuppliers]);

  const handleCopyPrices = useCallback(async () => {
    if (!targetSupplier || copySelectedIds.length === 0) return;

    setCopying(true);
    try {
      // Build price_overrides: map of pricebook_item_id -> override price
      const overrides: Record<string, number> = {};
      for (const [id, price] of Object.entries(priceOverrides)) {
        overrides[id] = price;
      }

      const response = await api.post<{
        success: boolean;
        message: string;
        copied_count: number;
        updated_count: number;
      }>(`/api/v1/contacts/supplier_pricing/${targetSupplier.id}/copy_history`, {
        source_id: contactId,
        pricebook_item_ids: copySelectedIds.map(Number),
        set_as_default: false,
        price_adjustment_percent: adjustmentPercent,
        rounding_mode: roundingMode,
        effective_date: effectiveDate,
        ...(Object.keys(overrides).length > 0 && { price_overrides: overrides }),
      });

      if (response?.success) {
        toast({
          title: "Prices Updated",
          description: response.message,
        });
        setCopyModalOpen(false);
        copyClearSelection?.();
        loadPricebookItems();
      } else {
        toast({
          title: "Copy Failed",
          description: "Failed to copy prices. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Failed to copy prices:", err);
      toast({
        title: "Copy Failed",
        description: err instanceof Error ? err.message : "An error occurred while copying prices.",
        variant: "destructive",
      });
    } finally {
      setCopying(false);
    }
  }, [targetSupplier, copySelectedIds, contactId, adjustmentPercent, roundingMode, effectiveDate, priceOverrides, toast, copyClearSelection]);

  const handleSetDefault = useCallback(async (selectedIds: (number | string)[], clearSelection: () => void) => {
    if (selectedIds.length === 0) return;

    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        updated_count: number;
      }>(`/api/v1/contacts/supplier_pricing/${contactId}/set_default`, {
        pricebook_item_ids: selectedIds.map(Number),
      });

      if (response?.success) {
        toast({
          title: "Default Supplier Updated",
          description: response.message,
        });
        clearSelection();
        loadPricebookItems();
      }
    } catch (err) {
      console.error("Failed to set default supplier:", err);
      toast({
        title: "Update Failed",
        description: err instanceof Error ? err.message : "Failed to set default supplier.",
        variant: "destructive",
      });
    }
  }, [contactId, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>No price book items found for {contactName}</p>
        <p className="text-sm mt-2">Items will appear here when this supplier is set as the default supplier for price book items.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {total} item{total !== 1 ? "s" : ""} from {contactName}
      </div>
      <div className="-mx-4">
        <TeeemTableView
          entries={rows}
          columns={columns}
          tableName="Price Book Items"
          enableExport={true}
          onRowUpdate={handleRowUpdate}
          customBulkActions={(selectedIds, clearSelection) => (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSetDefault(selectedIds, clearSelection)}
              >
                <Star className="h-4 w-4 mr-1" />
                Set as Default ({selectedIds.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenCopyModal(selectedIds, clearSelection)}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy Prices ({selectedIds.length})
              </Button>
            </>
          )}
        />
      </div>

      {/* Copy Prices Modal */}
      <Dialog open={copyModalOpen} onOpenChange={setCopyModalOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Copy Prices to Supplier</DialogTitle>
            <DialogDescription>
              Copy {copySelectedIds.length} selected price{copySelectedIds.length !== 1 ? "s" : ""} from{" "}
              <span className="font-medium text-foreground">{contactName}</span> to a supplier as new price history.
              You can edit individual prices before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
            {/* Target Supplier */}
            <div>
              <label className="text-sm font-medium mb-2 block">Target Supplier</label>
              <ComboboxDropdown<SupplierComboItem>
                items={suppliers}
                selectedItem={targetSupplier ? suppliers.find(s => s.supplierId === targetSupplier.id) : undefined}
                onSelect={(item) => setTargetSupplier({ id: item.supplierId, name: item.label })}
                placeholder="Search for target supplier..."
                searchPlaceholder="Search suppliers..."
                emptyResults="No suppliers found."
                isLoading={loadingSuppliers}
                clearable={!!targetSupplier}
                onClear={() => setTargetSupplier(null)}
              />
            </div>

            {/* Price Adjustment */}
            <div>
              <label className="text-sm font-medium mb-2 block">Price Adjustment %</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-[200px]">
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="0"
                    value={priceAdjustment}
                    onChange={(e) => setPriceAdjustment(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
                <div className="flex gap-1">
                  {[3, 5, 10].map((pct) => (
                    <Button
                      key={pct}
                      variant="outline"
                      size="sm"
                      onClick={() => setPriceAdjustment(String(pct))}
                      className={adjustmentPercent === pct ? "border-primary bg-primary/5" : ""}
                    >
                      +{pct}%
                    </Button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {adjustmentPercent > 0
                  ? `Prices will be increased by ${adjustmentPercent}%`
                  : adjustmentPercent < 0
                    ? `Prices will be decreased by ${Math.abs(adjustmentPercent)}%`
                    : "Prices will be copied at the same rate"}
              </p>
            </div>

            {/* Rounding */}
            <div>
              <label className="text-sm font-medium mb-2 block">Round Up</label>
              <div className="flex flex-wrap gap-1">
                {ROUNDING_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant="outline"
                    size="sm"
                    onClick={() => setRoundingMode(opt.value)}
                    className={roundingMode === opt.value ? "border-primary bg-primary/5" : ""}
                    title={opt.description}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {roundingMode === "none"
                  ? "No rounding applied"
                  : roundingMode === "smart"
                    ? "Auto-rounds based on price: <$10 \u2192 10c, <$100 \u2192 50c, <$1k \u2192 $1, $1k+ \u2192 $10"
                    : `All prices rounded up to nearest ${ROUNDING_OPTIONS.find(o => o.value === roundingMode)?.label}`}
              </p>
            </div>

            {/* Effective Date */}
            <div>
              <label className="text-sm font-medium mb-2 block">Effective Date</label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Date the new prices take effect
              </p>
            </div>

            {/* Price Preview Table */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Price Preview
                {hasAdjustment && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {adjustmentPercent !== 0 ? `${adjustmentPercent > 0 ? "+" : ""}${adjustmentPercent}%` : ""}
                    {adjustmentPercent !== 0 && roundingMode !== "none" ? " + " : ""}
                    {roundingMode !== "none" ? `round up ${roundingMode === "smart" ? "(smart)" : `to ${ROUNDING_OPTIONS.find(o => o.value === roundingMode)?.label}`}` : ""}
                  </span>
                )}
              </label>
              <div className="border rounded-md overflow-auto max-h-[300px]">
                <table className="w-full text-sm">
                  <thead className="bg-background sticky top-0 z-10 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Code</th>
                      <th className="text-left px-3 py-2 font-medium">Item Name</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">
                        {contactName}
                      </th>
                      {targetSupplier && (
                        <th className="text-right px-3 py-2 font-medium whitespace-nowrap">
                          {targetSupplier.name || "Target"} Current
                        </th>
                      )}
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">
                        <span className="flex items-center justify-end gap-1">
                          {hasAdjustment && <TrendingUp className="h-3 w-3" />}
                          {targetSupplier ? `${targetSupplier.name || "Target"} New` : "New Price"}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedItems.map((item) => {
                      const sourcePrice = item.supplier_price ?? item.current_price;
                      const targetCurrentPrice = targetPrices[item.id] ?? null;
                      const calculatedPrice = calcNewPrice(sourcePrice);
                      const effectiveNewPrice = priceOverrides[item.id] ?? calculatedPrice;
                      const diffFromTarget = targetCurrentPrice != null && effectiveNewPrice != null ? effectiveNewPrice - targetCurrentPrice : null;

                      return (
                        <tr key={item.id} className="hover:bg-muted/30">
                          <td className="px-3 py-1.5 font-mono text-xs">{item.item_code}</td>
                          <td className="px-3 py-1.5 truncate max-w-[250px]">{item.item_name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(sourcePrice)}
                          </td>
                          {targetSupplier && (
                            <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                              {loadingTargetPrices ? (
                                <span className="text-xs">...</span>
                              ) : (
                                formatCurrency(targetCurrentPrice)
                              )}
                            </td>
                          )}
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            <input
                              type="number"
                              step="0.01"
                              className="w-24 text-right font-medium bg-transparent border border-border rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={priceOverrides[item.id] !== undefined ? priceOverrides[item.id] : (calculatedPrice ?? "")}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                  setPriceOverrides(prev => ({ ...prev, [item.id]: val }));
                                } else if (e.target.value === "") {
                                  setPriceOverrides(prev => {
                                    const next = { ...prev };
                                    delete next[item.id];
                                    return next;
                                  });
                                }
                              }}
                            />
                            {targetSupplier && diffFromTarget != null && diffFromTarget !== 0 && (
                              <span className={`ml-1 text-xs ${diffFromTarget > 0 ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                                ({diffFromTarget > 0 ? "+" : ""}{formatCurrency(diffFromTarget)})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCopyModalOpen(false)}
              disabled={copying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCopyPrices}
              disabled={!targetSupplier || copying}
            >
              {copying ? (
                <>
                  <Spinner size={16} className="mr-1" />
                  Saving...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Save {copySelectedIds.length} Price{copySelectedIds.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
