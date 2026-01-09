"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

export type BulkActionType =
  | "pin"
  | "unpin"
  | "star"
  | "unstar"
  | "archive"
  | "unarchive"
  | "mark_read"
  | "mark_unread";

interface BulkActionResponse {
  success: boolean;
  affected_count?: number;
  message?: string;
  error?: string;
}

export interface UseEmailBulkActionsProps {
  /** Set of selected email IDs */
  selectedIds: Set<number>;
  /** Callback after successful action (e.g., refresh list, clear selection) */
  onSuccess?: () => void;
}

export interface UseEmailBulkActionsReturn {
  /** Archive all selected emails */
  bulkArchive: () => Promise<void>;
  /** Unarchive all selected emails */
  bulkUnarchive: () => Promise<void>;
  /** Star all selected emails */
  bulkStar: () => Promise<void>;
  /** Unstar all selected emails */
  bulkUnstar: () => Promise<void>;
  /** Pin all selected emails */
  bulkPin: () => Promise<void>;
  /** Unpin all selected emails */
  bulkUnpin: () => Promise<void>;
  /** Mark all selected emails as read */
  bulkMarkRead: () => Promise<void>;
  /** Mark all selected emails as unread */
  bulkMarkUnread: () => Promise<void>;
  /** Whether a bulk action is in progress */
  isLoading: boolean;
}

const ACTION_LABELS: Record<BulkActionType, string> = {
  pin: "Pinned",
  unpin: "Unpinned",
  star: "Starred",
  unstar: "Unstarred",
  archive: "Archived",
  unarchive: "Unarchived",
  mark_read: "Marked as read",
  mark_unread: "Marked as unread",
};

/**
 * Hook for performing bulk actions on selected emails
 *
 * Usage:
 * const { bulkArchive, bulkStar, isLoading } = useEmailBulkActions({
 *   selectedIds,
 *   onSuccess: () => {
 *     clearSelection();
 *     refreshEmails();
 *   }
 * });
 */
export function useEmailBulkActions({
  selectedIds,
  onSuccess,
}: UseEmailBulkActionsProps): UseEmailBulkActionsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const performBulkAction = useCallback(
    async (actionType: BulkActionType) => {
      if (selectedIds.size === 0) {
        toast({
          title: "No emails selected",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);
      try {
        const response = await api.post<BulkActionResponse>(
          "/api/v1/email_user_states/bulk_action",
          {
            email_ids: Array.from(selectedIds),
            action_type: actionType,
          }
        );

        if (response && response.success) {
          const count = response.affected_count || selectedIds.size;
          toast({
            title: `${ACTION_LABELS[actionType]} ${count} email${count !== 1 ? "s" : ""}`,
          });
          onSuccess?.();
        } else {
          throw new Error(response?.error || "Bulk action failed");
        }
      } catch (error) {
        console.error("Bulk action error:", error);
        toast({
          title: "Action failed",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [selectedIds, onSuccess, toast]
  );

  const bulkArchive = useCallback(
    () => performBulkAction("archive"),
    [performBulkAction]
  );

  const bulkUnarchive = useCallback(
    () => performBulkAction("unarchive"),
    [performBulkAction]
  );

  const bulkStar = useCallback(
    () => performBulkAction("star"),
    [performBulkAction]
  );

  const bulkUnstar = useCallback(
    () => performBulkAction("unstar"),
    [performBulkAction]
  );

  const bulkPin = useCallback(
    () => performBulkAction("pin"),
    [performBulkAction]
  );

  const bulkUnpin = useCallback(
    () => performBulkAction("unpin"),
    [performBulkAction]
  );

  const bulkMarkRead = useCallback(
    () => performBulkAction("mark_read"),
    [performBulkAction]
  );

  const bulkMarkUnread = useCallback(
    () => performBulkAction("mark_unread"),
    [performBulkAction]
  );

  return {
    bulkArchive,
    bulkUnarchive,
    bulkStar,
    bulkUnstar,
    bulkPin,
    bulkUnpin,
    bulkMarkRead,
    bulkMarkUnread,
    isLoading,
  };
}

export default useEmailBulkActions;
