"use client";

/**
 * Library Page - Company-wide reference documents
 *
 * Standalone reference documents (standards, specs, guidelines, manuals)
 * not linked to any specific job or contact. Tabs auto-generated from
 * warehouse folders assigned to the "library" warehouse type.
 *
 * Uses StandardDocumentList (THE ONE) for document rendering, preview sheet,
 * and per-row selection. Library-specific logic (tabs, upload, email compose
 * with share links, cross-tab selection bar) stays here.
 */

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  FileText,
  BookOpen,
  Mail,
  Link,
  Paperclip,
  EyeOff,
  MoreVertical,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { formatFileSize } from "@/utils/formatters";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { useWarehouseFolders } from "@/lib/hooks/useWarehouseFolders";
import { uploadFile } from "@/lib/upload-utils";
import { ComposeEmailModal } from "@/components/emails/ComposeEmailModal";
import { Spinner } from "@/components/ui/spinner";
import { getIcon } from "@/lib/icon-map";
import { formatFileEmailBody } from "@/lib/formatters/email-file-links";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarDays } from "lucide-react";
import {
  StandardDocumentList,
  type LibraryDocument,
} from "@/components/documents/StandardDocumentList";

export default function LibraryPage() {
  useSetLayoutMode("full-height");
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  // Company settings for email signature
  const [companySettings, setCompanySettings] = useState<{ company_name?: string; address?: string; website?: string } | null>(null);
  useEffect(() => {
    api.get<{ company_name?: string; address?: string; website?: string }>("/api/v1/tenant_settings")
      .then(res => { if (res) setCompanySettings(res); })
      .catch(() => {});
  }, []);

  // Derive active tab from URL: /library/standards → "standards"
  const activeTab = React.useMemo(() => {
    const parts = (pathname ?? "").replace("/library", "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname]);

  // Fetch library folder tabs from warehouse folders API
  const { tabs: libraryTabs, loading: tabsLoading } = useWarehouseFolders({ scope: "library" });

  // Get visible child tabs (skip root system folder, show children)
  const visibleTabs = React.useMemo(() => {
    if (!libraryTabs?.length) return [];
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

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Upload dialog state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);

  // Check if selected document type's template needs an expiry date
  const templateNeedsExpiry = React.useMemo(() => {
    if (!resolvedTab?.document_types?.length || !selectedDocType) return false;
    const dt = resolvedTab.document_types.find(d => d.name === selectedDocType);
    if (!dt) return false;
    const templates = [dt.ui_name, dt.download_name].filter(Boolean).join(" ");
    return /\{EX\}|\{Expiry\}/i.test(templates);
  }, [resolvedTab, selectedDocType]);

  // Selection state - Map stores full doc objects so selections persist across tab switches
  const [selectedDocs, setSelectedDocs] = useState<Map<number, LibraryDocument>>(new Map());

  // Email compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [emailDocs, setEmailDocs] = useState<LibraryDocument[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailOptions, setEmailOptions] = useState<Record<number, "attach" | "link" | "skip">>({});
  const [preparingEmail, setPreparingEmail] = useState(false);
  const [emailBody, setEmailBody] = useState("");

  // Admin check for drag-and-drop reordering
  const isAdmin = Array.isArray(currentUser?.role_names) &&
    currentUser.role_names.some((r: string) => ["admin", "super_admin"].includes(r?.toLowerCase()));

  // Fetch documents for active tab
  // SSoT: Use folder_path (full path e.g. "Library/STD Build Contract") not folder_segment
  // ("STD Build Contract") — folder_path matches what's stored in warehouse_documents.folder_path.
  const fetchDocuments = useCallback(async (folderPath?: string) => {
    setDocsLoading(true);
    try {
      const params = new URLSearchParams({
        source_type: "library",
        limit: "200",
        offset: "0",
      });
      if (folderPath) {
        params.set("folder", folderPath);
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

  // Refetch when active tab changes (selections persist across tabs)
  useEffect(() => {
    if (resolvedTab) {
      fetchDocuments(resolvedTab.folder_path || resolvedTab.folder_segment || resolvedTab.display_name);
    }
  }, [resolvedTab, fetchDocuments]);

  // Handle tab change via URL
  const handleTabChange = useCallback((tabKey: string) => {
    router.push(`/library/${tabKey}`, { scroll: false });
  }, [router]);

  // Handle file selection - opens dialog instead of uploading directly
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length || !resolvedTab) return;

    setPendingFiles(Array.from(files));
    const docTypes = resolvedTab.document_types || [];
    setSelectedDocType(docTypes.length > 0 ? docTypes[0].name : "");
    setUploadDialogOpen(true);

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
      const folderPath = resolvedTab.folder_path || resolvedTab.folder_segment || resolvedTab.display_name;

      for (const file of pendingFiles) {
        const result = await uploadFile(file, "library_documents", {
          metadata: {
            // SSoT: folder_path is ignored by backend when warehouse_folder_id is set
            // (materialize_folder_path computes it via FK chain). Kept for fallback only.
            folder_path: resolvedTab.folder_segment || resolvedTab.display_name,
            warehouse_folder_id: resolvedTab.id,
            document_type: selectedDocType || undefined,
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
        fetchDocuments(folderPath);
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
      setExpiryDate(undefined);
    }
  }, [pendingFiles, resolvedTab, selectedDocType, expiryDate, fetchDocuments, toast]);

  // File drag-and-drop handlers (for upload, not reorder)
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

  // Handle email - opens options dialog for attach/link/skip choice
  const handleEmail = useCallback((docs: LibraryDocument[]) => {
    setEmailDocs(docs);
    const defaults: Record<number, "attach" | "link" | "skip"> = {};
    docs.forEach(d => { defaults[d.id] = "attach"; });
    setEmailOptions(defaults);
    setEmailBody("");
    setEmailDialogOpen(true);
  }, []);

  // Generate share links and open compose modal
  const handleComposeEmail = useCallback(async () => {
    const attachDocs = emailDocs.filter(d => emailOptions[d.id] === "attach");
    const linkDocs = emailDocs.filter(d => emailOptions[d.id] === "link");

    if (attachDocs.length === 0 && linkDocs.length === 0) {
      setEmailDialogOpen(false);
      setComposeOpen(true);
      return;
    }

    let bodyHtml = "";
    if (linkDocs.length > 0) {
      setPreparingEmail(true);
      try {
        const linkResults = await Promise.all(
          linkDocs.map(async (doc) => {
            const [dlRes, openRes] = await Promise.all([
              api.post<{ success: boolean; shareUrl: string }>(`/api/v1/documents/${doc.id}/share_link`),
              api.post<{ success: boolean; shareUrl: string }>(`/api/v1/documents/${doc.id}/share_link`, { open: true }),
            ]);
            return {
              doc,
              downloadUrl: dlRes?.success ? dlRes.shareUrl : null,
              openUrl: openRes?.success ? openRes.shareUrl : null,
            };
          })
        );

        const validResults = linkResults.filter(r => r.downloadUrl || r.openUrl);
        const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

        let viewerUrl = "";
        if (validResults.length > 0) {
          const viewerFiles = validResults.map(r => ({
            name: r.doc.originalFilename || r.doc.displayName || "Document",
            downloadUrl: r.downloadUrl || "",
            openUrl: r.openUrl || r.downloadUrl || "",
            contentType: r.doc.mimeType || undefined,
          }));

          const ctxRes = await api.post<{ success: boolean; id?: string }>(
            "/api/v1/viewer_contexts",
            { context: { files: viewerFiles, currentIndex: 0 } }
          );

          if (ctxRes?.success && ctxRes.id) {
            viewerUrl = `${appOrigin}/view/ctx/${ctxRes.id}`;
          }
        }

        let zipUrl: string | undefined;
        if (validResults.length > 1) {
          try {
            const zipRes = await api.post<{
              success: boolean;
              share_url?: string;
              download_method?: string;
              content?: string;
              filename?: string;
              content_type?: string;
              expiry_days?: number;
            }>("/api/v1/documents/bulk_zip", {
              document_ids: validResults.map(r => r.doc.id),
            });
            if (zipRes?.success && zipRes.share_url) {
              zipUrl = zipRes.share_url;
            } else if (zipRes?.success && zipRes.download_method === "base64" && zipRes.content) {
              const byteCharacters = atob(zipRes.content);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/zip" });
              zipUrl = URL.createObjectURL(blob);
            }
          } catch {
            // Not critical - email works without ZIP link
          }
        }

        if (validResults.length > 0) {
          bodyHtml = formatFileEmailBody({
            files: validResults.map((r, idx) => {
              const name = r.doc.originalFilename || r.doc.displayName || "Document";
              const openHref = viewerUrl && validResults.length > 1
                ? `${viewerUrl}?idx=${idx}`
                : r.openUrl || r.downloadUrl || "";
              return { name, downloadUrl: r.downloadUrl || undefined, openUrl: openHref || undefined };
            }),
            zipUrl,
            zipFileCount: validResults.length,
            user: currentUser ? {
              name: currentUser.name,
              email: currentUser.email,
              mobile_phone: currentUser.mobile_phone,
              job_title: currentUser.job_title,
            } : undefined,
            company: companySettings ? {
              name: companySettings.company_name,
              address: companySettings.address,
              website: companySettings.website,
            } : undefined,
          });
        }
      } catch (error) {
        toast({
          title: "Link Generation Failed",
          description: "Could not generate share links. Documents will be attached instead.",
          variant: "destructive",
        });
        linkDocs.forEach(d => {
          emailOptions[d.id] = "attach";
        });
      } finally {
        setPreparingEmail(false);
      }
    }

    setEmailBody(bodyHtml);
    setEmailDialogOpen(false);
    setComposeOpen(true);
  }, [emailDocs, emailOptions, toast, currentUser, companySettings]);

  // Email selected documents (works across tabs since selectedDocs stores full objects)
  const handleEmailSelected = useCallback(() => {
    const docs = Array.from(selectedDocs.values());
    if (docs.length > 0) {
      handleEmail(docs);
    }
  }, [selectedDocs, handleEmail]);

  // Handle document verify
  const handleVerify = useCallback(async (doc: LibraryDocument) => {
    try {
      const res = await api.post<{ success: boolean; document: LibraryDocument }>(`/api/v1/documents/${doc.id}/verify`);
      if (res?.success) {
        toast({ title: "Verified", description: "Document has been validated" });
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, verified: true, verifiedBy: res.document?.verifiedBy || "You", verifiedAt: new Date().toISOString() } : d));
      }
    } catch (error) {
      toast({ title: "Verify Failed", description: "Could not verify document", variant: "destructive" });
    }
  }, [toast]);

  // Handle document unverify
  const handleUnverify = useCallback(async (doc: LibraryDocument) => {
    try {
      const res = await api.post<{ success: boolean; document: LibraryDocument }>(`/api/v1/documents/${doc.id}/unverify`);
      if (res?.success) {
        toast({ title: "Unvalidated", description: "Verification has been removed" });
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, verified: false, verifiedBy: null, verifiedAt: null } : d));
      }
    } catch {
      toast({ title: "Failed", description: "Could not remove verification", variant: "destructive" });
    }
  }, [toast]);

  // Handle document type change
  const handleChangeDocumentType = useCallback(async (doc: LibraryDocument, documentTypeId: number | null) => {
    try {
      const res = await api.patch<{ success: boolean; document: LibraryDocument }>(
        `/api/v1/documents/${doc.id}/change_document_type`,
        { document_type_id: documentTypeId }
      );
      if (res?.success) {
        toast({ title: "Document Type Updated", description: documentTypeId ? "Document type has been changed" : "Document type has been removed" });
        if (resolvedTab) {
          fetchDocuments(resolvedTab.folder_path || resolvedTab.folder_segment || resolvedTab.display_name);
        }
      }
    } catch {
      toast({ title: "Failed", description: "Could not change document type", variant: "destructive" });
    }
  }, [toast, resolvedTab, fetchDocuments]);

  // Handle set/update expiry date
  const handleSetExpiry = useCallback(async (doc: LibraryDocument, date: Date | null) => {
    try {
      const res = await api.patch<{ success: boolean; document: LibraryDocument }>(
        `/api/v1/documents/${doc.id}/set_expiry`,
        { expiry_date: date ? date.toISOString().split("T")[0] : null }
      );
      if (res?.success && res.document) {
        const updated = res.document;
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, expiryDate: updated.expiryDate, isExpired: updated.isExpired, isExpiringSoon: updated.isExpiringSoon, expiryStatus: updated.expiryStatus, daysUntilExpiry: updated.daysUntilExpiry, displayName: updated.displayName, sendName: updated.sendName } : d));
        toast({ title: date ? "Expiry Date Set" : "Expiry Date Removed", description: date ? `Expires ${date.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}` : "Expiry date has been cleared" });
      }
    } catch (error) {
      toast({ title: "Failed", description: "Could not update expiry date", variant: "destructive" });
    }
  }, [toast]);

  // Handle document delete
  const handleDelete = useCallback(async (doc: LibraryDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${doc.originalFilename || doc.displayName}"?`)) return;

    try {
      const res = await api.delete<{ success: boolean }>(`/api/v1/documents/${doc.id}`);
      if (res?.success) {
        toast({ title: "Deleted", description: "Document removed" });
        if (resolvedTab) {
          fetchDocuments(resolvedTab.folder_path || resolvedTab.folder_segment || resolvedTab.display_name);
        }
      }
    } catch (error) {
      toast({ title: "Delete Failed", description: "Could not delete document", variant: "destructive" });
    }
  }, [resolvedTab, fetchDocuments, toast]);

  // Handle reorder - persist to backend
  const handleReorder = useCallback((docIds: number[]) => {
    api.post("/api/v1/documents/reorder", {
      document_ids: docIds,
    }).catch(() => {
      toast({
        title: "Reorder Failed",
        description: "Could not save document order",
        variant: "destructive",
      });
    });
  }, [toast]);

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="px-1.5">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open("/settings/company/warehouse-config/document_types", "_blank")}>
                <FileText className="h-4 w-4 mr-2" />
                Document Types
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open("/settings/company/warehouse-config/library", "_blank")}>
                <BookOpen className="h-4 w-4 mr-2" />
                Library Tabs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs with file drag-and-drop */}
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
        <TabsList expandKey="library-tabs" className="mx-4 mt-2 justify-start">
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

        {/* Tab content - StandardDocumentList */}
        {visibleTabs.map((tab) => (
          <TabsContent
            key={tab.tab_key}
            value={tab.tab_key}
            className="flex-1 min-h-0 overflow-auto px-4 mt-0"
          >
            <StandardDocumentList
              documents={documents}
              loading={docsLoading}
              onDelete={handleDelete}
              onReorder={handleReorder}
              canDrag={isAdmin}
              onEmail={handleEmail}
              onVerify={handleVerify}
              onUnverify={handleUnverify}
              onChangeDocumentType={handleChangeDocumentType}
              onSetExpiry={handleSetExpiry}
              selectedDocs={selectedDocs}
              onSelectionChange={setSelectedDocs}
              hideFloatingBar={true}
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
          </TabsContent>
        ))}

        {/* Floating action bar - cross-tab selection (persists across tabs) */}
        {selectedDocs.size > 0 && (() => {
          const currentTabCount = documents.filter(d => selectedDocs.has(d.id)).length;
          const otherTabCount = selectedDocs.size - currentTabCount;
          return (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 bg-background border rounded-lg shadow-lg">
              <span className="text-sm font-medium">
                {selectedDocs.size} selected
                {otherTabCount > 0 && (
                  <span className="text-muted-foreground font-normal ml-1">
                    ({otherTabCount} from other tabs)
                  </span>
                )}
              </span>
              <Button size="sm" variant="outline" onClick={handleEmailSelected}>
                <Mail className="h-4 w-4 mr-1.5" />
                Email
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground"
                onClick={() => setSelectedDocs(new Map())}
              >
                Clear
              </Button>
            </div>
          );
        })()}
      </Tabs>

      {/* Email options dialog - attach/link/skip per document */}
      <Dialog open={emailDialogOpen} onOpenChange={(open) => {
        if (!open) setEmailDialogOpen(false);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Email Documents</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-auto">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Choose how to include each document.
              </p>
              <div className="flex items-center gap-1">
                {(["attach", "link", "skip"] as const).map((opt) => (
                  <Button
                    key={opt}
                    size="sm"
                    variant={Object.values(emailOptions).every(v => v === opt) ? "default" : "outline"}
                    className="text-xs h-7 px-2"
                    onClick={() => {
                      const updated: Record<number, "attach" | "link" | "skip"> = {};
                      emailDocs.forEach(d => { updated[d.id] = opt; });
                      setEmailOptions(updated);
                    }}
                  >
                    {opt === "attach" && <Paperclip className="h-3 w-3 mr-1" />}
                    {opt === "link" && <Link className="h-3 w-3 mr-1" />}
                    {opt === "skip" && <EyeOff className="h-3 w-3 mr-1" />}
                    All {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            {emailDocs.map((doc) => {
              const option = emailOptions[doc.id] || "attach";
              return (
                <div key={doc.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {doc.originalFilename || doc.displayName || `Document ${doc.id}`}
                    </p>
                    {doc.fileSize > 0 && (
                      <p className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</p>
                    )}
                    <RadioGroup
                      value={option}
                      onValueChange={(val) => setEmailOptions(prev => ({ ...prev, [doc.id]: val as "attach" | "link" | "skip" }))}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="attach" id={`attach-${doc.id}`} />
                        <Label htmlFor={`attach-${doc.id}`} className="text-xs font-normal flex items-center gap-1 cursor-pointer">
                          <Paperclip className="h-3 w-3" />
                          Attach
                        </Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="link" id={`link-${doc.id}`} />
                        <Label htmlFor={`link-${doc.id}`} className="text-xs font-normal flex items-center gap-1 cursor-pointer">
                          <Link className="h-3 w-3" />
                          Link
                        </Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="skip" id={`skip-${doc.id}`} />
                        <Label htmlFor={`skip-${doc.id}`} className="text-xs font-normal flex items-center gap-1 cursor-pointer">
                          <EyeOff className="h-3 w-3" />
                          Skip
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleComposeEmail} disabled={preparingEmail}>
              {preparingEmail ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {preparingEmail ? "Generating Links..." : "Compose Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

            {templateNeedsExpiry && (
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
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUploadDialogOpen(false);
              setPendingFiles([]);
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email compose modal */}
      {emailDocs.length > 0 && (
        <ComposeEmailModal
          open={composeOpen}
          onOpenChange={(open) => {
            setComposeOpen(open);
            if (!open) setSelectedDocs(new Map());
          }}
          defaultSubject={
            emailDocs.length === 1
              ? emailDocs[0].originalFilename || emailDocs[0].displayName || "Library Document"
              : `${emailDocs.length} Library Documents`
          }
          defaultBody={emailBody}
          skipSignature={true}
          initialPreUploadedAttachments={emailDocs
            .filter(d => d.storagePath && emailOptions[d.id] === "attach")
            .map(d => ({
              filename: d.originalFilename || d.displayName || "document",
              storageKey: d.storagePath!,
              fileSize: d.fileSize,
              contentType: d.mimeType,
            }))}
        />
      )}
    </div>
  );
}
