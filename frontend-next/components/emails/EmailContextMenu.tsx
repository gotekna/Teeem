"use client";

import * as React from "react";
import { useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { copyToClipboard } from "@/utils/formatters";
import {
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Archive,
  ArchiveRestore,
  FolderInput,
  Mail,
  MailOpen,
  Pin,
  PinOff,
  Star,
  Clock,
  AlertOctagon,
  Crown,
  Copy,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface EmailFolder {
  id: string;
  name: string;
  displayName?: string;
}

interface EmailContextMenuProps {
  children: React.ReactNode;
  emailId: number;
  isRead?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
  isStarred?: boolean;
  fromEmail?: string;
  fromName?: string;
  subject?: string;
  // Callbacks
  onReply?: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  onMove?: (folderId: string) => void;
  onToggleRead?: () => void;
  onTogglePin?: () => void;
  onToggleStar?: (color?: string) => void;
  onSnooze?: () => void;
  onSpam?: () => void;
  onAction?: () => void;
  // Folder list for move submenu
  folders?: EmailFolder[];
  // Account info for folder fetching
  accountId?: string;
  accountType?: string;
}

const STAR_COLORS = [
  { key: "yellow", hex: "#EAB308", label: "Yellow" },
  { key: "blue", hex: "#3B82F6", label: "Blue" },
  { key: "green", hex: "#22C55E", label: "Green" },
  { key: "red", hex: "#EF4444", label: "Red" },
  { key: "purple", hex: "#A855F7", label: "Purple" },
  { key: "orange", hex: "#F97316", label: "Orange" },
];

const SNOOZE_OPTIONS = [
  { label: "Later today", hours: 3 },
  { label: "Tomorrow", hours: 24 },
  { label: "This weekend", hours: 72 },
  { label: "Next week", hours: 168 },
  { label: "Pick date & time...", hours: -1 },
];

export function EmailContextMenu({
  children,
  emailId,
  isRead = false,
  isArchived = false,
  isPinned = false,
  isStarred = false,
  fromEmail,
  fromName,
  subject,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onArchive,
  onMove,
  onToggleRead,
  onTogglePin,
  onToggleStar,
  onSnooze,
  onSpam,
  onAction,
  folders = [],
  accountId,
  accountType,
}: EmailContextMenuProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleArchive = async () => {
    setLoading("archive");
    try {
      await api.post(`/api/v1/email_user_states/for_email/${emailId}/toggle_archive`);
      onArchive?.();
      onAction?.();
    } catch (error) {
      console.error("Failed to archive:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async () => {
    setLoading("delete");
    try {
      await api.delete(`/api/v1/synced_emails/${emailId}/delete_from_outlook`);
      onDelete?.();
      onAction?.();
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleToggleRead = async () => {
    setLoading("read");
    try {
      await api.post(`/api/v1/email_user_states/for_email/${emailId}/toggle_read`);
      onToggleRead?.();
      onAction?.();
    } catch (error) {
      console.error("Failed to toggle read:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleTogglePin = async () => {
    setLoading("pin");
    try {
      await api.post(`/api/v1/email_user_states/for_email/${emailId}/toggle_pin`);
      onTogglePin?.();
      onAction?.();
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleToggleStar = async (color?: string) => {
    setLoading("star");
    try {
      await api.post(`/api/v1/email_user_states/for_email/${emailId}/toggle_star`, { color });
      onToggleStar?.(color);
      onAction?.();
    } catch (error) {
      console.error("Failed to toggle star:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleSpam = async () => {
    setLoading("spam");
    try {
      await api.post(`/api/v1/synced_emails/${emailId}/mark_as_spam`, { delete_from_outlook: true });
      onSpam?.();
      onAction?.();
    } catch (error) {
      console.error("Failed to mark as spam:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleSnooze = async (hours: number) => {
    if (hours === -1) {
      // Open snooze picker dialog
      onSnooze?.();
      return;
    }

    setLoading("snooze");
    try {
      const remindAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await api.post(`/api/v1/email_user_states/for_email/${emailId}/set_reminder`, { remind_at: remindAt });
      onAction?.();
    } catch (error) {
      console.error("Failed to snooze:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleCopySubject = () => {
    if (subject) {
      copyToClipboard(subject);
    }
  };

  const handleCopySenderEmail = () => {
    if (fromEmail) {
      copyToClipboard(fromEmail);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* Reply actions */}
        {onReply && (
          <ContextMenuItem onClick={onReply}>
            <Reply className="mr-2 h-4 w-4" />
            Reply
            <ContextMenuShortcut>R</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {onReplyAll && (
          <ContextMenuItem onClick={onReplyAll}>
            <ReplyAll className="mr-2 h-4 w-4" />
            Reply All
            <ContextMenuShortcut>Shift+R</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {onForward && (
          <ContextMenuItem onClick={onForward}>
            <Forward className="mr-2 h-4 w-4" />
            Forward
            <ContextMenuShortcut>F</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Delete */}
        <ContextMenuItem
          onClick={handleDelete}
          disabled={loading === "delete"}
          className="text-red-600 dark:text-red-400 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
          <ContextMenuShortcut>D</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Archive */}
        <ContextMenuItem onClick={handleArchive} disabled={loading === "archive"}>
          {isArchived ? (
            <>
              <ArchiveRestore className="mr-2 h-4 w-4" />
              Unarchive
            </>
          ) : (
            <>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </>
          )}
          <ContextMenuShortcut>E</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Move to folder */}
        {folders.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FolderInput className="mr-2 h-4 w-4" />
              Move to
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              {folders.map((folder) => (
                <ContextMenuItem
                  key={folder.id}
                  onClick={() => onMove?.(folder.id)}
                >
                  {folder.displayName || folder.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {/* Copy submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onClick={handleCopySubject}>
              Copy subject
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopySenderEmail}>
              Copy sender email
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Mark as read/unread */}
        <ContextMenuItem onClick={handleToggleRead} disabled={loading === "read"}>
          {isRead ? (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Mark as unread
            </>
          ) : (
            <>
              <MailOpen className="mr-2 h-4 w-4" />
              Mark as read
            </>
          )}
          <ContextMenuShortcut>U</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Pin/Unpin */}
        <ContextMenuItem onClick={handleTogglePin} disabled={loading === "pin"}>
          {isPinned ? (
            <>
              <PinOff className="mr-2 h-4 w-4" />
              Unpin
            </>
          ) : (
            <>
              <Pin className="mr-2 h-4 w-4" />
              Pin to top
            </>
          )}
        </ContextMenuItem>

        {/* Star with color submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Star className={cn("mr-2 h-4 w-4", isStarred && "fill-current text-yellow-500 dark:text-yellow-400")} />
            {isStarred ? "Change star" : "Star"}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-40">
            {STAR_COLORS.map((color) => (
              <ContextMenuItem
                key={color.key}
                onClick={() => handleToggleStar(color.key)}
              >
                <div
                  className="mr-2 h-4 w-4 rounded-full"
                  style={{ backgroundColor: color.hex }}
                />
                {color.label}
              </ContextMenuItem>
            ))}
            {isStarred && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleToggleStar()}>
                  Remove star
                </ContextMenuItem>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Snooze */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Clock className="mr-2 h-4 w-4" />
            Snooze
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {SNOOZE_OPTIONS.map((option) => (
              <ContextMenuItem
                key={option.label}
                onClick={() => handleSnooze(option.hours)}
              >
                {option.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Spam */}
        <ContextMenuItem
          onClick={handleSpam}
          disabled={loading === "spam"}
          className="text-orange-600 dark:text-orange-400 focus:text-orange-600 dark:text-orange-400 dark:focus:text-orange-400"
        >
          <AlertOctagon className="mr-2 h-4 w-4" />
          Mark as spam
          <ContextMenuShortcut>!</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default EmailContextMenu;
