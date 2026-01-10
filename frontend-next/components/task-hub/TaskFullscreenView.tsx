'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { SmTask, TaskAttachment, TaskActionItem, TaskFollower, useTaskHub, ActionItemType, AttachmentCategory } from '@/contexts/TaskHubContext';
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
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  GripVertical,
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
import DocumentPreviewModal from '@/components/corporate/DocumentPreviewModal';
import { AttachmentCategoryDialog } from './AttachmentCategoryDialog';
import { ComposeEmailModal } from '@/components/emails/ComposeEmailModal';

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

// Sortable question/header item component
interface SortableQuestionItemProps {
  item: TaskActionItem;
  task?: SmTask;
  isHeader?: boolean;
  isCollapsed?: boolean;
  isDropTarget?: boolean;  // Visual feedback when item is being dragged over
  onToggleCollapse?: () => void;
  onEdit: (text: string) => void;
  onRemove: () => void;
  onAddChild?: () => void;  // For adding question under header
  onFileDrop?: (file: File, itemId: number) => void;  // For dropping files on questions
  editingItemId: number | null;
  editingItemText: string;
  setEditingItemText: (text: string) => void;
  handleUpdateItem: (id: number) => void;
  setEditingItemId: (id: number | null) => void;
  childCount?: number;
  // Question-specific props
  toggleIncludeInResponse?: (taskId: number, itemId: number) => void;
  answeringItemId?: number | null;
  setAnsweringItemId?: (id: number | null) => void;
  answerText?: string;
  setAnswerText?: (text: string) => void;
  handleAnswerItem?: (id: number) => void;
  editingAnswerId?: number | null;
  setEditingAnswerId?: (id: number | null) => void;
  editingAnswerText?: string;
  setEditingAnswerText?: (text: string) => void;
  handleUpdateAnswer?: (id: number) => void;
  delegatingQuestionId?: number | null;
  setDelegatingQuestionId?: (id: number | null) => void;
  delegationUsers?: User[];
  handleDelegateQuestion?: (itemId: number, userId: number) => void;
}

function SortableQuestionItem({
  item,
  task,
  isHeader = false,
  isCollapsed = false,
  isDropTarget = false,
  onToggleCollapse,
  onEdit,
  onRemove,
  onAddChild,
  onFileDrop,
  editingItemId,
  editingItemText,
  setEditingItemText,
  handleUpdateItem,
  setEditingItemId,
  childCount = 0,
  toggleIncludeInResponse,
  answeringItemId,
  setAnsweringItemId,
  answerText,
  setAnswerText,
  handleAnswerItem,
  editingAnswerId,
  setEditingAnswerId,
  editingAnswerText,
  setEditingAnswerText,
  handleUpdateAnswer,
  delegatingQuestionId,
  setDelegatingQuestionId,
  delegationUsers,
  handleDelegateQuestion,
}: SortableQuestionItemProps) {
  const [isFileDropTarget, setIsFileDropTarget] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isHeader) {
    // Header rendering
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-2 p-2 bg-muted/50 rounded-md font-medium text-sm transition-all",
          isDragging && "shadow-lg opacity-50",
          isDropTarget && "ring-2 ring-primary ring-offset-2 bg-primary/10"
        )}
      >
        <div {...attributes} {...listeners} className="cursor-grab touch-none">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <button onClick={onToggleCollapse} className="shrink-0">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
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
            className="h-6 text-sm font-medium flex-1"
            autoFocus
          />
        ) : (
          <span
            className="flex-1 cursor-pointer"
            onClick={() => onEdit(item.text)}
          >
            {item.text}
          </span>
        )}
        {isCollapsed && childCount > 0 && !isDropTarget && (
          <span className="text-xs text-muted-foreground">
            ({childCount} questions)
          </span>
        )}
        {isDropTarget && (
          <span className="text-xs text-primary font-medium animate-pulse">
            Drop to add here
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs shrink-0"
          onClick={onAddChild}
          title="Add question to this header"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Question rendering
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-2 rounded-md border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-sm space-y-2",
        isDragging && "shadow-lg"
      )}
    >
      <div className="flex items-start gap-2">
        <div {...attributes} {...listeners} className="cursor-grab touch-none mt-0.5">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        {/* Include in response checkbox */}
        {toggleIncludeInResponse && task && (
          <Checkbox
            checked={item.include_in_response || false}
            onCheckedChange={() => toggleIncludeInResponse(task.id, item.id)}
            className="mt-0.5 shrink-0 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            title="Include Q&A in response email"
          />
        )}
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
            onClick={() => onEdit(item.text)}
          >
            {item.text}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Answer section */}
      {item.response ? (
        editingAnswerId === item.id ? (
          <div className="ml-6 flex gap-2">
            <Input
              value={editingAnswerText}
              onChange={(e) => setEditingAnswerText?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdateAnswer?.(item.id);
                if (e.key === 'Escape') {
                  setEditingAnswerId?.(null);
                  setEditingAnswerText?.('');
                }
              }}
              className="h-7 text-sm"
              autoFocus
            />
            <Button size="sm" onClick={() => handleUpdateAnswer?.(item.id)} className="h-7">
              <Check className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div
            className="ml-6 p-2 rounded bg-green-50 dark:bg-green-950/30 border-l-2 border-green-500 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40"
            onClick={() => {
              setEditingAnswerId?.(item.id);
              setEditingAnswerText?.(item.response || '');
            }}
          >
            <span className="text-xs text-green-600 dark:text-green-400">Answer:</span>
            <p className="text-sm">{item.response}</p>
          </div>
        )
      ) : answeringItemId === item.id ? (
        <div className="ml-6 flex gap-2">
          <Input
            value={answerText}
            onChange={(e) => setAnswerText?.(e.target.value)}
            placeholder="Type answer..."
            className="h-7 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAnswerItem?.(item.id);
              if (e.key === 'Escape') {
                setAnsweringItemId?.(null);
                setAnswerText?.('');
              }
            }}
            autoFocus
          />
          <Button size="sm" onClick={() => handleAnswerItem?.(item.id)} className="h-7">
            <Send className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="ml-6">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setAnsweringItemId?.(item.id)}
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
            items={(delegationUsers || []).map(u => ({ id: u.id.toString(), label: u.name }))}
            placeholder="Select person..."
            onSelect={(selected) => handleDelegateQuestion?.(item.id, parseInt(selected.id))}
            className="h-6 text-xs w-40"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setDelegatingQuestionId?.(null)}
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
            onClick={() => setDelegatingQuestionId?.(item.id)}
          >
            → Task
          </Button>
        </div>
      )}
    </div>
  );
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
    toggleIncludeInResponse,
    reorderActionItems,
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
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  // File drop and category selection
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTargetColumn, setDragTargetColumn] = useState<'attachments' | 'questions' | null>(null);

  // Editing answers inline
  const [editingAnswerId, setEditingAnswerId] = useState<number | null>(null);
  const [editingAnswerText, setEditingAnswerText] = useState('');

  // Email compose for responses
  const [showComposeEmail, setShowComposeEmail] = useState(false);

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
  const [collapsedHeaders, setCollapsedHeaders] = useState<Set<number>>(new Set());

  // Adding header mode (when user clicks "+ Add Header")
  const [addingHeaderText, setAddingHeaderText] = useState('');
  const [showAddHeader, setShowAddHeader] = useState(false);

  // Adding question to specific header
  const [addingToHeaderId, setAddingToHeaderId] = useState<number | null>(null);
  const [addingToHeaderText, setAddingToHeaderText] = useState('');

  // Drag-drop state for visual feedback
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [overHeaderId, setOverHeaderId] = useState<number | null>(null);

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

  // Split document attachments by category
  const infoAttachments = documentAttachments.filter(a => a.category !== 'response');
  const responseAttachments = documentAttachments.filter(a => a.category === 'response');

  // Filter action items
  const actionItems = task.action_items?.filter(item => item.item_type === 'action') || [];
  const questionItems = task.action_items?.filter(item => item.item_type === 'question') || [];
  const headerItems = task.action_items?.filter(item => item.item_type === 'header') || [];

  // Group questions by parent header
  const groupedQuestions = useMemo(() => {
    const headers = headerItems.map(h => ({
      ...h,
      children: questionItems.filter(q => q.parent_item_id === h.id).sort((a, b) => a.position - b.position)
    })).sort((a, b) => a.position - b.position);

    const ungrouped = questionItems.filter(q => !q.parent_item_id).sort((a, b) => a.position - b.position);

    // Create flat list for drag-drop (headers first, then their children, then ungrouped)
    const allItems: TaskActionItem[] = [];
    headers.forEach(h => {
      allItems.push(h);
      if (!collapsedHeaders.has(h.id)) {
        allItems.push(...h.children);
      }
    });
    allItems.push(...ungrouped);

    return { headers, ungrouped, allItems };
  }, [headerItems, questionItems, collapsedHeaders]);

  // dnd-kit sensors for drag-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Toggle header collapse
  const toggleHeaderCollapse = useCallback((headerId: number) => {
    setCollapsedHeaders(prev => {
      const next = new Set(prev);
      if (next.has(headerId)) next.delete(headerId);
      else next.add(headerId);
      return next;
    });
  }, []);

  // Handle drag start - track what's being dragged
  const handleDragStart = useCallback((event: { active: { id: number | string } }) => {
    setActiveDragId(Number(event.active.id));
  }, []);

  // Handle drag over - track if we're over a header for visual feedback
  const handleDndDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverHeaderId(null);
      return;
    }

    const overId = Number(over.id);
    const overItem = groupedQuestions.allItems.find(item => item.id === overId);

    if (overItem?.item_type === 'header') {
      setOverHeaderId(overId);
    } else {
      setOverHeaderId(null);
    }
  }, [groupedQuestions.allItems]);

  // Handle drag end for reordering
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragId(null);
    setOverHeaderId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const allItems = groupedQuestions.allItems;
    const oldIndex = allItems.findIndex(item => item.id === active.id);
    const newIndex = allItems.findIndex(item => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const draggedItem = allItems[oldIndex];
    const targetItem = allItems[newIndex];

    // Determine new parent based on where we're dropping
    let newParentId: number | null = null;
    if (targetItem.item_type === 'header') {
      // Dropping ON a header - become child of that header
      newParentId = targetItem.id;
    } else if (targetItem.parent_item_id) {
      // Dropping next to a child - become sibling (same parent)
      newParentId = targetItem.parent_item_id;
    }
    // else: dropping in ungrouped area, newParentId stays null

    // Build new order
    const reorderedItems = arrayMove(allItems, oldIndex, newIndex);

    // Calculate new positions and parent assignments
    const updates = reorderedItems.map((item, index) => ({
      id: item.id,
      position: index,
      parent_item_id: item.id === draggedItem.id ? newParentId : (item.parent_item_id ?? null)
    }));

    await reorderActionItems(task.id, updates);
  }, [groupedQuestions.allItems, reorderActionItems, task.id]);

  // Add header
  const handleAddHeader = useCallback(async () => {
    if (!addingHeaderText.trim()) return;
    setActionItemLoading('new');
    try {
      await addActionItem(task.id, addingHeaderText, 'header');
      setAddingHeaderText('');
      setShowAddHeader(false);
    } catch (err) {
      console.error('Failed to add header:', err);
    } finally {
      setActionItemLoading(null);
    }
  }, [addActionItem, addingHeaderText, task.id]);

  // Add question under a specific header
  const handleAddQuestionToHeader = useCallback(async (headerId: number) => {
    if (!addingToHeaderText.trim()) return;
    setActionItemLoading('new');
    try {
      await addActionItem(task.id, addingToHeaderText, 'question', headerId);
      setAddingToHeaderText('');
      setAddingToHeaderId(null);
      // Expand header if collapsed
      setCollapsedHeaders(prev => {
        const next = new Set(prev);
        next.delete(headerId);
        return next;
      });
    } catch (err) {
      console.error('Failed to add question to header:', err);
    } finally {
      setActionItemLoading(null);
    }
  }, [addActionItem, addingToHeaderText, task.id]);

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

    // Parse indentation to create headers and children
    // Lines starting with tab or 2+ spaces are children of the previous non-indented line
    const parsedItems: Array<{ text: string; item_type: ActionItemType; isChild: boolean }> = [];

    lines.forEach((line) => {
      const isIndented = /^(\t|  +)/.test(line);
      const cleanText = line.replace(/^(\t|  +)/, '').trim();

      if (isIndented && parsedItems.length > 0) {
        // This is a child - mark it
        parsedItems.push({ text: cleanText, item_type: newActionItemType, isChild: true });
      } else {
        // This is a potential header or standalone item
        parsedItems.push({ text: cleanText, item_type: newActionItemType, isChild: false });
      }
    });

    // Now determine which non-indented items should be headers
    // A non-indented item becomes a header if the next item is indented
    const itemsToCreate: Array<{ text: string; item_type: ActionItemType; parent_index?: number }> = [];
    let currentHeaderIndex: number | null = null;

    parsedItems.forEach((item, index) => {
      if (!item.isChild) {
        // Check if next item is a child
        const nextItem = parsedItems[index + 1];
        if (nextItem?.isChild) {
          // This becomes a header
          itemsToCreate.push({ text: item.text, item_type: 'header' });
          currentHeaderIndex = itemsToCreate.length - 1;
        } else {
          // Standalone item
          itemsToCreate.push({ text: item.text, item_type: newActionItemType });
          currentHeaderIndex = null;
        }
      } else {
        // Child item - associate with current header
        itemsToCreate.push({
          text: item.text,
          item_type: newActionItemType,
          parent_index: currentHeaderIndex ?? undefined
        });
      }
    });

    // Create items - first create headers, then children with parent references
    // For now, create all items and let the backend handle positioning
    // We need to create headers first to get their IDs
    const headerItems = itemsToCreate.filter(i => i.item_type === 'header');
    const nonHeaderItems = itemsToCreate.filter(i => i.item_type !== 'header');

    try {
      // Create headers first
      const createdHeaders: { index: number; id: number }[] = [];
      for (let i = 0; i < headerItems.length; i++) {
        const header = headerItems[i];
        const originalIndex = itemsToCreate.indexOf(header);
        const created = await addActionItem(task.id, header.text, 'header');
        createdHeaders.push({ index: originalIndex, id: created.id });
      }

      // Create non-header items with parent references
      const itemsWithParents = nonHeaderItems.map(item => {
        let parentId: number | undefined;
        if (item.parent_index !== undefined) {
          const headerInfo = createdHeaders.find(h => h.index === item.parent_index);
          parentId = headerInfo?.id;
        }
        return {
          text: item.text,
          item_type: item.item_type,
          parent_item_id: parentId
        };
      });

      if (itemsWithParents.length > 0) {
        // When pasting questions, also create linked action items (but only for non-header items without parents)
        const createLinkedActions = newActionItemType === 'question' && !itemsWithParents.some(i => i.parent_item_id);
        await bulkAddActionItems(task.id, itemsWithParents, createLinkedActions);
      }
    } catch (err) {
      console.error('Failed to bulk add items:', err);
    }

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

  // File drop handlers
  const handleFileDrop = (file: File) => {
    setPendingFile(file);
    setShowCategoryDialog(true);
  };

  const handleCategorySelect = async (category: AttachmentCategory) => {
    if (!pendingFile) return;

    setAttachmentLoading(true);
    setShowCategoryDialog(false);

    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      formData.append('category', category);

      const response = await api.postFormData<{ success: boolean; attachment: TaskAttachment }>(
        `/api/v1/sm_tasks/${task.id}/attachments/upload`,
        formData
      );

      if (response?.success && response.attachment) {
        setLocalAttachments(prev => [...prev, response.attachment]);
      }
    } catch (err) {
      console.error('Failed to upload file:', err);
    } finally {
      setAttachmentLoading(false);
      setPendingFile(null);
    }
  };

  const handleCategoryCancel = () => {
    setShowCategoryDialog(false);
    setPendingFile(null);
  };

  // Helper to upload file directly with a category (bypasses dialog)
  const uploadFileWithCategory = async (file: File, category: AttachmentCategory) => {
    console.log('[TaskFullscreenView] uploadFileWithCategory:', file.name, 'category:', category);
    setAttachmentLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      const response = await api.postFormData<{ success: boolean; attachment: TaskAttachment }>(
        `/api/v1/sm_tasks/${task.id}/attachments/upload`,
        formData
      );

      console.log('[TaskFullscreenView] Upload response:', response);

      if (response?.success && response.attachment) {
        console.log('[TaskFullscreenView] Adding attachment to local state:', response.attachment);
        setLocalAttachments(prev => [...prev, response.attachment]);
      } else {
        console.error('[TaskFullscreenView] Upload failed or no attachment in response:', response);
      }
    } catch (err) {
      console.error('[TaskFullscreenView] Failed to upload file:', err);
    } finally {
      setAttachmentLoading(false);
    }
  };

  // Drag and drop handlers for the attachment column
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragTargetColumn('attachments');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragTargetColumn(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragTargetColumn(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileDrop(files[0]);
    }
  };

  // Drag and drop handlers for the Questions column (auto-categorizes as response)
  const handleQuestionsDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTargetColumn('questions');
  };

  const handleQuestionsDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTargetColumn(null);
  };

  const handleQuestionsDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTargetColumn(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      console.log('[TaskFullscreenView] Dropping file as response:', files[0].name);
      // Auto-upload as response (skip category dialog)
      await uploadFileWithCategory(files[0], 'response');
    }
  };

  // Handler for updating an answer inline
  const handleUpdateAnswer = async (itemId: number) => {
    if (!editingAnswerText.trim()) return;
    setActionItemLoading(itemId);
    await answerActionItem(task.id, itemId, editingAnswerText.trim());
    setEditingAnswerId(null);
    setEditingAnswerText('');
    setActionItemLoading(null);
  };

  // Generate response email body with Q&A, actions, and file links
  const generateResponseBody = (): string => {
    let body = '';

    // Add questions marked for inclusion in response (with answers)
    const includedQuestions = questionItems.filter(q => q.include_in_response && q.response);
    if (includedQuestions.length > 0) {
      body += 'Responses to your questions:\n\n';
      includedQuestions.forEach((q, i) => {
        body += `${i + 1}. ${q.text}\n`;
        body += `   → ${q.response}\n\n`;
      });
    }

    // Add actions marked for inclusion in response
    const includedActions = actionItems.filter(a => a.include_in_response);
    if (includedActions.length > 0) {
      body += body ? '\n' : '';
      body += 'Actions completed:\n\n';
      includedActions.forEach((a, i) => {
        const status = a.checked ? '✓' : '○';
        body += `${status} ${a.text}\n`;
      });
      body += '\n';
    }

    // Add response file links with document names
    if (responseAttachments.length > 0) {
      body += body ? '\n' : '';
      body += 'See attached:\n';
      responseAttachments.forEach(att => {
        const fileName = att.document?.display_name || att.document?.file_name || 'Document';
        const url = att.sharepoint_url || att.document?.sharepoint_url;
        if (url) {
          body += `• ${fileName} - ${url}\n`;
        } else {
          body += `• ${fileName}\n`;
        }
      });
    }

    return body.trim();
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
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">Actions</h2>
                <Badge variant="secondary" className="text-xs">{actionItems.length}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  setNewActionItemType('action');
                  setShowBulkPaste(true);
                }}
              >
                + Paste List
              </Button>
            </div>

            {/* Add action input */}
            <div className="flex gap-2 mb-3 shrink-0">
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
            <div className="flex-1 overflow-auto space-y-1 min-h-0">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "p-2 rounded-md border bg-card text-sm group space-y-1",
                    item.checked && "bg-muted/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {/* Include in response checkbox */}
                    <Checkbox
                      checked={item.include_in_response || false}
                      onCheckedChange={() => toggleIncludeInResponse(task.id, item.id)}
                      className="mt-0.5 shrink-0 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                      title="Include in response email"
                    />
                    {/* Completion checkbox */}
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

          </div>

          {/* Column 3: Questions */}
          <div
            className={cn(
              "flex flex-col h-full relative",
              dragTargetColumn === 'questions' && "after:absolute after:inset-0 after:border-2 after:border-dashed after:border-green-500 after:bg-green-500/5 after:rounded-lg after:pointer-events-none"
            )}
            onDragOver={handleQuestionsDragOver}
            onDragLeave={handleQuestionsDragLeave}
            onDrop={handleQuestionsDrop}
          >
            {/* Drag overlay message for questions */}
            {dragTargetColumn === 'questions' && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium text-sm shadow-lg">
                  Drop to attach as Response
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">Questions</h2>
                <Badge variant="secondary" className="text-xs">{questionItems.length + headerItems.length}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setShowAddHeader(!showAddHeader)}
                >
                  + Header
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    setNewActionItemType('question');
                    setShowBulkPaste(true);
                  }}
                >
                  + Paste List
                </Button>
              </div>
            </div>

            {/* Add header input (when + Header clicked) */}
            {showAddHeader && (
              <div className="flex gap-2 mb-2 shrink-0">
                <Input
                  placeholder="Header name..."
                  value={addingHeaderText}
                  onChange={(e) => setAddingHeaderText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddHeader();
                    if (e.key === 'Escape') {
                      setShowAddHeader(false);
                      setAddingHeaderText('');
                    }
                  }}
                  className="h-8 text-sm font-medium"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleAddHeader}
                  disabled={!addingHeaderText.trim() || actionItemLoading === 'new'}
                  className="h-8 shrink-0"
                >
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddHeader(false);
                    setAddingHeaderText('');
                  }}
                  className="h-8 shrink-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Add question input */}
            <div className="flex gap-2 mb-3 shrink-0">
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

            {/* Question items list with drag-drop */}
            <div className="flex-1 overflow-auto space-y-2 min-h-0">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDndDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={groupedQuestions.allItems.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {/* Headers with their children */}
                  {groupedQuestions.headers.map((header) => (
                    <div key={header.id} className="space-y-1">
                      {/* Header row */}
                      <SortableQuestionItem
                        item={header}
                        isHeader
                        isCollapsed={collapsedHeaders.has(header.id)}
                        isDropTarget={overHeaderId === header.id && activeDragId !== header.id}
                        onToggleCollapse={() => toggleHeaderCollapse(header.id)}
                        onEdit={(text) => {
                          setEditingItemId(header.id);
                          setEditingItemText(text);
                        }}
                        onRemove={() => handleRemoveItem(header.id)}
                        onAddChild={() => {
                          setAddingToHeaderId(header.id);
                          setAddingToHeaderText('');
                          // Expand header when adding
                          setCollapsedHeaders(prev => {
                            const next = new Set(prev);
                            next.delete(header.id);
                            return next;
                          });
                        }}
                        editingItemId={editingItemId}
                        editingItemText={editingItemText}
                        setEditingItemText={setEditingItemText}
                        handleUpdateItem={handleUpdateItem}
                        setEditingItemId={setEditingItemId}
                        childCount={header.children.length}
                      />

                      {/* Children (if expanded) or adding input */}
                      {(!collapsedHeaders.has(header.id) || addingToHeaderId === header.id) && (
                        <div className="ml-4 border-l-2 border-muted pl-2 space-y-2">
                          {/* Add question input for this header */}
                          {addingToHeaderId === header.id && (
                            <div className="flex gap-2">
                              <Input
                                value={addingToHeaderText}
                                onChange={(e) => setAddingToHeaderText(e.target.value)}
                                placeholder="Add question to this group..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && addingToHeaderText.trim()) {
                                    handleAddQuestionToHeader(header.id);
                                  }
                                  if (e.key === 'Escape') {
                                    setAddingToHeaderId(null);
                                    setAddingToHeaderText('');
                                  }
                                }}
                                className="h-8 text-sm flex-1"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => handleAddQuestionToHeader(header.id)}
                                disabled={!addingToHeaderText.trim() || actionItemLoading === 'new'}
                                className="h-8"
                              >
                                Add
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAddingToHeaderId(null);
                                  setAddingToHeaderText('');
                                }}
                                className="h-8"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {/* Existing children */}
                          {header.children.map((child) => (
                            <SortableQuestionItem
                              key={child.id}
                              item={child}
                              task={task}
                              onEdit={(text) => {
                                setEditingItemId(child.id);
                                setEditingItemText(text);
                              }}
                              onRemove={() => handleRemoveItem(child.id)}
                              editingItemId={editingItemId}
                              editingItemText={editingItemText}
                              setEditingItemText={setEditingItemText}
                              handleUpdateItem={handleUpdateItem}
                              setEditingItemId={setEditingItemId}
                              toggleIncludeInResponse={toggleIncludeInResponse}
                              answeringItemId={answeringItemId}
                              setAnsweringItemId={setAnsweringItemId}
                              answerText={answerText}
                              setAnswerText={setAnswerText}
                              handleAnswerItem={handleAnswerItem}
                              editingAnswerId={editingAnswerId}
                              setEditingAnswerId={setEditingAnswerId}
                              editingAnswerText={editingAnswerText}
                              setEditingAnswerText={setEditingAnswerText}
                              handleUpdateAnswer={handleUpdateAnswer}
                              delegatingQuestionId={delegatingQuestionId}
                              setDelegatingQuestionId={setDelegatingQuestionId}
                              delegationUsers={delegationUsers}
                              handleDelegateQuestion={handleDelegateQuestion}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Ungrouped questions */}
                  {groupedQuestions.ungrouped.map((item) => (
                    <SortableQuestionItem
                      key={item.id}
                      item={item}
                      task={task}
                      onEdit={(text) => {
                        setEditingItemId(item.id);
                        setEditingItemText(text);
                      }}
                      onRemove={() => handleRemoveItem(item.id)}
                      editingItemId={editingItemId}
                      editingItemText={editingItemText}
                      setEditingItemText={setEditingItemText}
                      handleUpdateItem={handleUpdateItem}
                      setEditingItemId={setEditingItemId}
                      toggleIncludeInResponse={toggleIncludeInResponse}
                      answeringItemId={answeringItemId}
                      setAnsweringItemId={setAnsweringItemId}
                      answerText={answerText}
                      setAnswerText={setAnswerText}
                      handleAnswerItem={handleAnswerItem}
                      editingAnswerId={editingAnswerId}
                      setEditingAnswerId={setEditingAnswerId}
                      editingAnswerText={editingAnswerText}
                      setEditingAnswerText={setEditingAnswerText}
                      handleUpdateAnswer={handleUpdateAnswer}
                      delegatingQuestionId={delegatingQuestionId}
                      setDelegatingQuestionId={setDelegatingQuestionId}
                      delegationUsers={delegationUsers}
                      handleDelegateQuestion={handleDelegateQuestion}
                    />
                  ))}
                </SortableContext>

                {/* Drag overlay for smooth dragging preview */}
                <DragOverlay>
                  {activeDragId ? (() => {
                    const activeItem = groupedQuestions.allItems.find(item => item.id === activeDragId);
                    if (!activeItem) return null;

                    if (activeItem.item_type === 'header') {
                      return (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md font-medium text-sm shadow-lg border-2 border-primary">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <ChevronDown className="h-4 w-4" />
                          <span>{activeItem.text}</span>
                        </div>
                      );
                    }

                    return (
                      <div className="p-2 rounded-md border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-sm shadow-lg border-2 border-primary">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <HelpCircle className="h-4 w-4 text-blue-500" />
                          <span>{activeItem.text}</span>
                        </div>
                      </div>
                    );
                  })() : null}
                </DragOverlay>
              </DndContext>

              {questionItems.length === 0 && headerItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No questions yet</p>
              )}
            </div>

            {/* Response Documents section - shows attached documents for the response */}
            {responseAttachments.length > 0 && (
              <div className="mt-3 pt-3 border-t shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">See attached:</span>
                </div>
                <div className="space-y-1">
                  {responseAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 p-2 rounded bg-green-50 dark:bg-green-950/30 text-sm group"
                    >
                      <FileText className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="flex-1 truncate font-medium">
                        {att.document?.display_name || att.document?.file_name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                        onClick={() => handleRemoveAttachment(att.id)}
                        title="Remove from response"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Column 4: Attachments */}
          <div
            className={cn(
              "flex flex-col h-full relative",
              isDragging && "after:absolute after:inset-0 after:border-2 after:border-dashed after:border-primary after:bg-primary/5 after:rounded-lg after:pointer-events-none"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag overlay message */}
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm shadow-lg">
                  Drop file to attach
                </div>
              </div>
            )}

            {/* Header with + Add button */}
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-muted-foreground">Attachments</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setShowAttachmentPicker(!showAttachmentPicker)}
              >
                {showAttachmentPicker ? 'Close' : '+ Add'}
              </Button>
            </div>

            {/* Attachment Picker (inline) */}
            {showAttachmentPicker && (
              <div className="p-2 border rounded bg-muted/30 mb-3 shrink-0">
                <AttachmentPicker
                  attachments={pendingAttachments}
                  onAdd={handleAddAttachment}
                  onRemove={handleRemovePendingAttachment}
                  jobId={task.construction_id > 0 ? String(task.construction_id) : undefined}
                />
              </div>
            )}

            {/* Emails Section */}
            <div className="mb-3">
              <div
                className="flex items-center gap-2 mb-2 cursor-pointer"
                onClick={() => setEmailsCollapsed(!emailsCollapsed)}
              >
                {emailsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Emails</span>
                <Badge variant="secondary" className="text-xs">{emailAttachments.length}</Badge>
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

                  {/* Email list - no scroll, shows all */}
                  <div className="border rounded-md">
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
                      <p className="text-xs text-muted-foreground text-center py-3">No emails attached</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Documents Section (Info attachments) */}
            <div className="mb-3">
              <div
                className="flex items-center gap-2 mb-2 cursor-pointer"
                onClick={() => setDocumentsCollapsed(!documentsCollapsed)}
              >
                {documentsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Documents</span>
                <Badge variant="secondary" className="text-xs">{infoAttachments.length}</Badge>
              </div>

              {!documentsCollapsed && (
                <div className="border rounded-md">
                  {infoAttachments.length > 0 ? (
                    <div className="divide-y">
                      {infoAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 p-2 hover:bg-muted/50 text-xs group cursor-pointer"
                          onClick={() => att.document && setSelectedDocumentId(att.document.id)}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (att.document?.sharepoint_url) {
                              window.open(att.document.sharepoint_url, '_blank');
                            }
                          }}
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
                    <p className="text-xs text-muted-foreground text-center py-3">No documents attached</p>
                  )}
                </div>
              )}
            </div>

            {/* Response Files Section */}
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Send className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Response Files</span>
                <Badge variant="secondary" className="text-xs">{responseAttachments.length}</Badge>
              </div>

              {responseAttachments.length > 0 ? (
                <>
                  <div className="border rounded-md divide-y bg-primary/5 dark:bg-primary/10">
                    {responseAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 p-2 text-xs group"
                      >
                        <FileText className="h-3 w-3 text-primary shrink-0" />
                        <span className="flex-1 truncate font-medium">
                          {att.document?.display_name || att.document?.file_name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => {
                            const url = att.sharepoint_url || att.document?.sharepoint_url;
                            if (url) window.open(url, '_blank');
                          }}
                          title="Open in SharePoint"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
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
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setShowComposeEmail(true)}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Response Email
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-md">
                  Drag files here to add response attachments
                </p>
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

      {/* Bulk paste dialog - large for organizing */}
      {showBulkPaste && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8">
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
            <h3 className="font-medium text-lg mb-1">Paste Multiple {newActionItemType === 'action' ? 'Actions' : 'Questions'}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              One per line. Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Tab</kbd> to indent lines as sub-items under a header.
            </p>
            <Textarea
              value={bulkPasteText}
              onChange={(e) => setBulkPasteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const target = e.target as HTMLTextAreaElement;
                  const start = target.selectionStart;
                  const end = target.selectionEnd;
                  const value = target.value;

                  // If text is selected, indent all selected lines
                  if (start !== end) {
                    const beforeSelection = value.substring(0, start);
                    const selection = value.substring(start, end);
                    const afterSelection = value.substring(end);

                    // Find start of first selected line
                    const lineStart = beforeSelection.lastIndexOf('\n') + 1;
                    const prefix = value.substring(0, lineStart);
                    const selectedLines = (beforeSelection.substring(lineStart) + selection).split('\n');

                    if (e.shiftKey) {
                      // Unindent - remove leading tab or spaces
                      const unindentedLines = selectedLines.map(line => line.replace(/^(\t|  )/, ''));
                      const newValue = prefix + unindentedLines.join('\n') + afterSelection;
                      setBulkPasteText(newValue);
                    } else {
                      // Indent - add tab to each line
                      const indentedLines = selectedLines.map(line => '\t' + line);
                      const newValue = prefix + indentedLines.join('\n') + afterSelection;
                      setBulkPasteText(newValue);
                    }
                  } else {
                    // No selection - indent current line
                    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                    const beforeLine = value.substring(0, lineStart);
                    const afterCursor = value.substring(start);
                    const currentLineBeforeCursor = value.substring(lineStart, start);

                    if (e.shiftKey) {
                      // Unindent current line
                      const newLine = currentLineBeforeCursor.replace(/^(\t|  )/, '');
                      const removed = currentLineBeforeCursor.length - newLine.length;
                      const newValue = beforeLine + newLine + afterCursor;
                      setBulkPasteText(newValue);
                      setTimeout(() => target.setSelectionRange(start - removed, start - removed), 0);
                    } else {
                      // Insert tab at start of line
                      const newValue = beforeLine + '\t' + currentLineBeforeCursor + afterCursor;
                      setBulkPasteText(newValue);
                      setTimeout(() => target.setSelectionRange(start + 1, start + 1), 0);
                    }
                  }
                }
              }}
              placeholder={newActionItemType === 'action'
                ? `Action 1\nAction 2\nAction 3`
                : `160 Alperton Road\n\tWhat is the property timeline?\n\tWestpac loan statements?\nHarder Family Trust\n\tTrust distribution records?\n\tAnnual returns?`
              }
              className="flex-1 min-h-[400px] font-mono text-sm mb-4 resize-none"
              autoFocus
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Indented lines become sub-questions. Non-indented lines with children become headers.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setShowBulkPaste(false); setBulkPasteText(''); }}>Cancel</Button>
                <Button onClick={handleBulkPaste} disabled={!bulkPasteText.trim() || actionItemLoading === 'bulk'}>
                  {actionItemLoading === 'bulk' ? <Spinner className="h-4 w-4" /> : 'Add All'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document preview modal */}
      {selectedDocumentId && (() => {
        // Search both info and response attachments
        const allDocAttachments = [...infoAttachments, ...responseAttachments];
        const selectedDoc = allDocAttachments.find(a => a.document?.id === selectedDocumentId)?.document;
        if (!selectedDoc) return null;
        return (
          <DocumentPreviewModal
            document={{
              id: selectedDoc.id,
              file_name: selectedDoc.file_name,
              display_name: selectedDoc.display_name,
              document_type: selectedDoc.document_type,
            }}
            open={!!selectedDocumentId}
            onOpenChange={(open) => !open && setSelectedDocumentId(null)}
          />
        );
      })()}

      {/* Attachment category dialog */}
      <AttachmentCategoryDialog
        open={showCategoryDialog}
        fileName={pendingFile?.name || ''}
        onSelect={handleCategorySelect}
        onCancel={handleCategoryCancel}
      />

      {/* Compose email modal for responses */}
      {showComposeEmail && (
        <ComposeEmailModal
          open={showComposeEmail}
          onOpenChange={setShowComposeEmail}
          defaultSubject={`Re: Task #${task.task_number} - ${task.name}`}
          defaultBody={generateResponseBody()}
          onSent={() => {
            setShowComposeEmail(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
