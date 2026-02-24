"use client";

/**
 * Library Page - Company-wide reference documents
 *
 * Standalone reference documents (standards, specs, guidelines, manuals)
 * not linked to any specific job or contact. Tabs auto-generated from
 * warehouse folders assigned to the "library" warehouse type.
 *
 * Pattern: useWarehouseFolders for tabs + fetch docs per folder + Sheet preview
 */

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Upload,
  FileText,
  BookOpen,
  Maximize2,
  X,
  Download,
  File,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { formatFileSize } from "@/utils/formatters";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { useWarehouseFolders } from "@/lib/hooks/useWarehouseFolders";
import { uploadFile } from "@/lib/upload-utils";
import { DocumentViewer, getFileType } from "@/components/ui/document-viewer";
import { ComposeEmailModal } from "@/components/emails/ComposeEmailModal";
import { Spinner } from "@/components/ui/spinner";
import { getIcon } from "@/lib/icon-map";

// Document shape from /api/v1/documents/warehouse
interface LibraryDocument {
  id: number;
  displayName: string;
  sendName: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string | null;
  storagePath: string | null;
  folder: string | null;
  createdAt: string;
  source: string;
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export default function LibraryPage() {
  useSetLayoutMode("full-height");
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  // Derive active tab from URL: /library/standards → "standards"
  const activeTab = React.useMemo(() => {
    const parts = (pathname ?? "").replace("/library", "").split("/").filter(Boolean);
    return parts[0] || null; // null means use first tab
  }, [pathname]);

  // Fetch library folder tabs from warehouse folders API
  const { tabs: libraryTabs, loading: tabsLoading } = useWarehouseFolders({ scope: "library" });

  // Get visible child tabs (skip root system folder, show children)
  const visibleTabs = React.useMemo(() => {
    if (!libraryTabs?.length) return [];
    // If there's a root system folder, return its children; otherwise all root-level tabs
    const root = libraryTabs.find(t => t.tab_type === "system" && t.children?.length > 0);
    return root ? root.children.filter(c => c.enabled) : libraryTabs.filter(t => t.enabled && t.tab_type !== "system");
  }, [libraryTabs]);

  // Resolve active tab - use URL tab or first visible
  const resolvedTab = React.useMemo(() => {
    if (!visibleTabs.length) return null;
    if (activeTab) {
      const match = visibleTabs.find(t => t.tab_key === activeTab);
      if (match) return match;
    }
    return visibleTabs[0];
  }, [activeTab, visibleTabs]);

  // Redirect to first tab if URL doesn't include one
  useEffect(() => {
    if (resolvedTab && !activeTab && pathname === "/library") {
      router.replace(`/library/${resolvedTab.tab_key}`, { scroll: false });
    }
  }, [resolvedTab, activeTab, pathname, router]);

  // Documents state
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [totalDocs, setTotalDocs] = useState(0);

  // Sheet preview state
  const [previewDoc, setPreviewDoc] = useState<LibraryDocument | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Upload dialog state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>("");

  // Email compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [emailDoc, setEmailDoc] = useState<LibraryDocument | null>(null);

  // Fetch documents for active tab
  const fetchDocuments = useCallback(async (folderName?: string) => {
    setDocsLoading(true);
    try {
      const params = new URLSearchParams({
        source_type: "library",
        limit: "200",
        offset: "0",
      });
      if (folderName) {
        params.set("folder", folderName);
      }

      const response = await api.get<{
        success: boolean;
        documents: LibraryDocument[];
        pagination: { total: number; has_more: boolean };
      }>(`/api/v1/documents/warehouse?${params.toString()}`);

      if (response?.success) {
        setDocuments(response.documents || []);
        setTotalDocs(response.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch library documents:", error);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  // Refetch when active tab changes
  useEffect(() => {
    if (resolvedTab) {
      // Use folder_segment as the folder filter (matches storage path)
      fetchDocuments(resolvedTab.folder_segment || resolvedTab.display_name);
    }
  }, [resolvedTab, fetchDocuments]);

  // Build preview URL when document selected
  useEffect(() => {
    if (!previewDoc?.fileUrl) {
      setPreviewUrl(null);
      return;
    }
    setPreviewUrl(previewDoc.fileUrl);
  }, [previewDoc]);

  // Handle tab change via URL
  const handleTabChange = useCallback((tabKey: string) => {
    router.push(`/library/${tabKey}`, { scroll: false });
  }, [router]);

  // Handle document click - open sheet preview
  const handleDocumentClick = useCallback((doc: LibraryDocument) => {
    setPreviewDoc(doc);
    setIsSheetOpen(true);
  }, []);

  // Handle file selection - opens dialog instead of uploading directly
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length || !resolvedTab) return;

    setPendingFiles(Array.from(files));
    // Pre-select first document type if available
    const docTypes = resolvedTab.document_types || [];
    setSelectedDocType(docTypes.length > 0 ? docTypes[0].name : "");
    setUploadDialogOpen(true);

    // Reset file input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [resolvedTab]);

  // Perform the actual upload after dialog confirmation
  const handleConfirmUpload = useCallback(async () => {
    if (!pendingFiles.length || !resolvedTab) return;

    setUploadDialogOpen(false);
    setUploading(true);
    try {
      let successCount = 0;
      const folderName = resolvedTab.folder_segment || resolvedTab.display_name;

      for (const file of pendingFiles) {
        const result = await uploadFile(file, "library_documents", {
          metadata: {
            folder_path: folderName,
            warehouse_folder_id: resolvedTab.id,
            document_type: selectedDocType || undefined,
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
        fetchDocuments(folderName);
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
  }, [pendingFiles, resolvedTab, selectedDocType, fetchDocuments, toast]);

  // Drag and drop handlers
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
    if (!files?.length || !resolvedTab) return;

    setPendingFiles(Array.from(files));
    const docTypes = resolvedTab.document_types || [];
    setSelectedDocType(docTypes.length > 0 ? docTypes[0].name : "");
    setUploadDialogOpen(true);
  }, [resolvedTab]);

  // Handle email document
  const handleEmail = useCallback((doc: LibraryDocument) => {
    setEmailDoc(doc);
    setComposeOpen(true);
  }, []);

  // Handle document verify
  const handleVerify = useCallback(async (doc: LibraryDocument) => {
    try {
      const res = await api.post<{ success: boolean; document: LibraryDocument }>(`/api/v1/documents/${doc.id}/verify`);
      if (res?.success) {
        toast({ title: "Verified", description: "Document has been validated" });
        // Update local state
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, verified: true, verifiedBy: res.document?.verifiedBy || "You", verifiedAt: new Date().toISOString() } : d));
        if (previewDoc?.id === doc.id) {
          setPreviewDoc(prev => prev ? { ...prev, verified: true, verifiedBy: res.document?.verifiedBy || "You", verifiedAt: new Date().toISOString() } : prev);
        }
      }
    } catch (error) {
      toast({ title: "Verify Failed", description: "Could not verify document", variant: "destructive" });
    }
  }, [previewDoc, toast]);

  // Handle document delete
  const handleDelete = useCallback(async (doc: LibraryDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${doc.displayName || doc.originalFilename}"?`)) return;

    try {
      const res = await api.delete<{ success: boolean }>(`/api/v1/documents/${doc.id}`);
      if (res?.success) {
        toast({ title: "Deleted", description: "Document removed" });
        if (resolvedTab) {
          fetchDocuments(resolvedTab.folder_segment || resolvedTab.display_name);
        }
      }
    } catch (error) {
      toast({ title: "Delete Failed", description: "Could not delete document", variant: "destructive" });
    }
  }, [resolvedTab, fetchDocuments, toast]);

  // Get file icon based on mime type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return ImageIcon;
    return FileText;
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Loading state
  if (tabsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // No tabs configured
  if (!visibleTabs.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <BookOpen className="h-12 w-12" />
        <p className="text-lg font-medium">Library Not Configured</p>
        <p className="text-sm">Ask an admin to configure Library folders in Settings.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Library</h1>
          {totalDocs > 0 && (
            <Badge variant="secondary" className="ml-1">{totalDocs}</Badge>
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

      {/* Tabs with drag-and-drop */}
      <Tabs
        value={resolvedTab?.tab_key || ""}
        onValueChange={handleTabChange}
        className="flex flex-col flex-1 min-h-0 relative"
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
                to {resolvedTab?.display_name || "Library"}
              </p>
            </div>
          </div>
        )}
        <TabsList className="mx-4 mt-2 justify-start">
          {visibleTabs.map((tab) => {
            const TabIcon = tab.icon_name ? getIcon(tab.icon_name) : FileText;
            return (
              <TabsTrigger
                key={tab.tab_key}
                value={tab.tab_key}
                className="flex items-center gap-1.5"
              >
                {TabIcon && <TabIcon className="h-4 w-4" />}
                {tab.display_name}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab content - document list */}
        {visibleTabs.map((tab) => (
          <TabsContent
            key={tab.tab_key}
            value={tab.tab_key}
            className="flex-1 min-h-0 overflow-auto px-4 mt-0"
          >
            {docsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner className="h-6 w-6" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <File className="h-10 w-10" />
                <p className="font-medium">No documents yet</p>
                <p className="text-sm">Upload reference documents to this category.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Documents
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {documents.map((doc) => {
                  const Icon = getFileIcon(doc.mimeType);
                  return (
                    <button
                      key={doc.id}
                      className="flex items-center gap-3 px-3 py-3 w-full text-left hover:bg-muted/50 rounded-md transition-colors cursor-pointer"
                      onClick={() => handleDocumentClick(doc)}
                    >
                      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {doc.displayName || doc.originalFilename || `Document ${doc.id}`}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {doc.fileSize > 0 && <span>{formatFileSize(doc.fileSize)}</span>}
                          {doc.createdAt && <span>{formatDate(doc.createdAt)}</span>}
                          {doc.verified ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="text-amber-500 dark:text-amber-400">Unverified</span>
                          )}
                        </div>
                      </div>
                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 p-1.5 hover:bg-muted rounded-md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </a>
                      )}
                      <button
                        className="shrink-0 p-1.5 hover:bg-destructive/10 rounded-md"
                        onClick={(e) => handleDelete(doc, e)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Upload dialog - document type picker */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setUploadDialogOpen(false);
          setPendingFiles([]);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Upload to {resolvedTab?.display_name || "Library"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* File list */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""} selected
              </Label>
              <div className="max-h-32 overflow-auto space-y-1">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{file.name}</span>
                    <span className="text-xs shrink-0">({formatFileSize(file.size)})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Document type picker */}
            {(resolvedTab?.document_types?.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="doc-type-select">Document Type</Label>
                <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                  <SelectTrigger id="doc-type-select">
                    <SelectValue placeholder="Select document type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {resolvedTab?.document_types?.map((dt) => (
                      <SelectItem key={dt.id} value={dt.name}>
                        {dt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUploadDialogOpen(false);
              setPendingFiles([]);
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document preview sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-[600px] sm:max-w-[600px] p-0 flex flex-col">
          {previewDoc && (
            <>
              {/* Sheet header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-medium truncate">
                    {previewDoc.displayName || previewDoc.originalFilename}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {previewDoc.fileSize > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {formatFileSize(previewDoc.fileSize)}
                      </Badge>
                    )}
                    {previewDoc.mimeType && (
                      <Badge variant="outline" className="text-xs">
                        {previewDoc.mimeType.split("/").pop()?.toUpperCase()}
                      </Badge>
                    )}
                    {previewDoc.verified ? (
                      <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Verified{previewDoc.verifiedBy ? ` by ${previewDoc.verifiedBy}` : ""}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!previewDoc.verified && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                      onClick={() => handleVerify(previewDoc)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                      Validate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => handleEmail(previewDoc)}
                  >
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    Email
                  </Button>
                  {previewDoc.fileUrl && (
                    <a
                      href={previewDoc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-muted rounded-md"
                      title="Open in new tab"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    onClick={() => setIsSheetOpen(false)}
                    className="p-1.5 hover:bg-muted rounded-md"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Preview content */}
              <div className="flex-1 min-h-0 overflow-auto bg-muted/30">
                {previewUrl ? (
                  (() => {
                    const fileType = getFileType(previewDoc.originalFilename || "");
                    if (fileType === "pdf") {
                      return (
                        <iframe
                          src={previewUrl}
                          className="w-full h-full border-0"
                          title="Document Preview"
                        />
                      );
                    }
                    if (fileType === "image") {
                      return (
                        <div className="flex items-center justify-center h-full p-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewUrl}
                            alt={previewDoc.displayName || "Preview"}
                            className="max-w-full max-h-full object-contain rounded-md"
                          />
                        </div>
                      );
                    }
                    if (fileType === "eml") {
                      return (
                        <DocumentViewer
                          url={previewUrl}
                          fileName={previewDoc.originalFilename || ""}
                        />
                      );
                    }
                    // Fallback - download link
                    return (
                      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                        <FileText className="h-12 w-12" />
                        <p className="text-sm">Preview not available for this file type</p>
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          Download to view
                        </a>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                    <FileText className="h-10 w-10" />
                    <p className="text-sm">No preview available</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Email compose modal */}
      {emailDoc && (
        <ComposeEmailModal
          open={composeOpen}
          onOpenChange={setComposeOpen}
          defaultSubject={emailDoc.displayName || emailDoc.originalFilename || "Library Document"}
          initialPreUploadedAttachments={emailDoc.storagePath ? [{
            filename: emailDoc.originalFilename || emailDoc.displayName || "document",
            storageKey: emailDoc.storagePath,
            size: emailDoc.fileSize,
            contentType: emailDoc.mimeType,
          }] : []}
        />
      )}
    </div>
  );
}
