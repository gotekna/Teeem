'use client';

import { useRouter } from 'next/navigation';
import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaskExpandedRow } from './TaskExpandedRow';
import { SubtaskList } from './SubtaskList';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  Lock,
  Mail,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getTaskRowColorClass, getTaskColorClasses } from './TaskColorSettings';
import { formatDateShort } from '@/utils/formatters';

export interface TaskListRowProps {
  task: SmTask;
  editingTaskId: number | null;
  editingTaskName: string;
  setEditingTaskId: (id: number | null) => void;
  setEditingTaskName: (name: string) => void;
  onTaskNameSave: (taskId: number) => void;
}

export function TaskListRow({
  task,
  editingTaskId,
  editingTaskName,
  setEditingTaskId,
  setEditingTaskName,
  onTaskNameSave,
}: TaskListRowProps) {
  const router = useRouter();
  const { user } = useAuth();
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

  // Show subtasks if user owns parent OR follows parent
  const showSubtasks = task.children && task.children.length > 0 &&
    (task.is_following || task.assigned_user_id === user?.id);

  // Unread email count for task card indicator (SSoT from backend)
  const unreadEmailCount = task.unread_email_count || 0;

  const handleRowClick = () => {
    toggleTaskExpansion(task.id);
  };

  const handleRowDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Open task in new tab on double-click (user preference)
    window.open(`/sm_tasks/${task.id}`, '_blank');
  };

  const handleStatusChange = async (newStatus: SmTask['status']) => {
    await updateTask(task.id, { status: newStatus });
  };

  return (
    <div>
      <div
        onClick={handleRowClick}
        onDoubleClick={handleRowDoubleClick}
        className={cn(
          'grid grid-cols-[28px_1fr_180px_60px_60px_100px_70px_32px] gap-1 px-2 py-2 text-xs items-center cursor-pointer transition-colors',
          !isExpanded && 'hover:bg-muted/30',
          !isExpanded && selectedTaskIds.has(task.id) && 'bg-primary/5',
          !isExpanded && getTaskRowColorClass(task),
          isExpanded && 'border-l-4 border-primary bg-muted'
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
          <span className="font-mono text-xs text-muted-foreground">#{task.task_number}</span>
          {editingTaskId === task.id ? (
            <Input
              value={editingTaskName}
              onChange={(e) => setEditingTaskName(e.target.value)}
              onBlur={() => onTaskNameSave(task.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onTaskNameSave(task.id);
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
                  'truncate flex-1',
                  task.status === 'completed' && 'line-through text-muted-foreground'
                )}
              >
                {task.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTaskId(task.id);
                  setEditingTaskName(task.name);
                }}
                className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground shrink-0"
                title="Edit task name"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
          {/* Unread email indicator - iOS-style mail icon with badge */}
          {unreadEmailCount > 0 && (
            <div className="relative shrink-0" title={`${unreadEmailCount} unread email${unreadEmailCount > 1 ? 's' : ''}`}>
              <Mail className="h-4 w-4 text-blue-500 fill-blue-500" />
              <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5">
                {unreadEmailCount > 99 ? '99+' : unreadEmailCount}
              </span>
            </div>
          )}
          {task.is_overdue && task.status !== 'completed' && (
            <Badge variant="destructive" className="h-4 px-1 text-[10px] gap-0.5 shrink-0">
              <AlertTriangle className="h-2.5 w-2.5" />
              {task.days_overdue ? `${task.days_overdue}d` : 'Overdue'}
            </Badge>
          )}
          {task.locked && (
            <Lock className="h-3 w-3 text-orange-500 dark:text-orange-400 shrink-0" />
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
                    checked={task.status === 'started' || task.status === 'waiting_for_response' || task.status === 'waiting_for_info' || task.status === 'completed'}
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

            {/* Waiting for Response - always show */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Checkbox
                    checked={task.status === 'waiting_for_response'}
                    onCheckedChange={(checked) => {
                      if (checked) updateTask(task.id, { status: 'waiting_for_response' });
                      else updateTask(task.id, { status: 'started' });
                    }}
                    disabled={task.status === 'completed' || task.status === 'not_started'}
                    className="h-3.5 w-3.5 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Waiting for Response</TooltipContent>
            </Tooltip>

            {/* Waiting for More Info - always show */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Checkbox
                    checked={task.status === 'waiting_for_info'}
                    onCheckedChange={(checked) => {
                      if (checked) updateTask(task.id, { status: 'waiting_for_info' });
                      else updateTask(task.id, { status: 'started' });
                    }}
                    disabled={task.status === 'completed' || task.status === 'not_started'}
                    className="h-3.5 w-3.5 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Waiting for More Info</TooltipContent>
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
                    className="h-3.5 w-3.5 data-[state=checked]:bg-muted0 data-[state=checked]:border-border"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Done</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="text-xs text-muted-foreground">{formatDateShort(task.start_date)}</div>
        <div className="text-xs text-muted-foreground">{formatDateShort(task.end_date)}</div>

        <div className="text-xs text-muted-foreground truncate">
          {task.job_name && task.job_name !== 'Personal Task' ? task.job_name : '-'}
        </div>

        <div className="text-xs">
          {task.trade ? (
            <Badge variant="outline" className="text-xs px-1 py-0 h-4">{task.trade}</Badge>
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
                <DropdownMenuItem onClick={() => handleStatusChange('started')} className="text-xs">
                  <Play className="h-3 w-3 mr-1.5" />
                  Start
                </DropdownMenuItem>
              )}
              {task.status !== 'completed' && (
                <DropdownMenuItem onClick={() => handleStatusChange('completed')} className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1.5" />
                  Complete
                </DropdownMenuItem>
              )}
              {task.status === 'started' && (
                <DropdownMenuItem onClick={() => handleStatusChange('not_started')} className="text-xs">
                  <Pause className="h-3 w-3 mr-1.5" />
                  Pause
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Subtasks section - shows when user owns or follows parent */}
      {showSubtasks && !isExpanded && (
        <div className="pl-8 pr-2 pb-1">
          <SubtaskList subtasks={task.children} compact={false} />
        </div>
      )}

      {isExpanded && <TaskExpandedRow task={task} />}
    </div>
  );
}

export function TaskListHeader() {
  return (
    <div className="grid grid-cols-[28px_1fr_180px_60px_60px_100px_70px_32px] gap-1 px-2 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
      <div></div>
      <div>Task</div>
      <div className="text-center">Progress</div>
      <div>Start</div>
      <div>End</div>
      <div>Job</div>
      <div>Trade</div>
      <div></div>
    </div>
  );
}
