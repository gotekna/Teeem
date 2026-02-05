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
import { SnapIndicator, SnapPointsLayer } from "./SnapIndicator";

// =============================================================================
// Fabric.js Type Extensions
// =============================================================================

// Custom data interface for takeoff objects
interface TakeoffObjectData {
  isMeasurement?: boolean;
  measurementId?: number;
  isCalibration?: boolean;
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
  onZoomChange: (zoom: number) => void;

  // Snap configuration
  snapConfig?: Partial<SnapConfig>;
  showSnapPoints?: boolean;  // Debug: show all available snap points
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
  onZoomChange,
  snapConfig,
  showSnapPoints = false,
}: TakeoffCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [calibrationLine, setCalibrationLine] = useState<{ start: Point; end: Point } | null>(null);

  // Count marker state
  const [nextCountLabel, setNextCountLabel] = useState(1);

  // Snap state
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null);
  const [snapResult, setSnapResult] = useState<{
    snapped: Point;
    isSnapped: boolean;
    snapType: "endpoint" | "intersection" | "midpoint" | "perpendicular" | "edge" | null;
  } | null>(null);

  // Initialize snap points hook
  const { findSnapPoint, getVisibleSnapPoints } = useSnapPoints({
    measurements: measurements.map(m => ({
      id: m.id,
      geometry_data: m.geometry_data,
    })),
    pageWidth,
    pageHeight,
    zoom,
    config: snapConfig,
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
      selection: currentTool === "select",
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
  // Render PDF background
  // =============================================================================

  useEffect(() => {
    if (!fabricRef.current || !pdfPage) return;

    // Add PDF as background image
    const dataUrl = pdfPage.toDataURL();
    fabric.FabricImage.fromURL(dataUrl).then((img) => {
      if (!fabricRef.current) return;

      img.scaleToWidth(pageWidth * zoom);
      fabricRef.current.backgroundImage = img;
      fabricRef.current.renderAll();
    });
  }, [pdfPage, zoom, pageWidth]);

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

    // Label
    const midX = (scaledLine[0].x + scaledLine[1].x) / 2;
    const midY = (scaledLine[0].y + scaledLine[1].y) / 2;
    const label = new fabric.FabricText(`${scale.reference_length_mm}mm (${scale.scale_label})`, {
      left: midX,
      top: midY - 15,
      fontSize: 12,
      fill: "#F59E0B",
      backgroundColor: "rgba(255,255,255,0.9)",
      originX: "center",
      selectable: false,
    }) as FabricObjectWithData;
    label.data = { isMeasurement: true, isCalibration: true };

    canvas.add(line);
    canvas.add(label);
  };

  // =============================================================================
  // Event Handlers Setup
  // =============================================================================

  const setupEventHandlers = (canvas: fabric.Canvas) => {
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);
    canvas.on("mouse:dblclick", handleDoubleClick);
    // Selection events have different type signature
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on("selection:created", handleSelectionCreated as any);
    canvas.on("selection:cleared", handleSelectionCleared);
  };

  // =============================================================================
  // Mouse Handlers
  // =============================================================================

  const handleMouseDown = useCallback((e: fabric.TPointerEventInfo) => {
    const canvas = fabricRef.current;
    if (!canvas || !e.pointer) return;

    const rawPoint = { x: e.pointer.x / zoom, y: e.pointer.y / zoom };

    // Apply snapping for measurement tools
    const shouldSnap = ["count", "area", "linear", "perimeter", "deduction", "calibrate"].includes(currentTool);
    const { snapped: point } = shouldSnap ? findSnapPoint(rawPoint.x, rawPoint.y) : { snapped: rawPoint };

    switch (currentTool) {
      case "calibrate":
        // Start calibration line
        setIsDrawing(true);
        setCalibrationLine({ start: point, end: point });
        break;

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
  }, [currentTool, zoom, findSnapPoint]);

  const handleMouseMove = useCallback((e: fabric.TPointerEventInfo) => {
    if (!e.pointer) return;

    const rawPoint = { x: e.pointer.x / zoom, y: e.pointer.y / zoom };

    // Always check for snap points when using measurement tools (for visual feedback)
    const shouldSnap = ["count", "area", "linear", "perimeter", "deduction", "calibrate"].includes(currentTool);
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

    if (currentTool === "calibrate" && calibrationLine) {
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
  }, [isDrawing, currentTool, calibrationLine, zoom, currentPoints, activeLayer, findSnapPoint, snapResult]);

  const handleMouseUp = useCallback(() => {
    if (currentTool === "calibrate" && calibrationLine) {
      // Show calibration input dialog
      setIsDrawing(false);
      showCalibrationDialog();
    }
  }, [currentTool, calibrationLine]);

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

    // Remove existing temp line
    const tempLine = (canvas.getObjects() as FabricObjectWithData[]).find(
      (obj) => obj.data?.isTempCalibration
    );
    if (tempLine) canvas.remove(tempLine);

    // Draw new temp line
    const line = new fabric.Line(
      [
        calibrationLine.start.x * zoom,
        calibrationLine.start.y * zoom,
        calibrationLine.end.x * zoom,
        calibrationLine.end.y * zoom,
      ],
      {
        stroke: "#F59E0B",
        strokeWidth: 3,
        strokeDashArray: [10, 5],
        selectable: false,
      }
    ) as FabricObjectWithData;
    line.data = { isTempCalibration: true };

    canvas.add(line);
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

  const showCalibrationDialog = () => {
    if (!calibrationLine) return;

    // Prompt for real-world length
    const lengthStr = window.prompt(
      "Enter the real-world length of this line (in mm):",
      "820"  // Default door width
    );

    if (!lengthStr) {
      setCalibrationLine(null);
      clearTempDrawing();
      return;
    }

    const lengthMm = parseFloat(lengthStr);
    if (isNaN(lengthMm) || lengthMm <= 0) {
      alert("Please enter a valid positive number");
      setCalibrationLine(null);
      clearTempDrawing();
      return;
    }

    // Submit calibration
    onCalibrate({
      lineStart: calibrationLine.start,
      lineEnd: calibrationLine.end,
      referenceLengthMm: lengthMm,
      canvasWidth: pageWidth,
      canvasHeight: pageHeight,
    });

    setCalibrationLine(null);
    clearTempDrawing();
  };

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
      if (e.key === "Escape") {
        // Cancel current drawing
        setCurrentPoints([]);
        setIsDrawing(false);
        setCalibrationLine(null);
        clearTempDrawing();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // Delete selected measurement
        if (selectedMeasurement) {
          onMeasurementDelete(selectedMeasurement.id);
        }
      } else if (e.key === "Enter" && isDrawing) {
        // Complete drawing
        completeDrawing();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMeasurement, isDrawing, currentPoints]);

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
    <div className="relative overflow-hidden">
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
    </div>
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

