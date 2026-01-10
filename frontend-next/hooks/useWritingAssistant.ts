"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";

/**
 * A single issue found in the text
 */
export interface WritingIssue {
  type: "spelling" | "grammar" | "tone";
  severity: "error" | "warning";
  original: string;
  suggestion: string;
  explanation: string;
}

/**
 * Result of the writing check
 */
export interface WritingCheckResult {
  issues: WritingIssue[];
  corrected_text: string;
  quality: "excellent" | "good" | "needs_work";
}

/**
 * Context types for different text fields
 * Helps the AI understand what kind of text it's checking
 */
export type WritingContext =
  | "task_name"
  | "question"
  | "action"
  | "answer"
  | "email_subject"
  | "email_body"
  | "notes"
  | "comment"
  | "general";

interface UseWritingAssistantOptions {
  /** Enable or disable the AI check (browser spell check still works) */
  enabled?: boolean;
  /** Context helps AI understand what this field is for */
  context?: WritingContext;
  /** Milliseconds to wait after typing before checking (default: 1500) */
  debounceMs?: number;
  /** Minimum text length to check (default: 5) */
  minLength?: number;
}

interface UseWritingAssistantReturn {
  /** The result of the last check */
  result: WritingCheckResult | null;
  /** Whether a check is in progress */
  isChecking: boolean;
  /** Whether there are any issues found */
  hasIssues: boolean;
  /** Force a check immediately (bypasses debounce) */
  checkNow: () => Promise<void>;
  /** Clear the current result */
  clear: () => void;
}

/**
 * Hook for AI-powered writing assistance
 *
 * @example
 * ```tsx
 * const { result, isChecking, hasIssues } = useWritingAssistant(
 *   taskName,
 *   { context: "task_name", enabled: true }
 * );
 * ```
 */
export function useWritingAssistant(
  text: string | undefined | null,
  options: UseWritingAssistantOptions = {}
): UseWritingAssistantReturn {
  const {
    enabled = true,
    context = "general",
    debounceMs = 1500,
    minLength = 5,
  } = options;

  const [result, setResult] = useState<WritingCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Track the last checked text to avoid duplicate checks
  const lastCheckedText = useRef<string>("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);

  // Normalize text for comparison
  const normalizedText = (text || "").trim();

  // Core check function
  const checkText = useCallback(
    async (textToCheck: string) => {
      // Skip if empty or too short
      if (!textToCheck || textToCheck.length < minLength) {
        setResult(null);
        return;
      }

      // Skip if already checked
      if (textToCheck === lastCheckedText.current) {
        return;
      }

      // Cancel any in-flight request
      if (abortController.current) {
        abortController.current.abort();
      }
      abortController.current = new AbortController();

      setIsChecking(true);
      lastCheckedText.current = textToCheck;

      try {
        const response = await api.post<{
          success: boolean;
          data: WritingCheckResult;
        }>("/api/v1/writing_assistant/check", {
          text: textToCheck,
          context,
        });

        if (response?.data) {
          setResult(response.data);
        }
      } catch (error) {
        // Only log if not aborted
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("[WritingAssistant] Check failed:", error);
        }
      } finally {
        setIsChecking(false);
      }
    },
    [context, minLength]
  );

  // Debounced check on text change
  useEffect(() => {
    if (!enabled) {
      setResult(null);
      return;
    }

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Skip if empty or too short
    if (!normalizedText || normalizedText.length < minLength) {
      setResult(null);
      return;
    }

    // Set new debounce timer
    debounceTimer.current = setTimeout(() => {
      checkText(normalizedText);
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [normalizedText, enabled, debounceMs, minLength, checkText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  // Force check now (bypass debounce)
  const checkNow = useCallback(async () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    await checkText(normalizedText);
  }, [normalizedText, checkText]);

  // Clear result
  const clear = useCallback(() => {
    setResult(null);
    lastCheckedText.current = "";
  }, []);

  const hasIssues = (result?.issues?.length ?? 0) > 0;

  return {
    result,
    isChecking,
    hasIssues,
    checkNow,
    clear,
  };
}

export default useWritingAssistant;
