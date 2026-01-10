'use client';

import { useTaskHub } from '@/contexts/TaskHubContext';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { TaskListRow, TaskListHeader } from '../TaskListRow';

type SortField = 'name' | 'status' | 'start_date' | 'end_date' | 'job_name' | 'trade';
type SortDirection = 'asc' | 'desc';

export function ListView() {
  const {
    filteredTasks,
    selectedTaskIds,
    selectAll,
    deselectAll,
    updateTask,
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

  return (
    <div className="border rounded overflow-hidden">
      {/* Header with sort controls */}
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
        {sortedTasks.map(task => (
          <TaskListRow
            key={task.id}
            task={task}
            editingTaskId={editingTaskId}
            editingTaskName={editingTaskName}
            setEditingTaskId={setEditingTaskId}
            setEditingTaskName={setEditingTaskName}
            onTaskNameSave={handleTaskNameSave}
          />
        ))}

        {sortedTasks.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No tasks found
          </div>
        )}
      </div>
    </div>
  );
}
