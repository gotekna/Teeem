"use client";

import * as React from "react";
import { useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { createFontSizeExtension, registerFocusedEditor } from "@/components/ui/rich-text-editor";
import { type PositionedBoxData } from "./hooks/useNotebookPage";

// Re-export for convenience
export type { PositionedBoxData as PositionedBox } from "./hooks/useNotebookPage";

interface PositionedTextBoxProps {
  box: PositionedBoxData;
  onUpdate: (id: string, content: string) => void;
  onBlur: (id: string, content: string) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onFocus?: (editor: Editor) => void;
  autoFocus?: boolean;
  isDragging?: boolean;
  className?: string;
}

export function PositionedTextBox({
  box,
  onUpdate,
  onBlur,
  onDragStart,
  onFocus,
  autoFocus = false,
  isDragging = false,
  className,
}: PositionedTextBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize extensions to prevent TipTap duplicate extension warnings
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: false,
    }),
    Placeholder.configure({
      placeholder: "Type here...",
    }),
    Underline,
    TextStyle,
    createFontSizeExtension(),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: "text-blue-600 underline hover:text-blue-800",
      },
    }),
    Image.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: {
        class: "max-w-full max-h-[300px] w-auto h-auto rounded object-contain cursor-pointer",
        style: "display: inline-block;",
      },
    }),
    TaskList.configure({
      HTMLAttributes: {
        class: "task-list",
      },
    }),
    TaskItem.configure({
      HTMLAttributes: {
        class: "task-item",
      },
      nested: true,
    }),
  ], []);

  const editor = useEditor({
    extensions,
    content: box.content,
    immediatelyRender: false, // Required for SSR/Next.js to avoid hydration mismatches
    editorProps: {
      attributes: {
        class: "outline-none min-h-[20px] text-sm [direction:ltr]",
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate(box.id, editor.getHTML());
    },
    onFocus: ({ editor }) => {
      registerFocusedEditor(editor);
      onFocus?.(editor);
    },
    onBlur: ({ editor }) => {
      const content = editor.getHTML();
      // Check if content is empty (just empty paragraph tags)
      const isEmpty = content === "<p></p>" || content === "" || !editor.getText().trim();
      onBlur(box.id, isEmpty ? "" : content);
    },
  });

  useEffect(() => {
    if (autoFocus && editor) {
      setTimeout(() => {
        editor.commands.focus();
      }, 0);
    }
  }, [autoFocus, editor]);

  // Update editor content if box.content changes externally
  useEffect(() => {
    if (editor && box.content !== editor.getHTML()) {
      editor.commands.setContent(box.content);
    }
  }, [box.content, editor]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Allow Escape to blur the editor
    if (e.key === "Escape") {
      editor?.commands.blur();
    }
  }, [editor]);

  return (
    <div
      ref={containerRef}
      data-positioned-box
      className={cn(
        "absolute flex items-start group",
        isDragging && "opacity-70 cursor-grabbing",
        className
      )}
      style={{
        left: `${box.x_percent}%`,
        top: `${box.y_percent}%`,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Drag handle */}
      <div
        className={cn(
          "flex items-center justify-center w-5 h-6 cursor-grab shrink-0",
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity",
          "text-muted-foreground hover:text-foreground",
          isDragging && "opacity-100 cursor-grabbing"
        )}
        onMouseDown={onDragStart}
      >
        <GripVertical className="h-4 w-4" />
      </div>
      {/* Editable content */}
      <div
        className={cn(
          "min-w-[80px] px-2 py-1",
          "border border-transparent rounded-sm",
          "bg-transparent",
          "focus-within:border-black/50 focus-within:dark:border-white/50",
          "[&_.ProseMirror]:outline-none",
          "[&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
          "[&_.ProseMirror_p.is-editor-empty:first-child]:before:text-muted-foreground/50",
          "[&_.ProseMirror_p.is-editor-empty:first-child]:before:float-left",
          "[&_.ProseMirror_p.is-editor-empty:first-child]:before:h-0",
          "[&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none",
          // List styles
          "[&_ol]:list-decimal [&_ol]:pl-6",
          "[&_ul]:list-disc [&_ul]:pl-6",
          "[&_li]:my-1",
          // Task list styles
          "[&_ul.task-list]:list-none [&_ul.task-list]:pl-0",
          "[&_.task-item]:flex [&_.task-item]:items-center [&_.task-item]:gap-2",
          "[&_.task-item>label]:flex [&_.task-item>label]:items-center [&_.task-item>label]:shrink-0",
          "[&_.task-item>div]:flex-1 [&_.task-item>div]:min-w-0"
        )}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
