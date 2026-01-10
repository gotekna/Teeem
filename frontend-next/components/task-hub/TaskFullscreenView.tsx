'use client';

import { useState, useEffect, useMemo } from 'react';
import { SmTask, TaskAttachment, TaskActionItem, TaskFollower, useTaskHub, ActionItemType } from '@/contexts/TaskHubContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Spinner } from "@/components/ui/spinner";
import { TaskAssignmentInline } from './TaskAssignmentInline';
import { AttachmentPicker, PendingAttachment } from './AttachmentPicker';
import TeeemTableView from '@/components/table/TeeemTableView';
import { EmailDetailDialog } from '@/components/emails/EmailDetailDialog';
import { api } from '@/lib/api';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Lock,
  LockOpen,
  Mail,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ComboboxDropdown, ComboboxItem } from '@/components/ui/combobox-dropdown';
import { CascadeCompletionDialog } from '@/components/schedule/CascadeCompletionDialog';

interface Job {
  id: number;
  name: string;
  client_name?: string;
}

interface TaskFullscreenViewProps {
  task: SmTask;
  onClose: () => void;
}

// Status checkbox colors matching Gantt
const statusColors = {
  started: 'data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500',
  hold: 'data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500',
  confirm: 'data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500',
  supplier_confirm: 'data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500',
  completed: 'data-[state=checked]:bg-gray-500 data-[state=checked]:border-gray-500',
};

interface User {
  id: number;
  name: string;
}

export function TaskFullscreenView({ task, onClose }: TaskFullscreenViewProps) {
  const { user: currentUser } = useAuth();
  const {
    updateTask,
    startTask,
    completeTask,
    getCompletableLinkedTasks,
    setTaskHold,
    confirmTask,
    supplierConfirmTask,
    addActionItem,
    bulkAddActionItems,
    toggleActionItem,
    answerActionItem,
    updateActionItem,
    removeActionItem,
    delegateActionItem,
    setTaskPrivacy,
    getFollowers,
    addFollower,
    removeFollower,
    deleteTask,
    refresh,
  } = useTaskHub();

  // Edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(task.name);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(task.description || '');
  const [duration, setDuration] = useState(task.duration_days);
  const [loading, setLoading] = useState<string | null>(null);

  // Cascade completion
  const [showCascadeDialog, setShowCascadeDialog] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<SmTask[]>([]);

  // Action items state
  const [newActionItemText, setNewActionItemText] = useState('');
  const [newActionItemType, setNewActionItemType] = useState<ActionItemType>('action');
  const [actionItemLoading, setActionItemLoading] = useState<number | 'new' | 'bulk' | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  const [answeringItemId, setAnsweringItemId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [delegatingActionId, setDelegatingActionId] = useState<number | null>(null);
  const [delegatingQuestionId, setDelegatingQuestionId] = useState<number | null>(null);
  const [delegationUsers, setDelegationUsers] = useState<User[]>([]);

  // Attachment state
  const [localAttachments, setLocalAttachments] = useState<TaskAttachment[]>(task.attachments || []);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [emailKeywords, setEmailKeywords] = useState(task.email_keywords || '');
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);

  // Followers
  const [shareOpen, setShareOpen] = useState(false);
  const [followers, setFollowers] = useState<TaskFollower[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  // Jobs for assignment
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobSearchTerm, setJobSearchTerm] = useState('');

  // Date pickers
  const [confirmDateOpen, setConfirmDateOpen] = useState(false);
  const [supplierConfirmDateOpen, setSupplierConfirmDateOpen] = useState(false);
  const [selectedConfirmDate, setSelectedConfirmDate] = useState<Date | undefined>(new Date());
  const [selectedSupplierDate, setSelectedSupplierDate] = useState<Date | undefined>(new Date());

  // Collapsible sections
  const [emailsCollapsed, setEmailsCollapsed] = useState(false);
  const [documentsCollapsed, setDocumentsCollapsed] = useState(false);

  // Sync local state when task changes
  useEffect(() => {
    setLocalAttachments(task.attachments || []);
    setEditedName(task.name);
    setEditedDescription(task.description || '');
    setDuration(task.duration_days);
    setEmailKeywords(task.email_keywords || '');
  }, [task]);

  // Filter attachments
  const emailAttachments = localAttachments.filter(a => a.email);
  const documentAttachments = localAttachments.filter(a => a.document && !a.email);

  // Filter action items
  const actionItems = task.action_items?.filter(item => item.item_type === 'action') || [];
  const questionItems = task.action_items?.filter(item => item.item_type === 'question') || [];

  // Load jobs for assignment
  useEffect(() => {
    const loadJobs = async () => {
      try {
        const response = await api.get<{ jobs: Job[] }>('/api/v1/jobs', { params: { per_page: 100 } });
        if (response?.jobs) {
          setJobs(response.jobs);
        }
      } catch (err) {
        console.error('Failed to load jobs:', err);
      }
    };
    loadJobs();
  }, []);

  // Load users for delegation
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await api.get<{ users: User[] }>('/api/v1/users');
        if (response?.users) {
          setDelegationUsers(response.users);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    };
    loadUsers();
  }, []);

  // === HANDLERS ===

  const handleSaveName = async () => {
    if (editedName.trim() && editedName !== task.name) {
      setLoading('name');
      await updateTask(task.id, { name: editedName.trim() });
      setLoading(null);
    }
    setIsEditingName(false);
  };

  const handleSaveDescription = async () => {
    if (editedDescription !== task.description) {
      setLoading('description');
      await updateTask(task.id, { description: editedDescription });
      setLoading(null);
    }
    setIsEditingDescription(false);
  };

  const handleDurationSave = async () => {
    if (duration !== task.duration_days) {
      setLoading('duration');
      await updateTask(task.id, { duration_days: duration });
      setLoading(null);
    }
  };

  const handleJobChange = async (jobId: number | null) => {
    setLoading('job');
    await updateTask(task.id, { construction_id: jobId || 0 });
    setLoading(null);
  };

  const handleComplete = async () => {
    // Check for linked tasks that could be cascaded
    const completable = await getCompletableLinkedTasks(task.id);
    if (completable && completable.length > 0) {
      setLinkedTasks(completable);
      setShowCascadeDialog(true);
    } else {
      await completeTask(task.id);
    }
  };

  const handleConfirmComplete = async (selectedTaskIds: number[]) => {
    setShowCascadeDialog(false);
    await completeTask(task.id, selectedTaskIds);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this task?')) {
      await deleteTask(task.id);
      onClose();
    }
  };

  // Action items
  const handleAddActionItem = async (type: ActionItemType) => {
    if (!newActionItemText.trim()) return;
    setActionItemLoading('new');
    await addActionItem(task.id, newActionItemText.trim(), type);
    setNewActionItemText('');
    setNewActionItemType('action');
    setActionItemLoading(null);
  };

  const handleToggleItem = async (itemId: number) => {
    setActionItemLoading(itemId);
    await toggleActionItem(task.id, itemId);
    setActionItemLoading(null);
  };

  const handleUpdateItem = async (itemId: number) => {
    if (!editingItemText.trim()) return;
    setActionItemLoading(itemId);
    await updateActionItem(task.id, itemId, editingItemText.trim());
    setEditingItemId(null);
    setEditingItemText('');
    setActionItemLoading(null);
  };

  const handleAnswerItem = async (itemId: number) => {
    if (!answerText.trim()) return;
    setActionItemLoading(itemId);
    await answerActionItem(task.id, itemId, answerText.trim());
    setAnsweringItemId(null);
    setAnswerText('');
    setActionItemLoading(null);
  };

  const handleRemoveItem = async (itemId: number) => {
    setActionItemLoading(itemId);
    await removeActionItem(task.id, itemId);
    setActionItemLoading(null);
  };

  const handleBulkPaste = async () => {
    if (!bulkPasteText.trim()) return;
    setActionItemLoading('bulk');
    const lines = bulkPasteText.split('\n').filter(line => line.trim());
    await bulkAddActionItems(task.id, lines.map(text => ({ text, item_type: newActionItemType })));
    setBulkPasteText('');
    setShowBulkPaste(false);
    setActionItemLoading(null);
  };

  const handleDelegateAction = async (itemId: number, userId: number) => {
    setActionItemLoading(itemId);
    await delegateActionItem(task.id, itemId, userId);
    setDelegatingActionId(null);
    setActionItemLoading(null);
    refresh();
  };

  const handleDelegateQuestion = async (itemId: number, userId: number) => {
    setActionItemLoading(itemId);
    await delegateActionItem(task.id, itemId, userId);
    setDelegatingQuestionId(null);
    setActionItemLoading(null);
    refresh();
  };

  // Attachments
  const handleAddAttachment = async (attachment: PendingAttachment) => {
    setAttachmentLoading(true);
    try {
      if (attachment.id) {
        const response = await api.post<{ success: boolean; attachment: TaskAttachment }>(
          `/api/v1/sm_tasks/${task.id}/attachments`,
          {
            attachment_type: attachment.type,
            attachable_id: attachment.id,
            attachable_type: attachment.type === 'email' ? 'EmailWarehouse' : 'CorporateCompanyDocument',
          }
        );
        if (response?.success && response.attachment) {
          setLocalAttachments(prev => [...prev, response.attachment]);
          setShowAttachmentPicker(false);
        }
      }
    } catch (err) {
      console.error('Failed to add attachment:', err);
    }
    setAttachmentLoading(false);
  };

  const handleRemovePendingAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveAttachment = async (attachmentId: number) => {
    setAttachmentLoading(true);
    try {
      await api.delete(`/api/v1/sm_tasks/${task.id}/attachments/${attachmentId}`);
      setLocalAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (err) {
      console.error('Failed to remove attachment:', err);
    }
    setAttachmentLoading(false);
  };

  const handleSaveKeywords = async () => {
    if (emailKeywords !== task.email_keywords) {
      setLoading('keywords');
      await updateTask(task.id, { email_keywords: emailKeywords });
      setLoading(null);
    }
  };

  // Job items for combobox
  const jobItems: ComboboxItem[] = useMemo(() => {
    return jobs.map(job => ({
      id: job.id.toString(),
      label: job.name,
      searchText: job.client_name,
    }));
  }, [jobs]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <header className="border-b px-6 py-3 flex items-center justify-between shrink-0 bg-primary/5 dark:bg-primary/10">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono text-sm text-muted-foreground shrink-0">#{task.task_number}</span>

          {/* Editable task name */}
          {isEditingName ? (
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setEditedName(task.name);
                  setIsEditingName(false);
                }
              }}
              className="text-lg font-semibold flex-1"
              autoFocus
            />
          ) : (
            <h1
              className="text-lg font-semibold truncate flex-1 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded -ml-2"
              onClick={() => setIsEditingName(true)}
              title="Click to edit"
            >
              {task.name}
            </h1>
          )}
        </div>

        {/* Status checkboxes and actions */}
        <div className="flex items-center gap-3 shrink-0">
          <TooltipProvider delayDuration={300}>
            {/* Started */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Checkbox
                    checked={task.status === 'started' || task.status === 'completed'}
                    onCheckedChange={(checked) => {
                      if (checked) startTask(task.id);
                      else updateTask(task.id, { status: 'not_started' });
                    }}
                    disabled={task.status === 'completed'}
                    className={cn("h-5 w-5", statusColors.started)}
                  />
                  <span className="text-xs text-muted-foreground">S</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Started</TooltipContent>
            </Tooltip>

            {/* Hold (PO only) */}
            {task.purchase_order_id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={task.hold}
                      onCheckedChange={(checked) => setTaskHold(task.id, !!checked)}
                      className={cn("h-5 w-5", statusColors.hold)}
                    />
                    <span className="text-xs text-muted-foreground">H</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Hold</TooltipContent>
              </Tooltip>
            )}

            {/* Confirmed (PO only) */}
            {task.purchase_order_id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <Popover open={confirmDateOpen} onOpenChange={setConfirmDateOpen}>
                      <PopoverTrigger asChild>
                        <div>
                          <Checkbox
                            checked={task.confirm}
                            onCheckedChange={(checked) => {
                              if (checked) setConfirmDateOpen(true);
                              else updateTask(task.id, { confirm: false });
                            }}
                            className={cn("h-5 w-5", statusColors.confirm)}
                          />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={selectedConfirmDate}
                          onSelect={(date) => {
                            if (date) {
                              setSelectedConfirmDate(date);
                              confirmTask(task.id, format(date, 'yyyy-MM-dd'));
                              setConfirmDateOpen(false);
                            }
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-xs text-muted-foreground">C</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Confirmed</TooltipContent>
              </Tooltip>
            )}

            {/* Supplier (PO only) */}
            {task.purchase_order_id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <Popover open={supplierConfirmDateOpen} onOpenChange={setSupplierConfirmDateOpen}>
                      <PopoverTrigger asChild>
                        <div>
                          <Checkbox
                            checked={task.supplier_confirm}
                            onCheckedChange={(checked) => {
                              if (checked) setSupplierConfirmDateOpen(true);
                              else updateTask(task.id, { supplier_confirm: false });
                            }}
                            className={cn("h-5 w-5", statusColors.supplier_confirm)}
                          />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={selectedSupplierDate}
                          onSelect={(date) => {
                            if (date) {
                              setSelectedSupplierDate(date);
                              supplierConfirmTask(task.id, format(date, 'yyyy-MM-dd'));
                              setSupplierConfirmDateOpen(false);
                            }
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-xs text-muted-foreground">Sup</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Supplier Confirmed</TooltipContent>
              </Tooltip>
            )}

            {/* Done */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Checkbox
                    checked={task.status === 'completed'}
                    onCheckedChange={(checked) => {
                      if (checked) handleComplete();
                      else updateTask(task.id, { status: 'started' });
                    }}
                    className={cn("h-5 w-5", statusColors.completed)}
                  />
                  <span className="text-xs text-muted-foreground">D</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Done</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="w-px h-6 bg-border mx-2" />

          {/* Privacy toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTaskPrivacy(task.id, !task.locked)}
            title={task.locked ? 'Private task' : 'Public task'}
          >
            {task.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4 text-muted-foreground" />}
          </Button>

          {/* Follow */}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (task.is_following) {
                await removeFollower(task.id, currentUser?.id || 0);
              } else {
                await addFollower(task.id, currentUser?.id || 0);
              }
              refresh();
            }}
            title={task.is_following ? 'Unfollow' : 'Follow'}
          >
            {task.is_following ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
          </Button>

          {/* Delete */}
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>

          {/* Close */}
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* 4-Column Content */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-4 gap-6 p-6 min-h-full">
          {/* Column 1: Description */}
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Description</h2>
              {isEditingDescription ? (
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  onBlur={handleSaveDescription}
                  className="min-h-[150px]"
                  autoFocus
                />
              ) : (
                <div
                  className="min-h-[100px] p-3 rounded-md border bg-muted/30 cursor-pointer hover:bg-muted/50 text-sm whitespace-pre-wrap"
                  onClick={() => setIsEditingDescription(true)}
                >
                  {task.description || <span className="text-muted-foreground italic">Click to add description...</span>}
                </div>
              )}
            </div>

            <div className="border-t pt-4 space-y-3">
              {/* Duration */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-20">Duration:</span>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                  onBlur={handleDurationSave}
                  className="w-16 h-8 text-sm"
                  min={1}
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>

              {/* Job */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-20">Job:</span>
                <div className="flex-1">
                  <ComboboxDropdown
                    items={jobItems}
                    selectedItem={task.construction_id > 0 ? {
                      id: task.construction_id.toString(),
                      label: task.job_name || 'Unknown Job'
                    } : undefined}
                    onSelect={(item) => handleJobChange(parseInt(item.id))}
                    placeholder="Select job..."
                    searchPlaceholder="Search jobs..."
                    className="h-8"
                  />
                </div>
              </div>

              {/* Assigned */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-20">Assigned:</span>
                <div className="flex-1">
                  <TaskAssignmentInline
                    assignedUserId={task.assigned_user_id}
                    assignedRole={task.assigned_role}
                    onAssign={async (userId, role) => {
                      await updateTask(task.id, { assigned_user_id: userId, assigned_role: role });
                    }}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-20">Dates:</span>
                <span>{format(new Date(task.start_date), 'dd MMM')} - {format(new Date(task.end_date), 'dd MMM yyyy')}</span>
              </div>
            </div>

            {/* Quick Links */}
            <div className="border-t pt-4 flex flex-wrap gap-2">
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

          {/* Column 2: Actions */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-muted-foreground">Actions</h2>
              <Badge variant="secondary" className="text-xs">{actionItems.length}</Badge>
            </div>

            {/* Add action input */}
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add action item..."
                value={newActionItemType === 'action' ? newActionItemText : ''}
                onChange={(e) => {
                  setNewActionItemText(e.target.value);
                  setNewActionItemType('action');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newActionItemText.trim()) {
                    handleAddActionItem('action');
                  }
                }}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddActionItem('action')}
                disabled={!newActionItemText.trim() || actionItemLoading === 'new'}
                className="h-8 shrink-0"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* Action items list */}
            <div className="flex-1 overflow-auto space-y-1">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "p-2 rounded-md border bg-card text-sm group space-y-1",
                    item.checked && "bg-muted/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={() => handleToggleItem(item.id)}
                      className="mt-0.5 shrink-0"
                      disabled={actionItemLoading === item.id}
                    />
                    {editingItemId === item.id ? (
                      <Input
                        value={editingItemText}
                        onChange={(e) => setEditingItemText(e.target.value)}
                        onBlur={() => handleUpdateItem(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateItem(item.id);
                          if (e.key === 'Escape') {
                            setEditingItemId(null);
                            setEditingItemText('');
                          }
                        }}
                        className="h-6 text-sm flex-1"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={cn(
                          "flex-1 cursor-pointer",
                          item.checked && "line-through text-muted-foreground"
                        )}
                        onClick={() => {
                          setEditingItemId(item.id);
                          setEditingItemText(item.text);
                        }}
                      >
                        {item.text}
                      </span>
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={actionItemLoading === item.id}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Delegated task link or create task button */}
                  {item.delegated_task_id ? (
                    <div className="ml-6">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-5 text-xs p-0 text-primary"
                        onClick={() => window.open(`/sm_tasks/${item.delegated_task_id}`, '_blank')}
                      >
                        → Task #{item.delegated_task_id}
                      </Button>
                    </div>
                  ) : delegatingActionId === item.id ? (
                    <div className="ml-6 flex gap-2 items-center">
                      <ComboboxDropdown
                        items={delegationUsers.map(u => ({ id: u.id.toString(), label: u.name }))}
                        placeholder="Select person..."
                        onSelect={(selected) => handleDelegateAction(item.id, parseInt(selected.id))}
                        className="h-6 text-xs w-40"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setDelegatingActionId(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="ml-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-xs p-0 text-muted-foreground hover:text-primary"
                        onClick={() => setDelegatingActionId(item.id)}
                      >
                        → Task
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {actionItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No action items yet</p>
              )}
            </div>

            {/* Bulk paste button */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => {
                setNewActionItemType('action');
                setShowBulkPaste(true);
              }}
            >
              + Paste List
            </Button>
          </div>

          {/* Column 3: Questions */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-muted-foreground">Questions</h2>
              <Badge variant="secondary" className="text-xs">{questionItems.length}</Badge>
            </div>

            {/* Add question input */}
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add question..."
                value={newActionItemType === 'question' ? newActionItemText : ''}
                onChange={(e) => {
                  setNewActionItemText(e.target.value);
                  setNewActionItemType('question');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newActionItemText.trim()) {
                    handleAddActionItem('question');
                  }
                }}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddActionItem('question')}
                disabled={!newActionItemText.trim() || actionItemLoading === 'new'}
                className="h-8 shrink-0"
              >
                <HelpCircle className="h-3 w-3" />
              </Button>
            </div>

            {/* Question items list */}
            <div className="flex-1 overflow-auto space-y-2">
              {questionItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "p-2 rounded-md border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-sm space-y-2"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <HelpCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    {editingItemId === item.id ? (
                      <Input
                        value={editingItemText}
                        onChange={(e) => setEditingItemText(e.target.value)}
                        onBlur={() => handleUpdateItem(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateItem(item.id);
                          if (e.key === 'Escape') {
                            setEditingItemId(null);
                            setEditingItemText('');
                          }
                        }}
                        className="h-6 text-sm flex-1"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="flex-1 cursor-pointer"
                        onClick={() => {
                          setEditingItemId(item.id);
                          setEditingItemText(item.text);
                        }}
                      >
                        {item.text}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Answer */}
                  {item.response ? (
                    <div className="ml-6 p-2 rounded bg-green-50 dark:bg-green-950/30 border-l-2 border-green-500">
                      <span className="text-xs text-green-600 dark:text-green-400">Answer:</span>
                      <p className="text-sm">{item.response}</p>
                    </div>
                  ) : answeringItemId === item.id ? (
                    <div className="ml-6 flex gap-2">
                      <Input
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="Type answer..."
                        className="h-7 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAnswerItem(item.id);
                          if (e.key === 'Escape') {
                            setAnsweringItemId(null);
                            setAnswerText('');
                          }
                        }}
                        autoFocus
                      />
                      <Button size="sm" onClick={() => handleAnswerItem(item.id)} className="h-7">
                        <Send className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="ml-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setAnsweringItemId(item.id)}
                      >
                        + Add Answer
                      </Button>
                    </div>
                  )}

                  {/* Delegated task link or create task button */}
                  {item.delegated_task_id ? (
                    <div className="ml-6">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-6 text-xs p-0 text-primary"
                        onClick={() => window.open(`/sm_tasks/${item.delegated_task_id}`, '_blank')}
                      >
                        → Task #{item.delegated_task_id}
                      </Button>
                    </div>
                  ) : delegatingQuestionId === item.id ? (
                    <div className="ml-6 flex gap-2 items-center">
                      <ComboboxDropdown
                        items={delegationUsers.map(u => ({ id: u.id.toString(), label: u.name }))}
                        placeholder="Select person..."
                        onSelect={(selected) => handleDelegateQuestion(item.id, parseInt(selected.id))}
                        className="h-6 text-xs w-40"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setDelegatingQuestionId(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="ml-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-xs p-0 text-muted-foreground hover:text-primary"
                        onClick={() => setDelegatingQuestionId(item.id)}
                      >
                        → Task
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {questionItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No questions yet</p>
              )}
            </div>

            {/* Bulk paste button */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => {
                setNewActionItemType('question');
                setShowBulkPaste(true);
              }}
            >
              + Paste List
            </Button>
          </div>

          {/* Column 4: Attachments */}
          <div className="flex flex-col gap-4">
            {/* Attachment Picker (inline) */}
            {showAttachmentPicker && (
              <div className="p-2 border rounded bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Add Attachment</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setShowAttachmentPicker(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <AttachmentPicker
                  attachments={pendingAttachments}
                  onAdd={handleAddAttachment}
                  onRemove={handleRemovePendingAttachment}
                  jobId={task.construction_id > 0 ? String(task.construction_id) : undefined}
                />
              </div>
            )}

            {/* Emails Section */}
            <div className="flex-1 flex flex-col min-h-0">
              <div
                className="flex items-center justify-between mb-2 cursor-pointer"
                onClick={() => setEmailsCollapsed(!emailsCollapsed)}
              >
                <div className="flex items-center gap-2">
                  {emailsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium text-muted-foreground">Emails</h2>
                  <Badge variant="secondary" className="text-xs">{emailAttachments.length}</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAttachmentPicker(true);
                  }}
                >
                  + Add
                </Button>
              </div>

              {!emailsCollapsed && (
                <>
                  {/* Keywords input */}
                  <div className="mb-2">
                    <Input
                      placeholder="Auto-match keywords (e.g., DUNS, Apple)"
                      value={emailKeywords}
                      onChange={(e) => setEmailKeywords(e.target.value)}
                      onBlur={handleSaveKeywords}
                      className="h-7 text-xs"
                    />
                  </div>

                  {/* Email list */}
                  <div className="flex-1 overflow-auto border rounded-md">
                    {emailAttachments.length > 0 ? (
                      <div className="divide-y">
                        {emailAttachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-2 p-2 hover:bg-muted/50 cursor-pointer text-xs group"
                            onClick={() => att.email && setSelectedEmailId(att.email.id)}
                          >
                            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{att.email?.subject}</div>
                              <div className="text-muted-foreground truncate">{att.email?.from_email}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveAttachment(att.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">No emails attached</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Documents Section */}
            <div className="flex-1 flex flex-col min-h-0">
              <div
                className="flex items-center justify-between mb-2 cursor-pointer"
                onClick={() => setDocumentsCollapsed(!documentsCollapsed)}
              >
                <div className="flex items-center gap-2">
                  {documentsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium text-muted-foreground">Documents</h2>
                  <Badge variant="secondary" className="text-xs">{documentAttachments.length}</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAttachmentPicker(true);
                  }}
                >
                  + Add
                </Button>
              </div>

              {!documentsCollapsed && (
                <div className="flex-1 overflow-auto border rounded-md">
                  {documentAttachments.length > 0 ? (
                    <div className="divide-y">
                      {documentAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 p-2 hover:bg-muted/50 text-xs group"
                        >
                          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {att.document?.display_name || att.document?.file_name}
                            </div>
                            {att.document?.document_type && (
                              <div className="text-muted-foreground">{att.document.document_type}</div>
                            )}
                          </div>
                          {att.document?.sharepoint_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => window.open(att.document?.sharepoint_url, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                            onClick={() => handleRemoveAttachment(att.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No documents attached</p>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showCascadeDialog && (
        <CascadeCompletionDialog
          open={showCascadeDialog}
          onOpenChange={setShowCascadeDialog}
          taskName={task.name}
          linkedTasks={linkedTasks}
          onComplete={handleConfirmComplete}
        />
      )}


      {selectedEmailId && (
        <EmailDetailDialog
          emailId={selectedEmailId}
          open={!!selectedEmailId}
          onOpenChange={(open) => !open && setSelectedEmailId(null)}
        />
      )}

      {/* Bulk paste dialog */}
      {showBulkPaste && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-lg p-4 w-[400px]">
            <h3 className="font-medium mb-2">Paste Multiple {newActionItemType === 'action' ? 'Actions' : 'Questions'}</h3>
            <p className="text-sm text-muted-foreground mb-3">One per line</p>
            <Textarea
              value={bulkPasteText}
              onChange={(e) => setBulkPasteText(e.target.value)}
              placeholder={`Action 1\nAction 2\nAction 3`}
              className="min-h-[150px] mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBulkPaste(false)}>Cancel</Button>
              <Button onClick={handleBulkPaste} disabled={!bulkPasteText.trim() || actionItemLoading === 'bulk'}>
                {actionItemLoading === 'bulk' ? <Spinner className="h-4 w-4" /> : 'Add All'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
