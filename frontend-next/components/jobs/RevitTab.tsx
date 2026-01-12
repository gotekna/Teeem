"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import {
  Folder,
  File,
  FileCode,
  FileImage,
  FileCog,
  ChevronRight,
  Home,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SharePointItem {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  source_folder?: string;
  folder?: { childCount?: number };
  "@microsoft.graph.downloadUrl"?: string;
}

interface FolderInfo {
  name: string;
  id: string;
  web_url?: string;
}

interface BrowseState {
  items: SharePointItem[];
  subfolders: SharePointItem[];
  currentPath: string[];
  currentFolderId: string | null;
  rootFolderUrl?: string;
}

interface RevitTabProps {
  jobId: number;
  jobTitle?: string;
}

// Map file extensions to icons
function getFileIcon(fileName: string) {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  switch (ext) {
    case "rvt":
    case "rfa":
    case "rte":
      return <FileCog className="h-5 w-5 text-orange-500" />;
    case "dwg":
    case "dxf":
      return <FileCode className="h-5 w-5 text-blue-500" />;
    case "skp":
      return <FileCode className="h-5 w-5 text-red-500" />;
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "bmp":
      return <FileImage className="h-5 w-5 text-green-500" />;
    case "pdf":
      return <File className="h-5 w-5 text-red-600" />;
    case "udatasmith":
    case "datasmith":
      return <FileCog className="h-5 w-5 text-purple-500" />;
    default:
      return <File className="h-5 w-5 text-muted-foreground" />;
  }
}

// Format file size
function formatFileSize(bytes?: number): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Format date
function formatDate(dateString?: string): string {
  if (!dateString) return "-";
  try {
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

export function RevitTab({ jobId, jobTitle }: RevitTabProps) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [browseState, setBrowseState] = React.useState<BrowseState>({
    items: [],
    subfolders: [],
    currentPath: [],
    currentFolderId: null,
  });

  // Drag & drop state
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<{ current: number; total: number } | null>(null);
  const dragCounterRef = React.useRef(0);
  const [revitFolderId, setRevitFolderId] = React.useState<string | null>(null);

  // Load folder contents
  const loadFolderContents = React.useCallback(
    async (folderName: string = "Revit", folderId?: string) => {
      setLoading(true);
      setError(null);

      try {
        // Use folder_id if navigating into a subfolder, otherwise use folder_name
        const params = new URLSearchParams();
        params.set("job_id", jobId.toString());

        if (folderId) {
          // TODO: When we have browse_subfolder endpoint, use it here
          // For now, we can only browse the root Revit folder
          params.set("folder_name", folderName);
        } else {
          params.set("folder_name", folderName);
        }

        const response = await api.get<{
          files: SharePointItem[];
          subfolders: SharePointItem[];
          found_folders: FolderInfo[];
          job_folder_web_url?: string;
        }>(`/api/v1/documents/folder_contents?${params.toString()}`);

        // Sort items: folders first, then files, both alphabetically
        const sortedSubfolders = [...(response.subfolders || [])].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        const sortedFiles = [...(response.files || [])].sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        // Get Revit folder URL and ID from found_folders (check both web_url and webUrl)
        const revitFolder = response.found_folders?.[0];
        const revitFolderUrl = revitFolder?.web_url || (revitFolder as any)?.webUrl || response.job_folder_web_url;

        // Store the folder ID for uploads
        if (revitFolder?.id) {
          setRevitFolderId(revitFolder.id);
        }

        setBrowseState((prev) => ({
          ...prev,
          items: sortedFiles,
          subfolders: sortedSubfolders,
          rootFolderUrl: revitFolderUrl,
        }));
      } catch (err) {
        console.error("Failed to load folder contents:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load Revit folder contents"
        );
      } finally {
        setLoading(false);
      }
    },
    [jobId]
  );

  // Initial load
  React.useEffect(() => {
    loadFolderContents("Revit");
  }, [loadFolderContents]);

  // Handle folder click (navigate into subfolder)
  const handleFolderClick = (folder: SharePointItem) => {
    // Open folder in SharePoint for now (until we have nested browse support)
    if (folder.webUrl) {
      window.open(folder.webUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Handle file click (open in SharePoint or download)
  const handleFileClick = (file: SharePointItem) => {
    if (file.webUrl) {
      window.open(file.webUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    loadFolderContents("Revit");
  };

  // Open root folder in SharePoint
  const handleOpenInSharePoint = () => {
    if (browseState.rootFolderUrl) {
      window.open(browseState.rootFolderUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Drag & drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (!revitFolderId) {
      toast.error("Revit folder not found. Cannot upload files.");
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Filter for CAD-related files (optional - can remove to allow any files)
    const allowedExtensions = [
      "rvt", "rfa", "rte", // Revit
      "dwg", "dxf", // AutoCAD
      "skp", // SketchUp
      "udatasmith", "datasmith", // Datasmith
      "fbx", "obj", "3ds", // 3D formats
      "pdf", // PDFs
      "jpg", "jpeg", "png", "gif", "bmp", // Images
    ];

    const validFiles = files.filter((file) => {
      const ext = file.name.toLowerCase().split(".").pop() || "";
      return allowedExtensions.includes(ext);
    });

    if (validFiles.length === 0) {
      toast.error("No valid CAD files found. Supported: RVT, DWG, Datasmith, SKP, PDF, images");
      return;
    }

    if (validFiles.length !== files.length) {
      toast.warning(`Skipped ${files.length - validFiles.length} unsupported file(s)`);
    }

    await uploadFiles(validFiles);
  };

  // Upload files to SharePoint
  const uploadFiles = async (files: File[]) => {
    if (!revitFolderId) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length });

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("job_id", jobId.toString());
        formData.append("folder_id", revitFolderId);

        await api.postFormData("/api/v1/documents/upload", formData);
        successCount++;
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
        errorCount++;
      }
    }

    setIsUploading(false);
    setUploadProgress(null);

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} file${successCount !== 1 ? "s" : ""}`);
      // Refresh to show new files
      loadFolderContents("Revit");
    }

    if (errorCount > 0) {
      toast.error(`Failed to upload ${errorCount} file${errorCount !== 1 ? "s" : ""}`);
    }
  };

  // Handle manual file input
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFiles(Array.from(files));
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center justify-center gap-4">
          <Spinner size={32} />
          <p className="text-muted-foreground">Loading Revit files...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasItems =
    browseState.subfolders.length > 0 || browseState.items.length > 0;

  // Hidden file input ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <Card
      className={cn("relative", isDragging && "ring-2 ring-primary ring-offset-2")}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary">
          <div className="text-center">
            <Upload className="h-12 w-12 mx-auto mb-2 text-primary" />
            <p className="text-lg font-medium text-primary">Drop files here</p>
            <p className="text-sm text-muted-foreground">RVT, DWG, Datasmith, SKP, PDF</p>
          </div>
        </div>
      )}

      {/* Upload progress overlay */}
      {isUploading && uploadProgress && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <Spinner size={32} className="mx-auto mb-2" />
            <p className="text-lg font-medium">
              Uploading {uploadProgress.current} of {uploadProgress.total}...
            </p>
          </div>
        </div>
      )}

      {/* Hidden file input for manual upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".rvt,.rfa,.rte,.dwg,.dxf,.skp,.udatasmith,.datasmith,.fbx,.obj,.3ds,.pdf,.jpg,.jpeg,.png,.gif,.bmp"
        onChange={handleFileInputChange}
      />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <FileCog className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <CardTitle>Revit & CAD Files</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              DWG, RVT, Datasmith, and other CAD files
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={!revitFolderId || isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isUploading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {browseState.rootFolderUrl && (
            <Button variant="outline" size="sm" onClick={handleOpenInSharePoint}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Storage
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 mb-4 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => loadFolderContents("Revit")}
          >
            <Home className="h-4 w-4 mr-1" />
            Revit
          </Button>
          {browseState.currentPath.map((folder, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  // TODO: Navigate to specific path
                }}
              >
                {folder}
              </Button>
            </React.Fragment>
          ))}
        </div>

        {!hasItems ? (
          <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No files in the Revit folder yet</p>
            <p className="text-sm mt-2 mb-4">
              Drag & drop CAD files here, or click Upload
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!revitFolderId || isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr,100px,120px] gap-4 px-4 py-2 bg-muted/50 text-sm font-medium text-muted-foreground border-b">
              <div>Name</div>
              <div className="text-right">Size</div>
              <div className="text-right">Modified</div>
            </div>

            {/* Folders first */}
            {browseState.subfolders.map((folder) => (
              <div
                key={folder.id}
                className={cn(
                  "grid grid-cols-[1fr,100px,120px] gap-4 px-4 py-2 border-b last:border-b-0",
                  "hover:bg-muted/50 cursor-pointer transition-colors"
                )}
                onClick={() => handleFolderClick(folder)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Folder className="h-5 w-5 text-yellow-500 shrink-0" />
                  <span className="truncate font-medium">{folder.name}</span>
                  {folder.folder?.childCount !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      ({folder.folder.childCount} items)
                    </span>
                  )}
                </div>
                <div className="text-right text-sm text-muted-foreground">-</div>
                <div className="text-right text-sm text-muted-foreground">
                  {formatDate(folder.lastModifiedDateTime)}
                </div>
              </div>
            ))}

            {/* Then files */}
            {browseState.items.map((file) => (
              <div
                key={file.id}
                className={cn(
                  "grid grid-cols-[1fr,100px,120px] gap-4 px-4 py-2 border-b last:border-b-0",
                  "hover:bg-muted/50 cursor-pointer transition-colors"
                )}
                onClick={() => handleFileClick(file)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getFileIcon(file.name)}
                  <span className="truncate">{file.name}</span>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {formatFileSize(file.size)}
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {formatDate(file.lastModifiedDateTime)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {hasItems && (
          <div className="mt-4 text-sm text-muted-foreground">
            {browseState.subfolders.length > 0 &&
              `${browseState.subfolders.length} folder${browseState.subfolders.length !== 1 ? "s" : ""}`}
            {browseState.subfolders.length > 0 && browseState.items.length > 0 && ", "}
            {browseState.items.length > 0 &&
              `${browseState.items.length} file${browseState.items.length !== 1 ? "s" : ""}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
