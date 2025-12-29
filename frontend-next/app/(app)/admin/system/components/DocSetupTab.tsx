"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  GripVertical,
  Pencil,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface DocumentationCategory {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  folder_path: string;
  sequence: number;
}

const PRESET_COLORS = [
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
  "#14B8A6", // Teal
  "#A855F7", // Violet
];

export function DocSetupTab() {
  const { toast } = useToast();
  const [categories, setCategories] = React.useState<DocumentationCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<DocumentationCategory | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    color: PRESET_COLORS[0],
    folder_path: "",
  });

  React.useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await api.get<{ documentation_categories: DocumentationCategory[] }>("/api/v1/documentation_categories");
      setCategories(response.documentation_categories || []);
    } catch (error) {
      console.error("Failed to load categories:", error);
      // Mock data
      setCategories([
        {
          id: 1,
          name: "Contracts",
          description: "Contract documents and agreements",
          color: "#3B82F6",
          icon: "file-text",
          folder_path: "/Contracts",
          sequence: 1,
        },
        {
          id: 2,
          name: "Permits",
          description: "Building permits and approvals",
          color: "#10B981",
          icon: "file-check",
          folder_path: "/Permits",
          sequence: 2,
        },
        {
          id: 3,
          name: "Plans",
          description: "Architectural and engineering plans",
          color: "#8B5CF6",
          icon: "layout",
          folder_path: "/Plans",
          sequence: 3,
        },
        {
          id: 4,
          name: "Site Photos",
          description: "Construction progress photos",
          color: "#F59E0B",
          icon: "image",
          folder_path: "/Site Photos",
          sequence: 4,
        },
        {
          id: 5,
          name: "Invoices",
          description: "Supplier and subcontractor invoices",
          color: "#EF4444",
          icon: "receipt",
          folder_path: "/Invoices",
          sequence: 5,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({
      name: "",
      description: "",
      color: PRESET_COLORS[0],
      folder_path: "",
    });
    setEditingCategory(null);
    setShowDialog(true);
  };

  const handleOpenEditDialog = (category: DocumentationCategory) => {
    setFormData({
      name: category.name,
      description: category.description || "",
      color: category.color || PRESET_COLORS[0],
      folder_path: category.folder_path || "",
    });
    setEditingCategory(category);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Category name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        await api.patch(`/api/v1/documentation_categories/${editingCategory.id}`, {
          documentation_category: formData,
        });
        toast({ title: "Success", description: "Category updated successfully" });
      } else {
        await api.post("/api/v1/documentation_categories", {
          documentation_category: {
            ...formData,
            sequence: categories.length + 1,
          },
        });
        toast({ title: "Success", description: "Category created successfully" });
      }
      setShowDialog(false);
      loadCategories();
    } catch (error) {
      console.error("Failed to save category:", error);
      toast({ title: "Error", description: "Failed to save category", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/documentation_categories/${id}`);
      toast({ title: "Success", description: "Category deleted successfully" });
      loadCategories();
    } catch (error) {
      console.error("Failed to delete category:", error);
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newCategories = [...categories];
    const [removed] = newCategories.splice(draggedIndex, 1);
    newCategories.splice(index, 0, removed);

    // Update sequences
    newCategories.forEach((cat, i) => {
      cat.sequence = i + 1;
    });

    setCategories(newCategories);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);

    try {
      await api.post("/api/v1/documentation_categories/reorder", {
        order: categories.map((c) => c.id),
      });
    } catch (error) {
      console.error("Failed to save order:", error);
      loadCategories();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Documentation Categories</h2>
          <p className="text-sm text-muted-foreground">
            Configure the categories used to organize job documentation.
          </p>
        </div>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Category
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No categories yet</h3>
              <p className="text-center max-w-md mb-4">
                Create documentation categories to organize files and documents for your jobs.
              </p>
              <Button onClick={handleOpenAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Category
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {(Array.isArray(categories) ? categories : [])
                .sort((a, b) => a.sequence - b.sequence)
                .map((category, index) => (
                  <div
                    key={category.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-4 p-4 hover:bg-muted/50 cursor-move",
                      draggedIndex === index && "opacity-50 bg-muted"
                    )}
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: category.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{category.name}</p>
                        {category.folder_path && (
                          <Badge variant="outline" className="text-xs">
                            <FolderOpen className="h-3 w-3 mr-1" />
                            {category.folder_path}
                          </Badge>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {category.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditDialog(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        disabled={deleting === category.id}
                        onClick={() => handleDelete(category.id)}
                      >
                        {deleting === category.id ? (
                          <Spinner size={16} />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "New Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the documentation category details."
                : "Create a new documentation category for organizing job files."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name</Label>
              <Input
                id="name"
                placeholder="e.g., Contracts"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of this category"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
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
            <div className="space-y-2">
              <Label htmlFor="folder_path">SharePoint Folder Path (Optional)</Label>
              <Input
                id="folder_path"
                placeholder="e.g., /Documents/Contracts"
                value={formData.folder_path}
                onChange={(e) => setFormData({ ...formData, folder_path: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Map this category to a specific SharePoint folder for automatic file sync.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : editingCategory ? (
                "Update Category"
              ) : (
                "Create Category"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
