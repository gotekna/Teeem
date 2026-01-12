"use client";

import * as React from "react";
import { useRef, useEffect, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { type StrokeData } from "./hooks/useNotebookPage";

export type DrawMode = "select" | "pen" | "highlighter" | "eraser" | null;

// Re-export for convenience
export type Stroke = StrokeData;

interface DrawingCanvasProps {
  strokes: StrokeData[];
  onStrokesChange: (strokes: StrokeData[]) => void;
  drawMode: DrawMode;
  drawColor: string;
  drawSize: number;
  width: number;
  height: number;
  className?: string;
}

export function DrawingCanvas({
  strokes,
  onStrokesChange,
  drawMode,
  drawColor,
  drawSize,
  width,
  height,
  className,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<StrokeData | null>(null);

  // Redraw all strokes whenever they change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = stroke.opacity;

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });

    // Reset alpha
    ctx.globalAlpha = 1;
  }, [strokes, width, height]);

  // Draw current stroke in real-time
  const drawCurrentStroke = useCallback(() => {
    const canvas = canvasRef.current;
    const stroke = currentStrokeRef.current;
    if (!canvas || !stroke || stroke.points.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Only draw the last segment for performance
    const lastTwo = stroke.points.slice(-2);
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = stroke.opacity;

    ctx.moveTo(lastTwo[0].x, lastTwo[0].y);
    ctx.lineTo(lastTwo[1].x, lastTwo[1].y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, []);

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawMode || drawMode === "select") return;

      const point = getCanvasPoint(e);
      if (!point) return;

      if (drawMode === "eraser") {
        // Find and remove strokes that intersect with the eraser point
        const eraserRadius = drawSize * 2;
        const newStrokes = strokes.filter((stroke) => {
          return !stroke.points.some(
            (p) =>
              Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) <
              eraserRadius
          );
        });
        if (newStrokes.length !== strokes.length) {
          onStrokesChange(newStrokes);
        }
        setIsDrawing(true);
        return;
      }

      // Start new stroke for pen or highlighter
      const opacity = drawMode === "highlighter" ? 0.4 : 1;
      currentStrokeRef.current = {
        id: crypto.randomUUID(),
        points: [point],
        color: drawColor,
        size: drawSize,
        opacity,
        tool: drawMode,
      };
      setIsDrawing(true);
    },
    [drawMode, drawColor, drawSize, strokes, onStrokesChange, getCanvasPoint]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !drawMode) return;

      const point = getCanvasPoint(e);
      if (!point) return;

      if (drawMode === "eraser") {
        // Continuous erasing while dragging
        const eraserRadius = drawSize * 2;
        const newStrokes = strokes.filter((stroke) => {
          return !stroke.points.some(
            (p) =>
              Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) <
              eraserRadius
          );
        });
        if (newStrokes.length !== strokes.length) {
          onStrokesChange(newStrokes);
        }
        return;
      }

      // Add point to current stroke
      if (currentStrokeRef.current) {
        currentStrokeRef.current.points.push(point);
        drawCurrentStroke();
      }
    },
    [isDrawing, drawMode, drawSize, strokes, onStrokesChange, getCanvasPoint, drawCurrentStroke]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);

    // Save the completed stroke
    if (currentStrokeRef.current && currentStrokeRef.current.points.length >= 2) {
      onStrokesChange([...strokes, currentStrokeRef.current]);
    }
    currentStrokeRef.current = null;
  }, [isDrawing, strokes, onStrokesChange]);

  const handleMouseLeave = useCallback(() => {
    // Finish stroke if we leave the canvas while drawing
    handleMouseUp();
  }, [handleMouseUp]);

  // Set cursor based on draw mode
  const getCursor = () => {
    if (!drawMode) return "default";
    switch (drawMode) {
      case "select":
        return "default";
      case "pen":
      case "highlighter":
        return "crosshair";
      case "eraser":
        return "cell";
      default:
        return "default";
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={cn(
        "absolute inset-0",
        drawMode && drawMode !== "select" ? "pointer-events-auto" : "pointer-events-none",
        className
      )}
      style={{ cursor: getCursor() }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
}
