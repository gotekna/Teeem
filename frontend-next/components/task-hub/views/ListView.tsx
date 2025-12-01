'use client';

import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowUpDown,
  MoreHorizontal,
  Play,
  CheckCircle,
  Pause,
  ExternalLink,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';

const statusColors: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400',
  started: 'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400',
};

type SortField = 'name' | 'status' | 'start_date' | 'end_date' | 'job_name' | 'trade';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export function ListView() {
  const {
    filteredTasks,
    selectedTaskIds,
    toggleTaskSelection,
    selectAll,
    deselectAll,
    updateTask,
  } = useTaskHub();

  const [sort, setSort] = useState<SortConfig>({ field: 'start_date', direction: 'asc' });

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
          aVal = a.status;
          bVal = b.status;
          break;
        case 'start_date':
          aVal = new Date(a.start_date);
          bVal = new Date(b.start_date);
          break;
        case 'end_date':
          aVal = new Date(a.end_date);
          bVal = new Date(b.end_date);
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
  const someSelected = filteredTasks.some(t => selectedTaskIds.has(t.id));

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className={cn(
        'h-3 w-3',
        sort.field === field && 'text-primary'
      )} />
    </button>
  );

  return (
    <Card>
      <CardContent className="p-0">
        {/* Table Header */}
        <div className="grid grid-cols-[40px_1fr_120px_100px_100px_120px_100px_60px_50px] gap-2 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
          <div>
            <Checkbox
              checked={allSelected}
              onCheckedChange={() => allSelected ? deselectAll() : selectAll()}
              className={someSelected && !allSelected ? 'data-[state=checked]:bg-primary/50' : ''}
            />
          </div>
          <SortableHeader field="name">Task</SortableHeader>
          <SortableHeader field="status">Status</SortableHeader>
          <SortableHeader field="start_date">Start</SortableHeader>
          <SortableHeader field="end_date">End</SortableHeader>
          <SortableHeader field="job_name">Job</SortableHeader>
          <SortableHeader field="trade">Trade</SortableHeader>
          <div>Assignee</div>
          <div></div>
        </div>

        {/* Table Body */}
        <div className="divide-y">
          {sortedTasks.map(task => (
            <div
              key={task.id}
              className={cn(
                'grid grid-cols-[40px_1fr_120px_100px_100px_120px_100px_60px_50px] gap-2 px-4 py-3 items-center hover:bg-muted/30 transition-colors',
                selectedTaskIds.has(task.id) && 'bg-primary/5',
                task.is_overdue && task.status !== 'completed' && 'bg-red-50/50 dark:bg-red-900/10'
              )}
            >
              <div>
                <Checkbox
                  checked={selectedTaskIds.has(task.id)}
                  onCheckedChange={() => toggleTaskSelection(task.id)}
                />
              </div>

              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-muted-foreground">
                  #{task.task_number}
                </span>
                <span className={cn(
                  'truncate',
                  task.status === 'completed' && 'line-through text-muted-foreground'
                )}>
                  {task.name}
                </span>
                {task.is_overdue && task.status !== 'completed' && (
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                )}
                {task.locked && (
                  <Lock className="h-4 w-4 text-orange-500 shrink-0" />
                )}
              </div>

              <div>
                <Badge className={statusColors[task.status]}>
                  {task.status.replace('_', ' ')}
                </Badge>
              </div>

              <div className="text-sm">
                {new Date(task.start_date).toLocaleDateString()}
              </div>

              <div className="text-sm">
                {new Date(task.end_date).toLocaleDateString()}
              </div>

              <div className="text-sm truncate text-muted-foreground">
                {task.job_name || '-'}
              </div>

              <div className="text-sm">
                {task.trade ? (
                  <Badge variant="outline" className="text-xs">
                    {task.trade}
                  </Badge>
                ) : '-'}
              </div>

              <div>
                {task.assigned_user_name ? (
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">
                      {task.assigned_user_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>

              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {task.status !== 'started' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(task, 'started')}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Task
                      </DropdownMenuItem>
                    )}
                    {task.status !== 'completed' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(task, 'completed')}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark Complete
                      </DropdownMenuItem>
                    )}
                    {task.status === 'started' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(task, 'not_started')}>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause Task
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View in Gantt
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}

          {sortedTasks.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No tasks found matching your filters
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
