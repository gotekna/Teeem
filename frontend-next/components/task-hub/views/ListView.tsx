'use client';

import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { TASK_STATUS } from '@/lib/constants/task-status';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { TaskListRow, TaskListHeader } from '../TaskListRow';

interface SectionProps {
  title: string;
  tasks: SmTask[];
  defaultOpen?: boolean;
  variant?: 'default' | 'danger' | 'warning';
  editingTaskId: number | null;
  editingTaskName: string;
  setEditingTaskId: (id: number | null) => void;
  setEditingTaskName: (name: string) => void;
  onTaskNameSave: (taskId: number) => void;
}

function Section({
  title,
  tasks,
  defaultOpen = true,
  variant = 'default',
  editingTaskId,
  editingTaskName,
  setEditingTaskId,
  setEditingTaskName,
  onTaskNameSave,
}: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (tasks.length === 0) return null;

  return (
    <div className={cn(
      'border rounded overflow-hidden',
      variant === 'danger' && 'border-red-200 dark:border-red-900',
      variant === 'warning' && 'border-yellow-200 dark:border-yellow-900'
    )}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium hover:bg-muted/50',
          variant === 'danger' && 'text-red-700 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20',
          variant === 'warning' && 'text-yellow-700 dark:text-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20'
        )}
      >
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title}
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-auto">
          {tasks.length}
        </Badge>
      </button>
      {isOpen && (
        <div>
          <TaskListHeader />
          <div className="divide-y divide-border/50">
            {tasks.map(task => (
              <TaskListRow
                key={task.id}
                task={task}
                editingTaskId={editingTaskId}
                editingTaskName={editingTaskName}
                setEditingTaskId={setEditingTaskId}
                setEditingTaskName={setEditingTaskName}
                onTaskNameSave={onTaskNameSave}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ListView() {
  const {
    filteredTasks,
    updateTask,
  } = useTaskHub();

  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskName, setEditingTaskName] = useState('');

  const handleTaskNameSave = async (taskId: number) => {
    if (editingTaskName.trim() && editingTaskName.trim() !== filteredTasks.find(t => t.id === taskId)?.name) {
      await updateTask(taskId, { name: editingTaskName.trim() });
    }
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  const { overdue, today, thisWeek, upcoming, completed } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const overdue: SmTask[] = [];
    const today: SmTask[] = [];
    const thisWeek: SmTask[] = [];
    const upcoming: SmTask[] = [];
    const completed: SmTask[] = [];

    filteredTasks.forEach(task => {
      if (task.status === TASK_STATUS.COMPLETED) {
        completed.push(task);
        return;
      }

      const endDate = new Date(task.end_date);

      if (endDate < todayStart) {
        overdue.push(task);
      } else if (endDate < todayEnd) {
        today.push(task);
      } else if (endDate < weekEnd) {
        thisWeek.push(task);
      } else {
        upcoming.push(task);
      }
    });

    // Sort each group by end_date
    const sortByEndDate = (a: SmTask, b: SmTask) =>
      new Date(a.end_date).getTime() - new Date(b.end_date).getTime();

    overdue.sort(sortByEndDate);
    today.sort(sortByEndDate);
    thisWeek.sort(sortByEndDate);
    upcoming.sort(sortByEndDate);
    completed.sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime()); // Most recent first

    return { overdue, today, thisWeek, upcoming, completed };
  }, [filteredTasks]);

  const editingProps = {
    editingTaskId,
    editingTaskName,
    setEditingTaskId,
    setEditingTaskName,
    onTaskNameSave: handleTaskNameSave,
  };

  if (filteredTasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No tasks found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Section title="Overdue" tasks={overdue} variant="danger" {...editingProps} />
      <Section title="Today" tasks={today} variant="warning" {...editingProps} />
      <Section title="This Week" tasks={thisWeek} {...editingProps} />
      <Section title="Upcoming" tasks={upcoming} defaultOpen={overdue.length === 0 && today.length === 0} {...editingProps} />
      <Section title="Completed" tasks={completed} defaultOpen={false} {...editingProps} />
    </div>
  );
}
