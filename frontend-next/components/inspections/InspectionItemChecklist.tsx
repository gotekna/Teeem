"use client";

import { useState, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  activeRoomAtom,
  inspectionDataAtom,
  inspectionDirtyAtom,
  CONDITIONS,
  type InspectionItem,
  type InspectionPhoto,
} from "@/lib/inspection-atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { ConditionBadge, ConditionComparisonIndicator } from "./ConditionBadge";
import { InspectionPhotoCapture } from "./InspectionPhotoCapture";

interface InspectionItemChecklistProps {
  inspectionId: number;
  inspectionType: string;
  onDataChanged: () => void;
  onAnnotatePhoto?: (photo: InspectionPhoto) => void;
}

export function InspectionItemChecklist({
  inspectionId,
  inspectionType,
  onDataChanged,
  onAnnotatePhoto,
}: InspectionItemChecklistProps) {
  const room = useAtomValue(activeRoomAtom);
  const setDirty = useSetAtom(inspectionDirtyAtom);
  const { toast } = useToast();
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");

  const isExitInspection = inspectionType === "exit";

  const handleConditionChange = useCallback(async (item: InspectionItem, condition: string) => {
    if (!room) return;
    setDirty(true);
    try {
      await api.patch(
        `/api/v1/inspection_rooms/${room.id}/inspection_items/${item.id}`,
        { inspection_item: { condition } }
      );
      onDataChanged();
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setDirty(false);
    }
  }, [room, setDirty, onDataChanged, toast]);

  const handleFieldChange = useCallback(async (item: InspectionItem, field: string, value: boolean | string) => {
    if (!room) return;
    setDirty(true);
    try {
      await api.patch(
        `/api/v1/inspection_rooms/${room.id}/inspection_items/${item.id}`,
        { inspection_item: { [field]: value } }
      );
      onDataChanged();
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setDirty(false);
    }
  }, [room, setDirty, onDataChanged, toast]);

  const handleAddItem = useCallback(async () => {
    if (!room || !newItemName.trim()) return;
    try {
      await api.post(`/api/v1/inspection_rooms/${room.id}/inspection_items`, {
        inspection_item: { name: newItemName.trim() },
      });
      setNewItemName("");
      setAddingItem(false);
      onDataChanged();
    } catch {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    }
  }, [room, newItemName, onDataChanged, toast]);

  const handleDeleteItem = useCallback(async (itemId: number) => {
    if (!room) return;
    try {
      await api.delete(`/api/v1/inspection_rooms/${room.id}/inspection_items/${itemId}`);
      onDataChanged();
    } catch {
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  }, [room, onDataChanged, toast]);

  if (!room) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a room to begin inspection
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Room header */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">{room.name}</h2>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs capitalize">{room.room_type.replace("_", " ")}</Badge>
          <span className="text-xs text-muted-foreground">
            {room.inspection_items.filter(i => i.condition).length} / {room.inspection_items.length} checked
          </span>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {/* Column headers */}
        <div className="sticky top-0 bg-background border-b px-4 py-2 flex items-center gap-3 text-xs font-medium text-muted-foreground z-10">
          <div className="flex-1">Item</div>
          {isExitInspection && <div className="w-20 text-center">Entry</div>}
          <div className="w-[280px] text-center">Condition</div>
          <div className="w-12 text-center">Clean</div>
          <div className="w-12 text-center">Work</div>
          <div className="w-8" />
        </div>

        {room.inspection_items.map(item => {
          const isExpanded = expandedItem === item.id;

          return (
            <div key={item.id} className={`border-b ${item.action_required ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}>
              {/* Main row */}
              <div className="px-4 py-2.5 flex items-center gap-3">
                {/* Expand button + name */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <button
                    className="shrink-0"
                    onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                  >
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </button>
                  <span className="text-sm truncate">{item.name}</span>
                  {item.action_required && (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                  {item.notes && (
                    <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  {item.inspection_photos.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
                      {item.inspection_photos.length} pic
                    </Badge>
                  )}
                </div>

                {/* Entry condition (exit inspection only) */}
                {isExitInspection && (
                  <div className="w-20 text-center">
                    <ConditionBadge condition={item.entry_condition} size="sm" />
                  </div>
                )}

                {/* Condition buttons */}
                <div className="w-[280px] flex gap-1 justify-center">
                  {CONDITIONS.map(c => (
                    <button
                      key={c.value}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all border ${
                        item.condition === c.value
                          ? `${c.color} text-white border-transparent`
                          : "bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40"
                      }`}
                      onClick={() => handleConditionChange(item, c.value)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Clean checkbox */}
                <div className="w-12 flex justify-center">
                  <Checkbox
                    checked={item.is_clean}
                    onCheckedChange={(checked) => handleFieldChange(item, "is_clean", !!checked)}
                  />
                </div>

                {/* Working checkbox */}
                <div className="w-12 flex justify-center">
                  <Checkbox
                    checked={item.is_working}
                    onCheckedChange={(checked) => handleFieldChange(item, "is_working", !!checked)}
                  />
                </div>

                {/* Delete */}
                <div className="w-8">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-3 pl-10 space-y-3">
                  {/* Comparison indicator for exit */}
                  {isExitInspection && item.entry_condition && item.condition && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Condition change:</span>
                      <ConditionComparisonIndicator
                        entryCondition={item.entry_condition}
                        currentCondition={item.condition}
                      />
                    </div>
                  )}

                  {/* Action required */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`action-${item.id}`}
                      checked={item.action_required}
                      onCheckedChange={(checked) => handleFieldChange(item, "action_required", !!checked)}
                    />
                    <label htmlFor={`action-${item.id}`} className="text-sm text-red-600 dark:text-red-400">
                      Action required
                    </label>
                  </div>

                  {/* Notes */}
                  <Textarea
                    placeholder="Notes for this item..."
                    value={item.notes || ""}
                    onChange={(e) => handleFieldChange(item, "notes", e.target.value)}
                    rows={2}
                    className="text-sm"
                  />

                  {/* Photos */}
                  <InspectionPhotoCapture
                    inspectionItemId={item.id}
                    photos={item.inspection_photos}
                    onPhotosChanged={onDataChanged}
                    onAnnotate={onAnnotatePhoto}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Add item */}
        <div className="px-4 py-3">
          {addingItem ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                placeholder="Item name"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleAddItem();
                  if (e.key === "Escape") setAddingItem(false);
                }}
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={handleAddItem} disabled={!newItemName.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingItem(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setAddingItem(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Item
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
