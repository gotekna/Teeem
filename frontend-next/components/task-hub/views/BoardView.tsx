'use client';

/**
 * BoardView - Kanban board view for Task Hub
 *
 * Uses the standard KanbanBoard component for drag-and-drop task management.
 * Supports manual priority ordering via drag-and-drop within columns.
 *
 * Ordering Logic:
 * - If task has board_priority[status], sort by that priority number
 * - Otherwise, sort by date (required_by or end_date)
 * - Manual priority always takes precedence over date ordering
 *
 * See: frontend-next/components/ui/kanban
 */

import { useMemo, useState, useCallback } from 'react';
import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { useAuth } from '@/contexts/AuthContext';
import { TASK_STATUS } from '@/lib/constants/task-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { TaskExpandedRow } from '../TaskExpandedRow';
import { SubtaskList } from '../SubtaskList';
import {
  KanbanBoard,
  KanbanCard,
  type KanbanColumnDef,
  type CardMoveEvent,
  type CardReorderEvent,
} from '@/components/ui/kanban';
import { Lock, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOverdueColorClasses } from '../TaskColorSettings';

// Extend SmTask to include KanbanItem requirements
interface TaskItem extends SmTask {
  id: number;
}

// Column definitions using the standard KanbanColumnDef type
const columns: KanbanColumnDef<TaskItem>[] = [
  {
    id: TASK_STATUS.NOT_STARTED,
    title: 'To Do',
    color: 'gray',
  },
  {
    id: TASK_STATUS.STARTED,
    title: 'Active',
    color: 'blue',
  },
  {
    id: TASK_STATUS.WAITING_FOR_RESPONSE,
    title: 'Waiting for Response',
    color: 'purple',
  },
  {
    id: TASK_STATUS.WAITING_FOR_INFO,
    title: 'Waiting for More Info',
    color: 'orange',
  },
  {
    id: TASK_STATUS.COMPLETED,
    title: 'Completed',
    color: 'green',
  },
];

// Task card content renderer
function TaskCardContent({ task, currentUserId }: { task: TaskItem; currentUserId?: number }) {
  // Get overdue gradient colors
  const overdueColors = task.is_overdue && task.status !== TASK_STATUS.COMPLETED && task.days_overdue
    ? getOverdueColorClasses(task.days_overdue)
    : null;

  // Show subtasks if user owns parent OR follows parent
  const showSubtasks = task.children && task.children.length > 0 &&
    (task.is_following || task.assigned_user_id === currentUserId);

  return (
    <div className={cn('px-2 py-1.5 text-xs', overdueColors && overdueColors.bg)}>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'flex-1 truncate',
            task.status === TASK_STATUS.COMPLETED && 'line-through text-muted-foreground'
          )}
        >
          {task.name}
        </span>

        {task.is_overdue && task.status !== TASK_STATUS.COMPLETED && (
          <Badge variant="destructive" className="h-3.5 px-1 text-[9px] gap-0.5 shrink-0">
            <AlertTriangle className="h-2 w-2" />
            {task.days_overdue ? `${task.days_overdue}d` : '!'}
          </Badge>
        )}
        {task.locked && (
          <Lock className="h-3 w-3 text-orange-500 dark:text-orange-400 shrink-0" />
        )}
        {task.trade && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 shrink-0">
            {task.trade}
          </Badge>
        )}
      </div>

      {/* Subtasks section */}
      {showSubtasks && (
        <SubtaskList subtasks={task.children} compact={true} />
      )}
    </div>
  );
}

/**
 * Calculate the priority value for inserting a task between two positions.
 * Uses fractional positioning to avoid rebalancing all priorities.
 */
function calculateInsertPriority(
  columnTasks: TaskItem[],
  fromIndex: number,
  toIndex: number,
  status: string
): number {
  // Remove the dragged item from consideration
  const otherTasks = columnTasks.filter((_, i) => i !== fromIndex);
  // Adjust toIndex if dragging down (since we removed the item)
  const effectiveToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;

  const before = effectiveToIndex > 0 ? otherTasks[effectiveToIndex - 1] : null;
  const after = otherTasks[effectiveToIndex] || null;

  const beforePriority = before?.board_priority?.[status];
  const afterPriority = after?.board_priority?.[status];

  // Insert at beginning (before all items with priority)
  if (beforePriority === undefined && afterPriority !== undefined) {
    return afterPriority - 1000;
  }
  // Insert at end (after all items with priority)
  if (afterPriority === undefined && beforePriority !== undefined) {
    return beforePriority + 1000;
  }
  // Insert between two prioritized items
  if (beforePriority !== undefined && afterPriority !== undefined) {
    return (beforePriority + afterPriority) / 2;
  }
  // Neither neighbor has priority - assign based on position
  // Use large gaps (1000) to leave room for future insertions
  return (effectiveToIndex + 1) * 1000;
}

/**
 * Sort tasks for a column using hybrid ordering:
 * - Tasks with board_priority for this status sort by priority (ascending)
 * - Tasks without priority sort by date (required_by or end_date)
 * - Tasks with priority appear before tasks without priority
 */
function sortTasksForColumn(tasks: TaskItem[], status: string): TaskItem[] {
  return [...tasks].sort((a, b) => {
    const aPriority = a.board_priority?.[status];
    const bPriority = b.board_priority?.[status];

    // Both have manual priority → sort by priority (lower = higher in list)
    if (aPriority !== undefined && bPriority !== undefined) {
      return aPriority - bPriority;
    }
    // Only a has priority → a comes first
    if (aPriority !== undefined) return -1;
    // Only b has priority → b comes first
    if (bPriority !== undefined) return 1;

    // Neither has priority → sort by date (earlier = higher in list)
    const aDate = new Date(a.required_by || a.end_date || 0).getTime();
    const bDate = new Date(b.required_by || b.end_date || 0).getTime();
    return aDate - bDate;
  });
}

export function BoardView() {
  const { filteredTasks, updateTask, reorderBoardTask } = useTaskHub();
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Cast tasks to TaskItem (they already have id)
  const rawTasks = filteredTasks as TaskItem[];

  // Sort tasks within each column by board_priority or date
  // We need to pass sorted items to KanbanBoard
  const sortedTasks = useMemo(() => {
    // Group by status and sort each group
    const grouped = new Map<string, TaskItem[]>();
    for (const task of rawTasks) {
      const existing = grouped.get(task.status) || [];
      existing.push(task);
      grouped.set(task.status, existing);
    }

    // Sort each group and flatten back
    const result: TaskItem[] = [];
    for (const [status, tasks] of grouped) {
      result.push(...sortTasksForColumn(tasks, status));
    }
    return result;
  }, [rawTasks]);

  // Get the column ID for a task
  const getItemColumn = (task: TaskItem): string => task.status;

  // Handle card move between columns
  const handleCardMove = async (event: CardMoveEvent<TaskItem>) => {
    const { item, toColumnId } = event;
    const newStatus = toColumnId as SmTask['status'];

    if (item.status === newStatus) return;

    try {
      await updateTask(item.id, { status: newStatus });
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  // Handle card reorder within a column (drag-and-drop priority ordering)
  const handleCardReorder = useCallback(async (event: CardReorderEvent<TaskItem>) => {
    const { item, columnId, fromIndex, toIndex } = event;

    // Don't do anything if position didn't change
    if (fromIndex === toIndex) return;

    // Get all tasks in this column (sorted)
    const columnTasks = sortedTasks.filter(t => t.status === columnId);

    // Calculate the new priority for the dragged task
    const newPriority = calculateInsertPriority(columnTasks, fromIndex, toIndex, columnId);

    try {
      await reorderBoardTask(item.id, columnId, newPriority);
    } catch (error) {
      console.error('Failed to reorder task:', error);
    }
  }, [sortedTasks, reorderBoardTask]);

  // Handle card click to open sheet
  const handleCardClick = (task: TaskItem) => {
    setSelectedTask(task);
    setSheetOpen(true);
  };

  // Handle double-click to open in new tab (matches List view behavior)
  const handleCardDoubleClick = (task: TaskItem) => {
    window.open(`/sm_tasks/${task.id}`, '_blank');
  };

  // Render a task card
  const renderCard = (task: TaskItem, isDragging: boolean) => {
    // Get overdue gradient colors
    const overdueColors = task.is_overdue && task.status !== TASK_STATUS.COMPLETED && task.days_overdue
      ? getOverdueColorClasses(task.days_overdue)
      : null;

    return (
      <KanbanCard
        key={task.id}
        id={task.id}
        isDragging={isDragging}
        className={cn(
          overdueColors && overdueColors.border
        )}
      >
      <div
        onClick={() => handleCardClick(task)}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleCardDoubleClick(task);
        }}
        className="cursor-pointer"
      >
        <TaskCardContent task={task} currentUserId={user?.id} />
      </div>
    </KanbanCard>
    );
  };

  return (
    <>
      <KanbanBoard
        columns={columns}
        items={sortedTasks}
        getItemColumn={getItemColumn}
        renderCard={renderCard}
        onCardMove={handleCardMove}
        onCardReorder={handleCardReorder}
        cardReorderable={true}
        columnsCollapsible={false}
        columnGap="sm"
        minColumnWidth={200}
        className="h-full"
      />

      {/* Task Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <SheetTitle
                className="text-base flex-1 cursor-pointer hover:text-primary transition-colors"
                onDoubleClick={() => selectedTask && window.open(`/sm_tasks/${selectedTask.id}`, '_blank')}
                title="Double-click to open full page"
              >
                {selectedTask?.name}
              </SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => selectedTask && window.open(`/sm_tasks/${selectedTask.id}`, '_blank')}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>
          {selectedTask && (
            <div className="mt-4">
              <TaskExpandedRow
                task={selectedTask}
                onClose={() => setSheetOpen(false)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
