"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  GripVertical,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";

interface PdfFieldPosition {
  id: number;
  pdf_template_key: string;
  field_key: string;
  display_name: string;
  page: number;
  x: number;
  y: number;
  font_size: number;
  test_value: string | null;
  active: boolean;
  updated_at: string;
}

interface Job {
  id: number;
  name: string;
  display_name?: string;
}

const TEMPLATE_OPTIONS = [
  { value: "qbcc_contract", label: "QBCC Contract", pages: 5 },
  { value: "qbcc_consumer_guide", label: "QBCC Consumer Guide", pages: 2 },
  { value: "qbcc_general_conditions", label: "QBCC General Conditions", pages: 16 },
];

// PDF dimensions in points (A4)
const PDF_WIDTH = 595;
const PDF_HEIGHT = 842;

export function PdfFieldsTab() {
  const { toast } = useToast();
  const [positions, setPositions] = React.useState<PdfFieldPosition[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] = React.useState("qbcc_contract");
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [currentPage, setCurrentPage] = React.useState(2);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = React.useState(false);
  const [zoom, setZoom] = React.useState(100);
  const [debugLogs, setDebugLogs] = React.useState<string[]>([]);
  const [pdfError, setPdfError] = React.useState<string | null>(null);
  const [draggingFieldId, setDraggingFieldId] = React.useState<number | null>(null);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [dropPreview, setDropPreview] = React.useState<{ x: number; y: number } | null>(null);
  const [previewWidth, setPreviewWidth] = React.useState<number>(0); // 0 = auto
  const [previewHeight, setPreviewHeight] = React.useState<number>(0); // 0 = auto
  const [isMouseDragging, setIsMouseDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Debug logger
  const addDebugLog = React.useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(`[PdfFieldsTab] ${message}`);
    setDebugLogs((prev) => [...prev.slice(-19), logEntry]);
  }, []);

  // Load positions
  const loadPositions = React.useCallback(async () => {
    try {
      setLoading(true);
      addDebugLog(`Fetching positions for template: ${selectedTemplate}`);
      const response = await api.get<{
        success: boolean;
        data: { positions: PdfFieldPosition[]; templates: string[] };
      }>(`/api/v1/pdf_field_positions?template=${selectedTemplate}`);

      if (response.success && response.data) {
        addDebugLog(`Loaded ${response.data.positions.length} positions`);
        setPositions(response.data.positions);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addDebugLog(`POSITIONS ERROR: ${errorMsg}`);
      toast({
        title: "Error",
        description: "Failed to load field positions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate, toast, addDebugLog]);

  // Load jobs
  const loadJobs = React.useCallback(async () => {
    try {
      const response = await api.get<{ jobs: Job[] }>("/api/v1/jobs?per_page=100");
      if (response.jobs) {
        setJobs(response.jobs);
        if (response.jobs.length > 0) {
          const wategos = response.jobs.find((j) =>
            j.name?.toLowerCase().includes("wategos")
          );
          setSelectedJob(wategos || response.jobs[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load jobs:", err);
    }
  }, []);

  // Load PDF preview
  const loadPdfPreview = React.useCallback(async () => {
    if (!selectedJob) return;

    try {
      setLoadingPdf(true);
      setPdfError(null);

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

      addDebugLog(`Loading preview: ${selectedTemplate}, job=${selectedJob.id}`);

      const response = await fetch(
        `${backendUrl}/api/v1/pdf_field_positions/preview?template=${selectedTemplate}&job_id=${selectedJob.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        setPdfUrl(URL.createObjectURL(blob));
        addDebugLog(`PDF loaded: ${blob.size} bytes`);
      } else {
        const errorText = await response.text();
        addDebugLog(`PDF ERROR: ${response.status} - ${errorText}`);
        setPdfError(`${response.status}: ${errorText}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addDebugLog(`FETCH ERROR: ${errorMsg}`);
      setPdfError(errorMsg);
    } finally {
      setLoadingPdf(false);
    }
  }, [selectedTemplate, selectedJob, addDebugLog]);

  React.useEffect(() => {
    addDebugLog("Component mounted");
  }, [addDebugLog]);

  React.useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  React.useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  React.useEffect(() => {
    if (selectedJob) {
      loadPdfPreview();
    }
  }, [selectedJob, loadPdfPreview]);

  // Save position
  const savePosition = async (id: number, updates: Partial<PdfFieldPosition>) => {
    addDebugLog(`Saving: id=${id}, x=${updates.x}, y=${updates.y}`);
    console.log("[PDF Save] Starting save...", { id, updates });
    try {
      setSaving(true);

      // Log what we're sending
      const requestBody = { pdf_field_position: updates };
      console.log("[PDF Save] Request body:", JSON.stringify(requestBody, null, 2));

      const response = await api.patch<{ success: boolean; data: PdfFieldPosition }>(
        `/api/v1/pdf_field_positions/${id}`,
        requestBody
      );

      console.log("[PDF Save] Response:", response);
      addDebugLog(`API response: ${JSON.stringify(response).substring(0, 200)}`);

      if (response.success && response.data) {
        setPositions((prev) =>
          prev.map((p) => (p.id === id ? response.data : p))
        );
        toast({ title: "Saved", description: `Position updated to x:${response.data.x}, y:${response.data.y}` });
        addDebugLog(`Position saved! New coords: x=${response.data.x}, y=${response.data.y}`);
        // Reload both positions and PDF
        loadPdfPreview();
      } else {
        addDebugLog(`Save failed - response.success=${response.success}`);
        console.error("[PDF Save] Save failed:", response);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addDebugLog(`SAVE ERROR: ${errorMsg}`);
      console.error("[PDF Save] Exception:", err);
      // Log full error details
      if (err && typeof err === 'object') {
        console.error("[PDF Save] Error status:", (err as { status?: number }).status);
        console.error("[PDF Save] Error data:", (err as { data?: unknown }).data);
      }
      toast({
        title: "Error",
        description: `Failed to save position: ${errorMsg}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Mouse-based drag handlers (more reliable than HTML5 drag and drop)
  const handleMouseDown = (e: React.MouseEvent, fieldId: number) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[DRAG] Mouse down - starting drag for field:', fieldId);
    addDebugLog(`Drag start: field ${fieldId}`);
    setDraggingFieldId(fieldId);
    setIsMouseDragging(true);

    // Calculate initial offset
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    // Initial preview position
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const scale = zoom / 100;
      const previewX = (e.clientX - containerRect.left) / scale;
      const previewY = (e.clientY - containerRect.top) / scale;
      setDropPreview({ x: previewX, y: previewY });
    }
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isMouseDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const scale = zoom / 100;
    const previewX = (e.clientX - rect.left) / scale;
    const previewY = (e.clientY - rect.top) / scale;
    setDropPreview({ x: previewX, y: previewY });
  }, [isMouseDragging, zoom]);

  const handleMouseUp = React.useCallback((e: MouseEvent) => {
    if (!isMouseDragging || !draggingFieldId || !containerRef.current) {
      setIsMouseDragging(false);
      setDraggingFieldId(null);
      setDropPreview(null);
      return;
    }

    console.log('[DRAG] Mouse up - completing drag');
    addDebugLog(`Drop event fired! draggingFieldId=${draggingFieldId}`);

    const rect = containerRef.current.getBoundingClientRect();
    const scale = zoom / 100;

    // Calculate drop position relative to PDF container
    const dropX = (e.clientX - rect.left) / scale;
    const dropY = (e.clientY - rect.top) / scale;

    // Convert to PDF coordinates (y is inverted)
    const pdfX = Math.round(Math.max(0, Math.min(PDF_WIDTH, dropX)));
    const pdfY = Math.round(Math.max(0, Math.min(PDF_HEIGHT, PDF_HEIGHT - dropY)));

    addDebugLog(`Drop coords: screen(${dropX.toFixed(0)}, ${dropY.toFixed(0)}) → pdf(${pdfX}, ${pdfY})`);
    addDebugLog(`Calling savePosition for field ${draggingFieldId}...`);

    savePosition(draggingFieldId, { x: pdfX, y: pdfY });
    setDraggingFieldId(null);
    setIsMouseDragging(false);
    setDropPreview(null);
  }, [isMouseDragging, draggingFieldId, zoom, addDebugLog, savePosition]);

  // Global mouse event listeners for drag
  React.useEffect(() => {
    if (isMouseDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isMouseDragging, handleMouseMove, handleMouseUp]);

  // Get fields for current page
  const fieldsOnPage = positions.filter((p) => p.page === currentPage);

  // Convert PDF coords to screen position
  const pdfToScreen = (x: number, y: number) => ({
    left: `${(x / PDF_WIDTH) * 100}%`,
    bottom: `${(y / PDF_HEIGHT) * 100}%`,
  });

  const templateConfig = TEMPLATE_OPTIONS.find((t) => t.value === selectedTemplate);
  const totalPages = templateConfig?.pages || 5;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Controls Bar */}
      <div className="flex items-center gap-2">
        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-64">
          <ComboboxDropdown
            selectedItem={selectedJob ? { id: String(selectedJob.id), label: selectedJob.name || `Job ${selectedJob.id}` } : undefined}
            onSelect={(item) => {
              if (item) {
                const job = jobs.find((j) => String(j.id) === item.id);
                setSelectedJob(job || null);
              }
            }}
            items={jobs.map((j) => ({
              id: String(j.id),
              label: j.name || `Job ${j.id}`,
            }))}
            placeholder="Select job..."
            searchPlaceholder="Search..."
            emptyResults="No jobs"
          />
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-10 text-center">
            {currentPage}/{totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" className="h-8" onClick={loadPositions} disabled={loading}>
          <RefreshCw className={cn("h-3 w-3 mr-1", loading && "animate-spin")} />
          Refresh
        </Button>

        <div className="border-l h-6 mx-2" />

        {/* Zoom controls */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setZoom((z) => Math.max(50, z - 25))}
        >
          <ZoomOut className="h-3 w-3" />
        </Button>
        <span className="text-xs w-10 text-center">{zoom}%</span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setZoom((z) => Math.min(200, z + 25))}
        >
          <ZoomIn className="h-3 w-3" />
        </Button>

        <div className="border-l h-6 mx-2" />

        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={loadPdfPreview}
          disabled={loadingPdf}
        >
          {loadingPdf ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Reload PDF
        </Button>

        {saving && <Badge variant="secondary" className="ml-2">Saving...</Badge>}

        <div className="border-l h-6 mx-2" />

        {/* Preview box size controls */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Preview:</span>
          <span className="text-xs">W</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPreviewWidth(w => Math.max(0, w - 10))}>-</Button>
          <span className="text-xs font-mono w-8 text-center">{previewWidth || 'auto'}</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPreviewWidth(w => w + 10)}>+</Button>
          <span className="text-xs ml-2">H</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPreviewHeight(h => Math.max(0, h - 2))}>-</Button>
          <span className="text-xs font-mono w-8 text-center">{previewHeight || 'auto'}</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPreviewHeight(h => h + 2)}>+</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setPreviewWidth(0); setPreviewHeight(0); }}>Reset</Button>
        </div>

        {/* Coordinates display when dragging */}
        {draggingFieldId && (
          <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded border">
            <span className="text-xs font-medium">
              {positions.find(p => p.id === draggingFieldId)?.display_name}:
            </span>
            <span className="text-xs font-mono text-red-600 dark:text-red-400">
              OLD x:{positions.find(p => p.id === draggingFieldId)?.x} y:{positions.find(p => p.id === draggingFieldId)?.y}
            </span>
            <span className="text-xs">→</span>
            <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
              NEW x:{dropPreview ? Math.round(dropPreview.x) : '...'} y:{dropPreview ? Math.round(PDF_HEIGHT - dropPreview.y) : '...'}
            </span>
          </div>
        )}

      </div>

      {/* Main Editor */}
      <div className="grid grid-cols-5 gap-2">
        {/* Field List - narrower */}
        <Card className="col-span-1">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs">Page {currentPage}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {fieldsOnPage.length === 0 ? (
              <p className="text-xs text-muted-foreground">No fields on this page</p>
            ) : (
              fieldsOnPage.map((field) => (
                <div
                  key={field.id}
                  className="p-1.5 rounded border bg-card hover:bg-muted transition-colors text-xs"
                >
                  <div className="font-medium truncate">
                    {field.display_name || field.field_key}
                  </div>
                  <div className="text-muted-foreground">
                    {field.x}, {field.y}
                  </div>
                </div>
              ))
            )}

            {positions.filter((p) => p.page !== currentPage).length > 0 && (
              <>
                <div className="border-t my-3" />
                <p className="text-xs text-muted-foreground font-medium">Other Pages</p>
                {positions
                  .filter((p) => p.page !== currentPage)
                  .map((field) => (
                    <div
                      key={field.id}
                      className="p-2 rounded border opacity-50 cursor-pointer hover:opacity-100"
                      onClick={() => setCurrentPage(field.page)}
                    >
                      <div className="text-xs">
                        <span className="font-medium">{field.display_name}</span>
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          Page {field.page}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* PDF Preview - no card wrapper, just the PDF */}
        <div className="col-span-4">
          <div
            className="relative bg-gray-100 dark:bg-gray-900 rounded overflow-auto border"
            style={{ height: "calc(100vh - 80px)", minHeight: "700px" }}
          >
              {loadingPdf ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : pdfUrl ? (
                <div
                  ref={containerRef}
                  className="relative inline-block"
                  style={{
                    width: `${PDF_WIDTH * (zoom / 100)}px`,
                    height: `${PDF_HEIGHT * (zoom / 100)}px`,
                  }}
                >
                  {/* PDF iframe */}
                  <iframe
                    src={`${pdfUrl}#page=${currentPage}`}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ border: "none" }}
                  />

                  {/* Drop preview indicator - follows cursor during drag */}
                  {dropPreview && draggingFieldId && (() => {
                    const draggingField = positions.find(p => p.id === draggingFieldId);
                    if (!draggingField) return null;

                    const previewText = draggingField.test_value || draggingField.display_name || draggingField.field_key;

                    return (
                      <div
                        className="absolute pointer-events-none z-50"
                        style={{
                          left: `${(dropPreview.x / PDF_WIDTH) * 100}%`,
                          top: `${(dropPreview.y / PDF_HEIGHT) * 100}%`,
                          transform: `scale(${100 / zoom})`,
                          transformOrigin: "top left",
                        }}
                      >
                        {/* Preview box - shows value at drop position */}
                        <span
                          className="inline-block bg-green-600 text-white text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap font-semibold shadow-lg"
                          style={{
                            ...(previewWidth > 0 && { width: `${previewWidth}px`, minWidth: `${previewWidth}px` }),
                            ...(previewHeight > 0 && { height: `${previewHeight}px`, lineHeight: `${previewHeight}px` }),
                          }}
                        >
                          {previewText}
                        </span>
                      </div>
                    );
                  })()}


                  {/* Field markers */}
                  {(() => {
                    // Debug: Log all fields on this page
                    console.group(`[PDF Fields] Page ${currentPage} - ${fieldsOnPage.length} fields`);
                    fieldsOnPage.forEach((f) => {
                      console.log(`  ${f.display_name || f.field_key}`, {
                        id: f.id,
                        value: f.test_value || "(empty)",
                        position: `x:${f.x} y:${f.y}`,
                      });
                    });
                    console.groupEnd();
                    return null;
                  })()}
                  {fieldsOnPage.map((field) => {
                    const isDragging = draggingFieldId === field.id;
                    const fieldName = field.display_name || field.field_key;
                    const fieldContent = field.test_value || "";
                    const fontSize = field.font_size || 10;

                    // SAVED position (always from database)
                    const savedLeftPercent = (field.x / PDF_WIDTH) * 100;
                    const savedBottomPercent = (field.y / PDF_HEIGHT) * 100;

                    return (
                      <React.Fragment key={field.id}>
                        {/* Position marker dot */}
                        <div
                          className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-lg z-30"
                          style={{
                            left: `${savedLeftPercent}%`,
                            bottom: `${savedBottomPercent}%`,
                            transform: 'translate(-50%, 50%)',
                          }}
                          title={`${fieldName} | Value: ${fieldContent} | Saved: x=${field.x}, y=${field.y}`}
                        />

                        {/* Draggable field panel - 2 boxes only */}
                        <div
                          onMouseDown={(e) => handleMouseDown(e, field.id)}
                          className={cn(
                            "absolute flex flex-col gap-1 cursor-grab active:cursor-grabbing z-50 select-none",
                            draggingFieldId === field.id ? "opacity-30" : ""
                          )}
                          style={{
                            left: `${savedLeftPercent}%`,
                            bottom: `${savedBottomPercent}%`,
                            transform: `translate(8px, 50%) scale(${100 / zoom})`,
                            transformOrigin: "bottom left",
                            pointerEvents: "auto",
                          }}
                        >
                          {/* Box 1: Field Name (Blue) with drag handle */}
                          <div className="flex items-center rounded shadow-lg hover:ring-2 hover:ring-white pointer-events-none">
                            <div className="bg-gray-700 text-white px-0.5 py-0.5 rounded-l flex items-center">
                              <GripVertical className="h-3 w-3" />
                            </div>
                            <div className="bg-blue-600 text-white text-[11px] px-1.5 py-0.5 rounded-r whitespace-nowrap font-semibold">
                              {fieldName}
                            </div>
                          </div>
                          {/* Box 2: Value (Green) */}
                          <div
                            className="bg-green-600 text-white px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg pointer-events-none"
                            style={{
                              fontSize: `${fontSize}px`,
                              fontFamily: 'Helvetica, Arial, sans-serif',
                            }}
                          >
                            {fieldContent || "(empty)"}
                          </div>
                        </div>

                        {/* DROP PREVIEW - Just shows new position */}
                        {isDragging && dropPreview && (
                          <>
                            {/* Connecting line from saved position to drop position */}
                            <svg
                              className="absolute inset-0 w-full h-full pointer-events-none z-30"
                              style={{ overflow: 'visible' }}
                            >
                              <line
                                x1={`${savedLeftPercent}%`}
                                y1={`${100 - savedBottomPercent}%`}
                                x2={`${(dropPreview.x / PDF_WIDTH) * 100}%`}
                                y2={`${(dropPreview.y / PDF_HEIGHT) * 100}%`}
                                stroke="#3b82f6"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                              />
                            </svg>

                            {/* Blue dot at drop position */}
                            <div
                              className="absolute w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-lg z-40"
                              style={{
                                left: `${(dropPreview.x / PDF_WIDTH) * 100}%`,
                                top: `${(dropPreview.y / PDF_HEIGHT) * 100}%`,
                                transform: 'translate(-50%, -50%)',
                              }}
                            />
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a job to load PDF preview
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Error display only */}
      {pdfError && (
        <div className="p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-sm">
          <strong>PDF Error:</strong> {pdfError}
        </div>
      )}
    </div>
  );
}
