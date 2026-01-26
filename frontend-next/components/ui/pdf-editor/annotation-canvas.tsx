"use client";

import * as React from "react";
import * as fabric from "fabric";
import type { AnnotationTool } from "./types";
import { cn } from "@/lib/utils";
import { debounce } from "@/utils/debounce";

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
  const isInitializedRef = React.useRef(false);
  const renderRequestRef = React.useRef<number | null>(null);

  // Debounced annotation save (300ms delay)
  const debouncedSaveAnnotations = React.useMemo(
    () =>
      debounce((canvas: fabric.Canvas) => {
        const objects = canvas.getObjects().map((obj) => obj.toJSON());
        onAnnotationsChange(objects);
      }, 300),
    [onAnnotationsChange]
  );

  // Debounced history save (500ms delay)
  const debouncedSaveHistory = React.useMemo(
    () =>
      debounce((canvas: fabric.Canvas) => {
        const json = JSON.stringify(canvas.toJSON());
        const history = historyRef.current;

        // Remove any redo states
        history.states = history.states.slice(0, history.index + 1);
        history.states.push(json);
        history.index = history.states.length - 1;

        // Limit history size
        if (history.states.length > 30) {
          history.states.shift();
          history.index--;
        }

        onHistoryChange(history.index > 0, false);
      }, 500),
    [onHistoryChange]
  );

  // Throttled render using requestAnimationFrame
  const requestRender = React.useCallback(() => {
    if (renderRequestRef.current) return;
    renderRequestRef.current = requestAnimationFrame(() => {
      fabricRef.current?.renderAll();
      renderRequestRef.current = null;
    });
  }, []);

  // Initialize fabric canvas
  React.useEffect(() => {
    if (!canvasRef.current || isInitializedRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: width * (zoom / 100),
      height: height * (zoom / 100),
      isDrawingMode: false,
      selection: true,
      // Performance optimizations
      renderOnAddRemove: false, // Manual render control
      skipTargetFind: false,
      enableRetinaScaling: true, // Enable for crisp rendering on Retina/high-DPI displays
    });

    fabricRef.current = canvas;
    isInitializedRef.current = true;

    // Load background image with caching
    fabric.FabricImage.fromURL(pageImage, { crossOrigin: "anonymous" }).then((img) => {
      img.scaleToWidth(width * (zoom / 100));
      img.scaleToHeight(height * (zoom / 100));
      // Cache the background image
      img.set({ objectCaching: true });
      canvas.backgroundImage = img;
      canvas.renderAll();
    });

    // Load existing annotations
    if (annotations.length > 0) {
      canvas.loadFromJSON({ objects: annotations }).then(() => {
        // Enable caching on all objects
        canvas.getObjects().forEach((obj) => {
          obj.set({ objectCaching: true });
        });
        canvas.renderAll();
      });
    }

    // Event handlers - debounced
    const handleChange = () => {
      debouncedSaveHistory(canvas);
      debouncedSaveAnnotations(canvas);
      requestRender();
    };

    canvas.on("object:added", handleChange);
    canvas.on("object:modified", handleChange);
    canvas.on("object:removed", handleChange);

    return () => {
      if (renderRequestRef.current) {
        cancelAnimationFrame(renderRequestRef.current);
      }
      canvas.dispose();
      isInitializedRef.current = false;
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
  const handleEraserClick = React.useCallback(
    (e: fabric.TPointerEventInfo) => {
      const canvas = fabricRef.current;
      if (!canvas || currentTool !== "eraser") return;

      const target = canvas.findTarget(e.e as MouseEvent);
      if (target && target !== canvas.backgroundImage) {
        canvas.remove(target);
        canvas.renderAll();
      }
    },
    [currentTool]
  );

  // Handle keyboard delete
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          activeObjects.forEach((obj) => canvas.remove(obj));
          canvas.discardActiveObject();
          canvas.renderAll();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle shape drawing with throttled rendering
  React.useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    let isDrawingShape = false;
    let startX = 0;
    let startY = 0;
    let shape: fabric.FabricObject | null = null;
    let calloutText: fabric.IText | null = null;
    let calloutArrow: fabric.Line | null = null;

    const handleMouseDown = (e: fabric.TPointerEventInfo) => {
      if (!["rectangle", "circle", "arrow", "text", "callout"].includes(currentTool)) return;
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
          objectCaching: true,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        isDrawingShape = false;
        canvas.renderAll();
      } else if (currentTool === "callout") {
        // Create text at click position
        calloutText = new fabric.IText("Label", {
          left: startX,
          top: startY - 20,
          fontSize: 14 * (zoom / 100),
          fill: strokeColor,
          fontFamily: "Arial",
          objectCaching: false,
        });
        // Create arrow from text to target (will be updated on drag)
        calloutArrow = new fabric.Line([startX, startY, startX, startY], {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          objectCaching: false,
        });
        canvas.add(calloutArrow);
        canvas.add(calloutText);
      } else if (currentTool === "rectangle") {
        shape = new fabric.Rect({
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          fill: "transparent",
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          objectCaching: false, // Disable during drawing for responsiveness
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
          objectCaching: false,
        });
        canvas.add(shape);
      } else if (currentTool === "arrow") {
        shape = new fabric.Line([startX, startY, startX, startY], {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          objectCaching: false,
        });
        canvas.add(shape);
      }
    };

    const handleMouseMove = (e: fabric.TPointerEventInfo) => {
      if (!isDrawingShape || !e.pointer) return;

      const currentX = e.pointer.x;
      const currentY = e.pointer.y;

      if (currentTool === "callout" && calloutArrow) {
        // Update arrow endpoint to follow mouse
        calloutArrow.set({
          x2: currentX,
          y2: currentY,
        });
        requestRender();
        return;
      }

      if (!shape) return;

      if (currentTool === "rectangle" && shape instanceof fabric.Rect) {
        const w = Math.abs(currentX - startX);
        const h = Math.abs(currentY - startY);
        shape.set({
          width: w,
          height: h,
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

      // Use throttled render instead of renderAll on every move
      requestRender();
    };

    const handleMouseUp = () => {
      if (isDrawingShape) {
        if (currentTool === "callout" && calloutText && calloutArrow) {
          // Enable caching on both elements
          calloutText.set({ objectCaching: true });
          calloutArrow.set({ objectCaching: true });
          // Select the text for editing
          canvas.setActiveObject(calloutText);
          calloutText.enterEditing();
          canvas.renderAll();
          calloutText = null;
          calloutArrow = null;
        } else if (shape) {
          // Enable caching after drawing is complete
          shape.set({ objectCaching: true });
          canvas.setActiveObject(shape);
          canvas.renderAll();
          shape = null;
        }
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
  }, [currentTool, strokeColor, strokeWidth, zoom, requestRender]);

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
