'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { TaskHubProvider, useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { TaskFullscreenView } from '@/components/task-hub/TaskFullscreenView';
import { Spinner } from '@/components/ui/spinner';
import { BackButton, getParentRoute } from '@/components/ui/back-button';
import { api } from '@/lib/api';
import { useSetLayoutMode } from '@/contexts/LayoutModeContext';

function TaskDetailContent() {
  const params = useParams();
  const taskId = Number(params.id);

  // Fullscreen mode - hides sidebar and breadcrumbs
  useSetLayoutMode('fullscreen');

  const { tasks, expandTask, loading: contextLoading } = useTaskHub();
  const [task, setTask] = useState<SmTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch task directly - don't wait for full context to load
  // FRC (Jan 2026): Was waiting for ALL tasks to load via contextLoading before showing
  // anything, causing long white screen times. Now fetches single task immediately.
  useEffect(() => {
    const fetchTask = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get<{ success: boolean; sm_task: SmTask }>(`/api/v1/sm_tasks/${taskId}`);
        if (response?.success && response.sm_task) {
          setTask(response.sm_task);
          expandTask(taskId);
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
      fetchTask();
    }
  }, [taskId, expandTask]);

  // Update task when context refreshes (index endpoint data)
  // ⚠️ DO NOT SIMPLIFY - Index vs Show data mismatch (Feb 2026)
  // ════════════════════════════════════════════════════════════
  // Why: Index endpoint returns attachments: [] and simplified action_items
  //      for performance. Show endpoint returns full data. If we blindly
  //      overwrite, attachments/emails disappear (shows "Emails 0").
  // ❌ WRONG: setTask(updatedTask) — overwrites full show data with stripped index data
  // ✅ CORRECT: Merge scalar fields from index, keep detailed nested data from show
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    if (task && !contextLoading) {
      const updatedTask = tasks.find((t: SmTask) => t.id === taskId);
      if (updatedTask) {
        setTask(prev => {
          if (!prev) return updatedTask;
          return {
            ...prev,
            ...updatedTask,
            // Preserve detailed data from show endpoint when index returns empty/simplified
            attachments: (updatedTask.attachments?.length ?? 0) > 0 ? updatedTask.attachments : prev.attachments,
            action_items: (prev.action_items?.length || 0) > (updatedTask.action_items?.length || 0)
              ? prev.action_items
              : updatedTask.action_items,
          };
        });
      }
    }
  }, [tasks, taskId, task, contextLoading]);

  if (loading) {
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
        <BackButton fallbackHref="/tasks" />
      </div>
    );
  }

  return (
    <TaskFullscreenView
      task={task}
      onClose={() => {
        // SSoT: Use BackButton's getParentRoute helper for consistent navigation
        const hasHistory = typeof window !== "undefined" && window.history.length > 2;
        if (hasHistory) {
          window.history.back();
        } else {
          window.location.href = getParentRoute(window.location.pathname);
        }
      }}
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
