/**
 * WebSocket Consumer Singleton
 *
 * SSoT for ActionCable WebSocket consumer.
 * Prevents multiple WebSocket connections by reusing the same consumer across hooks.
 *
 * Used by:
 * - useEmailWebSocket (EmailChannel)
 * - useLocationWebSocket (LocationChannel)
 */

import { createConsumer, Consumer } from "@rails/actioncable";
import { getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

// Singleton state
let globalConsumer: Consumer | null = null;
let globalConsumerUrl: string | null = null;

/**
 * Get or create a singleton ActionCable consumer
 *
 * Reuses existing consumer if URL matches, otherwise creates a new one.
 * This prevents multiple WebSocket connections when multiple hooks use WebSockets.
 *
 * @param wsUrl - WebSocket URL (optional, auto-generated from API URL if not provided)
 * @returns ActionCable Consumer instance
 */
export function getOrCreateConsumer(wsUrl?: string): Consumer {
  const targetUrl = wsUrl || getWebSocketUrl();

  // Reuse existing consumer if URL matches
  if (globalConsumer && globalConsumerUrl === targetUrl) {
    return globalConsumer;
  }

  // Disconnect old consumer if URL changed
  if (globalConsumer) {
    globalConsumer.disconnect();
  }

  globalConsumer = createConsumer(targetUrl);
  globalConsumerUrl = targetUrl;
  return globalConsumer;
}

/**
 * Disconnect the global consumer
 *
 * Only call this when you're sure no other components need the WebSocket.
 * Typically only needed during logout or app unmount.
 */
export function disconnectConsumer(): void {
  if (globalConsumer) {
    globalConsumer.disconnect();
    globalConsumer = null;
    globalConsumerUrl = null;
  }
}

/**
 * Check if the consumer is currently connected
 */
export function isConsumerConnected(): boolean {
  // @ts-expect-error - connection is not typed on Consumer but exists
  return globalConsumer?.connection?.isOpen?.() ?? false;
}

/**
 * Construct WebSocket URL from API URL
 *
 * Converts http(s)://host/api to ws(s)://host/cable
 * Includes auth token as query param for iOS Safari/mobile support
 * (iOS Safari can't send headers on WebSocket upgrade requests)
 */
export function getWebSocketUrl(): string {
  // SSoT: Use getApiBaseUrl from @/lib/api
  const apiUrl = getApiBaseUrl();
  const url = new URL(apiUrl);

  // Convert http to ws, https to wss
  url.protocol = url.protocol.replace("http", "ws");

  // Change path to /cable (ActionCable default)
  url.pathname = "/cable";

  // Add auth token as query parameter (iOS Safari can't send headers on WebSocket)
  if (typeof window !== "undefined") {
    const token = getStorageItem(STORAGE_KEYS.TOKEN, null);
    if (token) {
      url.searchParams.set("token", token);
    }
  }

  return url.toString();
}

export default getOrCreateConsumer;
