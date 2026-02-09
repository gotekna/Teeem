"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import type {
  TakeoffTool,
  PageScale,
  TakeoffMeasurement,
  TakeoffLayer,
  Point,
  GeometryData,
  CalibrationData,
  DrawingStyle,
  MeasurementCreateOptions,
} from "./types";
import { DEFAULT_DRAWING_STYLE } from "./types";
import { useSnapPoints, type SnapConfig } from "./useSnapPoints";
import { SnapIndicator, SnapPointsLayer, SnapMagnifier, PinnedMagnifier } from "./SnapIndicator";
import { PdfFrame } from "@/components/ui/pdf-chrome";

// =============================================================================
// Fabric.js Type Extensions
// =============================================================================

// Custom data interface for takeoff objects
interface TakeoffObjectData {
  isMeasurement?: boolean;
  measurementId?: number;
  pointIndex?: number;  // For count markers — which point in geometry_data.points
  isCalibration?: boolean;
  isCalibrationLabel?: boolean;
  isTempCalibration?: boolean;
  isTempDrawing?: boolean;
}

// Helper to get/set custom data on Fabric objects
type FabricObjectWithData = fabric.FabricObject & { data?: TakeoffObjectData };

// Selection event type
interface SelectionEvent {
  selected?: FabricObjectWithData[];
}

// =============================================================================
// Props
// =============================================================================

interface TakeoffCanvasProps {
  // PDF rendering
  pdfPage: HTMLCanvasElement | null;  // Rendered PDF page
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;

  // Scale calibration
  pageScale: PageScale | null;
  onCalibrate: (data: CalibrationData) => Promise<void>;
  onClearCalibration?: () => Promise<void>;

  // Measurements
  measurements: TakeoffMeasurement[];
  onMeasurementCreate: (
    type: TakeoffMeasurement["measurement_type"],
    geometryData: GeometryData,
    pixelValue: number,
    pageNumber: number,
    options?: MeasurementCreateOptions
  ) => Promise<TakeoffMeasurement | null>;
  onCountPointAdd: (measurementId: number, point: Point) => Promise<TakeoffMeasurement | null>;
  onMovePoint: (measurementId: number, pointIndex: number, newPoint: Point) => Promise<void>;
  onRemovePoint: (measurementId: number, pointIndex: number) => Promise<void>;
  onMeasurementDelete: (id: number) => Promise<void>;
  onMeasurementSelect: (measurement: TakeoffMeasurement | null) => void;
  selectedMeasurement: TakeoffMeasurement | null;

  // Layer
  activeLayer: TakeoffLayer | null;
  layers: TakeoffLayer[];  // For visibility filtering

  // Tool state
  currentTool: TakeoffTool;

  // Style
  drawingStyle?: DrawingStyle;

  // Zoom
  zoom: number;

  // Snap configuration
  snapConfig?: Partial<SnapConfig>;
  showSnapPoints?: boolean;  // Debug: show all available snap points

  // Container ref for calibration input positioning
  containerRef?: React.RefObject<HTMLDivElement | null>;

  // Pan state from usePdfPanZoom hook — suppresses tool clicks during pan
  isPanning?: boolean;
  isSpaceHeld?: boolean;

  // Zoom-to-rectangle: left-click drag in select mode zooms to the drawn rect
  onZoomToRect?: (rect: { x: number; y: number; width: number; height: number }) => void;
}

// =============================================================================
// Component
// =============================================================================

export function TakeoffCanvas({
  pdfPage,
  pageNumber,
  pageWidth,
  pageHeight,
  pageScale,
  onCalibrate,
  onClearCalibration,
  measurements,
  onMeasurementCreate,
  onCountPointAdd,
  onMovePoint,
  onRemovePoint,
  onMeasurementDelete,
  onMeasurementSelect,
  selectedMeasurement,
  activeLayer,
  layers,
  currentTool,
  drawingStyle = DEFAULT_DRAWING_STYLE,
  zoom,
  snapConfig,
  showSnapPoints = false,
  containerRef,
  isPanning: isPanningProp = false,
  isSpaceHeld: isSpaceHeldProp = false,
  onZoomToRect,
}: TakeoffCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);

  // Zoom-to-rect: track in canvas-space coords (zoomed) for overlay + page-space for zoom calc
  const zoomDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [zoomRect, setZoomRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const onZoomToRectRef = useRef(onZoomToRect);
  onZoomToRectRef.current = onZoomToRect;

  // Left-click pan: track drag start in screen coords for scrolling
  const panDragRef = useRef<{ clientX: number; clientY: number; scrollLeft: number; scrollTop: number } | null>(null);

  // Cached PDF background image — created once per page, re-scaled on zoom
  const pdfBgImageRef = useRef<fabric.FabricImage | null>(null);

  // Refs for event handlers - avoids stale closures in Fabric event listeners
  // ⚠️ DO NOT SIMPLIFY - Canvas event listeners capture closures at registration time.
  // Without refs, switching tools (e.g. select → calibrate) won't work because
  // the canvas still calls the old handler that captured the previous currentTool value.
  const handlersRef = useRef<{
    mouseDown: (e: fabric.TPointerEventInfo) => void;
    mouseMove: (e: fabric.TPointerEventInfo) => void;
    mouseUp: (e: fabric.TPointerEventInfo) => void;
    doubleClick: () => void;
    selectionCreated: (e: SelectionEvent) => void;
    selectionCleared: () => void;
  }>({
    mouseDown: () => {},
    mouseMove: () => {},
    mouseUp: (() => {}) as (e: fabric.TPointerEventInfo) => void,
    doubleClick: () => {},
    selectionCreated: () => {},
    selectionCleared: () => {},
  });

  // Reposition mode: click a count marker to pick it up, click again to place it
  // Works like calibration's "select which line to snap to" pattern
  const [repositioning, setRepositioning] = useState<{
    measurementId: number;
    pointIndex: number;
    originalPoint: Point;  // For visual feedback (dashed line from old → cursor)
  } | null>(null);
  const repositioningRef = useRef(repositioning);
  repositioningRef.current = repositioning;
  // Ghost preview position (raw PDF coords) — follows cursor while repositioning
  const [repositionPreview, setRepositionPreview] = useState<Point | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [calibrationLine, setCalibrationLine] = useState<{ start: Point; end: Point } | null>(null);
  // Calibration uses click-click (not drag): click first point, click second point, type dimension
  // "verifying" = already calibrated, showing computed measurement for a check line
  const [calibrationStep, setCalibrationStep] = useState<"idle" | "firstPoint" | "waitingInput" | "verifying">("idle");
  const [calibrationInput, setCalibrationInput] = useState("");
  const calibrationInputRef = useRef<HTMLInputElement>(null);
  // Calibration overlay visible only when calibrate tool is active
  const showCalibrationOverlay = currentTool === "calibrate";
  const [verificationInput, setVerificationInput] = useState("");
  const [verificationConfirmed, setVerificationConfirmed] = useState(false);
  const verificationInputRef = useRef<HTMLInputElement>(null);
  // Verifications stored per page so they persist across page switches
  type VerificationResult = {
    line: { start: Point; end: Point };
    computedMm: number;
    expectedMm: number;
    diffPercent: number;
  };
  const [verificationsByPage, setVerificationsByPage] = useState<Record<number, VerificationResult[]>>({});
  const completedVerifications = verificationsByPage[pageNumber] || [];
  const setCompletedVerifications = useCallback((updater: VerificationResult[] | ((prev: VerificationResult[]) => VerificationResult[])) => {
    setVerificationsByPage(prev => {
      const current = prev[pageNumber] || [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [pageNumber]: next };
    });
  }, [pageNumber]);

  // Reset active calibration UI (not verifications) when switching pages
  useEffect(() => {
    setCalibrationLine(null);
    setCalibrationStep("idle");
    setCalibrationInput("");
    setVerificationInput("");
    setVerificationConfirmed(false);
    setIsDrawing(false);
  }, [pageNumber]);

  // Refs for calibration state — avoids stale closures in placeToolPoint
  // ⚠️ DO NOT SIMPLIFY - placeToolPoint is called from both canvas mousedown and
  // SnapMagnifier candidate clicks. Without refs, rapid mousemove (which updates
  // calibrationLine on every frame) causes placeToolPoint to capture stale values,
  // preventing the "firstPoint" → "waitingInput" transition on second click.
  const calibrationLineRef = useRef(calibrationLine);
  calibrationLineRef.current = calibrationLine;
  const calibrationStepRef = useRef(calibrationStep);
  calibrationStepRef.current = calibrationStep;
  const pageScaleRef = useRef(pageScale);
  pageScaleRef.current = pageScale;
  // Refs for polygon auto-close in placeToolPoint
  const currentPointsRef = useRef(currentPoints);
  currentPointsRef.current = currentPoints;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const completeDrawingRef = useRef<() => void>(() => {});
  // Ref for onMovePoint — avoids stale closure in event handler
  const onMovePointRef = useRef(onMovePoint);
  onMovePointRef.current = onMovePoint;
  // Ref for onRemovePoint — avoids stale closure in keyboard handler
  const onRemovePointRef = useRef(onRemovePoint);
  onRemovePointRef.current = onRemovePoint;
  // ⚠️ DO NOT SIMPLIFY — renderMeasurements removes all Fabric objects then re-adds them.
  // This triggers Fabric's selection:cleared event, which would null the selectedMeasurement.
  // This ref suppresses that false-positive during re-render so selection persists.
  const isReRenderingRef = useRef(false);

  // Count marker state
  const [nextCountLabel, setNextCountLabel] = useState(1);

  // Snap state
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null);
  const [snapResult, setSnapResult] = useState<{
    snapped: Point;
    isSnapped: boolean;
    snapType: "endpoint" | "intersection" | "midpoint" | "perpendicular" | "edge" | "pdf-edge" | null;
    pdfCandidates?: Array<{ x: number; y: number }>;
  } | null>(null);
  // Ref to avoid stale closure in handleMouseDown (snapResult not in its deps)
  const snapResultRef = useRef(snapResult);
  snapResultRef.current = snapResult;

  // Initialize snap points hook
  const { findSnapPoint, getVisibleSnapPoints, overridePdfSnap } = useSnapPoints({
    measurements: measurements.map(m => ({
      id: m.id,
      geometry_data: m.geometry_data,
    })),
    pageWidth,
    pageHeight,
    zoom,
    config: snapConfig,
    pdfCanvas: pdfPage,
  });

  // =============================================================================
  // Canvas Setup
  // =============================================================================

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: pageWidth * zoom,
      height: pageHeight * zoom,
      selection: false,  // Left-click drag pans; right-click drag draws zoom-to-rect
      fireRightClick: true,  // Enable right-click events for zoom-to-rect
      stopContextMenu: true, // Suppress browser context menu on canvas
      renderOnAddRemove: false,  // Manual render for performance
    });

    fabricRef.current = canvas;

    // Set up event handlers
    setupEventHandlers(canvas);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [pageWidth, pageHeight]);

  // Safety net: if calibration was cleared while in "verifying" mode,
  // fall back to "waitingInput" so the mm input popup appears
  useEffect(() => {
    if (calibrationStep === "verifying" && (!pageScale?.calibrated || !pageScale?.scale_factor)) {
      setCalibrationStep("waitingInput");
      setCalibrationInput("");
    }
  }, [calibrationStep, pageScale]);

  // Re-render Fabric calibration line when calibration state changes.
  // This replaces the direct renderTempCalibrationLine() calls that were inside
  // placeToolPoint — those captured stale closure state. The useEffect sees
  // fresh state from React's committed render.
  useEffect(() => {
    if (calibrationLine && showCalibrationOverlay && (calibrationStep === "firstPoint" || calibrationStep === "waitingInput" || calibrationStep === "verifying")) {
      renderTempCalibrationLine();
    } else if (!calibrationLine || !showCalibrationOverlay) {
      // Clean up stale Fabric objects when calibration is cancelled/completed/hidden
      clearTempDrawing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calibrationLine, calibrationStep, showCalibrationOverlay]);

  // Sync calibration line endpoint with snap point when cycling magnifier candidates
  // (arrow keys change snapResult.snapped but don't move the mouse, so handleMouseMove
  // won't fire — we need this effect to update the preview line + distance label)
  useEffect(() => {
    if (isDrawing && currentTool === "calibrate" && calibrationStep === "firstPoint" && snapResult?.isSnapped && calibrationLine) {
      const snapped = snapResult.snapped;
      // Only update if the snap point actually differs from the current endpoint
      if (snapped.x !== calibrationLine.end.x || snapped.y !== calibrationLine.end.y) {
        setCalibrationLine(prev => prev ? { ...prev, end: snapped } : null);
      }
    }
  }, [snapResult?.snapped?.x, snapResult?.snapped?.y, isDrawing, currentTool, calibrationStep]);

  // =============================================================================
  // Update canvas selection mode when tool changes
  // =============================================================================

  useEffect(() => {
    if (!fabricRef.current) return;
    // Disable Fabric's built-in selection rectangle — left-click drag pans instead.
    // Shift+drag re-enables it temporarily for zoom-to-rect (handled in handleMouseDown).
    fabricRef.current.selection = false;
    // Fabric.js manages its own cursor on the upper-canvas, so we must
    // set it via Fabric's API rather than CSS on the lower-canvas
    fabricRef.current.defaultCursor = getCursorForTool(currentTool);
    fabricRef.current.hoverCursor = getCursorForTool(currentTool);
  }, [currentTool]);

  // =============================================================================
  // Update canvas size on zoom
  // =============================================================================

  useEffect(() => {
    if (!fabricRef.current) return;

    fabricRef.current.setDimensions({
      width: pageWidth * zoom,
      height: pageHeight * zoom,
    });

    // Re-render measurements at new scale
    renderMeasurements();
  }, [zoom, pageWidth, pageHeight]);

  // =============================================================================
  // Render PDF background — create image once per page, re-scale on zoom
  // =============================================================================

  // Create FabricImage only when page changes (expensive: toDataURL + image decode)
  useEffect(() => {
    if (!fabricRef.current || !pdfPage) return;

    const dataUrl = pdfPage.toDataURL();
    fabric.FabricImage.fromURL(dataUrl).then((img) => {
      if (!fabricRef.current) return;
      pdfBgImageRef.current = img;
      img.scaleToWidth(pageWidth * zoom);
      fabricRef.current.backgroundImage = img;
      fabricRef.current.renderAll();
    });
  }, [pdfPage, pageWidth]);

  // Re-scale cached image on zoom (cheap: just changes scale + re-render)
  useEffect(() => {
    if (!fabricRef.current || !pdfBgImageRef.current) return;
    pdfBgImageRef.current.scaleToWidth(pageWidth * zoom);
    fabricRef.current.renderAll();
  }, [zoom, pageWidth]);

  // =============================================================================
  // Render Measurements
  // =============================================================================

  const renderMeasurements = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Suppress selection:cleared during re-render (removing objects triggers it)
    isReRenderingRef.current = true;

    // Clear existing measurement objects
    const toRemove = (canvas.getObjects() as FabricObjectWithData[]).filter(
      (obj) => obj.data?.isMeasurement
    );
    toRemove.forEach((obj) => canvas.remove(obj));

    // Build set of hidden layer IDs
    const hiddenLayerIds = new Set(
      layers.filter((l) => !l.visible).map((l) => l.id)
    );

    // Render each measurement — filter by active layer (null = show all)
    measurements.forEach((m) => {
      // Skip if measurement's layer is hidden (via visibility toggle)
      if (m.layer?.id && hiddenLayerIds.has(m.layer.id)) {
        return;
      }
      // Skip if a specific layer is selected and this measurement isn't on it
      if (activeLayer) {
        const mLayerId = m.layer?.id || -1;
        if (mLayerId !== activeLayer.id) return;
      }
      renderMeasurement(canvas, m);
    });

    // Render calibration line if exists
    if (pageScale?.calibration_line && pageScale.calibrated) {
      renderCalibrationLine(canvas, pageScale);
    }

    canvas.renderAll();
    isReRenderingRef.current = false;
  }, [measurements, pageScale, zoom, layers, selectedMeasurement, activeLayer, repositioning]);

  useEffect(() => {
    renderMeasurements();
  }, [renderMeasurements]);

  // =============================================================================
  // Render Individual Measurement
  // =============================================================================

  const renderMeasurement = (canvas: fabric.Canvas, measurement: TakeoffMeasurement) => {
    const { geometry_data, color, display_label, measurement_type, formatted_value } = measurement;
    if (!geometry_data?.points?.length) return;

    const scaledPoints = geometry_data.points.map((p) => ({
      x: p.x * zoom,
      y: p.y * zoom,
    }));

    const isSelected = selectedMeasurement?.id === measurement.id;
    // Selected = vivid green highlight so user can confirm which shape they clicked
    const effectiveColor = isSelected ? "#22C55E" : color;
    const strokeWidth = isSelected ? 3 : 2;

    switch (geometry_data.type) {
      case "point": {
        // Count markers — one measurement can have multiple points
        const markerRadius = drawingStyle.markerSize / 2;

        scaledPoints.forEach((point, idx) => {
          // Is this specific point currently being repositioned?
          const isBeingRepositioned = repositioning?.measurementId === measurement.id && repositioning?.pointIndex === idx;

          // Selected: add a glow ring behind each marker
          if (isSelected) {
            const glow = new fabric.Circle({
              left: point.x - markerRadius - 6,
              top: point.y - markerRadius - 6,
              radius: markerRadius + 6,
              fill: isBeingRepositioned ? "rgba(59,130,246,0.3)" : "rgba(34,197,94,0.2)",
              stroke: isBeingRepositioned ? "#3B82F6" : "#22C55E",
              strokeWidth: isBeingRepositioned ? 4 : 3,
              strokeDashArray: isBeingRepositioned ? [4, 3] : undefined,
              selectable: false,
              evented: false,
            }) as FabricObjectWithData;
            glow.data = { isMeasurement: true, measurementId: measurement.id };
            canvas.add(glow);
          }

          const marker = new fabric.Circle({
            left: point.x - markerRadius,
            top: point.y - markerRadius,
            radius: markerRadius,
            fill: isBeingRepositioned ? "#3B82F680" : isSelected ? "#22C55E" : color,
            stroke: isSelected ? "#fff" : "#fff",
            strokeWidth: isSelected ? 3 : 2,
            selectable: currentTool === "select",
            opacity: isBeingRepositioned ? 0.5 : 1,
          }) as FabricObjectWithData;
          marker.data = {
            isMeasurement: true,
            measurementId: measurement.id,
            pointIndex: idx,
          };

          // Label — numbered 1, 2, 3... within this count group
          const label = new fabric.FabricText(String(idx + 1), {
            left: point.x,
            top: point.y,
            fontSize: drawingStyle.fontSize,
            fill: "#fff",
            fontWeight: "bold",
            originX: "center",
            originY: "center",
            selectable: false,
          }) as FabricObjectWithData;
          label.data = { isMeasurement: true, measurementId: measurement.id, pointIndex: idx };

          canvas.add(marker);
          canvas.add(label);
        });
        break;
      }

      case "polygon": {
        // Area/perimeter measurement
        const polygon = new fabric.Polygon(scaledPoints, {
          fill: isSelected ? "#22C55E44" : `${color}33`,
          stroke: effectiveColor,
          strokeWidth,
          selectable: currentTool === "select",
        }) as FabricObjectWithData;
        polygon.data = { isMeasurement: true, measurementId: measurement.id };
        canvas.add(polygon);

        // Value label at centroid
        const centroid = calculateCentroid(scaledPoints);
        const valueLabel = new fabric.FabricText(formatted_value, {
          left: centroid.x,
          top: centroid.y,
          fontSize: drawingStyle.fontSize,
          fill: effectiveColor,
          fontWeight: "bold",
          backgroundColor: isSelected ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.8)",
          originX: "center",
          originY: "center",
          selectable: false,
        }) as FabricObjectWithData;
        valueLabel.data = { isMeasurement: true, measurementId: measurement.id };
        canvas.add(valueLabel);

        // Vertex handles — visible when selected, clickable to reposition
        if (isSelected && currentTool === "select") {
          scaledPoints.forEach((pt, idx) => {
            const isBeingRepositioned = repositioning?.measurementId === measurement.id && repositioning?.pointIndex === idx;
            const handle = new fabric.Circle({
              left: pt.x - 6,
              top: pt.y - 6,
              radius: 6,
              fill: isBeingRepositioned ? "#3B82F680" : "#fff",
              stroke: isBeingRepositioned ? "#3B82F6" : "#22C55E",
              strokeWidth: 2,
              strokeDashArray: isBeingRepositioned ? [3, 2] : undefined,
              opacity: isBeingRepositioned ? 0.5 : 1,
              selectable: true,
              hasControls: false,
              hasBorders: false,
            }) as FabricObjectWithData;
            handle.data = { isMeasurement: true, measurementId: measurement.id, pointIndex: idx };
            canvas.add(handle);
          });
        }
        break;
      }

      case "polyline": {
        // Linear measurement
        const line = new fabric.Polyline(scaledPoints, {
          fill: "transparent",
          stroke: effectiveColor,
          strokeWidth,
          selectable: currentTool === "select",
        }) as FabricObjectWithData;
        line.data = { isMeasurement: true, measurementId: measurement.id };
        canvas.add(line);

        // Value label at midpoint
        const midIdx = Math.floor(scaledPoints.length / 2);
        const midpoint = scaledPoints[midIdx] || scaledPoints[0];
        const valueLabel = new fabric.FabricText(formatted_value, {
          left: midpoint.x,
          top: midpoint.y - 20,
          fontSize: drawingStyle.fontSize,
          fill: effectiveColor,
          fontWeight: "bold",
          backgroundColor: isSelected ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.8)",
          originX: "center",
          selectable: false,
        }) as FabricObjectWithData;
        valueLabel.data = { isMeasurement: true, measurementId: measurement.id };
        canvas.add(valueLabel);

        // Vertex handles — visible when selected, clickable to reposition
        if (isSelected && currentTool === "select") {
          scaledPoints.forEach((pt, idx) => {
            const isBeingRepositioned = repositioning?.measurementId === measurement.id && repositioning?.pointIndex === idx;
            const handle = new fabric.Circle({
              left: pt.x - 6,
              top: pt.y - 6,
              radius: 6,
              fill: isBeingRepositioned ? "#3B82F680" : "#fff",
              stroke: isBeingRepositioned ? "#3B82F6" : "#22C55E",
              strokeWidth: 2,
              strokeDashArray: isBeingRepositioned ? [3, 2] : undefined,
              opacity: isBeingRepositioned ? 0.5 : 1,
              selectable: true,
              hasControls: false,
              hasBorders: false,
            }) as FabricObjectWithData;
            handle.data = { isMeasurement: true, measurementId: measurement.id, pointIndex: idx };
            canvas.add(handle);
          });
        }
        break;
      }
    }
  };

  // =============================================================================
  // Render Calibration Line
  // =============================================================================

  const renderCalibrationLine = (canvas: fabric.Canvas, scale: PageScale) => {
    if (!scale.calibration_line) return;

    const { x1, y1, x2, y2 } = scale.calibration_line;
    const scaledLine = [
      { x: x1 * zoom, y: y1 * zoom },
      { x: x2 * zoom, y: y2 * zoom },
    ];

    // Dashed calibration line
    const line = new fabric.Line(
      [scaledLine[0].x, scaledLine[0].y, scaledLine[1].x, scaledLine[1].y],
      {
        stroke: "#F59E0B",  // Amber
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: false,
      }
    ) as FabricObjectWithData;
    line.data = { isMeasurement: true, isCalibration: true };

    // Label - offset perpendicular to line so original PDF text stays visible
    const midX = (scaledLine[0].x + scaledLine[1].x) / 2;
    const midY = (scaledLine[0].y + scaledLine[1].y) / 2;
    const dx = scaledLine[1].x - scaledLine[0].x;
    const dy = scaledLine[1].y - scaledLine[0].y;
    const lineLen = Math.sqrt(dx * dx + dy * dy);
    // Perpendicular unit vector (rotated 90° CCW), offset 35px above the line
    const offsetDist = 35;
    const perpX = lineLen > 0 ? (-dy / lineLen) * offsetDist : 0;
    const perpY = lineLen > 0 ? (dx / lineLen) * offsetDist : -offsetDist;
    const labelX = midX + perpX;
    const labelY = midY + perpY;

    // Thin connector line from label to line midpoint
    const connector = new fabric.Line(
      [midX, midY, labelX, labelY],
      {
        stroke: "#F59E0B",
        strokeWidth: 1,
        strokeDashArray: [2, 2],
        selectable: false,
      }
    ) as FabricObjectWithData;
    connector.data = { isMeasurement: true, isCalibration: true };

    const refMm = Number(scale.reference_length_mm);
    const sf = Number(scale.scale_factor);
    const labelStr = `${Math.round(refMm).toLocaleString()} mm (${sf.toFixed(2)} mm/px)`;
    // Rotate label to follow line direction (keep text readable)
    let labelAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (labelAngle > 90) labelAngle -= 180;
    if (labelAngle < -90) labelAngle += 180;

    const label = new fabric.FabricText(labelStr, {
      left: labelX,
      top: labelY - 8,
      fontSize: 12,
      fill: "#F59E0B",
      backgroundColor: "rgba(255,255,255,0.9)",
      originX: "center",
      originY: "bottom",
      angle: labelAngle,
      selectable: false,
      evented: true,  // Receive clicks even though not selectable
      hoverCursor: "pointer",
    }) as FabricObjectWithData;
    label.data = { isMeasurement: true, isCalibration: true, isCalibrationLabel: true };

    // Click on label → re-edit the calibration value
    label.on("mousedown", () => {
      if (scale.calibration_line) {
        const { x1, y1, x2, y2 } = scale.calibration_line;
        setCalibrationLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
        setCalibrationInput(String(scale.reference_length_mm));
        setCalibrationStep("waitingInput");
        setTimeout(() => {
          calibrationInputRef.current?.focus();
          calibrationInputRef.current?.select();
        }, 50);
      }
    });

    canvas.add(line);
    canvas.add(connector);
    canvas.add(label);
  };

  // =============================================================================
  // Event Handlers Setup
  // =============================================================================

  const setupEventHandlers = (canvas: fabric.Canvas) => {
    // Use wrapper functions that delegate to refs - this ensures the canvas
    // always calls the latest handler even when dependencies change
    canvas.on("mouse:down", (e: fabric.TPointerEventInfo) => handlersRef.current.mouseDown(e));
    canvas.on("mouse:move", (e: fabric.TPointerEventInfo) => handlersRef.current.mouseMove(e));
    canvas.on("mouse:up", (e: fabric.TPointerEventInfo) => handlersRef.current.mouseUp(e));
    canvas.on("mouse:dblclick", () => handlersRef.current.doubleClick());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on("selection:created", ((e: SelectionEvent) => handlersRef.current.selectionCreated(e)) as any);
    canvas.on("selection:cleared", () => handlersRef.current.selectionCleared());
  };

  // =============================================================================
  // Mouse Handlers
  // =============================================================================

  // Shared point-placement logic — called by both canvas mousedown and magnifier candidate click.
  // The SnapMagnifier's candidate buttons sit on top of the Fabric canvas and intercept clicks,
  // so we need this shared path to ensure points are placed regardless of which element receives the click.
  // ⚠️ DO NOT ADD calibrationLine/calibrationStep/pageScale to deps — use refs instead.
  // During "firstPoint" phase, handleMouseMove calls setCalibrationLine() on every frame,
  // which would recreate this callback constantly and cause stale closure bugs.
  const placeToolPoint = useCallback((point: Point, rawPoint?: Point) => {
    const calStep = calibrationStepRef.current;
    const calLine = calibrationLineRef.current;
    const pScale = pageScaleRef.current;

    switch (currentTool) {
      case "calibrate": {
        if (calStep === "waitingInput" || calStep === "verifying") return;
        if (!calLine) {
          setCalibrationLine({ start: point, end: point });
          setCalibrationStep("firstPoint");
          setIsDrawing(true);
        } else {
          const updatedLine = { ...calLine, end: point };
          setCalibrationLine(updatedLine);
          setIsDrawing(false);
          if (pScale?.calibrated && pScale.scale_factor) {
            setCalibrationStep("verifying");
          } else {
            setCalibrationStep("waitingInput");
            setCalibrationInput("");
            setTimeout(() => calibrationInputRef.current?.focus(), 100);
          }
        }
        break;
      }
      case "count":
        handleCountClick(point);
        break;
      case "area":
      case "linear":
      case "perimeter":
      case "deduction": {
        const pts = currentPointsRef.current;
        const isPolygonTool = currentTool === "area" || currentTool === "perimeter" || currentTool === "deduction";

        // Auto-close polygon: if 3+ points placed and clicking near the first point, complete the shape
        // Use raw (pre-snap) cursor position so snapping to a nearby PDF edge doesn't false-trigger close
        if (isPolygonTool && pts.length >= 3) {
          const firstPt = pts[0];
          const checkPt = rawPoint || point;
          const dx = (checkPt.x - firstPt.x) * zoomRef.current;
          const dy = (checkPt.y - firstPt.y) * zoomRef.current;
          const screenDist = Math.sqrt(dx * dx + dy * dy);
          if (screenDist < 25) {
            completeDrawingRef.current();
            break;
          }
        }

        setIsDrawing(true);
        setCurrentPoints((prev) => [...prev, point]);
        break;
      }
    }
  }, [currentTool]);

  const handleMouseDown = useCallback((e: fabric.TPointerEventInfo) => {
    const canvas = fabricRef.current;
    if (!canvas || !e.pointer) return;

    // Don't process tool actions during panning (space+drag, middle-click, or pan tool)
    if (isPanningProp || isSpaceHeldProp || currentTool === "pan") return;

    const rawPoint = { x: e.pointer.x / zoom, y: e.pointer.y / zoom };

    // ── Reposition mode: click to place the picked-up point at cursor (with snap) ──
    const repo = repositioningRef.current;
    if (repo) {
      const nativeEvt = e.e as PointerEvent;
      const altHeld = nativeEvt?.altKey ?? false;
      const currentSnap = snapResultRef.current;
      const placePt = !altHeld && currentSnap?.isSnapped
        ? currentSnap.snapped
        : !altHeld ? findSnapPoint(rawPoint.x, rawPoint.y).snapped : rawPoint;
      onMovePointRef.current(repo.measurementId, repo.pointIndex, placePt);
      setRepositioning(null);
      setRepositionPreview(null);
      return;  // Consumed the click
    }

    // ── Select mode: click a vertex handle or count marker to reposition it ──
    if (currentTool === "select") {
      const target = e.target as FabricObjectWithData | undefined;
      if (target?.data?.isMeasurement && target.data.pointIndex != null && target.data.measurementId) {
        // Only reposition vertices of the currently selected measurement
        const selMeasurement = measurements.find(m => m.id === target.data!.measurementId);
        if (selMeasurement && selMeasurement.id === selectedMeasurement?.id && selMeasurement.geometry_data?.points) {
          const pts = selMeasurement.geometry_data.points;
          const origPt = pts[target.data.pointIndex];
          if (origPt) {
            setRepositioning({
              measurementId: target.data.measurementId,
              pointIndex: target.data.pointIndex,
              originalPoint: origPt,
            });
            return;  // Don't trigger selection/pan — enter reposition mode
          }
        }
      }
    }

    // Select mode drag on empty area:
    //   Left-click drag = pan the PDF
    //   Right-click drag = zoom-to-rect (draws overlay rectangle)
    if (currentTool === "select" && !e.target) {
      const nativeEvent = e.e as PointerEvent;
      if (nativeEvent?.button === 2) {
        // Right-click drag → zoom-to-rect
        zoomDragStartRef.current = rawPoint;
        panDragRef.current = null;
      } else if (nativeEvent?.button === 0) {
        // Left-click drag → pan
        zoomDragStartRef.current = null;
        panDragRef.current = {
          clientX: nativeEvent.clientX,
          clientY: nativeEvent.clientY,
          scrollLeft: containerRef?.current?.scrollLeft ?? 0,
          scrollTop: containerRef?.current?.scrollTop ?? 0,
        };
      }
    } else {
      zoomDragStartRef.current = null;
      panDragRef.current = null;
    }

    // Apply snapping for measurement tools (hold Alt to bypass snap)
    // Use the existing snapResult (via ref to avoid stale closure) which reflects
    // magnifier candidate selection — this preserves the user's magnifier choice.
    const nativeEvt = e.e as PointerEvent;
    const altHeld = nativeEvt?.altKey ?? false;
    const shouldSnap = !altHeld && ["count", "area", "linear", "perimeter", "deduction", "calibrate"].includes(currentTool);
    const currentSnap = snapResultRef.current;
    const point = shouldSnap && currentSnap?.isSnapped
      ? currentSnap.snapped
      : shouldSnap ? findSnapPoint(rawPoint.x, rawPoint.y).snapped : rawPoint;

    // If clicked on the calibration label, the label's own mousedown handler
    // will open the re-edit input — don't start a new calibration line
    if (currentTool === "calibrate") {
      const target = e.target as FabricObjectWithData | undefined;
      if (target?.data?.isCalibrationLabel) return;
    }

    placeToolPoint(point, rawPoint);
  }, [currentTool, zoom, findSnapPoint, placeToolPoint, isPanningProp, isSpaceHeldProp, measurements, selectedMeasurement]);

  const handleMouseMove = useCallback((e: fabric.TPointerEventInfo) => {
    if (!e.pointer) return;

    // Left-click pan: scroll the container using screen-space delta
    if (panDragRef.current && containerRef?.current) {
      const nativeEvent = e.e as PointerEvent;
      containerRef.current.scrollLeft = panDragRef.current.scrollLeft - (nativeEvent.clientX - panDragRef.current.clientX);
      containerRef.current.scrollTop = panDragRef.current.scrollTop - (nativeEvent.clientY - panDragRef.current.clientY);
      return;  // Skip all other processing during pan
    }

    // Shift+drag zoom-to-rect: update overlay rectangle (canvas-space coords for display)
    if (zoomDragStartRef.current && e.pointer) {
      const start = zoomDragStartRef.current;
      const end = { x: e.pointer.x / zoom, y: e.pointer.y / zoom };
      setZoomRect({
        x: Math.min(start.x, end.x) * zoom,
        y: Math.min(start.y, end.y) * zoom,
        w: Math.abs(end.x - start.x) * zoom,
        h: Math.abs(end.y - start.y) * zoom,
      });
      return;
    }

    const rawPoint = { x: e.pointer.x / zoom, y: e.pointer.y / zoom };

    // Reposition preview: track cursor so ghost marker follows mouse
    if (repositioningRef.current) {
      setRepositionPreview(rawPoint);
    }

    // Always check for snap points when using measurement tools OR repositioning (for visual feedback)
    // Hold Alt to temporarily suppress snapping
    const moveNativeEvt = e.e as PointerEvent;
    const altHeldMove = moveNativeEvt?.altKey ?? false;
    const isRepositioning = !!repositioningRef.current;
    const shouldSnap = !altHeldMove && (
      isRepositioning || ["count", "area", "linear", "perimeter", "deduction", "calibrate"].includes(currentTool)
    );
    if (shouldSnap) {
      const snap = findSnapPoint(rawPoint.x, rawPoint.y);
      setCursorPoint(rawPoint);
      setSnapResult(snap);
      // Update ghost preview to snapped position when repositioning
      if (isRepositioning && snap.isSnapped) {
        setRepositionPreview(snap.snapped);
      }
    } else {
      setCursorPoint(null);
      setSnapResult(null);
    }

    // Only update drawing if actively drawing
    if (!isDrawing) return;

    const point = shouldSnap && snapResult?.isSnapped ? snapResult.snapped : rawPoint;

    if (currentTool === "calibrate" && calibrationLine && calibrationStep === "firstPoint") {
      // Preview line from first click to cursor — useEffect handles renderTempCalibrationLine
      setCalibrationLine({ ...calibrationLine, end: point });
    } else if (
      (currentTool === "area" || currentTool === "linear" ||
       currentTool === "perimeter" || currentTool === "deduction") &&
      currentPoints.length > 0
    ) {
      // Render live preview while drawing polygon/polyline
      // Pass raw point too so close-indicator uses pre-snap position
      renderTempDrawing(point, rawPoint);
    }
  }, [isDrawing, currentTool, calibrationLine, calibrationStep, zoom, currentPoints, activeLayer, findSnapPoint, snapResult]);

  const handleMouseUp = useCallback((e: fabric.TPointerEventInfo) => {
    // End left-click pan
    if (panDragRef.current) {
      panDragRef.current = null;
      return;
    }

    // Shift+drag zoom-to-rect: zoom to the drawn rectangle
    if (currentTool === "select" && zoomDragStartRef.current && e.pointer && onZoomToRectRef.current) {
      const endPoint = { x: e.pointer.x / zoom, y: e.pointer.y / zoom };
      const start = zoomDragStartRef.current;
      const dx = endPoint.x - start.x;
      const dy = endPoint.y - start.y;

      // Only zoom if drag was significant (>20px in page space)
      if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
        onZoomToRectRef.current({
          x: Math.min(start.x, endPoint.x),
          y: Math.min(start.y, endPoint.y),
          width: Math.abs(dx),
          height: Math.abs(dy),
        });
      }

      zoomDragStartRef.current = null;
      setZoomRect(null);
    }
  }, [currentTool, zoom]);

  const handleDoubleClick = useCallback(() => {
    if (!isDrawing) return;

    // Complete polygon/polyline on double-click
    if (currentPoints.length >= 2) {
      completeDrawing();
    }
  }, [isDrawing, currentPoints]);

  // =============================================================================
  // Selection Handlers
  // =============================================================================

  const handleSelectionCreated = useCallback((e: SelectionEvent) => {
    const selected = e.selected?.[0];
    const measurementId = selected?.data?.measurementId;
    if (measurementId) {
      const measurement = measurements.find((m) => m.id === measurementId);
      if (measurement) {
        onMeasurementSelect(measurement);
      }
    }
  }, [measurements, onMeasurementSelect]);

  const handleSelectionCleared = useCallback(() => {
    // Don't deselect during re-render — removing Fabric objects fires this event
    if (isReRenderingRef.current) return;
    onMeasurementSelect(null);
  }, [onMeasurementSelect]);

  // Keep handler refs in sync so canvas event wrappers always call latest
  handlersRef.current = {
    mouseDown: handleMouseDown,
    mouseMove: handleMouseMove,
    mouseUp: handleMouseUp,
    doubleClick: handleDoubleClick,
    selectionCreated: handleSelectionCreated,
    selectionCleared: handleSelectionCleared,
  };

  // =============================================================================
  // Count Tool
  // =============================================================================

  // Track active count measurement — clicks accumulate into one measurement
  const activeCountIdRef = useRef<number | null>(null);

  // Reset active count when tool changes away from count
  useEffect(() => {
    if (currentTool !== "count") {
      activeCountIdRef.current = null;
    }
    // Cancel any active repositioning when tool changes
    setRepositioning(null);
    setRepositionPreview(null);
  }, [currentTool]);

  const handleCountClick = async (point: Point) => {
    if (activeCountIdRef.current) {
      // Add point to existing count measurement
      const updated = await onCountPointAdd(activeCountIdRef.current, point);
      if (updated) {
        setNextCountLabel((prev) => prev + 1);
      }
    } else {
      // First click — create new count measurement
      const geometryData: GeometryData = {
        type: "point",
        points: [point],
        canvasWidth: pageWidth,
        canvasHeight: pageHeight,
      };

      const created = await onMeasurementCreate("count", geometryData, 1, pageNumber);
      if (created) {
        activeCountIdRef.current = created.id;
        setNextCountLabel(2);
      }
    }
  };

  // =============================================================================
  // Complete Drawing (Polygon/Polyline)
  // =============================================================================

  const completeDrawing = async () => {
    if (currentPoints.length < 2) {
      setCurrentPoints([]);
      setIsDrawing(false);
      return;
    }

    const isPolygon = currentTool === "area" || currentTool === "perimeter" || currentTool === "deduction";
    const geometryData: GeometryData = {
      type: isPolygon ? "polygon" : "polyline",
      points: currentPoints,
      canvasWidth: pageWidth,
      canvasHeight: pageHeight,
    };

    // Calculate pixel value
    let pixelValue = 0;
    if (isPolygon) {
      pixelValue = calculatePolygonArea(currentPoints);
    } else {
      pixelValue = calculatePolylineLength(currentPoints);
    }

    // Perimeter tool draws a closed polygon and calculates area (m²), same as area tool
    const measurementType = currentTool === "area" || currentTool === "perimeter" || currentTool === "deduction"
      ? "area"
      : "length";

    // Pass deduction flag if using deduction tool
    const options: MeasurementCreateOptions | undefined = currentTool === "deduction"
      ? { isDeduction: true }
      : undefined;

    await onMeasurementCreate(measurementType, geometryData, pixelValue, pageNumber, options);

    // Reset drawing state
    setCurrentPoints([]);
    setIsDrawing(false);
    clearTempDrawing();
  };
  completeDrawingRef.current = completeDrawing;

  // =============================================================================
  // Calibration
  // =============================================================================

  const renderTempCalibrationLine = () => {
    const canvas = fabricRef.current;
    if (!canvas || !calibrationLine) return;

    // Remove existing temp objects
    const tempObjects = (canvas.getObjects() as FabricObjectWithData[]).filter(
      (obj) => obj.data?.isTempCalibration
    );
    tempObjects.forEach((obj) => canvas.remove(obj));

    const sx = calibrationLine.start.x * zoom;
    const sy = calibrationLine.start.y * zoom;
    const ex = calibrationLine.end.x * zoom;
    const ey = calibrationLine.end.y * zoom;

    // Draw new temp line (green when verifying, amber when calibrating)
    const isVerifyMode = pageScale?.calibrated && pageScale.scale_factor;
    const lineColor = isVerifyMode ? "#16A34A" : "#F59E0B";
    const line = new fabric.Line([sx, sy, ex, ey], {
      stroke: lineColor,
      strokeWidth: 3,
      strokeDashArray: [10, 5],
      selectable: false,
      evented: false,  // Don't intercept canvas clicks — purely visual
    }) as FabricObjectWithData;
    line.data = { isTempCalibration: true };
    canvas.add(line);

    // Show pixel distance label offset above the line
    // Skip when verification popup is visible (it already shows the computed distance)
    const dx = ex - sx;
    const dy = ey - sy;
    const pxDist = Math.sqrt(dx * dx + dy * dy);
    if (pxDist > 10 && calibrationStep !== "verifying") {
      const midX = (sx + ex) / 2;
      const midY = (sy + ey) / 2;
      const lineLen = pxDist;
      const offsetDist = 30;
      const perpX = (-dy / lineLen) * offsetDist;
      const perpY = (dx / lineLen) * offsetDist;
      const labelX = midX + perpX;
      const labelY = midY + perpY;

      const connector = new fabric.Line([midX, midY, labelX, labelY], {
        stroke: lineColor,
        strokeWidth: 1,
        strokeDashArray: [2, 2],
        selectable: false,
        evented: false,
      }) as FabricObjectWithData;
      connector.data = { isTempCalibration: true };
      canvas.add(connector);

      // Show computed mm when calibrated, otherwise just px
      let labelText = `${Math.round(pxDist)} px`;
      if (pageScale?.calibrated && pageScale.scale_factor) {
        const pxDistUnscaled = Math.sqrt(
          Math.pow(calibrationLine.end.x - calibrationLine.start.x, 2) +
          Math.pow(calibrationLine.end.y - calibrationLine.start.y, 2)
        );
        const computedMm = pxDistUnscaled * pageScale.scale_factor;
        labelText = `${Math.round(computedMm).toLocaleString()} mm (${Number(pageScale.scale_factor).toFixed(2)} mm/px)`;
      }

      // Rotate label to follow the line direction
      let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
      // Keep text readable: flip if it would be upside-down
      if (angleDeg > 90) angleDeg -= 180;
      if (angleDeg < -90) angleDeg += 180;

      const label = new fabric.FabricText(labelText, {
        left: labelX,
        top: labelY - 6,
        fontSize: 11,
        fill: pageScale?.calibrated ? "#16A34A" : "#F59E0B",
        backgroundColor: "rgba(255,255,255,0.85)",
        originX: "center",
        originY: "bottom",
        angle: angleDeg,
        selectable: false,
        evented: false,  // Don't intercept canvas clicks
      }) as FabricObjectWithData;
      label.data = { isTempCalibration: true };
      canvas.add(label);
    }

    canvas.renderAll();
  };

  // Render temporary polygon/polyline while drawing (live preview)
  const renderTempDrawing = (cursorPoint: Point, rawCursorPoint?: Point) => {
    const canvas = fabricRef.current;
    if (!canvas || currentPoints.length === 0) return;

    // Remove existing temp drawing objects
    const toRemove = (canvas.getObjects() as FabricObjectWithData[]).filter(
      (obj) => obj.data?.isTempDrawing
    );
    toRemove.forEach((obj) => canvas.remove(obj));

    const isPolygon = currentTool === "area" || currentTool === "perimeter" || currentTool === "deduction";
    const color = activeLayer?.color || drawingStyle.strokeColor;

    // Check if cursor is near the first point BEFORE building the polygon
    // so we can snap the preview closed when near
    const checkPoint = rawCursorPoint || cursorPoint;
    const closeDistScreen = isPolygon && currentPoints.length >= 3 ? (() => {
      const first = currentPoints[0];
      const dx = (checkPoint.x - first.x) * zoom;
      const dy = (checkPoint.y - first.y) * zoom;
      return Math.sqrt(dx * dx + dy * dy);
    })() : null;
    // Visual indicator at 40px screen distance (close check uses 25px with raw cursor)
    const isNearFirstPoint = closeDistScreen !== null && closeDistScreen < 40;

    // Build points array — when near first point, snap cursor to first point for clean close preview
    const effectiveCursor = isNearFirstPoint ? currentPoints[0] : cursorPoint;
    const allPoints = [...currentPoints, effectiveCursor];
    const scaledPoints = allPoints.map((p) => ({
      x: p.x * zoom,
      y: p.y * zoom,
    }));

    if (isPolygon) {
      // Draw polygon preview — solid stroke when snapped-to-close, dashed otherwise
      const polygon = new fabric.Polygon(scaledPoints, {
        fill: isNearFirstPoint ? `${color}33` : `${color}22`,
        stroke: color,
        strokeWidth: isNearFirstPoint ? 3 : 2,
        strokeDashArray: isNearFirstPoint ? undefined : [5, 5],
        selectable: false,
      }) as FabricObjectWithData;
      polygon.data = { isTempDrawing: true };
      canvas.add(polygon);

      // Calculate and show preview area
      if (allPoints.length >= 3) {
        const pixelArea = calculatePolygonArea(allPoints);
        const centroid = calculateCentroid(scaledPoints);

        // Convert to real-world units if calibrated
        let areaText = `${pixelArea.toFixed(0)} px²`;
        if (pageScale?.calibrated && pageScale.scale_factor) {
          // scale_factor is mm per pixel, so mm² per pixel² = scale_factor²
          const m2 = pixelArea * Math.pow(pageScale.scale_factor / 1000, 2);
          areaText = `${m2.toFixed(2)} m²`;
        }

        const label = new fabric.FabricText(areaText, {
          left: centroid.x,
          top: centroid.y,
          fontSize: drawingStyle.fontSize,
          fill: color,
          fontWeight: "bold",
          backgroundColor: "rgba(255,255,255,0.9)",
          originX: "center",
          originY: "center",
          selectable: false,
        }) as FabricObjectWithData;
        label.data = { isTempDrawing: true };
        canvas.add(label);
      }
    } else {
      // Draw polyline preview
      const polyline = new fabric.Polyline(scaledPoints, {
        fill: "transparent",
        stroke: color,
        strokeWidth: 2,
        strokeDashArray: [5, 5],  // Dashed to show it's not final
        selectable: false,
      }) as FabricObjectWithData;
      polyline.data = { isTempDrawing: true };
      canvas.add(polyline);

      // Calculate and show preview length
      const pixelLength = calculatePolylineLength(allPoints);

      // Convert to real-world units if calibrated
      let lengthText = `${pixelLength.toFixed(0)} px`;
      if (pageScale?.calibrated && pageScale.scale_factor) {
        // scale_factor is mm per pixel
        const meters = (pixelLength * pageScale.scale_factor) / 1000;
        lengthText = `${meters.toFixed(2)} m`;
      }

      // Place label at midpoint of the line
      const midIdx = Math.floor(scaledPoints.length / 2);
      const midpoint = scaledPoints[midIdx] || scaledPoints[0];
      const label = new fabric.FabricText(lengthText, {
        left: midpoint.x,
        top: midpoint.y - 20,
        fontSize: drawingStyle.fontSize,
        fill: color,
        fontWeight: "bold",
        backgroundColor: "rgba(255,255,255,0.9)",
        originX: "center",
        selectable: false,
      }) as FabricObjectWithData;
      label.data = { isTempDrawing: true };
      canvas.add(label);

      // Hint: show "Double-click to finish" near cursor when 2+ points placed
      if (currentPoints.length >= 2) {
        const lastPt = scaledPoints[scaledPoints.length - 1];
        const hint = new fabric.FabricText("Double-click to finish", {
          left: lastPt.x + 15,
          top: lastPt.y + 10,
          fontSize: 11,
          fill: "#6B7280",
          backgroundColor: "rgba(255,255,255,0.85)",
          selectable: false,
        }) as FabricObjectWithData;
        hint.data = { isTempDrawing: true };
        canvas.add(hint);
      }
    }

    // Draw markers at each point
    scaledPoints.forEach((p, i) => {
      // Skip the first point marker — we draw it separately with close indicator logic
      if (i === 0) return;
      const marker = new fabric.Circle({
        left: p.x - 5,
        top: p.y - 5,
        radius: 5,
        fill: color,
        stroke: color,
        strokeWidth: 2,
        selectable: false,
      }) as FabricObjectWithData;
      marker.data = { isTempDrawing: true };
      canvas.add(marker);
    });

    // Draw first-point marker with close indicator when cursor is near
    if (scaledPoints.length > 0) {
      const fp = scaledPoints[0];
      if (isNearFirstPoint) {
        // Large outer glow ring to signal "click to close"
        const glow = new fabric.Circle({
          left: fp.x - 22,
          top: fp.y - 22,
          radius: 22,
          fill: `${color}33`,
          stroke: color,
          strokeWidth: 3,
          strokeDashArray: [4, 4],
          selectable: false,
        }) as FabricObjectWithData;
        glow.data = { isTempDrawing: true };
        canvas.add(glow);

        // "Click to close" label with background for contrast
        const closeLabel = new fabric.FabricText("Click to close", {
          left: fp.x + 26,
          top: fp.y - 10,
          fontSize: 13,
          fill: "#fff",
          fontWeight: "bold",
          backgroundColor: color,
          padding: 4,
          selectable: false,
        }) as FabricObjectWithData;
        closeLabel.data = { isTempDrawing: true };
        canvas.add(closeLabel);
      }
      const firstMarker = new fabric.Circle({
        left: fp.x - (isNearFirstPoint ? 8 : 5),
        top: fp.y - (isNearFirstPoint ? 8 : 5),
        radius: isNearFirstPoint ? 8 : 5,
        fill: isNearFirstPoint ? `${color}44` : "#fff",
        stroke: color,
        strokeWidth: isNearFirstPoint ? 3 : 2,
        selectable: false,
      }) as FabricObjectWithData;
      firstMarker.data = { isTempDrawing: true };
      canvas.add(firstMarker);
    }

    canvas.renderAll();
  };

  const handleCalibrationSubmit = () => {
    if (!calibrationLine) return;

    const lengthMm = parseFloat(calibrationInput);
    if (isNaN(lengthMm) || lengthMm <= 0) return;

    // Submit calibration
    onCalibrate({
      lineStart: calibrationLine.start,
      lineEnd: calibrationLine.end,
      referenceLengthMm: lengthMm,
      canvasWidth: pageWidth,
      canvasHeight: pageHeight,
    });

    // Reset
    setCalibrationLine(null);
    setCalibrationStep("idle");
    setCalibrationInput("");
    clearTempDrawing();
  };

  const handleCalibrationCancel = () => {
    setCalibrationLine(null);
    setCalibrationStep("idle");
    setCalibrationInput("");
    setIsDrawing(false);
    clearTempDrawing();
  };

  // Handle magnifier candidate selection — overrides the PDF snap lock
  // Handles calibration point placement directly (not via placeToolPoint) to avoid
  // stale closure / guard issues when the magnifier button intercepts the click.
  const handleMagnifierSelect = useCallback((candidate: { x: number; y: number }) => {
    overridePdfSnap(candidate);
    setSnapResult(prev => prev ? {
      ...prev,
      snapped: candidate,
    } : null);

    // Place the point — the magnifier button intercepted the click that
    // was meant for the Fabric canvas, so we execute the placement here.
    // For calibrate tool, handle inline to avoid guard/ref timing issues.
    if (currentTool === "calibrate") {
      const calStep = calibrationStepRef.current;
      const calLine = calibrationLineRef.current;
      const pScale = pageScaleRef.current;
      if (calStep === "waitingInput" || calStep === "verifying") return;
      if (!calLine) {
        setCalibrationLine({ start: candidate, end: candidate });
        setCalibrationStep("firstPoint");
        setIsDrawing(true);
      } else {
        setCalibrationLine({ ...calLine, end: candidate });
        setIsDrawing(false);
        if (pScale?.calibrated && pScale.scale_factor) {
          setCalibrationStep("verifying");
        } else {
          setCalibrationStep("waitingInput");
          setCalibrationInput("");
          setTimeout(() => calibrationInputRef.current?.focus(), 100);
        }
      }
    } else {
      placeToolPoint(candidate);
    }
  }, [overridePdfSnap, currentTool, placeToolPoint]);

  // Preview handler for magnifier drag — updates snap/line position without finalizing
  const handleMagnifierPreview = useCallback((candidate: { x: number; y: number }) => {
    overridePdfSnap(candidate);
    setSnapResult(prev => prev ? { ...prev, snapped: candidate } : null);
    // During calibrate firstPoint, update the line endpoint live
    if (currentTool === "calibrate" && calibrationStepRef.current === "firstPoint") {
      setCalibrationLine(prev => prev ? { ...prev, end: candidate } : null);
    }
  }, [overridePdfSnap, currentTool]);

  // =============================================================================
  // Helpers
  // =============================================================================

  const clearTempDrawing = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const toRemove = (canvas.getObjects() as FabricObjectWithData[]).filter(
      (obj) => obj.data?.isTempCalibration || obj.data?.isTempDrawing
    );
    toRemove.forEach((obj) => canvas.remove(obj));
    canvas.renderAll();
  };

  const calculateCentroid = (points: Point[]): Point => {
    const n = points.length;
    const sum = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    return { x: sum.x / n, y: sum.y / n };
  };

  const calculatePolygonArea = (points: Point[]): number => {
    // Shoelace formula for polygon area
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  };

  const calculatePolylineLength = (points: Point[]): number => {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  };

  // =============================================================================
  // Keyboard Handlers
  // =============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle when typing in an input (calibration input handles its own keys)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        // Cancel reposition mode
        setRepositioning(null);
        setRepositionPreview(null);
        // Cancel current drawing / calibration
        setCurrentPoints([]);
        setIsDrawing(false);
        setCalibrationLine(null);
        setCalibrationStep("idle");
        setCalibrationInput("");
        clearTempDrawing();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // If repositioning a count point, delete just that point (not the whole measurement)
        const repo = repositioningRef.current;
        if (repo) {
          e.preventDefault();
          onRemovePointRef.current(repo.measurementId, repo.pointIndex);
          setRepositioning(null);
          setRepositionPreview(null);
          return;
        }
        // Otherwise delete the entire selected measurement
        if (selectedMeasurement) {
          onMeasurementDelete(selectedMeasurement.id);
        }
      } else if (e.key === "Enter" && isDrawing) {
        // Complete drawing
        completeDrawing();
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        setSnapResult(prev => {
          if (!prev?.isSnapped || prev.snapType !== "pdf-edge") return prev;
          e.preventDefault(); // Don't scroll the page

          if (e.shiftKey) {
            // Shift + Arrow = nudge snap point 1px for fine positioning
            const step = 0.5;
            let dx = 0, dy = 0;
            if (e.key === "ArrowLeft") dx = -step;
            if (e.key === "ArrowRight") dx = step;
            if (e.key === "ArrowUp") dy = -step;
            if (e.key === "ArrowDown") dy = step;
            const nudged = { x: prev.snapped.x + dx, y: prev.snapped.y + dy };
            overridePdfSnap(nudged);
            return { ...prev, snapped: nudged };
          }

          // Plain Arrow = cycle between candidates
          if (!prev.pdfCandidates || prev.pdfCandidates.length < 2) return prev;
          const candidates = prev.pdfCandidates;
          const currentIdx = candidates.findIndex(c => c.x === prev.snapped.x && c.y === prev.snapped.y);
          let nextIdx: number;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            nextIdx = (currentIdx + 1) % candidates.length;
          } else {
            nextIdx = (currentIdx - 1 + candidates.length) % candidates.length;
          }
          const next = candidates[nextIdx];
          overridePdfSnap(next);
          return { ...prev, snapped: next };
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMeasurement, isDrawing, currentPoints, overridePdfSnap]);

  // =============================================================================
  // Fabric.js cursor sync with usePdfPanZoom hook
  // =============================================================================

  // When hook reports pan state changes, update Fabric.js cursor accordingly
  useEffect(() => {
    if (!fabricRef.current) return;
    if (isPanningProp) {
      fabricRef.current.defaultCursor = "grabbing";
      fabricRef.current.hoverCursor = "grabbing";
    } else if (isSpaceHeldProp) {
      fabricRef.current.defaultCursor = "grab";
      fabricRef.current.hoverCursor = "grab";
    } else if (repositioning) {
      // Crosshair cursor while placing a repositioned point
      fabricRef.current.defaultCursor = "crosshair";
      fabricRef.current.hoverCursor = "crosshair";
    } else {
      fabricRef.current.defaultCursor = getCursorForTool(currentTool);
      fabricRef.current.hoverCursor = getCursorForTool(currentTool);
    }
  }, [isPanningProp, isSpaceHeldProp, currentTool, repositioning]);

  // =============================================================================
  // Render
  // =============================================================================

  // Get visible snap points for the current viewport (for debug overlay)
  const visibleSnapPoints = React.useMemo(() => {
    if (!showSnapPoints) return [];
    return getVisibleSnapPoints({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
  }, [showSnapPoints, getVisibleSnapPoints, pageWidth, pageHeight]);

  return (
    <PdfFrame
      className="relative"
      style={{ width: pageWidth * zoom, height: pageHeight * zoom }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          cursor: getCursorForTool(currentTool),
        }}
      />

      {/* SVG overlay for snap indicators — z-20 ensures it's above Fabric upper-canvas */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={pageWidth * zoom}
        height={pageHeight * zoom}
        style={{ overflow: "visible", zIndex: 20 }}
      >
        {/* Debug: Show all available snap points */}
        <SnapPointsLayer
          snapPoints={visibleSnapPoints}
          zoom={zoom}
          showAll={showSnapPoints}
        />

        {/* Active snap indicator at cursor */}
        {snapResult && (
          <SnapIndicator
            point={snapResult.isSnapped ? {
              x: snapResult.snapped.x * zoom,
              y: snapResult.snapped.y * zoom,
            } : null}
            snapType={snapResult.snapType}
            zoom={zoom}
            isSnapped={snapResult.isSnapped}
          />
        )}
      </svg>

      {/* Snap magnifier for ambiguous PDF edge snaps (2+ junctions nearby) */}
      {snapResult?.pdfCandidates && snapResult.pdfCandidates.length >= 1 && pdfPage && (
        <SnapMagnifier
          candidates={snapResult.pdfCandidates}
          activeCandidate={snapResult.snapped}
          pdfCanvas={pdfPage}
          zoom={zoom}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          onSelect={handleMagnifierSelect}
          onPreview={handleMagnifierPreview}
        />
      )}

      {/* Pinned magnifiers at calibration endpoints — shows exactly where each point snapped */}
      {/* Original calibration magnifiers: always visible when showCalibrationOverlay is on */}
      {pdfPage && showCalibrationOverlay && pageScale?.calibration_line && pageScale.reference_length_mm && (() => {
        const calLine = pageScale.calibration_line!;
        const isVerticalCal = Math.abs(calLine.y2 - calLine.y1) > Math.abs(calLine.x2 - calLine.x1);
        return (
          <>
            <PinnedMagnifier
              point={{ x: calLine.x1, y: calLine.y1 }}
              pdfCanvas={pdfPage}
              zoom={zoom}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              label="Cal A"
              color="#F59E0B"
              preferSide="left"
              onSelect={(newPoint) => {
                void onCalibrate({
                  lineStart: { x: newPoint.x, y: newPoint.y },
                  lineEnd: { x: calLine.x2, y: calLine.y2 },
                  referenceLengthMm: pageScale.reference_length_mm!,
                  canvasWidth: pageWidth,
                  canvasHeight: pageHeight,
                });
              }}
            />
            <PinnedMagnifier
              point={{ x: calLine.x2, y: calLine.y2 }}
              pdfCanvas={pdfPage}
              zoom={zoom}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              label="Cal B"
              color="#F59E0B"
              preferSide={isVerticalCal ? "left" : "right"}
              onSelect={(newPoint) => {
                void onCalibrate({
                  lineStart: { x: calLine.x1, y: calLine.y1 },
                  lineEnd: { x: newPoint.x, y: newPoint.y },
                  referenceLengthMm: pageScale.reference_length_mm!,
                  canvasWidth: pageWidth,
                  canvasHeight: pageHeight,
                });
              }}
            />
          </>
        );
      })()}
      {/* Active calibration/verification line magnifiers: only when calibrate tool is active */}
      {currentTool === "calibrate" && pdfPage && showCalibrationOverlay && calibrationLine && (() => {
        const isVerticalActive = Math.abs(calibrationLine.end.y - calibrationLine.start.y) > Math.abs(calibrationLine.end.x - calibrationLine.start.x);
        return (
          <>
            <PinnedMagnifier
              point={calibrationLine.start}
              pdfCanvas={pdfPage}
              zoom={zoom}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              label={pageScale?.calibrated ? "Verify A" : "New A"}
              color={pageScale?.calibrated ? "#16A34A" : "#3B82F6"}
              preferSide="left"
              onSelect={(newPoint) => {
                setCalibrationLine(prev => prev ? { ...prev, start: newPoint } : null);
              }}
            />
            {(calibrationStep === "waitingInput" || calibrationStep === "verifying") && (
              <PinnedMagnifier
                point={calibrationLine.end}
                pdfCanvas={pdfPage}
                zoom={zoom}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
                label={pageScale?.calibrated ? "Verify B" : "New B"}
                color={pageScale?.calibrated ? "#16A34A" : "#3B82F6"}
                preferSide={isVerticalActive ? "left" : "right"}
                onSelect={(newPoint) => {
                  setCalibrationLine(prev => prev ? { ...prev, end: newPoint } : null);
                }}
              />
            )}
          </>
        );
      })()}

      {/* Completed verification results — persist on page after "Check Another" */}
      {showCalibrationOverlay && completedVerifications.map((v, i) => {
        const midX = ((v.line.start.x + v.line.end.x) / 2) * zoom;
        const midY = ((v.line.start.y + v.line.end.y) / 2) * zoom;
        const isProblem = v.diffPercent >= 1;
        const isAcceptable = v.diffPercent >= 0.5 && v.diffPercent < 1;
        const bgColor = isProblem
          ? "bg-red-500"
          : isAcceptable
          ? "bg-amber-500"
          : "bg-green-500";
        const vColor = isProblem ? "#ef4444" : isAcceptable ? "#f59e0b" : "#22c55e";
        const displayMm = `${Math.round(v.computedMm).toLocaleString()}mm`;
        const expectedDisplay = `${Math.round(v.expectedMm).toLocaleString()}mm`;
        const vIsVertical = Math.abs(v.line.end.y - v.line.start.y) > Math.abs(v.line.end.x - v.line.start.x);
        return (
          <React.Fragment key={i}>
          <div
            className="absolute pointer-events-none z-5"
            style={{
              left: midX,
              top: midY - 30,
              transform: "translate(-50%, -100%)",
            }}
          >
            {/* Verification line (SVG dashed line) */}
            <svg
              className="absolute pointer-events-none"
              style={{
                left: "50%",
                top: "100%",
                width: Math.abs(v.line.end.x - v.line.start.x) * zoom + 4,
                height: Math.abs(v.line.end.y - v.line.start.y) * zoom + 4,
                transform: `translate(-50%, 0)`,
                overflow: "visible",
              }}
            >
              <line
                x1={v.line.start.x * zoom - midX + Math.abs(v.line.end.x - v.line.start.x) * zoom / 2 + 2}
                y1={v.line.start.y * zoom - midY + 30}
                x2={v.line.end.x * zoom - midX + Math.abs(v.line.end.x - v.line.start.x) * zoom / 2 + 2}
                y2={v.line.end.y * zoom - midY + 30}
                stroke={vColor}
                strokeWidth={2}
                strokeDasharray="6 3"
                opacity={0.6}
              />
            </svg>
            {/* Result badge */}
            <div className={`${bgColor} text-white text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap ${isProblem ? "animate-pulse" : ""}`}>
              {displayMm} vs {expectedDisplay} ({v.diffPercent < 0.01 ? "0%" : v.diffPercent < 1 ? `${v.diffPercent.toFixed(2)}%` : `${v.diffPercent.toFixed(1)}%`})
            </div>
          </div>
          {/* PinnedMagnifiers at each verification line endpoint */}
          {pdfPage && showCalibrationOverlay && (
            <>
              <PinnedMagnifier
                point={v.line.start}
                pdfCanvas={pdfPage}
                zoom={zoom}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
                label={`V${i + 1} A`}
                color={vColor}
                preferSide="left"
              />
              <PinnedMagnifier
                point={v.line.end}
                pdfCanvas={pdfPage}
                zoom={zoom}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
                label={`V${i + 1} B`}
                color={vColor}
                preferSide={vIsVertical ? "left" : "right"}
              />
            </>
          )}
          </React.Fragment>
        );
      })}

      {/* Zoom-to-rect selection overlay (right-click drag) */}
      {zoomRect && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-500/15 pointer-events-none"
          style={{
            left: zoomRect.x,
            top: zoomRect.y,
            width: zoomRect.w,
            height: zoomRect.h,
          }}
        />
      )}

      {/* Scale indicator — only visible in calibrate mode */}
      {pageScale?.calibrated && showCalibrationOverlay && (
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 border shadow-sm">
          <div className="text-xs text-muted-foreground">Scale</div>
          <div className="text-sm font-medium">{pageScale.scale_label}</div>
        </div>
      )}

      {/* Reposition mode: banner + ghost marker following cursor + dashed line from origin */}
      {repositioning && (
        <>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-500/90 text-white rounded-lg px-4 py-2 text-sm font-medium shadow-lg z-30 flex items-center gap-2">
            Click to place point #{repositioning.pointIndex + 1}
            {(() => {
              const repoM = measurements.find(m => m.id === repositioning.measurementId);
              return repoM?.geometry_data?.type === "point" ? (
                <span className="text-white/70 text-xs ml-1">| Delete to remove</span>
              ) : null;
            })()}
            <button
              onClick={() => { setRepositioning(null); setRepositionPreview(null); }}
              className="ml-2 text-white/80 hover:text-white underline text-xs"
            >
              Cancel (Esc)
            </button>
          </div>

          {/* Ghost marker at cursor position + dashed line from original location */}
          {repositionPreview && (() => {
            const repoMeasurement = measurements.find(m => m.id === repositioning.measurementId);
            const isCountType = repoMeasurement?.geometry_data?.type === "point";
            return (
              <svg
                className="absolute inset-0 pointer-events-none"
                width={pageWidth * zoom}
                height={pageHeight * zoom}
                style={{ overflow: "visible", zIndex: 25 }}
              >
                {/* Dashed line from original position to cursor */}
                <line
                  x1={repositioning.originalPoint.x * zoom}
                  y1={repositioning.originalPoint.y * zoom}
                  x2={repositionPreview.x * zoom}
                  y2={repositionPreview.y * zoom}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  opacity={0.7}
                />
                {/* Ghost handle at cursor — large circle for count, small dot for vertex */}
                <circle
                  cx={repositionPreview.x * zoom}
                  cy={repositionPreview.y * zoom}
                  r={isCountType ? drawingStyle.markerSize / 2 : 6}
                  fill="#3B82F6"
                  fillOpacity={0.6}
                  stroke="#fff"
                  strokeWidth={2}
                />
                {/* Point number label — only for count markers */}
                {isCountType && (
                  <text
                    x={repositionPreview.x * zoom}
                    y={repositionPreview.y * zoom}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#fff"
                    fontWeight="bold"
                    fontSize={drawingStyle.fontSize}
                    style={{ pointerEvents: "none" }}
                  >
                    {repositioning.pointIndex + 1}
                  </text>
                )}
              </svg>
            );
          })()}
        </>
      )}

      {/* Not calibrated warning — only when calibrate tool is active */}
      {!pageScale?.calibrated && showCalibrationOverlay && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white rounded-lg px-4 py-2 text-sm font-medium shadow-lg">
          Page not calibrated - Use Calibrate tool to set scale
        </div>
      )}

      {/* Snap status indicator */}
      {snapResult?.isSnapped && (
        <div className="absolute top-4 right-4 bg-green-500/90 text-white rounded-lg px-3 py-1.5 text-xs font-medium shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Snap: {snapResult.snapType}
          {snapResult.snapType === "pdf-edge" && (
            <span className="opacity-70 ml-1">
              {snapResult.pdfCandidates && snapResult.pdfCandidates.length > 1 ? "← → switch" : ""}
              {" ⇧+↑↓←→ nudge"}
            </span>
          )}
        </div>
      )}

      {/* Drawing instructions */}
      {isDrawing && currentTool !== "calibrate" && (
        <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 border shadow-sm text-sm">
          <div className="font-medium mb-1">
            {currentPoints.length} point{currentPoints.length !== 1 ? "s" : ""} placed
          </div>
          <div className="text-muted-foreground">
            Click to add points • Double-click or Enter to finish • Esc to cancel
          </div>
        </div>
      )}

      {/* Calibration instructions - step 1: click first point */}
      {currentTool === "calibrate" && calibrationStep === "idle" && !calibrationLine && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="bg-amber-600/95 text-white rounded-lg px-4 py-2 text-sm font-medium shadow-lg">
            {pageScale?.calibrated
              ? <>Click two points on a <strong>known dimension</strong> to verify accuracy</>
              : <>Click the <strong>start</strong> of a known dimension line</>
            }
          </div>
          {pageScale?.calibrated && (
            <button
              onClick={async () => {
                if (onClearCalibration) {
                  await onClearCalibration();
                  // Reset all calibration UI state for a fresh start
                  setCalibrationLine(null);
                  setCalibrationStep("idle");
                  setCalibrationInput("");
                  setIsDrawing(false);
                  clearTempDrawing();
                }
              }}
              className="bg-red-500/90 text-white rounded-lg px-3 py-2 text-sm font-medium shadow-lg hover:bg-red-600"
            >
              Clear Calibration
            </button>
          )}
        </div>
      )}

      {/* Calibration instructions - step 2: click second point */}
      {currentTool === "calibrate" && calibrationStep === "firstPoint" && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-600/95 text-white rounded-lg px-4 py-2 text-sm font-medium shadow-lg">
          Click the <strong>end</strong> of the dimension line • Esc to cancel
        </div>
      )}

      {/* Calibration input - positioned below the line (avoids toolbar cutoff) */}
      {calibrationStep === "waitingInput" && calibrationLine && (
        <div
          className="absolute z-30"
          style={{
            left: Math.max(120, Math.min(
              pageWidth * zoom - 120,
              ((calibrationLine.start.x + calibrationLine.end.x) / 2) * zoom
            )),
            top: Math.max(calibrationLine.start.y, calibrationLine.end.y) * zoom + 60,
            transform: "translate(-50%, 0)",
          }}
        >
          <div className="bg-background/95 backdrop-blur-sm rounded-lg px-4 py-3 border-2 border-amber-500 shadow-xl min-w-[220px]">
            <div className="text-xs text-muted-foreground mb-1">
              Pixel distance: {Math.round(Math.sqrt(
                Math.pow(calibrationLine.end.x - calibrationLine.start.x, 2) +
                Math.pow(calibrationLine.end.y - calibrationLine.start.y, 2)
              ))} px
            </div>
            <div className="text-sm font-medium mb-2">Enter real-world length (mm):</div>
            <div className="flex gap-2">
              <input
                ref={calibrationInputRef}
                type="text"
                inputMode="numeric"
                value={calibrationInput}
                onChange={(e) => setCalibrationInput(e.target.value.replace(/[^0-9.]/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCalibrationSubmit();
                  if (e.key === "Escape") handleCalibrationCancel();
                  e.stopPropagation();
                }}
                placeholder="e.g. 3000"
                className="flex-1 text-sm bg-muted border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
              <button
                onClick={handleCalibrationSubmit}
                disabled={!calibrationInput || parseFloat(calibrationInput) <= 0}
                className="px-3 py-1 text-sm font-medium bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
              >
                Set
              </button>
              <button
                onClick={handleCalibrationCancel}
                className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification overlay - shows computed distance + accuracy check input */}
      {calibrationStep === "verifying" && calibrationLine && pageScale?.scale_factor && (() => {
        const dx = calibrationLine.end.x - calibrationLine.start.x;
        const dy = calibrationLine.end.y - calibrationLine.start.y;
        const pxDist = Math.sqrt(dx * dx + dy * dy);
        const computedMm = pxDist * pageScale.scale_factor;
        const computedM = computedMm / 1000;
        const expectedMm = parseFloat(verificationInput);
        const hasExpected = verificationInput.length > 0 && !isNaN(expectedMm) && expectedMm > 0;
        const diffMm = hasExpected ? Math.abs(computedMm - expectedMm) : 0;
        const diffPercent = hasExpected ? (diffMm / expectedMm) * 100 : 0;
        // Thresholds: <0.5% = excellent, <1% = acceptable, >=1% = problem
        const isAcceptable = hasExpected && diffPercent >= 0.5 && diffPercent < 1;
        const isProblem = hasExpected && diffPercent >= 1;
        const borderColor = !verificationConfirmed ? "border-green-500"
          : isProblem ? "border-red-500"
          : isAcceptable ? "border-amber-500"
          : "border-green-500";

        const confirmVerification = () => {
          if (hasExpected) setVerificationConfirmed(true);
        };

        return (
          <div
            className="absolute z-30"
            style={{
              left: Math.max(160, Math.min(
                pageWidth * zoom - 160,
                ((calibrationLine.start.x + calibrationLine.end.x) / 2) * zoom
              )),
              top: Math.max(calibrationLine.start.y, calibrationLine.end.y) * zoom + 60,
              transform: "translate(-50%, 0)",
            }}
          >
            <div className={`bg-background/95 backdrop-blur-sm rounded-lg px-4 py-3 border-2 ${borderColor} shadow-xl min-w-[280px] ${verificationConfirmed && isProblem ? "animate-pulse" : ""}`}>
              <div className="text-xs text-muted-foreground mb-1">
                Verification ({Math.round(pxDist)} px)
              </div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400 mb-2">
                {Math.round(computedMm).toLocaleString()} mm
                {computedMm >= 1000 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({computedM.toFixed(3)} m)
                  </span>
                )}
              </div>

              {/* Step 1: Enter expected dimension */}
              {!verificationConfirmed && (
                <>
                  <div className="mb-2">
                    <div className="text-xs text-muted-foreground mb-1">What does the drawing say? (mm)</div>
                    <div className="flex gap-2">
                      <input
                        ref={verificationInputRef}
                        type="text"
                        inputMode="numeric"
                        value={verificationInput}
                        onChange={(e) => setVerificationInput(e.target.value.replace(/[^0-9.]/g, ""))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmVerification();
                          if (e.key === "Escape") {
                            setVerificationInput("");
                            setVerificationConfirmed(false);
                            handleCalibrationCancel();
                          }
                          e.stopPropagation();
                        }}
                        placeholder="e.g. 13010"
                        className="flex-1 text-sm bg-muted border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-green-500"
                        autoFocus
                      />
                      <button
                        onClick={confirmVerification}
                        disabled={!hasExpected}
                        className="px-3 py-1 text-sm font-medium bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                      >
                        Check
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setVerificationInput("");
                        setVerificationConfirmed(false);
                        handleCalibrationCancel();
                      }}
                      className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Skip
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Show accuracy result + action buttons */}
              {verificationConfirmed && hasExpected && (
                <>
                  <div className="text-sm text-muted-foreground mb-1">
                    Expected: <span className="font-medium text-foreground">{Math.round(expectedMm).toLocaleString()} mm{expectedMm >= 1000 ? ` (${(expectedMm/1000).toFixed(3)} m)` : ""}</span>
                  </div>

                  <div className={`rounded px-3 py-2 mb-3 text-sm ${
                    isProblem
                      ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800"
                      : isAcceptable
                      ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                      : "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800"
                  }`}>
                    <div className="font-bold text-base">
                      {isProblem
                        ? `Off by ${diffMm.toFixed(0)}mm (${diffPercent.toFixed(1)}%)`
                        : isAcceptable
                        ? `Off by ${diffMm.toFixed(0)}mm (${diffPercent.toFixed(2)}%)`
                        : `Off by ${diffMm.toFixed(0)}mm (${diffPercent.toFixed(2)}%)`
                      }
                    </div>
                    <div className="font-semibold mt-1">
                      {isProblem
                        ? "Calibration may be inaccurate — recalibrate with a longer line"
                        : isAcceptable
                        ? "Acceptable — within tolerance for construction takeoffs"
                        : "Excellent — highly accurate calibration"
                      }
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Save this verification result to display on the page
                        if (calibrationLine) {
                          setCompletedVerifications(prev => [...prev, {
                            line: { start: calibrationLine.start, end: calibrationLine.end },
                            computedMm,
                            expectedMm,
                            diffPercent,
                          }]);
                        }
                        setCalibrationLine(null);
                        setCalibrationStep("idle");
                        setVerificationInput("");
                        setVerificationConfirmed(false);
                        clearTempDrawing();
                      }}
                      className={`flex-1 px-3 py-1.5 text-sm font-medium text-white rounded ${
                        isProblem ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                      }`}
                    >
                      Check Another
                    </button>
                    {isProblem && (
                      <button
                        onClick={() => {
                          setCalibrationStep("waitingInput");
                          setCalibrationInput("");
                          setVerificationInput("");
                          setVerificationConfirmed(false);
                          setTimeout(() => calibrationInputRef.current?.focus(), 50);
                        }}
                        className="px-3 py-1.5 text-sm font-medium bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Recalibrate
                      </button>
                    )}
                    <button
                      onClick={() => {
                        // Save this verification result before closing (same as Check Another)
                        if (calibrationLine) {
                          setCompletedVerifications(prev => [...prev, {
                            line: { start: calibrationLine.start, end: calibrationLine.end },
                            computedMm,
                            expectedMm,
                            diffPercent,
                          }]);
                        }
                        setVerificationInput("");
                        setVerificationConfirmed(false);
                        handleCalibrationCancel();
                      }}
                      className="px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </PdfFrame>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getCursorForTool(tool: TakeoffTool): string {
  switch (tool) {
    case "select":
      return "default";
    case "pan":
      return "grab";
    case "calibrate":
      return "crosshair";
    case "count":
      return "crosshair";
    case "area":
    case "linear":
    case "perimeter":
    case "deduction":
      return "crosshair";
    default:
      return "default";
  }
}

