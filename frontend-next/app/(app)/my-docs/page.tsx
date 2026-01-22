"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  File,
  Image as ImageIcon,
  Search,
  List,
  LayoutGrid,
  FolderTree,
  Upload,
  Download,
  Trash2,
  MoreVertical,
  Briefcase,
  Eye,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/utils/formatters";

// Types
interface UserDocument {
  id: number;
  fileName: string;
  displayName: string;
  folder: string | null;
  virtualPath: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string | null;
  storageBlobId: number | null;
  createdAt: string;
  updatedAt: string;
  isImage: boolean;
}

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
}

interface DocumentsResponse {
  success: boolean;
  documents: UserDocument[];
  folders: FolderNode[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

type ViewMode = "tree" | "list" | "gallery";

export default function MyDocsPage() {
  const { toast } = useToast();

  // State
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedDocument, setSelectedDocument] = useState<UserDocument | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Drag and drop for moving documents between folders
  const [draggedDocument, setDraggedDocument] = useState<UserDocument | null>(null);
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);

  // New folder modal
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Save to job modal
  const [saveToJobOpen, setSaveToJobOpen] = useState(false);
  const [saveToJobDoc, setSaveToJobDoc] = useState<UserDocument | null>(null);
  const [jobSearch, setJobSearch] = useState("");
  const [jobs, setJobs] = useState<Array<{ id: number; job_code: string; title: string }>>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [savingToJob, setSavingToJob] = useState(false);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentFolder) params.set("folder", currentFolder);
      if (searchQuery) params.set("search", searchQuery);

      const response = await api.get<DocumentsResponse>(`/api/v1/user_documents?${params}`);
      if (response?.success) {
        setDocuments(response.documents || []);
        setFolders(response.folders || []);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentFolder, searchQuery, toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Search jobs for save-to-job
  const searchJobs = useCallback(async (query: string) => {
    if (query.length < 2) {
      setJobs([]);
      return;
    }
    try {
      const response = await api.get<{ success: boolean; data: { records: Array<{ id: number; job_code: string; title: string }> } }>(
        `/api/v1/foundations/jobs/records?search=${encodeURIComponent(query)}&limit=10`
      );
      if (response?.success && response.data?.records) {
        setJobs(response.data.records);
      }
    } catch (error) {
      console.error("Failed to search jobs:", error);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (saveToJobOpen && jobSearch) {
        searchJobs(jobSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [jobSearch, saveToJobOpen, searchJobs]);

  // File upload handler
  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (currentFolder) {
          formData.append("folder", currentFolder);
        }

        const response = await fetch("/api/v1/user_documents", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const data = await response.json();
        if (data.success) {
          toast({
            title: "Uploaded",
            description: `${file.name} uploaded successfully`,
          });
        } else {
          throw new Error(data.error || "Upload failed");
        }
      } catch (error) {
        console.error("Upload failed:", error);
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }

    setUploading(false);
    fetchDocuments();
  }, [currentFolder, fetchDocuments, toast]);

  // Drag and drop handlers for file upload
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set dragOver if not dragging a document (file upload from desktop)
    if (!draggedDocument) {
      setDragOver(true);
    }
  }, [draggedDocument]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0 && !draggedDocument) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload, draggedDocument]);

  // Move document to folder (drag and drop)
  const handleMoveDocument = useCallback(async (doc: UserDocument, targetFolder: string | null) => {
    try {
      const response = await api.patch<{ success: boolean }>(`/api/v1/user_documents/${doc.id}`, {
        folder: targetFolder || "",
      });

      if (response?.success) {
        toast({
          title: "Moved",
          description: `${doc.fileName} moved to ${targetFolder || "root"}`,
        });
        fetchDocuments();
      }
    } catch (error) {
      console.error("Failed to move document:", error);
      toast({
        title: "Error",
        description: "Failed to move document",
        variant: "destructive",
      });
    }
  }, [fetchDocuments, toast]);

  // Document drag handlers
  const handleDocumentDragStart = useCallback((e: React.DragEvent, doc: UserDocument) => {
    setDraggedDocument(doc);
    e.dataTransfer.setData("text/plain", doc.id.toString());
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDocumentDragEnd = useCallback(() => {
    setDraggedDocument(null);
    setDropTargetFolder(null);
  }, []);

  // Folder drop handlers
  const handleFolderDragOver = useCallback((e: React.DragEvent, folderPath: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedDocument) {
      setDropTargetFolder(folderPath);
      e.dataTransfer.dropEffect = "move";
    }
  }, [draggedDocument]);

  const handleFolderDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetFolder(null);
  }, []);

  const handleFolderDrop = useCallback((e: React.DragEvent, folderPath: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedDocument) {
      handleMoveDocument(draggedDocument, folderPath);
    }
    setDraggedDocument(null);
    setDropTargetFolder(null);
  }, [draggedDocument, handleMoveDocument]);

  // Create folder
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await api.post<{ success: boolean; folder: FolderNode }>("/api/v1/user_documents/create_folder", {
        name: newFolderName,
        parent: currentFolder,
      });

      if (response?.success) {
        toast({
          title: "Folder Created",
          description: `Folder "${newFolderName}" created`,
        });
        setNewFolderOpen(false);
        setNewFolderName("");
        fetchDocuments();
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
      toast({
        title: "Error",
        description: "Failed to create folder",
        variant: "destructive",
      });
    }
  }, [newFolderName, currentFolder, fetchDocuments, toast]);

  // Delete document
  const handleDelete = useCallback(async (doc: UserDocument) => {
    if (!confirm(`Delete "${doc.fileName}"?`)) return;

    try {
      const response = await api.delete<{ success: boolean }>(`/api/v1/user_documents/${doc.id}`);
      if (response?.success) {
        toast({
          title: "Deleted",
          description: `${doc.fileName} deleted`,
        });
        fetchDocuments();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  }, [fetchDocuments, toast]);

  // Download document
  const handleDownload = useCallback(async (doc: UserDocument) => {
    try {
      const response = await api.get<{ success: boolean; url: string }>(`/api/v1/user_documents/${doc.id}/download`);
      if (response?.success && response.url) {
        window.open(response.url, "_blank");
      }
    } catch (error) {
      console.error("Failed to download:", error);
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Save to job
  const handleSaveToJob = useCallback(async () => {
    if (!saveToJobDoc || !selectedJobId) return;

    setSavingToJob(true);
    try {
      const response = await api.post<{ success: boolean; message: string }>(`/api/v1/user_documents/${saveToJobDoc.id}/save_to_job`, {
        job_id: selectedJobId,
      });

      if (response?.success) {
        toast({
          title: "Saved to Job",
          description: response.message,
        });
        setSaveToJobOpen(false);
        setSaveToJobDoc(null);
        setSelectedJobId(null);
        setJobSearch("");
      }
    } catch (error) {
      console.error("Failed to save to job:", error);
      toast({
        title: "Error",
        description: "Failed to save document to job",
        variant: "destructive",
      });
    } finally {
      setSavingToJob(false);
    }
  }, [saveToJobDoc, selectedJobId, toast]);

  // Toggle folder expansion
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Navigate to folder
  const navigateToFolder = useCallback((path: string | null) => {
    setCurrentFolder(path);
  }, []);

  // Get file icon
  const getFileIcon = (doc: UserDocument) => {
    if (doc.isImage) return <ImageIcon className="h-4 w-4 text-purple-500" />;
    if (doc.mimeType?.includes("pdf")) return <File className="h-4 w-4 text-red-500" />;
    if (doc.mimeType?.includes("word") || doc.mimeType?.includes("document")) return <File className="h-4 w-4 text-blue-500" />;
    if (doc.mimeType?.includes("sheet") || doc.mimeType?.includes("excel")) return <File className="h-4 w-4 text-green-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  // Render folder tree with drag-and-drop support
  const renderFolderTree = (nodes: FolderNode[], depth = 0) => {
    return nodes.map(node => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = currentFolder === node.path;
      const hasChildren = node.children && node.children.length > 0;
      const isDropTarget = dropTargetFolder === node.path;

      return (
        <div key={node.path}>
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded cursor-pointer hover:bg-muted transition-colors",
              isSelected && "bg-muted font-medium",
              isDropTarget && draggedDocument && "bg-primary/20 ring-2 ring-primary"
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => navigateToFolder(node.path)}
            onDragOver={(e) => handleFolderDragOver(e, node.path)}
            onDragLeave={handleFolderDragLeave}
            onDrop={(e) => handleFolderDrop(e, node.path)}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(node.path);
                }}
                className="p-0.5 hover:bg-muted-foreground/20 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
            ) : (
              <span className="w-4" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-amber-500" />
            ) : (
              <Folder className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-sm truncate">{node.name}</span>
          </div>
          {isExpanded && hasChildren && renderFolderTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  // Render document list item (draggable)
  const renderDocumentItem = (doc: UserDocument) => (
    <div
      key={doc.id}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded hover:bg-muted group cursor-grab active:cursor-grabbing",
        draggedDocument?.id === doc.id && "opacity-50"
      )}
      draggable
      onDragStart={(e) => handleDocumentDragStart(e, doc)}
      onDragEnd={handleDocumentDragEnd}
    >
      {getFileIcon(doc)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => { setSelectedDocument(doc); setPreviewOpen(true); }}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDownload(doc)}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setSaveToJobDoc(doc); setSaveToJobOpen(true); }}>
            <Briefcase className="h-4 w-4 mr-2" />
            Save to Job...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleDelete(doc)} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // Render gallery item (draggable)
  const renderGalleryItem = (doc: UserDocument) => (
    <div
      key={doc.id}
      className={cn(
        "border rounded-lg p-3 hover:bg-muted cursor-grab active:cursor-grabbing group",
        draggedDocument?.id === doc.id && "opacity-50"
      )}
      draggable
      onDragStart={(e) => handleDocumentDragStart(e, doc)}
      onDragEnd={handleDocumentDragEnd}
      onClick={() => { setSelectedDocument(doc); setPreviewOpen(true); }}
    >
      <div className="aspect-square flex items-center justify-center bg-muted/50 rounded mb-2">
        {doc.isImage && doc.fileUrl ? (
          <img src={doc.fileUrl} alt={doc.fileName} className="max-h-full max-w-full object-contain rounded" draggable={false} />
        ) : (
          <div className="scale-150">{getFileIcon(doc)}</div>
        )}
      </div>
      <p className="text-sm font-medium truncate">{doc.fileName}</p>
      <p className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</p>
    </div>
  );

  // Breadcrumb
  const breadcrumbParts = currentFolder ? currentFolder.split("/") : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Teeem Docs</h1>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <button
              onClick={() => navigateToFolder(null)}
              className={cn("hover:text-foreground", !currentFolder && "font-medium text-foreground")}
            >
              Root
            </button>
            {breadcrumbParts.map((part, index) => {
              const path = breadcrumbParts.slice(0, index + 1).join("/");
              return (
                <span key={path} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <button
                    onClick={() => navigateToFolder(path)}
                    className={cn(
                      "hover:text-foreground",
                      index === breadcrumbParts.length - 1 && "font-medium text-foreground"
                    )}
                  >
                    {part}
                  </button>
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "tree" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("tree")}
              title="Tree view"
            >
              <FolderTree className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "gallery" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("gallery")}
              title="Gallery view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {/* Actions */}
          <Button variant="outline" size="icon" onClick={() => setNewFolderOpen(true)} title="New folder">
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={fetchDocuments} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => document.getElementById("file-upload")?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
          <input
            id="file-upload"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (Tree view shows folders) */}
        {viewMode === "tree" && (
          <div className="w-64 border-r overflow-y-auto p-2">
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-muted transition-colors",
                !currentFolder && "bg-muted font-medium",
                dropTargetFolder === "" && draggedDocument && "bg-primary/20 ring-2 ring-primary"
              )}
              onClick={() => navigateToFolder(null)}
              onDragOver={(e) => handleFolderDragOver(e, "")}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, null)}
            >
              <Folder className="h-4 w-4 text-amber-500" />
              <span className="text-sm">All Documents</span>
            </div>
            {folders.length > 0 && renderFolderTree(folders)}
          </div>
        )}

        {/* Main content area */}
        <div
          className={cn(
            "flex-1 overflow-y-auto p-4",
            dragOver && "bg-primary/5 border-2 border-dashed border-primary"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Folder className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No documents yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload files or drag and drop them here
              </p>
              <Button onClick={() => document.getElementById("file-upload")?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </Button>
            </div>
          ) : viewMode === "gallery" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {documents.map(renderGalleryItem)}
            </div>
          ) : (
            <div className="space-y-1">
              {documents.map(renderDocumentItem)}
            </div>
          )}

          {/* Drop zone indicator */}
          {dragOver && (
            <div className="absolute inset-4 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg pointer-events-none">
              <div className="text-center">
                <Upload className="h-12 w-12 text-primary mx-auto mb-2" />
                <p className="text-lg font-medium">Drop files to upload</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
            {currentFolder && (
              <p className="text-sm text-muted-foreground mt-2">
                Will be created in: {currentFolder}/
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save to Job Dialog */}
      <Dialog open={saveToJobOpen} onOpenChange={setSaveToJobOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to Job</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Link "{saveToJobDoc?.fileName}" to a job
            </p>
            <Input
              placeholder="Search jobs..."
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
              autoFocus
            />
            {jobs.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {jobs.map(job => (
                  <button
                    key={job.id}
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2",
                      selectedJobId === job.id && "bg-primary/10"
                    )}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{job.job_code}</span>
                    <span className="text-muted-foreground truncate">{job.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveToJobOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveToJob} disabled={!selectedJobId || savingToJob}>
              {savingToJob ? "Saving..." : "Save to Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate">{selectedDocument?.fileName}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => selectedDocument && handleDownload(selectedDocument)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPreviewOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-[400px]">
            {selectedDocument?.mimeType?.includes("pdf") && selectedDocument.fileUrl ? (
              <PDFViewer url={selectedDocument.fileUrl} />
            ) : selectedDocument?.isImage && selectedDocument.fileUrl ? (
              <img
                src={selectedDocument.fileUrl}
                alt={selectedDocument.fileName}
                className="max-w-full h-auto mx-auto"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <File className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Preview not available for this file type</p>
                <Button variant="outline" className="mt-4" onClick={() => selectedDocument && handleDownload(selectedDocument)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download to view
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
