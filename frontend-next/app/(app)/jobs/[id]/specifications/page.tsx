"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  Download,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";

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

interface Job {
  id: number;
  name: string;
  job_type?: { id: number; name: string };
  job_type_id?: number;
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
  const pricebookOptions = pricebookItems.map((item) => ({
    value: item.id.toString(),
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
                      options={pricebookOptions}
                      value={spec.pricebook_item_id?.toString() || ""}
                      onChange={(value) =>
                        onUpdate(specKey, {
                          pricebook_item_id: value ? parseInt(value) : undefined,
                        })
                      }
                      placeholder="Select from pricebook..."
                      emptyMessage="No matching items"
                      searchPlaceholder="Search pricebook..."
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

// Main Page Component
export default function SpecificationBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [template, setTemplate] = useState<SpecificationTemplate | null>(null);
  const [specifications, setSpecifications] = useState<Record<string, JobSpecification>>({});
  const [pricebookItems, setPricebookItems] = useState<PricebookItem[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
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
        const response = await api.get<{ success: boolean; data: SpecificationTemplate }>(
          `/api/v1/specification_templates/for_job_type/${job.job_type_id}`
        );
        if (response?.success && response.data) {
          setTemplate(response.data);
          // Expand first section by default
          if (response.data.sections?.length > 0) {
            setExpandedSections(new Set([response.data.sections[0].key]));
          }
        }
      } catch (error) {
        console.error("Failed to load template:", error);
        // Try loading default template
        try {
          const defaultResponse = await api.get<{ success: boolean; data: SpecificationTemplate[] }>(
            "/api/v1/specification_templates?active_only=true"
          );
          if (defaultResponse?.success && defaultResponse.data?.length > 0) {
            const defaultTemplate = defaultResponse.data.find((t) => t.is_default) || defaultResponse.data[0];
            setTemplate(defaultTemplate);
            if (defaultTemplate.sections?.length > 0) {
              setExpandedSections(new Set([defaultTemplate.sections[0].key]));
            }
          }
        } catch {
          console.error("Failed to load default template");
        }
      }
    };
    loadTemplate();
  }, [job?.job_type_id]);

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
        const response = await api.get<{ pricebook_items: PricebookItem[] }>(
          "/api/v1/pricebook_items?per_page=1000"
        );
        if (response?.pricebook_items) {
          setPricebookItems(response.pricebook_items);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Specification Builder
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
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button onClick={handleSave} disabled={saving || !isDirty}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
        </div>
      </div>
    </div>
  );
}
