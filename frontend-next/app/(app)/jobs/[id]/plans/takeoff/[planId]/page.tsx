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

// Takeoff components
import { TakeoffCanvas } from "@/components/takeoff/TakeoffCanvas";
import { TakeoffToolbar } from "@/components/takeoff/TakeoffToolbar";
import { TakeoffSidebar } from "@/components/takeoff/TakeoffSidebar";
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
} from "@/components/takeoff/types";

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
  // Handlers
  // =============================================================================

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
      pageNumber: number
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

  // Assign pricebook item
  const handleAssignPricebook = React.useCallback(
    (measurementId: number) => {
      // TODO: Show pricebook selector modal
      toast({
        title: "Coming Soon",
        description: "Pricebook assignment will be available soon",
      });
    },
    [toast]
  );

  // Generate purchase order
  const handleGeneratePO = React.useCallback(async () => {
    // TODO: Call sync_to_po endpoint
    toast({
      title: "Coming Soon",
      description: "Purchase order generation will be available soon",
    });
  }, [toast]);

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
        isCalibrated={isCalibrated}
        scaleLabel={pageScale?.scale_label}
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
        <div className="flex-1 overflow-auto bg-muted/20 relative">
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
              className="relative mx-auto my-4"
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
                currentTool={currentTool}
                zoom={zoom}
                onZoomChange={setZoom}
              />
            </div>
          )}
        </div>

        {/* Measurements sidebar */}
        <TakeoffSidebar
          measurements={measurements}
          layers={layers}
          summary={summary}
          selectedMeasurement={selectedMeasurement}
          onMeasurementSelect={setSelectedMeasurement}
          onMeasurementDelete={handleMeasurementDelete}
          onAssignPricebook={handleAssignPricebook}
          onGeneratePO={handleGeneratePO}
          isLoading={false}
        />
      </div>
    </div>
  );
}
