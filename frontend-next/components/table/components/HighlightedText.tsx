"use client";

import React, { useMemo } from "react";
import type { SearchMode } from "./SearchInput";

interface HighlightedTextProps {
  /** The text content to search within */
  text: string;
  /** The search term to highlight */
  highlight: string;
  /** The search mode determines how matches are found */
  mode: SearchMode;
  /** Optional className for the highlight mark */
  highlightClassName?: string;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a regex pattern for fuzzy matching
 * Matches characters in sequence with optional characters between
 * e.g., "acount" matches "account" (a...c...o...u...n...t)
 */
function buildFuzzyPattern(term: string): string {
  // Split into characters and join with optional characters between
  return term
    .split("")
    .map(escapeRegex)
    .join(".*?");
}

/**
 * Gets the appropriate regex for the search mode
 */
function getHighlightRegex(highlight: string, mode: SearchMode): RegExp | null {
  if (!highlight) return null;

  try {
    switch (mode) {
      case "exact":
        // Match the entire text exactly (case-insensitive)
        return new RegExp(`^${escapeRegex(highlight)}$`, "i");

      case "starts_with":
        // Match at the beginning only
        return new RegExp(`^${escapeRegex(highlight)}`, "i");

      case "fuzzy":
        // Fuzzy match - characters in sequence
        return new RegExp(buildFuzzyPattern(highlight), "i");

      case "regex":
        // User-provided regex pattern
        return new RegExp(highlight, "gi");

      case "contains":
      default:
        // Default: match anywhere in the string
        return new RegExp(escapeRegex(highlight), "gi");
    }
  } catch {
    // Invalid regex pattern - return null
    return null;
  }
}

/**
 * HighlightedText - Highlights search matches in text
 *
 * Shows WHERE matches occurred in search results by wrapping
 * matched portions in a highlighted <mark> element.
 *
 * Supports all search modes:
 * - contains: highlights all occurrences
 * - exact: highlights entire text if exact match
 * - starts_with: highlights the matching prefix
 * - fuzzy: highlights the fuzzy-matched characters
 * - regex: highlights regex matches
 *
 * @example
 * <HighlightedText
 *   text="Accounts Payable"
 *   highlight="acc"
 *   mode="contains"
 * />
 * // Renders: <mark>Acc</mark>ounts Payable
 */
export function HighlightedText({
  text,
  highlight,
  mode,
  highlightClassName = "bg-yellow-200 dark:bg-yellow-700 rounded px-0.5",
}: HighlightedTextProps) {
  const parts = useMemo(() => {
    // If no highlight term or text, return text as-is
    if (!highlight || !text) {
      return [{ text, isMatch: false }];
    }

    const regex = getHighlightRegex(highlight, mode);
    if (!regex) {
      return [{ text, isMatch: false }];
    }

    // For exact mode, check if entire text matches
    if (mode === "exact") {
      const matches = text.match(regex);
      if (matches) {
        return [{ text, isMatch: true }];
      }
      return [{ text, isMatch: false }];
    }

    // For other modes, split by matches
    const result: Array<{ text: string; isMatch: boolean }> = [];
    let lastIndex = 0;

    // Reset regex lastIndex for global matching
    regex.lastIndex = 0;

    // Find all matches
    const textStr = String(text);
    let match: RegExpExecArray | null;

    // Use a different approach for fuzzy since it matches the whole string
    if (mode === "fuzzy") {
      const fullMatch = textStr.match(regex);
      if (fullMatch && fullMatch[0]) {
        // For fuzzy, highlight the entire matched portion
        const matchStart = textStr.toLowerCase().indexOf(fullMatch[0].toLowerCase());
        if (matchStart >= 0) {
          if (matchStart > 0) {
            result.push({ text: textStr.slice(0, matchStart), isMatch: false });
          }
          result.push({ text: fullMatch[0], isMatch: true });
          if (matchStart + fullMatch[0].length < textStr.length) {
            result.push({ text: textStr.slice(matchStart + fullMatch[0].length), isMatch: false });
          }
          return result;
        }
      }
      return [{ text, isMatch: false }];
    }

    // For global regex matches (contains, starts_with, regex modes)
    while ((match = regex.exec(textStr)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        result.push({ text: textStr.slice(lastIndex, match.index), isMatch: false });
      }

      // Add the match
      result.push({ text: match[0], isMatch: true });
      lastIndex = match.index + match[0].length;

      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }

    // Add remaining text after last match
    if (lastIndex < textStr.length) {
      result.push({ text: textStr.slice(lastIndex), isMatch: false });
    }

    // If no matches found, return original text
    if (result.length === 0) {
      return [{ text, isMatch: false }];
    }

    return result;
  }, [text, highlight, mode]);

  return (
    <span>
      {parts.map((part, index) =>
        part.isMatch ? (
          <mark key={index} className={highlightClassName}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  );
}

export default HighlightedText;
