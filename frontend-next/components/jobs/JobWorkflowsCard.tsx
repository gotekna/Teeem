'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import {
  Workflow,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  XCircle,
  MoreVertical,
  Pause,
  Play,
  X,
} from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from "@/components/ui/spinner";

interface WorkflowInstance {
  id: number;
  status: 'active' | 'completed' | 'cancelled' | 'error' | 'suspended';
  started_at: string;
  completed_at?: string;
  process_name: string;
  process_id: number;
  current_node?: string;
  progress: number;
  pending_tasks: number;
}

interface JobWorkflowsCardProps {
  jobId: number;
}

export function JobWorkflowsCard({ jobId }: JobWorkflowsCardProps) {
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadInstances = useCallback(async () => {
    try {
      const response = await api.get<{ instances: WorkflowInstance[]; success: boolean }>(
        `/api/v1/bpmn_process_instances/for_subject?subject_type=Job&subject_id=${jobId}`
      );
      if (response.success) {
        setInstances(response.instances || []);
      }
    } catch (err) {
      console.error('Failed to load workflow instances:', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const handleCancel = async (instanceId: number) => {
    try {
      await api.post(`/api/v1/bpmn_process_instances/${instanceId}/cancel`, {
        reason: 'Cancelled by user',
      });
      toast({ title: 'Workflow cancelled' });
      loadInstances();
    } catch (err) {
      console.error('Failed to cancel workflow:', err);
      toast({ title: 'Failed to cancel workflow', variant: 'destructive' });
    }
  };

  const handleSuspend = async (instanceId: number) => {
    try {
      await api.post(`/api/v1/bpmn_process_instances/${instanceId}/suspend`);
      toast({ title: 'Workflow suspended' });
      loadInstances();
    } catch (err) {
      console.error('Failed to suspend workflow:', err);
      toast({ title: 'Failed to suspend workflow', variant: 'destructive' });
    }
  };

  const handleResume = async (instanceId: number) => {
    try {
      await api.post(`/api/v1/bpmn_process_instances/${instanceId}/resume`);
      toast({ title: 'Workflow resumed' });
      loadInstances();
    } catch (err) {
      console.error('Failed to resume workflow:', err);
      toast({ title: 'Failed to resume workflow', variant: 'destructive' });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'suspended':
        return <Pause className="h-4 w-4 text-orange-500" />;
      default:
        return <Workflow className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-blue-500 text-xs">Active</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500 text-xs">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="text-xs">Cancelled</Badge>;
      case 'error':
        return <Badge variant="destructive" className="text-xs">Error</Badge>;
      case 'suspended':
        return <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Suspended</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Workflows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Spinner size={20} className="text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeInstances = instances.filter(i => i.status === 'active');
  const suspendedInstances = instances.filter(i => i.status === 'suspended');
  const completedInstances = instances.filter(i => i.status === 'completed');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Workflow className="h-5 w-5" />
          Workflows
          {activeInstances.length > 0 && (
            <Badge variant="default" className="bg-blue-500 ml-2">
              {activeInstances.length} active
            </Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={loadInstances} className="h-8 w-8 p-0">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {instances.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No workflows started for this job yet.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Active workflows */}
            {activeInstances.map((instance) => (
              <div
                key={instance.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-blue-50/50 border-blue-100"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(instance.status)}
                  <div>
                    <p className="font-medium text-sm">{instance.process_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {instance.current_node && (
                        <span>At: {instance.current_node} • </span>
                      )}
                      {instance.pending_tasks > 0 && (
                        <span className="text-blue-600">{instance.pending_tasks} pending task{instance.pending_tasks !== 1 ? 's' : ''} • </span>
                      )}
                      Started {formatDistanceToNow(new Date(instance.started_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(instance.status)}
                  <Link href="/tasks?tab=workflow">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleSuspend(instance.id)}>
                        <Pause className="h-4 w-4 mr-2" />
                        Suspend
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleCancel(instance.id)}
                        className="text-destructive"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}

            {/* Suspended workflows */}
            {suspendedInstances.map((instance) => (
              <div
                key={instance.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-orange-50/50 border-orange-100"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(instance.status)}
                  <div>
                    <p className="font-medium text-sm">{instance.process_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Suspended • Started {formatDistanceToNow(new Date(instance.started_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(instance.status)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleResume(instance.id)}>
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleCancel(instance.id)}
                        className="text-destructive"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}

            {/* Completed workflows (collapsed) */}
            {completedInstances.length > 0 && (
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {completedInstances.length} completed workflow{completedInstances.length !== 1 ? 's' : ''}
                </summary>
                <div className="mt-2 space-y-2 pl-6">
                  {completedInstances.slice(0, 5).map((instance) => (
                    <div
                      key={instance.id}
                      className="flex items-center justify-between p-2 border rounded-lg text-sm"
                    >
                      <div>
                        <p className="font-medium">{instance.process_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Completed {formatDistanceToNow(new Date(instance.completed_at!), { addSuffix: true })}
                        </p>
                      </div>
                      {getStatusBadge(instance.status)}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
