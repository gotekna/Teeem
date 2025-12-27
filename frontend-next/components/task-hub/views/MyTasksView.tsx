'use client';

import { useMemo, useState } from 'react';
import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskExpandedRow } from '../TaskExpandedRow';
import {
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  Circle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const statusIcons = {
  not_started: Circle,
  started: PlayCircle,
  completed: CheckCircle2,
};

const statusColors = {
  not_started: 'text-gray-400',
  started: 'text-blue-500',
  completed: 'text-green-500',
};

interface TaskRowProps {
  task: SmTask;
}

function TaskRow({ task }: TaskRowProps) {
  const { updateTask, toggleTaskSelection, selectedTaskIds, expandedTaskId, toggleTaskExpansion } = useTaskHub();
  const StatusIcon = statusIcons[task.status];
  const isExpanded = expandedTaskId === task.id;

  const handleStatusClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = task.status === 'not_started' ? 'started' :
                       task.status === 'started' ? 'completed' : 'not_started';
    await updateTask(task.id, { status: nextStatus });
  };

  const handleCheckboxChange = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleRowClick = () => {
    toggleTaskExpansion(task.id);
  };

  return (
    <div>
      <div
        onClick={handleRowClick}
        className={cn(
          'flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded text-sm group cursor-pointer',
          selectedTaskIds.has(task.id) && 'bg-primary/5',
          task.is_overdue && task.status !== 'completed' && 'bg-red-50/50 dark:bg-red-950/20',
          isExpanded && 'bg-muted/50'
        )}
      >
        <div onClick={handleCheckboxChange}>
          <Checkbox
            checked={selectedTaskIds.has(task.id)}
            onCheckedChange={() => toggleTaskSelection(task.id)}
            className="h-3.5 w-3.5"
          />
        </div>
        <button onClick={handleStatusClick} className="shrink-0">
          <StatusIcon className={cn('h-4 w-4', statusColors[task.status])} />
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
        {task.job_name && task.job_name !== 'Personal Task' && (
          <span className="text-xs text-muted-foreground truncate max-w-[120px] hidden sm:inline">
            {task.job_name}
          </span>
        )}
        {task.assigned_role && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 hidden md:inline-flex capitalize">
            {task.assigned_role}
          </Badge>
        )}
        {task.trade && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 hidden md:inline-flex">
            {task.trade}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
          {new Date(task.end_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
        </span>
      </div>
      {isExpanded && <TaskExpandedRow task={task} />}
    </div>
  );
}

interface SectionProps {
  title: string;
  tasks: SmTask[];
  defaultOpen?: boolean;
  variant?: 'default' | 'danger' | 'warning';
}

function Section({ title, tasks, defaultOpen = true, variant = 'default' }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (tasks.length === 0) return null;

  return (
    <div className={cn(
      'border rounded',
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
        <div className="py-1">
          {tasks.map(task => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MyTasksView() {
  const { myTasks, overdueTasks, todayTasks, thisWeekTasks } = useTaskHub();

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
      if (task.status === 'completed') return false;
      if (myOverdue.some(t => t.id === task.id)) return false;
      if (myToday.some(t => t.id === task.id)) return false;
      if (myThisWeek.some(t => t.id === task.id)) return false;
      return true;
    });

    const completed = myTasks.filter(task => task.status === 'completed').slice(0, 5);

    return { upcoming, completed, myOverdue, myToday, myThisWeek };
  }, [myTasks, overdueTasks, todayTasks, thisWeekTasks]);

  if (myTasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No tasks assigned to you</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Section title="Overdue" tasks={myOverdue} variant="danger" />
      <Section title="Today" tasks={myToday} variant="warning" />
      <Section title="This Week" tasks={myThisWeek} />
      <Section title="Upcoming" tasks={upcoming} defaultOpen={myOverdue.length === 0 && myToday.length === 0} />
      <Section title="Completed" tasks={completed} defaultOpen={false} />
    </div>
  );
}
