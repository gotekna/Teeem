"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createConsumer, Subscription } from "@rails/actioncable";
import type { EmailListItem, EmailUserState } from "@/lib/email-types";

// WebSocket event types (matches backend EmailChannel)
export type EmailWebSocketEventType =
  | "new_email"
  | "new_emails"
  | "email_state_changed"
  | "email_deleted"
  | "sync_started"
  | "sync_completed";

export interface NewEmailEvent {
  type: "new_email";
  email: EmailListItem;
}

export interface NewEmailsEvent {
  type: "new_emails";
  emails: EmailListItem[];
  count: number;
}

export interface EmailStateChangedEvent {
  type: "email_state_changed";
  email_id: number;
  changes: Partial<EmailUserState>;
}

export interface EmailDeletedEvent {
  type: "email_deleted";
  email_id: number;
}

export interface SyncStartedEvent {
  type: "sync_started";
  sync_type: "incremental" | "full";
  started_at: string;
}

export interface SyncCompletedEvent {
  type: "sync_completed";
  stats: {
    new_count: number;
    updated_count: number;
    duration_seconds: number;
  };
  completed_at: string;
}

export type EmailWebSocketEvent =
  | NewEmailEvent
  | NewEmailsEvent
  | EmailStateChangedEvent
  | EmailDeletedEvent
  | SyncStartedEvent
  | SyncCompletedEvent;

interface UseEmailWebSocketOptions {
  /**
   * Called when a new email is received
   */
  onNewEmail?: (email: EmailListItem) => void;

  /**
   * Called when multiple new emails are received (batch sync)
   */
  onNewEmails?: (emails: EmailListItem[], count: number) => void;

  /**
   * Called when an email's state changes (read, starred, etc.)
   */
  onStateChange?: (emailId: number, changes: Partial<EmailUserState>) => void;

  /**
   * Called when an email is deleted
   */
  onEmailDeleted?: (emailId: number) => void;

  /**
   * Called when a sync starts
   */
  onSyncStarted?: (syncType: "incremental" | "full") => void;

  /**
   * Called when a sync completes
   */
  onSyncCompleted?: (stats: SyncCompletedEvent["stats"]) => void;

  /**
   * Whether the WebSocket connection should be enabled
   * @default true
   */
  enabled?: boolean;
}

interface UseEmailWebSocketResult {
  /**
   * Whether the WebSocket is currently connected
   */
  isConnected: boolean;

  /**
   * Whether a sync is currently in progress
   */
  isSyncing: boolean;

  /**
   * Total number of new emails received in this session
   */
  newEmailCount: number;

  /**
   * Manually disconnect from the WebSocket
   */
  disconnect: () => void;

  /**
   * Manually reconnect to the WebSocket
   */
  reconnect: () => void;
}

/**
 * Hook for real-time email updates via WebSocket
 *
 * Connects to the Rails ActionCable EmailChannel and receives:
 * - New emails as they are synced
 * - State changes (read, starred, pinned, etc.)
 * - Email deletions
 * - Sync status updates
 *
 * @example
 * ```tsx
 * const { isConnected, isSyncing } = useEmailWebSocket({
 *   onNewEmail: (email) => {
 *     setEmails(prev => [email, ...prev]);
 *   },
 *   onStateChange: (emailId, changes) => {
 *     setEmails(prev => prev.map(e =>
 *       e.id === emailId ? { ...e, user_state: { ...e.user_state, ...changes } } : e
 *     ));
 *   },
 * });
 * ```
 */
export function useEmailWebSocket(
  options: UseEmailWebSocketOptions = {}
): UseEmailWebSocketResult {
  const {
    onNewEmail,
    onNewEmails,
    onStateChange,
    onEmailDeleted,
    onSyncStarted,
    onSyncCompleted,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newEmailCount, setNewEmailCount] = useState(0);

  const subscriptionRef = useRef<Subscription | null>(null);
  const consumerRef = useRef<ReturnType<typeof createConsumer> | null>(null);

  // Handle incoming WebSocket messages
  const handleReceived = useCallback(
    (data: EmailWebSocketEvent) => {
      switch (data.type) {
        case "new_email":
          setNewEmailCount((prev) => prev + 1);
          onNewEmail?.(data.email);
          break;

        case "new_emails":
          setNewEmailCount((prev) => prev + data.count);
          onNewEmails?.(data.emails, data.count);
          break;

        case "email_state_changed":
          onStateChange?.(data.email_id, data.changes);
          break;

        case "email_deleted":
          onEmailDeleted?.(data.email_id);
          break;

        case "sync_started":
          setIsSyncing(true);
          onSyncStarted?.(data.sync_type);
          break;

        case "sync_completed":
          setIsSyncing(false);
          onSyncCompleted?.(data.stats);
          break;
      }
    },
    [onNewEmail, onNewEmails, onStateChange, onEmailDeleted, onSyncStarted, onSyncCompleted]
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled) return;
    if (subscriptionRef.current) return; // Already connected

    // Get the WebSocket URL from environment or construct from API URL
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || getWebSocketUrl();

    try {
      consumerRef.current = createConsumer(wsUrl);

      subscriptionRef.current = consumerRef.current.subscriptions.create(
        { channel: "EmailChannel" },
        {
          connected() {
            setIsConnected(true);
            console.log("[EmailWebSocket] Connected");
          },
          disconnected() {
            setIsConnected(false);
            setIsSyncing(false);
            console.log("[EmailWebSocket] Disconnected");
          },
          rejected() {
            setIsConnected(false);
            console.warn("[EmailWebSocket] Connection rejected");
          },
          received: handleReceived,
        }
      );
    } catch (error) {
      console.error("[EmailWebSocket] Failed to connect:", error);
    }
  }, [enabled, handleReceived]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    if (consumerRef.current) {
      consumerRef.current.disconnect();
      consumerRef.current = null;
    }
    setIsConnected(false);
    setIsSyncing(false);
  }, []);

  // Reconnect
  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [disconnect, connect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    isSyncing,
    newEmailCount,
    disconnect,
    reconnect,
  };
}

/**
 * Construct WebSocket URL from API URL
 * Converts http(s)://host/api to ws(s)://host/cable
 * Includes auth token as query param for iOS Safari/mobile support
 */
function getWebSocketUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const url = new URL(apiUrl);

  // Convert http to ws, https to wss
  url.protocol = url.protocol.replace("http", "ws");

  // Change path to /cable (ActionCable default)
  url.pathname = "/cable";

  // Add auth token as query parameter (iOS Safari can't send headers on WebSocket)
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      url.searchParams.set("token", token);
    }
  }

  return url.toString();
}

export default useEmailWebSocket;
