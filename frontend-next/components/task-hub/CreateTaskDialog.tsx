'use client';

import * as React from 'react';
import { useOptionalTaskHub } from '@/contexts/TaskHubContext';
import { useAuth } from '@/contexts/AuthContext';
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
import { ComboboxDropdown, ComboboxItem } from '@/components/ui/combobox-dropdown';
import MultipleSelector, { Option } from '@/components/ui/multiple-selector';
import { api } from '@/lib/api';
import { Check, Eye, Lock, Plus, Users } from "lucide-react";
import { TaskAssignmentField } from './TaskAssignmentField';
import { AttachmentPicker, PendingAttachment } from './AttachmentPicker';
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from "@/components/ui/spinner";

interface Job {
  id: number;
  name: string;
  client_name?: string;
  employee_names?: string[];
  matched_contact?: { name: string; role: string };
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
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);
  const [searchingJobs, setSearchingJobs] = React.useState(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    job_id: '',
    assigned_user_id: '',
    assigned_role: '',
    start_date: new Date().toISOString().split('T')[0],
    duration_days: '1',
    started: false,
    required_by: '',
    follow: false,
    is_private: false,
    follower_ids: [] as string[],
    viewer_ids: [] as string[],
  });

  // Track pending attachments (before task is created)
  const [pendingAttachments, setPendingAttachments] = React.useState<PendingAttachment[]>([]);

  // Check if assigned to someone else (for showing Follow checkbox)
  const isAssignedToOther = React.useMemo(() => {
    if (!currentUser) return false;
    if (formData.assigned_role) return true; // Role assignment = might be others
    if (!formData.assigned_user_id) return false;
    return formData.assigned_user_id !== String(currentUser.id);
  }, [formData.assigned_user_id, formData.assigned_role, currentUser]);

  // Load jobs and users when dialog opens
  React.useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  // Set default assigned user to current user when users load
  React.useEffect(() => {
    if (currentUser && users.length > 0 && !formData.assigned_user_id) {
      // Check if current user is in the users list
      const currentUserInList = users.find(u => u.id === currentUser.id);
      if (currentUserInList) {
        setFormData(prev => ({ ...prev, assigned_user_id: String(currentUser.id) }));
      }
    }
  }, [currentUser, users, formData.assigned_user_id]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [jobsResponse, usersResponse] = await Promise.all([
        api.get<{ jobs?: Job[] }>('/api/v1/jobs/for_select'),  // Fast lightweight endpoint
        api.get<{ users?: User[] } | User[]>('/api/v1/users'),
      ]);
      setJobs(jobsResponse?.jobs || []);
      // Handle both array and object response formats
      setUsers(Array.isArray(usersResponse) ? usersResponse : usersResponse?.users || []);
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

  // Debounced job search
  const searchJobs = React.useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Always debounce to avoid flickering
    searchTimeoutRef.current = setTimeout(async () => {
      const url = query
        ? `/api/v1/jobs/for_select?q=${encodeURIComponent(query)}`
        : '/api/v1/jobs/for_select';
      setSearchingJobs(true);
      try {
        const response = await api.get<{ jobs?: Job[] }>(url);
        setJobs(response?.jobs || []);
      } catch (error) {
        console.error('Failed to search jobs:', error);
      } finally {
        setSearchingJobs(false);
      }
    }, query ? 300 : 0); // Immediate for clear, debounced for search
  }, []);

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

    setSaving(true);
    try {
      // Determine status based on started checkbox
      const status = formData.started ? 'started' : 'not_started';

      // Use nested route if job selected, otherwise use standalone route
      const url = formData.job_id
        ? `/api/v1/jobs/${formData.job_id}/sm_tasks`
        : '/api/v1/sm_tasks';

      const response = await api.post<{ success: boolean; sm_task: { id: number }; message?: string }>(
        url,
        {
          sm_task: {
            name: formData.name,
            description: formData.description || null,
            job_id: formData.job_id || null,
            assigned_user_id: formData.assigned_user_id || null,
            assigned_role: formData.assigned_role || null,
            start_date: formData.start_date || new Date().toISOString().split('T')[0],
            duration_days: parseInt(formData.duration_days) || 1,
            status: status,
            required_by: formData.required_by || null,
            is_private: formData.is_private,
          },
          follower_ids: formData.follower_ids.length > 0 ? formData.follower_ids : null,
          viewer_ids: formData.is_private && formData.viewer_ids.length > 0 ? formData.viewer_ids : null,
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

        // Follow the task if requested (only when assigned to others)
        if (taskId && formData.follow && isAssignedToOther) {
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
          assigned_user_id: currentUser ? String(currentUser.id) : '',
          assigned_role: '',
          start_date: new Date().toISOString().split('T')[0],
          duration_days: '1',
          started: false,
          required_by: '',
          follow: false,
          is_private: false,
          follower_ids: [],
          viewer_ids: [],
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

  const setDuration = (days: number) => {
    setFormData((prev) => ({ ...prev, duration_days: String(days) }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Create a task. Optionally assign to a job to show in Gantt chart.
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={32} className="text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-2">
              {/* Left Column - Task Details */}
              <div className="space-y-3">
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
                  <Label htmlFor="job">Job</Label>
                  <ComboboxDropdown
                    items={jobs.map((job) => ({
                      id: String(job.id),
                      label: job.name,
                      client_name: job.client_name,
                      employee_names: job.employee_names,
                      matched_contact: job.matched_contact,
                    } as ComboboxItem & { client_name?: string; employee_names?: string[]; matched_contact?: { name: string; role: string } }))}
                    selectedItem={formData.job_id ? {
                      id: formData.job_id,
                      label: jobs.find(j => String(j.id) === formData.job_id)?.name || ''
                    } : undefined}
                    onSelect={(item) => handleChange('job_id', item.id)}
                    placeholder="Search by job, client, or employee..."
                    clearable
                    onClear={() => handleChange('job_id', '')}
                    emptyResults="No jobs found"
                    isLoading={searchingJobs}
                    onInputChange={searchJobs}
                    disableInternalFilter
                    renderListItem={({ isChecked, item }) => {
                      const jobItem = item as ComboboxItem & { client_name?: string; employee_names?: string[]; matched_contact?: { name: string; role: string; company_name?: string } };
                      const roleLabels: Record<string, string> = {
                        client: 'Client',
                        coordinator: 'Coordinator',
                        estimator: 'Estimator',
                        internal_sales: 'Internal Sales',
                        site_coordinator: 'Site Coordinator',
                        supervisor: 'Supervisor',
                      };

                      // Format matched contact display
                      const formatMatchedContact = () => {
                        if (!jobItem.matched_contact) return null;
                        const mc = jobItem.matched_contact;
                        if (mc.role === 'employee_of' && mc.company_name) {
                          // Employee of a company contact
                          return `↳ ${mc.name} (Employee of ${mc.company_name})`;
                        }
                        // Direct job contact
                        return `↳ ${roleLabels[mc.role] || mc.role}: ${mc.name}`;
                      };

                      return (
                        <div className="flex flex-col w-full py-1">
                          <div className="flex items-center">
                            <Check className={`mr-2 h-4 w-4 flex-shrink-0 ${isChecked ? 'opacity-100' : 'opacity-0'}`} />
                            <span className="font-medium">{jobItem.label}</span>
                          </div>
                          {jobItem.matched_contact && (
                            <div className="ml-6 text-xs text-primary font-medium">
                              {formatMatchedContact()}
                            </div>
                          )}
                          {!jobItem.matched_contact && jobItem.client_name && (
                            <div className="ml-6 text-xs text-muted-foreground">
                              Client: {jobItem.client_name}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                </div>

                {/* Assign To (User or Role) + Follow checkbox */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Assign To</Label>
                    {isAssignedToOther && (
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
                          Follow
                        </Label>
                      </div>
                    )}
                  </div>
                  <TaskAssignmentField
                    users={users}
                    assignedUserId={formData.assigned_user_id}
                    assignedRole={formData.assigned_role}
                    onAssignedUserChange={(userId) => handleChange('assigned_user_id', userId)}
                    onAssignedRoleChange={(role) => handleChange('assigned_role', role)}
                  />
                </div>

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

                {/* Duration Quick Buttons */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={formData.duration_days === '1' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDuration(1)}
                    className="flex-1"
                  >
                    1 Day
                  </Button>
                  <Button
                    type="button"
                    variant={formData.duration_days === '7' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDuration(7)}
                    className="flex-1"
                  >
                    1 Week
                  </Button>
                  <Button
                    type="button"
                    variant={formData.duration_days === '30' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDuration(30)}
                    className="flex-1"
                  >
                    1 Month
                  </Button>
                </div>

                {/* Required By */}
                <div className="space-y-2">
                  <Label htmlFor="required_by">Required By</Label>
                  <Input
                    id="required_by"
                    type="date"
                    value={formData.required_by}
                    onChange={(e) => handleChange('required_by', e.target.value)}
                  />
                </div>

                {/* Followers */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    Followers
                  </Label>
                  <MultipleSelector
                    value={formData.follower_ids.map(id => {
                      const user = users.find(u => String(u.id) === id);
                      return { value: id, label: user?.name || '' };
                    })}
                    options={users
                      .filter(u => String(u.id) !== formData.assigned_user_id)
                      .map(u => ({ value: String(u.id), label: u.name }))}
                    onChange={(options: Option[]) => {
                      setFormData(prev => ({ ...prev, follower_ids: options.map(o => o.value) }));
                    }}
                    placeholder="Search followers..."
                    emptyIndicator="No users found"
                    hidePlaceholderWhenSelected
                  />
                </div>

                {/* Started & Private checkboxes */}
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
                      id="is_private"
                      checked={formData.is_private}
                      onCheckedChange={(checked) => handleChange('is_private', checked === true)}
                    />
                    <Label
                      htmlFor="is_private"
                      className="text-sm font-medium leading-none cursor-pointer flex items-center gap-1"
                    >
                      <Lock className="h-3 w-3" />
                      Private
                    </Label>
                  </div>
                </div>

                {/* Visible To (only shown when Private is checked) */}
                {formData.is_private && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      Visible To
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      You and the assigned user always have access.
                    </p>
                    <MultipleSelector
                      value={formData.viewer_ids.map(id => {
                        const user = users.find(u => String(u.id) === id);
                        return { value: id, label: user?.name || '' };
                      })}
                      options={users
                        .filter(u =>
                          String(u.id) !== formData.assigned_user_id &&
                          String(u.id) !== String(currentUser?.id)
                        )
                        .map(u => ({ value: String(u.id), label: u.name }))}
                      onChange={(options: Option[]) => {
                        setFormData(prev => ({ ...prev, viewer_ids: options.map(o => o.value) }));
                      }}
                      placeholder="Search users..."
                      emptyIndicator="No users found"
                      hidePlaceholderWhenSelected
                    />
                  </div>
                )}

                {/* Description */}
                <div className="space-y-1">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Task description (optional)"
                    rows={2}
                  />
                </div>
              </div>

              {/* Right Column - Attachments */}
              <div className="space-y-2">
                <Label>Attachments</Label>
                <div className="border rounded-lg p-4 dark:border-gray-700">
                  <AttachmentPicker
                    attachments={pendingAttachments}
                    onAdd={(attachment) => setPendingAttachments([...pendingAttachments, attachment])}
                    onRemove={(index) =>
                      setPendingAttachments(pendingAttachments.filter((_, i) => i !== index))
                    }
                    jobId={formData.job_id}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner size={16} className="mr-2" />
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
