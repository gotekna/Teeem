"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
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
  Eye,
  EyeOff,
  MousePointer2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";

// Initialize pdf.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

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

// Detected form field from PDF parsing (AcroForm)
interface DetectedField {
  name: string;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  is_text: boolean;
  is_checkbox: boolean;
  is_dropdown: boolean;
}

const TEMPLATE_OPTIONS = [
  { value: "qbcc_contract", label: "QBCC Contract", pages: 5 },
  { value: "qbcc_consumer_guide", label: "QBCC Consumer Guide", pages: 2 },
  { value: "qbcc_general_conditions", label: "QBCC General Conditions", pages: 16 },
];

// PDF dimensions in points (A4)
const PDF_WIDTH = 595;
const PDF_HEIGHT = 842;

// Overflow groups: PDF form fields that represent the same logical data field
// When one field in a group is mapped, all fields in the group should show as mapped
const OVERFLOW_GROUPS: Record<string, { fields: string[]; dataKey: string; label: string }> = {
  site_address: {
    fields: ["Text Field 34", "Text Field 35"],
    dataKey: "site_address", // Primary field key (line 1)
    label: "Site Address (continues)",
  },
};

export function PdfFieldsTab() {
  const { toast } = useToast();
  const [positions, setPositions] = React.useState<PdfFieldPosition[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Persist selections in localStorage
  const [selectedTemplate, setSelectedTemplate] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pdfFieldsTab_template') || "qbcc_contract";
    }
    return "qbcc_contract";
  });
  const [selectedJobId, setSelectedJobId] = React.useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pdfFieldsTab_jobId');
      return saved ? parseInt(saved) : null;
    }
    return null;
  });
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [currentPage, setCurrentPage] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pdfFieldsTab_page');
      return saved ? parseInt(saved) : 2;
    }
    return 2;
  });
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = React.useState(false);
  const [zoom, setZoom] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pdfFieldsTab_zoom');
      return saved ? parseInt(saved) : 100;
    }
    return 100;
  });
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
  // paletteSearch removed - using click-to-map dialog as SSoT
  const [draggingFromPalette, setDraggingFromPalette] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Detected form fields from PDF parsing (masterpiece UX)
  const [detectedFields, setDetectedFields] = React.useState<DetectedField[]>([]);
  const [loadingDetected, setLoadingDetected] = React.useState(false);
  const [showDetectedFields, setShowDetectedFields] = React.useState(true);
  const [showMappedFields, setShowMappedFields] = React.useState(true);
  const [clickedDetectedField, setClickedDetectedField] = React.useState<DetectedField | null>(null);

  // Preview values from selected job (shows actual data in dropdown)
  const [previewValues, setPreviewValues] = React.useState<Record<string, string>>({});

  // Compact mode - hides blue info box and drag handles in mapping dialog
  const [compactMode, setCompactMode] = React.useState(false);

  // Show blank template (no job data filled in)
  const [showBlankTemplate, setShowBlankTemplate] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pdfFieldsTab_blankTemplate');
      return saved !== 'false'; // Default to true
    }
    return true;
  });

  // react-pdf dimensions for precise overlay alignment
  const [pdfDimensions, setPdfDimensions] = React.useState<{ width: number; height: number } | null>(null);
  const pageRef = React.useRef<HTMLDivElement>(null);

  // Debug logger
  const addDebugLog = React.useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(`[PdfFieldsTab] ${message}`);
    setDebugLogs((prev) => [...prev.slice(-19), logEntry]);
  }, []);

  // Persist selections to localStorage
  React.useEffect(() => {
    localStorage.setItem('pdfFieldsTab_template', selectedTemplate);
  }, [selectedTemplate]);

  React.useEffect(() => {
    localStorage.setItem('pdfFieldsTab_page', String(currentPage));
  }, [currentPage]);

  React.useEffect(() => {
    if (selectedJob) {
      localStorage.setItem('pdfFieldsTab_jobId', String(selectedJob.id));
    }
  }, [selectedJob]);

  React.useEffect(() => {
    localStorage.setItem('pdfFieldsTab_zoom', String(zoom));
  }, [zoom]);

  React.useEffect(() => {
    localStorage.setItem('pdfFieldsTab_blankTemplate', String(showBlankTemplate));
  }, [showBlankTemplate]);

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

  // Load detected form fields from PDF (masterpiece UX)
  const loadDetectedFields = React.useCallback(async () => {
    try {
      setLoadingDetected(true);
      addDebugLog(`Detecting form fields in PDF: ${selectedTemplate}`);
      const response = await api.get<{
        success: boolean;
        detected_fields: DetectedField[];
        total_count: number;
        pages: number[];
      }>(`/api/v1/pdf_field_positions/detect_fields?template=${selectedTemplate}`);

      if (response.success && response.detected_fields) {
        addDebugLog(`Detected ${response.detected_fields.length} form fields across pages: ${response.pages?.join(", ")}`);
        setDetectedFields(response.detected_fields);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addDebugLog(`DETECTION ERROR: ${errorMsg}`);
      // Don't show toast - detection is optional enhancement
    } finally {
      setLoadingDetected(false);
    }
  }, [selectedTemplate, addDebugLog]);

  // Load jobs
  const loadJobs = React.useCallback(async () => {
    try {
      const response = await api.get<{ jobs: Job[] }>("/api/v1/jobs?per_page=100");
      if (response.jobs) {
        setJobs(response.jobs);
        if (response.jobs.length > 0) {
          // Restore previously selected job from localStorage
          if (selectedJobId) {
            const savedJob = response.jobs.find((j) => j.id === selectedJobId);
            if (savedJob) {
              setSelectedJob(savedJob);
              return;
            }
          }
          // Fallback: find Wategos or use first job
          const wategos = response.jobs.find((j) =>
            j.name?.toLowerCase().includes("wategos")
          );
          setSelectedJob(wategos || response.jobs[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load jobs:", err);
    }
  }, [selectedJobId]);

  // Fetch preview values for the selected job (shows actual data in dropdowns)
  const fetchPreviewValues = React.useCallback(async () => {
    if (!selectedJob) {
      setPreviewValues({});
      return;
    }
    try {
      const response = await api.get<{ success: boolean; values: Record<string, string> }>(
        `/api/v1/pdf_field_positions/preview_values?template=${selectedTemplate}&job_id=${selectedJob.id}`
      );
      if (response.success && response.values) {
        setPreviewValues(response.values);
        addDebugLog(`Loaded ${Object.keys(response.values).length} preview values`);
      }
    } catch (err) {
      console.error("Failed to load preview values:", err);
      setPreviewValues({});
    }
  }, [selectedJob, selectedTemplate, addDebugLog]);

  // Fetch preview values when job or template changes
  React.useEffect(() => {
    fetchPreviewValues();
  }, [fetchPreviewValues]);

  // Load PDF preview (blank template or filled with job data)
  const loadPdfPreview = React.useCallback(async () => {
    try {
      setLoadingPdf(true);
      setPdfError(null);

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

      // Build URL - blank template or filled preview
      let url: string;
      if (showBlankTemplate) {
        // Load blank template directly
        url = `${backendUrl}/api/v1/pdf_field_positions/template?template=${selectedTemplate}`;
        addDebugLog(`Loading blank template: ${selectedTemplate}`);
      } else {
        // Load preview with job data
        if (!selectedJob) return;
        url = `${backendUrl}/api/v1/pdf_field_positions/preview?template=${selectedTemplate}&job_id=${selectedJob.id}`;
        addDebugLog(`Loading preview: ${selectedTemplate}, job=${selectedJob.id}`);
      }

      const response = await fetch(url, {
        method: showBlankTemplate ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

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
  }, [selectedTemplate, selectedJob, showBlankTemplate, addDebugLog]);

  React.useEffect(() => {
    addDebugLog("Component mounted");
  }, [addDebugLog]);

  React.useEffect(() => {
    loadPositions();
    loadDetectedFields();
  }, [loadPositions, loadDetectedFields]);

  React.useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  React.useEffect(() => {
    // Load blank template immediately, or wait for job selection for filled preview
    if (showBlankTemplate || selectedJob) {
      loadPdfPreview();
    }
  }, [selectedJob, showBlankTemplate, loadPdfPreview]);

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

        {/* Toggle detected fields visibility */}
        <Button
          variant={showDetectedFields ? "default" : "outline"}
          size="sm"
          onClick={() => setShowDetectedFields(!showDetectedFields)}
          className="h-7 text-xs"
          title={showDetectedFields ? "Hide detected form fields" : "Show detected form fields"}
        >
          {showDetectedFields ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
          {loadingDetected ? "Detecting..." : `${detectedFields.filter(df => df.page === currentPage && df.is_text).length} Fields`}
        </Button>

        {/* Toggle blank/filled template */}
        <Button
          variant={showBlankTemplate ? "outline" : "default"}
          size="sm"
          onClick={() => setShowBlankTemplate(!showBlankTemplate)}
          className="h-7 text-xs"
          title={showBlankTemplate ? "Show preview with job data" : "Show blank template"}
        >
          {showBlankTemplate ? "Blank" : "With Data"}
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
                  const field = positions.find(p => p.id === draggingFromPalette);

                  // Check if drop position overlaps with a detected field
                  const matchingDetectedField = detectedFields.find(df =>
                    df.page === currentPage &&
                    dropPreview.x >= df.x - 10 && dropPreview.x <= df.x + df.width + 10 &&
                    dropPreview.y >= df.y - 10 && dropPreview.y <= df.y + df.height + 10
                  );

                  if (matchingDetectedField && field) {
                    // Smart alignment: currency → right, date → left, others → center
                    const fieldKey = field.field_key.toLowerCase();
                    const isCurrency = /(\$|amount|price|cost|total|deposit|fee|payment)/.test(fieldKey);
                    const isDate = /(date|day|month|year)/.test(fieldKey);
                    const textAlign = isCurrency ? "right" : isDate ? "left" : "center";

                    // Auto-size to match detected field
                    savePosition(draggingFromPalette, {
                      x: Math.round(matchingDetectedField.x),
                      y: Math.round(matchingDetectedField.y),
                      page: currentPage,
                      box_width: Math.round(matchingDetectedField.width),
                      box_height: Math.round(matchingDetectedField.height),
                      text_align: textAlign,
                    });
                    toast({
                      title: "Field Snapped",
                      description: `${field.display_name} → auto-sized & ${textAlign} aligned`,
                    });
                  } else {
                    // No detected field match, just save position
                    savePosition(draggingFromPalette, { x: dropPreview.x, y: dropPreview.y, page: currentPage });
                  }

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
              {/* PDF rendered with react-pdf for precise coordinate alignment */}
              <div ref={pageRef} className="absolute inset-0 pointer-events-none">
                <Document
                  file={pdfUrl}
                  loading={null}
                  error={<div className="text-red-500 text-sm p-4">Failed to load PDF</div>}
                >
                  <Page
                    pageNumber={currentPage}
                    width={PDF_WIDTH * (zoom / 100)}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={(page) => {
                      setPdfDimensions({ width: page.width, height: page.height });
                    }}
                  />
                </Document>
              </div>

            {/* Drop preview removed - using click-to-map only */}

            {/* DETECTED FORM FIELDS - Blue dashed overlays (masterpiece UX) */}
            {showDetectedFields && detectedFields
              .filter((df) => df.page === currentPage && df.is_text)
              .map((df, idx) => {
                // Check if this detected field is already mapped and get the mapped field
                // Match tolerance reduced to 10px to avoid overlapping matches
                const mappedField = positions.find(
                  (p) => p.page === df.page &&
                    Math.abs(p.x - df.x) < 10 &&
                    Math.abs(p.y - df.y) < 10
                );

                // Check if this field is part of an overflow group
                const overflowGroup = Object.values(OVERFLOW_GROUPS).find(
                  (group) => group.fields.includes(df.name)
                );
                const fieldIndexInGroup = overflowGroup
                  ? overflowGroup.fields.indexOf(df.name)
                  : -1;

                // For overflow groups, check if the primary field (first in group) is mapped
                let isOverflowMapped = false;
                let overflowMappedField: PdfFieldPosition | undefined;
                if (overflowGroup && !mappedField) {
                  // Find the primary field (first in the group) and check if it's mapped
                  const primaryFieldName = overflowGroup.fields[0];
                  const primaryDetectedField = detectedFields.find(
                    (f) => f.name === primaryFieldName && f.page === currentPage
                  );
                  if (primaryDetectedField) {
                    overflowMappedField = positions.find(
                      (p) => p.page === primaryDetectedField.page &&
                        Math.abs(p.x - primaryDetectedField.x) < 10 &&
                        Math.abs(p.y - primaryDetectedField.y) < 10
                    );
                    isOverflowMapped = !!overflowMappedField;
                  }
                }

                const isMapped = !!mappedField || isOverflowMapped;
                const effectiveMappedField = mappedField || overflowMappedField;

                // Get the preview value for this field if mapped
                // For overflow fields (line 2), use site_address_2 key
                let mappedValue = "";
                if (mappedField) {
                  mappedValue = previewValues[mappedField.field_key] || mappedField.test_value || "";
                } else if (isOverflowMapped && overflowMappedField) {
                  // For secondary overflow fields, use the _2 suffix key
                  const secondaryKey = `${overflowMappedField.field_key}_2`;
                  mappedValue = fieldIndexInGroup > 0
                    ? (previewValues[secondaryKey] || "")
                    : (previewValues[overflowMappedField.field_key] || overflowMappedField.test_value || "");
                }

                // Convert PDF coordinates (origin bottom-left) to CSS (origin top-left)
                // PDF y is distance from bottom, CSS top is distance from top
                const cssTop = ((PDF_HEIGHT - df.y - df.height) / PDF_HEIGHT) * 100;

                return (
                  <div
                    key={`detected-${idx}`}
                    className={cn(
                      "absolute cursor-pointer transition-colors group",
                      isMapped
                        ? "bg-green-500/30 hover:bg-green-500/40"
                        : "hover:bg-blue-500/20"
                    )}
                    style={{
                      left: `${(df.x / PDF_WIDTH) * 100}%`,
                      top: `${cssTop}%`,
                      width: `${(df.width / PDF_WIDTH) * 100}%`,
                      height: `${(df.height / PDF_HEIGHT) * 100}%`,
                      border: isMapped ? "2px solid #22c55e" : "2px dashed #3b82f6",
                      borderRadius: "2px",
                      zIndex: 30,
                    }}
                    onClick={() => setClickedDetectedField(df)}
                    title={isMapped
                      ? `Mapped: ${effectiveMappedField?.display_name}${isOverflowMapped ? " (overflow)" : ""} = ${mappedValue}`
                      : `Click to map: ${df.name}`}
                  >
                    {/* Show mapped data value inside the box */}
                    {isMapped && mappedValue && (
                      <div
                        className="absolute inset-0 flex items-center px-1 text-green-800 dark:text-green-200 font-medium overflow-hidden"
                        style={{ fontSize: `${Math.min(df.height * 0.7, 12)}px` }}
                      >
                        <span className="truncate">{mappedValue}</span>
                      </div>
                    )}
                    {/* Hover label */}
                    <div className={cn(
                      "absolute -top-5 left-0 opacity-0 group-hover:opacity-100 transition-opacity text-white text-[9px] px-1 py-0.5 rounded whitespace-nowrap shadow-lg",
                      isMapped ? "bg-green-600" : "bg-blue-600"
                    )}>
                      {isMapped
                        ? `✓ ${effectiveMappedField?.display_name}${isOverflowMapped ? " (line 2)" : ""}`
                        : "Click to map"}
                    </div>
                  </div>
                );
              })}

            {/* Mapped field markers removed - using click-to-map blue boxes only */}
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
                    const field = positions.find(p => p.id === draggingFromPalette);
                    const nextPage = currentPage + 1;

                    // Check if drop position overlaps with a detected field on next page
                    const matchingDetectedField = detectedFields.find(df =>
                      df.page === nextPage &&
                      dropPreview.x >= df.x - 10 && dropPreview.x <= df.x + df.width + 10 &&
                      dropPreview.y >= df.y - 10 && dropPreview.y <= df.y + df.height + 10
                    );

                    if (matchingDetectedField && field) {
                      // Smart alignment: currency → right, date → left, others → center
                      const fieldKey = field.field_key.toLowerCase();
                      const isCurrency = /(\$|amount|price|cost|total|deposit|fee|payment)/.test(fieldKey);
                      const isDate = /(date|day|month|year)/.test(fieldKey);
                      const textAlign = isCurrency ? "right" : isDate ? "left" : "center";

                      // Auto-size to match detected field
                      savePosition(draggingFromPalette, {
                        x: Math.round(matchingDetectedField.x),
                        y: Math.round(matchingDetectedField.y),
                        page: nextPage,
                        box_width: Math.round(matchingDetectedField.width),
                        box_height: Math.round(matchingDetectedField.height),
                        text_align: textAlign,
                      });
                      toast({
                        title: "Field Snapped",
                        description: `${field.display_name} → auto-sized & ${textAlign} aligned`,
                      });
                    } else {
                      // No detected field match, just save position
                      savePosition(draggingFromPalette, { x: dropPreview.x, y: dropPreview.y, page: nextPage });
                    }

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
                {/* PDF rendered with react-pdf for precise coordinate alignment */}
                <div className="absolute inset-0 pointer-events-none">
                  <Document file={pdfUrl} loading={null}>
                    <Page
                      pageNumber={currentPage + 1}
                      width={PDF_WIDTH * (zoom / 100)}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                </div>

                {/* Drop preview on page 2 removed - using click-to-map only */}
                {/* Mapped fields on next page removed - using click-to-map blue boxes only */}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a job to load PDF preview
          </div>
        )}
      </div>

      {/* Placeholder Palette Panel removed - using click-to-map dialog as SSoT */}

      {/* Error display only */}
      {pdfError && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-sm">
          <strong>PDF Error:</strong> {pdfError}
        </div>
      )}

      {/* Click-to-Map Dialog (masterpiece UX) */}
      <Dialog open={!!clickedDetectedField} onOpenChange={(open) => !open && setClickedDetectedField(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MousePointer2 className="h-5 w-5 text-blue-600" />
              Map Field
            </DialogTitle>
            <DialogDescription>
              Map this PDF form field to a data field from your job.
            </DialogDescription>
          </DialogHeader>

          {clickedDetectedField && (
            <div className="space-y-4">
              {/* Compact mode toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {compactMode ? "Clean view" : "Full view"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCompactMode(!compactMode)}
                  className="h-7 text-xs"
                >
                  {compactMode ? "Show Details" : "Hide Details"}
                </Button>
              </div>

              {/* Detected field info - hidden in compact mode */}
              {!compactMode && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    PDF Form Field
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {clickedDetectedField.name}
                  </div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                    Page {clickedDetectedField.page} • {Math.round(clickedDetectedField.width)}×{Math.round(clickedDetectedField.height)}px
                  </div>
                </div>
              )}

              {/* Data field selector - searchable */}
              <div>
                <Label className="text-sm font-medium">Map to Data Field</Label>
                <div className="mt-1">
                  <ComboboxDropdown
                    selectedItem={undefined}
                    onSelect={(item) => {
                      if (item) {
                        const field = positions.find(p => p.id === parseInt(item.id));
                        if (field && clickedDetectedField) {
                          // Determine text alignment based on field type
                          // Currency fields → right aligned, Date fields → left aligned, Others → center
                          const fieldKey = field.field_key.toLowerCase();
                          const isCurrency = /(\$|amount|price|cost|total|deposit|fee|payment)/.test(fieldKey);
                          const isDate = /(date|day|month|year)/.test(fieldKey);
                          const textAlign = isCurrency ? "right" : isDate ? "left" : "center";

                          // Update the field position to match detected field with smart alignment
                          savePosition(field.id, {
                            x: Math.round(clickedDetectedField.x),
                            y: Math.round(clickedDetectedField.y),
                            page: clickedDetectedField.page,
                            box_width: Math.round(clickedDetectedField.width),
                            box_height: Math.round(clickedDetectedField.height),
                            text_align: textAlign,
                          });
                          setClickedDetectedField(null);
                          toast({
                            title: "Field Mapped",
                            description: `${field.display_name} → ${textAlign} aligned`,
                          });
                        }
                      }
                    }}
                    items={positions
                      .sort((a, b) => a.display_name.localeCompare(b.display_name))
                      .map((field) => {
                        // Use preview values from selected job if available
                        const value = previewValues[field.field_key] || field.test_value || "";
                        const displayValue = value ? value.substring(0, 40) + (value.length > 40 ? "..." : "") : "empty";
                        return {
                          id: String(field.id),
                          label: `${field.display_name} (${displayValue})`,
                        };
                      })}
                    placeholder={`Map "${clickedDetectedField.name}" to...`}
                    searchPlaceholder="Type to search..."
                    emptyResults="No matching fields"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setClickedDetectedField(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
