'use client';

/**
 * GanttDependencyEditor - Modal for editing task dependencies
 *
 * Allows users to view, add, and remove predecessors for a task.
 * Matches the functionality from the old GanttCanvasView.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ComboboxDropdown } from '@/components/ui/combobox-dropdown';
import { Trash2, Plus, ArrowRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GanttTask } from '@/lib/gantt/types';

// =============================================================================
// Types
// =============================================================================

interface PredecessorInfo {
  id: number;
  taskNumber: number;
  name: string;
  type: string;
  lag: number;
}

interface AvailableTask {
  id: number;
  taskNumber: number;
  name: string;
}

export interface GanttDependencyEditorProps {
  isOpen: boolean;
  onClose: () => void;
  task: GanttTask | null;
  predecessors: PredecessorInfo[];
  availableTasks: AvailableTask[];
  onAddPredecessor: (taskId: string, predecessorTaskNumber: number, type: string) => Promise<void>;
  onRemovePredecessor: (taskId: string, predecessorTaskNumber: number) => Promise<void>;
}

// Dependency types
const DEPENDENCY_TYPES = [
  { value: 'FS', label: 'Finish-to-Start (FS)' },
  { value: 'FF', label: 'Finish-to-Finish (FF)' },
  { value: 'SS', label: 'Start-to-Start (SS)' },
  { value: 'SF', label: 'Start-to-Finish (SF)' },
];

// =============================================================================
// Component
// =============================================================================

export function GanttDependencyEditor({
  isOpen,
  onClose,
  task,
  predecessors,
  availableTasks,
  onAddPredecessor,
  onRemovePredecessor,
}: GanttDependencyEditorProps) {
  const [selectedTaskNumber, setSelectedTaskNumber] = React.useState<number | null>(null);
  const [selectedType, setSelectedType] = React.useState('FS');
  const [isAdding, setIsAdding] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<number | null>(null);

  // Filter out already-added predecessors from available tasks
  const availableForAdding = React.useMemo(() => {
    if (!task) return [];
    const existingPredIds = new Set(predecessors.map(p => p.taskNumber));
    // Also exclude the task itself
    const taskRowData = task.rowData as { task_number?: number } | undefined;
    const selfTaskNumber = taskRowData?.task_number;
    return availableTasks.filter(t =>
      !existingPredIds.has(t.taskNumber) && t.taskNumber !== selfTaskNumber
    );
  }, [availableTasks, predecessors, task]);

  const handleAddPredecessor = async () => {
    if (!task || selectedTaskNumber === null) return;

    setIsAdding(true);
    try {
      await onAddPredecessor(task.id, selectedTaskNumber, selectedType);
      setSelectedTaskNumber(null);
      setSelectedType('FS');
    } catch (error) {
      console.error('Failed to add predecessor:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemovePredecessor = async (predecessorTaskNumber: number) => {
    if (!task) return;

    setRemovingId(predecessorTaskNumber);
    try {
      await onRemovePredecessor(task.id, predecessorTaskNumber);
    } catch (error) {
      console.error('Failed to remove predecessor:', error);
    } finally {
      setRemovingId(null);
    }
  };

  // Get task name for display
  const taskRowData = task?.rowData as { name?: string; task_number?: number } | undefined;
  const taskName = taskRowData?.name || task?.name || 'Task';
  const taskNumber = taskRowData?.task_number;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Edit Dependencies
          </DialogTitle>
          <DialogDescription>
            Manage predecessors for <strong>#{taskNumber} {taskName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Predecessors */}
          <div>
            <h4 className="text-sm font-medium mb-2">Current Predecessors</h4>
            {predecessors.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No predecessors</p>
            ) : (
              <div className="space-y-1">
                {predecessors.map((pred) => (
                  <div
                    key={pred.taskNumber}
                    className={cn(
                      'flex items-center justify-between p-2 rounded border bg-muted/30',
                      removingId === pred.taskNumber && 'opacity-50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        #{pred.taskNumber}
                      </span>
                      <span className="text-sm">{pred.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({pred.type || 'FS'})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemovePredecessor(pred.taskNumber)}
                      disabled={removingId === pred.taskNumber}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Predecessor */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Add Predecessor</h4>
            {availableForAdding.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No more tasks available to add as predecessors
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Task</label>
                    <ComboboxDropdown
                      items={availableForAdding.map(t => ({
                        id: String(t.taskNumber),
                        label: `#${t.taskNumber} ${t.name}`
                      }))}
                      selectedItem={selectedTaskNumber ? {
                        id: String(selectedTaskNumber),
                        label: availableForAdding.find(t => t.taskNumber === selectedTaskNumber)
                          ? `#${selectedTaskNumber} ${availableForAdding.find(t => t.taskNumber === selectedTaskNumber)?.name}`
                          : ''
                      } : undefined}
                      onSelect={(item) => setSelectedTaskNumber(parseInt(item.id, 10))}
                      placeholder="Select task..."
                      emptyResults="No tasks found"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                    <ComboboxDropdown
                      items={DEPENDENCY_TYPES.map(t => ({
                        id: t.value,
                        label: t.label
                      }))}
                      selectedItem={{
                        id: selectedType,
                        label: DEPENDENCY_TYPES.find(t => t.value === selectedType)?.label || ''
                      }}
                      onSelect={(item) => setSelectedType(item.id)}
                      placeholder="Select type..."
                      emptyResults="No types"
                      className="w-full"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddPredecessor}
                  disabled={selectedTaskNumber === null || isAdding}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Predecessor
                </Button>
              </div>
            )}
          </div>

          {/* Circular Dependency Warning */}
          <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              Be careful when adding predecessors. Circular dependencies (A → B → A)
              will cause scheduling issues.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GanttDependencyEditor;
