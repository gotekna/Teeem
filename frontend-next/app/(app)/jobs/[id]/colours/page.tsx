"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Save,
  Palette,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { api, getApiBaseUrl } from "@/lib/api";

// Types
interface PricebookItem {
  id: number;
  item_code: string;
  item_name: string;
  current_price: number;
  colour?: string;
  colour_code?: string;
  colour_brand?: string;
}

interface JobColourSelection {
  id?: number;
  category_key: string;
  item_key: string;
  pricebook_item_id?: number;
  pricebook_item?: PricebookItem;
  colour_name?: string;
  colour_code?: string;
  colour_brand?: string;
  notes?: string;
  position: number;
}

interface TemplateCategory {
  key: string;
  name: string;
  position: number;
  items: { key: string; name: string }[];
}

interface ColourSelectionTemplate {
  id: number;
  name: string;
  job_type_id?: number;
  job_type_name?: string;
  categories: TemplateCategory[];
  is_default: boolean;
}

interface Job {
  id: number;
  name: string;
  job_type?: { id: number; name: string };
  job_type_id?: number;
}

// Colour Swatch Component
function ColourSwatch({ colour, code }: { colour?: string; code?: string }) {
  if (!code && !colour) return null;

  const bgColour = code?.startsWith("#") ? code : "#e5e5e5";

  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded border shadow-sm"
        style={{ backgroundColor: bgColour }}
        title={colour || code}
      />
      {colour && <span className="text-sm">{colour}</span>}
    </div>
  );
}

// Category Component
function ColourCategory({
  category,
  selections,
  pricebookItems,
  onUpdate,
  isExpanded,
  onToggle,
}: {
  category: TemplateCategory;
  selections: Record<string, JobColourSelection>;
  pricebookItems: PricebookItem[];
  onUpdate: (itemKey: string, updates: Partial<JobColourSelection>) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Filter pricebook items that have colours
  const colourItems = pricebookItems
    .filter((item) => item.colour)
    .map((item) => ({
      id: item.id.toString(),
      label: `${item.item_name} - ${item.colour}${item.colour_brand ? ` (${item.colour_brand})` : ""}`,
    }));

  return (
    <Card className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
          <h3 className="font-semibold text-lg">{category.name}</h3>
          <Badge variant="secondary" className="text-xs">
            {category.items.length} items
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {Object.keys(selections).filter((k) => k.startsWith(`${category.key}:`)).length} selected
        </div>
      </button>

      {isExpanded && (
        <CardContent className="pt-0 pb-4">
          <div className="space-y-4">
            {category.items.map((item) => {
              const selKey = `${category.key}:${item.key}`;
              const sel = selections[selKey] || {
                category_key: category.key,
                item_key: item.key,
                position: 0,
              };

              return (
                <div
                  key={item.key}
                  className="grid grid-cols-12 gap-4 items-start py-3 border-b last:border-0"
                >
                  <div className="col-span-3">
                    <Label className="text-sm font-medium">{item.name}</Label>
                  </div>
                  <div className="col-span-4">
                    <ComboboxDropdown
                      items={colourItems}
                      selectedItem={sel.pricebook_item_id ? colourItems.find(c => c.id === sel.pricebook_item_id?.toString()) : undefined}
                      onSelect={(item) => {
                        const pricebookItem = pricebookItems.find(
                          (p) => p.id.toString() === item.id
                        );
                        onUpdate(selKey, {
                          pricebook_item_id: parseInt(item.id),
                          colour_name: pricebookItem?.colour,
                          colour_code: pricebookItem?.colour_code,
                          colour_brand: pricebookItem?.colour_brand,
                        });
                      }}
                      placeholder="Select from pricebook..."
                      emptyResults="No matching colours"
                      searchPlaceholder="Search colours..."
                      clearable
                      onClear={() => {
                        onUpdate(selKey, {
                          pricebook_item_id: undefined,
                        });
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    {!sel.pricebook_item_id && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Colour name"
                          value={sel.colour_name || ""}
                          onChange={(e) =>
                            onUpdate(selKey, { colour_name: e.target.value })
                          }
                        />
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={sel.colour_code || "#ffffff"}
                            onChange={(e) =>
                              onUpdate(selKey, { colour_code: e.target.value })
                            }
                            className="w-12 h-8 p-1 cursor-pointer"
                          />
                          <Input
                            placeholder="Brand"
                            value={sel.colour_brand || ""}
                            onChange={(e) =>
                              onUpdate(selKey, { colour_brand: e.target.value })
                            }
                            className="flex-1"
                          />
                        </div>
                      </div>
                    )}
                    {sel.pricebook_item_id && (
                      <ColourSwatch colour={sel.colour_name} code={sel.colour_code} />
                    )}
                  </div>
                  <div className="col-span-3">
                    <Textarea
                      placeholder="Notes..."
                      value={sel.notes || ""}
                      onChange={(e) => onUpdate(selKey, { notes: e.target.value })}
                      className="min-h-[38px] resize-none"
                      rows={1}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Main Page Component
export default function ColourSelectionBuilderPage() {
  const params = useParams();
  const { toast } = useToast();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [template, setTemplate] = useState<ColourSelectionTemplate | null>(null);
  const [selections, setSelections] = useState<Record<string, JobColourSelection>>({});
  const [pricebookItems, setPricebookItems] = useState<PricebookItem[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Load job data
  useEffect(() => {
    const loadJob = async () => {
      try {
        const response = await api.get<Job>(`/api/v1/jobs/${jobId}`);
        setJob(response);
      } catch (error) {
        console.error("Failed to load job:", error);
        toast({ title: "Failed to load job", variant: "destructive" });
      }
    };
    loadJob();
  }, [jobId, toast]);

  // Load template based on job type
  useEffect(() => {
    if (!job?.job_type_id) return;

    const loadTemplate = async () => {
      try {
        const response = await api.get<{ success: boolean; data: ColourSelectionTemplate }>(
          `/api/v1/colour_selection_templates/for_job_type/${job.job_type_id}`
        );
        if (response?.success && response.data) {
          setTemplate(response.data);
          // Expand ALL categories by default
          if (response.data.categories?.length > 0) {
            setExpandedCategories(new Set(response.data.categories.map(c => c.key)));
          }
        }
      } catch (error) {
        console.error("Failed to load template:", error);
        // Try loading default template
        try {
          const defaultResponse = await api.get<{ success: boolean; data: ColourSelectionTemplate[] }>(
            "/api/v1/colour_selection_templates?active_only=true"
          );
          if (defaultResponse?.success && defaultResponse.data?.length > 0) {
            const defaultTemplate =
              defaultResponse.data.find((t) => t.is_default) || defaultResponse.data[0];
            setTemplate(defaultTemplate);
            // Expand ALL categories by default
            if (defaultTemplate.categories?.length > 0) {
              setExpandedCategories(new Set(defaultTemplate.categories.map(c => c.key)));
            }
          }
        } catch {
          console.error("Failed to load default template");
        }
      }
    };
    loadTemplate();
  }, [job?.job_type_id]);

  // Load existing colour selections
  useEffect(() => {
    const loadSelections = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data: { colour_selections: Record<string, JobColourSelection[]>; flat_list: JobColourSelection[] };
        }>(`/api/v1/jobs/${jobId}/colour_selections`);

        if (response?.success && response.data?.flat_list) {
          const selectionsMap: Record<string, JobColourSelection> = {};
          response.data.flat_list.forEach((sel) => {
            selectionsMap[`${sel.category_key}:${sel.item_key}`] = sel;
          });
          setSelections(selectionsMap);
        }
      } catch (error) {
        console.error("Failed to load colour selections:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSelections();
  }, [jobId]);

  // Load pricebook items with colours
  useEffect(() => {
    const loadPricebook = async () => {
      try {
        const response = await api.get<{ items: PricebookItem[] }>(
          "/api/v1/pricebook?per_page=1000"
        );
        if (response?.items) {
          setPricebookItems(response.items);
        }
      } catch (error) {
        console.error("Failed to load pricebook:", error);
      }
    };
    loadPricebook();
  }, []);

  // Handle selection updates
  const handleUpdate = useCallback((selKey: string, updates: Partial<JobColourSelection>) => {
    setSelections((prev) => {
      const [categoryKey, itemKey] = selKey.split(":");
      const existing = prev[selKey] || { category_key: categoryKey, item_key: itemKey, position: 0 };
      return {
        ...prev,
        [selKey]: { ...existing, ...updates },
      };
    });
    setIsDirty(true);
  }, []);

  // Toggle category expansion
  const toggleCategory = useCallback((categoryKey: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }
      return next;
    });
  }, []);

  // Save colour selections
  const handleSave = async () => {
    setSaving(true);
    try {
      const selectionsToSave = Object.values(selections).filter(
        (sel) => sel.pricebook_item_id || sel.colour_name || sel.notes
      );

      await api.post(`/api/v1/jobs/${jobId}/colour_selections/bulk_update`, {
        colour_selections: selectionsToSave,
      });

      toast({ title: "Colour selections saved" });
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to save colour selections:", error);
      toast({ title: "Failed to save colour selections", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Initialize from template
  const handleInitializeFromTemplate = async () => {
    if (!confirm("This will initialize colour selections from the template. Continue?")) return;

    try {
      const response = await api.post<{
        success: boolean;
        data: { selections_created: number };
      }>(`/api/v1/jobs/${jobId}/colour_selections/initialize_from_template`);

      if (response?.success) {
        toast({
          title: "Template applied",
          description: `${response.data.selections_created} colour selections created`,
        });
        // Reload selections
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to initialize from template:", error);
      toast({ title: "Failed to apply template", variant: "destructive" });
    }
  };

  // Export PDF
  const handleExportPdf = () => {
    // Open PDF in new tab
    const baseUrl = getApiBaseUrl();
    window.open(`${baseUrl}/api/v1/jobs/${jobId}/colour_selections/generate_pdf?download=true`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton fallbackHref="/jobs" />
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Colour Selection Builder
              </h1>
              <p className="text-sm text-muted-foreground">
                {job?.name || "Loading..."}
                {template && <span className="ml-2">({template.name})</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleInitializeFromTemplate}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Apply Template
            </Button>
            <Button variant="outline" onClick={handleExportPdf}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button onClick={handleSave} disabled={saving || !isDirty}>
              {saving ? (
                <Spinner size={16} className="mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-5xl mx-auto">
          {!template ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Palette className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No Template Found</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  No colour selection template found for this job type.
                  Please create a template in the admin settings first.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {template.categories?.map((category) => (
                <ColourCategory
                  key={category.key}
                  category={category}
                  selections={selections}
                  pricebookItems={pricebookItems}
                  onUpdate={handleUpdate}
                  isExpanded={expandedCategories.has(category.key)}
                  onToggle={() => toggleCategory(category.key)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
