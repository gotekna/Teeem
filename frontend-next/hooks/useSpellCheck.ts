"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";

/**
 * A single issue found in the text
 */
export interface SpellCheckIssue {
  type: "spelling" | "grammar" | "tone";
  severity: "error" | "warning";
  original: string;
  suggestion: string;
  explanation: string;
  /** Character position in text (0-indexed) */
  start: number;
  /** Character position end (exclusive) */
  end: number;
}

/**
 * Result of the spell check
 */
export interface SpellCheckResult {
  issues: SpellCheckIssue[];
  correctedText: string;
  quality: "excellent" | "good" | "needs_work";
}

/**
 * Context types for different text fields
 * Helps the AI understand what kind of text it's checking
 */
export type SpellCheckContext =
  | "task_name"
  | "question"
  | "action"
  | "answer"
  | "email_subject"
  | "email_body"
  | "notes"
  | "comment"
  | "general";

interface UseSpellCheckOptions {
  /** Enable or disable AI spell check (default: true) */
  enabled?: boolean;
  /** Context helps AI understand what this field is for */
  context?: SpellCheckContext;
  /** Milliseconds to wait after typing before checking (default: 800) */
  debounceMs?: number;
  /** Minimum text length to check (default: 5) */
  minLength?: number;
  /** Called when issues change */
  onIssuesChange?: (issues: SpellCheckIssue[]) => void;
}

interface UseSpellCheckReturn {
  /** Current issues found */
  issues: SpellCheckIssue[];
  /** Whether a check is in progress */
  isChecking: boolean;
  /** The corrected text (all fixes applied) */
  correctedText: string | null;
  /** Quality assessment */
  quality: "excellent" | "good" | "needs_work" | null;
  /** Force check immediately (bypasses debounce) */
  checkNow: () => Promise<void>;
  /** Apply a single fix - returns new text */
  applyFix: (issue: SpellCheckIssue, currentText: string) => string;
  /** Apply all fixes - returns new text */
  applyAllFixes: (currentText: string) => string;
  /** Clear all issues */
  clear: () => void;
  /** Dismiss a specific issue (won't show again for this text) */
  dismissIssue: (issue: SpellCheckIssue) => void;
}

/**
 * Hook for AI-powered spell check on plain text
 *
 * Works with any text input - textarea, input, or contentEditable.
 * Returns issues with character positions for highlighting.
 *
 * @example
 * ```tsx
 * const [text, setText] = useState("");
 * const { issues, isChecking, applyFix } = useSpellCheck(text, {
 *   context: "task_name",
 *   enabled: true,
 * });
 *
 * // Render issues as underlines or show in a popover
 * ```
 */
export function useSpellCheck(
  text: string | undefined | null,
  options: UseSpellCheckOptions = {}
): UseSpellCheckReturn {
  const {
    enabled = true,
    context = "general",
    debounceMs = 800,
    minLength = 5,
    onIssuesChange,
  } = options;

  const [issues, setIssues] = useState<SpellCheckIssue[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [correctedText, setCorrectedText] = useState<string | null>(null);
  const [quality, setQuality] = useState<"excellent" | "good" | "needs_work" | null>(null);

  // Track state
  const lastCheckedText = useRef<string>("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const dismissedIssues = useRef<Set<string>>(new Set());

  // Normalize text
  const normalizedText = (text || "").trim();

  // Core check function
  const checkText = useCallback(
    async (textToCheck: string) => {
      if (!textToCheck || textToCheck.length < minLength) {
        setIssues([]);
        setCorrectedText(null);
        setQuality(null);
        return;
      }

      // Skip if same text
      if (textToCheck === lastCheckedText.current) {
        return;
      }

      // Cancel previous request
      if (abortController.current) {
        abortController.current.abort();
      }
      abortController.current = new AbortController();

      setIsChecking(true);
      lastCheckedText.current = textToCheck;

      try {
        const response = await api.post<{
          success: boolean;
          data: {
            issues: Array<{
              type: "spelling" | "grammar" | "tone";
              severity: "error" | "warning";
              original: string;
              suggestion: string;
              explanation: string;
            }>;
            corrected_text: string;
            quality: "excellent" | "good" | "needs_work";
          };
        }>("/api/v1/writing_assistant/check", {
          text: textToCheck,
          context,
        });

        if (response?.data) {
          // Find positions for each issue
          const issuesWithPositions = findIssuePositions(
            textToCheck,
            response.data.issues,
            dismissedIssues.current
          );

          setIssues(issuesWithPositions);
          setCorrectedText(response.data.corrected_text);
          setQuality(response.data.quality);
          onIssuesChange?.(issuesWithPositions);
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("[useSpellCheck] Check failed:", error);
        }
      } finally {
        setIsChecking(false);
      }
    },
    [context, minLength, onIssuesChange]
  );

  // Debounced check on text change
  useEffect(() => {
    if (!enabled) {
      setIssues([]);
      setCorrectedText(null);
      setQuality(null);
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!normalizedText || normalizedText.length < minLength) {
      setIssues([]);
      setCorrectedText(null);
      setQuality(null);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      checkText(normalizedText);
    }, debounceMs);

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

  // Force check now
  const checkNow = useCallback(async () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    await checkText(normalizedText);
  }, [normalizedText, checkText]);

  // Apply a single fix
  const applyFix = useCallback(
    (issue: SpellCheckIssue, currentText: string): string => {
      const before = currentText.slice(0, issue.start);
      const after = currentText.slice(issue.end);
      const newText = before + issue.suggestion + after;

      // Update issues - remove the fixed one and adjust positions
      const lengthDiff = issue.suggestion.length - issue.original.length;
      const newIssues = issues
        .filter((i) => i !== issue)
        .map((i) => {
          if (i.start > issue.start) {
            return {
              ...i,
              start: i.start + lengthDiff,
              end: i.end + lengthDiff,
            };
          }
          return i;
        });

      setIssues(newIssues);
      onIssuesChange?.(newIssues);

      // Reset checked text so next check doesn't skip
      lastCheckedText.current = "";

      return newText;
    },
    [issues, onIssuesChange]
  );

  // Apply all fixes
  const applyAllFixes = useCallback(
    (currentText: string): string => {
      if (correctedText) {
        setIssues([]);
        onIssuesChange?.([]);
        lastCheckedText.current = "";
        return correctedText;
      }

      // Fallback: apply fixes in reverse order
      const sortedIssues = [...issues].sort((a, b) => b.start - a.start);
      let result = currentText;

      for (const issue of sortedIssues) {
        const before = result.slice(0, issue.start);
        const after = result.slice(issue.end);
        result = before + issue.suggestion + after;
      }

      setIssues([]);
      onIssuesChange?.([]);
      lastCheckedText.current = "";

      return result;
    },
    [correctedText, issues, onIssuesChange]
  );

  // Clear issues
  const clear = useCallback(() => {
    setIssues([]);
    setCorrectedText(null);
    setQuality(null);
    lastCheckedText.current = "";
    dismissedIssues.current.clear();
  }, []);

  // Dismiss an issue
  const dismissIssue = useCallback(
    (issue: SpellCheckIssue) => {
      dismissedIssues.current.add(`${issue.original}:${issue.start}`);
      const newIssues = issues.filter((i) => i !== issue);
      setIssues(newIssues);
      onIssuesChange?.(newIssues);
    },
    [issues, onIssuesChange]
  );

  return {
    issues,
    isChecking,
    correctedText,
    quality,
    checkNow,
    applyFix,
    applyAllFixes,
    clear,
    dismissIssue,
  };
}

/**
 * Find character positions for each issue in the text
 */
function findIssuePositions(
  text: string,
  issues: Array<{
    type: "spelling" | "grammar" | "tone";
    severity: "error" | "warning";
    original: string;
    suggestion: string;
    explanation: string;
  }>,
  dismissedIssues: Set<string>
): SpellCheckIssue[] {
  const result: SpellCheckIssue[] = [];

  for (const issue of issues) {
    let searchPos = 0;
    while (true) {
      const index = text.indexOf(issue.original, searchPos);
      if (index === -1) break;

      const dismissKey = `${issue.original}:${index}`;
      if (!dismissedIssues.has(dismissKey)) {
        result.push({
          ...issue,
          start: index,
          end: index + issue.original.length,
        });
      }

      searchPos = index + 1;
    }
  }

  return result;
}

export default useSpellCheck;
