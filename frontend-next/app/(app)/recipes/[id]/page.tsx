"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Calculator,
  Package,
  DollarSign,
  History
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecipeItemsEditor, type RecipeItem } from "@/components/recipes/RecipeItemsEditor";

interface RecipeVersion {
  id: number;
  version_number: number;
  total_amount: number;
  created_at: string;
  created_by_name?: string;
  notes?: string;
}

interface Recipe {
  id: number;
  code: string;
  name: string;
  description?: string;
  recipe_type: string;
  status: string;
  recipe_category_id?: number;
  default_supplier_id?: number;
  notes?: string;
  cached_total?: number;
  items?: RecipeItem[];
  versions?: RecipeVersion[];
}

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Test values for formula calculation
  const [testValues, setTestValues] = useState<Record<string, number>>({
    floor_area: 180,
    ceiling_height: 2.7,
    bedroom_count: 4,
    bathroom_count: 2,
  });
  const [calculatedTotal, setCalculatedTotal] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Fetch recipe details
  const fetchRecipe = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ success: boolean; recipe: Recipe }>(`/api/v1/recipes/${recipeId}`);
      if (response?.success) {
        setRecipe(response.recipe);
      }
    } catch (error) {
      console.error("Failed to fetch recipe:", error);
      toast.error("Failed to load recipe");
    } finally {
      setIsLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    fetchRecipe();
  }, [fetchRecipe]);

  // Handle field changes
  const handleFieldChange = (field: keyof Recipe, value: unknown) => {
    if (!recipe) return;
    setRecipe({ ...recipe, [field]: value });
    setHasChanges(true);
  };

  // Handle save
  const handleSave = async () => {
    if (!recipe) return;
    setIsSaving(true);
    try {
      await api.patch(`/api/v1/recipes/${recipe.id}`, {
        recipe: {
          code: recipe.code,
          name: recipe.name,
          description: recipe.description,
          recipe_type: recipe.recipe_type,
          status: recipe.status,
          notes: recipe.notes,
        }
      });
      toast.success("Recipe saved");
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save recipe:", error);
      toast.error("Failed to save recipe");
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate with test values
  const handleCalculate = async () => {
    if (!recipe) return;
    setIsCalculating(true);
    try {
      const response = await api.post<{ success: boolean; total: number }>(`/api/v1/recipes/${recipe.id}/calculate`, {
        variables: testValues
      });
      if (response?.success) {
        setCalculatedTotal(response.total);
        toast.success(`Total: $${response.total.toLocaleString()}`);
      }
    } catch (error) {
      console.error("Failed to calculate:", error);
      toast.error("Failed to calculate");
    } finally {
      setIsCalculating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Recipe not found</p>
        <Button variant="outline" onClick={() => router.push("/recipes")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Recipes
        </Button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    archived: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  const typeLabels: Record<string, string> = {
    materials: "Materials",
    labour: "Labour",
    full_assembly: "Full Assembly",
    subcontract: "Subcontract",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/recipes")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{recipe.name}</h1>
              <Badge variant="outline" className={statusColors[recipe.status]}>
                {recipe.status}
              </Badge>
              <Badge variant="secondary">{typeLabels[recipe.recipe_type]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{recipe.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-sm text-muted-foreground">Unsaved changes</span>
          )}
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="items">
              <Package className="h-4 w-4 mr-2" />
              Items ({recipe.items?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="calculator">
              <Calculator className="h-4 w-4 mr-2" />
              Calculator
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recipe Details</CardTitle>
                <CardDescription>Basic information about this recipe</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      value={recipe.code}
                      onChange={(e) => handleFieldChange("code", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={recipe.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={recipe.description || ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select
                      value={recipe.recipe_type}
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
                    <Label>Status</Label>
                    <Select
                      value={recipe.status}
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
                    value={recipe.notes || ""}
                    onChange={(e) => handleFieldChange("notes", e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Totals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Cached Total</p>
                    <p className="text-2xl font-semibold">
                      ${recipe.cached_total?.toLocaleString() || "0.00"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Items</p>
                    <p className="text-2xl font-semibold">{recipe.items?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Versions</p>
                    <p className="text-2xl font-semibold">{recipe.versions?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items">
            <RecipeItemsEditor
              recipeId={recipe.id}
              items={recipe.items || []}
              onItemsChange={(newItems) => setRecipe({ ...recipe, items: newItems })}
              onRefresh={fetchRecipe}
            />
          </TabsContent>

          {/* Calculator Tab */}
          <TabsContent value="calculator">
            <Card>
              <CardHeader>
                <CardTitle>Recipe Calculator</CardTitle>
                <CardDescription>Test recipe calculations with sample values</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <Label>Floor Area (m²)</Label>
                    <Input
                      type="number"
                      value={testValues.floor_area}
                      onChange={(e) => setTestValues({ ...testValues, floor_area: Number(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Ceiling Height (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={testValues.ceiling_height}
                      onChange={(e) => setTestValues({ ...testValues, ceiling_height: Number(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Bedrooms</Label>
                    <Input
                      type="number"
                      value={testValues.bedroom_count}
                      onChange={(e) => setTestValues({ ...testValues, bedroom_count: Number(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Bathrooms</Label>
                    <Input
                      type="number"
                      value={testValues.bathroom_count}
                      onChange={(e) => setTestValues({ ...testValues, bathroom_count: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Button onClick={handleCalculate} disabled={isCalculating}>
                    {isCalculating ? <Spinner className="mr-2 h-4 w-4" /> : <Calculator className="h-4 w-4 mr-2" />}
                    Calculate
                  </Button>
                  {calculatedTotal !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Calculated Total:</span>
                      <span className="text-2xl font-bold text-green-500">
                        ${calculatedTotal.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Version History</CardTitle>
                <CardDescription>Price snapshots and changes over time</CardDescription>
              </CardHeader>
              <CardContent>
                {recipe.versions && recipe.versions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>By</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipe.versions.map((version) => (
                        <TableRow key={version.id}>
                          <TableCell className="font-medium">v{version.version_number}</TableCell>
                          <TableCell>${version.total_amount.toLocaleString()}</TableCell>
                          <TableCell>{new Date(version.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>{version.created_by_name || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">{version.notes || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <History className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No version history yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Versions are created when recipe prices change
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
