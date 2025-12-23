"use client";

/**
 * Canvas Gantt Chart Page
 *
 * High-performance canvas-based Gantt chart view for Schedule Templates.
 * Part of the 3-Year Schedule Master Masterpiece Plan.
 */

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { GanttCanvasView } from "@/components/gantt-canvas";
import { GanttTask } from "@/lib/gantt/types";
import { useToast } from "@/components/ui/use-toast";

export default function ScheduleTemplateGanttPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const templateId = parseInt(params.id as string, 10);

  const handleTaskClick = React.useCallback(
    (task: GanttTask) => {
      toast({
        title: "Task Selected",
        description: `${task.name} (${task.startDate.toLocaleDateString()} - ${task.endDate.toLocaleDateString()})`,
      });
    },
    [toast]
  );

  const handleTaskDoubleClick = React.useCallback(
    (task: GanttTask) => {
      toast({
        title: "Edit Task",
        description: `Opening editor for: ${task.name}`,
      });
      // TODO: Open task editor modal
    },
    [toast]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/schedule-templates/${templateId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Canvas Gantt Chart</h1>
            <p className="text-sm text-muted-foreground">
              Template #{templateId} - High-performance canvas rendering
            </p>
          </div>
        </div>
      </div>

      {/* Gantt Canvas */}
      <div className="flex-1 min-h-0">
        <GanttCanvasView
          templateId={templateId}
          onTaskClick={handleTaskClick}
          onTaskDoubleClick={handleTaskDoubleClick}
          className="h-full"
        />
      </div>
    </div>
  );
}
