"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

/**
 * Microsoft 365 status response from /api/v1/microsoft/status
 */
interface MicrosoftStatus {
  connected: boolean;
  email?: string;
  status: string;
  expires_at?: string;
  needs_refresh: boolean;
  needs_reconnect: boolean;
  refresh_token_dead: boolean;
  reconnect_reason?: string;
  can_auto_reconnect: boolean;
  consecutive_failures?: number;
  last_refresh_attempt_at?: string;
  sync_error?: string;
}

interface AutoReconnectOptions {
  /** Enable/disable the auto-reconnect feature. Default: true */
  enabled?: boolean;
  /** Max auto-reconnect attempts before giving up. Default: 1 */
  maxAttempts?: number;
  /** Callback when auto-reconnect starts */
  onReconnectStart?: () => void;
  /** Callback when auto-reconnect succeeds */
  onReconnectSuccess?: (email: string) => void;
  /** Callback when auto-reconnect fails */
  onReconnectFailure?: (error: string) => void;
  /** Callback when status changes */
  onStatusChange?: (status: MicrosoftStatus | null) => void;
}

interface AutoReconnectResult {
  /** Whether auto-reconnect is currently in progress */
  isReconnecting: boolean;
  /** Number of reconnect attempts made */
  attemptCount: number;
  /** Current Microsoft status */
  status: MicrosoftStatus | null;
  /** Manually trigger reconnection */
  triggerReconnect: () => Promise<void>;
  /** Refresh the status manually */
  refreshStatus: () => Promise<MicrosoftStatus | null>;
}

/**
 * Hook for automatic Microsoft 365 reconnection.
 *
 * When the Microsoft refresh token is dead (expired/revoked), this hook
 * automatically opens an OAuth popup to reconnect the user.
 *
 * The backend already supports popup OAuth - it sends a postMessage on
 * completion and auto-closes the popup.
 */
export function useMicrosoftAutoReconnect(
  options: AutoReconnectOptions = {}
): AutoReconnectResult {
  const {
    enabled = true,
    maxAttempts = 1,
    onReconnectStart,
    onReconnectSuccess,
    onReconnectFailure,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<MicrosoftStatus | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const attemptCountRef = useRef(0);
  const popupRef = useRef<Window | null>(null);
  const lastAttemptTimeRef = useRef<number>(0);
  const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes between auto-reconnect attempts

  // Update status and notify
  const updateStatus = useCallback(
    (newStatus: MicrosoftStatus | null) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  // Handle messages from OAuth popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only handle microsoft-oauth-callback messages
      if (event.data?.type !== "microsoft-oauth-callback") return;

      setIsReconnecting(false);

      if (event.data.success) {
        attemptCountRef.current = 0;
        onReconnectSuccess?.(event.data.email || "");
        toast({
          title: "Microsoft 365 Reconnected",
          description: event.data.email
            ? `Connected as ${event.data.email}`
            : "Successfully reconnected",
          variant: "default",
        });
        // Refresh status after reconnect
        refreshStatus();
      } else {
        onReconnectFailure?.(event.data.error || "Unknown error");
        toast({
          title: "Reconnection Failed",
          description: event.data.error || "Please try again manually",
          variant: "destructive",
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onReconnectSuccess, onReconnectFailure]);

  // Refresh status from API
  const refreshStatus = useCallback(async () => {
    try {
      const response = await api.get<MicrosoftStatus>("/api/v1/microsoft/status");
      updateStatus(response);
      return response;
    } catch {
      // Silently fail - user might not have Microsoft connected
      updateStatus(null);
      return null;
    }
  }, [updateStatus]);

  // Attempt auto-reconnect via popup
  const attemptAutoReconnect = useCallback(async () => {
    if (isReconnecting) return;

    // Rate limiting: Don't attempt if we tried recently (within last 5 minutes)
    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttemptTimeRef.current;
    if (timeSinceLastAttempt < RATE_LIMIT_MS) {
      console.info(`[MicrosoftAutoReconnect] Rate limited - last attempt ${Math.round(timeSinceLastAttempt / 1000)}s ago`);
      return;
    }

    try {
      // Get auth URL from backend
      const { url } = await api.get<{ url: string }>("/api/v1/microsoft/auth_url");

      if (!url) {
        console.error("[MicrosoftAutoReconnect] No auth URL received");
        return;
      }

      setIsReconnecting(true);
      lastAttemptTimeRef.current = now; // Record attempt time
      attemptCountRef.current++;
      onReconnectStart?.();

      // Open OAuth popup (500x600 centered)
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      popupRef.current = window.open(
        url,
        "microsoft-oauth-popup",
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );

      // Handle popup blocked
      if (!popupRef.current || popupRef.current.closed) {
        setIsReconnecting(false);
        onReconnectFailure?.("Popup blocked");
        toast({
          title: "Popup Blocked",
          description:
            "Please allow popups for this site, or reconnect manually in Settings",
          variant: "destructive",
        });
        return;
      }

      // Monitor popup for close (user cancelled)
      const checkClosed = setInterval(() => {
        if (popupRef.current?.closed) {
          clearInterval(checkClosed);
          // Only treat as user-cancelled if we haven't received success message
          if (isReconnecting) {
            setIsReconnecting(false);
            // Don't show error - user may have cancelled intentionally
          }
        }
      }, 500);

      // Cleanup interval after 5 minutes (timeout safety)
      setTimeout(() => clearInterval(checkClosed), 5 * 60 * 1000);
    } catch (error) {
      setIsReconnecting(false);
      console.error("[MicrosoftAutoReconnect] Failed to initiate reconnect:", error);
    }
  }, [isReconnecting, maxAttempts, onReconnectStart, onReconnectFailure]);

  // Manual trigger for reconnect
  const triggerReconnect = useCallback(async () => {
    // Reset rate limit for manual trigger (allow immediate retry)
    attemptCountRef.current = 0;
    lastAttemptTimeRef.current = 0;
    await attemptAutoReconnect();
  }, [attemptAutoReconnect]);

  // Check status and auto-reconnect if needed
  useEffect(() => {
    if (!enabled) return;

    const checkAndAutoReconnect = async () => {
      const currentStatus = await refreshStatus();

      // Auto-reconnect conditions:
      // 1. needs_reconnect is true
      // 2. refresh_token_dead is true (not a transient error)
      // 3. can_auto_reconnect is true (backend has OAuth configured)
      // 4. Not already reconnecting
      // 5. Rate limit allows retry (checked inside attemptAutoReconnect)
      if (
        currentStatus?.needs_reconnect &&
        currentStatus?.refresh_token_dead &&
        currentStatus?.can_auto_reconnect &&
        !isReconnecting
      ) {
        console.info("[MicrosoftAutoReconnect] Auto-reconnecting...");
        attemptAutoReconnect();
      }
    };

    // Initial check
    checkAndAutoReconnect();

    // CONTINUOUS HEALING: Poll every 30 seconds to catch issues proactively
    // This ensures we heal BEFORE the user ever sees orange
    const interval = setInterval(checkAndAutoReconnect, 30000);

    return () => clearInterval(interval);
  }, [enabled, isReconnecting, refreshStatus, attemptAutoReconnect]);

  return {
    isReconnecting,
    attemptCount: attemptCountRef.current,
    status,
    triggerReconnect,
    refreshStatus,
  };
}
