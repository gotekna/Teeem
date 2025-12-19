"use client";

/**
 * PageThumbnail - Sortable page thumbnail for PDF editor
 *
 * Uses DnD primitives from @/components/ui/dnd for consistency.
 * See: frontend-next/lib/component-registry.ts
 */

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { PDFPage } from "./types";

// DnD Primitives - SSoT for drag and drop UI
import { DragHandle, ItemBadge } from "@/components/ui/dnd";

interface PageThumbnailProps {
  page: PDFPage;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  totalPages: number;
}

export function PageThumbnail({
  page,
  index,
  isSelected,
  onSelect,
  onDelete,
  totalPages,
}: PageThumbnailProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col items-center p-2 rounded-lg cursor-pointer transition-all",
        isSelected
          ? "bg-primary/10 ring-2 ring-primary"
          : "hover:bg-muted",
        isDragging && "opacity-50 z-50"
      )}
      onClick={onSelect}
    >
      {/* Drag handle */}
      <DragHandle
        {...attributes}
        {...listeners}
        size="sm"
        className="absolute top-1 left-1 opacity-0 group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Delete button */}
      {totalPages > 1 && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}

      {/* Thumbnail image */}
      <div
        className={cn(
          "border rounded overflow-hidden shadow-sm",
          isSelected && "border-primary"
        )}
      >
        <img
          src={page.thumbnail}
          alt={`Page ${index + 1}`}
          className="w-full h-auto max-w-[100px]"
          draggable={false}
        />
      </div>

      {/* Page number */}
      <ItemBadge position={index + 1} size="sm" color="gray" className="mt-1" />

      {/* Annotations indicator */}
      {page.annotations.length > 0 && (
        <div className="absolute bottom-6 right-2 w-2 h-2 rounded-full bg-orange-500" />
      )}
    </div>
  );
}
