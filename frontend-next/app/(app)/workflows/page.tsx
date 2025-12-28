'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUrlTabs } from '@/hooks/useUrlTabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import {
  Workflow,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  Pause,
  ListTodo,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  Calendar,
  Building,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { WorkflowProgress } from '@/components/workflows/WorkflowProgress';

interface WorkflowStats {
  active_instances: number;
  pending_tasks: number;
  completed_today: number;
  overdue_tasks: number;
}

interface WorkflowInstance {
  id: number;
  status: string;
  process_name: string;
  subject_type: string;
  subject_id: number;
  subject_name: string;
  current_node?: string;
  pending_tasks: number;
  started_at: string;
  progress: number;
}

interface BpmnTask {
  id: number;
  node_name: string;
  status: string;
  process_name: string;
  instance_id: number;
  subject_name: string;
  due_date: string | null;
  is_overdue: boolean;
  created_at: string;
}

interface BpmnProcess {
  id: number;
  name: string;
  description?: string;
  is_published: boolean;
}

export default function WorkflowsDashboardPage() {
  const [activeTab, setActiveTab] = useUrlTabs("tasks");
  const [stats, setStats] = useState<WorkflowStats>({
    active_instances: 0,
    pending_tasks: 0,
    completed_today: 0,
    overdue_tasks: 0,
  });
  const [activeInstances, setActiveInstances] = useState<WorkflowInstance[]>([]);
  const [myTasks, setMyTasks] = useState<BpmnTask[]>([]);
  const [processes, setProcesses] = useState<BpmnProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load all data in parallel
      const [instancesRes, tasksRes, processesRes] = await Promise.all([
        api.get<{ instances: WorkflowInstance[]; success: boolean }>('/api/v1/bpmn_process_instances?status=active&limit=10'),
        api.get<{ tasks: BpmnTask[]; success: boolean; total: number }>('/api/v1/bpmn_tasks'),
        api.get<{ processes: BpmnProcess[] }>('/api/v1/bpmn_processes'),
      ]);

      if (instancesRes?.success) {
        setActiveInstances(instancesRes.instances || []);
      }

      if (tasksRes?.success) {
        setMyTasks(tasksRes.tasks || []);
        const overdue = (tasksRes.tasks || []).filter(t => t.is_overdue).length;
        setStats(prev => ({
          ...prev,
          pending_tasks: tasksRes.total || 0,
          overdue_tasks: overdue,
        }));
      }

      if (processesRes?.processes) {
        setProcesses(processesRes.processes.filter(p => p.is_published));
      }

      // Get active instance count
      setStats(prev => ({
        ...prev,
        active_instances: instancesRes?.instances?.length || 0,
      }));

    } catch (err) {
      console.error('Failed to load workflow data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">Monitor and manage workflow executions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/workflows/processes">
            <Button size="sm">
              <Workflow className="h-4 w-4 mr-2" />
              Manage Processes
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Active Workflows</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.active_instances}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Pending Tasks</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.pending_tasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Overdue</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.overdue_tasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Available Processes</span>
            </div>
            <p className="text-2xl font-bold mt-1">{processes.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks" className="gap-2">
            <ListTodo className="h-4 w-4" />
            My Tasks
            {myTasks.length > 0 && (
              <Badge variant="secondary" className="ml-1">{myTasks.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-2">
            <Play className="h-4 w-4" />
            Active Workflows
            {activeInstances.length > 0 && (
              <Badge variant="secondary" className="ml-1">{activeInstances.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="processes" className="gap-2">
            <Workflow className="h-4 w-4" />
            Processes
          </TabsTrigger>
        </TabsList>

        {/* My Tasks Tab */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Pending Tasks</CardTitle>
              <CardDescription>Tasks waiting for your action</CardDescription>
            </CardHeader>
            <CardContent>
              {myTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                  <p className="font-medium">All caught up!</p>
                  <p className="text-sm text-muted-foreground">No pending workflow tasks</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        task.is_overdue ? 'border-red-200 bg-red-50/50' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          task.is_overdue ? 'bg-red-100' : 'bg-blue-100'
                        }`}>
                          <ListTodo className={`h-4 w-4 ${
                            task.is_overdue ? 'text-red-600' : 'text-blue-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium">{task.node_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {task.process_name} • {task.subject_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                            {task.due_date && (
                              <>
                                <span>•</span>
                                <Calendar className="h-3 w-3" />
                                Due {new Date(task.due_date).toLocaleDateString()}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.is_overdue && (
                          <Badge variant="destructive">Overdue</Badge>
                        )}
                        <Link href={`/tasks?tab=workflow`}>
                          <Button size="sm">
                            Complete
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Workflows Tab */}
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Workflow Instances</CardTitle>
              <CardDescription>Currently running workflows</CardDescription>
            </CardHeader>
            <CardContent>
              {activeInstances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Pause className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="font-medium">No active workflows</p>
                  <p className="text-sm text-muted-foreground">Start a workflow from a Job page</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeInstances.map((instance) => (
                    <div
                      key={instance.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedInstance(
                          selectedInstance === instance.id ? null : instance.id
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-full bg-blue-100">
                            <Workflow className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{instance.process_name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Building className="h-3 w-3" />
                              {instance.subject_name}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {instance.pending_tasks > 0 && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              {instance.pending_tasks} pending
                            </Badge>
                          )}
                          {instance.current_node && (
                            <span className="text-sm text-muted-foreground">
                              At: {instance.current_node}
                            </span>
                          )}
                          <Badge variant="default" className="bg-blue-500">
                            {Math.round(instance.progress)}%
                          </Badge>
                          <ChevronRight className={`h-4 w-4 transition-transform ${
                            selectedInstance === instance.id ? 'rotate-90' : ''
                          }`} />
                        </div>
                      </div>
                      {selectedInstance === instance.id && (
                        <div className="px-4 pb-4 border-t bg-muted/30">
                          <div className="pt-4">
                            <h4 className="text-sm font-medium mb-3">Progress</h4>
                            <WorkflowProgress instanceId={instance.id} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Processes Tab */}
        <TabsContent value="processes">
          <Card>
            <CardHeader>
              <CardTitle>Available Workflow Processes</CardTitle>
              <CardDescription>Published workflow templates</CardDescription>
            </CardHeader>
            <CardContent>
              {processes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Workflow className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="font-medium">No published processes</p>
                  <p className="text-sm text-muted-foreground">Create and publish a workflow process</p>
                  <Link href="/workflows/processes" className="mt-4">
                    <Button>
                      <Workflow className="h-4 w-4 mr-2" />
                      Manage Processes
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {processes.map((process) => (
                    <Card key={process.id} className="hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Workflow className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base">{process.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                          {process.description || 'No description'}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            Published
                          </Badge>
                          <Link href={`/workflows/designer/${process.id}`}>
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
