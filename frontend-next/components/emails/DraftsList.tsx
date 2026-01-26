"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useEmailDrafts, type EmailDraft } from "@/hooks/useEmailDrafts";
import {
  FileText,
  Trash2,
  X,
  Paperclip,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface DraftsListProps {
  /** Called when a draft is selected to resume */
  onResume?: (draft: EmailDraft) => void;
  /** Called when drafts list should be hidden */
  onClose?: () => void;
  /** Maximum height of the list */
  maxHeight?: string;
  /** Show as a compact list (for sidebar) */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Component to display and manage saved email drafts
 */
export function DraftsList({
  onResume,
  onClose,
  maxHeight = "400px",
  compact = false,
  className,
}: DraftsListProps) {
  const { drafts, deleteDraft, clearAllDrafts, refreshDrafts } = useEmailDrafts();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Refresh drafts when component mounts
  useEffect(() => {
    refreshDrafts();
  }, [refreshDrafts]);

  const handleDelete = (id: string) => {
    deleteDraft(id);
    setDeleteConfirmId(null);
  };

  const formatDraftTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    return format(date, "MMM d, yyyy 'at' h:mm a");
  };

  const getDraftPreview = (draft: EmailDraft) => {
    // Strip HTML tags for preview
    const textContent = draft.body
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return textContent.slice(0, 100) + (textContent.length > 100 ? "..." : "");
  };

  // Don't render anything when empty - the server Drafts folder handles drafts
  if (drafts.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Drafts</span>
          <Badge variant="secondary" className="text-xs">
            {drafts.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                Clear all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all drafts?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all {drafts.length} saved drafts. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearAllDrafts}>
                  Clear all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Drafts list */}
      <ScrollArea style={{ maxHeight }}>
        <div className="divide-y">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className={cn(
                "group relative hover:bg-muted/50 transition-colors",
                compact ? "px-3 py-2" : "px-4 py-3"
              )}
            >
              {/* Main content - clickable to resume */}
              <button
                className="w-full text-left"
                onClick={() => onResume?.(draft)}
              >
                {/* To/Subject line */}
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-medium truncate",
                    compact ? "text-xs" : "text-sm"
                  )}>
                    {draft.to || "No recipient"}
                  </span>
                  {draft.attachment_names.length > 0 && (
                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                </div>

                {/* Subject */}
                <p className={cn(
                  "truncate text-muted-foreground",
                  compact ? "text-xs" : "text-sm"
                )}>
                  {draft.subject || "(No subject)"}
                </p>

                {/* Preview (only in non-compact mode) */}
                {!compact && (
                  <p className="text-xs text-muted-foreground/70 line-clamp-2 mt-1">
                    {getDraftPreview(draft)}
                  </p>
                )}

                {/* Time */}
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {formatDraftTime(draft.updated_at)}
                </p>
              </button>

              {/* Delete button */}
              <AlertDialog open={deleteConfirmId === draft.id} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity",
                      "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(draft.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This draft will be permanently deleted. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(draft.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Compact badge showing draft count, clickable to open drafts list
 */
interface DraftsBadgeProps {
  onClick?: () => void;
  className?: string;
}

export function DraftsBadge({ onClick, className }: DraftsBadgeProps) {
  const { draftCount } = useEmailDrafts();

  if (draftCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md",
        "bg-muted hover:bg-muted/80 transition-colors",
        "text-xs text-muted-foreground",
        className
      )}
    >
      <FileText className="h-3.5 w-3.5" />
      <span>{draftCount} draft{draftCount !== 1 ? "s" : ""}</span>
    </button>
  );
}

export default DraftsList;
