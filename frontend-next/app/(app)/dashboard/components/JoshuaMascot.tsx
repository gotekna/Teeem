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
            <svg viewBox="0 0 160 240" width="128" height="192" overflow="visible" className="drop-shadow-lg">
              <defs>
                {/* Hard hat gradients */}
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
                {/* Skin with warm radial highlights */}
                <radialGradient id="jh-skin" cx="0.4" cy="0.3" r="0.65">
                  <stop offset="0%" stopColor="#fde8d0" />
                  <stop offset="40%" stopColor="#f5d4b3" />
                  <stop offset="75%" stopColor="#e8b48a" />
                  <stop offset="100%" stopColor="#d4a574" />
                </radialGradient>
                <radialGradient id="jh-skin-hi" cx="0.3" cy="0.2" r="0.5">
                  <stop offset="0%" stopColor="#fff5eb" />
                  <stop offset="100%" stopColor="#fde8d0" stopOpacity="0" />
                </radialGradient>
                {/* Hi-vis vest */}
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
                {/* Blue work shirt */}
                <linearGradient id="jh-shirt" x1="0.2" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#93c5fd" />
                  <stop offset="40%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
                <linearGradient id="jh-shirt-shade" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                {/* Jeans */}
                <linearGradient id="jh-jeans" x1="0.2" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="30%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                <linearGradient id="jh-jeans-shade" x1="1" y1="0" x2="0" y2="0.8">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1e3a8a" />
                </linearGradient>
                {/* (hammer gradients removed) */}
                {/* Boots */}
                <linearGradient id="jh-boot" x1="0.2" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#78716c" />
                  <stop offset="30%" stopColor="#57534e" />
                  <stop offset="100%" stopColor="#1c1917" />
                </linearGradient>
                {/* Belt */}
                <linearGradient id="jh-belt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a16207" />
                  <stop offset="50%" stopColor="#854d0e" />
                  <stop offset="100%" stopColor="#713f12" />
                </linearGradient>
                {/* Hair */}
                <linearGradient id="jh-hair" x1="0.3" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a0764a" />
                  <stop offset="50%" stopColor="#7c5b34" />
                  <stop offset="100%" stopColor="#5D4037" />
                </linearGradient>
              </defs>

              {/* Ground shadow */}
              <ellipse
                cx="78" cy="233" rx="38" ry="5" fill="#000" opacity="0.1"
                style={{
                  animation: phase === "idle" && !isWalking ? "josh-shadow-pulse 3s ease-in-out infinite" : undefined,
                  transformOrigin: "78px 233px",
                }}
              />

              {/* === LEGS === */}
              <g>
                {/* Left leg */}
                <g style={{
                  transformOrigin: "62px 162px",
                  animation: isWalking ? "josh-walk-left-leg 0.5s ease-in-out infinite" : undefined,
                }}>
                  {/* Thigh - muscular taper */}
                  <path d="M54 162 C52 168 51 174 50 180 C49 186 50 192 51 198 L51 204 C51 206 53 207 55 207 L67 207 C69 207 70 206 70 204 L70 198 C71 192 72 186 71 180 C70 174 69 168 68 162 Z" fill="url(#jh-jeans)" />
                  {/* Inner seam shadow */}
                  <path d="M66 162 C66 175 65 188 65 200 L68 162 Z" fill="url(#jh-jeans-shade)" opacity="0.25" />
                  {/* Knee cap highlight */}
                  <ellipse cx="59" cy="183" rx="6" ry="4" fill="white" opacity="0.06" />
                  {/* Knee crease */}
                  <path d="M52 181 Q59 184 67 181" fill="none" stroke="#1e40af" strokeWidth="0.6" opacity="0.2" />
                  {/* Hem fold */}
                  <path d="M51 202 Q59 205 68 202" fill="none" stroke="#1e40af" strokeWidth="0.7" opacity="0.12" />

                  {/* Work boot */}
                  <path d="M49 204 C48 208 47 212 47 216 C47 222 50 225 56 225 L68 225 C73 225 76 222 76 218 C76 214 74 209 72 204 Z" fill="url(#jh-boot)" />
                  {/* Boot sole */}
                  <path d="M46 222 C46 226 49 228 55 228 L69 228 C74 228 77 226 77 223 L77 222 C76 221 75 222 73 222 L49 222 C47 222 46 222 46 222 Z" fill="#0c0a09" />
                  {/* Boot tongue */}
                  <path d="M53 204 C54 207 56 208 59 208 L65 208 C67 208 68 207 69 204" fill="#44403c" opacity="0.4" />
                  {/* Laces */}
                  <line x1="57" y1="207" x2="64" y2="207" stroke="#a8a29e" strokeWidth="0.5" />
                  <line x1="56" y1="210" x2="65" y2="210" stroke="#a8a29e" strokeWidth="0.5" />
                  <line x1="56" y1="213" x2="65" y2="213" stroke="#a8a29e" strokeWidth="0.5" />
                  {/* Steel toe shine */}
                  <path d="M48 219 C50 216 56 215 64 215 C70 215 74 216 75 218" fill="none" stroke="white" strokeWidth="0.5" opacity="0.1" />
                </g>

                {/* Right leg */}
                <g style={{
                  transformOrigin: "86px 162px",
                  animation: isWalking ? "josh-walk-right-leg 0.5s ease-in-out infinite" : undefined,
                }}>
                  <path d="M80 162 C78 168 77 174 76 180 C75 186 76 192 77 198 L77 204 C77 206 79 207 81 207 L93 207 C95 207 96 206 96 204 L96 198 C97 192 98 186 97 180 C96 174 95 168 94 162 Z" fill="url(#jh-jeans)" />
                  <path d="M92 162 C92 175 91 188 91 200 L94 162 Z" fill="url(#jh-jeans-shade)" opacity="0.25" />
                  <ellipse cx="85" cy="183" rx="6" ry="4" fill="white" opacity="0.06" />
                  <path d="M78 181 Q85 184 93 181" fill="none" stroke="#1e40af" strokeWidth="0.6" opacity="0.2" />
                  <path d="M77 202 Q85 205 94 202" fill="none" stroke="#1e40af" strokeWidth="0.7" opacity="0.12" />

                  <path d="M75 204 C74 208 73 212 73 216 C73 222 76 225 82 225 L94 225 C99 225 102 222 102 218 C102 214 100 209 98 204 Z" fill="url(#jh-boot)" />
                  <path d="M72 222 C72 226 75 228 81 228 L95 228 C100 228 103 226 103 223 L103 222 C102 221 101 222 99 222 L75 222 C73 222 72 222 72 222 Z" fill="#0c0a09" />
                  <path d="M79 204 C80 207 82 208 85 208 L91 208 C93 208 94 207 95 204" fill="#44403c" opacity="0.4" />
                  <line x1="83" y1="207" x2="90" y2="207" stroke="#a8a29e" strokeWidth="0.5" />
                  <line x1="82" y1="210" x2="91" y2="210" stroke="#a8a29e" strokeWidth="0.5" />
                  <line x1="82" y1="213" x2="91" y2="213" stroke="#a8a29e" strokeWidth="0.5" />
                  <path d="M74 219 C76 216 82 215 90 215 C96 215 100 216 101 218" fill="none" stroke="white" strokeWidth="0.5" opacity="0.1" />
                </g>
              </g>

              {/* === LEFT ARM (wave/point) === */}
              <g style={{ transformOrigin: "48px 100px", animation: leftArmAnim }}>
                {/* Shoulder cap - rounded deltoid */}
                <path d="M42 96 C36 97 30 100 28 106 C27 110 30 112 34 112 L44 110 C48 108 50 104 48 100 Z" fill="url(#jh-vest)" />
                {/* Shoulder shadow */}
                <path d="M46 96 C48 100 48 105 45 110 L44 110 C48 106 48 101 46 97 Z" fill="url(#jh-vest-shade)" opacity="0.2" />
                {/* Reflective band on sleeve */}
                <path d="M30 107 C32 104 35 102 38 102 L42 103 C40 105 37 107 35 109 Z" fill="#fde047" opacity="0.7" />

                {/* Bicep - natural taper from shoulder to elbow */}
                <path d="M28 110 C26 116 24 122 22 128 C21 132 23 134 26 134 L34 133 C37 132 39 128 38 124 C37 118 36 114 34 110 Z" fill="url(#jh-shirt)" />
                {/* Bicep inner shadow */}
                <path d="M34 110 C36 116 36 122 34 128 L38 124 C37 118 36 114 34 110 Z" fill="url(#jh-shirt-shade)" opacity="0.12" />

                {/* Forearm - tapers to wrist */}
                <path d="M22 132 C19 138 16 144 14 150 C13 153 15 155 18 155 L26 154 C29 153 31 150 30 146 C29 140 28 136 26 132 Z" fill="url(#jh-skin)" />
                {/* Forearm muscle shadow */}
                <path d="M26 132 C28 138 28 144 26 150 L30 146 C29 140 28 136 26 132 Z" fill="#d4a574" opacity="0.12" />

                {/* Hand - relaxed open */}
                <path d="M12 149 C8 151 7 155 9 159 C11 163 16 164 20 162 C24 160 25 156 23 153 C21 150 16 148 12 149 Z" fill="url(#jh-skin)" />
                {/* Thumb */}
                <path d="M20 152 C22 150 24 150 25 152" stroke="url(#jh-skin)" strokeWidth="3.5" fill="none" strokeLinecap="round" />

                {/* Fingers when waving - spread open */}
                {armPose === "wave" && (
                  <g>
                    <path d="M11 150 C8 142 6 136 5 130" stroke="#f0c9a0" strokeWidth="4.5" strokeLinecap="round" fill="none" />
                    <path d="M14 148 C12 140 11 134 10 128" stroke="#f0c9a0" strokeWidth="4.5" strokeLinecap="round" fill="none" />
                    <path d="M18 148 C17 140 17 134 17 128" stroke="#f0c9a0" strokeWidth="4.5" strokeLinecap="round" fill="none" />
                    <path d="M22 150 C23 142 24 136 25 131" stroke="#f0c9a0" strokeWidth="4" strokeLinecap="round" fill="none" />
                  </g>
                )}
                {/* Pointing finger */}
                {armPose === "point" && (
                  <path d="M11 151 C5 143 1 137 -3 131" stroke="#f0c9a0" strokeWidth="5" strokeLinecap="round" fill="none" />
                )}
              </g>

              {/* === BODY (torso) === */}
              <g style={{ animation: bodyAnim, transformOrigin: "78px 132px" }}>
                {/* Torso base shirt - broad shoulders tapering to waist */}
                <path d="M40 96 C38 96 36 98 36 102 L37 156 C37 160 40 162 44 162 L108 162 C112 162 115 160 115 156 L116 102 C116 98 114 96 112 96 Z" fill="url(#jh-shirt)" />
                {/* Shirt shadow right */}
                <path d="M96 96 L112 96 C114 96 116 98 116 102 L115 156 C115 160 112 162 108 162 L96 162 Z" fill="url(#jh-shirt-shade)" opacity="0.1" />

                {/* Shirt wrinkle folds */}
                <path d="M68 106 C70 114 68 122 70 130" stroke="#2563eb" strokeWidth="0.6" fill="none" opacity="0.1" />
                <path d="M84 104 C82 112 84 120 82 128" stroke="#2563eb" strokeWidth="0.6" fill="none" opacity="0.08" />
                <path d="M58 102 C60 108 58 114 60 120" stroke="#2563eb" strokeWidth="0.5" fill="none" opacity="0.07" />

                {/* Hi-vis vest - left panel */}
                <path d="M40 96 C38 96 36 98 36 102 L37 156 C37 160 40 162 44 162 L66 162 L66 96 Z" fill="url(#jh-vest)" />
                <path d="M36 96 L44 96 L44 162 L37 162 C35 162 35 160 35 156 L35 102 C35 98 37 96 40 96 Z" fill="url(#jh-vest-shade)" opacity="0.12" />

                {/* Hi-vis vest - right panel */}
                <path d="M86 96 L112 96 C114 96 116 98 116 102 L115 156 C115 160 112 162 108 162 L86 162 Z" fill="url(#jh-vest)" />
                <path d="M108 96 L112 96 C114 96 116 98 116 102 L115 156 C115 160 112 162 108 162 Z" fill="url(#jh-vest-shade)" opacity="0.12" />

                {/* V-neck chest opening */}
                <path d="M66 96 L76 118 L86 96" fill="url(#jh-shirt)" />
                <path d="M68 96 L76 115 L84 96" fill="none" stroke="#1d4ed8" strokeWidth="0.5" opacity="0.12" />

                {/* Hi-vis reflective tape bands */}
                <path d="M36 124 L116 124" stroke="#fde047" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
                <path d="M36 124 L116 124" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
                <path d="M36 140 L116 140" stroke="#fde047" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
                <path d="M36 140 L116 140" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />

                {/* Vest pocket - right chest */}
                <path d="M90 104 L106 104 C107 104 108 105 108 106 L108 116 C108 117 107 118 106 118 L90 118 C89 118 88 117 88 116 L88 106 C88 105 89 104 90 104 Z" fill="#c2410c" opacity="0.15" />
                <path d="M90 104 L106 104 C107 104 108 105 108 106 L108 108 L88 108 L88 106 C88 105 89 104 90 104 Z" fill="#c2410c" opacity="0.25" />
                {/* Pen */}
                <line x1="96" y1="102" x2="96" y2="113" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
                <circle cx="96" cy="102" r="1.2" fill="#3b82f6" />

                {/* Tool belt */}
                <path d="M37 156 L115 156 C116 156 117 157 117 159 L117 164 C117 166 116 167 115 167 L37 167 C36 167 35 166 35 164 L35 159 C35 157 36 156 37 156 Z" fill="url(#jh-belt)" />
                {/* Belt buckle */}
                <rect x="70" y="157" width="14" height="9" rx="2" fill="#d97706" stroke="#92400e" strokeWidth="0.8" />
                <rect x="72" y="159" width="10" height="5" rx="1" fill="#fbbf24" opacity="0.3" />

                {/* Tape measure on belt */}
                <circle cx="110" cy="167" r="6" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
                <circle cx="110" cy="167" r="4" fill="#fcd34d" />
                <circle cx="110" cy="167" r="1.8" fill="#f59e0b" />
              </g>

              {/* === RIGHT ARM + HAMMER === */}
              <g style={{ transformOrigin: "104px 100px", animation: rightArmAnim }}>
                {/* Shoulder cap - rounded deltoid */}
                <path d="M110 96 C116 97 122 100 124 106 C125 110 122 112 118 112 L108 110 C104 108 102 104 104 100 Z" fill="url(#jh-vest)" />
                <path d="M106 96 C104 100 104 105 107 110 L108 110 C104 106 104 101 106 97 Z" fill="url(#jh-vest-shade)" opacity="0.2" />
                {/* Reflective band */}
                <path d="M122 107 C120 104 117 102 114 102 L110 103 C112 105 115 107 117 109 Z" fill="#fde047" opacity="0.7" />

                {/* Bicep */}
                <path d="M124 110 C126 116 128 122 129 128 C130 132 128 134 125 134 L117 133 C114 132 112 128 113 124 C114 118 116 114 118 110 Z" fill="url(#jh-shirt)" />
                <path d="M118 110 C116 116 116 122 118 128 L113 124 C114 118 116 114 118 110 Z" fill="url(#jh-shirt-shade)" opacity="0.1" />

                {/* Forearm - natural taper */}
                <path d="M129 132 C131 138 132 144 133 150 C134 153 132 155 129 155 L121 154 C118 153 116 150 117 146 C118 140 120 136 122 132 Z" fill="url(#jh-skin)" />
                <path d="M122 132 C120 138 120 144 122 150 L117 146 C118 140 120 136 122 132 Z" fill="#d4a574" opacity="0.1" />

                {/* Hand - relaxed at side */}
                <path d="M128 149 C132 151 133 155 131 159 C129 163 124 164 120 162 C116 160 115 156 117 153 C119 150 124 148 128 149 Z" fill="url(#jh-skin)" />
                {/* Thumb */}
                <path d="M118 152 C116 150 114 150 113 152" stroke="url(#jh-skin)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              </g>

              {/* === HEAD + FACE === */}
              <g>
                {/* Neck - tapered with muscle definition */}
                <path d="M67 84 C67 88 66 92 66 96 L66 100 C66 102 68 103 72 103 L82 103 C86 103 88 102 88 100 L88 96 C88 92 87 88 87 84 Z" fill="url(#jh-skin)" />
                {/* Neck shadow under chin */}
                <path d="M68 86 C72 89 82 89 86 86" fill="#c8956c" opacity="0.12" />
                {/* Sternocleidomastoid hint */}
                <path d="M70 88 C71 92 72 96 73 100" stroke="#d4a574" strokeWidth="0.5" opacity="0.08" />
                <path d="M84 88 C83 92 82 96 81 100" stroke="#d4a574" strokeWidth="0.5" opacity="0.08" />

                {/* Collar */}
                <path d="M62 100 L70 90 L77 101" fill="url(#jh-shirt)" />
                <path d="M77 101 L84 90 L92 100" fill="url(#jh-shirt)" />
                <path d="M63 100 L70 92 L76 100" fill="none" stroke="#1d4ed8" strokeWidth="0.5" opacity="0.15" />
                <path d="M78 100 L84 92 L91 100" fill="none" stroke="#1d4ed8" strokeWidth="0.5" opacity="0.15" />

                {/* Head - organic face shape with defined jaw */}
                <path d="M50 58 C50 38 60 28 77 28 C94 28 104 38 104 58 C104 67 102 74 97 79 C92 84 86 87 77 87 C68 87 62 84 57 79 C52 74 50 67 50 58 Z" fill="url(#jh-skin)" />
                {/* Forehead highlight */}
                <path d="M58 40 C62 34 72 31 80 32 C86 33 90 36 91 40 C86 36 74 34 62 38 Z" fill="url(#jh-skin-hi)" opacity="0.2" />
                {/* Jaw shadow - gives 3D chin */}
                <path d="M58 76 C64 84 77 86 88 82 C94 79 100 74 100 70 C98 78 88 83 77 83 C66 83 58 78 58 76 Z" fill="#c8956c" opacity="0.08" />
                {/* Chin cleft */}
                <path d="M73 84 C75 85.5 79 85.5 81 84" fill="none" stroke="#c8956c" strokeWidth="0.5" opacity="0.1" />

                {/* Ears */}
                <path d="M50 54 C46 52 44 54 44 59 C44 64 46 67 50 66" fill="#f0c9a0" />
                <path d="M48 55 C46 56 45 58 45 61 C45 63 46 65 48 65" fill="#e8a882" opacity="0.25" />
                <path d="M47 57 C46 59 46 61 47 63" fill="none" stroke="#d4a574" strokeWidth="0.6" opacity="0.2" />

                <path d="M104 54 C108 52 110 54 110 59 C110 64 108 67 104 66" fill="#f0c9a0" />
                <path d="M106 55 C108 56 109 58 109 61 C109 63 108 65 106 65" fill="#e8a882" opacity="0.25" />
                <path d="M107 57 C108 59 108 61 107 63" fill="none" stroke="#d4a574" strokeWidth="0.6" opacity="0.2" />

                {/* Hair - sideburns peeking under hat */}
                <path d="M51 40 C50 36 52 33 51 42" fill="url(#jh-hair)" opacity="0.6" />
                <path d="M53 38 C52 35 54 33 53 40" fill="url(#jh-hair)" opacity="0.4" />
                <path d="M103 40 C104 36 102 33 103 42" fill="url(#jh-hair)" opacity="0.6" />
                <path d="M101 38 C102 35 100 33 101 40" fill="url(#jh-hair)" opacity="0.4" />

                {/* Eyes - expressive with depth */}
                <g style={{ animation: "josh-blink 4s ease-in-out infinite", transformOrigin: "77px 56px" }}>
                  {/* Left eye */}
                  <ellipse cx="66" cy="56" rx="7" ry="6.5" fill="white" />
                  <ellipse cx="66" cy="56" rx="7" ry="6.5" fill="none" stroke="#c8a882" strokeWidth="0.5" opacity="0.3" />
                  {/* Upper eyelid weight */}
                  <path d="M59.5 52 C62 49 70 49 73 52" fill="none" stroke="#7c5b34" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
                  {/* Iris */}
                  <circle cx="67" cy="56.5" r="4.5" fill="#6D4C2E" />
                  <circle cx="67" cy="56.5" r="3.8" fill="#5D4037" />
                  {/* Pupil */}
                  <circle cx="67" cy="56.5" r="2.4" fill="#1a0f0a" />
                  {/* Iris ring */}
                  <circle cx="67" cy="56.5" r="4" fill="none" stroke="#8B6914" strokeWidth="0.3" opacity="0.25" />
                  {/* Eye sparkle */}
                  <circle cx="69.5" cy="54.5" r="2" fill="white" />
                  <circle cx="65" cy="58" r="0.9" fill="white" opacity="0.45" />
                  {/* Lower lid */}
                  <path d="M60 59 C63 61 70 61 73 59" fill="none" stroke="#c8a882" strokeWidth="0.4" opacity="0.2" />

                  {/* Right eye */}
                  <ellipse cx="88" cy="56" rx="7" ry="6.5" fill="white" />
                  <ellipse cx="88" cy="56" rx="7" ry="6.5" fill="none" stroke="#c8a882" strokeWidth="0.5" opacity="0.3" />
                  <path d="M81.5 52 C84 49 92 49 95 52" fill="none" stroke="#7c5b34" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
                  <circle cx="87" cy="56.5" r="4.5" fill="#6D4C2E" />
                  <circle cx="87" cy="56.5" r="3.8" fill="#5D4037" />
                  <circle cx="87" cy="56.5" r="2.4" fill="#1a0f0a" />
                  <circle cx="87" cy="56.5" r="4" fill="none" stroke="#8B6914" strokeWidth="0.3" opacity="0.25" />
                  <circle cx="89.5" cy="54.5" r="2" fill="white" />
                  <circle cx="85" cy="58" r="0.9" fill="white" opacity="0.45" />
                  <path d="M82 59 C85 61 92 61 95 59" fill="none" stroke="#c8a882" strokeWidth="0.4" opacity="0.2" />
                </g>

                {/* Eyebrows */}
                {alertCount > 3 ? (
                  <>
                    <path d="M58 46 C63 40 70 40 74 45" stroke="#5D4037" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <path d="M80 45 C84 40 91 40 96 46" stroke="#5D4037" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <path d="M58 48 C63 42 71 42 74 47" stroke="#5D4037" strokeWidth="2.8" fill="none" strokeLinecap="round" />
                    <path d="M80 47 C84 42 92 42 96 48" stroke="#5D4037" strokeWidth="2.8" fill="none" strokeLinecap="round" />
                  </>
                )}

                {/* Nose */}
                <path d="M76 48 C76 54 75 60 75 64" stroke="#c8956c" strokeWidth="1.2" fill="none" opacity="0.12" />
                <path d="M70 66 C72 69 77 70 81 69 C83 68 84 67 83 66" fill="#d4a574" opacity="0.3" />
                <path d="M76 50 C77 54 77 58 76 62" stroke="white" strokeWidth="0.7" fill="none" opacity="0.06" />
                <ellipse cx="72" cy="67" rx="2" ry="1.3" fill="#c8956c" opacity="0.18" />
                <ellipse cx="81" cy="67" rx="2" ry="1.3" fill="#c8956c" opacity="0.18" />
                <ellipse cx="77" cy="66" rx="5.5" ry="2.8" fill="#e0a87c" opacity="0.12" />

                {/* Mouth */}
                {isCelebrating ? (
                  <g>
                    <path d="M66 73 C72 84 82 84 88 73" stroke="#991b1b" strokeWidth="1.5" fill="#fecaca" strokeLinecap="round" />
                    <path d="M68 73 C73 77 81 77 86 73" fill="white" />
                    <ellipse cx="77" cy="79" rx="4" ry="2.5" fill="#ef4444" opacity="0.35" />
                  </g>
                ) : alertCount > 3 ? (
                  <g>
                    <path d="M69 75 C73 72 81 72 85 75" stroke="#991b1b" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </g>
                ) : (
                  <g>
                    {/* Upper lip - cupid's bow */}
                    <path d="M69 73 C72 71 74 72 77 71 C80 72 82 71 85 73" stroke="#b45309" strokeWidth="0.8" fill="none" opacity="0.3" />
                    {/* Smile */}
                    <path d="M67 73 C71 81 83 81 87 73" stroke="#b91c1c" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                    {/* Lower lip fullness */}
                    <path d="M70 76 C73 79 81 79 84 76" fill="#e0a87c" opacity="0.1" />
                  </g>
                )}

                {/* Cheek blush */}
                <ellipse cx="56" cy="66" rx="6" ry="4" fill="#fca5a5" opacity="0.1" />
                <ellipse cx="98" cy="66" rx="6" ry="4" fill="#fca5a5" opacity="0.1" />

                {/* Nasolabial folds - very subtle */}
                <path d="M60 62 C62 67 65 72 68 75" fill="none" stroke="#c8956c" strokeWidth="0.4" opacity="0.08" />
                <path d="M94 62 C92 67 89 72 86 75" fill="none" stroke="#c8956c" strokeWidth="0.4" opacity="0.08" />

                {/* Hard hat */}
                <g style={{
                  animation: phase === "idle" && !isWalking ? "josh-hat-wobble 3s ease-in-out infinite" : undefined,
                  transformOrigin: "77px 30px",
                }}>
                  {/* Hat dome */}
                  <path d="M46 39 C46 20 56 10 77 8 C98 10 108 20 108 39 Z" fill="url(#jh-hat)" />
                  {/* Right shadow */}
                  <path d="M92 12 C100 16 106 24 108 39 L100 39 C100 26 96 18 90 14 Z" fill="url(#jh-hat-shade)" opacity="0.18" />

                  {/* Central ridge */}
                  <path d="M77 8 C77 12 77 22 77 32" stroke="#d97706" strokeWidth="2" opacity="0.18" strokeLinecap="round" />

                  {/* Glossy highlight */}
                  <path d="M56 32 C62 16 76 12 86 14" fill="none" stroke="white" strokeWidth="2.5" opacity="0.1" strokeLinecap="round" />
                  <path d="M54 28 C58 18 68 14 78 14" fill="none" stroke="white" strokeWidth="1.5" opacity="0.06" strokeLinecap="round" />

                  {/* Brim */}
                  <path d="M38 37 C38 34 41 32 46 32 L108 32 C113 32 116 34 116 37 L116 42 C116 44 114 45 110 45 L44 45 C40 45 38 44 38 42 Z" fill="#b45309" />
                  <path d="M40 34 L114 34" stroke="#d97706" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
                  <path d="M42 44 L112 44" stroke="#78350f" strokeWidth="1.5" opacity="0.25" strokeLinecap="round" />

                  {/* Front lamp */}
                  <circle cx="77" cy="22" r="6.5" fill="#fef9c3" opacity="0.65" />
                  <circle cx="77" cy="22" r="4.5" fill="#fde68a" />
                  <circle cx="77" cy="22" r="2.2" fill="white" opacity="0.75" />
                  <circle cx="77" cy="22" r="5.5" fill="none" stroke="#d97706" strokeWidth="0.8" opacity="0.35" />

                  {/* Inner suspension band */}
                  <path d="M50 35 L104 35" stroke="#92400e" strokeWidth="3" opacity="0.2" strokeLinecap="round" />
                </g>
              </g>

              {/* Confetti when celebrating */}
              {isCelebrating && showBubble && (
                <g>
                  {["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4", "#f97316"].map((color, i) => (
                    <rect
                      key={i}
                      x={16 + i * 16}
                      y={-5}
                      width={i % 2 === 0 ? "5" : "4"}
                      height={i % 2 === 0 ? "5" : "6"}
                      rx="1"
                      fill={color}
                      style={{
                        animation: `josh-confetti 2s ease-in ${0.15 * i}s infinite`,
                        transformOrigin: `${18 + i * 16}px 0px`,
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
        0%, 100% { transform: translateY(0) scaleY(1); }
        25% { transform: translateY(-6px) scaleY(0.97); }
        50% { transform: translateY(0) scaleY(1); }
        75% { transform: translateY(2px) scaleY(1.01); }
      }
      @keyframes josh-walk-right-leg {
        0%, 100% { transform: translateY(0) scaleY(1); }
        25% { transform: translateY(2px) scaleY(1.01); }
        50% { transform: translateY(0) scaleY(1); }
        75% { transform: translateY(-6px) scaleY(0.97); }
      }
      @keyframes josh-walk-left-arm {
        0%, 100% { transform: translateY(0); }
        25% { transform: translateY(3px); }
        50% { transform: translateY(0); }
        75% { transform: translateY(-3px); }
      }
      @keyframes josh-walk-right-arm {
        0%, 100% { transform: translateY(0); }
        25% { transform: translateY(-2px); }
        50% { transform: translateY(0); }
        75% { transform: translateY(2px); }
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
      /* hammer-tap removed - no hammer */
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
