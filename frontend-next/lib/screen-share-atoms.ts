/**
 * Screen Share State - Jotai Atoms
 *
 * SSoT for all screen sharing state.
 * Pattern: Same as table-atoms.ts (Jotai atoms, no useState)
 */

import { atom } from "jotai";

export type ScreenShareRole = "viewer" | "sharer";

export type ScreenShareState =
  | "idle"
  | "requesting"    // Viewer: waiting for sharer to accept
  | "connecting"    // WebRTC negotiation in progress
  | "active"        // Screen sharing is live
  | "disconnected"; // Peer disconnected unexpectedly

export interface ScreenShareSession {
  sessionId: string;
  role: ScreenShareRole;
  remoteUserId: number;
  remoteUserName: string;
  state: ScreenShareState;
}

export interface IncomingScreenShareRequest {
  sessionId: string;
  fromUserId: number;
  fromUserName: string;
}

/**
 * Active screen share session (null = no active session)
 * Used by both viewer and sharer sides
 */
export const activeScreenShareAtom = atom<ScreenShareSession | null>(null);

/**
 * Incoming request waiting for user to accept/decline
 * Set when a session_request arrives via WebSocket
 * Cleared when user accepts or declines
 */
export const incomingScreenShareRequestAtom = atom<IncomingScreenShareRequest | null>(null);

/**
 * Whether the viewer modal should be open
 */
export const screenShareViewerOpenAtom = atom<boolean>(false);

/**
 * Remote control enabled (viewer can send mouse/keyboard events)
 */
export const remoteControlEnabledAtom = atom<boolean>(true);

/**
 * Generate a unique session ID for a new screen share session
 */
export function generateSessionId(): string {
  return `ss-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}
