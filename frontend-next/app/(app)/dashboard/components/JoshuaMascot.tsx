"use client";

import { useState, useEffect, useCallback } from "react";

interface JoshuaMascotProps {
  alertCount: number;
  hasItems: boolean;
  sections: Array<{ type: string; title: string; count: number }>;
  isLoading: boolean;
}

type Phase = "hidden" | "climbing" | "waving" | "speaking" | "idle" | "pointing";

const MESSAGES: Record<string, string[]> = {
  overdue: [
    "Oi! Overdue tasks need sorting, mate!",
    "These are past due — time to crack on!",
    "Red alert! Let's clear the overdue list!",
  ],
  tasks_due: [
    "Tasks on the board today — let's go!",
    "Got a few things to knock out today.",
    "Your to-do list is ready!",
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

export default function JoshuaMascot({ alertCount, hasItems, sections, isLoading }: JoshuaMascotProps) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [message, setMessage] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);

  const getMessages = useCallback(() => {
    if (isLoading) return MESSAGES.loading;
    if (!hasItems) return MESSAGES.all_clear;
    const priority = ["overdue", "tasks_due", "follow_ups", "unanswered", "pending_pos"];
    for (const type of priority) {
      const section = sections.find(s => s.type === type && s.count > 0);
      if (section) return MESSAGES[type] || MESSAGES.all_clear;
    }
    return MESSAGES.all_clear;
  }, [isLoading, hasItems, sections]);

  // Entrance animation sequence
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase("climbing"), 400));
    timers.push(setTimeout(() => setPhase("waving"), 2200));
    timers.push(setTimeout(() => {
      setPhase("speaking");
      const msgs = getMessages();
      setMessage(msgs[0]);
    }, 3400));
    timers.push(setTimeout(() => setPhase("idle"), 7000));
    return () => timers.forEach(clearTimeout);
  }, [getMessages]);

  // Cycle messages periodically
  useEffect(() => {
    if (phase !== "idle") return;
    const interval = setInterval(() => {
      const msgs = getMessages();
      setMsgIndex(prev => {
        const next = (prev + 1) % msgs.length;
        setMessage(msgs[next]);
        return next;
      });
      setPhase("pointing");
      setTimeout(() => setPhase("idle"), 2500);
    }, 10000);
    return () => clearInterval(interval);
  }, [phase, getMessages]);

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 group"
        title="Bring Joshua back"
      >
        <div className="w-14 h-14 rounded-full bg-amber-400 dark:bg-amber-500 shadow-lg group-hover:scale-110 transition-transform flex items-center justify-center border-2 border-amber-500 dark:border-amber-400">
          <svg viewBox="0 0 40 40" width="32" height="32">
            <ellipse cx="20" cy="14" rx="14" ry="8" fill="#f59e0b" />
            <rect x="5" y="18" width="30" height="4" rx="2" fill="#d97706" />
            <circle cx="20" cy="10" r="2.5" fill="#fef9c3" />
            <circle cx="14" cy="28" rx="2" ry="2.5" fill="#1e293b" />
            <circle cx="26" cy="28" rx="2" ry="2.5" fill="#1e293b" />
            <circle cx="15" cy="27" r="0.8" fill="white" />
            <circle cx="27" cy="27" r="0.8" fill="white" />
            <circle cx="20" cy="26" r="6" fill="#fcd9b6" />
          </svg>
        </div>
      </button>
    );
  }

  const showBubble = message && (phase === "speaking" || phase === "idle" || phase === "pointing");
  const isCelebrating = !hasItems && !isLoading;

  return (
    <>
      <style>{`
        @keyframes josh-climb {
          0% { transform: translate(60px, 120vh) rotate(5deg); opacity: 0; }
          10% { opacity: 1; }
          20% { transform: translate(45px, 80vh) rotate(-8deg); }
          35% { transform: translate(30px, 50vh) rotate(6deg); }
          50% { transform: translate(15px, 25vh) rotate(-4deg); }
          65% { transform: translate(5px, 8vh) rotate(3deg); }
          80% { transform: translate(-3px, -1vh) rotate(-1deg); }
          90% { transform: translate(2px, 1vh) rotate(0.5deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes josh-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes josh-wave {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-35deg); }
          40% { transform: rotate(15deg); }
          60% { transform: rotate(-25deg); }
          80% { transform: rotate(10deg); }
        }
        @keyframes josh-point {
          0% { transform: rotate(0deg); }
          40% { transform: rotate(-60deg); }
          100% { transform: rotate(-50deg); }
        }
        @keyframes josh-point-reset {
          0% { transform: rotate(-50deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes josh-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.05); }
        }
        @keyframes josh-breathe {
          0%, 100% { transform: scaleX(1); }
          50% { transform: scaleX(1.02); }
        }
        @keyframes josh-bubble {
          0% { opacity: 0; transform: scale(0.7) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes josh-bubble-hide {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.8) translateY(5px); }
        }
        @keyframes josh-celebrate {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          20% { transform: translateY(-20px) rotate(-6deg); }
          40% { transform: translateY(-25px) rotate(6deg); }
          60% { transform: translateY(-15px) rotate(-4deg); }
          80% { transform: translateY(-5px) rotate(2deg); }
        }
        @keyframes josh-confetti {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(80px) rotate(720deg); opacity: 0; }
        }
        @keyframes josh-walk-l {
          0%, 50%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-3px) rotate(-15deg); }
        }
        @keyframes josh-walk-r {
          0%, 50%, 100% { transform: translateY(0) rotate(0deg); }
          75% { transform: translateY(-3px) rotate(15deg); }
        }
        @keyframes josh-hat-wobble {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(-3deg); }
          60% { transform: rotate(2deg); }
        }
        @keyframes josh-shadow-pulse {
          0%, 100% { transform: scaleX(1); opacity: 0.15; }
          50% { transform: scaleX(0.85); opacity: 0.1; }
        }
        .josh-enter {
          animation: josh-climb 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .josh-idle-bob {
          animation: josh-bob 3s ease-in-out infinite;
        }
        .josh-wave-anim {
          animation: josh-wave 1s ease-in-out 2;
          transform-origin: 34px 62px;
        }
        .josh-point-anim {
          animation: josh-point 0.6s ease-out forwards;
          transform-origin: 66px 62px;
        }
        .josh-point-reset-anim {
          animation: josh-point-reset 0.4s ease-in forwards;
          transform-origin: 66px 62px;
        }
        .josh-blink-anim {
          animation: josh-blink 3.5s ease-in-out infinite;
          transform-origin: center;
        }
        .josh-breathe-anim {
          animation: josh-breathe 4s ease-in-out infinite;
          transform-origin: center 80px;
        }
        .josh-celebrate-anim {
          animation: josh-celebrate 0.8s ease-in-out 2;
        }
        .josh-hat-wobble-anim {
          animation: josh-hat-wobble 2s ease-in-out infinite;
          transform-origin: 50px 22px;
        }
      `}</style>

      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1.5 pointer-events-none hidden md:flex">
        {/* Speech bubble */}
        {showBubble && (
          <div
            className="pointer-events-auto relative max-w-[200px]"
            style={{ animation: "josh-bubble 0.4s ease-out forwards" }}
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl px-3.5 py-2 shadow-xl border border-border/60 dark:border-slate-700">
              <p className="text-xs font-semibold text-foreground leading-relaxed">{message}</p>
              {isCelebrating && (
                <p className="text-[10px] text-amber-500 mt-0.5 font-medium">- Joshua AI</p>
              )}
            </div>
            {/* Tail */}
            <div className="absolute -bottom-[6px] right-8 w-3 h-3 bg-white dark:bg-slate-800 border-b border-r border-border/60 dark:border-slate-700 transform rotate-45" />
          </div>
        )}

        {/* Character */}
        <div
          className={`pointer-events-auto relative ${
            phase === "hidden" ? "opacity-0" : ""
          } ${
            phase === "climbing" ? "josh-enter" : ""
          } ${
            phase === "idle" ? "josh-idle-bob" : ""
          } ${
            isCelebrating && phase === "speaking" ? "josh-celebrate-anim" : ""
          }`}
          style={{
            perspective: "600px",
            ...(phase === "hidden" ? { transform: "translateY(120vh)" } : {}),
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setMinimized(true)}
            className="absolute -top-1 -left-1 z-10 w-5 h-5 rounded-full bg-muted/80 hover:bg-red-500 hover:text-white text-muted-foreground text-[10px] flex items-center justify-center opacity-0 hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
            title="Minimize Joshua"
          >
            x
          </button>

          <svg
            viewBox="0 0 100 150"
            width="110"
            height="165"
            className="drop-shadow-lg"
            style={{ transform: "rotateY(-3deg) rotateX(2deg)" }}
          >
            <defs>
              {/* Gradients for 3D feel */}
              <linearGradient id="hat-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <linearGradient id="face-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fde68a" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="vest-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
              <linearGradient id="shirt-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
              <linearGradient id="jeans-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <radialGradient id="face-radial" cx="0.4" cy="0.35">
                <stop offset="0%" stopColor="#fde4c8" />
                <stop offset="100%" stopColor="#f0c9a0" />
              </radialGradient>
              {/* Shadow filter */}
              <filter id="inner-shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur" />
                <feOffset dx="0" dy="1" result="offsetBlur" />
                <feComposite in="SourceGraphic" in2="offsetBlur" operator="over" />
              </filter>
            </defs>

            {/* === Ground shadow === */}
            <ellipse
              cx="50" cy="145" rx="28" ry="4"
              fill="#000" opacity="0.12"
              style={{ animation: phase === "idle" ? "josh-shadow-pulse 3s ease-in-out infinite" : undefined }}
            />

            {/* === LEGS (behind body) === */}
            <g>
              <g style={{
                transformOrigin: "42px 100px",
                animation: phase === "climbing" ? "josh-walk-l 0.4s ease-in-out 5" : undefined,
              }}>
                <rect x="37" y="100" width="12" height="30" rx="5" fill="url(#jeans-grad)" />
                <rect x="34" y="126" width="17" height="10" rx="4" fill="#374151" />
                <rect x="34" y="132" width="17" height="4" rx="2" fill="#1f2937" />
              </g>
              <g style={{
                transformOrigin: "58px 100px",
                animation: phase === "climbing" ? "josh-walk-r 0.4s ease-in-out 5" : undefined,
              }}>
                <rect x="51" y="100" width="12" height="30" rx="5" fill="url(#jeans-grad)" />
                <rect x="49" y="126" width="17" height="10" rx="4" fill="#374151" />
                <rect x="49" y="132" width="17" height="4" rx="2" fill="#1f2937" />
              </g>
            </g>

            {/* === LEFT ARM (waving arm - behind body) === */}
            <g
              className={phase === "waving" ? "josh-wave-anim" : ""}
              style={{ transformOrigin: "34px 62px" }}
            >
              <path d="M34 62 Q24 72 18 80" stroke="url(#vest-grad)" strokeWidth="10" strokeLinecap="round" fill="none" />
              <circle cx="16" cy="82" r="5.5" fill="url(#face-radial)" />
              {/* Fingers when waving */}
              {phase === "waving" && (
                <g>
                  <line x1="13" y1="79" x2="10" y2="75" stroke="#f0c9a0" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="15" y1="78" x2="13" y2="73" stroke="#f0c9a0" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="18" y1="78" x2="17" y2="73" stroke="#f0c9a0" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              )}
            </g>

            {/* === BODY === */}
            <g className={phase === "idle" ? "josh-breathe-anim" : ""}>
              {/* Blue shirt base */}
              <rect x="33" y="56" width="34" height="42" rx="8" fill="url(#shirt-grad)" />

              {/* Hi-vis vest - left panel */}
              <path d="M31 58 Q31 54 35 54 L45 54 L45 96 L35 96 Q31 96 31 92 Z" fill="url(#vest-grad)" />
              {/* Hi-vis vest - right panel */}
              <path d="M55 54 L65 54 Q69 54 69 58 L69 92 Q69 96 65 96 L55 96 Z" fill="url(#vest-grad)" />

              {/* Reflective stripes */}
              <rect x="31" y="72" width="38" height="3.5" rx="1.5" fill="#facc15" opacity="0.85" />
              <rect x="31" y="80" width="38" height="3.5" rx="1.5" fill="#facc15" opacity="0.85" />

              {/* Vest collar V */}
              <path d="M45 54 L50 62 L55 54" fill="url(#shirt-grad)" />

              {/* Pocket */}
              <rect x="56" y="60" width="8" height="7" rx="1.5" fill="#c2410c" opacity="0.3" />
              <rect x="56" y="60" width="8" height="2" rx="1" fill="#c2410c" opacity="0.4" />

              {/* Tool belt */}
              <rect x="29" y="94" width="42" height="6" rx="2.5" fill="#78350f" />
              <circle cx="50" cy="97" r="3.5" fill="#b45309" stroke="#92400e" strokeWidth="0.7" />
              {/* Tools on belt */}
              <rect x="62" y="91" width="4" height="12" rx="1.5" fill="#6b7280" />
              <rect x="34" y="91" width="3" height="10" rx="1" fill="#9ca3af" />
              <rect x="38" y="93" width="2.5" height="8" rx="1" fill="#78716c" />
            </g>

            {/* === RIGHT ARM (pointing arm - in front of body) === */}
            <g
              className={
                phase === "pointing" ? "josh-point-anim" :
                phase === "idle" ? "josh-point-reset-anim" : ""
              }
              style={{ transformOrigin: "66px 62px" }}
            >
              <path d="M66 62 Q76 72 82 80" stroke="url(#vest-grad)" strokeWidth="10" strokeLinecap="round" fill="none" />
              <circle cx="84" cy="82" r="5.5" fill="url(#face-radial)" />
              {/* Pointing finger */}
              {phase === "pointing" && (
                <line x1="87" y1="80" x2="95" y2="74" stroke="#f0c9a0" strokeWidth="3" strokeLinecap="round" />
              )}
            </g>

            {/* === HEAD === */}
            <g>
              {/* Neck */}
              <rect x="44" y="50" width="12" height="8" rx="4" fill="#f0c9a0" />

              {/* Face */}
              <circle cx="50" cy="40" r="19" fill="url(#face-radial)" />
              {/* Cheek blush */}
              <circle cx="36" cy="44" r="4" fill="#fca5a5" opacity="0.3" />
              <circle cx="64" cy="44" r="4" fill="#fca5a5" opacity="0.3" />

              {/* Eyes with blink */}
              <g className="josh-blink-anim" style={{ transformOrigin: "50px 38px" }}>
                <ellipse cx="42" cy="38" rx="3.5" ry="4" fill="#1e293b" />
                <ellipse cx="58" cy="38" rx="3.5" ry="4" fill="#1e293b" />
                {/* Eye highlights */}
                <circle cx="43.8" cy="36.5" r="1.5" fill="white" />
                <circle cx="59.8" cy="36.5" r="1.5" fill="white" />
                <circle cx="41" cy="39" r="0.7" fill="white" opacity="0.6" />
                <circle cx="57" cy="39" r="0.7" fill="white" opacity="0.6" />
              </g>

              {/* Eyebrows */}
              {alertCount > 3 ? (
                <>
                  <path d="M37 31 Q42 29 47 32" stroke="#7c2d12" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <path d="M53 32 Q58 29 63 31" stroke="#7c2d12" strokeWidth="2" fill="none" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <path d="M37 32 Q42 29 47 32" stroke="#92400e" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <path d="M53 32 Q58 29 63 32" stroke="#92400e" strokeWidth="2" fill="none" strokeLinecap="round" />
                </>
              )}

              {/* Nose */}
              <ellipse cx="50" cy="43" rx="2.5" ry="2" fill="#e8a882" />

              {/* Mouth */}
              {isCelebrating ? (
                // Big happy open mouth
                <g>
                  <path d="M42 48 Q50 58 58 48" stroke="#b91c1c" strokeWidth="2" fill="#fecaca" strokeLinecap="round" />
                  <path d="M44 48 Q50 50 56 48" fill="white" /> {/* teeth */}
                </g>
              ) : alertCount > 3 ? (
                // Concerned/determined
                <path d="M44 50 Q50 47 56 50" stroke="#b91c1c" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              ) : (
                // Normal friendly smile
                <path d="M43 48 Q50 55 57 48" stroke="#b91c1c" strokeWidth="2" fill="none" strokeLinecap="round" />
              )}

              {/* === HARD HAT (on top of head) === */}
              <g
                className={phase === "idle" ? "josh-hat-wobble-anim" : ""}
                style={{ transformOrigin: "50px 22px" }}
              >
                {/* Hat dome */}
                <path
                  d="M26 25 Q26 8 50 8 Q74 8 74 25 Z"
                  fill="url(#hat-grad)"
                />
                {/* Hat brim */}
                <rect x="20" y="24" width="60" height="5.5" rx="2.5" fill="#b45309" />
                {/* Brim highlight */}
                <rect x="22" y="24" width="56" height="2" rx="1" fill="#d97706" opacity="0.6" />
                {/* Front lamp */}
                <circle cx="50" cy="15" r="4" fill="#fef9c3" />
                <circle cx="50" cy="15" r="2.5" fill="#fef08a" />
                <circle cx="50" cy="15" r="1.2" fill="white" opacity="0.9" />
                {/* Hat band */}
                <rect x="28" y="20" width="44" height="4" rx="1.5" fill="#92400e" opacity="0.5" />
              </g>
            </g>

            {/* === CONFETTI when celebrating === */}
            {isCelebrating && (phase === "speaking" || phase === "idle") && (
              <g>
                {["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4", "#f97316"].map((color, i) => (
                  <rect
                    key={i}
                    x={10 + i * 11}
                    y={-5}
                    width={i % 2 === 0 ? "4" : "3"}
                    height={i % 2 === 0 ? "4" : "5"}
                    rx="1"
                    fill={color}
                    style={{
                      animation: `josh-confetti 2s ease-in ${0.15 * i}s infinite`,
                      transformOrigin: `${12 + i * 11}px 0px`,
                    }}
                  />
                ))}
              </g>
            )}
          </svg>

          {/* Name plate */}
          <div className="flex justify-center -mt-2">
            <div className="bg-amber-500 dark:bg-amber-600 text-white text-[9px] font-bold tracking-[0.15em] uppercase px-3 py-0.5 rounded-full shadow-sm">
              Joshua
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
