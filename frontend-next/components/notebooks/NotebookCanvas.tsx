"use client";

import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PositionedTextBox, type PositionedBox } from "./PositionedTextBox";
import { type Editor } from "@tiptap/react";

interface NotebookCanvasProps {
  boxes: PositionedBox[];
  onBoxesChange: (boxes: PositionedBox[]) => void;
  onActiveEditorChange?: (editor: Editor | null) => void;
  children: React.ReactNode;
  className?: string;
}

export function NotebookCanvas({
  boxes,
  onBoxesChange,
  onActiveEditorChange,
  children,
  className,
}: NotebookCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const newBoxIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; boxX: number; boxY: number } | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Don't create box if we just finished dragging
      if (draggingId) return;

      // Don't create box if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (
        target.closest('input') ||
        target.closest('[contenteditable]') ||
        target.closest('button') ||
        target.closest('.ProseMirror') ||
        target.closest('[data-positioned-box]')
      ) {
        return;
      }

      const rect = containerRef.current!.getBoundingClientRect();
      const x_percent = ((e.clientX - rect.left) / rect.width) * 100;
      const y_percent = ((e.clientY - rect.top) / rect.height) * 100;

      const newBox: PositionedBox = {
        id: crypto.randomUUID(),
        x_percent,
        y_percent,
        content: "",
      };

      newBoxIdRef.current = newBox.id;
      onBoxesChange([...boxes, newBox]);
    },
    [boxes, onBoxesChange, draggingId]
  );

  const handleBoxUpdate = useCallback(
    (id: string, content: string) => {
      onBoxesChange(
        boxes.map((box) => (box.id === id ? { ...box, content } : box))
      );
    },
    [boxes, onBoxesChange]
  );

  const handleBoxBlur = useCallback(
    (id: string, content: string) => {
      // Remove empty boxes when they lose focus
      if (!content.trim()) {
        onBoxesChange(boxes.filter((box) => box.id !== id));
      } else {
        // Update content on blur in case it wasn't captured
        onBoxesChange(
          boxes.map((box) => (box.id === id ? { ...box, content } : box))
        );
      }
      // Clear the new box reference
      if (newBoxIdRef.current === id) {
        newBoxIdRef.current = null;
      }
    },
    [boxes, onBoxesChange]
  );

  // Drag handlers
  const handleDragStart = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const box = boxes.find(b => b.id === id);
      if (!box) return;

      setDraggingId(id);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        boxX: box.x_percent,
        boxY: box.y_percent,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current || !dragStartRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const deltaX = ((moveEvent.clientX - dragStartRef.current.x) / rect.width) * 100;
        const deltaY = ((moveEvent.clientY - dragStartRef.current.y) / rect.height) * 100;

        const newX = Math.max(0, Math.min(95, dragStartRef.current.boxX + deltaX));
        const newY = Math.max(0, Math.min(95, dragStartRef.current.boxY + deltaY));

        onBoxesChange(
          boxes.map((b) =>
            b.id === id ? { ...b, x_percent: newX, y_percent: newY } : b
          )
        );
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        // Delay clearing draggingId to prevent click from creating new box
        setTimeout(() => {
          setDraggingId(null);
          dragStartRef.current = null;
        }, 100);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [boxes, onBoxesChange]
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onDoubleClick={handleClick}
    >
      {children}
      {boxes.map((box) => (
        <PositionedTextBox
          key={box.id}
          box={box}
          onUpdate={handleBoxUpdate}
          onBlur={handleBoxBlur}
          onDragStart={(e) => handleDragStart(box.id, e)}
          onFocus={onActiveEditorChange}
          autoFocus={box.id === newBoxIdRef.current}
          isDragging={draggingId === box.id}
        />
      ))}
    </div>
  );
}
