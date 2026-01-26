"use client";

/**
 * SortableViewItem - Sortable item for saved views
 *
 * Uses DnD primitives from @/components/ui/dnd for consistency.
 * See: frontend-next/lib/component-registry.ts
 */

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Pencil,
  Trash2,
  Eye,
  Globe,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedView } from "../types";

// DnD Primitives - SSoT for drag and drop UI
import { DragHandle, ItemBadge, DRAGGING_CLASSES, DROP_TARGET_CLASSES } from "@/components/ui/dnd";

interface SortableViewItemProps {
  view: SavedView;
  isActive: boolean;
  index: number;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onApply?: () => void;
}

export function SortableViewItem({
  view,
  isActive,
  index,
  onSelect,
  onEdit,
  onDelete,
  onApply,
}: SortableViewItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: view.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Check if this is an unsaved new view
  const isUnsaved = typeof view.id === "string" && view.id.startsWith("new_");

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-1.5 p-2 rounded border cursor-pointer transition-all relative",
        isActive
          ? "bg-primary/10 border-primary"
          : "bg-background border-border hover:border-primary/50",
        isDragging && DRAGGING_CLASSES,
        isOver && !isDragging && DROP_TARGET_CLASSES,
        isUnsaved && "border-dashed border-orange-400 bg-orange-50 dark:bg-orange-950/20"
      )}
    >
      {/* DnD Primitive: DragHandle */}
      <DragHandle
        {...attributes}
        {...listeners}
        size="md"
        onClick={(e) => e.stopPropagation()}
      />

      {/* DnD Primitive: ItemBadge */}
      <ItemBadge position={index} size="md" />

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5">
          {view.is_global ? (
            <Globe className="h-3 w-3 text-blue-500 dark:text-blue-400 shrink-0" />
          ) : (
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{view.name}</span>
          {isUnsaved && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 text-orange-600 dark:text-orange-400 border-orange-400 shrink-0">
              unsaved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            {view.filters?.length || 0}f
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            {view.sortColumns?.length || 0}s
          </Badge>
        </div>
      </div>

      <div className="flex items-center shrink-0">
        {onApply && !isUnsaved && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onApply();
            }}
            title="Apply this view"
          >
            <Eye className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
