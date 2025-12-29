"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save,
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
}

interface JobSpecification {
  id?: number;
  section_key: string;
  item_key: string;
  pricebook_item_id?: number;
  pricebook_item?: PricebookItem;
  custom_value?: string;
  notes?: string;
  position: number;
}

interface TemplateSection {
  key: string;
  name: string;
  position: number;
  items: { key: string; name: string; type?: string }[];
}

interface SpecificationTemplate {
  id: number;
  name: string;
  job_type_id?: number;
  job_type_name?: string;
  sections: TemplateSection[];
  is_default: boolean;
}

// Section Component
function SpecificationSection({
  section,
  specifications,
  pricebookItems,
  onUpdate,
  isExpanded,
  onToggle,
}: {
  section: TemplateSection;
  specifications: Record<string, JobSpecification>;
  pricebookItems: PricebookItem[];
  onUpdate: (itemKey: string, updates: Partial<JobSpecification>) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const pricebookItems2 = pricebookItems.map((item) => ({
    id: item.id.toString(),
    label: `${item.item_code} - ${item.item_name}${item.colour ? ` (${item.colour})` : ""}`,
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
          <h3 className="font-semibold text-lg">{section.name}</h3>
          <Badge variant="secondary" className="text-xs">
            {section.items.length} items
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {Object.keys(specifications).filter((k) => k.startsWith(`${section.key}:`)).length} specified
        </div>
      </button>

      {isExpanded && (
        <CardContent className="pt-0 pb-4">
          <div className="space-y-4">
            {section.items.map((item) => {
              const specKey = `${section.key}:${item.key}`;
              const spec = specifications[specKey] || {
                section_key: section.key,
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
                  <div className="col-span-5">
                    <ComboboxDropdown
                      items={pricebookItems2}
                      selectedItem={spec.pricebook_item_id ? pricebookItems2.find(p => p.id === spec.pricebook_item_id?.toString()) : undefined}
                      onSelect={(item) =>
                        onUpdate(specKey, {
                          pricebook_item_id: parseInt(item.id),
                        })
                      }
                      placeholder="Select from pricebook..."
                      emptyResults="No matching items"
                      searchPlaceholder="Search pricebook..."
                      clearable
                      onClear={() =>
                        onUpdate(specKey, {
                          pricebook_item_id: undefined,
                        })
                      }
                    />
                    {!spec.pricebook_item_id && (
                      <Input
                        className="mt-2"
                        placeholder="Or enter custom value..."
                        value={spec.custom_value || ""}
                        onChange={(e) =>
                          onUpdate(specKey, { custom_value: e.target.value })
                        }
                      />
                    )}
                  </div>
                  <div className="col-span-4">
                    <Textarea
                      placeholder="Notes..."
                      value={spec.notes || ""}
                      onChange={(e) => onUpdate(specKey, { notes: e.target.value })}
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

// Props for the embeddable component
interface SpecificationBuilderProps {
  jobId: number | string;
  jobTypeId?: number;
}

// Main Embeddable Component
export function SpecificationBuilder({ jobId, jobTypeId }: SpecificationBuilderProps) {
  const { toast } = useToast();

  const [template, setTemplate] = useState<SpecificationTemplate | null>(null);
  const [specifications, setSpecifications] = useState<Record<string, JobSpecification>>({});
  const [pricebookItems, setPricebookItems] = useState<PricebookItem[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Load template based on job type
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        // Try loading by job type first
        if (jobTypeId) {
          const response = await api.get<{ success: boolean; data: SpecificationTemplate }>(
            `/api/v1/specification_templates/for_job_type/${jobTypeId}`
          );
          if (response?.success && response.data) {
            setTemplate(response.data);
            // Expand ALL sections by default
            if (response.data.sections?.length > 0) {
              setExpandedSections(new Set(response.data.sections.map(s => s.key)));
            }
            return;
          }
        }

        // Fallback to default template
        const defaultResponse = await api.get<{ success: boolean; data: SpecificationTemplate[] }>(
          "/api/v1/specification_templates?active_only=true"
        );
        if (defaultResponse?.success && defaultResponse.data?.length > 0) {
          const defaultTemplate =
            defaultResponse.data.find((t) => t.is_default) || defaultResponse.data[0];
          setTemplate(defaultTemplate);
          // Expand ALL sections by default
          if (defaultTemplate.sections?.length > 0) {
            setExpandedSections(new Set(defaultTemplate.sections.map(s => s.key)));
          }
        }
      } catch (error) {
        console.error("Failed to load template:", error);
      }
    };
    loadTemplate();
  }, [jobTypeId]);

  // Load existing specifications
  useEffect(() => {
    const loadSpecifications = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data: { specifications: Record<string, JobSpecification[]>; flat_list: JobSpecification[] };
        }>(`/api/v1/jobs/${jobId}/specifications`);

        if (response?.success && response.data?.flat_list) {
          const specsMap: Record<string, JobSpecification> = {};
          response.data.flat_list.forEach((spec) => {
            specsMap[`${spec.section_key}:${spec.item_key}`] = spec;
          });
          setSpecifications(specsMap);
        }
      } catch (error) {
        console.error("Failed to load specifications:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSpecifications();
  }, [jobId]);

  // Load pricebook items
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

  // Handle spec updates
  const handleUpdate = useCallback((specKey: string, updates: Partial<JobSpecification>) => {
    setSpecifications((prev) => {
      const [sectionKey, itemKey] = specKey.split(":");
      const existing = prev[specKey] || { section_key: sectionKey, item_key: itemKey, position: 0 };
      return {
        ...prev,
        [specKey]: { ...existing, ...updates },
      };
    });
    setIsDirty(true);
  }, []);

  // Toggle section expansion
  const toggleSection = useCallback((sectionKey: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  }, []);

  // Save specifications
  const handleSave = async () => {
    setSaving(true);
    try {
      const specsToSave = Object.values(specifications).filter(
        (spec) => spec.pricebook_item_id || spec.custom_value || spec.notes
      );

      await api.post(`/api/v1/jobs/${jobId}/specifications/bulk_update`, {
        specifications: specsToSave,
      });

      toast({ title: "Specifications saved" });
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to save specifications:", error);
      toast({ title: "Failed to save specifications", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Initialize from template
  const handleInitializeFromTemplate = async () => {
    if (!confirm("This will initialize specifications from the template. Continue?")) return;

    try {
      const response = await api.post<{
        success: boolean;
        data: { specifications_created: number };
      }>(`/api/v1/jobs/${jobId}/specifications/initialize_from_template`);

      if (response?.success) {
        toast({
          title: "Template applied",
          description: `${response.data.specifications_created} specifications created`,
        });
        // Reload specifications
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to initialize from template:", error);
      toast({ title: "Failed to apply template", variant: "destructive" });
    }
  };

  // Export PDF
  const handleExportPdf = () => {
    const baseUrl = getApiBaseUrl();
    window.open(`${baseUrl}/api/v1/jobs/${jobId}/specifications/generate_pdf?download=true`, "_blank");
  };

  // Custom specifications state
  const [customSpecs, setCustomSpecs] = useState<Array<{
    id?: number;
    name: string;
    value: string;
    notes: string;
  }>>([]);

  // Load custom specifications
  useEffect(() => {
    const loadCustomSpecs = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data: Array<{ id: number; name: string; value: string; notes: string }>;
        }>(`/api/v1/jobs/${jobId}/custom_specifications`);
        if (response?.success && response.data) {
          setCustomSpecs(response.data);
        }
      } catch {
        // Custom specs endpoint might not exist yet - that's ok
      }
    };
    loadCustomSpecs();
  }, [jobId]);

  // Add custom spec
  const addCustomSpec = () => {
    setCustomSpecs(prev => [...prev, { name: "", value: "", notes: "" }]);
    setIsDirty(true);
  };

  // Update custom spec
  const updateCustomSpec = (index: number, field: string, value: string) => {
    setCustomSpecs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setIsDirty(true);
  };

  // Remove custom spec
  const removeCustomSpec = (index: number) => {
    setCustomSpecs(prev => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  // Save custom specifications
  const handleSaveCustom = async () => {
    setSaving(true);
    try {
      await api.post(`/api/v1/jobs/${jobId}/custom_specifications/bulk_update`, {
        custom_specifications: customSpecs.filter(s => s.name || s.value),
      });
      toast({ title: "Custom specifications saved" });
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to save custom specifications:", error);
      toast({ title: "Failed to save custom specifications", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="standard" className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="standard">Standard Template</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Standard Template Tab */}
      <TabsContent value="standard" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {template?.name || "Standard Template"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleInitializeFromTemplate}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Apply Template
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !isDirty}>
              {saving ? (
                <Spinner size={16} className="mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>

        {!template ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No Template Found</h3>
              <p className="text-sm text-muted-foreground mt-2">
                No specification template found for this job type.
                Please create a template in the admin settings first.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {template.sections?.map((section) => (
              <SpecificationSection
                key={section.key}
                section={section}
                specifications={specifications}
                pricebookItems={pricebookItems}
                onUpdate={handleUpdate}
                isExpanded={expandedSections.has(section.key)}
                onToggle={() => toggleSection(section.key)}
              />
            ))}
          </div>
        )}
      </TabsContent>

      {/* Custom Tab */}
      <TabsContent value="custom" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Custom Specifications
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={addCustomSpec}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
            <Button size="sm" onClick={handleSaveCustom} disabled={saving || !isDirty}>
              {saving ? (
                <Spinner size={16} className="mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>

        {customSpecs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No Custom Specifications</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Click "Add Item" to create custom specification entries.
              </p>
              <Button variant="outline" className="mt-4" onClick={addCustomSpec}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Item
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {customSpecs.map((spec, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-4 items-start py-3 border-b last:border-0"
                  >
                    <div className="col-span-3">
                      <Input
                        placeholder="Item name..."
                        value={spec.name}
                        onChange={(e) => updateCustomSpec(index, "name", e.target.value)}
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        placeholder="Value / Selection..."
                        value={spec.value}
                        onChange={(e) => updateCustomSpec(index, "value", e.target.value)}
                      />
                    </div>
                    <div className="col-span-4">
                      <Textarea
                        placeholder="Notes..."
                        value={spec.notes}
                        onChange={(e) => updateCustomSpec(index, "notes", e.target.value)}
                        className="min-h-[38px] resize-none"
                        rows={1}
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCustomSpec(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
