"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import type { Subscription } from "@rails/actioncable";
import { getOrCreateConsumer, getWebSocketUrl } from "@/lib/websocket/consumer-singleton";

// Badge counts message from backend BadgeCountsChannel
export interface BadgeCounts {
  unread_notifications: number;
  unread_chat_messages: number;
  pending_job_proposals: number;
  pending_case_proposals: number;
  pending_bills: number;
  pending_plan_scans: number;
  unread_emails: number;
  email_by_account: Array<{ email: string; count: number }>;
}

interface BadgeCountsMessage {
  type: "badge_counts";
  counts: BadgeCounts;
}

interface UseBadgeCountsWebSocketOptions {
  enabled?: boolean;
}

interface UseBadgeCountsWebSocketResult {
  /** All badge counts from server */
  counts: BadgeCounts | null;
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Manually disconnect */
  disconnect: () => void;
  /** Manually reconnect (resets failure state) */
  reconnect: () => void;
}

const MAX_FAILURES = 5;
const FAILURE_RESET_MS = 60000;

/**
 * Hook for real-time badge counts via WebSocket (BadgeCountsChannel)
 *
 * Replaces 7 HTTP polling endpoints with a single WebSocket subscription.
 * Server broadcasts counts every 30s + sends initial counts on subscribe.
 *
 * FRC (Feb 2026): 8 polls/30-60s per tab caused R14 memory on Basic web dyno.
 */
export function useBadgeCountsWebSocket(
  options: UseBadgeCountsWebSocketOptions = {}
): UseBadgeCountsWebSocketResult {
  const { enabled = true } = options;

  const [counts, setCounts] = useState<BadgeCounts | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const subscriptionRef = useRef<Subscription | null>(null);
  const failureCountRef = useRef(0);
  const lastFailureTimeRef = useRef(0);
  const isDisabledRef = useRef(false);

  // Memoize WS URL so it doesn't change between renders
  const wsUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_WS_URL || getWebSocketUrl();
  }, []);

  // Handle incoming messages - stable callback (no deps)
  const handleReceived = useCallback((data: BadgeCountsMessage) => {
    if (data.type === "badge_counts" && data.counts) {
      setCounts(data.counts);
    }
  }, []);

  // Track connection failure
  const trackFailure = useCallback(() => {
    const now = Date.now();
    if (now - lastFailureTimeRef.current > FAILURE_RESET_MS) {
      failureCountRef.current = 0;
    }
    failureCountRef.current++;
    lastFailureTimeRef.current = now;

    if (failureCountRef.current >= MAX_FAILURES) {
      isDisabledRef.current = true;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled || isDisabledRef.current || subscriptionRef.current) return;

    try {
      const consumer = getOrCreateConsumer(wsUrl);

      subscriptionRef.current = consumer.subscriptions.create(
        { channel: "BadgeCountsChannel" },
        {
          connected() {
            setIsConnected(true);
            failureCountRef.current = 0;
          },
          disconnected() {
            setIsConnected(false);
            trackFailure();
          },
          rejected() {
            setIsConnected(false);
            trackFailure();
          },
          received: handleReceived,
        }
      );
    } catch (error) {
      console.error("[BadgeCountsWebSocket] Failed to connect:", error);
      trackFailure();
    }
  }, [enabled, wsUrl, handleReceived, trackFailure]);

  // Disconnect (unsubscribe only, keep global consumer alive)
  const disconnect = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Reconnect (resets disabled state for manual retry)
  const reconnect = useCallback(() => {
    isDisabledRef.current = false;
    failureCountRef.current = 0;
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

  return { counts, isConnected, disconnect, reconnect };
}

export default useBadgeCountsWebSocket;
