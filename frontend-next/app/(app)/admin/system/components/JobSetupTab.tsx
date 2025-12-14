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
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Loader2,
  GripVertical,
  Pencil,
  Trash2,
  Briefcase,
  ListChecks,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface JobType {
  id: number;
  name: string;
  color: string;
  position: number;
  active: boolean;
}

interface JobStatus {
  id: number;
  name: string;
  color: string;
  position: number;
  active: boolean;
}

interface JobStage {
  id: number;
  name: string;
  color: string;
  position: number;
  active: boolean;
}

// Individual sortable item component
function SortableItem<T extends { id: number; name: string; color?: string; position: number }>({
  item,
  index,
  totalItems,
  onEdit,
  onDelete,
  onPositionChange,
}: {
  item: T;
  index: number;
  totalItems: number;
  onEdit: (item: T) => void;
  onDelete: (id: number) => void;
  onPositionChange: (newPosition: number) => void;
}) {
  const [isEditingPosition, setIsEditingPosition] = React.useState(false);
  const [positionValue, setPositionValue] = React.useState(String(index + 1));
  const inputRef = React.useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  React.useEffect(() => {
    if (isEditingPosition && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingPosition]);

  React.useEffect(() => {
    setPositionValue(String(index + 1));
  }, [index]);

  const handlePositionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPositionValue(String(index + 1));
    setIsEditingPosition(true);
  };

  const handlePositionSubmit = () => {
    const newPos = parseInt(positionValue, 10);
    if (!isNaN(newPos) && newPos >= 1 && newPos <= totalItems && newPos !== index + 1) {
      onPositionChange(newPos);
    }
    setIsEditingPosition(false);
    setPositionValue(String(index + 1));
  };

  const handlePositionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handlePositionSubmit();
    } else if (e.key === "Escape") {
      setIsEditingPosition(false);
      setPositionValue(String(index + 1));
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-md border bg-background transition-all relative",
        isDragging && "opacity-50 shadow-lg scale-[1.02] z-50 border-primary bg-primary/5",
        isOver && !isDragging && "border-t-4 border-t-primary pt-4 mt-1"
      )}
    >
      {/* Drag handle with position number */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        {isEditingPosition ? (
          <input
            ref={inputRef}
            type="text"
            value={positionValue}
            onChange={(e) => setPositionValue(e.target.value)}
            onBlur={handlePositionSubmit}
            onKeyDown={handlePositionKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-6 h-5 text-[10px] font-medium text-center bg-background border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <button
            onClick={handlePositionClick}
            className="flex items-center justify-center w-5 h-5 text-[10px] font-medium bg-muted hover:bg-primary/20 hover:text-primary rounded cursor-pointer transition-colors"
            title="Click to change position"
          >
            {index + 1}
          </button>
        )}
      </div>

      {/* Color indicator */}
      {item.color && (
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: item.color }}
        />
      )}

      {/* Item name */}
      <span className="flex-1 text-sm truncate">{item.name}</span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(item)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// Main sortable list with DndContext
function SortableList<T extends { id: number; name: string; color?: string; position: number }>({
  items,
  title,
  icon: Icon,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  loading,
}: {
  items: T[];
  title: string;
  icon: typeof Briefcase;
  onAdd: () => void;
  onEdit: (item: T) => void;
  onDelete: (id: number) => void;
  onReorder: (items: T[]) => void;
  loading: boolean;
}) {
  const [activeId, setActiveId] = React.useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedItems = React.useMemo(
    () => [...items].sort((a, b) => a.position - b.position),
    [items]
  );

  const activeItem = activeId ? sortedItems.find((item) => item.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = sortedItems.findIndex((item) => item.id === active.id);
      const newIndex = sortedItems.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(sortedItems, oldIndex, newIndex);
      // Update positions
      newItems.forEach((item, i) => {
        item.position = i + 1;
      });
      onReorder(newItems);
    }
  };

  const handlePositionChange = (itemId: number, newPosition: number) => {
    const currentIndex = sortedItems.findIndex((item) => item.id === itemId);
    if (currentIndex === -1) return;

    const newIndex = newPosition - 1;
    if (newIndex < 0 || newIndex >= sortedItems.length) return;

    const newItems = arrayMove(sortedItems, currentIndex, newIndex);
    newItems.forEach((item, i) => {
      item.position = i + 1;
    });
    onReorder(newItems);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !Array.isArray(items) || items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No items yet. Click Add to create one.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedItems.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {sortedItems.map((item, index) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    index={index}
                    totalItems={sortedItems.length}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onPositionChange={(newPos) => handlePositionChange(item.id, newPos)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeItem ? (
                <div className="flex items-center gap-2 p-2 rounded-md border bg-background shadow-lg scale-[1.02] border-primary">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center justify-center w-5 h-5 text-[10px] font-medium bg-primary/20 text-primary rounded">
                    {sortedItems.findIndex((i) => i.id === activeItem.id) + 1}
                  </div>
                  {activeItem.color && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: activeItem.color }}
                    />
                  )}
                  <span className="flex-1 text-sm">{activeItem.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}

export function JobSetupTab() {
  const { toast } = useToast();
  const [jobTypes, setJobTypes] = React.useState<JobType[]>([]);
  const [jobStatuses, setJobStatuses] = React.useState<JobStatus[]>([]);
  const [jobStages, setJobStages] = React.useState<JobStage[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [showDialog, setShowDialog] = React.useState(false);
  const [dialogType, setDialogType] = React.useState<"type" | "status" | "stage">("type");
  const [editingItem, setEditingItem] = React.useState<JobType | JobStatus | JobStage | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: "",
    color: "#3B82F6",
  });

  const COLORS = [
    "#3B82F6", // Blue
    "#10B981", // Green
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#F97316", // Orange
    "#6366F1", // Indigo
    "#84CC16", // Lime
  ];

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [typesRes, statusesRes, stagesRes] = await Promise.all([
        api.get<{ job_types: JobType[] }>("/api/v1/job_types"),
        api.get<{ job_statuses: JobStatus[] }>("/api/v1/job_status"),
        api.get<{ job_stages: JobStage[] }>("/api/v1/job_stages"),
      ]);
      setJobTypes(typesRes.job_types || []);
      setJobStatuses(statusesRes.job_statuses || []);
      setJobStages(stagesRes.job_stages || []);
    } catch (error) {
      console.error("Failed to load data:", error);
      // Mock data
      setJobTypes([
        { id: 1, name: "New Build", color: "#3B82F6", position: 1, active: true },
        { id: 2, name: "Renovation", color: "#10B981", position: 2, active: true },
        { id: 3, name: "Extension", color: "#F59E0B", position: 3, active: true },
      ]);
      setJobStatuses([
        { id: 1, name: "Quote", color: "#8B5CF6", position: 1, active: true },
        { id: 2, name: "Won", color: "#10B981", position: 2, active: true },
        { id: 3, name: "In Progress", color: "#3B82F6", position: 3, active: true },
        { id: 4, name: "Complete", color: "#84CC16", position: 4, active: true },
        { id: 5, name: "Lost", color: "#EF4444", position: 5, active: true },
      ]);
      setJobStages([
        { id: 1, name: "Pre-Construction", color: "#F59E0B", position: 1, active: true },
        { id: 2, name: "Foundation", color: "#6366F1", position: 2, active: true },
        { id: 3, name: "Frame", color: "#06B6D4", position: 3, active: true },
        { id: 4, name: "Lock Up", color: "#8B5CF6", position: 4, active: true },
        { id: 5, name: "Fit Out", color: "#EC4899", position: 5, active: true },
        { id: 6, name: "Handover", color: "#10B981", position: 6, active: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = (type: "type" | "status" | "stage") => {
    setDialogType(type);
    setEditingItem(null);
    setFormData({ name: "", color: COLORS[0] });
    setShowDialog(true);
  };

  const handleOpenEditDialog = (item: JobType | JobStatus | JobStage, type: "type" | "status" | "stage") => {
    setDialogType(type);
    setEditingItem(item);
    setFormData({ name: item.name, color: item.color || COLORS[0] });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const endpoints = {
      type: "/api/v1/job_types",
      status: "/api/v1/job_status",
      stage: "/api/v1/job_stages",
    };

    try {
      if (editingItem) {
        await api.patch(`${endpoints[dialogType]}/${editingItem.id}`, {
          [dialogType === "type" ? "job_type" : dialogType === "status" ? "job_status" : "job_stage"]: formData,
        });
        toast({ title: "Success", description: "Item updated successfully" });
      } else {
        await api.post(endpoints[dialogType], {
          [dialogType === "type" ? "job_type" : dialogType === "status" ? "job_status" : "job_stage"]: formData,
        });
        toast({ title: "Success", description: "Item created successfully" });
      }
      setShowDialog(false);
      loadData();
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "Failed to save item", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, type: "type" | "status" | "stage") => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    const endpoints = {
      type: "/api/v1/job_types",
      status: "/api/v1/job_status",
      stage: "/api/v1/job_stages",
    };

    try {
      await api.delete(`${endpoints[type]}/${id}`);
      toast({ title: "Success", description: "Item deleted successfully" });
      loadData();
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  };

  const handleReorder = async (items: (JobType | JobStatus | JobStage)[], type: "type" | "status" | "stage") => {
    const endpoints = {
      type: "/api/v1/job_types/reorder",
      status: "/api/v1/job_status/reorder",
      stage: "/api/v1/job_stages/reorder",
    };

    // Backend expects different param names for each type
    const paramKeys = {
      type: "job_type_ids",
      status: "job_status_ids",
      stage: "job_stage_ids",
    };

    // Update local state immediately (optimistic update)
    if (type === "type") setJobTypes(items as JobType[]);
    if (type === "status") setJobStatuses(items as JobStatus[]);
    if (type === "stage") setJobStages(items as JobStage[]);

    try {
      await api.post(endpoints[type], {
        [paramKeys[type]]: items.map((item) => item.id),
      });
      toast({ title: "Order saved", description: "Position order has been updated" });
    } catch (error) {
      console.error("Failed to reorder:", error);
      toast({ title: "Error", description: "Failed to save order", variant: "destructive" });
      // Reload on error to restore correct state
      loadData();
    }
  };

  const getDialogTitle = () => {
    const action = editingItem ? "Edit" : "Add";
    switch (dialogType) {
      case "type":
        return `${action} Job Type`;
      case "status":
        return `${action} Job Status`;
      case "stage":
        return `${action} Job Stage`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <SortableList
          items={jobTypes}
          title="Job Types"
          icon={Briefcase}
          onAdd={() => handleOpenAddDialog("type")}
          onEdit={(item) => handleOpenEditDialog(item, "type")}
          onDelete={(id) => handleDelete(id, "type")}
          onReorder={(items) => handleReorder(items, "type")}
          loading={loading}
        />
        <SortableList
          items={jobStatuses}
          title="Job Statuses"
          icon={ListChecks}
          onAdd={() => handleOpenAddDialog("status")}
          onEdit={(item) => handleOpenEditDialog(item, "status")}
          onDelete={(id) => handleDelete(id, "status")}
          onReorder={(items) => handleReorder(items, "status")}
          loading={loading}
        />
        <SortableList
          items={jobStages}
          title="Job Stages"
          icon={Layers}
          onAdd={() => handleOpenAddDialog("stage")}
          onEdit={(item) => handleOpenEditDialog(item, "stage")}
          onDelete={(id) => handleDelete(id, "stage")}
          onReorder={(items) => handleReorder(items, "stage")}
          loading={loading}
        />
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>
              Configure the name and color for this item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-transform",
                      formData.color === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-8 p-0 border-0"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#000000"
                  className="w-24 font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingItem ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
