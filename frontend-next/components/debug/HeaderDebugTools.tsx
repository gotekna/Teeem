"use client";

import { useState, useEffect, useRef } from "react";
import {
  ClipboardCopy,
  Check,
  AlertTriangle,
  RefreshCw,
  Camera,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { copyToClipboard } from "@/utils/formatters";
import consoleCapture, { type LogEntry } from "@/utils/consoleCapture";
import { clearAllCachedRecords } from "@/lib/records-cache";
import html2canvas from "html2canvas";

export function HeaderDebugTools() {
  const [logCount, setLogCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [copiedButton, setCopiedButton] = useState<string | null>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [clearing, setClearing] = useState(false);
  const isMountedRef = useRef(true);
  const queryClient = useQueryClient();

  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    const isStaging =
      typeof window !== "undefined" &&
      (window.location.hostname.includes("vercel.app") ||
        window.location.hostname.includes("staging") ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    if (isDev || isStaging) {
      setShouldRender(true);
    }
  }, [isDev]);

  useEffect(() => {
    if (!shouldRender) return;

    isMountedRef.current = true;
    consoleCapture.initialize();

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

  if (!shouldRender) return null;

  const handleCopyConsole = async () => {
    try {
      const result = await consoleCapture.copyToClipboard();
      console.log(result);
      setCopiedButton("console");
      setTimeout(() => setCopiedButton(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyErrors = async () => {
    try {
      const logs = consoleCapture.getLogs();
      const errors = logs.filter((log) => log.type === "error");
      const warnings = logs.filter((log) => log.type === "warn");

      let formatted = `=== Console Errors & Warnings ===\nErrors: ${errors.length} | Warnings: ${warnings.length}\nCaptured: ${new Date().toLocaleString()}\n`;

      if (errors.length > 0) {
        formatted += `\n--- ERRORS ---\n`;
        errors.forEach((log) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          formatted += `[${time}] ${log.message}\n`;
        });
      }

      if (warnings.length > 0) {
        formatted += `\n--- WARNINGS ---\n`;
        warnings.forEach((log) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          formatted += `[${time}] ${log.message}\n`;
        });
      }

      await copyToClipboard(formatted);
      setCopiedButton("errors");
      setTimeout(() => setCopiedButton(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleScreenshot = async () => {
    try {
      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: 0.3,
        width: window.innerWidth,
        height: window.innerHeight,
      });

      const pngDataUrl = canvas.toDataURL("image/png");
      const pngResponse = await fetch(pngDataUrl);
      const pngBlob = await pngResponse.blob();

      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob }),
        ]);
        setCopiedButton("screenshot");
        setTimeout(() => setCopiedButton(null), 2000);
      } catch {
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
      }
    } catch (err) {
      console.error("Screenshot failed:", err);
    }
  };

  const handleRefresh = () => {
    consoleCapture.clear();
    window.location.reload();
  };

  // Clear ALL app caches - use this after hotfixes
  const handleClearAllCache = async () => {
    setClearing(true);
    try {
      // 1. Clear React Query cache (API responses)
      queryClient.clear();
      console.log("[ClearCache] React Query cache cleared");

      // 2. Clear records cache (L1 memory + L2 IndexedDB)
      clearAllCachedRecords();
      console.log("[ClearCache] Records cache cleared (L1 + L2)");

      // 3. Clear app-specific localStorage items (but not auth)
      // NOTE: Intentionally uses raw localStorage iteration, not storage-utils.ts,
      // because we need to clear ALL keys (including unknown third-party keys),
      // not just known STORAGE_KEYS constants.
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.includes("token") && !key.includes("auth") && !key.includes("session")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      console.log(`[ClearCache] Cleared ${keysToRemove.length} localStorage items`);

      // 4. Clear sessionStorage (except auth)
      // NOTE: Same rationale as localStorage above - need to clear ALL keys.
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && !key.includes("token") && !key.includes("auth") && !key.includes("session")) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach((key) => sessionStorage.removeItem(key));
      console.log(`[ClearCache] Cleared ${sessionKeysToRemove.length} sessionStorage items`);

      // 5. Clear console capture logs
      consoleCapture.clear();

      // Brief visual feedback then reload
      setCopiedButton("clear");
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error("[ClearCache] Error:", err);
      setClearing(false);
    }
  };

  const handleValidate = async () => {
    try {
      const logs = consoleCapture.getLogs();
      const errors = logs.filter((log) => log.type === "error");
      const warnings = logs.filter((log) => log.type === "warn");

      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        scale: 0.3,
      });

      const pngDataUrl = canvas.toDataURL("image/png");
      const formattedLogs = logs
        .map((log) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          return `[${time}] [${log.type.toUpperCase()}] ${log.message}`;
        })
        .join("\n");

      const formatted = `=== VALIDATION CONTEXT ===
URL: ${window.location.href}
Errors: ${errors.length} | Warnings: ${warnings.length}
Captured: ${new Date().toLocaleString()}

--- SCREENSHOT (base64) ---
${pngDataUrl}

--- CONSOLE LOGS ---
${formattedLogs || "(No logs)"}
`;

      await copyToClipboard(formatted);
      setCopiedButton("validate");
      setTimeout(() => setCopiedButton(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  // Combined: Copy all console logs + errors in one action
  const handleCopyAllConsole = async () => {
    try {
      const logs = consoleCapture.getLogs();
      const errors = logs.filter((log) => log.type === "error");
      const warnings = logs.filter((log) => log.type === "warn");

      let formatted = `=== Console Logs ===\nTotal: ${logs.length} | Errors: ${errors.length} | Warnings: ${warnings.length}\nURL: ${window.location.href}\nCaptured: ${new Date().toLocaleString()}\n`;

      if (errors.length > 0) {
        formatted += `\n--- ERRORS ---\n`;
        errors.forEach((log) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          formatted += `[${time}] ${log.message}\n`;
        });
      }

      if (warnings.length > 0) {
        formatted += `\n--- WARNINGS ---\n`;
        warnings.forEach((log) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          formatted += `[${time}] ${log.message}\n`;
        });
      }

      formatted += `\n--- ALL LOGS ---\n`;
      logs.forEach((log) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        formatted += `[${time}] [${log.type.toUpperCase()}] ${log.message}\n`;
      });

      await copyToClipboard(formatted);
      setCopiedButton("console");
      setTimeout(() => setCopiedButton(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Console + Errors combined */}
      <button
        onClick={handleCopyAllConsole}
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
          copiedButton === "console"
            ? "bg-green-600 text-white"
            : errorCount > 0
              ? "bg-yellow-500 text-black hover:bg-yellow-600"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
        }`}
        title="Copy console logs + errors"
      >
        {copiedButton === "console" ? (
          <Check className="h-2.5 w-2.5" />
        ) : (
          <ClipboardCopy className="h-2.5 w-2.5" />
        )}
        {errorCount > 0 ? (
          <span className="px-1 py-0 rounded-full bg-red-600 text-white text-[9px] font-bold">
            {errorCount}
          </span>
        ) : logCount > 0 ? (
          <span className="px-1 py-0 rounded-full bg-indigo-800 text-white text-[9px] font-bold">
            {logCount}
          </span>
        ) : null}
      </button>

      {/* Screenshot */}
      <button
        onClick={handleScreenshot}
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
          copiedButton === "screenshot"
            ? "bg-green-600 text-white"
            : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800"
        }`}
        title="Copy screenshot"
      >
        {copiedButton === "screenshot" ? (
          <Check className="h-2.5 w-2.5" />
        ) : (
          <Camera className="h-2.5 w-2.5" />
        )}
      </button>

      {/* Clear Cache + Hard Refresh combined */}
      <button
        onClick={handleClearAllCache}
        disabled={clearing}
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
          copiedButton === "clear"
            ? "bg-green-600 text-white"
            : clearing
              ? "bg-red-300 text-white cursor-wait"
              : "bg-red-500 text-white hover:bg-red-600"
        }`}
        title="Clear cache & hard refresh"
      >
        {copiedButton === "clear" ? (
          <Check className="h-2.5 w-2.5" />
        ) : (
          <>
            <Trash2 className="h-2.5 w-2.5" />
            <RefreshCw className="h-2 w-2" />
          </>
        )}
      </button>

      {/* Validate - Screenshot + Console */}
      <button
        onClick={handleValidate}
        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
          copiedButton === "validate"
            ? "bg-green-600 text-white"
            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-300"
        }`}
        title="Copy screenshot + console (for bug reports)"
      >
        {copiedButton === "validate" ? (
          <Check className="h-2.5 w-2.5" />
        ) : (
          <>
            <span className="text-[10px] font-bold">V</span>
            {(logCount > 0 || errorCount > 0) && (
              <span className={`px-1 py-0 rounded-full text-white text-[9px] font-bold ${errorCount > 0 ? 'bg-red-600' : 'bg-emerald-600'}`}>
                {errorCount > 0 ? errorCount : logCount}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
