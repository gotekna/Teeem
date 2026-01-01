"use client";

/**
 * SortableSortByItem - Sortable item for sort columns
 *
 * Uses DnD primitives from @/components/ui/dnd for consistency.
 * See: frontend-next/lib/component-registry.ts
 */

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import type { SortColumn } from "../types";

// DnD Primitives - SSoT for drag and drop UI
import {
  DragHandle,
  DRAGGING_CLASSES,
  DROP_TARGET_CLASSES,
  SortableList,
  SortableItem,
  reorderItems,
} from "@/components/ui/dnd";

interface Column {
  id: number;
  column_name: string;
  name: string;
  column_type: string;
}

interface SortableSortByItemProps {
  id: string;
  sort: SortColumn;
  columns: Column[];
  onChangeColumn: (col: string) => void;
  onChangeDir: (dir: "asc" | "desc" | "custom") => void;
  onChangeCustomOrder?: (order: string[]) => void;
  onRemove: () => void;
  allRows?: Record<string, unknown>[];
}

export function SortableSortByItem({
  id,
  sort,
  columns,
  onChangeColumn,
  onChangeDir,
  onChangeCustomOrder,
  onRemove,
  allRows,
}: SortableSortByItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Get unique values for the selected column (for custom sort)
  const uniqueValues = React.useMemo(() => {
    if (!allRows || !sort.column) {
      return [];
    }
    const values = new Set<string>();

    // For lookup columns with _id suffix, try both the _id column and the base column name
    // Example: job_type_id -> try both job_type_id and job_type
    const columnVariants = [sort.column];
    if (sort.column.endsWith('_id')) {
      const baseColumn = sort.column.replace(/_id$/, '');
      columnVariants.push(baseColumn);
    }

    allRows.forEach(row => {
      // Try each column variant until we find a value
      for (const colName of columnVariants) {
        const val = row[colName];
        if (val !== null && val !== undefined) {
          // Handle object values (lookup columns)
          if (typeof val === 'object') {
            const objVal = val as { display?: string; name?: string; id?: number };
            const displayVal = objVal.display || objVal.name || String(objVal.id || '');
            if (displayVal) {
              values.add(displayVal);
              break; // Found a value, stop checking variants
            }
          } else {
            values.add(String(val));
            break; // Found a value, stop checking variants
          }
        }
      }
    });
    return Array.from(values).sort();
  }, [allRows, sort.column]);

  // Initialize custom order with unique values if not set
  const currentOrder = sort.customOrder || uniqueValues;

  // Handle DnD reordering for custom sort values
  const handleCustomOrderReorder = (reorderedItems: Array<{ id: string; value: string }>) => {
    if (!onChangeCustomOrder) return;
    const newOrder = reorderedItems.map(item => item.value);
    onChangeCustomOrder(newOrder);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "space-y-2 relative",
        isDragging && DRAGGING_CLASSES + " p-2 rounded border",
        isOver && !isDragging && DROP_TARGET_CLASSES
      )}
    >
      <div className="flex items-center gap-2">
        {/* DnD Primitive: DragHandle */}
        <DragHandle {...attributes} {...listeners} size="md" />
        <div className="flex-1">
          <ComboboxDropdown
            items={columns.map(c => ({
              id: c.column_name,
              label: c.name || c.column_name,
            }))}
            selectedItem={sort.column ? {
              id: sort.column,
              label: columns.find(c => c.column_name === sort.column)?.name || sort.column,
            } : undefined}
            onSelect={(item) => onChangeColumn(item.id)}
            placeholder="Search column..."
            searchInTrigger={true}
            popoverProps={{ className: "w-[200px]" }}
          />
        </div>
        <Select value={sort.dir} onValueChange={(v) => onChangeDir(v as "asc" | "desc" | "custom")}>
          <SelectTrigger className="w-[110px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">A → Z</SelectItem>
            <SelectItem value="desc">Z → A</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Custom order editor - SSoT: Uses DnD SortableList/SortableItem */}
      {sort.dir === "custom" && uniqueValues.length > 0 && (
        <div className="ml-6 p-2 bg-muted/50 rounded border space-y-1">
          <p className="text-xs text-muted-foreground mb-2">Drag to reorder:</p>
          <SortableList
            items={currentOrder.map((value, index) => ({ id: `${value}-${index}`, value }))}
            onReorder={handleCustomOrderReorder}
          >
            {currentOrder.map((value, index) => (
              <SortableItem
                key={`${value}-${index}`}
                id={`${value}-${index}`}
                position={index + 1}
              >
                <span className="text-sm">{value}</span>
              </SortableItem>
            ))}
          </SortableList>
        </div>
      )}
    </div>
  );
}
