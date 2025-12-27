"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import { TablePage } from "@/components/ui/page-wrappers";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { TableRow } from "@/components/table/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface RecipeFormData {
  code: string;
  name: string;
  description: string;
  recipe_type: string;
  status: string;
  notes: string;
}

const initialFormData: RecipeFormData = {
  code: "",
  name: "",
  description: "",
  recipe_type: "materials",
  status: "draft",
  notes: "",
};

export default function RecipesPage() {
  const router = useRouter();

  // Use foundation hook for TeeemTableView
  const { foundation, records, totalCount, isLoading, refresh, serverSearch, isSearching } = useFoundationBySlug("recipes");

  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<RecipeFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  // Handle row click - open recipe detail
  const handleRowClick = useCallback((row: TableRow) => {
    const recipe = row as { id: number; code?: string };
    // Navigate to recipe detail page (we can create this later)
    router.push(`/recipes/${recipe.id}`);
  }, [router]);

  // Handle row double-click - open in sheet for quick edit
  const handleRowDoubleClick = useCallback((row: TableRow) => {
    const recipe = row as unknown as { id: number } & RecipeFormData;
    setSelectedRecipeId(recipe.id);
    setFormData({
      code: recipe.code || "",
      name: recipe.name || "",
      description: recipe.description || "",
      recipe_type: recipe.recipe_type || "materials",
      status: recipe.status || "draft",
      notes: recipe.notes || "",
    });
    setIsCreating(false);
    setSheetOpen(true);
  }, []);

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/recipes/${rowId}`, {
        recipe: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update recipe:", error);
      throw error;
    }
  }, [refresh]);

  // Handle form field changes
  const handleFieldChange = (field: keyof RecipeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle create new recipe
  const handleCreate = () => {
    setFormData(initialFormData);
    setSelectedRecipeId(null);
    setIsCreating(true);
    setSheetOpen(true);
  };

  // Handle save (create or update)
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isCreating) {
        await api.post("/api/v1/recipes", { recipe: formData });
        toast.success("Recipe created successfully");
      } else if (selectedRecipeId) {
        await api.patch(`/api/v1/recipes/${selectedRecipeId}`, { recipe: formData });
        toast.success("Recipe updated successfully");
      }
      setSheetOpen(false);
      refresh();
    } catch (error) {
      console.error("Failed to save recipe:", error);
      toast.error(isCreating ? "Failed to create recipe" : "Failed to update recipe");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle duplicate recipe
  const handleDuplicate = async (recipeId: number) => {
    try {
      const response = await api.post<{ success: boolean; recipe?: { id: number } }>(`/api/v1/recipes/${recipeId}/duplicate`);
      toast.success("Recipe duplicated successfully");
      refresh();
      // Navigate to the new recipe
      if (response?.recipe?.id) {
        router.push(`/recipes/${response.recipe.id}`);
      }
    } catch (error) {
      console.error("Failed to duplicate recipe:", error);
      toast.error("Failed to duplicate recipe");
    }
  };

  // Handle activate recipe
  const handleActivate = async (recipeId: number) => {
    try {
      await api.post(`/api/v1/recipes/${recipeId}/activate`);
      toast.success("Recipe activated");
      refresh();
    } catch (error) {
      console.error("Failed to activate recipe:", error);
      toast.error("Failed to activate recipe");
    }
  };

  // Handle archive recipe
  const handleArchive = async (recipeId: number) => {
    try {
      await api.post(`/api/v1/recipes/${recipeId}/archive`);
      toast.success("Recipe archived");
      refresh();
    } catch (error) {
      console.error("Failed to archive recipe:", error);
      toast.error("Failed to archive recipe");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  // Left actions - Add Recipe button
  const leftActions = (
    <Button variant="default" size="sm" onClick={handleCreate}>
      <Plus className="h-4 w-4 mr-2" />
      New Recipe
    </Button>
  );

  return (
    <TablePage>
      {/* TeeemTableView handles header, count, and table (SSoT) */}
      <TeeemTableView
        entries={records}
        totalCount={totalCount}
        foundationId="recipes"
        foundationIdNumeric={foundation?.id}
        tableName={foundation?.name || "Recipes"}
        enableExport={true}
        onRefresh={refresh}
        onRowClick={handleRowClick}
        onRowDoubleClick={handleRowDoubleClick}
        onRowUpdate={handleRowUpdate}
        onServerSearch={serverSearch}
        serverSearchLoading={isSearching}
        leftActions={leftActions}
      />

      {/* Recipe Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{isCreating ? "New Recipe" : "Edit Recipe"}</SheetTitle>
            <SheetDescription>
              {isCreating
                ? "Create a new recipe for estimating and purchase orders"
                : "Update recipe details"
              }
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => handleFieldChange("code", e.target.value)}
                placeholder="e.g., KITCHEN-STD"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="e.g., Standard Kitchen Package"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleFieldChange("description", e.target.value)}
                placeholder="Brief description of this recipe..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="recipe_type">Type</Label>
                <Select
                  value={formData.recipe_type}
                  onValueChange={(value) => handleFieldChange("recipe_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="materials">Materials</SelectItem>
                    <SelectItem value="labour">Labour</SelectItem>
                    <SelectItem value="full_assembly">Full Assembly</SelectItem>
                    <SelectItem value="subcontract">Subcontract</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleFieldChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleFieldChange("notes", e.target.value)}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.code || !formData.name}>
              {isSaving ? <Spinner className="mr-2 h-4 w-4" /> : null}
              {isCreating ? "Create Recipe" : "Save Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </TablePage>
  );
}
