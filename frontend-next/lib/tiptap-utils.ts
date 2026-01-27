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

// Immediate execution - runs as soon as this module is imported
const suppressTipTapWarnings = () => {
  if (typeof window === "undefined") return;
  if (typeof console === "undefined") return;

  // Check for marker to avoid multiple patches
  const win = window as typeof window & { __tiptapWarnPatched?: boolean };
  if (win.__tiptapWarnPatched) return;
  win.__tiptapWarnPatched = true;

  // Store original warn function
  const originalWarn = console.warn.bind(console);

  // Replace console.warn with filtered version
  console.warn = function (...args: unknown[]) {
    // Check first argument for TipTap duplicate warning
    const firstArg = args[0];
    if (typeof firstArg === "string") {
      // Suppress TipTap duplicate extension warnings
      if (firstArg.includes("[tiptap warn]") && firstArg.includes("Duplicate extension")) {
        return;
      }
    }
    // Pass through all other warnings
    return originalWarn(...args);
  };
};

// Execute immediately when module loads
suppressTipTapWarnings();

// Export nothing - this file is imported for side effects only
export {};
