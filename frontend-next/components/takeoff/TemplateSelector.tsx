"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutTemplate,
  Plus,
  ChevronRight,
  DoorOpen,
  AppWindowMac,
  SquareDashed,
  Plug,
  Droplets,
  Ruler,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

// =============================================================================
// Types
// =============================================================================

export interface TemplateStep {
  type: "count" | "area" | "linear" | "perimeter";
  label: string;
  color: string;
  prompt?: string;
  is_optional?: boolean;
  pricebook_item_id?: number;
}

export interface TakeoffTemplate {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  is_system: boolean;
  step_count: number;
  usage_count: number;
  steps?: TemplateStep[];
}

interface TemplateSelectorProps {
  onTemplateSelect: (template: TakeoffTemplate, steps: TemplateStep[]) => void;
  disabled?: boolean;
}

// =============================================================================
// Category Icons
// =============================================================================

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  doors: <DoorOpen className="h-4 w-4" />,
  windows: <AppWindowMac className="h-4 w-4" />,
  rooms: <SquareDashed className="h-4 w-4" />,
  electrical: <Plug className="h-4 w-4" />,
  plumbing: <Droplets className="h-4 w-4" />,
  custom: <Ruler className="h-4 w-4" />,
};

// =============================================================================
// Component
// =============================================================================

export function TemplateSelector({ onTemplateSelect, disabled }: TemplateSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<TakeoffTemplate[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [expandedTemplate, setExpandedTemplate] = React.useState<number | null>(null);
  const { toast } = useToast();

  // Fetch templates when popover opens
  const fetchTemplates = React.useCallback(async () => {
    if (templates.length > 0) return;

    setLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        data: { templates: TakeoffTemplate[]; categories: string[] };
      }>("/api/v1/pdf_takeoff/templates");

      if (response?.success) {
        setTemplates(response.data.templates);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      toast({
        title: "Error",
        description: "Failed to load templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [templates.length, toast]);

  // Fetch full template details (including steps)
  const fetchTemplateDetails = React.useCallback(async (templateId: number) => {
    try {
      const response = await api.get<{
        success: boolean;
        data: TakeoffTemplate;
      }>(`/api/v1/pdf_takeoff/templates/${templateId}`);

      if (response?.success) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch template details:", error);
      return null;
    }
  }, []);

  // Handle template selection
  const handleSelect = async (template: TakeoffTemplate) => {
    // Fetch full details if steps not loaded
    let fullTemplate = template;
    if (!template.steps) {
      const details = await fetchTemplateDetails(template.id);
      if (details) {
        fullTemplate = details;
      } else {
        toast({
          title: "Error",
          description: "Failed to load template details",
          variant: "destructive",
        });
        return;
      }
    }

    // Record usage
    api.post(`/api/v1/pdf_takeoff/templates/${template.id}/record_usage`).catch(() => {});

    onTemplateSelect(fullTemplate, fullTemplate.steps || []);
    setOpen(false);
  };

  // Group templates by category
  const groupedTemplates = React.useMemo(() => {
    const groups: Record<string, TakeoffTemplate[]> = {};
    templates.forEach((t) => {
      const cat = t.category || "custom";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    return groups;
  }, [templates]);

  return (
    <TooltipProvider delayDuration={300}>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) fetchTemplates(); }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                className="gap-2"
              >
                <LayoutTemplate className="h-4 w-4" />
                Templates
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            Use measurement templates for common patterns
          </TooltipContent>
        </Tooltip>

        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-3 border-b">
            <h4 className="font-semibold">Measurement Templates</h4>
            <p className="text-xs text-muted-foreground">
              Pre-configured measurement patterns for common tasks
            </p>
          </div>

          <ScrollArea className="h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No templates available
              </div>
            ) : (
              <div className="p-2">
                {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                  <div key={category} className="mb-4">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                      {CATEGORY_ICONS[category] || <LayoutTemplate className="h-3 w-3" />}
                      {category}
                    </div>
                    {categoryTemplates.map((template) => (
                      <TemplateItem
                        key={template.id}
                        template={template}
                        expanded={expandedTemplate === template.id}
                        onToggle={() => setExpandedTemplate(
                          expandedTemplate === template.id ? null : template.id
                        )}
                        onSelect={() => handleSelect(template)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <Separator />
          <div className="p-2">
            <Button variant="ghost" size="sm" className="w-full gap-2" disabled>
              <Plus className="h-4 w-4" />
              Create Custom Template
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

// =============================================================================
// Template Item
// =============================================================================

interface TemplateItemProps {
  template: TakeoffTemplate;
  expanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

function TemplateItem({ template, expanded, onToggle, onSelect }: TemplateItemProps) {
  return (
    <div className="rounded-md border mb-1 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-left"
      >
        <ChevronRight
          className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{template.name}</div>
          {template.description && (
            <div className="text-xs text-muted-foreground truncate">
              {template.description}
            </div>
          )}
        </div>
        <Badge variant="outline" className="text-xs">
          {template.step_count} step{template.step_count !== 1 ? "s" : ""}
        </Badge>
      </button>

      {expanded && (
        <div className="border-t bg-muted/30 p-2">
          {template.steps ? (
            <>
              <div className="space-y-1 mb-2">
                {template.steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: step.color }}
                    />
                    <span className="font-medium">{idx + 1}.</span>
                    <span className="capitalize">{step.type}</span>
                    <span className="text-muted-foreground">–</span>
                    <span className="truncate">{step.label}</span>
                    {step.is_optional && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        Optional
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              <Button size="sm" onClick={onSelect} className="w-full">
                Use Template
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Template Runner - Walks through template steps
// =============================================================================

export interface TemplateRunnerState {
  template: TakeoffTemplate;
  currentStepIndex: number;
  completedSteps: number[];
  measurements: Array<{
    stepIndex: number;
    measurementId: number;
  }>;
}

interface TemplateRunnerProps {
  state: TemplateRunnerState;
  onStepComplete: (stepIndex: number, measurementId: number) => void;
  onSkipStep: (stepIndex: number) => void;
  onFinish: () => void;
  onCancel: () => void;
}

export function TemplateRunner({
  state,
  onStepComplete,
  onSkipStep,
  onFinish,
  onCancel,
}: TemplateRunnerProps) {
  const steps = state.template.steps || [];
  const currentStep = steps[state.currentStepIndex];
  const isLastStep = state.currentStepIndex === steps.length - 1;
  const allComplete = state.completedSteps.length === steps.length;

  if (!currentStep) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-lg p-4 max-w-md w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-5 w-5 text-primary" />
          <span className="font-semibold">{state.template.name}</span>
        </div>
        <Badge variant="outline">
          Step {state.currentStepIndex + 1} of {steps.length}
        </Badge>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1 mb-3">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className={`flex-1 h-1 rounded-full ${
              state.completedSteps.includes(idx)
                ? "bg-green-500"
                : idx === state.currentStepIndex
                  ? "bg-primary"
                  : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Current step */}
      <div className="bg-muted/50 rounded-md p-3 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: currentStep.color }}
          />
          <span className="font-medium capitalize">{currentStep.type}</span>
          <span className="text-muted-foreground">–</span>
          <span>{currentStep.label}</span>
        </div>
        {currentStep.prompt && (
          <p className="text-sm text-muted-foreground">{currentStep.prompt}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {currentStep.is_optional && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSkipStep(state.currentStepIndex)}
          >
            Skip
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        {allComplete && (
          <Button size="sm" onClick={onFinish}>
            Finish
          </Button>
        )}
      </div>
    </div>
  );
}
