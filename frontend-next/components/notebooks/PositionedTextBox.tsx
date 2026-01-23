"use client";

import * as React from "react";
import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Blockquote from "@tiptap/extension-blockquote";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { createFontSizeExtension, registerFocusedEditor } from "@/components/ui/rich-text-editor";
import { WritingChecker } from "@/components/ui/tiptap-writing-checker";
import { type PositionedBoxData } from "./hooks/useNotebookPage";

// Re-export for convenience
export type { PositionedBoxData as PositionedBox } from "./hooks/useNotebookPage";

interface PositionedTextBoxProps {
  box: PositionedBoxData;
  onUpdate: (id: string, content: string) => void;
  onBlur: (id: string, content: string) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResize?: (id: string, width_percent: number, height_px: number) => void;
  onFocus?: (editor: Editor) => void;
  autoFocus?: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  /** Enable AI-powered spell check (default: true for main content, false for others) */
  enableSpellCheck?: boolean;
}

export function PositionedTextBox({
  box,
  onUpdate,
  onBlur,
  onDragStart,
  onResize,
  onFocus,
  autoFocus = false,
  isDragging = false,
  isResizing = false,
  containerRef: externalContainerRef,
  className,
  enableSpellCheck,
}: PositionedTextBoxProps) {
  // Default: spell check enabled for main content boxes (longer text), disabled for small boxes
  const shouldEnableSpellCheck = enableSpellCheck ?? box.isMainContent;
  const boxRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Memoize extensions to prevent TipTap duplicate extension warnings
  const extensions = useMemo(() => [
    StarterKit.configure({
      // Disable heading and blockquote from StarterKit - we add them explicitly below
      // to ensure their commands are properly available for the Styles dropdown
      heading: false,
      blockquote: false,
    }),
    // Explicitly add Heading extension for Styles dropdown support
    Heading.configure({
      levels: [1, 2, 3],
    }),
    // Explicitly add Blockquote for Quote style
    Blockquote.configure({}),
    Placeholder.configure({
      placeholder: box.isMainContent ? "Start writing..." : "Type here...",
    }),
    Underline.configure({}),
    TextStyle.configure({}),
    createFontSizeExtension(),
    Color.configure({}),
    Highlight.configure({
      multicolor: true,
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: "text-blue-600 dark:text-blue-400 underline hover:text-blue-800",
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
    // AI-powered spell check (only for main content by default)
    ...(shouldEnableSpellCheck ? [
      WritingChecker.configure({
        enabled: true,
        debounceMs: 500,
        context: "notes",
      }),
    ] : []),
  ], [box.isMainContent, shouldEnableSpellCheck]);

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
      setIsFocused(true);
      registerFocusedEditor(editor);
      onFocus?.(editor);
    },
    onBlur: ({ editor }) => {
      setIsFocused(false);
      const content = editor.getHTML();
      // Check if content is empty (just empty paragraph tags)
      const isEmpty = content === "<p></p>" || content === "" || !editor.getText().trim();
      // Don't remove main content box when empty
      if (box.isMainContent) {
        onBlur(box.id, content);
      } else {
        onBlur(box.id, isEmpty ? "" : content);
      }
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

  // Resize handler for bottom-right corner
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!boxRef.current || !externalContainerRef?.current || !onResize) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = boxRef.current.offsetWidth;
    const startHeight = boxRef.current.offsetHeight;
    const containerRect = externalContainerRef.current.getBoundingClientRect();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const newWidth = Math.max(100, startWidth + deltaX);
      const newHeight = Math.max(50, startHeight + deltaY);

      // Convert width to percentage of container
      const widthPercent = (newWidth / containerRect.width) * 100;

      onResize(box.id, widthPercent, newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [box.id, externalContainerRef, onResize]);

  // Resize handler for right edge (width only)
  const handleResizeWidthStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!boxRef.current || !externalContainerRef?.current || !onResize) return;

    const startX = e.clientX;
    const startWidth = boxRef.current.offsetWidth;
    const containerRect = externalContainerRef.current.getBoundingClientRect();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(100, startWidth + deltaX);
      const widthPercent = (newWidth / containerRect.width) * 100;
      onResize(box.id, widthPercent, box.height_px || boxRef.current!.offsetHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [box.id, box.height_px, externalContainerRef, onResize]);

  // Resize handler for bottom edge (height only)
  const handleResizeHeightStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!boxRef.current || !externalContainerRef?.current || !onResize) return;

    const startY = e.clientY;
    const startHeight = boxRef.current.offsetHeight;
    const containerRect = externalContainerRef.current.getBoundingClientRect();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(50, startHeight + deltaY);
      const currentWidthPercent = box.width_percent || (boxRef.current!.offsetWidth / containerRect.width) * 100;
      onResize(box.id, currentWidthPercent, newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [box.id, box.width_percent, externalContainerRef, onResize]);

  const showBorder = isFocused || isDragging || isResizing;

  return (
    <div
      ref={boxRef}
      data-positioned-box
      className={cn(
        "absolute flex items-start group",
        isDragging && "opacity-70 cursor-grabbing",
        isResizing && "select-none",
        className
      )}
      style={{
        left: `${box.x_percent}%`,
        top: `${box.y_percent}%`,
        width: box.width_percent ? `${box.width_percent}%` : undefined,
        minWidth: box.isMainContent ? "300px" : "80px",
        minHeight: box.isMainContent && !box.height_px ? "400px" : undefined,
        height: box.height_px ? `${box.height_px}px` : undefined,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Drag handle - only show when focused/clicked */}
      <div
        className={cn(
          "flex items-center justify-center w-5 h-6 cursor-grab shrink-0",
          "opacity-0 transition-opacity",
          "text-muted-foreground hover:text-foreground",
          (isDragging || showBorder) && "opacity-100",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={onDragStart}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Editable content with border - only show border when focused/clicked */}
      <div
        className={cn(
          "flex-1 h-full px-2 py-1",
          "border rounded-sm",
          "bg-transparent",
          showBorder
            ? "border-black/50 dark:border-white/50"
            : "border-transparent",
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
          "[&_.task-item>div]:flex-1 [&_.task-item>div]:min-w-0",
          // Heading styles
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-2",
          "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:my-2",
          "[&_h3]:text-lg [&_h3]:font-medium [&_h3]:my-1",
          // Blockquote styles
          "[&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-2"
        )}
        style={{
          overflow: box.height_px ? "auto" : undefined,
          minHeight: "20px",
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Resize handles - only show when focused/clicked, positioned on outer container */}
      {onResize && showBorder && (
        <>
          {/* Right edge resize handle */}
          <div
            className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-blue-500/20"
            onMouseDown={handleResizeWidthStart}
          />

          {/* Bottom edge resize handle */}
          <div
            className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-blue-500/20"
            onMouseDown={handleResizeHeightStart}
          />

          {/* Bottom-right corner resize handle */}
          <div
            className={cn(
              "absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-blue-500/20",
              "after:absolute after:bottom-0.5 after:right-0.5",
              "after:w-2 after:h-2 after:border-r-2 after:border-b-2",
              "after:border-muted-foreground/50"
            )}
            onMouseDown={handleResizeStart}
          />
        </>
      )}
    </div>
  );
}
