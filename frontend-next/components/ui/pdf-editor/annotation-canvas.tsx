"use client";

import * as React from "react";
import * as fabric from "fabric";
import type { AnnotationTool } from "./types";
import { cn } from "@/lib/utils";

interface AnnotationCanvasProps {
  pageImage: string;
  width: number;
  height: number;
  zoom: number;
  currentTool: AnnotationTool;
  strokeColor: string;
  strokeWidth: number;
  annotations: any[];
  onAnnotationsChange: (annotations: any[]) => void;
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
  className?: string;
}

export function AnnotationCanvas({
  pageImage,
  width,
  height,
  zoom,
  currentTool,
  strokeColor,
  strokeWidth,
  annotations,
  onAnnotationsChange,
  onHistoryChange,
  className,
}: AnnotationCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fabricRef = React.useRef<fabric.Canvas | null>(null);
  const historyRef = React.useRef<{ states: string[]; index: number }>({
    states: [],
    index: -1,
  });

  // Initialize fabric canvas
  React.useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: width * (zoom / 100),
      height: height * (zoom / 100),
      isDrawingMode: false,
      selection: true,
    });

    fabricRef.current = canvas;

    // Load background image
    fabric.FabricImage.fromURL(pageImage).then((img) => {
      img.scaleToWidth(width * (zoom / 100));
      img.scaleToHeight(height * (zoom / 100));
      canvas.backgroundImage = img;
      canvas.renderAll();
    });

    // Load existing annotations
    if (annotations.length > 0) {
      canvas.loadFromJSON({ objects: annotations }).then(() => {
        canvas.renderAll();
        saveHistory();
      });
    } else {
      saveHistory();
    }

    // Event handlers
    canvas.on("object:added", handleObjectChange);
    canvas.on("object:modified", handleObjectChange);
    canvas.on("object:removed", handleObjectChange);

    return () => {
      canvas.dispose();
    };
     
  }, [pageImage, width, height]);

  // Update canvas size on zoom change
  React.useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.setWidth(width * (zoom / 100));
    canvas.setHeight(height * (zoom / 100));
    canvas.setZoom(zoom / 100);
    canvas.renderAll();
  }, [zoom, width, height]);

  // Update drawing mode based on tool
  React.useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Reset drawing mode
    canvas.isDrawingMode = false;
    canvas.selection = true;

    switch (currentTool) {
      case "draw":
        canvas.isDrawingMode = true;
        if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.color = strokeColor;
          canvas.freeDrawingBrush.width = strokeWidth;
        }
        break;
      case "highlight":
        canvas.isDrawingMode = true;
        if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.color = `${strokeColor}66`; // Semi-transparent
          canvas.freeDrawingBrush.width = strokeWidth * 3;
        }
        break;
      case "select":
        canvas.selection = true;
        break;
      case "eraser":
        canvas.selection = true;
        // Enable click-to-delete
        canvas.on("mouse:down", handleEraserClick);
        return () => {
          canvas.off("mouse:down", handleEraserClick);
        };
      default:
        // Shape tools handled in mouse events
        break;
    }
     
  }, [currentTool, strokeColor, strokeWidth]);

  // Handle eraser click
  const handleEraserClick = React.useCallback((e: fabric.TPointerEventInfo) => {
    const canvas = fabricRef.current;
    if (!canvas || currentTool !== "eraser") return;

    const target = canvas.findTarget(e.e as MouseEvent);
    if (target && target !== canvas.backgroundImage) {
      canvas.remove(target);
      canvas.renderAll();
    }
  }, [currentTool]);

  // Save history for undo/redo
  const saveHistory = React.useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const json = JSON.stringify(canvas.toJSON());
    const history = historyRef.current;

    // Remove any redo states
    history.states = history.states.slice(0, history.index + 1);
    history.states.push(json);
    history.index = history.states.length - 1;

    // Limit history size
    if (history.states.length > 50) {
      history.states.shift();
      history.index--;
    }

    onHistoryChange(history.index > 0, false);
  }, [onHistoryChange]);

  // Handle object changes
  const handleObjectChange = React.useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    saveHistory();

    // Get all objects (excluding background)
    const objects = canvas.getObjects().map((obj) => obj.toJSON());
    onAnnotationsChange(objects);
  }, [saveHistory, onAnnotationsChange]);

  // Handle shape drawing
  React.useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    let isDrawingShape = false;
    let startX = 0;
    let startY = 0;
    let shape: fabric.FabricObject | null = null;

    const handleMouseDown = (e: fabric.TPointerEventInfo) => {
      if (!["rectangle", "circle", "arrow", "text"].includes(currentTool)) return;
      if (!e.pointer) return;

      isDrawingShape = true;
      startX = e.pointer.x;
      startY = e.pointer.y;

      if (currentTool === "text") {
        const text = new fabric.IText("Type here", {
          left: startX,
          top: startY,
          fontSize: 16 * (zoom / 100),
          fill: strokeColor,
          fontFamily: "Arial",
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        isDrawingShape = false;
      } else if (currentTool === "rectangle") {
        shape = new fabric.Rect({
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          fill: "transparent",
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        });
        canvas.add(shape);
      } else if (currentTool === "circle") {
        shape = new fabric.Ellipse({
          left: startX,
          top: startY,
          rx: 0,
          ry: 0,
          fill: "transparent",
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        });
        canvas.add(shape);
      } else if (currentTool === "arrow") {
        shape = new fabric.Line([startX, startY, startX, startY], {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        });
        canvas.add(shape);
      }
    };

    const handleMouseMove = (e: fabric.TPointerEventInfo) => {
      if (!isDrawingShape || !shape || !e.pointer) return;

      const currentX = e.pointer.x;
      const currentY = e.pointer.y;

      if (currentTool === "rectangle" && shape instanceof fabric.Rect) {
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        shape.set({
          width,
          height,
          left: Math.min(startX, currentX),
          top: Math.min(startY, currentY),
        });
      } else if (currentTool === "circle" && shape instanceof fabric.Ellipse) {
        const rx = Math.abs(currentX - startX) / 2;
        const ry = Math.abs(currentY - startY) / 2;
        shape.set({
          rx,
          ry,
          left: Math.min(startX, currentX),
          top: Math.min(startY, currentY),
        });
      } else if (currentTool === "arrow" && shape instanceof fabric.Line) {
        shape.set({
          x2: currentX,
          y2: currentY,
        });
      }

      canvas.renderAll();
    };

    const handleMouseUp = () => {
      if (isDrawingShape && shape) {
        canvas.setActiveObject(shape);
        shape = null;
      }
      isDrawingShape = false;
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [currentTool, strokeColor, strokeWidth, zoom]);

  return (
    <div className={cn("relative", className)}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// Export undo/redo methods
export type AnnotationCanvasRef = {
  undo: () => void;
  redo: () => void;
};
