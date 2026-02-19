"use client";

import { useState, useMemo, useCallback } from "react";
import { Copy, Star, Trash2, RefreshCw } from "lucide-react";
import PriceComparisonSheet from "./PriceComparisonSheet";
import { api } from "@/lib/api";
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
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";

interface SupplierComboItem extends ComboboxItem {
  supplierId: number;
}

interface PricebookBulkActionsProps {
  selectedIds: (number | string)[];
  clearSelection: () => void;
  onRefresh: () => void;
}

type RoundingMode = "none" | "smart" | "0.10" | "0.50" | "1" | "5" | "10";

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return `$${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

export default function PricebookBulkActions({
  selectedIds,
  clearSelection,
  onRefresh,
}: PricebookBulkActionsProps) {
  const { toast } = useToast();

  // Shared supplier state
  const [suppliers, setSuppliers] = useState<SupplierComboItem[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Update Prices comparison sheet state
  const [comparisonSheetOpen, setComparisonSheetOpen] = useState(false);

  // Copy Prices modal state
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [sourceSupplier, setSourceSupplier] = useState<{ id: number; name: string } | null>(null);
  const [targetSupplier, setTargetSupplier] = useState<{ id: number; name: string } | null>(null);
  const [priceAdjustment, setPriceAdjustment] = useState<string>("");
  const [roundingMode, setRoundingMode] = useState<RoundingMode>("none");
  const [effectiveDate, setEffectiveDate] = useState<string>(getLocalDateString);
  const [copying, setCopying] = useState(false);

  // Set Default modal state
  const [defaultModalOpen, setDefaultModalOpen] = useState(false);
  const [defaultSupplier, setDefaultSupplier] = useState<{ id: number; name: string } | null>(null);
  const [settingDefault, setSettingDefault] = useState(false);

  // Remove Prices modal state
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [removeSupplier, setRemoveSupplier] = useState<{ id: number; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadSuppliers = useCallback(async () => {
    if (suppliers.length > 0) return;
    setLoadingSuppliers(true);
    try {
      // Fetch from pricebook endpoint which returns filters.suppliers -
      // only suppliers that have price histories or are default suppliers.
      // limit=1 to avoid loading all items (we only need the filter metadata).
      const response = await api.get<{
        filters: { suppliers: [number, string][] };
      }>("/api/v1/pricebook?limit=1&include_risk=false");
      const list = (response?.filters?.suppliers || []).map(([id, name]) => ({
        id: String(id),
        label: name || `Supplier ${id}`,
        supplierId: id,
      }));
      setSuppliers(list);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setLoadingSuppliers(false);
    }
  }, [suppliers.length]);

  // Parse percentage
  const adjustmentPercent = useMemo(() => {
    const val = parseFloat(priceAdjustment);
    return isNaN(val) ? 0 : val;
  }, [priceAdjustment]);

  const hasAdjustment = adjustmentPercent !== 0 || roundingMode !== "none";

  // ===== Copy Prices =====
  const handleOpenCopyModal = useCallback(() => {
    setSourceSupplier(null);
    setTargetSupplier(null);
    setPriceAdjustment("");
    setRoundingMode("none");
    setEffectiveDate(getLocalDateString());
    setCopyModalOpen(true);
    loadSuppliers();
  }, [loadSuppliers]);

  const handleCopyPrices = useCallback(async () => {
    if (!sourceSupplier || !targetSupplier) return;

    setCopying(true);
    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        copied_count: number;
        updated_count: number;
      }>(`/api/v1/contacts/supplier_pricing/${targetSupplier.id}/copy_history`, {
        source_id: sourceSupplier.id,
        pricebook_item_ids: selectedIds.map(Number),
        set_as_default: false,
        price_adjustment_percent: adjustmentPercent,
        rounding_mode: roundingMode,
        effective_date: effectiveDate,
      });

      if (response?.success) {
        toast({
          title: "Prices Copied",
          description: response.message,
        });
        setCopyModalOpen(false);
        clearSelection();
        onRefresh();
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
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setCopying(false);
    }
  }, [sourceSupplier, targetSupplier, selectedIds, adjustmentPercent, roundingMode, effectiveDate, toast, clearSelection, onRefresh]);

  // ===== Set as Default =====
  const handleOpenDefaultModal = useCallback(() => {
    setDefaultSupplier(null);
    setDefaultModalOpen(true);
    loadSuppliers();
  }, [loadSuppliers]);

  const handleSetDefault = useCallback(async () => {
    if (!defaultSupplier) return;

    setSettingDefault(true);
    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        updated_count: number;
      }>(`/api/v1/contacts/supplier_pricing/${defaultSupplier.id}/set_default`, {
        pricebook_item_ids: selectedIds.map(Number),
      });

      if (response?.success) {
        toast({
          title: "Default Supplier Updated",
          description: response.message,
        });
        setDefaultModalOpen(false);
        clearSelection();
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to set default supplier:", err);
      toast({
        title: "Update Failed",
        description: err instanceof Error ? err.message : "Failed to set default supplier",
        variant: "destructive",
      });
    } finally {
      setSettingDefault(false);
    }
  }, [defaultSupplier, selectedIds, toast, clearSelection, onRefresh]);

  // ===== Remove Prices =====
  const handleOpenRemoveModal = useCallback(() => {
    setRemoveSupplier(null);
    setRemoveModalOpen(true);
    loadSuppliers();
  }, [loadSuppliers]);

  const handleRemovePrices = useCallback(async () => {
    if (!removeSupplier) return;

    setRemoving(true);
    try {
      const response = await api.delete<{
        success: boolean;
        message: string;
        deleted_histories_count: number;
        removed_default_count: number;
      }>(`/api/v1/contacts/supplier_pricing/${removeSupplier.id}/remove_items`, {
        data: { pricebook_item_ids: selectedIds.map(Number) },
      });

      if (response?.success) {
        toast({
          title: "Price History Removed",
          description: response.message,
        });
        setRemoveModalOpen(false);
        clearSelection();
        onRefresh();
      } else {
        toast({
          title: "Remove Failed",
          description: "Failed to remove price history.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Failed to remove price history:", err);
      toast({
        title: "Remove Failed",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  }, [removeSupplier, selectedIds, toast, clearSelection, onRefresh]);

  return (
    <>
      {/* Bulk Action Buttons */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setComparisonSheetOpen(true)}
      >
        <RefreshCw className="h-4 w-4 mr-1" />
        Update Prices ({selectedIds.length})
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenCopyModal}
      >
        <Copy className="h-4 w-4 mr-1" />
        Copy Prices ({selectedIds.length})
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenDefaultModal}
      >
        <Star className="h-4 w-4 mr-1" />
        Set Default ({selectedIds.length})
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={handleOpenRemoveModal}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Remove Prices ({selectedIds.length})
      </Button>

      {/* ===== Price Comparison Sheet ===== */}
      <PriceComparisonSheet
        open={comparisonSheetOpen}
        onOpenChange={setComparisonSheetOpen}
        selectedIds={selectedIds}
        clearSelection={clearSelection}
        onRefresh={onRefresh}
      />

      {/* ===== Copy Prices Modal ===== */}
      <Dialog open={copyModalOpen} onOpenChange={setCopyModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Copy Prices Between Suppliers</DialogTitle>
            <DialogDescription>
              Copy prices for {selectedIds.length} selected item{selectedIds.length !== 1 ? "s" : ""} from
              one supplier to another as new price history entries.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
            {/* Source Supplier */}
            <div>
              <label className="text-sm font-medium mb-2 block">Source Supplier</label>
              <ComboboxDropdown<SupplierComboItem>
                items={suppliers}
                selectedItem={sourceSupplier ? suppliers.find(s => s.supplierId === sourceSupplier.id) : undefined}
                onSelect={(item) => setSourceSupplier({ id: item.supplierId, name: item.label })}
                placeholder="Select source supplier..."
                searchPlaceholder="Search suppliers..."
                emptyResults="No suppliers found."
                isLoading={loadingSuppliers}
                clearable={!!sourceSupplier}
                onClear={() => setSourceSupplier(null)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supplier whose prices will be copied from
              </p>
            </div>

            {/* Target Supplier */}
            <div>
              <label className="text-sm font-medium mb-2 block">Target Supplier</label>
              <ComboboxDropdown<SupplierComboItem>
                items={suppliers}
                selectedItem={targetSupplier ? suppliers.find(s => s.supplierId === targetSupplier.id) : undefined}
                onSelect={(item) => setTargetSupplier({ id: item.supplierId, name: item.label })}
                placeholder="Select target supplier..."
                searchPlaceholder="Search suppliers..."
                emptyResults="No suppliers found."
                isLoading={loadingSuppliers}
                clearable={!!targetSupplier}
                onClear={() => setTargetSupplier(null)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supplier who will receive the copied prices
              </p>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyModalOpen(false)} disabled={copying}>
              Cancel
            </Button>
            <Button
              onClick={handleCopyPrices}
              disabled={!sourceSupplier || !targetSupplier || sourceSupplier.id === targetSupplier.id || copying}
            >
              {copying ? (
                <>
                  <Spinner size={16} className="mr-1" />
                  Copying...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy {selectedIds.length} Price{selectedIds.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Set as Default Supplier Modal ===== */}
      <Dialog open={defaultModalOpen} onOpenChange={setDefaultModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Default Supplier</DialogTitle>
            <DialogDescription>
              Set a supplier as the default for {selectedIds.length} selected item{selectedIds.length !== 1 ? "s" : ""}.
              This will update each item&apos;s current price to match the supplier&apos;s latest price.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Supplier</label>
              <ComboboxDropdown<SupplierComboItem>
                items={suppliers}
                selectedItem={defaultSupplier ? suppliers.find(s => s.supplierId === defaultSupplier.id) : undefined}
                onSelect={(item) => setDefaultSupplier({ id: item.supplierId, name: item.label })}
                placeholder="Select supplier..."
                searchPlaceholder="Search suppliers..."
                emptyResults="No suppliers found."
                isLoading={loadingSuppliers}
                clearable={!!defaultSupplier}
                onClear={() => setDefaultSupplier(null)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDefaultModalOpen(false)} disabled={settingDefault}>
              Cancel
            </Button>
            <Button onClick={handleSetDefault} disabled={!defaultSupplier || settingDefault}>
              {settingDefault ? (
                <>
                  <Spinner size={16} className="mr-1" />
                  Updating...
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-1" />
                  Set Default for {selectedIds.length} Item{selectedIds.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Remove Prices Modal ===== */}
      <Dialog open={removeModalOpen} onOpenChange={setRemoveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Price History</DialogTitle>
            <DialogDescription>
              Remove all price history for {selectedIds.length} selected item{selectedIds.length !== 1 ? "s" : ""} from
              a specific supplier. This will also remove the supplier as default for these items if applicable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Supplier to Remove</label>
              <ComboboxDropdown<SupplierComboItem>
                items={suppliers}
                selectedItem={removeSupplier ? suppliers.find(s => s.supplierId === removeSupplier.id) : undefined}
                onSelect={(item) => setRemoveSupplier({ id: item.supplierId, name: item.label })}
                placeholder="Select supplier..."
                searchPlaceholder="Search suppliers..."
                emptyResults="No suppliers found."
                isLoading={loadingSuppliers}
                clearable={!!removeSupplier}
                onClear={() => setRemoveSupplier(null)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveModalOpen(false)} disabled={removing}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemovePrices}
              disabled={!removeSupplier || removing}
            >
              {removing ? (
                <>
                  <Spinner size={16} className="mr-1" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove from {selectedIds.length} Item{selectedIds.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
