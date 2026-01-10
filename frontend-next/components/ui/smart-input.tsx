"use client";

import * as React from "react";
import { Input, InputProps } from "@/components/ui/input";
import { WritingIndicator } from "@/components/ui/writing-indicator";
import { useWritingAssistant, WritingContext } from "@/hooks/useWritingAssistant";
import { cn } from "@/lib/utils";

export interface SmartInputProps extends Omit<InputProps, "value" | "onChange"> {
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
  /** Position of the indicator: 'inside' (default) or 'outside' */
  indicatorPosition?: "inside" | "outside";
}

/**
 * Input with built-in AI writing assistant
 *
 * Drop-in replacement for Input with spell check, grammar check, and tone suggestions.
 *
 * @example
 * ```tsx
 * <SmartInput
 *   value={taskName}
 *   onChange={setTaskName}
 *   context="task_name"
 *   placeholder="Enter task name..."
 * />
 * ```
 */
export function SmartInput({
  value,
  onChange,
  context = "general",
  disableAI = false,
  alwaysShowIndicator = false,
  debounceMs = 1500,
  indicatorPosition = "inside",
  className,
  ...props
}: SmartInputProps) {
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

  if (indicatorPosition === "outside") {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck="true"
          className={className}
          {...props}
        />
        {showIndicator && (
          <WritingIndicator
            result={result}
            isChecking={isChecking}
            onApplyFix={handleApplyFix}
            alwaysShow={alwaysShowIndicator}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
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
          className="absolute right-2 top-1/2 -translate-y-1/2"
        />
      )}
    </div>
  );
}

export default SmartInput;
