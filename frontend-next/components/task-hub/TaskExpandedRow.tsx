'use client';

import { useState } from 'react';
import { SmTask, useTaskHub } from '@/contexts/TaskHubContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { TaskAssignmentInline } from './TaskAssignmentInline';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TaskExpandedRowProps {
  task: SmTask;
  onClose?: () => void;
}

// Status checkbox colors matching Gantt
const statusColors = {
  started: 'data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500',
  hold: 'data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500',
  confirm: 'data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500',
  supplier_confirm: 'data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500',
  completed: 'data-[state=checked]:bg-gray-500 data-[state=checked]:border-gray-500',
};

export function TaskExpandedRow({ task, onClose }: TaskExpandedRowProps) {
  const {
    updateTask,
    startTask,
    completeTask,
    setTaskHold,
    confirmTask,
    supplierConfirmTask,
    collapseTask,
  } = useTaskHub();

  const [loading, setLoading] = useState<string | null>(null);
  const [duration, setDuration] = useState(task.duration_days);
  const [confirmDateOpen, setConfirmDateOpen] = useState(false);
  const [supplierConfirmDateOpen, setSupplierConfirmDateOpen] = useState(false);
  const [selectedConfirmDate, setSelectedConfirmDate] = useState<Date | undefined>(
    task.hold_date ? new Date(task.hold_date) : new Date()
  );
  const [selectedSupplierDate, setSelectedSupplierDate] = useState<Date | undefined>(
    task.hold_date ? new Date(task.hold_date) : new Date()
  );

  // Check if this is a PO task
  const isPOTask = !!task.purchase_order_id;

  // Handler for started checkbox
  const handleStartedChange = async (checked: boolean) => {
    if (loading) return;
    setLoading('started');
    try {
      if (checked) {
        await startTask(task.id);
      } else {
        await updateTask(task.id, { status: 'not_started', started_at: undefined });
      }
    } finally {
      setLoading(null);
    }
  };

  // Handler for hold checkbox
  const handleHoldChange = async (checked: boolean) => {
    if (loading) return;
    setLoading('hold');
    try {
      await setTaskHold(task.id, checked);
    } finally {
      setLoading(null);
    }
  };

  // Handler for confirm - opens date picker first
  const handleConfirmDateSelect = async (date: Date | undefined) => {
    if (!date || loading) return;
    setLoading('confirm');
    try {
      await confirmTask(task.id, format(date, 'yyyy-MM-dd'));
      setConfirmDateOpen(false);
    } finally {
      setLoading(null);
    }
  };

  // Handler for supplier confirm - opens date picker first
  const handleSupplierConfirmDateSelect = async (date: Date | undefined) => {
    if (!date || loading) return;
    setLoading('supplier_confirm');
    try {
      await supplierConfirmTask(task.id, format(date, 'yyyy-MM-dd'));
      setSupplierConfirmDateOpen(false);
    } finally {
      setLoading(null);
    }
  };

  // Handler for completed checkbox
  const handleCompletedChange = async (checked: boolean) => {
    if (loading) return;
    setLoading('completed');
    try {
      if (checked) {
        await completeTask(task.id);
      } else {
        await updateTask(task.id, { status: 'started', completed_at: undefined });
      }
    } finally {
      setLoading(null);
    }
  };

  // Handler for duration change
  const handleDurationSave = async () => {
    if (duration === task.duration_days) return;
    setLoading('duration');
    try {
      await updateTask(task.id, { duration_days: duration });
    } finally {
      setLoading(null);
    }
  };

  // Handler for assignment change
  const handleAssignmentChange = async (userId?: number, role?: string) => {
    setLoading('assign');
    try {
      if (userId) {
        await updateTask(task.id, { assigned_user_id: userId, assigned_role: undefined });
      } else if (role) {
        await updateTask(task.id, { assigned_role: role, assigned_user_id: undefined });
      }
    } finally {
      setLoading(null);
    }
  };

  const handleClose = () => {
    collapseTask();
    onClose?.();
  };

  return (
    <div className="bg-muted/30 border-t border-b px-3 py-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
      {/* Header with close button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Task #{task.task_number}</span>
          {task.is_overdue && task.status !== 'completed' && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 gap-1">
              <AlertTriangle className="h-3 w-3" />
              Overdue
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleClose} className="h-6 px-2">
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Status checkboxes - Only for PO tasks */}
      {isPOTask && (
        <div className="flex flex-wrap items-center gap-4 p-2 bg-background/50 rounded border">
          {/* Started */}
          <div className="flex items-center gap-2">
            <Checkbox
              id={`started-${task.id}`}
              checked={task.status === 'started' || task.status === 'completed'}
              onCheckedChange={handleStartedChange}
              disabled={!!loading || task.status === 'completed'}
              className={cn(statusColors.started)}
            />
            <Label htmlFor={`started-${task.id}`} className="text-xs cursor-pointer">
              Started
            </Label>
            {loading === 'started' && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>

          {/* Hold */}
          <div className="flex items-center gap-2">
            <Checkbox
              id={`hold-${task.id}`}
              checked={task.hold}
              onCheckedChange={handleHoldChange}
              disabled={!!loading}
              className={cn(statusColors.hold)}
            />
            <Label htmlFor={`hold-${task.id}`} className="text-xs cursor-pointer">
              Hold
            </Label>
            {loading === 'hold' && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>

          {/* Confirm with date picker */}
          <div className="flex items-center gap-2">
            <Popover open={confirmDateOpen} onOpenChange={setConfirmDateOpen}>
              <PopoverTrigger asChild>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`confirm-${task.id}`}
                    checked={task.confirm}
                    onCheckedChange={(checked) => {
                      if (checked && !task.confirm) {
                        setConfirmDateOpen(true);
                      } else if (!checked) {
                        updateTask(task.id, { confirm: false });
                      }
                    }}
                    disabled={!!loading}
                    className={cn(statusColors.confirm)}
                  />
                  <Label htmlFor={`confirm-${task.id}`} className="text-xs cursor-pointer">
                    Confirmed
                  </Label>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b">
                  <p className="text-sm font-medium">Select Confirmation Date</p>
                  <p className="text-xs text-muted-foreground">Task will be locked to this date</p>
                </div>
                <Calendar
                  mode="single"
                  selected={selectedConfirmDate}
                  onSelect={(date) => {
                    setSelectedConfirmDate(date);
                    handleConfirmDateSelect(date);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {loading === 'confirm' && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>

          {/* Supplier Confirm with date picker */}
          <div className="flex items-center gap-2">
            <Popover open={supplierConfirmDateOpen} onOpenChange={setSupplierConfirmDateOpen}>
              <PopoverTrigger asChild>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`supplier-confirm-${task.id}`}
                    checked={task.supplier_confirm}
                    onCheckedChange={(checked) => {
                      if (checked && !task.supplier_confirm) {
                        setSupplierConfirmDateOpen(true);
                      } else if (!checked) {
                        updateTask(task.id, { supplier_confirm: false });
                      }
                    }}
                    disabled={!!loading}
                    className={cn(statusColors.supplier_confirm)}
                  />
                  <Label htmlFor={`supplier-confirm-${task.id}`} className="text-xs cursor-pointer">
                    Supplier
                  </Label>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b">
                  <p className="text-sm font-medium">Supplier Confirmation Date</p>
                  <p className="text-xs text-muted-foreground">Date supplier confirmed delivery</p>
                </div>
                <Calendar
                  mode="single"
                  selected={selectedSupplierDate}
                  onSelect={(date) => {
                    setSelectedSupplierDate(date);
                    handleSupplierConfirmDateSelect(date);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {loading === 'supplier_confirm' && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>

          {/* Completed */}
          <div className="flex items-center gap-2">
            <Checkbox
              id={`completed-${task.id}`}
              checked={task.status === 'completed'}
              onCheckedChange={handleCompletedChange}
              disabled={!!loading}
              className={cn(statusColors.completed)}
            />
            <Label htmlFor={`completed-${task.id}`} className="text-xs cursor-pointer">
              Done
            </Label>
            {loading === 'completed' && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
        </div>
      )}

      {/* Duration and Assignment */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Duration */}
        <div className="flex items-center gap-2">
          <Label htmlFor={`duration-${task.id}`} className="text-xs text-muted-foreground">
            Duration
          </Label>
          <Input
            id={`duration-${task.id}`}
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
            onBlur={handleDurationSave}
            onKeyDown={(e) => e.key === 'Enter' && handleDurationSave()}
            className="w-16 h-7 text-xs"
            disabled={!!loading}
          />
          <span className="text-xs text-muted-foreground">days</span>
          {loading === 'duration' && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>

        {/* Assignment */}
        <div className="flex-1 min-w-[200px]">
          <TaskAssignmentInline
            assignedUserId={task.assigned_user_id}
            assignedRole={task.assigned_role}
            onAssign={handleAssignmentChange}
            disabled={!!loading}
            compact
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {/* Open PO button */}
        {task.purchase_order_id && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => window.open(`/purchase_orders/${task.purchase_order_id}`, '_blank')}
          >
            <ExternalLink className="h-3 w-3" />
            Open PO {task.purchase_order_number && `#${task.purchase_order_number}`}
          </Button>
        )}

        {/* View Documents */}
        {task.construction_id > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => window.open(`/jobs/${task.construction_id}/documents`, '_blank')}
          >
            <FileText className="h-3 w-3" />
            Documents
          </Button>
        )}

        {/* Complete button for non-PO tasks */}
        {!isPOTask && task.status !== 'completed' && (
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs gap-1 ml-auto"
            onClick={() => handleCompletedChange(true)}
            disabled={!!loading}
          >
            {loading === 'completed' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              'Mark Complete'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
