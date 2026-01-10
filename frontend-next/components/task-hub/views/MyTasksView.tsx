'use client';

import { useMemo, useState } from 'react';
import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { TASK_STATUS } from '@/lib/constants/task-status';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
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

export function MyTasksView() {
  const { myTasks, overdueTasks, todayTasks, thisWeekTasks, updateTask } = useTaskHub();

  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskName, setEditingTaskName] = useState('');

  const handleTaskNameSave = async (taskId: number) => {
    const task = myTasks.find(t => t.id === taskId);
    if (editingTaskName.trim() && editingTaskName.trim() !== task?.name) {
      await updateTask(taskId, { name: editingTaskName.trim() });
    }
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  const { upcoming, completed, myOverdue, myToday, myThisWeek } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const myOverdue = overdueTasks.filter(t => myTasks.some(mt => mt.id === t.id));
    const myToday = todayTasks.filter(t => myTasks.some(mt => mt.id === t.id));
    const myThisWeek = thisWeekTasks.filter(t =>
      myTasks.some(mt => mt.id === t.id) && !myToday.some(tt => tt.id === t.id)
    );

    const upcoming = myTasks.filter(task => {
      if (task.status === TASK_STATUS.COMPLETED) return false;
      if (myOverdue.some(t => t.id === task.id)) return false;
      if (myToday.some(t => t.id === task.id)) return false;
      if (myThisWeek.some(t => t.id === task.id)) return false;
      return true;
    });

    const completed = myTasks.filter(task => task.status === TASK_STATUS.COMPLETED).slice(0, 5);

    return { upcoming, completed, myOverdue, myToday, myThisWeek };
  }, [myTasks, overdueTasks, todayTasks, thisWeekTasks]);

  const editingProps = {
    editingTaskId,
    editingTaskName,
    setEditingTaskId,
    setEditingTaskName,
    onTaskNameSave: handleTaskNameSave,
  };

  if (myTasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No tasks assigned to you</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Section title="Overdue" tasks={myOverdue} variant="danger" {...editingProps} />
      <Section title="Today" tasks={myToday} variant="warning" {...editingProps} />
      <Section title="This Week" tasks={myThisWeek} {...editingProps} />
      <Section title="Upcoming" tasks={upcoming} defaultOpen={myOverdue.length === 0 && myToday.length === 0} {...editingProps} />
      <Section title="Completed" tasks={completed} defaultOpen={false} {...editingProps} />
    </div>
  );
}
