'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TaskHubProvider, useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { TaskExpandedRow } from '@/components/task-hub/TaskExpandedRow';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

function TaskDetailContent() {
  const params = useParams();
  const router = useRouter();
  const taskId = Number(params.id);

  const { tasks, expandTask, loading: contextLoading } = useTaskHub();
  const [task, setTask] = useState<SmTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Try to find task in context first, otherwise fetch directly
  useEffect(() => {
    const findOrFetchTask = async () => {
      setLoading(true);
      setError(null);

      // First check if task exists in context
      const contextTask = tasks.find((t: SmTask) => t.id === taskId);
      if (contextTask) {
        setTask(contextTask);
        expandTask(taskId);
        setLoading(false);
        return;
      }

      // If context is still loading, wait
      if (contextLoading) {
        return;
      }

      // Task not in context, fetch directly
      try {
        const response = await api.get<{ success: boolean; task: SmTask }>(`/api/v1/sm_tasks/${taskId}`);
        if (response?.success && response.task) {
          setTask(response.task);
        } else {
          setError('Task not found');
        }
      } catch (err) {
        console.error('Failed to fetch task:', err);
        setError('Failed to load task');
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      findOrFetchTask();
    }
  }, [taskId, tasks, contextLoading, expandTask]);

  // Update task when context refreshes
  useEffect(() => {
    if (task && !contextLoading) {
      const updatedTask = tasks.find((t: SmTask) => t.id === taskId);
      if (updatedTask) {
        setTask(updatedTask);
      }
    }
  }, [tasks, taskId, task, contextLoading]);

  if (loading || contextLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">{error || 'Task not found'}</p>
        <Button variant="outline" onClick={() => router.push('/tasks')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/tasks')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>

        {/* Quick links */}
        <div className="flex items-center gap-2">
          {task.construction_id > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/jobs/${task.construction_id}`, '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open Job
            </Button>
          )}
          {task.purchase_order_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/purchase_orders/${task.purchase_order_id}`, '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open PO
            </Button>
          )}
        </div>
      </div>

      {/* Task Detail - Full Width */}
      <div className="bg-background rounded-lg border shadow-sm">
        <TaskExpandedRow
          task={task}
          onClose={() => router.push('/tasks')}
        />
      </div>
    </div>
  );
}

export default function TaskDetailPage() {
  return (
    <TaskHubProvider>
      <TaskDetailContent />
    </TaskHubProvider>
  );
}
