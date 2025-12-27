'use client';

import * as React from 'react';
import { useOptionalTaskHub } from '@/contexts/TaskHubContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { Loader2, Plus } from 'lucide-react';
import { TaskAssignmentField } from './TaskAssignmentField';
import { AttachmentPicker, PendingAttachment } from './AttachmentPicker';
import { useToast } from '@/components/ui/use-toast';

interface Job {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  // Use optional hook - this component can be used outside TaskHubProvider (e.g., in HeaderBar)
  const taskHub = useOptionalTaskHub();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);

  // Form state
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    job_id: '',
    assigned_user_id: '',
    assigned_role: '',
    start_date: new Date().toISOString().split('T')[0],
    duration_days: '1',
    trade: '',
    started: false,
    required_by: '',
    follow: false,
  });

  // Track pending attachments (before task is created)
  const [pendingAttachments, setPendingAttachments] = React.useState<PendingAttachment[]>([]);

  // Load jobs and users when dialog opens
  React.useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [jobsResponse, usersResponse] = await Promise.all([
        api.get<{ jobs?: Job[] }>('/api/v1/jobs'),
        api.get<{ users: User[] }>('/api/v1/users'),
      ]);
      setJobs(jobsResponse?.jobs || []);
      setUsers(usersResponse?.users || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load jobs and users',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Task name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.job_id) {
      toast({
        title: 'Validation Error',
        description: 'Please select a job',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Determine status based on started checkbox
      const status = formData.started ? 'started' : 'not_started';

      const response = await api.post<{ success: boolean; sm_task: { id: number }; message?: string }>(
        `/api/v1/jobs/${formData.job_id}/sm_tasks`,
        {
          sm_task: {
            name: formData.name,
            description: formData.description || null,
            assigned_user_id: formData.assigned_user_id || null,
            assigned_role: formData.assigned_role || null,
            start_date: formData.start_date || new Date().toISOString().split('T')[0],
            duration_days: parseInt(formData.duration_days) || 1,
            trade: formData.trade || null,
            status: status,
            required_by: formData.required_by || null,
          },
        }
      );

      if (response?.success) {
        const taskId = response.sm_task?.id;

        // Add pending attachments
        if (taskId && pendingAttachments.length > 0) {
          for (const attachment of pendingAttachments) {
            if (attachment.type === 'upload' && attachment.file) {
              // TODO: Implement file upload to SharePoint first, then attach
              console.log('File upload not yet implemented:', attachment.file.name);
            } else if (attachment.id) {
              // Attach existing email/document
              try {
                await api.post(`/api/v1/sm_tasks/${taskId}/attachments`, {
                  attachment_type: attachment.type,
                  attachable_id: attachment.id,
                });
              } catch (attachError) {
                console.error('Failed to attach:', attachError);
              }
            }
          }
        }

        // Follow the task if requested
        if (taskId && formData.follow) {
          try {
            await api.post(`/api/v1/sm_tasks/${taskId}/follow`);
          } catch (followError) {
            console.error('Failed to follow task:', followError);
          }
        }

        toast({
          title: 'Success',
          description: 'Task created successfully',
        });

        // Reset form
        setFormData({
          name: '',
          description: '',
          job_id: '',
          assigned_user_id: '',
          assigned_role: '',
          start_date: new Date().toISOString().split('T')[0],
          duration_days: '1',
          trade: '',
          started: false,
          required_by: '',
          follow: false,
        });
        setPendingAttachments([]);
        onOpenChange(false);
        // Refresh task list if within TaskHubProvider context
        taskHub?.refresh();
      } else {
        throw new Error(response?.message || 'Failed to create task');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create task',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task to a job. Tasks will appear in the Gantt chart and task hub.
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {/* Task Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Task Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter task name"
                autoFocus
              />
            </div>

            {/* Job Selection */}
            <div className="space-y-2">
              <Label htmlFor="job">
                Job <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.job_id}
                onValueChange={(value) => handleChange('job_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No jobs available
                    </SelectItem>
                  ) : (
                    jobs.map((job) => (
                      <SelectItem key={job.id} value={String(job.id)}>
                        {job.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Assign To (User or Role) */}
            <TaskAssignmentField
              users={users}
              assignedUserId={formData.assigned_user_id}
              assignedRole={formData.assigned_role}
              onAssignedUserChange={(userId) => handleChange('assigned_user_id', userId)}
              onAssignedRoleChange={(role) => handleChange('assigned_role', role)}
            />

            {/* Start Date & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={formData.duration_days}
                  onChange={(e) => handleChange('duration_days', e.target.value)}
                />
              </div>
            </div>

            {/* Required By Date */}
            <div className="space-y-2">
              <Label htmlFor="required_by">Required By</Label>
              <Input
                id="required_by"
                type="date"
                value={formData.required_by}
                onChange={(e) => handleChange('required_by', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                When this task must be completed (independent of schedule)
              </p>
            </div>

            {/* Started & Follow Checkboxes */}
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="started"
                  checked={formData.started}
                  onCheckedChange={(checked) => handleChange('started', checked === true)}
                />
                <Label
                  htmlFor="started"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Mark as Started
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="follow"
                  checked={formData.follow}
                  onCheckedChange={(checked) => handleChange('follow', checked === true)}
                />
                <Label
                  htmlFor="follow"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Follow (get notifications)
                </Label>
              </div>
            </div>

            {/* Trade */}
            <div className="space-y-2">
              <Label htmlFor="trade">Trade</Label>
              <Input
                id="trade"
                value={formData.trade}
                onChange={(e) => handleChange('trade', e.target.value)}
                placeholder="e.g., Electrical, Plumbing, Framing"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Task description (optional)"
                rows={3}
              />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              <AttachmentPicker
                attachments={pendingAttachments}
                onAdd={(attachment) => setPendingAttachments([...pendingAttachments, attachment])}
                onRemove={(index) =>
                  setPendingAttachments(pendingAttachments.filter((_, i) => i !== index))
                }
                jobId={formData.job_id}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Task
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
