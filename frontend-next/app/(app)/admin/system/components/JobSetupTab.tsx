"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
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
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...items];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, removed);

    // Update positions
    newItems.forEach((item, i) => {
      item.position = i + 1;
    });

    onReorder(newItems);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
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
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No items yet. Click Add to create one.
          </div>
        ) : (
          <div className="space-y-1">
            {items
              .sort((a, b) => a.position - b.position)
              .map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-muted/50 cursor-move",
                    draggedIndex === index && "opacity-50"
                  )}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  {item.color && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span className="flex-1 text-sm">{item.name}</span>
                  <div className="flex items-center gap-1">
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
                      className="h-7 w-7 text-destructive"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
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
      const [types, statuses, stages] = await Promise.all([
        api.get<JobType[]>("/api/v1/job_types"),
        api.get<JobStatus[]>("/api/v1/job_status"),
        api.get<JobStage[]>("/api/v1/job_stages"),
      ]);
      setJobTypes(types);
      setJobStatuses(statuses);
      setJobStages(stages);
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

    // Update local state immediately
    if (type === "type") setJobTypes(items as JobType[]);
    if (type === "status") setJobStatuses(items as JobStatus[]);
    if (type === "stage") setJobStages(items as JobStage[]);

    try {
      await api.post(endpoints[type], {
        order: items.map((item) => item.id),
      });
    } catch (error) {
      console.error("Failed to reorder:", error);
      // Reload on error
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
