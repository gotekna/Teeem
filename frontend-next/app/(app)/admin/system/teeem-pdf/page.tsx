"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Save,
  Download,
  Upload,
  FileText,
  ChevronLeft,
  MoreVertical,
  Plus,
  Briefcase,
  X,
  Search,
  FilePlus,
  PenLine,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useLayoutMode } from "@/contexts/LayoutModeContext";
import { useToast } from "@/components/ui/use-toast";
import { PDFEditor } from "@/components/ui/pdf-editor";
import { ESignaturePdfEditor } from "@/components/e-signature/e-signature-pdf-editor";
import type { Signer, SignatureField } from "@/components/ui/pdf-editor/types";
import { SIGNER_COLORS } from "@/components/ui/pdf-editor/types";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Types
interface TeeemPdf {
  id: number;
  name: string;
  description?: string;
  data: PdfData;
  jobId?: number;
  jobName?: string;
  pageCount: number;
  updatedAt: string;
  createdAt: string;
}

interface PdfData {
  pdfBase64?: string; // Base64 encoded PDF bytes
  metadata?: {
    title?: string;
    author?: string;
    version?: number;
  };
  // E-signature data
  signers?: Signer[];
  signatureFields?: SignatureField[];
}

interface Job {
  id: number;
  name: string;
}

export default function TeeemPdfPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pdfId = searchParams.get("id");
  const { setMode } = useLayoutMode();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Enable fullscreen mode (hide sidebar/breadcrumbs)
  React.useEffect(() => {
    setMode("fullscreen");
    return () => setMode("padded");
  }, [setMode]);

  // State
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [pdf, setPdf] = React.useState<TeeemPdf | null>(null);
  const [name, setName] = React.useState("Untitled PDF");
  const [hasChanges, setHasChanges] = React.useState(false);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [isBlankPdf, setIsBlankPdf] = React.useState(false);

  // Job association state
  const [selectedJobId, setSelectedJobId] = React.useState<number | null>(null);
  const [selectedJobName, setSelectedJobName] = React.useState<string | null>(null);
  const [jobSearchOpen, setJobSearchOpen] = React.useState(false);
  const [jobSearchTerm, setJobSearchTerm] = React.useState("");
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = React.useState(false);

  // E-signature mode state
  const [esignMode, setEsignMode] = React.useState(false);
  const [signers, setSigners] = React.useState<Signer[]>([]);
  const [selectedSigner, setSelectedSigner] = React.useState<Signer | null>(null);
  const [signatureFields, setSignatureFields] = React.useState<SignatureField[]>([]);

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = React.useState(false);

  // Search jobs for the job picker
  const searchJobs = React.useCallback(async (term: string) => {
    setLoadingJobs(true);
    try {
      const url = term.trim()
        ? `/api/v1/jobs/for_select?q=${encodeURIComponent(term)}`
        : `/api/v1/jobs/for_select`;
      const response = await api.get<{ success: boolean; jobs: Job[] }>(url);
      if (response?.success && response.jobs) {
        setJobs(response.jobs.slice(0, 20));
      }
    } catch (error) {
      console.error("Failed to search jobs:", error);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // Load jobs when popover opens
  React.useEffect(() => {
    if (!jobSearchOpen) return;
    if (jobSearchTerm === "") {
      searchJobs("");
      return;
    }
    const timeout = setTimeout(() => {
      searchJobs(jobSearchTerm);
    }, 300);
    return () => clearTimeout(timeout);
  }, [jobSearchTerm, jobSearchOpen, searchJobs]);

  // Create a blank PDF
  const createBlankPdf = async (): Promise<string> => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Add placeholder text
    page.drawText("Double-click to edit or use the annotation tools", {
      x: 50,
      y: 742,
      size: 12,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  };

  // Load PDF or create new
  React.useEffect(() => {
    const loadOrCreate = async () => {
      setLoading(true);
      try {
        if (pdfId) {
          // Load existing PDF
          const response = await api.get<{ success: boolean; data: TeeemPdf }>(
            `/api/v1/teeem_pdfs/${pdfId}`
          );
          if (response?.success && response.data) {
            setPdf(response.data);
            setName(response.data.name);
            setSelectedJobId(response.data.jobId || null);
            setSelectedJobName(response.data.jobName || null);

            // Convert base64 to blob URL
            if (response.data.data?.pdfBase64) {
              const binaryString = atob(response.data.data.pdfBase64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: "application/pdf" });
              setPdfUrl(URL.createObjectURL(blob));
            } else {
              // No PDF data yet - create blank
              const blankUrl = await createBlankPdf();
              setPdfUrl(blankUrl);
              setIsBlankPdf(true);
            }

            // Restore e-signature data if present
            if (response.data.data?.signers) {
              setSigners(response.data.data.signers);
            }
            if (response.data.data?.signatureFields) {
              setSignatureFields(response.data.data.signatureFields);
            }
          }
        } else {
          // Create new PDF record
          const response = await api.post<{ success: boolean; data: TeeemPdf }>(
            "/api/v1/teeem_pdfs",
            { teeem_pdf: { name: "Untitled PDF" } }
          );
          if (response?.success && response.data) {
            setPdf(response.data);
            setName(response.data.name);

            // Create blank PDF
            const blankUrl = await createBlankPdf();
            setPdfUrl(blankUrl);
            setIsBlankPdf(true);

            router.replace(`/admin/system/teeem-pdf?id=${response.data.id}`);
          }
        }
      } catch (error) {
        console.error("Failed to load/create PDF:", error);
        toast({
          title: "Error",
          description: "Failed to load PDF. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadOrCreate();
  }, [pdfId, router, toast]);

  // Cleanup blob URLs
  React.useEffect(() => {
    return () => {
      if (pdfUrl && pdfUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // Handle PDF save from editor
  const handlePdfSave = async (pdfBytes: Uint8Array, fileName: string) => {
    if (!pdf) return;

    setSaving(true);
    try {
      // Convert to base64
      const base64 = btoa(
        Array.from(pdfBytes)
          .map((b) => String.fromCharCode(b))
          .join("")
      );

      await api.patch(`/api/v1/teeem_pdfs/${pdf.id}`, {
        teeem_pdf: {
          name,
          job_id: selectedJobId,
          data: {
            pdfBase64: base64,
            metadata: {
              title: name,
              version: (pdf.data?.metadata?.version || 0) + 1,
            },
            // Include e-signature data
            signers: signers.length > 0 ? signers : undefined,
            signatureFields: signatureFields.length > 0 ? signatureFields : undefined,
          },
        },
      });

      setHasChanges(false);
      setIsBlankPdf(false);

      toast({
        title: "Saved",
        description: "PDF saved successfully",
      });
    } catch (error) {
      console.error("Failed to save:", error);
      toast({
        title: "Error",
        description: "Failed to save PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle manual save
  const handleSave = async () => {
    if (!pdf) return;

    setSaving(true);
    try {
      await api.patch(`/api/v1/teeem_pdfs/${pdf.id}`, {
        teeem_pdf: {
          name,
          job_id: selectedJobId,
        },
      });
      setHasChanges(false);

      toast({
        title: "Saved",
        description: "PDF metadata saved",
      });
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  // Import PDF file
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });

      // Revoke old URL
      if (pdfUrl && pdfUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pdfUrl);
      }

      setPdfUrl(URL.createObjectURL(blob));
      setIsBlankPdf(false);
      setHasChanges(true);

      const fileName = file.name.replace(/\.pdf$/i, "");
      setName(fileName);

      toast({
        title: "PDF imported",
        description: "Use the editor to annotate, then save to keep changes",
      });
    } catch (error) {
      console.error("Failed to import:", error);
      toast({
        title: "Import failed",
        description: "Failed to import PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Download current PDF
  const handleDownload = async () => {
    if (!pdfUrl) return;

    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9]/gi, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download:", error);
    }
  };

  // Handle drag-and-drop PDF import
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({
        title: "Invalid file type",
        description: "Please drop a PDF file",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });

      // Revoke old URL
      if (pdfUrl && pdfUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pdfUrl);
      }

      setPdfUrl(URL.createObjectURL(blob));
      setIsBlankPdf(false);
      setHasChanges(true);

      const fileName = file.name.replace(/\.pdf$/i, "");
      setName(fileName);

      toast({
        title: "PDF imported",
        description: "Use the editor to annotate, then save to keep changes",
      });
    } catch (error) {
      console.error("Failed to import:", error);
      toast({
        title: "Import failed",
        description: "Failed to import PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  // Signer management for e-signature mode
  const handleAddSigner = React.useCallback((email: string, signerName?: string) => {
    const newSigner: Signer = {
      id: `signer-${Date.now()}`,
      email,
      name: signerName,
      color: SIGNER_COLORS[signers.length % SIGNER_COLORS.length],
      order: signers.length,
    };
    setSigners((prev) => [...prev, newSigner]);
    setSelectedSigner(newSigner);
    setHasChanges(true);
  }, [signers.length]);

  const handleRemoveSigner = React.useCallback((signerId: string) => {
    setSigners((prev) => prev.filter((s) => s.id !== signerId));
    setSignatureFields((prev) => prev.filter((f) => f.signerId !== signerId));
    if (selectedSigner?.id === signerId) {
      setSelectedSigner(null);
    }
    setHasChanges(true);
  }, [selectedSigner]);

  const handleFieldsChange = React.useCallback((newFields: SignatureField[]) => {
    setSignatureFields(newFields);
    setHasChanges(true);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-background relative",
        isDragOver && "ring-4 ring-inset ring-primary"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 p-8 rounded-lg border-2 border-dashed border-primary bg-primary/5">
            <Upload className="h-12 w-12 text-primary" />
            <p className="text-lg font-medium">Drop PDF here</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/system/teeem-pdf/list")}
            title="Back to PDFs"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="h-8 w-8 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>

          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasChanges(true);
            }}
            className="w-64 h-8 text-sm font-medium bg-transparent border-0 hover:bg-muted/50 focus:bg-background"
            placeholder="PDF name"
          />

          {saving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Spinner size={12} />
              Saving...
            </span>
          )}
          {!saving && hasChanges && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
          {!saving && !hasChanges && pdf && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Job association */}
          <Popover open={jobSearchOpen} onOpenChange={setJobSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <Briefcase className="h-3.5 w-3.5" />
                {selectedJobName || "Attach to Job"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={jobSearchTerm}
                    onChange={(e) => setJobSearchTerm(e.target.value)}
                    placeholder="Search jobs..."
                    className="h-8 pl-7 text-sm"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {loadingJobs ? (
                    <div className="flex items-center justify-center py-4">
                      <Spinner size={16} />
                    </div>
                  ) : jobs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No jobs found
                    </p>
                  ) : (
                    <div className="space-y-0.5">
                      {selectedJobId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-8 text-xs text-destructive"
                          onClick={() => {
                            setSelectedJobId(null);
                            setSelectedJobName(null);
                            setHasChanges(true);
                            setJobSearchOpen(false);
                          }}
                        >
                          <X className="h-3 w-3 mr-2" />
                          Remove job
                        </Button>
                      )}
                      {jobs.map((job) => (
                        <Button
                          key={job.id}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "w-full justify-start h-8 text-xs",
                            selectedJobId === job.id && "bg-muted"
                          )}
                          onClick={() => {
                            setSelectedJobId(job.id);
                            setSelectedJobName(job.name);
                            setHasChanges(true);
                            setJobSearchOpen(false);
                          }}
                        >
                          {job.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* E-signature mode toggle */}
          <Button
            variant={esignMode ? "default" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => setEsignMode(!esignMode)}
            disabled={!pdfUrl}
          >
            <PenLine className="h-3.5 w-3.5 mr-2" />
            {esignMode ? "Exit Sign Mode" : "Sign Mode"}
          </Button>

          <Button variant="outline" size="sm" className="h-8" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-2" />
            Save
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Spinner size={14} className="mr-2" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-2" />
            )}
            Import
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleImport}
            className="hidden"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* PDF Editor */}
      <div className="flex-1 overflow-hidden">
        {pdfUrl ? (
          esignMode ? (
            // E-signature mode - place signature fields
            <ESignaturePdfEditor
              url={pdfUrl}
              signers={signers}
              selectedSigner={selectedSigner}
              onSelectSigner={setSelectedSigner}
              fields={signatureFields}
              onFieldsChange={handleFieldsChange}
              onAddSigner={handleAddSigner}
              onRemoveSigner={handleRemoveSigner}
              onReorderSigners={setSigners}
            />
          ) : (
            // Annotation mode - draw, shapes, text
            <PDFEditor
              url={pdfUrl}
              fileName={`${name}.pdf`}
              onSave={handlePdfSave}
              className="h-full"
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-16 w-16 mb-4" />
            <p className="text-lg font-medium mb-2">No PDF loaded</p>
            <p className="text-sm mb-4">Import a PDF, drag & drop, or create a new document</p>
            <div className="flex gap-2">
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Import PDF
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const blankUrl = await createBlankPdf();
                  setPdfUrl(blankUrl);
                  setIsBlankPdf(true);
                }}
              >
                <FilePlus className="h-4 w-4 mr-2" />
                Create Blank
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
