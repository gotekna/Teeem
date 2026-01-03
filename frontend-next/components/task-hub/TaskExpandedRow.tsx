'use client';

import { useState, useEffect } from 'react';
import { SmTask, TaskAttachment, TaskActionItem, TaskFollower, useTaskHub } from '@/contexts/TaskHubContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Spinner } from "@/components/ui/spinner";
import { TaskAssignmentInline } from './TaskAssignmentInline';
import { AttachmentPicker, PendingAttachment } from './AttachmentPicker';
import { api } from '@/lib/api';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  History,
  Lock,
  Mail,
  Paperclip,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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

export function TaskExpandedRow({ task, onClose }: TaskExpandedRowProps) {
  const {
    updateTask,
    startTask,
    completeTask,
    setTaskHold,
    confirmTask,
    supplierConfirmTask,
    collapseTask,
    addActionItem,
    toggleActionItem,
    removeActionItem,
    setTaskPrivacy,
    getFollowers,
    addFollower,
    removeFollower,
    deleteTask,
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
  const [actionItemLoading, setActionItemLoading] = useState<number | 'new' | null>(null);

  // Share/Followers state
  const [shareOpen, setShareOpen] = useState(false);
  const [followers, setFollowers] = useState<TaskFollower[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  // Direct drag-and-drop state for attachments section
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // History state
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);

  // Load followers on mount for all tasks
  useEffect(() => {
    getFollowers(task.id).then(setFollowers).catch(console.error);
  }, [task.id, getFollowers]);

  // Check if this is a PO task
  const isPOTask = !!task.purchase_order_id;

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
    setLoading('completed');
    try {
      if (checked) {
        await completeTask(task.id);
      } else {
        await updateTask(task.id, { status: 'started', completed_at: undefined });
      }
    } finally {
      setLoading(null);
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
    setIsDraggingFile(false);
  };

  return (
    <div className="bg-muted/30 border-t border-b px-3 py-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
      {/* Header with close button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Task #{task.task_number}</span>
          {task.is_overdue && task.status !== 'completed' && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 gap-1">
              <AlertTriangle className="h-3 w-3" />
              Overdue
            </Badge>
          )}
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

          {/* Show followers for public tasks (no share button needed) */}
          {!task.is_private && followers.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>→</span>
              {followers.map((f, idx) => (
                <span key={f.id}>
                  {f.user_name.split(' ')[0]}{idx < followers.length - 1 ? ',' : ''}
                </span>
              ))}
            </div>
          )}

          {/* Share Button (only for private tasks) */}
          {task.is_private && (
            <>
              <Popover open={shareOpen} onOpenChange={handleShareOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 gap-1"
                    title="Share with others"
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

            {/* Show followers to the right of Share button */}
            {followers.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>→</span>
                {followers.map((f, idx) => (
                  <span key={f.id}>
                    {f.user_name.split(' ')[0]}{idx < followers.length - 1 ? ',' : ''}
                  </span>
                ))}
              </div>
            )}
            </>
          )}
        </div>
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

      {/* Status checkboxes - Always visible */}
      <div className="flex flex-wrap items-center gap-4 p-2 bg-background/50 rounded border">
          {/* Started */}
          <div className="flex items-center gap-2">
            <Checkbox
              id={`started-${task.id}`}
              checked={task.status === 'started' || task.status === 'completed'}
              onCheckedChange={handleStartedChange}
              disabled={!!loading || task.status === 'completed'}
              className={cn(statusColors.started)}
            />
            <Label htmlFor={`started-${task.id}`} className="text-xs cursor-pointer">
              Started
            </Label>
            {loading === 'started' && <Spinner size={12} />}
          </div>

          {/* Hold */}
          <div className="flex items-center gap-2">
            <Checkbox
              id={`hold-${task.id}`}
              checked={task.hold}
              onCheckedChange={handleHoldChange}
              disabled={!!loading}
              className={cn(statusColors.hold)}
            />
            <Label htmlFor={`hold-${task.id}`} className="text-xs cursor-pointer">
              Hold
            </Label>
            {loading === 'hold' && <Spinner size={12} />}
          </div>

          {/* Confirm with date picker */}
          <div className="flex items-center gap-2">
            <Popover open={confirmDateOpen} onOpenChange={setConfirmDateOpen}>
              <PopoverTrigger asChild>
                <div className="flex items-center gap-2">
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
                    className={cn(statusColors.confirm)}
                  />
                  <Label htmlFor={`confirm-${task.id}`} className="text-xs cursor-pointer">
                    Confirmed
                  </Label>
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
            {loading === 'confirm' && <Spinner size={12} />}
          </div>

          {/* Supplier Confirm with date picker */}
          <div className="flex items-center gap-2">
            <Popover open={supplierConfirmDateOpen} onOpenChange={setSupplierConfirmDateOpen}>
              <PopoverTrigger asChild>
                <div className="flex items-center gap-2">
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
                    className={cn(statusColors.supplier_confirm)}
                  />
                  <Label htmlFor={`supplier-confirm-${task.id}`} className="text-xs cursor-pointer">
                    Supplier
                  </Label>
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
            {loading === 'supplier_confirm' && <Spinner size={12} />}
          </div>

          {/* Completed */}
          <div className="flex items-center gap-2">
            <Checkbox
              id={`completed-${task.id}`}
              checked={task.status === 'completed'}
              onCheckedChange={handleCompletedChange}
              disabled={!!loading}
              className={cn(statusColors.completed)}
            />
            <Label htmlFor={`completed-${task.id}`} className="text-xs cursor-pointer">
              Done
            </Label>
            {loading === 'completed' && <Spinner size={12} />}
          </div>
        </div>

      {/* Description Section */}
      {task.description && (
        <div className="p-2 bg-background/50 rounded border">
          <div className="text-xs text-muted-foreground mb-1">Description</div>
          <p className="text-sm whitespace-pre-wrap">{task.description}</p>
        </div>
      )}

      {/* Action Items Section */}
      {(task.action_items?.length || 0) > 0 || true ? (
        <div className="p-2 bg-background/50 rounded border">
          <div className="text-xs text-muted-foreground mb-2">Action Items</div>
          <div className="space-y-1">
            {task.action_items?.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 group"
              >
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
                  disabled={actionItemLoading === item.id}
                  className="h-4 w-4"
                />
                <span className={cn(
                  "flex-1 text-sm",
                  item.checked && "line-through text-muted-foreground"
                )}>
                  {item.text}
                </span>
                {actionItemLoading === item.id ? (
                  <Spinner size={12} />
                ) : (
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
            ))}
            {/* Add new action item */}
            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="Add action item..."
                value={newActionItemText}
                onChange={(e) => setNewActionItemText(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newActionItemText.trim()) {
                    setActionItemLoading('new');
                    try {
                      await addActionItem(task.id, newActionItemText.trim());
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
                    await addActionItem(task.id, newActionItemText.trim());
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
      ) : null}

      {/* Duration and Assignment */}
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

        {/* Assignment */}
        <div className="flex-1 min-w-[200px]">
          <TaskAssignmentInline
            assignedUserId={task.assigned_user_id}
            assignedRole={task.assigned_role}
            onAssign={handleAssignmentChange}
            disabled={!!loading}
            compact
          />
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

      {/* Attachments Section - Drop Zone */}
      <div
        className={cn(
          "border-t pt-3 transition-colors rounded-lg",
          isDraggingFile && "bg-primary/10 border-2 border-dashed border-primary"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleFileDrop}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className={cn(
              "text-xs font-medium",
              isDraggingFile ? "text-primary" : "text-muted-foreground"
            )}>
              {isDraggingFile ? "Drop files here to attach" : `Attachments ${localAttachments.length > 0 ? `(${localAttachments.length})` : ""}`}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => setShowAttachmentPicker(!showAttachmentPicker)}
            disabled={attachmentLoading}
          >
            {attachmentLoading ? (
              <Spinner size={12} />
            ) : (
              <Plus className="h-3 w-3" />
            )}
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

        {/* Existing Attachments */}
        {localAttachments.length > 0 && (
          <div className="space-y-2">
            {localAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-2 bg-background/50 rounded border hover:bg-muted/50 transition-colors"
              >
                {attachment.email ? (
                  <>
                    <Mail className="h-4 w-4 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.email.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        From: {attachment.email.from_email} • {format(new Date(attachment.email.received_at), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs shrink-0"
                      onClick={() => window.open(`/email?id=${attachment.email!.id}`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </>
                ) : attachment.document ? (
                  <>
                    <FileText className="h-4 w-4 text-orange-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {attachment.document.display_name || attachment.document.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {attachment.document.document_type || 'Document'} • {format(new Date(attachment.document.created_at), 'dd MMM yyyy')}
                      </p>
                    </div>
                    {attachment.document.sharepoint_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs shrink-0"
                        onClick={() => window.open(attachment.document!.sharepoint_url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Unknown attachment type</span>
                )}
              </div>
            ))}
          </div>
        )}

        {localAttachments.length === 0 && !showAttachmentPicker && !isDraggingFile && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No attachments yet • Drag files here or click Add
          </p>
        )}
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
    </div>
  );
}
