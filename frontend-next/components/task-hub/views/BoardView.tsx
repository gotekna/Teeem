'use client';

/**
 * BoardView - Kanban board view for Task Hub
 *
 * Uses the standard KanbanBoard component for drag-and-drop task management.
 * See: frontend-next/components/ui/kanban
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { TASK_STATUS } from '@/lib/constants/task-status';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { TaskExpandedRow } from '../TaskExpandedRow';
import {
  KanbanBoard,
  KanbanCard,
  type KanbanColumnDef,
  type CardMoveEvent,
} from '@/components/ui/kanban';
import { Lock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    id: TASK_STATUS.COMPLETED,
    title: 'Done',
    color: 'green',
  },
];

// Task card content renderer
function TaskCardContent({ task }: { task: TaskItem }) {
  return (
    <div
      className={cn(
        'px-2 py-1.5 text-xs flex items-center gap-1.5',
        task.is_overdue && task.status !== TASK_STATUS.COMPLETED && 'bg-red-50/50 dark:bg-red-950/30'
      )}
    >
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
        <Lock className="h-3 w-3 text-orange-500 shrink-0" />
      )}
      {task.trade && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 shrink-0">
          {task.trade}
        </Badge>
      )}
    </div>
  );
}

export function BoardView() {
  const router = useRouter();
  const { filteredTasks, updateTask } = useTaskHub();
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Cast tasks to TaskItem (they already have id)
  const tasks = filteredTasks as TaskItem[];

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

  // Handle card click to open sheet
  const handleCardClick = (task: TaskItem) => {
    setSelectedTask(task);
    setSheetOpen(true);
  };

  // Handle double-click to open in fullscreen
  const handleCardDoubleClick = (task: TaskItem) => {
    router.push(`/sm_tasks/${task.id}`);
  };

  // Render a task card
  const renderCard = (task: TaskItem, isDragging: boolean) => (
    <KanbanCard
      key={task.id}
      id={task.id}
      isDragging={isDragging}
      className={cn(
        task.is_overdue && task.status !== TASK_STATUS.COMPLETED && 'border-red-300'
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
        <TaskCardContent task={task} />
      </div>
    </KanbanCard>
  );

  return (
    <>
      <KanbanBoard
        columns={columns}
        items={tasks}
        getItemColumn={getItemColumn}
        renderCard={renderCard}
        onCardMove={handleCardMove}
        columnsCollapsible={false}
        columnGap="sm"
        minColumnWidth={200}
        className="h-full"
      />

      {/* Task Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-base">
              {selectedTask?.name}
            </SheetTitle>
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
