"use client";

import * as React from "react";
import { format, differenceInDays } from "date-fns";
import { Lock, Play, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { GanttFeature, LockType } from "./types";

// Represents a task affected by a cascade
export type CascadeAffectedTask = {
  feature: GanttFeature;
  currentStart: Date;
  currentEnd: Date;
  newStart: Date;
  newEnd: Date;
  isBlocked: boolean;
  blockReason?: string;
};

// Resolution actions for affected tasks
export type CascadeResolution = {
  featureId: string;
  action: "move" | "unlink" | "unlock-move";
};

type CascadePreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceFeature: GanttFeature;
  originalStart: Date;
  newStart: Date;
  affectedTasks: CascadeAffectedTask[];
  onApply: (resolutions: CascadeResolution[]) => void;
  onCancel: () => void;
};

const getLockLabel = (lock: LockType): string => {
  switch (lock) {
    case "supplierConfirmed":
      return "Supplier Confirmed";
    case "started":
      return "Started";
    case "manuallyPositioned":
      return "Manually Positioned";
    default:
      return "Locked";
  }
};

const getLockIcon = (lock: LockType) => {
  if (lock === "started") {
    return <Play className="h-3.5 w-3.5" />;
  }
  return <Lock className="h-3.5 w-3.5" />;
};

export function CascadePreviewModal({
  open,
  onOpenChange,
  sourceFeature,
  originalStart,
  newStart,
  affectedTasks,
  onApply,
  onCancel,
}: CascadePreviewModalProps) {
  // Track resolutions for each task
  const [resolutions, setResolutions] = React.useState<Map<string, CascadeResolution["action"]>>(
    () => {
      const initial = new Map<string, CascadeResolution["action"]>();
      affectedTasks.forEach((task) => {
        // Default: move if not blocked, unlink if blocked
        initial.set(task.feature.id, task.isBlocked ? "unlink" : "move");
      });
      return initial;
    }
  );

  // Reset resolutions when modal opens with new tasks
  React.useEffect(() => {
    const initial = new Map<string, CascadeResolution["action"]>();
    affectedTasks.forEach((task) => {
      initial.set(task.feature.id, task.isBlocked ? "unlink" : "move");
    });
    setResolutions(initial);
  }, [affectedTasks]);

  const daysDiff = differenceInDays(newStart, originalStart);
  const direction = daysDiff > 0 ? "forward" : "back";

  // Split tasks into movable and blocked
  const movableTasks = affectedTasks.filter((t) => !t.isBlocked);
  const blockedTasks = affectedTasks.filter((t) => t.isBlocked);

  const handleResolutionChange = (featureId: string, action: CascadeResolution["action"]) => {
    setResolutions((prev) => new Map(prev).set(featureId, action));
  };

  const handleApply = () => {
    const resolvedActions: CascadeResolution[] = [];
    resolutions.forEach((action, featureId) => {
      resolvedActions.push({ featureId, action });
    });
    onApply(resolvedActions);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  // Count how many will actually move
  const moveCount = Array.from(resolutions.values()).filter(
    (action) => action === "move" || action === "unlock-move"
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-[15px] font-semibold">
            Cascade Preview
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4">
          {/* Summary */}
          <div className="mb-4">
            <p className="text-[13px] text-foreground">
              Moving <span className="font-medium">"{sourceFeature.name}"</span>{" "}
              {direction} {Math.abs(daysDiff)} {Math.abs(daysDiff) === 1 ? "day" : "days"}
            </p>
            <p className="text-[12px] text-muted-foreground mt-1">
              {format(originalStart, "MMM d")} → {format(newStart, "MMM d, yyyy")}
            </p>
            {affectedTasks.length > 0 && (
              <p className="text-[12px] text-muted-foreground mt-0.5">
                This affects {affectedTasks.length} dependent{" "}
                {affectedTasks.length === 1 ? "task" : "tasks"}
              </p>
            )}
          </div>

          {/* Movable tasks */}
          {movableTasks.length > 0 && (
            <div className="mb-4">
              <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Will Move
              </h4>
              <div className="border border-border divide-y divide-border">
                {movableTasks.map((task) => {
                  const resolution = resolutions.get(task.feature.id);
                  const willMove = resolution === "move";

                  return (
                    <div
                      key={task.feature.id}
                      className="flex items-center justify-between py-2 px-3"
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={willMove}
                          onCheckedChange={(checked) =>
                            handleResolutionChange(
                              task.feature.id,
                              checked ? "move" : "unlink"
                            )
                          }
                        />
                        <div>
                          <p className="text-[12px] font-medium">{task.feature.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            → {format(task.newStart, "MMM d")}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => handleResolutionChange(task.feature.id, "unlink")}
                      >
                        Unlink instead
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Blocked tasks */}
          {blockedTasks.length > 0 && (
            <div>
              <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-status-warning" />
                Blocked
              </h4>
              <div className="border border-border divide-y divide-border">
                {blockedTasks.map((task) => {
                  const resolution = resolutions.get(task.feature.id);
                  const lock = task.feature.lock;

                  return (
                    <div key={task.feature.id} className="py-2 px-3">
                      <div className="flex items-start gap-2">
                        <div
                          className={cn(
                            "mt-0.5 p-1 rounded",
                            lock === "started"
                              ? "bg-status-info/10 text-status-info"
                              : "bg-status-warning/10 text-status-warning"
                          )}
                        >
                          {lock && getLockIcon(lock)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[12px] font-medium truncate">
                              {task.feature.name}
                            </p>
                            {lock && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground shrink-0">
                                {getLockLabel(lock)}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {task.blockReason || "Cannot move - task is locked"}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Current: {format(task.currentStart, "MMM d")} → Would move
                            to: {format(task.newStart, "MMM d")}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons for blocked tasks */}
                      <div className="flex items-center gap-2 mt-2 ml-7">
                        {lock !== "started" && (
                          <Button
                            variant={resolution === "unlock-move" ? "default" : "outline"}
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() =>
                              handleResolutionChange(
                                task.feature.id,
                                resolution === "unlock-move" ? "unlink" : "unlock-move"
                              )
                            }
                          >
                            Unlock & Move
                          </Button>
                        )}
                        <Button
                          variant={resolution === "unlink" ? "default" : "outline"}
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => handleResolutionChange(task.feature.id, "unlink")}
                        >
                          Unlink
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {affectedTasks.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-[12px]">
              No dependent tasks will be affected by this change.
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 border-t border-border pt-4">
          <div className="flex items-center justify-between w-full">
            <p className="text-[11px] text-muted-foreground">
              {moveCount} {moveCount === 1 ? "task" : "tasks"} will move
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply Changes
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Utility function to calculate cascade effects
export function calculateCascadeEffects(
  sourceFeature: GanttFeature,
  newStart: Date,
  allFeatures: GanttFeature[],
  getDependentTasks: (taskId: string) => string[]
): CascadeAffectedTask[] {
  const timeShift = newStart.getTime() - sourceFeature.startAt.getTime();
  if (timeShift === 0) return [];

  const dependentIds = getDependentTasks(sourceFeature.id);
  const affected: CascadeAffectedTask[] = [];

  dependentIds.forEach((depId) => {
    const feature = allFeatures.find((f) => f.id === depId);
    if (!feature) return;

    const newStartDate = new Date(feature.startAt.getTime() + timeShift);
    const newEndDate = new Date(feature.endAt.getTime() + timeShift);

    let isBlocked = false;
    let blockReason: string | undefined;

    if (feature.lock) {
      isBlocked = true;
      switch (feature.lock) {
        case "supplierConfirmed":
          blockReason = "Supplier has confirmed this delivery date";
          break;
        case "started":
          blockReason = "Cannot move - task already in progress";
          break;
        case "manuallyPositioned":
          blockReason = "Task has been manually locked in place";
          break;
      }
    }

    affected.push({
      feature,
      currentStart: feature.startAt,
      currentEnd: feature.endAt,
      newStart: newStartDate,
      newEnd: newEndDate,
      isBlocked,
      blockReason,
    });
  });

  return affected;
}
