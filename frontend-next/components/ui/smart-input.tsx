"use client";

import * as React from "react";
import { Input } from "./input";
import { WritingIndicator } from "./writing-indicator";
import { useWritingAssistant, WritingContext } from "@/hooks/useWritingAssistant";
import { cn } from "@/lib/utils";

type OnChangeHandler =
  | React.ChangeEventHandler<HTMLInputElement>
  | ((value: string) => void);

export interface SmartInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
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
 * Input with built-in spell/grammar checking
 *
 * Drop-in replacement for Input with writing assistance.
 * Supports both standard React onChange and simple string setters.
 *
 * @example
 * ```tsx
 * // With string setter (common pattern)
 * <SmartInput
 *   value={name}
 *   onChange={setName}
 *   context="task_name"
 * />
 *
 * // With event handler
 * <SmartInput
 *   value={name}
 *   onChange={(e) => setName(e.target.value)}
 *   context="task_name"
 * />
 * ```
 */
export const SmartInput = React.forwardRef<HTMLInputElement, SmartInputProps>(
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
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!onChange) return;

        // Check if it's a simple string setter by checking if it expects 1 arg
        // and the function name suggests it's a setter
        const fn = onChange as OnChangeHandler;
        try {
          // Try calling with string first (common pattern in codebase)
          (fn as (value: string) => void)(e.target.value);
        } catch {
          // Fall back to event handler
          (fn as React.ChangeEventHandler<HTMLInputElement>)(e);
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
          } as React.ChangeEvent<HTMLInputElement>;
          (onChange as React.ChangeEventHandler<HTMLInputElement>)(syntheticEvent);
        }
      },
      [onChange]
    );

    return (
      <div className="relative">
        <Input
          ref={ref}
          value={value}
          onChange={handleChange}
          className={cn(
            // Add padding-right for the indicator
            hasIssues || isChecking || alwaysShowIndicator ? "pr-8" : "",
            className
          )}
          spellCheck={true}
          {...props}
        />
        <WritingIndicator
          result={result}
          isChecking={isChecking}
          onApplyFix={handleApplyFix}
          alwaysShow={alwaysShowIndicator}
          className="absolute right-2 top-1/2 -translate-y-1/2"
        />
      </div>
    );
  }
);

SmartInput.displayName = "SmartInput";

export default SmartInput;
