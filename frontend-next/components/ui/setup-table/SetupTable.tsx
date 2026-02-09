"use client";

/**
 * SetupTable - Standard component for editable config/setup lists
 *
 * THE ONE component for configuration lists like Job Types, Categories, Statuses.
 * Provides drag-and-drop reordering, add/edit/delete actions, and consistent styling.
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * import { SetupTable } from "@/components/ui/setup-table";
 * import { Briefcase } from "lucide-react";
 *
 * <SetupTable
 *   title="Job Types"
 *   icon={Briefcase}
 *   items={jobTypes}
 *   getLabel={(item) => item.name}
 *   getColor={(item) => item.color}
 *   onAdd={() => setShowAddModal(true)}
 *   onEdit={(item) => setEditingItem(item)}
 *   onDelete={(item) => handleDelete(item)}
 *   onReorder={(items) => saveOrder(items)}
 * />
 * ```
 */

import * as React from "react";
import {
  type LucideIcon,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SortableList, SortableItem } from "@/components/ui/dnd";
import { Spinner } from "@/components/ui/spinner";

export interface SetupTableProps<T extends { id: string | number }> {
  /** Array of items to display */
  items: T[];
  /** Title displayed in header */
  title: string;
  /** Icon displayed next to title */
  icon?: LucideIcon;
  /** Function to get display label from item */
  getLabel: (item: T) => string;
  /** Function to get color dot from item (optional) */
  getColor?: (item: T) => string | undefined;
  /** Function to check if item is active (optional) */
  getIsActive?: (item: T) => boolean;
  /** Callback when Add button clicked */
  onAdd?: () => void;
  /** Callback when Edit button clicked */
  onEdit?: (item: T) => void;
  /** Callback when Delete button clicked */
  onDelete?: (item: T) => void;
  /** Callback when items are reordered */
  onReorder?: (items: T[]) => void;
  /** Label for Add button (default: "Add") */
  addLabel?: string;
  /** Show position numbers (default: true) */
  showPosition?: boolean;
  /** Show drag handles (default: true) */
  showHandle?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional className for container */
  className?: string;
  /** Custom render function for item content */
  renderItem?: (item: T, index: number) => React.ReactNode;
  /** Show loading state */
  loading?: boolean;
}

export function SetupTable<T extends { id: string | number }>({
  items,
  title,
  icon: Icon,
  getLabel,
  getColor,
  getIsActive,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  addLabel = "Add",
  showPosition = true,
  showHandle = true,
  emptyMessage = "No items yet",
  className,
  renderItem,
  loading = false,
}: SetupTableProps<T>) {
  const handleReorder = (newItems: T[]) => {
    onReorder?.(newItems);
  };

  return (
    <div className={cn("border rounded-lg bg-background", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
        </div>
        {onAdd && (
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1" />
            {addLabel}
          </Button>
        )}
      </div>

      {/* List */}
      <div className="p-2 max-h-[60vh] overflow-y-auto">
        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <Spinner size={24} className="text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <SortableList items={items} onReorder={handleReorder}>
            {items.map((item, index) => {
              const isActive = getIsActive ? getIsActive(item) : true;
              const color = getColor?.(item);
              const label = getLabel(item);

              return (
                <SortableItem
                  key={item.id}
                  id={item.id}
                  position={showPosition ? index + 1 : undefined}
                  showHandle={showHandle}
                  showBadge={showPosition}
                  variant="card"
                  className="mb-1"
                  actions={
                    (onEdit || onDelete) && (
                      <div className="flex items-center gap-1">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(item);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(item);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )
                  }
                >
                  {renderItem ? (
                    renderItem(item, index)
                  ) : (
                    <div className="flex items-center gap-2">
                      {color && (
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      <span
                        className={cn(
                          "text-sm",
                          !isActive && "text-muted-foreground line-through"
                        )}
                      >
                        {label}
                      </span>
                      {!isActive && (
                        <Badge variant="outline" className="text-[9px] h-4">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  )}
                </SortableItem>
              );
            })}
          </SortableList>
        )}
      </div>
    </div>
  );
}
