'use client';

import { useMemo, useState } from 'react';
import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { Badge } from '@/components/ui/badge';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  Lock,
  AlertTriangle,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column {
  id: 'not_started' | 'started' | 'completed';
  title: string;
  color: string;
  bgColor: string;
}

const columns: Column[] = [
  { id: 'not_started', title: 'To Do', color: 'bg-gray-200 dark:bg-gray-700', bgColor: 'bg-gray-50 dark:bg-gray-900/50' },
  { id: 'started', title: 'Active', color: 'bg-blue-200 dark:bg-blue-900', bgColor: 'bg-blue-50/50 dark:bg-blue-950/30' },
  { id: 'completed', title: 'Done', color: 'bg-green-200 dark:bg-green-900', bgColor: 'bg-green-50/50 dark:bg-green-950/30' },
];

interface TaskCardProps {
  task: SmTask;
  isDragging?: boolean;
}

function TaskCard({ task, isDragging }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-background rounded border px-2 py-1.5 text-xs transition-all flex items-center gap-1.5',
        isDragging && 'opacity-50 shadow-lg',
        task.is_overdue && task.status !== 'completed' && 'border-red-300 bg-red-50/50 dark:bg-red-950/30'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3" />
      </button>

      <span className={cn(
        'flex-1 truncate',
        task.status === 'completed' && 'line-through text-muted-foreground'
      )}>
        {task.name}
      </span>

      {task.is_overdue && task.status !== 'completed' && (
        <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
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

interface ColumnProps {
  column: Column;
  tasks: SmTask[];
}

function BoardColumn({ column, tasks }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col flex-1 min-w-[200px]">
      <div className={cn('px-2 py-1 text-xs font-medium flex items-center justify-between rounded-t', column.color)}>
        <span>{column.title}</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{tasks.length}</Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[120px] rounded-b border border-t-0 p-1 space-y-1 transition-colors',
          column.bgColor,
          isOver && 'ring-2 ring-primary ring-inset'
        )}
      >
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-12 text-[10px] text-muted-foreground">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

export function BoardView() {
  const { filteredTasks, updateTask } = useTaskHub();
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, SmTask[]> = { not_started: [], started: [], completed: [] };
    filteredTasks.forEach(task => {
      if (grouped[task.status]) grouped[task.status].push(task);
    });
    return grouped;
  }, [filteredTasks]);

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as number);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const taskId = active.id as number;
    const newStatus = over.id as SmTask['status'];
    const task = filteredTasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    try {
      await updateTask(taskId, { status: newStatus });
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const activeTask = activeId ? filteredTasks.find(t => t.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-2">
        {columns.map(column => (
          <BoardColumn key={column.id} column={column} tasks={tasksByStatus[column.id] || []} />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="w-48">
            <TaskCard task={activeTask} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
