"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { useAtom } from "jotai";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Maximize2,
  Minimize2,
  Monitor,
  MousePointer2,
  MousePointer2Off,
  PhoneOff,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useScreenShareWebSocket, type ScreenShareMessageType } from "@/hooks/useScreenShareWebSocket";
import { ScreenShareManager } from "@/lib/webrtc/screen-share-manager";
import {
  activeScreenShareAtom,
  screenShareViewerOpenAtom,
  remoteControlEnabledAtom,
  generateSessionId,
} from "@/lib/screen-share-atoms";
import { cn } from "@/lib/utils";

interface ScreenShareViewerProps {
  targetUserId: number;
  targetUserName: string;
}

/**
 * ScreenShareViewer - Modal for viewing a remote user's screen
 *
 * Contains:
 * - <video> element showing the WebRTC stream
 * - Invisible overlay capturing mouse/keyboard for remote control
 * - Toolbar: connection status, fullscreen, remote control toggle, disconnect
 */
export function ScreenShareViewer({
  targetUserId,
  targetUserName,
}: ScreenShareViewerProps) {
  const [isOpen, setIsOpen] = useAtom(screenShareViewerOpenAtom);
  const [activeSession, setActiveSession] = useAtom(activeScreenShareAtom);
  const [remoteControlEnabled, setRemoteControlEnabled] = useAtom(remoteControlEnabledAtom);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<ScreenShareManager | null>(null);
  const sessionIdRef = useRef<string>("");

  // Use a ref for the send function to break the circular dependency
  // (callbacks need send, but send comes from the hook that takes callbacks)
  const sendRef = useRef<(targetUserId: number, type: ScreenShareMessageType, sessionId: string, payload?: Record<string, unknown>) => void>(
    () => {}
  );

  // Helper to cleanup everything
  const doCleanup = useCallback(() => {
    managerRef.current?.cleanup();
    managerRef.current = null;
    sessionIdRef.current = "";
    setActiveSession(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [setActiveSession]);

  // WebSocket for signaling
  const { send } = useScreenShareWebSocket({
    onSessionAccepted: useCallback(
      (fromUserId: number, sessionId: string) => {
        if (sessionId !== sessionIdRef.current) return;
        setActiveSession((prev) =>
          prev?.sessionId === sessionId ? { ...prev, state: "connecting" } : prev
        );
        if (!managerRef.current) {
          const manager = new ScreenShareManager("viewer", {
            onSignal: (type, payload) => {
              sendRef.current(fromUserId, type, sessionId, payload as Record<string, unknown>);
            },
            onRemoteStream: (stream) => {
              if (videoRef.current) {
                videoRef.current.srcObject = stream;
              }
              setActiveSession((prev) =>
                prev?.sessionId === sessionId ? { ...prev, state: "active" } : prev
              );
              setConnectionError(null);
            },
            onStateChange: (state) => {
              if (state === "connected") {
                setActiveSession((prev) =>
                  prev?.sessionId === sessionId ? { ...prev, state: "active" } : prev
                );
              }
            },
            onEnded: (reason) => {
              console.log("[ScreenShareViewer] Session ended:", reason);
              doCleanup();
            },
          });
          managerRef.current = manager;
          manager.initAsViewer();
        }
      },
      [setActiveSession, doCleanup]
    ),

    onSessionDeclined: useCallback(
      (_fromUserId: number, sessionId: string) => {
        if (sessionId !== sessionIdRef.current) return;
        setConnectionError("Request declined");
        setActiveSession(null);
      },
      [setActiveSession]
    ),

    onSdpOffer: useCallback(
      async (_fromUserId: number, sessionId: string, sdp: RTCSessionDescriptionInit) => {
        if (sessionId !== sessionIdRef.current || !managerRef.current) return;
        await managerRef.current.handleSdpOffer(sdp);
      },
      []
    ),

    onIceCandidate: useCallback(
      async (_fromUserId: number, sessionId: string, candidate: RTCIceCandidateInit) => {
        if (sessionId !== sessionIdRef.current || !managerRef.current) return;
        await managerRef.current.handleIceCandidate(candidate);
      },
      []
    ),

    onSessionEnded: useCallback(
      (_fromUserId: number, sessionId: string) => {
        if (sessionId !== sessionIdRef.current) return;
        doCleanup();
      },
      [doCleanup]
    ),
  });

  // Keep sendRef up to date
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Start screen share request
  const handleStartRequest = useCallback(() => {
    const sessionId = generateSessionId();
    sessionIdRef.current = sessionId;

    setActiveSession({
      sessionId,
      role: "viewer",
      remoteUserId: targetUserId,
      remoteUserName: targetUserName,
      state: "requesting",
    });
    setConnectionError(null);

    send(targetUserId, "session_request", sessionId);
  }, [targetUserId, targetUserName, send, setActiveSession]);

  // Disconnect and cleanup
  const handleDisconnect = useCallback(() => {
    if (activeSession) {
      send(activeSession.remoteUserId, "session_ended", activeSession.sessionId);
    }
    doCleanup();
  }, [activeSession, send, doCleanup]);

  // Handle modal close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleDisconnect();
      }
      setIsOpen(open);
    },
    [handleDisconnect, setIsOpen]
  );

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    const container = document.getElementById("screen-share-viewer-container");
    if (!container) return;

    if (!isFullscreen) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Mouse event handlers for remote control overlay
  const handleMouseEvent = useCallback(
    (e: React.MouseEvent, eventType: "click" | "dblclick" | "mousemove") => {
      if (!remoteControlEnabled || !managerRef.current || !overlayRef.current) return;

      const rect = overlayRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      if (eventType === "click") {
        managerRef.current.sendControlEvent({ type: "click", x, y, button: e.button });
      } else if (eventType === "dblclick") {
        managerRef.current.sendControlEvent({ type: "dblclick", x, y });
      } else {
        managerRef.current.sendControlEvent({ type: "mousemove", x, y });
      }
    },
    [remoteControlEnabled]
  );

  // Scroll handler stored in ref for native event listener
  const handleScrollRef = useRef<(e: WheelEvent) => void>(() => {});
  handleScrollRef.current = (e: WheelEvent) => {
    if (!remoteControlEnabled || !managerRef.current) return;
    e.preventDefault();
    managerRef.current.sendControlEvent({
      type: "scroll",
      deltaX: e.deltaX,
      deltaY: e.deltaY,
    });
  };

  // Attach wheel listener with { passive: false } so preventDefault() works
  // React registers onWheel as passive by default, which blocks preventDefault
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const handler = (e: WheelEvent) => handleScrollRef.current(e);
    overlay.addEventListener("wheel", handler, { passive: false });
    return () => overlay.removeEventListener("wheel", handler);
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!remoteControlEnabled || !managerRef.current) return;
      if (e.key === "Escape") return;

      e.preventDefault();
      managerRef.current.sendControlEvent({
        type: "keydown",
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      });
    },
    [remoteControlEnabled]
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (!remoteControlEnabled || !managerRef.current) return;
      if (e.key === "Escape") return;

      e.preventDefault();
      managerRef.current.sendControlEvent({
        type: "keyup",
        key: e.key,
        code: e.code,
      });
    },
    [remoteControlEnabled]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      managerRef.current?.cleanup();
      managerRef.current = null;
    };
  }, []);

  // Listen for fullscreen change events
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const isActive = activeSession?.state === "active";
  const isConnecting =
    activeSession?.state === "requesting" || activeSession?.state === "connecting";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden"
        id="screen-share-viewer-container"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Screen Share - {targetUserName}</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
          <div className="flex items-center gap-2">
            {isActive ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">{targetUserName}</span>
            <span className="text-xs text-muted-foreground">
              {isConnecting && "Connecting..."}
              {isActive && "Live"}
              {connectionError && connectionError}
              {!activeSession && !connectionError && "Not connected"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRemoteControlEnabled(!remoteControlEnabled)}
              title={remoteControlEnabled ? "Disable remote control" : "Enable remote control"}
              className={cn("h-8 px-2", remoteControlEnabled && "text-primary")}
            >
              {remoteControlEnabled ? (
                <MousePointer2 className="h-4 w-4" />
              ) : (
                <MousePointer2Off className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="h-8 px-2"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                handleDisconnect();
                setIsOpen(false);
              }}
              className="h-8 gap-1"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              End
            </Button>
          </div>
        </div>

        {/* Video + control overlay */}
        <div className="relative bg-black flex items-center justify-center min-h-[400px]">
          {!activeSession && !connectionError && (
            <div className="flex flex-col items-center gap-4 text-white">
              <Monitor className="h-16 w-16 opacity-30" />
              <p className="text-muted-foreground">
                Click below to request screen access
              </p>
              <Button onClick={handleStartRequest}>Request Screen Share</Button>
            </div>
          )}

          {isConnecting && (
            <div className="flex flex-col items-center gap-4 text-white">
              <div className="h-8 w-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-sm text-white/70">
                {activeSession?.state === "requesting"
                  ? `Waiting for ${targetUserName} to accept...`
                  : "Establishing connection..."}
              </p>
            </div>
          )}

          {connectionError && (
            <div className="flex flex-col items-center gap-4 text-white">
              <WifiOff className="h-16 w-16 opacity-30" />
              <p className="text-red-400">{connectionError}</p>
              <Button onClick={handleStartRequest}>Try Again</Button>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={cn(
              "max-w-full max-h-[80vh] object-contain",
              !isActive && "hidden"
            )}
          />

          {isActive && (
            <div
              ref={overlayRef}
              className={cn(
                "absolute inset-0",
                remoteControlEnabled ? "cursor-pointer" : "cursor-default pointer-events-none"
              )}
              tabIndex={0}
              onClick={(e) => handleMouseEvent(e, "click")}
              onDoubleClick={(e) => handleMouseEvent(e, "dblclick")}
              onMouseMove={(e) => handleMouseEvent(e, "mousemove")}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onContextMenu={(e) => e.preventDefault()}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
