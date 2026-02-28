"use client";

/**
 * PdfMarkupOverlay - Universal PDF measurement overlay
 *
 * Wraps TakeoffCanvas + TakeoffToolbar to provide measurement tools
 * on any PDF viewer in the app. Manages all takeoff state:
 * - Calibration (scale per page)
 * - Measurements (create, edit, delete, move)
 * - Layers (create, toggle visibility, lock)
 *
 * Usage: Rendered inside PDFViewerImpl when markup mode is active.
 * The parent provides the canvas, page info, and zoom state.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import type { MarkupContext } from "./pdf-viewer";
import type {
  TakeoffTool,
  TakeoffMeasurement,
  TakeoffLayer,
  PageScale,
  CalibrationData,
  GeometryData,
  MeasurementSummary,
  MeasurementCreateOptions,
} from "@/components/takeoff/types";
import type { DetectedElement } from "@/components/takeoff/ElementDetector";

// Lazy-load TakeoffCanvas (pulls in Fabric.js ~500KB)
const TakeoffCanvas = dynamic(
  () => import("@/components/takeoff/TakeoffCanvas").then((mod) => mod.TakeoffCanvas),
  { ssr: false }
);
import { TakeoffToolbar } from "@/components/takeoff/TakeoffToolbar";

// =============================================================================
// Props
// =============================================================================

interface PdfMarkupOverlayProps {
  /** Markup context (document type + ID) */
  markupContext: MarkupContext;
  /** The rendered PDF page canvas from pdfjs */
  pdfPageCanvas: HTMLCanvasElement;
  /** Current page number (1-based) */
  pageNumber: number;
  /** Logical page width in CSS pixels */
  pageWidth: number;
  /** Logical page height in CSS pixels */
  pageHeight: number;
  /** Current zoom level from usePdfPanZoom */
  zoom: number;
  /** Max zoom from usePdfPanZoom */
  maxZoom: number;
  /** Zoom change handler from usePdfPanZoom */
  onZoomChange: (zoom: number) => void;
  /** Fit to view handler from usePdfPanZoom */
  onFitToView: () => void;
  /** Zoom to rectangle handler from usePdfPanZoom */
  onZoomToRect: (rect: { x: number; y: number; width: number; height: number }) => void;
  /** Pan state from usePdfPanZoom */
  isPanning: boolean;
  isSpaceHeld: boolean;
  /** Container ref for positioning calibration inputs */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

// =============================================================================
// API path builder
// =============================================================================

function apiBasePath(ctx: MarkupContext): string {
  switch (ctx.contextType) {
    case "warehouse_document":
      return `/api/v1/pdf_takeoff/warehouse_document/${ctx.contextId}`;
    case "document_inbox":
      return `/api/v1/pdf_takeoff/document_inbox/${ctx.contextId}`;
    case "job_plan":
      return `/api/v1/pdf_takeoff/plans/${ctx.contextId}`;
  }
}

// =============================================================================
// Component
// =============================================================================

export function PdfMarkupOverlay({
  markupContext,
  pdfPageCanvas,
  pageNumber,
  pageWidth,
  pageHeight,
  zoom,
  maxZoom,
  onZoomChange,
  onFitToView,
  onZoomToRect,
  isPanning,
  isSpaceHeld,
  containerRef,
}: PdfMarkupOverlayProps) {
  const { toast } = useToast();
  const basePath = apiBasePath(markupContext);

  // ── State ─────────────────────────────────────────────────────────────────

  const [measurements, setMeasurements] = React.useState<TakeoffMeasurement[]>([]);
  const [summary, setSummary] = React.useState<MeasurementSummary | null>(null);
  const [selectedMeasurement, setSelectedMeasurement] = React.useState<TakeoffMeasurement | null>(null);
  const [layers, setLayers] = React.useState<TakeoffLayer[]>([]);
  const [activeLayer, setActiveLayer] = React.useState<TakeoffLayer | null>(null);
  const [currentTool, setCurrentTool] = React.useState<TakeoffTool>("select");
  const [pageScales, setPageScales] = React.useState<PageScale[]>([]);

  // Current page scale
  const pageScale = React.useMemo(
    () => pageScales.find((ps) => ps.page_number === pageNumber) || null,
    [pageScales, pageNumber]
  );
  const isCalibrated = pageScale?.calibrated || false;

  // ── Data Fetching ─────────────────────────────────────────────────────────

  // Fetch initial data (page scales, measurements, layers)
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch document data (includes page_scales)
        const docResponse = await api.get<{
          success: boolean;
          data: { page_scales: PageScale[] };
        }>(basePath);
        if (docResponse?.success && docResponse?.data) {
          setPageScales(docResponse.data.page_scales);
        }
      } catch (err) {
        console.error("[PdfMarkup] Failed to fetch document data:", err);
      }
    };
    fetchData();
  }, [basePath]);

  const fetchMeasurements = React.useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: { measurements: TakeoffMeasurement[]; summary: MeasurementSummary };
      }>(`${basePath}/measurements`);
      if (response?.success && response?.data) {
        setMeasurements(response.data.measurements);
        setSummary(response.data.summary);
      }
    } catch (err) {
      console.error("[PdfMarkup] Failed to fetch measurements:", err);
    }
  }, [basePath]);

  const fetchLayers = React.useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: { layers: TakeoffLayer[] };
      }>(`${basePath}/layers`);
      if (response?.success && response?.data) {
        setLayers(response.data.layers);
      }
    } catch (err) {
      console.error("[PdfMarkup] Failed to fetch layers:", err);
    }
  }, [basePath]);

  React.useEffect(() => {
    fetchMeasurements();
    fetchLayers();
  }, [fetchMeasurements, fetchLayers]);

  // ── Calibration ───────────────────────────────────────────────────────────

  const handleCalibrate = React.useCallback(
    async (data: CalibrationData) => {
      try {
        const response = await api.post<{
          success: boolean;
          data: { page_scale: PageScale };
          error?: string;
        }>(`${basePath}/calibrate`, {
          page_number: pageNumber,
          reference_length_mm: data.referenceLengthMm,
          line_start_x: data.lineStart.x,
          line_start_y: data.lineStart.y,
          line_end_x: data.lineEnd.x,
          line_end_y: data.lineEnd.y,
          canvas_width: data.canvasWidth,
          canvas_height: data.canvasHeight,
        });

        if (response?.success && response?.data) {
          const ps = response.data.page_scale;
          setPageScales((prev) => {
            const idx = prev.findIndex((p) => p.page_number === pageNumber);
            const next = [...prev];
            if (idx >= 0) next[idx] = ps;
            else next.push(ps);
            return next;
          });
          toast({ title: "Scale Calibrated", description: `Scale set to ${ps.scale_label}` });
        } else {
          throw new Error(response?.error || "Failed to calibrate");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Calibration failed";
        toast({ title: "Calibration Failed", description: message, variant: "destructive" });
      }
    },
    [basePath, pageNumber, toast]
  );

  const handleClearCalibration = React.useCallback(async () => {
    try {
      await api.delete(`${basePath}/calibrate`, { params: { page_number: pageNumber } });
      setPageScales((prev) => prev.filter((ps) => ps.page_number !== pageNumber));
      toast({ title: "Calibration Cleared" });
    } catch (err) {
      console.error("[PdfMarkup] Failed to clear calibration:", err);
      toast({ title: "Failed to clear calibration", variant: "destructive" });
    }
  }, [basePath, pageNumber, toast]);

  // ── Measurements ──────────────────────────────────────────────────────────

  const handleMeasurementCreate = React.useCallback(
    async (
      type: TakeoffMeasurement["measurement_type"],
      geometryData: GeometryData,
      pixelValue: number,
      measurementPageNumber: number,
      options?: MeasurementCreateOptions
    ): Promise<TakeoffMeasurement | null> => {
      try {
        const response = await api.post<{
          success: boolean;
          data: { measurement: TakeoffMeasurement; summary: MeasurementSummary };
          error?: string;
        }>(`${basePath}/measurements`, {
          measurement: {
            measurement_type: type,
            pixel_value: pixelValue,
            page_number: measurementPageNumber,
            geometry_data: geometryData,
            takeoff_layer_id: activeLayer?.id,
            is_deduction: options?.isDeduction,
            parent_measurement_id: options?.parentMeasurementId,
          },
        });

        if (response?.success && response?.data) {
          const newM = response.data.measurement;
          setMeasurements((prev) => [...prev, newM]);
          setSummary(response.data.summary);
          toast({ title: "Measurement Added", description: `${type}: ${newM.formatted_value}` });
          return newM;
        } else {
          throw new Error(response?.error || "Failed to create measurement");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create measurement";
        toast({ title: "Error", description: message, variant: "destructive" });
        return null;
      }
    },
    [basePath, activeLayer, toast]
  );

  const handleCountPointAdd = React.useCallback(
    async (measurementId: number, point: { x: number; y: number }): Promise<TakeoffMeasurement | null> => {
      try {
        const response = await api.post<{
          success: boolean;
          data: TakeoffMeasurement;
        }>(`/api/v1/pdf_takeoff/measurements/${measurementId}/count_point`, {
          point: { x: point.x, y: point.y },
        });
        if (response?.success && response?.data) {
          setMeasurements((prev) => prev.map((m) => (m.id === measurementId ? response.data : m)));
          return response.data;
        }
        return null;
      } catch (err) {
        console.error("[PdfMarkup] Failed to add count point:", err);
        return null;
      }
    },
    []
  );

  const handleMovePoint = React.useCallback(
    async (measurementId: number, pointIndex: number, newPoint: { x: number; y: number }): Promise<void> => {
      try {
        const response = await api.patch<{
          success: boolean;
          data: TakeoffMeasurement;
        }>(`/api/v1/pdf_takeoff/measurements/${measurementId}/move_point`, {
          point_index: pointIndex,
          x: newPoint.x,
          y: newPoint.y,
        });
        if (response?.success && response?.data) {
          setMeasurements((prev) => prev.map((m) => (m.id === measurementId ? response.data : m)));
          if (selectedMeasurement?.id === measurementId) {
            setSelectedMeasurement(response.data);
          }
        }
      } catch (err) {
        console.error("[PdfMarkup] Failed to move point:", err);
      }
    },
    [selectedMeasurement]
  );

  const handleRemovePoint = React.useCallback(
    async (measurementId: number, pointIndex: number): Promise<void> => {
      try {
        const response = await api.delete<{
          success: boolean;
          data: TakeoffMeasurement | null;
        }>(`/api/v1/pdf_takeoff/measurements/${measurementId}/remove_point`, {
          params: { point_index: pointIndex },
        });
        if (response?.success) {
          if (response.data) {
            setMeasurements((prev) => prev.map((m) => (m.id === measurementId ? response.data! : m)));
          } else {
            setMeasurements((prev) => prev.filter((m) => m.id !== measurementId));
            if (selectedMeasurement?.id === measurementId) setSelectedMeasurement(null);
          }
        }
      } catch (err) {
        console.error("[PdfMarkup] Failed to remove point:", err);
      }
    },
    [selectedMeasurement]
  );

  const handleMeasurementDelete = React.useCallback(
    async (id: number) => {
      try {
        const response = await api.delete<{ success: boolean }>(`/api/v1/pdf_takeoff/measurements/${id}`);
        if (response?.success) {
          setMeasurements((prev) => prev.filter((m) => m.id !== id));
          if (selectedMeasurement?.id === id) setSelectedMeasurement(null);
          fetchMeasurements();
          toast({ title: "Measurement Deleted" });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete";
        toast({ title: "Error", description: message, variant: "destructive" });
      }
    },
    [selectedMeasurement, fetchMeasurements, toast]
  );

  const handleMeasurementSelect = React.useCallback(
    (measurement: TakeoffMeasurement | null) => {
      setSelectedMeasurement(measurement);
      if (measurement) setCurrentTool("select");
    },
    []
  );

  // ── Layers ────────────────────────────────────────────────────────────────

  const handleCreateLayer = React.useCallback(
    async (name: string, color: string) => {
      try {
        const response = await api.post<{
          success: boolean;
          data: TakeoffLayer;
        }>(`${basePath}/layers`, { layer: { name, color } });
        if (response?.success && response?.data) {
          setLayers((prev) => [...prev, response.data]);
          setActiveLayer(response.data);
        }
      } catch (err) {
        console.error("[PdfMarkup] Failed to create layer:", err);
        toast({ title: "Error", description: "Failed to create layer", variant: "destructive" });
      }
    },
    [basePath, toast]
  );

  const handleUpdateLayer = React.useCallback(
    async (id: number, updates: Partial<TakeoffLayer>) => {
      try {
        await api.patch(`/api/v1/pdf_takeoff/layers/${id}`, { layer: updates });
        setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
        if (activeLayer?.id === id) setActiveLayer((prev) => (prev ? { ...prev, ...updates } : prev));
      } catch (err) {
        console.error("[PdfMarkup] Failed to update layer:", err);
      }
    },
    [activeLayer]
  );

  const handleDeleteLayer = React.useCallback(
    async (id: number) => {
      try {
        const response = await api.delete<{ success: boolean }>(`/api/v1/pdf_takeoff/layers/${id}`);
        if (response?.success) {
          setLayers((prev) => prev.filter((l) => l.id !== id));
          if (activeLayer?.id === id) setActiveLayer(null);
          fetchMeasurements();
        }
      } catch (err) {
        console.error("[PdfMarkup] Failed to delete layer:", err);
      }
    },
    [activeLayer, fetchMeasurements]
  );

  const handleToggleLayerVisibility = React.useCallback(
    async (id: number, visible: boolean) => {
      setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible } : l)));
      if (activeLayer?.id === id) setActiveLayer((prev) => (prev ? { ...prev, visible } : prev));
    },
    [activeLayer]
  );

  const handleToggleLayerLock = React.useCallback(
    async (id: number, locked: boolean) => {
      setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, locked } : l)));
      if (activeLayer?.id === id) setActiveLayer((prev) => (prev ? { ...prev, locked } : prev));
    },
    [activeLayer]
  );

  // ── AI Detection stubs ────────────────────────────────────────────────────

  const handleScaleDetected = React.useCallback(
    (_scaleText: string, _referenceMm: number) => {
      toast({ title: "Scale Detected", description: "Please draw a calibration line to confirm." });
      setCurrentTool("calibrate");
    },
    [toast]
  );

  const handleElementsDetected = React.useCallback(
    (_elements: DetectedElement[]) => {
      toast({ title: "Element detection not yet supported in markup mode" });
    },
    [toast]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar — rendered absolutely at top of PDF viewer */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <TakeoffToolbar
          currentTool={currentTool}
          onToolChange={setCurrentTool}
          zoom={zoom}
          maxZoom={maxZoom}
          onZoomChange={onZoomChange}
          onFitToView={onFitToView}
          activeLayer={activeLayer}
          layers={layers}
          onLayerChange={setActiveLayer}
          onCreateLayer={handleCreateLayer}
          onUpdateLayer={handleUpdateLayer}
          onDeleteLayer={handleDeleteLayer}
          onToggleLayerVisibility={handleToggleLayerVisibility}
          onToggleLayerLock={handleToggleLayerLock}
          isCalibrated={isCalibrated}
          scaleLabel={pageScale?.scale_label}
          pageCanvas={pdfPageCanvas}
          pageNumber={pageNumber}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          onScaleDetected={handleScaleDetected}
          onElementsDetected={handleElementsDetected}
        />
      </div>

      {/* TakeoffCanvas overlay — same size as the PDF page */}
      <TakeoffCanvas
        pdfPage={pdfPageCanvas}
        pageNumber={pageNumber}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        pageScale={pageScale}
        onCalibrate={handleCalibrate}
        onClearCalibration={handleClearCalibration}
        measurements={measurements.filter((m) => m.page_number === pageNumber)}
        onMeasurementCreate={handleMeasurementCreate}
        onCountPointAdd={handleCountPointAdd}
        onMovePoint={handleMovePoint}
        onRemovePoint={handleRemovePoint}
        onMeasurementDelete={handleMeasurementDelete}
        onMeasurementSelect={handleMeasurementSelect}
        selectedMeasurement={selectedMeasurement}
        activeLayer={activeLayer}
        layers={layers}
        currentTool={currentTool}
        zoom={zoom}
        containerRef={containerRef}
        isPanning={isPanning}
        isSpaceHeld={isSpaceHeld}
        onZoomToRect={onZoomToRect}
      />
    </>
  );
}
