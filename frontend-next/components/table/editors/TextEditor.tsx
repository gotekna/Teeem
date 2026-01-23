"use client";

/**
 * TextEditor Component
 *
 * Handles text-based cell editing for:
 * - single_line_text
 * - email
 * - phone
 * - url
 * - multiple_lines_text (multiline mode)
 *
 * Features:
 * - Auto-focus on mount
 * - Tab/Shift+Tab for navigation
 * - Escape to cancel
 * - Enter to save (single line) or new line (multiline)
 * - Debounced validation while typing
 * - Error display with red border
 * - AI-powered spell check (opt-in)
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from "@/components/ui/spinner";
import { useSpellCheck, type SpellCheckIssue } from "@/hooks/useSpellCheck";
import { Check, ChevronRight, Loader2, SpellCheck as SpellCheckIcon, Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

import type { TextEditorProps } from './types';

export function TextEditor({
  value,
  onChange,
  column,
  isFocused,
  isSaving,
  error,
  onBlur,
  onFocusNext,
  onFocusPrev,
  onCancel,
  disabled,
  className,
  placeholder,
  inputType = 'text',
  maxLength,
  multiline = false,
  rows = 3,
  enableSpellCheck = false,
}: TextEditorProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Spell check - only for text types, not email/phone/url
  const shouldSpellCheck = enableSpellCheck && inputType === 'text';

  const {
    issues,
    isChecking: isSpellChecking,
    applyFix,
    applyAllFixes,
    dismissIssue,
  } = useSpellCheck(value, {
    enabled: shouldSpellCheck,
    context: multiline ? "notes" : "general",
    debounceMs: 1000, // Longer debounce for table cells
  });

  const hasSpellIssues = issues.length > 0;

  // Auto-focus when cell becomes focused
  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
      // Select all text for easy replacement
      inputRef.current.select();
    }
  }, [isFocused]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          onBlur(); // Save first
          if (e.shiftKey) {
            onFocusPrev();
          } else {
            onFocusNext();
          }
          break;

        case 'Escape':
          e.preventDefault();
          onCancel();
          break;

        case 'Enter':
          if (!multiline) {
            e.preventDefault();
            onBlur();
            onFocusNext();
          }
          // In multiline mode, Enter creates a new line
          break;
      }
    },
    [onBlur, onFocusNext, onFocusPrev, onCancel, multiline]
  );

  // Handle value change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      let newValue = e.target.value;

      // Enforce maxLength if specified
      if (maxLength && newValue.length > maxLength) {
        newValue = newValue.slice(0, maxLength);
      }

      onChange(newValue);
    },
    [onChange, maxLength]
  );

  // Handle blur (auto-save)
  const handleBlur = useCallback(() => {
    onBlur();
  }, [onBlur]);

  // Handle spell check fix
  const handleSpellFix = useCallback(
    (issue: SpellCheckIssue) => {
      const newText = applyFix(issue, value ?? '');
      onChange(newText);
    },
    [applyFix, value, onChange]
  );

  // Handle fix all
  const handleFixAll = useCallback(() => {
    const newText = applyAllFixes(value ?? '');
    onChange(newText);
    setIsPopoverOpen(false);
  }, [applyAllFixes, value, onChange]);

  // Common props for both Input and Textarea
  const commonProps = {
    value: value ?? '',
    onChange: handleChange,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    disabled: disabled || isSaving,
    placeholder: placeholder || column.options?.placeholder,
    maxLength,
    className: cn(
      'w-full h-full border-0 focus:ring-2 focus:ring-blue-500 rounded-none',
      error && 'ring-2 ring-red-500 focus:ring-red-500',
      isSaving && 'opacity-50',
      hasSpellIssues && 'pr-10',
      className
    ),
  };

  return (
    <div className="relative w-full h-full">
      {multiline ? (
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          rows={rows}
          {...commonProps}
        />
      ) : (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={inputType}
          {...commonProps}
        />
      )}

      {/* Spell check indicator */}
      {shouldSpellCheck && !isSaving && (
        <div className="absolute top-1/2 -translate-y-1/2 right-2">
          {isSpellChecking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : hasSpellIssues ? (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SpellCheckIcon className="h-3 w-3" />
                  {issues.length}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-72 p-0"
                align="end"
                side="bottom"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <SpellCheckPopover
                  issues={issues}
                  onFix={handleSpellFix}
                  onDismiss={dismissIssue}
                  onFixAll={handleFixAll}
                />
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <Spinner size={16} className="text-muted-foreground" />
        </div>
      )}

      {/* Error message tooltip */}
      {error && !isSaving && (
        <div className="absolute left-0 -bottom-6 z-10 px-2 py-1 text-xs text-white bg-red-500 rounded shadow-lg whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}

// Compact spell check popover for table cells
function SpellCheckPopover({
  issues,
  onFix,
  onDismiss,
  onFixAll,
}: {
  issues: SpellCheckIssue[];
  onFix: (issue: SpellCheckIssue) => void;
  onDismiss: (issue: SpellCheckIssue) => void;
  onFixAll: () => void;
}) {
  const issueTypeConfig = {
    spelling: {
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/50",
      label: "Spell",
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
    <div className="max-h-[200px] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b bg-muted/30">
        <span className="text-xs font-medium">
          {issues.length} issue{issues.length !== 1 ? "s" : ""}
        </span>
        {issues.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onFixAll}
            className="h-6 text-[10px] px-2"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Fix All
          </Button>
        )}
      </div>

      {/* Issues */}
      <div className="divide-y">
        {issues.slice(0, 5).map((issue, idx) => {
          const config = issueTypeConfig[issue.type];
          return (
            <div key={`${issue.original}-${issue.start}-${idx}`} className="p-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className={cn(
                    "text-[9px] font-semibold uppercase px-1 py-0.5 rounded",
                    config.bg,
                    config.color
                  )}
                >
                  {config.label}
                </span>
                <span className="text-xs line-through text-muted-foreground truncate max-w-[80px]">
                  {issue.original}
                </span>
                <ChevronRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-green-600 dark:text-green-400 truncate max-w-[80px]">
                  {issue.suggestion}
                </span>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFix(issue)}
                  className="h-6 text-[10px] px-2 flex-1"
                >
                  <Check className="h-2.5 w-2.5 mr-1" />
                  Fix
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDismiss(issue)}
                  className="h-6 text-[10px] px-2"
                >
                  Ignore
                </Button>
              </div>
            </div>
          );
        })}
        {issues.length > 5 && (
          <div className="px-2 py-1.5 text-[10px] text-muted-foreground text-center">
            +{issues.length - 5} more issues
          </div>
        )}
      </div>
    </div>
  );
}

export default TextEditor;
