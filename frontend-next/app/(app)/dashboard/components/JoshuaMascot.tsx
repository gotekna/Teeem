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
    ? "josh-hammer-tap 4s ease-in-out infinite"
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
            <svg viewBox="0 0 100 160" width="115" height="184" className="drop-shadow-lg">
              <defs>
                <linearGradient id="jh-hat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fcd34d" />
                  <stop offset="50%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
                <radialGradient id="jh-skin" cx="0.4" cy="0.3">
                  <stop offset="0%" stopColor="#fde8d0" />
                  <stop offset="100%" stopColor="#f0c9a0" />
                </radialGradient>
                <linearGradient id="jh-vest" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
                <linearGradient id="jh-shirt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
                <linearGradient id="jh-jeans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                <linearGradient id="jh-wood" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#d4a056" />
                  <stop offset="50%" stopColor="#b8860b" />
                  <stop offset="100%" stopColor="#8B6914" />
                </linearGradient>
                <linearGradient id="jh-steel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#cbd5e1" />
                  <stop offset="50%" stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#64748b" />
                </linearGradient>
                <linearGradient id="jh-boot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4b5563" />
                  <stop offset="100%" stopColor="#1f2937" />
                </linearGradient>
              </defs>

              {/* Ground shadow */}
              <ellipse
                cx="50" cy="152" rx="30" ry="4" fill="#000" opacity="0.1"
                style={{
                  animation: phase === "idle" && !isWalking ? "josh-shadow-pulse 3s ease-in-out infinite" : undefined,
                  transformOrigin: "50px 152px",
                }}
              />

              {/* === LEGS === */}
              <g>
                {/* Left leg */}
                <g style={{
                  transformOrigin: "42px 107px",
                  animation: isWalking ? "josh-walk-left-leg 0.5s ease-in-out infinite" : undefined,
                }}>
                  <path d="M37 107 L36 132 Q36 136 39 136 L47 136 Q49 136 49 134 L48 107 Z" fill="url(#jh-jeans)" />
                  <ellipse cx="42" cy="120" rx="4" ry="2" fill="white" opacity="0.06" />
                  <path d="M34 132 L34 143 Q34 147 38 147 L48 147 Q52 147 52 144 L50 132 Z" fill="url(#jh-boot)" />
                  <rect x="33" y="145" width="20" height="3" rx="1.5" fill="#111827" />
                  <path d="M34 140 Q34 136 40 136 L48 136 Q50 136 50 138" fill="none" stroke="#6b7280" strokeWidth="0.7" />
                  <line x1="40" y1="134" x2="46" y2="134" stroke="#9ca3af" strokeWidth="0.5" />
                  <line x1="40" y1="136" x2="46" y2="136" stroke="#9ca3af" strokeWidth="0.5" />
                  <line x1="40" y1="138" x2="46" y2="138" stroke="#9ca3af" strokeWidth="0.5" />
                </g>
                {/* Right leg */}
                <g style={{
                  transformOrigin: "58px 107px",
                  animation: isWalking ? "josh-walk-right-leg 0.5s ease-in-out infinite" : undefined,
                }}>
                  <path d="M52 107 L51 132 Q51 136 54 136 L62 136 Q64 136 64 134 L63 107 Z" fill="url(#jh-jeans)" />
                  <ellipse cx="58" cy="120" rx="4" ry="2" fill="white" opacity="0.06" />
                  <path d="M49 132 L49 143 Q49 147 53 147 L63 147 Q67 147 67 144 L65 132 Z" fill="url(#jh-boot)" />
                  <rect x="48" y="145" width="20" height="3" rx="1.5" fill="#111827" />
                  <path d="M49 140 Q49 136 55 136 L63 136 Q65 136 65 138" fill="none" stroke="#6b7280" strokeWidth="0.7" />
                  <line x1="55" y1="134" x2="61" y2="134" stroke="#9ca3af" strokeWidth="0.5" />
                  <line x1="55" y1="136" x2="61" y2="136" stroke="#9ca3af" strokeWidth="0.5" />
                  <line x1="55" y1="138" x2="61" y2="138" stroke="#9ca3af" strokeWidth="0.5" />
                </g>
              </g>

              {/* === LEFT ARM (wave/point) === */}
              <g style={{ transformOrigin: "32px 68px", animation: leftArmAnim }}>
                <path d="M32 68 Q26 76 22 84" stroke="url(#jh-vest)" strokeWidth="11" strokeLinecap="round" fill="none" />
                <path d="M22 84 Q18 90 16 95" stroke="url(#jh-shirt)" strokeWidth="9" strokeLinecap="round" fill="none" />
                <ellipse cx="15" cy="97" rx="5.5" ry="5" fill="url(#jh-skin)" />
                <ellipse cx="11" cy="95" rx="2.5" ry="2" fill="#f0c9a0" transform="rotate(-20, 11, 95)" />
                {armPose === "wave" && (
                  <g>
                    <line x1="12" y1="94" x2="9" y2="89" stroke="#f0c9a0" strokeWidth="2.8" strokeLinecap="round" />
                    <line x1="14" y1="93" x2="12" y2="87" stroke="#f0c9a0" strokeWidth="2.8" strokeLinecap="round" />
                    <line x1="16" y1="93" x2="15" y2="87" stroke="#f0c9a0" strokeWidth="2.8" strokeLinecap="round" />
                    <line x1="18" y1="94" x2="18" y2="88" stroke="#f0c9a0" strokeWidth="2.8" strokeLinecap="round" />
                  </g>
                )}
                {armPose === "point" && (
                  <line x1="12" y1="95" x2="3" y2="88" stroke="#f0c9a0" strokeWidth="3.2" strokeLinecap="round" />
                )}
              </g>

              {/* === BODY === */}
              <g style={{ animation: bodyAnim, transformOrigin: "50px 85px" }}>
                <path d="M30 66 Q28 66 28 70 L27 102 Q27 106 31 106 L69 106 Q73 106 73 102 L72 70 Q72 66 70 66 Z" fill="url(#jh-shirt)" />
                <path d="M29 66 L46 66 L46 106 L29 106 Q26 106 26 102 L26 70 Q26 66 29 66 Z" fill="url(#jh-vest)" />
                <path d="M54 66 L71 66 Q74 66 74 70 L74 102 Q74 106 71 106 L54 106 Z" fill="url(#jh-vest)" />
                <path d="M46 66 L50 76 L54 66" fill="url(#jh-shirt)" />
                <rect x="26" y="80" width="48" height="3.5" rx="1.5" fill="#fde047" opacity="0.85" />
                <rect x="26" y="90" width="48" height="3.5" rx="1.5" fill="#fde047" opacity="0.85" />
                <rect x="58" y="72" width="10" height="7" rx="2" fill="#c2410c" opacity="0.25" />
                <rect x="58" y="72" width="10" height="2.5" rx="1" fill="#c2410c" opacity="0.35" />
                <line x1="60" y1="71" x2="60" y2="76" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="25" y="103" width="50" height="5.5" rx="2" fill="#78350f" />
                <rect x="46" y="103.5" width="8" height="4.5" rx="1.5" fill="#b45309" stroke="#92400e" strokeWidth="0.5" />
                <rect x="63" y="100" width="3.5" height="10" rx="1.5" fill="#6b7280" />
                <rect x="33" y="101" width="3" height="8" rx="1" fill="#9ca3af" />
              </g>

              {/* === RIGHT ARM + HAMMER === */}
              <g style={{ transformOrigin: "68px 68px", animation: rightArmAnim }}>
                <path d="M68 68 Q74 76 78 84" stroke="url(#jh-vest)" strokeWidth="11" strokeLinecap="round" fill="none" />
                <path d="M78 84 Q82 90 84 95" stroke="url(#jh-shirt)" strokeWidth="9" strokeLinecap="round" fill="none" />
                <ellipse cx="85" cy="97" rx="5.5" ry="5" fill="url(#jh-skin)" />
                {/* Hammer */}
                <g>
                  <rect x="83" y="97" width="3.5" height="28" rx="1.5" fill="url(#jh-wood)" />
                  <line x1="83.5" y1="100" x2="86" y2="100" stroke="#92400e" strokeWidth="0.5" opacity="0.3" />
                  <line x1="83.5" y1="103" x2="86" y2="103" stroke="#92400e" strokeWidth="0.5" opacity="0.3" />
                  <line x1="83.5" y1="106" x2="86" y2="106" stroke="#92400e" strokeWidth="0.5" opacity="0.3" />
                  <rect x="77" y="123" width="16" height="7" rx="2" fill="url(#jh-steel)" />
                  <rect x="78" y="124" width="14" height="2" rx="1" fill="white" opacity="0.15" />
                  <path d="M77 124 L73 119 M78 126 L74 121" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" />
                  <rect x="91" y="123" width="3" height="7" rx="0.5" fill="#475569" />
                </g>
              </g>

              {/* === HEAD === */}
              <g>
                <rect x="43" y="55" width="14" height="13" rx="5" fill="#f0c9a0" />
                <rect x="43" y="55" width="14" height="5" rx="3" fill="#d4a574" opacity="0.2" />
                <ellipse cx="50" cy="42" rx="20" ry="21" fill="url(#jh-skin)" />
                <ellipse cx="50" cy="55" rx="14" ry="5" fill="#d4a574" opacity="0.12" />

                {/* Ears */}
                <ellipse cx="29" cy="44" rx="4.5" ry="6.5" fill="#f0c9a0" />
                <ellipse cx="29" cy="44" rx="2.5" ry="4" fill="#e8a882" opacity="0.3" />
                <ellipse cx="71" cy="44" rx="4.5" ry="6.5" fill="#f0c9a0" />
                <ellipse cx="71" cy="44" rx="2.5" ry="4" fill="#e8a882" opacity="0.3" />

                {/* Hair tufts under hat */}
                <path d="M31 30 Q33 26 32 32" fill="#6B4226" opacity="0.7" />
                <path d="M69 30 Q67 26 68 32" fill="#6B4226" opacity="0.7" />
                <path d="M33 31 Q35 28 34 33" fill="#6B4226" opacity="0.5" />

                {/* Eyes with detail */}
                <g style={{ animation: "josh-blink 4s ease-in-out infinite", transformOrigin: "50px 40px" }}>
                  <ellipse cx="41" cy="40" rx="5" ry="5.5" fill="white" />
                  <ellipse cx="41" cy="40" rx="5" ry="5.5" fill="none" stroke="#d4a574" strokeWidth="0.5" opacity="0.3" />
                  <circle cx="42" cy="40.5" r="3.5" fill="#5D4037" />
                  <circle cx="42" cy="40.5" r="2.2" fill="#2C1810" />
                  <circle cx="43.5" cy="39" r="1.4" fill="white" />
                  <circle cx="41" cy="42" r="0.6" fill="white" opacity="0.4" />

                  <ellipse cx="59" cy="40" rx="5" ry="5.5" fill="white" />
                  <ellipse cx="59" cy="40" rx="5" ry="5.5" fill="none" stroke="#d4a574" strokeWidth="0.5" opacity="0.3" />
                  <circle cx="58" cy="40.5" r="3.5" fill="#5D4037" />
                  <circle cx="58" cy="40.5" r="2.2" fill="#2C1810" />
                  <circle cx="59.5" cy="39" r="1.4" fill="white" />
                  <circle cx="57" cy="42" r="0.6" fill="white" opacity="0.4" />
                </g>

                {/* Eyebrows */}
                {alertCount > 3 ? (
                  <>
                    <path d="M35 31 Q41 28 47 32" stroke="#5D4037" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <path d="M53 32 Q59 28 65 31" stroke="#5D4037" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <path d="M35 33 Q41 29 47 33" stroke="#5D4037" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                    <path d="M53 33 Q59 29 65 33" stroke="#5D4037" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                  </>
                )}

                {/* Nose */}
                <path d="M49 46 Q50 49 51 46" fill="#e0a87c" />
                <ellipse cx="50" cy="47.5" rx="3" ry="1.8" fill="#e0a87c" opacity="0.5" />
                <line x1="50" y1="38" x2="50" y2="45" stroke="#d4a574" strokeWidth="1" opacity="0.12" />

                {/* Mouth */}
                {isCelebrating ? (
                  <g>
                    <path d="M42 52 Q50 62 58 52" stroke="#b91c1c" strokeWidth="2" fill="#fecaca" strokeLinecap="round" />
                    <path d="M44 52 Q50 55 56 52" fill="white" />
                  </g>
                ) : alertCount > 3 ? (
                  <path d="M44 54 Q50 51 56 54" stroke="#b91c1c" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                ) : (
                  <path d="M43 52 Q50 59 57 52" stroke="#c0392b" strokeWidth="2" fill="none" strokeLinecap="round" />
                )}

                {/* Cheek blush */}
                <circle cx="34" cy="48" r="4.5" fill="#fca5a5" opacity="0.2" />
                <circle cx="66" cy="48" r="4.5" fill="#fca5a5" opacity="0.2" />

                {/* Hard hat */}
                <g style={{
                  animation: phase === "idle" && !isWalking ? "josh-hat-wobble 3s ease-in-out infinite" : undefined,
                  transformOrigin: "50px 20px",
                }}>
                  <path d="M26 27 Q26 5 50 3 Q74 5 74 27 Z" fill="url(#jh-hat)" />
                  <path d="M34 22 Q38 10 52 8" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2" strokeLinecap="round" />
                  <rect x="19" y="25" width="62" height="6" rx="3" fill="#b45309" />
                  <rect x="21" y="25" width="58" height="2.5" rx="1.2" fill="#d97706" opacity="0.5" />
                  <rect x="22" y="29" width="56" height="1.5" rx="0.7" fill="#92400e" opacity="0.3" />
                  <circle cx="50" cy="14" r="5" fill="#fef9c3" opacity="0.8" />
                  <circle cx="50" cy="14" r="3" fill="#fde68a" />
                  <circle cx="50" cy="14" r="1.5" fill="white" opacity="0.9" />
                  <rect x="30" y="21" width="40" height="3.5" rx="1.5" fill="#92400e" opacity="0.35" />
                </g>
              </g>

              {/* Confetti when celebrating */}
              {isCelebrating && showBubble && (
                <g>
                  {["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4", "#f97316"].map((color, i) => (
                    <rect
                      key={i}
                      x={8 + i * 11}
                      y={-5}
                      width={i % 2 === 0 ? "4" : "3"}
                      height={i % 2 === 0 ? "4" : "5"}
                      rx="1"
                      fill={color}
                      style={{
                        animation: `josh-confetti 2s ease-in ${0.15 * i}s infinite`,
                        transformOrigin: `${10 + i * 11}px 0px`,
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
        50% { transform: translateY(-6px); }
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
        0%, 70%, 100% { transform: rotate(0deg); }
        15% { transform: rotate(-12deg); }
        30% { transform: rotate(3deg); }
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
