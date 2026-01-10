'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { SmTask, TaskAttachment, TaskActionItem, TaskFollower, useTaskHub, ActionItemType } from '@/contexts/TaskHubContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskAssignmentInline } from './TaskAssignmentInline';
import { AttachmentPicker, PendingAttachment } from './AttachmentPicker';
import TeeemTableView from '@/components/table/TeeemTableView';
import { EmailDetailDialog } from '@/components/emails/EmailDetailDialog';
import { api } from '@/lib/api';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  History,
  ListTodo,
  Lock,
  Mail,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ComboboxDropdown, ComboboxItem } from '@/components/ui/combobox-dropdown';
import { Briefcase } from 'lucide-react';
import { CascadeCompletionDialog } from '@/components/schedule/CascadeCompletionDialog';

interface Job {
  id: number;
  name: string;
  client_name?: string;
}

interface TaskExpandedRowProps {
  task: SmTask;
  onClose?: () => void;
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

interface TaskHistoryEntry {
  id: number;
  activity_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  user_name: string | null;
  created_at: string;
}

// Simplified view for delegated questions/actions
// Shows only: question context, attachments, due date, complete button
function DelegatedTaskView({
  task,
  onClose,
  onComplete,
}: {
  task: SmTask;
  onClose?: () => void;
  onComplete: () => Promise<void>;
}) {
  const [completing, setCompleting] = useState(false);
  const [localAttachments, setLocalAttachments] = useState<TaskAttachment[]>(task.attachments || []);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract the question/action from the description
  const questionMatch = task.description?.match(/\*\*(Question|Action):\*\*\s*(.+?)(?:\n|$)/);
  const questionText = questionMatch?.[2] || task.name.replace(/^(Question|Action):\s*/i, '');
  const questionType = questionMatch?.[1] || (task.name.startsWith('Action:') ? 'Action' : 'Question');

  // Extract context info
  const fromTaskMatch = task.description?.match(/- From task:\s*(.+?)(?:\n|$)/);
  const sentByMatch = task.description?.match(/- Sent by:\s*(.+?)(?:\n|$)/);
  const fromTask = fromTaskMatch?.[1] || task.parent_task_name;
  const sentBy = sentByMatch?.[1];

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await onComplete();
    } finally {
      setCompleting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'response');

        const result = await api.postFormData<{ success: boolean; attachment: TaskAttachment }>(
          `/api/v1/sm_tasks/${task.id}/attachments/upload`,
          formData
        );

        if (result?.success && result.attachment) {
          setLocalAttachments(prev => [...prev, result.attachment]);
        }
      }
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = async (attachmentId: number) => {
    try {
      await api.delete(`/api/v1/sm_tasks/${task.id}/attachments/${attachmentId}`);
      setLocalAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (err) {
      console.error('Failed to remove attachment:', err);
    }
  };

  return (
    <div className="bg-muted/30 border-t border-b px-4 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {questionType}
          </Badge>
          <span className="text-sm text-muted-foreground">
            From: {fromTask || 'Unknown task'}
          </span>
          {sentBy && (
            <span className="text-sm text-muted-foreground">
              • Sent by: {sentBy}
            </span>
          )}
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Question/Action text */}
      <div className="bg-primary/10 border-l-4 border-primary rounded-r px-4 py-3">
        <p className="font-medium">{questionText}</p>
      </div>

      {/* Attachments */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Attachments</Label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4 mr-1" />
            Add File
          </Button>
        </div>
        {localAttachments.length > 0 ? (
          <div className="space-y-1">
            {localAttachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{att.document?.file_name || att.document?.display_name || 'File'}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleRemoveAttachment(att.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No attachments yet</p>
        )}
      </div>

      {/* Due date */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span>Due: {task.end_date ? format(new Date(task.end_date), 'dd MMM yyyy') : 'No due date'}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button
          variant="default"
          onClick={handleComplete}
          disabled={completing}
          className="gap-2"
        >
          {completing ? (
            <Spinner size={16} />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Complete & Submit
        </Button>
      </div>
    </div>
  );
}

export function TaskExpandedRow({ task, onClose }: TaskExpandedRowProps) {
  const { user: currentUser } = useAuth();
  const {
    updateTask,
    startTask,
    completeTask,
    getCompletableLinkedTasks,
    setTaskHold,
    confirmTask,
    supplierConfirmTask,
    collapseTask,
    navigateToTask,
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

  const [loading, setLoading] = useState<string | null>(null);
  const [duration, setDuration] = useState(task.duration_days);
  const [confirmDateOpen, setConfirmDateOpen] = useState(false);
  const [supplierConfirmDateOpen, setSupplierConfirmDateOpen] = useState(false);
  const [selectedConfirmDate, setSelectedConfirmDate] = useState<Date | undefined>(
    task.hold_date ? new Date(task.hold_date) : new Date()
  );
  const [selectedSupplierDate, setSelectedSupplierDate] = useState<Date | undefined>(
    task.hold_date ? new Date(task.hold_date) : new Date()
  );

  // Attachment state
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [localAttachments, setLocalAttachments] = useState<TaskAttachment[]>(task.attachments || []);
  const [attachmentLoading, setAttachmentLoading] = useState(false);

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
  const [delegatingItemId, setDelegatingItemId] = useState<number | null>(null);
  const [delegationUsers, setDelegationUsers] = useState<User[]>([]);

  // Share/Followers state
  const [shareOpen, setShareOpen] = useState(false);
  const [followers, setFollowers] = useState<TaskFollower[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  // Direct drag-and-drop state for attachments section
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // History state
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);

  // Attachments section expanded state - default to expanded only if there are attachments
  const hasAttachments = (task.attachments?.length || 0) > 0;
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(hasAttachments);

  // Email keywords state
  const [emailKeywords, setEmailKeywords] = useState(task.email_keywords || '');

  // Description editing state
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionText, setDescriptionText] = useState(task.description || '');
  const [descriptionSaving, setDescriptionSaving] = useState(false);

  // Email detail dialog state
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [keywordsSaving, setKeywordsSaving] = useState(false);

  // Job assignment state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobSearchTimeout, setJobSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Task name editing state
  const [editingTaskName, setEditingTaskName] = useState(false);
  const [taskNameText, setTaskNameText] = useState(task.name);
  const [taskNameSaving, setTaskNameSaving] = useState(false);

  // Cascade completion dialog state
  const [cascadeDialogOpen, setCascadeDialogOpen] = useState(false);
  const [cascadeDialogLoading, setCascadeDialogLoading] = useState(false);

  // Load followers on mount for all tasks
  useEffect(() => {
    getFollowers(task.id).then(setFollowers).catch(console.error);
  }, [task.id, getFollowers]);

  // Sync description text when task updates
  useEffect(() => {
    if (!editingDescription) {
      setDescriptionText(task.description || '');
    }
  }, [task.description, editingDescription]);

  // Sync task name text when task updates
  useEffect(() => {
    if (!editingTaskName) {
      setTaskNameText(task.name);
    }
  }, [task.name, editingTaskName]);

  // Check if this is a PO task
  const isPOTask = !!task.purchase_order_id;

  // Check if task is linked to a job
  const isJobLinked = task.construction_id > 0;

  // Check if current user is following this task
  const isCurrentUserFollowing = useMemo(() => {
    if (!currentUser) return false;
    return followers.some(f => f.user_id === currentUser.id);
  }, [followers, currentUser]);

  // Toggle follow for current user
  const handleToggleFollow = async () => {
    if (!currentUser) return;
    setFollowersLoading(true);
    try {
      if (isCurrentUserFollowing) {
        await removeFollower(task.id, currentUser.id);
        setFollowers(prev => prev.filter(f => f.user_id !== currentUser.id));
      } else {
        const newFollower = await addFollower(task.id, currentUser.id);
        setFollowers(prev => [...prev, newFollower]);
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    } finally {
      setFollowersLoading(false);
    }
  };

  // Load followers when share popover opens
  const handleShareOpen = async (open: boolean) => {
    setShareOpen(open);
    if (open) {
      setFollowersLoading(true);
      try {
        const [followersData, usersResponse] = await Promise.all([
          getFollowers(task.id),
          api.get<{ users?: User[] } | User[]>('/api/v1/users'),
        ]);
        setFollowers(followersData);
        const userList = Array.isArray(usersResponse) ? usersResponse : usersResponse?.users || [];
        setAvailableUsers(userList);
      } catch (error) {
        console.error('Failed to load followers:', error);
      } finally {
        setFollowersLoading(false);
      }
    }
  };

  // Fetch history when expanded
  const handleHistoryToggle = async () => {
    const newExpanded = !historyExpanded;
    setHistoryExpanded(newExpanded);

    if (newExpanded && history.length === 0) {
      setHistoryLoading(true);
      try {
        const response = await api.get<{ success: boolean; history: TaskHistoryEntry[] }>(
          `/api/v1/sm_tasks/${task.id}/history`
        );
        if (response?.success) {
          setHistory(response.history || []);
        }
      } catch (error) {
        console.error('Failed to load history:', error);
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  // Format activity type for display
  const formatActivityType = (type: string): string => {
    const labels: Record<string, string> = {
      'created': 'Created',
      'assignment_changed': 'Reassigned',
      'status_changed': 'Status changed',
      'privacy_changed': 'Privacy changed',
      'follower_added': 'Follower added',
      'follower_removed': 'Follower removed',
      'hold_changed': 'Hold changed',
      'confirm_changed': 'Confirmation changed',
      'dates_changed': 'Dates changed',
    };
    return labels[type] || type;
  };

  // Get icon for activity type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'assignment_changed':
        return <Users className="h-3 w-3" />;
      case 'status_changed':
      case 'hold_changed':
      case 'confirm_changed':
        return <Clock className="h-3 w-3" />;
      case 'privacy_changed':
        return <Lock className="h-3 w-3" />;
      case 'follower_added':
      case 'follower_removed':
        return <UserPlus className="h-3 w-3" />;
      default:
        return <History className="h-3 w-3" />;
    }
  };

  const handleAddFollower = async (userId: number) => {
    setFollowersLoading(true);
    try {
      const newFollower = await addFollower(task.id, userId);
      setFollowers(prev => [...prev, newFollower]);
    } catch (error) {
      console.error('Failed to add follower:', error);
    } finally {
      setFollowersLoading(false);
    }
  };

  const handleRemoveFollower = async (userId: number) => {
    setFollowersLoading(true);
    try {
      await removeFollower(task.id, userId);
      setFollowers(prev => prev.filter(f => f.user_id !== userId));
    } catch (error) {
      console.error('Failed to remove follower:', error);
    } finally {
      setFollowersLoading(false);
    }
  };

  // Handler for started checkbox
  const handleStartedChange = async (checked: boolean) => {
    if (loading) return;
    setLoading('started');
    try {
      if (checked) {
        await startTask(task.id);
      } else {
        await updateTask(task.id, { status: 'not_started', started_at: undefined });
      }
    } finally {
      setLoading(null);
    }
  };

  // Handler for hold checkbox
  const handleHoldChange = async (checked: boolean) => {
    if (loading) return;
    setLoading('hold');
    try {
      await setTaskHold(task.id, checked);
    } finally {
      setLoading(null);
    }
  };

  // Handler for confirm - opens date picker first
  const handleConfirmDateSelect = async (date: Date | undefined) => {
    if (!date || loading) return;
    setLoading('confirm');
    try {
      await confirmTask(task.id, format(date, 'yyyy-MM-dd'));
      setConfirmDateOpen(false);
    } finally {
      setLoading(null);
    }
  };

  // Handler for supplier confirm - opens date picker first
  const handleSupplierConfirmDateSelect = async (date: Date | undefined) => {
    if (!date || loading) return;
    setLoading('supplier_confirm');
    try {
      await supplierConfirmTask(task.id, format(date, 'yyyy-MM-dd'));
      setSupplierConfirmDateOpen(false);
    } finally {
      setLoading(null);
    }
  };

  // Handler for completed checkbox
  const handleCompletedChange = async (checked: boolean) => {
    if (loading) return;

    if (checked) {
      // Check if this task has completable linked tasks
      const linkedTasks = getCompletableLinkedTasks(task.id);
      if (linkedTasks.length > 0) {
        // Show cascade completion dialog
        setCascadeDialogOpen(true);
        return;
      }

      // No linked tasks, complete directly
      setLoading('completed');
      try {
        await completeTask(task.id);
      } finally {
        setLoading(null);
      }
    } else {
      // Un-completing - no dialog needed
      setLoading('completed');
      try {
        await updateTask(task.id, { status: 'started', completed_at: undefined });
      } finally {
        setLoading(null);
      }
    }
  };

  // Handler for cascade completion dialog
  const handleCascadeComplete = async (alsoCompleteTaskIds: number[]) => {
    setCascadeDialogLoading(true);
    try {
      await completeTask(task.id, alsoCompleteTaskIds);
      setCascadeDialogOpen(false);
    } finally {
      setCascadeDialogLoading(false);
    }
  };

  // Handler for duration change
  const handleDurationSave = async () => {
    if (duration === task.duration_days) return;
    setLoading('duration');
    try {
      await updateTask(task.id, { duration_days: duration });
    } finally {
      setLoading(null);
    }
  };

  // Handler for assignment change
  const handleAssignmentChange = async (userId?: number, role?: string) => {
    setLoading('assign');
    try {
      if (userId) {
        await updateTask(task.id, { assigned_user_id: userId, assigned_role: undefined });
      } else if (role) {
        await updateTask(task.id, { assigned_role: role, assigned_user_id: undefined });
      }
    } finally {
      setLoading(null);
    }
  };

  // Job search with debounce
  const searchJobs = (query: string) => {
    if (jobSearchTimeout) {
      clearTimeout(jobSearchTimeout);
    }
    const timeout = setTimeout(async () => {
      setJobsLoading(true);
      try {
        const url = query
          ? `/api/v1/jobs/for_select?q=${encodeURIComponent(query)}`
          : '/api/v1/jobs/for_select';
        const response = await api.get<{ jobs?: Job[] }>(url);
        setJobs(response?.jobs || []);
      } catch (error) {
        console.error('Failed to search jobs:', error);
      } finally {
        setJobsLoading(false);
      }
    }, query ? 300 : 0);
    setJobSearchTimeout(timeout);
  };

  // Handle job change
  const handleJobChange = async (jobId: number | null) => {
    setLoading('job');
    try {
      // Call API with job_id (backend expects job_id)
      await api.patch(`/api/v1/sm_tasks/${task.id}`, {
        sm_task: { job_id: jobId }
      });
      // Refresh to get updated data from server (includes job_name)
      await refresh();
    } catch (err) {
      console.error('Failed to update job:', err);
    } finally {
      setLoading(null);
    }
  };

  const handleClose = () => {
    collapseTask();
    onClose?.();
  };

  // Handler for adding an attachment
  const handleAddAttachment = async (attachment: PendingAttachment) => {
    setAttachmentLoading(true);
    try {
      if (attachment.type === 'upload' && attachment.file) {
        // Upload file using multipart form data
        const formData = new FormData();
        formData.append('file', attachment.file);

        const response = await api.postFormData<{ success: boolean; attachment: TaskAttachment; error?: string }>(
          `/api/v1/sm_tasks/${task.id}/attachments/upload`,
          formData
        );

        if (response?.success && response.attachment) {
          setLocalAttachments((prev) => [...prev, response.attachment]);
          setShowAttachmentPicker(false);
        } else {
          console.error('Upload failed:', response?.error);
        }
      } else if (attachment.id) {
        // Link existing email/document
        const response = await api.post<{ success: boolean; attachment: TaskAttachment }>(
          `/api/v1/sm_tasks/${task.id}/attachments`,
          {
            attachment_type: attachment.type,
            attachable_id: attachment.id,
          }
        );

        if (response?.success && response.attachment) {
          setLocalAttachments((prev) => [...prev, response.attachment]);
          setShowAttachmentPicker(false);
        }
      }
    } catch (error) {
      console.error('Failed to add attachment:', error);
    } finally {
      setAttachmentLoading(false);
    }
  };

  const handleRemovePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Direct file drop handler for attachments section
  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // Upload each file
    for (const file of Array.from(files)) {
      setAttachmentLoading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.postFormData<{ success: boolean; attachment: TaskAttachment; error?: string }>(
          `/api/v1/sm_tasks/${task.id}/attachments/upload`,
          formData
        );

        if (response?.success && response.attachment) {
          setLocalAttachments((prev) => [...prev, response.attachment]);
        } else {
          console.error('Upload failed:', response?.error);
        }
      } catch (error) {
        console.error('Failed to upload file:', error);
      }
    }
    setAttachmentLoading(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only show drag state if dragging files
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're actually leaving the drop zone
    // Check if relatedTarget is outside the drop zone
    const relatedTarget = e.relatedTarget as Node | null;
    if (dropZoneRef.current && relatedTarget && !dropZoneRef.current.contains(relatedTarget)) {
      setIsDraggingFile(false);
    } else if (!relatedTarget) {
      // relatedTarget is null when leaving the window
      setIsDraggingFile(false);
    }
  };

  // Save email keywords
  const saveEmailKeywords = async () => {
    if (emailKeywords === task.email_keywords) return;

    setKeywordsSaving(true);
    try {
      await updateTask(task.id, { email_keywords: emailKeywords });
    } catch (error) {
      console.error('Failed to save keywords:', error);
      setEmailKeywords(task.email_keywords || ''); // Revert on error
    } finally {
      setKeywordsSaving(false);
    }
  };

  // Save description
  const saveDescription = async () => {
    if (descriptionText === (task.description || '')) {
      setEditingDescription(false);
      return;
    }

    setDescriptionSaving(true);
    try {
      await updateTask(task.id, { description: descriptionText });
      setEditingDescription(false);
    } catch (error) {
      console.error('Failed to save description:', error);
      setDescriptionText(task.description || ''); // Revert on error
    } finally {
      setDescriptionSaving(false);
    }
  };

  // Save task name
  const saveTaskName = async () => {
    if (taskNameText.trim() === task.name || !taskNameText.trim()) {
      setEditingTaskName(false);
      setTaskNameText(task.name); // Revert if empty
      return;
    }

    setTaskNameSaving(true);
    try {
      await updateTask(task.id, { name: taskNameText.trim() });
      setEditingTaskName(false);
    } catch (error) {
      console.error('Failed to save task name:', error);
      setTaskNameText(task.name); // Revert on error
    } finally {
      setTaskNameSaving(false);
    }
  };

  // Render text with clickable task IDs (e.g., #123 becomes a link)
  const renderTextWithTaskLinks = (text: string) => {
    const parts = text.split(/(#\d+)/g);
    return parts.map((part, index) => {
      const match = part.match(/^#(\d+)$/);
      if (match) {
        const taskId = parseInt(match[1], 10);
        return (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              navigateToTask(taskId);
            }}
            className="text-primary hover:underline font-medium"
          >
            {part}
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Simplified view for delegated questions/actions
  if (task.is_delegated_question) {
    return (
      <DelegatedTaskView
        task={task}
        onClose={onClose}
        onComplete={async () => {
          await completeTask(task.id);
          onClose?.();
        }}
      />
    );
  }

  return (
    <div className="bg-muted/30 border-t border-b px-3 py-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
      {/* Header with prominent colored background */}
      <div className="bg-primary/20 dark:bg-primary/30 border-l-4 border-primary rounded px-3 py-3 -mx-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          {/* Task name - editable */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-mono text-muted-foreground">#{task.task_number}</span>
            {editingTaskName ? (
              <Input
                value={taskNameText}
                onChange={(e) => setTaskNameText(e.target.value)}
                onBlur={saveTaskName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveTaskName();
                  } else if (e.key === 'Escape') {
                    setEditingTaskName(false);
                    setTaskNameText(task.name);
                  }
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-8 text-base font-bold flex-1"
                autoFocus
                disabled={taskNameSaving}
              />
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span
                  className="text-lg font-bold cursor-pointer hover:bg-primary/10 px-2 -mx-2 rounded flex-1"
                  onClick={() => setEditingTaskName(true)}
                  title="Click to edit task name"
                >
                  {task.name}
                </span>
                <Pencil className="h-4 w-4 text-muted-foreground opacity-50" />
              </div>
            )}
            {taskNameSaving && <Spinner size={16} />}
            {task.is_overdue && task.status !== 'completed' && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </Badge>
            )}
          </div>

          {/* Delete and Close buttons */}
          <div className="flex items-center gap-1">
            {/* Delete Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-muted-foreground hover:text-destructive"
              onClick={async () => {
                if (window.confirm(`Delete task "${task.name}"? This cannot be undone.`)) {
                  setLoading('delete');
                  try {
                    await deleteTask(task.id);
                    handleClose();
                  } finally {
                    setLoading(null);
                  }
                }
              }}
              disabled={!!loading}
              title="Delete task"
            >
              {loading === 'delete' ? <Spinner size={12} /> : <Trash2 className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClose} className="h-6 px-2">
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Second row - Privacy, Follow, Share, Status checkboxes */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Privacy Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-2 gap-1",
              task.is_private && "text-amber-600 dark:text-amber-400"
            )}
            onClick={async () => {
              setLoading('privacy');
              try {
                await setTaskPrivacy(task.id, !task.is_private);
              } finally {
                setLoading(null);
              }
            }}
            disabled={!!loading}
            title={task.is_private ? "Task is private - click to make public" : "Click to make private"}
          >
            {loading === 'privacy' ? (
              <Spinner size={12} />
            ) : (
              <Lock className={cn("h-3 w-3", task.is_private ? "fill-current" : "")} />
            )}
            <span className="text-xs">{task.is_private ? 'Private' : 'Public'}</span>
          </Button>

          {/* Follow Button - quick toggle for current user */}
          <Button
            variant={isCurrentUserFollowing ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "h-6 px-2 gap-1",
              isCurrentUserFollowing && "bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
            )}
            onClick={handleToggleFollow}
            disabled={followersLoading}
            title={isCurrentUserFollowing ? "Click to unfollow" : "Click to follow this task"}
          >
            {followersLoading ? (
              <Spinner size={12} />
            ) : (
              <UserPlus className={cn("h-3 w-3", isCurrentUserFollowing && "fill-current text-blue-600 dark:text-blue-400")} />
            )}
            <span className="text-xs">{isCurrentUserFollowing ? 'Following' : 'Follow'}</span>
          </Button>

          {/* Share Button - add other users as followers */}
          <Popover open={shareOpen} onOpenChange={handleShareOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 gap-1"
                title="Add other followers"
              >
                <Users className="h-3 w-3" />
                <span className="text-xs">Share</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-3">
                <div className="font-medium text-sm">Share with</div>

                {followersLoading ? (
                  <div className="flex justify-center py-4">
                    <Spinner size={20} />
                  </div>
                ) : (
                  <>
                    {/* Current followers */}
                    {followers.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Current followers</div>
                        {followers.map((follower) => (
                          <div key={follower.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted">
                            <span className="text-sm">{follower.user_name}</span>
                            <button
                              onClick={() => handleRemoveFollower(follower.user_id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new follower */}
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Add follower</div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {availableUsers
                          .filter(u => !followers.some(f => f.user_id === u.id))
                          .map((user) => (
                            <button
                              key={user.id}
                              onClick={() => handleAddFollower(user.id)}
                              className="w-full flex items-center gap-2 py-1 px-2 rounded hover:bg-muted text-left text-sm"
                            >
                              <UserPlus className="h-3 w-3 text-muted-foreground" />
                              {user.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Show other followers (excluding current user) */}
          {followers.filter(f => f.user_id !== currentUser?.id).length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>→</span>
              {followers.filter(f => f.user_id !== currentUser?.id).map((f, idx, arr) => (
                <span key={f.id}>
                  {f.user_name.split(' ')[0]}{idx < arr.length - 1 ? ',' : ''}
                </span>
              ))}
            </div>
          )}

          {/* Separator */}
          <div className="h-4 w-px bg-border mx-1" />

          {/* Status checkboxes - inline in header */}
          <div className="flex items-center gap-3">
            {/* Started - always shown */}
            <div className="flex items-center gap-1">
              <Checkbox
                id={`started-${task.id}`}
                checked={task.status === 'started' || task.status === 'completed'}
                onCheckedChange={handleStartedChange}
                disabled={!!loading || task.status === 'completed'}
                className={cn("h-4 w-4", statusColors.started)}
              />
              <Label htmlFor={`started-${task.id}`} className="text-xs cursor-pointer">Started</Label>
              {loading === 'started' && <Spinner size={10} />}
            </div>

            {/* Hold - only if linked to job */}
            {isJobLinked && (
              <div className="flex items-center gap-1">
                <Checkbox
                  id={`hold-${task.id}`}
                  checked={task.hold}
                  onCheckedChange={handleHoldChange}
                  disabled={!!loading}
                  className={cn("h-4 w-4", statusColors.hold)}
                />
                <Label htmlFor={`hold-${task.id}`} className="text-xs cursor-pointer">Hold</Label>
                {loading === 'hold' && <Spinner size={10} />}
              </div>
            )}

            {/* Confirmed - only if linked to PO */}
            {isPOTask && (
              <Popover open={confirmDateOpen} onOpenChange={setConfirmDateOpen}>
                <PopoverTrigger asChild>
                  <div className="flex items-center gap-1">
                    <Checkbox
                      id={`confirm-${task.id}`}
                      checked={task.confirm}
                      onCheckedChange={(checked) => {
                        if (checked && !task.confirm) {
                          setConfirmDateOpen(true);
                        } else if (!checked) {
                          updateTask(task.id, { confirm: false });
                        }
                      }}
                      disabled={!!loading}
                      className={cn("h-4 w-4", statusColors.confirm)}
                    />
                    <Label htmlFor={`confirm-${task.id}`} className="text-xs cursor-pointer">Confirmed</Label>
                    {loading === 'confirm' && <Spinner size={10} />}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium">Select Confirmation Date</p>
                    <p className="text-xs text-muted-foreground">Task will be locked to this date</p>
                  </div>
                  <Calendar
                    mode="single"
                    selected={selectedConfirmDate}
                    onSelect={(date) => {
                      setSelectedConfirmDate(date);
                      handleConfirmDateSelect(date);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}

            {/* Supplier - only if linked to PO */}
            {isPOTask && (
              <Popover open={supplierConfirmDateOpen} onOpenChange={setSupplierConfirmDateOpen}>
                <PopoverTrigger asChild>
                  <div className="flex items-center gap-1">
                    <Checkbox
                      id={`supplier-confirm-${task.id}`}
                      checked={task.supplier_confirm}
                      onCheckedChange={(checked) => {
                        if (checked && !task.supplier_confirm) {
                          setSupplierConfirmDateOpen(true);
                        } else if (!checked) {
                          updateTask(task.id, { supplier_confirm: false });
                        }
                      }}
                      disabled={!!loading}
                      className={cn("h-4 w-4", statusColors.supplier_confirm)}
                    />
                    <Label htmlFor={`supplier-confirm-${task.id}`} className="text-xs cursor-pointer">Supplier</Label>
                    {loading === 'supplier_confirm' && <Spinner size={10} />}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium">Supplier Confirmation Date</p>
                    <p className="text-xs text-muted-foreground">Date supplier confirmed delivery</p>
                  </div>
                  <Calendar
                    mode="single"
                    selected={selectedSupplierDate}
                    onSelect={(date) => {
                      setSelectedSupplierDate(date);
                      handleSupplierConfirmDateSelect(date);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}

            {/* Complete - always shown */}
            <div className="flex items-center gap-1">
              <Checkbox
                id={`completed-${task.id}`}
                checked={task.status === 'completed'}
                onCheckedChange={handleCompletedChange}
                disabled={!!loading}
                className={cn("h-4 w-4", statusColors.completed)}
              />
              <Label htmlFor={`completed-${task.id}`} className="text-xs cursor-pointer">Complete</Label>
              {loading === 'completed' && <Spinner size={10} />}
            </div>
          </div>
        </div>
      </div>
      {/* End of colored header box */}

      {/* Description Section - Always show (editable) */}
      <div className="p-2 bg-background/50 rounded border">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-muted-foreground">Description</div>
          {descriptionSaving && <Spinner size={12} />}
        </div>
        {editingDescription ? (
          <textarea
            value={descriptionText}
            onChange={(e) => setDescriptionText(e.target.value)}
            onBlur={saveDescription}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDescriptionText(task.description || '');
                setEditingDescription(false);
              }
            }}
            placeholder="Add a description..."
            className="w-full text-sm bg-transparent border-0 resize-none focus:outline-none focus:ring-0 min-h-[60px]"
            autoFocus
            disabled={descriptionSaving}
          />
        ) : (
          <p
            className="text-sm whitespace-pre-wrap cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded min-h-[24px]"
            onClick={() => setEditingDescription(true)}
            title="Click to edit"
          >
            {task.description ? renderTextWithTaskLinks(task.description) : <span className="text-muted-foreground italic">Click to add description...</span>}
          </p>
        )}
      </div>

      {/* Action Items Section */}
      <div className="p-2 bg-background/50 rounded border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-muted-foreground">Actions & Questions</div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setShowBulkPaste(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Paste List
          </Button>
        </div>
        <div className="space-y-2">
          {task.action_items?.map((item) => (
            <div key={item.id} className="group">
              {/* Action type item (checkbox) */}
              {item.item_type === 'action' && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={async () => {
                      setActionItemLoading(item.id);
                      try {
                        await toggleActionItem(task.id, item.id);
                      } finally {
                        setActionItemLoading(null);
                      }
                    }}
                    disabled={actionItemLoading === item.id || editingItemId === item.id}
                    className="h-4 w-4"
                  />
                  {editingItemId === item.id ? (
                    <Input
                      value={editingItemText}
                      onChange={(e) => setEditingItemText(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && editingItemText.trim()) {
                          setActionItemLoading(item.id);
                          try {
                            await updateActionItem(task.id, item.id, editingItemText.trim());
                            setEditingItemId(null);
                            setEditingItemText('');
                          } finally {
                            setActionItemLoading(null);
                          }
                        } else if (e.key === 'Escape') {
                          setEditingItemId(null);
                          setEditingItemText('');
                        }
                      }}
                      onBlur={async () => {
                        if (editingItemText.trim() && editingItemText.trim() !== item.text) {
                          setActionItemLoading(item.id);
                          try {
                            await updateActionItem(task.id, item.id, editingItemText.trim());
                          } finally {
                            setActionItemLoading(null);
                          }
                        }
                        setEditingItemId(null);
                        setEditingItemText('');
                      }}
                      className="flex-1 h-7 text-sm"
                      autoFocus
                      disabled={actionItemLoading === item.id}
                    />
                  ) : (
                    <span
                      className={cn(
                        "flex-1 text-sm cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded",
                        item.checked && "line-through text-muted-foreground"
                      )}
                      onClick={() => {
                        setEditingItemId(item.id);
                        setEditingItemText(item.text);
                      }}
                      title="Click to edit"
                    >
                      {item.text}
                    </span>
                  )}
                  {actionItemLoading === item.id ? (
                    <Spinner size={12} />
                  ) : editingItemId !== item.id && (
                    <button
                      onClick={async () => {
                        setActionItemLoading(item.id);
                        try {
                          await removeActionItem(task.id, item.id);
                        } finally {
                          setActionItemLoading(null);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Question type item */}
              {item.item_type === 'question' && (
                <div className="pl-1 border-l-2 border-blue-400">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    {editingItemId === item.id ? (
                      <Input
                        value={editingItemText}
                        onChange={(e) => setEditingItemText(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && editingItemText.trim()) {
                            setActionItemLoading(item.id);
                            try {
                              await updateActionItem(task.id, item.id, editingItemText.trim());
                              setEditingItemId(null);
                              setEditingItemText('');
                            } finally {
                              setActionItemLoading(null);
                            }
                          } else if (e.key === 'Escape') {
                            setEditingItemId(null);
                            setEditingItemText('');
                          }
                        }}
                        onBlur={async () => {
                          if (editingItemText.trim() && editingItemText.trim() !== item.text) {
                            setActionItemLoading(item.id);
                            try {
                              await updateActionItem(task.id, item.id, editingItemText.trim());
                            } finally {
                              setActionItemLoading(null);
                            }
                          }
                          setEditingItemId(null);
                          setEditingItemText('');
                        }}
                        className="flex-1 h-7 text-sm"
                        autoFocus
                        disabled={actionItemLoading === item.id}
                      />
                    ) : (
                      <span
                        className="flex-1 text-sm cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded font-medium"
                        onClick={() => {
                          setEditingItemId(item.id);
                          setEditingItemText(item.text);
                        }}
                        title="Click to edit"
                      >
                        {item.text}
                      </span>
                    )}
                    {actionItemLoading === item.id ? (
                      <Spinner size={12} />
                    ) : editingItemId !== item.id && (
                      <button
                        onClick={async () => {
                          setActionItemLoading(item.id);
                          try {
                            await removeActionItem(task.id, item.id);
                          } finally {
                            setActionItemLoading(null);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {/* Answer section */}
                  <div className="ml-6 mt-1">
                    {item.response ? (
                      <div className="text-sm bg-green-50 dark:bg-green-950 p-2 rounded border border-green-200 dark:border-green-800">
                        <div className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-foreground">{item.response}</p>
                            {item.responded_by_name && (
                              <p className="text-xs text-muted-foreground mt-1">
                                — {item.responded_by_name}
                                {item.responded_at && `, ${format(new Date(item.responded_at), 'MMM d')}`}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : item.delegated && item.delegated_task ? (
                      // Delegated - show status
                      <div className="text-sm bg-purple-50 dark:bg-purple-950 p-2 rounded border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-2">
                          <Send className="h-4 w-4 text-purple-600 shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-purple-700 dark:text-purple-300">
                              Sent to <span className="font-medium">{item.delegated_task.assigned_user_name || 'Unknown'}</span>
                              {item.delegated_task.status === 'completed' && ' • Completed'}
                              {item.delegated_task.status === 'started' && ' • In Progress'}
                              {item.delegated_task.status === 'not_started' && ' • Pending'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : delegatingItemId === item.id ? (
                      // User selection for delegation
                      <div className="flex gap-2 items-center">
                        <ComboboxDropdown
                          items={delegationUsers.map(u => ({
                            id: String(u.id),
                            label: u.name,
                          }))}
                          onSelect={async (selected) => {
                            setActionItemLoading(item.id);
                            try {
                              await delegateActionItem(task.id, item.id, parseInt(selected.id));
                              setDelegatingItemId(null);
                            } finally {
                              setActionItemLoading(null);
                            }
                          }}
                          placeholder="Select user..."
                          className="h-7 text-xs w-40"
                        />
                        {actionItemLoading === item.id ? (
                          <Spinner size={12} />
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setDelegatingItemId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : answeringItemId === item.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="Type your answer..."
                          className="flex-1 h-7 text-sm"
                          autoFocus
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && answerText.trim()) {
                              setActionItemLoading(item.id);
                              try {
                                await answerActionItem(task.id, item.id, answerText.trim());
                                setAnsweringItemId(null);
                                setAnswerText('');
                              } finally {
                                setActionItemLoading(null);
                              }
                            } else if (e.key === 'Escape') {
                              setAnsweringItemId(null);
                              setAnswerText('');
                            }
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={async () => {
                            if (!answerText.trim()) return;
                            setActionItemLoading(item.id);
                            try {
                              await answerActionItem(task.id, item.id, answerText.trim());
                              setAnsweringItemId(null);
                              setAnswerText('');
                            } finally {
                              setActionItemLoading(null);
                            }
                          }}
                          disabled={!answerText.trim()}
                        >
                          {actionItemLoading === item.id ? <Spinner size={12} /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => {
                            setAnsweringItemId(null);
                            setAnswerText('');
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setAnsweringItemId(item.id);
                            setAnswerText('');
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline"
                        >
                          + Add answer
                        </button>
                        <button
                          onClick={async () => {
                            setDelegatingItemId(item.id);
                            // Fetch users if not already loaded
                            if (delegationUsers.length === 0) {
                              const response = await api.get<{ users?: User[] } | User[]>('/api/v1/users');
                              const userList = Array.isArray(response) ? response : response?.users || [];
                              setDelegationUsers(userList);
                            }
                          }}
                          className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 hover:underline flex items-center gap-1"
                        >
                          <Send className="h-3 w-3" />
                          Send to...
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add new action/question */}
          <div className="pt-2 border-t border-dashed space-y-2">
            {/* Type selector */}
            <div className="flex gap-1">
              <Button
                variant={newActionItemType === 'action' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setNewActionItemType('action')}
              >
                <ListTodo className="h-3 w-3 mr-1" />
                Action
              </Button>
              <Button
                variant={newActionItemType === 'question' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setNewActionItemType('question')}
              >
                <HelpCircle className="h-3 w-3 mr-1" />
                Question
              </Button>
            </div>
            {/* Input row */}
            <div className="flex items-center gap-2">
              {newActionItemType === 'action' ? (
                <Checkbox disabled className="h-4 w-4 opacity-50" />
              ) : (
                <HelpCircle className="h-4 w-4 text-blue-500 opacity-50" />
              )}
              <Input
                placeholder={newActionItemType === 'action' ? "Add action item..." : "Add question..."}
                value={newActionItemText}
                onChange={(e) => setNewActionItemText(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newActionItemText.trim()) {
                    setActionItemLoading('new');
                    try {
                      await addActionItem(task.id, newActionItemText.trim(), newActionItemType);
                      setNewActionItemText('');
                    } finally {
                      setActionItemLoading(null);
                    }
                  }
                }}
                className="flex-1 h-7 text-sm"
                disabled={actionItemLoading === 'new'}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={async () => {
                  if (!newActionItemText.trim()) return;
                  setActionItemLoading('new');
                  try {
                    await addActionItem(task.id, newActionItemText.trim(), newActionItemType);
                    setNewActionItemText('');
                  } finally {
                    setActionItemLoading(null);
                  }
                }}
                disabled={actionItemLoading === 'new' || !newActionItemText.trim()}
              >
                {actionItemLoading === 'new' ? (
                  <Spinner size={12} />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Bulk Paste Dialog */}
        {showBulkPaste && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-lg shadow-lg p-4 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Paste Questions from Email</h3>
                <button
                  onClick={() => {
                    setShowBulkPaste(false);
                    setBulkPasteText('');
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Paste a list of questions (one per line). They will be added as question items.
              </p>
              <textarea
                className="w-full h-40 border rounded p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="What is the delivery date?&#10;Can you confirm the quantity?&#10;Are there any special requirements?"
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowBulkPaste(false);
                    setBulkPasteText('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!bulkPasteText.trim() || actionItemLoading === 'bulk'}
                  onClick={async () => {
                    const lines = bulkPasteText
                      .split('\n')
                      .map(line => line.trim())
                      .filter(line => line.length > 0);

                    if (lines.length === 0) return;

                    setActionItemLoading('bulk');
                    try {
                      await bulkAddActionItems(
                        task.id,
                        lines.map(text => ({ text, item_type: 'question' as ActionItemType }))
                      );
                      setShowBulkPaste(false);
                      setBulkPasteText('');
                    } finally {
                      setActionItemLoading(null);
                    }
                  }}
                >
                  {actionItemLoading === 'bulk' ? (
                    <Spinner size={12} className="mr-1" />
                  ) : null}
                  Add {bulkPasteText.split('\n').filter(l => l.trim()).length || 0} Questions
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Duration, Job and Assignment */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Duration */}
        <div className="flex items-center gap-2">
          <Label htmlFor={`duration-${task.id}`} className="text-xs text-muted-foreground">
            Duration
          </Label>
          <Input
            id={`duration-${task.id}`}
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
            onBlur={handleDurationSave}
            onKeyDown={(e) => e.key === 'Enter' && handleDurationSave()}
            className="w-16 h-7 text-xs"
            disabled={!!loading}
          />
          <span className="text-xs text-muted-foreground">days</span>
          {loading === 'duration' && <Spinner size={12} />}
        </div>

        {/* Job Assignment */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
          <ComboboxDropdown
            items={jobs.map((job) => ({
              id: String(job.id),
              label: job.name,
              client_name: job.client_name,
            } as ComboboxItem & { client_name?: string }))}
            selectedItem={task.construction_id > 0 ? {
              id: String(task.construction_id),
              label: task.job_name || 'Unknown Job'
            } : undefined}
            onSelect={(item) => handleJobChange(parseInt(item.id))}
            placeholder="Assign to job..."
            clearable
            onClear={() => handleJobChange(null)}
            emptyResults="No jobs found"
            isLoading={jobsLoading}
            onInputChange={searchJobs}
            disableInternalFilter
            className="h-7 text-xs"
            renderListItem={({ item }) => {
              const jobItem = item as ComboboxItem & { client_name?: string };
              return (
                <div className="flex flex-col">
                  <span className="font-medium text-xs">{item.label}</span>
                  {jobItem.client_name && (
                    <span className="text-xs text-muted-foreground">{jobItem.client_name}</span>
                  )}
                </div>
              );
            }}
          />
          {loading === 'job' && <Spinner size={12} />}
        </div>

        {/* Assignment */}
        <div className="flex-1 min-w-[200px] flex items-center gap-2">
          <TaskAssignmentInline
            assignedUserId={task.assigned_user_id}
            assignedRole={task.assigned_role}
            onAssign={handleAssignmentChange}
            disabled={!!loading}
            compact
          />
          {/* Quick assign buttons */}
          {/* "Assign to [last assigner]" - show when last assigner is different from current assignee */}
          {task.last_assigner_id && task.last_assigner_id !== task.assigned_user_id && task.last_assigner_name && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
              onClick={() => handleAssignmentChange(task.last_assigner_id)}
              disabled={!!loading}
            >
              Assign to {task.last_assigner_name.split(' ')[0]}
            </Button>
          )}
          {/* "Assign to me" - when task is assigned to someone else */}
          {task.assigned_user_id !== currentUser?.id && currentUser?.id && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
              onClick={() => handleAssignmentChange(currentUser.id)}
              disabled={!!loading}
            >
              Assign to me
            </Button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {/* Open PO button */}
        {task.purchase_order_id && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => window.open(`/purchase_orders/${task.purchase_order_id}`, '_blank')}
          >
            <ExternalLink className="h-3 w-3" />
            Open PO {task.purchase_order_number && `#${task.purchase_order_number}`}
          </Button>
        )}

        {/* View Documents */}
        {task.construction_id > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => window.open(`/jobs/${task.construction_id}/documents`, '_blank')}
          >
            <FileText className="h-3 w-3" />
            Documents
          </Button>
        )}

      </div>

      {/* Attachments Section with Tabs - Collapsible */}
      <div className="border-t pt-3">
        {(() => {
          const emailAttachments = localAttachments.filter(a => a.email);
          const documentAttachments = localAttachments.filter(a => a.document && !a.email);
          const totalAttachments = emailAttachments.length + documentAttachments.length;

          return (
            <>
              {/* Collapsible header */}
              <button
                onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}
                className="flex items-center gap-2 w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 mb-2 transition-colors"
              >
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Attachments {totalAttachments > 0 && `(${totalAttachments})`}
                </span>
                {attachmentsExpanded ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
                )}
              </button>

              {attachmentsExpanded && (
            <Tabs defaultValue="emails" className="w-full">
              <div className="flex items-center justify-between mb-2">
                <TabsList className="h-7">
                  <TabsTrigger value="emails" className="text-xs h-6 px-2 gap-1">
                    <Mail className="h-3 w-3" />
                    Emails {emailAttachments.length > 0 && `(${emailAttachments.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs h-6 px-2 gap-1">
                    <FileText className="h-3 w-3" />
                    Documents {documentAttachments.length > 0 && `(${documentAttachments.length})`}
                  </TabsTrigger>
                </TabsList>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => setShowAttachmentPicker(!showAttachmentPicker)}
                  disabled={attachmentLoading}
                >
                  {attachmentLoading ? <Spinner size={12} /> : <Plus className="h-3 w-3" />}
                  Add
                </Button>
              </div>

              {/* Attachment Picker */}
              {showAttachmentPicker && (
                <div className="mb-3 p-2 border rounded bg-background">
                  <AttachmentPicker
                    attachments={pendingAttachments}
                    onAdd={handleAddAttachment}
                    onRemove={handleRemovePendingAttachment}
                    jobId={task.construction_id > 0 ? String(task.construction_id) : undefined}
                  />
                </div>
              )}

              {/* Emails Tab */}
              <TabsContent value="emails" className="mt-2">
                {/* Email Keywords */}
                <div className="mb-3 p-2 bg-muted/30 rounded border">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">
                      Auto-match keywords:
                    </Label>
                    <Input
                      value={emailKeywords}
                      onChange={(e) => setEmailKeywords(e.target.value)}
                      onBlur={saveEmailKeywords}
                      onKeyDown={(e) => e.key === 'Enter' && saveEmailKeywords()}
                      placeholder="e.g., DUNS, D-U-N-S, Apple Developer"
                      className="h-6 text-xs flex-1"
                    />
                    {keywordsSaving && <Spinner size={12} />}
                  </div>
                </div>

                {/* Emails Table - SSoT TeeemTableView */}
                <div className="h-[250px] -mx-2">
                  <TeeemTableView
                    tableName="Task Emails"
                    disableSavedViews={true}
                    columns={[
                      {
                        key: "from",
                        label: "From",
                        column_type: "text",
                        width: 160,
                        filterable: true,
                      },
                      {
                        key: "to",
                        label: "To",
                        column_type: "text",
                        width: 160,
                        filterable: true,
                      },
                      {
                        key: "subject",
                        label: "Subject",
                        column_type: "text",
                        width: 280,
                        filterable: true,
                      },
                      {
                        key: "received_at",
                        label: "Date",
                        column_type: "date_and_time",
                        width: 140,
                        sortable: true,
                      },
                      {
                        key: "files",
                        label: "Files",
                        column_type: "whole_number",
                        width: 60,
                      },
                    ]}
                    entries={emailAttachments.map((attachment) => {
                      const email = attachment.email!;
                      return {
                        id: email.id,
                        from: email.from_email || "-",
                        to: email.to_emails?.join(", ") || "-",
                        subject: email.subject || "(no subject)",
                        received_at: email.received_at,
                        files: email.document_attachments_count || 0,
                      };
                    })}
                    viewOnly={true}
                    onRowDoubleClick={(row) => {
                      // Open email detail dialog
                      setSelectedEmailId(Number(row.id));
                    }}
                  />
                </div>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent
                ref={dropZoneRef}
                value="documents"
                className={cn(
                  "mt-2 transition-colors rounded-lg min-h-[60px]",
                  isDraggingFile && "bg-primary/10 border-2 border-dashed border-primary p-4"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleFileDrop}
              >
                {attachmentLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Spinner size={16} />
                    <span className="text-sm text-muted-foreground">Uploading...</span>
                  </div>
                ) : isDraggingFile ? (
                  <p className="text-sm font-medium text-primary text-center py-4">
                    Drop files here to attach
                  </p>
                ) : documentAttachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No documents attached. Drag files here or click Add.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {documentAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-3 p-2 bg-background/50 rounded border hover:bg-muted/50 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-orange-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {attachment.document!.display_name || attachment.document!.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.document!.document_type || 'Document'} • {format(new Date(attachment.document!.created_at), 'dd MMM yyyy')}
                          </p>
                        </div>
                        {(attachment.document!.sharepoint_download_url || attachment.document!.file_url) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs shrink-0"
                            onClick={() => window.open(attachment.document!.sharepoint_download_url || attachment.document!.file_url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Open
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
              )}
            </>
          );
        })()}
      </div>

      {/* History Section */}
      <div className="border-t pt-3">
        <button
          onClick={handleHistoryToggle}
          className="flex items-center gap-2 w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors"
        >
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">History</span>
          {historyLoading ? (
            <Spinner size={12} />
          ) : (
            historyExpanded ? (
              <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
            )
          )}
        </button>

        {historyExpanded && (
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
            {history.length === 0 && !historyLoading && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No history yet
              </p>
            )}
            {history.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 p-2 bg-background/50 rounded border text-xs"
              >
                <div className="mt-0.5 text-muted-foreground">
                  {getActivityIcon(entry.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground">
                    {entry.description || formatActivityType(entry.activity_type)}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {format(new Date(entry.created_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Detail Dialog */}
      <EmailDetailDialog
        emailId={selectedEmailId}
        open={selectedEmailId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEmailId(null);
        }}
      />

      {/* Cascade Completion Dialog */}
      <CascadeCompletionDialog
        open={cascadeDialogOpen}
        onOpenChange={setCascadeDialogOpen}
        taskName={task.name}
        linkedTasks={getCompletableLinkedTasks(task.id).map(t => ({
          id: t.id,
          name: t.name,
          status: t.status,
        }))}
        onComplete={handleCascadeComplete}
        loading={cascadeDialogLoading}
      />
    </div>
  );
}
