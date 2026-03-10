"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowUpRight,
  Circle,
  Square,
  Type,
  Pen,
  Undo2,
  Redo2,
  Save,
  X,
  Palette,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import type { InspectionPhoto } from "@/lib/inspection-atoms";

type AnnotationTool = "arrow" | "circle" | "rectangle" | "text" | "freehand";

interface AnnotationOverlayProps {
  photo: InspectionPhoto;
  onClose: () => void;
  onSaved: () => void;
}

const COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Black", value: "#000000" },
  { name: "White", value: "#ffffff" },
];

const LINE_WIDTHS = [
  { name: "Thin", value: 2 },
  { name: "Medium", value: 4 },
  { name: "Thick", value: 8 },
];

export function AnnotationOverlay({ photo, onClose, onSaved }: AnnotationOverlayProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricCanvasRef = useRef<any>(null);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("freehand");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(4);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize Fabric.js canvas
  useEffect(() => {
    let cancelled = false;

    async function initCanvas() {
      const fabricModule = await import("fabric");
      const { Canvas, FabricImage } = fabricModule;

      if (cancelled || !canvasRef.current) return;

      const canvas = new Canvas(canvasRef.current, {
        width: 800,
        height: 600,
        backgroundColor: "#1a1a1a",
      });

      fabricCanvasRef.current = canvas;

      // Load the original image as background
      const blob = photo.storage_blob;
      const imgUrl = `/api/v1/storage_blobs/${blob.id}/download`;

      try {
        const img = await FabricImage.fromURL(imgUrl, { crossOrigin: "anonymous" });

        // Scale image to fit canvas
        const scale = Math.min(800 / (img.width || 800), 600 / (img.height || 600));
        img.scale(scale);
        img.set({
          left: (800 - (img.width || 800) * scale) / 2,
          top: (600 - (img.height || 600) * scale) / 2,
          selectable: false,
          evented: false,
        });

        canvas.backgroundImage = img;
        canvas.renderAll();

        // Load existing annotations if any
        if (photo.annotations_json && Object.keys(photo.annotations_json).length > 0) {
          await canvas.loadFromJSON(photo.annotations_json);
          canvas.renderAll();
        }

        // Save initial state
        const initialState = JSON.stringify(canvas.toJSON());
        setHistory([initialState]);
        setHistoryIndex(0);
        setLoaded(true);
      } catch (err) {
        console.error("Failed to load annotation image:", err);
        setLoaded(true);
      }
    }

    initCanvas();

    return () => {
      cancelled = true;
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [photo]);

  // Update drawing mode when tool/color/width changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (activeTool === "freehand") {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = lineWidth;
    } else {
      canvas.isDrawingMode = false;
    }
  }, [activeTool, activeColor, lineWidth]);

  // Handle tool-specific actions on canvas click
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || activeTool === "freehand") return;

    const handleMouseDown = async (opt: { e: MouseEvent; pointer: { x: number; y: number } }) => {
      const fabricModule = await import("fabric");
      const pointer = canvas.getScenePoint(opt.e);

      switch (activeTool) {
        case "arrow": {
          const line = new fabricModule.Line([pointer.x, pointer.y, pointer.x + 80, pointer.y - 40], {
            stroke: activeColor,
            strokeWidth: lineWidth,
            selectable: true,
          });
          // Arrowhead triangle
          const triangle = new fabricModule.Triangle({
            width: lineWidth * 4,
            height: lineWidth * 4,
            fill: activeColor,
            left: pointer.x + 80,
            top: pointer.y - 40,
            angle: -30,
            selectable: true,
          });
          canvas.add(line, triangle);
          break;
        }
        case "circle": {
          const circle = new fabricModule.Circle({
            radius: 40,
            left: pointer.x - 40,
            top: pointer.y - 40,
            fill: "transparent",
            stroke: activeColor,
            strokeWidth: lineWidth,
            selectable: true,
          });
          canvas.add(circle);
          break;
        }
        case "rectangle": {
          const rect = new fabricModule.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 80,
            height: 60,
            fill: "transparent",
            stroke: activeColor,
            strokeWidth: lineWidth,
            selectable: true,
          });
          canvas.add(rect);
          break;
        }
        case "text": {
          const text = new fabricModule.IText("Note", {
            left: pointer.x,
            top: pointer.y,
            fill: activeColor,
            fontSize: lineWidth * 6,
            fontFamily: "sans-serif",
            selectable: true,
          });
          canvas.add(text);
          canvas.setActiveObject(text);
          text.enterEditing();
          break;
        }
      }

      canvas.renderAll();
      saveHistory();
    };

    canvas.on("mouse:down", handleMouseDown);
    return () => canvas.off("mouse:down", handleMouseDown);
  }, [activeTool, activeColor, lineWidth]);

  const saveHistory = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const state = JSON.stringify(canvas.toJSON());
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(state);
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [historyIndex]);

  // Track freehand drawing completion
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handlePathCreated = () => saveHistory();
    canvas.on("path:created", handlePathCreated);
    return () => canvas.off("path:created", handlePathCreated);
  }, [saveHistory]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const newIndex = historyIndex - 1;
    canvas.loadFromJSON(history[newIndex]).then(() => {
      canvas.renderAll();
      setHistoryIndex(newIndex);
    });
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const newIndex = historyIndex + 1;
    canvas.loadFromJSON(history[newIndex]).then(() => {
      canvas.renderAll();
      setHistoryIndex(newIndex);
    });
  }, [history, historyIndex]);

  const handleSave = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    setSaving(true);
    try {
      // Export annotated image as PNG
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });

      // Export Fabric.js JSON for re-editing
      const annotationsJson = canvas.toJSON();

      await api.post(
        `/api/v1/inspection_items/${photo.inspection_item_id || 0}/inspection_photos/${photo.id}/annotate`,
        {
          annotated_image: dataUrl,
          annotations_json: annotationsJson,
        }
      );

      toast({ title: "Annotation saved" });
      onSaved();
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to save annotation", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [photo, onSaved, onClose, toast]);

  const tools: { tool: AnnotationTool; icon: typeof Pen; label: string }[] = [
    { tool: "freehand", icon: Pen, label: "Draw" },
    { tool: "arrow", icon: ArrowUpRight, label: "Arrow" },
    { tool: "circle", icon: Circle, label: "Circle" },
    { tool: "rectangle", icon: Square, label: "Rect" },
    { tool: "text", icon: Type, label: "Text" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-1">
          {/* Tool buttons */}
          {tools.map(({ tool, icon: Icon, label }) => (
            <Button
              key={tool}
              size="sm"
              variant={activeTool === tool ? "default" : "ghost"}
              className={activeTool === tool ? "" : "text-gray-400 hover:text-white"}
              onClick={() => setActiveTool(tool)}
            >
              <Icon className="h-4 w-4 mr-1" />
              <span className="text-xs hidden sm:inline">{label}</span>
            </Button>
          ))}

          <div className="w-px h-6 bg-gray-700 mx-2" />

          {/* Colors */}
          <div className="flex items-center gap-1">
            {COLORS.map(c => (
              <button
                key={c.value}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  activeColor === c.value ? "border-white scale-110" : "border-gray-600"
                }`}
                style={{ backgroundColor: c.value }}
                onClick={() => setActiveColor(c.value)}
                title={c.name}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-gray-700 mx-2" />

          {/* Line widths */}
          <div className="flex items-center gap-1">
            {LINE_WIDTHS.map(lw => (
              <button
                key={lw.value}
                className={`px-2 py-1 rounded text-xs ${
                  lineWidth === lw.value
                    ? "bg-white text-black"
                    : "text-gray-400 hover:text-white"
                }`}
                onClick={() => setLineWidth(lw.value)}
              >
                {lw.name}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-gray-700 mx-2" />

          {/* Undo/Redo */}
          <Button size="sm" variant="ghost" className="text-gray-400" onClick={handleUndo} disabled={historyIndex <= 0}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-gray-400" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-gray-400" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner className="h-8 w-8" />
          </div>
        )}
        <canvas ref={canvasRef} className="touch-none" />
      </div>
    </div>
  );
}
