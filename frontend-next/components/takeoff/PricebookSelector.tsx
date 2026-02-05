"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Search, Package, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/utils/formatters";
import { useDebounce } from "@/hooks/use-debounce";
import type { TakeoffMeasurement, PricebookItemSummary } from "./types";

// =============================================================================
// Types
// =============================================================================

interface PricebookItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  current_price: number | null;
  category: string | null;
  preferred_supplier_name: string | null;
}

interface PricebookSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measurement: TakeoffMeasurement | null;
  onSelect: (pricebookItem: PricebookItem) => Promise<void>;
  onClear: () => Promise<void>;
}

// =============================================================================
// Component
// =============================================================================

export function PricebookSelector({
  open,
  onOpenChange,
  measurement,
  onSelect,
  onClear,
}: PricebookSelectorProps) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PricebookItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  // Fetch pricebook items
  const fetchItems = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        data: { records: PricebookItem[] };
      }>(`/api/v1/pricebook`, {
        params: {
          search: query,
          limit: 50,
          active: true,
        },
      });

      if (response?.success && response?.data?.records) {
        setItems(response.data.records);
      }
    } catch (err) {
      console.error("Failed to fetch pricebook items:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on search change
  useEffect(() => {
    if (open) {
      fetchItems(debouncedSearch);
    }
  }, [open, debouncedSearch, fetchItems]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearch("");
      setItems([]);
    }
  }, [open]);

  // Handle selection
  const handleSelect = async (item: PricebookItem) => {
    setIsSelecting(true);
    try {
      await onSelect(item);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to assign pricebook item:", err);
    } finally {
      setIsSelecting(false);
    }
  };

  // Handle clear
  const handleClear = async () => {
    setIsSelecting(true);
    try {
      await onClear();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to clear pricebook item:", err);
    } finally {
      setIsSelecting(false);
    }
  };

  if (!measurement) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Assign Pricebook Item
          </DialogTitle>
          <DialogDescription>
            Link this measurement ({measurement.formatted_value}) to a pricebook item for costing
          </DialogDescription>
        </DialogHeader>

        {/* Current assignment */}
        {measurement.pricebook_item && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Currently:</span>
            <Badge variant="secondary">
              {measurement.pricebook_item.code} - {measurement.pricebook_item.name}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={isSelecting}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Items list */}
        <ScrollArea className="flex-1 min-h-[300px]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size={24} />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No items match your search" : "Start typing to search"}
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <PricebookItemRow
                  key={item.id}
                  item={item}
                  measurementUnit={measurement.unit}
                  measurementValue={measurement.net_value}
                  onSelect={() => handleSelect(item)}
                  disabled={isSelecting}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Pricebook Item Row
// =============================================================================

interface PricebookItemRowProps {
  item: PricebookItem;
  measurementUnit: string;
  measurementValue: number;
  onSelect: () => void;
  disabled?: boolean;
}

function PricebookItemRow({
  item,
  measurementUnit,
  measurementValue,
  onSelect,
  disabled,
}: PricebookItemRowProps) {
  // Calculate line total
  const lineTotal = (item.current_price || 0) * measurementValue;
  const unitMatch = item.unit?.toLowerCase() === measurementUnit?.toLowerCase();

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted text-left transition-colors disabled:opacity-50"
    >
      {/* Code badge */}
      <Badge variant="outline" className="shrink-0 font-mono">
        {item.code}
      </Badge>

      {/* Name and details */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.name}</div>
        {item.description && (
          <div className="text-sm text-muted-foreground line-clamp-1">
            {item.description}
          </div>
        )}
        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
          {item.category && <span>{item.category}</span>}
          {item.preferred_supplier_name && (
            <span>Supplier: {item.preferred_supplier_name}</span>
          )}
        </div>
      </div>

      {/* Price and estimated total */}
      <div className="text-right shrink-0">
        <div className="text-sm">
          {formatCurrency(item.current_price || 0)}
          <span className="text-muted-foreground">/{item.unit || "ea"}</span>
        </div>
        {!unitMatch && item.unit !== measurementUnit && (
          <div className="text-xs text-amber-600 dark:text-amber-400">
            Unit mismatch: {measurementUnit}
          </div>
        )}
        <div className="text-sm font-medium text-primary">
          Est: {formatCurrency(lineTotal)}
        </div>
      </div>
    </button>
  );
}
