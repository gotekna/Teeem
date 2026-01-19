"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { createConsumer, Subscription } from "@rails/actioncable";
import { getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

// Singleton ActionCable consumer to prevent multiple connections
let globalConsumer: ReturnType<typeof createConsumer> | null = null;
let globalConsumerUrl: string | null = null;

function getOrCreateConsumer(wsUrl: string): ReturnType<typeof createConsumer> {
  if (globalConsumer && globalConsumerUrl === wsUrl) {
    return globalConsumer;
  }

  if (globalConsumer) {
    globalConsumer.disconnect();
  }

  globalConsumer = createConsumer(wsUrl);
  globalConsumerUrl = wsUrl;
  return globalConsumer;
}

// WebSocket event types (matches backend LocationChannel)
export type LocationWebSocketEventType =
  | "location_update"
  | "geofence_exit"
  | "geofence_enter"
  | "worker_checkin"
  | "worker_checkout";

export interface WorkerLocation {
  workerId: number;
  workerName: string;
  sessionId: number;
  jobId: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  withinGeofence: boolean;
  distanceFromSite?: number;
  recordedAt: string;
}

export interface LocationUpdateEvent {
  type: "location_update";
  worker_id: number;
  worker_name: string;
  session_id: number;
  job_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  within_geofence: boolean;
  distance_from_site?: number;
  recorded_at: string;
  timestamp: string;
}

export interface GeofenceEvent {
  type: "geofence_exit" | "geofence_enter";
  event_id: number;
  worker_id: number;
  worker_name: string;
  session_id: number;
  job_id: number;
  job_name: string;
  latitude: number;
  longitude: number;
  distance_from_site?: number;
  detected_at: string;
  timestamp: string;
}

export interface WorkerCheckinEvent {
  type: "worker_checkin";
  session_id: number;
  worker_id: number;
  worker_name: string;
  job_id: number;
  job_name: string;
  checkin_at: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface WorkerCheckoutEvent {
  type: "worker_checkout";
  session_id: number;
  worker_id: number;
  worker_name: string;
  job_id: number;
  job_name: string;
  checkin_at: string;
  checkout_at: string;
  total_hours: number;
  timestamp: string;
}

export type LocationWebSocketEvent =
  | LocationUpdateEvent
  | GeofenceEvent
  | WorkerCheckinEvent
  | WorkerCheckoutEvent;

interface UseLocationWebSocketOptions {
  /**
   * Called when a worker's location is updated
   */
  onLocationUpdate?: (location: WorkerLocation) => void;

  /**
   * Called when a worker exits a geofence
   */
  onGeofenceExit?: (event: GeofenceEvent) => void;

  /**
   * Called when a worker enters a geofence
   */
  onGeofenceEnter?: (event: GeofenceEvent) => void;

  /**
   * Called when a worker checks in
   */
  onWorkerCheckin?: (event: WorkerCheckinEvent) => void;

  /**
   * Called when a worker checks out
   */
  onWorkerCheckout?: (event: WorkerCheckoutEvent) => void;

  /**
   * Whether the WebSocket connection should be enabled
   * @default true
   */
  enabled?: boolean;
}

interface UseLocationWebSocketResult {
  /**
   * Whether the WebSocket is currently connected
   */
  isConnected: boolean;

  /**
   * Map of active worker locations by worker ID
   */
  activeWorkers: Map<number, WorkerLocation>;

  /**
   * Recent geofence events
   */
  geofenceEvents: GeofenceEvent[];

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
 * Hook for real-time worker location updates via WebSocket
 *
 * Connects to the Rails ActionCable LocationChannel and receives:
 * - Location updates from workers
 * - Geofence exit/enter events
 * - Worker check-in/check-out events
 *
 * @example
 * ```tsx
 * const { isConnected, activeWorkers, geofenceEvents } = useLocationWebSocket({
 *   onGeofenceExit: (event) => {
 *     toast.error(`${event.worker_name} left ${event.job_name} site!`);
 *   },
 * });
 * ```
 */
export function useLocationWebSocket(
  options: UseLocationWebSocketOptions = {}
): UseLocationWebSocketResult {
  const {
    onLocationUpdate,
    onGeofenceExit,
    onGeofenceEnter,
    onWorkerCheckin,
    onWorkerCheckout,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [activeWorkers, setActiveWorkers] = useState<Map<number, WorkerLocation>>(new Map());
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEvent[]>([]);

  const subscriptionRef = useRef<Subscription | null>(null);
  const failureCountRef = useRef(0);
  const lastFailureTimeRef = useRef(0);
  const isDisabledRef = useRef(false);

  // Store callbacks in refs so they don't cause reconnections
  const callbacksRef = useRef({
    onLocationUpdate,
    onGeofenceExit,
    onGeofenceEnter,
    onWorkerCheckin,
    onWorkerCheckout,
  });

  useEffect(() => {
    callbacksRef.current = {
      onLocationUpdate,
      onGeofenceExit,
      onGeofenceEnter,
      onWorkerCheckin,
      onWorkerCheckout,
    };
  });

  const MAX_FAILURES = 5;
  const FAILURE_RESET_MS = 60000;
  const MAX_GEOFENCE_EVENTS = 50;

  const wsUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_WS_URL || getWebSocketUrl();
  }, []);

  // Handle incoming WebSocket messages
  const handleReceived = useCallback(
    (data: LocationWebSocketEvent) => {
      const callbacks = callbacksRef.current;

      switch (data.type) {
        case "location_update": {
          const location: WorkerLocation = {
            workerId: data.worker_id,
            workerName: data.worker_name,
            sessionId: data.session_id,
            jobId: data.job_id,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            withinGeofence: data.within_geofence,
            distanceFromSite: data.distance_from_site,
            recordedAt: data.recorded_at,
          };
          setActiveWorkers((prev) => new Map(prev).set(data.worker_id, location));
          callbacks.onLocationUpdate?.(location);
          break;
        }

        case "geofence_exit":
          setGeofenceEvents((prev) => [data, ...prev].slice(0, MAX_GEOFENCE_EVENTS));
          callbacks.onGeofenceExit?.(data);
          break;

        case "geofence_enter":
          setGeofenceEvents((prev) => [data, ...prev].slice(0, MAX_GEOFENCE_EVENTS));
          callbacks.onGeofenceEnter?.(data);
          break;

        case "worker_checkin": {
          const location: WorkerLocation = {
            workerId: data.worker_id,
            workerName: data.worker_name,
            sessionId: data.session_id,
            jobId: data.job_id,
            latitude: data.latitude,
            longitude: data.longitude,
            withinGeofence: true,
            recordedAt: data.checkin_at,
          };
          setActiveWorkers((prev) => new Map(prev).set(data.worker_id, location));
          callbacks.onWorkerCheckin?.(data);
          break;
        }

        case "worker_checkout":
          setActiveWorkers((prev) => {
            const updated = new Map(prev);
            updated.delete(data.worker_id);
            return updated;
          });
          callbacks.onWorkerCheckout?.(data);
          break;
      }
    },
    []
  );

  const trackFailure = useCallback(() => {
    const now = Date.now();

    if (now - lastFailureTimeRef.current > FAILURE_RESET_MS) {
      failureCountRef.current = 0;
    }

    failureCountRef.current++;
    lastFailureTimeRef.current = now;

    if (failureCountRef.current >= MAX_FAILURES) {
      console.warn(`[LocationWebSocket] Too many failures (${failureCountRef.current}), disabling`);
      isDisabledRef.current = true;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled) return;
    if (isDisabledRef.current) {
      console.log("[LocationWebSocket] Disabled due to repeated failures");
      return;
    }
    if (subscriptionRef.current) return;

    try {
      const consumer = getOrCreateConsumer(wsUrl);

      subscriptionRef.current = consumer.subscriptions.create(
        { channel: "LocationChannel" },
        {
          connected() {
            setIsConnected(true);
            failureCountRef.current = 0;
            console.log("[LocationWebSocket] Connected");
          },
          disconnected() {
            setIsConnected(false);
            trackFailure();
            console.log("[LocationWebSocket] Disconnected");
          },
          rejected() {
            setIsConnected(false);
            trackFailure();
            console.warn("[LocationWebSocket] Connection rejected - ensure you have supervisor/manager access");
          },
          received: handleReceived,
        }
      );
    } catch (error) {
      console.error("[LocationWebSocket] Failed to connect:", error);
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
    activeWorkers,
    geofenceEvents,
    disconnect,
    reconnect,
  };
}

function getWebSocketUrl(): string {
  const apiUrl = getApiBaseUrl();
  const url = new URL(apiUrl);

  url.protocol = url.protocol.replace("http", "ws");
  url.pathname = "/cable";

  if (typeof window !== "undefined") {
    const token = getStorageItem(STORAGE_KEYS.TOKEN, null);
    if (token) {
      url.searchParams.set("token", token);
    }
  }

  return url.toString();
}

export default useLocationWebSocket;
