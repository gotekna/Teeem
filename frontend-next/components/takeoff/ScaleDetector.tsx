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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Wand2, Check, X, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

// =============================================================================
// Types
// =============================================================================

interface ScaleDetectionResult {
  detected: boolean;
  scale_text?: string;
  scale_ratio?: number;
  unit?: "metric" | "imperial";
  confidence?: number;
  notes?: string;
  reference_mm?: number;
  error?: string;
}

interface ScaleDetectorProps {
  planId?: string;
  docsortItemId?: string;
  pageNumber: number;
  pageCanvas: HTMLCanvasElement | null;
  onScaleDetected: (scaleText: string, referenceMm: number) => void;
  isCalibrated: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function ScaleDetector({
  planId,
  docsortItemId,
  pageNumber,
  pageCanvas,
  onScaleDetected,
  isCalibrated,
}: ScaleDetectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState<ScaleDetectionResult | null>(null);
  const [manualReference, setManualReference] = useState("");

  // Capture page as base64 image
  const capturePageImage = (): string | null => {
    if (!pageCanvas) return null;

    try {
      // Convert canvas to base64 PNG
      const dataUrl = pageCanvas.toDataURL("image/png");
      // Remove the data:image/png;base64, prefix
      return dataUrl.split(",")[1];
    } catch (err) {
      console.error("Failed to capture page image:", err);
      return null;
    }
  };

  // Detect scale from page
  const handleDetect = async () => {
    const imageBase64 = capturePageImage();
    if (!imageBase64) {
      setResult({
        detected: false,
        error: "Failed to capture page image",
      });
      return;
    }

    setIsDetecting(true);
    setResult(null);

    try {
      const endpoint = planId
        ? `/api/v1/pdf_takeoff/plans/${planId}/detect_scale`
        : `/api/v1/pdf_takeoff/docsort/${docsortItemId}/detect_scale`;

      const response = await api.post<{
        success: boolean;
        data: ScaleDetectionResult;
        error?: string;
      }>(endpoint, {
        image_base64: imageBase64,
        media_type: "image/png",
        page_number: pageNumber,
      });

      if (response?.success && response?.data) {
        setResult(response.data);
        if (response.data.reference_mm) {
          setManualReference(response.data.reference_mm.toString());
        }
      } else {
        setResult({
          detected: false,
          error: response?.error || "Detection failed",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Detection failed";
      setResult({
        detected: false,
        error: message,
      });
    } finally {
      setIsDetecting(false);
    }
  };

  // Apply detected scale
  const handleApply = () => {
    if (!result?.detected || !result.scale_text) return;

    const referenceMm = parseFloat(manualReference) || result.reference_mm || 1000;
    onScaleDetected(result.scale_text, referenceMm);
    setIsOpen(false);
    setResult(null);
  };

  // Open dialog and start detection
  const handleOpenDialog = () => {
    setIsOpen(true);
    setResult(null);
    setManualReference("");
    // Auto-start detection
    setTimeout(() => handleDetect(), 100);
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-500";
    if (confidence >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
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
        <Wand2 className="h-4 w-4" />
        Auto-detect Scale
      </Button>

      {/* Detection Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              AI Scale Detection
            </DialogTitle>
            <DialogDescription>
              Analyzing the drawing to detect the scale from the title block.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Loading State */}
            {isDetecting && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Spinner size={32} />
                <p className="text-sm text-muted-foreground">
                  Analyzing drawing...
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

            {/* No Scale Found */}
            {result && !result.detected && !result.error && (
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <X className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">No Scale Detected</p>
                  <p className="text-sm text-muted-foreground">
                    {result.notes || "Could not find a scale notation in the drawing. Please calibrate manually."}
                  </p>
                </div>
              </div>
            )}

            {/* Scale Detected */}
            {result?.detected && (
              <div className="space-y-4">
                {/* Detection Result */}
                <div className="flex items-start gap-3 p-4 bg-green-500/10 rounded-lg">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-green-700 dark:text-green-400">
                        Scale Detected
                      </p>
                      {result.confidence !== undefined && (
                        <Badge
                          variant="secondary"
                          className={`${getConfidenceColor(result.confidence)} text-white text-xs`}
                        >
                          {Math.round(result.confidence * 100)}% confident
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold mt-1">{result.scale_text}</p>
                    {result.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{result.notes}</p>
                    )}
                  </div>
                </div>

                {/* Scale Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Scale Ratio:</span>
                    <span className="ml-2 font-medium">1:{result.scale_ratio}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Unit System:</span>
                    <span className="ml-2 font-medium capitalize">{result.unit}</span>
                  </div>
                </div>

                {/* Manual Reference Adjustment */}
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference Length (mm)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="reference"
                      type="number"
                      value={manualReference}
                      onChange={(e) => setManualReference(e.target.value)}
                      placeholder={result.unit === "imperial" ? "304.8 (1 foot)" : "1000 (1 meter)"}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {result.unit === "imperial"
                      ? "Suggested: 304.8mm (1 foot) for imperial scales"
                      : "Suggested: 1000mm (1 meter) for metric scales"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            {!isDetecting && !result?.detected && (
              <Button onClick={handleDetect}>
                <Wand2 className="h-4 w-4 mr-2" />
                Retry Detection
              </Button>
            )}
            {result?.detected && (
              <Button onClick={handleApply}>
                <Check className="h-4 w-4 mr-2" />
                Apply Scale
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
