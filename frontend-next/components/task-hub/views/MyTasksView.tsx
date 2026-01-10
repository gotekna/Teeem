'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskExpandedRow } from '../TaskExpandedRow';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getTaskRowColorClass, getTaskColorClasses } from '../TaskColorSettings';

interface TaskRowProps {
  task: SmTask;
}

function TaskRow({ task }: TaskRowProps) {
  const router = useRouter();
  const {
    updateTask,
    toggleTaskSelection,
    selectedTaskIds,
    expandedTaskId,
    toggleTaskExpansion,
    startTask,
    completeTask,
    setTaskHold,
    confirmTask,
    supplierConfirmTask,
  } = useTaskHub();
  const isExpanded = expandedTaskId === task.id;

  const handleRowClick = () => {
    toggleTaskExpansion(task.id);
  };

  const handleRowDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/sm_tasks/${task.id}`);
  };

  return (
    <div>
      <div
        onClick={handleRowClick}
        onDoubleClick={handleRowDoubleClick}
        className={cn(
          'grid grid-cols-[20px_1fr_90px_16px_140px_60px_60px] gap-1 py-1.5 px-2 hover:bg-muted/50 rounded text-sm group cursor-pointer items-center',
          selectedTaskIds.has(task.id) && 'bg-primary/5',
          getTaskRowColorClass(task),
          isExpanded && 'bg-muted/50'
        )}
      >
        {/* Col 1: Multi-select */}
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedTaskIds.has(task.id)}
            onCheckedChange={() => toggleTaskSelection(task.id)}
            className="h-3.5 w-3.5"
          />
        </div>

        {/* Col 2: Task name */}
        <div className="flex items-center gap-1 min-w-0">
          <span className={cn(
            'truncate',
            task.status === 'completed' && 'line-through text-muted-foreground'
          )}>
            {task.name}
          </span>
          {(task.attachments_count ?? 0) > 0 && (
            <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          {task.is_following && (
            <Badge variant="outline" className={cn("h-4 px-1 text-[10px] gap-0.5 shrink-0", getTaskColorClasses('following').text)}>
              <Eye className="h-2.5 w-2.5" />
              Following
            </Badge>
          )}
        </div>

        {/* Col 3: Status Checkboxes - fixed width for alignment */}
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <TooltipProvider delayDuration={300}>
            {/* Started */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Checkbox
                    checked={task.status === 'started' || task.status === 'completed'}
                    onCheckedChange={(checked) => {
                      if (checked) startTask(task.id);
                      else updateTask(task.id, { status: 'not_started' });
                    }}
                    disabled={task.status === 'completed'}
                    className="h-3.5 w-3.5 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Started</TooltipContent>
            </Tooltip>

            {/* PO-only: Hold, Confirmed, Supplier */}
            {task.purchase_order_id ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Checkbox
                        checked={task.hold}
                        onCheckedChange={(checked) => setTaskHold(task.id, !!checked)}
                        className="h-3.5 w-3.5 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px]">Hold</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Checkbox
                        checked={task.confirm}
                        onCheckedChange={(checked) => {
                          if (checked) confirmTask(task.id, new Date().toISOString().split('T')[0]);
                          else updateTask(task.id, { confirm: false });
                        }}
                        className="h-3.5 w-3.5 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px]">Confirmed</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Checkbox
                        checked={task.supplier_confirm}
                        onCheckedChange={(checked) => {
                          if (checked) supplierConfirmTask(task.id, new Date().toISOString().split('T')[0]);
                          else updateTask(task.id, { supplier_confirm: false });
                        }}
                        className="h-3.5 w-3.5 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px]">Supplier</TooltipContent>
                </Tooltip>
              </>
            ) : (
              /* Spacers for non-PO tasks to maintain alignment */
              <div className="w-[54px]" />
            )}

            {/* Done */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Checkbox
                    checked={task.status === 'completed'}
                    onCheckedChange={(checked) => {
                      if (checked) completeTask(task.id);
                      else updateTask(task.id, { status: 'started' });
                    }}
                    className="h-3.5 w-3.5 data-[state=checked]:bg-gray-500 data-[state=checked]:border-gray-500"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Done</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Col 4: Overdue indicator */}
        <div className="flex justify-center">
          {task.is_overdue && task.status !== 'completed' && (
            <AlertTriangle className="h-3 w-3 text-red-500" />
          )}
        </div>

        {/* Col 5: Job name */}
        <span className="text-xs text-muted-foreground truncate hidden sm:block">
          {task.job_name && task.job_name !== 'Personal Task' ? task.job_name : ''}
        </span>

        {/* Col 6: Role/Trade badges */}
        <div className="hidden md:flex gap-1">
          {task.assigned_role && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 capitalize truncate max-w-[50px]">
              {task.assigned_role}
            </Badge>
          )}
        </div>

        {/* Col 7: Due date */}
        <span className="text-xs text-muted-foreground text-right">
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
          {/* Column headers - matches TaskRow layout */}
          <div className="grid grid-cols-[20px_1fr_90px_16px_140px_60px_60px] gap-1 px-2 py-1 text-[10px] text-muted-foreground font-medium border-b">
            <div></div>
            <div>Task</div>
            <div className="flex items-center gap-1 justify-end">
              <span className="w-3.5 text-center">Start</span>
              <div className="w-[54px]"></div>
              <span className="w-3.5 text-center">Done</span>
            </div>
            <div></div>
            <div className="hidden sm:block">Job</div>
            <div className="hidden md:block">Role</div>
            <div className="text-right">Due</div>
          </div>
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
        <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
