"use client";

/**
 * JobDocumentListTab - Document tab for jobs using StandardDocumentList (THE ONE)
 *
 * Replaces JobDocumentsTab for tab_type='document' tabs. Uses the same
 * StandardDocumentList component as Library for consistent UX: sortable rows,
 * preview sheet, drag-and-drop upload, verify/expiry badges.
 *
 * Photo tabs continue using JobDocumentsTab (gallery view + camera capture).
 */

import * as React from "react";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { Upload, FileText, FolderOpen, CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { uploadFile } from "@/lib/upload-utils";
import { useToast } from "@/components/ui/use-toast";
import { formatFileSize } from "@/utils/formatters";
import {
  StandardDocumentList,
  type LibraryDocument,
} from "@/components/documents/StandardDocumentList";
import type { WarehouseFolder } from "@/lib/types/warehouse-folders";

interface JobDocumentListTabProps {
  jobId: number | string;
  warehouseFolder: WarehouseFolder;
}

export default function JobDocumentListTab({ jobId, warehouseFolder }: JobDocumentListTabProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedDocType, setSelectedDocType] = useState("");
  const [signingStatus, setSigningStatus] = useState<"draft" | "signed">("draft");
  const [executedDate, setExecutedDate] = useState<Date | undefined>(undefined);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);

  // Preview state
  const [previewFileIndex, setPreviewFileIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Create/revoke blob URL for preview
  useEffect(() => {
    if (!uploadDialogOpen || pendingFiles.length === 0) {
      setPreviewUrl(null);
      return;
    }
    const file = pendingFiles[previewFileIndex] || pendingFiles[0];
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadDialogOpen, pendingFiles, previewFileIndex]);

  // File type detection for preview
  const previewType = useMemo(() => {
    if (pendingFiles.length === 0) return "other";
    const file = pendingFiles[previewFileIndex] || pendingFiles[0];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (ext === "pdf") return "pdf";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
    return "other";
  }, [pendingFiles, previewFileIndex]);

  const hasPreview = previewType !== "other" && previewUrl;

  // Detect if selected doc type needs signing status or special date fields
  const selectedDocTypeObj = React.useMemo(
    () => warehouseFolder.document_types?.find(d => d.name === selectedDocType),
    [warehouseFolder.document_types, selectedDocType]
  );

  const needsSigningStatus = selectedDocTypeObj?.tracks_signing_status || false;

  // Show executed date picker when user selects "Signed" — need to know when it was signed
  const needsExecutedDate = needsSigningStatus && signingStatus === "signed";

  const needsExpiry = React.useMemo(() => {
    if (!selectedDocTypeObj) return false;
    const templates = [selectedDocTypeObj.ui_name, selectedDocTypeObj.download_name].filter(Boolean).join(" ");
    return /\{EX\}|\{Expiry\}/i.test(templates);
  }, [selectedDocTypeObj]);

  // Fetch documents for this folder
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        source_type: "job",
        linkable_type: "Job",
        linkable_id: String(jobId),
        warehouse_folder_id: String(warehouseFolder.id),
        limit: "200",
        offset: "0",
      });

      const response = await api.get<{
        success: boolean;
        documents: LibraryDocument[];
        pagination: { total: number; has_more: boolean };
      }>(`/api/v1/documents/warehouse?${params.toString()}`);

      if (response?.success) {
        setDocuments(response.documents || []);
      }
    } catch (error) {
      console.error("Failed to fetch job documents:", error);
    } finally {
      setLoading(false);
    }
  }, [jobId, warehouseFolder.id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // File selection → open upload dialog
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    setPendingFiles(Array.from(files));
    setPreviewFileIndex(0);
    const docTypes = warehouseFolder.document_types || [];
    setSelectedDocType(docTypes.length > 0 ? docTypes[0].name : "");
    setUploadDialogOpen(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [warehouseFolder.document_types]);

  // Upload after dialog confirmation
  const handleConfirmUpload = useCallback(async () => {
    if (!pendingFiles.length) return;

    setUploadDialogOpen(false);
    setUploading(true);
    try {
      let successCount = 0;

      for (const file of pendingFiles) {
        const result = await uploadFile(file, "job_documents", {
          metadata: {
            job_id: jobId,
            warehouse_folder_id: warehouseFolder.id,
            document_type: selectedDocType || undefined,
            version_status: needsSigningStatus ? signingStatus : undefined,
            executed_date: executedDate ? executedDate.toISOString().split("T")[0] : undefined,
            expiry_date: expiryDate ? expiryDate.toISOString().split("T")[0] : undefined,
          },
        });

        if (result.success) {
          successCount++;
        } else {
          toast({
            title: "Upload Failed",
            description: `${file.name}: ${result.error || "Failed to upload"}`,
            variant: "destructive",
          });
        }
      }

      if (successCount > 0) {
        toast({ title: "Upload Complete", description: `${successCount} file(s) uploaded` });
        fetchDocuments();
      }
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "An error occurred during upload",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setPendingFiles([]);
    }
  }, [pendingFiles, jobId, warehouseFolder.id, selectedDocType, needsSigningStatus, signingStatus, executedDate, expiryDate, fetchDocuments, toast]);

  // Delete
  const handleDelete = useCallback(async (doc: LibraryDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${doc.originalFilename || doc.displayName}"?`)) return;

    try {
      const res = await api.delete<{ success: boolean }>(`/api/v1/documents/${doc.id}`);
      if (res?.success) {
        toast({ title: "Deleted", description: "Document removed" });
        fetchDocuments();
      }
    } catch (error) {
      toast({ title: "Delete Failed", description: "Could not delete document", variant: "destructive" });
    }
  }, [fetchDocuments, toast]);

  // Verify
  const handleVerify = useCallback(async (doc: LibraryDocument) => {
    try {
      const res = await api.post<{ success: boolean; document: LibraryDocument }>(`/api/v1/documents/${doc.id}/verify`);
      if (res?.success) {
        toast({ title: "Verified", description: "Document has been validated" });
        setDocuments(prev => prev.map(d =>
          d.id === doc.id
            ? { ...d, verified: true, verifiedBy: res.document?.verifiedBy || "You", verifiedAt: new Date().toISOString() }
            : d
        ));
      }
    } catch (error) {
      toast({ title: "Verify Failed", description: "Could not verify document", variant: "destructive" });
    }
  }, [toast]);

  // Set expiry
  const handleSetExpiry = useCallback(async (doc: LibraryDocument, date: Date | null) => {
    try {
      const res = await api.patch<{ success: boolean; document: LibraryDocument }>(
        `/api/v1/documents/${doc.id}/set_expiry`,
        { expiry_date: date ? date.toISOString().split("T")[0] : null }
      );
      if (res?.success) {
        toast({ title: "Expiry Updated", description: date ? `Expires ${date.toLocaleDateString("en-AU")}` : "Expiry removed" });
        setDocuments(prev => prev.map(d =>
          d.id === doc.id
            ? { ...d, expiryDate: date ? date.toISOString().split("T")[0] : null, isExpired: false, isExpiringSoon: false }
            : d
        ));
      }
    } catch (error) {
      toast({ title: "Update Failed", description: "Could not update expiry date", variant: "destructive" });
    }
  }, [toast]);

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (!files?.length) return;

    setPendingFiles(Array.from(files));
    setPreviewFileIndex(0);
    const docTypes = warehouseFolder.document_types || [];
    setSelectedDocType(docTypes.length > 0 ? docTypes[0].name : "");
    setUploadDialogOpen(true);
  }, [warehouseFolder.document_types]);

  return (
    <div
      className="flex flex-col h-full relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-lg m-2 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-10 w-10" />
            <p className="text-lg font-medium">Drop files to upload</p>
            <p className="text-sm text-muted-foreground">
              Files will be added to {warehouseFolder.display_name}
            </p>
          </div>
        </div>
      )}

      {/* Header with upload button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          <span>{warehouseFolder.display_name}</span>
          {!loading && documents.length > 0 && (
            <span className="text-xs">({documents.length})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Spinner className="h-4 w-4 mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload
          </Button>
        </div>
      </div>

      {/* Document list */}
      <div className="flex-1 min-h-0 overflow-auto">
        <StandardDocumentList
          documents={documents}
          loading={loading}
          onDelete={handleDelete}
          onVerify={handleVerify}
          onSetExpiry={handleSetExpiry}
          showVerifiedBadge={true}
          showExpiryBadge={true}
          showVerifyActions={true}
          smTaskInfo={warehouseFolder.sm_task_info}
          emptyMessage="No documents yet"
          emptyAction={
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Documents
            </Button>
          }
        />
      </div>

      {/* Upload sheet with document preview */}
      <Sheet open={uploadDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setUploadDialogOpen(false);
          setPendingFiles([]);
          setPreviewFileIndex(0);
          setSigningStatus("draft");
          setExecutedDate(undefined);
          setExpiryDate(undefined);
        }
      }}>
        <SheetContent
          side={hasPreview ? "right-95" : "right-wide"}
          title={`Upload to ${warehouseFolder.display_name}`}
          className="flex flex-col overflow-hidden"
        >
          {/* Header */}
          <SheetHeader className="flex flex-row items-center justify-between shrink-0 pb-4 border-b">
            <h2 className="text-lg font-semibold">Upload to {warehouseFolder.display_name}</h2>
            <Button variant="ghost" size="icon" onClick={() => {
              setUploadDialogOpen(false);
              setPendingFiles([]);
              setPreviewFileIndex(0);
              setSigningStatus("draft");
              setExecutedDate(undefined);
              setExpiryDate(undefined);
            }} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>

          {/* Body — two-column when preview available, single column otherwise */}
          <div className={`flex-1 overflow-hidden flex ${hasPreview ? "flex-row gap-4" : "flex-col"} mt-4`}>
            {/* Left panel: Document preview */}
            {hasPreview && previewUrl && (
              <div className="flex-1 min-w-0 rounded-lg border bg-muted/30 overflow-hidden">
                {previewType === "pdf" ? (
                  <PDFViewer url={previewUrl} className="h-full w-full" />
                ) : previewType === "image" ? (
                  <div className="flex items-center justify-center h-full p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt={pendingFiles[previewFileIndex]?.name || "Preview"}
                      className="max-w-full max-h-full object-contain rounded"
                    />
                  </div>
                ) : null}
              </div>
            )}

            {/* Right panel: File list + form fields */}
            <div className={`${hasPreview ? "w-[380px] shrink-0" : "flex-1 max-w-md mx-auto w-full"} overflow-y-auto space-y-4 pr-1`}>
              {/* Clickable file list */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""} selected
                </Label>
                <div className="max-h-40 overflow-auto space-y-0.5">
                  {pendingFiles.map((file, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-2 text-sm px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                        i === previewFileIndex
                          ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                      onClick={() => setPreviewFileIndex(i)}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs shrink-0">({formatFileSize(file.size)})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Document type */}
              {(warehouseFolder.document_types?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="job-doc-type-select">Document Type</Label>
                  <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                    <SelectTrigger id="job-doc-type-select">
                      <SelectValue placeholder="Select document type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseFolder.document_types?.map((dt) => (
                        <SelectItem key={dt.id} value={dt.name}>
                          {dt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Signing status */}
              {needsSigningStatus && (
                <div className="space-y-1.5">
                  <Label htmlFor="job-signing-status">Signing Status</Label>
                  <Select value={signingStatus} onValueChange={(v) => setSigningStatus(v as "draft" | "signed")}>
                    <SelectTrigger id="job-signing-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="signed">Signed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Executed date */}
              {needsExecutedDate && (
                <div className="space-y-1.5">
                  <Label>Date Executed</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${!executedDate ? "text-muted-foreground" : ""}`}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {executedDate
                          ? executedDate.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
                          : "When was this document signed?"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={executedDate}
                        onSelect={setExecutedDate}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Expiry date */}
              {needsExpiry && (
                <div className="space-y-1.5">
                  <Label>Expiry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${!expiryDate ? "text-muted-foreground" : ""}`}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {expiryDate
                          ? expiryDate.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
                          : "Select expiry date..."
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={expiryDate}
                        onSelect={setExpiryDate}
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t mt-4 shrink-0">
            <Button variant="outline" onClick={() => {
              setUploadDialogOpen(false);
              setPendingFiles([]);
              setPreviewFileIndex(0);
              setSigningStatus("draft");
              setExecutedDate(undefined);
              setExpiryDate(undefined);
            }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUpload} disabled={uploading}>
              {uploading ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
