"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

interface BriefingSection {
  type: string;
  title: string;
  count: number;
}

interface BriefingData {
  sections: BriefingSection[];
  has_items: boolean;
  alert_count: number;
}

type Phase = "hidden" | "entering" | "greeting" | "touring" | "idle";

const CHARACTER_SIZE = 56;

const MESSAGES: Record<string, string[]> = {
  overdue: [
    "Overdue tasks here — time to sort 'em!",
    "These need attention, boss!",
  ],
  tasks_due: [
    "Today's tasks — let's knock 'em out.",
    "Here's what's on the board today.",
  ],
  follow_ups: [
    "Follow-ups waiting on ya!",
    "Don't leave 'em hanging!",
  ],
  unanswered: [
    "People waiting for your reply!",
    "Inbox needs some love, mate!",
  ],
  pending_pos: [
    "POs need the green light!",
    "Purchase orders to approve!",
  ],
  all_clear: [
    "All caught up — legend!",
    "Clean slate! Grab a coffee.",
  ],
  metrics: [
    "Here's your numbers at a glance.",
    "Key metrics right here.",
  ],
  activity: [
    "Latest from the team.",
    "Here's what's been happening.",
  ],
  tasks: [
    "Upcoming deadlines this week.",
    "Keep an eye on these dates.",
  ],
  greeting: [
    "G'day! Let me show you around.",
    "Morning! Here's today's rundown.",
  ],
};

// Tour stops reference data-tour attributes in the Overview tab
const TOUR_STOPS = [
  { selector: '[data-tour="metrics-cards"]', msgKey: "metrics" },
  { selector: '[data-tour="recent-items"]', msgKey: "activity" },
  { selector: '[data-tour="tasks-widget"]', msgKey: "tasks" },
];

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getElRect(selector: string): DOMRect | null {
  return document.querySelector(selector)?.getBoundingClientRect() ?? null;
}

export default function JoshuaMascot() {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [pos, setPos] = useState({ top: -200, left: -200 });
  const [message, setMessage] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timeoutsRef.current.push(t);
    return t;
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  // Fetch briefing data for contextual messages
  useEffect(() => {
    api.get<{ success: boolean; data: BriefingData }>("/api/v1/assistant/briefing")
      .then(res => { if (res?.data) setBriefing(res.data); })
      .catch(() => {}); // Non-critical, Joshua works without it
  }, []);

  // Position to the right of an element, near its top
  const moveToElement = useCallback((selector: string): boolean => {
    const rect = getElRect(selector);
    if (!rect) return false;

    setPos({
      top: rect.top + window.scrollY + 8,
      left: Math.min(rect.right + 8, window.innerWidth - CHARACTER_SIZE - 12),
    });
    setHighlightRect(rect);
    return true;
  }, []);

  // Bottom-right idle spot
  const moveToIdle = useCallback(() => {
    setPos({
      top: window.innerHeight - CHARACTER_SIZE - 90 + window.scrollY,
      left: window.innerWidth - CHARACTER_SIZE - 16,
    });
    setHighlightRect(null);
  }, []);

  // Build contextual alert message from briefing data
  const getAlertMessage = useCallback(() => {
    if (!briefing?.has_items) return pick(MESSAGES.all_clear);
    const priority = ["overdue", "tasks_due", "follow_ups", "unanswered", "pending_pos"];
    for (const type of priority) {
      const sec = briefing.sections.find(s => s.type === type && s.count > 0);
      if (sec) {
        const msgs = MESSAGES[type] || MESSAGES.all_clear;
        return `${sec.count} ${sec.title.toLowerCase()} — ${pick(msgs)}`;
      }
    }
    return pick(MESSAGES.all_clear);
  }, [briefing]);

  // Main tour sequence - runs once on mount
  useEffect(() => {
    clearAllTimeouts();
    if (minimized) return;

    let d = 1000;

    // Enter
    addTimeout(() => { setPhase("entering"); moveToIdle(); }, d);
    d += 800;

    // Greet
    addTimeout(() => {
      setPhase("greeting");
      setMessage(pick(MESSAGES.greeting));
      setShowBubble(true);
    }, d);
    d += 2800;
    addTimeout(() => setShowBubble(false), d);
    d += 400;

    // Tour each visible data-tour element
    for (const stop of TOUR_STOPS) {
      const stopRef = stop; // capture for closure
      addTimeout(() => {
        setPhase("touring");
        if (moveToElement(stopRef.selector)) {
          addTimeout(() => {
            setMessage(pick(MESSAGES[stopRef.msgKey] || MESSAGES.all_clear));
            setShowBubble(true);
          }, 700);
          addTimeout(() => { setShowBubble(false); setHighlightRect(null); }, 3200);
        }
      }, d);
      d += 4000;
    }

    // Show most urgent alert if briefing loaded
    addTimeout(() => {
      if (briefing?.has_items) {
        setMessage(getAlertMessage());
        setShowBubble(true);
        addTimeout(() => setShowBubble(false), 3000);
      }
    }, d);
    d += 3500;

    // Settle to idle
    addTimeout(() => { setPhase("idle"); moveToIdle(); }, d);

    return clearAllTimeouts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimized, briefing]);

  // Keep highlight position correct on scroll
  useEffect(() => {
    if (!highlightRect) return;
    const onScroll = () => {
      // Find which tour stop is currently targeted
      for (const stop of TOUR_STOPS) {
        const rect = getElRect(stop.selector);
        if (rect) {
          setHighlightRect(rect);
          break;
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [highlightRect]);

  // Periodic idle visits
  useEffect(() => {
    if (phase !== "idle" || minimized) return;

    const interval = setInterval(() => {
      const validStops = TOUR_STOPS.filter(s => getElRect(s.selector));
      if (validStops.length === 0) return;
      const stop = validStops[Math.floor(Math.random() * validStops.length)];

      moveToElement(stop.selector);
      addTimeout(() => {
        setMessage(pick(MESSAGES[stop.msgKey] || MESSAGES.all_clear));
        setShowBubble(true);
      }, 700);
      addTimeout(() => {
        setShowBubble(false);
        setHighlightRect(null);
        moveToIdle();
      }, 4000);
    }, 15000);

    return () => clearInterval(interval);
  }, [phase, minimized, moveToElement, moveToIdle, addTimeout]);

  // Minimized state: small avatar button
  if (minimized) {
    return (
      <button
        onClick={() => { setMinimized(false); setPhase("hidden"); }}
        className="fixed bottom-4 right-4 z-50 group hidden md:block"
        title="Bring Joshua back"
      >
        <div className="w-11 h-11 rounded-full bg-amber-400 dark:bg-amber-500 shadow-lg group-hover:scale-110 transition-transform flex items-center justify-center border-2 border-amber-500 dark:border-amber-400">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/joshua.png" alt="Joshua" width={32} height={32} className="rounded-full" />
        </div>
      </button>
    );
  }

  return (
    <>
      <style>{`
        @keyframes josh-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes josh-bubble-in {
          0% { opacity: 0; transform: scale(0.85) translateY(4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes josh-highlight {
          0%, 100% { box-shadow: 0 0 0 2px rgba(245,158,11,0.3), 0 0 8px rgba(245,158,11,0.1); }
          50% { box-shadow: 0 0 0 2px rgba(245,158,11,0.5), 0 0 16px rgba(245,158,11,0.25); }
        }
      `}</style>

      {/* Highlight glow on the target section */}
      {highlightRect && (
        <div
          className="fixed z-40 pointer-events-none rounded-lg"
          style={{
            top: highlightRect.top - 3,
            left: highlightRect.left - 3,
            width: highlightRect.width + 6,
            height: highlightRect.height + 6,
            animation: "josh-highlight 1.5s ease-in-out infinite",
            transition: "all 0.4s ease",
          }}
        />
      )}

      {/* Joshua container */}
      <div
        className="absolute z-50 pointer-events-none hidden md:block"
        style={{
          top: pos.top,
          left: pos.left,
          transition: "top 1s cubic-bezier(0.25,0.46,0.45,0.94), left 1s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.4s ease",
          opacity: phase === "hidden" ? 0 : 1,
        }}
      >
        {/* Speech bubble */}
        {showBubble && message && (
          <div
            className="pointer-events-auto absolute"
            style={{
              bottom: CHARACTER_SIZE + 4,
              right: -4,
              animation: "josh-bubble-in 0.25s ease-out forwards",
              maxWidth: 190,
            }}
          >
            <div className="bg-white dark:bg-slate-800 rounded-xl px-2.5 py-1.5 shadow-lg border border-border/60 dark:border-slate-700 relative">
              <p className="text-[10px] font-medium text-foreground leading-snug">{message}</p>
              <div className="absolute -bottom-[4px] right-3 w-2 h-2 bg-white dark:bg-slate-800 border-b border-r border-border/60 dark:border-slate-700 transform rotate-45" />
            </div>
          </div>
        )}

        {/* Character */}
        <div className="pointer-events-auto relative group cursor-pointer" onClick={() => setMinimized(true)}>
          <div style={{ width: CHARACTER_SIZE, height: CHARACTER_SIZE, animation: phase === "idle" ? "josh-bob 3s ease-in-out infinite" : undefined }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/joshua.png" alt="Joshua AI" width={CHARACTER_SIZE} height={CHARACTER_SIZE} className="drop-shadow-md rounded-full" draggable={false} />
          </div>
          <div className="flex justify-center -mt-0.5">
            <div className="bg-amber-500 dark:bg-amber-600 text-white text-[7px] font-bold tracking-wider uppercase px-2 py-px rounded-full shadow-sm">
              Joshua
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
