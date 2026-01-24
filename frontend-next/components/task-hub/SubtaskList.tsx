'use client';

/**
 * SubtaskList - Expandable subtask display for parent tasks
 *
 * Shows a collapsed count (e.g., "3 subtasks") that expands to show
 * each subtask's status and assignee.
 *
 * Used in: BoardView (compact=true) and TaskListRow (compact=false)
 */

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type CoreTaskStatus, TASK_STATUS, getStatusColors, getStatusShortLabel } from '@/lib/constants/task-status';

interface Subtask {
  id: number;
  name: string;
  status: CoreTaskStatus;
  assigned_user_id?: number;
  assigned_user_name?: string;
}

interface SubtaskListProps {
  subtasks: Subtask[] | undefined;
  compact?: boolean; // true for BoardView (smaller), false for ListView
}

function StatusBadge({ status }: { status: CoreTaskStatus }) {
  const colors = getStatusColors(status);
  const label = getStatusShortLabel(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[9px] px-1 py-0 h-3.5 shrink-0',
        colors.bg,
        colors.text,
        colors.border
      )}
    >
      {label}
    </Badge>
  );
}

export function SubtaskList({ subtasks, compact = false }: SubtaskListProps) {
  const [expanded, setExpanded] = useState(false);

  if (!subtasks?.length) return null;

  return (
    <div className={cn('mt-1', compact && 'mt-0.5')}>
      {/* Collapsed: clickable count */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className={cn(
          'flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors',
          compact ? 'text-[10px]' : 'text-xs'
        )}
      >
        <ChevronRight
          className={cn(
            'shrink-0 transition-transform',
            compact ? 'h-2.5 w-2.5' : 'h-3 w-3',
            expanded && 'rotate-90'
          )}
        />
        <span>
          {subtasks.length} subtask{subtasks.length > 1 ? 's' : ''}
        </span>
      </button>

      {/* Expanded: subtask rows */}
      {expanded && (
        <div
          className={cn(
            'border-l border-muted-foreground/20',
            compact ? 'pl-2 ml-1 mt-0.5 space-y-0.5' : 'pl-3 ml-1.5 mt-1 space-y-1'
          )}
        >
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className={cn(
                'flex items-center gap-1.5',
                compact ? 'text-[10px]' : 'text-xs'
              )}
            >
              <StatusBadge status={subtask.status} />
              <span
                className={cn(
                  'truncate flex-1',
                  subtask.status === TASK_STATUS.COMPLETED && 'line-through text-muted-foreground'
                )}
              >
                {subtask.name}
              </span>
              {subtask.assigned_user_name && (
                <span className="text-muted-foreground shrink-0 truncate max-w-[80px]">
                  {subtask.assigned_user_name}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
