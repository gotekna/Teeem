'use client';

/**
 * GanttDependencyEditor - Full dependency editor dialog
 *
 * Matches the old GanttCanvasView dependency editor with:
 * - Left sidebar with info panels
 * - Predecessors section with table
 * - Successors section with table
 * - Lag editing
 * - Row # quick input
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ComboboxDropdown } from '@/components/ui/combobox-dropdown';
import { X } from 'lucide-react';
import type { GanttTask } from '@/lib/gantt/types';

// =============================================================================
// Types
// =============================================================================

type DependencyType = 'FS' | 'FF' | 'SS' | 'SF';

interface DependencyLink {
  predecessorId: string;
  type: DependencyType;
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
  tasks: GanttTask[]; // All tasks for selection
  onSave: (
    taskId: string,
    predecessors: Array<{ taskNumber: number; type: string; lag: number }>,
    successors: Array<{ taskNumber: number; type: string; lag: number }>
  ) => Promise<void>;
  /** Pending predecessor from drag-create (not yet saved) */
  pendingPredecessor?: { taskNumber: number; type: string; lag: number };
  /** Pending successor from drag-create (not yet saved) */
  pendingSuccessor?: { taskNumber: number; type: string; lag: number };
}

// =============================================================================
// Component
// =============================================================================

export function GanttDependencyEditor({
  isOpen,
  onClose,
  task,
  tasks,
  onSave,
  pendingPredecessor,
  pendingSuccessor,
}: GanttDependencyEditorProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [depEditorLinks, setDepEditorLinks] = React.useState<DependencyLink[]>([]);
  const [depEditorSuccessorLinks, setDepEditorSuccessorLinks] = React.useState<DependencyLink[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  // Controlled state for pending input values (fixes race condition when clicking OK)
  const [pendingPredRowNum, setPendingPredRowNum] = React.useState('');
  const [pendingSuccRowNum, setPendingSuccRowNum] = React.useState('');

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Load predecessors and successors when task changes
  React.useEffect(() => {
    if (!task || !isOpen) return;

    // Reset pending input values when dialog opens
    setPendingPredRowNum('');
    setPendingSuccRowNum('');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowData = task.rowData as any;
    const predecessorIds = rowData?.predecessor_ids || [];

    // Convert predecessor_ids to DependencyLink format
    const predecessorLinks: DependencyLink[] = predecessorIds.map((pred: { id: number; type?: string; lag?: number }) => {
      // Find task by task_number to get its id
      const predTask = tasks.find(t => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = t.rowData as any;
        return r?.task_number === pred.id;
      });
      return {
        predecessorId: predTask?.id || '',
        type: (pred.type as DependencyType) || 'FS',
        lag: pred.lag || 0,
      };
    }).filter((link: DependencyLink) => link.predecessorId);

    // Add pending predecessor from drag-create if not already in the list
    if (pendingPredecessor) {
      console.log('[GanttDependencyEditor] pendingPredecessor:', pendingPredecessor);
      const alreadyExists = predecessorLinks.some(link => {
        const predTask = tasks.find(t => t.id === link.predecessorId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = predTask?.rowData as any;
        return r?.task_number === pendingPredecessor.taskNumber;
      });

      if (!alreadyExists) {
        // Find the task by task_number to get its id
        const pendingTask = tasks.find(t => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = t.rowData as any;
          return r?.task_number === pendingPredecessor.taskNumber;
        });
        console.log('[GanttDependencyEditor] Found pendingTask:', pendingTask?.id, pendingTask?.name);
        if (pendingTask) {
          predecessorLinks.push({
            predecessorId: pendingTask.id,
            type: (pendingPredecessor.type as DependencyType) || 'FS',
            lag: pendingPredecessor.lag || 0,
          });
          console.log('[GanttDependencyEditor] Added pending predecessor, total:', predecessorLinks.length);
        }
      } else {
        console.log('[GanttDependencyEditor] Pending predecessor already exists');
      }
    }

    setDepEditorLinks(predecessorLinks);

    // Find successors - tasks that have this task in their predecessor_ids
    const taskNumber = rowData?.task_number;
    const successorLinks: DependencyLink[] = [];

    if (taskNumber) {
      tasks.forEach(t => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = t.rowData as any;
        const preds = r?.predecessor_ids || [];
        const predLink = preds.find((p: { id: number }) => p.id === taskNumber);
        if (predLink) {
          successorLinks.push({
            predecessorId: t.id,
            type: (predLink.type as DependencyType) || 'FS',
            lag: predLink.lag || 0,
          });
        }
      });
    }

    setDepEditorSuccessorLinks(successorLinks);
  }, [task, tasks, isOpen, pendingPredecessor]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const updatePredecessorLink = (index: number, updates: Partial<DependencyLink>) => {
    setDepEditorLinks(prev => prev.map((link, i) =>
      i === index ? { ...link, ...updates } : link
    ));
  };

  const removePredecessorLink = (index: number) => {
    setDepEditorLinks(prev => prev.filter((_, i) => i !== index));
  };

  const updateSuccessorLink = (index: number, updates: Partial<DependencyLink>) => {
    setDepEditorSuccessorLinks(prev => prev.map((link, i) =>
      i === index ? { ...link, ...updates } : link
    ));
  };

  const removeSuccessorLink = (index: number) => {
    setDepEditorSuccessorLinks(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!task) return;

    // Start with current links
    let currentPredLinks = [...depEditorLinks];
    let currentSuccLinks = [...depEditorSuccessorLinks];

    // Check if there's a pending predecessor in the input field (controlled state)
    console.log('[GanttDependencyEditor] pendingPredRowNum:', pendingPredRowNum);
    console.log('[GanttDependencyEditor] tasks.length:', tasks.length);

    if (pendingPredRowNum) {
      const rowNum = parseInt(pendingPredRowNum, 10);
      console.log('[GanttDependencyEditor] rowNum:', rowNum);
      const t = rowNum > 0 && rowNum <= tasks.length ? tasks[rowNum - 1] : null;
      console.log('[GanttDependencyEditor] found task t:', t?.id, t?.name);
      console.log('[GanttDependencyEditor] current task.id:', task?.id);
      if (t && t.id !== task?.id && !currentPredLinks.some(l => l.predecessorId === t.id)) {
        currentPredLinks.push({ predecessorId: t.id, type: 'FS', lag: 0 });
        console.log('[GanttDependencyEditor] Added pending predecessor from input:', rowNum);
      }
    }

    // Check if there's a pending successor in the input field (controlled state)
    if (pendingSuccRowNum) {
      const rowNum = parseInt(pendingSuccRowNum, 10);
      const t = rowNum > 0 && rowNum <= tasks.length ? tasks[rowNum - 1] : null;
      if (t && t.id !== task?.id && !currentSuccLinks.some(l => l.predecessorId === t.id)) {
        currentSuccLinks.push({ predecessorId: t.id, type: 'FS', lag: 0 });
        console.log('[GanttDependencyEditor] Added pending successor from input:', rowNum);
      }
    }

    console.log('[GanttDependencyEditor] handleSave called, depEditorLinks:', currentPredLinks.length);

    setIsSaving(true);
    try {
      // Convert links back to task numbers
      const predecessors = currentPredLinks
        .filter(link => link.predecessorId)
        .map(link => {
          const predTask = tasks.find(t => t.id === link.predecessorId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rowData = predTask?.rowData as any;
          return {
            taskNumber: rowData?.task_number || 0,
            type: link.type,
            lag: link.lag,
          };
        })
        .filter(p => p.taskNumber > 0);

      const successors = currentSuccLinks
        .filter(link => link.predecessorId)
        .map(link => {
          const succTask = tasks.find(t => t.id === link.predecessorId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rowData = succTask?.rowData as any;
          return {
            taskNumber: rowData?.task_number || 0,
            type: link.type,
            lag: link.lag,
          };
        })
        .filter(s => s.taskNumber > 0);

      console.log('[GanttDependencyEditor] Saving predecessors:', predecessors, 'successors:', successors);
      await onSave(task.id, predecessors, successors);
      console.log('[GanttDependencyEditor] Save completed');
      onClose();
    } catch (error) {
      console.error('[GanttDependencyEditor] Failed to save dependencies:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  // Get task info for display
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskRowData = task?.rowData as any;
  const taskName = taskRowData?.name || task?.name || 'Task';
  const taskNumber = taskRowData?.task_number;
  const rowIndex = task ? tasks.findIndex(t => t.id === task.id) + 1 : 0;

  // Helper: Extract parent header task_number from header_gantt field
  // Mirrors backend extract_header_parent logic
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractHeaderParent = (headerGantt: any): number | null => {
    if (!headerGantt || headerGantt === 'Header') return null;
    if (typeof headerGantt === 'number') return headerGantt;
    if (typeof headerGantt === 'object' && (headerGantt.id || headerGantt.id === 0)) {
      return headerGantt.id;
    }
    if (typeof headerGantt === 'string' && /^\d+$/.test(headerGantt)) {
      return parseInt(headerGantt, 10);
    }
    return null;
  };

  // Get inherited predecessors from parent headers (walk up the chain)
  const inheritedPredecessors = React.useMemo(() => {
    if (!task) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskRowData = task.rowData as any;

    const inherited: Array<{ taskNumber: number; headerName: string; taskId: string }> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentParentId = extractHeaderParent(taskRowData?.header_gantt);

    while (currentParentId !== null) {
      // Find the parent header by task_number
      const parentHeader = tasks.find(t => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = t.rowData as any;
        return r?.task_number === currentParentId;
      });

      if (!parentHeader) break;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parentRowData = parentHeader.rowData as any;
      const parentPreds = parentRowData?.predecessor_ids || [];

      // Add each predecessor from this header
      parentPreds.forEach((pred: { id: number }) => {
        // Find the predecessor task
        const predTask = tasks.find(t => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = t.rowData as any;
          return r?.task_number === pred.id;
        });
        if (predTask) {
          inherited.push({
            taskNumber: pred.id,
            headerName: parentRowData?.name || `Header ${parentRowData?.task_number}`,
            taskId: predTask.id,
          });
        }
      });

      // Walk up to grandparent
      currentParentId = extractHeaderParent(parentRowData?.header_gantt);
    }

    return inherited;
  }, [task, tasks]);

  // Build combobox items from tasks (exclude headers and current task)
  const taskComboItems = React.useMemo(() => {
    return tasks
      .filter(t => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = t.rowData as any;
        // Exclude current task and headers
        return t.id !== task?.id && r?.header_gantt !== 'Header';
      })
      .map(t => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = t.rowData as any;
        return {
          id: t.id,
          label: `${r?.task_number || ''} - ${r?.name || t.name}`,
        };
      });
  }, [tasks, task?.id]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Dependencies</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Row {rowIndex}: {taskName}
          </p>
        </DialogHeader>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Sidebar - Info Panel */}
          <div className="w-64 shrink-0 space-y-4 overflow-y-auto">
            {/* Visual Guide */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">Drag to connect on Gantt</p>
              <div className="flex flex-col items-center gap-2 py-2">
                {/* Predecessor line: black/yellow */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center">
                    <div className="bg-indigo-500 text-white text-[10px] px-2 py-1 rounded font-medium">A</div>
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full -ml-0.5 ring-1 ring-white" />
                  </div>
                  <div className="w-8 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg, #000 0px, #000 3px, #fbbf24 3px, #fbbf24 6px)' }} />
                  <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-amber-400" />
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full -mr-0.5 ring-1 ring-white z-10" />
                    <div className="bg-purple-500 text-white text-[10px] px-2 py-1 rounded font-medium">B</div>
                  </div>
                  <span className="text-[9px] text-muted-foreground ml-1">predecessor</span>
                </div>
                {/* Successor line: black/blue */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center">
                    <div className="bg-purple-500 text-white text-[10px] px-2 py-1 rounded font-medium">B</div>
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full -ml-0.5 ring-1 ring-white" />
                  </div>
                  <div className="w-8 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg, #000 0px, #000 3px, #60a5fa 3px, #60a5fa 6px)' }} />
                  <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-blue-400" />
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full -mr-0.5 ring-1 ring-white z-10" />
                    <div className="bg-gray-500 text-white text-[10px] px-2 py-1 rounded font-medium">C</div>
                  </div>
                  <span className="text-[9px] text-muted-foreground ml-1">successor</span>
                </div>
              </div>
              <p className="text-[10px] text-blue-700 dark:text-blue-300 text-center">
                Drag from right dot → left dot
              </p>
            </div>

            {/* Predecessors Info */}
            <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-indigo-800 dark:text-indigo-200 mb-1">Predecessors</h4>
              <p className="text-[10px] text-indigo-700 dark:text-indigo-300">
                Tasks that must <strong>finish before</strong> this task can start. Controls when this task begins.
              </p>
            </div>

            {/* Successors Info */}
            <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-purple-800 dark:text-purple-200 mb-1">Successors</h4>
              <p className="text-[10px] text-purple-700 dark:text-purple-300">
                Tasks that <strong>wait for</strong> this task. When this task moves, successors may cascade.
              </p>
            </div>

            {/* Dependency Types */}
            <div className="bg-muted/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold mb-2">Dependency Types</h4>
              <div className="space-y-1.5 text-[10px]">
                <div><strong>FS</strong> - Finish-to-Start (most common)</div>
                <div><strong>SS</strong> - Start-to-Start</div>
                <div><strong>FF</strong> - Finish-to-Finish</div>
                <div><strong>SF</strong> - Start-to-Finish (rare)</div>
              </div>
            </div>

            {/* Lag Info */}
            <div className="bg-muted/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold mb-1">Lag (Days)</h4>
              <p className="text-[10px] text-muted-foreground">
                <strong>+3</strong> = wait 3 days after<br/>
                <strong>-2</strong> = overlap by 2 days
              </p>
            </div>
          </div>

          {/* Main Content - Predecessors & Successors */}
          <div className="flex-1 overflow-y-auto space-y-4 min-w-0">
            {/* Predecessors Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <h3 className="text-sm font-semibold">Predecessors</h3>
                <span className="text-xs text-muted-foreground">
                  ({depEditorLinks.filter(l => l.predecessorId).length}
                  {inheritedPredecessors.length > 0 && ` + ${inheritedPredecessors.length} inherited`})
                </span>
              </div>

              {/* Header row */}
              <div className="grid grid-cols-[72px_1fr_180px_60px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Row #</span>
                <span>Task</span>
                <span>Type</span>
                <span>Lag</span>
                <span></span>
              </div>

              {/* Predecessor rows */}
              <div className="space-y-2">
                {depEditorLinks.map((link, index) => {
                  const predecessorTask = tasks.find(t => t.id === link.predecessorId);
                  const predecessorRowNum = predecessorTask
                    ? tasks.findIndex(t => t.id === link.predecessorId) + 1
                    : '';

                  return (
                    <div key={index} className="grid grid-cols-[72px_1fr_180px_60px_32px] gap-2 items-center">
                      {/* Row # input */}
                      <Input
                        type="number"
                        min={1}
                        max={tasks.length}
                        value={predecessorRowNum}
                        onChange={(e) => {
                          const rowNum = parseInt(e.target.value, 10);
                          const t = rowNum > 0 && rowNum <= tasks.length ? tasks[rowNum - 1] : null;
                          if (t && t.id !== task?.id) {
                            updatePredecessorLink(index, { predecessorId: t.id });
                          } else if (!e.target.value) {
                            updatePredecessorLink(index, { predecessorId: '' });
                          }
                        }}
                        className="h-8 text-center"
                        placeholder="#"
                      />

                      {/* Task dropdown */}
                      <ComboboxDropdown
                        items={taskComboItems}
                        selectedItem={taskComboItems.find(item => item.id === link.predecessorId)}
                        onSelect={(item) => updatePredecessorLink(index, { predecessorId: item.id })}
                        placeholder="Select task..."
                        searchPlaceholder="Search tasks..."
                        className="h-8"
                      />

                      {/* Type dropdown */}
                      <select
                        value={link.type}
                        onChange={(e) => updatePredecessorLink(index, { type: e.target.value as DependencyType })}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="FS">Finish-to-Start (FS)</option>
                        <option value="FF">Finish-to-Finish (FF)</option>
                        <option value="SS">Start-to-Start (SS)</option>
                        <option value="SF">Start-to-Finish (SF)</option>
                      </select>

                      {/* Lag input */}
                      <Input
                        type="number"
                        value={link.lag}
                        onChange={(e) => updatePredecessorLink(index, { lag: parseInt(e.target.value, 10) || 0 })}
                        className="h-8 text-center"
                        placeholder="0"
                      />

                      {/* Remove button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removePredecessorLink(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}

                {/* Inherited predecessors (greyed out, read-only) */}
                {inheritedPredecessors.map((inherited, index) => {
                  const inheritedTask = tasks.find(t => t.id === inherited.taskId);
                  const inheritedRowNum = inheritedTask
                    ? tasks.findIndex(t => t.id === inherited.taskId) + 1
                    : '';
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const inheritedRowData = inheritedTask?.rowData as any;
                  const inheritedTaskName = inheritedRowData?.name || inheritedTask?.name || '';

                  return (
                    <div
                      key={`inherited-${index}`}
                      className="grid grid-cols-[72px_1fr_180px_60px_32px] gap-2 items-center opacity-50"
                      title={`Inherited from: ${inherited.headerName}`}
                    >
                      {/* Row # - disabled */}
                      <Input
                        type="number"
                        value={inheritedRowNum}
                        disabled
                        className="h-8 text-center bg-muted cursor-not-allowed"
                      />

                      {/* Task name - disabled with inherited label */}
                      <div className="h-8 flex items-center px-3 rounded-md border border-input bg-muted text-sm truncate">
                        <span className="truncate">{inherited.taskNumber} - {inheritedTaskName}</span>
                        <span className="ml-auto text-xs text-muted-foreground shrink-0 pl-2">
                          (from {inherited.headerName})
                        </span>
                      </div>

                      {/* Type - disabled */}
                      <select
                        disabled
                        className="h-8 w-full rounded-md border border-input bg-muted px-2 text-sm cursor-not-allowed"
                      >
                        <option>Finish-to-Start (FS)</option>
                      </select>

                      {/* Lag - disabled */}
                      <Input
                        disabled
                        value={0}
                        className="h-8 text-center bg-muted cursor-not-allowed"
                      />

                      {/* No remove button - can't delete inherited */}
                      <div className="h-8 w-8" />
                    </div>
                  );
                })}

                {/* Empty row to add new predecessor */}
                {(() => {
                  // Compute the pending task from row number for display
                  const pendingPredNum = parseInt(pendingPredRowNum, 10);
                  const pendingPredTask = pendingPredNum > 0 && pendingPredNum <= tasks.length ? tasks[pendingPredNum - 1] : null;
                  const pendingPredItem = pendingPredTask && pendingPredTask.id !== task?.id
                    ? taskComboItems.find(item => item.id === pendingPredTask.id)
                    : undefined;

                  return (
                    <div className="grid grid-cols-[72px_1fr_180px_60px_32px] gap-2 items-center opacity-60">
                      <Input
                        type="number"
                        min={1}
                        max={tasks.length}
                        value={pendingPredRowNum}
                        onChange={(e) => setPendingPredRowNum(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const rowNum = parseInt(pendingPredRowNum, 10);
                            const t = rowNum > 0 && rowNum <= tasks.length ? tasks[rowNum - 1] : null;
                            if (t && t.id !== task?.id && !depEditorLinks.some(l => l.predecessorId === t.id)) {
                              setDepEditorLinks(prev => [...prev, { predecessorId: t.id, type: 'FS', lag: 0 }]);
                              setPendingPredRowNum('');
                            }
                          }
                        }}
                        className="h-8 text-center"
                        placeholder="#"
                      />
                      <ComboboxDropdown
                        items={taskComboItems.filter(item => !depEditorLinks.some(l => l.predecessorId === item.id))}
                        selectedItem={pendingPredItem}
                        onSelect={(item) => {
                          // Update both the row number and add to list
                          const rowIndex = tasks.findIndex(t => t.id === item.id);
                          setPendingPredRowNum(rowIndex >= 0 ? String(rowIndex + 1) : '');
                          setDepEditorLinks(prev => [...prev, { predecessorId: item.id, type: 'FS', lag: 0 }]);
                          setPendingPredRowNum('');
                        }}
                        placeholder="Add predecessor..."
                        searchPlaceholder="Search tasks..."
                        className="h-8"
                      />
                      <select disabled className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                        <option>Finish-to-Start (FS)</option>
                      </select>
                      <Input disabled className="h-8 text-center" placeholder="0" />
                      <div className="h-8 w-8" />
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Successors Section */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <h3 className="text-sm font-semibold">Successors</h3>
                <span className="text-xs text-muted-foreground">({depEditorSuccessorLinks.filter(l => l.predecessorId).length})</span>
              </div>

              {/* Header row */}
              <div className="grid grid-cols-[72px_1fr_180px_60px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Row #</span>
                <span>Task</span>
                <span>Type</span>
                <span>Lag</span>
                <span></span>
              </div>

              {/* Successor rows */}
              <div className="space-y-2">
                {depEditorSuccessorLinks.map((link, index) => {
                  const successorTask = tasks.find(t => t.id === link.predecessorId);
                  const successorRowNum = successorTask
                    ? tasks.findIndex(t => t.id === link.predecessorId) + 1
                    : '';

                  return (
                    <div key={index} className="grid grid-cols-[72px_1fr_180px_60px_32px] gap-2 items-center">
                      {/* Row # input */}
                      <Input
                        type="number"
                        min={1}
                        max={tasks.length}
                        value={successorRowNum}
                        onChange={(e) => {
                          const rowNum = parseInt(e.target.value, 10);
                          const t = rowNum > 0 && rowNum <= tasks.length ? tasks[rowNum - 1] : null;
                          if (t && t.id !== task?.id) {
                            updateSuccessorLink(index, { predecessorId: t.id });
                          } else if (!e.target.value) {
                            updateSuccessorLink(index, { predecessorId: '' });
                          }
                        }}
                        className="h-8 text-center"
                        placeholder="#"
                      />

                      {/* Task dropdown */}
                      <ComboboxDropdown
                        items={taskComboItems}
                        selectedItem={taskComboItems.find(item => item.id === link.predecessorId)}
                        onSelect={(item) => updateSuccessorLink(index, { predecessorId: item.id })}
                        placeholder="Select task..."
                        searchPlaceholder="Search tasks..."
                        className="h-8"
                      />

                      {/* Type dropdown */}
                      <select
                        value={link.type}
                        onChange={(e) => updateSuccessorLink(index, { type: e.target.value as DependencyType })}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="FS">Finish-to-Start (FS)</option>
                        <option value="FF">Finish-to-Finish (FF)</option>
                        <option value="SS">Start-to-Start (SS)</option>
                        <option value="SF">Start-to-Finish (SF)</option>
                      </select>

                      {/* Lag input */}
                      <Input
                        type="number"
                        value={link.lag}
                        onChange={(e) => updateSuccessorLink(index, { lag: parseInt(e.target.value, 10) || 0 })}
                        className="h-8 text-center"
                        placeholder="0"
                      />

                      {/* Remove button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeSuccessorLink(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}

                {/* Empty row to add new successor */}
                {(() => {
                  // Compute the pending task from row number for display
                  const pendingSuccNum = parseInt(pendingSuccRowNum, 10);
                  const pendingSuccTask = pendingSuccNum > 0 && pendingSuccNum <= tasks.length ? tasks[pendingSuccNum - 1] : null;
                  const pendingSuccItem = pendingSuccTask && pendingSuccTask.id !== task?.id
                    ? taskComboItems.find(item => item.id === pendingSuccTask.id)
                    : undefined;

                  return (
                    <div className="grid grid-cols-[72px_1fr_180px_60px_32px] gap-2 items-center opacity-60">
                      <Input
                        type="number"
                        min={1}
                        max={tasks.length}
                        value={pendingSuccRowNum}
                        onChange={(e) => setPendingSuccRowNum(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const rowNum = parseInt(pendingSuccRowNum, 10);
                            const t = rowNum > 0 && rowNum <= tasks.length ? tasks[rowNum - 1] : null;
                            if (t && t.id !== task?.id && !depEditorSuccessorLinks.some(l => l.predecessorId === t.id)) {
                              setDepEditorSuccessorLinks(prev => [...prev, { predecessorId: t.id, type: 'FS', lag: 0 }]);
                              setPendingSuccRowNum('');
                            }
                          }
                        }}
                        className="h-8 text-center"
                        placeholder="#"
                      />
                      <ComboboxDropdown
                        items={taskComboItems.filter(item =>
                          !depEditorSuccessorLinks.some(l => l.predecessorId === item.id) &&
                          !depEditorLinks.some(l => l.predecessorId === item.id)
                        )}
                        selectedItem={pendingSuccItem}
                        onSelect={(item) => {
                          const rowIndex = tasks.findIndex(t => t.id === item.id);
                          setPendingSuccRowNum(rowIndex >= 0 ? String(rowIndex + 1) : '');
                          setDepEditorSuccessorLinks(prev => [...prev, { predecessorId: item.id, type: 'FS', lag: 0 }]);
                          setPendingSuccRowNum('');
                        }}
                        placeholder="Add successor..."
                        searchPlaceholder="Search tasks..."
                        className="h-8"
                      />
                      <select disabled className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                        <option>Finish-to-Start (FS)</option>
                      </select>
                      <Input disabled className="h-8 text-center" placeholder="0" />
                      <div className="h-8 w-8" />
                    </div>
                  );
                })()}

                {depEditorSuccessorLinks.length === 0 && (
                  <p className="text-xs text-muted-foreground italic py-1">
                    No tasks depend on this task yet. Add one above.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'OK'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GanttDependencyEditor;
