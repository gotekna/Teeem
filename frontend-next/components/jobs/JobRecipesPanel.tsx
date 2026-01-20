"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Trash2,
  FileText,
  Package,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  ShoppingCart,
  Check,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";

interface Recipe {
  id: number;
  code: string;
  name: string;
  recipe_type: string;
  cached_total: number;
  category_name: string | null;
  item_count: number;
}

interface JobRecipe {
  id: number;
  recipe_id: number;
  recipe_code: string;
  recipe_name: string;
  recipe_type: string;
  quantity_multiplier: number;
  applied_total: number;
  status: string;
  applied_at: string;
  applied_by_name: string | null;
  notes: string | null;
  line_items?: {
    id: number;
    description: string;
    base_quantity: number;
    calculated_quantity: number;
    unit_price: number;
    line_total: number;
    uses_formula: boolean;
    quantity_formula: string | null;
  }[];
}

interface GeneratedPO {
  id: number;
  po_number: string;
  supplier_name: string;
  total: number;
}

interface JobRecipesPanelProps {
  jobId: string | number;
  onPOGenerated?: () => void;
}

export function JobRecipesPanel({ jobId, onPOGenerated }: JobRecipesPanelProps) {
  const [loading, setLoading] = useState(true);
  const [jobRecipes, setJobRecipes] = useState<JobRecipe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecipes, setExpandedRecipes] = useState<number[]>([]);

  // Add recipe dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [availableRecipes, setAvailableRecipes] = useState<Recipe[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);

  // Generate PO dialog
  const [showPODialog, setShowPODialog] = useState(false);
  const [generatingPO, setGeneratingPO] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<JobRecipe | null>(null);
  const [generatedPOs, setGeneratedPOs] = useState<GeneratedPO[]>([]);

  useEffect(() => {
    loadJobRecipes();
  }, [jobId]);

  const loadJobRecipes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ success: boolean; job_recipes: JobRecipe[] }>(
        `/api/v1/jobs/${jobId}/recipes`
      );
      if (response?.success) {
        setJobRecipes(response.job_recipes);
      } else {
        setError("Failed to load recipes");
      }
    } catch (err) {
      console.error("Failed to load job recipes:", err);
      setError("Failed to load recipes");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableRecipes = async () => {
    try {
      setLoadingAvailable(true);
      const response = await api.get<{ success: boolean; recipes: Recipe[] }>(
        `/api/v1/jobs/${jobId}/recipes/available`,
        { params: { search: searchTerm } }
      );
      if (response?.success) {
        setAvailableRecipes(response.recipes);
      }
    } catch (err) {
      console.error("Failed to load available recipes:", err);
    } finally {
      setLoadingAvailable(false);
    }
  };

  const loadRecipeDetails = async (jobRecipeId: number) => {
    try {
      const response = await api.get<{ success: boolean; job_recipe: JobRecipe }>(
        `/api/v1/jobs/${jobId}/recipes/${jobRecipeId}`
      );
      if (response?.success) {
        setJobRecipes((prev) =>
          prev.map((jr) => (jr.id === jobRecipeId ? response.job_recipe : jr))
        );
      }
    } catch (err) {
      console.error("Failed to load recipe details:", err);
    }
  };

  const handleAddRecipe = async (recipeId: number) => {
    try {
      setAdding(recipeId);
      const response = await api.post<{ success: boolean; job_recipe: JobRecipe }>(
        `/api/v1/jobs/${jobId}/recipes`,
        { recipe_id: recipeId }
      );
      if (response?.success) {
        setJobRecipes((prev) => [...prev, response.job_recipe]);
        setAvailableRecipes((prev) => prev.filter((r) => r.id !== recipeId));
      }
    } catch (err) {
      console.error("Failed to add recipe:", err);
    } finally {
      setAdding(null);
    }
  };

  const handleRemoveRecipe = async (jobRecipeId: number) => {
    if (!confirm("Remove this recipe from the job?")) return;

    try {
      await api.delete(`/api/v1/jobs/${jobId}/recipes/${jobRecipeId}`);
      setJobRecipes((prev) => prev.filter((jr) => jr.id !== jobRecipeId));
    } catch (err) {
      console.error("Failed to remove recipe:", err);
    }
  };

  const handleGeneratePO = async () => {
    if (!selectedRecipe) return;

    try {
      setGeneratingPO(true);
      const response = await api.post<{
        success: boolean;
        purchase_orders: GeneratedPO[];
        message: string;
      }>(`/api/v1/jobs/${jobId}/recipes/${selectedRecipe.id}/generate_pos`);

      if (response?.success) {
        setGeneratedPOs(response.purchase_orders);
        await loadJobRecipes(); // Reload to update status
        onPOGenerated?.();
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      console.error("Failed to generate POs:", err);
      setError(apiErr?.response?.data?.error || "Failed to generate purchase orders");
    } finally {
      setGeneratingPO(false);
    }
  };

  const toggleRecipeExpanded = async (jobRecipeId: number) => {
    if (expandedRecipes.includes(jobRecipeId)) {
      setExpandedRecipes((prev) => prev.filter((id) => id !== jobRecipeId));
    } else {
      // Load details if not already loaded
      const recipe = jobRecipes.find((jr) => jr.id === jobRecipeId);
      if (recipe && !recipe.line_items) {
        await loadRecipeDetails(jobRecipeId);
      }
      setExpandedRecipes((prev) => [...prev, jobRecipeId]);
    }
  };

  const openAddDialog = () => {
    setShowAddDialog(true);
    setSearchTerm("");
    loadAvailableRecipes();
  };

  const openPODialog = (recipe: JobRecipe) => {
    setSelectedRecipe(recipe);
    setGeneratedPOs([]);
    setShowPODialog(true);
  };

  useEffect(() => {
    if (showAddDialog) {
      const debounce = setTimeout(() => {
        loadAvailableRecipes();
      }, 300);
      return () => clearTimeout(debounce);
    }
  }, [searchTerm, showAddDialog]);

  const totalApplied = jobRecipes.reduce((sum, jr) => sum + (jr.applied_total || 0), 0);
  const withPO = jobRecipes.filter((jr) => jr.status === "po_generated").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Applied Recipes</h3>
          <p className="text-sm text-muted-foreground">
            {jobRecipes.length} recipe{jobRecipes.length !== 1 ? "s" : ""} applied
            {withPO > 0 && ` • ${withPO} with PO generated`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadJobRecipes}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Recipe
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Summary Card */}
      {jobRecipes.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Total from Recipes</div>
                <div className="text-2xl font-bold">{formatCurrency(totalApplied)}</div>
              </div>
              {jobRecipes.some((jr) => jr.status === "applied") && (
                <Button
                  variant="default"
                  onClick={() => {
                    const firstApplied = jobRecipes.find((jr) => jr.status === "applied");
                    if (firstApplied) openPODialog(firstApplied);
                  }}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Generate Purchase Orders
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recipes Table */}
      {jobRecipes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No recipes applied to this job yet</p>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Recipe
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Recipe</TableHead>
                  <TableHead className="text-right">Multiplier</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobRecipes.map((jr) => {
                  const isExpanded = expandedRecipes.includes(jr.id);

                  return (
                    <>
                      <TableRow key={jr.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell onClick={() => toggleRecipeExpanded(jr.id)}>
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <div>
                              <div className="font-medium">{jr.recipe_name}</div>
                              <div className="text-sm text-muted-foreground">{jr.recipe_code}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ×{jr.quantity_multiplier}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(jr.applied_total)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={jr.status === "po_generated" ? "default" : "secondary"}
                            className={cn(
                              jr.status === "po_generated" &&
                                "bg-green-500/10 text-green-600 dark:text-green-400"
                            )}
                          >
                            {jr.status === "po_generated" ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                PO Generated
                              </>
                            ) : (
                              "Applied"
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {jr.status === "applied" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPODialog(jr)}
                              >
                                <ShoppingCart className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRecipe(jr.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Line Items */}
                      {isExpanded && jr.line_items && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30 p-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item</TableHead>
                                  <TableHead className="text-right">Qty</TableHead>
                                  <TableHead className="text-right">Unit Price</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {jr.line_items.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell>
                                      <div>
                                        {item.description}
                                        {item.uses_formula && (
                                          <span className="text-xs text-muted-foreground ml-2">
                                            (formula: {item.quantity_formula})
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {(item.calculated_quantity ?? 0).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      ${(item.unit_price ?? 0).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {formatCurrency(item.line_total)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Recipe Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Recipe to Job</DialogTitle>
            <DialogDescription>
              Select a recipe to apply to this job. The quantities will be calculated using the
              job&apos;s house specifications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto border rounded-lg">
              {loadingAvailable ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size={24} className="text-muted-foreground" />
                </div>
              ) : availableRecipes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No available recipes found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipe</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Base Total</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableRecipes.map((recipe) => (
                      <TableRow key={recipe.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{recipe.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {recipe.code}
                              {recipe.category_name && ` • ${recipe.category_name}`}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{recipe.recipe_type}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(recipe.cached_total)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleAddRecipe(recipe.id)}
                            disabled={adding === recipe.id}
                          >
                            {adding === recipe.id ? (
                              <Spinner size={16} />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate PO Dialog */}
      <Dialog open={showPODialog} onOpenChange={setShowPODialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Purchase Orders</DialogTitle>
            <DialogDescription>
              Create purchase orders from recipe &quot;{selectedRecipe?.recipe_name}&quot;.
              Items will be grouped by supplier.
            </DialogDescription>
          </DialogHeader>

          {generatedPOs.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg">
                <Check className="h-4 w-4" />
                Successfully created {generatedPOs.length} purchase order(s)
              </div>

              <div className="space-y-2">
                {generatedPOs.map((po) => (
                  <div
                    key={po.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{po.po_number}</div>
                      <div className="text-sm text-muted-foreground">{po.supplier_name}</div>
                    </div>
                    <div className="font-mono font-medium">{formatCurrency(po.total)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Recipe Total</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(selectedRecipe?.applied_total || 0)}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                This will create draft purchase orders that you can review before sending to
                suppliers.
              </p>
            </div>
          )}

          <DialogFooter>
            {generatedPOs.length > 0 ? (
              <Button onClick={() => setShowPODialog(false)}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowPODialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGeneratePO} disabled={generatingPO}>
                  {generatingPO ? (
                    <>
                      <Spinner size={16} className="mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Generate POs
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JobRecipesPanel;
