"use client";

import * as React from "react";
import { useSpellCheck, type SpellCheckIssue, type SpellCheckContext } from "@/hooks/useSpellCheck";
import { cn } from "@/lib/utils";
import { Check, X, ChevronRight, Loader2, SpellCheck, Sparkles, BookPlus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface SpellCheckTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  /** Current value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Context helps AI understand what this field is for */
  context?: SpellCheckContext;
  /** Enable spell check (default: true) */
  enableSpellCheck?: boolean;
  /** Show the spell check indicator badge (default: true) */
  showIndicator?: boolean;
  /** Custom class for the wrapper */
  wrapperClassName?: string;
}

/**
 * Textarea with AI-powered spell check
 *
 * Shows a small indicator when issues are found, with a popover to fix them.
 *
 * @example
 * ```tsx
 * <SpellCheckTextarea
 *   value={notes}
 *   onChange={setNotes}
 *   context="notes"
 *   placeholder="Enter notes..."
 * />
 * ```
 */
export function SpellCheckTextarea({
  value,
  onChange,
  context = "general",
  enableSpellCheck = true,
  showIndicator = true,
  wrapperClassName,
  className,
  ...props
}: SpellCheckTextareaProps) {
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  const {
    issues,
    isChecking,
    quality,
    applyFix,
    applyAllFixes,
    dismissIssue,
    addToDictionary,
  } = useSpellCheck(value, {
    enabled: enableSpellCheck,
    context,
    debounceMs: 800,
  });

  const hasIssues = issues.length > 0;

  // Handle fixing a single issue
  const handleFix = (issue: SpellCheckIssue) => {
    const newText = applyFix(issue, value);
    onChange(newText);
  };

  // Handle fixing all issues
  const handleFixAll = () => {
    const newText = applyAllFixes(value);
    onChange(newText);
    setIsPopoverOpen(false);
  };

  // Handle adding a word to the dictionary
  const handleAddToDictionary = async (issue: SpellCheckIssue) => {
    await addToDictionary(issue.original);
  };

  return (
    <div className={cn("relative", wrapperClassName)}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          hasIssues && "pr-10",
          className
        )}
        {...props}
      />

      {/* Spell check indicator */}
      {showIndicator && enableSpellCheck && (
        <div className="absolute top-2 right-2">
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : hasIssues ? (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  <SpellCheck className="h-3 w-3" />
                  {issues.length}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80 p-0"
                align="end"
                side="bottom"
              >
                <IssuesList
                  issues={issues}
                  onFix={handleFix}
                  onDismiss={dismissIssue}
                  onFixAll={handleFixAll}
                  onAddToDictionary={handleAddToDictionary}
                />
              </PopoverContent>
            </Popover>
          ) : quality === "excellent" && value.length > 10 ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs">
              <Check className="h-3 w-3" />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Input with AI-powered spell check
 *
 * Same as SpellCheckTextarea but for single-line inputs.
 */
interface SpellCheckInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  /** Current value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Context helps AI understand what this field is for */
  context?: SpellCheckContext;
  /** Enable spell check (default: true) */
  enableSpellCheck?: boolean;
  /** Show the spell check indicator badge (default: true) */
  showIndicator?: boolean;
  /** Custom class for the wrapper */
  wrapperClassName?: string;
}

export function SpellCheckInput({
  value,
  onChange,
  context = "general",
  enableSpellCheck = true,
  showIndicator = true,
  wrapperClassName,
  className,
  ...props
}: SpellCheckInputProps) {
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  const {
    issues,
    isChecking,
    quality,
    applyFix,
    applyAllFixes,
    dismissIssue,
    addToDictionary,
  } = useSpellCheck(value, {
    enabled: enableSpellCheck,
    context,
    debounceMs: 800,
  });

  const hasIssues = issues.length > 0;

  const handleFix = (issue: SpellCheckIssue) => {
    const newText = applyFix(issue, value);
    onChange(newText);
  };

  const handleFixAll = () => {
    const newText = applyAllFixes(value);
    onChange(newText);
    setIsPopoverOpen(false);
  };

  const handleAddToDictionary = async (issue: SpellCheckIssue) => {
    await addToDictionary(issue.original);
  };

  return (
    <div className={cn("relative", wrapperClassName)}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          hasIssues && "pr-10",
          className
        )}
        {...props}
      />

      {showIndicator && enableSpellCheck && (
        <div className="absolute top-1/2 -translate-y-1/2 right-2">
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : hasIssues ? (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  <SpellCheck className="h-3 w-3" />
                  {issues.length}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80 p-0"
                align="end"
                side="bottom"
              >
                <IssuesList
                  issues={issues}
                  onFix={handleFix}
                  onDismiss={dismissIssue}
                  onFixAll={handleFixAll}
                  onAddToDictionary={handleAddToDictionary}
                />
              </PopoverContent>
            </Popover>
          ) : quality === "excellent" && value.length > 10 ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : null}
        </div>
      )}
    </div>
  );
}

// Shared issues list component
function IssuesList({
  issues,
  onFix,
  onDismiss,
  onFixAll,
  onAddToDictionary,
}: {
  issues: SpellCheckIssue[];
  onFix: (issue: SpellCheckIssue) => void;
  onDismiss: (issue: SpellCheckIssue) => void;
  onFixAll: () => void;
  onAddToDictionary: (issue: SpellCheckIssue) => void;
}) {
  const issueTypeConfig = {
    spelling: {
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/50",
      label: "Spelling",
    },
    grammar: {
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/50",
      label: "Grammar",
    },
    tone: {
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/50",
      label: "Tone",
    },
  };

  return (
    <div className="max-h-[300px] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium">
          {issues.length} issue{issues.length !== 1 ? "s" : ""} found
        </span>
        {issues.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onFixAll}
            className="h-7 text-xs"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Fix All
          </Button>
        )}
      </div>

      {/* Issues */}
      <div className="divide-y">
        {issues.map((issue, idx) => {
          const config = issueTypeConfig[issue.type];
          return (
            <div key={`${issue.original}-${issue.start}-${idx}`} className="p-3">
              {/* Type badge and original/suggestion */}
              <div className="flex items-start gap-2 mb-2">
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
                    config.bg,
                    config.color
                  )}
                >
                  {config.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="line-through text-muted-foreground truncate">
                      {issue.original}
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-medium text-green-600 dark:text-green-400 truncate">
                      {issue.suggestion}
                    </span>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              {issue.explanation && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {issue.explanation}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFix(issue)}
                  className="h-7 text-xs flex-1"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Fix
                </Button>
                {issue.type === "spelling" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onAddToDictionary(issue)}
                    className="h-7 text-xs"
                    title="Add to Dictionary"
                  >
                    <BookPlus className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDismiss(issue)}
                  className="h-7 text-xs"
                >
                  Ignore
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SpellCheckTextarea;
