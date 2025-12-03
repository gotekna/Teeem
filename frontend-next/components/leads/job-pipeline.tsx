"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PipelineJob, PipelineStage, PIPELINE_STAGE_CONFIG } from "@/types/leads";
import { JobPipelineCard } from "./job-pipeline-card";
import { EmailProposalCard } from "./email-proposal-card";
import { cn } from "@/lib/utils";
import { EmailProposal } from "@/app/(app)/leads/page";

interface JobPipelineProps {
  jobsByStage: Record<string, PipelineJob[]>;
  emailProposals?: EmailProposal[];
  onJobClick: (job: PipelineJob) => void;
  onStageChange: (jobId: number, newStage: PipelineStage) => void;
  onProposalsChange?: () => void;
  onJobsChange?: () => void;
}

const PIPELINE_COLUMNS: PipelineStage[] = [
  "proposal",
  "priced_up",
  "contacted",
  "qualified",
  "contract_sent",
  "lost",
];

export function JobPipeline({
  jobsByStage,
  emailProposals = [],
  onJobClick,
  onStageChange,
  onProposalsChange,
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
    return jobs.reduce((sum, job) => sum + (job.contract_value || 0), 0);
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
      const currentStage = draggedJob.job_stage?.toLowerCase().replace(' ', '_') || 'proposal';
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

  // Handler for when a proposal is approved and navigates to job
  const handleProposalApproved = (jobId: number) => {
    onProposalsChange?.();
    onJobsChange?.();
    router.push(`/jobs/${jobId}`);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[600px]">
      {PIPELINE_COLUMNS.map((stage) => {
        const stageConfig = PIPELINE_STAGE_CONFIG[stage];
        const columnJobs = getJobsByStage(stage);
        const totalValue = getTotalValue(stage);
        const isDropTarget = dragOverColumn === stage;
        // Show email proposals in the "proposal" column
        const showEmailProposals = stage === "proposal";
        const proposalCount = showEmailProposals ? emailProposals.length : 0;
        const totalCount = columnJobs.length + proposalCount;

        return (
          <div
            key={stage}
            className="flex-1 min-w-[220px] max-w-[320px]"
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
                borderBottomColor:
                  stage === "won"
                    ? "#22c55e"
                    : stage === "lost"
                    ? "#ef4444"
                    : stage === "priced_up"
                    ? "#6b7280"
                    : stage === "contacted"
                    ? "#3b82f6"
                    : stage === "qualified"
                    ? "#a855f7"
                    : stage === "proposal"
                    ? "#eab308"
                    : "#f97316",
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
              {/* Email Proposals (only in proposal column) */}
              {showEmailProposals && emailProposals.map((proposal) => (
                <EmailProposalCard
                  key={`proposal-${proposal.id}`}
                  proposal={proposal}
                  onApproved={handleProposalApproved}
                  onRejected={onProposalsChange}
                />
              ))}

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
