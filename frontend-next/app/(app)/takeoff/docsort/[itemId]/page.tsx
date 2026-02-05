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
  MeasurementCreateOptions,
} from "@/components/takeoff/types";

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

  // Plan data
  const [itemData, setItemData] = React.useState<DocsortTakeoffResponse | null>(null);
  const [isLoadingItem, setIsLoadingItem] = React.useState(true);
  const [itemError, setItemError] = React.useState<string | null>(null);

  // Measurements
  const [measurements, setMeasurements] = React.useState<TakeoffMeasurement[]>([]);
  const [summary, setSummary] = React.useState<MeasurementSummary | null>(null);
  const [selectedMeasurement, setSelectedMeasurement] = React.useState<TakeoffMeasurement | null>(null);

  // Layers - DocSort standalone doesn't have job-linked layers, use virtual layers
  const [layers, setLayers] = React.useState<TakeoffLayer[]>([
    { id: -1, name: "Measurements", color: "#3B82F6", display_order: 1, visible: true, locked: false, measurement_count: 0 }
  ]);
  const [activeLayer, setActiveLayer] = React.useState<TakeoffLayer | null>(layers[0]);

  // Tool state
  const [currentTool, setCurrentTool] = React.useState<TakeoffTool>("select");
  const [zoom, setZoom] = React.useState(1);

  // Pricebook selector state
  const [pricebookSelectorOpen, setPricebookSelectorOpen] = React.useState(false);
  const [measurementForPricebook, setMeasurementForPricebook] = React.useState<TakeoffMeasurement | null>(null);

  // Get current page scale
  const [currentPageNumber, setCurrentPageNumber] = React.useState(1);
  const pageScale = React.useMemo(() => {
    return itemData?.page_scales.find((ps) => ps.page_number === currentPageNumber) || null;
  }, [itemData, currentPageNumber]);

  // PDF loading
  const pdfUrl = itemData?.download_url || null;
  const { pages, currentPage, pageCount, isLoading: isLoadingPdf, error: pdfError } = useTakeoffPdf(pdfUrl);

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

  // Initial data fetch
  React.useEffect(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);

  // =============================================================================
  // Layer Management (Local only for standalone takeoff)
  // =============================================================================

  // Create layer (local only)
  const handleCreateLayer = React.useCallback(
    async (name: string, color: string) => {
      const newLayer: TakeoffLayer = {
        id: -Date.now(), // Negative temp ID for local layers
        name,
        color,
        display_order: layers.length + 1,
        visible: true,
        locked: false,
        measurement_count: 0,
      };
      setLayers((prev) => [...prev, newLayer]);
      setActiveLayer(newLayer);
    },
    [layers.length]
  );

  // Update layer (local only)
  const handleUpdateLayer = React.useCallback(
    async (id: number, updates: Partial<TakeoffLayer>) => {
      setLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
      );
      if (activeLayer?.id === id) {
        setActiveLayer((prev) => (prev ? { ...prev, ...updates } : prev));
      }
    },
    [activeLayer]
  );

  // Delete layer (local only)
  const handleDeleteLayer = React.useCallback(
    async (id: number) => {
      setLayers((prev) => {
        const remaining = prev.filter((l) => l.id !== id);
        if (activeLayer?.id === id && remaining.length > 0) {
          setActiveLayer(remaining[0]);
        }
        return remaining;
      });
    },
    [activeLayer]
  );

  // Toggle layer visibility (local only)
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

  // Toggle layer lock (local only)
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
    [itemId, currentPageNumber, toast]
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
      if (!itemId) return;

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
    [itemId, toast]
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
          setMeasurements((prev) =>
            prev.map((m) => (m.id === measurementForPricebook.id ? response.data : m))
          );
          if (selectedMeasurement?.id === measurementForPricebook.id) {
            setSelectedMeasurement(response.data);
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

  // Generate purchase order - not available for standalone takeoff
  const handleGeneratePO = React.useCallback(async () => {
    toast({
      title: "Route to Job First",
      description: "Route this document to a job to generate a purchase order",
    });
  }, [toast]);

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
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b bg-background shrink-0">
        <BackButton fallbackHref="/docsort" />
        <span className="font-medium truncate">{displayName}</span>
        <span className="text-sm text-muted-foreground">- Takeoff (Standalone)</span>
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
                layers={layers}
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
