"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { SearchInput } from "@/components/ui/search-input";
import { Badge } from "@/components/ui/badge";
import { SortableList, SortableItem } from "@/components/ui/dnd";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  Package,
  Calculator,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecipeItem {
  id: number;
  description: string;
  pricebook_item_id?: number;
  pricebook_item_code?: string;
  pricebook_item_name?: string;
  unit_of_measure: string;
  cost_type: string;
  base_quantity: number;
  quantity_formula?: string;
  uses_formula: boolean;
  unit_price_override?: number;
  use_pricebook_price: boolean;
  effective_unit_price?: number;
  sequence_order: number;
  notes?: string;
}

interface PricebookItem {
  id: number;
  item_code: string;
  item_name: string;
  unit_of_measure: string;
  current_price: number;
}

interface RecipeItemsEditorProps {
  recipeId: number;
  items: RecipeItem[];
  onItemsChange: (items: RecipeItem[]) => void;
  onRefresh: () => void;
}

const COST_TYPES = [
  { value: "materials", label: "Materials" },
  { value: "labour", label: "Labour" },
  { value: "overhead", label: "Overhead" },
  { value: "subcontract", label: "Subcontract" },
];

const DEFAULT_NEW_ITEM: Partial<RecipeItem> = {
  description: "",
  unit_of_measure: "ea",
  cost_type: "materials",
  base_quantity: 1,
  uses_formula: false,
  use_pricebook_price: false,
  unit_price_override: 0,
};

export function RecipeItemsEditor({
  recipeId,
  items,
  onItemsChange,
  onRefresh,
}: RecipeItemsEditorProps) {
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<Partial<RecipeItem>>(DEFAULT_NEW_ITEM);
  const [isSaving, setIsSaving] = useState(false);
  const [pricebookSearch, setPricebookSearch] = useState("");
  const [pricebookResults, setPricebookResults] = useState<PricebookItem[]>([]);
  const [isSearchingPricebook, setIsSearchingPricebook] = useState(false);
  const [showPricebookPicker, setShowPricebookPicker] = useState(false);
  const [selectedItemForPricebook, setSelectedItemForPricebook] = useState<number | "new" | null>(null);

  // Search pricebook items
  const searchPricebook = useCallback(async (query: string) => {
    if (query.length < 2) {
      setPricebookResults([]);
      return;
    }
    setIsSearchingPricebook(true);
    try {
      const response = await api.get<{ success: boolean; data: PricebookItem[] }>(
        `/api/v1/foundations/pricebook-items/records?search=${encodeURIComponent(query)}&limit=20`
      );
      if (response?.success) {
        setPricebookResults(response.data || []);
      }
    } catch (error) {
      console.error("Failed to search pricebook:", error);
    } finally {
      setIsSearchingPricebook(false);
    }
  }, []);

  // Debounced pricebook search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pricebookSearch) {
        searchPricebook(pricebookSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [pricebookSearch, searchPricebook]);

  // Handle drag-drop reorder
  const handleReorder = useCallback(async (newItems: RecipeItem[]) => {
    // Optimistically update UI
    onItemsChange(newItems);

    // Save to server
    try {
      await api.post(`/api/v1/recipes/${recipeId}/items/reorder`, {
        item_ids: newItems.map((item) => item.id),
      });
    } catch (error) {
      console.error("Failed to reorder items:", error);
      toast.error("Failed to reorder items");
      onRefresh(); // Revert to server state
    }
  }, [recipeId, onItemsChange, onRefresh]);

  // Handle create new item
  const handleCreateItem = async () => {
    if (!newItem.description?.trim()) {
      toast.error("Description is required");
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.post<{ success: boolean; item: RecipeItem }>(
        `/api/v1/recipes/${recipeId}/items`,
        { recipe_item: newItem }
      );
      if (response?.success) {
        toast.success("Item added");
        setNewItem(DEFAULT_NEW_ITEM);
        setIsAddingNew(false);
        onRefresh();
      }
    } catch (error) {
      console.error("Failed to create item:", error);
      toast.error("Failed to add item");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle update item
  const handleUpdateItem = async (itemId: number, updates: Partial<RecipeItem>) => {
    setIsSaving(true);
    try {
      await api.patch(`/api/v1/recipes/${recipeId}/items/${itemId}`, {
        recipe_item: updates,
      });
      toast.success("Item updated");
      onRefresh();
      setEditingItemId(null);
    } catch (error) {
      console.error("Failed to update item:", error);
      toast.error("Failed to update item");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete item
  const handleDeleteItem = async (itemId: number) => {
    if (!confirm("Delete this item?")) return;

    try {
      await api.delete(`/api/v1/recipes/${recipeId}/items/${itemId}`);
      toast.success("Item deleted");
      onRefresh();
    } catch (error) {
      console.error("Failed to delete item:", error);
      toast.error("Failed to delete item");
    }
  };

  // Handle pricebook item selection
  const handleSelectPricebookItem = (pricebookItem: PricebookItem, targetItemId: number | "new") => {
    if (targetItemId === "new") {
      setNewItem({
        ...newItem,
        pricebook_item_id: pricebookItem.id,
        pricebook_item_code: pricebookItem.item_code,
        pricebook_item_name: pricebookItem.item_name,
        description: pricebookItem.item_name,
        unit_of_measure: pricebookItem.unit_of_measure,
        use_pricebook_price: true,
        effective_unit_price: pricebookItem.current_price,
      });
    } else {
      handleUpdateItem(targetItemId, {
        pricebook_item_id: pricebookItem.id,
        description: pricebookItem.item_name,
        unit_of_measure: pricebookItem.unit_of_measure,
        use_pricebook_price: true,
      });
    }
    setShowPricebookPicker(false);
    setPricebookSearch("");
    setSelectedItemForPricebook(null);
  };

  // Calculate total
  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const qty = item.base_quantity || 0;
      const price = item.effective_unit_price || item.unit_price_override || 0;
      return sum + qty * price;
    }, 0);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Recipe Items</h3>
          <Badge variant="secondary">{items.length} items</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Total: <span className="font-semibold text-foreground">${calculateTotal().toFixed(2)}</span>
          </div>
          <Button size="sm" onClick={() => setIsAddingNew(true)} disabled={isAddingNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Items List */}
      {items.length > 0 || isAddingNew ? (
        <div className="border rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[auto_1fr_100px_80px_100px_100px_100px_auto] gap-2 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
            <div className="w-6"></div>
            <div>Description</div>
            <div>Unit</div>
            <div className="text-right">Qty</div>
            <div>Formula</div>
            <div className="text-right">Unit Price</div>
            <div className="text-right">Line Total</div>
            <div className="w-8"></div>
          </div>

          {/* Add New Item Row */}
          {isAddingNew && (
            <div className="grid grid-cols-[auto_1fr_100px_80px_100px_100px_100px_auto] gap-2 px-3 py-2 bg-blue-500/5 border-b items-center">
              <div className="w-6 text-muted-foreground">
                <Package className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newItem.description || ""}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Description"
                  className="h-8"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setSelectedItemForPricebook("new");
                    setShowPricebookPicker(true);
                  }}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <Select
                value={newItem.unit_of_measure}
                onValueChange={(v) => setNewItem({ ...newItem, unit_of_measure: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ea">ea</SelectItem>
                  <SelectItem value="m">m</SelectItem>
                  <SelectItem value="m2">m²</SelectItem>
                  <SelectItem value="m3">m³</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="l">L</SelectItem>
                  <SelectItem value="hr">hr</SelectItem>
                  <SelectItem value="day">day</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={newItem.base_quantity || ""}
                onChange={(e) => setNewItem({ ...newItem, base_quantity: parseFloat(e.target.value) || 0 })}
                className="h-8 text-right"
              />
              <div className="flex items-center gap-1">
                <Switch
                  checked={newItem.uses_formula}
                  onCheckedChange={(v) => setNewItem({ ...newItem, uses_formula: v })}
                />
                <Label className="text-xs">Formula</Label>
              </div>
              <Input
                type="number"
                value={newItem.unit_price_override || ""}
                onChange={(e) => setNewItem({ ...newItem, unit_price_override: parseFloat(e.target.value) || 0 })}
                className="h-8 text-right"
                disabled={newItem.use_pricebook_price}
                placeholder={newItem.use_pricebook_price ? "Pricebook" : "0.00"}
              />
              <div className="text-right font-medium text-sm">
                ${((newItem.base_quantity || 0) * (newItem.unit_price_override || newItem.effective_unit_price || 0)).toFixed(2)}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="default" onClick={handleCreateItem} disabled={isSaving}>
                  {isSaving ? <Spinner className="h-4 w-4" /> : "Add"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setIsAddingNew(false); setNewItem(DEFAULT_NEW_ITEM); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Existing Items with Drag-Drop */}
          <SortableList
            items={items}
            onReorder={handleReorder}
            className="divide-y"
          >
            {items.map((item, index) => (
              <SortableItem key={item.id} id={item.id} position={index + 1}>
                <RecipeItemRow
                  item={item}
                  isEditing={editingItemId === item.id}
                  onEdit={() => setEditingItemId(item.id)}
                  onSave={(updates) => handleUpdateItem(item.id, updates)}
                  onCancel={() => setEditingItemId(null)}
                  onDelete={() => handleDeleteItem(item.id)}
                  onSearchPricebook={() => {
                    setSelectedItemForPricebook(item.id);
                    setShowPricebookPicker(true);
                  }}
                  isSaving={isSaving}
                />
              </SortableItem>
            ))}
          </SortableList>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No items in this recipe yet</p>
          <Button className="mt-4" size="sm" onClick={() => setIsAddingNew(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Item
          </Button>
        </div>
      )}

      {/* Pricebook Picker Modal */}
      {showPricebookPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Select from Pricebook</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowPricebookPicker(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SearchInput
              value={pricebookSearch}
              onChange={setPricebookSearch}
              placeholder="Search pricebook items..."
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {isSearchingPricebook ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              ) : pricebookResults.length > 0 ? (
                pricebookResults.map((pb) => (
                  <button
                    key={pb.id}
                    onClick={() => handleSelectPricebookItem(pb, selectedItemForPricebook!)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted text-left"
                  >
                    <div>
                      <p className="font-medium">{pb.item_name}</p>
                      <p className="text-xs text-muted-foreground">{pb.item_code} &bull; {pb.unit_of_measure}</p>
                    </div>
                    <span className="font-medium">${pb.current_price?.toFixed(2)}</span>
                  </button>
                ))
              ) : pricebookSearch.length >= 2 ? (
                <p className="text-center py-8 text-muted-foreground">No results found</p>
              ) : (
                <p className="text-center py-8 text-muted-foreground">Type to search...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Individual item row component
interface RecipeItemRowProps {
  item: RecipeItem;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updates: Partial<RecipeItem>) => void;
  onCancel: () => void;
  onDelete: () => void;
  onSearchPricebook: () => void;
  isSaving: boolean;
}

function RecipeItemRow({
  item,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onSearchPricebook,
  isSaving,
}: RecipeItemRowProps) {
  const [editedItem, setEditedItem] = useState(item);

  // Reset edited item when switching to edit mode
  useEffect(() => {
    if (isEditing) {
      setEditedItem(item);
    }
  }, [isEditing, item]);

  const lineTotal = (item.base_quantity || 0) * (item.effective_unit_price || item.unit_price_override || 0);

  if (isEditing) {
    return (
      <div className="grid grid-cols-[auto_1fr_100px_80px_100px_100px_100px_auto] gap-2 px-3 py-2 bg-yellow-500/5 items-center">
        <div className="w-6 text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={editedItem.description}
            onChange={(e) => setEditedItem({ ...editedItem, description: e.target.value })}
            className="h-8"
          />
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onSearchPricebook}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <Select
          value={editedItem.unit_of_measure}
          onValueChange={(v) => setEditedItem({ ...editedItem, unit_of_measure: v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ea">ea</SelectItem>
            <SelectItem value="m">m</SelectItem>
            <SelectItem value="m2">m²</SelectItem>
            <SelectItem value="m3">m³</SelectItem>
            <SelectItem value="kg">kg</SelectItem>
            <SelectItem value="l">L</SelectItem>
            <SelectItem value="hr">hr</SelectItem>
            <SelectItem value="day">day</SelectItem>
          </SelectContent>
        </Select>
        {editedItem.uses_formula ? (
          <Input
            value={editedItem.quantity_formula || ""}
            onChange={(e) => setEditedItem({ ...editedItem, quantity_formula: e.target.value })}
            className="h-8 font-mono text-xs"
            placeholder="{floor_area}"
          />
        ) : (
          <Input
            type="number"
            value={editedItem.base_quantity}
            onChange={(e) => setEditedItem({ ...editedItem, base_quantity: parseFloat(e.target.value) || 0 })}
            className="h-8 text-right"
          />
        )}
        <div className="flex items-center gap-1">
          <Switch
            checked={editedItem.uses_formula}
            onCheckedChange={(v) => setEditedItem({ ...editedItem, uses_formula: v })}
          />
          <Calculator className={cn("h-3 w-3", editedItem.uses_formula ? "text-blue-500 dark:text-blue-400" : "text-muted-foreground")} />
        </div>
        <Input
          type="number"
          value={editedItem.unit_price_override || ""}
          onChange={(e) => setEditedItem({ ...editedItem, unit_price_override: parseFloat(e.target.value) || 0 })}
          className="h-8 text-right"
          disabled={editedItem.use_pricebook_price}
        />
        <div className="text-right font-medium text-sm">
          ${((editedItem.base_quantity || 0) * (editedItem.unit_price_override || 0)).toFixed(2)}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="default" onClick={() => onSave(editedItem)} disabled={isSaving}>
            {isSaving ? <Spinner className="h-4 w-4" /> : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-[auto_1fr_100px_80px_100px_100px_100px_auto] gap-2 px-3 py-2 hover:bg-muted/30 items-center cursor-pointer group"
      onDoubleClick={onEdit}
    >
      <div className="w-6 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-4 w-4 cursor-grab" />
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate">{item.description}</span>
        {item.pricebook_item_code && (
          <Badge variant="outline" className="shrink-0 text-xs">
            {item.pricebook_item_code}
          </Badge>
        )}
      </div>
      <span className="text-muted-foreground">{item.unit_of_measure}</span>
      <span className="text-right font-mono">
        {item.uses_formula ? (
          <span className="text-blue-500 dark:text-blue-400 text-xs">{item.quantity_formula}</span>
        ) : (
          item.base_quantity
        )}
      </span>
      <div className="flex justify-center">
        {item.uses_formula && <Calculator className="h-4 w-4 text-blue-500 dark:text-blue-400" />}
      </div>
      <span className="text-right">
        ${(item.effective_unit_price || item.unit_price_override || 0).toFixed(2)}
        {item.use_pricebook_price && (
          <span className="text-xs text-muted-foreground ml-1">PB</span>
        )}
      </span>
      <span className="text-right font-semibold">${lineTotal.toFixed(2)}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default RecipeItemsEditor;
