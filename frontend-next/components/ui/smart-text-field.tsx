"use client";

// SSoT: TipTap warning suppression - must be first import
import "@/lib/tiptap-utils";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "@/lib/utils";
import { WritingChecker, useWritingCheckerState, WritingIssue } from "./tiptap-writing-checker";
import { WritingContext } from "@/hooks/useWritingAssistant";
import { Loader2, SpellCheck, Check, Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface SmartTextFieldProps {
  /** Current value (plain text or HTML) */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Called on blur */
  onBlur?: () => void;
  /** Called on key down */
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Context helps AI understand what this field is for */
  context?: WritingContext;
  /** Auto focus on mount */
  autoFocus?: boolean;
  /** Single line mode (like input) vs multi-line (like textarea) */
  singleLine?: boolean;
  /** Minimum height for multi-line mode */
  minHeight?: number;
  /** Disable the field */
  disabled?: boolean;
}

/**
 * Text field with real-time inline spell/grammar checking
 *
 * Uses TipTap for inline decorations (wavy underlines).
 * Works for both single-line (task names) and multi-line (notes, answers).
 *
 * @example
 * ```tsx
 * <SmartTextField
 *   value={taskName}
 *   onChange={setTaskName}
 *   context="task_name"
 *   singleLine
 *   placeholder="Enter task name..."
 * />
 * ```
 */
export function SmartTextField({
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder = "Enter text...",
  className,
  context = "general",
  autoFocus = false,
  singleLine = false,
  minHeight = 60,
  disabled = false,
}: SmartTextFieldProps) {
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  const extensions = React.useMemo(
    () => [
      StarterKit.configure({
        // Minimal config for text fields
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: singleLine ? false : {},
        orderedList: singleLine ? false : {},
        listItem: singleLine ? false : {},
        hardBreak: singleLine ? false : {},
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      WritingChecker.configure({
        enabled: true,
        debounceMs: 1000,
        context,
      }),
    ],
    [placeholder, context, singleLine]
  );

  const editor = useEditor({
    extensions,
    content: value || "",
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "focus:outline-none text-sm",
          singleLine ? "whitespace-nowrap overflow-hidden" : "min-h-[inherit]",
          disabled && "opacity-50 cursor-not-allowed"
        ),
        spellcheck: "true",
      },
      handleKeyDown: (view, event) => {
        // Prevent Enter in single-line mode
        if (singleLine && event.key === "Enter") {
          event.preventDefault();
          // Trigger the onKeyDown handler so parent can handle Enter
          onKeyDown?.({
            key: "Enter",
            preventDefault: () => {},
          } as React.KeyboardEvent);
          return true;
        }
        // Handle Escape
        if (event.key === "Escape") {
          onKeyDown?.({
            key: "Escape",
            preventDefault: () => {},
          } as React.KeyboardEvent);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      // Return plain text for single line, HTML for multi-line
      const content = singleLine ? editor.getText() : editor.getHTML();
      onChange(content);
    },
    onBlur: () => {
      onBlur?.();
    },
  });

  // Get writing checker state for status display
  const { issues, isChecking } = useWritingCheckerState(editor);

  // Apply a single fix
  const applyFix = React.useCallback((issue: WritingIssue) => {
    if (!editor) return;

    const tr = editor.state.tr.replaceWith(
      issue.from,
      issue.to,
      editor.state.schema.text(issue.suggestion)
    );
    editor.view.dispatch(tr);
  }, [editor]);

  // Apply all fixes (in reverse order to preserve positions)
  const applyAllFixes = React.useCallback(() => {
    if (!editor || issues.length === 0) return;

    // Sort by position descending so we fix from end to start
    const sortedIssues = [...issues].sort((a, b) => b.from - a.from);

    let tr = editor.state.tr;
    for (const issue of sortedIssues) {
      tr = tr.replaceWith(
        issue.from,
        issue.to,
        editor.state.schema.text(issue.suggestion)
      );
    }
    editor.view.dispatch(tr);
    setIsPopoverOpen(false);
  }, [editor, issues]);

  // Update content when value changes externally
  React.useEffect(() => {
    if (!editor) return;

    const currentContent = singleLine ? editor.getText() : editor.getHTML();
    if (value !== currentContent) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor, singleLine]);

  // Auto focus
  React.useEffect(() => {
    if (autoFocus && editor) {
      setTimeout(() => {
        editor.chain().focus().run();
      }, 0);
    }
  }, [autoFocus, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "border bg-background px-3 py-2 text-sm",
          singleLine ? "h-9" : "",
          className
        )}
        style={!singleLine ? { minHeight } : undefined}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative border bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        singleLine ? "flex items-center" : "",
        className
      )}
    >
      <EditorContent
        editor={editor}
        className={cn(
          "flex-1 px-3",
          singleLine ? "py-1.5" : "py-2",
          "[&_.is-editor-empty]:before:content-[attr(data-placeholder)]",
          "[&_.is-editor-empty]:before:text-muted-foreground",
          "[&_.is-editor-empty]:before:float-left",
          "[&_.is-editor-empty]:before:h-0",
          "[&_.is-editor-empty]:before:pointer-events-none"
        )}
        style={!singleLine ? { minHeight } : undefined}
      />

      {/* Status indicator with popover */}
      <div className={cn(
        "flex items-center gap-1 pr-2",
        singleLine ? "" : "absolute right-0 top-2"
      )}>
        {isChecking ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : issues.length > 0 ? (
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors p-1 -m-1 rounded"
                title={`${issues.length} suggestion${issues.length > 1 ? 's' : ''}`}
              >
                <SpellCheck className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{issues.length}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-96 p-0"
              align="end"
              side="bottom"
              sideOffset={8}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-sm">Writing Suggestions</span>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {issues.length} found
                </span>
              </div>

              {/* Issues list */}
              <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                {issues.map((issue, index) => (
                  <IssueRow
                    key={`${issue.from}-${issue.to}-${index}`}
                    issue={issue}
                    onApply={() => applyFix(issue)}
                  />
                ))}
              </div>

              {/* Footer with Fix All */}
              {issues.length > 1 && (
                <div className="px-3 py-2 border-t bg-muted/30">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={applyAllFixes}
                  >
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Fix All {issues.length} Issues
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}

// Individual issue row component
function IssueRow({
  issue,
  onApply
}: {
  issue: WritingIssue;
  onApply: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onApply}
      className="w-full px-3 py-3 hover:bg-primary/5 transition-colors text-left group border-l-2 border-transparent hover:border-primary"
    >
      {/* Suggested text - clean and readable */}
      <p className="text-sm leading-relaxed text-foreground">
        {issue.suggestion}
      </p>

      {/* Explanation if available */}
      {issue.explanation && (
        <p className="text-xs text-muted-foreground mt-1">
          {issue.explanation}
        </p>
      )}
    </button>
  );
}

export default SmartTextField;
