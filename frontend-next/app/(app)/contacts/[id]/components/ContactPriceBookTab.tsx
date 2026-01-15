"use client";

import { useState, useEffect, useMemo } from "react";
import { Package } from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  success: boolean;
  items: PricebookItem[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
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

      if (response?.success) {
        setItems(response.items || []);
        setTotal(response.pagination?.total || response.items?.length || 0);
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
        />
      </div>
    </div>
  );
}
