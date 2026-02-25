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
            <svg viewBox="0 0 140 220" width="120" height="188" className="drop-shadow-lg">
              <defs>
                {/* Refined gradients for depth */}
                <linearGradient id="jh-hat" x1="0" y1="0" x2="0.15" y2="1">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="25%" stopColor="#fbbf24" />
                  <stop offset="70%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
                <linearGradient id="jh-hat-shade" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
                <radialGradient id="jh-skin" cx="0.38" cy="0.28" r="0.65">
                  <stop offset="0%" stopColor="#fde8d0" />
                  <stop offset="45%" stopColor="#f5d4b3" />
                  <stop offset="80%" stopColor="#e8b48a" />
                  <stop offset="100%" stopColor="#d4a574" />
                </radialGradient>
                <radialGradient id="jh-skin-hi" cx="0.3" cy="0.2" r="0.5">
                  <stop offset="0%" stopColor="#fff5eb" />
                  <stop offset="100%" stopColor="#fde8d0" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="jh-vest" x1="0" y1="0" x2="0.2" y2="1">
                  <stop offset="0%" stopColor="#fdba74" />
                  <stop offset="30%" stopColor="#fb923c" />
                  <stop offset="70%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#c2410c" />
                </linearGradient>
                <linearGradient id="jh-vest-shade" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ea580c" />
                  <stop offset="100%" stopColor="#9a3412" />
                </linearGradient>
                <linearGradient id="jh-shirt" x1="0.2" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#93c5fd" />
                  <stop offset="40%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
                <linearGradient id="jh-shirt-shade" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                <linearGradient id="jh-jeans" x1="0.2" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="30%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                <linearGradient id="jh-jeans-shade" x1="1" y1="0" x2="0" y2="0.8">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1e3a8a" />
                </linearGradient>
                <linearGradient id="jh-wood" x1="0" y1="0" x2="0.8" y2="1">
                  <stop offset="0%" stopColor="#d4a056" />
                  <stop offset="30%" stopColor="#c08430" />
                  <stop offset="60%" stopColor="#b8860b" />
                  <stop offset="100%" stopColor="#8B6914" />
                </linearGradient>
                <linearGradient id="jh-steel" x1="0.1" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f1f5f9" />
                  <stop offset="20%" stopColor="#cbd5e1" />
                  <stop offset="50%" stopColor="#94a3b8" />
                  <stop offset="80%" stopColor="#64748b" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
                <linearGradient id="jh-boot" x1="0.2" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#78716c" />
                  <stop offset="30%" stopColor="#57534e" />
                  <stop offset="100%" stopColor="#1c1917" />
                </linearGradient>
                <linearGradient id="jh-belt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a16207" />
                  <stop offset="50%" stopColor="#854d0e" />
                  <stop offset="100%" stopColor="#713f12" />
                </linearGradient>
                <linearGradient id="jh-hair" x1="0.3" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a0764a" />
                  <stop offset="50%" stopColor="#7c5b34" />
                  <stop offset="100%" stopColor="#5D4037" />
                </linearGradient>
                {/* Soft shadow filter */}
                <filter id="jh-softshadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                  <feOffset dx="1" dy="2" />
                  <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" />
                  <feFlood floodColor="#000" floodOpacity="0.12" />
                  <feComposite in2="SourceGraphic" operator="in" />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Ground shadow - soft ellipse */}
              <ellipse
                cx="70" cy="214" rx="34" ry="5" fill="#000" opacity="0.12"
                style={{
                  animation: phase === "idle" && !isWalking ? "josh-shadow-pulse 3s ease-in-out infinite" : undefined,
                  transformOrigin: "70px 214px",
                }}
              />

              {/* === LEGS === */}
              <g>
                {/* Left leg */}
                <g style={{
                  transformOrigin: "58px 148px",
                  animation: isWalking ? "josh-walk-left-leg 0.5s ease-in-out infinite" : undefined,
                }}>
                  {/* Full leg shape - organic contour */}
                  <path d="M50 148 C49 155 48 162 47 170 C46 175 46 178 47 180 L47 188 C47 190 48 191 50 191 L62 191 C64 191 65 190 65 188 L65 180 C66 178 66 175 65 170 C64 162 63 155 62 148 Z" fill="url(#jh-jeans)" />
                  {/* Inner leg shadow */}
                  <path d="M60 148 C60 158 60 168 60 178 L62 148 Z" fill="url(#jh-jeans-shade)" opacity="0.3" />
                  {/* Knee highlight */}
                  <ellipse cx="55" cy="168" rx="5" ry="4" fill="white" opacity="0.06" />
                  {/* Knee crease */}
                  <path d="M50 166 Q55 168 61 166" fill="none" stroke="#1e40af" strokeWidth="0.6" opacity="0.25" />
                  {/* Jean hem fold */}
                  <path d="M47 186 Q55 189 63 186" fill="none" stroke="#1e40af" strokeWidth="0.8" opacity="0.15" />

                  {/* Boot - organic shape */}
                  <path d="M45 188 C44 192 43 196 43 200 C43 205 46 208 51 208 L63 208 C68 208 70 206 70 202 C70 198 68 194 66 188 Z" fill="url(#jh-boot)" />
                  {/* Boot sole - thick rubber */}
                  <path d="M42 205 C42 209 45 211 50 211 L64 211 C69 211 71 209 71 206 L71 205 C71 204 70 204 69 205 L44 205 C43 205 42 205 42 205 Z" fill="#0c0a09" />
                  {/* Boot tongue */}
                  <path d="M49 188 C49 190 50 191 53 191 L60 191 C62 191 63 190 63 188" fill="#44403c" opacity="0.5" />
                  {/* Boot lace details */}
                  <line x1="53" y1="190" x2="59" y2="190" stroke="#a8a29e" strokeWidth="0.5" />
                  <line x1="52" y1="192" x2="60" y2="192" stroke="#a8a29e" strokeWidth="0.5" />
                  <line x1="52" y1="194" x2="60" y2="194" stroke="#a8a29e" strokeWidth="0.5" />
                  {/* Steel toe cap shine */}
                  <path d="M44 202 C45 199 50 198 58 198 C64 198 68 199 69 201" fill="none" stroke="white" strokeWidth="0.6" opacity="0.12" />
                </g>

                {/* Right leg */}
                <g style={{
                  transformOrigin: "78px 148px",
                  animation: isWalking ? "josh-walk-right-leg 0.5s ease-in-out infinite" : undefined,
                }}>
                  <path d="M72 148 C71 155 70 162 69 170 C68 175 68 178 69 180 L69 188 C69 190 70 191 72 191 L84 191 C86 191 87 190 87 188 L87 180 C88 178 88 175 87 170 C86 162 85 155 84 148 Z" fill="url(#jh-jeans)" />
                  <path d="M82 148 C82 158 82 168 82 178 L84 148 Z" fill="url(#jh-jeans-shade)" opacity="0.3" />
                  <ellipse cx="77" cy="168" rx="5" ry="4" fill="white" opacity="0.06" />
                  <path d="M72 166 Q77 168 83 166" fill="none" stroke="#1e40af" strokeWidth="0.6" opacity="0.25" />
                  <path d="M69 186 Q77 189 85 186" fill="none" stroke="#1e40af" strokeWidth="0.8" opacity="0.15" />

                  <path d="M67 188 C66 192 65 196 65 200 C65 205 68 208 73 208 L85 208 C90 208 92 206 92 202 C92 198 90 194 88 188 Z" fill="url(#jh-boot)" />
                  <path d="M64 205 C64 209 67 211 72 211 L86 211 C91 211 93 209 93 206 L93 205 C93 204 92 204 91 205 L66 205 C65 205 64 205 64 205 Z" fill="#0c0a09" />
                  <path d="M71 188 C71 190 72 191 75 191 L82 191 C84 191 85 190 85 188" fill="#44403c" opacity="0.5" />
                  <line x1="75" y1="190" x2="81" y2="190" stroke="#a8a29e" strokeWidth="0.5" />
                  <line x1="74" y1="192" x2="82" y2="192" stroke="#a8a29e" strokeWidth="0.5" />
                  <line x1="74" y1="194" x2="82" y2="194" stroke="#a8a29e" strokeWidth="0.5" />
                  <path d="M66 202 C67 199 72 198 80 198 C86 198 90 199 91 201" fill="none" stroke="white" strokeWidth="0.6" opacity="0.12" />
                </g>
              </g>

              {/* === LEFT ARM (wave/point) === */}
              <g style={{ transformOrigin: "44px 94px", animation: leftArmAnim }}>
                {/* Upper arm - shaped */}
                <path d="M44 94 C40 100 36 106 33 113" stroke="url(#jh-vest)" strokeWidth="14" strokeLinecap="round" fill="none" />
                {/* Arm shadow */}
                <path d="M44 94 C40 100 36 106 33 113" stroke="url(#jh-vest-shade)" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.15" />
                {/* Sleeve cuff / hi-vis */}
                <path d="M38 103 C36 106 34 109 33 111" stroke="#fde047" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />

                {/* Forearm */}
                <path d="M33 113 C29 121 25 128 22 134" stroke="url(#jh-shirt)" strokeWidth="12" strokeLinecap="round" fill="none" />
                <path d="M33 113 C29 121 25 128 22 134" stroke="url(#jh-shirt-shade)" strokeWidth="12" strokeLinecap="round" fill="none" opacity="0.1" />

                {/* Wrist + hand base */}
                <path d="M18 131 C14 133 12 136 14 139 C16 142 20 143 24 141 C28 139 29 136 27 133 C26 131 22 130 18 131 Z" fill="url(#jh-skin)" />
                {/* Skin highlight */}
                <ellipse cx="20" cy="135" rx="4" ry="3" fill="url(#jh-skin-hi)" opacity="0.4" />

                {/* Thumb */}
                <path d="M14 133 C11 131 10 133 11 136 C12 138 14 139 15 137" fill="#f0c9a0" stroke="#d4a574" strokeWidth="0.5" />

                {/* Fingers when waving - naturally spread */}
                {armPose === "wave" && (
                  <g>
                    <path d="M16 132 C14 126 12 122 11 119" stroke="#f0c9a0" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                    <path d="M18 131 C17 125 16 120 15 116" stroke="#f0c9a0" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                    <path d="M21 131 C21 125 21 120 21 116" stroke="#f0c9a0" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                    <path d="M24 132 C25 126 26 121 27 118" stroke="#f0c9a0" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                    {/* Fingertip highlights */}
                    <circle cx="11" cy="119" r="2" fill="#fde8d0" />
                    <circle cx="15" cy="116" r="2" fill="#fde8d0" />
                    <circle cx="21" cy="116" r="2" fill="#fde8d0" />
                    <circle cx="27" cy="118" r="2" fill="#fde8d0" />
                  </g>
                )}
                {/* Pointing finger */}
                {armPose === "point" && (
                  <g>
                    <path d="M16 133 C10 127 6 122 2 118" stroke="#f0c9a0" strokeWidth="4" strokeLinecap="round" fill="none" />
                    <circle cx="2" cy="118" r="2.2" fill="#fde8d0" />
                  </g>
                )}
              </g>

              {/* === BODY (torso) === */}
              <g style={{ animation: bodyAnim, transformOrigin: "70px 120px" }}>
                {/* Torso base - shirt with natural contour */}
                <path d="M42 91 C40 91 38 93 38 96 L37 142 C37 146 40 148 44 148 L92 148 C96 148 99 146 99 142 L98 96 C98 93 96 91 94 91 Z" fill="url(#jh-shirt)" />
                {/* Shirt shadow - right side */}
                <path d="M80 91 L94 91 C96 91 98 93 98 96 L99 142 C99 146 96 148 92 148 L80 148 Z" fill="url(#jh-shirt-shade)" opacity="0.12" />

                {/* Shirt wrinkle folds - subtle curves */}
                <path d="M62 100 C64 108 62 116 64 124" stroke="#2563eb" strokeWidth="0.6" fill="none" opacity="0.12" />
                <path d="M76 98 C74 106 76 114 74 122" stroke="#2563eb" strokeWidth="0.6" fill="none" opacity="0.1" />
                <path d="M55 95 C57 100 55 105 57 110" stroke="#2563eb" strokeWidth="0.5" fill="none" opacity="0.08" />

                {/* Hi-vis vest - left panel with shape */}
                <path d="M42 91 C40 91 38 92 38 95 L38 142 C38 146 40 148 44 148 L60 148 L60 91 Z" fill="url(#jh-vest)" />
                {/* Vest left shadow */}
                <path d="M38 91 L44 91 L44 148 L38 148 C36 148 36 146 36 142 L36 96 C36 93 38 91 38 91 Z" fill="url(#jh-vest-shade)" opacity="0.15" />

                {/* Hi-vis vest - right panel */}
                <path d="M76 91 L98 91 C100 93 100 96 100 96 L100 142 C100 146 98 148 94 148 L76 148 Z" fill="url(#jh-vest)" />
                <path d="M94 91 L98 91 C100 93 100 96 100 96 L100 142 C100 146 98 148 94 148 Z" fill="url(#jh-vest-shade)" opacity="0.15" />

                {/* V-neck opening showing shirt */}
                <path d="M60 91 L68 108 L76 91" fill="url(#jh-shirt)" />
                {/* V shadow */}
                <path d="M62 91 L68 105 L74 91" fill="none" stroke="#1d4ed8" strokeWidth="0.5" opacity="0.15" />

                {/* Hi-vis reflective tape bands */}
                <path d="M38 114 L100 114" stroke="#fde047" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
                <path d="M38 114 L100 114" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.15" />
                <path d="M38 128 L100 128" stroke="#fde047" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
                <path d="M38 128 L100 128" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.15" />

                {/* Vest pocket - right chest */}
                <path d="M80 98 L92 98 C93 98 94 99 94 100 L94 108 C94 109 93 110 92 110 L80 110 C79 110 78 109 78 108 L78 100 C78 99 79 98 80 98 Z" fill="#c2410c" opacity="0.18" />
                <path d="M80 98 L92 98 C93 98 94 99 94 100 L94 101 L78 101 L78 100 C78 99 79 98 80 98 Z" fill="#c2410c" opacity="0.28" />
                {/* Pen clip */}
                <line x1="84" y1="96" x2="84" y2="105" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="84" cy="96" r="1" fill="#3b82f6" />

                {/* Tool belt with depth */}
                <path d="M37 143 L99 143 C100 143 101 144 101 145 L101 150 C101 151 100 152 99 152 L37 152 C36 152 35 151 35 150 L35 145 C35 144 36 143 37 143 Z" fill="url(#jh-belt)" />
                {/* Belt highlight */}
                <path d="M37 143 L99 143" stroke="#b45309" strokeWidth="1" opacity="0.3" />
                {/* Belt buckle - metallic */}
                <rect x="62" y="143.5" width="12" height="8" rx="2" fill="#d97706" stroke="#92400e" strokeWidth="0.8" />
                <rect x="64" y="145" width="8" height="5" rx="1" fill="#fbbf24" opacity="0.4" />
                <circle cx="68" cy="147.5" r="1.5" fill="#92400e" opacity="0.4" />

                {/* Belt loop left */}
                <rect x="44" y="141" width="4" height="12" rx="1.5" fill="#a16207" opacity="0.6" />
                {/* Belt loop right */}
                <rect x="88" y="141" width="4" height="12" rx="1.5" fill="#a16207" opacity="0.6" />

                {/* Tape measure on belt - 3D-ish */}
                <circle cx="94" cy="152" r="5" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
                <circle cx="94" cy="152" r="3" fill="#fcd34d" />
                <circle cx="94" cy="152" r="1.2" fill="#f59e0b" />
                <path d="M92 149 C93 148 95 148 96 149" fill="none" stroke="white" strokeWidth="0.5" opacity="0.4" />
              </g>

              {/* === RIGHT ARM + HAMMER (natural human grip) === */}
              <g style={{ transformOrigin: "92px 94px", animation: rightArmAnim }}>
                {/* Upper arm */}
                <path d="M92 94 C96 100 100 106 103 113" stroke="url(#jh-vest)" strokeWidth="14" strokeLinecap="round" fill="none" />
                <path d="M92 94 C96 100 100 106 103 113" stroke="url(#jh-vest-shade)" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.12" />
                {/* Sleeve cuff / hi-vis */}
                <path d="M98 103 C100 106 102 109 103 111" stroke="#fde047" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />

                {/* Forearm */}
                <path d="M103 113 C106 121 108 128 110 134" stroke="url(#jh-shirt)" strokeWidth="12" strokeLinecap="round" fill="none" />

                {/* Hammer assembly - handle through fist */}
                <g>
                  {/* Handle below hand */}
                  <path d="M108 130 L112 168" stroke="url(#jh-wood)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
                  {/* Wood grain texture */}
                  <line x1="108.5" y1="140" x2="110.5" y2="140" stroke="#92400e" strokeWidth="0.4" opacity="0.25" />
                  <line x1="109" y1="145" x2="111" y2="145" stroke="#92400e" strokeWidth="0.4" opacity="0.25" />
                  <line x1="109.5" y1="150" x2="111.5" y2="150" stroke="#92400e" strokeWidth="0.4" opacity="0.25" />
                  <line x1="109.8" y1="155" x2="111.8" y2="155" stroke="#92400e" strokeWidth="0.4" opacity="0.2" />
                  <line x1="110.2" y1="160" x2="112.2" y2="160" stroke="#92400e" strokeWidth="0.4" opacity="0.2" />
                  {/* Handle highlight */}
                  <path d="M108.5 132 L112 166" stroke="#d4a056" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.3" />

                  {/* Hammer head - forged steel look */}
                  <g transform="rotate(3, 112, 168)">
                    {/* Head body */}
                    <path d="M102 165 C101 163 101 162 103 162 L122 162 C124 162 125 163 125 165 L125 173 C125 175 124 176 122 176 L103 176 C101 176 101 175 102 173 Z" fill="url(#jh-steel)" />
                    {/* Top bevel highlight */}
                    <path d="M103 162 L122 162 C124 162 125 163 125 164 L101 164 C101 163 102 162 103 162 Z" fill="white" opacity="0.2" />
                    {/* Bottom edge shadow */}
                    <path d="M103 175 L122 175" stroke="#334155" strokeWidth="0.8" opacity="0.3" />
                    {/* Claw fork - V shape */}
                    <path d="M103 165 L97 158 C96 157 97 156 98 157 L103 163" fill="url(#jh-steel)" stroke="#475569" strokeWidth="0.8" />
                    <path d="M103 168 L98 162 C97 161 96 161 97 162 L103 169" fill="url(#jh-steel)" stroke="#475569" strokeWidth="0.8" />
                    {/* Claw gap */}
                    <path d="M98 158 L97.5 162" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
                    {/* Strike face (right side) */}
                    <rect x="123" y="162" width="4" height="14" rx="1.5" fill="#475569" />
                    <rect x="123.5" y="163" width="1" height="12" rx="0.5" fill="white" opacity="0.08" />
                    {/* Side face bevel */}
                    <path d="M125 163 L127 163 L127 175 L125 175" fill="#334155" opacity="0.5" />
                  </g>

                  {/* HAND gripping handle - drawn ON TOP */}
                  {/* Hand back/palm */}
                  <path d="M104 130 C100 131 98 134 99 138 C100 142 104 144 108 143 C112 142 114 139 113 135 C112 132 108 130 104 130 Z" fill="url(#jh-skin)" />
                  {/* Skin highlight on hand */}
                  <ellipse cx="106" cy="135" rx="4" ry="3" fill="url(#jh-skin-hi)" opacity="0.35" />

                  {/* Fingers curling around handle from front */}
                  <path d="M101 132 C99 134 99 137 100 139 C101 140 103 139 103 137 L103 134 C103 133 102 132 101 132 Z" fill="#f0c9a0" stroke="#d4a574" strokeWidth="0.4" />
                  <path d="M101 136 C99 138 99 140 100 142 C101 143 103 142 103 140 L103 138 C103 137 102 136 101 136 Z" fill="#f0c9a0" stroke="#d4a574" strokeWidth="0.4" />
                  <path d="M102 139 C100 141 100 143 101 145 C102 146 104 145 104 143 L104 141 C104 140 103 139 102 139 Z" fill="#f0c9a0" stroke="#d4a574" strokeWidth="0.4" />

                  {/* Thumb wrapping from far side */}
                  <path d="M112 133 C114 135 114 138 113 140 C112 141 110 140 111 138 L111 135 C111 134 112 133 112 133 Z" fill="#f0c9a0" stroke="#d4a574" strokeWidth="0.4" />

                  {/* Knuckle bumps */}
                  <circle cx="102" cy="133" r="1.5" fill="#fde8d0" opacity="0.4" />
                  <circle cx="102" cy="137" r="1.5" fill="#fde8d0" opacity="0.35" />
                  <circle cx="103" cy="141" r="1.5" fill="#fde8d0" opacity="0.3" />
                </g>
              </g>

              {/* === HEAD + FACE === */}
              <g>
                {/* Neck - tapered cylinder */}
                <path d="M61 78 C61 82 60 86 60 90 L60 94 C60 96 62 97 65 97 L73 97 C76 97 78 96 78 94 L78 90 C78 86 77 82 77 78 Z" fill="url(#jh-skin)" />
                {/* Neck shadow under chin */}
                <path d="M62 80 C66 83 72 83 76 80" fill="#c8956c" opacity="0.15" />
                {/* Adam's apple subtle */}
                <ellipse cx="69" cy="86" rx="1.5" ry="2" fill="#d4a574" opacity="0.08" />

                {/* Collar - folded shirt collar */}
                <path d="M57 92 L63 84 L69 93" fill="url(#jh-shirt)" />
                <path d="M69 93 L75 84 L81 92" fill="url(#jh-shirt)" />
                {/* Collar shadow */}
                <path d="M58 92 L63 86 L68 92" fill="none" stroke="#1d4ed8" strokeWidth="0.5" opacity="0.2" />
                <path d="M70 92 L75 86 L80 92" fill="none" stroke="#1d4ed8" strokeWidth="0.5" opacity="0.2" />

                {/* Head - organic face shape with jaw */}
                <path d="M44 54 C44 36 53 26 69 26 C85 26 94 36 94 54 C94 62 92 68 88 73 C84 78 78 81 69 81 C60 81 54 78 50 73 C46 68 44 62 44 54 Z" fill="url(#jh-skin)" />
                {/* Face highlight - top left forehead area */}
                <path d="M52 38 C55 32 64 29 72 30 C78 31 82 34 83 38 C78 34 66 32 55 36 Z" fill="url(#jh-skin-hi)" opacity="0.25" />
                {/* Jaw shadow */}
                <path d="M52 70 C58 78 69 80 80 76 C86 73 90 68 90 65 C88 72 80 77 69 77 C58 77 52 72 52 70 Z" fill="#c8956c" opacity="0.1" />
                {/* Chin definition */}
                <path d="M63 78 C66 80 72 80 75 78" fill="none" stroke="#c8956c" strokeWidth="0.5" opacity="0.12" />

                {/* Ears - more anatomical */}
                {/* Left ear */}
                <path d="M44 50 C40 48 38 50 38 55 C38 60 40 63 44 62" fill="#f0c9a0" />
                <path d="M42 51 C40 52 39 54 39 57 C39 59 40 61 42 61" fill="#e8a882" opacity="0.3" />
                <path d="M41 53 C40 55 40 57 41 59" fill="none" stroke="#d4a574" strokeWidth="0.6" opacity="0.25" />

                {/* Right ear */}
                <path d="M94 50 C98 48 100 50 100 55 C100 60 98 63 94 62" fill="#f0c9a0" />
                <path d="M96 51 C98 52 99 54 99 57 C99 59 98 61 96 61" fill="#e8a882" opacity="0.3" />
                <path d="M97 53 C98 55 98 57 97 59" fill="none" stroke="#d4a574" strokeWidth="0.6" opacity="0.25" />

                {/* Hair - sideburns and under hat */}
                <path d="M45 38 C44 34 46 32 45 40" fill="url(#jh-hair)" opacity="0.7" />
                <path d="M47 36 C46 33 48 31 47 38" fill="url(#jh-hair)" opacity="0.5" />
                <path d="M93 38 C94 34 92 32 93 40" fill="url(#jh-hair)" opacity="0.7" />
                <path d="M91 36 C92 33 90 31 91 38" fill="url(#jh-hair)" opacity="0.5" />

                {/* Eyes - detailed with depth */}
                <g style={{ animation: "josh-blink 4s ease-in-out infinite", transformOrigin: "69px 52px" }}>
                  {/* Left eye socket shadow */}
                  <ellipse cx="59" cy="52" rx="8" ry="7" fill="#d4a574" opacity="0.06" />
                  {/* Left eyeball */}
                  <ellipse cx="59" cy="52" rx="6.5" ry="6" fill="white" />
                  <ellipse cx="59" cy="52" rx="6.5" ry="6" fill="none" stroke="#c8a882" strokeWidth="0.6" opacity="0.35" />
                  {/* Upper lid weight */}
                  <path d="M53 48 C56 45 62 45 65 48" fill="none" stroke="#8B6914" strokeWidth="1.2" opacity="0.3" strokeLinecap="round" />
                  {/* Iris - rich brown with rings */}
                  <circle cx="60" cy="52.5" r="4.2" fill="#6D4C2E" />
                  <circle cx="60" cy="52.5" r="3.5" fill="#5D4037" />
                  {/* Pupil */}
                  <circle cx="60" cy="52.5" r="2.2" fill="#1a0f0a" />
                  {/* Iris ring detail */}
                  <circle cx="60" cy="52.5" r="3.8" fill="none" stroke="#8B6914" strokeWidth="0.3" opacity="0.3" />
                  {/* Eye sparkle */}
                  <circle cx="62" cy="50.5" r="1.8" fill="white" />
                  <circle cx="58" cy="54" r="0.8" fill="white" opacity="0.5" />
                  {/* Lower lid */}
                  <path d="M53 55 C56 57 62 57 65 55" fill="none" stroke="#c8a882" strokeWidth="0.4" opacity="0.25" />

                  {/* Right eye */}
                  <ellipse cx="79" cy="52" rx="8" ry="7" fill="#d4a574" opacity="0.06" />
                  <ellipse cx="79" cy="52" rx="6.5" ry="6" fill="white" />
                  <ellipse cx="79" cy="52" rx="6.5" ry="6" fill="none" stroke="#c8a882" strokeWidth="0.6" opacity="0.35" />
                  <path d="M73 48 C76 45 82 45 85 48" fill="none" stroke="#8B6914" strokeWidth="1.2" opacity="0.3" strokeLinecap="round" />
                  <circle cx="78" cy="52.5" r="4.2" fill="#6D4C2E" />
                  <circle cx="78" cy="52.5" r="3.5" fill="#5D4037" />
                  <circle cx="78" cy="52.5" r="2.2" fill="#1a0f0a" />
                  <circle cx="78" cy="52.5" r="3.8" fill="none" stroke="#8B6914" strokeWidth="0.3" opacity="0.3" />
                  <circle cx="80" cy="50.5" r="1.8" fill="white" />
                  <circle cx="76" cy="54" r="0.8" fill="white" opacity="0.5" />
                  <path d="M73 55 C76 57 82 57 85 55" fill="none" stroke="#c8a882" strokeWidth="0.4" opacity="0.25" />
                </g>

                {/* Eyebrows - full shaped brows */}
                {alertCount > 3 ? (
                  <>
                    <path d="M52 42 C56 37 62 37 66 41" stroke="#5D4037" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <path d="M72 41 C76 37 82 37 86 42" stroke="#5D4037" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <path d="M52 44 C56 39 63 39 66 43" stroke="#5D4037" strokeWidth="2.8" fill="none" strokeLinecap="round" />
                    <path d="M72 43 C76 39 83 39 86 44" stroke="#5D4037" strokeWidth="2.8" fill="none" strokeLinecap="round" />
                  </>
                )}

                {/* Nose bridge + tip */}
                <path d="M68 44 C68 50 67 56 67 60" stroke="#c8956c" strokeWidth="1.2" fill="none" opacity="0.15" />
                <path d="M63 62 C65 65 69 66 73 65 C75 64 76 63 75 62" fill="#d4a574" opacity="0.35" />
                {/* Nose bridge highlight */}
                <path d="M68 46 C69 50 69 54 68 58" stroke="white" strokeWidth="0.8" fill="none" opacity="0.08" />
                {/* Nostrils */}
                <ellipse cx="65" cy="63" rx="1.8" ry="1.2" fill="#c8956c" opacity="0.2" />
                <ellipse cx="73" cy="63" rx="1.8" ry="1.2" fill="#c8956c" opacity="0.2" />
                {/* Nose tip roundness */}
                <ellipse cx="69" cy="62" rx="5" ry="2.5" fill="#e0a87c" opacity="0.15" />

                {/* Mouth */}
                {isCelebrating ? (
                  <g>
                    {/* Big open smile */}
                    <path d="M59 68 C64 79 74 79 79 68" stroke="#991b1b" strokeWidth="1.5" fill="#fecaca" strokeLinecap="round" />
                    {/* Teeth */}
                    <path d="M61 68 C66 72 72 72 77 68" fill="white" />
                    {/* Tongue hint */}
                    <ellipse cx="69" cy="74" rx="4" ry="2" fill="#ef4444" opacity="0.4" />
                  </g>
                ) : alertCount > 3 ? (
                  <g>
                    {/* Concerned frown */}
                    <path d="M62 70 C66 67 72 67 76 70" stroke="#991b1b" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </g>
                ) : (
                  <g>
                    {/* Natural friendly smile */}
                    {/* Upper lip with cupid's bow */}
                    <path d="M62 68 C65 66 67 67 69 66 C71 67 73 66 76 68" stroke="#b45309" strokeWidth="0.8" fill="none" opacity="0.35" />
                    {/* Lower lip / smile curve */}
                    <path d="M60 68 C64 76 74 76 78 68" stroke="#b91c1c" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                    {/* Lower lip fullness */}
                    <path d="M63 71 C66 74 72 74 75 71" fill="#e0a87c" opacity="0.12" />
                  </g>
                )}

                {/* Cheek blush - soft warm glow */}
                <ellipse cx="50" cy="62" rx="6" ry="4" fill="#fca5a5" opacity="0.12" />
                <ellipse cx="88" cy="62" rx="6" ry="4" fill="#fca5a5" opacity="0.12" />

                {/* Smile lines - very subtle nasolabial */}
                <path d="M54 58 C56 63 59 68 61 70" fill="none" stroke="#c8956c" strokeWidth="0.4" opacity="0.1" />
                <path d="M84 58 C82 63 79 68 77 70" fill="none" stroke="#c8956c" strokeWidth="0.4" opacity="0.1" />

                {/* Hard hat - detailed with ridges and depth */}
                <g style={{
                  animation: phase === "idle" && !isWalking ? "josh-hat-wobble 3s ease-in-out infinite" : undefined,
                  transformOrigin: "69px 28px",
                }}>
                  {/* Hat dome - smooth curved shell */}
                  <path d="M40 37 C40 18 50 8 69 6 C88 8 98 18 98 37 Z" fill="url(#jh-hat)" />
                  {/* Right shadow on dome */}
                  <path d="M82 10 C90 14 96 22 98 37 L90 37 C90 24 86 16 80 12 Z" fill="url(#jh-hat-shade)" opacity="0.2" />

                  {/* Central ridge/keel line */}
                  <path d="M69 6 C69 10 69 20 69 30" stroke="#d97706" strokeWidth="2" opacity="0.2" strokeLinecap="round" />

                  {/* Glossy highlight across dome */}
                  <path d="M50 30 C56 14 68 10 78 12" fill="none" stroke="white" strokeWidth="2.5" opacity="0.12" strokeLinecap="round" />
                  <path d="M48 26 C52 16 62 12 70 12" fill="none" stroke="white" strokeWidth="1.5" opacity="0.08" strokeLinecap="round" />

                  {/* Brim - thick with curvature */}
                  <path d="M32 35 C32 32 35 30 40 30 L98 30 C103 30 106 32 106 35 L106 40 C106 42 104 43 100 43 L38 43 C34 43 32 42 32 40 Z" fill="#b45309" />
                  {/* Brim top highlight */}
                  <path d="M34 32 L104 32" stroke="#d97706" strokeWidth="2" opacity="0.4" strokeLinecap="round" />
                  {/* Brim underside shadow */}
                  <path d="M36 42 L102 42" stroke="#78350f" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />

                  {/* Front headlamp/logo circle */}
                  <circle cx="69" cy="20" r="6" fill="#fef9c3" opacity="0.7" />
                  <circle cx="69" cy="20" r="4" fill="#fde68a" />
                  <circle cx="69" cy="20" r="2" fill="white" opacity="0.8" />
                  {/* Lamp ring */}
                  <circle cx="69" cy="20" r="5" fill="none" stroke="#d97706" strokeWidth="0.8" opacity="0.4" />

                  {/* Inner suspension band */}
                  <path d="M44 33 L94 33" stroke="#92400e" strokeWidth="3" opacity="0.25" strokeLinecap="round" />
                </g>
              </g>

              {/* Confetti when celebrating */}
              {isCelebrating && showBubble && (
                <g>
                  {["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4", "#f97316"].map((color, i) => (
                    <rect
                      key={i}
                      x={12 + i * 14}
                      y={-5}
                      width={i % 2 === 0 ? "5" : "4"}
                      height={i % 2 === 0 ? "5" : "6"}
                      rx="1"
                      fill={color}
                      style={{
                        animation: `josh-confetti 2s ease-in ${0.15 * i}s infinite`,
                        transformOrigin: `${14 + i * 14}px 0px`,
                      }}
                    />
                  ))}
                </g>
              )}
            </svg>

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
