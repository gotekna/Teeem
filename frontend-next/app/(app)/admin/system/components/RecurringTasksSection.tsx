'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Pause,
  Play,
  XCircle,
  Zap,
  Calendar,
  Users,
  User,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { TaskAssignmentField } from '@/components/task-hub/TaskAssignmentField';
import { Spinner } from "@/components/ui/spinner";

// SSoT: Matches backend SmRecurringTaskDefinition::FREQUENCIES
const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

interface RecurringTaskDefinition {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  status: string;
  frequency: string;
  frequency_interval: number;
  frequency_description: string;
  day_of_month?: number;
  day_of_week?: number;
  start_date: string;
  end_date?: string;
  occurrences_limit?: number;
  occurrences_count: number;
  remaining_occurrences?: number;
  advance_days: number;
  last_generated_for_date?: string;
  next_generation_date?: string;
  assignment_type: string;
  assigned_user_id?: number;
  assigned_user_name?: string;
  assigned_role?: string;
  assignee_name: string;
  default_duration_days: number;
  trade?: string;
  stage?: string;
  job_id?: number;
  job_name?: string;
  skip_config: {
    skip_weekends?: boolean;
    skip_holidays?: boolean;
    skip_user_leave?: boolean;
  };
  notify_on_create: boolean;
  notify_on_due: boolean;
  created_by_name?: string;
  created_at: string;
}

interface Summary {
  total: number;
  active: number;
  paused: number;
  completed: number;
  cancelled: number;
  upcoming_this_week: number;
  tasks_generated_today: number;
}

interface UserOption {
  id: number;
  name: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  cancelled: 'bg-muted text-foreground dark:bg-gray-900 dark:text-muted-foreground',
};

const emptyFormData = {
  name: '',
  description: '',
  frequency: 'weekly',
  frequency_interval: 1,
  day_of_month: undefined as number | undefined,
  day_of_week: 1, // Monday
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  occurrences_limit: undefined as number | undefined,
  advance_days: 7,
  assignment_type: 'user',
  assigned_user_id: '',
  assigned_role: '',
  default_duration_days: 1,
  trade: '',
  stage: '',
  skip_weekends: false,
  skip_holidays: false,
  skip_user_leave: false,
  notify_on_create: true,
  notify_on_due: false,
};

export function RecurringTasksSection() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [definitions, setDefinitions] = React.useState<RecurringTaskDefinition[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [users, setUsers] = React.useState<UserOption[]>([]);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingDefinition, setEditingDefinition] = React.useState<RecurringTaskDefinition | null>(null);
  const [formData, setFormData] = React.useState(emptyFormData);

  const loadData = React.useCallback(async () => {
    try {
      const [definitionsRes, summaryRes, usersRes] = await Promise.all([
        api.get<{ sm_recurring_task_definitions: RecurringTaskDefinition[] }>('/api/v1/sm_recurring_task_definitions'),
        api.get<{ summary: Summary }>('/api/v1/sm_recurring_task_definitions/summary'),
        api.get<{ users: UserOption[] }>('/api/v1/users'),
      ]);

      setDefinitions(definitionsRes?.sm_recurring_task_definitions || []);
      setSummary(summaryRes?.summary || null);
      setUsers(usersRes?.users || []);
    } catch (error) {
      console.error('Failed to load recurring task definitions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recurring task definitions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDialog = (definition?: RecurringTaskDefinition) => {
    if (definition) {
      setEditingDefinition(definition);
      setFormData({
        name: definition.name,
        description: definition.description || '',
        frequency: definition.frequency,
        frequency_interval: definition.frequency_interval,
        day_of_month: definition.day_of_month,
        day_of_week: definition.day_of_week || 1,
        start_date: definition.start_date,
        end_date: definition.end_date || '',
        occurrences_limit: definition.occurrences_limit,
        advance_days: definition.advance_days,
        assignment_type: definition.assignment_type,
        assigned_user_id: definition.assigned_user_id ? String(definition.assigned_user_id) : '',
        assigned_role: definition.assigned_role || '',
        default_duration_days: definition.default_duration_days,
        trade: definition.trade || '',
        stage: definition.stage || '',
        skip_weekends: definition.skip_config?.skip_weekends || false,
        skip_holidays: definition.skip_config?.skip_holidays || false,
        skip_user_leave: definition.skip_config?.skip_user_leave || false,
        notify_on_create: definition.notify_on_create,
        notify_on_due: definition.notify_on_due,
      });
    } else {
      setEditingDefinition(null);
      setFormData(emptyFormData);
    }
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name is required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        sm_recurring_task_definition: {
          name: formData.name,
          description: formData.description || null,
          frequency: formData.frequency,
          frequency_interval: formData.frequency_interval,
          day_of_month: formData.frequency === 'monthly' ? formData.day_of_month : null,
          day_of_week: formData.frequency === 'weekly' ? formData.day_of_week : null,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          occurrences_limit: formData.occurrences_limit || null,
          advance_days: formData.advance_days,
          assignment_type: formData.assignment_type,
          assigned_user_id: formData.assignment_type === 'user' ? (formData.assigned_user_id || null) : null,
          assigned_role: formData.assignment_type === 'role' ? (formData.assigned_role || null) : null,
          default_duration_days: formData.default_duration_days,
          trade: formData.trade || null,
          stage: formData.stage || null,
          skip_config: {
            skip_weekends: formData.skip_weekends,
            skip_holidays: formData.skip_holidays,
            skip_user_leave: formData.skip_user_leave,
          },
          notify_on_create: formData.notify_on_create,
          notify_on_due: formData.notify_on_due,
        },
      };

      if (editingDefinition) {
        await api.patch(`/api/v1/sm_recurring_task_definitions/${editingDefinition.id}`, payload);
        toast({ title: 'Success', description: 'Recurring task definition updated' });
      } else {
        await api.post('/api/v1/sm_recurring_task_definitions', payload);
        toast({ title: 'Success', description: 'Recurring task definition created' });
      }

      setShowDialog(false);
      loadData();
    } catch (error) {
      console.error('Failed to save:', error);
      toast({
        title: 'Error',
        description: 'Failed to save recurring task definition',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (id: number, action: 'pause' | 'resume' | 'cancel' | 'generate_now' | 'delete') => {
    try {
      if (action === 'delete') {
        await api.delete(`/api/v1/sm_recurring_task_definitions/${id}`);
        toast({ title: 'Success', description: 'Definition deleted' });
      } else {
        const res = await api.post<{ message: string }>(`/api/v1/sm_recurring_task_definitions/${id}/${action}`);
        toast({ title: 'Success', description: res?.message || 'Action completed' });
      }
      loadData();
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      toast({
        title: 'Error',
        description: `Failed to ${action} definition`,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{summary.active}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Paused</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Pause className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">{summary.paused}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Due This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{summary.upcoming_this_week}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Generated Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold">{summary.tasks_generated_today}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Recurring Task Definitions</h2>
          <p className="text-sm text-muted-foreground">
            Set up tasks that automatically create on a schedule.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            New Definition
          </Button>
        </div>
      </div>

      {/* Definitions Table */}
      {definitions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No recurring tasks yet</h3>
            <p className="text-center max-w-md mb-4">
              Create recurring task definitions to automatically generate tasks on a schedule.
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Definition
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {definitions.map((def) => (
                <TableRow key={def.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{def.name}</div>
                      {def.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {def.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{def.frequency_description}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {def.assignment_type === 'user' ? (
                        <User className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Users className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-sm">{def.assignee_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[def.status]}>
                      {def.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {def.next_generation_date ? (
                      <span className="text-sm">
                        {new Date(def.next_generation_date).toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{def.occurrences_count}</span>
                    {def.occurrences_limit && (
                      <span className="text-xs text-muted-foreground"> / {def.occurrences_limit}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenDialog(def)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction(def.id, 'generate_now')}>
                          <Zap className="h-4 w-4 mr-2" />
                          Generate Now
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {def.status === 'active' && (
                          <DropdownMenuItem onClick={() => handleAction(def.id, 'pause')}>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </DropdownMenuItem>
                        )}
                        {def.status === 'paused' && (
                          <DropdownMenuItem onClick={() => handleAction(def.id, 'resume')}>
                            <Play className="h-4 w-4 mr-2" />
                            Resume
                          </DropdownMenuItem>
                        )}
                        {(def.status === 'active' || def.status === 'paused') && (
                          <DropdownMenuItem onClick={() => handleAction(def.id, 'cancel')}>
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleAction(def.id, 'delete')}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDefinition ? 'Edit Recurring Task' : 'New Recurring Task'}
            </DialogTitle>
            <DialogDescription>
              Configure a task that will be automatically created on a schedule.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Weekly Site Inspection"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Schedule</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(v) => setFormData({ ...formData, frequency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Every</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={formData.frequency_interval}
                      onChange={(e) => setFormData({ ...formData, frequency_interval: parseInt(e.target.value) || 1 })}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">
                      {formData.frequency === 'daily' ? 'day(s)' :
                       formData.frequency === 'weekly' ? 'week(s)' :
                       formData.frequency === 'monthly' ? 'month(s)' :
                       formData.frequency === 'quarterly' ? 'quarter(s)' :
                       formData.frequency === 'annually' ? 'year(s)' : 'period(s)'}
                    </span>
                  </div>
                </div>
              </div>

              {formData.frequency === 'weekly' && (
                <div className="space-y-2">
                  <Label>Day of Week</Label>
                  <Select
                    value={String(formData.day_of_week)}
                    onValueChange={(v) => setFormData({ ...formData, day_of_week: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.frequency === 'monthly' && (
                <div className="space-y-2">
                  <Label>Day of Month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={formData.day_of_month || ''}
                    onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) || undefined })}
                    placeholder="1-28 (or leave blank for same day)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use -1 for last day of month
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Advance Days</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.advance_days}
                    onChange={(e) => setFormData({ ...formData, advance_days: parseInt(e.target.value) || 7 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Generate tasks this many days ahead
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Max Occurrences (Optional)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.occurrences_limit || ''}
                    onChange={(e) => setFormData({ ...formData, occurrences_limit: parseInt(e.target.value) || undefined })}
                    placeholder="Unlimited"
                  />
                </div>
              </div>
            </div>

            {/* Assignment */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Assignment</h3>
              <TaskAssignmentField
                users={users}
                assignedUserId={formData.assigned_user_id}
                assignedRole={formData.assigned_role}
                onAssignedUserChange={(userId) => setFormData({
                  ...formData,
                  assigned_user_id: userId,
                  assignment_type: userId ? 'user' : formData.assignment_type,
                })}
                onAssignedRoleChange={(role) => setFormData({
                  ...formData,
                  assigned_role: role,
                  assignment_type: role ? 'role' : formData.assignment_type,
                })}
              />
            </div>

            {/* Task Defaults */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Task Defaults</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Duration (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.default_duration_days}
                    onChange={(e) => setFormData({ ...formData, default_duration_days: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trade</Label>
                  <Input
                    value={formData.trade}
                    onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                    placeholder="e.g., Electrical"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Input
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    placeholder="e.g., Pre-Handover"
                  />
                </div>
              </div>
            </div>

            {/* Skip Options */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Skip Options</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="skip_weekends" className="cursor-pointer">Skip weekends</Label>
                  <Switch
                    id="skip_weekends"
                    checked={formData.skip_weekends}
                    onCheckedChange={(v) => setFormData({ ...formData, skip_weekends: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="skip_holidays" className="cursor-pointer">Skip public holidays</Label>
                  <Switch
                    id="skip_holidays"
                    checked={formData.skip_holidays}
                    onCheckedChange={(v) => setFormData({ ...formData, skip_holidays: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="skip_user_leave" className="cursor-pointer">Skip when assignee on leave</Label>
                  <Switch
                    id="skip_user_leave"
                    checked={formData.skip_user_leave}
                    onCheckedChange={(v) => setFormData({ ...formData, skip_user_leave: v })}
                  />
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Notifications</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notify_on_create" className="cursor-pointer">Notify when task is created</Label>
                  <Switch
                    id="notify_on_create"
                    checked={formData.notify_on_create}
                    onCheckedChange={(v) => setFormData({ ...formData, notify_on_create: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="notify_on_due" className="cursor-pointer">Notify when task is due</Label>
                  <Switch
                    id="notify_on_due"
                    checked={formData.notify_on_due}
                    onCheckedChange={(v) => setFormData({ ...formData, notify_on_due: v })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : editingDefinition ? (
                'Save Changes'
              ) : (
                'Create Definition'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
