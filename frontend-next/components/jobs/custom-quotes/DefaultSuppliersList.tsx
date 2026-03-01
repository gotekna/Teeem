"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SupplierPicker, type Supplier } from "@/components/ui/supplier-picker";
import { api } from "@/lib/api";

interface DefaultSuppliersListProps {
  supplierIds: number[];
  onUpdate: (ids: number[]) => void;
}

/** Simple default supplier manager for template mode — add/remove supplier contacts by ID */
export function DefaultSuppliersList({ supplierIds, onUpdate }: DefaultSuppliersListProps) {
  const [names, setNames] = useState<Record<number, string>>({});
  const [adding, setAdding] = useState(false);

  // Fetch contact names for the IDs
  useEffect(() => {
    if (supplierIds.length === 0) {
      setNames({});
      return;
    }
    const missing = supplierIds.filter((id) => !names[id]);
    if (missing.length === 0) return;

    (async () => {
      try {
        const res = await api.get<{ success: boolean; contacts: Array<{ id: number; display_name?: string; name?: string }> }>(
          `/api/v1/contacts?ids=${missing.join(",")}&type=suppliers`
        );
        if (res?.contacts) {
          const map: Record<number, string> = { ...names };
          for (const c of res.contacts) {
            map[c.id] = c.display_name || c.name || `Supplier ${c.id}`;
          }
          setNames(map);
        }
      } catch {
        // Names will show as "Supplier ID"
      }
    })();
  }, [supplierIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemove = useCallback((id: number) => {
    onUpdate(supplierIds.filter((sid) => sid !== id));
  }, [supplierIds, onUpdate]);

  const handleAdd = useCallback((supplier: Supplier | null) => {
    if (!supplier) return;
    if (supplierIds.includes(supplier.id)) {
      setAdding(false);
      return;
    }
    // Update names cache immediately
    setNames((prev) => ({
      ...prev,
      [supplier.id]: supplier.display_name || supplier.name || `Supplier ${supplier.id}`,
    }));
    onUpdate([...supplierIds, supplier.id]);
    setAdding(false);
  }, [supplierIds, onUpdate]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Default Suppliers</span>
        {!adding && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Supplier
          </Button>
        )}
      </div>

      {supplierIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {supplierIds.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pr-1">
              {names[id] || `Supplier ${id}`}
              <button
                onClick={() => handleRemove(id)}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {adding && (
        <div className="max-w-xs">
          <SupplierPicker
            value={null}
            onSelect={handleAdd}
            placeholder="Search suppliers..."
            clearable
          />
        </div>
      )}
    </div>
  );
}
