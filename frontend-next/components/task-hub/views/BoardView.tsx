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

import React, { useMemo, useState, useCallback } from 'react';
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
import { Lock, AlertTriangle, ExternalLink, ChevronDown, ChevronRight, Mail } from 'lucide-react';
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
    collapsed: true, // Collapsed by default
  },
];

// Task card content renderer (position badge now handled by KanbanCard SSoT)
interface TaskCardContentProps {
  task: TaskItem;
  currentUserId?: number;
  waitingStyles?: string | null;
  overdueColors?: { bg: string; border: string } | null;
}

function TaskCardContent({ task, currentUserId, waitingStyles, overdueColors }: TaskCardContentProps) {
  // Show subtasks if user owns parent OR follows parent
  const showSubtasks = task.children && task.children.length > 0 &&
    (task.is_following || task.assigned_user_id === currentUserId);

  // Determine if task is in a waiting status (shouldn't show overdue badge)
  const isWaitingStatus = task.status === TASK_STATUS.WAITING_FOR_RESPONSE ||
    task.status === TASK_STATUS.WAITING_FOR_INFO;

  // Unread email count for task card indicator (SSoT from backend)
  const unreadEmailCount = task.unread_email_count || 0;

  return (
    <div className={cn('px-2 py-1.5 text-xs', overdueColors?.bg)}>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'flex-1 truncate',
            task.status === TASK_STATUS.COMPLETED && 'line-through text-muted-foreground'
          )}
        >
          {task.name}
        </span>

        {/* Unread email indicator - iOS-style mail icon with badge */}
        {unreadEmailCount > 0 && (
          <div className="relative shrink-0" title={`${unreadEmailCount} unread email${unreadEmailCount > 1 ? 's' : ''}`}>
            <Mail className="h-4 w-4 text-blue-500 fill-blue-500" />
            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5">
              {unreadEmailCount > 99 ? '99+' : unreadEmailCount}
            </span>
          </div>
        )}
        {/* Only show overdue badge if not in waiting status */}
        {task.is_overdue && task.status !== TASK_STATUS.COMPLETED && !isWaitingStatus && (
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

// =============================================================================
// TIME-BASED GROUPING FOR COMPLETED COLUMN
// =============================================================================

type TimeGroup = 'thisWeek' | 'lastMonth' | 'thisYear' | string; // string for year like "2024"

interface GroupedTasks {
  id: TimeGroup;
  label: string;
  tasks: TaskItem[];
}

/**
 * Group tasks by completion date into time periods
 */
function groupTasksByCompletionDate(tasks: TaskItem[]): GroupedTasks[] {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const groups: Record<TimeGroup, TaskItem[]> = {
    thisWeek: [],
    lastMonth: [],
    thisYear: [],
  };
  const yearGroups: Record<string, TaskItem[]> = {};

  for (const task of tasks) {
    // Use completed_at as completion date (when task was marked complete)
    const completedDate = task.completed_at ? new Date(task.completed_at) : null;

    if (!completedDate) {
      groups.thisWeek.push(task); // No date, show in most recent
      continue;
    }

    if (completedDate >= startOfWeek) {
      groups.thisWeek.push(task);
    } else if (completedDate >= startOfMonth) {
      groups.lastMonth.push(task);
    } else if (completedDate >= startOfYear) {
      groups.thisYear.push(task);
    } else {
      // Group by year
      const year = completedDate.getFullYear().toString();
      if (!yearGroups[year]) yearGroups[year] = [];
      yearGroups[year].push(task);
    }
  }

  // Build ordered result
  const result: GroupedTasks[] = [];

  if (groups.thisWeek.length > 0) {
    result.push({ id: 'thisWeek', label: 'This Week', tasks: groups.thisWeek });
  }
  if (groups.lastMonth.length > 0) {
    result.push({ id: 'lastMonth', label: 'Last Month', tasks: groups.lastMonth });
  }
  if (groups.thisYear.length > 0) {
    result.push({ id: 'thisYear', label: 'This Year', tasks: groups.thisYear });
  }

  // Add year groups in descending order
  const years = Object.keys(yearGroups).sort((a, b) => parseInt(b) - parseInt(a));
  for (const year of years) {
    result.push({ id: year, label: year, tasks: yearGroups[year] });
  }

  return result;
}

/**
 * Collapsible section for time-grouped completed tasks
 */
function CompletedGroupSection({
  group,
  renderCard,
  defaultCollapsed = true,
}: {
  group: GroupedTasks;
  renderCard: (task: TaskItem, isDragging: boolean) => React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="mb-2">
      {/* Group header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 w-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <span>{group.label}</span>
        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
          {group.tasks.length}
        </Badge>
      </button>

      {/* Group content */}
      {!collapsed && (
        <div className="space-y-2 mt-1.5">
          {group.tasks.map((task) => (
            <React.Fragment key={task.id}>
              {renderCard(task, false)}
            </React.Fragment>
          ))}
        </div>
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
      const updates: Partial<SmTask> = { status: newStatus };

      // When moving TO Active, set required_by to today
      if (newStatus === TASK_STATUS.STARTED) {
        updates.required_by = new Date().toISOString().split('T')[0];
      }

      await updateTask(item.id, updates);
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  // Handle card reorder within a column (drag-and-drop priority ordering)
  // Strategy: Assign sequential priorities to ALL tasks in the column to maintain new order
  const handleCardReorder = useCallback(async (event: CardReorderEvent<TaskItem>) => {
    const { item, columnId, fromIndex, toIndex } = event;

    console.log('[BoardView] handleCardReorder called:', { itemId: item.id, columnId, fromIndex, toIndex });

    // Don't do anything if position didn't change
    if (fromIndex === toIndex) {
      console.log('[BoardView] fromIndex === toIndex, skipping');
      return;
    }

    // Get all tasks in this column (sorted by current order)
    const columnTasks = [...sortedTasks.filter(t => t.status === columnId)];

    // Reorder the array: remove from old position, insert at new position
    const [movedTask] = columnTasks.splice(fromIndex, 1);
    columnTasks.splice(toIndex, 0, movedTask);

    console.log('[BoardView] New order:', columnTasks.map((t, i) => `${i}: ${t.id}`));

    // Assign sequential priorities to ALL tasks in the column
    // This ensures the new order is maintained regardless of existing priorities
    try {
      const updatePromises = columnTasks.map((task, index) => {
        const newPriority = (index + 1) * 1000; // 1000, 2000, 3000, etc.
        console.log(`[BoardView] Setting task ${task.id} priority to ${newPriority}`);
        return reorderBoardTask(task.id, columnId, newPriority);
      });

      await Promise.all(updatePromises);
      console.log('[BoardView] All priorities updated successfully');
    } catch (error) {
      console.error('[BoardView] Failed to reorder tasks:', error);
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

  // Handle position change via typed number input
  // Uses same strategy as drag reorder: assign priorities to ALL tasks
  const handlePositionChange = useCallback(async (task: TaskItem, newPosition: number) => {
    const columnTasks = [...sortedTasks.filter(t => t.status === task.status)];
    const currentIndex = columnTasks.findIndex(t => t.id === task.id);
    const newIndex = newPosition - 1; // Convert 1-indexed to 0-indexed

    if (currentIndex === -1 || newIndex === currentIndex) return;
    if (newIndex < 0 || newIndex >= columnTasks.length) return;

    // Reorder the array: remove from old position, insert at new position
    const [movedTask] = columnTasks.splice(currentIndex, 1);
    columnTasks.splice(newIndex, 0, movedTask);

    // Assign sequential priorities to ALL tasks in the column
    try {
      const updatePromises = columnTasks.map((t, index) => {
        const newPriority = (index + 1) * 1000;
        return reorderBoardTask(t.id, task.status, newPriority);
      });

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Failed to reorder task:', error);
    }
  }, [sortedTasks, reorderBoardTask]);

  // Get column-based background color for waiting statuses
  const getWaitingColumnStyles = (status: string) => {
    if (status === TASK_STATUS.WAITING_FOR_RESPONSE) {
      return 'bg-purple-50/50 dark:bg-purple-950/20 border-l-4 border-l-purple-400';
    }
    if (status === TASK_STATUS.WAITING_FOR_INFO) {
      return 'bg-orange-50/50 dark:bg-orange-950/20 border-l-4 border-l-orange-400';
    }
    return null;
  };

  // Render a task card
  const renderCard = (task: TaskItem, isDragging: boolean) => {
    // Get overdue gradient colors - exclude waiting statuses (they shouldn't show as overdue)
    const overdueColors = task.is_overdue &&
      task.status !== TASK_STATUS.COMPLETED &&
      task.status !== TASK_STATUS.WAITING_FOR_RESPONSE &&
      task.status !== TASK_STATUS.WAITING_FOR_INFO &&
      task.days_overdue
        ? getOverdueColorClasses(task.days_overdue)
        : null;

    // Get waiting column styles (purple for Waiting for Response, orange for Waiting for More Info)
    const waitingStyles = getWaitingColumnStyles(task.status);

    // Calculate position within this column (1-indexed for display)
    const columnTasks = sortedTasks.filter(t => t.status === task.status);
    const position = columnTasks.findIndex(t => t.id === task.id) + 1;
    const maxPosition = columnTasks.length;

    return (
      <KanbanCard
        key={task.id}
        id={task.id}
        isDragging={isDragging}
        className={cn(
          overdueColors && overdueColors.border,
          waitingStyles,
          "cursor-pointer"
        )}
        onClick={() => handleCardClick(task)}
        onDoubleClick={() => handleCardDoubleClick(task)}
        // Position badge via SSoT - click to type new position number
        position={position}
        maxPosition={maxPosition}
        positionEditable={true}
        onPositionChange={(newPos) => handlePositionChange(task, newPos)}
      >
        <TaskCardContent
          task={task}
          currentUserId={user?.id}
          waitingStyles={waitingStyles}
          overdueColors={overdueColors}
        />
      </KanbanCard>
    );
  };

  return (
    <>
    <div className="h-full overflow-hidden">
      <KanbanBoard
        columns={columns}
        items={sortedTasks}
        getItemColumn={getItemColumn}
        renderCard={renderCard}
        onCardMove={handleCardMove}
        onCardReorder={handleCardReorder}
        cardReorderable={true}
        columnsCollapsible={true}
        columnGap="sm"
        minColumnWidth={200}
        className="h-full"
        // Custom grouped view for Completed column only
        renderColumnContent={(column, items, rc) => {
          // Only use grouped view for Completed column
          if (column.id !== TASK_STATUS.COMPLETED) {
            return undefined; // Use default rendering
          }

          // Group completed tasks by time period
          const groups = groupTasksByCompletionDate(items as TaskItem[]);

          if (groups.length === 0) {
            return (
              <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                No completed tasks
              </div>
            );
          }

          return (
            <div>
              {groups.map((group, index) => (
                <CompletedGroupSection
                  key={group.id}
                  group={group}
                  renderCard={rc as (task: TaskItem, isDragging: boolean) => React.ReactNode}
                  defaultCollapsed={index > 0} // First group expanded, rest collapsed
                />
              ))}
            </div>
          );
        }}
      />
    </div>

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
