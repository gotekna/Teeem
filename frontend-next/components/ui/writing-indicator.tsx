"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WritingCheckResult, WritingIssue } from "@/hooks/useWritingAssistant";

interface WritingIndicatorProps {
  /** Result from useWritingAssistant hook */
  result: WritingCheckResult | null;
  /** Whether a check is in progress */
  isChecking: boolean;
  /** Callback when user clicks "Fix All" */
  onApplyFix?: (correctedText: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Always show indicator even when no issues */
  alwaysShow?: boolean;
}

/**
 * Displays writing check status with popover for issues
 *
 * Shows:
 * - Spinner when checking
 * - Green check when no issues
 * - Yellow warning for suggestions
 * - Red X for errors
 */
export function WritingIndicator({
  result,
  isChecking,
  onApplyFix,
  className,
  alwaysShow = false,
}: WritingIndicatorProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Don't show anything if not checking and no result (unless alwaysShow)
  if (!isChecking && !result && !alwaysShow) {
    return null;
  }

  // Show spinner while checking
  if (isChecking) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No result yet
  if (!result) {
    return null;
  }

  const hasErrors = result.issues?.some((i) => i.severity === "error");
  const hasWarnings = result.issues?.some((i) => i.severity === "warning");
  const hasIssues = (result.issues?.length ?? 0) > 0;

  // Determine icon and color
  let Icon = CheckCircle2;
  let iconClass = "text-green-500 dark:text-green-400";
  let title = "Looks good!";

  if (hasErrors) {
    Icon = XCircle;
    iconClass = "text-red-500 dark:text-red-400";
    title = `${result.issues.length} issue${result.issues.length > 1 ? "s" : ""} found`;
  } else if (hasWarnings) {
    Icon = AlertCircle;
    iconClass = "text-yellow-500 dark:text-yellow-400";
    title = `${result.issues.length} suggestion${result.issues.length > 1 ? "s" : ""}`;
  }

  // If no issues and not alwaysShow, don't render
  if (!hasIssues && !alwaysShow) {
    return null;
  }

  // If no issues and alwaysShow, just show the green check (no popover)
  if (!hasIssues) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        title={title}
      >
        <Icon className={cn("h-4 w-4", iconClass)} />
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-center p-0.5 rounded transition-colors",
            "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            className
          )}
          title={title}
        >
          <Icon className={cn("h-4 w-4", iconClass)} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-3"
        align="end"
        side="bottom"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Writing Check</h4>
            {result.quality && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  result.quality === "excellent" && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900/30 dark:text-green-400",
                  result.quality === "good" && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-400",
                  result.quality === "needs_work" && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400"
                )}
              >
                {result.quality.replace("_", " ")}
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {result.issues.map((issue, i) => (
              <IssueItem key={i} issue={issue} />
            ))}
          </div>

          {onApplyFix && result.corrected_text && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                onApplyFix(result.corrected_text);
                setIsOpen(false);
              }}
            >
              Fix All
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function IssueItem({ issue }: { issue: WritingIssue }) {
  const borderColor =
    issue.severity === "error"
      ? "border-red-500"
      : "border-yellow-500";

  const typeLabel =
    issue.type === "spelling"
      ? "Spelling"
      : issue.type === "grammar"
        ? "Grammar"
        : "Tone";

  return (
    <div className={cn("text-sm border-l-2 pl-2 py-1", borderColor)}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span
          className={cn(
            "text-xs font-medium px-1 py-0.5 rounded",
            issue.severity === "error"
              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400"
          )}
        >
          {typeLabel}
        </span>
      </div>
      <div className="space-y-0.5">
        <p className="text-muted-foreground line-through">{issue.original}</p>
        <p className="text-foreground font-medium">{issue.suggestion}</p>
        {issue.explanation && (
          <p className="text-xs text-muted-foreground">{issue.explanation}</p>
        )}
      </div>
    </div>
  );
}

export default WritingIndicator;
