"use client";

import * as React from "react";
import { Textarea, TextareaProps } from "@/components/ui/textarea";
import { WritingIndicator } from "@/components/ui/writing-indicator";
import { useWritingAssistant, WritingContext } from "@/hooks/useWritingAssistant";
import { cn } from "@/lib/utils";

export interface SmartTextareaProps extends Omit<TextareaProps, "value" | "onChange"> {
  /** Controlled value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Context helps AI understand what this field is for */
  context?: WritingContext;
  /** Disable AI checking (browser spell check still works) */
  disableAI?: boolean;
  /** Always show indicator even when no issues */
  alwaysShowIndicator?: boolean;
  /** Milliseconds to wait after typing before checking (default: 1500) */
  debounceMs?: number;
}

/**
 * Textarea with built-in AI writing assistant
 *
 * Drop-in replacement for Textarea with spell check, grammar check, and tone suggestions.
 *
 * @example
 * ```tsx
 * <SmartTextarea
 *   value={question}
 *   onChange={setQuestion}
 *   context="question"
 *   placeholder="Enter question..."
 * />
 * ```
 */
export function SmartTextarea({
  value,
  onChange,
  context = "general",
  disableAI = false,
  alwaysShowIndicator = false,
  debounceMs = 1500,
  className,
  ...props
}: SmartTextareaProps) {
  const { result, isChecking, hasIssues } = useWritingAssistant(value, {
    enabled: !disableAI,
    context,
    debounceMs,
  });

  const handleApplyFix = React.useCallback(
    (correctedText: string) => {
      onChange(correctedText);
    },
    [onChange]
  );

  const showIndicator = !disableAI && (isChecking || hasIssues || alwaysShowIndicator);

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck="true"
        className={cn(showIndicator && "pr-8", className)}
        {...props}
      />
      {showIndicator && (
        <WritingIndicator
          result={result}
          isChecking={isChecking}
          onApplyFix={handleApplyFix}
          alwaysShow={alwaysShowIndicator}
          className="absolute right-2 top-2"
        />
      )}
    </div>
  );
}

export default SmartTextarea;
