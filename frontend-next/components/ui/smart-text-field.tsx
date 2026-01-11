"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "@/lib/utils";
import { WritingChecker, useWritingCheckerState } from "./tiptap-writing-checker";
import { WritingContext } from "@/hooks/useWritingAssistant";
import { Loader2, SpellCheck } from "lucide-react";

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

      {/* Status indicator */}
      <div className={cn(
        "flex items-center gap-1 pr-2",
        singleLine ? "" : "absolute right-0 top-2"
      )}>
        {isChecking ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : issues.length > 0 ? (
          <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
            <SpellCheck className="h-3.5 w-3.5" />
            <span className="text-xs">{issues.length}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default SmartTextField;
