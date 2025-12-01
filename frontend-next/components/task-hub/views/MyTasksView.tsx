'use client';

import { useMemo } from 'react';
import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle2,
  PlayCircle,
  ChevronRight,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400',
  started: 'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400',
};

interface TaskItemProps {
  task: SmTask;
  showJob?: boolean;
}

function TaskItem({ task, showJob = true }: TaskItemProps) {
  const { updateTask, toggleTaskSelection, selectedTaskIds } = useTaskHub();

  const handleStatusToggle = async () => {
    const nextStatus = task.status === 'not_started' ? 'started' :
                       task.status === 'started' ? 'completed' : 'not_started';
    await updateTask(task.id, { status: nextStatus });
  };

  const isSelected = selectedTaskIds.has(task.id);

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-secondary/50',
        isSelected && 'bg-primary/5 border-primary/20',
        task.is_overdue && task.status !== 'completed' && 'border-red-200 bg-red-50/50 dark:bg-red-900/10'
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => toggleTaskSelection(task.id)}
      />

      <button
        onClick={handleStatusToggle}
        className="shrink-0"
      >
        {task.status === 'completed' ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : task.status === 'started' ? (
          <PlayCircle className="h-5 w-5 text-blue-600" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-medium truncate',
            task.status === 'completed' && 'line-through text-muted-foreground'
          )}>
            {task.name}
          </span>
          {task.is_overdue && task.status !== 'completed' && (
            <Badge variant="destructive" className="text-xs">Overdue</Badge>
          )}
          {task.locked && (
            <Badge variant="outline" className="text-xs">Locked</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {showJob && task.job_name && (
            <>
              <Briefcase className="h-3 w-3" />
              <span className="truncate">{task.job_name}</span>
              <span>•</span>
            </>
          )}
          {task.trade && (
            <>
              <span>{task.trade}</span>
              <span>•</span>
            </>
          )}
          <Calendar className="h-3 w-3" />
          <span>{new Date(task.start_date).toLocaleDateString()}</span>
        </div>
      </div>

      <Badge className={statusColors[task.status]}>
        {task.status.replace('_', ' ')}
      </Badge>

      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

interface TaskSectionProps {
  title: string;
  description?: string;
  tasks: SmTask[];
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger';
}

function TaskSection({ title, description, tasks, icon, variant = 'default' }: TaskSectionProps) {
  if (tasks.length === 0) return null;

  return (
    <Card className={cn(
      variant === 'danger' && 'border-red-200',
      variant === 'warning' && 'border-yellow-200'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map(task => (
          <TaskItem key={task.id} task={task} />
        ))}
      </CardContent>
    </Card>
  );
}

export function MyTasksView() {
  const { myTasks, overdueTasks, todayTasks, thisWeekTasks, meta } = useTaskHub();

  // Split tasks into sections
  const { upcoming, completed } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcoming = myTasks.filter(task => {
      if (task.status === 'completed') return false;
      const startDate = new Date(task.start_date);
      return startDate >= nextWeek;
    });

    const completed = myTasks.filter(task => task.status === 'completed').slice(0, 5);

    return { upcoming, completed };
  }, [myTasks]);

  // My overdue tasks only
  const myOverdueTasks = overdueTasks.filter(t => myTasks.some(mt => mt.id === t.id));
  const myTodayTasks = todayTasks.filter(t => myTasks.some(mt => mt.id === t.id));
  const myThisWeekTasks = thisWeekTasks.filter(t =>
    myTasks.some(mt => mt.id === t.id) && !myTodayTasks.some(tt => tt.id === t.id)
  );

  if (myTasks.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
        <h3 className="text-lg font-medium">All caught up!</h3>
        <p className="text-muted-foreground mt-1">
          You have no tasks assigned to you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              <span className="text-sm">My Tasks</span>
            </div>
            <p className="text-2xl font-bold font-mono mt-1">{myTasks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <PlayCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm">In Progress</span>
            </div>
            <p className="text-2xl font-bold font-mono mt-1 text-blue-600">
              {myTasks.filter(t => t.status === 'started').length}
            </p>
          </CardContent>
        </Card>
        <Card className={myOverdueTasks.length > 0 ? 'border-red-200' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm">Overdue</span>
            </div>
            <p className={cn('text-2xl font-bold font-mono mt-1', myOverdueTasks.length > 0 && 'text-red-600')}>
              {myOverdueTasks.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm">Completed</span>
            </div>
            <p className="text-2xl font-bold font-mono mt-1 text-green-600">
              {myTasks.filter(t => t.status === 'completed').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Task Sections */}
      <TaskSection
        title="Overdue"
        description="Tasks past their due date"
        tasks={myOverdueTasks}
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        variant="danger"
      />

      <TaskSection
        title="Today"
        description="Tasks starting today"
        tasks={myTodayTasks}
        icon={<Calendar className="h-5 w-5 text-yellow-600" />}
        variant="warning"
      />

      <TaskSection
        title="This Week"
        description="Tasks starting within the next 7 days"
        tasks={myThisWeekTasks}
        icon={<Clock className="h-5 w-5 text-blue-600" />}
      />

      <TaskSection
        title="Upcoming"
        description="Tasks starting after this week"
        tasks={upcoming}
        icon={<Calendar className="h-5 w-5 text-gray-600" />}
      />

      {completed.length > 0 && (
        <TaskSection
          title="Recently Completed"
          tasks={completed}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
        />
      )}
    </div>
  );
}
