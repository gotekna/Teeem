"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Folder,
  FileText,
  Hash,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { TokenBuilder } from "@/components/ui/tokens/TokenBuilder";
import type { PlaceholderToken } from "@/lib/placeholders";

// Custom placeholders for Plan Types
const PLAN_TYPE_PLACEHOLDERS: PlaceholderToken[] = [
  // Job placeholders
  {
    code: "{JobCode}",
    example: "EB2401",
    color: "orange",
    description: "Job code (e.g., EB2401)",
  },
  {
    code: "{JobName}",
    example: "05 Wategors",
    color: "orange",
    description: "Job name/title (short)",
  },
  {
    code: "{JobAddress}",
    example: "Lot 5 Wategois Street Claamvale",
    color: "orange",
    description: "Full job address",
  },
  {
    code: "{LotNumber}",
    example: "5",
    color: "orange",
    description: "Lot number",
  },
  {
    code: "{StreetName}",
    example: "Wategois Street",
    color: "orange",
    description: "Street name",
  },
  {
    code: "{Suburb}",
    example: "Claamvale",
    color: "orange",
    description: "Suburb",
  },
  // Plan type placeholders
  {
    code: "{Code}",
    example: "01",
    color: "blue",
    description: "Plan type code (01, 02, 07, etc.)",
  },
  {
    code: "{Name}",
    example: "PERSPECTIVE",
    color: "blue",
    description: "Plan type name (short)",
  },
  {
    code: "{Description}",
    example: "Perspective Drawing - Front Elevation View",
    color: "blue",
    description: "Plan type long description",
  },
  {
    code: "{Category}",
    example: "Contract Drawings",
    color: "blue",
    description: "Plan category name",
  },
  {
    code: "{CategoryCode}",
    example: "ConD",
    color: "blue",
    description: "Plan category code",
  },
  // Revision/version placeholders
  {
    code: "{Rev}",
    example: "A",
    color: "green",
    description: "Revision letter/number",
  },
  {
    code: "{Date}",
    example: "20251218",
    color: "green",
    description: "Date in YYYYMMDD format",
  },
  {
    code: "{Variant}",
    example: "a",
    color: "purple",
    description: "Variant suffix (a, b, c)",
  },
  // Project placeholders
  {
    code: "{ProjectName}",
    example: "Wategors Estate",
    color: "purple",
    description: "Project name",
  },
];

interface PlanCategory {
  id: number;
  name: string;
  code: string;
  sequence_order: number;
  is_active: boolean;
}

interface PlanType {
  id: number;
  name: string;
  code: string;
  allows_variants: boolean;
  notes: string;
  sequence_order: number;
  is_active: boolean;
  short_name_template?: string;
  long_name_template?: string;
  short_name_preview?: string;
  long_name_preview?: string;
  // Many-to-many: array of category IDs
  category_ids: number[];
  category_names?: string;
  categories?: { id: number; name: string; code: string }[];
}

interface RevisionFormat {
  id: number;
  name: string;
  sequence: string[];
  is_default: boolean;
}

export function PlansTab() {
  const [activeTab, setActiveTab] = React.useState("categories");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Plans Configuration</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure plan categories, types, and revision formats for the Plans tab on job pages.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="categories">
            <Folder className="h-4 w-4 mr-2" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="types">
            <FileText className="h-4 w-4 mr-2" />
            Plan Types
          </TabsTrigger>
          <TabsTrigger value="revisions">
            <Hash className="h-4 w-4 mr-2" />
            Revision Formats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-6">
          <CategoriesSection />
        </TabsContent>
        <TabsContent value="types" className="mt-6">
          <TypesSection />
        </TabsContent>
        <TabsContent value="revisions" className="mt-6">
          <RevisionFormatsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategoriesSection() {
  const { toast } = useToast();
  const [categories, setCategories] = React.useState<PlanCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editing, setEditing] = React.useState<PlanCategory | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    code: "",
    sequence_order: 0,
    is_active: true,
  });

  React.useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await api.get<{ success: boolean; data: PlanCategory[] }>("/api/v1/plan_categories");
      if (response?.data) {
        setCategories(response.data);
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({ name: "", code: "", sequence_order: categories.length, is_active: true });
    setEditing(null);
    setShowDialog(true);
  };

  const handleOpenEditDialog = (category: PlanCategory) => {
    setFormData({
      name: category.name,
      code: category.code || "",
      sequence_order: category.sequence_order,
      is_active: category.is_active,
    });
    setEditing(category);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/v1/plan_categories/${editing.id}`, { plan_category: formData });
        toast({ title: "Success", description: "Category updated" });
      } else {
        await api.post("/api/v1/plan_categories", { plan_category: formData });
        toast({ title: "Success", description: "Category created" });
      }
      setShowDialog(false);
      loadCategories();
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "Failed to save category", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/plan_categories/${id}`);
      toast({ title: "Success", description: "Category deleted" });
      loadCategories();
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Plan Categories</h3>
          <p className="text-sm text-muted-foreground">
            Categories group plan types (e.g., Drawings, Certification, Cabinets)
          </p>
        </div>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {categories.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No categories yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Folder className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {category.code && (
                          <Badge variant="outline" className="text-xs">
                            {category.code}
                          </Badge>
                        )}
                        {!category.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                      onClick={() => handleDelete(category.id)}
                      disabled={deleting === category.id}
                    >
                      {deleting === category.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-500" />
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
            <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the category details" : "Create a new plan category"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Drawings"
              />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., A"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: !!checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface GlobalDefaults {
  short_name_template: string;
  long_name_template: string;
}

function TypesSection() {
  const { toast } = useToast();
  const [types, setTypes] = React.useState<PlanType[]>([]);
  const [categories, setCategories] = React.useState<PlanCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editing, setEditing] = React.useState<PlanType | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);
  const [filterCategory, setFilterCategory] = React.useState<string>("all");

  // Global defaults state
  const [globalDefaults, setGlobalDefaults] = React.useState<GlobalDefaults>({
    short_name_template: "{Code}-{Name}",
    long_name_template: "{JobCode}-{Code}-{Name}-Rev{Rev}",
  });
  const [editingDefaults, setEditingDefaults] = React.useState(false);
  const [savingDefaults, setSavingDefaults] = React.useState(false);

  const [formData, setFormData] = React.useState({
    category_ids: [] as number[],
    name: "",
    code: "",
    allows_variants: true,
    notes: "",
    sequence_order: 0,
    is_active: true,
    short_name_template: "",
    long_name_template: "",
  });

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [typesRes, catsRes, defaultsRes] = await Promise.all([
        api.get<{ success: boolean; data: PlanType[] }>("/api/v1/plan_types"),
        api.get<{ success: boolean; data: PlanCategory[] }>("/api/v1/plan_categories"),
        api.get<{ success: boolean; data: GlobalDefaults }>("/api/v1/plan_types/defaults"),
      ]);
      if (typesRes?.data) setTypes(typesRes.data);
      if (catsRes?.data) setCategories(catsRes.data);
      if (defaultsRes?.data) setGlobalDefaults(defaultsRes.data);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDefaults = async () => {
    setSavingDefaults(true);
    try {
      await api.patch("/api/v1/plan_types/defaults", {
        short_name_template: globalDefaults.short_name_template,
        long_name_template: globalDefaults.long_name_template,
      });
      toast({ title: "Success", description: "Global defaults saved" });
      setEditingDefaults(false);
      loadData(); // Reload to update previews
    } catch (error) {
      console.error("Failed to save defaults:", error);
      toast({ title: "Error", description: "Failed to save defaults", variant: "destructive" });
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({
      category_ids: [],
      name: "",
      code: "",
      allows_variants: true,
      notes: "",
      sequence_order: types.length,
      is_active: true,
      short_name_template: "", // Empty = use global default
      long_name_template: "", // Empty = use global default
    });
    setEditing(null);
    setShowDialog(true);
  };

  const handleOpenEditDialog = (type: PlanType) => {
    setFormData({
      category_ids: type.category_ids || [],
      name: type.name,
      code: type.code,
      allows_variants: type.allows_variants,
      notes: type.notes || "",
      sequence_order: type.sequence_order,
      is_active: type.is_active,
      // Keep empty to use global defaults - don't set fallback values
      short_name_template: type.short_name_template || "",
      long_name_template: type.long_name_template || "",
    });
    setEditing(type);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast({ title: "Error", description: "Name and code are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        plan_type: {
          ...formData,
        },
      };

      if (editing) {
        await api.put(`/api/v1/plan_types/${editing.id}`, payload);
        toast({ title: "Success", description: "Plan type updated" });
      } else {
        await api.post("/api/v1/plan_types", payload);
        toast({ title: "Success", description: "Plan type created" });
      }
      setShowDialog(false);
      loadData();
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "Failed to save plan type", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this plan type?")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/plan_types/${id}`);
      toast({ title: "Success", description: "Plan type deleted" });
      loadData();
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({ title: "Error", description: "Failed to delete plan type", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const filteredTypes = filterCategory === "all"
    ? types
    : types.filter(t => t.category_ids?.includes(parseInt(filterCategory)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Global Default Templates */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Global Default Templates</CardTitle>
            {!editingDefaults ? (
              <Button variant="outline" size="sm" onClick={() => setEditingDefaults(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingDefaults(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveDefaults} disabled={savingDefaults}>
                  {savingDefaults && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-4">
            These templates are used for all plan types unless overridden individually.
          </p>
          {editingDefaults ? (
            <div className="space-y-4">
              <TokenBuilder
                label="Default Short Name Template"
                value={globalDefaults.short_name_template}
                onChange={(value) => setGlobalDefaults({ ...globalDefaults, short_name_template: value })}
                placeholders={PLAN_TYPE_PLACEHOLDERS}
                showPreview
                previewData={{
                  JobCode: "EB2401",
                  JobName: "05 Wategors",
                  JobAddress: "Lot 5 Wategois Street Claamvale",
                  LotNumber: "5",
                  StreetName: "Wategois Street",
                  Suburb: "Claamvale",
                  Code: "01",
                  Name: "PERSPECTIVE",
                  Description: "Perspective Drawing - Front Elevation View",
                  Category: "Contract Drawings",
                  CategoryCode: "ConD",
                  Rev: "A",
                  Date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
                  Variant: "a",
                  ProjectName: "Wategors Estate",
                }}
                helpText="Used for display in tables and lists"
              />
              <TokenBuilder
                label="Default Long Name Template (SharePoint filename)"
                value={globalDefaults.long_name_template}
                onChange={(value) => setGlobalDefaults({ ...globalDefaults, long_name_template: value })}
                placeholders={PLAN_TYPE_PLACEHOLDERS}
                showPreview
                previewData={{
                  JobCode: "EB2401",
                  JobName: "05 Wategors",
                  JobAddress: "Lot 5 Wategois Street Claamvale",
                  LotNumber: "5",
                  StreetName: "Wategois Street",
                  Suburb: "Claamvale",
                  Code: "01",
                  Name: "PERSPECTIVE",
                  Description: "Perspective Drawing - Front Elevation View",
                  Category: "Contract Drawings",
                  CategoryCode: "ConD",
                  Rev: "A",
                  Date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
                  Variant: "a",
                  ProjectName: "Wategors Estate",
                }}
                helpText="Used for file names when saving to SharePoint"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Short Name</p>
                <p className="text-sm text-muted-foreground font-mono">{globalDefaults.short_name_template}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Long Name (SharePoint)</p>
                <p className="text-sm text-muted-foreground font-mono">{globalDefaults.long_name_template}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Types List */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Plan Types</h3>
          <p className="text-sm text-muted-foreground">
            Standard drawing types (e.g., 01-PERSPECTIVE, 07-SLAB PLAN)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleOpenAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Type
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filteredTypes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No plan types yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {type.code}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">{type.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        {type.categories?.map((cat) => (
                          <Badge key={cat.id} variant="outline" className="text-xs">
                            {cat.name}
                          </Badge>
                        ))}
                        {(!type.categories || type.categories.length === 0) && (
                          <span className="text-xs text-muted-foreground">No categories</span>
                        )}
                        {type.allows_variants && (
                          <span className="text-xs">Allows variants</span>
                        )}
                        {!type.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {/* Name Previews */}
                      <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                        <div><span className="font-medium">Short:</span> {type.short_name_preview || `${type.code}-${type.name}`}</div>
                        <div><span className="font-medium">Long:</span> {type.long_name_preview || `EB2401-${type.code}-${type.name}-RevA`}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEditDialog(type)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(type.id)}
                      disabled={deleting === type.id}
                    >
                      {deleting === type.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-500" />
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
            <DialogTitle>{editing ? "Edit Plan Type" : "Add Plan Type"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the plan type details" : "Create a new plan type"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="border rounded-md p-3 space-y-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`cat-${cat.id}`}
                      checked={formData.category_ids.includes(cat.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, category_ids: [...formData.category_ids, cat.id] });
                        } else {
                          setFormData({ ...formData, category_ids: formData.category_ids.filter(id => id !== cat.id) });
                        }
                      }}
                    />
                    <Label htmlFor={`cat-${cat.id}`} className="text-sm font-normal cursor-pointer">
                      {cat.name}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select which categories this plan type belongs to
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., 01"
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., PERSPECTIVE"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>

            {/* Naming Templates */}
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-1">File Naming Templates (Optional)</p>
              <p className="text-xs text-muted-foreground mb-3">
                Leave empty to use global defaults. Set custom templates to override for this type only.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <TokenBuilder
                    label="Short Name Template"
                    value={formData.short_name_template}
                    onChange={(value) => setFormData({ ...formData, short_name_template: value })}
                    placeholders={PLAN_TYPE_PLACEHOLDERS}
                    showPreview={!!formData.short_name_template}
                    previewData={{
                      JobCode: "EB2401",
                      JobName: "05 Wategors",
                      JobAddress: "Lot 5 Wategois Street Claamvale",
                      LotNumber: "5",
                      StreetName: "Wategois Street",
                      Suburb: "Claamvale",
                      Code: formData.code || "01",
                      Name: formData.name || "PERSPECTIVE",
                      Description: "Perspective Drawing - Front Elevation View",
                      Category: "Contract Drawings",
                      CategoryCode: "ConD",
                      Rev: "A",
                      Date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
                      Variant: "a",
                      ProjectName: "Wategors Estate",
                    }}
                    placeholder="Empty = use global default"
                    helpText={formData.short_name_template ? "Custom template (overrides global default)" : undefined}
                  />
                  {!formData.short_name_template && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <span className="font-medium">Using global default:</span>{" "}
                      <span className="font-mono">{globalDefaults.short_name_template}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <TokenBuilder
                    label="Long Name Template (SharePoint filename)"
                    value={formData.long_name_template}
                    onChange={(value) => setFormData({ ...formData, long_name_template: value })}
                    placeholders={PLAN_TYPE_PLACEHOLDERS}
                    showPreview={!!formData.long_name_template}
                    previewData={{
                      JobCode: "EB2401",
                      JobName: "05 Wategors",
                      JobAddress: "Lot 5 Wategois Street Claamvale",
                      LotNumber: "5",
                      StreetName: "Wategois Street",
                      Suburb: "Claamvale",
                      Code: formData.code || "01",
                      Name: formData.name || "PERSPECTIVE",
                      Description: "Perspective Drawing - Front Elevation View",
                      Category: "Contract Drawings",
                      CategoryCode: "ConD",
                      Rev: "A",
                      Date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
                      Variant: "a",
                      ProjectName: "Wategors Estate",
                    }}
                    placeholder="Empty = use global default"
                    helpText={formData.long_name_template ? "Custom template (overrides global default)" : undefined}
                  />
                  {!formData.long_name_template && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <span className="font-medium">Using global default:</span>{" "}
                      <span className="font-mono">{globalDefaults.long_name_template}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="allows_variants"
                  checked={formData.allows_variants}
                  onCheckedChange={(checked) => setFormData({ ...formData, allows_variants: !!checked })}
                />
                <Label htmlFor="allows_variants">Allows variants (a, b, c)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: !!checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RevisionFormatsSection() {
  const { toast } = useToast();
  const [formats, setFormats] = React.useState<RevisionFormat[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editing, setEditing] = React.useState<RevisionFormat | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    sequence: "",
    is_default: false,
  });

  React.useEffect(() => {
    loadFormats();
  }, []);

  const loadFormats = async () => {
    try {
      const response = await api.get<{ success: boolean; data: RevisionFormat[] }>("/api/v1/revision_formats");
      if (response?.data) {
        setFormats(response.data);
      }
    } catch (error) {
      console.error("Failed to load formats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({ name: "", sequence: "", is_default: false });
    setEditing(null);
    setShowDialog(true);
  };

  const handleOpenEditDialog = (format: RevisionFormat) => {
    setFormData({
      name: format.name,
      sequence: format.sequence.join(", "),
      is_default: format.is_default,
    });
    setEditing(format);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.sequence.trim()) {
      toast({ title: "Error", description: "Name and sequence are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const sequenceArray = formData.sequence.split(",").map(s => s.trim()).filter(Boolean);
      const payload = {
        revision_format: {
          name: formData.name,
          sequence: JSON.stringify(sequenceArray),
          is_default: formData.is_default,
        },
      };

      if (editing) {
        await api.put(`/api/v1/revision_formats/${editing.id}`, payload);
        toast({ title: "Success", description: "Format updated" });
      } else {
        await api.post("/api/v1/revision_formats", payload);
        toast({ title: "Success", description: "Format created" });
      }
      setShowDialog(false);
      loadFormats();
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "Failed to save format", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this format?")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/revision_formats/${id}`);
      toast({ title: "Success", description: "Format deleted" });
      loadFormats();
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({ title: "Error", description: "Failed to delete format", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await api.put(`/api/v1/revision_formats/${id}`, { is_default: true });
      toast({ title: "Success", description: "Default format updated" });
      loadFormats();
    } catch (error) {
      console.error("Failed to set default:", error);
      toast({ title: "Error", description: "Failed to set default", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Revision Formats</h3>
          <p className="text-sm text-muted-foreground">
            Configure revision sequences (e.g., A, B, C or 1, 2, 3)
          </p>
        </div>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Format
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {formats.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Hash className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No revision formats yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {formats.map((format) => (
                <div
                  key={format.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Hash className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{format.name}</p>
                        {format.is_default && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format.sequence.slice(0, 10).join(", ")}
                        {format.sequence.length > 10 && "..."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!format.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(format.id)}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEditDialog(format)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(format.id)}
                      disabled={deleting === format.id}
                    >
                      {deleting === format.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-500" />
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
            <DialogTitle>{editing ? "Edit Format" : "Add Format"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the revision format" : "Create a new revision format"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Letters"
              />
            </div>
            <div className="space-y-2">
              <Label>Sequence (comma-separated)</Label>
              <Input
                value={formData.sequence}
                onChange={(e) => setFormData({ ...formData, sequence: e.target.value })}
                placeholder="e.g., A, B, C, D, E"
              />
              <p className="text-xs text-muted-foreground">
                Enter the revision sequence separated by commas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: !!checked })}
              />
              <Label htmlFor="is_default">Set as default format</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
