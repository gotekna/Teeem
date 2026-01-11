"use client";

import * as React from "react";
import { Textarea } from "./textarea";
import { WritingIndicator } from "./writing-indicator";
import { useWritingAssistant, WritingContext } from "@/hooks/useWritingAssistant";
import { cn } from "@/lib/utils";

type OnChangeHandler =
  | React.ChangeEventHandler<HTMLTextAreaElement>
  | ((value: string) => void);

export interface SmartTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  /** Context helps AI understand what this field is for */
  context?: WritingContext;
  /** Disable AI checking (browser spell check still works) */
  disableAI?: boolean;
  /** Show indicator even when no issues */
  alwaysShowIndicator?: boolean;
  /** Accepts either (e) => void or (value: string) => void */
  onChange?: OnChangeHandler;
}

/**
 * Textarea with built-in spell/grammar checking
 *
 * Drop-in replacement for Textarea with writing assistance.
 * Supports both standard React onChange and simple string setters.
 *
 * @example
 * ```tsx
 * // With string setter (common pattern)
 * <SmartTextarea
 *   value={notes}
 *   onChange={setNotes}
 *   context="notes"
 * />
 *
 * // With event handler
 * <SmartTextarea
 *   value={notes}
 *   onChange={(e) => setNotes(e.target.value)}
 *   context="notes"
 * />
 * ```
 */
export const SmartTextarea = React.forwardRef<
  HTMLTextAreaElement,
  SmartTextareaProps
>(
  (
    {
      context = "general",
      disableAI = false,
      alwaysShowIndicator = false,
      className,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const textValue = typeof value === "string" ? value : "";

    const { result, isChecking, hasIssues } = useWritingAssistant(textValue, {
      enabled: !disableAI,
      context,
    });

    // Detect if onChange expects string or event
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!onChange) return;

        const fn = onChange as OnChangeHandler;
        try {
          // Try calling with string first (common pattern in codebase)
          (fn as (value: string) => void)(e.target.value);
        } catch {
          // Fall back to event handler
          (fn as React.ChangeEventHandler<HTMLTextAreaElement>)(e);
        }
      },
      [onChange]
    );

    // Handle applying fix from writing indicator
    const handleApplyFix = React.useCallback(
      (correctedText: string) => {
        if (!onChange) return;

        try {
          // Try calling with string first
          (onChange as (value: string) => void)(correctedText);
        } catch {
          // Fall back to synthetic event
          const syntheticEvent = {
            target: { value: correctedText },
            currentTarget: { value: correctedText },
          } as React.ChangeEvent<HTMLTextAreaElement>;
          (onChange as React.ChangeEventHandler<HTMLTextAreaElement>)(syntheticEvent);
        }
      },
      [onChange]
    );

    return (
      <div className="relative">
        <Textarea
          ref={ref}
          value={value}
          onChange={handleChange}
          className={cn(className)}
          spellCheck={true}
          {...props}
        />
        <WritingIndicator
          result={result}
          isChecking={isChecking}
          onApplyFix={handleApplyFix}
          alwaysShow={alwaysShowIndicator}
          className="absolute right-2 top-2"
        />
      </div>
    );
  }
);

SmartTextarea.displayName = "SmartTextarea";

export default SmartTextarea;
