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
  Eye,
  Lock,
  ChevronDown,
  ChevronRight,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getTaskRowColorClass, getTaskColorClasses } from '../TaskColorSettings';
import { Input } from '@/components/ui/input';

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
    startTask,
    completeTask,
    setTaskHold,
    confirmTask,
    supplierConfirmTask,
  } = useTaskHub();

  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'start_date',
    direction: 'asc'
  });

  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskName, setEditingTaskName] = useState('');

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

  const handleTaskNameSave = async (taskId: number) => {
    if (editingTaskName.trim() && editingTaskName.trim() !== filteredTasks.find(t => t.id === taskId)?.name) {
      await updateTask(taskId, { name: editingTaskName.trim() });
    }
    setEditingTaskId(null);
    setEditingTaskName('');
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
      <div className="grid grid-cols-[28px_1fr_130px_60px_60px_100px_70px_32px] gap-1 px-2 py-1.5 bg-muted/50 text-[11px] font-medium text-muted-foreground border-b">
        <div>
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => allSelected ? deselectAll() : selectAll()}
            className="h-3.5 w-3.5"
          />
        </div>
        <SortHeader field="name">Task</SortHeader>
        <div className="text-center">Progress</div>
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
                  'grid grid-cols-[28px_1fr_130px_60px_60px_100px_70px_32px] gap-1 px-2 items-center cursor-pointer transition-colors',
                  !isExpanded && 'py-2 text-xs hover:bg-muted/30',
                  !isExpanded && selectedTaskIds.has(task.id) && 'bg-primary/5',
                  !isExpanded && getTaskRowColorClass(task),
                  isExpanded && '!bg-primary/15 dark:!bg-primary/25 border-l-4 !border-primary shadow-xl !py-3 !text-base font-semibold'
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
                  {editingTaskId === task.id ? (
                    <Input
                      value={editingTaskName}
                      onChange={(e) => setEditingTaskName(e.target.value)}
                      onBlur={() => handleTaskNameSave(task.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleTaskNameSave(task.id);
                        } else if (e.key === 'Escape') {
                          setEditingTaskId(null);
                          setEditingTaskName('');
                        }
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 text-xs flex-1"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span
                        className={cn(
                          'truncate cursor-text hover:bg-muted/50 px-1 -mx-1 rounded flex-1',
                          task.status === 'completed' && 'line-through text-muted-foreground',
                          isExpanded && '!font-bold !text-lg'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTaskId(task.id);
                          setEditingTaskName(task.name);
                        }}
                        title="Click to edit task name"
                      >
                        {task.name}
                      </span>
                      {isExpanded && (
                        <Pencil className="h-3 w-3 text-muted-foreground shrink-0 opacity-50" />
                      )}
                    </div>
                  )}
                  {task.is_overdue && task.status !== 'completed' && (
                    <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                  )}
                  {task.locked && (
                    <Lock className="h-3 w-3 text-orange-500 shrink-0" />
                  )}
                  {task.is_following && (
                    <Badge variant="outline" className={cn("h-4 px-1 text-[10px] gap-0.5 shrink-0", getTaskColorClasses('following').text)}>
                      <Eye className="h-2.5 w-2.5" />
                      Following
                    </Badge>
                  )}
                </div>

                {/* Inline Status Checkboxes */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <TooltipProvider delayDuration={300}>
                    {/* Started - always show */}
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

                    {/* PO-only checkboxes */}
                    {task.purchase_order_id && (
                      <>
                        {/* Hold */}
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

                        {/* Confirmed */}
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

                        {/* Supplier */}
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
                    )}

                    {/* Done - always show */}
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
