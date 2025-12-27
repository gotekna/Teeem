'use client';

import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { TaskExpandedRow } from '../TaskExpandedRow';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowUpDown,
  MoreHorizontal,
  Play,
  CheckCircle,
  Pause,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';

const statusColors: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  started: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
};

type SortField = 'name' | 'status' | 'start_date' | 'end_date' | 'job_name' | 'trade';
type SortDirection = 'asc' | 'desc';

export function ListView() {
  const {
    filteredTasks,
    selectedTaskIds,
    toggleTaskSelection,
    selectAll,
    deselectAll,
    updateTask,
    expandedTaskId,
    toggleTaskExpansion,
  } = useTaskHub();

  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'start_date',
    direction: 'asc'
  });

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      let aVal: string | number | Date = '';
      let bVal: string | number | Date = '';

      switch (sort.field) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'status':
          const statusOrder = { not_started: 0, started: 1, completed: 2 };
          aVal = statusOrder[a.status];
          bVal = statusOrder[b.status];
          break;
        case 'start_date':
          aVal = new Date(a.start_date).getTime();
          bVal = new Date(b.start_date).getTime();
          break;
        case 'end_date':
          aVal = new Date(a.end_date).getTime();
          bVal = new Date(b.end_date).getTime();
          break;
        case 'job_name':
          aVal = (a.job_name || '').toLowerCase();
          bVal = (b.job_name || '').toLowerCase();
          break;
        case 'trade':
          aVal = (a.trade || '').toLowerCase();
          bVal = (b.trade || '').toLowerCase();
          break;
      }

      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTasks, sort]);

  const handleSort = (field: SortField) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleStatusChange = async (task: SmTask, newStatus: SmTask['status']) => {
    await updateTask(task.id, { status: newStatus });
  };

  const allSelected = filteredTasks.length > 0 && filteredTasks.every(t => selectedTaskIds.has(t.id));

  const SortHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn('flex items-center gap-0.5 hover:text-foreground', className)}
    >
      {children}
      <ArrowUpDown className={cn('h-3 w-3', sort.field === field && 'text-primary')} />
    </button>
  );

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="border rounded overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[28px_1fr_70px_60px_60px_100px_70px_32px] gap-1 px-2 py-1.5 bg-muted/50 text-[11px] font-medium text-muted-foreground border-b">
        <div>
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => allSelected ? deselectAll() : selectAll()}
            className="h-3.5 w-3.5"
          />
        </div>
        <SortHeader field="name">Task</SortHeader>
        <SortHeader field="status">Status</SortHeader>
        <SortHeader field="start_date">Start</SortHeader>
        <SortHeader field="end_date">End</SortHeader>
        <SortHeader field="job_name">Job</SortHeader>
        <SortHeader field="trade">Trade</SortHeader>
        <div></div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
        {sortedTasks.map(task => {
          const isExpanded = expandedTaskId === task.id;
          return (
            <div key={task.id}>
              <div
                onClick={() => toggleTaskExpansion(task.id)}
                className={cn(
                  'grid grid-cols-[28px_1fr_70px_60px_60px_100px_70px_32px] gap-1 px-2 py-1 items-center text-xs hover:bg-muted/30 cursor-pointer',
                  selectedTaskIds.has(task.id) && 'bg-primary/5',
                  task.is_overdue && task.status !== 'completed' && 'bg-red-50/50 dark:bg-red-950/20',
                  isExpanded && 'bg-muted/50'
                )}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedTaskIds.has(task.id)}
                    onCheckedChange={() => toggleTaskSelection(task.id)}
                    className="h-3.5 w-3.5"
                  />
                </div>

                <div className="flex items-center gap-1 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground">#{task.task_number}</span>
                  <span className={cn('truncate', task.status === 'completed' && 'line-through text-muted-foreground')}>
                    {task.name}
                  </span>
                  {task.is_overdue && task.status !== 'completed' && (
                    <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                  )}
                  {task.locked && (
                    <Lock className="h-3 w-3 text-orange-500 shrink-0" />
                  )}
                </div>

                <div>
                  <Badge className={cn('text-[10px] px-1.5 py-0 h-4', statusColors[task.status])}>
                    {task.status === 'not_started' ? 'todo' : task.status === 'started' ? 'active' : 'done'}
                  </Badge>
                </div>

                <div className="text-[11px] text-muted-foreground">{formatDate(task.start_date)}</div>
                <div className="text-[11px] text-muted-foreground">{formatDate(task.end_date)}</div>

                <div className="text-[11px] text-muted-foreground truncate">
                  {task.job_name && task.job_name !== 'Personal Task' ? task.job_name : '-'}
                </div>

                <div className="text-[11px]">
                  {task.trade ? (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{task.trade}</Badge>
                  ) : '-'}
                </div>

                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs">
                      {task.status !== 'started' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(task, 'started')} className="text-xs">
                          <Play className="h-3 w-3 mr-1.5" />
                          Start
                        </DropdownMenuItem>
                      )}
                      {task.status !== 'completed' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(task, 'completed')} className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1.5" />
                          Complete
                        </DropdownMenuItem>
                      )}
                      {task.status === 'started' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(task, 'not_started')} className="text-xs">
                          <Pause className="h-3 w-3 mr-1.5" />
                          Pause
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {isExpanded && <TaskExpandedRow task={task} />}
            </div>
          );
        })}

        {sortedTasks.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No tasks found
          </div>
        )}
      </div>
    </div>
  );
}
