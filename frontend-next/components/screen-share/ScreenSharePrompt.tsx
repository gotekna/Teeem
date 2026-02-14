"use client";

import { useCallback, useRef, useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Monitor, PhoneOff } from "lucide-react";
import { useScreenShareWebSocket } from "@/hooks/useScreenShareWebSocket";
import { ScreenShareManager } from "@/lib/webrtc/screen-share-manager";
import {
  activeScreenShareAtom,
  incomingScreenShareRequestAtom,
} from "@/lib/screen-share-atoms";

/**
 * ScreenSharePrompt - Global component for handling incoming screen share requests
 *
 * Rendered in app/(app)/layout.tsx so it works on any page.
 *
 * Three states:
 * 1. Idle - renders nothing
 * 2. Incoming request - Dialog: "{Name} wants to view and control your screen"
 * 3. Sharing active - Fixed floating "Stop Sharing" button
 */
export function ScreenSharePrompt() {
  const [incomingRequest, setIncomingRequest] = useAtom(incomingScreenShareRequestAtom);
  const [activeSession, setActiveSession] = useAtom(activeScreenShareAtom);
  const managerRef = useRef<ScreenShareManager | null>(null);

  // WebSocket for signaling
  const { send } = useScreenShareWebSocket({
    // Handle incoming session requests
    onSessionRequest: useCallback(
      (fromUserId: number, fromUserName: string, sessionId: string) => {
        // If already in a session, auto-decline
        if (activeSession) {
          send(fromUserId, "session_declined", sessionId);
          return;
        }
        setIncomingRequest({ sessionId, fromUserId, fromUserName });
      },
      [activeSession]
    ),

    // Handle SDP answer from viewer (we are sharer)
    onSdpAnswer: useCallback(
      async (_fromUserId: number, sessionId: string, sdp: RTCSessionDescriptionInit) => {
        if (activeSession?.sessionId !== sessionId || !managerRef.current) return;
        await managerRef.current.handleSdpAnswer(sdp);
      },
      [activeSession?.sessionId]
    ),

    // Handle ICE candidates
    onIceCandidate: useCallback(
      async (_fromUserId: number, sessionId: string, candidate: RTCIceCandidateInit) => {
        if (activeSession?.sessionId !== sessionId || !managerRef.current) return;
        await managerRef.current.handleIceCandidate(candidate);
      },
      [activeSession?.sessionId]
    ),

    // Handle session ended by viewer
    onSessionEnded: useCallback(
      (_fromUserId: number, sessionId: string) => {
        if (activeSession?.sessionId !== sessionId) return;
        managerRef.current?.cleanup();
        managerRef.current = null;
        setActiveSession(null);
      },
      [activeSession?.sessionId]
    ),
  });

  // Accept the incoming screen share request
  const handleAccept = useCallback(async () => {
    if (!incomingRequest) return;

    const { sessionId, fromUserId, fromUserName } = incomingRequest;
    setIncomingRequest(null);

    // Set session state to connecting
    setActiveSession({
      sessionId,
      role: "sharer",
      remoteUserId: fromUserId,
      remoteUserName: fromUserName,
      state: "connecting",
    });

    try {
      // Create WebRTC manager as sharer
      const manager = new ScreenShareManager("sharer", {
        onSignal: (type, payload) => {
          send(fromUserId, type, sessionId, payload as Record<string, unknown>);
        },
        onStateChange: (state) => {
          if (state === "connected") {
            setActiveSession((prev) =>
              prev?.sessionId === sessionId ? { ...prev, state: "active" } : prev
            );
          }
        },
        onEnded: (reason) => {
          send(fromUserId, "session_ended", sessionId);
          managerRef.current = null;
          setActiveSession(null);
        },
      });

      managerRef.current = manager;

      // Send accepted signal first so viewer knows to prepare
      send(fromUserId, "session_accepted", sessionId);

      // Start sharing (triggers browser's getDisplayMedia prompt)
      await manager.initAsSharer();
    } catch (err) {
      console.error("[ScreenSharePrompt] Failed to start sharing:", err);
      // User likely cancelled the browser prompt
      send(fromUserId, "session_ended", sessionId);
      managerRef.current?.cleanup();
      managerRef.current = null;
      setActiveSession(null);
    }
  }, [incomingRequest, send, setActiveSession, setIncomingRequest]);

  // Decline the incoming request
  const handleDecline = useCallback(() => {
    if (!incomingRequest) return;
    send(incomingRequest.fromUserId, "session_declined", incomingRequest.sessionId);
    setIncomingRequest(null);
  }, [incomingRequest, send, setIncomingRequest]);

  // Stop sharing
  const handleStopSharing = useCallback(() => {
    if (!activeSession) return;
    send(activeSession.remoteUserId, "session_ended", activeSession.sessionId);
    managerRef.current?.cleanup();
    managerRef.current = null;
    setActiveSession(null);
  }, [activeSession, send, setActiveSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      managerRef.current?.cleanup();
      managerRef.current = null;
    };
  }, []);

  return (
    <>
      {/* Incoming request dialog */}
      <Dialog
        open={!!incomingRequest}
        onOpenChange={(open) => {
          if (!open) handleDecline();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Screen Share Request
            </DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">
                {incomingRequest?.fromUserName}
              </span>{" "}
              wants to view and control your screen. They will be able to see your
              current browser tab and interact with it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleDecline}>
              Decline
            </Button>
            <Button onClick={handleAccept}>Accept</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating "Stop Sharing" button when actively sharing */}
      {activeSession?.role === "sharer" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]">
          <Button
            variant="destructive"
            size="lg"
            onClick={handleStopSharing}
            className="shadow-lg gap-2 animate-pulse"
          >
            <PhoneOff className="h-4 w-4" />
            Stop Sharing
            <span className="text-xs opacity-75">
              ({activeSession.remoteUserName} is viewing)
            </span>
          </Button>
        </div>
      )}
    </>
  );
}
