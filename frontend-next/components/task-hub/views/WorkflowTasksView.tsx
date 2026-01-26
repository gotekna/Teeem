'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  Building,
  Play,
  FileText,
  RefreshCw,
  ChevronRight,
  Workflow,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { WorkflowProgress } from '@/components/workflows/WorkflowProgress';

interface BpmnTask {
  id: number;
  node_name: string;
  task_type: string;
  status: string;
  process_id: number;
  process_name: string;
  instance_id: number;
  subject_type: string;
  subject_id: number;
  subject_name: string;
  assigned_to_type: string | null;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  due_date: string | null;
  is_overdue: boolean;
  created_at: string;
  started_at: string | null;
  // Extended fields from show endpoint
  node_config?: Record<string, unknown>;
  form_schema?: {
    fields?: string[];
    [key: string]: unknown;
  };
  form_data?: Record<string, unknown>;
  process_variables?: Record<string, unknown>;
}

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'currency';
  required?: boolean;
  placeholder?: string;
  prefix?: string;
  options?: { label: string; value: string }[];
}

export function WorkflowTasksView() {
  const [tasks, setTasks] = useState<BpmnTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<BpmnTask | null>(null);
  const [completing, setCompleting] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ tasks: BpmnTask[]; success: boolean; total: number }>('/api/v1/bpmn_tasks');
      if (response.success) {
        setTasks(response.tasks || []);
      }
    } catch (err) {
      console.error('Failed to load workflow tasks:', err);
      setError('Failed to load workflow tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const loadTaskDetails = async (taskId: number) => {
    try {
      const response = await api.get<{ task: BpmnTask; success: boolean }>(`/api/v1/bpmn_tasks/${taskId}`);
      if (response.success && response.task) {
        setSelectedTask(response.task);
        // Pre-populate form data if exists
        setFormData(response.task.form_data as Record<string, string> || {});
      }
    } catch (err) {
      console.error('Failed to load task details:', err);
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;

    setCompleting(true);
    try {
      await api.post(`/api/v1/bpmn_tasks/${selectedTask.id}/complete`, {
        form_data: formData,
        result: { completed_by: 'user' },
      });
      setSelectedTask(null);
      setFormData({});
      loadTasks();
    } catch (err) {
      console.error('Failed to complete task:', err);
    } finally {
      setCompleting(false);
    }
  };

  const getFormFields = (task: BpmnTask): FormField[] => {
    const schema = task.form_schema;
    if (!schema?.fields) return [];

    return schema.fields.map((field: string) => {
      const fieldLower = field.toLowerCase();
      const label = field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      // Determine field type based on name patterns
      let type: FormField['type'] = 'text';
      let placeholder = '';
      let prefix = '';

      if (fieldLower.includes('date')) {
        type = 'date';
        placeholder = 'Select a date';
      } else if (fieldLower.includes('price') || fieldLower.includes('amount') || fieldLower.includes('cost') || fieldLower.includes('value') || fieldLower.includes('deposit')) {
        type = 'currency';
        placeholder = '0.00';
        prefix = '$';
      } else if (fieldLower.includes('quantity') || fieldLower.includes('count') || fieldLower.includes('number') || fieldLower.includes('period') || fieldLower.includes('days')) {
        type = 'number';
        placeholder = '0';
      } else if (fieldLower.includes('description') || fieldLower.includes('notes') || fieldLower.includes('conditions') || fieldLower.includes('comments')) {
        type = 'textarea';
        placeholder = `Enter ${label.toLowerCase()}...`;
      } else {
        placeholder = `Enter ${label.toLowerCase()}`;
      }

      return {
        name: field,
        label,
        type,
        required: true,
        placeholder,
        prefix,
      };
    });
  };

  const getStatusBadge = (status: string, isOverdue: boolean) => {
    if (isOverdue) {
      return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    }
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="text-xs">Pending</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="text-xs bg-blue-500">In Progress</Badge>;
      case 'completed':
        return <Badge variant="default" className="text-xs bg-green-500">Completed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={loadTasks}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="p-3 bg-muted rounded-full">
          <CheckCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">No workflow tasks</p>
          <p className="text-sm text-muted-foreground">
            You&apos;re all caught up! Workflow tasks will appear here when processes require your action.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadTasks}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{tasks.length} workflow task{tasks.length !== 1 ? 's' : ''}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={loadTasks}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {tasks.map((task) => (
          <Card
            key={task.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => loadTaskDetails(task.id)}
          >
            <CardHeader className="p-3 pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-medium truncate">
                    {task.node_name}
                  </CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1 mt-0.5">
                    <FileText className="h-3 w-3" />
                    {task.process_name}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(task.status, task.is_overdue)}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {task.subject_name}
                </span>
                {task.assigned_to_name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {task.assigned_to_name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Task Detail / Complete Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => { setSelectedTask(null); setFormData({}); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              {selectedTask?.node_name}
            </DialogTitle>
            <DialogDescription>
              {selectedTask?.process_name} - {selectedTask?.subject_name}
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              {/* Task Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <span className="ml-2">{getStatusBadge(selectedTask.status, selectedTask.is_overdue)}</span>
                </div>
                {selectedTask.due_date && (
                  <div>
                    <span className="text-muted-foreground">Due:</span>
                    <span className="ml-2">{new Date(selectedTask.due_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Workflow Progress */}
              {selectedTask.instance_id && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">Workflow Progress</h4>
                  <WorkflowProgress instanceId={selectedTask.instance_id} compact />
                </div>
              )}

              {/* Dynamic Form */}
              {selectedTask.form_schema?.fields && (
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Complete this task</h4>
                  {getFormFields(selectedTask).map((field) => (
                    <div key={field.name} className="space-y-1">
                      <Label htmlFor={field.name} className="text-xs">
                        {field.label}
                        {field.required && <span className="text-destructive ml-0.5">*</span>}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          id={field.name}
                          value={formData[field.name] || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="text-sm"
                          rows={3}
                        />
                      ) : field.type === 'currency' ? (
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            {field.prefix}
                          </span>
                          <Input
                            id={field.name}
                            type="number"
                            step="0.01"
                            value={formData[field.name] || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                            placeholder={field.placeholder}
                            className="h-8 text-sm pl-7"
                          />
                        </div>
                      ) : (
                        <Input
                          id={field.name}
                          type={field.type === 'number' ? 'number' : field.type}
                          value={formData[field.name] || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="h-8 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Process Variables (for reference) */}
              {selectedTask.process_variables && Object.keys(selectedTask.process_variables).length > 0 && (
                <div className="border-t pt-4">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View process data
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(selectedTask.process_variables, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedTask(null); setFormData({}); }}>
              Cancel
            </Button>
            <Button onClick={handleCompleteTask} disabled={completing}>
              {completing ? (
                <>
                  <Spinner className="h-3 w-3 mr-2" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 mr-2" />
                  Complete Task
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
