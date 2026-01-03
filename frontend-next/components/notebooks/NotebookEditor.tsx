"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  useNotebookPage,
  attachmentActions,
  type NotebookPageAttachment,
} from "./hooks/useNotebookPage";
import {
  Check,
  Cloud,
  CloudOff,
  Clock,
  FileText,
  Paperclip,
  Download,
  Trash2,
  Image,
  File,
  X,
} from "lucide-react";

interface NotebookEditorProps {
  pageId: number | null;
  className?: string;
}

export function NotebookEditor({ pageId, className }: NotebookEditorProps) {
  const {
    page,
    isLoading,
    error,
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    updateContent,
    updateTitle,
  } = useNotebookPage(pageId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<NotebookPageAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state with fetched page data
  useEffect(() => {
    if (page) {
      setTitle(page.title);
      setContent(page.content || "");
      setAttachments(page.attachments || []);
    }
  }, [page]);

  // Load attachments
  useEffect(() => {
    if (pageId) {
      attachmentActions.list(pageId).then(setAttachments).catch(console.error);
    }
  }, [pageId]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!pageId || !e.target.files?.length) return;

      setIsUploading(true);
      try {
        const file = e.target.files[0];
        const attachment = await attachmentActions.upload(pageId, file);
        setAttachments((prev) => [attachment, ...prev]);
        setShowAttachments(true);
      } catch (err) {
        console.error("Failed to upload:", err);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [pageId]
  );

  const handleDeleteAttachment = useCallback(async (attachmentId: number) => {
    try {
      await attachmentActions.delete(attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }, []);

  const handleDownload = useCallback(async (attachmentId: number) => {
    try {
      const { url, file_name } = await attachmentActions.getDownloadUrl(attachmentId);
      const link = document.createElement("a");
      link.href = url;
      link.download = file_name;
      link.click();
    } catch (err) {
      console.error("Failed to download:", err);
    }
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    updateTitle(newTitle);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    updateContent(newContent);
  };

  if (!pageId) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground", className)}>
        <FileText className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm">Select a page to start editing</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-destructive", className)}>
        <CloudOff className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">Failed to load page</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with title and save status */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Input
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled"
          className="text-xl font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto flex-1"
        />
        <div className="flex items-center gap-2">
          <SaveStatus
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSaved={lastSaved}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="relative"
          >
            {isUploading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            {attachments.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {attachments.length}
              </span>
            )}
          </Button>
          {attachments.length > 0 && (
            <Button
              variant={showAttachments ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowAttachments(!showAttachments)}
            >
              Attachments
            </Button>
          )}
        </div>
      </div>

      {/* Attachments panel */}
      {showAttachments && attachments.length > 0 && (
        <div className="border-b bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Attachments ({attachments.length})</h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowAttachments(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {attachments.map((attachment) => (
              <AttachmentCard
                key={attachment.id}
                attachment={attachment}
                onDownload={() => handleDownload(attachment.id)}
                onDelete={() => handleDeleteAttachment(attachment.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto py-6 px-4">
          <RichTextEditor
            value={content}
            onChange={handleContentChange}
            placeholder="Start writing..."
            minHeight={400}
            className="prose prose-sm dark:prose-invert max-w-none"
          />
        </div>
      </div>

      {/* Footer with metadata */}
      {page && (
        <div className="flex items-center gap-4 px-4 py-2 border-t text-xs text-muted-foreground bg-muted/30">
          <span>{page.word_count} words</span>
          <span>{page.char_count} characters</span>
          {page.last_edited_by && (
            <span>Last edited by {page.last_edited_by.name}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface SaveStatusProps {
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
}

function SaveStatus({ isSaving, hasUnsavedChanges, lastSaved }: SaveStatusProps) {
  if (isSaving) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Cloud className="h-3.5 w-3.5 animate-pulse" />
        <span>Saving...</span>
      </div>
    );
  }

  if (hasUnsavedChanges) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-500">
        <Clock className="h-3.5 w-3.5" />
        <span>Unsaved changes</span>
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-500">
        <Check className="h-3.5 w-3.5" />
        <span>Saved</span>
      </div>
    );
  }

  return null;
}

interface AttachmentCardProps {
  attachment: NotebookPageAttachment;
  onDownload: () => void;
  onDelete: () => void;
}

function AttachmentCard({ attachment, onDownload, onDelete }: AttachmentCardProps) {
  const IconComponent = attachment.is_image ? Image : File;

  return (
    <div className="flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-muted/50 group">
      <IconComponent className="h-8 w-8 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
        <p className="text-xs text-muted-foreground">{attachment.human_size}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onDownload}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
