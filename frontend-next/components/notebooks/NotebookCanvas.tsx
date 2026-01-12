"use client";

import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PositionedTextBox, type PositionedBox } from "./PositionedTextBox";
import { PositionedImageBox } from "./PositionedImageBox";
import { type Editor } from "@tiptap/react";

interface NotebookCanvasProps {
  boxes: PositionedBox[];
  onBoxesChange: (boxes: PositionedBox[], skipHistory?: boolean) => void;
  onActiveEditorChange?: (editor: Editor | null) => void;
  onAddImage?: (x_percent: number, y_percent: number) => void;
  className?: string;
}

// Constants for the main content box
const MAIN_CONTENT_ID = "main-content";
const DEFAULT_MAIN_BOX: PositionedBox = {
  id: MAIN_CONTENT_ID,
  x_percent: 5,
  y_percent: 2,
  width_percent: 85,
  content: "",
  isMainContent: true,
};

export function NotebookCanvas({
  boxes,
  onBoxesChange,
  onActiveEditorChange,
  onAddImage,
  className,
}: NotebookCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const newBoxIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; boxX: number; boxY: number } | null>(null);

  // Ensure main content box exists
  const allBoxes = React.useMemo(() => {
    const hasMainBox = boxes.some(b => b.id === MAIN_CONTENT_ID);
    if (!hasMainBox) {
      return [DEFAULT_MAIN_BOX, ...boxes];
    }
    return boxes;
  }, [boxes]);

  const handleDoubleClick = useCallback(
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
      onBoxesChange([...allBoxes, newBox]);
    },
    [allBoxes, onBoxesChange, draggingId]
  );

  const handleBoxUpdate = useCallback(
    (id: string, content: string) => {
      onBoxesChange(
        allBoxes.map((box) => (box.id === id ? { ...box, content } : box))
      );
    },
    [allBoxes, onBoxesChange]
  );

  const handleBoxBlur = useCallback(
    (id: string, content: string) => {
      // Never remove main content box
      if (id === MAIN_CONTENT_ID) {
        onBoxesChange(
          allBoxes.map((box) => (box.id === id ? { ...box, content } : box))
        );
        return;
      }

      // Remove empty boxes when they lose focus
      if (!content.trim()) {
        onBoxesChange(allBoxes.filter((box) => box.id !== id));
      } else {
        // Update content on blur in case it wasn't captured
        onBoxesChange(
          allBoxes.map((box) => (box.id === id ? { ...box, content } : box))
        );
      }
      // Clear the new box reference
      if (newBoxIdRef.current === id) {
        newBoxIdRef.current = null;
      }
    },
    [allBoxes, onBoxesChange]
  );

  const handleBoxResize = useCallback(
    (id: string, width_percent: number, height_px: number) => {
      setResizingId(id);
      // Skip history during live resize - only commit when mouseup fires
      onBoxesChange(
        allBoxes.map((box) =>
          box.id === id ? { ...box, width_percent, height_px } : box
        ),
        true // skipHistory = true during live resize
      );
      // Clear resizing state after a short delay
      setTimeout(() => setResizingId(null), 100);
    },
    [allBoxes, onBoxesChange]
  );

  // Ref to track latest boxes state - avoids stale closure in resize/drag end handlers
  const latestBoxesRef = useRef(allBoxes);
  latestBoxesRef.current = allBoxes;

  // Called when resize ends to commit the change to history
  const handleBoxResizeEnd = useCallback(
    (_id: string) => {
      // Commit current state to history by calling onBoxesChange without skipHistory
      // Use ref to always get the latest boxes state, avoiding stale closure
      onBoxesChange(latestBoxesRef.current, false);
    },
    [onBoxesChange]
  );

  const handleBoxDelete = useCallback(
    (id: string) => {
      // Never delete main content box
      if (id === MAIN_CONTENT_ID) return;
      onBoxesChange(allBoxes.filter((box) => box.id !== id));
    },
    [allBoxes, onBoxesChange]
  );

  // Drag handlers
  const handleDragStart = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const box = allBoxes.find(b => b.id === id);
      if (!box) return;

      setDraggingId(id);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        boxX: box.x_percent,
        boxY: box.y_percent,
      };

      // Track current position for final commit
      let finalX = box.x_percent;
      let finalY = box.y_percent;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current || !dragStartRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const deltaX = ((moveEvent.clientX - dragStartRef.current.x) / rect.width) * 100;
        const deltaY = ((moveEvent.clientY - dragStartRef.current.y) / rect.height) * 100;

        finalX = Math.max(0, Math.min(95, dragStartRef.current.boxX + deltaX));
        finalY = Math.max(0, Math.min(95, dragStartRef.current.boxY + deltaY));

        // Skip history during live drag
        onBoxesChange(
          allBoxes.map((b) =>
            b.id === id ? { ...b, x_percent: finalX, y_percent: finalY } : b
          ),
          true // skipHistory = true during live drag
        );
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        // Commit final position to history when drag ends
        onBoxesChange(
          allBoxes.map((b) =>
            b.id === id ? { ...b, x_percent: finalX, y_percent: finalY } : b
          ),
          false // commit to history
        );
        // Delay clearing draggingId to prevent click from creating new box
        setTimeout(() => {
          setDraggingId(null);
          dragStartRef.current = null;
        }, 100);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [allBoxes, onBoxesChange]
  );

  // Make containerRef available to parent for calculating image position
  React.useEffect(() => {
    if (onAddImage && containerRef.current) {
      // Store ref on the callback for external access
      (onAddImage as unknown as { containerRef?: React.RefObject<HTMLDivElement | null> }).containerRef = containerRef;
    }
  }, [onAddImage]);

  return (
    <div
      ref={containerRef}
      className={cn("relative min-h-[600px]", className)}
      onDoubleClick={handleDoubleClick}
    >
      {allBoxes.map((box) => {
        // Render image boxes differently
        if (box.type === "image" && box.imageUrl) {
          return (
            <PositionedImageBox
              key={box.id}
              box={box}
              onDragStart={(e) => handleDragStart(box.id, e)}
              onResize={handleBoxResize}
              onResizeEnd={handleBoxResizeEnd}
              onDelete={handleBoxDelete}
              isDragging={draggingId === box.id}
              isResizing={resizingId === box.id}
              containerRef={containerRef}
            />
          );
        }

        // Default: render text boxes
        return (
          <PositionedTextBox
            key={box.id}
            box={box}
            onUpdate={handleBoxUpdate}
            onBlur={handleBoxBlur}
            onDragStart={(e) => handleDragStart(box.id, e)}
            onResize={handleBoxResize}
            onFocus={onActiveEditorChange}
            autoFocus={box.id === newBoxIdRef.current}
            isDragging={draggingId === box.id}
            isResizing={resizingId === box.id}
            containerRef={containerRef}
          />
        );
      })}
    </div>
  );
}

// Export helper to get container dimensions
export function useCanvasContainer() {
  return useRef<HTMLDivElement>(null);
}
