"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface JoshuaMascotProps {
  alertCount: number;
  hasItems: boolean;
  sections: Array<{ type: string; title: string; count: number }>;
  isLoading: boolean;
}

type Phase = "hidden" | "entering" | "greeting" | "touring" | "idle";

const MESSAGES: Record<string, string[]> = {
  overdue: [
    "Oi! Overdue tasks need sorting, mate!",
    "These are past due — time to crack on!",
    "Red alert! Let's clear the overdue list!",
  ],
  tasks_due: [
    "Tasks on the board today — let's go!",
    "Got a few things to knock out today.",
    "Your to-do list is ready, boss!",
  ],
  follow_ups: [
    "Emails need a follow-up, boss!",
    "Don't leave 'em hanging — reply time!",
    "Follow-ups waiting on ya!",
  ],
  unanswered: [
    "People are waiting for your reply!",
    "Inbox needs some love, mate!",
    "Unanswered emails piling up!",
  ],
  pending_pos: [
    "POs waiting for the green light!",
    "Purchase orders need your tick!",
    "Approve those POs, legend!",
  ],
  all_clear: [
    "Ripper! All caught up today!",
    "Nothing to stress about — you legend!",
    "Clean slate! Go grab a coffee!",
    "All done! Site's running smooth!",
  ],
  loading: [
    "Checking the site report...",
    "Pulling up today's brief...",
    "Just a tick...",
  ],
};

const SECTION_STOPS = ["18vh", "38vh", "56vh"];
const GREETING_POS = "8vh";
const IDLE_POS = "calc(100vh - 280px)";
const OFFSCREEN = "calc(100vh + 100px)";

export default function JoshuaMascot({ alertCount, hasItems, sections, isLoading }: JoshuaMascotProps) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [posTop, setPosTop] = useState(OFFSCREEN);
  const [isWalking, setIsWalking] = useState(false);
  const [armPose, setArmPose] = useState<"rest" | "wave" | "point">("rest");
  const [message, setMessage] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timeoutsRef.current.push(t);
    return t;
  }, []);

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const getTopMessage = useCallback(() => {
    if (isLoading) return MESSAGES.loading[0];
    if (!hasItems) return MESSAGES.all_clear[Math.floor(Math.random() * MESSAGES.all_clear.length)];
    const priority = ["overdue", "tasks_due", "follow_ups", "unanswered", "pending_pos"];
    for (const type of priority) {
      if (sections.find(s => s.type === type && s.count > 0)) {
        const msgs = MESSAGES[type];
        return msgs[Math.floor(Math.random() * msgs.length)];
      }
    }
    return MESSAGES.all_clear[0];
  }, [isLoading, hasItems, sections]);

  const getSectionMessage = useCallback((index: number) => {
    const active = sections.filter(s => s.count > 0);
    if (index < active.length) {
      const msgs = MESSAGES[active[index].type] || MESSAGES.all_clear;
      return msgs[Math.floor(Math.random() * msgs.length)];
    }
    return null;
  }, [sections]);

  // Main entrance + tour sequence
  useEffect(() => {
    clearTimeouts();

    addTimeout(() => {
      setPhase("entering");
      setIsWalking(true);
      setPosTop(GREETING_POS);
    }, 600);

    addTimeout(() => {
      setIsWalking(false);
      setPhase("greeting");
      setArmPose("wave");
      setMessage(getTopMessage());
      setShowBubble(true);
    }, 3200);

    addTimeout(() => setArmPose("rest"), 5200);

    addTimeout(() => {
      setShowBubble(false);
      setPhase("touring");
      setIsWalking(true);
      setPosTop(SECTION_STOPS[0]);
    }, 6500);

    addTimeout(() => {
      setIsWalking(false);
      setArmPose("point");
      const msg = getSectionMessage(0);
      if (msg) { setMessage(msg); setShowBubble(true); }
    }, 8700);

    addTimeout(() => {
      setShowBubble(false);
      setArmPose("rest");
      setIsWalking(true);
      setPosTop(SECTION_STOPS[1]);
    }, 11700);

    addTimeout(() => {
      setIsWalking(false);
      setArmPose("point");
      const msg = getSectionMessage(1);
      if (msg) { setMessage(msg); setShowBubble(true); }
    }, 13900);

    addTimeout(() => {
      setShowBubble(false);
      setArmPose("rest");
      setIsWalking(true);
      setPosTop(IDLE_POS);
    }, 16900);

    addTimeout(() => {
      setIsWalking(false);
      setPhase("idle");
    }, 19200);

    return clearTimeouts;
  }, [getTopMessage, getSectionMessage, addTimeout, clearTimeouts]);

  // Periodic roaming when idle
  useEffect(() => {
    if (phase !== "idle") return;
    const interval = setInterval(() => {
      const active = sections.filter(s => s.count > 0);
      if (active.length === 0) return;

      const idx = Math.floor(Math.random() * Math.min(active.length, SECTION_STOPS.length));
      const msgs = MESSAGES[active[idx].type] || MESSAGES.all_clear;
      const msg = msgs[Math.floor(Math.random() * msgs.length)];

      setIsWalking(true);
      setPosTop(SECTION_STOPS[idx]);

      addTimeout(() => {
        setIsWalking(false);
        setArmPose("point");
        setMessage(msg);
        setShowBubble(true);
      }, 2200);

      addTimeout(() => {
        setShowBubble(false);
        setArmPose("rest");
        setIsWalking(true);
        setPosTop(IDLE_POS);
      }, 5500);

      addTimeout(() => setIsWalking(false), 7700);
    }, 14000);

    return () => clearInterval(interval);
  }, [phase, sections, addTimeout]);

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 group hidden md:block"
        title="Bring Joshua back"
      >
        <div className="w-14 h-14 rounded-full bg-amber-400 dark:bg-amber-500 shadow-lg group-hover:scale-110 transition-transform flex items-center justify-center border-2 border-amber-500 dark:border-amber-400">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/joshua.png" alt="Joshua" width={40} height={40} className="rounded-full" />
        </div>
      </button>
    );
  }

  const isCelebrating = !hasItems && !isLoading;

  const characterAnim = phase === "entering"
    ? "josh-wobble 0.8s ease-in-out 3"
    : isWalking
    ? "josh-walk-bounce 0.5s ease-in-out infinite"
    : phase === "idle" && !isWalking
    ? "josh-bob 3s ease-in-out infinite"
    : isCelebrating && phase === "greeting"
    ? "josh-celebrate 0.8s ease-in-out 2"
    : undefined;

  return (
    <>
      <JoshuaStyles />

      <div
        className="fixed z-50 pointer-events-none hidden md:flex flex-col items-end"
        style={{
          right: "20px",
          top: posTop,
          transition: "top 2.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.5s ease",
          opacity: phase === "hidden" ? 0 : 1,
        }}
      >
        {/* Speech bubble */}
        {showBubble && message && (
          <div
            className="pointer-events-auto mb-2 max-w-[220px]"
            style={{ animation: "josh-bubble-in 0.4s ease-out forwards" }}
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-2.5 shadow-xl border border-border/60 dark:border-slate-700 relative">
              <p className="text-xs font-semibold text-foreground leading-relaxed">{message}</p>
              {isCelebrating && (
                <p className="text-[10px] text-amber-500 mt-0.5 font-medium">— Joshua AI</p>
              )}
              <div className="absolute -bottom-[6px] right-10 w-3 h-3 bg-white dark:bg-slate-800 border-b border-r border-border/60 dark:border-slate-700 transform rotate-45" />
            </div>
          </div>
        )}

        {/* Character */}
        <div className="pointer-events-auto relative">
          <button
            onClick={() => setMinimized(true)}
            className="absolute -top-1 -left-1 z-10 w-5 h-5 rounded-full bg-muted/80 hover:bg-red-500 hover:text-white text-muted-foreground text-[10px] flex items-center justify-center opacity-0 hover:opacity-100 transition-all duration-200"
            title="Minimize Joshua"
          >
            &times;
          </button>

          <div style={{ animation: characterAnim }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/joshua.png"
              alt="Joshua - AI Construction Assistant"
              width={140}
              height={140}
              className="drop-shadow-lg"
              draggable={false}
            />

            {/* Name plate */}
            <div className="flex justify-center -mt-1">
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 text-white text-[9px] font-bold tracking-[0.15em] uppercase px-4 py-0.5 rounded-full shadow-md border border-amber-400/30">
                Joshua
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function JoshuaStyles() {
  return (
    <style>{`
      @keyframes josh-bob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      @keyframes josh-walk-bounce {
        0%, 100% { transform: translateY(0); }
        25% { transform: translateY(-3px); }
        50% { transform: translateY(0); }
        75% { transform: translateY(-3px); }
      }
      @keyframes josh-bubble-in {
        0% { opacity: 0; transform: scale(0.7) translateY(8px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes josh-celebrate {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        25% { transform: translateY(-15px) rotate(-5deg); }
        50% { transform: translateY(-20px) rotate(5deg); }
        75% { transform: translateY(-8px) rotate(-3deg); }
      }
      @keyframes josh-wobble {
        0%, 100% { transform: rotate(0deg) translateX(0); }
        20% { transform: rotate(-4deg) translateX(-3px); }
        40% { transform: rotate(3deg) translateX(3px); }
        60% { transform: rotate(-2deg) translateX(-2px); }
        80% { transform: rotate(1deg) translateX(1px); }
      }
    `}</style>
  );
}
