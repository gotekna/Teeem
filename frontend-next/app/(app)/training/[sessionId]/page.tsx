"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ShareIcon, XMarkIcon, CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TrainingSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const displayName = searchParams.get("displayName") || "TEEEM User";
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [showInviteCard, setShowInviteCard] = useState(false);
  const [copied, setCopied] = useState(false);
  const [jitsiLoaded, setJitsiLoaded] = useState(false);

  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/training/${sessionId}` : "";

  useEffect(() => {
    // Load Jitsi external API script
    const script = document.createElement("script");
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = () => setJitsiLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!jitsiLoaded || !sessionId) return;

    const domain = "meet.jit.si";
    const options = {
      roomName: `teeem-training-${sessionId}`,
      width: "100%",
      height: "100%",
      parentNode: document.getElementById("jitsi-container"),
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: false,
        disableModeratorIndicator: false,
        enableWelcomePage: false,
        prejoinPageEnabled: false,
        hideConferenceSubject: false,
        subject: `Training Session: ${sessionId}`,
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          "camera",
          "chat",
          "desktop",
          "download",
          "filmstrip",
          "fullscreen",
          "hangup",
          "help",
          "microphone",
          "participants-pane",
          "profile",
          "raisehand",
          "recording",
          "settings",
          "shareaudio",
          "sharedvideo",
          "shortcuts",
          "tileview",
          "toggle-camera",
          "videoquality",
          "whiteboard",
        ],
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: "#1F2937",
        MOBILE_APP_PROMO: false,
      },
      userInfo: {
        displayName: displayName,
        email: "",
      },
    };

    // @ts-ignore - JitsiMeetExternalAPI is loaded from external script
    const api = new window.JitsiMeetExternalAPI(domain, options);

    api.addListener("videoConferenceJoined", () => {
      console.log("User joined the conference");
    });

    api.addListener("videoConferenceLeft", () => {
      console.log("User left the conference");
      setMeetingEnded(true);
      router.push("/training");
    });

    return () => {
      api.dispose();
    };
  }, [jitsiLoaded, sessionId, displayName, router]);

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySessionId = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold">No Session ID</h2>
          <p className="mb-4 text-muted-foreground">
            Please provide a valid training session ID
          </p>
          <BackButton fallbackHref="/training" />
        </div>
      </div>
    );
  }

  if (meetingEnded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold">Training Session Ended</h2>
          <p className="mb-4 text-muted-foreground">
            Thank you for participating in the training session
          </p>
          <BackButton fallbackHref="/training" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen">
      {/* Floating Invite Button */}
      <Button
        onClick={() => setShowInviteCard(!showInviteCard)}
        className="absolute right-4 top-4 z-50 shadow-lg"
      >
        <ShareIcon className="mr-2 h-5 w-5" />
        Invite
      </Button>

      {/* Invite Card */}
      {showInviteCard && (
        <Card className="absolute right-4 top-20 z-50 w-96 shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Invite Participants</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowInviteCard(false)}>
              <XMarkIcon className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Session ID */}
            <div className="space-y-2">
              <Label>Session ID</Label>
              <div className="flex gap-2">
                <Input value={sessionId} readOnly className="font-mono" />
                <Button variant="secondary" size="icon" onClick={copySessionId} title="Copy Session ID">
                  {copied ? (
                    <CheckIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <ClipboardIcon className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Full Link */}
            <div className="space-y-2">
              <Label>Invite Link</Label>
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="truncate" />
                <Button onClick={copyInviteLink} title="Copy Invite Link">
                  {copied ? (
                    <CheckIcon className="h-5 w-5" />
                  ) : (
                    <ClipboardIcon className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="border-t pt-2">
              <p className="text-sm text-muted-foreground">
                Share the Session ID or link with participants to invite them to this training
                session.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jitsi Container */}
      <div id="jitsi-container" className="h-full w-full" />
    </div>
  );
}
