"use client";

import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wand2, Check, X, AlertCircle, Layers, Box, DoorOpen, Square } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface DetectedElement {
  id: string;
  type: "wall" | "door" | "window" | "opening" | "stair" | "column" | "beam" | "other";
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  points: Array<{ x: number; y: number }>;
  estimated_value: number | null;
  estimated_unit: string | null;
  confidence: number;
  notes: string | null;
}

interface ElementDetectionResult {
  detected: boolean;
  element_count: number;
  elements: DetectedElement[];
  drawing_info?: {
    has_dimensions: boolean;
    has_scale_bar: boolean;
    drawing_type: string;
    notes: string;
  };
  error?: string;
}

interface ElementDetectorProps {
  planId?: string;
  docsortItemId?: string;
  pageNumber: number;
  pageCanvas: HTMLCanvasElement | null;
  pageWidth: number;
  pageHeight: number;
  onElementsDetected: (elements: DetectedElement[]) => void;
  isCalibrated: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const ELEMENT_TYPES = [
  { value: "wall", label: "Walls", icon: Layers },
  { value: "door", label: "Doors", icon: DoorOpen },
  { value: "window", label: "Windows", icon: Square },
  { value: "opening", label: "Openings", icon: Box },
  { value: "stair", label: "Stairs", icon: Box },
  { value: "column", label: "Columns", icon: Box },
  { value: "beam", label: "Beams", icon: Box },
] as const;

// =============================================================================
// Component
// =============================================================================

export function ElementDetector({
  planId,
  docsortItemId,
  pageNumber,
  pageCanvas,
  pageWidth,
  pageHeight,
  onElementsDetected,
  isCalibrated,
}: ElementDetectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState<ElementDetectionResult | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["wall", "door", "window"]);
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set());

  // Capture page as base64 image
  const capturePageImage = (): string | null => {
    if (!pageCanvas) return null;

    try {
      const dataUrl = pageCanvas.toDataURL("image/png");
      return dataUrl.split(",")[1];
    } catch (err) {
      console.error("Failed to capture page image:", err);
      return null;
    }
  };

  // Detect elements from page
  const handleDetect = async () => {
    const imageBase64 = capturePageImage();
    if (!imageBase64) {
      setResult({
        detected: false,
        element_count: 0,
        elements: [],
        error: "Failed to capture page image",
      });
      return;
    }

    setIsDetecting(true);
    setResult(null);
    setSelectedElements(new Set());

    try {
      const endpoint = planId
        ? `/api/v1/pdf_takeoff/plans/${planId}/detect_elements`
        : `/api/v1/pdf_takeoff/docsort/${docsortItemId}/detect_elements`;

      const response = await api.post<{
        success: boolean;
        data: ElementDetectionResult;
        error?: string;
      }>(endpoint, {
        image_base64: imageBase64,
        media_type: "image/png",
        page_number: pageNumber,
        element_types: selectedTypes,
      });

      if (response?.success && response?.data) {
        setResult(response.data);
        // Auto-select high confidence elements
        const autoSelected = new Set(
          response.data.elements
            .filter((e) => e.confidence >= 0.7)
            .map((e) => e.id)
        );
        setSelectedElements(autoSelected);
      } else {
        setResult({
          detected: false,
          element_count: 0,
          elements: [],
          error: response?.error || "Detection failed",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Detection failed";
      setResult({
        detected: false,
        element_count: 0,
        elements: [],
        error: message,
      });
    } finally {
      setIsDetecting(false);
    }
  };

  // Toggle element selection
  const toggleElement = (id: string) => {
    setSelectedElements((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select/deselect all
  const toggleAllElements = () => {
    if (!result) return;
    if (selectedElements.size === result.elements.length) {
      setSelectedElements(new Set());
    } else {
      setSelectedElements(new Set(result.elements.map((e) => e.id)));
    }
  };

  // Toggle element type filter
  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  // Apply selected elements
  const handleApply = () => {
    if (!result) return;

    const selected = result.elements.filter((e) => selectedElements.has(e.id));
    onElementsDetected(selected);
    setIsOpen(false);
    setResult(null);
  };

  // Open dialog
  const handleOpenDialog = () => {
    setIsOpen(true);
    setResult(null);
    setSelectedElements(new Set());
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-500";
    if (confidence >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Get element type icon
  const getElementIcon = (type: string) => {
    const typeConfig = ELEMENT_TYPES.find((t) => t.value === type);
    if (typeConfig) {
      const Icon = typeConfig.icon;
      return <Icon className="h-4 w-4" />;
    }
    return <Box className="h-4 w-4" />;
  };

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenDialog}
        className="gap-2"
        disabled={!pageCanvas}
      >
        <Layers className="h-4 w-4" />
        Detect Elements
      </Button>

      {/* Detection Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              AI Element Detection
            </DialogTitle>
            <DialogDescription>
              Detect walls, doors, windows, and other architectural elements in the drawing.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Element Type Filters */}
            {!isDetecting && !result && (
              <div className="space-y-2">
                <Label>Elements to detect:</Label>
                <div className="flex flex-wrap gap-2">
                  {ELEMENT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => toggleType(type.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors",
                        selectedTypes.includes(type.value)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border"
                      )}
                    >
                      <type.icon className="h-3.5 w-3.5" />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading State */}
            {isDetecting && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Spinner size={32} />
                <p className="text-sm text-muted-foreground">
                  Analyzing drawing for architectural elements...
                </p>
              </div>
            )}

            {/* Error State */}
            {result && !result.detected && result.error && (
              <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Detection Failed</p>
                  <p className="text-sm text-muted-foreground">{result.error}</p>
                </div>
              </div>
            )}

            {/* No Elements Found */}
            {result && !result.detected && !result.error && (
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <X className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">No Elements Detected</p>
                  <p className="text-sm text-muted-foreground">
                    Could not identify architectural elements in the drawing. Try with a clearer image or different element types.
                  </p>
                </div>
              </div>
            )}

            {/* Elements Detected */}
            {result?.detected && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-700 dark:text-green-400">
                      {result.element_count} elements detected
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={toggleAllElements}>
                    {selectedElements.size === result.elements.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                {/* Drawing Info */}
                {result.drawing_info && (
                  <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                    Type: {result.drawing_info.drawing_type || "Unknown"} |
                    {result.drawing_info.has_dimensions && " Has dimensions |"}
                    {result.drawing_info.has_scale_bar && " Has scale bar"}
                  </div>
                )}

                {/* Element List */}
                <ScrollArea className="h-64 border rounded-lg">
                  <div className="p-2 space-y-1">
                    {result.elements.map((element) => (
                      <button
                        key={element.id}
                        onClick={() => toggleElement(element.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                          selectedElements.has(element.id)
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted"
                        )}
                      >
                        <Checkbox
                          checked={selectedElements.has(element.id)}
                          onCheckedChange={() => toggleElement(element.id)}
                        />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getElementIcon(element.type)}
                          <span className="font-medium capitalize">{element.type}</span>
                          {element.estimated_value && (
                            <span className="text-sm text-muted-foreground">
                              ~{element.estimated_value.toFixed(1)}
                              {element.estimated_unit || "m"}
                            </span>
                          )}
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn(
                            getConfidenceColor(element.confidence),
                            "text-white text-xs"
                          )}
                        >
                          {Math.round(element.confidence * 100)}%
                        </Badge>
                      </button>
                    ))}
                  </div>
                </ScrollArea>

                {/* Calibration Warning */}
                {!isCalibrated && (
                  <div className="text-sm text-amber-600 dark:text-amber-400 p-2 bg-amber-50 dark:bg-amber-950/30 rounded">
                    Note: The drawing is not calibrated. Detected elements will be added but measurements won&apos;t be accurate until you calibrate the scale.
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            {!isDetecting && !result && (
              <Button onClick={handleDetect} disabled={selectedTypes.length === 0}>
                <Wand2 className="h-4 w-4 mr-2" />
                Detect Elements
              </Button>
            )}
            {!isDetecting && result && !result.detected && (
              <Button onClick={handleDetect}>
                <Wand2 className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
            {result?.detected && (
              <Button onClick={handleApply} disabled={selectedElements.size === 0}>
                <Check className="h-4 w-4 mr-2" />
                Add {selectedElements.size} Element{selectedElements.size !== 1 ? "s" : ""}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================================================
// Types Export
// =============================================================================

export type { DetectedElement, ElementDetectionResult };
