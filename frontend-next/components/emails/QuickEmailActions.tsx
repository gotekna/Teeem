"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Archive, Trash2, Clock, Mail, MailOpen, AlertOctagon, FolderInput, Reply, Forward } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface QuickEmailActionsProps {
  emailId: number;
  isRead?: boolean;
  isArchived?: boolean;
  onAction?: () => void;
  onSnooze?: () => void;
  onMove?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  className?: string;
}

/**
 * Quick action buttons that appear on hover over email list items
 * Actions: Archive, Delete, Snooze, Move, Mark Read/Unread
 */
export function QuickEmailActions({
  emailId,
  isRead = false,
  isArchived = false,
  onAction,
  onSnooze,
  onMove,
  onReply,
  onForward,
  className,
}: QuickEmailActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading("archive");
    try {
      await api.post(`/api/v1/email_user_states/for_email/${emailId}/toggle_archive`);
      onAction?.();
    } catch (error) {
      console.error("Failed to archive:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading("delete");
    try {
      await api.delete(`/api/v1/synced_email/${emailId}/delete_from_outlook`);
      onAction?.();
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleToggleRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading("read");
    try {
      await api.post(`/api/v1/email_user_states/for_email/${emailId}/toggle_read`);
      onAction?.();
    } catch (error) {
      console.error("Failed to toggle read:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleSnooze = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSnooze?.();
  };

  const handleMove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMove?.();
  };

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReply?.();
  };

  const handleForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    onForward?.();
  };

  const handleSpam = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading("spam");
    try {
      await api.post(`/api/v1/synced_email/${emailId}/mark_as_spam`, { delete_from_outlook: true });
      onAction?.();
    } catch (error) {
      console.error("Failed to mark as spam:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "hidden items-center gap-0.5 group-hover:flex",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Reply */}
        {onReply && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-primary/10"
                onClick={handleReply}
                disabled={loading !== null}
              >
                <Reply className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Reply (r)
            </TooltipContent>
          </Tooltip>
        )}

        {/* Forward */}
        {onForward && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-primary/10"
                onClick={handleForward}
                disabled={loading !== null}
              >
                <Forward className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Forward (f)
            </TooltipContent>
          </Tooltip>
        )}

        {/* Archive */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-primary/10"
              onClick={handleArchive}
              disabled={loading !== null}
            >
              {loading === "archive" ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {isArchived ? "Unarchive (e)" : "Archive (e)"}
          </TooltipContent>
        </Tooltip>

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-red-500/10 hover:text-red-500 dark:text-red-400"
              onClick={handleDelete}
              disabled={loading !== null}
            >
              {loading === "delete" ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Delete (d)
          </TooltipContent>
        </Tooltip>

        {/* Snooze */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-primary/10"
              onClick={handleSnooze}
              disabled={loading !== null}
            >
              <Clock className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Snooze (b)
          </TooltipContent>
        </Tooltip>

        {/* Move to folder */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-primary/10"
              onClick={handleMove}
              disabled={loading !== null}
            >
              <FolderInput className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Move to folder (m)
          </TooltipContent>
        </Tooltip>

        {/* Mark Read/Unread */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-primary/10"
              onClick={handleToggleRead}
              disabled={loading !== null}
            >
              {loading === "read" ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : isRead ? (
                <Mail className="h-3.5 w-3.5" />
              ) : (
                <MailOpen className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {isRead ? "Mark unread (u)" : "Mark read (u)"}
          </TooltipContent>
        </Tooltip>

        {/* Spam */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-orange-500/10 hover:text-orange-500 dark:text-orange-400"
              onClick={handleSpam}
              disabled={loading !== null}
            >
              {loading === "spam" ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <AlertOctagon className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Spam (!)
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export default QuickEmailActions;
