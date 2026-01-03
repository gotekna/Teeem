"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useNotebookPage } from "./hooks/useNotebookPage";
import { Check, Cloud, CloudOff, Clock, FileText } from "lucide-react";

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

  // Sync local state with fetched page data
  useEffect(() => {
    if (page) {
      setTitle(page.title);
      setContent(page.content || "");
    }
  }, [page]);

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
          className="text-xl font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
        />
        <SaveStatus
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          lastSaved={lastSaved}
        />
      </div>

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
