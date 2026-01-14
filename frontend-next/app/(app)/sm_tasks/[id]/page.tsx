'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TaskHubProvider, useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { TaskFullscreenView } from '@/components/task-hub/TaskFullscreenView';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useSetLayoutMode } from '@/contexts/LayoutModeContext';

function TaskDetailContent() {
  const params = useParams();
  const router = useRouter();
  const taskId = Number(params.id);

  // Fullscreen mode - hides sidebar and breadcrumbs
  useSetLayoutMode('fullscreen');

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
        const response = await api.get<{ success: boolean; sm_task: SmTask }>(`/api/v1/sm_tasks/${taskId}`);
        if (response?.success && response.sm_task) {
          setTask(response.sm_task);
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
    <TaskFullscreenView
      task={task}
      onClose={() => router.back()}
    />
  );
}

export default function TaskDetailPage() {
  return (
    <TaskHubProvider>
      <TaskDetailContent />
    </TaskHubProvider>
  );
}
