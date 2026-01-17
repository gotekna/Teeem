'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SmTask, TaskAttachment, TaskAttachmentEmail, TaskActionItem, TaskFollower, useTaskHub, ActionItemType, AttachmentCategory } from '@/contexts/TaskHubContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SmartInput } from '@/components/ui/smart-input';
import { SmartTextField } from '@/components/ui/smart-text-field';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Spinner } from "@/components/ui/spinner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { TaskAssignmentInline } from './TaskAssignmentInline';
import { AttachmentPicker, PendingAttachment } from './AttachmentPicker';
import TeeemTableView from '@/components/table/TeeemTableView';
import { EmailDetailDialog } from '@/components/emails/EmailDetailDialog';
import { api, getApiBaseUrl } from '@/lib/api';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DndContext,
  closestCenter,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  CollisionDetection,
  useDroppable,
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
  Building2,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Link2,
  Loader2,
  GripVertical,
  HelpCircle,
  Lock,
  LockOpen,
  Mail,
  Paperclip,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Send,
  Target,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useWorkingDays } from '@/lib/hooks/useWorkingDays';
import { ComboboxDropdown, ComboboxItem } from '@/components/ui/combobox-dropdown';
import { ExpandChevron } from '@/components/ui/expand-chevron';
import { CascadeCompletionDialog } from '@/components/schedule/CascadeCompletionDialog';
import { DocumentViewerModal, getFileType } from '@/components/ui/document-viewer-modal';
import { AttachmentCategoryDialog } from './AttachmentCategoryDialog';
import { ComposeEmailModal } from '@/components/emails/ComposeEmailModal';
import { getOverdueColorClasses } from './TaskColorSettings';
import { TASK_STATUS } from '@/lib/constants/task-status';

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
  completed: 'data-[state=checked]:bg-muted0 data-[state=checked]:border-border',
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
  onAttachmentDrop?: (attachmentId: number, itemId: number) => void;  // For dropping existing attachments on questions
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
  handleUndelegateQuestion?: (itemId: number) => void;  // Unlink a delegated task
  onCreateAction?: (text: string) => void;  // Create action item from question
  setSelectedEmailId?: (id: number | null) => void;  // For viewing linked emails
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
  onAttachmentDrop,
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
  handleUndelegateQuestion,
  onCreateAction,
  setSelectedEmailId,
}: SortableQuestionItemProps) {
  const [isFileDropTarget, setIsFileDropTarget] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection from click
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileDrop) {
      console.log('[SortableQuestionItem] File selected via picker:', file.name);
      onFileDrop(file, item.id);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
        data-item-id={item.id}
        className={cn(
          "relative transition-all duration-200",
          isDropTarget && "py-1"
        )}
      >
        {/* Drop indicator above header */}
        {isDropTarget && (
          <div className="absolute -top-1 left-0 right-0 h-1 bg-primary rounded-full animate-pulse" />
        )}
        <div
          className={cn(
            "flex items-center gap-2 p-2 bg-muted/50 rounded-md font-medium text-sm transition-all",
            isDragging && "shadow-lg opacity-50",
            isDropTarget && "ring-2 ring-primary bg-primary/20 scale-[1.02] shadow-lg"
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
              spellCheck={true}
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
            <span className="text-xs text-primary font-semibold bg-primary/20 px-2 py-0.5 rounded animate-pulse">
              Drop here
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
        {/* Drop zone indicator below header when hovering */}
        {isDropTarget && (
          <div className="mt-1 h-8 border-2 border-dashed border-primary rounded bg-primary/10 flex items-center justify-center">
            <span className="text-xs text-primary font-medium">Release to add question here</span>
          </div>
        )}
      </div>
    );
  }

  // File drop handlers for questions
  const handleQuestionFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDropTarget(true);
  };

  const handleQuestionFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDropTarget(false);
  };

  const handleQuestionFileDropEvent = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDropTarget(false);

    // Check for existing attachment being dragged (from "See attached" section)
    const attachmentId = e.dataTransfer.getData('application/x-attachment-id');
    if (attachmentId && onAttachmentDrop) {
      console.log('[SortableQuestionItem] Linking existing attachment:', attachmentId, 'to question:', item.id);
      onAttachmentDrop(parseInt(attachmentId), item.id);
      return;
    }

    // Log everything about the drop to debug OneDrive drags
    const files = Array.from(e.dataTransfer.files);
    const items = Array.from(e.dataTransfer.items);
    const types = e.dataTransfer.types;

    console.log('[SortableQuestionItem] Drop event details:');
    console.log('  - Question ID:', item.id);
    console.log('  - Files count:', files.length);
    console.log('  - Items count:', items.length);
    console.log('  - Types:', types);

    // Log each item's kind and type
    items.forEach((item, i) => {
      console.log(`  - Item ${i}: kind=${item.kind}, type=${item.type}`);
      if (item.kind === 'string') {
        item.getAsString((s) => console.log(`    String data: ${s.substring(0, 200)}...`));
      }
    });

    if (files.length > 0 && onFileDrop) {
      console.log('[SortableQuestionItem] Calling onFileDrop with file:', files[0].name);
      onFileDrop(files[0], item.id);
    } else if (files.length === 0) {
      console.log('[SortableQuestionItem] No files in drop - might be URL/text drag from OneDrive');
      // Try to get URL or text data
      const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (url) {
        console.log('[SortableQuestionItem] Got URL/text:', url);
      }
    }
  };

  // Question rendering
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-item-id={item.id}
      className={cn(
        "p-2 rounded-md border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-sm space-y-2 transition-all",
        isDragging && "shadow-lg",
        isFileDropTarget && "ring-2 ring-green-500 ring-offset-1 bg-green-50 dark:bg-green-950/30"
      )}
      onDragOver={handleQuestionFileDragOver}
      onDragLeave={handleQuestionFileDragLeave}
      onDrop={handleQuestionFileDropEvent}
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
            spellCheck={true}
          />
        ) : (
          <span
            className="flex-1 cursor-pointer"
            onClick={() => onEdit(item.text)}
          >
            {item.text}
          </span>
        )}
        {/* Hidden file input for click-to-attach */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
        />
        {/* Paperclip button to attach file */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-green-600"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file to this question"
        >
          <Paperclip className="h-3 w-3" />
        </Button>
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
          <div className="ml-6 space-y-2">
            <SmartTextField
              value={editingAnswerText ?? ''}
              onChange={(value) => setEditingAnswerText?.(value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditingAnswerId?.(null);
                  setEditingAnswerText?.('');
                }
              }}
              className="min-h-[60px] text-sm"
              context="answer"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingAnswerId?.(null);
                  setEditingAnswerText?.('');
                }}
                className="h-7"
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => handleUpdateAnswer?.(item.id)} className="h-7">
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
            </div>
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
            <div
              className="text-sm prose prose-sm dark:prose-invert max-w-none [&>p]:my-0"
              dangerouslySetInnerHTML={{ __html: item.response || '' }}
            />
          </div>
        )
      ) : answeringItemId === item.id ? (
        <div className="ml-6 space-y-2">
          <SmartTextField
            value={answerText ?? ''}
            onChange={(value) => setAnswerText?.(value)}
            placeholder="Type answer..."
            className="min-h-[60px] text-sm"
            context="answer"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setAnsweringItemId?.(null);
                setAnswerText?.('');
              }
            }}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAnsweringItemId?.(null);
                setAnswerText?.('');
              }}
              className="h-7"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => handleAnswerItem?.(item.id)} className="h-7">
              <Send className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
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

      {/* Attached response documents/emails - displayed as hyperlinks (v3 - handles both document and email types, empty emails return null) */}
      {item.attachments && item.attachments.length > 0 && (
        <div className="ml-6 space-y-1">
          {item.attachments.map((att) => {
            // Handle document attachments (CorporateCompanyDocument)
            if (att.document) {
              // SSoT: Use storage_url (provider-agnostic) first, then file_url (ActiveStorage legacy)
              const url = att.document?.storage_url || att.document?.file_url;
              const fileName = att.document?.display_name || att.document?.file_name || 'Document';
              return (
                <div key={att.id} className="flex items-center gap-2 text-xs">
                  <Paperclip className="h-3 w-3 text-green-600 shrink-0" />
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-700 hover:underline font-medium"
                    >
                      {fileName}
                    </a>
                  ) : (
                    <span className="text-green-600 font-medium">{fileName}</span>
                  )}
                </div>
              );
            }
            // Handle email attachments (EmailWarehouse)
            if (att.email) {
              const subject = att.email.subject || '(No subject)';
              return (
                <div key={att.id} className="flex items-center gap-2 text-xs">
                  <Mail className="h-3 w-3 text-green-600 shrink-0" />
                  <button
                    onClick={() => setSelectedEmailId?.(att.email!.id)}
                    className="text-green-600 hover:text-green-700 hover:underline font-medium text-left"
                  >
                    {subject}
                  </button>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Delegated task link or create task button */}
      {item.delegated_task_id ? (
        <div className="ml-6 flex items-center gap-1">
          <Button
            variant="link"
            size="sm"
            className="h-6 text-xs p-0 text-primary"
            onClick={() => window.open(`/sm_tasks/${item.delegated_task_id}`, '_blank')}
          >
            → Task #{item.delegated_task_id}
          </Button>
          {item.delegated_task?.assigned_user_name && (
            <span className="text-xs text-muted-foreground">
              ({item.delegated_task.assigned_user_name})
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => handleUndelegateQuestion?.(item.id)}
            title="Unlink task"
          >
            <X className="h-3 w-3" />
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
        <div className="ml-6 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs p-0 text-muted-foreground hover:text-primary"
            onClick={() => setDelegatingQuestionId?.(item.id)}
          >
            → Task
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs p-0 text-muted-foreground hover:text-green-600"
            onClick={() => onCreateAction?.(item.text)}
          >
            → Action
          </Button>
        </div>
      )}
    </div>
  );
}

// Ungroup drop zone component - appears when dragging a grouped question
function UngroupDropZone({
  isOver,
  onIsOverChange,
}: {
  isOver: boolean;
  onIsOverChange: (isOver: boolean) => void;
}) {
  const { setNodeRef, isOver: isOverInternal } = useDroppable({
    id: 'ungroup-zone',
  });

  // Sync internal isOver state to parent
  useEffect(() => {
    onIsOverChange(isOverInternal);
  }, [isOverInternal, onIsOverChange]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-2 p-3 border-2 border-dashed rounded-lg text-center text-sm transition-all",
        isOver
          ? "border-primary bg-primary/10 text-primary font-medium"
          : "border-muted-foreground/30 text-muted-foreground"
      )}
    >
      {isOver ? "Release to remove from header" : "Drop here to remove from header"}
    </div>
  );
}

export function TaskFullscreenView({ task, onClose }: TaskFullscreenViewProps) {
  const { user: currentUser } = useAuth();
  const { calculateEndDate, calculateDuration } = useWorkingDays();
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
    undelegateActionItem,
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
  const [delegatingQuestionId, setDelegatingQuestionId] = useState<number | null>(null);
  const [delegatingActionId, setDelegatingActionId] = useState<number | null>(null);
  const [delegationUsers, setDelegationUsers] = useState<User[]>([]);

  // Attachment state
  const [localAttachments, setLocalAttachments] = useState<TaskAttachment[]>(task.attachments || []);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [emailKeywords, setEmailKeywords] = useState(task.email_keywords || '');
  const [emailSearchType, setEmailSearchType] = useState<'subject' | 'body' | 'full' | 'exact'>('subject');
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);

  // Email-to-document highlighting state
  const [selectedEmailForHighlight, setSelectedEmailForHighlight] = useState<number | null>(null);
  const [highlightedDocHashes, setHighlightedDocHashes] = useState<Set<string>>(new Set());

  // Email source filter - filter emails by which source they came from
  const [emailSourceFilter, setEmailSourceFilter] = useState<{
    type: 'all' | 'contact' | 'matched' | 'thread';
    emails?: string[];  // For contact filter - the email addresses to match
    label?: string;     // Display label for the filter
  }>({ type: 'all' });

  // Bulk email linking state
  const [bulkLinkOpen, setBulkLinkOpen] = useState(false);
  const [bulkLinkOptions, setBulkLinkOptions] = useState<{
    hasJob: boolean;
    jobCode?: string;
    options: Array<{
      type: string;
      job_contact_id?: number;
      contact_id?: number;
      user_id?: number;
      role: string;
      name: string;
      label: string;
      emails: string[];
      email_count: number;
    }>;
  } | null>(null);
  const [bulkLinkLoading, setBulkLinkLoading] = useState(false);
  const [bulkLinkEmail, setBulkLinkEmail] = useState('');
  // Client email picker state (for clients with multiple emails)
  const [expandedClientId, setExpandedClientId] = useState<number | null>(null);
  // Contact search state
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState<Array<{
    id: number;
    name: string;
    company?: string;
    emails: string[];
    email_count: number;
  }>>([]);
  const [contactSearchLoading, setContactSearchLoading] = useState(false);
  const contactSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Document viewer state (for markup/annotations)
  const [viewerDocument, setViewerDocument] = useState<{
    url: string;
    fileName: string;
    fileType: 'pdf' | 'image' | 'other';
  } | null>(null);

  // Column collapse state
  const [columnsCollapsed, setColumnsCollapsed] = useState({
    description: false,
    questions: false,
    actions: false,
    attachments: false,
  });

  const toggleColumn = useCallback((column: keyof typeof columnsCollapsed) => {
    setColumnsCollapsed(prev => ({ ...prev, [column]: !prev[column] }));
  }, []);

  // File drop and category selection
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTargetColumn, setDragTargetColumn] = useState<'attachments' | 'questions' | null>(null);

  // State for attachment-to-question linking dialog
  const [pendingAttachmentForQuestion, setPendingAttachmentForQuestion] = useState<number | null>(null);

  // Editing answers inline
  const [editingAnswerId, setEditingAnswerId] = useState<number | null>(null);
  const [editingAnswerText, setEditingAnswerText] = useState('');

  // Scroll position preservation after save
  const lastSavedItemIdRef = useRef<number | null>(null);
  const scrollToSavedItem = useCallback(() => {
    if (lastSavedItemIdRef.current !== null) {
      const itemId = lastSavedItemIdRef.current;
      // Small delay to let DOM update after state changes
      requestAnimationFrame(() => {
        const element = document.querySelector(`[data-item-id="${itemId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        lastSavedItemIdRef.current = null;
      });
    }
  }, []);

  // Email compose for responses
  const [showComposeEmail, setShowComposeEmail] = useState(false);
  const [emailFileAttachments, setEmailFileAttachments] = useState<File[]>([]);
  const [prepareEmailLoading, setPrepareEmailLoading] = useState(false);
  const [prepareEmailStatus, setPrepareEmailStatus] = useState('');
  // Track how each attachment should be included: 'attach' (file), 'link' (SharePoint URL), 'none' (exclude)
  const [attachmentEmailOptions, setAttachmentEmailOptions] = useState<Record<number, 'attach' | 'link' | 'none'>>({});
  // Store SharePoint share links created for 'link' option
  const [shareLinksMap, setShareLinksMap] = useState<Record<number, string>>({});

  // Multi-select documents
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const toggleDocSelection = (id: number) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearDocSelection = () => setSelectedDocIds(new Set());
  const selectAllDocs = (ids: number[]) => setSelectedDocIds(new Set(ids));
  const handleBulkDeleteDocs = async () => {
    if (selectedDocIds.size === 0) return;
    setAttachmentLoading(true);
    try {
      for (const id of selectedDocIds) {
        await api.delete(`/api/v1/sm_tasks/${task.id}/attachments/${id}`);
      }
      setLocalAttachments(prev => prev.filter(a => !selectedDocIds.has(a.id)));
      clearDocSelection();
    } catch (err) {
      console.error('Failed to delete attachments:', err);
    }
    setAttachmentLoading(false);
  };

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
  const [collapsedEmailMonths, setCollapsedEmailMonths] = useState<Set<string>>(new Set());

  // Email tree view expansion state (by source category)
  const [emailTreeExpanded, setEmailTreeExpanded] = useState<Record<string, boolean>>({
    thread: true,      // Thread expanded by default
    matched: false,    // Auto-matched collapsed
    linked: false,     // Linked collapsed
  });

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

  // Filter attachments - emails sorted by date (latest first)
  const allEmailAttachments = localAttachments
    .filter(a => a.email)
    .sort((a, b) => {
      const dateA = a.email?.received_at ? new Date(a.email.received_at).getTime() : 0;
      const dateB = b.email?.received_at ? new Date(b.email.received_at).getTime() : 0;
      return dateB - dateA; // DESC - latest first
    });

  // Apply email source filter
  const emailAttachments = allEmailAttachments.filter(att => {
    if (emailSourceFilter.type === 'all') return true;
    if (emailSourceFilter.type === 'matched') {
      return att.notes?.startsWith('Matched');
    }
    if (emailSourceFilter.type === 'thread') {
      return att.notes?.startsWith('Thread:');
    }
    if (emailSourceFilter.type === 'contact' && emailSourceFilter.emails) {
      const fromEmail = att.email?.from_email?.toLowerCase();
      const toEmails = att.email?.to_emails?.map((e: string) => e.toLowerCase()) || [];
      const allParticipants = [fromEmail, ...toEmails].filter(Boolean);
      return emailSourceFilter.emails.some(e => allParticipants.includes(e.toLowerCase()));
    }
    return true;
  });

  // Calculate linked email counts per source
  const getLinkedCountForEmails = (emails: string[]): number => {
    if (!emails.length) return 0;
    const lowerEmails = emails.map(e => e.toLowerCase());
    return allEmailAttachments.filter(att => {
      const fromEmail = att.email?.from_email?.toLowerCase();
      const toEmails = att.email?.to_emails?.map((e: string) => e.toLowerCase()) || [];
      const allParticipants = [fromEmail, ...toEmails].filter(Boolean);
      return lowerEmails.some(e => allParticipants.includes(e));
    }).length;
  };

  const matchedEmailCount = allEmailAttachments.filter(att => att.notes?.startsWith('Matched')).length;
  const threadEmailCount = allEmailAttachments.filter(att => att.notes?.startsWith('Thread:')).length;

  // Calculate unique senders from attached emails with counts
  // This allows filtering by sender even if they're not a job contact
  const uniqueEmailSenders = useMemo(() => {
    const senderMap = new Map<string, { email: string; name: string; count: number }>();

    allEmailAttachments.forEach(att => {
      const fromEmail = att.email?.from_email?.toLowerCase();
      const fromName = att.email?.from_name || fromEmail || 'Unknown';

      if (fromEmail) {
        const existing = senderMap.get(fromEmail);
        if (existing) {
          existing.count++;
        } else {
          senderMap.set(fromEmail, {
            email: fromEmail,
            name: fromName,
            count: 1
          });
        }
      }
    });

    // Sort by count descending, then by name
    return Array.from(senderMap.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [allEmailAttachments]);

  // Categorize emails by source (for tree view)
  const categorizedEmails = useMemo(() => {
    const thread: typeof allEmailAttachments = [];
    const matched: typeof allEmailAttachments = [];
    const linked: typeof allEmailAttachments = [];

    allEmailAttachments.forEach(att => {
      if (att.notes?.startsWith('Thread:')) {
        thread.push(att);
      } else if (att.notes?.startsWith('Matched')) {
        matched.push(att);
      } else {
        linked.push(att);
      }
    });

    return { thread, matched, linked };
  }, [allEmailAttachments]);

  // Apply person filter to each category (for tree view)
  const filteredCategories = useMemo(() => {
    const filterEmails = (emails: typeof allEmailAttachments) => {
      if (emailSourceFilter.type !== 'contact' || !emailSourceFilter.emails?.length) {
        return emails;
      }
      const filterAddrs = emailSourceFilter.emails.map(e => e.toLowerCase());
      return emails.filter(att => {
        const from = att.email?.from_email?.toLowerCase();
        const to = att.email?.to_emails?.map((e: string) => e.toLowerCase()) || [];
        const all = [from, ...to].filter(Boolean);
        return filterAddrs.some(f => all.includes(f));
      });
    };

    return {
      thread: filterEmails(categorizedEmails.thread),
      matched: filterEmails(categorizedEmails.matched),
      linked: filterEmails(categorizedEmails.linked),
    };
  }, [categorizedEmails, emailSourceFilter]);

  const documentAttachments = localAttachments.filter(a => a.document && !a.email);

  // Split document attachments by category
  const infoAttachments = documentAttachments.filter(a => a.category !== 'response');
  const responseDocuments = documentAttachments.filter(a => a.category === 'response');

  // Emails linked to questions are also response items
  const responseEmails = allEmailAttachments.filter(a => a.action_item_id);

  // Combined response attachments (documents + emails linked to questions)
  const responseAttachments = [...responseDocuments, ...responseEmails];

  // Initialize default email options for response attachments
  // Default: 'link' for SharePoint files, 'attach' for ActiveStorage files
  useEffect(() => {
    const newOptions: Record<number, 'attach' | 'link' | 'none'> = {};
    responseAttachments.forEach(att => {
      // Keep existing choice if already set
      if (attachmentEmailOptions[att.id]) {
        newOptions[att.id] = attachmentEmailOptions[att.id];
      } else {
        // Default: use link for external storage files, attach for others
        const hasExternalStorage = att.document?.storage_url;
        newOptions[att.id] = hasExternalStorage ? 'link' : 'attach';
      }
    });
    // Only update if different to avoid infinite loop
    const hasChanges = Object.keys(newOptions).length !== Object.keys(attachmentEmailOptions).length ||
      Object.entries(newOptions).some(([id, val]) => attachmentEmailOptions[Number(id)] !== val);
    if (hasChanges) {
      setAttachmentEmailOptions(newOptions);
    }
  }, [responseAttachments]);

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

  // Custom collision detection that prioritizes headers
  // This prevents flickering when dragging near headers with children
  const headerPriorityCollision: CollisionDetection = useCallback((args) => {
    // First, get all rect intersections
    const rectCollisions = rectIntersection(args);

    // Find if any collision is with a header
    const headerCollision = rectCollisions.find(collision => {
      const item = groupedQuestions.allItems.find(i => i.id === Number(collision.id));
      return item?.item_type === 'header';
    });

    // If we're intersecting a header, prioritize it
    if (headerCollision) {
      return [headerCollision];
    }

    // Otherwise use closestCenter for smooth reordering
    return closestCenter(args);
  }, [groupedQuestions.allItems]);

  // Toggle header collapse
  const toggleHeaderCollapse = useCallback((headerId: number) => {
    setCollapsedHeaders(prev => {
      const next = new Set(prev);
      if (next.has(headerId)) next.delete(headerId);
      else next.add(headerId);
      return next;
    });
  }, []);

  // Check if we're dragging a grouped item (for showing ungroup zone)
  const isDraggingGroupedItem = useMemo(() => {
    if (!activeDragId) return false;
    const item = groupedQuestions.allItems.find(i => i.id === activeDragId);
    return item?.parent_item_id != null && item?.item_type !== 'header';
  }, [activeDragId, groupedQuestions.allItems]);

  // Ungroup drop zone - appears when dragging a grouped question
  const [isOverUngroupZone, setIsOverUngroupZone] = useState(false);

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
    const currentOverHeaderId = overHeaderId; // Capture before clearing
    const wasOverUngroupZone = isOverUngroupZone; // Capture before clearing
    setActiveDragId(null);
    setOverHeaderId(null);
    setIsOverUngroupZone(false);

    const { active, over } = event;

    const allItems = groupedQuestions.allItems;
    const oldIndex = allItems.findIndex(item => item.id === active.id);
    const draggedItem = allItems[oldIndex];

    if (oldIndex === -1) return;

    // CASE 0: Dropping on ungroup zone - remove from header
    if (wasOverUngroupZone && draggedItem.parent_item_id) {
      // Move to end of ungrouped items
      const ungroupedItems = allItems.filter(i => !i.parent_item_id && i.item_type !== 'header');
      const lastUngroupedIndex = ungroupedItems.length > 0
        ? allItems.findIndex(i => i.id === ungroupedItems[ungroupedItems.length - 1].id) + 1
        : allItems.length;

      const reorderedItems = arrayMove(allItems, oldIndex, lastUngroupedIndex > oldIndex ? lastUngroupedIndex - 1 : lastUngroupedIndex);
      const updates = reorderedItems.map((item, index) => ({
        id: item.id,
        position: index,
        parent_item_id: item.id === draggedItem.id ? null : (item.parent_item_id ?? null)
      }));
      await reorderActionItems(task.id, updates);
      return;
    }

    if (!over) return;
    if (active.id === over.id && !currentOverHeaderId) return;

    // Don't allow headers to become children of other headers
    if (draggedItem.item_type === 'header' && currentOverHeaderId) {
      return;
    }

    // CASE 1: Dropping on a header (detected by overHeaderId) - add as child
    if (currentOverHeaderId && draggedItem.item_type !== 'header') {
      // Find the header and its last child to position after
      const header = allItems.find(item => item.id === currentOverHeaderId);
      if (!header) return;

      // Find last child of this header to insert after
      const headerChildren = allItems.filter(item => item.parent_item_id === currentOverHeaderId);
      const lastChildIndex = headerChildren.length > 0
        ? allItems.findIndex(item => item.id === headerChildren[headerChildren.length - 1].id)
        : allItems.findIndex(item => item.id === currentOverHeaderId);

      // Move item to after the last child (or after header if no children)
      const targetIndex = lastChildIndex + 1;
      const reorderedItems = arrayMove(allItems, oldIndex, oldIndex < targetIndex ? targetIndex - 1 : targetIndex);

      // Update positions and set parent
      const updates = reorderedItems.map((item, index) => ({
        id: item.id,
        position: index,
        parent_item_id: item.id === draggedItem.id ? currentOverHeaderId : (item.parent_item_id ?? null)
      }));

      await reorderActionItems(task.id, updates);
      return;
    }

    // CASE 2: Normal reordering
    const newIndex = allItems.findIndex(item => item.id === over.id);
    if (newIndex === -1) return;

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
  }, [groupedQuestions.allItems, reorderActionItems, task.id, overHeaderId, isOverUngroupZone]);

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
      // Calculate new end_date using working days (skips weekends/holidays)
      const newEndDate = calculateEndDate(task.start_date, duration);
      await updateTask(task.id, {
        duration_days: duration,
        end_date: newEndDate
      });
      setLoading(null);
    }
  };

  const handleJobChange = async (jobId: number | null) => {
    setLoading('job');
    // Backend permits job_id, not construction_id. Also update construction_id for optimistic UI.
    await updateTask(task.id, { job_id: jobId || 0, construction_id: jobId || 0 } as Partial<SmTask>);
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
    lastSavedItemIdRef.current = itemId;  // Remember which item we're saving
    setActionItemLoading(itemId);
    await updateActionItem(task.id, itemId, editingItemText.trim());
    setEditingItemId(null);
    setEditingItemText('');
    setActionItemLoading(null);
    scrollToSavedItem();  // Scroll back to the saved item
  };

  const handleAnswerItem = async (itemId: number) => {
    if (!answerText.trim()) return;
    lastSavedItemIdRef.current = itemId;  // Remember which item we're saving
    setActionItemLoading(itemId);
    await answerActionItem(task.id, itemId, answerText.trim());
    setAnsweringItemId(null);
    setAnswerText('');
    setActionItemLoading(null);
    scrollToSavedItem();  // Scroll back to the saved question
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

  const handleDelegateQuestion = async (itemId: number, userId: number) => {
    setActionItemLoading(itemId);
    await delegateActionItem(task.id, itemId, userId);
    setDelegatingQuestionId(null);
    setActionItemLoading(null);
    refresh();
  };

  const handleDelegateAction = async (itemId: number, userId: number) => {
    setActionItemLoading(itemId);
    await delegateActionItem(task.id, itemId, userId);
    setDelegatingActionId(null);
    setActionItemLoading(null);
    refresh();
  };

  const handleUndelegateQuestion = async (itemId: number) => {
    setActionItemLoading(itemId);
    try {
      await undelegateActionItem(task.id, itemId, false);  // Don't delete the task, just unlink
      toast.success('Task unlinked');
    } catch (err) {
      console.error('Failed to unlink task:', err);
      toast.error('Failed to unlink task');
    }
    setActionItemLoading(null);
    refresh();
  };

  // Attachments
  const handleAddAttachment = async (attachment: PendingAttachment) => {
    setAttachmentLoading(true);
    try {
      if (attachment.type === 'upload' && attachment.file) {
        // File upload - use FormData to upload the file
        const formData = new FormData();
        formData.append('file', attachment.file);
        formData.append('category', 'info'); // Default to info category for picker uploads

        const response = await api.postFormData<{ success: boolean; attachment: TaskAttachment }>(
          `/api/v1/sm_tasks/${task.id}/attachments/upload`,
          formData
        );
        if (response?.success && response.attachment) {
          setLocalAttachments(prev => [...prev, response.attachment]);
          setShowAttachmentPicker(false);
        }
      } else if (attachment.id) {
        // Email or document - link existing record
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

  // Get shareable link for an attachment (email or document) and copy to clipboard
  const handleCopyShareLink = async (attachmentId: number) => {
    try {
      const response = await api.post<{ success: boolean; share_url?: string; error?: string }>(
        `/api/v1/sm_tasks/${task.id}/attachments/${attachmentId}/share_link`
      );
      if (response?.success && response?.share_url) {
        await navigator.clipboard.writeText(response.share_url);
        toast.success('Link copied to clipboard');
      } else {
        toast.error(response?.error || 'Failed to create share link');
      }
    } catch (err) {
      console.error('Failed to create share link:', err);
      toast.error('Failed to create share link');
    }
  };

  const handleSaveKeywords = async () => {
    if (emailKeywords !== task.email_keywords) {
      setLoading('keywords');
      await updateTask(task.id, { email_keywords: emailKeywords });
      setLoading(null);
    }
  };

  // Match emails by keywords and link them to the task
  const handleMatchKeywords = async (searchType?: 'subject' | 'body' | 'full' | 'exact') => {
    if (!emailKeywords.trim()) return;

    // Save keywords first
    await handleSaveKeywords();

    const type = searchType || emailSearchType;
    setLoading('matching');
    try {
      const response = await api.post<{
        success: boolean;
        linked_count: number;
        skipped_count: number;
        total_found: number;
        search_type: string;
        attachments: TaskAttachment[];
        error?: string;
      }>(`/api/v1/sm_tasks/${task.id}/match_keywords`, { search_type: type });

      if (response?.success) {
        const typeLabel = type === 'subject' ? 'subject' : type === 'body' ? 'body' : type === 'exact' ? 'exact' : 'all';
        if (response.linked_count > 0) {
          toast.success(`Linked ${response.linked_count} email${response.linked_count !== 1 ? 's' : ''} (${typeLabel} match)`);
          // Refresh tasks to get updated attachments
          await refresh?.();
        } else if (response.total_found > 0) {
          toast.info(`Found ${response.total_found} emails but all already linked`);
        } else {
          toast.info(`No emails found matching "${emailKeywords}" in ${typeLabel}`);
        }
      } else {
        toast.error(response?.error || 'Failed to match keywords');
      }
    } catch (err) {
      console.error('[TaskFullscreenView] Failed to match keywords:', err);
      toast.error('Failed to search emails');
    } finally {
      setLoading(null);
    }
  };

  // Clear all matched emails from the task
  const handleClearMatchedEmails = async () => {
    setLoading('clearing');
    try {
      const response = await api.delete<{
        success: boolean;
        removed_count: number;
        error?: string;
      }>(`/api/v1/sm_tasks/${task.id}/clear_matched_emails`);

      if (response?.success) {
        if (response.removed_count > 0) {
          toast.success(`Removed ${response.removed_count} matched email${response.removed_count !== 1 ? 's' : ''}`);
          await refresh?.();
        } else {
          toast.info('No matched emails to remove');
        }
      } else {
        toast.error(response?.error || 'Failed to clear emails');
      }
    } catch (err) {
      console.error('[TaskFullscreenView] Failed to clear matched emails:', err);
      toast.error('Failed to clear emails');
    } finally {
      setLoading(null);
    }
  };

  // Link all emails in a conversation thread
  const handleLinkEmailThread = async (emailId: number) => {
    try {
      const response = await api.post<{
        success: boolean;
        linked_count: number;
        thread_size: number;
        message: string;
        error?: string;
      }>(`/api/v1/sm_tasks/${task.id}/link_email_thread`, { email_id: emailId });

      if (response?.success) {
        if (response.linked_count > 0) {
          toast.success(`Linked ${response.linked_count} email${response.linked_count !== 1 ? 's' : ''} from thread`);
          await refresh?.();
        } else {
          toast.info(response.message || 'All thread emails already linked');
        }
      } else {
        toast.error(response?.error || 'Failed to link thread');
      }
    } catch (err) {
      console.error('[TaskFullscreenView] Failed to link email thread:', err);
      toast.error('Failed to link email thread');
    }
  };

  // Fetch bulk email link options when popover opens
  const fetchBulkLinkOptions = async () => {
    setBulkLinkLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        has_job: boolean;
        job_code?: string;
        options: Array<{
          type: string;
          job_contact_id: number;
          role: string;
          name: string;
          label: string;
          emails: string[];
          email_count: number;
        }>;
      }>(`/api/v1/sm_tasks/${task.id}/email_link_options`);

      if (response?.success) {
        setBulkLinkOptions({
          hasJob: response.has_job,
          jobCode: response.job_code,
          options: response.options
        });
      }
    } catch (err) {
      console.error('Failed to fetch bulk link options:', err);
    }
    setBulkLinkLoading(false);
  };

  // Handle bulk link from suggested option (job contact, contact, or user)
  const handleBulkLinkOption = async (option: {
    type: string;
    job_contact_id?: number;
    contact_id?: number;
    user_id?: number;
  }) => {
    setBulkLinkLoading(true);
    try {
      // Build payload based on option type
      const payload: Record<string, number> = {};
      if (option.type === 'job_contact' && option.job_contact_id) {
        payload.job_contact_id = option.job_contact_id;
      } else if (option.type === 'contact' && option.contact_id) {
        payload.contact_id = option.contact_id;
      } else if (option.type === 'user' && option.user_id) {
        payload.user_id = option.user_id;
      }

      const response = await api.post<{
        success: boolean;
        linked_count: number;
        skipped_count: number;
        attachments: TaskAttachment[];
      }>(`/api/v1/sm_tasks/${task.id}/bulk_link_emails`, payload);

      if (response?.success) {
        // Add new attachments to local state
        setLocalAttachments(prev => [...prev, ...response.attachments]);
        setBulkLinkOpen(false);
        // Show success message (using existing toast or alert system)
        if (response.linked_count > 0) {
          alert(`Linked ${response.linked_count} emails to this task`);
        } else {
          alert('No new emails to link (all already attached)');
        }
      }
    } catch (err) {
      console.error('Failed to bulk link emails:', err);
      alert('Failed to link emails');
    }
    setBulkLinkLoading(false);
  };

  // Handle bulk link ALL clients from the job (All Clients button)
  const handleBulkLinkAllClients = async (clientJobContactIds: number[]) => {
    if (clientJobContactIds.length === 0) return;

    setBulkLinkLoading(true);
    try {
      const response = await api.post<{
        success: boolean;
        linked_count: number;
        skipped_count: number;
        attachments: TaskAttachment[];
      }>(`/api/v1/sm_tasks/${task.id}/bulk_link_emails`, {
        job_contact_ids: clientJobContactIds
      });

      if (response?.success) {
        setLocalAttachments(prev => [...prev, ...response.attachments]);
        setBulkLinkOpen(false);
        if (response.linked_count > 0) {
          alert(`Linked ${response.linked_count} emails from all clients to this task`);
        } else {
          alert('No new emails to link (all already attached)');
        }
      }
    } catch (err) {
      console.error('Failed to bulk link all client emails:', err);
      alert('Failed to link client emails');
    }
    setBulkLinkLoading(false);
  };

  // Handle bulk link from a specific email address (used by email picker)
  const handleBulkLinkByEmail = async (email: string) => {
    if (!email.trim()) return;

    setBulkLinkLoading(true);
    try {
      const response = await api.post<{
        success: boolean;
        linked_count: number;
        skipped_count: number;
        total_found: number;
        attachments: TaskAttachment[];
      }>(`/api/v1/sm_tasks/${task.id}/bulk_link_emails`, {
        email_address: email.trim()
      });

      if (response?.success) {
        setLocalAttachments(prev => [...prev, ...response.attachments]);
        setBulkLinkOpen(false);
        if (response.linked_count > 0) {
          alert(`Linked ${response.linked_count} emails to this task`);
        } else if (response.total_found === 0) {
          alert('No emails found for this address');
        } else {
          alert('No new emails to link (all already attached)');
        }
      }
    } catch (err) {
      console.error('Failed to bulk link emails:', err);
      alert('Failed to link emails');
    }
    setBulkLinkLoading(false);
  };

  // Handle bulk link from manual email address
  const handleBulkLinkEmail = async () => {
    if (!bulkLinkEmail.trim()) return;

    setBulkLinkLoading(true);
    try {
      const response = await api.post<{
        success: boolean;
        linked_count: number;
        skipped_count: number;
        total_found: number;
        attachments: TaskAttachment[];
      }>(`/api/v1/sm_tasks/${task.id}/bulk_link_emails`, {
        email_address: bulkLinkEmail.trim()
      });

      if (response?.success) {
        setLocalAttachments(prev => [...prev, ...response.attachments]);
        setBulkLinkOpen(false);
        setBulkLinkEmail('');
        if (response.linked_count > 0) {
          alert(`Linked ${response.linked_count} emails to this task`);
        } else if (response.total_found === 0) {
          alert('No emails found for this address');
        } else {
          alert('No new emails to link (all already attached)');
        }
      }
    } catch (err) {
      console.error('Failed to bulk link emails:', err);
      alert('Failed to link emails');
    }
    setBulkLinkLoading(false);
  };

  // Search contacts for email linking (with debounce and abort support)
  const contactSearchAbortRef = useRef<AbortController | null>(null);

  const handleContactSearch = (query: string) => {
    setContactSearchQuery(query);

    // Cancel any in-flight request
    if (contactSearchAbortRef.current) {
      contactSearchAbortRef.current.abort();
      contactSearchAbortRef.current = null;
    }

    // Clear previous timeout
    if (contactSearchTimeoutRef.current) {
      clearTimeout(contactSearchTimeoutRef.current);
    }

    // Clear results and loading if query too short
    if (query.length < 2) {
      setContactSearchResults([]);
      setContactSearchLoading(false);
      return;
    }

    // Debounce the search
    contactSearchTimeoutRef.current = setTimeout(async () => {
      setContactSearchLoading(true);

      // Create new AbortController for this request
      contactSearchAbortRef.current = new AbortController();

      try {
        const response = await api.get<{
          success: boolean;
          contacts: Array<{
            id: number;
            name: string;
            company?: string;
            emails: string[];
            email_count: number;
          }>;
        }>(`/api/v1/sm_tasks/${task.id}/search_contacts?q=${encodeURIComponent(query)}`, {
          signal: contactSearchAbortRef.current.signal
        });

        if (response?.success) {
          setContactSearchResults(response.contacts);
        } else {
          setContactSearchResults([]);
        }
      } catch (err) {
        // Don't log abort errors - they're expected when user types quickly
        if (err instanceof Error && err.name === 'AbortError') {
          return; // Don't update state for aborted requests
        }
        console.error('Failed to search contacts:', err);
        setContactSearchResults([]);
      } finally {
        setContactSearchLoading(false);
      }
    }, 300);
  };

  // Handle bulk link from contact search result
  const handleBulkLinkFromContact = async (contactId: number) => {
    setBulkLinkLoading(true);
    try {
      const response = await api.post<{
        success: boolean;
        linked_count: number;
        skipped_count: number;
        total_found: number;
        attachments: TaskAttachment[];
      }>(`/api/v1/sm_tasks/${task.id}/bulk_link_emails`, {
        contact_id: contactId
      });

      if (response?.success) {
        setLocalAttachments(prev => [...prev, ...response.attachments]);
        setBulkLinkOpen(false);
        setContactSearchQuery('');
        setContactSearchResults([]);
        if (response.linked_count > 0) {
          alert(`Linked ${response.linked_count} emails to this task`);
        } else if (response.total_found === 0) {
          alert('No emails found for this contact');
        } else {
          alert('No new emails to link (all already attached)');
        }
      }
    } catch (err) {
      console.error('Failed to bulk link emails:', err);
      alert('Failed to link emails');
    }
    setBulkLinkLoading(false);
  };

  // Email-to-document highlighting handler
  const handleEmailHighlight = useCallback((email: TaskAttachmentEmail) => {
    // Collect content hashes from this email
    const hashes = new Set<string>(email.attachment_content_hashes || []);

    // If email has a conversation_id, aggregate hashes from all emails in the thread
    if (email.conversation_id) {
      emailAttachments
        .filter(att => att.email?.conversation_id === email.conversation_id)
        .forEach(att => {
          (att.email?.attachment_content_hashes || []).forEach(h => hashes.add(h));
        });
    }

    setSelectedEmailForHighlight(email.id);
    setHighlightedDocHashes(hashes);
  }, [emailAttachments]);

  // Clear highlighting when clicking outside
  const handleClearHighlight = useCallback(() => {
    setSelectedEmailForHighlight(null);
    setHighlightedDocHashes(new Set());
  }, []);

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
  const uploadFileWithCategory = async (file: File, category: AttachmentCategory, actionItemId?: number) => {
    console.log('[TaskFullscreenView] uploadFileWithCategory:', file.name, 'category:', category, 'actionItemId:', actionItemId);
    setAttachmentLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      if (actionItemId) {
        formData.append('action_item_id', actionItemId.toString());
      }

      const response = await api.postFormData<{ success: boolean; attachment: TaskAttachment & { action_item_id?: number } }>(
        `/api/v1/sm_tasks/${task.id}/attachments/upload`,
        formData
      );

      console.log('[TaskFullscreenView] Upload response:', response);

      if (response?.success && response.attachment) {
        console.log('[TaskFullscreenView] Adding attachment to local state:', response.attachment);
        setLocalAttachments(prev => [...prev, response.attachment]);

        // If linked to an action item, also update the local task action items
        if (actionItemId && response.attachment) {
          // Force a refresh to get the updated action items with attachments
          refresh();
        }
      } else {
        console.error('[TaskFullscreenView] Upload failed or no attachment in response:', response);
      }
    } catch (err) {
      console.error('[TaskFullscreenView] Failed to upload file:', err);
    } finally {
      setAttachmentLoading(false);
    }
  };

  // Handle file drop on a specific question
  const handleFileDropOnQuestion = async (file: File, actionItemId: number) => {
    console.log('[TaskFullscreenView] handleFileDropOnQuestion called:', file.name, 'actionItemId:', actionItemId);
    await uploadFileWithCategory(file, 'response', actionItemId);
  };

  // Handle linking an existing attachment to a question
  const handleAttachmentDropOnQuestion = async (attachmentId: number, actionItemId: number) => {
    console.log('[TaskFullscreenView] handleAttachmentDropOnQuestion called:', attachmentId, 'to question:', actionItemId);
    try {
      const response = await api.patch<{ success: boolean; attachment: TaskAttachment }>(
        `/api/v1/sm_tasks/${task.id}/attachments/${attachmentId}`,
        { action_item_id: actionItemId }
      );
      if (response?.success) {
        console.log('[TaskFullscreenView] Attachment linked to question successfully');
        // Refresh tasks to show updated attachments
        await refresh();
      }
    } catch (error) {
      console.error('[TaskFullscreenView] Failed to link attachment:', error);
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

    // Check for existing attachment being dragged (from Emails section)
    const attachmentId = e.dataTransfer.getData('application/x-attachment-id');
    if (attachmentId) {
      console.log('[TaskFullscreenView] handleDrop - Attachment ID detected:', attachmentId);
      // Open dialog to select which question to attach to
      setPendingAttachmentForQuestion(parseInt(attachmentId));
      return;
    }

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

    // Check for existing attachment being dragged (from Emails section)
    const attachmentId = e.dataTransfer.getData('application/x-attachment-id');
    if (attachmentId) {
      console.log('[TaskFullscreenView] handleQuestionsDrop - Attachment ID detected:', attachmentId);
      // Open dialog to select which question to attach to
      setPendingAttachmentForQuestion(parseInt(attachmentId));
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    console.log('[TaskFullscreenView] handleQuestionsDrop - Questions COLUMN drop handler fired, files:', files.length);
    if (files.length > 0) {
      console.log('[TaskFullscreenView] Dropping file as response (column level):', files[0].name);
      // Auto-upload as response (skip category dialog)
      await uploadFileWithCategory(files[0], 'response');
    }
  };

  // Handler for updating an answer inline
  const handleUpdateAnswer = async (itemId: number) => {
    if (!editingAnswerText.trim()) return;
    lastSavedItemIdRef.current = itemId;  // Remember which item we're saving
    setActionItemLoading(itemId);
    await answerActionItem(task.id, itemId, editingAnswerText.trim());
    setEditingAnswerId(null);
    setEditingAnswerText('');
    setActionItemLoading(null);
    scrollToSavedItem();  // Scroll back to the saved question
  };

  // Generate response email body with Q&A (grouped by headers), actions, and file links
  // Uses HTML formatting for proper hyperlinks that work for external recipients
  const generateResponseBody = (): string => {
    let body = '';

    // Helper to format a file link as HTML hyperlink
    const formatFileLink = (fileName: string, url?: string): string => {
      if (url) {
        return `<a href="${url}">${fileName}</a>`;
      }
      return fileName;
    };

    // Get all included questions (with answers OR attachments)
    // A question is included if marked AND has either a text response or attachments
    const includedQuestions = questionItems.filter(q =>
      q.include_in_response && (q.response || (q.attachments && q.attachments.length > 0))
    );

    // Debug: Log ALL questions to diagnose filtering
    console.log('[generateResponseBody] ALL questions:', questionItems.map(q => ({
      id: q.id,
      text: q.text.substring(0, 50),
      include_in_response: q.include_in_response,
      response: q.response ? q.response.substring(0, 30) + '...' : null,
      hasResponse: !!q.response,
      attachmentCount: q.attachments?.length || 0,
      willBeIncluded: q.include_in_response && (!!q.response || (q.attachments && q.attachments.length > 0))
    })));
    console.log('[generateResponseBody] Filtered to include:', includedQuestions.length, 'of', questionItems.length);

    if (includedQuestions.length > 0) {
      body += '<p><strong>Responses to your questions:</strong></p>\n\n';

      // Group questions by their parent header
      const headerMap = new Map<number | null, typeof includedQuestions>();
      includedQuestions.forEach(q => {
        const parentId = q.parent_item_id || null;
        if (!headerMap.has(parentId)) {
          headerMap.set(parentId, []);
        }
        headerMap.get(parentId)!.push(q);
      });

      // Get header names for display
      const getHeaderName = (headerId: number | null): string | null => {
        if (!headerId) return null;
        const header = headerItems.find(h => h.id === headerId);
        return header?.text || null;
      };

      // Sort headers: named headers first, then ungrouped (null)
      const sortedParentIds = Array.from(headerMap.keys()).sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return 0;
      });

      let questionNum = 1;
      sortedParentIds.forEach(parentId => {
        const questions = headerMap.get(parentId) || [];
        const headerName = getHeaderName(parentId);

        // Add header if it exists
        if (headerName) {
          body += `<p><strong><u>${headerName}</u></strong></p>\n`;
        }

        // Add questions under this header
        questions.forEach(q => {
          body += `<p>${questionNum}. ${q.text}<br>\n`;

          // Show text response if present
          if (q.response) {
            body += `&nbsp;&nbsp;&nbsp;→ ${q.response}</p>\n`;
          } else if (q.attachments && q.attachments.length > 0) {
            // No text response but has attachments - the attachments ARE the answer
            body += `&nbsp;&nbsp;&nbsp;→ See attached</p>\n`;
          } else {
            body += '</p>\n';
          }

          // Include attachments linked to this question
          if (q.attachments && q.attachments.length > 0) {
            q.attachments.forEach(att => {
              const fileName = att.document?.display_name || att.document?.file_name || 'Document';
              // Use SharePoint share link if available, otherwise fall back to storage_url or file_url
              const shareUrl = shareLinksMap[att.id];
              const fallbackUrl = att.document?.storage_url || att.document?.file_url;
              const url = shareUrl || fallbackUrl;
              body += `<p>&nbsp;&nbsp;&nbsp;📎 See attached: ${formatFileLink(fileName, url)}</p>\n`;
            });
          }
          questionNum++;
        });
        body += '\n';
      });
    }

    // Add actions marked for inclusion in response
    const includedActions = actionItems.filter(a => a.include_in_response);
    if (includedActions.length > 0) {
      body += '<p><strong>Actions completed:</strong></p>\n';
      body += '<ul>\n';
      includedActions.forEach(a => {
        const status = a.checked ? '✓' : '○';
        body += `<li>${status} ${a.text}</li>\n`;
      });
      body += '</ul>\n\n';
    }

    // Add general response file links (not linked to specific questions)
    // Respects attachmentEmailOptions: 'attach' (file attached), 'link' (SharePoint URL), 'none' (excluded)
    const generalResponseAttachments = responseAttachments.filter(att => {
      const linkedToQuestion = questionItems.some(q =>
        q.attachments?.some(a => a.id === att.id)
      );
      return !linkedToQuestion;
    });

    // Separate by option type
    const attachedFiles = generalResponseAttachments.filter(att => attachmentEmailOptions[att.id] === 'attach');
    const linkedFiles = generalResponseAttachments.filter(att => attachmentEmailOptions[att.id] === 'link');
    // 'none' files are excluded

    // Show files that are attached to the email (no hyperlink - they're attachments)
    if (attachedFiles.length > 0) {
      body += '<p><strong>Files attached:</strong></p>\n';
      body += '<ul>\n';
      attachedFiles.forEach(att => {
        const fileName = att.document?.display_name || att.document?.file_name || 'Document';
        body += `<li>📎 ${fileName}</li>\n`;
      });
      body += '</ul>\n';
    }

    // Show files with SharePoint sharing links
    if (linkedFiles.length > 0) {
      body += '<p><strong>File links:</strong></p>\n';
      body += '<ul>\n';
      linkedFiles.forEach(att => {
        const fileName = att.document?.display_name || att.document?.file_name || 'Document';
        // Use SharePoint share link if available, otherwise fall back to existing URL
        const shareUrl = shareLinksMap[att.id];
        const fallbackUrl = att.document?.storage_url || att.document?.file_url;
        const url = shareUrl || fallbackUrl;
        body += `<li>${formatFileLink(fileName, url)}</li>\n`;
      });
      body += '</ul>\n';
    }

    return body.trim();
  };

  // Prepare email: download file attachments and get sharing links
  const prepareEmailResponse = async () => {
    setPrepareEmailLoading(true);
    setPrepareEmailStatus('');
    try {
      const filesToAttach: File[] = [];
      const shareLinks: Record<number, string> = {};

      // Collect all question attachments that have SharePoint file IDs
      const questionAttachmentsToLink = questionItems
        .filter(q => q.include_in_response)
        .flatMap(q => q.attachments || [])
        .filter(att => att.document?.storage_url);

      // Count files to process for progress
      const toAttach = responseAttachments.filter(a => attachmentEmailOptions[a.id] === 'attach');
      const toLink = responseAttachments.filter(a => {
        const opt = attachmentEmailOptions[a.id];
        const hasExternalStorage = a.document?.storage_url;
        return opt === 'link' && hasExternalStorage;
      });
      const totalToProcess = toAttach.length + toLink.length + questionAttachmentsToLink.length;
      let processed = 0;

      // Process files to attach
      for (const att of toAttach) {
        const fileName = att.document?.display_name || att.document?.file_name || 'file';
        setPrepareEmailStatus(`Downloading ${fileName}... (${processed + 1}/${totalToProcess})`);
        try {
          const response = await api.get<{ success: boolean; filename: string; content: string; content_type: string }>(
            `/api/v1/sm_tasks/${task.id}/attachments/${att.id}/download`
          );
          if (response.success) {
            const byteCharacters = atob(response.content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: response.content_type });
            const file = new File([blob], response.filename, { type: response.content_type });
            filesToAttach.push(file);
          }
        } catch (err) {
          console.error(`Failed to download attachment ${att.id}:`, err);
        }
        processed++;
      }

      // Process files to create share links (response attachments)
      for (const att of toLink) {
        const fileName = att.document?.display_name || att.document?.file_name || 'file';
        setPrepareEmailStatus(`Creating share link for ${fileName}... (${processed + 1}/${totalToProcess})`);
        try {
          const response = await api.post<{ success: boolean; share_url: string }>(
            `/api/v1/sm_tasks/${task.id}/attachments/${att.id}/share_link`
          );
          if (response?.success && response?.share_url) {
            shareLinks[att.id] = response.share_url;
          }
        } catch (err) {
          console.error(`Failed to create share link for attachment ${att.id}:`, err);
        }
        processed++;
      }

      // Process question attachments to create share links
      for (const att of questionAttachmentsToLink) {
        // Skip if we already have a share link for this attachment
        if (shareLinks[att.id]) {
          processed++;
          continue;
        }
        const fileName = att.document?.display_name || att.document?.file_name || 'file';
        setPrepareEmailStatus(`Creating share link for ${fileName}... (${processed + 1}/${totalToProcess})`);
        try {
          const response = await api.post<{ success: boolean; share_url: string }>(
            `/api/v1/sm_tasks/${task.id}/attachments/${att.id}/share_link`
          );
          if (response?.success && response?.share_url) {
            shareLinks[att.id] = response.share_url;
          }
        } catch (err) {
          console.error(`Failed to create share link for question attachment ${att.id}:`, err);
        }
        processed++;
      }

      setPrepareEmailStatus('Opening email...');

      // Store the share links and file attachments
      setShareLinksMap(shareLinks);
      setEmailFileAttachments(filesToAttach);

      // Open compose modal
      setShowComposeEmail(true);
    } catch (err) {
      console.error('Failed to prepare email:', err);
    } finally {
      setPrepareEmailLoading(false);
      setPrepareEmailStatus('');
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

  // Get overdue gradient colors if task is overdue
  const overdueColors = task.is_overdue && task.status !== TASK_STATUS.COMPLETED && task.days_overdue
    ? getOverdueColorClasses(task.days_overdue)
    : null;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <header className={cn(
        "border-b px-6 py-3 flex items-center justify-between shrink-0",
        overdueColors
          ? `${overdueColors.bg} ${overdueColors.border}`
          : "bg-primary/5 dark:bg-primary/10"
      )}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono text-sm text-muted-foreground shrink-0">#{task.task_number}</span>

          {/* Editable task name */}
          {isEditingName ? (
            <SmartTextField
              value={editedName}
              onChange={setEditedName}
              context="task_name"
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setEditedName(task.name);
                  setIsEditingName(false);
                }
              }}
              className="text-lg font-semibold flex-1"
              singleLine
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

            {/* Complete */}
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
                  <span className="text-xs text-muted-foreground">C</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Complete</TooltipContent>
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
        <div
          className="grid gap-6 p-6 min-h-full transition-all duration-200"
          style={{
            gridTemplateColumns: [
              columnsCollapsed.description ? '48px' : '1fr',
              columnsCollapsed.questions ? '48px' : '1fr',
              columnsCollapsed.actions ? '48px' : '1fr',
              columnsCollapsed.attachments ? '48px' : '1fr',
            ].join(' ')
          }}
        >
          {/* Column 1: Description */}
          <div className={cn("flex flex-col gap-4", columnsCollapsed.description && "overflow-hidden")}>
            <div
              className="flex items-center gap-2 cursor-pointer mb-2"
              onClick={() => toggleColumn('description')}
            >
              <ExpandChevron expanded={!columnsCollapsed.description} size={14} />
              <h2 className="text-sm font-medium text-muted-foreground">Description</h2>
            </div>
            {!columnsCollapsed.description && (
              <>
                <div>
                  {isEditingDescription ? (
                    <SmartTextField
                      value={editedDescription}
                      onChange={setEditedDescription}
                      onBlur={handleSaveDescription}
                      className="min-h-[150px]"
                      context="notes"
                      minHeight={150}
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

              {/* Start Date */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-20">Start Date:</span>
                {task.status === 'not_started' ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 hover:text-primary transition-colors">
                        <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                        <span>{format(new Date(task.start_date), 'dd MMM yyyy')}</span>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(task.start_date)}
                        onSelect={async (date) => {
                          if (date) {
                            // When start date changes, recalculate end_date using working days
                            const newEndDate = calculateEndDate(date, task.duration_days);
                            await updateTask(task.id, {
                              start_date: format(date, 'yyyy-MM-dd'),
                              end_date: newEndDate
                            });
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className="text-muted-foreground">{format(new Date(task.start_date), 'dd MMM yyyy')}</span>
                )}
              </div>

              {/* Complete Date */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-20">Complete Date:</span>
                {task.status === 'not_started' ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 hover:text-primary transition-colors">
                        <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                        <span>{format(new Date(task.end_date), 'dd MMM yyyy')}</span>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(task.end_date)}
                        onSelect={async (date) => {
                          if (date) {
                            // When end date changes, recalculate duration using working days
                            const newDuration = calculateDuration(task.start_date, date);
                            // Ensure minimum duration of 1 day
                            const validDuration = Math.max(1, newDuration);
                            await updateTask(task.id, {
                              end_date: format(date, 'yyyy-MM-dd'),
                              duration_days: validDuration
                            });
                            setDuration(validDuration);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className="text-muted-foreground">{format(new Date(task.end_date), 'dd MMM yyyy')}</span>
                )}
              </div>

              {/* Required By Date */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-20">Required By:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "flex items-center gap-1 hover:text-primary transition-colors",
                      task.is_overdue && task.status !== TASK_STATUS.COMPLETED && "text-red-600 dark:text-red-400"
                    )}>
                      <CalendarIcon className={cn(
                        "h-3 w-3",
                        task.is_overdue && task.status !== TASK_STATUS.COMPLETED ? "text-red-500" : "text-muted-foreground"
                      )} />
                      <span>{task.required_by ? format(new Date(task.required_by), 'dd MMM yyyy') : 'Not set'}</span>
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={task.required_by ? new Date(task.required_by) : undefined}
                      onSelect={async (date) => {
                        await updateTask(task.id, {
                          required_by: date ? format(date, 'yyyy-MM-dd') : undefined
                        });
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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
              </>
            )}
          </div>

          {/* Column 2: Questions */}
          <div
            className={cn(
              "flex flex-col h-full relative",
              columnsCollapsed.questions && "overflow-hidden",
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
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => toggleColumn('questions')}
              >
                <ExpandChevron expanded={!columnsCollapsed.questions} size={14} />
                <h2 className="text-sm font-medium text-muted-foreground">Questions</h2>
                <Badge variant="secondary" className="text-xs">{questionItems.length + headerItems.length}</Badge>
              </div>
              {!columnsCollapsed.questions && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={(e) => { e.stopPropagation(); setShowAddHeader(!showAddHeader); }}
                  >
                    + Header
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewActionItemType('question');
                      setShowBulkPaste(true);
                    }}
                  >
                    + Paste List
                  </Button>
                </div>
              )}
            </div>

            {!columnsCollapsed.questions && (
              <>
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
              {/* Collapse/Expand all headers button - on the left */}
              {groupedQuestions.headers.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => {
                    const allCollapsed = groupedQuestions.headers.every(h => collapsedHeaders.has(h.id));
                    if (allCollapsed) {
                      // Expand all
                      setCollapsedHeaders(new Set());
                    } else {
                      // Collapse all
                      setCollapsedHeaders(new Set(groupedQuestions.headers.map(h => h.id)));
                    }
                  }}
                  title={groupedQuestions.headers.every(h => collapsedHeaders.has(h.id)) ? "Expand all headers" : "Collapse all headers"}
                >
                  <ExpandChevron expanded={!groupedQuestions.headers.every(h => collapsedHeaders.has(h.id))} />
                </Button>
              )}
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
                spellCheck={true}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddActionItem('question')}
                disabled={!newActionItemText.trim() || actionItemLoading === 'new'}
                className="h-8 shrink-0"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* Question items list with drag-drop */}
            <div className="flex-1 overflow-auto space-y-2 min-h-0">
              <DndContext
                sensors={sensors}
                collisionDetection={headerPriorityCollision}
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
                                spellCheck={true}
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
                              onFileDrop={handleFileDropOnQuestion}
                              onAttachmentDrop={handleAttachmentDropOnQuestion}
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
                              handleUndelegateQuestion={handleUndelegateQuestion}
                              onCreateAction={(text) => addActionItem(task.id, text, 'action')}
                              setSelectedEmailId={setSelectedEmailId}
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
                      onFileDrop={handleFileDropOnQuestion}
                      onAttachmentDrop={handleAttachmentDropOnQuestion}
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
                      handleUndelegateQuestion={handleUndelegateQuestion}
                      onCreateAction={(text) => addActionItem(task.id, text, 'action')}
                      setSelectedEmailId={setSelectedEmailId}
                    />
                  ))}
                </SortableContext>

                {/* Ungroup drop zone - appears when dragging a grouped question */}
                {isDraggingGroupedItem && (
                  <UngroupDropZone
                    isOver={isOverUngroupZone}
                    onIsOverChange={setIsOverUngroupZone}
                  />
                )}

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

            {/* Response section - shows documents and emails attached as responses */}
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
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-attachment-id', att.id.toString());
                        e.dataTransfer.effectAllowed = 'link';
                      }}
                      className="flex items-center gap-2 p-2 rounded bg-green-50 dark:bg-green-950/30 text-sm group cursor-grab active:cursor-grabbing"
                    >
                      {att.email ? (
                        <>
                          <Mail className="h-4 w-4 text-green-600 shrink-0" />
                          <button
                            onClick={() => setSelectedEmailId(att.email!.id)}
                            className="flex-1 truncate font-medium text-left hover:underline"
                          >
                            {att.email.subject || '(No subject)'}
                          </button>
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 text-green-600 shrink-0" />
                          <span className="flex-1 truncate font-medium">
                            {att.document?.display_name || att.document?.file_name}
                          </span>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveAttachment(att.id)}
                        title="Delete attachment"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
              </>
            )}

          </div>

          {/* Column 3: Actions */}
          <div className={cn("flex flex-col h-full", columnsCollapsed.actions && "overflow-hidden")}>
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => toggleColumn('actions')}
              >
                <ExpandChevron expanded={!columnsCollapsed.actions} size={14} />
                <h2 className="text-sm font-medium text-muted-foreground">Actions</h2>
                <Badge variant="secondary" className="text-xs">{actionItems.length}</Badge>
              </div>
              {!columnsCollapsed.actions && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewActionItemType('action');
                    setShowBulkPaste(true);
                  }}
                >
                  + Paste List
                </Button>
              )}
            </div>

            {!columnsCollapsed.actions && (
              <>
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
                spellCheck={true}
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
                        spellCheck={true}
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
                    <div className="ml-6 flex items-center gap-1">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-5 text-xs p-0 text-primary"
                        onClick={() => window.open(`/sm_tasks/${item.delegated_task_id}`, '_blank')}
                      >
                        → Task #{item.delegated_task_id}
                      </Button>
                      {item.delegated_task?.assigned_user_name && (
                        <span className="text-xs text-muted-foreground">
                          ({item.delegated_task.assigned_user_name})
                        </span>
                      )}
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
              </>
            )}

          </div>

          {/* Column 4: Attachments */}
          <div
            className={cn(
              "flex flex-col h-full relative",
              columnsCollapsed.attachments && "overflow-hidden",
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
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => toggleColumn('attachments')}
              >
                <ExpandChevron expanded={!columnsCollapsed.attachments} size={14} />
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-muted-foreground">Attachments</h2>
              </div>
              {!columnsCollapsed.attachments && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={(e) => { e.stopPropagation(); setShowAttachmentPicker(!showAttachmentPicker); }}
                >
                  {showAttachmentPicker ? 'Close' : '+ Add'}
                </Button>
              )}
            </div>

            {!columnsCollapsed.attachments && (
              <>
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
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="flex items-center gap-2 cursor-pointer flex-1"
                  onClick={() => setEmailsCollapsed(!emailsCollapsed)}
                >
                  {emailsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Emails</span>
                  <Badge variant="secondary" className="text-xs">
                    {emailSourceFilter.type !== 'all' ? `${emailAttachments.length}/${allEmailAttachments.length}` : allEmailAttachments.length}
                  </Badge>
                  {/* Quick filter chips */}
                  {!emailsCollapsed && matchedEmailCount > 0 && (
                    <Button
                      variant={emailSourceFilter.type === 'matched' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-5 px-1.5 text-[10px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (emailSourceFilter.type === 'matched') {
                          setEmailSourceFilter({ type: 'all' });
                        } else {
                          setEmailSourceFilter({ type: 'matched', label: 'Matched' });
                        }
                      }}
                    >
                      <Target className="h-3 w-3 mr-0.5" />
                      {matchedEmailCount}
                    </Button>
                  )}
                  {!emailsCollapsed && threadEmailCount > 0 && (
                    <Button
                      variant={emailSourceFilter.type === 'thread' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-5 px-1.5 text-[10px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (emailSourceFilter.type === 'thread') {
                          setEmailSourceFilter({ type: 'all' });
                        } else {
                          setEmailSourceFilter({ type: 'thread', label: 'Thread' });
                        }
                      }}
                    >
                      <Users className="h-3 w-3 mr-0.5" />
                      {threadEmailCount}
                    </Button>
                  )}
                  {/* Sender filter chips - show unique senders with email counts */}
                  {!emailsCollapsed && uniqueEmailSenders.length > 0 && (
                    <div className="flex flex-wrap gap-1 ml-2 pl-2 border-l border-border">
                      {uniqueEmailSenders.slice(0, 5).map((sender) => {
                        const isActive = emailSourceFilter.type === 'contact' &&
                          emailSourceFilter.emails?.some(e => e.toLowerCase() === sender.email);
                        return (
                          <Button
                            key={sender.email}
                            variant={isActive ? 'default' : 'ghost'}
                            size="sm"
                            className="h-5 px-1.5 text-[10px] max-w-[120px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isActive) {
                                setEmailSourceFilter({ type: 'all' });
                              } else {
                                setEmailSourceFilter({
                                  type: 'contact',
                                  emails: [sender.email],
                                  label: sender.name
                                });
                              }
                            }}
                            title={`${sender.name} (${sender.email})`}
                          >
                            <span className="truncate">{sender.name.split(' ')[0]}</span>
                            <Badge variant="secondary" className="ml-1 h-3 px-1 text-[9px]">
                              {sender.count}
                            </Badge>
                          </Button>
                        );
                      })}
                      {uniqueEmailSenders.length > 5 && (
                        <span className="text-[10px] text-muted-foreground self-center">
                          +{uniqueEmailSenders.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bulk Link Emails Button */}
                <Popover open={bulkLinkOpen} onOpenChange={(open) => {
                  setBulkLinkOpen(open);
                  if (open) {
                    fetchBulkLinkOptions();
                  } else {
                    // Reset search state when closing
                    setContactSearchQuery('');
                    setContactSearchResults([]);
                  }
                }}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      Link
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3" align="end">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Link emails from:</h4>

                      {/* Client Quick-Add Section */}
                      {(() => {
                        const clients = bulkLinkOptions?.options?.filter(opt =>
                          opt.role?.toLowerCase().includes('client')
                        ) || [];

                        if (clients.length === 0) return null;

                        // Get all client job_contact_ids that have emails
                        const clientsWithEmails = clients.filter(c => c.emails.length > 0 && c.job_contact_id);
                        const allClientIds = clientsWithEmails.map(c => c.job_contact_id as number);
                        const totalClientEmails = clientsWithEmails.reduce((sum, c) => sum + c.email_count, 0);

                        return (
                          <div className="space-y-2 pb-3 border-b">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                Job Clients
                              </label>
                              {/* All Clients button - links all client emails at once */}
                              {allClientIds.length > 0 && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-6 px-2 text-xs bg-primary"
                                  onClick={() => handleBulkLinkAllClients(allClientIds)}
                                  disabled={bulkLinkLoading}
                                >
                                  <Users className="h-3 w-3 mr-1" />
                                  All Clients ({totalClientEmails})
                                </Button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {clients.map((client) => {
                                const clientKey = client.job_contact_id || client.contact_id || 0;
                                const hasMultipleEmails = client.emails.length > 1;
                                const isExpanded = expandedClientId === clientKey;
                                const linkedCount = getLinkedCountForEmails(client.emails);

                                return (
                                  <div key={clientKey} className="relative">
                                    <div className="flex items-center gap-0.5">
                                      {/* Main button - click to filter emails */}
                                      <Button
                                        variant={isExpanded ? "default" : linkedCount > 0 ? "secondary" : "outline"}
                                        size="sm"
                                        className="h-8 text-xs rounded-r-none"
                                        onClick={() => {
                                          if (client.emails.length > 0) {
                                            setEmailSourceFilter({
                                              type: 'contact',
                                              emails: client.emails,
                                              label: client.name
                                            });
                                            setBulkLinkOpen(false);
                                          }
                                        }}
                                        disabled={client.emails.length === 0}
                                      >
                                        <User className="h-3 w-3 mr-1" />
                                        {client.name}
                                        {linkedCount > 0 && (
                                          <Badge variant="default" className="ml-1 h-4 px-1 text-[10px] bg-green-600">
                                            {linkedCount}
                                          </Badge>
                                        )}
                                        {client.emails.length === 0 && (
                                          <span className="ml-1 text-muted-foreground">(no email)</span>
                                        )}
                                      </Button>
                                      {/* Link button - click to link emails */}
                                      {client.emails.length > 0 && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 px-1.5 rounded-l-none border-l-0"
                                          onClick={() => {
                                            if (hasMultipleEmails) {
                                              setExpandedClientId(isExpanded ? null : clientKey);
                                            } else if (client.emails.length === 1) {
                                              handleBulkLinkOption(client);
                                            }
                                          }}
                                          disabled={bulkLinkLoading}
                                          title="Link emails from this contact"
                                        >
                                          {hasMultipleEmails ? (
                                            <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                          ) : (
                                            <Plus className="h-3 w-3" />
                                          )}
                                        </Button>
                                      )}
                                    </div>

                                    {/* Email picker dropdown for clients with multiple emails */}
                                    {isExpanded && hasMultipleEmails && (
                                      <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-md shadow-lg p-1 min-w-[200px]">
                                        <div className="text-xs text-muted-foreground px-2 py-1">
                                          Choose email:
                                        </div>
                                        {client.emails.map((email, idx) => (
                                          <button
                                            key={idx}
                                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted truncate"
                                            onClick={() => {
                                              handleBulkLinkByEmail(email);
                                              setExpandedClientId(null);
                                            }}
                                            disabled={bulkLinkLoading}
                                          >
                                            <Mail className="h-3 w-3 inline mr-1" />
                                            {email}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Contact Search */}
                      <div className="space-y-2">
                        <Input
                          placeholder="Search contacts..."
                          value={contactSearchQuery}
                          onChange={(e) => handleContactSearch(e.target.value)}
                          className="h-8 text-xs"
                        />

                        {/* Search Results */}
                        {contactSearchLoading && (
                          <div className="flex items-center justify-center py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        )}

                        {!contactSearchLoading && contactSearchResults.length > 0 && (
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {contactSearchResults.map((contact) => (
                              <button
                                key={contact.id}
                                className="w-full flex items-center justify-between p-2 text-sm rounded hover:bg-muted text-left"
                                onClick={() => handleBulkLinkFromContact(contact.id)}
                                disabled={bulkLinkLoading}
                              >
                                <div className="truncate flex-1">
                                  <div className="font-medium truncate">{contact.name}</div>
                                  {contact.company && (
                                    <div className="text-xs text-muted-foreground truncate">{contact.company}</div>
                                  )}
                                </div>
                                <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                                  {contact.email_count}
                                </Badge>
                              </button>
                            ))}
                          </div>
                        )}

                        {!contactSearchLoading && contactSearchQuery.length >= 2 && contactSearchResults.length === 0 && (
                          <div className="text-xs text-muted-foreground text-center py-2">
                            No contacts found
                          </div>
                        )}
                      </div>

                      {bulkLinkLoading && !contactSearchLoading && (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}

                      {/* Suggested Contacts (Supplier, Assigned - excluding Clients shown above) */}
                      {(() => {
                        const nonClientOptions = bulkLinkOptions?.options?.filter(opt =>
                          !opt.role?.toLowerCase().includes('client')
                        ) || [];

                        if (!bulkLinkLoading && nonClientOptions.length > 0) {
                          return (
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Suggested:</label>
                              {nonClientOptions.map((opt, idx) => (
                                <button
                                  key={`${opt.type}-${opt.job_contact_id || opt.contact_id || opt.user_id || idx}`}
                                  className="w-full flex items-center justify-between p-2 text-sm rounded hover:bg-muted text-left"
                                  onClick={() => handleBulkLinkOption(opt)}
                                >
                                  <span className="truncate">{opt.label}</span>
                                  <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                                    {opt.email_count}
                                  </Badge>
                                </button>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Manual email input */}
                      <div className="space-y-2 border-t pt-3">
                        <label className="text-xs text-muted-foreground">Or enter email address:</label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="email@example.com"
                            value={bulkLinkEmail}
                            onChange={(e) => setBulkLinkEmail(e.target.value)}
                            className="h-8 text-xs flex-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleBulkLinkEmail();
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-8 px-3"
                            onClick={handleBulkLinkEmail}
                            disabled={!bulkLinkEmail.trim() || bulkLinkLoading}
                          >
                            Link
                          </Button>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {!emailsCollapsed && (
                <>
                  {/* Keywords input with Match button */}
                  <div className="mb-2 flex gap-1">
                    <Input
                      placeholder="Search keywords (e.g., Carindale, DUNS)"
                      value={emailKeywords}
                      onChange={(e) => setEmailKeywords(e.target.value)}
                      onBlur={handleSaveKeywords}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && emailKeywords.trim()) {
                          handleMatchKeywords('subject');
                        }
                      }}
                      className="h-7 text-xs flex-1"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={loading === 'matching'}
                        >
                          {loading === 'matching' ? (
                            <Spinner className="h-3 w-3" />
                          ) : (
                            <>
                              <Search className="h-3 w-3 mr-1" />
                              Match
                              <MoreVertical className="h-3 w-3 ml-1" />
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => handleMatchKeywords('subject')}
                          disabled={!emailKeywords.trim()}
                        >
                          <Search className="h-3.5 w-3.5 mr-2" />
                          Subject Only
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleMatchKeywords('body')}
                          disabled={!emailKeywords.trim()}
                        >
                          <FileText className="h-3.5 w-3.5 mr-2" />
                          Body Only
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleMatchKeywords('full')}
                          disabled={!emailKeywords.trim()}
                        >
                          <Search className="h-3.5 w-3.5 mr-2" />
                          Full Text
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleMatchKeywords('exact')}
                          disabled={!emailKeywords.trim()}
                        >
                          <Target className="h-3.5 w-3.5 mr-2" />
                          Exact Match
                        </DropdownMenuItem>
                        {emailAttachments.some(att => att.notes?.startsWith('Matched')) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={handleClearMatchedEmails}
                              className="text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Clear Matched
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Email filter indicator */}
                  {emailSourceFilter.type !== 'all' && (
                    <div className="mb-2 flex items-center gap-2 px-2 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
                      <span className="text-xs text-blue-700 dark:text-blue-300">
                        Showing: {emailSourceFilter.label || emailSourceFilter.type}
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {emailAttachments.length} of {allEmailAttachments.length}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-xs text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 ml-auto"
                        onClick={() => setEmailSourceFilter({ type: 'all' })}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    </div>
                  )}

                  {/* Email Tree View - grouped by source */}
                  <div className="border rounded-md">
                    {allEmailAttachments.length > 0 ? (
                      <div className="divide-y">
                        {/* Thread Emails Branch */}
                        {categorizedEmails.thread.length > 0 && (
                          <Collapsible
                            open={emailTreeExpanded.thread}
                            onOpenChange={(open: boolean) => setEmailTreeExpanded(prev => ({ ...prev, thread: open }))}
                          >
                            <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-1.5 bg-muted/30 hover:bg-muted/50">
                              {emailTreeExpanded.thread ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <Mail className="h-3 w-3 text-blue-500" />
                              <span className="text-xs font-medium">Thread</span>
                              <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                                {filteredCategories.thread.length}
                                {emailSourceFilter.type === 'contact' && filteredCategories.thread.length !== categorizedEmails.thread.length &&
                                  ` / ${categorizedEmails.thread.length}`}
                              </Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="divide-y">
                                {filteredCategories.thread.map((att) => (
                                        <ContextMenu key={att.id}>
                                          <ContextMenuTrigger asChild>
                                            <div
                                              draggable
                                              onDragStart={(e) => {
                                                e.dataTransfer.setData('application/x-attachment-id', att.id.toString());
                                                e.dataTransfer.effectAllowed = 'move';
                                              }}
                                              className={cn(
                                                "flex items-center gap-2 p-2 hover:bg-muted/50 cursor-grab text-xs group",
                                                selectedEmailForHighlight === att.email?.id && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                              )}
                                              onClick={() => {
                                                if (att.email) {
                                                  setSelectedEmailId(att.email.id);
                                                  handleEmailHighlight(att.email);
                                                }
                                              }}
                                            >
                                              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                              <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{att.email?.subject}</div>
                                                <div className="text-muted-foreground truncate flex items-center gap-2">
                                                  <span className="truncate">{att.email?.from_email}</span>
                                                  {att.email?.received_at && (
                                                    <span className="shrink-0 text-[10px]">
                                                      {format(new Date(att.email.received_at), 'dd MMM HH:mm')}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0 text-muted-foreground hover:text-blue-500"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleCopyShareLink(att.id);
                                                }}
                                                title="Copy shareable link"
                                              >
                                                <Link2 className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0 text-muted-foreground hover:text-green-500"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (att.email?.id) {
                                                    handleLinkEmailThread(att.email.id);
                                                  }
                                                }}
                                                title="Link entire email thread"
                                              >
                                                <Users className="h-3 w-3" />
                                              </Button>
                                              {questionItems.length > 0 && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-5 w-5 p-0 text-muted-foreground hover:text-blue-500"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPendingAttachmentForQuestion(att.id);
                                                  }}
                                                  title="Link to question"
                                                >
                                                  <HelpCircle className="h-3 w-3" />
                                                </Button>
                                              )}
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleRemoveAttachment(att.id);
                                                }}
                                                title="Delete attachment"
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </ContextMenuTrigger>
                                          <ContextMenuContent>
                                            {questionItems.length > 0 && (
                                              <>
                                                <ContextMenuSub>
                                                  <ContextMenuSubTrigger>
                                                    <HelpCircle className="h-4 w-4 mr-2 text-blue-500" />
                                                    Link to Question
                                                  </ContextMenuSubTrigger>
                                                  <ContextMenuSubContent className="max-w-[350px] max-h-[300px] overflow-y-auto">
                                                    {/* Grouped questions with headers */}
                                                    {groupedQuestions.headers.map((header, headerIdx) => (
                                                      <div key={header.id}>
                                                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                                                          {headerIdx + 1}. {header.text}
                                                        </div>
                                                        {header.children.map((q, qIdx) => (
                                                          <ContextMenuItem
                                                            key={q.id}
                                                            onClick={() => handleAttachmentDropOnQuestion(att.id, q.id)}
                                                          >
                                                            <Badge variant="secondary" className="mr-2 shrink-0 text-[10px] font-mono px-1">
                                                              {headerIdx + 1}.{qIdx + 1}
                                                            </Badge>
                                                            <span className="line-clamp-2 text-sm">{q.text}</span>
                                                          </ContextMenuItem>
                                                        ))}
                                                      </div>
                                                    ))}
                                                    {/* Ungrouped questions */}
                                                    {groupedQuestions.ungrouped.length > 0 && (
                                                      <div>
                                                        {groupedQuestions.headers.length > 0 && (
                                                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                                                            Other
                                                          </div>
                                                        )}
                                                        {groupedQuestions.ungrouped.map((q, qIdx) => (
                                                          <ContextMenuItem
                                                            key={q.id}
                                                            onClick={() => handleAttachmentDropOnQuestion(att.id, q.id)}
                                                          >
                                                            <Badge variant="secondary" className="mr-2 shrink-0 text-[10px] font-mono px-1">
                                                              {groupedQuestions.headers.length > 0 ? `${groupedQuestions.headers.length + 1}.${qIdx + 1}` : qIdx + 1}
                                                            </Badge>
                                                            <span className="line-clamp-2 text-sm">{q.text}</span>
                                                          </ContextMenuItem>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </ContextMenuSubContent>
                                                </ContextMenuSub>
                                                <ContextMenuSeparator />
                                              </>
                                            )}
                                            <ContextMenuItem onClick={() => handleCopyShareLink(att.id)}>
                                              <Link2 className="h-4 w-4 mr-2" />
                                              Copy Link
                                            </ContextMenuItem>
                                            {att.email?.id && (
                                              <ContextMenuItem onClick={() => handleLinkEmailThread(att.email!.id)}>
                                                <Users className="h-4 w-4 mr-2" />
                                                Link Thread
                                              </ContextMenuItem>
                                            )}
                                            <ContextMenuSeparator />
                                            <ContextMenuItem
                                              onClick={() => handleRemoveAttachment(att.id)}
                                              className="text-destructive focus:text-destructive"
                                            >
                                              <Trash2 className="h-4 w-4 mr-2" />
                                              Delete
                                            </ContextMenuItem>
                                          </ContextMenuContent>
                                        </ContextMenu>
                                      ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Auto-Matched Emails Branch */}
                        {categorizedEmails.matched.length > 0 && (
                          <Collapsible
                            open={emailTreeExpanded.matched}
                            onOpenChange={(open: boolean) => setEmailTreeExpanded(prev => ({ ...prev, matched: open }))}
                          >
                            <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-1.5 bg-muted/30 hover:bg-muted/50">
                              {emailTreeExpanded.matched ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <Search className="h-3 w-3 text-amber-500" />
                              <span className="text-xs font-medium">Auto-Matched</span>
                              <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                                {filteredCategories.matched.length}
                                {emailSourceFilter.type === 'contact' && filteredCategories.matched.length !== categorizedEmails.matched.length &&
                                  ` / ${categorizedEmails.matched.length}`}
                              </Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="divide-y">
                                {filteredCategories.matched.map((att) => (
                                  <ContextMenu key={att.id}>
                                    <ContextMenuTrigger asChild>
                                      <div
                                        draggable
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData('application/x-attachment-id', att.id.toString());
                                          e.dataTransfer.effectAllowed = 'move';
                                        }}
                                        className={cn(
                                          "flex items-center gap-2 p-2 hover:bg-muted/50 cursor-grab text-xs group",
                                          selectedEmailForHighlight === att.email?.id && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                        )}
                                        onClick={() => {
                                          if (att.email) {
                                            setSelectedEmailId(att.email.id);
                                            handleEmailHighlight(att.email);
                                          }
                                        }}
                                      >
                                        <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium truncate">{att.email?.subject}</div>
                                          <div className="text-muted-foreground truncate flex items-center gap-2">
                                            <span className="truncate">{att.email?.from_email}</span>
                                            {att.email?.received_at && (
                                              <span className="shrink-0 text-[10px]">
                                                {format(new Date(att.email.received_at), 'dd MMM HH:mm')}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0 text-muted-foreground hover:text-blue-500"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCopyShareLink(att.id);
                                          }}
                                          title="Copy shareable link"
                                        >
                                          <Link2 className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveAttachment(att.id);
                                          }}
                                          title="Delete attachment"
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent>
                                      <ContextMenuItem onClick={() => handleCopyShareLink(att.id)}>
                                        <Link2 className="h-4 w-4 mr-2" />
                                        Copy Link
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem
                                        onClick={() => handleRemoveAttachment(att.id)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </ContextMenuItem>
                                    </ContextMenuContent>
                                  </ContextMenu>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Manually Linked Emails Branch */}
                        {categorizedEmails.linked.length > 0 && (
                          <Collapsible
                            open={emailTreeExpanded.linked}
                            onOpenChange={(open: boolean) => setEmailTreeExpanded(prev => ({ ...prev, linked: open }))}
                          >
                            <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-1.5 bg-muted/30 hover:bg-muted/50">
                              {emailTreeExpanded.linked ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <Link2 className="h-3 w-3 text-green-500" />
                              <span className="text-xs font-medium">Linked</span>
                              <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                                {filteredCategories.linked.length}
                                {emailSourceFilter.type === 'contact' && filteredCategories.linked.length !== categorizedEmails.linked.length &&
                                  ` / ${categorizedEmails.linked.length}`}
                              </Badge>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="divide-y">
                                {filteredCategories.linked.map((att) => (
                                  <ContextMenu key={att.id}>
                                    <ContextMenuTrigger asChild>
                                      <div
                                        draggable
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData('application/x-attachment-id', att.id.toString());
                                          e.dataTransfer.effectAllowed = 'move';
                                        }}
                                        className={cn(
                                          "flex items-center gap-2 p-2 hover:bg-muted/50 cursor-grab text-xs group",
                                          selectedEmailForHighlight === att.email?.id && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                        )}
                                        onClick={() => {
                                          if (att.email) {
                                            setSelectedEmailId(att.email.id);
                                            handleEmailHighlight(att.email);
                                          }
                                        }}
                                      >
                                        <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium truncate">{att.email?.subject}</div>
                                          <div className="text-muted-foreground truncate flex items-center gap-2">
                                            <span className="truncate">{att.email?.from_email}</span>
                                            {att.email?.received_at && (
                                              <span className="shrink-0 text-[10px]">
                                                {format(new Date(att.email.received_at), 'dd MMM HH:mm')}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0 text-muted-foreground hover:text-blue-500"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCopyShareLink(att.id);
                                          }}
                                          title="Copy shareable link"
                                        >
                                          <Link2 className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveAttachment(att.id);
                                          }}
                                          title="Delete attachment"
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent>
                                      <ContextMenuItem onClick={() => handleCopyShareLink(att.id)}>
                                        <Link2 className="h-4 w-4 mr-2" />
                                        Copy Link
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem
                                        onClick={() => handleRemoveAttachment(att.id)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </ContextMenuItem>
                                    </ContextMenuContent>
                                  </ContextMenu>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
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
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="flex items-center gap-2 cursor-pointer flex-1"
                  onClick={() => setDocumentsCollapsed(!documentsCollapsed)}
                >
                  {documentsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Documents</span>
                  <Badge variant="secondary" className="text-xs">{infoAttachments.length}</Badge>
                </div>
                {/* Bulk actions when documents selected */}
                {selectedDocIds.size > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{selectedDocIds.size} selected</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={handleBulkDeleteDocs}
                      disabled={attachmentLoading}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={clearDocSelection}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {!documentsCollapsed && (
                <div className="border rounded-md">
                  {infoAttachments.length > 0 ? (
                    <div className="divide-y">
                      {/* Select all checkbox */}
                      <div className="flex items-center gap-2 p-2 bg-muted/30 text-xs border-b">
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded border-border"
                          checked={infoAttachments.length > 0 && infoAttachments.every(a => selectedDocIds.has(a.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              selectAllDocs(infoAttachments.map(a => a.id));
                            } else {
                              clearDocSelection();
                            }
                          }}
                        />
                        <span className="text-muted-foreground">Select all</span>
                      </div>
                      {infoAttachments.map((att) => (
                        <div
                          key={att.id}
                          className={cn(
                            "flex items-center gap-2 p-2 hover:bg-muted/50 text-xs group cursor-pointer",
                            selectedDocIds.has(att.id) && "bg-primary/10",
                            att.document?.content_hash && highlightedDocHashes.has(att.document.content_hash) &&
                              "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/30"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-3 w-3 rounded border-border"
                            checked={selectedDocIds.has(att.id)}
                            onChange={() => toggleDocSelection(att.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div
                            className="flex items-center gap-2 flex-1 min-w-0"
                            onClick={() => {
                              if (att.document) {
                                const docUrl = `${getApiBaseUrl()}/api/v1/company_documents/${att.document.id}/content`;
                                setViewerDocument({
                                  url: docUrl,
                                  fileName: att.document.display_name || att.document.file_name || 'document',
                                  fileType: getFileType(att.document.file_name),
                                });
                              }
                            }}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const url = att.document?.storage_url || att.document?.file_url;
                              if (url) {
                                window.open(url, '_blank');
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
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAttachment(att.id);
                            }}
                            title="Delete attachment"
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
                <div className="border rounded-md divide-y bg-primary/5 dark:bg-primary/10 mb-2">
                  {responseAttachments.map((att) => {
                    const hasExternalStorage = att.document?.storage_url;
                    const emailOption = attachmentEmailOptions[att.id] || 'link';
                    const isEmail = !!att.email;
                    return (
                      <div key={att.id} className="p-2 text-xs">
                        <div
                          className="flex items-center gap-2 group hover:bg-muted/50 cursor-pointer rounded p-1 -m-1"
                          onClick={() => {
                            if (att.email) {
                              setSelectedEmailId(att.email.id);
                            } else if (att.document) {
                              const docUrl = `${getApiBaseUrl()}/api/v1/company_documents/${att.document.id}/content`;
                              setViewerDocument({
                                url: docUrl,
                                fileName: att.document.display_name || att.document.file_name || 'document',
                                fileType: getFileType(att.document.file_name),
                              });
                            }
                          }}
                        >
                          {isEmail ? (
                            <Mail className="h-3 w-3 text-primary shrink-0" />
                          ) : (
                            <FileText className="h-3 w-3 text-primary shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {isEmail
                                ? (att.email?.subject || '(No subject)')
                                : (att.document?.display_name || att.document?.file_name)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAttachment(att.id);
                            }}
                            title="Delete attachment"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        {/* Email inclusion options - only for documents, not email attachments */}
                        {!isEmail && (
                        <div className="flex items-center gap-3 mt-1.5 ml-5 text-[10px]">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`att-${att.id}`}
                              checked={emailOption === 'attach'}
                              onChange={() => setAttachmentEmailOptions(prev => ({ ...prev, [att.id]: 'attach' }))}
                              className="w-3 h-3"
                            />
                            <span>Attach</span>
                          </label>
                          {hasExternalStorage && (
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`att-${att.id}`}
                                checked={emailOption === 'link'}
                                onChange={() => setAttachmentEmailOptions(prev => ({ ...prev, [att.id]: 'link' }))}
                                className="w-3 h-3"
                              />
                              <span>Link</span>
                            </label>
                          )}
                          <label className="flex items-center gap-1 cursor-pointer text-muted-foreground">
                            <input
                              type="radio"
                              name={`att-${att.id}`}
                              checked={emailOption === 'none'}
                              onChange={() => setAttachmentEmailOptions(prev => ({ ...prev, [att.id]: 'none' }))}
                              className="w-3 h-3"
                            />
                            <span>Skip</span>
                          </label>
                        </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3 mb-2 border border-dashed rounded-md">
                  Drag files here to add response attachments
                </p>
              )}
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={prepareEmailResponse}
                disabled={prepareEmailLoading}
              >
                {prepareEmailLoading ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Response Email
                  </>
                )}
              </Button>
              {prepareEmailStatus && (
                <p className="text-xs text-muted-foreground text-center mt-1 truncate" title={prepareEmailStatus}>
                  {prepareEmailStatus}
                </p>
              )}
            </div>
              </>
            )}
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

      {/* Document viewer modal with markup/annotation tools */}
      {viewerDocument && (
        <DocumentViewerModal
          url={viewerDocument.url}
          fileName={viewerDocument.fileName}
          fileType={viewerDocument.fileType}
          open={!!viewerDocument}
          onOpenChange={(open) => !open && setViewerDocument(null)}
          onSave={async (pdfBytes, fileName) => {
            // Download the annotated PDF
            const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.replace(/\.[^.]+$/, '') + '_annotated.pdf';
            a.click();
            URL.revokeObjectURL(url);
          }}
        />
      )}

      {/* Attachment category dialog */}
      <AttachmentCategoryDialog
        open={showCategoryDialog}
        fileName={pendingFile?.name || ''}
        onSelect={handleCategorySelect}
        onCancel={handleCategoryCancel}
      />

      {/* Question selector dialog for attachment linking */}
      <Dialog
        open={pendingAttachmentForQuestion !== null}
        onOpenChange={(open) => !open && setPendingAttachmentForQuestion(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link to Question</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Which question should this email be attached to?
          </p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {questionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No questions found. Add a question first.</p>
            ) : (
              <>
                {/* Questions grouped under headers */}
                {groupedQuestions.headers.map((header, headerIdx) => (
                  <div key={header.id} className="space-y-1">
                    {/* Header label */}
                    <div className="text-xs font-medium text-muted-foreground px-2 pt-2">
                      {headerIdx + 1}. {header.text}
                    </div>
                    {/* Questions under this header */}
                    {header.children.map((q, qIdx) => (
                      <Button
                        key={q.id}
                        variant="outline"
                        className="w-full justify-start text-left h-auto py-2 px-4"
                        onClick={async () => {
                          if (pendingAttachmentForQuestion) {
                            await handleAttachmentDropOnQuestion(pendingAttachmentForQuestion, q.id);
                            setPendingAttachmentForQuestion(null);
                          }
                        }}
                      >
                        <Badge variant="secondary" className="mr-2 shrink-0 text-xs font-mono">
                          {headerIdx + 1}.{qIdx + 1}
                        </Badge>
                        <span className="line-clamp-2">{q.text}</span>
                      </Button>
                    ))}
                  </div>
                ))}
                {/* Ungrouped questions */}
                {groupedQuestions.ungrouped.length > 0 && (
                  <div className="space-y-1">
                    {groupedQuestions.headers.length > 0 && (
                      <div className="text-xs font-medium text-muted-foreground px-2 pt-2">
                        Other Questions
                      </div>
                    )}
                    {groupedQuestions.ungrouped.map((q, qIdx) => (
                      <Button
                        key={q.id}
                        variant="outline"
                        className="w-full justify-start text-left h-auto py-2 px-4"
                        onClick={async () => {
                          if (pendingAttachmentForQuestion) {
                            await handleAttachmentDropOnQuestion(pendingAttachmentForQuestion, q.id);
                            setPendingAttachmentForQuestion(null);
                          }
                        }}
                      >
                        <Badge variant="secondary" className="mr-2 shrink-0 text-xs font-mono">
                          {groupedQuestions.headers.length > 0 ? `${groupedQuestions.headers.length + 1}.${qIdx + 1}` : qIdx + 1}
                        </Badge>
                        <span className="line-clamp-2">{q.text}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <Button
            variant="ghost"
            className="w-full mt-2"
            onClick={() => setPendingAttachmentForQuestion(null)}
          >
            Cancel
          </Button>
        </DialogContent>
      </Dialog>

      {/* Compose email modal for responses */}
      {showComposeEmail && (
        <ComposeEmailModal
          open={showComposeEmail}
          onOpenChange={setShowComposeEmail}
          defaultSubject={`Re: Task #${task.task_number} - ${task.name}`}
          defaultBody={generateResponseBody()}
          initialAttachments={emailFileAttachments}
          onSent={() => {
            setShowComposeEmail(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
