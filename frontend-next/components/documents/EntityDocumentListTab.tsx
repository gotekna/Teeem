"use client";

/**
 * EntityDocumentListTab - Gold standard document tab for any entity (jobs, corporate, contacts)
 *
 * THE ONE document tab component using StandardDocumentList. Provides:
 * - Drag-and-drop upload with drop zone overlay
 * - Document type selection from folder's configured types
 * - Upload preview dialog (PDF, image, Excel, Word)
 * - Signing status tracking (if doc type needs it)
 * - Executed/expiry date fields
 * - Verify and expiry badges
 * - SM task required document placeholders (jobs only)
 *
 * Generalized from JobDocumentListTab (Feb 2026) to support corporate entities.
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
import { DocumentViewer } from "@/components/ui/document-viewer";
import { Upload, FileText, FolderOpen, CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { uploadFile } from "@/lib/upload-utils";
import type { UploadScope } from "@/lib/upload-utils";
import { useToast } from "@/components/ui/use-toast";
import { formatFileSize } from "@/utils/formatters";
import {
  StandardDocumentList,
  type LibraryDocument,
  type SmTaskRequiredDocType,
} from "@/components/documents/StandardDocumentList";
import type { SmTaskInfo } from "@/components/warehouse/types";
import type { WarehouseFolder } from "@/lib/types/warehouse-folders";

export interface EntityDocumentListTabProps {
  entityId: number | string;
  entityType: string;      // "Job" | "Corporate" | "Contact" etc.
  sourceType: string;      // "job" | "corporate" | "contact" etc.
  uploadScope: UploadScope; // "job_documents" | "documents" | "library_documents" etc.
  warehouseFolder: WarehouseFolder;
}

export default function EntityDocumentListTab({
  entityId,
  entityType,
  sourceType,
  uploadScope,
  warehouseFolder,
}: EntityDocumentListTabProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [smTaskInfo, setSmTaskInfo] = useState<SmTaskInfo | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<string>("");
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

  // File type detection for preview — DocumentViewer handles pdf, image, excel, word
  const hasPreview = useMemo(() => {
    if (pendingFiles.length === 0 || !previewUrl) return false;
    const file = pendingFiles[previewFileIndex] || pendingFiles[0];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const previewableExts = ["pdf", "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "xlsx", "xls", "docx", "doc"];
    return previewableExts.includes(ext);
  }, [pendingFiles, previewFileIndex, previewUrl]);

  // Detect if selected doc type needs signing status or special date fields
  const selectedDocTypeObj = React.useMemo(
    () => warehouseFolder.document_types?.find(d => String(d.id) === selectedDocTypeId),
    [warehouseFolder.document_types, selectedDocTypeId]
  );

  // Computed name previews from selected document type templates
  const namePreview = useMemo(() => {
    if (!selectedDocTypeObj) return null;
    const uiTemplate = selectedDocTypeObj.ui_name;
    const dlTemplate = selectedDocTypeObj.download_name;
    return { uiName: uiTemplate || null, dlName: dlTemplate || null };
  }, [selectedDocTypeObj]);

  const needsSigningStatus = selectedDocTypeObj?.tracks_signing_status || false;

  // Show executed date picker when user selects "Signed"
  const needsExecutedDate = needsSigningStatus && signingStatus === "signed";

  const needsExpiry = React.useMemo(() => {
    if (!selectedDocTypeObj) return false;
    const templates = [selectedDocTypeObj.ui_name, selectedDocTypeObj.download_name].filter(Boolean).join(" ");
    return /\{EX\}|\{Expiry\}/i.test(templates);
  }, [selectedDocTypeObj]);

  // Build the metadata key for the entity ID based on source type
  const entityIdKey = useMemo(() => {
    switch (sourceType) {
      case "job": return "job_id";
      case "corporate": return "company_id";
      case "contact": return "contact_id";
      default: return "entity_id";
    }
  }, [sourceType]);

  // Fetch documents for this folder
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        source_type: sourceType,
        linkable_type: entityType,
        linkable_id: String(entityId),
        warehouse_folder_id: String(warehouseFolder.id),
        limit: "200",
        offset: "0",
      });

      const response = await api.get<{
        success: boolean;
        documents: LibraryDocument[];
        pagination: { total: number; has_more: boolean };
        smTaskInfo?: SmTaskInfo;
      }>(`/api/v1/documents/warehouse?${params.toString()}`);

      if (response?.success) {
        setDocuments(response.documents || []);
        setSmTaskInfo(response.smTaskInfo || undefined);
      }
    } catch (error) {
      console.error(`Failed to fetch ${sourceType} documents:`, error);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, sourceType, warehouseFolder.id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // File selection → open upload dialog
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    setPendingFiles(Array.from(files));
    setPreviewFileIndex(0);

    // If doc type was pre-selected (from placeholder Upload button), keep it
    if (preSelectedDocTypeRef.current) {
      setSelectedDocTypeId(preSelectedDocTypeRef.current);
      preSelectedDocTypeRef.current = null;
    } else {
      const docTypes = warehouseFolder.document_types || [];
      const primary = docTypes.find(dt => dt.is_primary) || docTypes[0];
      setSelectedDocTypeId(primary ? String(primary.id) : "");
    }
    setUploadDialogOpen(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [warehouseFolder.document_types]);

  // Upload for a specific required doc type (from placeholder row)
  const preSelectedDocTypeRef = useRef<string | null>(null);

  const handleUploadForDocType = useCallback((docType: SmTaskRequiredDocType) => {
    preSelectedDocTypeRef.current = String(docType.documentTypeId);
    setSelectedDocTypeId(String(docType.documentTypeId));
    fileInputRef.current?.click();
  }, []);

  // Upload after dialog confirmation
  const handleConfirmUpload = useCallback(async () => {
    if (!pendingFiles.length) return;

    setUploadDialogOpen(false);
    setUploading(true);
    try {
      let successCount = 0;

      for (const file of pendingFiles) {
        const result = await uploadFile(file, uploadScope, {
          metadata: {
            [entityIdKey]: entityId,
            warehouse_folder_id: warehouseFolder.id,
            warehouse_folder_document_type_id: selectedDocTypeObj?.wfdt_id || undefined,
            document_type: selectedDocTypeObj?.name || undefined,
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
  }, [pendingFiles, entityId, entityIdKey, uploadScope, warehouseFolder.id, selectedDocTypeId, selectedDocTypeObj, needsSigningStatus, signingStatus, executedDate, expiryDate, fetchDocuments, toast]);

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
    } catch (error: unknown) {
      const apiErr = error as { status?: number };
      if (apiErr.status === 404) {
        toast({ title: "Already Deleted", description: "Document was already removed" });
        fetchDocuments();
      } else {
        toast({ title: "Delete Failed", description: "Could not delete document", variant: "destructive" });
      }
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
    const primary = docTypes.find(dt => dt.is_primary) || docTypes[0];
    setSelectedDocTypeId(primary ? String(primary.id) : "");
    setUploadDialogOpen(true);
  }, [warehouseFolder.document_types]);

  // Reset upload dialog state
  const resetUploadDialog = useCallback(() => {
    setUploadDialogOpen(false);
    setPendingFiles([]);
    setPreviewFileIndex(0);
    setSigningStatus("draft");
    setExecutedDate(undefined);
    setExpiryDate(undefined);
  }, []);

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
          smTaskInfo={smTaskInfo}
          onUploadForDocType={handleUploadForDocType}
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
        if (!open) resetUploadDialog();
      }}>
        <SheetContent
          side={hasPreview ? "right-95" : "right-wide"}
          title={`Upload to ${warehouseFolder.display_name}`}
          className="flex flex-col overflow-hidden"
        >
          {/* Header */}
          <SheetHeader className="flex flex-row items-center justify-between shrink-0 pb-4 border-b">
            <h2 className="text-lg font-semibold">Upload to {warehouseFolder.display_name}</h2>
            <Button variant="ghost" size="icon" onClick={resetUploadDialog} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>

          {/* Body — form on left, preview on right */}
          <div className={`flex-1 overflow-hidden flex ${hasPreview ? "flex-row gap-4" : "flex-col"} mt-4`}>
            {/* Left panel: File list + form fields */}
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
                  <Label htmlFor="entity-doc-type-select">Document Type</Label>
                  <Select value={selectedDocTypeId} onValueChange={setSelectedDocTypeId}>
                    <SelectTrigger id="entity-doc-type-select">
                      <SelectValue placeholder="Select document type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseFolder.document_types?.map((dt) => (
                        <SelectItem key={dt.id} value={String(dt.id)}>
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
                  <Label htmlFor="entity-signing-status">Signing Status</Label>
                  <Select value={signingStatus} onValueChange={(v) => setSigningStatus(v as "draft" | "signed")}>
                    <SelectTrigger id="entity-signing-status">
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

              {/* Name preview */}
              {selectedDocTypeObj && (namePreview?.uiName || namePreview?.dlName) && (
                <div className="space-y-1.5 pt-2 border-t">
                  <Label className="text-xs text-muted-foreground">Name Preview</Label>
                  <div className="space-y-1 text-sm">
                    {namePreview?.uiName && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground shrink-0 mt-0.5 w-16">UI Name:</span>
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded break-all">{namePreview.uiName}</span>
                      </div>
                    )}
                    {namePreview?.dlName && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground shrink-0 mt-0.5 w-16">DL Name:</span>
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded break-all">{namePreview.dlName}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right panel: Document preview */}
            {hasPreview && previewUrl && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <DocumentViewer
                  url={previewUrl}
                  fileName={pendingFiles[previewFileIndex]?.name || "document"}
                  showHeader={true}
                  showFooter={false}
                  showSidebar={false}
                  theme="light"
                  className="h-full w-full"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t mt-4 shrink-0">
            <Button variant="outline" onClick={resetUploadDialog}>
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
