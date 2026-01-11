"use client";

import { useState, useEffect, useRef } from "react";
import {
  ClipboardCopy,
  Check,
  AlertTriangle,
  Code,
  RefreshCw,
  X,
  Camera,
} from "lucide-react";
import consoleCapture, { type LogEntry } from "@/utils/consoleCapture";

export function DebugToolbar() {
  const [logCount, setLogCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [copiedButton, setCopiedButton] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(false);
  const isMountedRef = useRef(true);

  // Only show in development or staging - check after mount to avoid hydration mismatch
  const isDev = process.env.NODE_ENV === "development";

  // Determine if we should render on the client side only
  useEffect(() => {
    const isStaging =
      window.location.hostname.includes("vercel.app") ||
      window.location.hostname.includes("staging") ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isDev || isStaging) {
      setShouldRender(true);
    }
  }, [isDev]);

  useEffect(() => {
    if (!shouldRender) return;

    isMountedRef.current = true;

    // Initialize console capture
    consoleCapture.initialize();

    // Subscribe to log updates
    const unsubscribe = consoleCapture.subscribe((logs: LogEntry[]) => {
      queueMicrotask(() => {
        if (!isMountedRef.current) return;
        setLogCount(logs.length);
        const errors = logs.filter(
          (log) => log.type === "error" || log.type === "warn"
        ).length;
        setErrorCount(errors);
      });
    });

    // Initialize counts
    queueMicrotask(() => {
      if (!isMountedRef.current) return;
      const logs = consoleCapture.getLogs();
      setLogCount(logs.length);
      const errors = logs.filter(
        (log) => log.type === "error" || log.type === "warn"
      ).length;
      setErrorCount(errors);
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [shouldRender]);

  // Return null initially and on server to avoid hydration mismatch
  if (!shouldRender) return null;

  const handleCopy = async () => {
    try {
      const result = await consoleCapture.copyToClipboard();
      console.log(result);
      setCopiedButton("console");
      setTimeout(() => setCopiedButton(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClear = () => {
    consoleCapture.clear();
    console.clear();
    console.log("✨ Console cleared - fresh start for debugging!");
  };

  const handleHardRefresh = () => {
    sessionStorage.setItem("clearConsoleAfterReload", "true");
    window.location.reload();
  };

  const handleCopyScreen = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: 0.3,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      });

      const pngDataUrl = canvas.toDataURL("image/png");
      const pngResponse = await fetch(pngDataUrl);
      const pngBlob = await pngResponse.blob();
      const sizeKB = (pngBlob.size / 1024).toFixed(0);

      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob }),
        ]);
        setCopiedButton("screenshot");
        setTimeout(() => setCopiedButton(null), 2000);
        console.log(`📸 Screenshot copied to clipboard! (${sizeKB}KB)`);
      } catch {
        // Fallback to download
        const url = URL.createObjectURL(pngBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `screenshot-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setCopiedButton("screenshot");
        setTimeout(() => setCopiedButton(null), 2000);
        console.log(`📸 Screenshot downloaded! (${sizeKB}KB)`);
      }
    } catch (err) {
      console.error("Screenshot failed:", err);
    }
  };

  const simplifyHTMLUltraLight = (html: string): string => {
    return html
      .replace(/<option[^>]*>.*?<\/option>/gi, "")
      .replace(/<div class="[^"]*invisible[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<div[^>]*draggable="true"[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<div class="[^"]*cursor-col-resize[^"]*"[^>]*><\/div>/gi, "")
      .replace(/\s+data-[a-z-]+="[^"]*"/gi, "")
      .replace(/\s+aria-(?!label)[a-z-]+="[^"]*"/gi, "")
      .replace(/\s+id="[^"]*"/gi, "")
      .replace(/\s+tabindex="[^"]*"/gi, "")
      .replace(/\s+style="[^"]*"/gi, "")
      .replace(/\s+title="[^"]*"/gi, "")
      .replace(/\s+placeholder="[^"]*"/gi, "")
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "<svg>...</svg>")
      .replace(/class="[^"]*"/g, (match) => {
        const classMatch = match.match(/class="([^"]*)"/);
        if (!classMatch) return "";
        const classes = classMatch[1];
        const simplified = classes
          .split(" ")
          .filter(
            (c) =>
              c === "flex" ||
              c === "grid" ||
              c === "relative" ||
              c === "absolute" ||
              c === "sticky" ||
              c === "fixed" ||
              c === "hidden" ||
              c.startsWith("w-") ||
              c.startsWith("h-") ||
              c.startsWith("max-w-") ||
              c.startsWith("max-h-") ||
              c.startsWith("overflow-") ||
              c.startsWith("z-") ||
              c === "sr-only"
          )
          .join(" ");
        return simplified ? `class="${simplified}"` : "";
      })
      .replace(/\s+[a-z-]+=""\s*/gi, " ")
      .replace(/\s+>/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  };

  const handleGetScreenCode = async () => {
    try {
      const mainContent = document.querySelector("main") || document.body;
      const clone = mainContent.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('script, style, link[rel="stylesheet"]')
        .forEach((el) => el.remove());
      let html = clone.outerHTML;
      html = simplifyHTMLUltraLight(html);
      await navigator.clipboard.writeText(html);
      setCopiedButton("code");
      setTimeout(() => setCopiedButton(null), 2000);
      console.log("💻 Screen code copied to clipboard!");
    } catch (err) {
      console.error("Failed to get screen code:", err);
    }
  };

  const handleGetContext = async () => {
    try {
      const logs = consoleCapture.getLogs();
      const errors = logs.filter((log) => log.type === "error");
      const warnings = logs.filter((log) => log.type === "warn");
      const recentLogs = logs
        .filter((log) => log.type === "log" || log.type === "info")
        .slice(-5);

      let formatted = `=== ALL RELEVANT CONSOLE DATA ===
Total Console Logs: ${logs.length}
🚨 ALL Errors Found: ${errors.length}
⚠️  ALL Warnings Found: ${warnings.length}
Captured at: ${new Date().toLocaleString()}
`;

      if (errors.length > 0) {
        formatted += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚨 ALL CONSOLE ERRORS (${errors.length} total):\n`;
        errors.forEach((log, index) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          formatted += `\nError ${index + 1}/${errors.length}:\n[${time}] ${log.message}\n`;
        });
      }

      if (warnings.length > 0) {
        formatted += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚠️  ALL CONSOLE WARNINGS (${warnings.length} total):\n`;
        warnings.forEach((log, index) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          formatted += `\nWarning ${index + 1}/${warnings.length}:\n[${time}] ${log.message}\n`;
        });
      }

      if (recentLogs.length > 0) {
        formatted += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 RECENT CONTEXT LOGS (last ${recentLogs.length}):\n`;
        recentLogs.forEach((log) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          formatted += `\n[${time}] ${log.message}\n`;
        });
      }

      if (errors.length === 0 && warnings.length === 0) {
        formatted += "\n✅ No errors or warnings found. Everything looks good!\n";
      }

      await navigator.clipboard.writeText(formatted);
      setCopiedButton("context");
      setTimeout(() => setCopiedButton(null), 2000);
      console.log(`🎯 Context copied! ${errors.length} errors, ${warnings.length} warnings`);
    } catch (err) {
      console.error("Failed to get context:", err);
    }
  };

  const handleGetCompleteContext = async () => {
    try {
      const logs = consoleCapture.getLogs();
      const mainContent = document.querySelector("main") || document.body;
      const clone = mainContent.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('script, style, link[rel="stylesheet"]')
        .forEach((el) => el.remove());
      let html = clone.outerHTML;
      html = simplifyHTMLUltraLight(html);

      const formattedLogs = logs
        .map((log) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          return `[${time}] [${log.type.toUpperCase()}] ${log.message}`;
        })
        .join("\n\n");

      const formatted = `╔════════════════════════════════════════════════════════════════════════╗
║                   COMPLETE CONTEXT (EVERYTHING)                       ║
╚════════════════════════════════════════════════════════════════════════╝

URL: ${window.location.href}
Total Console Logs: ${logs.length}
Captured at: ${new Date().toLocaleString()}

═══════════════════════════════════════════════════════════════════════════
                       ALL CONSOLE LOGS
═══════════════════════════════════════════════════════════════════════════

${formattedLogs}

═══════════════════════════════════════════════════════════════════════════
                        PAGE HTML STRUCTURE
═══════════════════════════════════════════════════════════════════════════

${html}
`;

      await navigator.clipboard.writeText(formatted);
      setCopiedButton("complete");
      setTimeout(() => setCopiedButton(null), 2000);
      console.log(`📦 Complete context copied! ${logs.length} logs + HTML`);
    } catch (err) {
      console.error("Failed to get complete context:", err);
    }
  };

  const handleGetCompleteValidation = async () => {
    try {
      const logs = consoleCapture.getLogs();
      const errors = logs.filter((log) => log.type === "error");
      const warnings = logs.filter((log) => log.type === "warn");

      const mainContent = document.querySelector("main") || document.body;
      const clone = mainContent.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('script, style, link[rel="stylesheet"]')
        .forEach((el) => el.remove());
      let html = clone.outerHTML;
      html = simplifyHTMLUltraLight(html);

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        scale: 0.3,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      });

      const pngDataUrl = canvas.toDataURL("image/png");
      const pngResponse = await fetch(pngDataUrl);
      const pngBlob = await pngResponse.blob();
      const sizeKB = (pngBlob.size / 1024).toFixed(0);

      const formattedLogs = logs
        .map((log) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          return `[${time}] [${log.type.toUpperCase()}] ${log.message}`;
        })
        .join("\n");

      const doesMatch = errors.length === 0 && warnings.length === 0;

      const formatted = `╔════════════════════════════════════════════════════════════════════════╗
║               🐛 LET'S DEBUG THIS!                                    ║
╚════════════════════════════════════════════════════════════════════════╝

📊 QUICK SUMMARY:
${doesMatch ? "✅ Console Clean - No errors or warnings" : "🚨 ERRORS FOUND - Check console section below!"}
📸 Screenshot: ${sizeKB}KB (${canvas.width}x${canvas.height}px)
📍 URL: ${window.location.href}
🕐 Captured: ${new Date().toLocaleString()}

═══════════════════════════════════════════════════════════════════════════
                    📸 SCREENSHOT (base64)
═══════════════════════════════════════════════════════════════════════════

${pngDataUrl}

═══════════════════════════════════════════════════════════════════════════
                    💻 PAGE HTML
═══════════════════════════════════════════════════════════════════════════

${html}

═══════════════════════════════════════════════════════════════════════════
                    🔴 CONSOLE LOGS
═══════════════════════════════════════════════════════════════════════════

${errors.length > 0 ? `🚨 FOUND ${errors.length} ERROR(S)` : "✅ No console errors"}
${warnings.length > 0 ? `⚠️  FOUND ${warnings.length} WARNING(S)` : "✅ No console warnings"}

${formattedLogs || "(No console logs captured)"}
`;

      await navigator.clipboard.writeText(formatted);
      setCopiedButton("validation");
      setTimeout(() => setCopiedButton(null), 2000);
      console.log(
        `📦 Complete validation: ${doesMatch ? "PASSED ✅" : "FAILED ❌"}`
      );
    } catch (err) {
      console.error("Failed to get complete validation:", err);
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-1 right-1 bg-gray-800 text-white p-1 rounded-full shadow-lg hover:bg-gray-700 transition-all z-[9999]"
        title="Show Console Tools"
      >
        <ClipboardCopy className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-border dark:border-border z-[9999] py-1">
      <div className="flex items-center justify-between gap-1.5 max-w-screen-2xl mx-auto px-2">
        {/* Left side - Info */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-foreground dark:text-muted-foreground">
            Console
          </span>
          <span className="text-[10px] px-1.5 py-0 rounded-full bg-muted dark:bg-gray-700 text-muted-foreground dark:text-muted-foreground">
            {logCount}
          </span>
        </div>

        {/* Center - Actions */}
        <div className="flex items-center gap-1 flex-1 justify-center">
          <button
            onClick={handleCopy}
            disabled={logCount === 0}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === "console"
                ? "bg-green-600 text-white"
                : logCount === 0
                  ? "bg-muted dark:bg-gray-700 text-muted-foreground cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {copiedButton === "console" ? (
              <>
                <Check className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              <>
                <ClipboardCopy className="h-2.5 w-2.5" />
                Console
                {logCount > 0 && (
                  <span className="ml-0.5 px-1 py-0 rounded-full bg-indigo-800 text-white text-[9px] font-bold">
                    {logCount}
                  </span>
                )}
              </>
            )}
          </button>

          <button
            onClick={handleGetContext}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === "context"
                ? "bg-green-600 text-white"
                : "bg-yellow-400 dark:bg-yellow-500 text-black hover:bg-yellow-500"
            }`}
            title="Get ALL errors + warnings from console"
          >
            {copiedButton === "context" ? (
              <>
                <Check className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              <>
                <AlertTriangle className="h-2.5 w-2.5" />
                Console
                {errorCount > 0 && (
                  <span className="ml-0.5 px-1 py-0 rounded-full bg-red-600 text-white text-[9px] font-bold">
                    {errorCount}
                  </span>
                )}
              </>
            )}
          </button>

          <button
            onClick={handleClear}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-all"
          >
            <X className="h-2.5 w-2.5" />
            Clear
          </button>

          <button
            onClick={handleCopyScreen}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === "screenshot"
                ? "bg-green-600 text-white"
                : "bg-purple-100 dark:bg-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-200"
            }`}
          >
            {copiedButton === "screenshot" ? (
              <>
                <Check className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              <>
                <Camera className="h-2.5 w-2.5" />
                Screenshot
              </>
            )}
          </button>

          <button
            onClick={handleGetScreenCode}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === "code"
                ? "bg-green-600 text-white"
                : "bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-200"
            }`}
            title="Get page HTML structure"
          >
            {copiedButton === "code" ? (
              <>
                <Check className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              <>
                <Code className="h-2.5 w-2.5" />
                Screenshot
              </>
            )}
          </button>

          <button
            onClick={handleHardRefresh}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500 text-white hover:bg-green-600 transition-all"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            Refresh
          </button>

          <button
            onClick={handleGetCompleteContext}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === "complete"
                ? "bg-green-600 text-white"
                : "bg-muted dark:bg-gray-700 text-foreground dark:text-muted-foreground hover:bg-muted"
            }`}
            title="Get ALL console logs + page HTML"
          >
            {copiedButton === "complete" ? (
              <>
                <Check className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              <>
                Con/Screen
                {logCount > 0 && (
                  <span className="ml-0.5 px-1 py-0 rounded-full bg-gray-400 dark:bg-gray-600 text-white text-[9px] font-bold">
                    {logCount}
                  </span>
                )}
              </>
            )}
          </button>

          <button
            onClick={handleGetCompleteValidation}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
              copiedButton === "validation"
                ? "bg-green-600 text-white"
                : "bg-emerald-100 dark:bg-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200"
            }`}
            title="Complete validation: Console + Screenshot + HTML"
          >
            {copiedButton === "validation" ? (
              <>
                <Check className="h-2.5 w-2.5" />
                Copied!
              </>
            ) : (
              <>
                ✓ Validate
                {logCount > 0 && (
                  <span className="ml-0.5 px-1 py-0 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                    {logCount}
                  </span>
                )}
              </>
            )}
          </button>
        </div>

        {/* Right side - Close */}
        <button
          onClick={() => setIsVisible(false)}
          className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground p-0.5 transition-colors"
          title="Hide console tools"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export default DebugToolbar;
