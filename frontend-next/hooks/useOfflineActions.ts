"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import {
  emailCache,
  isIndexedDBAvailable,
  OfflineAction,
  OfflineActionType,
} from "@/lib/email-cache";
import { useNetworkStatus } from "./useNetworkStatus";

// =============================================================================
// Types
// =============================================================================

interface UseOfflineActionsResult {
  /**
   * Number of pending offline actions.
   */
  pendingCount: number;

  /**
   * Whether actions are currently being processed.
   */
  isProcessing: boolean;

  /**
   * Queue an action for offline processing.
   * Applies optimistic update to cache immediately.
   */
  queueAction: (
    action: OfflineActionType,
    emailId: number,
    payload?: Record<string, unknown>
  ) => Promise<void>;

  /**
   * Process all pending actions (called automatically on reconnect).
   */
  processQueue: () => Promise<ProcessResult>;

  /**
   * Get all pending actions.
   */
  getPendingActions: () => Promise<OfflineAction[]>;

  /**
   * Clear all pending actions without processing.
   */
  clearQueue: () => Promise<void>;
}

interface ProcessResult {
  processed: number;
  failed: number;
  errors: string[];
}

// Action to API endpoint mapping
const ACTION_ENDPOINTS: Record<OfflineActionType, { method: "PATCH"; field: string; value: boolean }> = {
  mark_read: { method: "PATCH", field: "is_read", value: true },
  mark_unread: { method: "PATCH", field: "is_read", value: false },
  star: { method: "PATCH", field: "is_starred", value: true },
  unstar: { method: "PATCH", field: "is_starred", value: false },
  pin: { method: "PATCH", field: "is_pinned", value: true },
  unpin: { method: "PATCH", field: "is_pinned", value: false },
  archive: { method: "PATCH", field: "is_archived", value: true },
  unarchive: { method: "PATCH", field: "is_archived", value: false },
};

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing offline email actions.
 *
 * Features:
 * - Queue actions when offline
 * - Optimistic UI updates via cache
 * - Auto-process queue when back online
 * - Retry failed actions
 *
 * @example
 * ```tsx
 * const { queueAction, pendingCount, isProcessing } = useOfflineActions();
 *
 * // Star an email (works offline)
 * await queueAction('star', emailId);
 *
 * // Show pending count
 * {pendingCount > 0 && <Badge>{pendingCount} pending</Badge>}
 * ```
 */
export function useOfflineActions(): UseOfflineActionsResult {
  const [pendingCount, setPendingCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const { isOnline, wasOffline } = useNetworkStatus();
  const processingRef = useRef(false);

  // Load pending count on mount
  useEffect(() => {
    if (!isIndexedDBAvailable()) return;

    emailCache.getPendingActionCount().then(setPendingCount);
  }, []);

  // Process queue when coming back online
  useEffect(() => {
    if (wasOffline && isOnline) {
      console.log("[OfflineActions] Back online - processing queue");
      processQueue();
    }
  }, [wasOffline, isOnline]);

  // Queue an action
  const queueAction = useCallback(
    async (
      action: OfflineActionType,
      emailId: number,
      payload?: Record<string, unknown>
    ): Promise<void> => {
      if (!isIndexedDBAvailable()) {
        // Fallback: just make the API call directly
        if (isOnline) {
          await executeAction(action, emailId, payload);
        }
        return;
      }

      const actionConfig = ACTION_ENDPOINTS[action];

      // 1. Optimistic update to cache
      try {
        await emailCache.updateEmail(emailId, {
          [actionConfig.field]: actionConfig.value,
        });
      } catch (err) {
        console.error("[OfflineActions] Failed to update cache:", err);
      }

      // 2. If online, execute immediately
      if (isOnline) {
        try {
          await executeAction(action, emailId, payload);
          return; // Success - no need to queue
        } catch (err) {
          console.error("[OfflineActions] API call failed, queuing:", err);
          // Fall through to queue the action
        }
      }

      // 3. Queue for later processing
      try {
        await emailCache.queueOfflineAction(action, emailId, payload);
        const count = await emailCache.getPendingActionCount();
        setPendingCount(count);
        console.log(`[OfflineActions] Queued ${action} for email ${emailId}`);
      } catch (err) {
        console.error("[OfflineActions] Failed to queue action:", err);
      }
    },
    [isOnline]
  );

  // Process all pending actions
  const processQueue = useCallback(async (): Promise<ProcessResult> => {
    const result: ProcessResult = {
      processed: 0,
      failed: 0,
      errors: [],
    };

    if (!isIndexedDBAvailable() || processingRef.current) {
      return result;
    }

    processingRef.current = true;
    setIsProcessing(true);

    try {
      const actions = await emailCache.getPendingActions();

      for (const action of actions) {
        try {
          await executeAction(action.action, action.emailId, action.payload);
          await emailCache.removeOfflineAction(action.id);
          result.processed++;
        } catch (err) {
          result.failed++;
          result.errors.push(
            `${action.action} on ${action.emailId}: ${err instanceof Error ? err.message : "Unknown"}`
          );

          // Update retry count
          await emailCache.updateOfflineAction(action.id, {
            retries: action.retries + 1,
            lastError: err instanceof Error ? err.message : "Unknown error",
          });

          // Remove if too many retries
          if (action.retries >= 3) {
            console.warn(
              `[OfflineActions] Removing failed action after 3 retries:`,
              action
            );
            await emailCache.removeOfflineAction(action.id);
          }
        }
      }

      // Update pending count
      const count = await emailCache.getPendingActionCount();
      setPendingCount(count);

      console.log(
        `[OfflineActions] Processed: ${result.processed}, Failed: ${result.failed}`
      );
    } catch (err) {
      console.error("[OfflineActions] Queue processing failed:", err);
      result.errors.push(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }

    return result;
  }, []);

  // Get pending actions
  const getPendingActions = useCallback(async (): Promise<OfflineAction[]> => {
    if (!isIndexedDBAvailable()) return [];
    return emailCache.getPendingActions();
  }, []);

  // Clear queue
  const clearQueue = useCallback(async (): Promise<void> => {
    if (!isIndexedDBAvailable()) return;
    await emailCache.clearOfflineActions();
    setPendingCount(0);
  }, []);

  return {
    pendingCount,
    isProcessing,
    queueAction,
    processQueue,
    getPendingActions,
    clearQueue,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Execute a single action against the API.
 */
async function executeAction(
  action: OfflineActionType,
  emailId: number,
  payload?: Record<string, unknown>
): Promise<void> {
  const actionConfig = ACTION_ENDPOINTS[action];

  await api.patch(`/api/v1/email_user_states/${emailId}`, {
    [actionConfig.field]: actionConfig.value,
    ...payload,
  });
}

export default useOfflineActions;
