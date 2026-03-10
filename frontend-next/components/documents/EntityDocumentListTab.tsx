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
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { Input } from "@/components/ui/input";
import { Upload, FileText, FolderOpen, CalendarDays, X, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { uploadFile } from "@/lib/upload-utils";
import type { UploadScope, UploadStep } from "@/lib/upload-utils";
import { ComposeEmailModal } from "@/components/emails/ComposeEmailModal";
import { useToast } from "@/components/ui/use-toast";
import { formatFileSize } from "@/utils/formatters";
import {
  StandardDocumentList,
  type LibraryDocument,
  type SmTaskRequiredDocType,
} from "@/components/documents/StandardDocumentList";
import type { SmTaskInfo } from "@/components/warehouse/types";
import type { WarehouseFolder, WarehouseFolderDocumentType } from "@/lib/types/warehouse-folders";

export interface EntityDocumentListTabProps {
  entityId: number | string;
  entityType: string;      // "Job" | "Corporate" | "Contact" etc.
  sourceType: string;      // "job" | "corporate" | "contact" etc.
  uploadScope: UploadScope; // "job_documents" | "documents" | "library_documents" etc.
  warehouseFolder: WarehouseFolder;
  /** Entity name for template preview (e.g. company name, job name) */
  entityName?: string;
  /** Entity code for template preview (e.g. company code, job code) */
  entityCode?: string;
  /** Controlled selection - parent manages the Map (for cross-tab persistence) */
  selectedDocs?: Map<number, LibraryDocument>;
  /** Controlled selection change handler */
  onSelectionChange?: (docs: Map<number, LibraryDocument>) => void;
  /** Hide the built-in floating action bar (parent renders its own cross-tab bar) */
  hideFloatingBar?: boolean;
}

/** Inline date picker with manual text input + calendar with year dropdown */
function DatePickerWithInput({
  label,
  placeholder,
  value,
  onChange,
  disablePast,
}: {
  label: string;
  placeholder: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  disablePast?: boolean;
}) {
  const [textValue, setTextValue] = useState(
    value ? value.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""
  );
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Sync text when calendar selection changes
  React.useEffect(() => {
    if (value) {
      setTextValue(value.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }));
    }
  }, [value]);

  // Parse dd/mm/yyyy input
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextValue(raw);

    // Try parsing dd/mm/yyyy
    const match = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime()) && date.getDate() === day && date.getMonth() === month) {
        if (disablePast && date < new Date(new Date().setHours(0, 0, 0, 0))) return;
        onChange(date);
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    onChange(date);
    if (date) setPopoverOpen(false);
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={placeholder}
              value={textValue}
              onChange={handleTextChange}
              className="pl-9 font-normal"
            />
          </div>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <CalendarDays className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent
          className="w-auto p-0"
          align="end"
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={value}
            onSelect={handleCalendarSelect}
            defaultMonth={value}
            fromYear={1900}
            toYear={currentYear + 10}
            disabled={disablePast ? (date) => date < new Date(new Date().setHours(0, 0, 0, 0)) : undefined}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function EntityDocumentListTab({
  entityId,
  entityType,
  sourceType,
  uploadScope,
  warehouseFolder,
  entityName,
  entityCode,
  selectedDocs: controlledSelectedDocs,
  onSelectionChange,
  hideFloatingBar,
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

  // Email compose state
  const [emailDocs, setEmailDocs] = useState<LibraryDocument[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<string>("");
  // Fresh document types — re-fetched each time upload dialog opens
  const [freshDocTypes, setFreshDocTypes] = useState<WarehouseFolderDocumentType[] | null>(null);
  const [signingStatus, setSigningStatus] = useState<"draft" | "signed">("draft");
  const [executedDate, setExecutedDate] = useState<Date | undefined>(undefined);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);

  // Preview state
  const [previewFileIndex, setPreviewFileIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch fresh document types when upload dialog opens
  useEffect(() => {
    if (!uploadDialogOpen) return;
    let cancelled = false;
    api.get<{ success: boolean; data: WarehouseFolder }>(
      `/api/v1/warehouse_folders/${warehouseFolder.id}`
    ).then((res) => {
      if (!cancelled && res?.success && res.data?.document_types) {
        setFreshDocTypes(res.data.document_types);
      }
    }).catch(() => { /* keep using prop data as fallback */ });
    return () => { cancelled = true; };
  }, [uploadDialogOpen, warehouseFolder.id]);

  // Use fresh doc types if available, fallback to prop
  const activeDocTypes = freshDocTypes ?? warehouseFolder.document_types ?? [];

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

  // File type detection for preview — PDFViewer for PDFs, DocumentViewer for images/excel/word
  const previewFileExt = useMemo(() => {
    if (pendingFiles.length === 0) return "";
    const file = pendingFiles[previewFileIndex] || pendingFiles[0];
    return file.name.split(".").pop()?.toLowerCase() || "";
  }, [pendingFiles, previewFileIndex]);

  const isPdfPreview = previewFileExt === "pdf";

  const hasPreview = useMemo(() => {
    if (!previewUrl || !previewFileExt) return false;
    const previewableExts = ["pdf", "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "xlsx", "xls", "docx", "doc"];
    return previewableExts.includes(previewFileExt);
  }, [previewFileExt, previewUrl]);

  // Detect if selected doc type needs signing status or special date fields
  const selectedDocTypeObj = React.useMemo(
    () => activeDocTypes.find(d => String(d.id) === selectedDocTypeId),
    [activeDocTypes, selectedDocTypeId]
  );

  // Resolve name templates client-side for live preview
  const namePreview = useMemo(() => {
    if (!selectedDocTypeObj) return null;
    const uiTemplate = selectedDocTypeObj.ui_name;
    const dlTemplate = selectedDocTypeObj.download_name;
    if (!uiTemplate && !dlTemplate) return null;

    // Build token map matching backend SendNameResolver conventions
    const now = new Date();
    const tokens: Record<string, string> = {
      DocTypeName: selectedDocTypeObj.name || "",
      Date: now.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-"),
      DDMMYYYY: now.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-"),
      YYYYMMDD: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    };

    // Entity tokens based on type
    if (entityName) {
      if (sourceType === "corporate") {
        tokens.CompanyName = entityName;
      } else if (sourceType === "job") {
        tokens.JobName = entityName;
      } else if (sourceType === "contact") {
        tokens.ContactName = entityName;
      }
    }
    if (entityCode) {
      if (sourceType === "corporate") {
        tokens.CompanyCode = entityCode;
      } else if (sourceType === "job") {
        tokens.JobCode = entityCode;
      }
    }

    // Date tokens from user input
    if (executedDate) {
      const d = executedDate;
      tokens.EXC = `EXC ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
      tokens.Executed = `Executed ${d.getDate()} ${d.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}`;
    }
    if (expiryDate) {
      const d = expiryDate;
      tokens.EX = `EX ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
      tokens.Expiry = `Expiry ${d.getDate()} ${d.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}`;
    }

    const resolve = (template: string) =>
      template.replace(/\{\{?(\w+)\}?\}/g, (match, token) => tokens[token] ?? match);

    return {
      uiName: uiTemplate ? resolve(uiTemplate) : null,
      dlName: dlTemplate ? resolve(dlTemplate) : null,
    };
  }, [selectedDocTypeObj, entityName, entityCode, sourceType, executedDate, expiryDate]);

  const needsSigningStatus = selectedDocTypeObj?.tracks_signing_status || false;

  // Show executed date picker when user selects "Signed" OR when template contains {Executed}/{EXC}
  const templateHasExecuted = React.useMemo(() => {
    if (!selectedDocTypeObj) return false;
    const templates = [selectedDocTypeObj.ui_name, selectedDocTypeObj.download_name].filter(Boolean).join(" ");
    return /\{EXC\}|\{Executed\}/i.test(templates);
  }, [selectedDocTypeObj]);

  const needsExecutedDate = templateHasExecuted || (needsSigningStatus && signingStatus === "signed");

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
      const primary = activeDocTypes.find(dt => dt.is_primary) || activeDocTypes[0];
      setSelectedDocTypeId(primary ? String(primary.id) : "");
    }
    setFreshDocTypes(null); // Clear so effect re-fetches on dialog open
    setUploadDialogOpen(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [activeDocTypes]);

  // Upload for a specific required doc type (from placeholder row)
  const preSelectedDocTypeRef = useRef<string | null>(null);

  const handleUploadForDocType = useCallback((docType: SmTaskRequiredDocType) => {
    preSelectedDocTypeRef.current = String(docType.documentTypeId);
    setSelectedDocTypeId(String(docType.documentTypeId));
    fileInputRef.current?.click();
  }, []);

  // Upload after dialog confirmation — with progress toast
  const handleConfirmUpload = useCallback(async () => {
    if (!pendingFiles.length) return;

    setUploadDialogOpen(false);
    setUploading(true);

    const totalFiles = pendingFiles.length;
    const multiPrefix = totalFiles > 1;

    // Step label mapping
    const stepLabels: Record<UploadStep, string> = {
      presigning: "Preparing",
      uploading: "Uploading",
      hashing: "Processing",
      confirming: "Finalizing",
    };

    // Create persistent progress toast
    const { id: toastId, update, dismiss } = toast({
      title: multiPrefix ? `(1/${totalFiles}) ${pendingFiles[0].name}` : pendingFiles[0].name,
      description: "Preparing upload...",
      variant: "progress",
      progress: 0,
      duration: Infinity,
    });

    try {
      let successCount = 0;

      for (let i = 0; i < totalFiles; i++) {
        const file = pendingFiles[i];
        const fileLabel = multiPrefix ? `(${i + 1}/${totalFiles}) ${file.name}` : file.name;

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
          onByteProgress: (loaded, total) => {
            const pct = Math.round((loaded / total) * 100);
            update({
              id: toastId,
              title: fileLabel,
              description: `Uploading — ${formatFileSize(loaded)} / ${formatFileSize(total)}`,
              variant: "progress",
              progress: pct,
            });
          },
          onStepChange: (step) => {
            if (step === "uploading") return; // byte progress handles this
            update({
              id: toastId,
              title: fileLabel,
              description: `${stepLabels[step]}...`,
              variant: "progress",
              progress: step === "confirming" ? 100 : undefined,
            });
          },
        });

        if (result.success) {
          successCount++;
        } else {
          update({
            id: toastId,
            title: "Upload Failed",
            description: `${file.name}: ${result.error || "Failed to upload"}`,
            variant: "destructive",
          });
          // Give user time to read the error before next file starts
          if (i < totalFiles - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      if (successCount > 0) {
        update({
          id: toastId,
          title: "Upload Complete",
          description: `${successCount} file(s) uploaded`,
          variant: "success",
          progress: 100,
        });
        // Auto-dismiss after 3 seconds
        setTimeout(() => dismiss(), 3000);
        fetchDocuments();
      } else {
        // All failed — dismiss after reading
        setTimeout(() => dismiss(), 5000);
      }
    } catch (error) {
      update({
        id: toastId,
        title: "Upload Error",
        description: "An error occurred during upload",
        variant: "destructive",
      });
      setTimeout(() => dismiss(), 5000);
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
            ? { ...d, ...res.document, verified: true, verifiedBy: res.document?.verifiedBy || "You", verifiedAt: new Date().toISOString() }
            : d
        ));
      }
    } catch (error) {
      toast({ title: "Verify Failed", description: "Could not verify document", variant: "destructive" });
    }
  }, [toast]);

  // Unverify
  const handleUnverify = useCallback(async (doc: LibraryDocument) => {
    try {
      const res = await api.post<{ success: boolean; document: LibraryDocument }>(`/api/v1/documents/${doc.id}/unverify`);
      if (res?.success) {
        toast({ title: "Unvalidated", description: "Verification has been removed" });
        setDocuments(prev => prev.map(d =>
          d.id === doc.id
            ? { ...d, verified: false, verifiedBy: null, verifiedAt: null }
            : d
        ));
      }
    } catch {
      toast({ title: "Failed", description: "Could not remove verification", variant: "destructive" });
    }
  }, [toast]);

  // Change document type
  const handleChangeDocumentType = useCallback(async (doc: LibraryDocument, documentTypeId: number | null) => {
    try {
      const res = await api.patch<{ success: boolean; document: LibraryDocument & { documentTypeName?: string } }>(
        `/api/v1/documents/${doc.id}/change_document_type`,
        { document_type_id: documentTypeId }
      );
      if (res?.success) {
        toast({ title: "Document Type Updated", description: documentTypeId ? "Document type has been changed" : "Document type has been removed" });
        fetchDocuments();
      }
    } catch {
      toast({ title: "Failed", description: "Could not change document type", variant: "destructive" });
    }
  }, [toast, fetchDocuments]);

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

  // Email selected documents
  const handleEmail = useCallback((docs: LibraryDocument[]) => {
    setEmailDocs(docs);
    setComposeOpen(true);
  }, []);

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
    const primary = activeDocTypes.find(dt => dt.is_primary) || activeDocTypes[0];
    setSelectedDocTypeId(primary ? String(primary.id) : "");
    setFreshDocTypes(null); // Clear so effect re-fetches on dialog open
    setUploadDialogOpen(true);
  }, [activeDocTypes]);

  // Reset upload dialog state
  const resetUploadDialog = useCallback(() => {
    setUploadDialogOpen(false);
    setPendingFiles([]);
    setPreviewFileIndex(0);
    setSigningStatus("draft");
    setExecutedDate(undefined);
    setExpiryDate(undefined);
    setFreshDocTypes(null);
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
          onUnverify={handleUnverify}
          onChangeDocumentType={handleChangeDocumentType}
          onSetExpiry={handleSetExpiry}
          onEmail={handleEmail}
          selectedDocs={controlledSelectedDocs}
          onSelectionChange={onSelectionChange}
          hideFloatingBar={hideFloatingBar}
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
          className="flex flex-row overflow-hidden p-0"
        >
          {/* Left panel: header + form + footer */}
          <div className={`${hasPreview ? "w-[380px] shrink-0 border-r" : "flex-1 max-w-md mx-auto w-full"} flex flex-col h-full p-6`}>
            {/* Header */}
            <SheetHeader className="flex flex-row items-center justify-between shrink-0 pb-4 border-b">
              <h2 className="text-lg font-semibold">Upload to {warehouseFolder.display_name}</h2>
              <Button variant="ghost" size="icon" onClick={resetUploadDialog} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </SheetHeader>

            {/* Form fields */}
            <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-1">
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
              {activeDocTypes.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="entity-doc-type-select">Document Type</Label>
                  <Select value={selectedDocTypeId} onValueChange={setSelectedDocTypeId}>
                    <SelectTrigger id="entity-doc-type-select">
                      <SelectValue placeholder="Select document type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeDocTypes.map((dt) => (
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
                <DatePickerWithInput
                  label="Date Executed"
                  placeholder="When was this document signed?"
                  value={executedDate}
                  onChange={setExecutedDate}
                />
              )}

              {/* Expiry date */}
              {needsExpiry && (
                <DatePickerWithInput
                  label="Expiry Date"
                  placeholder="Select expiry date..."
                  value={expiryDate}
                  onChange={setExpiryDate}
                  disablePast
                />
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
          </div>

          {/* Right panel: Document preview — full height, edge to edge */}
          {hasPreview && previewUrl && (
            <div className="flex-1 min-w-0 h-full overflow-hidden bg-muted/30">
              {isPdfPreview ? (
                <PDFViewer
                  url={previewUrl}
                  className="h-full w-full"
                />
              ) : (
                <DocumentViewer
                  url={previewUrl}
                  fileName={pendingFiles[previewFileIndex]?.name || "document"}
                  showHeader={false}
                  showFooter={false}
                  showSidebar={false}
                  theme="light"
                  className="h-full w-full"
                />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Email compose modal — same ComposeEmailModal used by Library (SSoT) */}
      {emailDocs.length > 0 && (
        <ComposeEmailModal
          open={composeOpen}
          onOpenChange={(open) => {
            setComposeOpen(open);
            if (!open) setEmailDocs([]);
          }}
          defaultSubject={
            emailDocs.length === 1
              ? emailDocs[0].originalFilename || emailDocs[0].displayName || "Document"
              : `${emailDocs.length} Documents`
          }
          skipSignature={true}
          initialPreUploadedAttachments={emailDocs
            .filter(d => d.storagePath)
            .map(d => ({
              filename: d.originalFilename || d.displayName || "document",
              storageKey: d.storagePath!,
              fileSize: d.fileSize,
            }))}
        />
      )}
    </div>
  );
}
