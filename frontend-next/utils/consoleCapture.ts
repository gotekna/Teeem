// Console Capture Utility - Intercepts and stores all console output

import { copyToClipboard } from "@/utils/formatters";

interface LogEntry {
  timestamp: string;
  type: "log" | "error" | "warn" | "info" | "debug";
  message: string;
  raw?: unknown[];
}

type LogListener = (logs: LogEntry[]) => void;

class ConsoleCapture {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
  };
  private listeners: LogListener[] = [];
  private initialized = false;

  constructor() {
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;

    // Intercept console.log
    console.log = (...args: unknown[]) => {
      this.capture("log", args);
      this.originalConsole.log.apply(console, args);
    };

    // Intercept console.error
    console.error = (...args: unknown[]) => {
      this.capture("error", args);
      this.originalConsole.error.apply(console, args);
    };

    // Intercept console.warn
    console.warn = (...args: unknown[]) => {
      this.capture("warn", args);
      this.originalConsole.warn.apply(console, args);
    };

    // Intercept console.info
    console.info = (...args: unknown[]) => {
      this.capture("info", args);
      this.originalConsole.info.apply(console, args);
    };

    // Intercept console.debug
    console.debug = (...args: unknown[]) => {
      this.capture("debug", args);
      this.originalConsole.debug.apply(console, args);
    };

    // Capture unhandled errors
    if (typeof window !== "undefined") {
      window.addEventListener("error", (event) => {
        this.capture("error", [
          `Unhandled Error: ${event.message}`,
          event.filename,
          `Line: ${event.lineno}:${event.colno}`,
        ]);
      });

      // Capture unhandled promise rejections
      window.addEventListener("unhandledrejection", (event) => {
        this.capture("error", [`Unhandled Promise Rejection: ${event.reason}`]);
      });
    }
  }

  private capture(type: LogEntry["type"], args: unknown[]) {
    const timestamp = new Date().toISOString();
    const message = args
      .map((arg) => {
        if (typeof arg === "object") {
          try {
            return JSON.stringify(
              arg,
              (key, value) => {
                if (typeof value === "object" && value !== null) {
                  if (value instanceof Error) {
                    return `${value.name}: ${value.message}\n${value.stack}`;
                  }
                }
                return value;
              },
              2
            );
          } catch {
            if (arg instanceof Error) {
              return `${arg.name}: ${arg.message}\n${arg.stack}`;
            }
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");

    this.logs.push({
      timestamp,
      type,
      message,
      raw: args,
    });

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.notifyListeners();
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  getFormattedLogs(): string {
    return this.logs
      .map((log) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        return `[${time}] [${log.type.toUpperCase()}] ${log.message}`;
      })
      .join("\n\n");
  }

  async copyToClipboard(): Promise<string> {
    const formatted = this.getFormattedLogs();

    if (formatted.length === 0) {
      return "No console logs captured yet";
    }

    const header = `=== Console Logs Captured ===\nTotal Entries: ${this.logs.length}\nCaptured at: ${new Date().toLocaleString()}\n\n`;
    const fullText = header + formatted;

    try {
      await copyToClipboard(fullText);
      return `Copied ${this.logs.length} console entries to clipboard!`;
    } catch (err) {
      throw new Error(`Failed to copy: ${err}`);
    }
  }

  clear() {
    this.logs = [];
    this.notifyListeners();
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.logs));
  }

  getErrorCount(): number {
    return this.logs.filter((log) => log.type === "error" || log.type === "warn").length;
  }
}

// Create singleton instance
const consoleCapture = new ConsoleCapture();

// Expose to window for debugging
if (typeof window !== "undefined") {
  (window as unknown as { consoleCapture: ConsoleCapture }).consoleCapture = consoleCapture;
}

export default consoleCapture;
export type { LogEntry };
