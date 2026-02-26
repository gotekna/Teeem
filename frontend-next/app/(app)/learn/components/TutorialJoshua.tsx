"use client";

import type { JoshuaEmotion } from "@/lib/tutorials/tutorial-types";

interface TutorialJoshuaProps {
  message: string;
  emotion: JoshuaEmotion;
}

export function TutorialJoshua({ message, emotion }: TutorialJoshuaProps) {
  const armPose = emotion === "wave" ? "wave" : emotion === "point" ? "point" : "rest";

  const leftArmAnim =
    armPose === "wave"
      ? "josh-wave 1.2s ease-in-out 2"
      : armPose === "point"
      ? "josh-point 0.5s ease-out forwards"
      : undefined;

  return (
    <div className="flex items-end gap-3">
      {/* Joshua character (simplified) */}
      <div className="flex-shrink-0">
        <TutorialJoshuaStyles />
        <svg viewBox="0 0 100 160" width="80" height="128" className="drop-shadow-md">
          <defs>
            <linearGradient id="tjh-hat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fcd34d" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <radialGradient id="tjh-skin" cx="0.4" cy="0.3">
              <stop offset="0%" stopColor="#fde8d0" />
              <stop offset="100%" stopColor="#f0c9a0" />
            </radialGradient>
            <linearGradient id="tjh-vest" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <linearGradient id="tjh-shirt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="tjh-jeans" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1e40af" />
            </linearGradient>
            <linearGradient id="tjh-boot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4b5563" />
              <stop offset="100%" stopColor="#1f2937" />
            </linearGradient>
          </defs>

          {/* Ground shadow */}
          <ellipse cx="50" cy="152" rx="25" ry="3" fill="#000" opacity="0.08" />

          {/* Legs */}
          <g>
            <path d="M37 107 L36 132 Q36 136 39 136 L47 136 Q49 136 49 134 L48 107 Z" fill="url(#tjh-jeans)" />
            <path d="M34 132 L34 143 Q34 147 38 147 L48 147 Q52 147 52 144 L50 132 Z" fill="url(#tjh-boot)" />
            <path d="M52 107 L51 132 Q51 136 54 136 L62 136 Q64 136 64 134 L63 107 Z" fill="url(#tjh-jeans)" />
            <path d="M49 132 L49 143 Q49 147 53 147 L63 147 Q67 147 67 144 L65 132 Z" fill="url(#tjh-boot)" />
          </g>

          {/* Left arm */}
          <g style={{ transformOrigin: "32px 68px", animation: leftArmAnim }}>
            <path d="M32 68 Q26 76 22 84" stroke="url(#tjh-vest)" strokeWidth="11" strokeLinecap="round" fill="none" />
            <path d="M22 84 Q18 90 16 95" stroke="url(#tjh-shirt)" strokeWidth="9" strokeLinecap="round" fill="none" />
            <ellipse cx="15" cy="97" rx="5.5" ry="5" fill="url(#tjh-skin)" />
          </g>

          {/* Body */}
          <g>
            <path d="M30 66 Q28 66 28 70 L27 102 Q27 106 31 106 L69 106 Q73 106 73 102 L72 70 Q72 66 70 66 Z" fill="url(#tjh-shirt)" />
            <path d="M29 66 L46 66 L46 106 L29 106 Q26 106 26 102 L26 70 Q26 66 29 66 Z" fill="url(#tjh-vest)" />
            <path d="M54 66 L71 66 Q74 66 74 70 L74 102 Q74 106 71 106 L54 106 Z" fill="url(#tjh-vest)" />
            <path d="M46 66 L50 76 L54 66" fill="url(#tjh-shirt)" />
            <rect x="26" y="80" width="48" height="3.5" rx="1.5" fill="#fde047" opacity="0.85" />
            <rect x="26" y="90" width="48" height="3.5" rx="1.5" fill="#fde047" opacity="0.85" />
            <rect x="25" y="103" width="50" height="5.5" rx="2" fill="#78350f" />
          </g>

          {/* Right arm */}
          <g>
            <path d="M68 68 Q74 76 78 84" stroke="url(#tjh-vest)" strokeWidth="11" strokeLinecap="round" fill="none" />
            <path d="M78 84 Q82 90 84 95" stroke="url(#tjh-shirt)" strokeWidth="9" strokeLinecap="round" fill="none" />
            <ellipse cx="85" cy="97" rx="5.5" ry="5" fill="url(#tjh-skin)" />
          </g>

          {/* Head */}
          <g>
            <rect x="43" y="55" width="14" height="13" rx="5" fill="#f0c9a0" />
            <ellipse cx="50" cy="42" rx="20" ry="21" fill="url(#tjh-skin)" />

            {/* Ears */}
            <ellipse cx="29" cy="44" rx="4.5" ry="6.5" fill="#f0c9a0" />
            <ellipse cx="71" cy="44" rx="4.5" ry="6.5" fill="#f0c9a0" />

            {/* Eyes */}
            <g style={{ animation: "tjosh-blink 4s ease-in-out infinite", transformOrigin: "50px 40px" }}>
              <ellipse cx="41" cy="40" rx="5" ry="5.5" fill="white" />
              <circle cx="42" cy="40.5" r="3.5" fill="#5D4037" />
              <circle cx="42" cy="40.5" r="2.2" fill="#2C1810" />
              <circle cx="43.5" cy="39" r="1.4" fill="white" />
              <ellipse cx="59" cy="40" rx="5" ry="5.5" fill="white" />
              <circle cx="58" cy="40.5" r="3.5" fill="#5D4037" />
              <circle cx="58" cy="40.5" r="2.2" fill="#2C1810" />
              <circle cx="59.5" cy="39" r="1.4" fill="white" />
            </g>

            {/* Eyebrows */}
            <path d="M35 33 Q41 29 47 33" stroke="#5D4037" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M53 33 Q59 29 65 33" stroke="#5D4037" strokeWidth="2.2" fill="none" strokeLinecap="round" />

            {/* Nose */}
            <ellipse cx="50" cy="47.5" rx="3" ry="1.8" fill="#e0a87c" opacity="0.5" />

            {/* Mouth */}
            {emotion === "celebrate" ? (
              <g>
                <path d="M42 52 Q50 62 58 52" stroke="#b91c1c" strokeWidth="2" fill="#fecaca" strokeLinecap="round" />
                <path d="M44 52 Q50 55 56 52" fill="white" />
              </g>
            ) : (
              <path d="M43 52 Q50 59 57 52" stroke="#c0392b" strokeWidth="2" fill="none" strokeLinecap="round" />
            )}

            {/* Cheek blush */}
            <circle cx="34" cy="48" r="4.5" fill="#fca5a5" opacity="0.2" />
            <circle cx="66" cy="48" r="4.5" fill="#fca5a5" opacity="0.2" />

            {/* Hard hat */}
            <g>
              <path d="M26 27 Q26 5 50 3 Q74 5 74 27 Z" fill="url(#tjh-hat)" />
              <rect x="19" y="25" width="62" height="6" rx="3" fill="#b45309" />
              <circle cx="50" cy="14" r="5" fill="#fef9c3" opacity="0.8" />
              <circle cx="50" cy="14" r="3" fill="#fde68a" />
              <circle cx="50" cy="14" r="1.5" fill="white" opacity="0.9" />
            </g>
          </g>

          {/* Confetti when celebrating */}
          {emotion === "celebrate" && (
            <g>
              {["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899"].map((color, i) => (
                <rect
                  key={i}
                  x={12 + i * 14}
                  y={-5}
                  width={i % 2 === 0 ? "4" : "3"}
                  height={i % 2 === 0 ? "4" : "5"}
                  rx="1"
                  fill={color}
                  style={{
                    animation: `tjosh-confetti 2s ease-in ${0.15 * i}s infinite`,
                    transformOrigin: `${14 + i * 14}px 0px`,
                  }}
                />
              ))}
            </g>
          )}
        </svg>

        {/* Name plate */}
        <div className="flex justify-center -mt-1">
          <div className="bg-amber-500 dark:bg-amber-600 text-white text-[8px] font-bold tracking-[0.15em] uppercase px-2.5 py-0.5 rounded-full shadow-sm">
            Joshua
          </div>
        </div>
      </div>

      {/* Speech bubble */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 shadow-lg border border-border/60 dark:border-slate-700 max-w-sm mb-8">
        <p className="text-sm text-foreground leading-relaxed">{message}</p>
        <div className="absolute -left-[6px] bottom-4 w-3 h-3 bg-white dark:bg-slate-800 border-b border-l border-border/60 dark:border-slate-700 transform rotate-45" />
      </div>
    </div>
  );
}

function TutorialJoshuaStyles() {
  return (
    <style>{`
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
      @keyframes tjosh-blink {
        0%, 90%, 100% { transform: scaleY(1); }
        94% { transform: scaleY(0.05); }
      }
      @keyframes tjosh-confetti {
        0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(80px) rotate(720deg); opacity: 0; }
      }
    `}</style>
  );
}
