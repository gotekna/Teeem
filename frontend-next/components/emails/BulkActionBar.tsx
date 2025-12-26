"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Archive,
  Star,
  Pin,
  Mail,
  MailOpen,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulkActionBarProps {
  /** Number of selected emails */
  selectedCount: number;
  /** Total number of emails in current view */
  totalCount: number;
  /** Whether all emails are selected */
  allSelected: boolean;
  /** Toggle select all */
  onToggleSelectAll: () => void;
  /** Clear selection */
  onClear: () => void;
  /** Bulk archive action */
  onArchive: () => void;
  /** Bulk star action */
  onStar: () => void;
  /** Bulk pin action */
  onPin: () => void;
  /** Bulk mark as read action */
  onMarkRead: () => void;
  /** Bulk mark as unread action */
  onMarkUnread: () => void;
  /** Whether a bulk action is in progress */
  isLoading?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Bulk action bar that appears when emails are selected
 *
 * Shows selection count and action buttons for:
 * - Archive
 * - Star
 * - Pin
 * - Mark Read/Unread
 * - Clear selection
 */
export function BulkActionBar({
  selectedCount,
  totalCount,
  allSelected,
  onToggleSelectAll,
  onClear,
  onArchive,
  onStar,
  onPin,
  onMarkRead,
  onMarkUnread,
  isLoading = false,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 bg-muted/50 border-b",
        "animate-in slide-in-from-top-2 duration-200",
        className
      )}
    >
      {/* Select all checkbox */}
      <Checkbox
        checked={allSelected}
        onCheckedChange={onToggleSelectAll}
        disabled={isLoading}
      />

      {/* Selection count */}
      <span className="text-sm font-medium">
        {selectedCount} selected
        {totalCount > 0 && (
          <span className="text-muted-foreground ml-1">
            of {totalCount}
          </span>
        )}
      </span>

      {/* Divider */}
      <div className="h-4 w-px bg-border mx-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onArchive}
          disabled={isLoading}
          className="h-7 px-2 text-xs"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Archive className="h-3.5 w-3.5" />
          )}
          <span className="ml-1 hidden sm:inline">Archive</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onStar}
          disabled={isLoading}
          className="h-7 px-2 text-xs"
        >
          <Star className="h-3.5 w-3.5" />
          <span className="ml-1 hidden sm:inline">Star</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onPin}
          disabled={isLoading}
          className="h-7 px-2 text-xs"
        >
          <Pin className="h-3.5 w-3.5" />
          <span className="ml-1 hidden sm:inline">Pin</span>
        </Button>

        {/* Divider */}
        <div className="h-4 w-px bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkRead}
          disabled={isLoading}
          className="h-7 px-2 text-xs"
        >
          <MailOpen className="h-3.5 w-3.5" />
          <span className="ml-1 hidden sm:inline">Read</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkUnread}
          disabled={isLoading}
          className="h-7 px-2 text-xs"
        >
          <Mail className="h-3.5 w-3.5" />
          <span className="ml-1 hidden sm:inline">Unread</span>
        </Button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clear button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        disabled={isLoading}
        className="h-7 px-2 text-xs"
      >
        <X className="h-3.5 w-3.5" />
        <span className="ml-1">Clear</span>
      </Button>
    </div>
  );
}

export default BulkActionBar;
