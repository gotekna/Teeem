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
import { SnapIndicator, SnapPointsLayer, SnapMagnifier } from "./SnapIndicator";
import { PdfFrame } from "@/components/ui/pdf-chrome";

// =============================================================================
// Fabric.js Type Extensions
// =============================================================================

// Custom data interface for takeoff objects
interface TakeoffObjectData {
  isMeasurement?: boolean;
  measurementId?: number;
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

  // Measurements
  measurements: TakeoffMeasurement[];
  onMeasurementCreate: (
    type: TakeoffMeasurement["measurement_type"],
    geometryData: GeometryData,
    pixelValue: number,
    pageNumber: number,
    options?: MeasurementCreateOptions
  ) => Promise<void>;
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
  measurements,
  onMeasurementCreate,
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

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [calibrationLine, setCalibrationLine] = useState<{ start: Point; end: Point } | null>(null);
  // Calibration uses click-click (not drag): click first point, click second point, type dimension
  // "verifying" = already calibrated, showing computed measurement for a check line
  const [calibrationStep, setCalibrationStep] = useState<"idle" | "firstPoint" | "waitingInput" | "verifying">("idle");
  const [calibrationInput, setCalibrationInput] = useState("");
  const calibrationInputRef = useRef<HTMLInputElement>(null);

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

    // Clear existing measurement objects
    const toRemove = (canvas.getObjects() as FabricObjectWithData[]).filter(
      (obj) => obj.data?.isMeasurement
    );
    toRemove.forEach((obj) => canvas.remove(obj));

    // Build set of hidden layer IDs
    const hiddenLayerIds = new Set(
      layers.filter((l) => !l.visible).map((l) => l.id)
    );

    // Render each measurement (skip hidden layers)
    measurements.forEach((m) => {
      // Skip if measurement's layer is hidden
      if (m.layer?.id && hiddenLayerIds.has(m.layer.id)) {
        return;
      }
      renderMeasurement(canvas, m);
    });

    // Render calibration line if exists
    if (pageScale?.calibration_line && pageScale.calibrated) {
      renderCalibrationLine(canvas, pageScale);
    }

    canvas.renderAll();
  }, [measurements, pageScale, zoom, layers]);

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
    const strokeWidth = isSelected ? 3 : 2;

    switch (geometry_data.type) {
      case "point": {
        // Count marker
        const point = scaledPoints[0];
        const marker = new fabric.Circle({
          left: point.x - drawingStyle.markerSize / 2,
          top: point.y - drawingStyle.markerSize / 2,
          radius: drawingStyle.markerSize / 2,
          fill: color,
          stroke: isSelected ? "#000" : "#fff",
          strokeWidth: 2,
          selectable: currentTool === "select",
        }) as FabricObjectWithData;
        marker.data = { isMeasurement: true, measurementId: measurement.id };

        // Label
        const label = new fabric.FabricText(display_label || "?", {
          left: point.x,
          top: point.y,
          fontSize: drawingStyle.fontSize,
          fill: "#fff",
          fontWeight: "bold",
          originX: "center",
          originY: "center",
          selectable: false,
        }) as FabricObjectWithData;
        label.data = { isMeasurement: true, measurementId: measurement.id };

        canvas.add(marker);
        canvas.add(label);
        break;
      }

      case "polygon": {
        // Area measurement
        const polygon = new fabric.Polygon(scaledPoints, {
          fill: `${color}33`,  // 20% opacity
          stroke: color,
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
          fill: color,
          fontWeight: "bold",
          backgroundColor: "rgba(255,255,255,0.8)",
          originX: "center",
          originY: "center",
          selectable: false,
        }) as FabricObjectWithData;
        valueLabel.data = { isMeasurement: true, measurementId: measurement.id };
        canvas.add(valueLabel);
        break;
      }

      case "polyline": {
        // Linear measurement
        const line = new fabric.Polyline(scaledPoints, {
          fill: "transparent",
          stroke: color,
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
          fill: color,
          fontWeight: "bold",
          backgroundColor: "rgba(255,255,255,0.8)",
          originX: "center",
          selectable: false,
        }) as FabricObjectWithData;
        valueLabel.data = { isMeasurement: true, measurementId: measurement.id };
        canvas.add(valueLabel);
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

    const label = new fabric.FabricText(`${scale.reference_length_mm}mm (${scale.scale_label})`, {
      left: labelX,
      top: labelY - 8,
      fontSize: 12,
      fill: "#F59E0B",
      backgroundColor: "rgba(255,255,255,0.9)",
      originX: "center",
      originY: "bottom",
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

  const handleMouseDown = useCallback((e: fabric.TPointerEventInfo) => {
    const canvas = fabricRef.current;
    if (!canvas || !e.pointer) return;

    // Don't process tool actions during panning (space+drag, middle-click, or pan tool)
    if (isPanningProp || isSpaceHeldProp || currentTool === "pan") return;

    const rawPoint = { x: e.pointer.x / zoom, y: e.pointer.y / zoom };

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
    const nativeEvt = e.e as PointerEvent;
    const altHeld = nativeEvt?.altKey ?? false;
    const shouldSnap = !altHeld && ["count", "area", "linear", "perimeter", "deduction", "calibrate"].includes(currentTool);
    const { snapped: point } = shouldSnap ? findSnapPoint(rawPoint.x, rawPoint.y) : { snapped: rawPoint };

    switch (currentTool) {
      case "calibrate": {
        // If clicked on the calibration label, the label's own mousedown handler
        // will open the re-edit input — don't start a new calibration line
        const target = e.target as FabricObjectWithData | undefined;
        if (target?.data?.isCalibrationLabel) return;

        // Click-click calibration: first click sets start, second click sets end
        if (calibrationStep === "waitingInput" || calibrationStep === "verifying") {
          // Already have two points and waiting for input/showing verification - ignore clicks
          return;
        }
        if (!calibrationLine) {
          // First click - set start point
          setCalibrationLine({ start: point, end: point });
          setCalibrationStep("firstPoint");
          setIsDrawing(true);
        } else {
          // Second click - set end point
          const updatedLine = { ...calibrationLine, end: point };
          setCalibrationLine(updatedLine);
          setIsDrawing(false);

          if (pageScale?.calibrated && pageScale.scale_factor) {
            // Already calibrated → show verification (computed distance)
            setCalibrationStep("verifying");
            renderTempCalibrationLine();
          } else {
            // Not calibrated → ask for mm input
            setCalibrationStep("waitingInput");
            setCalibrationInput("");
            renderTempCalibrationLine();
            setTimeout(() => calibrationInputRef.current?.focus(), 50);
          }
        }
        break;
      }

      case "count":
        // Create count marker immediately
        handleCountClick(point);
        break;

      case "area":
      case "linear":
      case "perimeter":
      case "deduction":
        // Add point to polygon/polyline
        setIsDrawing(true);
        setCurrentPoints((prev) => [...prev, point]);
        break;
    }
  }, [currentTool, zoom, findSnapPoint, calibrationLine, calibrationStep, pageScale, isPanningProp, isSpaceHeldProp]);

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

    // Always check for snap points when using measurement tools (for visual feedback)
    // Hold Alt to temporarily suppress snapping
    const moveNativeEvt = e.e as PointerEvent;
    const altHeldMove = moveNativeEvt?.altKey ?? false;
    const shouldSnap = !altHeldMove && ["count", "area", "linear", "perimeter", "deduction", "calibrate"].includes(currentTool);
    if (shouldSnap) {
      const snap = findSnapPoint(rawPoint.x, rawPoint.y);
      setCursorPoint(rawPoint);
      setSnapResult(snap);
    } else {
      setCursorPoint(null);
      setSnapResult(null);
    }

    // Only update drawing if actively drawing
    if (!isDrawing) return;

    const point = shouldSnap && snapResult?.isSnapped ? snapResult.snapped : rawPoint;

    if (currentTool === "calibrate" && calibrationLine && calibrationStep === "firstPoint") {
      // Preview line from first click to cursor
      setCalibrationLine({ ...calibrationLine, end: point });
      renderTempCalibrationLine();
    } else if (
      (currentTool === "area" || currentTool === "linear" ||
       currentTool === "perimeter" || currentTool === "deduction") &&
      currentPoints.length > 0
    ) {
      // Render live preview while drawing polygon/polyline
      renderTempDrawing(point);
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

  const handleCountClick = async (point: Point) => {
    const geometryData: GeometryData = {
      type: "point",
      points: [point],
      canvasWidth: pageWidth,
      canvasHeight: pageHeight,
    };

    await onMeasurementCreate("count", geometryData, 1, pageNumber);
    setNextCountLabel((prev) => prev + 1);
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

    const measurementType = currentTool === "area" || currentTool === "deduction"
      ? "area"
      : currentTool === "perimeter"
        ? "perimeter"
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
        labelText = computedMm >= 1000
          ? `${(computedMm / 1000).toFixed(2)} m (${Math.round(pxDist)} px)`
          : `${computedMm.toFixed(1)} mm (${Math.round(pxDist)} px)`;
      }

      const label = new fabric.FabricText(labelText, {
        left: labelX,
        top: labelY - 6,
        fontSize: 11,
        fill: pageScale?.calibrated ? "#16A34A" : "#F59E0B",
        backgroundColor: "rgba(255,255,255,0.85)",
        originX: "center",
        originY: "bottom",
        selectable: false,
      }) as FabricObjectWithData;
      label.data = { isTempCalibration: true };
      canvas.add(label);
    }

    canvas.renderAll();
  };

  // Render temporary polygon/polyline while drawing (live preview)
  const renderTempDrawing = (cursorPoint: Point) => {
    const canvas = fabricRef.current;
    if (!canvas || currentPoints.length === 0) return;

    // Remove existing temp drawing objects
    const toRemove = (canvas.getObjects() as FabricObjectWithData[]).filter(
      (obj) => obj.data?.isTempDrawing
    );
    toRemove.forEach((obj) => canvas.remove(obj));

    // Build points array with cursor position
    const allPoints = [...currentPoints, cursorPoint];
    const scaledPoints = allPoints.map((p) => ({
      x: p.x * zoom,
      y: p.y * zoom,
    }));

    const isPolygon = currentTool === "area" || currentTool === "perimeter" || currentTool === "deduction";
    const color = activeLayer?.color || drawingStyle.strokeColor;

    if (isPolygon) {
      // Draw polygon preview with semi-transparent fill
      const polygon = new fabric.Polygon(scaledPoints, {
        fill: `${color}22`,  // ~13% opacity for preview
        stroke: color,
        strokeWidth: 2,
        strokeDashArray: [5, 5],  // Dashed to show it's not final
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
    }

    // Draw markers at each point
    scaledPoints.forEach((p, i) => {
      const marker = new fabric.Circle({
        left: p.x - 5,
        top: p.y - 5,
        radius: 5,
        fill: i === 0 ? "#fff" : color,  // First point is white (start indicator)
        stroke: color,
        strokeWidth: 2,
        selectable: false,
      }) as FabricObjectWithData;
      marker.data = { isTempDrawing: true };
      canvas.add(marker);
    });

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
  const handleMagnifierSelect = useCallback((candidate: { x: number; y: number }) => {
    overridePdfSnap(candidate);
    setSnapResult(prev => prev ? {
      ...prev,
      snapped: candidate,
    } : null);
  }, [overridePdfSnap]);

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
        // Cancel current drawing / calibration
        setCurrentPoints([]);
        setIsDrawing(false);
        setCalibrationLine(null);
        setCalibrationStep("idle");
        setCalibrationInput("");
        clearTempDrawing();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // Delete selected measurement
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
    } else {
      fabricRef.current.defaultCursor = getCursorForTool(currentTool);
      fabricRef.current.hoverCursor = getCursorForTool(currentTool);
    }
  }, [isPanningProp, isSpaceHeldProp, currentTool]);

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

      {/* SVG overlay for snap indicators */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={pageWidth * zoom}
        height={pageHeight * zoom}
        style={{ overflow: "visible" }}
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
        />
      )}

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

      {/* Scale indicator */}
      {pageScale?.calibrated && (
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 border shadow-sm">
          <div className="text-xs text-muted-foreground">Scale</div>
          <div className="text-sm font-medium">{pageScale.scale_label}</div>
        </div>
      )}

      {/* Not calibrated warning */}
      {!pageScale?.calibrated && (
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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-600/95 text-white rounded-lg px-4 py-2 text-sm font-medium shadow-lg">
          {pageScale?.calibrated
            ? <>Click two points on a <strong>known dimension</strong> to verify accuracy</>
            : <>Click the <strong>start</strong> of a known dimension line</>
          }
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
          className="absolute z-10"
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

      {/* Verification overlay - shows computed distance after calibration */}
      {calibrationStep === "verifying" && calibrationLine && pageScale?.scale_factor && (() => {
        const dx = calibrationLine.end.x - calibrationLine.start.x;
        const dy = calibrationLine.end.y - calibrationLine.start.y;
        const pxDist = Math.sqrt(dx * dx + dy * dy);
        const computedMm = pxDist * pageScale.scale_factor;
        const computedM = computedMm / 1000;
        return (
          <div
            className="absolute z-10"
            style={{
              left: Math.max(120, Math.min(
                pageWidth * zoom - 120,
                ((calibrationLine.start.x + calibrationLine.end.x) / 2) * zoom
              )),
              top: Math.max(calibrationLine.start.y, calibrationLine.end.y) * zoom + 60,
              transform: "translate(-50%, 0)",
            }}
          >
            <div className="bg-background/95 backdrop-blur-sm rounded-lg px-4 py-3 border-2 border-green-500 shadow-xl min-w-[240px]">
              <div className="text-xs text-muted-foreground mb-1">
                Verification ({Math.round(pxDist)} px)
              </div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400 mb-1">
                {computedMm >= 1000
                  ? `${computedM.toFixed(2)} m`
                  : `${computedMm.toFixed(1)} mm`
                }
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({computedMm.toFixed(0)} mm)
                </span>
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                Compare this to the dimension on the drawing
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Dismiss and immediately allow another verification
                    setCalibrationLine(null);
                    setCalibrationStep("idle");
                    clearTempDrawing();
                  }}
                  className="flex-1 px-3 py-1 text-sm font-medium bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Check Another
                </button>
                <button
                  onClick={() => {
                    // Switch to re-calibrate mode with this line
                    setCalibrationStep("waitingInput");
                    setCalibrationInput("");
                    setTimeout(() => calibrationInputRef.current?.focus(), 50);
                  }}
                  className="px-3 py-1 text-sm font-medium border rounded hover:bg-muted"
                >
                  Recalibrate
                </button>
                <button
                  onClick={handleCalibrationCancel}
                  className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  Done
                </button>
              </div>
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

