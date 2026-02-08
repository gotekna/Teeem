"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { PdfChrome } from "@/components/ui/pdf-chrome";
import { ChevronUp, ChevronDown, ChevronLeft } from "lucide-react";
import { useBreadcrumbContext } from "@/contexts/BreadcrumbContext";
import { useLayoutMode } from "@/contexts/LayoutModeContext";

// Takeoff components
import { TakeoffCanvas } from "@/components/takeoff/TakeoffCanvas";
import { TakeoffToolbar } from "@/components/takeoff/TakeoffToolbar";
import { TakeoffSidebar } from "@/components/takeoff/TakeoffSidebar";
import { PricebookSelector } from "@/components/takeoff/PricebookSelector";
import { useTakeoffPdf } from "@/components/takeoff/useTakeoffPdf";
import { usePdfPanZoom } from "@/hooks/usePdfPanZoom";
import { RoomChecklist } from "@/components/takeoff/RoomChecklist";
import type {
  TakeoffTool,
  TakeoffMeasurement,
  TakeoffLayer,
  TakeoffRoomInstance,
  TakeoffRoomSlot,
  PageScale,
  CalibrationData,
  GeometryData,
  MeasurementSummary,
  MeasurementCreateOptions,
} from "@/components/takeoff/types";
import type { DetectedElement } from "@/components/takeoff/ElementDetector";
import type { TakeoffTemplate as RoomTemplate } from "@/components/takeoff/RoomManager";

// =============================================================================
// Types
// =============================================================================

interface DocsortTakeoffResponse {
  docsort_item: {
    id: number;
    display_name: string;
    document_type: string | null;
    original_filename: string | null;
  };
  download_url: string | null;
  page_scales: PageScale[];
}

// =============================================================================
// Page Component
// =============================================================================

export default function DocsortTakeoffPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const itemId = params.itemId as string;
  const { setDisplayName } = useBreadcrumbContext();
  const { setMode } = useLayoutMode();

  // Edge-to-edge layout for takeoff (no padding around toolbar/canvas)
  React.useEffect(() => {
    setMode("edge-to-edge");
    return () => setMode("padded");
  }, [setMode]);

  // Plan data
  const [itemData, setItemData] = React.useState<DocsortTakeoffResponse | null>(null);
  const [isLoadingItem, setIsLoadingItem] = React.useState(true);
  const [itemError, setItemError] = React.useState<string | null>(null);

  // Measurements
  const [measurements, setMeasurements] = React.useState<TakeoffMeasurement[]>([]);
  const [summary, setSummary] = React.useState<MeasurementSummary | null>(null);
  const [selectedMeasurement, setSelectedMeasurement] = React.useState<TakeoffMeasurement | null>(null);

  // Layers - persisted to backend via /api/v1/pdf_takeoff/docsort/:id/layers
  const [layers, setLayers] = React.useState<TakeoffLayer[]>([]);
  // null = "All" view (shows all layers, saves to default layer)
  const [activeLayer, setActiveLayer] = React.useState<TakeoffLayer | null>(null);

  // Tool state
  const [currentTool, setCurrentTool] = React.useState<TakeoffTool>("select");

  // Room instances
  const [rooms, setRooms] = React.useState<TakeoffRoomInstance[]>([]);
  const [activeRoom, setActiveRoom] = React.useState<TakeoffRoomInstance | null>(null);
  const [activeSlotId, setActiveSlotId] = React.useState<number | null>(null);
  const [roomTemplates, setRoomTemplates] = React.useState<RoomTemplate[]>([]);
  const [sidebarMode, setSidebarMode] = React.useState<"measurements" | "room">("measurements");

  // Pricebook selector state
  const [pricebookSelectorOpen, setPricebookSelectorOpen] = React.useState(false);
  const [measurementForPricebook, setMeasurementForPricebook] = React.useState<TakeoffMeasurement | null>(null);

  // Sidebar state - pinned persists to localStorage
  const [sidebarPinned, setSidebarPinned] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('takeoff-sidebar-pinned') === 'true';
  });
  const [sidebarOpen, setSidebarOpen] = React.useState(sidebarPinned);

  const handleToggleSidebar = () => setSidebarOpen(prev => !prev);
  const handlePinSidebar = (pinned: boolean) => {
    setSidebarPinned(pinned);
    localStorage.setItem('takeoff-sidebar-pinned', String(pinned));
    if (pinned) setSidebarOpen(true);
  };

  // PDF loading - hook owns currentPageNumber state
  // Fall back to demo PDF for local testing when storage provider is disconnected
  const pdfUrl = itemData?.download_url || (itemData ? "/demo/floor-plan.pdf" : null);
  const { pages, currentPage, pageCount, isLoading: isLoadingPdf, error: pdfError, setCurrentPageNumber, currentPageNumber } = useTakeoffPdf(pdfUrl);

  // Get current page scale
  const pageScale = React.useMemo(() => {
    return itemData?.page_scales.find((ps) => ps.page_number === currentPageNumber) || null;
  }, [itemData, currentPageNumber]);

  // Pan/zoom — SSoT hook for all PDF interaction (zoom, fit-to-view, pan, scroll-wheel zoom)
  const { zoom, effectiveMaxZoom, onZoomChange: handleZoomChange, onFitToView: handleFitToView, zoomToRect, containerRef: canvasContainerRef, isPanning, isSpaceHeld } = usePdfPanZoom({
    pageWidth: currentPage?.width ?? 0,
    pageHeight: currentPage?.height ?? 0,
    panToolActive: currentTool === "pan",
  });

  // =============================================================================
  // Data Fetching
  // =============================================================================

  // Fetch docsort item data
  React.useEffect(() => {
    const fetchItem = async () => {
      try {
        setIsLoadingItem(true);
        setItemError(null);

        const response = await api.get<{ success: boolean; data: DocsortTakeoffResponse; error?: string }>(
          `/api/v1/pdf_takeoff/docsort/${itemId}`
        );

        if (response?.success && response?.data) {
          setItemData(response.data);
        } else {
          throw new Error(response?.error || "Failed to load document");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load document";
        setItemError(message);
        console.error("Failed to load docsort item for takeoff:", err);
      } finally {
        setIsLoadingItem(false);
      }
    };

    if (itemId) {
      fetchItem();
    }
  }, [itemId]);

  // Fetch measurements
  const fetchMeasurements = React.useCallback(async () => {
    if (!itemId) return;

    try {
      const response = await api.get<{
        success: boolean;
        data: { measurements: TakeoffMeasurement[]; summary: MeasurementSummary };
      }>(`/api/v1/pdf_takeoff/docsort/${itemId}/measurements`);

      if (response?.success && response?.data) {
        setMeasurements(response.data.measurements);
        setSummary(response.data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch measurements:", err);
    }
  }, [itemId]);

  // Fetch room instances
  const fetchRooms = React.useCallback(async () => {
    if (!itemId) return;
    try {
      const response = await api.get<{
        success: boolean;
        data: TakeoffRoomInstance[];
      }>(`/api/v1/pdf_takeoff/docsort/${itemId}/rooms`);
      if (response?.success && response?.data) {
        setRooms(response.data);
        if (activeRoom) {
          const updated = response.data.find((r) => r.id === activeRoom.id);
          if (updated) setActiveRoom(updated);
        }
      }
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    }
  }, [itemId, activeRoom]);

  // Fetch templates
  const fetchTemplates = React.useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: Array<{ id: number; name: string; category: string | null; configuration: { steps: unknown[] } }>;
      }>("/api/v1/pdf_takeoff/templates");
      if (response?.success && response?.data) {
        setRoomTemplates(
          response.data.map((t) => ({
            id: t.id,
            name: t.name,
            category: t.category,
            step_count: t.configuration?.steps?.length || 0,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    }
  }, []);

  // Initial data fetch
  React.useEffect(() => {
    fetchMeasurements();
    fetchRooms();
    fetchTemplates();
  }, [fetchMeasurements, fetchRooms, fetchTemplates]);

  // =============================================================================
  // Room Management Handlers
  // =============================================================================

  const handleRoomChange = React.useCallback(
    (room: TakeoffRoomInstance | null) => {
      setActiveRoom(room);
      setActiveSlotId(null);
      setSidebarMode(room ? "room" : "measurements");
      if (room) setSidebarOpen(true);
    },
    []
  );

  const handleCreateRoom = React.useCallback(
    async (templateId: number, name?: string) => {
      if (!itemId) return;
      try {
        const response = await api.post<{
          success: boolean;
          data: TakeoffRoomInstance;
          error?: string;
        }>(`/api/v1/pdf_takeoff/docsort/${itemId}/rooms`, {
          template_id: templateId,
          name,
        });
        if (response?.success && response?.data) {
          const newRoom = response.data;
          setRooms((prev) => [...prev, newRoom]);
          handleRoomChange(newRoom);
          toast({ title: "Room Created", description: newRoom.name });
        } else {
          throw new Error(response?.error || "Failed to create room");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create room";
        toast({ title: "Error", description: message, variant: "destructive" });
        throw err;
      }
    },
    [itemId, toast, handleRoomChange]
  );

  const handleUpdateRoom = React.useCallback(
    async (id: number, updates: { name?: string; status?: string; notes?: string }) => {
      try {
        const response = await api.patch<{
          success: boolean;
          data: TakeoffRoomInstance;
          error?: string;
        }>(`/api/v1/pdf_takeoff/rooms/${id}`, updates);
        if (response?.success && response?.data) {
          const updatedRoom = response.data;
          setRooms((prev) => prev.map((r) => (r.id === id ? updatedRoom : r)));
          if (activeRoom?.id === id) setActiveRoom(updatedRoom);
        } else {
          throw new Error(response?.error || "Failed to update room");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update room";
        toast({ title: "Error", description: message, variant: "destructive" });
        throw err;
      }
    },
    [activeRoom, toast]
  );

  const handleDeleteRoom = React.useCallback(
    async (id: number) => {
      try {
        const response = await api.delete<{ success: boolean; error?: string }>(
          `/api/v1/pdf_takeoff/rooms/${id}`
        );
        if (response?.success) {
          setRooms((prev) => prev.filter((r) => r.id !== id));
          if (activeRoom?.id === id) handleRoomChange(null);
          toast({ title: "Room Deleted" });
        } else {
          throw new Error(response?.error || "Failed to delete room");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete room";
        toast({ title: "Error", description: message, variant: "destructive" });
        throw err;
      }
    },
    [activeRoom, toast, handleRoomChange]
  );

  const handleSlotSelect = React.useCallback(
    (slot: TakeoffRoomSlot | null) => {
      if (!slot) {
        setActiveSlotId(null);
        return;
      }
      setActiveSlotId(slot.id);
      const toolMap: Record<string, TakeoffTool> = {
        count: "count",
        area: "area",
        linear: "linear",
        perimeter: "perimeter",
      };
      const tool = toolMap[slot.measurement_type];
      if (tool) setCurrentTool(tool);
    },
    []
  );

  const handleSlotClear = React.useCallback(
    async (slotId: number) => {
      if (!activeRoom) return;
      try {
        const response = await api.delete<{
          success: boolean;
          data: TakeoffRoomInstance;
        }>(`/api/v1/pdf_takeoff/rooms/${activeRoom.id}/slots/${slotId}/fill`);
        if (response?.success && response?.data) {
          const updatedRoom = response.data;
          setActiveRoom(updatedRoom);
          setRooms((prev) => prev.map((r) => (r.id === updatedRoom.id ? updatedRoom : r)));
        }
      } catch (err) {
        console.error("Failed to clear slot:", err);
      }
    },
    [activeRoom]
  );

  const handleSlotAssignPricebook = React.useCallback(
    (slotId: number) => {
      toast({ title: "Pricebook", description: "Use template to pre-assign pricebook items to slots" });
    },
    [toast]
  );

  const handleRoomMarkComplete = React.useCallback(
    () => {
      if (!activeRoom) return;
      const newStatus = activeRoom.status === "complete" ? "in_progress" : "complete";
      handleUpdateRoom(activeRoom.id, { status: newStatus });
    },
    [activeRoom, handleUpdateRoom]
  );

  // =============================================================================
  // Layer Management (Backend-persisted)
  // =============================================================================

  // Fetch layers from backend
  const fetchLayers = React.useCallback(async () => {
    if (!itemId) return;
    try {
      const response = await api.get<{
        success: boolean;
        data: { layers: TakeoffLayer[] };
      }>(`/api/v1/pdf_takeoff/docsort/${itemId}/layers`);

      if (response?.success && response?.data) {
        setLayers(response.data.layers);
      }
    } catch (err) {
      console.error("Failed to fetch layers:", err);
    }
  }, [itemId]);

  // Fetch layers on mount
  React.useEffect(() => {
    fetchLayers();
  }, [fetchLayers]);

  // Create layer
  const handleCreateLayer = React.useCallback(
    async (name: string, color: string) => {
      if (!itemId) return;
      try {
        const response = await api.post<{
          success: boolean;
          data: TakeoffLayer;
        }>(`/api/v1/pdf_takeoff/docsort/${itemId}/layers`, {
          layer: { name, color },
        });

        if (response?.success && response?.data) {
          const newLayer = response.data;
          setLayers((prev) => [...prev, newLayer]);
          setActiveLayer(newLayer);
        }
      } catch (err) {
        console.error("Failed to create layer:", err);
        toast({ title: "Error", description: "Failed to create layer", variant: "destructive" });
      }
    },
    [itemId, toast]
  );

  // Update layer
  const handleUpdateLayer = React.useCallback(
    async (id: number, updates: Partial<TakeoffLayer>) => {
      try {
        const response = await api.patch<{
          success: boolean;
          data: TakeoffLayer;
        }>(`/api/v1/pdf_takeoff/layers/${id}`, {
          layer: updates,
        });

        if (response?.success) {
          setLayers((prev) =>
            prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
          );
          if (activeLayer?.id === id) {
            setActiveLayer((prev) => (prev ? { ...prev, ...updates } : prev));
          }
        }
      } catch (err) {
        console.error("Failed to update layer:", err);
      }
    },
    [activeLayer]
  );

  // Delete layer
  const handleDeleteLayer = React.useCallback(
    async (id: number) => {
      try {
        const response = await api.delete<{ success: boolean }>(
          `/api/v1/pdf_takeoff/layers/${id}`
        );

        if (response?.success) {
          setLayers((prev) => {
            const remaining = prev.filter((l) => l.id !== id);
            if (activeLayer?.id === id) {
              setActiveLayer(null);
            }
            return remaining;
          });
          // Refresh measurements since deleted layer's measurements move to default
          fetchMeasurements();
        }
      } catch (err) {
        console.error("Failed to delete layer:", err);
      }
    },
    [activeLayer, fetchMeasurements]
  );

  // Toggle layer visibility (local only - doesn't need backend persistence)
  const handleToggleLayerVisibility = React.useCallback(
    async (id: number, visible: boolean) => {
      setLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, visible } : l))
      );
      if (activeLayer?.id === id) {
        setActiveLayer((prev) => (prev ? { ...prev, visible } : prev));
      }
    },
    [activeLayer]
  );

  // Toggle layer lock (local only - doesn't need backend persistence)
  const handleToggleLayerLock = React.useCallback(
    async (id: number, locked: boolean) => {
      setLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, locked } : l))
      );
      if (activeLayer?.id === id) {
        setActiveLayer((prev) => (prev ? { ...prev, locked } : prev));
      }
    },
    [activeLayer]
  );

  // =============================================================================
  // Handlers
  // =============================================================================

  // Handle AI scale detection result
  const handleScaleDetected = React.useCallback(
    async (scaleText: string, referenceMm: number) => {
      // Update page scale with AI-detected values
      if (!itemId) return;

      // The AI gives us the scale text and suggested reference length
      // Prompt user to draw a calibration line to confirm
      toast({
        title: "Scale Detected",
        description: `Detected scale: ${scaleText}. Please draw a calibration line to confirm.`,
      });

      // Set tool to calibrate mode
      setCurrentTool("calibrate");
    },
    [itemId, toast]
  );

  // Calibrate scale
  const handleCalibrate = React.useCallback(
    async (data: CalibrationData) => {
      if (!itemId) return;

      try {
        const response = await api.post<{
          success: boolean;
          data: { page_scale: PageScale };
          error?: string;
        }>(`/api/v1/pdf_takeoff/docsort/${itemId}/calibrate`, {
          page_number: currentPageNumber,
          reference_length_mm: data.referenceLengthMm,
          line_start_x: data.lineStart.x,
          line_start_y: data.lineStart.y,
          line_end_x: data.lineEnd.x,
          line_end_y: data.lineEnd.y,
          canvas_width: data.canvasWidth,
          canvas_height: data.canvasHeight,
        });

        if (response?.success && response?.data) {
          const pageScaleData = response.data.page_scale;
          // Update page scales in item data
          setItemData((prev) => {
            if (!prev) return prev;
            const existingIndex = prev.page_scales.findIndex(
              (ps) => ps.page_number === currentPageNumber
            );
            const newScales = [...prev.page_scales];
            if (existingIndex >= 0) {
              newScales[existingIndex] = pageScaleData;
            } else {
              newScales.push(pageScaleData);
            }
            return { ...prev, page_scales: newScales };
          });

          toast({
            title: "Scale Calibrated",
            description: `Scale set to ${pageScaleData.scale_label}`,
          });

          // Stay in calibrate mode so user can immediately verify with other dimensions
          // (magnifiers + "verify accuracy" prompt remain visible)
        } else {
          throw new Error(response?.error || "Failed to calibrate");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Calibration failed";
        toast({
          title: "Calibration Failed",
          description: message,
          variant: "destructive",
        });
      }
    },
    [itemId, currentPageNumber, toast]
  );

  const handleClearCalibration = React.useCallback(
    async () => {
      if (!itemId) return;
      try {
        await api.delete(`/api/v1/pdf_takeoff/docsort/${itemId}/calibrate`, {
          params: { page_number: currentPageNumber },
        });
        // Clear page scale locally
        setItemData((prev) => {
          if (!prev) return prev;
          const newScales = prev.page_scales.filter(
            (ps) => ps.page_number !== currentPageNumber
          );
          return { ...prev, page_scales: newScales };
        });
        toast({ title: "Calibration Cleared", description: "You can now recalibrate from scratch." });
      } catch {
        toast({ title: "Failed to clear calibration", variant: "destructive" });
      }
    },
    [itemId, currentPageNumber, toast]
  );

  // Create measurement — returns the created measurement for count accumulation
  const handleMeasurementCreate = React.useCallback(
    async (
      type: TakeoffMeasurement["measurement_type"],
      geometryData: GeometryData,
      pixelValue: number,
      pageNumber: number,
      options?: MeasurementCreateOptions
    ): Promise<TakeoffMeasurement | null> => {
      if (!itemId) return null;

      try {
        const response = await api.post<{
          success: boolean;
          data: { measurement: TakeoffMeasurement; summary: MeasurementSummary };
          error?: string;
        }>(`/api/v1/pdf_takeoff/docsort/${itemId}/measurements`, {
          measurement: {
            measurement_type: type,
            pixel_value: pixelValue,
            page_number: pageNumber,
            geometry_data: geometryData,
            takeoff_layer_id: activeLayer?.id,
            is_deduction: options?.isDeduction,
            parent_measurement_id: options?.parentMeasurementId,
          },
        });

        if (response?.success && response?.data) {
          const measurementData = response.data;
          const newMeasurement = measurementData.measurement;
          setMeasurements((prev) => [...prev, newMeasurement]);
          setSummary(measurementData.summary);

          // If a room slot is active, fill it with this measurement
          if (activeRoom && activeSlotId) {
            try {
              const fillResponse = await api.post<{
                success: boolean;
                data: TakeoffRoomInstance;
              }>(`/api/v1/pdf_takeoff/rooms/${activeRoom.id}/slots/${activeSlotId}/fill`, {
                measurement_id: newMeasurement.id,
              });
              if (fillResponse?.success && fillResponse?.data) {
                const updatedRoom = fillResponse.data;
                setActiveRoom(updatedRoom);
                setRooms((prev) => prev.map((r) => (r.id === updatedRoom.id ? updatedRoom : r)));
                // Auto-advance to next unfilled slot
                const nextUnfilled = updatedRoom.slots.find((s) => !s.is_filled);
                if (nextUnfilled) {
                  handleSlotSelect(nextUnfilled);
                } else {
                  setActiveSlotId(null);
                  setCurrentTool("select");
                }
              }
            } catch (err) {
              console.error("Failed to fill slot:", err);
            }
          }

          toast({
            title: "Measurement Added",
            description: `${type}: ${newMeasurement.formatted_value}`,
          });
          return newMeasurement;
        } else {
          throw new Error(response?.error || "Failed to create measurement");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create measurement";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        return null;
      }
    },
    [itemId, activeLayer, activeRoom, activeSlotId, handleSlotSelect, toast]
  );

  // Add point to existing count measurement
  const handleCountPointAdd = React.useCallback(
    async (measurementId: number, point: { x: number; y: number }): Promise<TakeoffMeasurement | null> => {
      try {
        const response = await api.post<{
          success: boolean;
          data: TakeoffMeasurement;
          error?: string;
        }>(`/api/v1/pdf_takeoff/measurements/${measurementId}/count_point`, {
          point: { x: point.x, y: point.y },
        });

        if (response?.success && response?.data) {
          const updated = response.data;
          setMeasurements((prev) =>
            prev.map((m) => (m.id === measurementId ? updated : m))
          );
          return updated;
        }
        return null;
      } catch (err) {
        console.error("Failed to add count point:", err);
        return null;
      }
    },
    []
  );

  // Move a vertex/point to a new position — keeps measurement selected after
  const handleMovePoint = React.useCallback(
    async (measurementId: number, pointIndex: number, newPoint: { x: number; y: number }): Promise<void> => {
      try {
        const response = await api.patch<{
          success: boolean;
          data: TakeoffMeasurement;
          error?: string;
        }>(`/api/v1/pdf_takeoff/measurements/${measurementId}/move_point`, {
          point_index: pointIndex,
          x: newPoint.x,
          y: newPoint.y,
        });

        if (response?.success && response?.data) {
          const updated = response.data;
          setMeasurements((prev) =>
            prev.map((m) => (m.id === measurementId ? updated : m))
          );
          // Keep it selected so user can immediately adjust another vertex
          setSelectedMeasurement(updated);
        }
      } catch (err) {
        console.error("Failed to move point:", err);
      }
    },
    []
  );

  // Remove a single point from a count measurement (Delete key while repositioning)
  const handleRemovePoint = React.useCallback(
    async (measurementId: number, pointIndex: number): Promise<void> => {
      try {
        const response = await api.delete<{
          success: boolean;
          data: TakeoffMeasurement | { deleted: boolean };
        }>(`/api/v1/pdf_takeoff/measurements/${measurementId}/remove_point`, {
          params: { point_index: pointIndex },
        });

        if (response?.success) {
          if ("deleted" in response.data && response.data.deleted) {
            // Last point removed — measurement was deleted
            setMeasurements((prev) => prev.filter((m) => m.id !== measurementId));
            setSelectedMeasurement(null);
          } else {
            // Point removed, measurement still exists with fewer points
            const updated = response.data as TakeoffMeasurement;
            setMeasurements((prev) =>
              prev.map((m) => (m.id === measurementId ? updated : m))
            );
            setSelectedMeasurement(updated);
          }
        }
      } catch (err) {
        console.error("Failed to remove point:", err);
      }
    },
    []
  );

  // Handle AI element detection result
  const handleElementsDetected = React.useCallback(
    async (elements: DetectedElement[]) => {
      if (!itemId || !currentPage) return;

      // Convert detected elements to measurements
      let added = 0;
      for (const element of elements) {
        try {
          // Calculate pixel value from normalized bbox
          const pixelWidth = element.bbox.width * currentPage.width;
          const pixelHeight = element.bbox.height * currentPage.height;

          // Determine measurement type based on element type
          let measurementType: TakeoffMeasurement["measurement_type"] = "length";
          let pixelValue = 0;

          if (element.type === "wall" || element.type === "beam") {
            measurementType = "length";
            pixelValue = Math.sqrt(pixelWidth ** 2 + pixelHeight ** 2);
          } else if (element.type === "door" || element.type === "window" || element.type === "opening") {
            measurementType = "length";
            pixelValue = Math.max(pixelWidth, pixelHeight);
          } else if (element.type === "stair") {
            measurementType = "area";
            pixelValue = pixelWidth * pixelHeight;
          } else if (element.type === "column") {
            measurementType = "count";
            pixelValue = 1;
          }

          // Create geometry from bbox
          const geometryData: GeometryData = {
            type: element.points.length > 0 ? "polygon" : "line",
            points: element.points.length > 0
              ? element.points.map(p => ({
                  x: p.x * currentPage.width,
                  y: p.y * currentPage.height
                }))
              : [
                  { x: element.bbox.x * currentPage.width, y: element.bbox.y * currentPage.height },
                  { x: (element.bbox.x + element.bbox.width) * currentPage.width, y: (element.bbox.y + element.bbox.height) * currentPage.height }
                ],
            canvasWidth: currentPage.width,
            canvasHeight: currentPage.height,
          };

          // Create measurement
          await handleMeasurementCreate(
            measurementType,
            geometryData,
            pixelValue,
            currentPageNumber
          );
          added++;
        } catch (err) {
          console.error(`Failed to create measurement for element ${element.id}:`, err);
        }
      }

      toast({
        title: "Elements Added",
        description: `Created ${added} measurement${added !== 1 ? "s" : ""} from detected elements`,
      });
    },
    [itemId, currentPage, currentPageNumber, handleMeasurementCreate, toast]
  );

  // Select measurement — auto-switch to select tool so vertex handles appear
  const handleMeasurementSelect = React.useCallback(
    (measurement: TakeoffMeasurement | null) => {
      setSelectedMeasurement(measurement);
      if (measurement) {
        setCurrentTool("select");
      }
    },
    []
  );

  // Delete measurement
  const handleMeasurementDelete = React.useCallback(
    async (id: number) => {
      try {
        const response = await api.delete<{ success: boolean; error?: string }>(
          `/api/v1/pdf_takeoff/measurements/${id}`
        );

        if (response?.success) {
          setMeasurements((prev) => prev.filter((m) => m.id !== id));
          if (selectedMeasurement?.id === id) {
            setSelectedMeasurement(null);
          }
          // Refresh summary
          fetchMeasurements();

          toast({
            title: "Measurement Deleted",
          });
        } else {
          throw new Error(response?.error || "Failed to delete");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete measurement";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      }
    },
    [selectedMeasurement, fetchMeasurements, toast]
  );

  // Rename a measurement (update category)
  const handleRenameMeasurement = React.useCallback(
    async (id: number, name: string) => {
      try {
        const response = await api.patch<{
          success: boolean;
          data: TakeoffMeasurement;
        }>(`/api/v1/pdf_takeoff/measurements/${id}`, {
          category: name || null,
        });
        if (response?.success && response?.data) {
          setMeasurements((prev) =>
            prev.map((m) => (m.id === id ? { ...response.data } : m))
          );
        }
      } catch {
        toast({ title: "Error", description: "Failed to rename measurement", variant: "destructive" });
      }
    },
    [toast]
  );

  // Open pricebook selector for a measurement
  const handleAssignPricebook = React.useCallback(
    (measurementId: number) => {
      const measurement = measurements.find((m) => m.id === measurementId);
      if (measurement) {
        setMeasurementForPricebook(measurement);
        setPricebookSelectorOpen(true);
      }
    },
    [measurements]
  );

  // Assign pricebook item to measurement
  const handlePricebookSelect = React.useCallback(
    async (pricebookItem: { id: number; code: string; name: string; current_price: number | null }) => {
      if (!measurementForPricebook) return;

      try {
        const response = await api.patch<{
          success: boolean;
          data: TakeoffMeasurement;
          error?: string;
        }>(`/api/v1/pdf_takeoff/measurements/${measurementForPricebook.id}`, {
          pricebook_item_id: pricebookItem.id,
        });

        if (response?.success && response?.data) {
          setMeasurements((prev) =>
            prev.map((m) => (m.id === measurementForPricebook.id ? { ...response.data } : m))
          );
          if (selectedMeasurement?.id === measurementForPricebook.id) {
            setSelectedMeasurement((prev) => prev ? { ...response.data, layer: prev.layer } : response.data);
          }
          fetchMeasurements();

          toast({
            title: "Pricebook Item Assigned",
            description: `${pricebookItem.code} - ${pricebookItem.name}`,
          });
        } else {
          throw new Error(response?.error || "Failed to assign");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to assign pricebook item";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        throw err;
      }
    },
    [measurementForPricebook, selectedMeasurement, fetchMeasurements, toast]
  );

  // Clear pricebook item from measurement
  const handlePricebookClear = React.useCallback(async () => {
    if (!measurementForPricebook) return;

    try {
      const response = await api.patch<{
        success: boolean;
        data: TakeoffMeasurement;
        error?: string;
      }>(`/api/v1/pdf_takeoff/measurements/${measurementForPricebook.id}`, {
        pricebook_item_id: null,
      });

      if (response?.success && response?.data) {
        setMeasurements((prev) =>
          prev.map((m) => (m.id === measurementForPricebook.id ? { ...response.data } : m))
        );
        if (selectedMeasurement?.id === measurementForPricebook.id) {
          setSelectedMeasurement((prev) => prev ? { ...response.data, layer: prev.layer } : response.data);
        }
        fetchMeasurements();

        toast({
          title: "Pricebook Item Removed",
        });
      } else {
        throw new Error(response?.error || "Failed to clear");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear pricebook item";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      throw err;
    }
  }, [measurementForPricebook, selectedMeasurement, fetchMeasurements, toast]);

  // Generate purchase order - not available for standalone takeoff
  const handleGeneratePO = React.useCallback(async () => {
    toast({
      title: "Route to Job First",
      description: "Route this document to a job to generate a purchase order",
    });
  }, [toast]);

  // Set filename in breadcrumb to save a header row
  const breadcrumbName = itemData?.docsort_item.display_name;
  React.useEffect(() => {
    if (breadcrumbName) {
      setDisplayName(`${breadcrumbName} - Takeoff`);
    }
  }, [breadcrumbName, setDisplayName]);

  // =============================================================================
  // Render
  // =============================================================================

  // Loading state
  if (isLoadingItem) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Spinner size={32} className="mb-2" />
          <p className="text-sm text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (itemError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-lg font-medium text-destructive">Failed to load document</p>
        <p className="text-sm text-muted-foreground">{itemError}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const displayName = itemData?.docsort_item.display_name || "Document";
  const isCalibrated = pageScale?.calibrated || false;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <TakeoffToolbar
        currentTool={currentTool}
        onToolChange={setCurrentTool}
        zoom={zoom}
        maxZoom={effectiveMaxZoom}
        onZoomChange={handleZoomChange}
        onFitToView={handleFitToView}
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
        pageCanvas={currentPage?.canvas || null}
        pageNumber={currentPageNumber}
        pageWidth={currentPage?.width || 0}
        pageHeight={currentPage?.height || 0}
        docsortItemId={itemId}
        onScaleDetected={handleScaleDetected}
        onElementsDetected={handleElementsDetected}
        rooms={rooms}
        activeRoom={activeRoom}
        onRoomChange={handleRoomChange}
        onCreateRoom={handleCreateRoom}
        onUpdateRoom={handleUpdateRoom}
        onDeleteRoom={handleDeleteRoom}
        roomTemplates={roomTemplates}
        pdfUrl={pdfUrl}
        onSyncComplete={fetchMeasurements}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnails sidebar */}
        <div className="w-24 border-r bg-muted/30 flex flex-col">
          <div className="p-2 border-b text-xs font-medium text-muted-foreground flex items-center justify-between">
            <span>Pages</span>
            {pageCount > 1 && (
              <span className="text-[10px]">{currentPageNumber}/{pageCount}</span>
            )}
          </div>
          {/* Prev page arrow */}
          {pageCount > 1 && (
            <button
              onClick={() => setCurrentPageNumber(Math.max(1, currentPageNumber - 1))}
              disabled={currentPageNumber <= 1}
              className="flex items-center justify-center py-1 border-b hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {pages.map((page) => (
                <button
                  key={page.pageNumber}
                  onClick={() => setCurrentPageNumber(page.pageNumber)}
                  className={cn(
                    "w-full aspect-[3/4] rounded border-2 overflow-hidden",
                    page.pageNumber === currentPageNumber
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  )}
                >
                  <img
                    src={page.thumbnail}
                    alt={`Page ${page.pageNumber}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
              {isLoadingPdf && (
                <div className="flex justify-center py-4">
                  <Spinner size={16} />
                </div>
              )}
            </div>
          </ScrollArea>
          {/* Next page arrow */}
          {pageCount > 1 && (
            <button
              onClick={() => setCurrentPageNumber(Math.min(pageCount, currentPageNumber + 1))}
              disabled={currentPageNumber >= pageCount}
              className="flex items-center justify-center py-1 border-t hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Canvas area */}
        <PdfChrome ref={canvasContainerRef} className="p-0.5">
          {pdfError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-destructive font-medium">Failed to load PDF</p>
                <p className="text-sm text-muted-foreground">{pdfError}</p>
              </div>
            </div>
          )}

          {isLoadingPdf && !currentPage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Spinner size={32} className="mb-2" />
                <p className="text-sm text-muted-foreground">Loading PDF...</p>
              </div>
            </div>
          )}

          {currentPage && (
            <div
              className="relative mx-auto"
              style={{
                width: currentPage.width * zoom,
                height: currentPage.height * zoom,
              }}
            >
              <TakeoffCanvas
                pdfPage={currentPage.canvas}
                pageNumber={currentPageNumber}
                pageWidth={currentPage.width}
                pageHeight={currentPage.height}
                pageScale={pageScale}
                onCalibrate={handleCalibrate}
                onClearCalibration={handleClearCalibration}
                measurements={measurements.filter(
                  (m) => m.page_number === currentPageNumber
                )}
                onMeasurementCreate={handleMeasurementCreate}
                onCountPointAdd={handleCountPointAdd}
                onMovePoint={handleMovePoint}
                onRemovePoint={handleRemovePoint}
                onMeasurementDelete={handleMeasurementDelete}
                onMeasurementSelect={setSelectedMeasurement}
                selectedMeasurement={selectedMeasurement}
                activeLayer={activeLayer}
                layers={layers}
                currentTool={currentTool}
                zoom={zoom}
                containerRef={canvasContainerRef}
                isPanning={isPanning}
                isSpaceHeld={isSpaceHeld}
                onZoomToRect={zoomToRect}
              />
            </div>
          )}
        </PdfChrome>

        {/* Collapsible measurements sidebar */}
        <div
          className={cn(
            "transition-all duration-200 ease-in-out overflow-hidden border-l",
            sidebarOpen ? "w-80" : "w-0 border-l-0"
          )}
        >
          <div className="w-80 h-full">
            {sidebarMode === "room" && activeRoom ? (
              <RoomChecklist
                room={activeRoom}
                activeSlotId={activeSlotId}
                onSlotSelect={handleSlotSelect}
                onSlotClear={handleSlotClear}
                onSlotAssignPricebook={handleSlotAssignPricebook}
                onGeneratePO={handleGeneratePO}
                onMarkComplete={handleRoomMarkComplete}
                isLoading={false}
                onClose={() => setSidebarOpen(false)}
                pinned={sidebarPinned}
                onPinChange={handlePinSidebar}
                hasJob={false}
              />
            ) : (
              <TakeoffSidebar
                measurements={measurements}
                layers={layers}
                activeLayer={activeLayer}
                summary={summary}
                selectedMeasurement={selectedMeasurement}
                onMeasurementSelect={handleMeasurementSelect}
                onMeasurementDelete={handleMeasurementDelete}
                onAssignPricebook={handleAssignPricebook}
                onRenameMeasurement={handleRenameMeasurement}
                onGeneratePO={handleGeneratePO}
                isLoading={false}
                onClose={() => setSidebarOpen(false)}
                pinned={sidebarPinned}
                onPinChange={handlePinSidebar}
              />
            )}
          </div>
        </div>

        {/* Sidebar toggle tab (visible when collapsed) */}
        {!sidebarOpen && (
          <button
            onClick={handleToggleSidebar}
            className="w-6 border-l bg-background hover:bg-muted flex items-center justify-center"
            title="Show measurements"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Pricebook Selector Modal */}
      <PricebookSelector
        open={pricebookSelectorOpen}
        onOpenChange={setPricebookSelectorOpen}
        measurement={measurementForPricebook}
        onSelect={handlePricebookSelect}
        onClear={handlePricebookClear}
      />
    </div>
  );
}
