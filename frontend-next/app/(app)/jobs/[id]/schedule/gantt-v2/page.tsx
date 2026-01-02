'use client';

/**
 * Gantt V2 Test Page
 *
 * This page allows side-by-side comparison of the new unified Gantt chart
 * with the old implementation. Both can be viewed in separate browser tabs.
 *
 * URLs:
 * - /jobs/{id}/schedule         → Old Gantt (current implementation)
 * - /jobs/{id}/schedule/gantt-v2 → New Gantt (unified canvas)
 *
 * @see TEEEM_DOCS/GANTT_FEATURE_INVENTORY.md - Feature checklist
 */

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/back-button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';
import { GanttUnified } from '@/components/gantt-v2/GanttUnified';
import { api } from '@/lib/api';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { GanttTask, GanttDependency, SmScheduleMaster } from '@/lib/gantt/types';
import { convertRowsToTasks } from '@/lib/gantt/types';
import { getTodayInCompanyTimezone } from '@/lib/stores/company-settings-store';

// =============================================================================
// Types
// =============================================================================

interface Job {
  id: number;
  name: string;
  title: string;
}

interface GanttDataResponse {
  rows: SmScheduleMaster[];
  dependencies: Array<{
    id: string;
    from_id: string;
    to_id: string;
    type: 'FS' | 'SS' | 'FF' | 'SF';
    lag?: number;
  }>;
}

// =============================================================================
// Page Component
// =============================================================================

export default function GanttV2Page() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const jobId = Number(params.id);

  // State
  const [job, setJob] = React.useState<Job | null>(null);
  const [tasks, setTasks] = React.useState<GanttTask[]>([]);
  const [dependencies, setDependencies] = React.useState<GanttDependency[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // ==========================================================================
  // Data Loading
  // ==========================================================================

  React.useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch job details
        const jobResponse = await api.get<Job>(`/api/v1/jobs/${jobId}`);
        if (jobResponse) {
          setJob(jobResponse);
        }

        // Fetch Gantt data
        const ganttResponse = await api.get<GanttDataResponse>(
          `/api/v1/jobs/${jobId}/sm_tasks/gantt_data`
        );

        if (ganttResponse) {
          // Debug: log response structure
          console.log('[GanttV2] API response:', ganttResponse);

          // API returns {success: true, gantt_data: {tasks: [...], dependencies: [...]}}
          // Note: Backend uses "tasks", not "rows"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = (ganttResponse as any).gantt_data || ganttResponse;
          const rows = data.tasks || data.rows || [];
          const deps = data.dependencies || [];

          console.log('[GanttV2] Tasks:', rows.length, 'Dependencies:', deps.length);

          const today = getTodayInCompanyTimezone();
          const convertedTasks = convertRowsToTasks(rows as SmScheduleMaster[], today);
          setTasks(convertedTasks);

          // Convert dependencies
          const convertedDeps: GanttDependency[] = deps.map((dep: { id: string; from_id: string; to_id: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag?: number }) => ({
            id: dep.id,
            fromId: dep.from_id,
            toId: dep.to_id,
            type: dep.type,
            lag: dep.lag,
          }));
          setDependencies(convertedDeps);
        }
      } catch (err) {
        console.error('[GanttV2] Failed to load data:', err);
        setError('Failed to load Gantt data');
        toast({
          title: 'Error',
          description: 'Failed to load Gantt data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    if (jobId) {
      loadData();
    }
  }, [jobId, toast]);

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  const handleTaskClick = (task: GanttTask) => {
    console.log('[GanttV2] Task clicked:', task);
    toast({
      title: 'Task Selected',
      description: task.name,
    });
  };

  const handleTaskDoubleClick = (task: GanttTask) => {
    console.log('[GanttV2] Task double-clicked:', task);
    toast({
      title: 'Task Edit',
      description: `Would open editor for: ${task.name}`,
    });
  };

  const handleCheckboxToggle = (taskId: string, field: string, checked: boolean) => {
    console.log('[GanttV2] Checkbox toggled:', { taskId, field, checked });

    // Update local state optimistically
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId && task.rowData) {
          return {
            ...task,
            rowData: {
              ...task.rowData,
              [field]: checked,
            },
          };
        }
        return task;
      })
    );

    toast({
      title: 'Status Updated',
      description: `${field} ${checked ? 'checked' : 'unchecked'}`,
    });
  };

  const handleOpenOldGantt = () => {
    window.open(`/jobs/${jobId}/schedule`, '_blank');
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header job={job} onOpenOldGantt={handleOpenOldGantt} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-sm text-muted-foreground">Loading Gantt V2...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header job={job} onOpenOldGantt={handleOpenOldGantt} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => router.refresh()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header job={job} onOpenOldGantt={handleOpenOldGantt} />

      {/* Gantt Chart */}
      <div className="flex-1 min-h-0">
        <GanttUnified
          tasks={tasks}
          dependencies={dependencies}
          jobId={jobId}
          showToolbar={true}
          onTaskClick={handleTaskClick}
          onTaskDoubleClick={handleTaskDoubleClick}
          onCheckboxToggle={handleCheckboxToggle}
        />
      </div>

      {/* Debug Info */}
      <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <span className="font-medium">Gantt V2 (Development)</span>
        {' | '}
        {tasks.length} tasks, {dependencies.length} dependencies
        {' | '}
        <a
          href={`/jobs/${jobId}/schedule`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          Compare with old Gantt
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// Header Component
// =============================================================================

interface HeaderProps {
  job: Job | null;
  onOpenOldGantt: () => void;
}

function Header({ job, onOpenOldGantt }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-lg font-semibold">
            Gantt V2 {job ? `- ${job.name || job.title}` : ''}
          </h1>
          <p className="text-xs text-muted-foreground">
            Unified Canvas Architecture (Development Preview)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onOpenOldGantt}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Compare with Old Gantt
        </Button>
      </div>
    </div>
  );
}
