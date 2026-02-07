"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { PdfChrome } from "@/components/ui/pdf-chrome";
import { ChevronLeft } from "lucide-react";

// Takeoff components
import { TakeoffCanvas } from "@/components/takeoff/TakeoffCanvas";
import { TakeoffToolbar } from "@/components/takeoff/TakeoffToolbar";
import { TakeoffSidebar } from "@/components/takeoff/TakeoffSidebar";
import { PricebookSelector } from "@/components/takeoff/PricebookSelector";
import { useTakeoffPdf } from "@/components/takeoff/useTakeoffPdf";
import type {
  TakeoffTool,
  TakeoffMeasurement,
  TakeoffLayer,
  PageScale,
  CalibrationData,
  GeometryData,
  MeasurementSummary,
  TakeoffPlanResponse,
  MeasurementCreateOptions,
} from "@/components/takeoff/types";
import type { DetectedElement } from "@/components/takeoff/ElementDetector";
import type { TakeoffTemplate, TemplateStep } from "@/components/takeoff/TemplateSelector";

// =============================================================================
// Page Component
// =============================================================================

export default function TakeoffPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const jobId = params.id as string;
  const planId = params.planId as string;

  // Plan data
  const [planData, setPlanData] = React.useState<TakeoffPlanResponse | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = React.useState(true);
  const [planError, setPlanError] = React.useState<string | null>(null);

  // Measurements
  const [measurements, setMeasurements] = React.useState<TakeoffMeasurement[]>([]);
  const [summary, setSummary] = React.useState<MeasurementSummary | null>(null);
  const [selectedMeasurement, setSelectedMeasurement] = React.useState<TakeoffMeasurement | null>(null);

  // Layers
  const [layers, setLayers] = React.useState<TakeoffLayer[]>([]);
  const [activeLayer, setActiveLayer] = React.useState<TakeoffLayer | null>(null);

  // Tool state
  const [currentTool, setCurrentTool] = React.useState<TakeoffTool>("select");
  const [zoom, setZoom] = React.useState(1);

  // Pricebook selector state
  const [pricebookSelectorOpen, setPricebookSelectorOpen] = React.useState(false);
  const [measurementForPricebook, setMeasurementForPricebook] = React.useState<TakeoffMeasurement | null>(null);
  const [isGeneratingPO, setIsGeneratingPO] = React.useState(false);

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

  // Get current page scale
  const [currentPageNumber, setCurrentPageNumber] = React.useState(1);
  const pageScale = React.useMemo(() => {
    return planData?.page_scales.find((ps) => ps.page_number === currentPageNumber) || null;
  }, [planData, currentPageNumber]);

  // PDF loading
  const pdfUrl = planData?.current_revision?.download_url || null;
  const { pages, currentPage, pageCount, isLoading: isLoadingPdf, error: pdfError } = useTakeoffPdf(pdfUrl);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  // Fetch plan data
  React.useEffect(() => {
    const fetchPlan = async () => {
      try {
        setIsLoadingPlan(true);
        setPlanError(null);

        const response = await api.get<{ success: boolean; data: TakeoffPlanResponse; error?: string }>(
          `/api/v1/pdf_takeoff/plans/${planId}`
        );

        if (response.success && response.data) {
          setPlanData(response.data);
        } else {
          throw new Error(response.error || "Failed to load plan");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load plan";
        setPlanError(message);
        console.error("Failed to load takeoff plan:", err);
      } finally {
        setIsLoadingPlan(false);
      }
    };

    if (planId) {
      fetchPlan();
    }
  }, [planId]);

  // Fetch measurements
  const fetchMeasurements = React.useCallback(async () => {
    if (!planId) return;

    try {
      const response = await api.get<{
        success: boolean;
        data: { measurements: TakeoffMeasurement[]; summary: MeasurementSummary };
      }>(`/api/v1/pdf_takeoff/plans/${planId}/measurements`);

      if (response.success && response.data) {
        setMeasurements(response.data.measurements);
        setSummary(response.data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch measurements:", err);
    }
  }, [planId]);

  // Fetch layers
  const fetchLayers = React.useCallback(async () => {
    if (!jobId) return;

    try {
      const response = await api.get<{
        success: boolean;
        data: { layers: TakeoffLayer[] };
      }>(`/api/v1/pdf_takeoff/jobs/${jobId}/layers`);

      if (response.success && response.data) {
        setLayers(response.data.layers);
        // Set first layer as active if none selected
        if (!activeLayer && response.data.layers.length > 0) {
          setActiveLayer(response.data.layers[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch layers:", err);
    }
  }, [jobId, activeLayer]);

  // Initial data fetch
  React.useEffect(() => {
    fetchMeasurements();
    fetchLayers();
  }, [fetchMeasurements, fetchLayers]);

  // =============================================================================
  // Layer Management Handlers
  // =============================================================================

  // Create layer
  const handleCreateLayer = React.useCallback(
    async (name: string, color: string) => {
      if (!jobId) return;

      try {
        const response = await api.post<{
          success: boolean;
          data: { layer: TakeoffLayer };
          error?: string;
        }>(`/api/v1/pdf_takeoff/jobs/${jobId}/layers`, {
          layer: { name, color },
        });

        if (response?.success && response?.data) {
          const newLayer = response.data.layer;
          setLayers((prev) => [...prev, newLayer]);
          setActiveLayer(newLayer);
          toast({
            title: "Layer Created",
            description: `"${name}" layer created`,
          });
        } else {
          throw new Error(response?.error || "Failed to create layer");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create layer";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        throw err;
      }
    },
    [jobId, toast]
  );

  // Update layer
  const handleUpdateLayer = React.useCallback(
    async (id: number, updates: Partial<TakeoffLayer>) => {
      if (!jobId) return;

      try {
        const response = await api.patch<{
          success: boolean;
          data: { layer: TakeoffLayer };
          error?: string;
        }>(`/api/v1/pdf_takeoff/jobs/${jobId}/layers/${id}`, {
          layer: updates,
        });

        if (response?.success && response?.data) {
          const updatedLayer = response.data.layer;
          setLayers((prev) =>
            prev.map((l) => (l.id === id ? updatedLayer : l))
          );
          if (activeLayer?.id === id) {
            setActiveLayer(updatedLayer);
          }
          toast({
            title: "Layer Updated",
          });
        } else {
          throw new Error(response?.error || "Failed to update layer");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update layer";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        throw err;
      }
    },
    [jobId, activeLayer, toast]
  );

  // Delete layer
  const handleDeleteLayer = React.useCallback(
    async (id: number) => {
      if (!jobId) return;

      try {
        const response = await api.delete<{ success: boolean; error?: string }>(
          `/api/v1/pdf_takeoff/jobs/${jobId}/layers/${id}`
        );

        if (response?.success) {
          setLayers((prev) => {
            const remaining = prev.filter((l) => l.id !== id);
            // If we deleted the active layer, switch to first remaining
            if (activeLayer?.id === id && remaining.length > 0) {
              setActiveLayer(remaining[0]);
            }
            return remaining;
          });
          toast({
            title: "Layer Deleted",
          });
        } else {
          throw new Error(response?.error || "Failed to delete layer");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete layer";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        throw err;
      }
    },
    [jobId, activeLayer, toast]
  );

  // Toggle layer visibility
  const handleToggleLayerVisibility = React.useCallback(
    async (id: number, visible: boolean) => {
      if (!jobId) return;

      try {
        const response = await api.patch<{
          success: boolean;
          data: { layer: TakeoffLayer };
          error?: string;
        }>(`/api/v1/pdf_takeoff/jobs/${jobId}/layers/${id}`, {
          layer: { visible },
        });

        if (response?.success && response?.data) {
          const updatedLayer = response.data.layer;
          setLayers((prev) =>
            prev.map((l) => (l.id === id ? updatedLayer : l))
          );
          if (activeLayer?.id === id) {
            setActiveLayer(updatedLayer);
          }
        } else {
          throw new Error(response?.error || "Failed to toggle visibility");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to toggle visibility";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        throw err;
      }
    },
    [jobId, activeLayer, toast]
  );

  // Toggle layer lock
  const handleToggleLayerLock = React.useCallback(
    async (id: number, locked: boolean) => {
      if (!jobId) return;

      try {
        const response = await api.patch<{
          success: boolean;
          data: { layer: TakeoffLayer };
          error?: string;
        }>(`/api/v1/pdf_takeoff/jobs/${jobId}/layers/${id}`, {
          layer: { locked },
        });

        if (response?.success && response?.data) {
          const updatedLayer = response.data.layer;
          setLayers((prev) =>
            prev.map((l) => (l.id === id ? updatedLayer : l))
          );
          if (activeLayer?.id === id) {
            setActiveLayer(updatedLayer);
          }
        } else {
          throw new Error(response?.error || "Failed to toggle lock");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to toggle lock";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        throw err;
      }
    },
    [jobId, activeLayer, toast]
  );

  // =============================================================================
  // Handlers
  // =============================================================================

  // Handle AI scale detection result
  const handleScaleDetected = React.useCallback(
    async (scaleText: string, referenceMm: number) => {
      // Update page scale with AI-detected values
      if (!planId) return;

      // The AI gives us the scale text and suggested reference length
      // We need to prompt user to draw a calibration line OR auto-calibrate if possible
      toast({
        title: "Scale Detected",
        description: `Detected scale: ${scaleText}. Please draw a calibration line to confirm.`,
      });

      // Set tool to calibrate mode
      setCurrentTool("calibrate");
    },
    [planId, toast]
  );

  // Calibrate scale
  const handleCalibrate = React.useCallback(
    async (data: CalibrationData) => {
      if (!planId) return;

      try {
        const response = await api.post<{
          success: boolean;
          data: { page_scale: PageScale };
          error?: string;
        }>(`/api/v1/pdf_takeoff/plans/${planId}/calibrate`, {
          page_number: currentPageNumber,
          reference_length_mm: data.referenceLengthMm,
          line_start: data.lineStart,
          line_end: data.lineEnd,
          canvas_width: data.canvasWidth,
          canvas_height: data.canvasHeight,
        });

        if (response?.success && response?.data) {
          const pageScaleData = response.data.page_scale;
          // Update page scales in plan data
          setPlanData((prev) => {
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

          // Switch to select tool after calibration
          setCurrentTool("select");
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
    [planId, currentPageNumber, toast]
  );

  // Create measurement
  const handleMeasurementCreate = React.useCallback(
    async (
      type: TakeoffMeasurement["measurement_type"],
      geometryData: GeometryData,
      pixelValue: number,
      pageNumber: number,
      options?: MeasurementCreateOptions
    ) => {
      if (!planId) return;

      try {
        const response = await api.post<{
          success: boolean;
          data: { measurement: TakeoffMeasurement; summary: MeasurementSummary };
          error?: string;
        }>(`/api/v1/pdf_takeoff/plans/${planId}/measurements`, {
          measurement: {
            measurement_type: type,
            pixel_value: pixelValue,
            page_number: pageNumber,
            takeoff_layer_id: activeLayer?.id,
            geometry_data: geometryData,
            is_deduction: options?.isDeduction,
            parent_measurement_id: options?.parentMeasurementId,
          },
        });

        if (response?.success && response?.data) {
          const measurementData = response.data;
          setMeasurements((prev) => [...prev, measurementData.measurement]);
          setSummary(measurementData.summary);

          toast({
            title: "Measurement Added",
            description: `${type}: ${measurementData.measurement.formatted_value}`,
          });
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
      }
    },
    [planId, activeLayer, toast]
  );

  // Handle AI element detection result
  const handleElementsDetected = React.useCallback(
    async (elements: DetectedElement[]) => {
      if (!planId || !currentPage) return;

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
            // Use length (diagonal of bbox as approximation)
            measurementType = "length";
            pixelValue = Math.sqrt(pixelWidth ** 2 + pixelHeight ** 2);
          } else if (element.type === "door" || element.type === "window" || element.type === "opening") {
            // Use the larger dimension as width
            measurementType = "length";
            pixelValue = Math.max(pixelWidth, pixelHeight);
          } else if (element.type === "stair") {
            // Use area
            measurementType = "area";
            pixelValue = pixelWidth * pixelHeight;
          } else if (element.type === "column") {
            // Use count
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
    [planId, currentPage, currentPageNumber, handleMeasurementCreate, toast]
  );

  // Handle template selection - start guided measurement workflow
  const handleTemplateSelect = React.useCallback(
    (template: TakeoffTemplate, steps: TemplateStep[]) => {
      if (!steps.length) return;

      // For now, just switch to the first step's measurement type
      const firstStep = steps[0];
      const toolMap: Record<string, TakeoffTool> = {
        count: "count",
        area: "area",
        linear: "linear",
        perimeter: "perimeter",
      };

      const tool = toolMap[firstStep.type] || "linear";
      setCurrentTool(tool);

      toast({
        title: `Template: ${template.name}`,
        description: `Step 1/${steps.length}: ${firstStep.label} - ${firstStep.prompt || `Use ${firstStep.type} tool`}`,
      });

      // TODO: Implement full template runner with step-by-step guidance
      // The TemplateRunner component can be added to the UI for step tracking
    },
    [toast]
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
          // Update measurement in list
          setMeasurements((prev) =>
            prev.map((m) => (m.id === measurementForPricebook.id ? response.data : m))
          );
          // Update selected measurement if it's the same
          if (selectedMeasurement?.id === measurementForPricebook.id) {
            setSelectedMeasurement(response.data);
          }
          // Refresh summary to get new totals
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
          prev.map((m) => (m.id === measurementForPricebook.id ? response.data : m))
        );
        if (selectedMeasurement?.id === measurementForPricebook.id) {
          setSelectedMeasurement(response.data);
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

  // Generate purchase order
  const handleGeneratePO = React.useCallback(async () => {
    if (!planId) return;

    // Check if there are measurements with pricebook items
    const pricedMeasurements = measurements.filter((m) => m.pricebook_item);
    if (pricedMeasurements.length === 0) {
      toast({
        title: "No Priced Items",
        description: "Assign pricebook items to measurements before generating a PO",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPO(true);
    try {
      const response = await api.post<{
        success: boolean;
        data: {
          purchase_orders: Array<{
            id: number;
            supplier_name: string;
            line_items_count: number;
            total: number;
          }>;
          total_pos: number;
          total_measurements: number;
        };
        error?: string;
      }>(`/api/v1/pdf_takeoff/plans/${planId}/generate_po`);

      if (response?.success && response?.data) {
        const { purchase_orders, total_pos, total_measurements } = response.data;
        toast({
          title: "Purchase Orders Created",
          description: `Created ${total_pos} PO(s) with ${total_measurements} line items`,
        });

        // Navigate to first PO or show success
        if (purchase_orders.length === 1) {
          router.push(`/jobs/${jobId}/purchase-orders/${purchase_orders[0].id}`);
        }
      } else {
        throw new Error(response?.error || "Failed to generate PO");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate purchase order";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPO(false);
    }
  }, [planId, jobId, measurements, router, toast]);

  // =============================================================================
  // Render
  // =============================================================================

  // Loading state
  if (isLoadingPlan) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Spinner size={32} className="mb-2" />
          <p className="text-sm text-muted-foreground">Loading plan...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (planError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-lg font-medium text-destructive">Failed to load plan</p>
        <p className="text-sm text-muted-foreground">{planError}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const planName = planData?.job_plan.display_name || "Plan";
  const isCalibrated = pageScale?.calibrated || false;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b bg-background shrink-0">
        <BackButton fallbackHref={`/jobs/${jobId}/plans`} />
        <span className="font-medium truncate">{planName}</span>
        <span className="text-sm text-muted-foreground">- Takeoff</span>
      </div>

      {/* Toolbar */}
      <TakeoffToolbar
        currentTool={currentTool}
        onToolChange={setCurrentTool}
        zoom={zoom}
        onZoomChange={setZoom}
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
        planId={planId}
        onScaleDetected={handleScaleDetected}
        onElementsDetected={handleElementsDetected}
        onTemplateSelect={handleTemplateSelect}
        pdfUrl={pdfUrl}
        onSyncComplete={fetchMeasurements}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnails sidebar */}
        <div className="w-24 border-r bg-muted/30 flex flex-col">
          <div className="p-2 border-b text-xs font-medium text-muted-foreground">
            Pages
          </div>
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
        </div>

        {/* Canvas area */}
        <PdfChrome className="p-0.5">
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
                measurements={measurements.filter(
                  (m) => m.page_number === currentPageNumber
                )}
                onMeasurementCreate={handleMeasurementCreate}
                onMeasurementDelete={handleMeasurementDelete}
                onMeasurementSelect={setSelectedMeasurement}
                selectedMeasurement={selectedMeasurement}
                activeLayer={activeLayer}
                layers={layers}
                currentTool={currentTool}
                zoom={zoom}
                onZoomChange={setZoom}
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
            <TakeoffSidebar
              measurements={measurements}
              layers={layers}
              summary={summary}
              selectedMeasurement={selectedMeasurement}
              onMeasurementSelect={setSelectedMeasurement}
              onMeasurementDelete={handleMeasurementDelete}
              onAssignPricebook={handleAssignPricebook}
              onGeneratePO={handleGeneratePO}
              isLoading={isGeneratingPO}
              onClose={() => setSidebarOpen(false)}
              pinned={sidebarPinned}
              onPinChange={handlePinSidebar}
            />
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
