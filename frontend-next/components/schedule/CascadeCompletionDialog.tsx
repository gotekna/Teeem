"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";

export interface LinkedTask {
  id: number;
  name: string;
  status: string;
}

export interface CascadeCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  linkedTasks: LinkedTask[];
  onComplete: (alsoCompleteTaskIds: number[]) => Promise<void>;
  loading?: boolean;
}

/**
 * Dialog shown when completing a task that has completion_linked_task_ids configured.
 * Allows user to select which related tasks should also be completed.
 */
export function CascadeCompletionDialog({
  open,
  onOpenChange,
  taskName,
  linkedTasks,
  onComplete,
  loading = false,
}: CascadeCompletionDialogProps) {
  // Pre-select all incomplete tasks
  const [selectedIds, setSelectedIds] = React.useState<number[]>(() =>
    linkedTasks
      .filter((t) => t.status !== "completed")
      .map((t) => t.id)
  );

  // Reset selections when dialog opens with new tasks
  React.useEffect(() => {
    if (open) {
      setSelectedIds(
        linkedTasks
          .filter((t) => t.status !== "completed")
          .map((t) => t.id)
      );
    }
  }, [open, linkedTasks]);

  const incompleteTasks = linkedTasks.filter((t) => t.status !== "completed");
  const completedTasks = linkedTasks.filter((t) => t.status === "completed");

  const toggleTask = (taskId: number) => {
    setSelectedIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleComplete = async () => {
    await onComplete(selectedIds);
  };

  const totalToComplete = selectedIds.length + 1; // +1 for the main task

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete {taskName}</DialogTitle>
          <DialogDescription>
            Also complete these related tasks?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {incompleteTasks.length > 0 && (
            <div className="space-y-2">
              {incompleteTasks.map((task) => (
                <label
                  key={task.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.includes(task.id)}
                    onCheckedChange={() => toggleTask(task.id)}
                    disabled={loading}
                  />
                  <span className="text-sm">{task.name}</span>
                </label>
              ))}
            </div>
          )}

          {completedTasks.length > 0 && (
            <div className="space-y-2 opacity-50">
              {completedTasks.map((task) => (
                <label
                  key={task.id}
                  className="flex items-center gap-3 p-2 rounded-md"
                >
                  <Checkbox checked disabled />
                  <span className="text-sm line-through">
                    {task.name}
                    <span className="text-muted-foreground ml-2">(already completed)</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {linkedTasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No linked tasks found
            </p>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={loading}>
            {loading ? (
              <>
                <Spinner size={16} className="mr-2" />
                Completing...
              </>
            ) : (
              <>
                Complete{" "}
                {totalToComplete > 1
                  ? `(${totalToComplete} tasks)`
                  : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CascadeCompletionDialog;
