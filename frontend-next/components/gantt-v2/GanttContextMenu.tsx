'use client';

/**
 * GanttContextMenu - Right-click context menu for Gantt tasks
 *
 * Appears at cursor position on right-click.
 * Provides quick actions for the selected task.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { GanttTask } from '@/lib/gantt/types';
import {
  Edit,
  Trash2,
  Copy,
  GitBranch,
  ChevronRight,
  ChevronDown,
  PlayCircle,
  PauseCircle,
  CheckCircle,
  MoreHorizontal,
  RotateCcw,
  Link2,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  task: GanttTask | null;
}

export interface GanttContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onEdit?: (task: GanttTask) => void;
  onDelete?: (task: GanttTask) => void;
  onDuplicate?: (task: GanttTask) => void;
  onAddDependency?: (task: GanttTask) => void;
  onEditDependencies?: (task: GanttTask) => void;
  onExpandChildren?: (task: GanttTask) => void;
  onCollapseChildren?: (task: GanttTask) => void;
  onMarkStarted?: (task: GanttTask) => void;
  onMarkOnHold?: (task: GanttTask) => void;
  onMarkCompleted?: (task: GanttTask) => void;
  onResetManualPosition?: (task: GanttTask) => void;
}

// =============================================================================
// Component
// =============================================================================

export function GanttContextMenu({
  state,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  onAddDependency,
  onEditDependencies,
  onExpandChildren,
  onCollapseChildren,
  onMarkStarted,
  onMarkOnHold,
  onMarkCompleted,
  onResetManualPosition,
}: GanttContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    if (!state.isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Use capture to intercept before other handlers
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [state.isOpen, onClose]);

  // Adjust position to stay within viewport
  const [adjustedPosition, setAdjustedPosition] = React.useState({ x: state.x, y: state.y });

  React.useEffect(() => {
    if (!state.isOpen || !menuRef.current) {
      setAdjustedPosition({ x: state.x, y: state.y });
      return;
    }

    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = state.x;
    let y = state.y;

    // Adjust if menu would go off right edge
    if (x + rect.width > viewportWidth - 10) {
      x = viewportWidth - rect.width - 10;
    }

    // Adjust if menu would go off bottom edge
    if (y + rect.height > viewportHeight - 10) {
      y = viewportHeight - rect.height - 10;
    }

    setAdjustedPosition({ x, y });
  }, [state.isOpen, state.x, state.y]);

  if (!state.isOpen) return null;

  const task = state.task;
  // Use record access for rowData since it's a union type
  const rowData = task?.rowData as Record<string, unknown> | undefined;
  const isHeader = rowData?.header_gantt === 'Header' || rowData?.allow_header;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {task ? (
        <>
          {/* Task Name Header */}
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground truncate max-w-[200px]">
            {task.name}
          </div>

          <div className="-mx-1 my-1 h-px bg-border" />

          {/* Edit */}
          {onEdit && (
            <MenuItem
              icon={<Edit className="h-4 w-4" />}
              label="Edit Task"
              shortcut="Enter"
              onClick={() => handleAction(() => onEdit(task))}
            />
          )}

          {/* Duplicate */}
          {onDuplicate && (
            <MenuItem
              icon={<Copy className="h-4 w-4" />}
              label="Duplicate"
              onClick={() => handleAction(() => onDuplicate(task))}
            />
          )}

          {/* Add Dependency */}
          {onAddDependency && (
            <MenuItem
              icon={<GitBranch className="h-4 w-4" />}
              label="Add Dependency"
              onClick={() => handleAction(() => onAddDependency(task))}
            />
          )}

          {/* Edit Dependencies */}
          {onEditDependencies && (
            <MenuItem
              icon={<Link2 className="h-4 w-4" />}
              label="Edit Dependencies"
              onClick={() => handleAction(() => onEditDependencies(task))}
            />
          )}

          <div className="-mx-1 my-1 h-px bg-border" />

          {/* Status Actions */}
          {onMarkStarted && (
            <MenuItem
              icon={<PlayCircle className="h-4 w-4" />}
              label={rowData?.started ? 'Mark Not Started' : 'Mark Started'}
              onClick={() => handleAction(() => onMarkStarted(task))}
            />
          )}

          {onMarkOnHold && (
            <MenuItem
              icon={<PauseCircle className="h-4 w-4" />}
              label={rowData?.hold ? 'Remove Hold' : 'Put on Hold'}
              onClick={() => handleAction(() => onMarkOnHold(task))}
            />
          )}

          {onMarkCompleted && (
            <MenuItem
              icon={<CheckCircle className="h-4 w-4" />}
              label={rowData?.is_completed ? 'Mark Incomplete' : 'Mark Completed'}
              onClick={() => handleAction(() => onMarkCompleted(task))}
            />
          )}

          {/* Reset Manual Position - only show if task has hold or hold_date */}
          {onResetManualPosition && (rowData?.hold || rowData?.hold_date) && (
            <MenuItem
              icon={<RotateCcw className="h-4 w-4" />}
              label="Reset Manual Position"
              onClick={() => handleAction(() => onResetManualPosition(task))}
            />
          )}

          {/* Header-specific actions */}
          {isHeader && (onExpandChildren || onCollapseChildren) && (
            <>
              <div className="-mx-1 my-1 h-px bg-border" />

              {onExpandChildren && (
                <MenuItem
                  icon={<ChevronDown className="h-4 w-4" />}
                  label="Expand Children"
                  onClick={() => handleAction(() => onExpandChildren(task))}
                />
              )}

              {onCollapseChildren && (
                <MenuItem
                  icon={<ChevronRight className="h-4 w-4" />}
                  label="Collapse Children"
                  onClick={() => handleAction(() => onCollapseChildren(task))}
                />
              )}
            </>
          )}

          <div className="-mx-1 my-1 h-px bg-border" />

          {/* Delete */}
          {onDelete && (
            <MenuItem
              icon={<Trash2 className="h-4 w-4" />}
              label="Delete Task"
              variant="destructive"
              onClick={() => handleAction(() => onDelete(task))}
            />
          )}
        </>
      ) : (
        /* No task selected - show general actions */
        <>
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Gantt Chart
          </div>

          <div className="-mx-1 my-1 h-px bg-border" />

          <MenuItem
            icon={<MoreHorizontal className="h-4 w-4" />}
            label="No task selected"
            disabled
            onClick={() => {}}
          />
        </>
      )}
    </div>
  );
}

// =============================================================================
// MenuItem Component
// =============================================================================

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  onClick: () => void;
}

function MenuItem({ icon, label, shortcut, variant = 'default', disabled, onClick }: MenuItemProps) {
  return (
    <button
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
        variant === 'destructive'
          ? 'text-destructive focus:bg-destructive/10 focus:text-destructive'
          : 'focus:bg-accent focus:text-accent-foreground',
        disabled && 'pointer-events-none opacity-50'
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="mr-2 text-muted-foreground">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="ml-auto text-xs tracking-widest text-muted-foreground">
          {shortcut}
        </span>
      )}
    </button>
  );
}

export default GanttContextMenu;
