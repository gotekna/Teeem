"use client";

/**
 * SortableColumnRow - Sortable row for column management
 *
 * Uses DnD primitives from @/components/ui/dnd for consistency.
 * See: frontend-next/lib/component-registry.ts
 */

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  TableRow,
  TableCell,
} from "@/components/ui/table";
import type { TableColumn } from "../types";

// DnD Primitives - SSoT for drag and drop UI
import { DragHandle, ItemBadge } from "@/components/ui/dnd";

interface SortableColumnRowProps {
  id: string;
  column: TableColumn;
  isVisible: boolean;
  isSearchable: boolean;
  index: number;
  totalVisible: number;
  onToggleVisibility: () => void;
  onToggleSearchable?: () => void;
  onReorder: (newPosition: number) => void;
  columnWidth: number;
  onWidthChange: (width: number) => void;
  getColumnTypeEmoji: (type: string) => string;
  getColumnTypeSqlType: (type: string) => string;
  getColumnTypeLabel: (type: string) => string;
  getColumnTypeValidationRules: (type: string) => string;
}

export function SortableColumnRow({
  id,
  column,
  isVisible,
  isSearchable,
  index,
  totalVisible,
  onToggleVisibility,
  onToggleSearchable,
  onReorder,
  columnWidth,
  onWidthChange,
  getColumnTypeEmoji,
  getColumnTypeSqlType,
  getColumnTypeLabel,
  getColumnTypeValidationRules,
}: SortableColumnRowProps) {
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

  const columnType = column.column_type || "single_line_text";
  const sqlType = getColumnTypeSqlType(columnType);
  const displayLabel = getColumnTypeLabel(columnType);
  const typeEmoji = getColumnTypeEmoji(columnType);
  const validationRules = getColumnTypeValidationRules(columnType);
  const isSystemColumn = ['id', 'created_at', 'updated_at'].includes(column.key);

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "hover:bg-muted/50",
        isDragging && "opacity-50 bg-muted",
        isSystemColumn && "bg-red-50 dark:bg-red-950/30",
        !isVisible && "opacity-60"
      )}
    >
      {/* Drag Handle + Position */}
      <TableCell className="w-16">
        <div className="flex items-center gap-1">
          <DragHandle {...attributes} {...listeners} size="sm" />
          {isVisible && (
            <ItemBadge
              position={index}
              editable
              onPositionChange={onReorder}
              maxPosition={totalVisible}
              size="sm"
            />
          )}
        </div>
      </TableCell>
      {/* Visibility Checkbox */}
      <TableCell className="w-12">
        <Checkbox
          checked={isVisible}
          onCheckedChange={() => onToggleVisibility()}
        />
      </TableCell>
      {/* Searchable Checkbox */}
      <TableCell className="w-12">
        <Checkbox
          checked={isSearchable}
          onCheckedChange={() => onToggleSearchable?.()}
          disabled={!onToggleSearchable}
        />
      </TableCell>
      {/* Column Name */}
      <TableCell>
        <div className="flex items-center gap-2">
          <span>{typeEmoji}</span>
          <span className="font-medium">{column.label}</span>
        </div>
      </TableCell>
      {/* SQL Type */}
      <TableCell>
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
          {sqlType}
        </code>
      </TableCell>
      {/* Display Type */}
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {displayLabel}
        </span>
      </TableCell>
      {/* Validation Rules */}
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {validationRules}
        </span>
      </TableCell>
      {/* Width */}
      <TableCell>
        <Input
          type="number"
          value={columnWidth}
          onChange={(e) => onWidthChange(parseInt(e.target.value) || 50)}
          className="w-16 h-8 text-sm"
          min={50}
          max={500}
        />
      </TableCell>
    </TableRow>
  );
}
