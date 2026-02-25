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
          <svg viewBox="0 0 40 40" width="32" height="32">
            <path d="M10 22 Q10 8 20 6 Q30 8 30 22 Z" fill="#fbbf24" />
            <rect x="7" y="20" width="26" height="4" rx="2" fill="#b45309" />
            <circle cx="20" cy="30" r="7" fill="#fde4c8" />
            <circle cx="17" cy="29" r="1.5" fill="#1e293b" />
            <circle cx="23" cy="29" r="1.5" fill="#1e293b" />
          </svg>
        </div>
      </button>
    );
  }

  const isCelebrating = !hasItems && !isLoading;

  const leftArmAnim = armPose === "wave"
    ? "josh-wave 1.2s ease-in-out 2"
    : armPose === "point"
    ? "josh-point 0.5s ease-out forwards"
    : isWalking
    ? "josh-walk-left-arm 0.5s ease-in-out infinite"
    : undefined;

  const rightArmAnim = isWalking
    ? "josh-walk-right-arm 0.5s ease-in-out infinite"
    : phase === "idle" && !isWalking
    ? "josh-hammer-tap 5s ease-in-out infinite"
    : undefined;

  const bodyAnim = phase === "idle" && !isWalking
    ? "josh-breathe 4s ease-in-out infinite"
    : undefined;

  const characterAnim = phase === "entering"
    ? "josh-wobble 0.8s ease-in-out 3"
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
            <svg viewBox="0 0 120 200" width="115" height="192" className="drop-shadow-lg">
              <defs>
                <linearGradient id="jh-hat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fcd34d" />
                  <stop offset="40%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
                <radialGradient id="jh-skin" cx="0.4" cy="0.3">
                  <stop offset="0%" stopColor="#fde8d0" />
                  <stop offset="70%" stopColor="#f5d4b3" />
                  <stop offset="100%" stopColor="#e8b48a" />
                </radialGradient>
                <radialGradient id="jh-skin-shadow" cx="0.5" cy="0.5">
                  <stop offset="0%" stopColor="#f5d4b3" />
                  <stop offset="100%" stopColor="#d4a574" />
                </radialGradient>
                <linearGradient id="jh-vest" x1="0" y1="0" x2="0.3" y2="1">
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="60%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
                <linearGradient id="jh-shirt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <linearGradient id="jh-jeans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="40%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                <linearGradient id="jh-wood" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#d4a056" />
                  <stop offset="50%" stopColor="#b8860b" />
                  <stop offset="100%" stopColor="#8B6914" />
                </linearGradient>
                <linearGradient id="jh-steel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e2e8f0" />
                  <stop offset="30%" stopColor="#cbd5e1" />
                  <stop offset="70%" stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#64748b" />
                </linearGradient>
                <linearGradient id="jh-boot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#57534e" />
                  <stop offset="100%" stopColor="#292524" />
                </linearGradient>
                <linearGradient id="jh-belt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#92400e" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
                <linearGradient id="jh-hair" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B6914" />
                  <stop offset="100%" stopColor="#5D4037" />
                </linearGradient>
              </defs>

              {/* Ground shadow */}
              <ellipse
                cx="60" cy="194" rx="32" ry="5" fill="#000" opacity="0.1"
                style={{
                  animation: phase === "idle" && !isWalking ? "josh-shadow-pulse 3s ease-in-out infinite" : undefined,
                  transformOrigin: "60px 194px",
                }}
              />

              {/* === LEGS === */}
              <g>
                {/* Left leg */}
                <g style={{
                  transformOrigin: "51px 133px",
                  animation: isWalking ? "josh-walk-left-leg 0.5s ease-in-out infinite" : undefined,
                }}>
                  {/* Thigh */}
                  <path d="M44 133 L42 157 Q42 159 44 159 L54 159 Q56 159 56 157 L55 133 Z" fill="url(#jh-jeans)" />
                  {/* Knee highlight */}
                  <ellipse cx="49" cy="150" rx="5" ry="3" fill="white" opacity="0.04" />
                  {/* Shin */}
                  <path d="M42 157 L41 172 Q41 174 43 174 L55 174 Q57 174 57 172 L56 157 Z" fill="url(#jh-jeans)" />
                  {/* Boot */}
                  <path d="M39 172 L38 183 Q38 188 43 188 L55 188 Q60 188 60 184 L58 172 Z" fill="url(#jh-boot)" />
                  {/* Boot sole */}
                  <rect x="37" y="186" width="24" height="3.5" rx="1.5" fill="#1c1917" />
                  {/* Boot details - lace area */}
                  <path d="M40 178 Q40 174 47 174 L53 174 Q57 174 57 177" fill="none" stroke="#78716c" strokeWidth="0.6" />
                  <line x1="47" y1="174" x2="52" y2="174" stroke="#a8a29e" strokeWidth="0.4" />
                  <line x1="46" y1="176" x2="53" y2="176" stroke="#a8a29e" strokeWidth="0.4" />
                  {/* Boot steel toe cap */}
                  <path d="M38 184 Q38 181 45 180 L54 180 Q59 181 59 184" fill="#44403c" opacity="0.3" />
                </g>
                {/* Right leg */}
                <g style={{
                  transformOrigin: "65px 133px",
                  animation: isWalking ? "josh-walk-right-leg 0.5s ease-in-out infinite" : undefined,
                }}>
                  <path d="M59 133 L57 157 Q57 159 59 159 L69 159 Q71 159 71 157 L70 133 Z" fill="url(#jh-jeans)" />
                  <ellipse cx="64" cy="150" rx="5" ry="3" fill="white" opacity="0.04" />
                  <path d="M57 157 L56 172 Q56 174 58 174 L70 174 Q72 174 72 172 L71 157 Z" fill="url(#jh-jeans)" />
                  <path d="M54 172 L53 183 Q53 188 58 188 L70 188 Q75 188 75 184 L73 172 Z" fill="url(#jh-boot)" />
                  <rect x="52" y="186" width="24" height="3.5" rx="1.5" fill="#1c1917" />
                  <path d="M55 178 Q55 174 62 174 L68 174 Q72 174 72 177" fill="none" stroke="#78716c" strokeWidth="0.6" />
                  <line x1="62" y1="174" x2="67" y2="174" stroke="#a8a29e" strokeWidth="0.4" />
                  <line x1="61" y1="176" x2="68" y2="176" stroke="#a8a29e" strokeWidth="0.4" />
                  <path d="M53 184 Q53 181 60 180 L69 180 Q74 181 74 184" fill="#44403c" opacity="0.3" />
                </g>
              </g>

              {/* === LEFT ARM (wave/point) === */}
              <g style={{ transformOrigin: "38px 82px", animation: leftArmAnim }}>
                {/* Upper arm */}
                <path d="M38 82 Q32 92 28 100" stroke="url(#jh-vest)" strokeWidth="12" strokeLinecap="round" fill="none" />
                {/* Hi-vis stripe on sleeve */}
                <line x1="34" y1="90" x2="30" y2="96" stroke="#fde047" strokeWidth="2" opacity="0.7" strokeLinecap="round" />
                {/* Forearm */}
                <path d="M28 100 Q24 108 20 115" stroke="url(#jh-shirt)" strokeWidth="10" strokeLinecap="round" fill="none" />
                {/* Wrist/hand */}
                <ellipse cx="19" cy="117" rx="6" ry="5.5" fill="url(#jh-skin)" />
                {/* Thumb */}
                <ellipse cx="14" cy="115" rx="2.8" ry="2.2" fill="#f0c9a0" transform="rotate(-15, 14, 115)" />
                {/* Fingers for wave */}
                {armPose === "wave" && (
                  <g>
                    <path d="M15 114 Q13 108 12 105" stroke="#f0c9a0" strokeWidth="3" strokeLinecap="round" fill="none" />
                    <path d="M17 113 Q16 107 15 103" stroke="#f0c9a0" strokeWidth="3" strokeLinecap="round" fill="none" />
                    <path d="M19 113 Q19 107 19 103" stroke="#f0c9a0" strokeWidth="3" strokeLinecap="round" fill="none" />
                    <path d="M22 114 Q22 108 23 104" stroke="#f0c9a0" strokeWidth="3" strokeLinecap="round" fill="none" />
                  </g>
                )}
                {/* Pointing finger */}
                {armPose === "point" && (
                  <path d="M15 115 Q9 110 4 105" stroke="#f0c9a0" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                )}
              </g>

              {/* === BODY (torso) === */}
              <g style={{ animation: bodyAnim, transformOrigin: "60px 107px" }}>
                {/* Shirt base */}
                <path d="M36 80 Q34 80 34 84 L33 128 Q33 132 37 132 L79 132 Q83 132 83 128 L82 84 Q82 80 80 80 Z" fill="url(#jh-shirt)" />
                {/* Shirt wrinkle details */}
                <path d="M55 90 Q58 95 55 100" stroke="#2563eb" strokeWidth="0.5" fill="none" opacity="0.2" />
                <path d="M65 88 Q62 94 65 99" stroke="#2563eb" strokeWidth="0.5" fill="none" opacity="0.15" />

                {/* Hi-vis vest - left panel */}
                <path d="M35 80 L53 80 L53 132 L35 132 Q32 132 32 128 L32 84 Q32 80 35 80 Z" fill="url(#jh-vest)" />
                {/* Hi-vis vest - right panel */}
                <path d="M63 80 L81 80 Q84 80 84 84 L84 128 Q84 132 81 132 L63 132 Z" fill="url(#jh-vest)" />
                {/* Vest V-neck opening showing shirt */}
                <path d="M53 80 L58 94 L63 80" fill="url(#jh-shirt)" />

                {/* Hi-vis reflective stripes */}
                <rect x="32" y="100" width="52" height="3" rx="1" fill="#fde047" opacity="0.85" />
                <rect x="32" y="112" width="52" height="3" rx="1" fill="#fde047" opacity="0.85" />

                {/* Vest pocket (right) */}
                <rect x="66" y="88" width="12" height="8" rx="2" fill="#c2410c" opacity="0.2" />
                <rect x="66" y="88" width="12" height="2.5" rx="1" fill="#c2410c" opacity="0.3" />
                {/* Pen in pocket */}
                <line x1="69" y1="87" x2="69" y2="93" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />

                {/* Tool belt */}
                <rect x="31" y="128" width="54" height="6" rx="2" fill="url(#jh-belt)" />
                {/* Belt buckle */}
                <rect x="54" y="128.5" width="8" height="5" rx="1.5" fill="#b45309" stroke="#92400e" strokeWidth="0.5" />
                {/* Belt loops */}
                <rect x="73" y="126" width="3.5" height="10" rx="1" fill="#78716c" />
                <rect x="39" y="127" width="3" height="8" rx="1" fill="#9ca3af" />
                {/* Tape measure on belt */}
                <circle cx="78" cy="134" r="4" fill="#fbbf24" stroke="#d97706" strokeWidth="0.8" />
                <circle cx="78" cy="134" r="2" fill="#fcd34d" />
              </g>

              {/* === RIGHT ARM + HAMMER (human grip) === */}
              <g style={{ transformOrigin: "78px 82px", animation: rightArmAnim }}>
                {/* Upper arm */}
                <path d="M78 82 Q84 92 88 100" stroke="url(#jh-vest)" strokeWidth="12" strokeLinecap="round" fill="none" />
                {/* Hi-vis stripe on sleeve */}
                <line x1="82" y1="90" x2="86" y2="96" stroke="#fde047" strokeWidth="2" opacity="0.7" strokeLinecap="round" />
                {/* Forearm */}
                <path d="M88 100 Q91 108 93 115" stroke="url(#jh-shirt)" strokeWidth="10" strokeLinecap="round" fill="none" />
                {/* Hand - closed fist gripping hammer handle */}
                <g>
                  {/* Hammer handle - passes THROUGH the fist (human grip) */}
                  <rect x="90" y="108" width="3.5" height="32" rx="1.5" fill="url(#jh-wood)" transform="rotate(5, 92, 124)" />
                  {/* Wood grain lines */}
                  <line x1="90.8" y1="112" x2="93" y2="112" stroke="#92400e" strokeWidth="0.4" opacity="0.3" transform="rotate(5, 92, 124)" />
                  <line x1="90.8" y1="116" x2="93" y2="116" stroke="#92400e" strokeWidth="0.4" opacity="0.3" transform="rotate(5, 92, 124)" />
                  <line x1="90.8" y1="120" x2="93" y2="120" stroke="#92400e" strokeWidth="0.4" opacity="0.3" transform="rotate(5, 92, 124)" />
                  <line x1="90.8" y1="128" x2="93" y2="128" stroke="#92400e" strokeWidth="0.4" opacity="0.3" transform="rotate(5, 92, 124)" />

                  {/* Hammer head */}
                  <g transform="rotate(5, 92, 124)">
                    {/* Main head block */}
                    <rect x="84" y="138" width="18" height="8" rx="2" fill="url(#jh-steel)" />
                    {/* Steel highlight */}
                    <rect x="85" y="139" width="16" height="2.5" rx="1" fill="white" opacity="0.2" />
                    {/* Claw end */}
                    <path d="M84 140 L80 135 M85 142 L81 137" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
                    {/* Strike face */}
                    <rect x="100" y="138" width="3.5" height="8" rx="0.8" fill="#475569" />
                    {/* Steel texture */}
                    <line x1="86" y1="144" x2="100" y2="144" stroke="#64748b" strokeWidth="0.5" opacity="0.3" />
                  </g>

                  {/* Fist wrapping around handle (drawn ON TOP of handle) */}
                  {/* Back of hand */}
                  <ellipse cx="93" cy="117" rx="6.5" ry="5.5" fill="url(#jh-skin)" />
                  {/* Curled fingers gripping handle */}
                  <path d="M88 113 Q86 115 87 118 Q88 120 90 119" fill="#f0c9a0" stroke="#e0a87c" strokeWidth="0.4" />
                  <path d="M88 116 Q86 118 87 121 Q88 123 90 122" fill="#f0c9a0" stroke="#e0a87c" strokeWidth="0.4" />
                  <path d="M89 119 Q87 121 88 124 Q89 126 91 125" fill="#f0c9a0" stroke="#e0a87c" strokeWidth="0.4" />
                  {/* Thumb wrapping from other side */}
                  <path d="M97 114 Q99 116 98 119 Q97 121 95 120" fill="#f0c9a0" stroke="#e0a87c" strokeWidth="0.4" />
                  {/* Knuckle highlights */}
                  <circle cx="89" cy="114" r="1.2" fill="#fde8d0" opacity="0.5" />
                  <circle cx="89" cy="117" r="1.2" fill="#fde8d0" opacity="0.5" />
                  <circle cx="89" cy="120" r="1.2" fill="#fde8d0" opacity="0.4" />
                </g>
              </g>

              {/* === HEAD === */}
              <g>
                {/* Neck */}
                <path d="M53 68 L53 82 Q53 84 55 84 L65 84 Q67 84 67 82 L67 68 Z" fill="url(#jh-skin)" />
                {/* Neck shadow */}
                <path d="M53 76 Q60 80 67 76" fill="#d4a574" opacity="0.15" />
                {/* Shirt collar */}
                <path d="M50 80 L55 74 L60 80" fill="url(#jh-shirt)" />
                <path d="M60 80 L65 74 L70 80" fill="url(#jh-shirt)" />

                {/* Head shape - more realistic oval */}
                <ellipse cx="60" cy="50" rx="22" ry="24" fill="url(#jh-skin)" />
                {/* Jaw definition */}
                <path d="M40 56 Q50 72 60 72 Q70 72 80 56" fill="url(#jh-skin)" />
                {/* Chin */}
                <ellipse cx="60" cy="69" rx="8" ry="4" fill="url(#jh-skin)" />
                {/* Jaw shadow */}
                <path d="M42 58 Q50 70 60 70 Q70 70 78 58" fill="#d4a574" opacity="0.08" />

                {/* Ears */}
                <ellipse cx="37" cy="52" rx="4" ry="7" fill="#f0c9a0" />
                <ellipse cx="37" cy="52" rx="2.5" ry="5" fill="#e8a882" opacity="0.25" />
                <path d="M36 48 Q35 52 36 55" fill="none" stroke="#d4a574" strokeWidth="0.5" opacity="0.3" />
                <ellipse cx="83" cy="52" rx="4" ry="7" fill="#f0c9a0" />
                <ellipse cx="83" cy="52" rx="2.5" ry="5" fill="#e8a882" opacity="0.25" />
                <path d="M84 48 Q85 52 84 55" fill="none" stroke="#d4a574" strokeWidth="0.5" opacity="0.3" />

                {/* Hair visible under hat - sideburns and back */}
                <path d="M38 35 Q40 30 39 38" fill="url(#jh-hair)" opacity="0.8" />
                <path d="M82 35 Q80 30 81 38" fill="url(#jh-hair)" opacity="0.8" />
                <path d="M40 37 Q42 33 41 40" fill="url(#jh-hair)" opacity="0.6" />
                <path d="M80 37 Q78 33 79 40" fill="url(#jh-hair)" opacity="0.6" />
                {/* Stubble hint on jaw */}
                <ellipse cx="60" cy="65" rx="12" ry="5" fill="#8B6914" opacity="0.04" />

                {/* Eyes - more detailed and natural */}
                <g style={{ animation: "josh-blink 4s ease-in-out infinite", transformOrigin: "60px 48px" }}>
                  {/* Left eye */}
                  <ellipse cx="51" cy="48" rx="5.5" ry="5" fill="white" />
                  <ellipse cx="51" cy="48" rx="5.5" ry="5" fill="none" stroke="#c8a882" strokeWidth="0.5" opacity="0.4" />
                  {/* Upper eyelid crease */}
                  <path d="M46 44 Q51 42 56 44" fill="none" stroke="#c8a882" strokeWidth="0.6" opacity="0.3" />
                  {/* Iris */}
                  <circle cx="52" cy="48.5" r="3.8" fill="#5D4037" />
                  {/* Pupil */}
                  <circle cx="52" cy="48.5" r="2.3" fill="#2C1810" />
                  {/* Eye highlights */}
                  <circle cx="53.5" cy="47" r="1.5" fill="white" />
                  <circle cx="51" cy="50" r="0.7" fill="white" opacity="0.4" />
                  {/* Lower lash line */}
                  <path d="M46 51 Q51 53 56 51" fill="none" stroke="#c8a882" strokeWidth="0.3" opacity="0.3" />

                  {/* Right eye */}
                  <ellipse cx="69" cy="48" rx="5.5" ry="5" fill="white" />
                  <ellipse cx="69" cy="48" rx="5.5" ry="5" fill="none" stroke="#c8a882" strokeWidth="0.5" opacity="0.4" />
                  <path d="M64 44 Q69 42 74 44" fill="none" stroke="#c8a882" strokeWidth="0.6" opacity="0.3" />
                  <circle cx="68" cy="48.5" r="3.8" fill="#5D4037" />
                  <circle cx="68" cy="48.5" r="2.3" fill="#2C1810" />
                  <circle cx="69.5" cy="47" r="1.5" fill="white" />
                  <circle cx="67" cy="50" r="0.7" fill="white" opacity="0.4" />
                  <path d="M64 51 Q69 53 74 51" fill="none" stroke="#c8a882" strokeWidth="0.3" opacity="0.3" />
                </g>

                {/* Eyebrows - thicker, more natural */}
                {alertCount > 3 ? (
                  <>
                    <path d="M45 38 Q51 34 57 39" stroke="#5D4037" strokeWidth="2.8" fill="none" strokeLinecap="round" />
                    <path d="M63 39 Q69 34 75 38" stroke="#5D4037" strokeWidth="2.8" fill="none" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <path d="M45 40 Q51 36 57 40" stroke="#5D4037" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <path d="M63 40 Q69 36 75 40" stroke="#5D4037" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  </>
                )}

                {/* Nose - more defined */}
                <path d="M59 43 Q60 50 60 55" stroke="#d4a574" strokeWidth="1.2" fill="none" opacity="0.2" />
                <path d="M56 56 Q60 60 64 56" fill="#e0a87c" opacity="0.6" />
                <ellipse cx="60" cy="57" rx="4" ry="2" fill="#e0a87c" opacity="0.4" />
                {/* Nostril hints */}
                <circle cx="57" cy="57" r="1.2" fill="#d4a574" opacity="0.2" />
                <circle cx="63" cy="57" r="1.2" fill="#d4a574" opacity="0.2" />

                {/* Mouth */}
                {isCelebrating ? (
                  <g>
                    <path d="M52 62 Q60 73 68 62" stroke="#b91c1c" strokeWidth="2" fill="#fecaca" strokeLinecap="round" />
                    <path d="M54 62 Q60 66 66 62" fill="white" />
                  </g>
                ) : alertCount > 3 ? (
                  <path d="M54 64 Q60 61 66 64" stroke="#b91c1c" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                ) : (
                  <g>
                    {/* Upper lip */}
                    <path d="M54 62 Q57 60 60 61 Q63 60 66 62" stroke="#c0392b" strokeWidth="1" fill="none" opacity="0.6" />
                    {/* Smile */}
                    <path d="M53 62 Q60 70 67 62" stroke="#c0392b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                  </g>
                )}

                {/* Cheek blush - subtle */}
                <ellipse cx="43" cy="56" rx="5" ry="3.5" fill="#fca5a5" opacity="0.15" />
                <ellipse cx="77" cy="56" rx="5" ry="3.5" fill="#fca5a5" opacity="0.15" />

                {/* Nasolabial folds (smile lines) - very subtle */}
                <path d="M47 54 Q48 58 52 63" fill="none" stroke="#d4a574" strokeWidth="0.4" opacity="0.15" />
                <path d="M73 54 Q72 58 68 63" fill="none" stroke="#d4a574" strokeWidth="0.4" opacity="0.15" />

                {/* Hard hat */}
                <g style={{
                  animation: phase === "idle" && !isWalking ? "josh-hat-wobble 3s ease-in-out infinite" : undefined,
                  transformOrigin: "60px 25px",
                }}>
                  {/* Hat dome */}
                  <path d="M34 34 Q34 8 60 5 Q86 8 86 34 Z" fill="url(#jh-hat)" />
                  {/* Hat ridge/keel */}
                  <path d="M52 6 Q60 3 68 6" fill="none" stroke="#d97706" strokeWidth="2" opacity="0.4" />
                  {/* Highlight reflection */}
                  <path d="M42 28 Q48 12 62 10" fill="none" stroke="white" strokeWidth="2" opacity="0.15" strokeLinecap="round" />
                  {/* Brim */}
                  <rect x="27" y="32" width="66" height="6" rx="3" fill="#b45309" />
                  <rect x="29" y="32" width="62" height="2.8" rx="1.2" fill="#d97706" opacity="0.5" />
                  <rect x="30" y="36.5" width="60" height="1.5" rx="0.7" fill="#92400e" opacity="0.3" />
                  {/* Front light/logo */}
                  <circle cx="60" cy="18" r="5.5" fill="#fef9c3" opacity="0.75" />
                  <circle cx="60" cy="18" r="3.5" fill="#fde68a" />
                  <circle cx="60" cy="18" r="1.8" fill="white" opacity="0.85" />
                  {/* Suspension band visible inside brim */}
                  <rect x="38" y="27" width="44" height="4" rx="2" fill="#92400e" opacity="0.3" />
                </g>
              </g>

              {/* Confetti when celebrating */}
              {isCelebrating && showBubble && (
                <g>
                  {["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4", "#f97316"].map((color, i) => (
                    <rect
                      key={i}
                      x={10 + i * 13}
                      y={-5}
                      width={i % 2 === 0 ? "4" : "3"}
                      height={i % 2 === 0 ? "4" : "5"}
                      rx="1"
                      fill={color}
                      style={{
                        animation: `josh-confetti 2s ease-in ${0.15 * i}s infinite`,
                        transformOrigin: `${12 + i * 13}px 0px`,
                      }}
                    />
                  ))}
                </g>
              )}
            </svg>

            {/* Name plate */}
            <div className="flex justify-center -mt-1">
              <div className="bg-amber-500 dark:bg-amber-600 text-white text-[9px] font-bold tracking-[0.15em] uppercase px-3.5 py-0.5 rounded-full shadow-sm">
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
      @keyframes josh-walk-left-leg {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-20deg); }
        50% { transform: rotate(0deg); }
        75% { transform: rotate(20deg); }
      }
      @keyframes josh-walk-right-leg {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(20deg); }
        50% { transform: rotate(0deg); }
        75% { transform: rotate(-20deg); }
      }
      @keyframes josh-walk-left-arm {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(12deg); }
        50% { transform: rotate(0deg); }
        75% { transform: rotate(-12deg); }
      }
      @keyframes josh-walk-right-arm {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-8deg); }
        50% { transform: rotate(0deg); }
        75% { transform: rotate(8deg); }
      }
      @keyframes josh-bob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      @keyframes josh-wave {
        0%, 100% { transform: rotate(0deg); }
        15% { transform: rotate(-40deg); }
        30% { transform: rotate(15deg); }
        45% { transform: rotate(-30deg); }
        60% { transform: rotate(10deg); }
        75% { transform: rotate(-15deg); }
        90% { transform: rotate(5deg); }
      }
      @keyframes josh-point {
        0% { transform: rotate(0deg); }
        60% { transform: rotate(-55deg); }
        100% { transform: rotate(-50deg); }
      }
      @keyframes josh-blink {
        0%, 90%, 100% { transform: scaleY(1); }
        94% { transform: scaleY(0.05); }
      }
      @keyframes josh-breathe {
        0%, 100% { transform: scaleX(1); }
        50% { transform: scaleX(1.015); }
      }
      @keyframes josh-bubble-in {
        0% { opacity: 0; transform: scale(0.7) translateY(8px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes josh-hat-wobble {
        0%, 100% { transform: rotate(0deg); }
        30% { transform: rotate(-2deg); }
        60% { transform: rotate(1.5deg); }
      }
      @keyframes josh-celebrate {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        25% { transform: translateY(-15px) rotate(-5deg); }
        50% { transform: translateY(-20px) rotate(5deg); }
        75% { transform: translateY(-8px) rotate(-3deg); }
      }
      @keyframes josh-confetti {
        0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(80px) rotate(720deg); opacity: 0; }
      }
      @keyframes josh-hammer-tap {
        0%, 75%, 100% { transform: rotate(0deg); }
        12% { transform: rotate(-8deg); }
        24% { transform: rotate(2deg); }
        32% { transform: rotate(-3deg); }
        40% { transform: rotate(0deg); }
      }
      @keyframes josh-shadow-pulse {
        0%, 100% { transform: scaleX(1); opacity: 0.1; }
        50% { transform: scaleX(0.85); opacity: 0.07; }
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
