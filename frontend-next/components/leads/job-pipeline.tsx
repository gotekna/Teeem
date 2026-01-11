"use client";

/**
 * JobPipeline - Sales pipeline Kanban board
 *
 * Uses KanbanBoard from @/components/ui/kanban for consistency.
 * See: frontend-next/lib/component-registry.ts
 */

import { useState, useMemo } from "react";
import { PipelineJob, PipelineStage, PIPELINE_STAGE_CONFIG } from "@/types/leads";
import { JobPipelineCard } from "./job-pipeline-card";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Standard Kanban components
import { KanbanBoard, KanbanCard } from "@/components/ui/kanban";
import type { KanbanColumnDef, CardMoveEvent } from "@/components/ui/kanban";

interface JobPipelineProps {
  jobsByStage: Record<string, PipelineJob[]>;
  onJobClick: (job: PipelineJob) => void;
  onStageChange: (jobId: number, newStage: PipelineStage) => void;
  onMarkAsLost?: (jobId: number) => Promise<void>;
  onJobsChange?: () => void;
}

// Extend PipelineJob with columnId for Kanban (PipelineJob.id satisfies KanbanItem.id)
interface PipelineJobItem extends PipelineJob {
  columnId: string;
}

const PIPELINE_COLUMNS: PipelineStage[] = [
  "needs_pricing",
  "needs_drafting",
  "priced_up",
  "contacted",
  "qualified",
  "contract_sent",
  "lost",
];

// Map stage to KanbanBoard color (closest matches)
const STAGE_TO_KANBAN_COLOR: Record<PipelineStage, "default" | "gray" | "blue" | "green" | "orange" | "red" | "purple"> = {
  needs_pricing: "orange",      // yellow → closest is orange
  needs_drafting: "purple",     // pink → closest is purple
  priced_up: "gray",
  contacted: "blue",
  qualified: "purple",
  contract_sent: "orange",
  won: "green",
  lost: "red",
};

// Custom header background colors for exact brand colors
const STAGE_HEADER_CLASSES: Record<PipelineStage, string> = {
  needs_pricing: "bg-yellow-100 dark:bg-yellow-900/30",
  needs_drafting: "bg-pink-100 dark:bg-pink-900/30",
  priced_up: "bg-muted dark:bg-card/50",
  contacted: "bg-blue-100 dark:bg-blue-900/30",
  qualified: "bg-purple-100 dark:bg-purple-900/30",
  contract_sent: "bg-orange-100 dark:bg-orange-900/30",
  won: "bg-green-100 dark:bg-green-900/30",
  lost: "bg-red-100 dark:bg-red-900/30",
};

// Border colors for exact brand colors
const STAGE_BORDER_COLORS: Record<PipelineStage, string> = {
  needs_pricing: "#eab308",
  needs_drafting: "#ec4899",
  priced_up: "#6b7280",
  contacted: "#3b82f6",
  qualified: "#a855f7",
  contract_sent: "#f97316",
  won: "#22c55e",
  lost: "#ef4444",
};

export function JobPipeline({
  jobsByStage,
  onJobClick,
  onStageChange,
  onMarkAsLost,
}: JobPipelineProps) {
  const [lostConfirmJob, setLostConfirmJob] = useState<PipelineJob | null>(null);

  // Convert jobsByStage to flat array with columnId
  const items = useMemo((): PipelineJobItem[] => {
    const allJobs: PipelineJobItem[] = [];
    Object.entries(jobsByStage).forEach(([stage, jobs]) => {
      jobs.forEach((job) => {
        allJobs.push({
          ...job,
          columnId: stage,
        });
      });
    });
    return allJobs;
  }, [jobsByStage]);

  // Column definitions
  const columns = useMemo((): KanbanColumnDef<PipelineJobItem>[] => {
    return PIPELINE_COLUMNS.map((stage) => ({
      id: stage,
      title: PIPELINE_STAGE_CONFIG[stage]?.label || stage,
      color: STAGE_TO_KANBAN_COLOR[stage],
    }));
  }, []);

  // Get column for an item
  const getItemColumn = (item: PipelineJobItem): string => {
    // Normalize job_stage to snake_case for matching
    const normalizedStage = item.job_stage?.toLowerCase().replace(/ /g, '_') || 'needs_pricing';
    return normalizedStage;
  };

  // Calculate total value for a stage
  const getTotalValue = (stage: PipelineStage): number => {
    const jobs = jobsByStage[stage] || [];
    return jobs.reduce((sum, job) => sum + (Number(job.contract_value) || 0), 0);
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  // Handle card move between columns
  const handleCardMove = (event: CardMoveEvent<PipelineJobItem>) => {
    const newStage = event.toColumnId as PipelineStage;

    // If dropping to "lost", show confirmation dialog
    if (newStage === "lost") {
      setLostConfirmJob(event.item);
    } else {
      onStageChange(event.item.id, newStage);
    }
  };

  const handleConfirmLost = async () => {
    if (lostConfirmJob && onMarkAsLost) {
      await onMarkAsLost(lostConfirmJob.id);
    }
    setLostConfirmJob(null);
  };

  const handleCancelLost = () => {
    setLostConfirmJob(null);
  };

  // Custom column header renderer
  const renderColumnHeader = (column: KanbanColumnDef<PipelineJobItem>, itemCount: number) => {
    const stage = column.id as PipelineStage;
    const stageConfig = PIPELINE_STAGE_CONFIG[stage];
    const totalValue = getTotalValue(stage);

    return (
      <div
        className={cn(
          "rounded-t-lg px-2 py-2 -m-3 mb-0 border-b-2",
          STAGE_HEADER_CLASSES[stage]
        )}
        style={{
          borderBottomColor: STAGE_BORDER_COLORS[stage],
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("font-medium text-sm", stageConfig?.color)}>
              {stageConfig?.label || column.title}
            </span>
            <span className="text-xs bg-background px-1.5 py-0.5 rounded-full font-mono">
              {itemCount}
            </span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {formatCurrency(totalValue)}
          </span>
        </div>
      </div>
    );
  };

  // Render card
  const renderCard = (item: PipelineJobItem, isDragging: boolean) => (
    <KanbanCard id={item.id} isDragging={isDragging}>
      <JobPipelineCard
        job={item}
        onClick={() => onJobClick(item)}
        isDragging={isDragging}
      />
    </KanbanCard>
  );

  // Empty column renderer
  const renderEmptyColumn = () => (
    <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
      No jobs
    </div>
  );

  return (
    <>
      <AlertDialog open={!!lostConfirmJob} onOpenChange={(open) => !open && setLostConfirmJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Lost?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark &quot;{lostConfirmJob?.title}&quot; as lost?
              This will change the status to &quot;Lost - Pre Contract&quot; and remove it from the pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelLost}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLost} className="bg-red-600 hover:bg-red-700">
              Yes, Mark as Lost
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <KanbanBoard
        columns={columns}
        items={items}
        getItemColumn={getItemColumn}
        renderCard={renderCard}
        renderColumnHeader={renderColumnHeader}
        renderEmptyColumn={renderEmptyColumn}
        onCardMove={handleCardMove}
        columnGap="sm"
        minColumnWidth={200}
        columnsCollapsible={false}
        className="min-h-[600px] pb-4"
      />
    </>
  );
}
