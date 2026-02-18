"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Package, Copy } from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SupplierPicker, type Supplier } from "@/components/ui/supplier-picker";
import { useToast } from "@/components/ui/use-toast";

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

export function ContactPriceBookTab({ contactId, contactName }: ContactPriceBookTabProps) {
  const [items, setItems] = useState<PricebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Copy prices modal state
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySelectedIds, setCopySelectedIds] = useState<(number | string)[]>([]);
  const [copyClearSelection, setCopyClearSelection] = useState<(() => void) | null>(null);
  const [targetSupplier, setTargetSupplier] = useState<Supplier | null>(null);
  const [copying, setCopying] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadPricebookItems();
  }, [contactId]);

  const loadPricebookItems = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch pricebook items where this contact is the supplier
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

  // Define columns for TeeemTableView
  const columns: TableColumn[] = useMemo(() => [
    { key: "item_code", label: "Code", width: 120, sortable: true },
    { key: "item_name", label: "Item Name", width: 300, sortable: true },
    { key: "category", label: "Category", width: 150, sortable: true },
    { key: "brand", label: "Brand", width: 120, sortable: true },
    { key: "unit_of_measure", label: "UOM", width: 80, sortable: true },
    { key: "current_price", label: "Current Price", width: 120, sortable: true, column_type: "currency" },
    { key: "supplier_price", label: "Supplier Price", width: 120, sortable: true, column_type: "currency" },
    { key: "price_last_updated_at", label: "Price Updated", width: 120, sortable: true, column_type: "date" },
    { key: "needs_pricing_review", label: "Review", width: 80, sortable: true, column_type: "boolean" },
  ], []);

  // Transform items to rows
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

  const handleOpenCopyModal = useCallback((selectedIds: (number | string)[], clearSelection: () => void) => {
    setCopySelectedIds(selectedIds);
    setCopyClearSelection(() => clearSelection);
    setTargetSupplier(null);
    setCopyModalOpen(true);
  }, []);

  const handleCopyPrices = useCallback(async () => {
    if (!targetSupplier || copySelectedIds.length === 0) return;

    setCopying(true);
    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        copied_count: number;
        updated_count: number;
      }>(`/api/v1/contacts/supplier_pricing/${targetSupplier.id}/copy_history`, {
        source_id: contactId,
        pricebook_item_ids: copySelectedIds.map(Number),
        set_as_default: true,
      });

      if (response?.success) {
        toast({
          title: "Prices Copied",
          description: response.message,
        });
        setCopyModalOpen(false);
        copyClearSelection?.();
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
  }, [targetSupplier, copySelectedIds, contactId, toast, copyClearSelection]);

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
          viewOnly={true}
          enableExport={true}
          customBulkActions={(selectedIds, clearSelection) => (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenCopyModal(selectedIds, clearSelection)}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy Prices ({selectedIds.length})
            </Button>
          )}
        />
      </div>

      {/* Copy Prices Modal */}
      <Dialog open={copyModalOpen} onOpenChange={setCopyModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy Prices to Another Supplier</DialogTitle>
            <DialogDescription>
              Copy {copySelectedIds.length} selected price{copySelectedIds.length !== 1 ? "s" : ""} from{" "}
              <span className="font-medium text-foreground">{contactName}</span> to another supplier.
              The target supplier will be set as the default supplier for these items.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Target Supplier</label>
            <SupplierPicker
              value={targetSupplier}
              onSelect={setTargetSupplier}
              placeholder="Search for target supplier..."
              clearable
            />
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
              disabled={!targetSupplier || copying || targetSupplier.id === contactId}
            >
              {copying ? (
                <>
                  <Spinner size={16} className="mr-1" />
                  Copying...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Prices
                </>
              )}
            </Button>
          </DialogFooter>

          {targetSupplier?.id === contactId && (
            <p className="text-sm text-destructive">
              Cannot copy prices to the same supplier.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
