/**
 * ScreenShareManager - WebRTC peer connection + DataChannel for screen sharing
 *
 * Pure TypeScript class (no React dependencies).
 * Manages the RTCPeerConnection lifecycle for both viewer and sharer roles.
 *
 * Viewer (User A): receives video, sends control events via DataChannel
 * Sharer (User B): sends screen video, receives and replays control events
 */

// ICE servers - Google STUN only for Stage 1
// TURN server can be added later if symmetric NAT blocks P2P
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type RemoteControlEvent =
  | { type: "click"; x: number; y: number; button: number }
  | { type: "dblclick"; x: number; y: number }
  | { type: "mousemove"; x: number; y: number }
  | { type: "scroll"; deltaX: number; deltaY: number }
  | { type: "keydown"; key: string; code: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }
  | { type: "keyup"; key: string; code: string }
  | { type: "input"; text: string };

export interface ScreenShareManagerCallbacks {
  /** Called when we need to send signaling data to the remote peer */
  onSignal: (type: "sdp_offer" | "sdp_answer" | "ice_candidate", payload: unknown) => void;
  /** Called when the remote video stream is available (viewer only) */
  onRemoteStream?: (stream: MediaStream) => void;
  /** Called when the connection state changes */
  onStateChange?: (state: RTCPeerConnectionState) => void;
  /** Called when the session ends (track ended, peer disconnected, etc.) */
  onEnded?: (reason: string) => void;
}

export class ScreenShareManager {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private callbacks: ScreenShareManagerCallbacks;
  private role: "viewer" | "sharer";

  constructor(role: "viewer" | "sharer", callbacks: ScreenShareManagerCallbacks) {
    this.role = role;
    this.callbacks = callbacks;
  }

  /**
   * Initialize as SHARER (User B)
   * 1. Get screen via getDisplayMedia
   * 2. Create peer connection + add track
   * 3. Create SDP offer → send via signaling
   */
  async initAsSharer(): Promise<void> {
    // Request screen capture (browser shows native prompt)
    this.localStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser",
      } as MediaTrackConstraints,
      audio: false,
    });

    // Listen for user clicking "Stop sharing" in browser chrome
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        this.callbacks.onEnded?.("user_stopped_sharing");
        this.cleanup();
      };
    }

    this.createPeerConnection();

    // Add screen track to peer connection
    this.localStream.getTracks().forEach((track) => {
      this.pc!.addTrack(track, this.localStream!);
    });

    // Listen for DataChannel from viewer (remote control events)
    this.pc!.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
    };

    // Create and send SDP offer
    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);
    this.callbacks.onSignal("sdp_offer", { sdp: offer });
  }

  /**
   * Initialize as VIEWER (User A)
   * Peer connection is created, waiting for SDP offer from sharer
   */
  initAsViewer(): void {
    this.createPeerConnection();

    // Create DataChannel for sending remote control events
    this.dataChannel = this.pc!.createDataChannel("remote-control", {
      ordered: true,
    });
    this.setupDataChannelHandlers();

    // Listen for remote video track
    this.pc!.ontrack = (event) => {
      if (event.streams[0]) {
        this.callbacks.onRemoteStream?.(event.streams[0]);
      }
    };
  }

  /**
   * Handle incoming SDP offer (viewer receives from sharer)
   */
  async handleSdpOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.callbacks.onSignal("sdp_answer", { sdp: answer });
  }

  /**
   * Handle incoming SDP answer (sharer receives from viewer)
   */
  async handleSdpAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  /**
   * Handle incoming ICE candidate from remote peer
   */
  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("[ScreenShareManager] Failed to add ICE candidate:", err);
    }
  }

  /**
   * Send a remote control event to the sharer (viewer only)
   */
  sendControlEvent(event: RemoteControlEvent): void {
    if (this.role !== "viewer" || !this.dataChannel || this.dataChannel.readyState !== "open") {
      return;
    }
    this.dataChannel.send(JSON.stringify(event));
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Stop local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Close peer connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  // --- Private ---

  private createPeerConnection(): void {
    this.pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    // Send ICE candidates to remote peer
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onSignal("ice_candidate", {
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Monitor connection state
    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const state = this.pc.connectionState;
      this.callbacks.onStateChange?.(state);

      if (state === "disconnected" || state === "failed" || state === "closed") {
        this.callbacks.onEnded?.(state);
      }
    };

    // ICE connection state for additional monitoring
    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return;
      if (this.pc.iceConnectionState === "failed") {
        this.callbacks.onEnded?.("ice_failed");
      }
    };
  }

  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log("[ScreenShareManager] DataChannel open");
    };

    this.dataChannel.onclose = () => {
      console.log("[ScreenShareManager] DataChannel closed");
    };

    // Only the sharer processes incoming control events
    if (this.role === "sharer") {
      this.dataChannel.onmessage = (event) => {
        try {
          const controlEvent: RemoteControlEvent = JSON.parse(event.data);
          this.replayControlEvent(controlEvent);
        } catch (err) {
          console.warn("[ScreenShareManager] Failed to parse control event:", err);
        }
      };
    }
  }

  /**
   * Replay a remote control event on the sharer's DOM
   * Coordinates are normalized (0-1) and mapped to viewport dimensions
   */
  private replayControlEvent(event: RemoteControlEvent): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    switch (event.type) {
      case "click": {
        const x = event.x * vw;
        const y = event.y * vh;
        const el = document.elementFromPoint(x, y);
        if (el) {
          el.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
              button: event.button,
              view: window,
            })
          );
        }
        break;
      }

      case "dblclick": {
        const x = event.x * vw;
        const y = event.y * vh;
        const el = document.elementFromPoint(x, y);
        if (el) {
          el.dispatchEvent(
            new MouseEvent("dblclick", {
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
              view: window,
            })
          );
        }
        break;
      }

      case "mousemove": {
        const x = event.x * vw;
        const y = event.y * vh;
        const el = document.elementFromPoint(x, y);
        if (el) {
          el.dispatchEvent(
            new MouseEvent("mousemove", {
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
              view: window,
            })
          );
        }
        break;
      }

      case "scroll": {
        window.scrollBy({
          left: event.deltaX,
          top: event.deltaY,
          behavior: "instant",
        });
        break;
      }

      case "keydown": {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
          })
        );
        break;
      }

      case "keyup": {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent("keyup", {
            bubbles: true,
            cancelable: true,
            key: event.key,
            code: event.code,
          })
        );
        break;
      }

      case "input": {
        // For React controlled inputs, use execCommand to trigger onChange
        const active = document.activeElement;
        if (active && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
          // Focus the element and use document.execCommand for React compatibility
          active.focus();
          document.execCommand("insertText", false, event.text);
        }
        break;
      }
    }
  }
}
