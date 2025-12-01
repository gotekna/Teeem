'use client';

import { useMemo } from 'react';
import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { useState } from 'react';
import {
  Calendar,
  Briefcase,
  Lock,
  AlertTriangle,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column {
  id: 'not_started' | 'started' | 'completed';
  title: string;
  color: string;
}

const columns: Column[] = [
  { id: 'not_started', title: 'Not Started', color: 'bg-gray-100' },
  { id: 'started', title: 'In Progress', color: 'bg-blue-100' },
  { id: 'completed', title: 'Completed', color: 'bg-green-100' },
];

interface TaskCardProps {
  task: SmTask;
  isDragging?: boolean;
}

function TaskCard({ task, isDragging }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
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
        'bg-background rounded-lg border p-3 shadow-sm transition-all',
        isDragging && 'opacity-50',
        task.is_overdue && task.status !== 'completed' && 'border-red-300 bg-red-50/50 dark:bg-red-900/10'
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 mt-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-medium text-sm truncate',
              task.status === 'completed' && 'line-through text-muted-foreground'
            )}>
              {task.name}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.job_name && (
              <Badge variant="outline" className="text-xs">
                <Briefcase className="h-3 w-3 mr-1" />
                {task.job_name}
              </Badge>
            )}
            {task.trade && (
              <Badge variant="secondary" className="text-xs">
                {task.trade}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{new Date(task.start_date).toLocaleDateString()}</span>
            </div>

            <div className="flex items-center gap-1">
              {task.is_overdue && task.status !== 'completed' && (
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              )}
              {task.locked && (
                <Lock className="h-3.5 w-3.5 text-orange-500" />
              )}
              {task.assigned_user_name && (
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">
                    {task.assigned_user_name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ColumnProps {
  column: Column;
  tasks: SmTask[];
}

function BoardColumn({ column, tasks }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex flex-col w-80 shrink-0">
      <div className={cn('rounded-t-lg px-3 py-2', column.color)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{column.title}</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {tasks.length}
          </Badge>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[200px] rounded-b-lg border border-t-0 p-2 space-y-2 transition-colors',
          isOver && 'bg-primary/5 border-primary'
        )}
      >
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
            No tasks
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
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, SmTask[]> = {
      not_started: [],
      started: [],
      completed: [],
    };

    filteredTasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    return grouped;
  }, [filteredTasks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(column => (
          <BoardColumn
            key={column.id}
            column={column}
            tasks={tasksByStatus[column.id] || []}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="w-80">
            <TaskCard task={activeTask} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
