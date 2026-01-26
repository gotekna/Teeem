"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/utils/formatters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EditorToolbar, type Editor } from "@/components/ui/rich-text-editor";
import {
  useNotebookPage,
  attachmentActions,
  type NotebookPageAttachment,
  type PositionedBoxData,
  type StrokeData,
} from "./hooks/useNotebookPage";
import { NotebookCanvas } from "./NotebookCanvas";
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
  Share2,
  Copy,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultipleSelector, { type Option } from "@/components/ui/multiple-selector";
import { api } from "@/lib/api";

// Constants for the main content box - must match NotebookCanvas
const MAIN_CONTENT_ID = "main-content";

interface NotebookEditorProps {
  pageId: number | null;
  notebookId: number | null;
  className?: string;
}

export function NotebookEditor({ pageId, notebookId, className }: NotebookEditorProps) {
  const {
    page,
    isLoading,
    error,
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    updateContent,
    updateTitle,
    updateContentMetadata,
    saveNow,
  } = useNotebookPage(pageId, notebookId);

  // All state declarations MUST come before callbacks that use them
  const [title, setTitle] = useState("");
  const [attachments, setAttachments] = useState<NotebookPageAttachment[]>([]);
  const [positionedBoxes, setPositionedBoxes] = useState<PositionedBoxData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draw mode state
  const [drawMode, setDrawMode] = useState<"select" | "pen" | "highlighter" | "eraser" | null>(null);
  const [drawColor, setDrawColor] = useState("#000000");
  const [drawSize, setDrawSize] = useState(2);
  const [strokes, setStrokes] = useState<StrokeData[]>([]);

  // Unified history for undo/redo - stores both boxes and strokes together
  interface HistoryState {
    boxes: PositionedBoxData[];
    strokes: StrokeData[];
  }
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false); // Track if change is from undo/redo

  // Share state
  const [selectedUsers, setSelectedUsers] = useState<Option[]>([]);
  const [shareAccess, setShareAccess] = useState<"read" | "edit">("read");
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [userOptions, setUserOptions] = useState<Option[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Undo function for boxes and strokes
  const undoBoxes = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex - 1;
      const previousState = history[newIndex];
      setHistoryIndex(newIndex);
      setPositionedBoxes(previousState.boxes);
      setStrokes(previousState.strokes);
      updateContentMetadata({
        positioned_boxes: previousState.boxes,
        strokes: previousState.strokes,
      });

      // Also update legacy content field if main content box exists
      const mainBox = previousState.boxes.find(b => b.id === MAIN_CONTENT_ID);
      if (mainBox) {
        updateContent(mainBox.content);
      }
    }
  }, [historyIndex, history, updateContentMetadata, updateContent]);

  // Redo function for boxes and strokes
  const redoBoxes = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];
      setHistoryIndex(newIndex);
      setPositionedBoxes(nextState.boxes);
      setStrokes(nextState.strokes);
      updateContentMetadata({
        positioned_boxes: nextState.boxes,
        strokes: nextState.strokes,
      });

      // Also update legacy content field if main content box exists
      const mainBox = nextState.boxes.find(b => b.id === MAIN_CONTENT_ID);
      if (mainBox) {
        updateContent(mainBox.content);
      }
    }
  }, [historyIndex, history, updateContentMetadata, updateContent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (pageId && hasUnsavedChanges) {
          saveNow();
        }
      }

      // Ctrl/Cmd + Z to undo (only when not in text editor)
      // Check if active element is a TipTap editor (it has its own undo)
      const activeEl = document.activeElement;
      const isInTipTap = activeEl?.closest('.ProseMirror') !== null;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey && !isInTipTap) {
        e.preventDefault();
        undoBoxes();
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y to redo (only when not in text editor)
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" && e.shiftKey || e.key === "y") && !isInTipTap) {
        e.preventDefault();
        redoBoxes();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pageId, hasUnsavedChanges, saveNow, undoBoxes, redoBoxes]);

  // Load users for sharing
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await api.get<{ users: { id: number; name: string }[] }>('/api/v1/users/for_select');
        if (response?.users) {
          setUserOptions(response.users.map(u => ({
            value: String(u.id),
            label: u.name,
          })));
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    loadUsers();
  }, []);

  // Generate share link
  const shareLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    const baseUrl = window.location.origin;
    if (pageId && notebookId) {
      return `${baseUrl}/notebooks/${notebookId}/pages/${pageId}`;
    }
    if (notebookId) {
      return `${baseUrl}/notebooks/${notebookId}`;
    }
    return "";
  }, [pageId, notebookId]);

  const handleCopyLink = useCallback(() => {
    if (shareLink) {
      copyToClipboard(shareLink);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    }
  }, [shareLink]);

  const handleShare = useCallback(() => {
    if (selectedUsers.length === 0) return;
    // TODO: Implement actual share API call
    console.log("Sharing with:", {
      userIds: selectedUsers.map(u => u.value),
      access: shareAccess,
      pageId,
      notebookId,
    });
    // Reset form
    setSelectedUsers([]);
    setShareAccess("read");
  }, [selectedUsers, shareAccess, pageId, notebookId]);

  // Calculate word and character counts from all boxes content
  const { wordCount, charCount } = useMemo(() => {
    const allContent = positionedBoxes.map(b => b.content).join(" ");
    const plainText = allContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const chars = plainText.length;
    const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
    return { wordCount: words, charCount: chars };
  }, [positionedBoxes]);

  // Sync local state with fetched page data
  useEffect(() => {
    if (page) {
      setTitle(page.title);
      setAttachments(page.attachments || []);

      // Load positioned boxes from content_metadata
      // If there's legacy content without positioned_boxes, create main box with that content
      const boxes = page.content_metadata?.positioned_boxes || [];
      let initialBoxes: PositionedBoxData[];
      if (boxes.length === 0 && page.content) {
        // Migrate legacy content to main content box
        initialBoxes = [{
          id: MAIN_CONTENT_ID,
          x_percent: 5,
          y_percent: 2,
          width_percent: 85,
          content: page.content,
          isMainContent: true,
        }];
      } else {
        initialBoxes = boxes;
      }
      setPositionedBoxes(initialBoxes);

      // Load drawing strokes from content_metadata
      const loadedStrokes = page.content_metadata?.strokes || [];
      setStrokes(loadedStrokes);

      // Initialize unified history with boxes and strokes
      setHistory([{ boxes: initialBoxes, strokes: loadedStrokes }]);
      setHistoryIndex(0);
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

  // Helper to add state to unified history
  const addToHistory = useCallback(
    (boxes: PositionedBoxData[], strokesData: StrokeData[]) => {
      // Skip if this change came from undo/redo
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false;
        return;
      }

      // Add to history, discarding any "future" states if we're not at the end
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        // Limit history to 50 states to avoid memory issues
        const limitedHistory = newHistory.length >= 50
          ? newHistory.slice(-49)
          : newHistory;
        return [...limitedHistory, { boxes, strokes: strokesData }];
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 49));
    },
    [historyIndex]
  );

  const handlePositionedBoxesChange = useCallback(
    (boxes: PositionedBoxData[], skipHistory?: boolean) => {
      setPositionedBoxes(boxes);

      // Find main content box and sync to legacy content field for compatibility
      const mainBox = boxes.find(b => b.id === MAIN_CONTENT_ID);
      if (mainBox) {
        updateContent(mainBox.content);
      }

      // Save all boxes to content_metadata
      updateContentMetadata({ positioned_boxes: boxes });

      // Skip history tracking during live resize/drag operations
      if (skipHistory) {
        return;
      }

      // Add to unified history with current strokes
      addToHistory(boxes, strokes);
    },
    [updateContent, updateContentMetadata, addToHistory, strokes]
  );

  // Handle strokes change - save to content_metadata and track history
  const handleStrokesChange = useCallback(
    (newStrokes: StrokeData[]) => {
      setStrokes(newStrokes);
      updateContentMetadata({ strokes: newStrokes });

      // Add to unified history with current boxes
      addToHistory(positionedBoxes, newStrokes);
    },
    [updateContentMetadata, addToHistory, positionedBoxes]
  );

  // Handle external image upload - creates a positioned image box
  const handleExternalImageUpload = useCallback(
    (base64: string) => {
      // Create image box at a default position (slightly offset from center)
      const newImageBox: PositionedBoxData = {
        id: crypto.randomUUID(),
        x_percent: 10,
        y_percent: 10 + (positionedBoxes.filter(b => b.type === "image").length * 5), // Stack new images slightly lower
        width_percent: 30, // Default width
        content: "",
        type: "image",
        imageUrl: base64,
      };

      // Use handlePositionedBoxesChange so it tracks history for undo/redo
      handlePositionedBoxesChange([...positionedBoxes, newImageBox]);
    },
    [positionedBoxes, handlePositionedBoxesChange]
  );

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

  // Right side content for the ribbon toolbar
  const toolbarRightContent = (
    <>
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
        className="relative h-7"
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
          className="h-7 text-xs"
        >
          Attachments
        </Button>
      )}

      {/* Share button */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7">
            <Share2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Share this page</h4>

            {/* User selector */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Share with team members
              </label>
              <MultipleSelector
                value={selectedUsers}
                onChange={setSelectedUsers}
                defaultOptions={userOptions}
                placeholder="Search users..."
                emptyIndicator={
                  loadingUsers ? (
                    <p className="text-center text-sm text-muted-foreground py-2">Loading...</p>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-2">No users found</p>
                  )
                }
                className="min-h-[36px]"
                badgeClassName="bg-primary/10 text-primary hover:bg-primary/20"
              />
              <div className="flex items-center gap-2">
                <div onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={shareAccess}
                    onValueChange={(v: "read" | "edit") => setShareAccess(v)}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Can view</SelectItem>
                      <SelectItem value="edit">Can edit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  onClick={handleShare}
                  disabled={selectedUsers.length === 0}
                  className="flex-1 h-8"
                >
                  Share
                </Button>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t" />

            {/* Share link */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Or copy link
              </label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareLink}
                  className="flex-1 h-8 text-xs bg-muted"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-8 px-3"
                >
                  {shareLinkCopied ? (
                    <Check className="h-4 w-4 text-green-500 dark:text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Ribbon Toolbar */}
      <EditorToolbar
        editor={activeEditor}
        onExternalImageUpload={handleExternalImageUpload}
        onExternalUndo={undoBoxes}
        onExternalRedo={redoBoxes}
        canExternalUndo={historyIndex > 0}
        canExternalRedo={historyIndex < history.length - 1}
        rightContent={toolbarRightContent}
        drawMode={drawMode}
        onDrawModeChange={setDrawMode}
        drawColor={drawColor}
        onDrawColorChange={setDrawColor}
        drawSize={drawSize}
        onDrawSizeChange={setDrawSize}
      />

      {/* Attachments panel */}
      {showAttachments && attachments.length > 0 && (
        <div className="border-b bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-muted-foreground">Attachments ({attachments.length})</h4>
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

      {/* Page content area */}
      <div className="flex-1 overflow-auto bg-background">
        <div className="bg-background min-h-full">
          {/* Page header */}
          <div className="pl-[78px] pr-6 pt-4 pb-2">
            <Input
              value={title}
              onChange={handleTitleChange}
              placeholder="Untitled"
              className="text-2xl font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
            />
            <div className="w-3/4 h-px bg-muted-foreground/30 my-2" />
            {page?.created_at && (
              <p className="text-sm text-muted-foreground">
                {new Date(page.created_at).toLocaleDateString("en-AU", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {"    "}
                {new Date(page.created_at).toLocaleTimeString("en-AU", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
            )}
          </div>

          {/* Canvas with all text boxes and drawing layer */}
          <NotebookCanvas
            boxes={positionedBoxes}
            onBoxesChange={handlePositionedBoxesChange}
            onActiveEditorChange={setActiveEditor}
            drawMode={drawMode}
            drawColor={drawColor}
            drawSize={drawSize}
            strokes={strokes}
            onStrokesChange={handleStrokesChange}
            className="min-h-[500px]"
          />
        </div>
      </div>

      {/* Footer with metadata */}
      {page && (
        <div className="flex items-center gap-4 px-4 py-2 border-t text-xs text-muted-foreground bg-muted/30">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
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
      <div className="flex items-center gap-1.5 text-xs text-green-500 dark:text-green-400">
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
