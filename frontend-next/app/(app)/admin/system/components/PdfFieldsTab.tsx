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
    try {
      setSaving(true);
      const response = await api.patch<{ success: boolean; data: PdfFieldPosition }>(
        `/api/v1/pdf_field_positions/${id}`,
        { pdf_field_position: updates }
      );

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
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addDebugLog(`SAVE ERROR: ${errorMsg}`);
      console.error("Save error details:", err);
      toast({
        title: "Error",
        description: "Failed to save position",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, fieldId: number) => {
    addDebugLog(`Drag start: field ${fieldId}`);
    setDraggingFieldId(fieldId);

    // Calculate offset from mouse to field center
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    });

    // Set drag image
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(fieldId));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Update drop preview position
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scale = zoom / 100;
      const previewX = (e.clientX - rect.left) / scale;
      const previewY = (e.clientY - rect.top) / scale;
      setDropPreview({ x: previewX, y: previewY });
    }
  };

  const handleDragLeave = () => {
    setDropPreview(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropPreview(null);

    addDebugLog(`Drop event fired! draggingFieldId=${draggingFieldId}`);

    if (!draggingFieldId) {
      addDebugLog("Drop ignored: no draggingFieldId");
      return;
    }
    if (!containerRef.current) {
      addDebugLog("Drop ignored: no containerRef");
      return;
    }

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
  };

  const handleDragEnd = () => {
    setDraggingFieldId(null);
    setDropPreview(null);
  };

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">PDF Field Position Editor</h2>
          <p className="text-sm text-muted-foreground">
            Drag fields using the grip handle to reposition them on the PDF
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadPositions} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="h-9">
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
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Job (for preview data)</Label>
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
            <div className="space-y-1">
              <Label className="text-xs">Page</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium w-16 text-center">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Editor */}
      <div className="grid grid-cols-4 gap-4">
        {/* Field List */}
        <Card className="col-span-1">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Fields on Page {currentPage}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {fieldsOnPage.length === 0 ? (
              <p className="text-xs text-muted-foreground">No fields on this page</p>
            ) : (
              fieldsOnPage.map((field) => (
                <div
                  key={field.id}
                  className="p-2 rounded border bg-card hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium truncate flex-1">
                      {field.display_name || field.field_key}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 ml-6">
                    x: {field.x}, y: {field.y}
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

        {/* PDF Preview */}
        <Card className="col-span-3">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">
              PDF Preview
              {saving && <Badge variant="secondary" className="ml-2">Saving...</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom((z) => Math.max(50, z - 25))}
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-xs w-12 text-center">{zoom}%</span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom((z) => Math.min(200, z + 25))}
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPdfPreview}
                disabled={loadingPdf}
              >
                {loadingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                <span className="ml-1">Reload</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="relative bg-gray-100 dark:bg-gray-900 rounded overflow-auto"
              style={{ height: "600px" }}
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
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {/* PDF iframe */}
                  <iframe
                    src={`${pdfUrl}#page=${currentPage}`}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ border: "none" }}
                  />

                  {/* Drop preview indicator */}
                  {dropPreview && draggingFieldId && (() => {
                    const draggingField = positions.find(p => p.id === draggingFieldId);
                    if (!draggingField) return null;

                    // Get test value or display name for preview
                    const previewText = draggingField.test_value || draggingField.display_name || draggingField.field_key;
                    const fontSize = draggingField.font_size || 10;

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
                        {/* Drop point marker */}
                        <div className="absolute w-2 h-2 bg-red-500 rounded-full -translate-x-1 -translate-y-1" />

                        {/* Preview text offset to the right */}
                        <div
                          className="absolute left-8 top-4 bg-green-500/90 text-white px-2 py-1 rounded whitespace-nowrap border-2 border-green-600 shadow-lg"
                          style={{
                            fontSize: `${fontSize}px`,
                            fontFamily: 'Helvetica, Arial, sans-serif',
                          }}
                        >
                          {previewText}
                        </div>
                        {/* Coordinates label */}
                        <div className="absolute left-8 top-12 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-mono">
                          x: {Math.round(dropPreview.x)}, y: {Math.round(PDF_HEIGHT - dropPreview.y)}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Draggable field markers */}
                  {fieldsOnPage.map((field) => {
                    const pos = pdfToScreen(field.x, field.y);
                    const isDragging = draggingFieldId === field.id;
                    const displayValue = field.test_value || field.display_name || field.field_key;
                    const fontSize = field.font_size || 10;

                    return (
                      <div
                        key={field.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, field.id)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "absolute flex items-center gap-1 rounded cursor-grab active:cursor-grabbing shadow-md",
                          isDragging
                            ? "opacity-30"
                            : "hover:ring-2 hover:ring-blue-500"
                        )}
                        style={{
                          left: pos.left,
                          bottom: pos.bottom,
                          transform: `scale(${100 / zoom})`,
                          transformOrigin: "bottom left",
                        }}
                      >
                        {/* Drag handle */}
                        <div className="bg-gray-700 text-white px-0.5 py-0.5 rounded-l flex items-center">
                          <GripVertical className="h-3 w-3" />
                        </div>
                        {/* Value badge - green, actual font size */}
                        <div
                          className="bg-green-500 text-white px-1.5 py-0.5 rounded-r whitespace-nowrap border-l border-green-600"
                          style={{
                            fontSize: `${fontSize}px`,
                            fontFamily: 'Helvetica, Arial, sans-serif',
                          }}
                        >
                          {displayValue}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a job to load PDF preview
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="outline">1</Badge>
              <span>Find the field marker on the PDF</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">2</Badge>
              <span>Drag it using the grip handle</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">3</Badge>
              <span>Drop where you want it - saves automatically</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Panel */}
      <Card>
        <CardHeader className="py-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm text-orange-500">Debug Console</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setDebugLogs([])}>
            Clear
          </Button>
        </CardHeader>
        <CardContent className="py-2">
          <div className="bg-black text-green-400 font-mono text-xs p-3 rounded h-32 overflow-y-auto">
            {debugLogs.length === 0 ? (
              <div className="text-gray-500">Waiting for actions...</div>
            ) : (
              debugLogs.map((log, i) => (
                <div key={i} className={cn(
                  log.includes("ERROR") && "text-red-400",
                  log.includes("saved") && "text-green-400"
                )}>
                  {log}
                </div>
              ))
            )}
          </div>
          {pdfError && (
            <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-sm">
              <strong>PDF Error:</strong> {pdfError}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
