"use client";

/**
 * Gantt Schedule Page
 *
 * Standalone page showing the Canvas-based Gantt chart with
 * "Schedule Master LIVE" template pre-selected.
 */

import * as React from "react";
import { useUrlState } from "@/hooks/useUrlState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GanttCanvasView } from "@/components/gantt-canvas";
import { api } from "@/lib/api";

interface SmScheduleMasterTemplate {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  row_count: number;
}

export default function GanttSchedulePage() {
  // SSoT: URL state for template selection (enables shareable links)
  const [urlState, setUrlState] = useUrlState({
    template: null as string | null,  // null = auto-select default
  });
  const [templates, setTemplates] = React.useState<SmScheduleMasterTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [defaultTemplateId, setDefaultTemplateId] = React.useState<number | null>(null);

  // Derive selected template from URL or default
  const selectedTemplateId = urlState.template ? parseInt(urlState.template) : defaultTemplateId;

  // Load templates and determine default
  React.useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await api.get<{ success: boolean; sm_schedule_master_templates: SmScheduleMasterTemplate[] }>(
          "/api/v1/sm_schedule_master_templates"
        );
        const loadedTemplates = data?.sm_schedule_master_templates || [];
        setTemplates(loadedTemplates);

        // Determine default template (Schedule Master LIVE)
        if (loadedTemplates.length > 0) {
          const scheduleMasterLive = loadedTemplates.find(t =>
            t.name.toLowerCase().includes("schedule master live") ||
            (t.row_count === 165 && t.name.toLowerCase().includes("schedule"))
          );
          if (scheduleMasterLive) {
            setDefaultTemplateId(scheduleMasterLive.id);
          } else {
            // Fallback to first template
            setDefaultTemplateId(loadedTemplates[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to load templates:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <Spinner />
      </div>
    );
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* Header */}
      <div className="px-4 pb-4 flex items-center justify-between border-b shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Gantt Schedule</h1>
          <p className="text-sm text-muted-foreground">
            High-performance canvas-based schedule visualization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedTemplateId ? String(selectedTemplateId) : ""}
            onValueChange={(value) => {
              // Clear URL param if selecting default, otherwise set it
              const newId = parseInt(value);
              setUrlState({ template: newId === defaultTemplateId ? null : value });
            }}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={String(template.id)}>
                  {template.name} ({template.row_count} tasks)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTemplate && (
            <Badge variant="secondary">
              {selectedTemplate.row_count} tasks
            </Badge>
          )}
        </div>
      </div>

      {/* Gantt Canvas */}
      <div className="flex-1 min-h-0">
        {selectedTemplateId ? (
          <GanttCanvasView
            templateId={selectedTemplateId}
            className="h-full"
          />
        ) : (
          <Card className="m-4">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-lg font-medium mb-2">Select a template</p>
              <p className="text-center max-w-md">
                Choose a schedule template from the dropdown above to view it as a Gantt chart.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
