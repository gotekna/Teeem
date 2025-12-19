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
  AlignLeft,
  AlignCenter,
  AlignRight,
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
  box_width: number | null;
  box_height: number | null;
  text_align: "left" | "center" | "right";
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
  const [dropPreview, setDropPreview] = React.useState<{ x: number; y: number } | null>(null);
  const [previewWidth, setPreviewWidth] = React.useState<number>(0); // 0 = auto
  const [previewHeight, setPreviewHeight] = React.useState<number>(0); // 0 = auto
  const [fieldSizes, setFieldSizes] = React.useState<Record<number, { w: number; h: number }>>(() => {
    // Load from localStorage on init
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pdfFieldSizes');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });

  // Save to localStorage when fieldSizes changes
  React.useEffect(() => {
    if (Object.keys(fieldSizes).length > 0) {
      localStorage.setItem('pdfFieldSizes', JSON.stringify(fieldSizes));
    }
  }, [fieldSizes]);
  const [isMouseDragging, setIsMouseDragging] = React.useState(false);
  const [selectedFieldId, setSelectedFieldId] = React.useState<number | null>(null);
  const [mouseDownPos, setMouseDownPos] = React.useState<{ x: number; y: number } | null>(null);
  const [paletteSearch, setPaletteSearch] = React.useState("");
  const [draggingFromPalette, setDraggingFromPalette] = React.useState<number | null>(null);
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

  // Save box dimensions
  const saveBoxDimensions = async (id: number, width: number, height: number) => {
    try {
      const response = await api.patch<{ success: boolean; data: PdfFieldPosition }>(
        `/api/v1/pdf_field_positions/${id}`,
        { pdf_field_position: { box_width: width || null, box_height: height || null } }
      );
      if (response.success && response.data) {
        setPositions((prev) =>
          prev.map((p) => (p.id === id ? response.data : p))
        );
        console.log('[PDF] Box dimensions saved:', response.data.box_width, response.data.box_height);
      }
    } catch (err) {
      console.error('[PDF] Failed to save box dimensions:', err);
    }
  };

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
  // Click = select, Drag = move
  const DRAG_THRESHOLD = 5; // pixels to move before drag starts
  const [dragStartFieldPos, setDragStartFieldPos] = React.useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent, fieldId: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Record mouse position to detect drag vs click
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setDraggingFieldId(fieldId);

    // Store the field's ORIGINAL position (in PDF coordinates)
    const field = positions.find(p => p.id === fieldId);
    if (field) {
      setDragStartFieldPos({ x: field.x, y: field.y });
    }
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!draggingFieldId || !containerRef.current || !mouseDownPos || !dragStartFieldPos) return;

    // Check if we've moved past the drag threshold
    const dx = Math.abs(e.clientX - mouseDownPos.x);
    const dy = Math.abs(e.clientY - mouseDownPos.y);

    if (!isMouseDragging && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
      setIsMouseDragging(true);
    }

    if (isMouseDragging) {
      const scale = zoom / 100;

      // Calculate how much the mouse has moved in screen pixels
      const deltaScreenX = e.clientX - mouseDownPos.x;
      const deltaScreenY = e.clientY - mouseDownPos.y;

      // Convert delta to PDF units (y is inverted - moving down on screen = moving up in PDF)
      const deltaPdfX = deltaScreenX / scale;
      const deltaPdfY = -deltaScreenY / scale; // Invert Y

      // Apply delta to original field position
      const newPdfX = Math.round(Math.max(0, Math.min(PDF_WIDTH, dragStartFieldPos.x + deltaPdfX)));
      const newPdfY = Math.round(Math.max(0, Math.min(PDF_HEIGHT, dragStartFieldPos.y + deltaPdfY)));

      setDropPreview({ x: newPdfX, y: newPdfY });
    }
  }, [draggingFieldId, isMouseDragging, mouseDownPos, zoom, dragStartFieldPos]);

  const handleMouseUp = React.useCallback((e: MouseEvent) => {
    // If we weren't dragging (just clicked), select the field
    if (!isMouseDragging && draggingFieldId) {
      setSelectedFieldId(draggingFieldId);

      // Load W/H from the field's database values
      const field = positions.find(p => p.id === draggingFieldId);
      if (field) {
        setPreviewWidth(field.box_width || 0);
        setPreviewHeight(field.box_height || 0);
      }

      setDraggingFieldId(null);
      setMouseDownPos(null);
      setDragStartFieldPos(null);
      return;
    }

    if (!isMouseDragging || !draggingFieldId || !dropPreview) {
      setIsMouseDragging(false);
      setDraggingFieldId(null);
      setDropPreview(null);
      setMouseDownPos(null);
      setDragStartFieldPos(null);
      return;
    }

    // Use the calculated position from dropPreview (already in PDF coordinates)
    const pdfX = dropPreview.x;
    const pdfY = dropPreview.y;

    addDebugLog(`Saving: pdf(${pdfX}, ${pdfY})`);

    savePosition(draggingFieldId, { x: pdfX, y: pdfY });
    setSelectedFieldId(draggingFieldId);
    setDraggingFieldId(null);
    setIsMouseDragging(false);
    setDropPreview(null);
    setMouseDownPos(null);
    setDragStartFieldPos(null);
  }, [isMouseDragging, draggingFieldId, dropPreview, addDebugLog, savePosition, positions]);

  // Global mouse event listeners for drag
  React.useEffect(() => {
    if (draggingFieldId) {
      // Prevent scrolling during drag
      const preventScroll = (e: Event) => {
        if (isMouseDragging) {
          e.preventDefault();
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.overflow = 'hidden';
      document.body.style.userSelect = 'none';

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.overflow = '';
        document.body.style.userSelect = '';
      };
    }
  }, [draggingFieldId, isMouseDragging, handleMouseMove, handleMouseUp]);

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
    <div className="flex" style={{ height: 'calc(100vh - 60px)' }}>
      {/* Controls Panel - narrow left column */}
      <div className="w-56 px-2 flex flex-col gap-2 shrink-0 overflow-auto">
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
            onClick={() => {
              console.log('[PAGE] Previous clicked, currentPage:', currentPage);
              setCurrentPage((p) => Math.max(1, p - 1));
            }}
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
            onClick={() => {
              console.log('[PAGE] Next clicked, currentPage:', currentPage);
              setCurrentPage((p) => Math.min(totalPages, p + 1));
            }}
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

        {/* Preview box size controls - stacked vertically */}
        {selectedFieldId ? (
          <Badge variant="secondary" className="text-xs">
            {positions.find(p => p.id === selectedFieldId)?.display_name || 'Selected'}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Click field to select</span>
        )}
        <div className="flex items-center gap-1">
          <span className="text-xs w-4">W</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => {
            const newW = Math.max(0, previewWidth - 10);
            setPreviewWidth(newW);
            if (selectedFieldId) saveBoxDimensions(selectedFieldId, newW, previewHeight);
          }} disabled={!selectedFieldId}>-</Button>
          <Input
            type="number"
            value={previewWidth || ''}
            onChange={(e) => setPreviewWidth(parseInt(e.target.value) || 0)}
            onBlur={() => {
              if (selectedFieldId) saveBoxDimensions(selectedFieldId, previewWidth, previewHeight);
            }}
            className="h-6 w-16 text-xs text-center font-mono px-1"
            placeholder="auto"
            disabled={!selectedFieldId}
          />
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => {
            const newW = previewWidth + 10;
            setPreviewWidth(newW);
            if (selectedFieldId) saveBoxDimensions(selectedFieldId, newW, previewHeight);
          }} disabled={!selectedFieldId}>+</Button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs w-4">H</span>
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => {
            const newH = Math.max(0, previewHeight - 2);
            setPreviewHeight(newH);
            if (selectedFieldId) saveBoxDimensions(selectedFieldId, previewWidth, newH);
          }} disabled={!selectedFieldId}>-</Button>
          <Input
            type="number"
            value={previewHeight || ''}
            onChange={(e) => setPreviewHeight(parseInt(e.target.value) || 0)}
            onBlur={() => {
              if (selectedFieldId) saveBoxDimensions(selectedFieldId, previewWidth, previewHeight);
            }}
            className="h-6 w-16 text-xs text-center font-mono px-1"
            placeholder="auto"
            disabled={!selectedFieldId}
          />
          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => {
            const newH = previewHeight + 2;
            setPreviewHeight(newH);
            if (selectedFieldId) saveBoxDimensions(selectedFieldId, previewWidth, newH);
          }} disabled={!selectedFieldId}>+</Button>
        </div>

        {/* Text alignment controls */}
        <div className="flex items-center gap-1">
          <span className="text-xs w-8">Align</span>
          {(["left", "center", "right"] as const).map((align) => {
            const selectedField = positions.find(p => p.id === selectedFieldId);
            const isActive = selectedField?.text_align === align || (!selectedField?.text_align && align === "left");
            const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
            return (
              <Button
                key={align}
                variant={isActive ? "default" : "outline"}
                size="icon"
                className="h-6 w-6"
                onClick={async () => {
                  if (!selectedFieldId) return;
                  try {
                    const response = await api.patch<{ success: boolean; data: PdfFieldPosition }>(
                      `/api/v1/pdf_field_positions/${selectedFieldId}`,
                      { pdf_field_position: { text_align: align } }
                    );
                    if (response.success && response.data) {
                      setPositions(prev => prev.map(p => p.id === selectedFieldId ? response.data : p));
                    }
                  } catch (err) {
                    console.error("Failed to save alignment:", err);
                  }
                }}
                disabled={!selectedFieldId}
                title={align.charAt(0).toUpperCase() + align.slice(1)}
              >
                <Icon className="h-3 w-3" />
              </Button>
            );
          })}
        </div>

        {/* Page selector for moving field between pages */}
        {selectedFieldId && (() => {
          const field = positions.find(p => p.id === selectedFieldId);
          if (!field) return null;
          return (
            <div className="flex items-center gap-1">
              <span className="text-xs w-8">Page</span>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => {
                if (field.page > 1) {
                  savePosition(field.id, { page: field.page - 1 });
                }
              }} disabled={field.page <= 1}>-</Button>
              <Input
                type="number"
                value={field.page}
                onChange={(e) => {
                  const newPage = Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1));
                  setPositions(prev => prev.map(p => p.id === field.id ? { ...p, page: newPage } : p));
                }}
                onBlur={(e) => {
                  const newPage = Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1));
                  savePosition(field.id, { page: newPage });
                }}
                className="h-6 w-12 text-xs text-center font-mono px-1"
              />
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => {
                if (field.page < totalPages) {
                  savePosition(field.id, { page: field.page + 1 });
                }
              }} disabled={field.page >= totalPages}>+</Button>
              <span className="text-[10px] text-muted-foreground">/ {totalPages}</span>
            </div>
          );
        })()}

        {/* Manual X/Y coordinate controls */}
        {selectedFieldId && (() => {
          const field = positions.find(p => p.id === selectedFieldId);
          if (!field) return null;
          return (
            <>
              <div className="flex items-center gap-1">
                <span className="text-xs w-4">X</span>
                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => {
                  const newX = Math.max(0, field.x - 5);
                  savePosition(field.id, { x: newX, y: field.y });
                }}>-</Button>
                <Input
                  type="number"
                  value={field.x}
                  onChange={(e) => {
                    const newX = Math.max(0, Math.min(PDF_WIDTH, parseInt(e.target.value) || 0));
                    setPositions(prev => prev.map(p => p.id === field.id ? { ...p, x: newX } : p));
                  }}
                  onBlur={(e) => {
                    const newX = Math.max(0, Math.min(PDF_WIDTH, parseInt(e.target.value) || 0));
                    savePosition(field.id, { x: newX, y: field.y });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const newX = Math.max(0, Math.min(PDF_WIDTH, parseInt((e.target as HTMLInputElement).value) || 0));
                      savePosition(field.id, { x: newX, y: field.y });
                    }
                  }}
                  className="h-6 w-16 text-xs text-center font-mono px-1"
                />
                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => {
                  const newX = Math.min(PDF_WIDTH, field.x + 5);
                  savePosition(field.id, { x: newX, y: field.y });
                }}>+</Button>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs w-4">Y</span>
                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => {
                  const newY = Math.max(0, field.y - 5);
                  savePosition(field.id, { x: field.x, y: newY });
                }}>-</Button>
                <Input
                  type="number"
                  value={field.y}
                  onChange={(e) => {
                    const newY = Math.max(0, Math.min(PDF_HEIGHT, parseInt(e.target.value) || 0));
                    setPositions(prev => prev.map(p => p.id === field.id ? { ...p, y: newY } : p));
                  }}
                  onBlur={(e) => {
                    const newY = Math.max(0, Math.min(PDF_HEIGHT, parseInt(e.target.value) || 0));
                    savePosition(field.id, { x: field.x, y: newY });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const newY = Math.max(0, Math.min(PDF_HEIGHT, parseInt((e.target as HTMLInputElement).value) || 0));
                      savePosition(field.id, { x: field.x, y: newY });
                    }
                  }}
                  className="h-6 w-16 text-xs text-center font-mono px-1"
                />
                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => {
                  const newY = Math.min(PDF_HEIGHT, field.y + 5);
                  savePosition(field.id, { x: field.x, y: newY });
                }}>+</Button>
              </div>
            </>
          );
        })()}

        {/* Coordinates display during drag */}
        {draggingFieldId && dropPreview && (() => {
          const field = positions.find(p => p.id === draggingFieldId);
          if (!field) return null;
          return (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded border">
              <span className="text-xs font-mono">
                x:<span className="font-bold text-green-600">{dropPreview.x}</span>
              </span>
              <span className="text-xs font-mono">
                y:<span className="font-bold text-green-600">{dropPreview.y}</span>
              </span>
              <span className="text-xs text-muted-foreground">(was {field.x}, {field.y})</span>
            </div>
          );
        })()}

        {/* Field List - scrollable */}
        <div className="border-t pt-2 mt-2">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Fields ({positions.length})
          </div>
          <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
            {positions
              .sort((a, b) => a.page - b.page || a.display_name.localeCompare(b.display_name))
              .map((field) => (
                <button
                  key={field.id}
                  onClick={() => {
                    setSelectedFieldId(field.id);
                    setCurrentPage(field.page);
                    setPreviewWidth(field.box_width || 0);
                    setPreviewHeight(field.box_height || 0);
                  }}
                  className={cn(
                    "text-left px-2 py-1 rounded text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                    selectedFieldId === field.id && "bg-blue-100 dark:bg-blue-900 ring-1 ring-blue-500"
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground w-4">p{field.page}</span>
                    <span className="font-medium truncate">{field.display_name}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground pl-5">
                    x:{field.x} y:{field.y}
                  </div>
                </button>
              ))}
          </div>
        </div>

      </div>

      {/* PDF Preview - takes remaining width, full height, scrollable */}
      <div
        className="flex-1 bg-gray-100 dark:bg-gray-900 overflow-auto min-h-0"
      >
        {loadingPdf ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : pdfUrl ? (
          <div className="flex gap-2 p-2 pb-8" style={{ minHeight: 'min-content' }}>
            {/* Current Page (interactive) */}
            <div
              ref={containerRef}
              className="relative shrink-0"
              style={{
                width: `${PDF_WIDTH * (zoom / 100)}px`,
                height: `${PDF_HEIGHT * (zoom / 100)}px`,
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";

                // Calculate preview position while dragging over PDF
                if (draggingFromPalette && containerRef.current) {
                  const rect = containerRef.current.getBoundingClientRect();
                  const scale = zoom / 100;
                  const screenX = e.clientX - rect.left;
                  const screenY = e.clientY - rect.top;
                  const pdfX = Math.round(screenX / scale);
                  const pdfY = Math.round(PDF_HEIGHT - (screenY / scale));
                  setDropPreview({ x: Math.max(0, Math.min(PDF_WIDTH, pdfX)), y: Math.max(0, Math.min(PDF_HEIGHT, pdfY)) });
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingFromPalette && containerRef.current && dropPreview) {
                  // Save the new position
                  savePosition(draggingFromPalette, { x: dropPreview.x, y: dropPreview.y, page: currentPage });
                  setSelectedFieldId(draggingFromPalette);
                  setDraggingFromPalette(null);
                  setDraggingFieldId(null);
                  setDropPreview(null);
                }
              }}
              onDragLeave={() => {
                if (draggingFromPalette) {
                  setDropPreview(null);
                }
              }}
            >
              {/* Page number label */}
              <div className="absolute -top-5 left-0 text-xs text-muted-foreground font-medium">
                Page {currentPage}
              </div>
              {/* PDF iframe - toolbar=0 hides browser PDF viewer controls */}
              <iframe
                key={`pdf-page-${currentPage}`}
                src={`${pdfUrl}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=0`}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ border: "none" }}
              />

            {/* Drop preview indicator - follows cursor during drag */}
            {dropPreview && draggingFieldId && (() => {
              const draggingField = positions.find(p => p.id === draggingFieldId);
              if (!draggingField) return null;

              const fieldName = draggingField.display_name || draggingField.field_key;
              const fieldContent = draggingField.test_value || "(empty)";
              const fontSize = draggingField.font_size || 10;

              return (
                <div
                  className="absolute pointer-events-none z-50"
                  style={{
                    left: `${(dropPreview.x / PDF_WIDTH) * 100}%`,
                    bottom: `${(dropPreview.y / PDF_HEIGHT) * 100}%`,
                    transform: `scale(${100 / zoom})`,
                    transformOrigin: "bottom left",
                  }}
                >
                  {/* Blue drag handle - same as placed fields */}
                  <div className="absolute bottom-full left-0 mb-0.5 flex items-center rounded shadow-lg">
                    <div className="bg-gray-700 text-white px-0.5 py-0.5 rounded-l flex items-center">
                      <GripVertical className="h-3 w-3" />
                    </div>
                    <div className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-r whitespace-nowrap font-medium">
                      {fieldName}
                    </div>
                  </div>
                  {/* Green value box */}
                  <div
                    className="bg-green-600 text-white px-1 py-0 rounded whitespace-nowrap shadow-lg border-2 border-white"
                    style={{
                      fontSize: `${fontSize}px`,
                      fontFamily: 'Helvetica, Arial, sans-serif',
                      height: `${draggingField.box_height && draggingField.box_height > 0 ? draggingField.box_height : 12}px`,
                      lineHeight: `${draggingField.box_height && draggingField.box_height > 0 ? draggingField.box_height : 12}px`,
                      ...(draggingField.box_width && draggingField.box_width > 0 && { width: `${draggingField.box_width}px`, minWidth: `${draggingField.box_width}px` }),
                    }}
                  >
                    {fieldContent}
                  </div>
                </div>
              );
            })()}


            {/* Field markers */}
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
                  {/* Field marker - blue handle above, green box at coordinates */}
                  <div
                    className="absolute"
                    style={{
                      left: `${savedLeftPercent}%`,
                      bottom: `${savedBottomPercent}%`,
                      transform: `scale(${100 / zoom})`,
                      transformOrigin: "bottom left",
                      zIndex: selectedFieldId === field.id ? 100 : 50,
                      pointerEvents: "auto",
                    }}
                  >
                    {/* Blue drag handle - grab this to position */}
                    <div
                      onMouseDown={(e) => handleMouseDown(e, field.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFieldId(field.id);
                        setPreviewWidth(field.box_width || 0);
                        setPreviewHeight(field.box_height || 0);
                      }}
                      className={cn(
                        "absolute bottom-full left-0 mb-0.5 flex items-center rounded shadow-lg cursor-grab active:cursor-grabbing select-none",
                        draggingFieldId === field.id ? "opacity-50" : "hover:ring-2 hover:ring-white",
                        selectedFieldId === field.id && "ring-2 ring-yellow-400"
                      )}
                      style={{ pointerEvents: "auto" }}
                    >
                      <div className="bg-gray-700 text-white px-0.5 py-0.5 rounded-l flex items-center">
                        <GripVertical className="h-3 w-3" />
                      </div>
                      <div className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-r whitespace-nowrap font-medium">
                        {fieldName}
                      </div>
                    </div>
                    {/* Green value box - shows where data will appear */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFieldId(field.id);
                        setPreviewWidth(field.box_width || 0);
                        setPreviewHeight(field.box_height || 0);
                      }}
                      className={cn(
                        "bg-green-600/90 text-white px-1 py-0 rounded shadow-lg cursor-pointer",
                        draggingFieldId === field.id ? "opacity-30" : "",
                        selectedFieldId === field.id && "ring-2 ring-yellow-400"
                      )}
                      style={{
                        fontSize: `${fontSize}px`,
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        height: `${field.box_height && field.box_height > 0 ? field.box_height : 12}px`,
                        lineHeight: `${field.box_height && field.box_height > 0 ? field.box_height : 12}px`,
                        ...(field.box_width && field.box_width > 0 && { width: `${field.box_width}px`, minWidth: `${field.box_width}px` }),
                        textAlign: field.text_align || "left",
                        whiteSpace: field.box_width ? "normal" : "nowrap",
                        overflow: "hidden",
                        pointerEvents: "auto",
                      }}
                      title={`${fieldName} | x=${field.x}, y=${field.y}`}
                    >
                      {fieldContent || "(empty)"}
                    </div>
                  </div>

                  {/* DROP PREVIEW - Shows green box at new position */}
                  {isDragging && dropPreview && (
                    <div
                      className="absolute z-40 pointer-events-none"
                      style={{
                        left: `${(dropPreview.x / PDF_WIDTH) * 100}%`,
                        bottom: `${(dropPreview.y / PDF_HEIGHT) * 100}%`,
                        transform: `scale(${100 / zoom})`,
                        transformOrigin: "bottom left",
                      }}
                    >
                      <div
                        className="bg-green-500 text-white px-1 py-0 rounded shadow-lg border-2 border-white"
                        style={{
                          fontSize: `${fontSize}px`,
                          fontFamily: 'Helvetica, Arial, sans-serif',
                          height: `${field.box_height && field.box_height > 0 ? field.box_height : 12}px`,
                          lineHeight: `${field.box_height && field.box_height > 0 ? field.box_height : 12}px`,
                          ...(field.box_width && field.box_width > 0 && { width: `${field.box_width}px`, minWidth: `${field.box_width}px` }),
                        }}
                      >
                        {fieldContent || "(empty)"}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            </div>

            {/* Next Page (now interactive for drops) */}
            {currentPage < totalPages && (
              <div
                className="relative shrink-0 opacity-90 hover:opacity-100 transition-opacity"
                style={{
                  width: `${PDF_WIDTH * (zoom / 100)}px`,
                  height: `${PDF_HEIGHT * (zoom / 100)}px`,
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  // Calculate preview position for page 2
                  if (draggingFromPalette) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const scale = zoom / 100;
                    const screenX = e.clientX - rect.left;
                    const screenY = e.clientY - rect.top;
                    const pdfX = Math.round(screenX / scale);
                    const pdfY = Math.round(PDF_HEIGHT - (screenY / scale));
                    setDropPreview({ x: Math.max(0, Math.min(PDF_WIDTH, pdfX)), y: Math.max(0, Math.min(PDF_HEIGHT, pdfY)) });
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggingFromPalette && dropPreview) {
                    // Save to NEXT page (currentPage + 1)
                    savePosition(draggingFromPalette, { x: dropPreview.x, y: dropPreview.y, page: currentPage + 1 });
                    setSelectedFieldId(draggingFromPalette);
                    setDraggingFromPalette(null);
                    setDraggingFieldId(null);
                    setDropPreview(null);
                  }
                }}
                onDragLeave={() => {
                  if (draggingFromPalette) {
                    setDropPreview(null);
                  }
                }}
              >
                {/* Page number label */}
                <div className="absolute -top-5 left-0 text-xs text-muted-foreground font-medium">
                  Page {currentPage + 1}
                </div>
                <iframe
                  key={`pdf-page-${currentPage + 1}`}
                  src={`${pdfUrl}#page=${currentPage + 1}&toolbar=0&navpanes=0&scrollbar=0`}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ border: "none" }}
                />

                {/* Drop preview on page 2 */}
                {dropPreview && draggingFromPalette && (() => {
                  const draggingField = positions.find(p => p.id === draggingFromPalette);
                  if (!draggingField) return null;
                  const fieldName = draggingField.display_name || draggingField.field_key;
                  const fieldContent = draggingField.test_value || "(empty)";
                  const fontSize = draggingField.font_size || 10;
                  return (
                    <div
                      className="absolute pointer-events-none z-50"
                      style={{
                        left: `${(dropPreview.x / PDF_WIDTH) * 100}%`,
                        bottom: `${(dropPreview.y / PDF_HEIGHT) * 100}%`,
                        transform: `scale(${100 / zoom})`,
                        transformOrigin: "bottom left",
                      }}
                    >
                      {/* Blue drag handle */}
                      <div className="absolute bottom-full left-0 mb-0.5 flex items-center rounded shadow-lg">
                        <div className="bg-gray-700 text-white px-0.5 py-0.5 rounded-l flex items-center">
                          <GripVertical className="h-3 w-3" />
                        </div>
                        <div className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-r whitespace-nowrap font-medium">
                          {fieldName}
                        </div>
                      </div>
                      {/* Green value box */}
                      <div
                        className="bg-green-600 text-white px-1 py-0 rounded whitespace-nowrap shadow-lg border-2 border-white"
                        style={{
                          fontSize: `${fontSize}px`,
                          fontFamily: 'Helvetica, Arial, sans-serif',
                          height: `${draggingField.box_height && draggingField.box_height > 0 ? draggingField.box_height : 12}px`,
                          lineHeight: `${draggingField.box_height && draggingField.box_height > 0 ? draggingField.box_height : 12}px`,
                          ...(draggingField.box_width && draggingField.box_width > 0 && { width: `${draggingField.box_width}px`, minWidth: `${draggingField.box_width}px` }),
                        }}
                      >
                        {fieldContent}
                      </div>
                    </div>
                  );
                })()}
                {/* Fields on next page (now clickable to select and navigate) */}
                {positions.filter(p => p.page === currentPage + 1).map((field) => {
                  const fieldName = field.display_name || field.field_key;
                  const fieldContent = field.test_value || "";
                  const fontSize = field.font_size || 10;
                  const savedLeftPercent = (field.x / PDF_WIDTH) * 100;
                  const savedBottomPercent = (field.y / PDF_HEIGHT) * 100;

                  return (
                    <div
                      key={field.id}
                      className="absolute"
                      style={{
                        left: `${savedLeftPercent}%`,
                        bottom: `${savedBottomPercent}%`,
                        transform: `scale(${100 / zoom})`,
                        transformOrigin: "bottom left",
                        zIndex: selectedFieldId === field.id ? 100 : 50,
                        pointerEvents: "auto",
                      }}
                    >
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFieldId(field.id);
                          setCurrentPage(currentPage + 1); // Navigate to this page
                          setPreviewWidth(field.box_width || 0);
                          setPreviewHeight(field.box_height || 0);
                        }}
                        className={cn(
                          "flex items-center rounded shadow-lg mb-0.5 cursor-pointer hover:ring-2 hover:ring-white",
                          selectedFieldId === field.id && "ring-2 ring-yellow-400"
                        )}
                        style={{ pointerEvents: "auto" }}
                      >
                        <div className="bg-gray-600 text-white px-0.5 py-0.5 rounded-l flex items-center">
                          <GripVertical className="h-3 w-3" />
                        </div>
                        <div className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-r whitespace-nowrap font-medium">
                          {fieldName}
                        </div>
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFieldId(field.id);
                          setCurrentPage(currentPage + 1); // Navigate to this page
                          setPreviewWidth(field.box_width || 0);
                          setPreviewHeight(field.box_height || 0);
                        }}
                        className={cn(
                          "bg-green-500/90 text-white px-1 py-0 rounded shadow-lg cursor-pointer",
                          selectedFieldId === field.id && "ring-2 ring-yellow-400"
                        )}
                        style={{
                          fontSize: `${fontSize}px`,
                          fontFamily: 'Helvetica, Arial, sans-serif',
                          height: `${field.box_height && field.box_height > 0 ? field.box_height : 12}px`,
                          lineHeight: `${field.box_height && field.box_height > 0 ? field.box_height : 12}px`,
                          ...(field.box_width && field.box_width > 0 && { width: `${field.box_width}px`, minWidth: `${field.box_width}px` }),
                          textAlign: field.text_align || "left",
                          whiteSpace: field.box_width ? "normal" : "nowrap",
                          overflow: "hidden",
                          pointerEvents: "auto",
                        }}
                      >
                        {fieldContent || "(empty)"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a job to load PDF preview
          </div>
        )}
      </div>

      {/* Placeholder Palette Panel - Right side */}
      <div className="w-64 border-l bg-background flex flex-col shrink-0">
        <div className="p-2 border-b">
          <div className="text-sm font-medium mb-2">Placeholders</div>
          <Input
            placeholder="Search..."
            value={paletteSearch}
            onChange={(e) => setPaletteSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {/* Column headers */}
          <div className="flex text-[10px] text-muted-foreground uppercase tracking-wide mb-2 px-1">
            <span className="flex-1">Field</span>
            <span className="w-24 text-right">Value</span>
          </div>

          {/* Field list */}
          <div className="flex flex-col gap-1">
            {positions
              .filter(f =>
                paletteSearch === "" ||
                f.display_name.toLowerCase().includes(paletteSearch.toLowerCase()) ||
                f.field_key.toLowerCase().includes(paletteSearch.toLowerCase())
              )
              .sort((a, b) => a.page - b.page || a.display_name.localeCompare(b.display_name))
              .map((field) => (
                <div
                  key={field.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggingFromPalette(field.id);
                    setDraggingFieldId(field.id);
                    setDragStartFieldPos({ x: field.x, y: field.y });
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDraggingFromPalette(null);
                  }}
                  onClick={() => {
                    setSelectedFieldId(field.id);
                    setCurrentPage(field.page);
                    setPreviewWidth(field.box_width || 0);
                    setPreviewHeight(field.box_height || 0);
                  }}
                  className={cn(
                    "flex items-center gap-2 p-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border",
                    selectedFieldId === field.id ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300" : "border-transparent",
                    field.page === currentPage ? "opacity-100" : "opacity-60"
                  )}
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{field.display_name}</div>
                    <div className="text-[10px] text-muted-foreground">p{field.page} • {field.field_key}</div>
                  </div>
                  <div className="w-20 text-right">
                    <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded truncate inline-block max-w-full">
                      {field.test_value || "(empty)"}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Selected field info */}
        {selectedFieldId && (() => {
          const field = positions.find(p => p.id === selectedFieldId);
          if (!field) return null;
          return (
            <div className="border-t p-2 bg-slate-50 dark:bg-slate-900">
              <div className="text-xs font-medium mb-1">{field.display_name}</div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <span className="text-muted-foreground">Page:</span>
                <span>{field.page}</span>
                <span className="text-muted-foreground">X:</span>
                <span>{field.x}</span>
                <span className="text-muted-foreground">Y:</span>
                <span>{field.y}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Error display only */}
      {pdfError && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-sm">
          <strong>PDF Error:</strong> {pdfError}
        </div>
      )}
    </div>
  );
}
