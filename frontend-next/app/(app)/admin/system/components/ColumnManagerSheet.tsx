"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getColumnTypeEmoji } from "@/lib/column-type-registry";

interface ColumnConfig {
  id: number;
  column_name: string;
  name: string;
  column_type: string;
  position?: number;
  visible?: boolean;
}

interface ColumnManagerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnConfig[];
  onSave: (columns: ColumnConfig[]) => void;
}

// Sortable column item component
function SortableColumnItem({
  column,
  onToggleVisibility,
}: {
  column: ColumnConfig;
  onToggleVisibility: (columnName: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.column_name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSystemColumn = ['id', 'created_at', 'updated_at'].includes(column.column_name);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 border rounded-md bg-background",
        isDragging && "opacity-50 shadow-lg",
        !column.visible && "bg-muted/30",
        isSystemColumn && "border-dashed"
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Visibility toggle */}
      <Checkbox
        checked={column.visible !== false}
        onCheckedChange={() => onToggleVisibility(column.column_name)}
        disabled={isSystemColumn && column.column_name === 'id'}
      />

      {/* Column info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">
            {getColumnTypeEmoji(column.column_type)}
          </span>
          <span className={cn(
            "font-medium text-sm truncate",
            !column.visible && "text-muted-foreground"
          )}>
            {column.name || column.column_name}
          </span>
          {isSystemColumn && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              System
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {column.column_type} • {column.column_name}
        </p>
      </div>

      {/* Visibility indicator */}
      {column.visible === false ? (
        <EyeOff className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Eye className="h-4 w-4 text-muted-foreground/50" />
      )}
    </div>
  );
}

export function ColumnManagerSheet({
  open,
  onOpenChange,
  columns: initialColumns,
  onSave,
}: ColumnManagerSheetProps) {
  const [columns, setColumns] = React.useState<ColumnConfig[]>([]);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Initialize columns when sheet opens
  React.useEffect(() => {
    if (open) {
      // Sort by position, add visible: true if not set
      const sortedColumns = [...initialColumns]
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map((col, index) => ({
          ...col,
          visible: col.visible !== false,
          position: col.position ?? index,
        }));
      setColumns(sortedColumns);
      setHasChanges(false);
    }
  }, [open, initialColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.findIndex((i) => i.column_name === active.id);
        const newIndex = items.findIndex((i) => i.column_name === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
          ...item,
          position: index,
        }));
        setHasChanges(true);
        return newItems;
      });
    }
  };

  const toggleVisibility = (columnName: string) => {
    setColumns((items) =>
      items.map((item) =>
        item.column_name === columnName
          ? { ...item, visible: !item.visible }
          : item
      )
    );
    setHasChanges(true);
  };

  const handleShowAll = () => {
    setColumns((items) => items.map((item) => ({ ...item, visible: true })));
    setHasChanges(true);
  };

  const handleHideAll = () => {
    setColumns((items) =>
      items.map((item) => ({
        ...item,
        visible: item.column_name === 'id', // Keep ID visible
      }))
    );
    setHasChanges(true);
  };

  const handleReset = () => {
    const sortedColumns = [...initialColumns]
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((col, index) => ({
        ...col,
        visible: true,
        position: col.position ?? index,
      }));
    setColumns(sortedColumns);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(columns);
    setHasChanges(false);
    onOpenChange(false);
  };

  const visibleCount = columns.filter((c) => c.visible !== false).length;
  const totalCount = columns.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[450px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Column Manager
          </SheetTitle>
          <SheetDescription>
            Drag to reorder columns. Toggle visibility with checkboxes.
          </SheetDescription>
        </SheetHeader>

        {/* Stats bar */}
        <div className="flex items-center justify-between py-3 px-1">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{visibleCount}</span> of{" "}
            <span className="font-medium text-foreground">{totalCount}</span> columns
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleShowAll}>
              Show All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleHideAll}>
              Hide All
            </Button>
          </div>
        </div>

        <Separator />

        {/* Sortable columns list */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map((c) => c.column_name)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 py-4">
                {columns.map((column) => (
                  <SortableColumnItem
                    key={column.column_name}
                    column={column}
                    onToggleVisibility={toggleVisibility}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </ScrollArea>

        <Separator />

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
