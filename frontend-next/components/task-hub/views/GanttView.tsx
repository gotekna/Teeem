'use client';

import { useMemo } from 'react';
import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { GanttCanvasView } from '@/components/gantt-canvas/GanttCanvasView';
import { GanttTask } from '@/lib/gantt/types';

/**
 * GanttView for Task Hub
 *
 * Uses the standard GanttCanvasView component for consistency.
 * Converts SmTask to GanttTask format and uses static mode.
 */
export function GanttView() {
  const { filteredTasks, expandTask } = useTaskHub();

  // Convert SmTask to GanttTask format
  const ganttTasks: GanttTask[] = useMemo(() => {
    return filteredTasks.map(task => ({
      id: String(task.id),
      name: task.name,
      startDate: new Date(task.start_date),
      endDate: new Date(task.end_date),
      progress: task.progress_percentage || 0,
      status: task.status,
      // Map SmTask fields to GanttTask
      supplierId: task.supplier_id,
      supplierName: task.supplier_name,
      purchaseOrderId: task.purchase_order_id,
      purchaseOrderNumber: task.purchase_order_number,
      poRequired: task.po_required,
      // Store original task data for reference
      rowData: {
        id: task.id,
        name: task.name,
        start_date: task.start_date,
        end_date: task.end_date,
        duration_days: task.duration_days,
        status: task.status,
        assigned_user_id: task.assigned_user_id,
        assigned_user_name: task.assigned_user_name,
        assigned_role: task.assigned_role,
        construction_id: task.construction_id,
        job_name: task.job_name,
      } as any,
    }));
  }, [filteredTasks]);

  // Handle task click - expand the task
  const handleTaskClick = (task: GanttTask) => {
    const taskId = parseInt(task.id, 10);
    if (!isNaN(taskId)) {
      expandTask(taskId);
    }
  };

  if (filteredTasks.length === 0) {
    return (
      <div className="h-[500px] flex items-center justify-center border rounded-lg bg-muted/20">
        <p className="text-sm text-muted-foreground">No tasks to display in Gantt view</p>
      </div>
    );
  }

  return (
    <div className="h-[500px]">
      <GanttCanvasView
        staticTasks={ganttTasks}
        staticDependencies={[]}
        showToolbar={true}
        showFullscreenButton={true}
        onTaskClick={handleTaskClick}
        onTaskDoubleClick={handleTaskClick}
        className="h-full"
      />
    </div>
  );
}

export default GanttView;
