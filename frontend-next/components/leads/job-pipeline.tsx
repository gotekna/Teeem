"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PipelineJob, PipelineStage, PIPELINE_STAGE_CONFIG } from "@/types/leads";
import { JobPipelineCard } from "./job-pipeline-card";
import { cn } from "@/lib/utils";

interface JobPipelineProps {
  jobsByStage: Record<string, PipelineJob[]>;
  onJobClick: (job: PipelineJob) => void;
  onStageChange: (jobId: number, newStage: PipelineStage) => void;
  onJobsChange?: () => void;
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

// Map stage to border color
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
  onJobsChange,
}: JobPipelineProps) {
  const router = useRouter();
  const [draggedJob, setDraggedJob] = useState<PipelineJob | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<PipelineStage | null>(null);

  const getJobsByStage = (stage: PipelineStage): PipelineJob[] => {
    return jobsByStage[stage] || [];
  };

  const getTotalValue = (stage: PipelineStage): number => {
    const jobs = getJobsByStage(stage);
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

  const handleDragStart = (e: React.DragEvent, job: PipelineJob) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(stage);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStage: PipelineStage) => {
    e.preventDefault();
    if (draggedJob) {
      // Get current stage from job_stage field (normalize to snake_case)
      const currentStage = draggedJob.job_stage?.toLowerCase().replace(/ /g, '_') || 'needs_pricing';
      if (currentStage !== newStage) {
        onStageChange(draggedJob.id, newStage);
      }
    }
    setDraggedJob(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
    setDragOverColumn(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[600px]">
      {PIPELINE_COLUMNS.map((stage) => {
        const stageConfig = PIPELINE_STAGE_CONFIG[stage];
        const columnJobs = getJobsByStage(stage);
        const totalValue = getTotalValue(stage);
        const isDropTarget = dragOverColumn === stage;
        const totalCount = columnJobs.length;

        return (
          <div
            key={stage}
            className="flex-1 min-w-[200px] max-w-[280px]"
            onDragOver={(e) => handleDragOver(e, stage)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage)}
          >
            {/* Column Header */}
            <div
              className={cn(
                "rounded-t-lg px-2 py-2 border-b-2",
                stageConfig.bgColor
              )}
              style={{
                borderBottomColor: STAGE_BORDER_COLORS[stage],
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium text-sm", stageConfig.color)}>
                    {stageConfig.label}
                  </span>
                  <span className="text-xs bg-background px-1.5 py-0.5 rounded-full font-mono">
                    {totalCount}
                  </span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {formatCurrency(totalValue)}
                </span>
              </div>
            </div>

            {/* Column Content */}
            <div
              className={cn(
                "min-h-[500px] bg-muted/30 rounded-b-lg p-2 space-y-2 transition-colors",
                isDropTarget && "bg-primary/10 ring-2 ring-primary ring-inset"
              )}
            >
              {/* Jobs */}
              {columnJobs.map((job) => (
                <div
                  key={job.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, job)}
                  onDragEnd={handleDragEnd}
                >
                  <JobPipelineCard
                    job={job}
                    onClick={() => onJobClick(job)}
                    isDragging={draggedJob?.id === job.id}
                  />
                </div>
              ))}

              {totalCount === 0 && (
                <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                  No jobs
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
