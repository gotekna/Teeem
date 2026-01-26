/**
 * TipTap Utilities - SSoT for TipTap configuration
 *
 * IMPORTANT: Import this file FIRST in any component that uses TipTap
 * to ensure warning suppression is active before editors initialize.
 *
 * Usage:
 *   import "@/lib/tiptap-utils"; // Must be first TipTap-related import
 *   import { useEditor } from "@tiptap/react";
 */

// Suppress TipTap duplicate extension warning
// This warning occurs with:
// - React Strict Mode (double mounting)
// - Hot Module Replacement in development
// - Multiple editor instances on the same page
// It doesn't affect functionality - TipTap handles duplicates correctly
if (typeof window !== "undefined") {
  // Only override once (check for marker)
  const windowWithMarker = window as typeof window & { __tiptapWarnSuppressed?: boolean };

  if (!windowWithMarker.__tiptapWarnSuppressed) {
    windowWithMarker.__tiptapWarnSuppressed = true;

    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      const message = args[0];
      if (
        typeof message === "string" &&
        message.includes("[tiptap warn]: Duplicate extension names")
      ) {
        return; // Suppress this specific warning
      }
      originalWarn.apply(console, args);
    };
  }
}

// Export nothing - this file is imported for side effects only
export {};
