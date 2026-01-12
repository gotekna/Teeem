"use client";

import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GripVertical, Trash2 } from "lucide-react";
import { type PositionedBoxData } from "./hooks/useNotebookPage";

interface PositionedImageBoxProps {
  box: PositionedBoxData;
  onResize?: (id: string, width_percent: number, height_px: number) => void;
  onResizeEnd?: (id: string) => void; // Called when resize completes to commit to history
  onDelete?: (id: string) => void;
  onDragStart: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  isResizing?: boolean;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export function PositionedImageBox({
  box,
  onResize,
  onResizeEnd,
  onDelete,
  onDragStart,
  isDragging = false,
  isResizing = false,
  containerRef: externalContainerRef,
  className,
}: PositionedImageBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [isResizingLocal, setIsResizingLocal] = useState(false);

  // Track natural image dimensions for aspect ratio
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  // Helper to get current actual dimensions
  const getCurrentDimensions = useCallback(() => {
    if (!boxRef.current || !externalContainerRef?.current) {
      return { width: 0, height: 0, widthPercent: 30, containerWidth: 1 };
    }
    const containerRect = externalContainerRef.current.getBoundingClientRect();
    const boxRect = boxRef.current.getBoundingClientRect();
    return {
      width: boxRect.width,
      height: boxRect.height,
      widthPercent: (boxRect.width / containerRect.width) * 100,
      containerWidth: containerRect.width,
    };
  }, [externalContainerRef]);

  // Resize handler for bottom-right corner (maintains current aspect ratio)
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!boxRef.current || !externalContainerRef?.current || !onResize) return;

    setIsResizingLocal(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const dims = getCurrentDimensions();
    const startWidth = dims.width;
    const startHeight = dims.height;
    const containerWidth = dims.containerWidth;
    // Use current displayed aspect ratio, not natural image ratio
    // This preserves any stretching/squishing done with edge handles
    const aspectRatio = startWidth / startHeight;
    const shiftHeld = e.shiftKey;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth: number;
      let newHeight: number;

      if (moveEvent.shiftKey || shiftHeld) {
        // Free resize when shift is held
        newWidth = Math.max(50, startWidth + deltaX);
        newHeight = Math.max(50, startHeight + deltaY);
      } else {
        // Maintain aspect ratio - use the larger delta
        const widthDelta = Math.abs(deltaX);
        const heightDelta = Math.abs(deltaY);

        if (widthDelta > heightDelta) {
          newWidth = Math.max(50, startWidth + deltaX);
          newHeight = newWidth / aspectRatio;
        } else {
          newHeight = Math.max(50, startHeight + deltaY);
          newWidth = newHeight * aspectRatio;
        }
      }

      // Convert width to percentage of container
      const widthPercent = (newWidth / containerWidth) * 100;

      onResize(box.id, widthPercent, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingLocal(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // Commit to history when resize ends
      onResizeEnd?.(box.id);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [box.id, externalContainerRef, onResize, onResizeEnd, naturalSize, getCurrentDimensions]);

  // Resize handler for right edge (width only - independent adjustment)
  const handleResizeWidthStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!boxRef.current || !externalContainerRef?.current || !onResize) return;

    setIsResizingLocal(true);
    const startX = e.clientX;
    const dims = getCurrentDimensions();
    const startWidth = dims.width;
    const fixedHeight = dims.height; // Capture current height at start
    const containerWidth = dims.containerWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(50, startWidth + deltaX);
      const widthPercent = (newWidth / containerWidth) * 100;

      // Width only - keep height fixed at captured value
      onResize(box.id, widthPercent, fixedHeight);
    };

    const handleMouseUp = () => {
      setIsResizingLocal(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // Commit to history when resize ends
      onResizeEnd?.(box.id);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [box.id, externalContainerRef, onResize, onResizeEnd, getCurrentDimensions]);

  // Resize handler for bottom edge (height only - independent adjustment)
  const handleResizeHeightStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!boxRef.current || !externalContainerRef?.current || !onResize) return;

    setIsResizingLocal(true);
    const startY = e.clientY;
    const dims = getCurrentDimensions();
    const startHeight = dims.height;
    const fixedWidthPercent = dims.widthPercent; // Capture current width at start

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(50, startHeight + deltaY);

      // Height only - keep width fixed at captured value
      onResize(box.id, fixedWidthPercent, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingLocal(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // Commit to history when resize ends
      onResizeEnd?.(box.id);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [box.id, externalContainerRef, onResize, onResizeEnd, getCurrentDimensions]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onDelete?.(box.id);
    }
    if (e.key === "Escape") {
      setIsFocused(false);
      (e.target as HTMLElement).blur();
    }
  }, [box.id, onDelete]);

  // Handle delete button click - need to prevent blur from firing first
  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(box.id);
  }, [box.id, onDelete]);

  const showBorder = isFocused || isDragging || isResizing || isResizingLocal;

  return (
    <div
      ref={boxRef}
      data-positioned-box
      tabIndex={0}
      className={cn(
        "absolute flex items-stretch group outline-none",
        isDragging && "opacity-70 cursor-grabbing",
        isResizing && "select-none",
        className
      )}
      style={{
        left: `${box.x_percent}%`,
        top: `${box.y_percent}%`,
        width: box.width_percent ? `${box.width_percent}%` : "auto",
        height: box.height_px ? `${box.height_px}px` : "auto",
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        // Don't blur if clicking on resize handles or delete button
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (relatedTarget?.closest('[data-positioned-box]') === boxRef.current) {
          return;
        }
        // Don't blur during resize
        if (isResizingLocal) return;
        setIsFocused(false);
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Drag handle - only show when focused/clicked */}
      <div
        className={cn(
          "flex items-center justify-center w-5 cursor-grab shrink-0 self-start",
          "opacity-0 transition-opacity",
          "text-muted-foreground hover:text-foreground",
          (isDragging || showBorder) && "opacity-100",
          isDragging && "cursor-grabbing"
        )}
        style={{ height: "24px" }}
        onMouseDown={onDragStart}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Image container with border - use explicit height when set */}
      <div
        className={cn(
          "relative flex-1",
          "border rounded-sm",
          "bg-transparent",
          showBorder
            ? "border-blue-500 dark:border-blue-400"
            : "border-transparent"
        )}
        style={{
          height: box.height_px ? "100%" : "auto",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={box.imageUrl}
          alt=""
          className="w-full h-full rounded-sm"
          style={{
            // object-fill stretches/squishes to fit container exactly (no cropping)
            // This ensures entire image is always visible, just potentially distorted
            objectFit: box.height_px ? "fill" : "contain",
          }}
          onLoad={handleImageLoad}
          draggable={false}
        />
      </div>

      {/* Delete button - show when focused, positioned outside inner container */}
      {showBorder && onDelete && (
        <button
          type="button"
          className="absolute -top-2 -right-2 z-20 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 shadow-sm"
          onClick={handleDeleteClick}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      {/* Resize handles - only show when focused/clicked */}
      {onResize && showBorder && (
        <>
          {/* Right edge resize handle */}
          <div
            className="absolute top-0 right-0 w-3 h-full cursor-ew-resize hover:bg-blue-500/30 z-10"
            onMouseDown={handleResizeWidthStart}
          />

          {/* Bottom edge resize handle */}
          <div
            className="absolute bottom-0 left-0 w-full h-3 cursor-ns-resize hover:bg-blue-500/30 z-10"
            onMouseDown={handleResizeHeightStart}
          />

          {/* Bottom-right corner resize handle */}
          <div
            className={cn(
              "absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize hover:bg-blue-500/30 z-10",
              "after:absolute after:bottom-0.5 after:right-0.5",
              "after:w-2 after:h-2 after:border-r-2 after:border-b-2",
              "after:border-blue-500 dark:after:border-blue-400"
            )}
            onMouseDown={handleResizeStart}
          />
        </>
      )}
    </div>
  );
}
