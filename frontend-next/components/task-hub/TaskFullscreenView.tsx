'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SmTask, TaskAttachment, TaskAttachmentEmail, TaskActionItem, TaskFollower, useTaskHub, ActionItemType, AttachmentCategory } from '@/contexts/TaskHubContext';
import { useAuth } from '@/contexts/AuthContext';
import { copyToClipboard } from '@/utils/formatters';
import { generateSimpleSignature } from '@/lib/email-signature';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
import { SubtaskList } from './SubtaskList';
import TeeemTableView from '@/components/table/TeeemTableView';
import { EmailDetailDialog } from '@/components/emails/EmailDetailDialog';
import { api, getApiBaseUrl } from '@/lib/api';
import { getStorageItem, STORAGE_KEYS } from '@/lib/storage-utils';
// Note: Uses sonner's toast (imported below) for toast.success/error/info API
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
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
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
import { RichTextEditorModal } from '@/components/ui/rich-text-editor-modal';
import { AttachmentCategoryDialog } from './AttachmentCategoryDialog';
import { ComposeEmailModal } from '@/components/emails/ComposeEmailModal';
import { EmailAttachmentLink } from '@/components/emails/EmailAttachmentLink';
import { getOverdueColorClasses } from './TaskColorSettings';
import { TASK_STATUS } from '@/lib/constants/task-status';

// Type for rich text editor modal
type EditModalType = 'question' | 'header' | 'answer' | 'action' | null;

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

// Suggested email from the suggested_emails endpoint
interface SuggestedEmail {
  id: number;
  subject: string;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  received_at: string;
  has_attachments: boolean;
  document_attachments_count: number;
  body_preview: string | null;
}

// Category of suggested emails
interface SuggestedEmailCategory {
  emails: SuggestedEmail[];
  label: string;
  description: string;
}

// Grouped suggested emails by category
interface SuggestedEmailsGrouped {
  thread: SuggestedEmailCategory;
  sender: SuggestedEmailCategory;
  subject: SuggestedEmailCategory;
}

// Sortable question/header item component
interface SortableQuestionItemProps {
  item: TaskActionItem;
  task?: SmTask;
  questionNumber?: string;  // e.g., "1", "1.1", "2.3" for numbered display
  isHeader?: boolean;
  isCollapsed?: boolean;
  isDropTarget?: boolean;  // Visual feedback when item is being dragged over
  onToggleCollapse?: () => void;
  onEdit: (text: string) => void;
  onRemove: () => void;
  onAddChild?: () => void;  // For adding question under header
  onFileDrop?: (file: File, itemId: number) => void;  // For dropping files on questions
  onAttachmentDrop?: (attachmentId: number, itemId: number) => void;  // For dropping existing attachments on questions
  onDocumentDrop?: (docId: number, sourceType: string, itemId: number) => void;  // For dropping documents from picker
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
  // Rich text editor modal for answers
  onEditAnswer?: (itemId: number, currentAnswer: string) => void;
  delegatingQuestionId?: number | null;
  setDelegatingQuestionId?: (id: number | null) => void;
  delegationUsers?: User[];
  handleDelegateQuestion?: (itemId: number, userId: number) => void;
  handleUndelegateQuestion?: (item: TaskActionItem) => void;  // Open undelegate modal
  openDelegateModal?: (item: TaskActionItem) => void;  // Open delegation modal
  onCreateAction?: (text: string) => void;  // Create action item from question
  setSelectedEmailId?: (id: number | null) => void;  // For viewing linked emails
  // Attachment rename props
  renamingAttachmentId?: number | null;
  renamingAttachmentName?: string;
  setRenamingAttachmentId?: (id: number | null) => void;
  setRenamingAttachmentName?: (name: string) => void;
  handleRenameAttachment?: (attachmentId: number, newName: string) => void;
  // Document viewer props
  onOpenDocument?: (url: string, fileName: string, fileType: 'pdf' | 'image' | 'other') => void;
  onDownloadAttachment?: (att: TaskAttachment) => void;
}

function SortableQuestionItem({
  item,
  task,
  questionNumber,
  isHeader = false,
  isCollapsed = false,
  isDropTarget = false,
  onToggleCollapse,
  onEdit,
  onRemove,
  onAddChild,
  onFileDrop,
  onAttachmentDrop,
  onDocumentDrop,
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
  onEditAnswer,
  delegatingQuestionId,
  setDelegatingQuestionId,
  delegationUsers,
  handleDelegateQuestion,
  handleUndelegateQuestion,
  openDelegateModal,
  onCreateAction,
  setSelectedEmailId,
  renamingAttachmentId,
  renamingAttachmentName,
  setRenamingAttachmentId,
  setRenamingAttachmentName,
  handleRenameAttachment,
  onOpenDocument,
  onDownloadAttachment,
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
    // Collapsed header: bordered box matching other items
    if (isCollapsed) {
      return (
        <div
          ref={setNodeRef}
          style={style}
          data-item-id={item.id}
          className={cn(
            "flex items-center gap-2 p-2 rounded-lg border bg-card cursor-pointer transition-all hover:bg-muted/50",
            isDragging && "shadow-lg opacity-50"
          )}
          onClick={() => onToggleCollapse?.()}
        >
          <div {...attributes} {...listeners} className="cursor-grab touch-none" onClick={(e) => e.stopPropagation()}>
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] font-mono text-muted-foreground">{questionNumber}</span>
          <span className="text-sm truncate flex-1">{item.text}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
            {childCount}
          </Badge>
        </div>
      );
    }

    // Expanded header rendering
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
            "p-2 rounded-lg border bg-card transition-all space-y-1",
            isDragging && "shadow-lg opacity-50",
            isDropTarget && "ring-2 ring-primary bg-primary/10 scale-[1.02] shadow-lg"
          )}
        >
          {/* Header row 1: controls only */}
          <div className="flex items-center gap-1.5">
            <div {...attributes} {...listeners} className="cursor-grab touch-none">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <button onClick={onToggleCollapse} className="shrink-0">
              <ChevronDown className="h-4 w-4" />
            </button>
            {isDropTarget && (
              <span className="text-[11px] text-primary font-semibold bg-primary/20 px-2 py-0.5 rounded-none animate-pulse">
                Drop here
              </span>
            )}
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[11px] shrink-0"
              onClick={onAddChild}
              title="Add question to this header"
            >
              + Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 shrink-0"
              onClick={onRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          {/* Header row 2: number + text (full width) */}
          {editingItemId === item.id ? (
            <Textarea
              value={editingItemText}
              onChange={(e) => setEditingItemText(e.target.value)}
              onBlur={() => handleUpdateItem(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleUpdateItem(item.id);
                }
                if (e.key === 'Escape') {
                  setEditingItemId(null);
                  setEditingItemText('');
                }
              }}
              className="text-sm font-medium w-full min-h-[40px] resize-y p-2 border-2 border-primary/50 rounded-none shadow-sm"
              autoFocus
              spellCheck={true}
            />
          ) : (
            <div
              className="cursor-pointer text-base font-semibold leading-snug"
              onClick={() => onEdit(item.text)}
            >
              {questionNumber && (
                <span className="font-mono text-muted-foreground mr-1.5">{questionNumber}</span>
              )}
              {item.text}
            </div>
          )}
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

    // Check for document being dragged from Documents tab in AttachmentPicker
    const documentId = e.dataTransfer.getData('application/x-document-id');
    const documentSource = e.dataTransfer.getData('application/x-document-source');
    if (documentId && documentSource && onDocumentDrop) {
      console.log('[SortableQuestionItem] Linking document:', documentId, 'source:', documentSource, 'to question:', item.id);
      onDocumentDrop(parseInt(documentId), documentSource, item.id);
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
    items.forEach((dtItem, i) => {
      console.log(`  - Item ${i}: kind=${dtItem.kind}, type=${dtItem.type}`);
      if (dtItem.kind === 'string') {
        dtItem.getAsString((s) => console.log(`    String data: ${s.substring(0, 200)}...`));
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
        "p-2 rounded-lg border bg-card text-sm space-y-1 transition-all",
        isDragging && "shadow-lg",
        isFileDropTarget && "ring-2 ring-green-500 ring-offset-1 bg-green-50 dark:bg-green-950/30"
      )}
      onDragOver={handleQuestionFileDragOver}
      onDragLeave={handleQuestionFileDragLeave}
      onDrop={handleQuestionFileDropEvent}
    >
      {/* Header row: controls only */}
      <div className="flex items-center gap-1.5">
        <div {...attributes} {...listeners} className="cursor-grab touch-none">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        {/* Include in response checkbox */}
        {toggleIncludeInResponse && task && (
          <Checkbox
            checked={item.include_in_response || false}
            onCheckedChange={() => toggleIncludeInResponse(task.id, item.id)}
            className="shrink-0 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            title="Include Q&A in response email"
          />
        )}
        <div className="flex-1" />
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
          className="h-5 w-5 p-0 text-muted-foreground hover:text-green-600 dark:text-green-400"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file to this question"
        >
          <Paperclip className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      {/* Question text: full width */}
      {editingItemId === item.id ? (
        <Textarea
          value={editingItemText}
          onChange={(e) => setEditingItemText(e.target.value)}
          onBlur={() => handleUpdateItem(item.id)}
          onKeyDown={(e) => {
            // Shift+Enter for newline, Enter to save
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleUpdateItem(item.id);
            }
            if (e.key === 'Escape') {
              setEditingItemId(null);
              setEditingItemText('');
            }
          }}
          className="text-sm w-full min-h-[60px] resize-y p-2 border-2 border-primary/50 rounded-md shadow-sm"
          autoFocus
          spellCheck={true}
          rows={Math.max(2, Math.ceil(editingItemText.length / 50))}
        />
      ) : (
        <div
          className="cursor-pointer text-sm leading-snug"
          onClick={() => onEdit(item.text)}
        >
          {questionNumber && (
            <Badge variant="secondary" className="text-xs font-mono px-1.5 mr-1.5 align-text-top">
              {questionNumber}
            </Badge>
          )}
          {item.text}
        </div>
      )}

      {/* Answer section */}
      {item.response ? (
        editingAnswerId === item.id ? (
          <div className="space-y-1.5">
            <SmartTextField
              value={editingAnswerText ?? ''}
              onChange={(value) => setEditingAnswerText?.(value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditingAnswerId?.(null);
                  setEditingAnswerText?.('');
                }
              }}
              className="min-h-[80px] text-sm border-2 border-primary/50 rounded-md shadow-sm"
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
                className="h-6 text-xs"
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => handleUpdateAnswer?.(item.id)} className="h-6 text-xs">
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="pl-2 border-l-2 border-green-500 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20 rounded-r"
            onClick={() => {
              if (onEditAnswer) {
                // Use rich text editor modal
                onEditAnswer(item.id, item.response || '');
              } else {
                // Fallback to inline editing
                setEditingAnswerId?.(item.id);
                setEditingAnswerText?.(item.response || '');
              }
            }}
          >
            <span className="text-xs text-green-600 dark:text-green-400">Answer:</span>
            <div
              className="text-sm prose prose-sm dark:prose-invert max-w-none [&>p]:my-0 leading-snug"
              dangerouslySetInnerHTML={{ __html: item.response || '' }}
            />
          </div>
        )
      ) : answeringItemId === item.id ? (
        <div className="space-y-1.5">
          <SmartTextField
            value={answerText ?? ''}
            onChange={(value) => setAnswerText?.(value)}
            placeholder="Type answer..."
            className="min-h-[80px] text-sm border-2 border-primary/50 rounded-md shadow-sm"
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
              className="h-6 text-xs"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => handleAnswerItem?.(item.id)} className="h-6 text-xs">
              <Send className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => {
              if (onEditAnswer) {
                // Use rich text editor modal
                onEditAnswer(item.id, '');
              } else {
                // Fallback to inline editing
                setAnsweringItemId?.(item.id);
              }
            }}
          >
            + Add Answer
          </Button>
        </div>
      )}

      {/* Attached response documents/emails - displayed as hyperlinks (v3 - handles both document and email types, empty emails return null) */}
      {item.attachments && item.attachments.length > 0 && (
        <div className="space-y-0.5">
          {item.attachments.map((att) => {
            // Handle document attachments (CorporateCompanyDocument)
            if (att.document) {
              // SSoT: Use storage_url (provider-agnostic) first, then file_url (ActiveStorage legacy)
              const url = att.document?.storage_url || att.document?.file_url;
              const fileName = att.document?.display_name || att.document?.file_name || 'Document';
              const isRenaming = renamingAttachmentId === att.id;

              // Determine file type for viewer
              const ext = (att.document?.file_name || '').split('.').pop()?.toLowerCase() || '';
              const fileType: 'pdf' | 'image' | 'other' = ext === 'pdf' ? 'pdf'
                : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) ? 'image'
                : 'other';

              return (
                <div key={att.id} className="flex items-center gap-1 text-xs group">
                  <Paperclip className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
                  {/* Download button - always visible */}
                  {url && (
                    <button
                      onClick={() => onDownloadAttachment?.(att)}
                      className="text-muted-foreground hover:text-foreground"
                      title="Download"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                  )}
                  {isRenaming ? (
                    // Inline edit mode - use form submit to get current input value directly
                    <form
                      className="flex items-center gap-1 flex-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const input = form.querySelector('input') as HTMLInputElement;
                        const newName = input?.value || '';
                        if (newName.trim()) {
                          handleRenameAttachment?.(att.id, newName);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        name="attachmentName"
                        defaultValue={renamingAttachmentName}
                        className="h-5 text-xs px-1 py-0 flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Escape') {
                            setRenamingAttachmentId?.(null);
                            setRenamingAttachmentName?.('');
                          }
                        }}
                      />
                      <button
                        type="submit"
                        className="text-green-600 hover:text-green-700 p-0.5"
                        title="Save"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingAttachmentId?.(null);
                          setRenamingAttachmentName?.('');
                        }}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </form>
                  ) : (
                    // Display mode: single click = drawer, double click = new window
                    <>
                      {url ? (
                        <button
                          onClick={() => onOpenDocument?.(url, fileName, fileType)}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            window.open(url, '_blank');
                          }}
                          className="text-green-600 dark:text-green-400 hover:text-green-700 hover:underline font-medium text-left"
                          title="Click to preview, double-click to open in new tab"
                        >
                          {fileName}
                        </button>
                      ) : (
                        <span className="text-green-600 dark:text-green-400 font-medium">{fileName}</span>
                      )}
                      <button
                        onClick={() => {
                          setRenamingAttachmentId?.(att.id);
                          setRenamingAttachmentName?.(fileName);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                        title="Rename"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              );
            }
            // Handle email attachments (SyncedEmail)
            if (att.email) {
              return (
                <div key={att.id} className="flex items-center gap-1 text-xs group">
                  <Mail className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
                  <EmailAttachmentLink
                    emailId={att.email.id}
                    subject={att.email.subject || '(No subject)'}
                    onSelect={(id) => setSelectedEmailId?.(id)}
                    downloadUrl={att.email.download_eml_url}
                  />
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Delegated task link or create task button */}
      {item.delegated_task_id ? (
        <div>
          <div className="flex items-center gap-1">
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
            {item.delegated_task?.status && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                item.delegated_task.status === 'completed' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
                item.delegated_task.status === 'in_progress' && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                item.delegated_task.status === 'not_started' && "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              )}>
                {item.delegated_task.status.replace('_', ' ')}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleUndelegateQuestion?.(item)}
              title="Remove task"
            >
              <X className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs p-0 text-muted-foreground hover:text-primary"
              onClick={() => openDelegateModal?.(item)}
            >
              → Task
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs p-0 text-muted-foreground hover:text-green-600 dark:text-green-400"
              onClick={() => onCreateAction?.(item.text)}
            >
              → Action
            </Button>
          </div>
          {/* Subtasks of delegated task */}
          {item.delegated_task?.children && item.delegated_task.children.length > 0 && (
            <div className="mt-1 ml-4 space-y-0.5">
              {item.delegated_task.children.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="text-muted-foreground/50">└</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-5 text-xs p-0 text-muted-foreground hover:text-primary"
                    onClick={() => window.open(`/sm_tasks/${subtask.id}`, '_blank')}
                  >
                    {subtask.name}
                  </Button>
                  {subtask.assigned_user_name && (
                    <span className="text-muted-foreground/70">
                      ({subtask.assigned_user_name})
                    </span>
                  )}
                  <span className={cn(
                    "text-[10px] px-1 rounded",
                    subtask.status === 'completed' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
                    subtask.status === 'in_progress' && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                    subtask.status === 'not_started' && "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  )}>
                    {subtask.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
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
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs p-0 text-muted-foreground hover:text-primary"
            onClick={() => openDelegateModal?.(item)}
          >
            → Task
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs p-0 text-muted-foreground hover:text-green-600 dark:text-green-400"
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
  // Note: Uses sonner's toast (imported at top) for toast.success/error/info API
  const { user: currentUser } = useAuth();
  const { calculateEndDate, calculateDuration, isWorkingDay, addWorkingDays } = useWorkingDays();
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
    moveDelegatedTask,
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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
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

  // Delegate modal state (for questions and actions)
  const [delegateModalData, setDelegateModalData] = useState<{
    itemId: number;
    itemText: string;
    itemType: 'question' | 'action';
  } | null>(null);
  const [delegateModalUserId, setDelegateModalUserId] = useState<number | null>(null);
  const [delegateModalInstructions, setDelegateModalInstructions] = useState('');
  const [delegateModalDueDate, setDelegateModalDueDate] = useState<Date | undefined>(undefined);
  const [delegateModalLoading, setDelegateModalLoading] = useState(false);

  // Undelegate modal state (for moving or deleting delegated tasks)
  const [undelegateModalItem, setUndelegateModalItem] = useState<TaskActionItem | null>(null);
  const [undelegateTargetQuestionId, setUndelegateTargetQuestionId] = useState<number | null>(null);
  const [undelegateModalLoading, setUndelegateModalLoading] = useState(false);

  // Delete confirmation for items with delegated tasks
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<TaskActionItem | null>(null);

  // Attachment state
  const [localAttachments, setLocalAttachments] = useState<TaskAttachment[]>(task.attachments || []);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<number | null>(null);
  const [downloadingAllResponseFiles, setDownloadingAllResponseFiles] = useState(false);
  const [emailKeywords, setEmailKeywords] = useState(task.email_keywords || '');
  const [emailSearchType, setEmailSearchType] = useState<'subject' | 'body' | 'full' | 'exact'>('subject');
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);

  // Attachment rename state
  const [renamingAttachmentId, setRenamingAttachmentId] = useState<number | null>(null);
  const [renamingAttachmentName, setRenamingAttachmentName] = useState('');

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

  // Rich text editor modal state (SSoT for all text editing)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalType, setEditModalType] = useState<EditModalType>(null);
  const [editModalItemId, setEditModalItemId] = useState<number | null>(null);
  const [editModalValue, setEditModalValue] = useState('');
  const [editModalTitle, setEditModalTitle] = useState('Edit');

  // Open the rich text editor modal
  const openEditModal = useCallback((type: EditModalType, itemId: number, value: string, title: string) => {
    setEditModalType(type);
    setEditModalItemId(itemId);
    setEditModalValue(value || '');
    setEditModalTitle(title);
    setEditModalOpen(true);
  }, []);

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

  // Save handler for the rich text editor modal
  const handleEditModalSave = useCallback(async (newValue: string) => {
    if (!editModalItemId || !editModalType) return;

    const trimmedValue = newValue.trim();
    if (!trimmedValue) return;

    lastSavedItemIdRef.current = editModalItemId;
    setActionItemLoading(editModalItemId);

    try {
      if (editModalType === 'question' || editModalType === 'header' || editModalType === 'action') {
        // Questions, headers, and action items all use updateActionItem
        await updateActionItem(task.id, editModalItemId, trimmedValue);
      } else if (editModalType === 'answer') {
        // Answers use answerActionItem
        await answerActionItem(task.id, editModalItemId, trimmedValue);
      }
    } finally {
      setActionItemLoading(null);
      scrollToSavedItem();
    }
  }, [editModalItemId, editModalType, task.id, updateActionItem, answerActionItem, scrollToSavedItem]);

  // Email compose for responses
  const [showComposeEmail, setShowComposeEmail] = useState(false);
  const [emailFileAttachments, setEmailFileAttachments] = useState<File[]>([]);
  const [prepareEmailLoading, setPrepareEmailLoading] = useState(false);
  const [prepareEmailStatus, setPrepareEmailStatus] = useState('');
  // Track how each attachment should be included: 'attach' (file), 'link' (URL), 'both' (attach + link), 'none' (exclude)
  const [attachmentEmailOptions, setAttachmentEmailOptions] = useState<Record<number, 'attach' | 'link' | 'both' | 'none'>>({});
  // Store share links created for 'link' option - both download (attachment) and open (inline) URLs
  const [shareLinksMap, setShareLinksMap] = useState<Record<number, { download: string; open: string }>>({});
  // Viewer context ID - stored server-side to avoid URL length limits
  // When set, formatFileLink uses /view/ctx/{id} instead of encoding context in URL
  const viewerContextIdRef = useRef<string | null>(null);
  // Download All URL - use both state and ref for synchronous access in generateResponseBody
  const [downloadAllShareUrl, setDownloadAllShareUrl] = useState<string | null>(null);
  const downloadAllShareUrlRef = useRef<string | null>(null);
  // Download All expiry days - from company settings
  const downloadAllExpiryDaysRef = useRef<number>(7);
  // Company settings for email signature
  // Use both state (for re-renders) and ref (for synchronous access in generateResponseBody)
  const [companySettings, setCompanySettings] = useState<{
    logo_dark?: string;
    logo_url?: string;
    company_name?: string;
    address?: string;
    website?: string;
    phone?: string;
    brand_colors?: { primary?: string; primaryForeground?: string };
  } | null>(null);
  const companySettingsRef = useRef(companySettings);
  // Keep ref in sync with state
  useEffect(() => { companySettingsRef.current = companySettings; }, [companySettings]);
  // Include original email in response chain (quoted reply)
  const [includeOriginalEmail, setIncludeOriginalEmail] = useState(true);

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

  // Collapsible sections - all collapsed by default for cleaner initial view
  const [emailsCollapsed, setEmailsCollapsed] = useState(true);
  const [documentsCollapsed, setDocumentsCollapsed] = useState(true);
  const [responseFilesCollapsed, setResponseFilesCollapsed] = useState(true);
  const [emailSourceCollapsed, setEmailSourceCollapsed] = useState(true); // Start collapsed
  const [collapsedHeaders, setCollapsedHeaders] = useState<Set<number>>(new Set());
  const [collapsedEmailMonths, setCollapsedEmailMonths] = useState<Set<string>>(new Set());
  const initialHeaderCollapseRef = useRef(false);
  const [moreSendersOpen, setMoreSendersOpen] = useState(false);

  // Email tree view expansion state (by source category) - array of expanded item keys
  const [emailTreeExpanded, setEmailTreeExpanded] = useState<string[]>(['thread']); // Thread expanded by default

  // Suggested emails modal (related emails not yet attached, grouped by category)
  const [suggestedEmailsGrouped, setSuggestedEmailsGrouped] = useState<SuggestedEmailsGrouped | null>(null);
  const [suggestedEmailsLoading, setSuggestedEmailsLoading] = useState(false);
  const [suggestedEmailsModalOpen, setSuggestedEmailsModalOpen] = useState(false);
  const [selectedSuggestedEmails, setSelectedSuggestedEmails] = useState<Set<number>>(new Set());
  const [addingSuggestedEmail, setAddingSuggestedEmail] = useState(false);
  // Track which categories are expanded in the suggested emails modal - array of expanded item keys
  const [suggestedCategoryExpanded, setSuggestedCategoryExpanded] = useState<string[]>(['thread']); // Thread expanded by default

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

  // Parse forwarded email info from task description
  // Looks for patterns like "From: Name <email>" or "From: Name" in forwarded messages
  const forwardedEmailInfo = useMemo(() => {
    if (!task.description) return null;

    // Look for forwarded message pattern
    const forwardedMatch = task.description.match(/(?:Begin forwarded message:|Forwarded message:)[\s\S]*?From:\s*([^<\n]+?)(?:\s*<([^>]+)>)?(?:\s*Date:|$)/i);
    if (forwardedMatch) {
      const name = forwardedMatch[1]?.trim();
      const email = forwardedMatch[2]?.trim();
      if (name || email) {
        return { from_name: name || null, from_email: email || null };
      }
    }

    // Also try simple "From: Name" pattern at start of description
    const simpleMatch = task.description.match(/^From:\s*([^<\n]+?)(?:\s*<([^>]+)>)?(?:\n|$)/i);
    if (simpleMatch) {
      const name = simpleMatch[1]?.trim();
      const email = simpleMatch[2]?.trim();
      if (name || email) {
        return { from_name: name || null, from_email: email || null };
      }
    }

    return null;
  }, [task.description]);

  // Find the original email sender for pre-populating "To" field in responses
  // Priority: forwarded email in description, then oldest thread email, then oldest matched, then oldest linked
  const originalEmailSender = useMemo(() => {
    // First check if we parsed a forwarded email from description
    if (forwardedEmailInfo?.from_email) {
      return forwardedEmailInfo.from_email;
    }

    // Helper to find email address by name in our stored emails
    const findEmailByName = (name: string): string | null => {
      const normalizedName = name.toLowerCase().trim();
      for (const att of allEmailAttachments) {
        const email = att.email;
        if (!email) continue;
        // Check from_name
        if (email.from_name?.toLowerCase().trim() === normalizedName && email.from_email) {
          return email.from_email;
        }
      }
      return null;
    };

    // If we have a name from forwarded email but no email, search our stored emails
    if (forwardedEmailInfo?.from_name) {
      const foundEmail = findEmailByName(forwardedEmailInfo.from_name);
      if (foundEmail) return foundEmail;
    }

    const findOldestEmailSender = (emails: typeof allEmailAttachments): string | null => {
      if (emails.length === 0) return null;
      // Sort by received_at ascending (oldest first)
      const sorted = [...emails].sort((a, b) => {
        const dateA = a.email?.received_at ? new Date(a.email.received_at).getTime() : 0;
        const dateB = b.email?.received_at ? new Date(b.email.received_at).getTime() : 0;
        return dateA - dateB;
      });
      return sorted[0]?.email?.from_email || null;
    };

    // Try thread emails first (most likely the original conversation)
    const threadSender = findOldestEmailSender(categorizedEmails.thread);
    if (threadSender) return threadSender;

    // Then try matched emails
    const matchedSender = findOldestEmailSender(categorizedEmails.matched);
    if (matchedSender) return matchedSender;

    // Finally try linked emails
    return findOldestEmailSender(categorizedEmails.linked);
  }, [categorizedEmails, forwardedEmailInfo, allEmailAttachments]);

  // Find the original email data for quoted reply
  const originalEmailData = useMemo(() => {
    // If we have forwarded email info, try to find the actual email record
    if (forwardedEmailInfo?.from_name) {
      const normalizedName = forwardedEmailInfo.from_name.toLowerCase().trim();
      // Search our stored emails for this sender
      for (const att of allEmailAttachments) {
        const email = att.email;
        if (!email) continue;
        if (email.from_name?.toLowerCase().trim() === normalizedName) {
          return email;
        }
      }
      // If not found in stored emails, return what we have from parsing
      return {
        from_name: forwardedEmailInfo.from_name,
        from_email: forwardedEmailInfo.from_email,
        received_at: null,
        subject: null,
        body_preview: null,
        to_emails: undefined,
        cc_emails: undefined,
        body_text: undefined,
        body_html: undefined,
        conversation_id: undefined, // Required for SSoT conversation threading
      };
    }

    const findOldestEmail = (emails: typeof allEmailAttachments) => {
      if (emails.length === 0) return null;
      const sorted = [...emails].sort((a, b) => {
        const dateA = a.email?.received_at ? new Date(a.email.received_at).getTime() : 0;
        const dateB = b.email?.received_at ? new Date(b.email.received_at).getTime() : 0;
        return dateA - dateB;
      });
      return sorted[0]?.email || null;
    };

    // Try thread emails first
    const threadEmail = findOldestEmail(categorizedEmails.thread);
    if (threadEmail) return threadEmail;

    // Then matched
    const matchedEmail = findOldestEmail(categorizedEmails.matched);
    if (matchedEmail) return matchedEmail;

    // Finally linked
    return findOldestEmail(categorizedEmails.linked);
  }, [categorizedEmails, forwardedEmailInfo, allEmailAttachments]);

  // Collect CC recipients from the original email's To and CC fields
  // Excludes the sender (goes in To) and current user's email
  const suggestedCcRecipients = useMemo(() => {
    const ccEmails = new Set<string>();
    const senderEmail = originalEmailSender?.toLowerCase();

    if (!originalEmailData) return [];

    // Add original To recipients (except sender and current user robert@tekna)
    originalEmailData.to_emails?.forEach((addr: string) => {
      const lower = addr.toLowerCase();
      // Exclude: the sender, robert@tekna (current user), and @teeem internal
      if (lower !== senderEmail &&
          !lower.includes('robert@tekna') &&
          !lower.includes('@teeem.')) {
        ccEmails.add(addr);
      }
    });

    // Add original CC recipients
    originalEmailData.cc_emails?.forEach((addr: string) => {
      const lower = addr.toLowerCase();
      if (lower !== senderEmail &&
          !lower.includes('robert@tekna') &&
          !lower.includes('@teeem.')) {
        ccEmails.add(addr);
      }
    });

    return Array.from(ccEmails);
  }, [originalEmailData, originalEmailSender]);

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

  // Helper function to group emails by month
  const groupEmailsByMonth = useCallback((emails: typeof allEmailAttachments) => {
    const byMonth: Record<string, typeof allEmailAttachments> = {};

    emails.forEach(att => {
      let monthKey = 'unknown';
      try {
        const dateStr = att.email?.received_at;
        if (dateStr) {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            monthKey = format(date, 'yyyy-MM');
          }
        }
      } catch {
        // Keep as unknown
      }

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = [];
      }
      byMonth[monthKey].push(att);
    });

    // Sort months descending (newest first)
    const sortedMonths = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

    return { byMonth, sortedMonths };
  }, []);

  // Group each filtered category by month
  const emailsByMonthPerCategory = useMemo(() => ({
    thread: groupEmailsByMonth(filteredCategories.thread),
    matched: groupEmailsByMonth(filteredCategories.matched),
    linked: groupEmailsByMonth(filteredCategories.linked),
  }), [filteredCategories, groupEmailsByMonth]);

  // Collapse all email months by default when data loads
  const [emailMonthsInitialized, setEmailMonthsInitialized] = useState(false);
  useEffect(() => {
    if (emailMonthsInitialized) return;
    const allMonthKeys = new Set<string>();
    emailsByMonthPerCategory.thread.sortedMonths.forEach(m => allMonthKeys.add(`thread-${m}`));
    emailsByMonthPerCategory.matched.sortedMonths.forEach(m => allMonthKeys.add(`matched-${m}`));
    emailsByMonthPerCategory.linked.sortedMonths.forEach(m => allMonthKeys.add(`linked-${m}`));
    if (allMonthKeys.size > 0) {
      setCollapsedEmailMonths(allMonthKeys);
      setEmailMonthsInitialized(true);
    }
  }, [emailsByMonthPerCategory, emailMonthsInitialized]);

  // Helper to expand/collapse all email months
  const toggleAllEmailMonths = useCallback((collapse: boolean) => {
    if (collapse) {
      const allMonthKeys = new Set<string>();
      emailsByMonthPerCategory.thread.sortedMonths.forEach(m => allMonthKeys.add(`thread-${m}`));
      emailsByMonthPerCategory.matched.sortedMonths.forEach(m => allMonthKeys.add(`matched-${m}`));
      emailsByMonthPerCategory.linked.sortedMonths.forEach(m => allMonthKeys.add(`linked-${m}`));
      setCollapsedEmailMonths(allMonthKeys);
    } else {
      setCollapsedEmailMonths(new Set());
    }
  }, [emailsByMonthPerCategory]);

  // Check if all months are collapsed
  const allMonthsCollapsed = useMemo(() => {
    const totalMonths =
      emailsByMonthPerCategory.thread.sortedMonths.length +
      emailsByMonthPerCategory.matched.sortedMonths.length +
      emailsByMonthPerCategory.linked.sortedMonths.length;
    return totalMonths > 0 && collapsedEmailMonths.size >= totalMonths;
  }, [emailsByMonthPerCategory, collapsedEmailMonths]);

  const documentAttachments = localAttachments.filter(a => a.document && !a.email);

  // Split document attachments by category
  const infoAttachments = documentAttachments.filter(a => a.category !== 'response');
  const responseDocuments = documentAttachments.filter(a => a.category === 'response');

  // Emails linked to questions OR with category 'response' are response items
  const responseEmails = allEmailAttachments.filter(a => a.action_item_id || a.category === 'response');

  // Combined response attachments (documents + emails linked to questions)
  const responseAttachments = [...responseDocuments, ...responseEmails];

  // Initialize default email options for response attachments
  // Default: 'link' for all attachments (user preference - links are preferred)
  useEffect(() => {
    const newOptions: Record<number, 'attach' | 'link' | 'both' | 'none'> = {};
    responseAttachments.forEach(att => {
      // Keep existing choice if already set
      if (attachmentEmailOptions[att.id]) {
        newOptions[att.id] = attachmentEmailOptions[att.id];
      } else {
        // Default: always use 'link' for all response attachments
        newOptions[att.id] = 'link';
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

  // Collapse all question headers on initial load for cleaner view
  useEffect(() => {
    if (!initialHeaderCollapseRef.current && headerItems.length > 0) {
      initialHeaderCollapseRef.current = true;
      setCollapsedHeaders(new Set(headerItems.map(h => h.id)));
    }
  }, [headerItems]);

  // Parse email source metadata from description (if task was created from email)
  const emailSourceData = useMemo(() => {
    if (!task.description?.startsWith('**Created from email:**')) return null;

    const lines = task.description.split('\n');
    const fromMatch = lines.find(l => l.startsWith('From:'));
    const dateMatch = lines.find(l => l.startsWith('Date:'));

    // Find where the email body starts (after the metadata lines)
    let bodyStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('From:') || lines[i].startsWith('Date:') || lines[i].startsWith('**Created from email:**')) {
        bodyStartIndex = i + 1;
      } else if (lines[i].trim() !== '') {
        break;
      }
    }

    const body = lines.slice(bodyStartIndex).join('\n').trim();

    return {
      from: fromMatch?.replace('From:', '').trim() || 'Unknown',
      date: dateMatch?.replace('Date:', '').trim() || '',
      body: body
    };
  }, [task.description]);

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

  const handleRemoveItem = async (itemId: number, skipConfirm = false) => {
    // Find the item to check if it has a delegated task
    const item = task.action_items?.find(i => i.id === itemId);

    // If item has a delegated task and we haven't confirmed, show dialog
    if (item?.delegated_task_id && !skipConfirm) {
      setDeleteConfirmItem(item);
      return;
    }

    setActionItemLoading(itemId);
    await removeActionItem(task.id, itemId);
    setActionItemLoading(null);
  };

  // Handle confirmed delete with subtask option
  const handleConfirmedDelete = async (keepSubtask: boolean) => {
    if (!deleteConfirmItem) return;

    const itemId = deleteConfirmItem.id;
    setDeleteConfirmItem(null);

    if (keepSubtask && deleteConfirmItem.delegated_task_id) {
      // First unlink the subtask, then delete the question
      await undelegateActionItem(task.id, itemId, false); // false = don't delete task
    }

    // Now delete the question (if keepSubtask was true, it's already unlinked)
    setActionItemLoading(itemId);
    await removeActionItem(task.id, itemId);
    setActionItemLoading(null);

    // Refresh to update subtasks list
    await refresh();
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

  // Open delegate modal for a question or action
  const openDelegateModal = (item: TaskActionItem) => {
    const isQuestion = item.item_type === 'question';
    setDelegateModalData({
      itemId: item.id,
      itemText: item.text,
      itemType: isQuestion ? 'question' : 'action',
    });
    setDelegateModalUserId(null);
    setDelegateModalInstructions('');
    // Default due date to today
    setDelegateModalDueDate(new Date());
  };

  // Submit delegation from modal
  const handleSubmitDelegation = async () => {
    if (!delegateModalData || !delegateModalUserId) return;

    setDelegateModalLoading(true);
    try {
      await delegateActionItem(
        task.id,
        delegateModalData.itemId,
        delegateModalUserId,
        {
          instructions: delegateModalInstructions || undefined,
          dueDate: delegateModalDueDate?.toISOString().split('T')[0],
        }
      );
      // Reset modal state
      setDelegateModalData(null);
      setDelegateModalUserId(null);
      setDelegateModalInstructions('');
      setDelegateModalDueDate(undefined);
      setDelegatingQuestionId(null);
      setDelegatingActionId(null);
      refresh();
    } catch (err) {
      console.error('Failed to delegate:', err);
      toast.error('Failed to create task');
    } finally {
      setDelegateModalLoading(false);
    }
  };

  // Close delegate modal
  const closeDelegateModal = () => {
    setDelegateModalData(null);
    setDelegateModalUserId(null);
    setDelegateModalInstructions('');
    setDelegateModalDueDate(undefined);
  };

  // Legacy handlers - still used for backward compatibility with ComboboxDropdown immediate selection
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

  // Open undelegate modal instead of immediately unlinking
  const handleUndelegateQuestion = (item: TaskActionItem) => {
    setUndelegateModalItem(item);
    setUndelegateTargetQuestionId(null);
  };

  // Handle moving task to another question
  const handleMoveToQuestion = async () => {
    if (!undelegateModalItem || !undelegateTargetQuestionId) return;

    setUndelegateModalLoading(true);
    try {
      await moveDelegatedTask(task.id, undelegateModalItem.id, undelegateTargetQuestionId);
      const targetQuestion = groupedQuestions.allItems.find((q: TaskActionItem) => q.id === undelegateTargetQuestionId);
      toast.success(`Task moved to: ${targetQuestion?.text?.substring(0, 50) || 'another question'}...`);
      setUndelegateModalItem(null);
      setUndelegateTargetQuestionId(null);
      refresh();
    } catch (err) {
      console.error('Failed to move task:', err);
      toast.error('Failed to move task');
    } finally {
      setUndelegateModalLoading(false);
    }
  };

  // Handle deleting the delegated task
  const handleDeleteDelegatedTask = async () => {
    if (!undelegateModalItem) return;

    setUndelegateModalLoading(true);
    try {
      await undelegateActionItem(task.id, undelegateModalItem.id, true);  // Delete the task
      toast.success('Task deleted');
      setUndelegateModalItem(null);
      refresh();
    } catch (err) {
      console.error('Failed to delete task:', err);
      toast.error('Failed to delete task');
    } finally {
      setUndelegateModalLoading(false);
    }
  };

  // Attachments
  // Uses presigned URL flow for file uploads: Browser → S3 directly (bypasses Heroku 30s timeout)
  const handleAddAttachment = async (attachment: PendingAttachment) => {
    setAttachmentLoading(true);
    try {
      if (attachment.type === 'upload' && attachment.file) {
        // File upload - use presigned URL flow (reuse uploadFileWithCategory)
        // Note: uploadFileWithCategory handles setAttachmentLoading internally,
        // but we manage it here for consistency with the email/document branch
        await uploadFileWithCategory(attachment.file, 'info');
        setShowAttachmentPicker(false);
      } else if (attachment.id) {
        // Email or document - link existing record
        // Map source_type to attachment_type for backend API
        const sourceType = (attachment.metadata as { source_type?: string })?.source_type;
        let attachmentType: string;
        if (attachment.type === 'email') {
          attachmentType = 'email';
        } else if (sourceType === 'user') {
          attachmentType = 'user_document';
        } else if (sourceType && ['job', 'contact', 'task'].includes(sourceType)) {
          attachmentType = 'warehouse_document';
        } else {
          attachmentType = 'document';  // Default to corporate document
        }

        const response = await api.post<{ success: boolean; attachment: TaskAttachment }>(
          `/api/v1/sm_tasks/${task.id}/attachments`,
          {
            attachment_type: attachmentType,
            attachable_id: attachment.id,
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

  // Handle dropping a document from the Documents tab directly onto a question
  const handleDocumentDropOnQuestion = async (
    docId: number,
    sourceType: string,
    actionItemId: number
  ) => {
    console.log('[TaskFullscreenView] handleDocumentDropOnQuestion:', { docId, sourceType, actionItemId });
    setAttachmentLoading(true);
    try {
      // Map source_type to attachment_type for backend API
      let attachmentType: string;
      if (sourceType === 'user') {
        attachmentType = 'user_document';
      } else if (['job', 'contact', 'task'].includes(sourceType)) {
        attachmentType = 'warehouse_document';
      } else {
        attachmentType = 'document';  // Default to corporate document
      }

      const response = await api.post<{ success: boolean; attachment: TaskAttachment }>(
        `/api/v1/sm_tasks/${task.id}/attachments`,
        {
          attachment_type: attachmentType,
          attachable_id: docId,
          action_item_id: actionItemId,
        }
      );
      if (response?.success) {
        console.log('[TaskFullscreenView] Document linked to question successfully');
        await refresh();
      }
    } catch (error) {
      console.error('[TaskFullscreenView] Failed to link document:', error);
    } finally {
      setAttachmentLoading(false);
    }
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

  // Fetch suggested emails (related emails not yet attached, grouped by category)
  const fetchSuggestedEmails = async () => {
    setSuggestedEmailsLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        categories: SuggestedEmailsGrouped;
        already_attached_ids: number[];
        source_email_id?: number;
        message?: string;
      }>(`/api/v1/sm_tasks/${task.id}/suggested_emails`);

      if (response?.success) {
        setSuggestedEmailsGrouped(response.categories || null);
      }
    } catch (err) {
      console.error('Failed to fetch suggested emails:', err);
    } finally {
      setSuggestedEmailsLoading(false);
    }
  };

  // Get total count of suggested emails across all categories
  const getTotalSuggestedCount = (): number => {
    if (!suggestedEmailsGrouped) return 0;
    return (
      suggestedEmailsGrouped.thread.emails.length +
      suggestedEmailsGrouped.sender.emails.length +
      suggestedEmailsGrouped.subject.emails.length
    );
  };

  // Get all email IDs from a category
  const getCategoryEmailIds = (category: keyof SuggestedEmailsGrouped): number[] => {
    if (!suggestedEmailsGrouped) return [];
    return suggestedEmailsGrouped[category].emails.map(e => e.id);
  };

  // Check if all emails in a category are selected
  const isCategoryFullySelected = (category: keyof SuggestedEmailsGrouped): boolean => {
    const ids = getCategoryEmailIds(category);
    if (ids.length === 0) return false;
    return ids.every(id => selectedSuggestedEmails.has(id));
  };

  // Toggle all emails in a category
  const toggleCategorySelection = (category: keyof SuggestedEmailsGrouped) => {
    const ids = getCategoryEmailIds(category);
    const allSelected = isCategoryFullySelected(category);

    setSelectedSuggestedEmails(prev => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all in category
        ids.forEach(id => next.delete(id));
      } else {
        // Select all in category
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Add all selected suggested emails
  const handleAddSelectedSuggestedEmails = async () => {
    if (selectedSuggestedEmails.size === 0) return;

    setAddingSuggestedEmail(true);
    const emailIds = Array.from(selectedSuggestedEmails);
    let addedCount = 0;

    for (const emailId of emailIds) {
      try {
        const response = await api.post<{ success: boolean; attachment: TaskAttachment }>(
          `/api/v1/sm_tasks/${task.id}/attachments`,
          {
            attachment_type: 'email',
            attachable_id: emailId,
            notes: 'Added from suggestions',
          }
        );
        if (response?.success && response.attachment) {
          setLocalAttachments(prev => [...prev, response.attachment]);
          addedCount++;
        }
      } catch (err) {
        console.error(`Failed to add email ${emailId}:`, err);
      }
    }

    // Remove added emails from grouped state
    if (suggestedEmailsGrouped) {
      setSuggestedEmailsGrouped({
        thread: {
          ...suggestedEmailsGrouped.thread,
          emails: suggestedEmailsGrouped.thread.emails.filter(e => !selectedSuggestedEmails.has(e.id))
        },
        sender: {
          ...suggestedEmailsGrouped.sender,
          emails: suggestedEmailsGrouped.sender.emails.filter(e => !selectedSuggestedEmails.has(e.id))
        },
        subject: {
          ...suggestedEmailsGrouped.subject,
          emails: suggestedEmailsGrouped.subject.emails.filter(e => !selectedSuggestedEmails.has(e.id))
        }
      });
    }

    setSelectedSuggestedEmails(new Set());
    setAddingSuggestedEmail(false);
    toast.success(`Added ${addedCount} email(s)`);

    // Close modal if all emails added
    if (getTotalSuggestedCount() - addedCount === 0) {
      setSuggestedEmailsModalOpen(false);
    }
  };

  // Toggle suggested email selection
  const toggleSuggestedEmailSelection = (emailId: number) => {
    setSelectedSuggestedEmails(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  };

  // Download an attachment document
  const handleDownloadAttachment = async (att: TaskAttachment) => {
    if (!att.document) return;

    setDownloadingAttachmentId(att.id);
    try {
      const url = att.document.storage_url || att.document.file_url;
      if (url) {
        // Direct download via presigned URL
        const link = document.createElement('a');
        link.href = url;
        link.download = att.document.display_name || att.document.file_name || 'document';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Fallback: Use API endpoint (works for all documents via DocumentStorageService)
        const response = await api.get<{
          success: boolean;
          filename: string;
          content: string;
          content_type: string;
        }>(`/api/v1/sm_tasks/${task.id}/attachments/${att.id}/download`);

        if (response?.success && response.content) {
          // Convert base64 to blob and download
          const byteCharacters = atob(response.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: response.content_type });

          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = response.filename || att.document.display_name || 'document';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        } else {
          toast.error('Failed to download file');
        }
      }
    } catch (err) {
      console.error('Failed to download attachment:', err);
      toast.error('Failed to download file');
    } finally {
      // Brief delay so user sees the loading state
      setTimeout(() => setDownloadingAttachmentId(null), 500);
    }
  };

  // Download all response files at once
  const handleDownloadAllResponseFiles = async () => {
    // Backend can download via DocumentStorageService even without frontend URLs
    const downloadableFiles = responseAttachments.filter(att => att.document);

    if (downloadableFiles.length === 0) {
      toast.error('No files available to download');
      return;
    }

    setDownloadingAllResponseFiles(true);
    let downloadedCount = 0;

    try {
      for (const att of downloadableFiles) {
        await handleDownloadAttachment(att);
        downloadedCount++;
        // Small delay between downloads to avoid overwhelming the browser
        if (downloadedCount < downloadableFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      toast.success(`Downloaded ${downloadedCount} file${downloadedCount > 1 ? 's' : ''}`);
    } catch (err) {
      console.error('Failed to download all files:', err);
      toast.error(`Downloaded ${downloadedCount} of ${downloadableFiles.length} files`);
    } finally {
      setDownloadingAllResponseFiles(false);
    }
  };

  // Open an attachment in a new window
  // Uses share_link API with open=true to get inline disposition (browser displays file)
  const handleOpenAttachmentInNewWindow = async (att: TaskAttachment) => {
    if (!att.document) return;

    try {
      // Get presigned URL with inline disposition for browser viewing
      const response = await api.post<{ success: boolean; share_url?: string; error?: string }>(
        `/api/v1/sm_tasks/${task.id}/attachments/${att.id}/share_link`,
        { open: true }
      );

      if (response?.success && response?.share_url) {
        window.open(response.share_url, '_blank');
      } else {
        // Fallback to direct URL if API fails
        const url = att.document.storage_url || att.document.file_url;
        if (url) {
          window.open(url, '_blank');
        }
      }
    } catch (err) {
      console.error('Failed to get open link:', err);
      // Fallback to direct URL on error
      const url = att.document.storage_url || att.document.file_url;
      if (url) {
        window.open(url, '_blank');
      }
    }
  };

  // Download all attachments at once
  const [downloadingAll, setDownloadingAll] = useState(false);
  const handleDownloadAllAttachments = async (attachments: TaskAttachment[]) => {
    if (attachments.length === 0) return;

    setDownloadingAll(true);
    let downloaded = 0;
    let failed = 0;

    for (const att of attachments) {
      try {
        if (att.email) {
          // Download email as .eml file
          const response = await api.get<{ success: boolean; filename: string; content: string; content_type: string }>(
            `/api/v1/synced_emails/${att.email.id}/download_eml`
          );
          if (response?.success) {
            const byteCharacters = atob(response.content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: response.content_type || 'message/rfc822' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = response.filename || `email-${att.email.id}.eml`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            downloaded++;
          } else {
            failed++;
          }
        } else if (att.document) {
          // Download document
          const url = att.document.storage_url || att.document.file_url;
          if (url) {
            const link = document.createElement('a');
            link.href = url;
            link.download = att.document.display_name || att.document.file_name || 'document';
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            downloaded++;
          } else {
            failed++;
          }
        }
        // Small delay between downloads to prevent browser blocking
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.error(`Failed to download attachment ${att.id}:`, err);
        failed++;
      }
    }

    setDownloadingAll(false);
    if (failed === 0) {
      toast.success(`Downloaded ${downloaded} file${downloaded !== 1 ? 's' : ''}`);
    } else if (downloaded > 0) {
      toast.info(`Downloaded ${downloaded} file${downloaded !== 1 ? 's' : ''}, ${failed} failed`);
    } else {
      toast.error('Failed to download files');
    }
  };

  // Get shareable link for an attachment (email or document) and copy to clipboard
  const handleCopyShareLink = async (attachmentId: number) => {
    try {
      const response = await api.post<{ success: boolean; share_url?: string; error?: string }>(
        `/api/v1/sm_tasks/${task.id}/attachments/${attachmentId}/share_link`
      );
      if (response?.success && response?.share_url) {
        await copyToClipboard(response.share_url);
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
          toast.success(`Linked ${response.linked_count} emails to this task`);
        } else {
          toast.info('No new emails to link (all already attached)');
        }
      }
    } catch (err) {
      console.error('Failed to bulk link emails:', err);
      toast.error('Failed to link emails');
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
          toast.success(`Linked ${response.linked_count} emails from all clients to this task`);
        } else {
          toast.info('No new emails to link (all already attached)');
        }
      }
    } catch (err) {
      console.error('Failed to bulk link all client emails:', err);
      toast.error('Failed to link client emails');
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
          toast.success(`Linked ${response.linked_count} emails to this task`);
        } else if (response.total_found === 0) {
          toast.info('No emails found for this address');
        } else {
          toast.info('No new emails to link (all already attached)');
        }
      }
    } catch (err) {
      console.error('Failed to bulk link emails:', err);
      toast.error('Failed to link emails');
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
          toast.success(`Linked ${response.linked_count} emails to this task`);
        } else if (response.total_found === 0) {
          toast.info('No emails found for this address');
        } else {
          toast.info('No new emails to link (all already attached)');
        }
      }
    } catch (err) {
      console.error('Failed to bulk link emails:', err);
      toast.error('Failed to link emails');
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
          toast.success(`Linked ${response.linked_count} emails to this task`);
        } else if (response.total_found === 0) {
          toast.info('No emails found for this contact');
        } else {
          toast.info('No new emails to link (all already attached)');
        }
      }
    } catch (err) {
      console.error('Failed to bulk link emails:', err);
      toast.error('Failed to link emails');
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

    setShowCategoryDialog(false);
    const file = pendingFile;
    setPendingFile(null);

    // Use the shared presigned URL upload function
    await uploadFileWithCategory(file, category);
  };

  const handleCategoryCancel = () => {
    setShowCategoryDialog(false);
    setPendingFile(null);
  };

  // Helper to upload file directly with a category (bypasses dialog)
  // Uses presigned URL flow: Browser → S3 directly (bypasses Heroku 30s timeout)
  const uploadFileWithCategory = async (file: File, category: AttachmentCategory, actionItemId?: number) => {
    console.log('[TaskFullscreenView] uploadFileWithCategory:', file.name, 'category:', category, 'actionItemId:', actionItemId);
    setAttachmentLoading(true);

    const token = getStorageItem(STORAGE_KEYS.TOKEN, null, false);
    const baseUrl = getApiBaseUrl();

    try {
      // Step 1: Get presigned URL from backend
      console.log('[TaskFullscreenView] Step 1: Getting presigned URL...');
      const presignResponse = await fetch(`${baseUrl}/api/v1/sm_tasks/${task.id}/attachments/presign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          category,
        }),
      });

      const presignData = await presignResponse.json();
      if (!presignData.success || !presignData.upload_url) {
        console.error('[TaskFullscreenView] Failed to get presigned URL:', presignData);
        toast.error(presignData.error || 'Failed to prepare upload. Please try again.');
        setAttachmentLoading(false);
        return;
      }

      console.log('[TaskFullscreenView] Got presigned URL, uploading file...');

      try {
        const s3Response = await fetch(presignData.upload_url, {
          method: 'PUT',
          headers: {
            'Content-Type': presignData.content_type,
          },
          body: file,
        });

        console.log('[TaskFullscreenView] S3 response status:', s3Response.status, s3Response.statusText);

        if (!s3Response.ok) {
          // Try to read error body if possible
          const errorText = await s3Response.text().catch(() => 'Could not read error');
          console.error('[TaskFullscreenView] S3 upload failed:', errorText);
          throw new Error(`S3 upload failed: ${s3Response.status} ${s3Response.statusText}`);
        }

        console.log('[TaskFullscreenView] S3 upload complete');
      } catch (fetchError) {
        console.error('[TaskFullscreenView] S3 fetch error:', fetchError);
        // Re-throw with more context
        throw new Error(`S3 upload failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
      }

      // Step 3: Confirm upload with backend
      console.log('[TaskFullscreenView] Step 3: Confirming upload...');
      const confirmResponse = await fetch(`${baseUrl}/api/v1/sm_tasks/${task.id}/attachments/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          key: presignData.key,
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          category,
          action_item_id: actionItemId,
        }),
      });

      const confirmData = await confirmResponse.json();
      console.log('[TaskFullscreenView] Confirm response:', confirmData);

      if (confirmData.success && confirmData.attachment) {
        console.log('[TaskFullscreenView] Adding attachment to local state:', confirmData.attachment);
        setLocalAttachments(prev => [...prev, confirmData.attachment]);
        toast.success(`Uploaded ${file.name}`);

        // If linked to an action item, refresh to get updated action items
        if (actionItemId) {
          refresh();
        }
      } else {
        console.error('[TaskFullscreenView] Confirm failed:', confirmData);
        toast.error(confirmData.error || 'Failed to save attachment. Please try again.');
      }
    } catch (error) {
      console.error('[TaskFullscreenView] Upload error:', error);
      toast.error('Upload failed. Please check your connection and try again.');
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

  // Handle renaming an attachment's display name (works for all types: docs, images, emails)
  const handleRenameAttachment = async (attachmentId: number, newName: string) => {
    if (!newName.trim()) return;
    try {
      const response = await api.patch<{ success: boolean; attachment: TaskAttachment }>(
        `/api/v1/sm_tasks/${task.id}/attachments/${attachmentId}`,
        { display_name: newName.trim() }
      );
      if (response?.success) {
        // Update local state - store display_name on the attachment itself
        setLocalAttachments(prev => prev.map(att =>
          att.id === attachmentId
            ? { ...att, display_name: newName.trim() }
            : att
        ));
        // Also refresh to ensure action items get updated attachments
        await refresh();
        toast.success('Attachment renamed');
      }
    } catch (error) {
      console.error('[TaskFullscreenView] Failed to rename attachment:', error);
      toast.error('Failed to rename attachment');
    }
    setRenamingAttachmentId(null);
    setRenamingAttachmentName('');
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

    // Check for document being dragged from Documents tab in AttachmentPicker
    const documentId = e.dataTransfer.getData('application/x-document-id');
    const documentSource = e.dataTransfer.getData('application/x-document-source');
    if (documentId && documentSource) {
      console.log('[TaskFullscreenView] handleDrop - Document dropped:', documentId, 'source:', documentSource);
      // Add document as a general attachment (not linked to a question)
      handleDocumentDropAsAttachment(parseInt(documentId), documentSource);
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileDrop(files[0]);
    }
  };

  // Handle dropping a document from the Documents tab as a general attachment (not linked to question)
  const handleDocumentDropAsAttachment = async (docId: number, sourceType: string) => {
    console.log('[TaskFullscreenView] handleDocumentDropAsAttachment:', { docId, sourceType });
    setAttachmentLoading(true);
    try {
      // Map source_type to attachment_type for backend API
      let attachmentType: string;
      if (sourceType === 'user') {
        attachmentType = 'user_document';
      } else if (['job', 'contact', 'task'].includes(sourceType)) {
        attachmentType = 'warehouse_document';
      } else {
        attachmentType = 'document';  // Default to corporate document
      }

      const response = await api.post<{ success: boolean; attachment: TaskAttachment }>(
        `/api/v1/sm_tasks/${task.id}/attachments`,
        {
          attachment_type: attachmentType,
          attachable_id: docId,
        }
      );
      if (response?.success && response.attachment) {
        console.log('[TaskFullscreenView] Document attached successfully');
        setLocalAttachments(prev => [...prev, response.attachment]);
      }
    } catch (error) {
      console.error('[TaskFullscreenView] Failed to attach document:', error);
    } finally {
      setAttachmentLoading(false);
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

    // Context-aware viewer URL with Q&A and file navigation
    // Encodes question, answer, and all sibling files into URL for navigation in viewer
    interface ViewerFile {
      name: string;
      downloadUrl: string;
      openUrl: string;
    }
    interface QAPair {
      question: string;
      answer?: string;
      fileIndex?: number;
    }
    interface ViewerContext {
      files: ViewerFile[];
      currentIndex: number;
      question?: string;  // Legacy single Q&A
      answer?: string;
      allQA?: QAPair[];   // All Q&As from email
    }
    const encodeViewerContext = (context: ViewerContext): string => {
      const json = JSON.stringify(context);
      // Handle Unicode: encode UTF-8 bytes, then base64
      const utf8Bytes = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      );
      const base64 = btoa(utf8Bytes);
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };

    // Helper to detect file type for viewer URL - tries multiple sources
    const getFileTypeHint = (displayName: string, actualFileName?: string | null, contentType?: string | null): string | undefined => {
      // Try content-type first (most reliable)
      if (contentType) {
        if (contentType.includes('pdf')) return 'pdf';
        if (contentType.startsWith('image/')) return 'image';
        if (contentType === 'message/rfc822') return 'eml';
        if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType === 'text/csv') return 'excel';
      }

      // Try actual filename with extension
      if (actualFileName) {
        const ext = actualFileName.split('.').pop()?.toLowerCase() || '';
        if (ext === 'pdf') return 'pdf';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
        if (ext === 'eml') return 'eml';
        if (['xlsx', 'xls', 'csv'].includes(ext)) return 'excel';
      }

      // Try display name (may not have extension)
      const ext = displayName.split('.').pop()?.toLowerCase() || '';
      if (ext === 'pdf') return 'pdf';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
      if (ext === 'eml') return 'eml';
      if (['xlsx', 'xls', 'csv'].includes(ext)) return 'excel';

      return undefined;
    };

    // SSoT: THE ONE function for attachment display names
    // Priority: user-renamed (att.display_name) > document name > email subject
    const getAttachmentDisplayName = (att: TaskAttachment): string => {
      if (att.display_name) return att.display_name;
      if (att.document) return att.document.display_name || att.document.file_name || 'Document';
      if (att.email) return att.email.subject || '(No subject)';
      return 'Attachment';
    };

    // Helper to format a file link as HTML hyperlink with Download/Open options
    // For external email recipients - makes actions more discoverable
    // downloadUrl = presigned URL with Content-Disposition: attachment (forces download)
    // openUrl = presigned URL with Content-Disposition: inline (browser displays file)
    // Open link uses the enhanced viewer page (/view/[id]) with Q&A context and file navigation
    const formatFileLink = (
      fileName: string,
      downloadUrl?: string,
      openUrl?: string,
      context?: { question?: string; answer?: string; allFiles?: ViewerFile[]; currentIndex?: number; allQA?: QAPair[]; actualFileName?: string | null; contentType?: string | null }
    ): string => {
      if (downloadUrl && openUrl) {
        let viewerUrl: string;
        const typeHint = getFileTypeHint(fileName, context?.actualFileName, context?.contentType);

        // If we have context with multiple files or Q&A, use the enhanced viewer
        if (context && (context.allFiles?.length || context.question || context.answer || context.allQA?.length)) {
          const viewerContext: ViewerContext = {
            files: context.allFiles || [{ name: fileName, downloadUrl, openUrl }],
            currentIndex: context.currentIndex ?? 0,
            question: context.question,
            answer: context.answer,
            allQA: context.allQA
          };
          const encoded = encodeViewerContext(viewerContext);
          const enhancedUrl = `https://teeem.vercel.app/view/${encoded}`;

          // URL length limit: browsers support ~2000 chars, but keep under 1800 to be safe
          // Presigned S3 URLs can be 300+ chars each, so fall back for long URLs
          if (enhancedUrl.length <= 1800) {
            viewerUrl = enhancedUrl;
          } else if (viewerContextIdRef.current) {
            // Use server-stored context (preserves Q&A sidebar)
            const idx = context.currentIndex ?? 0;
            viewerUrl = `https://teeem.vercel.app/view/ctx/${viewerContextIdRef.current}?idx=${idx}`;
          } else {
            // Last resort: simple URL for this file only (pass type hint for blob URLs without extension)
            const viewerParams = new URLSearchParams({
              url: openUrl,
              name: fileName,
              download: downloadUrl
            });
            if (typeHint) viewerParams.set('type', typeHint);
            viewerUrl = `https://teeem.vercel.app/view?${viewerParams.toString()}`;
          }
        } else {
          // Fallback to simple query params for single files without Q&A context
          const viewerParams = new URLSearchParams({
            url: openUrl,
            name: fileName,
            download: downloadUrl
          });
          if (typeHint) viewerParams.set('type', typeHint);
          viewerUrl = `https://teeem.vercel.app/view?${viewerParams.toString()}`;
        }

        return `<a href="${downloadUrl}">${fileName}</a> · <a href="${downloadUrl}" style="color: #666; font-size: 0.9em;">Download</a> · <a href="${viewerUrl}" target="_blank" style="color: #666; font-size: 0.9em;">Open</a>`;
      } else if (downloadUrl) {
        return `<a href="${downloadUrl}">${fileName}</a>`;
      }
      return fileName;
    };

    // Add greeting with recipient's name
    if (originalEmailData) {
      const recipientName = originalEmailData.from_name?.split(' ')[0] || 'there';
      body += `<p>Hi ${recipientName},</p>\n`;
      body += `<p>&nbsp;</p>\n`;  // Blank line after greeting (nbsp prevents stripping)
      body += `<p>Please see my responses below:</p>\n`;
      body += `<p>&nbsp;</p>\n`;  // Blank line before questions
    }

    // Get all included questions (with answers OR attachments)
    // A question is included if marked AND has either a text response or attachments
    const includedQuestions = questionItems.filter(q =>
      q.include_in_response && (q.response || (q.attachments && q.attachments.length > 0))
    );

    // Build allQA array for the viewer sidebar (shows all Q&As, not just current one)
    const allQA: QAPair[] = includedQuestions.map(q => ({
      question: q.text,
      answer: q.response || undefined
    }));

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

      // Build hierarchical numbering: use the same structure as groupedQuestions
      // Headers are numbered 1, 2, 3...
      // Questions under headers are 1.1, 1.2, 2.1, 2.2...
      // Ungrouped questions get next header number: e.g., if 2 headers, ungrouped are 3.1, 3.2...

      // First, process headers in order
      let headerNum = 0;
      console.log('[generateResponseBody] Processing headers:', groupedQuestions.headers.map(h => ({
        id: h.id,
        text: h.text.substring(0, 30),
        childCount: h.children?.length || 0
      })));
      console.log('[generateResponseBody] headerMap keys:', Array.from(headerMap.keys()));

      groupedQuestions.headers.forEach(header => {
        headerNum++;
        const headerQuestions = headerMap.get(header.id) || [];
        console.log(`[generateResponseBody] Header ${headerNum} "${header.text.substring(0, 20)}": ${headerQuestions.length} questions in map`);
        if (headerQuestions.length === 0) return; // Skip headers with no included questions

        // Add header with its number (bold)
        body += `<p><strong>${headerNum}. ${header.text}</strong></p>\n`;

        // Add questions under this header
        headerQuestions.forEach((q, qIdx) => {
          const qNum = `${headerNum}.${qIdx + 1}`;
          body += `<p><strong>${qNum}</strong> ${q.text}</p>\n`;

          // Build file list for viewer navigation (if multiple attachments)
          // Includes both documents and emails
          const allFiles: ViewerFile[] = (q.attachments || [])
            .filter(att => att.document || att.email)
            .map(att => {
              const links = shareLinksMap[att.id];
              if (att.document) {
                const fallback = att.document?.storage_url || att.document?.file_url || '';
                return { name: getAttachmentDisplayName(att), downloadUrl: links?.download || fallback, openUrl: links?.open || fallback };
              } else {
                // Email attachment - use .eml extension for proper viewer handling
                const emailName = getAttachmentDisplayName(att);
                const emlName = emailName.toLowerCase().endsWith('.eml') ? emailName : `${emailName}.eml`;
                return { name: emlName, downloadUrl: links?.download || '', openUrl: links?.open || '' };
              }
            });

          // Show text response (no extra spacing before attachments)
          if (q.response) {
            body += `<p>${q.response}`;
            // If there are attachments, add them immediately after (no gap)
            if (q.attachments && q.attachments.length > 0) {
              q.attachments.forEach((att, attIdx) => {
                if (att.document) {
                  const links = shareLinksMap[att.id];
                  const fallbackUrl = att.document.storage_url || att.document.file_url;
                  body += `\n📎 ${formatFileLink(getAttachmentDisplayName(att), links?.download || fallbackUrl, links?.open, {
                    question: q.text,
                    answer: q.response,
                    allFiles,
                    currentIndex: attIdx,
                    allQA,
                    actualFileName: att.document.file_name
                  })}`;
                } else if (att.email) {
                  // Email attachment - add link with .eml extension
                  const links = shareLinksMap[att.id];
                  const emailName = getAttachmentDisplayName(att);
                  const emlName = emailName.toLowerCase().endsWith('.eml') ? emailName : `${emailName}.eml`;
                  if (links?.download || links?.open) {
                    body += `\n📧 ${formatFileLink(emlName, links?.download, links?.open, {
                      question: q.text,
                      answer: q.response,
                      allFiles,
                      currentIndex: attIdx,
                      allQA,
                      contentType: 'message/rfc822'
                    })}`;
                  }
                }
              });
            }
            body += `</p>\n`;
          } else if (q.attachments && q.attachments.length > 0) {
            // Attachments only (no text response)
            body += `<p>`;
            q.attachments.forEach((att, attIdx) => {
              if (attIdx > 0) body += `<br>`;
              if (att.document) {
                const links = shareLinksMap[att.id];
                const fallbackUrl = att.document.storage_url || att.document.file_url;
                body += `📎 ${formatFileLink(getAttachmentDisplayName(att), links?.download || fallbackUrl, links?.open, {
                  question: q.text,
                  allFiles,
                  currentIndex: attIdx,
                  allQA,
                  actualFileName: att.document.file_name
                })}`;
              } else if (att.email) {
                // Email attachment - add link with .eml extension
                const links = shareLinksMap[att.id];
                const emailName = getAttachmentDisplayName(att);
                const emlName = emailName.toLowerCase().endsWith('.eml') ? emailName : `${emailName}.eml`;
                if (links?.download || links?.open) {
                  body += `📧 ${formatFileLink(emlName, links?.download, links?.open, {
                    question: q.text,
                    allFiles,
                    currentIndex: attIdx,
                    allQA,
                    contentType: 'message/rfc822'
                  })}`;
                }
              }
            });
            body += `</p>\n`;
          }
        });
      });

      // Then process ungrouped questions
      const ungroupedQuestions = headerMap.get(null) || [];
      if (ungroupedQuestions.length > 0) {
        ungroupedQuestions.forEach((q, qIdx) => {
          // Simple numbering for ungrouped questions
          const qNum = `${qIdx + 1}`;
          body += `<p><strong>${qNum}.</strong> ${q.text}</p>\n`;

          // Build file list for viewer navigation (if multiple attachments)
          // Includes both documents and emails
          const allFiles: ViewerFile[] = (q.attachments || [])
            .filter(att => att.document || att.email)
            .map(att => {
              const links = shareLinksMap[att.id];
              if (att.document) {
                const fallback = att.document?.storage_url || att.document?.file_url || '';
                return { name: getAttachmentDisplayName(att), downloadUrl: links?.download || fallback, openUrl: links?.open || fallback };
              } else {
                // Email attachment - use .eml extension for proper viewer handling
                const emailName = getAttachmentDisplayName(att);
                const emlName = emailName.toLowerCase().endsWith('.eml') ? emailName : `${emailName}.eml`;
                return { name: emlName, downloadUrl: links?.download || '', openUrl: links?.open || '' };
              }
            });

          // Show text response (no extra spacing before attachments)
          if (q.response) {
            body += `<p>${q.response}`;
            // If there are attachments, add them immediately after (no gap)
            if (q.attachments && q.attachments.length > 0) {
              q.attachments.forEach((att, attIdx) => {
                if (att.document) {
                  const links = shareLinksMap[att.id];
                  const fallbackUrl = att.document.storage_url || att.document.file_url;
                  body += `\n📎 ${formatFileLink(getAttachmentDisplayName(att), links?.download || fallbackUrl, links?.open, {
                    question: q.text,
                    answer: q.response,
                    allFiles,
                    currentIndex: attIdx,
                    allQA,
                    actualFileName: att.document.file_name
                  })}`;
                } else if (att.email) {
                  // Email attachment - add link with .eml extension
                  const links = shareLinksMap[att.id];
                  const emailName = getAttachmentDisplayName(att);
                  const emlName = emailName.toLowerCase().endsWith('.eml') ? emailName : `${emailName}.eml`;
                  if (links?.download || links?.open) {
                    body += `\n📧 ${formatFileLink(emlName, links?.download, links?.open, {
                      question: q.text,
                      answer: q.response,
                      allFiles,
                      currentIndex: attIdx,
                      allQA,
                      contentType: 'message/rfc822'
                    })}`;
                  }
                }
              });
            }
            body += `</p>\n`;
          } else if (q.attachments && q.attachments.length > 0) {
            // Attachments only (no text response)
            body += `<p>`;
            q.attachments.forEach((att, attIdx) => {
              if (attIdx > 0) body += `<br>`;
              if (att.document) {
                const links = shareLinksMap[att.id];
                const fallbackUrl = att.document.storage_url || att.document.file_url;
                body += `📎 ${formatFileLink(getAttachmentDisplayName(att), links?.download || fallbackUrl, links?.open, {
                  question: q.text,
                  allFiles,
                  currentIndex: attIdx,
                  allQA,
                  actualFileName: att.document.file_name
                })}`;
              } else if (att.email) {
                // Email attachment - add link with .eml extension
                const links = shareLinksMap[att.id];
                const emailName = getAttachmentDisplayName(att);
                const emlName = emailName.toLowerCase().endsWith('.eml') ? emailName : `${emailName}.eml`;
                if (links?.download || links?.open) {
                  body += `📧 ${formatFileLink(emlName, links?.download, links?.open, {
                    question: q.text,
                    allFiles,
                    currentIndex: attIdx,
                    allQA,
                    contentType: 'message/rfc822'
                  })}`;
                }
              }
            });
            body += `</p>\n`;
          }
        });
      }
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

    // SSoT: Only include emails from the SAME conversation thread as the email being replied to
    // This prevents mixing emails from different matters that happen to be from the same sender
    const originalConversationId = originalEmailData?.conversation_id;

    // Separate by option type (documents and emails)
    // 'both' option includes item in BOTH attached AND linked lists
    const attachedFiles = generalResponseAttachments.filter(att => {
      const opt = attachmentEmailOptions[att.id];
      return (opt === 'attach' || opt === 'both') && att.document;
    });
    const attachedEmails = generalResponseAttachments.filter(att => {
      const opt = attachmentEmailOptions[att.id];
      if (!((opt === 'attach' || opt === 'both') && att.email)) return false;

      // Filter by conversation_id - only include emails from the same thread
      if (originalConversationId && att.email?.conversation_id) {
        return att.email.conversation_id === originalConversationId;
      }
      // If no conversation_id, fall back to including the email (legacy behavior)
      return true;
    });
    const linkedFiles = generalResponseAttachments.filter(att => {
      const opt = attachmentEmailOptions[att.id];
      return (opt === 'link' || opt === 'both') && att.document;
    });
    // NOTE: linkedEmails removed - external recipients don't need .eml downloads
    // 'none' files are excluded

    // Note: Removed "Files attached:" section - recipients see attachments in their email client

    // Show files with sharing links (both download and open URLs)
    if (linkedFiles.length > 0) {
      // Build file list for viewer navigation (if multiple linked files)
      const linkedFilesForViewer: ViewerFile[] = linkedFiles.map(att => {
        const links = shareLinksMap[att.id];
        const fallback = att.document?.storage_url || att.document?.file_url || '';
        return { name: getAttachmentDisplayName(att), downloadUrl: links?.download || fallback, openUrl: links?.open || fallback };
      });

      body += '<p><strong>File links:</strong></p>\n';
      body += '<ul>\n';
      linkedFiles.forEach((att, attIdx) => {
        const links = shareLinksMap[att.id];
        const fallbackUrl = att.document?.storage_url || att.document?.file_url;
        body += `<li>${formatFileLink(getAttachmentDisplayName(att), links?.download || fallbackUrl, links?.open, {
          allFiles: linkedFilesForViewer,
          currentIndex: attIdx,
          allQA,
          actualFileName: att.document?.file_name
        })}</li>\n`;
      });
      body += '</ul>\n';
    }

    // NOTE: Email links removed - external recipients don't need .eml downloads of conversations they're part of

    // Count total document attachments (question attachments + general response files)
    const questionDocCount = includedQuestions.reduce((count, q) => {
      return count + (q.attachments?.filter(a => a.document)?.length || 0);
    }, 0);
    const totalDocuments = questionDocCount + linkedFiles.length;

    // Add "Download All" link if available (for multiple files)
    // Use ref for synchronous access (avoids React state timing issues)
    const downloadUrl = downloadAllShareUrlRef.current;
    if (downloadUrl && totalDocuments > 1) {
      const expiryDays = downloadAllExpiryDaysRef.current;
      body += `<p>For your convenience, you can download all ${totalDocuments} files in a single ZIP archive:</p>\n`;
      body += `<p>📦 <a href="${downloadUrl}"><strong>Download All Files (ZIP)</strong></a></p>\n`;
      body += `<p style="font-size: 12px; color: #666;"><em>Note: This download link expires in ${expiryDays} day${expiryDays === 1 ? '' : 's'}.</em></p>\n`;
    }

    // Add closing line (with blank line before for visual separation)
    body += '<p></p>\n';
    body += '<p>Please let me know if you have any further questions.</p>\n';

    // Add simple signature (TipTap-compatible) - positioned BEFORE quoted chain like Outlook
    // Use ref for company settings to avoid React state timing issues
    const settings = companySettingsRef.current;
    if (currentUser) {
      const signature = generateSimpleSignature(
        {
          name: currentUser.name,
          email: currentUser.email,
          mobile_phone: currentUser.mobile_phone as string | undefined,
          job_title: currentUser.job_title as string | undefined,
        },
        settings ? {
          name: settings.company_name,
          address: settings.address,
          website: settings.website,
        } : undefined
      );
      if (signature) {
        body += '\n' + signature + '\n';
      }
    }

    // Include original email as quoted reply if enabled
    if (includeOriginalEmail && originalEmailData) {
      const fromName = originalEmailData.from_name || originalEmailData.from_email || 'Unknown';
      const fromEmail = originalEmailData.from_email || '';
      const sentDate = originalEmailData.received_at
        ? format(new Date(originalEmailData.received_at), 'EEE, MMM d, yyyy \'at\' h:mm a')
        : '';
      const subject = originalEmailData.subject || '(No subject)';
      // Use body_html for full formatted content, fallback to body_text with line breaks
      let originalBody = originalEmailData.body_html
        || (originalEmailData.body_text || originalEmailData.body_preview || '').replace(/\n/g, '<br>');

      // Strip nested blockquotes (previous thread) to reduce email size
      // Email clients embed the full thread as nested blockquotes - we only want the first-level content
      const blockquoteMatch = originalBody.match(/<blockquote[^>]*>/i);
      if (blockquoteMatch) {
        const blockquoteIndex = originalBody.indexOf(blockquoteMatch[0]);
        if (blockquoteIndex !== -1) {
          originalBody = originalBody.slice(0, blockquoteIndex).trim();
          // Add note that thread was truncated
          if (originalBody) {
            originalBody += '<p style="color: #999; font-size: 11px;">[Previous email thread trimmed]</p>';
          }
        }
      }

      body += '\n<br><hr>\n';
      body += `<p style="color: #666; font-size: 12px;">On ${sentDate}, ${fromName} &lt;${fromEmail}&gt; wrote:</p>\n`;
      body += `<blockquote style="margin: 10px 0; padding: 10px 15px; border-left: 3px solid #ccc; color: #555;">\n`;
      body += `<p><strong>Subject:</strong> ${subject}</p>\n`;
      body += `${originalBody}\n`;
      body += '</blockquote>\n';
    }

    return body.trim();
  };

  // Prepare email: download file attachments and get sharing links
  const prepareEmailResponse = async () => {
    setPrepareEmailLoading(true);
    setPrepareEmailStatus('');
    try {
      // Fetch company settings for signature if not already loaded
      if (!companySettings) {
        setPrepareEmailStatus('Loading signature settings...');
        try {
          const settingsResponse = await api.get<{ success: boolean; data: typeof companySettings }>(
            "/api/v1/company_settings"
          );
          if (settingsResponse?.data) {
            // Set both ref (for immediate use) and state (for re-renders)
            companySettingsRef.current = settingsResponse.data;
            setCompanySettings(settingsResponse.data);
          }
        } catch (err) {
          console.debug("Company settings unavailable for signature");
        }
      }

      const filesToAttach: File[] = [];
      // Store both download (attachment disposition) and open (inline disposition) URLs
      const shareLinks: Record<number, { download: string; open: string }> = {};

      // Collect all question attachments that have document URLs (SharePoint or fallback)
      const allQuestionAttachments = questionItems
        .filter(q => q.include_in_response)
        .flatMap(q => q.attachments || []);

      // Include any attachment that has a document (backend can download via DocumentStorageService)
      const questionAttachmentsToLink = allQuestionAttachments
        .filter(att => att.document);

      // Also collect email attachments from questions (need share links for response body)
      const questionEmailsToLink = allQuestionAttachments
        .filter(att => att.email);

      // Separate documents and emails for processing
      // 'both' option includes item in BOTH attach AND link lists
      const documentsToAttach = responseAttachments.filter(a => {
        const opt = attachmentEmailOptions[a.id] || 'link';  // Default to 'link'
        return (opt === 'attach' || opt === 'both') && a.document;
      });
      const emailsToAttach = responseAttachments.filter(a => {
        const opt = attachmentEmailOptions[a.id] || 'link';  // Default to 'link'
        return (opt === 'attach' || opt === 'both') && a.email;
      });
      const documentsToLink = responseAttachments.filter(a => {
        const opt = attachmentEmailOptions[a.id] || 'link';  // Default to 'link'
        // Include any document (backend can download via DocumentStorageService)
        return (opt === 'link' || opt === 'both') && a.document;
      });
      // Emails to include in viewer (show in FILES list for navigation)
      const emailsToLink = responseAttachments.filter(a => {
        const opt = attachmentEmailOptions[a.id] || 'link';  // Default to 'link'
        return (opt === 'link' || opt === 'both') && a.email;
      });

      const totalToProcess = documentsToAttach.length + emailsToAttach.length +
        documentsToLink.length + emailsToLink.length + questionAttachmentsToLink.length + questionEmailsToLink.length;
      let processed = 0;

      // Process documents to attach
      for (const att of documentsToAttach) {
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

      // Process emails to attach - download as .eml
      for (const att of emailsToAttach) {
        const subject = att.email?.subject || '(No subject)';
        setPrepareEmailStatus(`Downloading email "${subject}"... (${processed + 1}/${totalToProcess})`);
        try {
          const response = await api.get<{ success: boolean; filename: string; content: string; content_type: string }>(
            `/api/v1/synced_emails/${att.email?.id}/download_eml`
          );
          if (response?.success) {
            const byteCharacters = atob(response.content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: response.content_type || 'message/rfc822' });
            const file = new File([blob], response.filename || `${subject}.eml`, { type: 'message/rfc822' });
            filesToAttach.push(file);
          }
        } catch (err) {
          console.error(`Failed to download email ${att.email?.id}:`, err);
          // Note: No fallback needed - we're not including email links in response body
        }
        processed++;
      }

      // Process documents to link - call share_link API TWICE per document:
      // 1. Default (no open param) = attachment disposition = Download link
      // 2. open=true = inline disposition = Open link (browser displays file)
      // Track documents that couldn't get share links (file might not exist in storage)
      const docsWithoutShareLinks: string[] = [];
      for (const att of documentsToLink) {
        const fileName = att.document?.display_name || att.document?.file_name || 'Document';
        setPrepareEmailStatus(`Creating links for "${fileName}"... (${processed + 1}/${totalToProcess})`);
        try {
          // Generate both download and open URLs in parallel
          const [downloadResponse, openResponse] = await Promise.all([
            api.post<{ success: boolean; share_url?: string; error?: string }>(
              `/api/v1/sm_tasks/${task.id}/attachments/${att.id}/share_link`
            ),
            api.post<{ success: boolean; share_url?: string; error?: string }>(
              `/api/v1/sm_tasks/${task.id}/attachments/${att.id}/share_link`,
              { open: true }
            )
          ]);

          if (downloadResponse?.success && downloadResponse.share_url) {
            shareLinks[att.id] = {
              download: downloadResponse.share_url,
              open: openResponse?.share_url || downloadResponse.share_url // fallback to download if open fails
            };
          } else {
            // Document file not found in storage - skip and warn user
            console.warn(`[prepareEmailResponse] No share link for document ${att.id}: ${downloadResponse?.error || 'unknown error'}`);
            docsWithoutShareLinks.push(fileName);
          }
        } catch (err) {
          console.error(`Failed to create share link for document ${att.id}:`, err);
          docsWithoutShareLinks.push(fileName);
        }
        processed++;
      }

      // Process emails to link - generate share links for email attachments (for viewer navigation)
      for (const att of emailsToLink) {
        if (shareLinks[att.id]) {
          processed++;
          continue;
        }
        const emailSubject = att.email?.subject || att.display_name || 'Email';
        setPrepareEmailStatus(`Creating links for "${emailSubject}"... (${processed + 1}/${totalToProcess})`);
        try {
          const [downloadResponse, openResponse] = await Promise.all([
            api.post<{ success: boolean; share_url?: string; error?: string }>(
              `/api/v1/sm_tasks/${task.id}/attachments/${att.id}/share_link`
            ),
            api.post<{ success: boolean; share_url?: string; error?: string }>(
              `/api/v1/sm_tasks/${task.id}/attachments/${att.id}/share_link`,
              { open: true }
            )
          ]);

          if (downloadResponse?.success && downloadResponse.share_url) {
            shareLinks[att.id] = {
              download: downloadResponse.share_url,
              open: openResponse?.share_url || downloadResponse.share_url
            };
          } else {
            console.warn(`[prepareEmailResponse] No share link for email ${att.id}: ${downloadResponse?.error || 'unknown error'}`);
          }
        } catch (err) {
          console.error(`Failed to create share link for email ${att.id}:`, err);
        }
        processed++;
      }

      // Process question attachments to link - call share_link API for both download and open URLs
      // Note: failures are added to docsWithoutShareLinks (defined above)
      for (const att of questionAttachmentsToLink) {
        // Skip if we already have a link for this attachment
        if (shareLinks[att.id]) {
          processed++;
          continue;
        }
        const fileName = att.document?.display_name || att.document?.file_name || 'Document';
        setPrepareEmailStatus(`Creating links for "${fileName}"... (${processed + 1}/${totalToProcess})`);
        try {
          // Generate both download and open URLs in parallel
          const [downloadResponse, openResponse] = await Promise.all([
            api.post<{ success: boolean; share_url?: string; error?: string }>(
              `/api/v1/sm_tasks/${task.id}/attachments/${att.id}/share_link`
            ),
            api.post<{ success: boolean; share_url?: string; error?: string }>(
              `/api/v1/sm_tasks/${task.id}/attachments/${att.id}/share_link`,
              { open: true }
            )
          ]);

          if (downloadResponse?.success && downloadResponse.share_url) {
            shareLinks[att.id] = {
              download: downloadResponse.share_url,
              open: openResponse?.share_url || downloadResponse.share_url
            };
          } else {
            // Question attachment file not found - skip and add to warning
            console.warn(`[prepareEmailResponse] No share link for question attachment ${att.id}`);
            docsWithoutShareLinks.push(fileName);
          }
        } catch (err) {
          console.error(`Failed to create share link for question attachment ${att.id}:`, err);
          docsWithoutShareLinks.push(fileName);
        }
        processed++;
      }

      // Process question email attachments to link - generate share links for emails linked to questions
      for (const att of questionEmailsToLink) {
        // Skip if we already have a link for this attachment
        if (shareLinks[att.id]) {
          processed++;
          continue;
        }
        const emailSubject = att.email?.subject || att.display_name || 'Email';
        setPrepareEmailStatus(`Creating links for email "${emailSubject}"... (${processed + 1}/${totalToProcess})`);
        try {
          // Generate both download and open URLs in parallel
          const [downloadResponse, openResponse] = await Promise.all([
            api.post<{ success: boolean; share_url?: string; error?: string }>(
              `/api/v1/sm_tasks/${task.id}/attachments/${att.id}/share_link`
            ),
            api.post<{ success: boolean; share_url?: string; error?: string }>(
              `/api/v1/sm_tasks/${task.id}/attachments/${att.id}/share_link`,
              { open: true }
            )
          ]);

          if (downloadResponse?.success && downloadResponse.share_url) {
            shareLinks[att.id] = {
              download: downloadResponse.share_url,
              open: openResponse?.share_url || downloadResponse.share_url
            };
          } else {
            console.warn(`[prepareEmailResponse] No share link for question email ${att.id}: ${downloadResponse?.error || 'unknown error'}`);
          }
        } catch (err) {
          console.error(`Failed to create share link for question email ${att.id}:`, err);
        }
        processed++;
      }

      // BLOCK email if any files are missing - don't send incomplete emails
      // User must fix root cause (re-upload files) before sending
      if (docsWithoutShareLinks.length > 0) {
        const docList = docsWithoutShareLinks.join('\n  • ');
        toast.error(`Cannot send email - ${docsWithoutShareLinks.length} document(s) have missing files:\n  • ${docList}\n\nPlease re-upload these files before sending.`, {
          duration: 15000,
        });
        setPrepareEmailLoading(false);
        setPrepareEmailStatus('');
        return; // STOP - don't proceed with incomplete email
      }

      setPrepareEmailStatus('Preparing viewer context...');

      // Store the share links and file attachments
      setShareLinksMap(shareLinks);
      setEmailFileAttachments(filesToAttach);

      // Store viewer context server-side (avoids URL length limits)
      // Build context with all Q&A and all files (documents AND emails)
      try {
        // Deduplicate all attachments by ID (documents + emails + question attachments + question emails)
        const allAttsMap = new Map<number, typeof documentsToLink[0]>();
        for (const att of [...documentsToLink, ...emailsToLink, ...questionAttachmentsToLink, ...questionEmailsToLink]) {
          if (!allAttsMap.has(att.id)) {
            allAttsMap.set(att.id, att);
          }
        }
        const allAtts = Array.from(allAttsMap.values());

        // Build viewer files from all attachments (documents and emails)
        const viewerFiles = allAtts.map(att => {
          const links = shareLinks[att.id];
          // Handle both documents and emails
          if (att.document) {
            const fallback = att.document.storage_url || att.document.file_url || '';
            return {
              name: att.display_name || att.document.display_name || att.document.file_name || 'Document',
              downloadUrl: links?.download || fallback,
              openUrl: links?.open || fallback
            };
          } else if (att.email) {
            // Ensure .eml extension for proper file type detection in document viewer
            const baseName = att.display_name || att.email.subject || 'Email';
            const emlName = baseName.toLowerCase().endsWith('.eml') ? baseName : `${baseName}.eml`;
            return {
              name: emlName,
              downloadUrl: links?.download || '',
              openUrl: links?.open || ''
            };
          }
          return {
            name: att.display_name || 'Attachment',
            downloadUrl: links?.download || '',
            openUrl: links?.open || ''
          };
        });

        // Create mapping from attachment ID to file index for question attachments
        const attIdToFileIndex = new Map<number, number>();
        allAtts.forEach((att, idx) => {
          attIdToFileIndex.set(att.id, idx);
        });

        // Build Q&A list from included questions with attachment indices
        const includedQs = questionItems.filter(q =>
          q.include_in_response && (q.response || (q.attachments && q.attachments.length > 0))
        );
        const viewerQA = includedQs.map(q => {
          // Find file indices for this question's attachments
          const attachmentIndices: number[] = [];
          if (q.attachments) {
            for (const att of q.attachments) {
              const fileIdx = attIdToFileIndex.get(att.id);
              if (fileIdx !== undefined) {
                attachmentIndices.push(fileIdx);
              }
            }
          }
          return {
            question: q.text,
            answer: q.response || undefined,
            attachmentIndices: attachmentIndices.length > 0 ? attachmentIndices : undefined
          };
        });

        // Store context via API
        const contextResponse = await api.post<{ success: boolean; id?: string; error?: string }>(
          '/api/v1/viewer_contexts',
          { context: { files: viewerFiles, allQA: viewerQA, currentIndex: 0 } }
        );

        if (contextResponse?.success && contextResponse?.id) {
          viewerContextIdRef.current = contextResponse.id;
        } else {
          console.warn('[prepareEmailResponse] Failed to store viewer context:', contextResponse?.error);
          viewerContextIdRef.current = null;
        }
      } catch (err) {
        console.error('[prepareEmailResponse] Failed to store viewer context:', err);
        viewerContextIdRef.current = null;
      }

      setPrepareEmailStatus('Opening email...');

      // Generate "Download All" zip link if there are multiple documents to link
      // Note: Use same deduplicated list (allDocAtts is already deduped above, but may not be in scope here)
      const allDocsMap = new Map<number, typeof documentsToLink[0]>();
      for (const att of [...documentsToLink, ...questionAttachmentsToLink]) {
        if (!allDocsMap.has(att.id)) allDocsMap.set(att.id, att);
      }
      const allDocumentsToLink = Array.from(allDocsMap.values());
      if (allDocumentsToLink.length > 1) {
        setPrepareEmailStatus('Creating download all link...');
        try {
          const zipResponse = await api.get<{
            success: boolean;
            share_url?: string;
            download_method?: string;
            content?: string;
            filename?: string;
            content_type?: string;
            expiry_days?: number;
            error?: string
          }>(
            `/api/v1/sm_tasks/${task.id}/download_all_response_files`
          );
          if (zipResponse.success && zipResponse.share_url) {
            // Presigned URL (production with Wasabi/S3)
            downloadAllShareUrlRef.current = zipResponse.share_url;
            setDownloadAllShareUrl(zipResponse.share_url);
            // Store expiry days from company settings (default 7 if not provided)
            downloadAllExpiryDaysRef.current = zipResponse.expiry_days || 7;
          } else if (zipResponse.success && zipResponse.download_method === 'base64' && zipResponse.content) {
            // Base64 fallback (local dev without storage connection)
            // Create a blob URL for local testing - note: only works in same browser session
            const byteCharacters = atob(zipResponse.content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: zipResponse.content_type || 'application/zip' });
            const blobUrl = URL.createObjectURL(blob);
            downloadAllShareUrlRef.current = blobUrl;
            setDownloadAllShareUrl(blobUrl);
          } else {
            // No URL available - Download All link won't appear in email
          }
        } catch (err) {
          console.error('Failed to create download all link:', err);
          // Not critical - continue without it
        }
      } else {
        console.log('[prepareEmailResponse] Not enough documents for download all:', allDocumentsToLink.length);
        downloadAllShareUrlRef.current = null;
        setDownloadAllShareUrl(null);
      }

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
          className="grid p-6 h-full transition-all duration-200"
          style={{
            gap: '8px',
            alignItems: 'stretch',
            gridTemplateColumns: [
              columnsCollapsed.description ? '40px' : '1fr',
              columnsCollapsed.questions ? '40px' : '1fr',
              columnsCollapsed.actions ? '40px' : '1fr',
              columnsCollapsed.attachments ? '40px' : '1fr',
            ].join(' ')
          }}
        >
          {/* Column 1: Description */}
          {columnsCollapsed.description ? (
            // Collapsed: clean vertical strip
            <div
              className="flex flex-col items-center rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors w-10 min-w-10 h-full"
              onClick={() => toggleColumn('description')}
            >
              <div className="p-2">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div
                className="flex-1 flex items-center justify-start pt-2 text-muted-foreground"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                <span className="text-xs font-medium whitespace-nowrap">Description</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col rounded-lg border bg-background h-full">
              {/* Expanded header */}
              <div className="h-10 flex items-center justify-between border-b px-3">
                <div
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md py-1 px-2 -ml-2 transition-colors"
                  onClick={() => toggleColumn('description')}
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Description</span>
                </div>
              </div>
              <div className="flex-1 p-3 space-y-4 overflow-auto">
                {/* Email Source Header (if task was created from email) */}
                {emailSourceData && (
                  <div className="border rounded-md overflow-hidden">
                    <div
                      className="flex items-center gap-2 p-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setEmailSourceCollapsed(!emailSourceCollapsed)}
                    >
                      {emailSourceCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      <Mail className="h-4 w-4 text-primary" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">Created from email</span>
                        <span className="text-xs text-muted-foreground ml-2">from {emailSourceData.from}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{emailSourceData.date}</span>
                    </div>
                    {!emailSourceCollapsed && emailSourceData.body && (
                      <div className="p-3 text-sm whitespace-pre-wrap border-t bg-background">
                        {emailSourceData.body}
                      </div>
                    )}
                  </div>
                )}

                {/* Description (hide raw email content if we have structured email source) */}
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
                  ) : !emailSourceData ? (
                    <div className="relative">
                      <div
                        className={cn(
                          "p-3 rounded-md border bg-muted/30 cursor-pointer hover:bg-muted/50 text-sm whitespace-pre-wrap",
                          !descriptionExpanded && task.description && task.description.length > 300 && "line-clamp-5"
                        )}
                        onClick={() => setIsEditingDescription(true)}
                      >
                        {task.description || <span className="text-muted-foreground italic">Click to add description...</span>}
                      </div>
                      {task.description && task.description.length > 300 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs mt-1 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDescriptionExpanded(!descriptionExpanded);
                          }}
                        >
                          {descriptionExpanded ? "Show less" : "Show more"}
                        </Button>
                      )}
                    </div>
                  ) : null}
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
                        task.is_overdue && task.status !== TASK_STATUS.COMPLETED ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
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

            {/* Subtasks - shows all children (from delegated questions/actions or direct subtasks) */}
            {task.children && task.children.length > 0 && (
              <div className="border-t pt-4">
                <SubtaskList subtasks={task.children} compact={false} />
              </div>
            )}

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
            </div>
          )}

          {/* Column 2: Questions */}
          <div
            className={cn(
              "flex flex-col h-full min-w-0 relative overflow-hidden",
              columnsCollapsed.questions && "items-center",
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
            {columnsCollapsed.questions ? (
              // Collapsed: clean vertical strip
              <div
                className="flex flex-col items-center rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors w-10 min-w-10 h-full"
                onClick={() => toggleColumn('questions')}
              >
                <div className="p-2">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div
                  className="flex-1 flex items-center justify-start pt-2 text-muted-foreground"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  <span className="text-xs font-medium whitespace-nowrap">Questions</span>
                </div>
                <div className="p-2">
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">{questionItems.length + headerItems.length}</Badge>
                </div>
              </div>
            ) : (
              <div className="flex flex-col rounded-lg border bg-background h-full">
                {/* Expanded header */}
                <div className="h-10 flex items-center justify-between border-b border-border px-3">
                  <div
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md py-1 px-2 -ml-2 transition-colors"
                    onClick={() => toggleColumn('questions')}
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Questions</span>
                    <Badge variant="secondary" className="text-xs">{questionItems.length + headerItems.length}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={(e) => { e.stopPropagation(); setShowAddHeader(!showAddHeader); }}
                    >
                      + Header
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewActionItemType('question');
                        setShowBulkPaste(true);
                      }}
                    >
                      + Paste
                    </Button>
                  </div>
                </div>
                <div className="flex-1 p-3 space-y-4 overflow-auto">
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
                  {groupedQuestions.headers.map((header, headerIdx) => (
                    <div key={header.id} className="space-y-1">
                      {/* Header row */}
                      <SortableQuestionItem
                        item={header}
                        questionNumber={`${headerIdx + 1}`}
                        isHeader
                        isCollapsed={collapsedHeaders.has(header.id)}
                        isDropTarget={overHeaderId === header.id && activeDragId !== header.id}
                        onToggleCollapse={() => toggleHeaderCollapse(header.id)}
                        onEdit={(text) => openEditModal('header', header.id, text, 'Edit Header')}
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
                          {header.children.map((child, childIdx) => (
                            <SortableQuestionItem
                              key={child.id}
                              item={child}
                              task={task}
                              questionNumber={`${headerIdx + 1}.${childIdx + 1}`}
                              onEdit={(text) => openEditModal('question', child.id, text, 'Edit Question')}
                              onRemove={() => handleRemoveItem(child.id)}
                              onFileDrop={handleFileDropOnQuestion}
                              onAttachmentDrop={handleAttachmentDropOnQuestion}
                              onDocumentDrop={handleDocumentDropOnQuestion}
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
                              onEditAnswer={(itemId, answer) => openEditModal('answer', itemId, answer, 'Edit Answer')}
                              delegatingQuestionId={delegatingQuestionId}
                              setDelegatingQuestionId={setDelegatingQuestionId}
                              delegationUsers={delegationUsers}
                              handleDelegateQuestion={handleDelegateQuestion}
                              handleUndelegateQuestion={handleUndelegateQuestion}
                              openDelegateModal={openDelegateModal}
                              onCreateAction={(text) => addActionItem(task.id, text, 'action')}
                              setSelectedEmailId={setSelectedEmailId}
                              renamingAttachmentId={renamingAttachmentId}
                              renamingAttachmentName={renamingAttachmentName}
                              setRenamingAttachmentId={setRenamingAttachmentId}
                              setRenamingAttachmentName={setRenamingAttachmentName}
                              handleRenameAttachment={handleRenameAttachment}
                              onOpenDocument={(url, name, type) => setViewerDocument({ url, fileName: name, fileType: type })}
                              onDownloadAttachment={handleDownloadAttachment}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Ungrouped questions */}
                  {groupedQuestions.ungrouped.map((item, idx) => (
                    <SortableQuestionItem
                      key={item.id}
                      item={item}
                      task={task}
                      questionNumber={groupedQuestions.headers.length > 0 ? `${groupedQuestions.headers.length + 1}.${idx + 1}` : `${idx + 1}`}
                      onEdit={(text) => openEditModal('question', item.id, text, 'Edit Question')}
                      onRemove={() => handleRemoveItem(item.id)}
                      onFileDrop={handleFileDropOnQuestion}
                      onAttachmentDrop={handleAttachmentDropOnQuestion}
                              onDocumentDrop={handleDocumentDropOnQuestion}
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
                      onEditAnswer={(itemId, answer) => openEditModal('answer', itemId, answer, 'Edit Answer')}
                      delegatingQuestionId={delegatingQuestionId}
                      setDelegatingQuestionId={setDelegatingQuestionId}
                      delegationUsers={delegationUsers}
                      handleDelegateQuestion={handleDelegateQuestion}
                      handleUndelegateQuestion={handleUndelegateQuestion}
                      openDelegateModal={openDelegateModal}
                      onCreateAction={(text) => addActionItem(task.id, text, 'action')}
                      setSelectedEmailId={setSelectedEmailId}
                      renamingAttachmentId={renamingAttachmentId}
                      renamingAttachmentName={renamingAttachmentName}
                      setRenamingAttachmentId={setRenamingAttachmentId}
                      setRenamingAttachmentName={setRenamingAttachmentName}
                      handleRenameAttachment={handleRenameAttachment}
                      onOpenDocument={(url, name, type) => setViewerDocument({ url, fileName: name, fileType: type })}
                      onDownloadAttachment={handleDownloadAttachment}
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
                          <HelpCircle className="h-4 w-4 text-blue-500 dark:text-blue-400" />
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

            {/* Info attachments - reference docs that can be dragged onto questions */}
            {infoAttachments.length > 0 && (
              <div className="mt-3 pt-3 border-t shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Reference docs:</span>
                  </div>
                  {infoAttachments.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => handleDownloadAllAttachments(infoAttachments)}
                      disabled={downloadingAll}
                      title="Download all reference docs to your computer"
                    >
                      {downloadingAll ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3 mr-1" />
                          Download All
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  {infoAttachments.map((att) => (
                    <div
                      key={att.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-attachment-id', att.id.toString());
                        e.dataTransfer.effectAllowed = 'link';
                      }}
                      className="flex items-center gap-2 p-2 rounded bg-blue-50 dark:bg-blue-950/30 text-sm group cursor-grab active:cursor-grabbing"
                    >
                      {att.email ? (
                        <>
                          <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          <EmailAttachmentLink
                            emailId={att.email.id}
                            subject={att.email.subject || '(No subject)'}
                            onSelect={(id) => setSelectedEmailId(id)}
                            downloadUrl={att.email.download_eml_url}
                            linkClassName="flex-1 truncate"
                          />
                        </>
                      ) : (
                        <>
                          {downloadingAttachmentId === att.id ? (
                            <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          )}
                          <button
                            onClick={() => handleDownloadAttachment(att)}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOpenAttachmentInNewWindow(att);
                            }}
                            className="flex-1 truncate font-medium text-left hover:underline cursor-pointer"
                            title="Click to download, double-click to open in new window"
                          >
                            {att.document?.display_name || att.document?.file_name}
                          </button>
                        </>
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
                  ))}
                </div>
              </div>
            )}
                </div>
              </div>
            )}

          </div>

          {/* Column 3: Actions */}
          <div className={cn("flex flex-col h-full min-w-0 overflow-hidden", columnsCollapsed.actions && "items-center")}>
            {columnsCollapsed.actions ? (
              // Collapsed: clean vertical strip
              <div
                className="flex flex-col items-center rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors w-10 min-w-10 h-full"
                onClick={() => toggleColumn('actions')}
              >
                <div className="p-2">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div
                  className="flex-1 flex items-center justify-start pt-2 text-muted-foreground"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  <span className="text-xs font-medium whitespace-nowrap">Actions</span>
                </div>
                <div className="p-2">
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">{actionItems.length}</Badge>
                </div>
              </div>
            ) : (
              <div className="flex flex-col rounded-lg border bg-background h-full">
                {/* Expanded header */}
                <div className="h-10 flex items-center justify-between border-b border-border px-3">
                  <div
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md py-1 px-2 -ml-2 transition-colors"
                    onClick={() => toggleColumn('actions')}
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Actions</span>
                    <Badge variant="secondary" className="text-xs">{actionItems.length}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewActionItemType('action');
                      setShowBulkPaste(true);
                    }}
                  >
                    + Paste
                  </Button>
                </div>
                <div className="flex-1 p-3 space-y-4 overflow-auto">
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
                    "p-2 rounded-lg border bg-card text-sm group space-y-1",
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
                    <span
                      className={cn(
                        "flex-1 cursor-pointer",
                        item.checked && "line-through text-muted-foreground"
                      )}
                      onClick={() => openEditModal('action', item.id, item.text, 'Edit Action')}
                    >
                      {item.text}
                    </span>
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
                        onClick={() => openDelegateModal(item)}
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
              </div>
            )}

          </div>

          {/* Column 4: Attachments */}
          <div
            className={cn(
              "flex flex-col h-full min-h-0 min-w-0 relative overflow-hidden",
              columnsCollapsed.attachments && "items-center",
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
            {columnsCollapsed.attachments ? (
              // Collapsed: clean vertical strip
              <div
                className="flex flex-col items-center rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors w-10 min-w-10 h-full"
                onClick={() => toggleColumn('attachments')}
              >
                <div className="p-2">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div
                  className="flex-1 flex items-center justify-start pt-2 text-muted-foreground"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  <span className="text-xs font-medium whitespace-nowrap">Attachments</span>
                </div>
                <div className="p-2">
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">{allEmailAttachments.length + infoAttachments.length + responseAttachments.length}</Badge>
                </div>
              </div>
            ) : (
              <div className="flex flex-col rounded-lg border bg-background h-full min-h-0">
                {/* Expanded header */}
                <div className="h-10 flex items-center justify-between border-b border-border px-3 shrink-0">
                  <div
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md py-1 px-2 -ml-2 transition-colors"
                    onClick={() => toggleColumn('attachments')}
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Attachments</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); setShowAttachmentPicker(!showAttachmentPicker); }}
                  >
                    {showAttachmentPicker ? 'Close' : '+ Add'}
                  </Button>
                </div>
                <div className="flex-1 min-h-0 p-3 space-y-4 overflow-y-auto">
            {/* Attachment Picker (inline) */}
            {showAttachmentPicker && (
              <div className="p-2 border rounded bg-muted/30 mb-3 shrink-0">
                {attachmentLoading && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-primary/10 rounded text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Uploading file...</span>
                  </div>
                )}
                <AttachmentPicker
                  attachments={pendingAttachments}
                  onAdd={handleAddAttachment}
                  onRemove={handleRemovePendingAttachment}
                  jobId={task.construction_id > 0 ? String(task.construction_id) : undefined}
                />
              </div>
            )}

            {/* Emails Section */}
            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center gap-2 p-2 border-b flex-wrap">
                <div
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md py-1 px-1 -ml-1 transition-colors"
                  onClick={() => setEmailsCollapsed(!emailsCollapsed)}
                >
                  {emailsCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Emails</span>
                  <Badge variant="secondary" className="text-xs">
                    {emailSourceFilter.type !== 'all' ? `${emailAttachments.length}/${allEmailAttachments.length}` : allEmailAttachments.length}
                  </Badge>
                </div>
                {/* Quick filter chips - outside clickable area */}
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
                        <Popover open={moreSendersOpen} onOpenChange={setMoreSendersOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                              onClick={(e) => e.stopPropagation()}
                            >
                              +{uniqueEmailSenders.length - 5} more
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
                            <div className="text-xs font-medium mb-2">All senders</div>
                            <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
                              {uniqueEmailSenders.map((sender) => {
                                const isActive = emailSourceFilter.type === 'contact' &&
                                  emailSourceFilter.emails?.some(e => e.toLowerCase() === sender.email);
                                return (
                                  <Button
                                    key={sender.email}
                                    variant={isActive ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={() => {
                                      if (isActive) {
                                        setEmailSourceFilter({ type: 'all' });
                                      } else {
                                        setEmailSourceFilter({
                                          type: 'contact',
                                          emails: [sender.email],
                                          label: sender.name
                                        });
                                      }
                                      setMoreSendersOpen(false);
                                    }}
                                    title={sender.email}
                                  >
                                    <span className="truncate max-w-[100px]">{sender.name.split(' ')[0]}</span>
                                    <Badge variant="secondary" className="ml-1 h-3 px-1 text-[9px]">
                                      {sender.count}
                                    </Badge>
                                  </Button>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  )}

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
                      <h4 className="text-sm font-medium text-muted-foreground">Link emails from:</h4>

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

                {/* Suggested Emails Button - Opens Modal */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSuggestedEmailsModalOpen(true);
                    if (!suggestedEmailsGrouped) {
                      fetchSuggestedEmails();
                    }
                  }}
                >
                  <Target className="h-3 w-3 mr-1" />
                  Suggested
                  {getTotalSuggestedCount() > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                      {getTotalSuggestedCount()}
                    </Badge>
                  )}
                </Button>
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
                        {/* Collapse/Expand all months button */}
                        <div className="flex items-center justify-end px-2 py-1 bg-muted/20 border-b">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={() => toggleAllEmailMonths(!allMonthsCollapsed)}
                          >
                            {allMonthsCollapsed ? (
                              <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Expand all months
                              </>
                            ) : (
                              <>
                                <ChevronRight className="h-3 w-3 mr-1" />
                                Collapse all months
                              </>
                            )}
                          </Button>
                        </div>
                        <Accordion type="multiple" value={emailTreeExpanded} onValueChange={setEmailTreeExpanded}>
                        {/* Thread Emails Branch */}
                        {categorizedEmails.thread.length > 0 && (
                          <AccordionItem value="thread" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 w-full px-2 py-1.5 bg-muted/30 hover:bg-muted/50 hover:no-underline [&[data-state=open]>svg:first-child]:rotate-90">
                              <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200" />
                              <Mail className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                              <span className="text-xs font-medium">Thread</span>
                              <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                                {filteredCategories.thread.length}
                                {emailSourceFilter.type === 'contact' && filteredCategories.thread.length !== categorizedEmails.thread.length &&
                                  ` / ${categorizedEmails.thread.length}`}
                              </Badge>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div>
                                {emailsByMonthPerCategory.thread.sortedMonths.map((monthKey, monthIdx) => {
                                  const monthEmails = emailsByMonthPerCategory.thread.byMonth[monthKey];
                                  const monthLabel = monthKey === 'unknown' ? 'Unknown Date' : format(new Date(monthKey + '-01'), 'MMMM yyyy');
                                  const isMonthCollapsed = collapsedEmailMonths.has(`thread-${monthKey}`);

                                  return (
                                    <div key={monthKey}>
                                      {/* Month header - collapsible, first month expanded by default */}
                                      <div
                                        className="flex items-center gap-2 px-2 py-1 bg-muted/20 hover:bg-muted/40 cursor-pointer text-[10px] text-muted-foreground font-medium"
                                        onClick={() => {
                                          setCollapsedEmailMonths(prev => {
                                            const next = new Set(prev);
                                            const key = `thread-${monthKey}`;
                                            if (next.has(key)) {
                                              next.delete(key);
                                            } else {
                                              next.add(key);
                                            }
                                            return next;
                                          });
                                        }}
                                      >
                                        {isMonthCollapsed ? <ChevronRight className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                                        <CalendarIcon className="h-2.5 w-2.5" />
                                        <span>{monthLabel}</span>
                                        <span className="ml-auto">{monthEmails.length}</span>
                                      </div>

                                      {/* Emails for this month */}
                                      {!isMonthCollapsed && (
                                        <div className="divide-y">
                                          {monthEmails.map((att) => (
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
                                              onDoubleClick={(e) => {
                                                e.preventDefault();
                                                if (att.email) {
                                                  window.open(`/emails?open=${att.email.id}`, '_blank');
                                                }
                                              }}
                                              title="Click to view, double-click to open in new tab"
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
                                                className="h-5 w-5 p-0 text-muted-foreground hover:text-blue-500 dark:text-blue-400"
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
                                                className="h-5 w-5 p-0 text-muted-foreground hover:text-green-500 dark:text-green-400"
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
                                                  className="h-5 w-5 p-0 text-muted-foreground hover:text-blue-500 dark:text-blue-400"
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
                                                    <HelpCircle className="h-4 w-4 mr-2 text-blue-500 dark:text-blue-400" />
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
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}

                        {/* Auto-Matched Emails Branch */}
                        {categorizedEmails.matched.length > 0 && (
                          <AccordionItem value="matched" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 w-full px-2 py-1.5 bg-muted/30 hover:bg-muted/50 hover:no-underline [&[data-state=open]>svg:first-child]:rotate-90">
                              <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200" />
                              <Search className="h-3 w-3 text-amber-500" />
                              <span className="text-xs font-medium">Auto-Matched</span>
                              <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                                {filteredCategories.matched.length}
                                {emailSourceFilter.type === 'contact' && filteredCategories.matched.length !== categorizedEmails.matched.length &&
                                  ` / ${categorizedEmails.matched.length}`}
                              </Badge>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div>
                                {emailsByMonthPerCategory.matched.sortedMonths.map((monthKey) => {
                                  const monthEmails = emailsByMonthPerCategory.matched.byMonth[monthKey];
                                  const monthLabel = monthKey === 'unknown' ? 'Unknown Date' : format(new Date(monthKey + '-01'), 'MMMM yyyy');
                                  const isMonthCollapsed = collapsedEmailMonths.has(`matched-${monthKey}`);

                                  return (
                                    <div key={monthKey}>
                                      <div
                                        className="flex items-center gap-2 px-2 py-1 bg-muted/20 hover:bg-muted/40 cursor-pointer text-[10px] text-muted-foreground font-medium"
                                        onClick={() => {
                                          setCollapsedEmailMonths(prev => {
                                            const next = new Set(prev);
                                            const key = `matched-${monthKey}`;
                                            if (next.has(key)) next.delete(key);
                                            else next.add(key);
                                            return next;
                                          });
                                        }}
                                      >
                                        {isMonthCollapsed ? <ChevronRight className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                                        <CalendarIcon className="h-2.5 w-2.5" />
                                        <span>{monthLabel}</span>
                                        <span className="ml-auto">{monthEmails.length}</span>
                                      </div>
                                      {!isMonthCollapsed && (
                                        <div className="divide-y">
                                          {monthEmails.map((att) => (
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
                                        onDoubleClick={(e) => {
                                          e.preventDefault();
                                          if (att.email) {
                                            window.open(`/emails?open=${att.email.id}`, '_blank');
                                          }
                                        }}
                                        title="Click to view, double-click to open in new tab"
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
                                          className="h-5 w-5 p-0 text-muted-foreground hover:text-blue-500 dark:text-blue-400"
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
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}

                        {/* Manually Linked Emails Branch */}
                        {categorizedEmails.linked.length > 0 && (
                          <AccordionItem value="linked" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 w-full px-2 py-1.5 bg-muted/30 hover:bg-muted/50 hover:no-underline [&[data-state=open]>svg:first-child]:rotate-90">
                              <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200" />
                              <Link2 className="h-3 w-3 text-green-500 dark:text-green-400" />
                              <span className="text-xs font-medium">Linked</span>
                              <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                                {filteredCategories.linked.length}
                                {emailSourceFilter.type === 'contact' && filteredCategories.linked.length !== categorizedEmails.linked.length &&
                                  ` / ${categorizedEmails.linked.length}`}
                              </Badge>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div>
                                {emailsByMonthPerCategory.linked.sortedMonths.map((monthKey) => {
                                  const monthEmails = emailsByMonthPerCategory.linked.byMonth[monthKey];
                                  const monthLabel = monthKey === 'unknown' ? 'Unknown Date' : format(new Date(monthKey + '-01'), 'MMMM yyyy');
                                  const isMonthCollapsed = collapsedEmailMonths.has(`linked-${monthKey}`);

                                  return (
                                    <div key={monthKey}>
                                      <div
                                        className="flex items-center gap-2 px-2 py-1 bg-muted/20 hover:bg-muted/40 cursor-pointer text-[10px] text-muted-foreground font-medium"
                                        onClick={() => {
                                          setCollapsedEmailMonths(prev => {
                                            const next = new Set(prev);
                                            const key = `linked-${monthKey}`;
                                            if (next.has(key)) next.delete(key);
                                            else next.add(key);
                                            return next;
                                          });
                                        }}
                                      >
                                        {isMonthCollapsed ? <ChevronRight className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                                        <CalendarIcon className="h-2.5 w-2.5" />
                                        <span>{monthLabel}</span>
                                        <span className="ml-auto">{monthEmails.length}</span>
                                      </div>
                                      {!isMonthCollapsed && (
                                        <div className="divide-y">
                                          {monthEmails.map((att) => (
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
                                        onDoubleClick={(e) => {
                                          e.preventDefault();
                                          if (att.email) {
                                            window.open(`/emails?open=${att.email.id}`, '_blank');
                                          }
                                        }}
                                        title="Click to view, double-click to open in new tab"
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
                                          className="h-5 w-5 p-0 text-muted-foreground hover:text-blue-500 dark:text-blue-400"
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
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}
                        </Accordion>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-3">No emails attached</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Documents Section (Info attachments) */}
            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center gap-2 p-2 border-b">
                <div
                  className="flex items-center gap-2 cursor-pointer flex-1 hover:bg-muted/50 rounded-md py-1 px-1 -ml-1 transition-colors"
                  onClick={() => setDocumentsCollapsed(!documentsCollapsed)}
                >
                  {documentsCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
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
                            onClick={() => handleDownloadAttachment(att)}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOpenAttachmentInNewWindow(att);
                            }}
                            title="Click to download, double-click to open in new window"
                          >
                            {downloadingAttachmentId === att.id ? (
                              <Loader2 className="h-3 w-3 text-muted-foreground shrink-0 animate-spin" />
                            ) : (
                              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
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
            <div className="rounded-lg border overflow-hidden">
              <div
                className="flex items-center gap-2 p-2 border-b cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setResponseFilesCollapsed(!responseFilesCollapsed)}
              >
                {responseFilesCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                <Send className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Response Files</span>
                <Badge variant="secondary" className="text-xs">{responseAttachments.length}</Badge>
                {/* Download All button - backend can download via API even without frontend URLs */}
                {responseAttachments.filter(att => att.document).length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadAllResponseFiles();
                    }}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    title="Download all files"
                  >
                    {downloadingAllResponseFiles ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    <span>Download All</span>
                  </button>
                )}
              </div>

              {!responseFilesCollapsed && (
                <>
                {responseAttachments.length > 0 ? (
                <div className="border rounded-md divide-y bg-primary/5 dark:bg-primary/10 mb-2">
                  {responseAttachments.map((att) => {
                    // SSoT: has_storage indicates share links can be created (even for legacy SharePoint docs)
                    const hasExternalStorage = att.document?.has_storage || att.document?.storage_url || att.document?.file_url;
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
                              // Single click = open preview (consistent with Questions section)
                              const url = att.document?.storage_url || att.document?.file_url;
                              const fileName = att.document?.display_name || att.document?.file_name || 'Document';
                              const ext = (att.document?.file_name || '').split('.').pop()?.toLowerCase() || '';
                              const fileType: 'pdf' | 'image' | 'other' = ext === 'pdf' ? 'pdf'
                                : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) ? 'image'
                                : 'other';
                              if (url) {
                                setViewerDocument({ url, fileName, fileType });
                              }
                            }
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (att.email) {
                              window.open(`/emails?open=${att.email.id}`, '_blank');
                            } else {
                              handleOpenAttachmentInNewWindow(att);
                            }
                          }}
                          title={att.email ? "Click to view, double-click to open in new tab" : "Click to preview, double-click to open in new tab"}
                        >
                          {isEmail ? (
                            <Mail className="h-3 w-3 text-primary shrink-0" />
                          ) : (
                            <>
                              <FileText className="h-3 w-3 text-primary shrink-0" />
                              {/* Download button - separate from preview (consistent with Questions section) */}
                              {(att.document?.has_storage || att.document?.storage_url || att.document?.file_url) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadAttachment(att);
                                  }}
                                  className="text-muted-foreground hover:text-foreground"
                                  title="Download"
                                >
                                  {downloadingAttachmentId === att.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Download className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </>
                          )}
                          <div className="flex-1 min-w-0">
                            {renamingAttachmentId === att.id ? (
                              <form
                                className="flex items-center gap-1"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const form = e.currentTarget;
                                  const input = form.querySelector('input') as HTMLInputElement;
                                  const newName = input?.value || '';
                                  if (newName.trim()) {
                                    handleRenameAttachment(att.id, newName);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Input
                                  name="attachmentName"
                                  defaultValue={renamingAttachmentName}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Escape') {
                                      setRenamingAttachmentId(null);
                                      setRenamingAttachmentName('');
                                    }
                                  }}
                                  className="h-7 text-sm flex-1"
                                  autoFocus
                                />
                                <Button
                                  type="submit"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                                  title="Save"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingAttachmentId(null);
                                    setRenamingAttachmentName('');
                                  }}
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </form>
                            ) : (
                              <div className="font-medium truncate">
                                {/* Priority: attachment.display_name > document/email name */}
                                {att.display_name || (isEmail
                                  ? (att.email?.subject || '(No subject)')
                                  : (att.document?.display_name || att.document?.file_name))}
                              </div>
                            )}
                          </div>
                          {renamingAttachmentId !== att.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingAttachmentId(att.id);
                                // Use current display name or fall back to original
                                const currentName = att.display_name || (isEmail
                                  ? (att.email?.subject || '')
                                  : (att.document?.display_name || att.document?.file_name || ''));
                                setRenamingAttachmentName(currentName);
                              }}
                              title="Rename"
                            >
                              <Pencil className="h-3 w-3" />
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
                        {/* Email inclusion options - for documents (S3 link) and emails (app link) */}
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
                          {(hasExternalStorage || isEmail) && (
                            <>
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
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`att-${att.id}`}
                                  checked={emailOption === 'both'}
                                  onChange={() => setAttachmentEmailOptions(prev => ({ ...prev, [att.id]: 'both' }))}
                                  className="w-3 h-3"
                                />
                                <span>Both</span>
                              </label>
                            </>
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
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3 mb-2 border border-dashed rounded-md">
                  Drag files here to add response attachments
                </p>
              )}
              {/* Include original email option */}
              {originalEmailData && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeOriginalEmail}
                    onChange={(e) => setIncludeOriginalEmail(e.target.checked)}
                    className="h-3 w-3"
                  />
                  <span>Include original email in reply</span>
                </label>
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
              </>
            )}
            </div>
                </div>
              </div>
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

      {/* Delete question confirmation dialog - when item has a delegated subtask */}
      {deleteConfirmItem && (
        <Dialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete {deleteConfirmItem.item_type === 'question' ? 'Question' : 'Action'}?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This {deleteConfirmItem.item_type} has a linked subtask:
              </p>
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium text-sm">
                  Task #{deleteConfirmItem.delegated_task_id}: {deleteConfirmItem.delegated_task?.name}
                </div>
                {deleteConfirmItem.delegated_task?.assigned_user_name && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Assigned to: {deleteConfirmItem.delegated_task.assigned_user_name}
                  </div>
                )}
                {deleteConfirmItem.delegated_task?.children && deleteConfirmItem.delegated_task.children.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Has {deleteConfirmItem.delegated_task.children.length} subtask(s)
                  </div>
                )}
                {(deleteConfirmItem.delegated_task?.action_items_count ?? 0) > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Has {deleteConfirmItem.delegated_task?.action_items_count} action item(s)
                  </div>
                )}
                {(deleteConfirmItem.delegated_task?.attachments_count ?? 0) > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Has {deleteConfirmItem.delegated_task?.attachments_count} attachment(s)
                  </div>
                )}
              </div>
              <p className="text-sm">What would you like to do with the subtask?</p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => handleConfirmedDelete(true)}
                >
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                  Keep subtask (will become a standalone subtask)
                </Button>
                <Button
                  variant="outline"
                  className="justify-start text-destructive hover:text-destructive"
                  onClick={() => handleConfirmedDelete(false)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete subtask and all its contents
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDeleteConfirmItem(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedEmailId && (
        <EmailDetailDialog
          emailId={selectedEmailId}
          open={!!selectedEmailId}
          onOpenChange={(open) => !open && setSelectedEmailId(null)}
        />
      )}

      {/* Undelegate modal - when clicking X on a delegated task */}
      {undelegateModalItem && (
        <Dialog open={!!undelegateModalItem} onOpenChange={(open) => !open && setUndelegateModalItem(null)}>
          <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Remove Delegated Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium text-sm">
                  Task #{undelegateModalItem.delegated_task_id}: {undelegateModalItem.delegated_task?.name}
                </div>
                {undelegateModalItem.delegated_task?.assigned_user_name && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Assigned to: {undelegateModalItem.delegated_task.assigned_user_name}
                  </div>
                )}
              </div>

              <p className="text-sm">What would you like to do?</p>

              {/* Hidden focus trap to prevent auto-opening the dropdown */}
              <button className="sr-only" tabIndex={0} aria-hidden="true" />

              {/* Move to another question option */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Move to another question:</label>
                <ComboboxDropdown
                  items={groupedQuestions.allItems
                    .filter((q: TaskActionItem) => q.item_type === 'question' && q.id !== undelegateModalItem.id && !q.delegated_task_id)
                    .map((q: TaskActionItem) => ({ id: q.id.toString(), label: q.text.substring(0, 60) + (q.text.length > 60 ? '...' : '') }))}
                  placeholder="Select a question..."
                  selectedItem={undelegateTargetQuestionId ? {
                    id: undelegateTargetQuestionId.toString(),
                    label: groupedQuestions.allItems.find((q: TaskActionItem) => q.id === undelegateTargetQuestionId)?.text.substring(0, 60) || ''
                  } : undefined}
                  onSelect={(selected) => setUndelegateTargetQuestionId(parseInt(selected.id))}
                  className="w-full"
                />
                {undelegateTargetQuestionId && (
                  <Button
                    className="w-full"
                    onClick={handleMoveToQuestion}
                    disabled={undelegateModalLoading}
                  >
                    {undelegateModalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Move to Selected Question
                  </Button>
                )}
              </div>

              <div className="border-t pt-4 flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="justify-start text-destructive hover:text-destructive"
                  onClick={handleDeleteDelegatedTask}
                  disabled={undelegateModalLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete task permanently
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setUndelegateModalItem(null)}
                  disabled={undelegateModalLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delegate question/action modal */}
      {delegateModalData && (
        <Dialog open={!!delegateModalData} onOpenChange={(open) => !open && closeDelegateModal()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Delegate {delegateModalData.itemType === 'question' ? 'Question' : 'Action'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Question/Action text (read-only) */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {delegateModalData.itemType === 'question' ? 'Question' : 'Action'}
                </label>
                <div className="mt-1 p-3 bg-muted rounded-lg text-sm">
                  {delegateModalData.itemText}
                </div>
              </div>

              {/* Assign to (required) */}
              <div>
                <label className="text-sm font-medium">
                  Assign to <span className="text-destructive">*</span>
                </label>
                <div className="mt-1">
                  <ComboboxDropdown
                    items={delegationUsers.map(u => ({ id: u.id.toString(), label: u.name }))}
                    placeholder="Select person..."
                    selectedItem={delegateModalUserId ? { id: delegateModalUserId.toString(), label: delegationUsers.find(u => u.id === delegateModalUserId)?.name || '' } : undefined}
                    onSelect={(selected) => setDelegateModalUserId(parseInt(selected.id))}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Instructions (optional) */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Instructions (optional)
                </label>
                <Textarea
                  value={delegateModalInstructions}
                  onChange={(e) => setDelegateModalInstructions(e.target.value)}
                  placeholder="Add any specific instructions or context for the assignee..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Due date */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Due date
                </label>
                {/* Quick date buttons */}
                <div className="flex gap-2 mt-1 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setDelegateModalDueDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setDelegateModalDueDate(addWorkingDays(new Date(), 7))}
                  >
                    +7 days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setDelegateModalDueDate(addWorkingDays(new Date(), 30))}
                  >
                    +30 days
                  </Button>
                </div>
                <div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {delegateModalDueDate
                          ? delegateModalDueDate.toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })
                          : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={delegateModalDueDate}
                        onSelect={setDelegateModalDueDate}
                        disabled={(date) => !isWorkingDay(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={closeDelegateModal}
                  disabled={delegateModalLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitDelegation}
                  disabled={!delegateModalUserId || delegateModalLoading}
                >
                  {delegateModalLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Task'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
          defaultTo={originalEmailSender || ''}
          defaultCc={suggestedCcRecipients.join(', ')}
          defaultSubject={originalEmailData?.subject
            ? `Re: ${originalEmailData.subject.replace(/^(RE:|FW:|FWD:)\s*/gi, '')}`
            : `Re: Task #${task.task_number}  |  ${task.name}`}
          defaultBody={generateResponseBody()}
          initialAttachments={emailFileAttachments}
          smTaskId={task.id}
          skipSignature={true}
          onSent={() => {
            setShowComposeEmail(false);
            refresh();
          }}
        />
      )}

      {/* Suggested Emails Modal - Collapsible sections by category */}
      <Dialog open={suggestedEmailsModalOpen} onOpenChange={setSuggestedEmailsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Suggested Related Emails
              {getTotalSuggestedCount() > 0 && (
                <Badge variant="secondary">{getTotalSuggestedCount()}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            {suggestedEmailsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-6 w-6" />
                <span className="ml-2 text-sm text-muted-foreground">Loading suggestions...</span>
              </div>
            ) : !suggestedEmailsGrouped ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No source email found for this task.</p>
                <p className="text-sm mt-1">Suggestions are based on the email used to create this task.</p>
              </div>
            ) : getTotalSuggestedCount() === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No related emails found.</p>
                <p className="text-sm mt-1">All similar emails may already be attached.</p>
              </div>
            ) : (
              <Accordion type="multiple" value={suggestedCategoryExpanded} onValueChange={setSuggestedCategoryExpanded} className="space-y-2">
                {/* Thread Section */}
                {suggestedEmailsGrouped.thread.emails.length > 0 && (
                  <AccordionItem value="thread" className="border rounded-lg">
                    <AccordionTrigger className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 hover:no-underline [&[data-state=open]>div>svg:first-child]:rotate-90">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200" />
                        <span className="font-medium">{suggestedEmailsGrouped.thread.label}</span>
                        <Badge variant="outline">{suggestedEmailsGrouped.thread.emails.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isCategoryFullySelected('thread')}
                          onCheckedChange={() => toggleCategorySelection('thread')}
                        />
                        <span className="text-xs text-muted-foreground">Select All</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="border-t divide-y">
                        {suggestedEmailsGrouped.thread.emails.map((email) => (
                          <div
                            key={email.id}
                            className="flex items-start gap-3 p-3 hover:bg-muted/30"
                          >
                            <Checkbox
                              checked={selectedSuggestedEmails.has(email.id)}
                              onCheckedChange={() => toggleSuggestedEmailSelection(email.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">
                                  {email.from_name || email.from_email}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(email.received_at), 'dd/MM/yy HH:mm')}
                                </span>
                              </div>
                              <p className="text-sm truncate">{email.subject}</p>
                              {email.body_preview && (
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  {email.body_preview}
                                </p>
                              )}
                            </div>
                            {email.has_attachments && (
                              <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Sender Section */}
                {suggestedEmailsGrouped.sender.emails.length > 0 && (
                  <AccordionItem value="sender" className="border rounded-lg">
                    <AccordionTrigger className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 hover:no-underline [&[data-state=open]>div>svg:first-child]:rotate-90">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200" />
                        <span className="font-medium">{suggestedEmailsGrouped.sender.label}</span>
                        <Badge variant="outline">{suggestedEmailsGrouped.sender.emails.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isCategoryFullySelected('sender')}
                          onCheckedChange={() => toggleCategorySelection('sender')}
                        />
                        <span className="text-xs text-muted-foreground">Select All</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="border-t divide-y">
                        {suggestedEmailsGrouped.sender.emails.map((email) => (
                          <div
                            key={email.id}
                            className="flex items-start gap-3 p-3 hover:bg-muted/30"
                          >
                            <Checkbox
                              checked={selectedSuggestedEmails.has(email.id)}
                              onCheckedChange={() => toggleSuggestedEmailSelection(email.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">
                                  {email.from_name || email.from_email}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(email.received_at), 'dd/MM/yy HH:mm')}
                                </span>
                              </div>
                              <p className="text-sm truncate">{email.subject}</p>
                              {email.body_preview && (
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  {email.body_preview}
                                </p>
                              )}
                            </div>
                            {email.has_attachments && (
                              <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Subject Section */}
                {suggestedEmailsGrouped.subject.emails.length > 0 && (
                  <AccordionItem value="subject" className="border rounded-lg">
                    <AccordionTrigger className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 hover:no-underline [&[data-state=open]>div>svg:first-child]:rotate-90">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200" />
                        <span className="font-medium">{suggestedEmailsGrouped.subject.label}</span>
                        <Badge variant="outline">{suggestedEmailsGrouped.subject.emails.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isCategoryFullySelected('subject')}
                          onCheckedChange={() => toggleCategorySelection('subject')}
                        />
                        <span className="text-xs text-muted-foreground">Select All</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="border-t divide-y">
                        {suggestedEmailsGrouped.subject.emails.map((email) => (
                          <div
                            key={email.id}
                            className="flex items-start gap-3 p-3 hover:bg-muted/30"
                          >
                            <Checkbox
                              checked={selectedSuggestedEmails.has(email.id)}
                              onCheckedChange={() => toggleSuggestedEmailSelection(email.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">
                                  {email.from_name || email.from_email}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(email.received_at), 'dd/MM/yy HH:mm')}
                                </span>
                              </div>
                              <p className="text-sm truncate">{email.subject}</p>
                              {email.body_preview && (
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  {email.body_preview}
                                </p>
                              )}
                            </div>
                            {email.has_attachments && (
                              <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            )}
          </div>

          {/* Footer with Add Selected button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setSuggestedEmailsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSelectedSuggestedEmails}
              disabled={selectedSuggestedEmails.size === 0 || addingSuggestedEmail}
            >
              {addingSuggestedEmail ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Selected ({selectedSuggestedEmails.size})
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rich Text Editor Modal (SSoT for all text editing) */}
      <RichTextEditorModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        value={editModalValue}
        onSave={handleEditModalSave}
        title={editModalTitle}
        placeholder={
          editModalType === 'answer' ? 'Type your answer...' :
          editModalType === 'question' ? 'Enter your question...' :
          editModalType === 'header' ? 'Enter header text...' :
          'Enter text...'
        }
        plainText={editModalType !== 'answer'}
        minHeight={editModalType === 'answer' ? 400 : 300}
        enableWritingChecker={true}
        writingContext="notes"
      />
    </div>
  );
}
