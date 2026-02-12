"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import type { Subscription } from "@rails/actioncable";
import { getOrCreateConsumer, getWebSocketUrl } from "@/lib/websocket/consumer-singleton";

// Message types matching backend ScreenShareChannel
export type ScreenShareMessageType =
  | "session_request"
  | "session_accepted"
  | "session_declined"
  | "sdp_offer"
  | "sdp_answer"
  | "ice_candidate"
  | "session_ended";

export interface ScreenShareMessage {
  type: ScreenShareMessageType;
  fromUserId: number;
  fromUserName: string;
  sessionId: string;
  payload?: Record<string, unknown>;
}

interface UseScreenShareWebSocketOptions {
  onSessionRequest?: (fromUserId: number, fromUserName: string, sessionId: string) => void;
  onSessionAccepted?: (fromUserId: number, sessionId: string) => void;
  onSessionDeclined?: (fromUserId: number, sessionId: string) => void;
  onSdpOffer?: (fromUserId: number, sessionId: string, sdp: RTCSessionDescriptionInit) => void;
  onSdpAnswer?: (fromUserId: number, sessionId: string, sdp: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (fromUserId: number, sessionId: string, candidate: RTCIceCandidateInit) => void;
  onSessionEnded?: (fromUserId: number, sessionId: string) => void;
  enabled?: boolean;
}

interface UseScreenShareWebSocketResult {
  isConnected: boolean;
  send: (targetUserId: number, type: ScreenShareMessageType, sessionId: string, payload?: Record<string, unknown>) => void;
  disconnect: () => void;
  reconnect: () => void;
}

/**
 * Hook for screen share signaling via WebSocket
 *
 * Pattern: Same as useEmailWebSocket (singleton consumer, callback refs, failure tracking)
 *
 * @example
 * ```tsx
 * const { isConnected, send } = useScreenShareWebSocket({
 *   onSessionRequest: (fromUserId, fromUserName, sessionId) => {
 *     // Show accept/decline prompt
 *   },
 *   onSdpOffer: (fromUserId, sessionId, sdp) => {
 *     // Handle WebRTC offer
 *   },
 * });
 *
 * // Send a session request
 * send(targetUserId, "session_request", sessionId);
 * ```
 */
export function useScreenShareWebSocket(
  options: UseScreenShareWebSocketOptions = {}
): UseScreenShareWebSocketResult {
  const {
    onSessionRequest,
    onSessionAccepted,
    onSessionDeclined,
    onSdpOffer,
    onSdpAnswer,
    onIceCandidate,
    onSessionEnded,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);

  const subscriptionRef = useRef<Subscription | null>(null);
  const failureCountRef = useRef(0);
  const lastFailureTimeRef = useRef(0);
  const isDisabledRef = useRef(false);

  // Store callbacks in refs so they don't cause reconnections
  const callbacksRef = useRef({
    onSessionRequest,
    onSessionAccepted,
    onSessionDeclined,
    onSdpOffer,
    onSdpAnswer,
    onIceCandidate,
    onSessionEnded,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSessionRequest,
      onSessionAccepted,
      onSessionDeclined,
      onSdpOffer,
      onSdpAnswer,
      onIceCandidate,
      onSessionEnded,
    };
  });

  const MAX_FAILURES = 5;
  const FAILURE_RESET_MS = 60000;

  const wsUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_WS_URL || getWebSocketUrl();
  }, []);

  const handleReceived = useCallback((data: ScreenShareMessage) => {
    const callbacks = callbacksRef.current;
    const payload = data.payload || {};

    switch (data.type) {
      case "session_request":
        callbacks.onSessionRequest?.(data.fromUserId, data.fromUserName, data.sessionId);
        break;
      case "session_accepted":
        callbacks.onSessionAccepted?.(data.fromUserId, data.sessionId);
        break;
      case "session_declined":
        callbacks.onSessionDeclined?.(data.fromUserId, data.sessionId);
        break;
      case "sdp_offer":
        callbacks.onSdpOffer?.(data.fromUserId, data.sessionId, payload.sdp as RTCSessionDescriptionInit);
        break;
      case "sdp_answer":
        callbacks.onSdpAnswer?.(data.fromUserId, data.sessionId, payload.sdp as RTCSessionDescriptionInit);
        break;
      case "ice_candidate":
        callbacks.onIceCandidate?.(data.fromUserId, data.sessionId, payload.candidate as RTCIceCandidateInit);
        break;
      case "session_ended":
        callbacks.onSessionEnded?.(data.fromUserId, data.sessionId);
        break;
    }
  }, []);

  const trackFailure = useCallback(() => {
    const now = Date.now();
    if (now - lastFailureTimeRef.current > FAILURE_RESET_MS) {
      failureCountRef.current = 0;
    }
    failureCountRef.current++;
    lastFailureTimeRef.current = now;

    if (failureCountRef.current >= MAX_FAILURES) {
      console.warn(`[ScreenShareWS] Too many failures (${failureCountRef.current}), disabling`);
      isDisabledRef.current = true;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled) return;
    if (isDisabledRef.current) return;
    if (subscriptionRef.current) return;

    try {
      const consumer = getOrCreateConsumer(wsUrl);

      subscriptionRef.current = consumer.subscriptions.create(
        { channel: "ScreenShareChannel" },
        {
          connected() {
            setIsConnected(true);
            failureCountRef.current = 0;
            console.log("[ScreenShareWS] Connected");
          },
          disconnected() {
            setIsConnected(false);
            trackFailure();
            console.log("[ScreenShareWS] Disconnected");
          },
          rejected() {
            setIsConnected(false);
            trackFailure();
            console.warn("[ScreenShareWS] Connection rejected");
          },
          received: handleReceived,
        }
      );
    } catch (error) {
      console.error("[ScreenShareWS] Failed to connect:", error);
      trackFailure();
    }
  }, [enabled, wsUrl, handleReceived, trackFailure]);

  const disconnect = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    isDisabledRef.current = false;
    failureCountRef.current = 0;
    disconnect();
    connect();
  }, [disconnect, connect]);

  /**
   * Send a signaling message to a target user via the relay
   */
  const send = useCallback(
    (
      targetUserId: number,
      type: ScreenShareMessageType,
      sessionId: string,
      payload?: Record<string, unknown>
    ) => {
      if (!subscriptionRef.current) {
        console.warn("[ScreenShareWS] Cannot send - not connected");
        return;
      }

      subscriptionRef.current.perform("relay", {
        targetUserId,
        type,
        sessionId,
        payload: payload || {},
      });
    },
    []
  );

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
    send,
    disconnect,
    reconnect,
  };
}

export default useScreenShareWebSocket;
