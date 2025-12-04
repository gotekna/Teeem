"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";

interface Column {
  id: number;
  column_name: string;
  name: string;
  column_type: string;
}

interface SortableGroupByItemProps {
  id: string;
  columnName: string;
  columns: Column[];
  onChangeColumn: (col: string) => void;
  onRemove: () => void;
}

export function SortableGroupByItem({
  id,
  columnName,
  columns,
  onChangeColumn,
  onRemove,
}: SortableGroupByItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2",
        isDragging && "opacity-50"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <ComboboxDropdown
          items={columns.map(c => ({
            id: c.column_name,
            label: c.name || c.column_name,
          }))}
          selectedItem={{
            id: id,
            label: columnName,
          }}
          onSelect={(item) => onChangeColumn(item.id)}
          placeholder="Search column..."
          searchInTrigger={true}
          popoverProps={{ className: "w-[200px]" }}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
