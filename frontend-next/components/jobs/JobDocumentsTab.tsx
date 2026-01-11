"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Folder,
  Upload,
  ExternalLink,
  Cloud,
  CheckCircle,
  AlertCircle,
  FileText,
  Paperclip,
  Eye,
  ShieldCheck,
  Settings,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  File,
  Download,
  FolderInput,
  X,
  Sparkles,
  Check,
  CheckSquare,
  ArrowRight,
  Camera,
  ImagePlus,
  LayoutGrid,
  List,
} from "lucide-react";
import { PhotoGallery, type PhotoItem } from "@/components/ui/photo-gallery";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { api, getApiBaseUrl } from "@/lib/api";
import { uploadToSharePointDirect, type UploadProgress } from "@/lib/sharepoint-upload";

interface OrgStatus {
  loading: boolean;
  connected: boolean;
  rootFolderPath?: string;
}

interface JobFolderStatus {
  loading: boolean;
  exists: boolean;
  webUrl: string | null;
  jobFolderId?: string;
}

// RENAMED: OneDriveItem → SharePointItem, OneDriveFolder → SharePointFolder
interface SharePointItem {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime?: string;
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
  };
  size?: number;
}

interface SharePointFolder {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime?: string;
  folder?: {
    childCount: number;
  };
}

interface FolderPath {
  id: string;
  name: string;
  webUrl?: string;
}

interface DocumentCategory {
  id: number;
  tab_key?: string;  // SSoT: Unique key for matching (e.g., "supervisor-photo")
  name: string;  // SSoT: Alias for display_name (backend sends both)
  display_name: string;  // SSoT: The actual field from EntityTab
  document_count?: number;
  icon?: string;
  color?: string;
  description?: string;
  sequence_order?: number;
  is_active?: boolean;
  folder_path?: string;
  is_photo_category?: boolean;  // SSoT: Explicit photo gallery flag from EntityTab
  children?: DocumentCategory[];
}

interface DocumentTask {
  id: number;
  name: string;
  description: string;
  required: boolean;
  has_document: boolean;
  is_validated: boolean;
  document_url: string | null;
  uploaded_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
}

interface LegacyItem {
  id: string;
  document_id?: number;
  name: string;
  original_name?: string;
  size?: number;
  web_url?: string;
  modified?: string;
  type: "file" | "folder";
  child_count?: number;
  folder_path?: string; // Path to the file's parent folder (for recursive listing)
  // Storage provider routing (SSoT for document access)
  storage_provider?: "sharepoint" | "s3_compatible";
  // AI analysis fields
  ai_analyzed?: boolean;
  ai_analyzed_at?: string;
  ai_suggested_type_id?: number;
  ai_suggested_type_name?: string;
  ai_proposed_name?: string;
  ai_confidence?: number;
  ai_reasoning?: string;
  rename_status?: string;
  thumbnail_url?: string; // Graph API thumbnail URL (publicly accessible)
  download_url?: string; // SSoT download URL - works for both SharePoint and S3
  // Version chain fields (Draft/Signed versioning)
  version_status?: "draft" | "signed" | "superseded";
  version_number?: number;
  parent_document_id?: number | null;
  is_versionable?: boolean;
  has_signed_version?: boolean;
  signed_at?: string;
  signed_by_name?: string;
  child_versions?: Array<{
    id: number;
    version_status: string;
    version_number: number;
    file_name: string;
  }>;
}

interface AIStats {
  total: number;
  analyzed: number;
  unanalyzed: number;
  pending_review: number;
  approved: number;
  rejected: number;
}

interface JobDocumentsTabProps {
  jobId: string | number;
  jobTitle?: string;
  initialCategory?: string; // e.g., "site-photo" -> auto-selects "Site Photo" category
  categories?: DocumentCategory[]; // SSoT: Categories from parent (useEntityTabs) - eliminates duplicate API call
}

export function JobDocumentsTab({ jobId, jobTitle, initialCategory, categories: propCategories }: JobDocumentsTabProps) {
  const [viewMode, setViewMode] = useState<"tasks" | "sharepoint" | "allfiles">("tasks");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [orgStatus, setOrgStatus] = useState<OrgStatus>({ loading: true, connected: false });
  const [jobFolderStatus, setJobFolderStatus] = useState<JobFolderStatus>({ loading: false, exists: false, webUrl: null });
  const [folders, setFolders] = useState<SharePointFolder[]>([]);
  const [creatingFolders, setCreatingFolders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [documentCategories, setDocumentCategories] = useState<DocumentCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<DocumentCategory | null>(null);
  const [tasks, setTasks] = useState<DocumentTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPath[]>([]);
  const [folderContents, setFolderContents] = useState<SharePointItem[]>([]);
  const [loadingContents, setLoadingContents] = useState(false);

  // Legacy import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [legacyItems, setLegacyItems] = useState<LegacyItem[]>([]);
  const [loadingLegacy, setLoadingLegacy] = useState(false);
  const [selectedLegacyFiles, setSelectedLegacyFiles] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  // All Files tab state
  const [allFiles, setAllFiles] = useState<LegacyItem[]>([]);
  const [loadingAllFiles, setLoadingAllFiles] = useState(false);
  const [allFilesJobFolderUrl, setAllFilesJobFolderUrl] = useState<string | null>(null);
  const [aiStats, setAiStats] = useState<AIStats | null>(null);
  const [analyzingDocs, setAnalyzingDocs] = useState(false);
  const [approvingDoc, setApprovingDoc] = useState<number | null>(null);

  // Bulk categorization state (for client onboarding)
  const [bulkCategorizing, setBulkCategorizing] = useState(false);
  const [categorizeResult, setCategorizeResult] = useState<{
    dry_run: boolean;
    stats: { total: number; categorized: number; skipped: number; failed: number; recategorized: number; already_correct?: number };
    details: Array<{ id: number; file_name: string; folder_path?: string; status: string; document_type?: string; entity_tab?: string; reason?: string; old_type?: string }>;
  } | null>(null);
  const [showCategorizeSummary, setShowCategorizeSummary] = useState(false);
  const [forceRecategorize, setForceRecategorize] = useState(false);
  const [categorizeFilter, setCategorizeFilter] = useState<"all" | "new" | "fixed" | "correct" | "skipped" | "failed">("all");

  // Photo upload state
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoLibraryInputRef = useRef<HTMLInputElement>(null);

  // Photo gallery state
  const [allFilesDisplayMode, setAllFilesDisplayMode] = useState<"table" | "gallery">("table");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Category photo lightbox state
  const [categoryLightboxOpen, setCategoryLightboxOpen] = useState(false);
  const [categoryLightboxIndex, setCategoryLightboxIndex] = useState(0);

  // Version grouping state (Draft/Signed document versioning)
  const [expandedVersionGroups, setExpandedVersionGroups] = useState<Set<string>>(new Set());

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photosToDelete, setPhotosToDelete] = useState<PhotoItem[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Check if the current category is a photo category
  // SSoT: "Photo Gallery View" checkbox on each tab controls this
  const isPhotoCategory = (category: DocumentCategory | null): boolean => {
    return category?.is_photo_category === true;
  };

  // Check if a file is an image
  const isImageFile = (item: LegacyItem): boolean => {
    const name = item.name?.toLowerCase() || "";
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic", ".heif"];
    return imageExtensions.some((ext) => name.endsWith(ext));
  };

  // Open document in new tab - handles both SharePoint and S3 storage providers
  // For S3 documents, fetches a pre-signed URL first
  // For SharePoint documents, uses the existing web_url
  const openDocument = React.useCallback(async (item: LegacyItem) => {
    try {
      // If document is on S3, get a pre-signed URL first
      if (item.storage_provider === "s3_compatible" && item.document_id) {
        const response = await api.get<{
          success: boolean;
          download_url?: string;
          error?: string;
        }>(
          "/api/v1/organization_onedrive/job_document_url",
          { params: { document_id: item.document_id } }
        );

        if (response.success && response.download_url) {
          window.open(response.download_url, "_blank");
          return;
        }
        // Fall through to web_url if S3 URL fetch fails
        console.warn("Failed to get S3 URL, falling back to web_url:", response.error);
      }

      // Default: use web_url for SharePoint documents (or as fallback)
      if (item.web_url) {
        window.open(item.web_url, "_blank");
      }
    } catch (err) {
      console.error("Error opening document:", err);
      // Fallback to web_url on error
      if (item.web_url) {
        window.open(item.web_url, "_blank");
      }
    }
  }, []);

  // Resolve full-size download URL for lightbox viewing
  // This fetches on-demand from Microsoft Graph (returns pre-authenticated URL valid ~1hr)
  const resolveFullUrl = React.useCallback(async (fileId: string): Promise<string | null> => {
    try {
      const data = await api.get<{ download_url?: string }>(
        "/api/v1/organization_onedrive/download_url",
        { params: { file_id: fileId }, skipAuthRedirect: true }
      );
      return data.download_url || null;
    } catch (err) {
      console.error("Error fetching download URL:", err);
      return null;
    }
  }, []);

  // Delete a photo from SharePoint
  const handleDeletePhoto = React.useCallback(async (fileId: string): Promise<void> => {
    const response = await api.delete<{ success: boolean; error?: string }>(
      "/api/v1/organization_onedrive/delete_file",
      { params: { file_id: fileId } }
    );

    if (!response || !response.success) {
      throw new Error(response?.error || "Failed to delete file");
    }

    // Remove from local state - categoryPhotoItems is derived via useMemo from allFiles
    setAllFiles((prev: LegacyItem[]) => prev.filter((f: LegacyItem) => f.id !== fileId));
  }, []);

  // Convert LegacyItem to PhotoItem for gallery display
  const convertToPhotoItem = (item: LegacyItem): PhotoItem => {
    // Build API URL for fetching image through backend proxy (with auth)
    // IMPORTANT: Always use proxy URL for main image because SharePoint direct URLs
    // fail due to CORS when used in <img> tags. The lightbox fetches via api.getBlob()
    // with proper auth to bypass this.
    const apiBase = getApiBaseUrl();
    const proxyUrl = `${apiBase}/api/v1/organization_onedrive/download?file_id=${item.id}&preview=true`;
    // Use Graph API thumbnail URL if available (publicly accessible, no auth required)
    const thumbnailUrl = item.thumbnail_url || proxyUrl;

    return {
      id: item.id,
      name: item.name,
      url: proxyUrl, // Always use proxy - lightbox fetches with auth via api.getBlob()
      thumbnailUrl: thumbnailUrl,
      webUrl: item.web_url,
      createdAt: item.modified, // Use modified as fallback for created
      modifiedAt: item.modified,
      size: item.size,
    };
  };

  // Get filtered image files as PhotoItems
  const imagePhotos: PhotoItem[] = useMemo(() => {
    return allFiles.filter(isImageFile).map(convertToPhotoItem);
  }, [allFiles, jobId]);

  // Handle photo click to open lightbox (All Files tab)
  const handlePhotoClick = (photo: PhotoItem, index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Handle photo click for category gallery
  const handleCategoryPhotoClick = (photo: PhotoItem, index: number) => {
    setCategoryLightboxIndex(index);
    setCategoryLightboxOpen(true);
  };

  // Handle selection action (download, delete)
  const handleSelectionAction = async (action: string, selectedPhotos: PhotoItem[]) => {
    if (action === "download") {
      // Download selected photos
      for (const photo of selectedPhotos) {
        const link = document.createElement("a");
        link.href = photo.url;
        link.download = photo.name;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Small delay between downloads to avoid browser blocking
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      setMessage({ type: "success", text: `Downloading ${selectedPhotos.length} photo(s)` });
    } else if (action === "delete") {
      // Show confirmation dialog
      setPhotosToDelete(selectedPhotos);
      setDeleteDialogOpen(true);
      return; // Don't clear selection yet - wait for confirmation
    }
    // Clear selection after action
    setSelectedPhotoIds(new Set());
    setSelectMode(false);
  };

  // Execute delete after confirmation
  const executeDelete = async () => {
    if (photosToDelete.length === 0) return;

    setDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const photo of photosToDelete) {
      try {
        await handleDeletePhoto(photo.id);
        successCount++;
      } catch (err) {
        console.error(`Failed to delete ${photo.name}:`, err);
        failCount++;
      }
    }

    // Show result message
    if (failCount === 0) {
      setMessage({ type: "success", text: `${successCount} photo${successCount > 1 ? "s" : ""} deleted successfully` });
    } else if (successCount === 0) {
      setError(`Failed to delete ${failCount} photo${failCount > 1 ? "s" : ""}`);
    } else {
      setMessage({ type: "success", text: `${successCount} deleted, ${failCount} failed` });
    }

    // Clear state
    setDeleting(false);
    setDeleteDialogOpen(false);
    setPhotosToDelete([]);
    setSelectedPhotoIds(new Set());
    setSelectMode(false);
  };

  // Toggle select mode
  const toggleSelectMode = () => {
    if (selectMode) {
      // Exiting select mode - clear selection
      setSelectedPhotoIds(new Set());
    }
    setSelectMode(!selectMode);
  };

  // Get category photos by filtering allFiles by folder_path (more efficient than separate API call)
  const categoryPhotoItems: PhotoItem[] = useMemo(() => {
    const activeCategory = selectedSubCategory || selectedCategory;
    if (!isPhotoCategory(activeCategory)) {
      return [];
    }

    const categoryName = activeCategory?.name?.toLowerCase() || "";
    const folderPath = activeCategory?.folder_path?.toLowerCase() || "";

    // Filter allFiles to only those in this folder
    const photosInFolder = allFiles.filter((file) => {
      if (!isImageFile(file)) return false;
      const fileFolderPath = (file.folder_path || "").toLowerCase();

      // Match by multiple strategies (folder_path format varies):
      // 1. File path contains category folder_path (e.g., "06 Photo/07 Supervisor Photos")
      // 2. File path contains category name (e.g., "Supervisor" in "Photo/Supervisor")
      // 3. Category folder_path contains file path (reverse match)
      return (
        (folderPath && fileFolderPath.includes(folderPath)) ||
        (categoryName && fileFolderPath.includes(categoryName)) ||
        (folderPath && folderPath.includes(fileFolderPath) && fileFolderPath.length > 0)
      );
    });

    return photosInFolder.map(convertToPhotoItem);
  }, [allFiles, selectedCategory, selectedSubCategory, jobId]);

  // Get category documents (non-photos) by filtering allFiles by folder_path
  const categoryDocumentItems: LegacyItem[] = useMemo(() => {
    const activeCategory = selectedSubCategory || selectedCategory;
    if (!activeCategory || isPhotoCategory(activeCategory)) {
      return [];
    }

    const categoryName = activeCategory?.name?.toLowerCase() || "";
    const folderPath = activeCategory?.folder_path?.toLowerCase() || "";

    // Filter allFiles to documents (non-images) in this folder
    return allFiles.filter((file) => {
      if (isImageFile(file)) return false; // Skip images
      const fileFolderPath = (file.folder_path || "").toLowerCase();

      // Match by multiple strategies (same as categoryPhotoItems)
      return (
        (folderPath && fileFolderPath.includes(folderPath)) ||
        (categoryName && fileFolderPath.includes(categoryName)) ||
        (folderPath && folderPath.includes(fileFolderPath) && fileFolderPath.length > 0)
      );
    });
  }, [allFiles, selectedCategory, selectedSubCategory]);

  // Group documents by version chain for expandable display (Draft/Signed versioning)
  // Returns items grouped: root documents with their child versions nested
  const groupedAllFiles = useMemo(() => {
    // Separate root documents (no parent) from child versions
    const rootDocs = allFiles.filter(f => !f.parent_document_id);
    const childVersionMap = new Map<number, LegacyItem[]>();

    // Build a map of parent_document_id -> child versions
    allFiles.forEach(f => {
      if (f.parent_document_id && f.document_id) {
        const children = childVersionMap.get(f.parent_document_id) || [];
        children.push(f);
        childVersionMap.set(f.parent_document_id, children);
      }
    });

    // Return root docs with their child versions attached
    return rootDocs.map(doc => ({
      ...doc,
      // Attach child versions from the map (if any)
      child_versions_data: doc.document_id ? childVersionMap.get(doc.document_id) || [] : []
    }));
  }, [allFiles]);

  // Toggle expansion of a version group
  const toggleVersionGroup = useCallback((documentId: string) => {
    setExpandedVersionGroups(prev => {
      const next = new Set(prev);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }
      return next;
    });
  }, []);

  // Get version status badge color and label
  const getVersionBadge = (status?: string) => {
    switch (status) {
      case "draft":
        return { label: "Draft", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
      case "signed":
        return { label: "Signed", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
      case "superseded":
        return { label: "Superseded", className: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400" };
      default:
        return null;
    }
  };

  // Generate photo filename based on category and current date/time
  const generatePhotoFilename = (extension: string): string => {
    const category = selectedSubCategory || selectedCategory;
    // Use category name, or fallback to initialCategory, or default to "Photo"
    let categoryName = category?.name || "";
    if (!categoryName && initialCategory) {
      // Convert "site-photo" to "Site_Photo"
      categoryName = initialCategory
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("_");
    }
    categoryName = categoryName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "Photo";
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ""); // HHMMSS
    return `${categoryName}_${dateStr}_${timeStr}.${extension}`;
  };

  // Handle photo upload (from camera or library)
  // ULTRA MASTERPIECE: Direct browser-to-SharePoint upload (50% faster)
  // Returns true on success, false on failure
  const handlePhotoUpload = async (file: File): Promise<boolean> => {
    if (!file || !orgStatus.connected) return false;

    setUploadingPhoto(true);
    setShowPhotoOptions(false);
    setError(null);

    // Get the folder path from the current category or initialCategory
    const category = selectedSubCategory || selectedCategory;
    let folderPath = category?.folder_path || "";

    // If no folder path from category, derive from initialCategory
    if (!folderPath && initialCategory) {
      // Map tab names to folder paths
      const folderMap: Record<string, string> = {
        "site-photo": "06 Photo/01 SITE",
        "client-photo": "06 Photo/02 Client",
        "slab-photo": "06 Photo/02 SLAB",
        "frame-photo": "06 Photo/03 FRAME",
        "pc-photo": "06 Photo/06 Practical Completion",
        "enclosed-photo": "06 Photo/04 ENCLOSED",
        "fixing-photo": "06 Photo/05 FIXING",
        "supervisor-photo": "06 Photo/07 Supervisor Photos",
      };
      folderPath = folderMap[initialCategory] || "06 Photo";
    }

    if (!folderPath) {
      folderPath = "06 Photo";
    }

    // Generate a proper filename based on category and date/time
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const newFilename = generatePhotoFilename(extension);

    // ULTRA: Optimistic UI - show photo BEFORE upload starts
    // This makes uploads feel instant even though they take 10-15 seconds
    const blobUrl = URL.createObjectURL(file);
    const optimisticItem: LegacyItem = {
      id: `optimistic_${Date.now()}`,
      name: newFilename,
      type: "file",
      folder_path: folderPath,
      modified: new Date().toISOString(),
      size: file.size,
      download_url: blobUrl,
      thumbnail_url: blobUrl,
    };

    // Add to allFiles immediately - categoryPhotoItems will auto-update via useMemo
    setAllFiles((prev) => [...prev, optimisticItem]);

    try {
      // ULTRA MASTERPIECE: Direct upload to SharePoint (skips backend proxy!)
      // Browser uploads directly to SharePoint using pre-authenticated URL
      // This is 50% faster than going through Heroku
      const result = await uploadToSharePointDirect(file, {
        jobId,
        folderPath,
        filename: newFilename,
        onProgress: (progress: UploadProgress) => {
          // Could add progress UI here in the future
          console.log(`[DirectUpload] ${progress.status}: ${progress.percentage}%`);
        },
      });

      if (result.success) {
        // FALLBACK: Trigger job-specific document sync to ensure warehouse is updated
        // This handles edge cases where upload_complete is skipped (e.g., missing SharePoint item ID)
        api.post("/api/v1/organization_onedrive/sync_job_documents", { job_id: jobId })
          .catch(err => console.warn("[PhotoUpload] Fallback sync failed:", err));

        // Refresh file list in background to get real SharePoint URLs
        // Wait for SharePoint to index the file (3s is usually enough)
        setTimeout(() => {
          loadAllFiles().then(() => {
            URL.revokeObjectURL(blobUrl);
          });
        }, 3000);
        return true;
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (err) {
      console.error("Failed to upload photo:", err);

      // Remove optimistic item on failure
      setAllFiles((prev) => prev.filter((f) => f.id !== optimisticItem.id));
      URL.revokeObjectURL(blobUrl);
      return false;
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Handle camera capture
  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoUpload(file);
    }
    // Reset the input so the same file can be selected again
    if (e.target) e.target.value = "";
  };

  // Handle photo library selection (supports multiple files)
  const handlePhotoLibrarySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const totalFiles = files.length;
    let successCount = 0;
    let failCount = 0;

    // Upload all selected files sequentially
    for (let i = 0; i < totalFiles; i++) {
      // Show progress message for multi-upload
      if (totalFiles > 1) {
        setMessage({ type: "info", text: `Uploading photo ${i + 1} of ${totalFiles}...` });
      }

      const success = await handlePhotoUpload(files[i]);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    // Show final summary
    if (totalFiles > 1) {
      if (failCount === 0) {
        setMessage({ type: "success", text: `${successCount} photos uploaded successfully!` });
      } else if (successCount === 0) {
        setError(`Failed to upload ${failCount} photo${failCount > 1 ? "s" : ""}. Please try again.`);
      } else {
        setMessage({ type: "success", text: `${successCount} uploaded, ${failCount} failed.` });
      }

      // ULTRA FIX: Do a final refresh after all uploads complete
      // This ensures we get the real SharePoint URLs for all photos
      // Wait longer (5s) to give SharePoint time to index all files
      setTimeout(() => {
        loadAllFiles();
      }, 5000);
    } else if (successCount === 1) {
      setMessage({ type: "success", text: "Photo uploaded successfully!" });
    }

    // Reset the input so the same files can be selected again
    if (e.target) e.target.value = "";
  };

  // Track if org status has been checked for this job (prevents duplicate API calls)
  const orgStatusCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    // Only check org status once per job (not on every category/prop change)
    if (orgStatusCheckedRef.current !== String(jobId)) {
      orgStatusCheckedRef.current = String(jobId);
      checkOrganizationStatus();
    }
    loadDocumentCategories();

  }, [jobId, initialCategory, propCategories]);  // SSoT: Re-run when initialCategory or propCategories changes

  // Track if initialCategory has been applied to prevent useEffect from overwriting it
  const initialCategoryAppliedRef = useRef(false);

  useEffect(() => {
    // When a parent category is selected, auto-select the first child (or the parent itself if no children)
    // BUT skip if initialCategory was just applied (to prevent overwriting the correct subcategory)
    if (selectedCategory) {
      if (selectedCategory.children && selectedCategory.children.length > 0) {
        // If initialCategory was applied and subcategory is already set correctly, don't overwrite
        if (initialCategoryAppliedRef.current && selectedSubCategory) {
          initialCategoryAppliedRef.current = false; // Reset flag after first use
          return;
        }
        setSelectedSubCategory(selectedCategory.children[0]);
      } else {
        setSelectedSubCategory(null);
        loadDocumentTasks(selectedCategory.id);
      }
    }

  }, [selectedCategory]);

  useEffect(() => {
    // Load tasks for the selected subcategory
    if (selectedSubCategory) {
      loadDocumentTasks(selectedSubCategory.id);
    }

  }, [selectedSubCategory]);

  const checkOrganizationStatus = async () => {
    try {
      setOrgStatus({ loading: true, connected: false });
      setError(null);

      const response = await api.get<{ connected: boolean; root_folder_path?: string }>(
        "/api/v1/organization_onedrive/status"
      );

      setOrgStatus({
        loading: false,
        connected: response?.connected || false,
        rootFolderPath: response?.root_folder_path,
      });

      if (response?.connected) {
        await checkJobFolderStatus();
      }
    } catch (err) {
      console.error("Failed to check organization OneDrive status:", err);
      setOrgStatus({ loading: false, connected: false });
    }
  };

  const checkJobFolderStatus = async () => {
    try {
      setJobFolderStatus({ loading: true, exists: false, webUrl: null });

      const response = await api.get<{
        job_folder_web_url?: string;
        job_folder_id?: string;
        items?: SharePointFolder[];
      }>(`/api/v1/organization_onedrive/job_folders?job_id=${jobId}`);

      if (response) {
        setJobFolderStatus({
          loading: false,
          exists: true,
          webUrl: response.job_folder_web_url || null,
          jobFolderId: response.job_folder_id,
        });

        const items = response.items || [];
        const folderItems = items.filter((item) => item.folder);
        setFolders(folderItems);
      }
    } catch (err: unknown) {
      // Check both error.status (ApiError) and error.response?.status (legacy)
      const error = err as { status?: number; response?: { status?: number } };
      const status = error.status || error.response?.status;

      if (status === 404) {
        // Expected: folder doesn't exist yet - not an error to log
        setJobFolderStatus({ loading: false, exists: false, webUrl: null });
      } else {
        // Unexpected error - log it
        console.error("Failed to check job folder status:", err);
        setJobFolderStatus({ loading: false, exists: false, webUrl: null });
      }
    }
  };

  const loadDocumentCategories = async () => {
    try {
      let categories: DocumentCategory[];

      // SSoT: Use prop categories if provided (from useEntityTabs in parent)
      // This eliminates duplicate API calls and ensures consistency
      if (propCategories && propCategories.length > 0) {
        console.log('[JobDocumentsTab] Using prop categories (SSoT):', propCategories.length);
        categories = propCategories;
      } else {
        // Fallback to API for standalone usage (e.g., Documents tab)
        console.log('[JobDocumentsTab] Loading documentation_tabs from API for job:', jobId);
        const response = await api.get<DocumentCategory[]>(`/api/v1/jobs/${jobId}/documentation_tabs`);
        categories = response || [];
      }

      console.log('[JobDocumentsTab] Categories:', categories.length, categories.map(c => ({
        id: c.id,
        tab_key: c.tab_key,
        name: c.name,
        is_photo_category: c.is_photo_category,
        children: c.children?.map(ch => ({ id: ch.id, tab_key: ch.tab_key, name: ch.name, is_photo_category: ch.is_photo_category }))
      })));
      setDocumentCategories(categories);

      if (categories.length > 0) {
        // If initialCategory is provided, ALWAYS try to find and select it
        // This handles both first load AND tab switching (when initialCategory changes)
        if (initialCategory) {
          // SSoT: Support composite keys (parent__child) to disambiguate same-named categories
          // e.g., "photo__site" means find "site" child under "photo" parent specifically
          // Without composite key, "site" could match document Site OR photo Site
          const isCompositeKey = initialCategory.includes("__");
          let parentKey: string | null = null;
          let childKey: string = initialCategory;

          if (isCompositeKey) {
            const [p, c] = initialCategory.split("__");
            parentKey = p;
            childKey = c;
          }

          console.log("[JobDocumentsTab] Category lookup:", {
            initialCategory,
            isCompositeKey,
            parentKey,
            childKey,
          });

          // SSoT: Match by tab_key directly (e.g., "supervisor-photo")
          // No name conversion needed - tab_key is the unique identifier
          let foundMatch = false;

          for (const parent of categories) {
            // If composite key provided, only search within the specified parent
            if (parentKey && parent.tab_key !== parentKey) {
              continue;
            }

            if (parent.children && parent.children.length > 0) {
              const matchingChild = parent.children.find(
                (child) => child.tab_key === childKey
              );
              if (matchingChild) {
                console.log("[JobDocumentsTab] Found matching child:", {
                  parent: parent.tab_key,
                  child: matchingChild.tab_key,
                  is_photo_category: matchingChild.is_photo_category,
                });
                // Set flag BEFORE setting state to prevent useEffect from overwriting
                initialCategoryAppliedRef.current = true;
                setSelectedCategory(parent);
                setSelectedSubCategory(matchingChild);
                foundMatch = true;
                return;
              }
            }
            // Also check if the parent itself matches (only if no composite key)
            if (!parentKey && parent.tab_key === childKey) {
              console.log("[JobDocumentsTab] Found matching parent:", {
                parent: parent.tab_key,
                is_photo_category: parent.is_photo_category,
              });
              setSelectedCategory(parent);
              foundMatch = true;
              return;
            }
          }

          // SSoT FALLBACK: Categories may be passed as a flat list (already children)
          // This happens when job page passes parent.children directly
          // In this case, match childKey against the flat list
          if (!foundMatch && isCompositeKey) {
            const matchingCategory = categories.find(
              (cat) => cat.tab_key === childKey
            );
            if (matchingCategory) {
              console.log("[JobDocumentsTab] Found matching category (flat list):", {
                tab_key: matchingCategory.tab_key,
                name: matchingCategory.name,
                is_photo_category: matchingCategory.is_photo_category,
              });
              initialCategoryAppliedRef.current = true;
              setSelectedCategory(matchingCategory);
              return;
            }
          }
        }
        // Default to first category only if no initialCategory provided AND no selection yet
        if (!selectedCategory) {
          setSelectedCategory(categories[0]);
        }
      }
    } catch (err) {
      console.error("[JobDocumentsTab] Failed to load document categories:", err);
      console.error("[JobDocumentsTab] Error details:", JSON.stringify(err, null, 2));
    }
  };

  const loadDocumentTasks = async (categoryId: number) => {
    try {
      setLoadingTasks(true);
      const response = await api.get<{ tasks: DocumentTask[] }>(
        `/api/v1/jobs/${jobId}/document_tasks?category=${categoryId}`
      );
      setTasks(response?.tasks || []);
    } catch (err) {
      console.error("Failed to load document tasks:", err);
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleCreateFolders = async () => {
    try {
      setCreatingFolders(true);
      setError(null);
      setMessage(null);

      const response = await api.post<{ message?: string }>(
        `/api/v1/organization_onedrive/create_job_folders?job_id=${jobId}`
      );

      setMessage({
        type: "success",
        text: response?.message || "Folder structure created successfully!",
      });

      await checkJobFolderStatus();
    } catch (err) {
      console.error("Failed to create folders:", err);
      setError("Failed to create folder structure");
    } finally {
      setCreatingFolders(false);
    }
  };

  const handleUpload = (folderId: string) => {
    setUploadFolderId(folderId);
    fileInputRef.current?.click();
  };

  const loadFolderContents = async (folderId: string, folderName: string, webUrl?: string) => {
    try {
      setLoadingContents(true);
      const response = await api.get<{ items: SharePointItem[] }>(
        `/api/v1/organization_onedrive/folder_contents?folder_id=${folderId}&job_id=${jobId}`
      );

      setFolderContents(response?.items || []);
      setCurrentFolderId(folderId);
      setFolderPath((prev) => [...prev, { id: folderId, name: folderName, webUrl }]);
    } catch (err) {
      console.error("Failed to load folder contents:", err);
      setError("Failed to load folder contents");
    } finally {
      setLoadingContents(false);
    }
  };

  const navigateBack = () => {
    if (folderPath.length <= 1) {
      // Go back to folder list
      setCurrentFolderId(null);
      setFolderPath([]);
      setFolderContents([]);
    } else {
      // Go up one level
      const newPath = folderPath.slice(0, -2);
      const parentFolder = folderPath[folderPath.length - 2];
      setFolderPath(newPath);
      loadFolderContents(parentFolder.id, parentFolder.name, parentFolder.webUrl);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ULTRA MASTERPIECE: Direct browser-to-SharePoint file upload
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadFolderId) return;

    try {
      // Direct upload to SharePoint (skips backend proxy!)
      const result = await uploadToSharePointDirect(file, {
        jobId,
        folderId: uploadFolderId,
        filename: file.name,
        onProgress: (progress: UploadProgress) => {
          console.log(`[DirectUpload] ${progress.status}: ${progress.percentage}%`);
        },
      });

      if (result.success) {
        setMessage({ type: "success", text: `File "${file.name}" uploaded successfully!` });
        await checkJobFolderStatus();
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (err) {
      console.error("Failed to upload file:", err);
      setError("Failed to upload file");
    } finally {
      setUploadFolderId(null);
      if (event.target) event.target.value = "";
    }
  };

  const handleTaskUpload = async (taskId: number, file: File) => {
    try {
      setUploading(taskId);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("task_id", String(taskId));
      formData.append("construction_id", String(jobId));
      formData.append("category", String(selectedCategory?.id));

      const response = await api.postFormData<{ document_url: string; uploaded_at: string }>(
        `/api/v1/jobs/${jobId}/document_tasks/${taskId}/upload`,
        formData
      );

      if (response) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, has_document: true, document_url: response.document_url, uploaded_at: response.uploaded_at }
              : task
          )
        );
      }
    } catch (err) {
      console.error("Failed to upload document:", err);
      setError("Failed to upload document");
    } finally {
      setUploading(null);
    }
  };

  const handleValidate = async (taskId: number) => {
    try {
      const response = await api.post<{ validated_at: string; validated_by: string }>(
        `/api/v1/jobs/${jobId}/document_tasks/${taskId}/validate`
      );

      if (response) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, is_validated: true, validated_at: response.validated_at, validated_by: response.validated_by }
              : task
          )
        );
      }
    } catch (err) {
      console.error("Failed to validate document:", err);
    }
  };

  // Load legacy files from the old SharePoint folder
  // Always loads recursively to get ALL files from all subfolders
  const loadLegacyFiles = async () => {
    try {
      setLoadingLegacy(true);
      setError(null);
      // Always request recursive=true to get all files from all subfolders
      const url = `/api/v1/organization_onedrive/legacy_files?job_id=${jobId}&recursive=true`;
      console.log('[Legacy Import] Fetching:', url);

      const response = await api.get<{
        success: boolean;
        items: LegacyItem[];
        count: number;
        source_folder: string;
        recursive: boolean;
        error?: string;
      }>(url);

      console.log('[Legacy Import] Response:', response);

      if (response?.success) {
        console.log('[Legacy Import] Found', response.items?.length || 0, 'files');
        setLegacyItems(response.items || []);
        setSelectedLegacyFiles([]);
      } else {
        console.error('[Legacy Import] API returned error:', response?.error || 'Unknown error');
        setError(response?.error || 'Failed to load legacy files');
        setLegacyItems([]);
      }
    } catch (err) {
      console.error("[Legacy Import] Exception:", err);
      setError(err instanceof Error ? err.message : 'Failed to load legacy files');
      setLegacyItems([]);
    } finally {
      setLoadingLegacy(false);
    }
  };


  // Import selected legacy files to the job folder
  const handleImportLegacy = async () => {
    if (selectedLegacyFiles.length === 0) return;

    try {
      setImporting(true);
      setError(null);

      const response = await api.post<{
        success: boolean;
        message: string;
        imported: { file_id: string; name: string; category: string }[];
        errors: { file_id: string; error: string }[];
      }>("/api/v1/organization_onedrive/import_legacy", {
        job_id: jobId,
        file_ids: selectedLegacyFiles,
      });

      if (response?.success) {
        setMessage({
          type: "success",
          text: response.message || `Imported ${response.imported?.length || 0} files successfully!`,
        });
        setShowImportModal(false);
        setSelectedLegacyFiles([]);
        // Refresh the folder list
        await checkJobFolderStatus();
      } else {
        setError(response?.errors?.map((e) => e.error).join(", ") || "Import failed");
      }
    } catch (err) {
      console.error("Failed to import legacy files:", err);
      setError("Failed to import files. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  // Open import modal and load files
  const openImportModal = async () => {
    setShowImportModal(true);
    await loadLegacyFiles();
  };

  // Toggle file selection (files only, not folders)
  const toggleFileSelection = useCallback((fileId: string) => {
    console.log('[Legacy Import] toggleFileSelection called with:', fileId);
    setSelectedLegacyFiles((prev) => {
      const newSelection = prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId];
      console.log('[Legacy Import] Selection updated:', newSelection.length, 'files');
      return newSelection;
    });
  }, []);

  // Select all files (only files, not folders)
  const selectAllFiles = () => {
    // All items are files now (recursive listing returns only files)
    if (selectedLegacyFiles.length === legacyItems.length && legacyItems.length > 0) {
      setSelectedLegacyFiles([]);
    } else {
      setSelectedLegacyFiles(legacyItems.map((f) => f.id));
    }
  };

  // Load all files in the job folder (for All Files tab)
  const loadAllFiles = async () => {
    try {
      setLoadingAllFiles(true);
      setError(null);
      const url = `/api/v1/organization_onedrive/job_all_files?job_id=${jobId}`;
      console.log('[All Files] Fetching:', url);

      const response = await api.get<{
        success: boolean;
        items: LegacyItem[];
        count: number;
        job_folder_web_url?: string;
        ai_stats?: AIStats;
        error?: string;
      }>(url);

      console.log('[All Files] Response:', response);

      if (response?.success) {
        console.log('[All Files] Found', response.items?.length || 0, 'files');

        // ULTRA FIX: Preserve optimistic items that aren't yet in the API response
        // SharePoint may take a few seconds to index new files, so we keep optimistic
        // items until they appear in the real data (matched by filename)
        setAllFiles(prev => {
          const newItems = response.items || [];
          const newItemNames = new Set(newItems.map(item => item.name.toLowerCase()));

          // Keep optimistic items (id starts with 'optimistic_') that aren't yet in response
          const preservedOptimistic = prev.filter(item =>
            item.id.startsWith('optimistic_') &&
            !newItemNames.has(item.name.toLowerCase())
          );

          if (preservedOptimistic.length > 0) {
            console.log('[All Files] Preserving', preservedOptimistic.length, 'optimistic items');
          }

          return [...newItems, ...preservedOptimistic];
        });
        setAllFilesJobFolderUrl(response.job_folder_web_url || null);
        setAiStats(response.ai_stats || null);
      } else {
        console.log('[All Files] No job folder or empty:', response?.error);
        setAllFiles([]);
        setAllFilesJobFolderUrl(null);
        setAiStats(null);
      }
    } catch (err) {
      console.error("[All Files] Exception:", err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setAllFiles([]);
    } finally {
      setLoadingAllFiles(false);
    }
  };

  // Trigger AI analysis for documents
  const handleAnalyzeDocuments = async () => {
    try {
      setAnalyzingDocs(true);
      setError(null);

      const response = await api.post<{
        success: boolean;
        message: string;
        queued_count?: number;
        total_unanalyzed?: number;
      }>(`/api/v1/organization_onedrive/analyze_job_documents`, {
        job_id: jobId,
        limit: 25,
      });

      if (response?.success) {
        setMessage({ type: "success", text: response.message });
        // Refresh after a short delay to see updated data
        setTimeout(loadAllFiles, 2000);
      }
    } catch (err) {
      console.error("Failed to start AI analysis:", err);
      setError("Failed to start AI analysis");
    } finally {
      setAnalyzingDocs(false);
    }
  };

  // Approve or reject a document rename
  const handleApproveRename = async (documentId: number, action: "approve" | "reject") => {
    try {
      setApprovingDoc(documentId);
      setError(null);

      const response = await api.post<{
        success: boolean;
        message: string;
        new_name?: string;
      }>(`/api/v1/organization_onedrive/approve_document_rename`, {
        document_id: documentId,
        action,
      });

      if (response?.success) {
        setMessage({ type: "success", text: response.message });
        // Update the local state
        setAllFiles(prev => prev.map(f =>
          f.document_id === documentId
            ? { ...f, rename_status: action === "approve" ? "completed" : "rejected", name: response.new_name || f.name }
            : f
        ));
        // Update AI stats
        if (aiStats) {
          setAiStats({
            ...aiStats,
            pending_review: aiStats.pending_review - 1,
            [action === "approve" ? "approved" : "rejected"]: (aiStats[action === "approve" ? "approved" : "rejected"] || 0) + 1,
          });
        }
      }
    } catch (err) {
      console.error("Failed to approve/reject rename:", err);
      setError("Failed to process rename action");
    } finally {
      setApprovingDoc(null);
    }
  };

  // Bulk categorize documents based on folder paths (for client onboarding)
  // force=true will re-categorize ALL documents, fixing wrong assignments
  const handleBulkCategorize = async (dryRun: boolean = false, force: boolean = false) => {
    try {
      setBulkCategorizing(true);
      setCategorizeResult(null);
      setError(null);

      const response = await api.post<{
        success: boolean;
        dry_run: boolean;
        stats: { total: number; categorized: number; skipped: number; failed: number; recategorized: number };
        details: Array<{ id: number; file_name: string; folder_path?: string; status: string; document_type?: string; entity_tab?: string; reason?: string; old_type?: string }>;
      }>(`/api/v1/organization_onedrive/bulk_categorize_job_documents`, {
        job_id: jobId,
        dry_run: dryRun,
        force: force,
      });

      if (response?.success) {
        setCategorizeResult(response);
        setCategorizeFilter("all");  // Reset filter when opening dialog
        setShowCategorizeSummary(true);

        const totalChanged = (response.stats.categorized || 0) + (response.stats.recategorized || 0);
        if (!dryRun && totalChanged > 0) {
          setMessage({ type: "success", text: `Categorized ${totalChanged} documents` });
          // Refresh file list to show updated data
          setTimeout(loadAllFiles, 1000);
        }
      }
    } catch (err) {
      console.error("Failed to bulk categorize documents:", err);
      setError("Failed to categorize documents");
    } finally {
      setBulkCategorizing(false);
    }
  };

  // Load all files when viewing any document tab (tasks view) or All Files tab
  // This provides real data for both photo galleries and document lists
  // Use a ref to prevent duplicate in-flight requests
  const loadAllFilesInFlightRef = useRef(false);

  useEffect(() => {
    // Load files for: All Files tab, Document Tasks view (any category)
    const needsFiles = viewMode === "allfiles" || viewMode === "tasks";

    if (orgStatus.connected && needsFiles) {
      // Prevent duplicate requests if one is already in flight
      if (loadAllFilesInFlightRef.current) {
        return;
      }
      loadAllFilesInFlightRef.current = true;
      loadAllFiles().finally(() => {
        loadAllFilesInFlightRef.current = false;
      });
    }
  }, [viewMode, orgStatus.connected, selectedCategory, selectedSubCategory]);

  const getStatusBadge = (task: DocumentTask) => {
    if (task.is_validated) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" />Validated</Badge>;
    }
    if (task.has_document) {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Paperclip className="h-3 w-3 mr-1" />Attached</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  // Document Tasks View
  const renderTasksView = () => {
    const activeCategory = selectedSubCategory || selectedCategory;
    const photoCheck = isPhotoCategory(activeCategory);
    console.log('[JobDocumentsTab] DEBUG:', {
      viewMode,
      activeCategory: activeCategory?.name,
      isPhotoCategory: photoCheck,
      is_photo_category_flag: activeCategory?.is_photo_category,
      orgStatusConnected: orgStatus.connected,
    });

    if (documentCategories.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No documentation categories found.</p>
            <p className="text-sm text-muted-foreground mt-1">Please create categories in Settings.</p>
          </CardContent>
        </Card>
      );
    }

    // activeCategory already declared in debug block above

    return (
      <div className="space-y-4">
        {/* Main Tabs (Parent Categories) - HIDE when initialCategory is set (job page handles navigation) */}
        {!initialCategory && (
          <Tabs
            value={String(selectedCategory?.id)}
            onValueChange={(val) => {
              const cat = documentCategories.find((c) => String(c.id) === val);
              if (cat) setSelectedCategory(cat);
            }}
          >
            <TabsList className="w-full justify-start overflow-x-auto bg-muted/50 p-1">
              {documentCategories.map((cat) => (
                <TabsTrigger
                  key={cat.id}
                  value={String(cat.id)}
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Sub Tabs (Child Categories) - HIDE when initialCategory is set (job page handles navigation) */}
        {!initialCategory && selectedCategory?.children && selectedCategory.children.length > 0 && (
          <Tabs
            value={String(selectedSubCategory?.id)}
            onValueChange={(val) => {
              const subCat = selectedCategory.children?.find((c) => String(c.id) === val);
              if (subCat) setSelectedSubCategory(subCat);
            }}
          >
            <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap gap-1 bg-transparent p-0">
              {selectedCategory.children.map((subCat) => {
                // Check if this sub-tab matches the initialCategory
                const isActiveByInitial = initialCategory && subCat.name &&
                  subCat.name.toLowerCase().replace(/\s+/g, "-") === initialCategory.toLowerCase();
                const isActive = selectedSubCategory?.id === subCat.id || isActiveByInitial;

                return (
                  <TabsTrigger
                    key={subCat.id}
                    value={String(subCat.id)}
                    data-state={isActive ? "active" : "inactive"}
                    className="border border-border bg-muted text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {subCat.name}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        )}

        {/* Content for the active category */}
        {loadingTasks ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={32} className="text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tasks Table */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Folder className="h-5 w-5 text-yellow-500" />
                    {activeCategory?.name}
                    {activeCategory?.folder_path && (
                      <span className="text-xs text-muted-foreground font-normal">
                        ({activeCategory.folder_path})
                      </span>
                    )}
                  </CardTitle>
                  {/* Add Photo and Select buttons - show for photo categories (SSoT: uses is_photo_category flag) */}
                  {isPhotoCategory(activeCategory) && orgStatus.connected && (
                    <div className="flex items-center gap-2">
                      {/* Select button - toggle multi-select mode */}
                      {categoryPhotoItems.length > 0 && (
                        <Button
                          size="sm"
                          variant={selectMode ? "default" : "outline"}
                          onClick={toggleSelectMode}
                        >
                          {selectMode ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Done
                            </>
                          ) : (
                            <>
                              <CheckSquare className="h-4 w-4 mr-2" />
                              Select
                            </>
                          )}
                        </Button>
                      )}
                      {/* Add Photo button */}
                      <div className="relative">
                        <Button
                          size="sm"
                          onClick={() => setShowPhotoOptions(!showPhotoOptions)}
                          disabled={uploadingPhoto}
                        >
                          {uploadingPhoto ? (
                            <>
                              <Spinner size={16} className="mr-2" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Camera className="h-4 w-4 mr-2" />
                              Add Photo
                            </>
                          )}
                        </Button>
                      {/* Dropdown menu for camera/library selection */}
                      {showPhotoOptions && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-background border rounded-md shadow-lg min-w-[180px]">
                          <button
                            className="w-full px-4 py-2.5 text-left hover:bg-muted flex items-center gap-2 text-sm"
                            onClick={() => {
                              cameraInputRef.current?.click();
                              setShowPhotoOptions(false);
                            }}
                          >
                            <Camera className="h-4 w-4" />
                            Take Photo
                          </button>
                          <button
                            className="w-full px-4 py-2.5 text-left hover:bg-muted flex items-center gap-2 text-sm border-t"
                            onClick={() => {
                              photoLibraryInputRef.current?.click();
                              setShowPhotoOptions(false);
                            }}
                          >
                            <ImagePlus className="h-4 w-4" />
                            Choose from Library
                          </button>
                        </div>
                      )}
                      </div>
                      {/* Open in SharePoint button */}
                      {jobFolderStatus.webUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Construct the folder URL by appending category folder_path to job folder URL
                            const baseUrl = jobFolderStatus.webUrl!;
                            const folderPath = activeCategory?.folder_path;
                            const fullUrl = folderPath
                              ? `${baseUrl}/${folderPath.replace(/^\//, "").split("/").map(encodeURIComponent).join("/")}`
                              : baseUrl;
                            window.open(fullUrl, "_blank");
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          SharePoint
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Show Photo Gallery for photo categories (SSoT: uses is_photo_category flag) */}
                {isPhotoCategory(activeCategory) ? (
                  <div className="p-4">
                    {loadingAllFiles ? (
                      <PhotoGallery photos={[]} loading={true} />
                    ) : categoryPhotoItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Camera className="h-12 w-12 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">No photos in this folder yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Use the "Add Photo" button to upload photos
                        </p>
                      </div>
                    ) : (
                      <PhotoGallery
                        photos={categoryPhotoItems}
                        onPhotoClick={selectMode ? undefined : handleCategoryPhotoClick}
                        groupByDate
                        thumbnailSize="lg"
                        selectable={selectMode}
                        selectedIds={selectedPhotoIds}
                        onSelectionChange={setSelectedPhotoIds}
                        onSelectionAction={handleSelectionAction}
                      />
                    )}
                  </div>
                ) : loadingAllFiles ? (
                  <div className="py-12 text-center">
                    <Spinner size={32} className="mx-auto mb-3" />
                    <p className="text-muted-foreground">Loading documents...</p>
                  </div>
                ) : categoryDocumentItems.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No documents in this folder yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload files via SharePoint or the All Files tab
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryDocumentItems.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="flex items-start gap-3">
                              <File className="h-5 w-5 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="font-medium">{doc.name}</p>
                                <p className="text-sm text-muted-foreground">{doc.folder_path}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {doc.ai_suggested_type_name ? (
                              <Badge variant="secondary">{doc.ai_suggested_type_name}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {doc.modified ? new Date(doc.modified).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {(doc.web_url || doc.document_id) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDocument(doc)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              )}
                              {doc.download_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(doc.download_url, "_blank")}
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Download
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Category Photo Lightbox */}
            <ImageLightbox
              photos={categoryPhotoItems}
              initialIndex={categoryLightboxIndex}
              open={categoryLightboxOpen}
              onClose={() => setCategoryLightboxOpen(false)}
              resolveFullUrl={resolveFullUrl}
              showDelete={true}
              onDelete={handleDeletePhoto}
            />
          </div>
        )}
      </div>
    );
  };

  // SharePoint View
  const renderSharePointView = () => {
    if (orgStatus.loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spinner size={32} className="text-muted-foreground" />
        </div>
      );
    }

    if (!orgStatus.connected) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Cloud className="h-16 w-16 text-muted-foreground mx-auto" />
            <h3 className="mt-4 text-lg font-semibold">SharePoint Not Connected</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Your organization hasn't connected SharePoint yet. An admin needs to connect Microsoft 365 in Settings first.
            </p>
            <Button asChild className="mt-6">
              <Link href="/settings/integrations/microsoft">
                <Settings className="h-4 w-4 mr-2" />
                Go to Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!jobFolderStatus.exists) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Folder className="h-16 w-16 text-yellow-500 mx-auto" />
            <h3 className="mt-4 text-lg font-semibold">Create Folder Structure</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Create the folder structure in SharePoint for {jobTitle || "this job"}.
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <Button onClick={handleCreateFolders} disabled={creatingFolders}>
                {creatingFolders ? (
                  <>
                    <Spinner size={16} className="mr-2" />
                    Creating Folders...
                  </>
                ) : (
                  <>
                    <Folder className="h-4 w-4 mr-2" />
                    Create Folder Structure
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={openImportModal}>
                <FolderInput className="h-4 w-4 mr-2" />
                Import from Legacy
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Or import existing documents from the legacy SharePoint folder
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Success header */}
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold">SharePoint Connected</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Job folder found for {jobTitle || "this job"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={openImportModal}>
                  <FolderInput className="h-4 w-4 mr-1" />
                  Import from Legacy
                </Button>
                <Button variant="outline" size="sm" onClick={checkJobFolderStatus}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
                {(folderPath.length > 0 ? folderPath[folderPath.length - 1]?.webUrl : jobFolderStatus.webUrl) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Use current folder's webUrl if inside a subfolder, otherwise use job root folder
                      const url = folderPath.length > 0
                        ? folderPath[folderPath.length - 1]?.webUrl
                        : jobFolderStatus.webUrl;
                      if (url) window.open(url, "_blank");
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open in SharePoint
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Folders list or folder contents */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              {currentFolderId ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={navigateBack}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    {folderPath.map((p, i) => (
                      <span key={p.id} className="flex items-center">
                        {i > 0 && <ChevronRight className="h-3 w-3 mx-1" />}
                        <span className={i === folderPath.length - 1 ? "font-medium text-foreground" : ""}>
                          {p.name}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <CardTitle className="text-base">Folder Structure</CardTitle>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingContents ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size={32} className="text-muted-foreground" />
              </div>
            ) : currentFolderId ? (
              // Show folder contents
              folderContents.length > 0 ? (
                <div className="divide-y">
                  {folderContents.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors group ${item.folder ? "cursor-pointer" : ""}`}
                      onClick={() => item.folder && loadFolderContents(item.id, item.name, item.webUrl)}
                    >
                      <div className="flex items-center gap-3">
                        {item.folder ? (
                          <>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            <Folder className="h-5 w-5 text-yellow-500" />
                          </>
                        ) : (
                          <>
                            <div className="w-4" />
                            <File className="h-5 w-5 text-blue-500" />
                          </>
                        )}
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.lastModifiedDateTime && `Modified ${new Date(item.lastModifiedDateTime).toLocaleDateString()}`}
                            {item.size && ` • ${formatFileSize(item.size)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.folder && (
                          <span className="text-xs text-muted-foreground">
                            {item.folder.childCount || 0} items
                          </span>
                        )}
                        {!item.folder && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(item.webUrl, "_blank"); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(item.webUrl, "_blank"); }}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Folder className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">This folder is empty.</p>
                </div>
              )
            ) : (
              // Show top-level folders
              folders.length > 0 ? (
                <div className="divide-y">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors group cursor-pointer"
                      onClick={() => loadFolderContents(folder.id, folder.name, folder.webUrl)}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <Folder className="h-5 w-5 text-yellow-500" />
                        <div>
                          <p className="text-sm font-medium">{folder.name}</p>
                          {folder.lastModifiedDateTime && (
                            <p className="text-xs text-muted-foreground">
                              Modified {new Date(folder.lastModifiedDateTime).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-muted-foreground">
                          {folder.folder?.childCount || 0} items
                        </span>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleUpload(folder.id); }}>
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(folder.webUrl, "_blank"); }}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Folder className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">No folders found. Try refreshing.</p>
                </div>
              )
            )}
          </CardContent>
        </Card>

        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
      </div>
    );
  };

  // All Files View - shows all files in the job folder recursively
  const renderAllFilesView = () => {
    if (orgStatus.loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spinner size={32} className="text-muted-foreground" />
        </div>
      );
    }

    if (!orgStatus.connected) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Cloud className="h-16 w-16 text-muted-foreground mx-auto" />
            <h3 className="mt-4 text-lg font-semibold">SharePoint Not Connected</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Your organization hasn't connected SharePoint yet. An admin needs to connect Microsoft 365 in Settings first.
            </p>
            <Button asChild className="mt-6">
              <Link href="/settings/integrations/microsoft">
                <Settings className="h-4 w-4 mr-2" />
                Go to Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    // Get files with pending AI suggestions
    const filesWithSuggestions = allFiles.filter(
      f => f.ai_analyzed && f.ai_proposed_name && f.rename_status === "pending"
    );

    return (
      <div className="space-y-4">
        {/* Header with refresh and open in SharePoint */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">All Files</h3>
            <span className="text-sm text-muted-foreground">
              {loadingAllFiles ? "Loading..." : `${allFiles.length} files`}
              {allFilesDisplayMode === "gallery" && imagePhotos.length > 0 && (
                <span className="ml-1">({imagePhotos.length} photos)</span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            {/* Table/Gallery Toggle */}
            <div className="flex items-center rounded-md border border-border bg-muted p-0.5">
              <Button
                variant={allFilesDisplayMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setAllFilesDisplayMode("table")}
                className="h-7 px-2"
              >
                <List className="h-4 w-4 mr-1" />
                Table
              </Button>
              <Button
                variant={allFilesDisplayMode === "gallery" ? "default" : "ghost"}
                size="sm"
                onClick={() => setAllFilesDisplayMode("gallery")}
                className="h-7 px-2"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Gallery
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyzeDocuments}
              disabled={analyzingDocs || loadingAllFiles}
            >
              {analyzingDocs ? (
                <Spinner size={16} className="mr-1" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Analyze with AI
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllFiles}
              disabled={loadingAllFiles}
            >
              {loadingAllFiles ? (
                <Spinner size={16} />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Refresh
            </Button>
            {allFilesJobFolderUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(allFilesJobFolderUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in SharePoint
              </Button>
            )}
          </div>
        </div>

        {/* AI Stats */}
        {aiStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Card className="bg-muted/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{aiStats.total}</div>
                <div className="text-xs text-muted-foreground">Total Files</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-950/30">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{aiStats.analyzed}</div>
                <div className="text-xs text-muted-foreground">Analyzed</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 dark:bg-yellow-950/30">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">{aiStats.pending_review}</div>
                <div className="text-xs text-muted-foreground">Pending Review</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-950/30">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{aiStats.approved}</div>
                <div className="text-xs text-muted-foreground">Approved</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{aiStats.unanalyzed}</div>
                <div className="text-xs text-muted-foreground">Unanalyzed</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bulk Categorization Card (for client onboarding) */}
        {aiStats && (
          <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    Bulk Categorize
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {forceRecategorize
                      ? `Re-categorize ALL ${allFiles.length} files based on folder structure`
                      : `Assign document types to ${aiStats.unanalyzed} uncategorized files`
                    }
                  </p>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={forceRecategorize}
                      onCheckedChange={(checked) => setForceRecategorize(checked === true)}
                    />
                    <span className="text-orange-600 dark:text-orange-400">
                      Force re-categorize (fix wrong assignments)
                    </span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkCategorize(true, forceRecategorize)}
                    disabled={bulkCategorizing}
                  >
                    {bulkCategorizing ? <Spinner className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleBulkCategorize(false, forceRecategorize)}
                    disabled={bulkCategorizing}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {bulkCategorizing ? <Spinner className="h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    {forceRecategorize ? "Re-categorize All" : "Categorize All"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Suggested Renames Section */}
        {filesWithSuggestions.length > 0 && (
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-600" />
                AI Suggested Renames ({filesWithSuggestions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {filesWithSuggestions.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-background rounded-lg border"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 text-sm">
                        <File className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <span className="truncate text-muted-foreground">{item.name}</span>
                        <ArrowRight className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                        <span className="truncate font-medium text-foreground">{item.ai_proposed_name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {item.ai_suggested_type_name && (
                          <Badge variant="secondary" className="text-xs">
                            {item.ai_suggested_type_name}
                          </Badge>
                        )}
                        {item.ai_confidence && (
                          <span className={`${item.ai_confidence >= 80 ? "text-green-600" : item.ai_confidence >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                            {item.ai_confidence}% confidence
                          </span>
                        )}
                        {item.folder_path && (
                          <span className="text-blue-600">{item.folder_path}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                        onClick={() => item.document_id && handleApproveRename(item.document_id, "approve")}
                        disabled={approvingDoc === item.document_id}
                        title="Approve rename"
                      >
                        {approvingDoc === item.document_id ? (
                          <Spinner size={16} />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                        onClick={() => item.document_id && handleApproveRename(item.document_id, "reject")}
                        disabled={approvingDoc === item.document_id}
                        title="Reject rename"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filesWithSuggestions.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    And {filesWithSuggestions.length - 10} more suggestions...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Files display - Table or Gallery */}
        {allFilesDisplayMode === "gallery" ? (
          // Gallery View
          <Card>
            <CardContent className="p-4">
              {loadingAllFiles ? (
                <PhotoGallery photos={[]} loading={true} />
              ) : imagePhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <LayoutGrid className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No photos found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {allFiles.length > 0
                      ? `${allFiles.length} files in this folder, but none are images`
                      : "Upload some photos to see them here"}
                  </p>
                </div>
              ) : (
                <PhotoGallery
                  photos={imagePhotos}
                  onPhotoClick={handlePhotoClick}
                  groupByDate
                  thumbnailSize="lg"
                />
              )}
            </CardContent>
          </Card>
        ) : (
          // Table View
          <Card>
            <CardContent className="p-0">
              {loadingAllFiles ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size={32} className="text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Folder</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>AI Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedAllFiles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No files found
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupedAllFiles.map((item) => {
                        const hasChildVersions = (item as any).child_versions_data?.length > 0 || (item.child_versions?.length ?? 0) > 0;
                        const isExpanded = expandedVersionGroups.has(item.id);
                        const versionBadge = getVersionBadge(item.version_status);
                        const childVersions = (item as any).child_versions_data || [];

                        return (
                          <React.Fragment key={item.id}>
                            <TableRow className={item.rename_status === "completed" ? "bg-green-50/50 dark:bg-green-950/20" : ""}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {/* Expand/collapse chevron for versioned documents */}
                                  {hasChildVersions ? (
                                    <button
                                      onClick={() => toggleVersionGroup(item.id)}
                                      className="p-0.5 hover:bg-muted rounded"
                                    >
                                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                    </button>
                                  ) : (
                                    <div className="w-5" /> // Spacer for alignment
                                  )}
                                  <File className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <span className="text-sm truncate block max-w-[300px]">{item.name}</span>
                                    {item.original_name && item.name !== item.original_name && (
                                      <span className="text-xs text-muted-foreground line-through block">{item.original_name}</span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {item.folder_path || "-"}
                                </span>
                              </TableCell>
                              <TableCell>
                                {item.ai_suggested_type_name ? (
                                  <Badge variant="secondary" className="text-xs">
                                    {item.ai_suggested_type_name}
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {versionBadge ? (
                                  <Badge className={versionBadge.className + " text-xs"}>
                                    {versionBadge.label}
                                  </Badge>
                                ) : item.is_versionable ? (
                                  <span className="text-xs text-muted-foreground">-</span>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                {item.rename_status === "completed" ? (
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Renamed
                                  </Badge>
                                ) : item.rename_status === "rejected" ? (
                                  <Badge variant="secondary" className="text-muted-foreground">
                                    Skipped
                                  </Badge>
                                ) : item.ai_analyzed ? (
                                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    Pending
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {(item.web_url || item.document_id) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openDocument(item)}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                            {/* Child version rows (shown when expanded) */}
                            {isExpanded && childVersions.map((child: LegacyItem) => {
                              const childBadge = getVersionBadge(child.version_status);
                              return (
                                <TableRow key={child.id} className="bg-muted/30">
                                  <TableCell>
                                    <div className="flex items-center gap-2 pl-7">
                                      <div className="w-5" /> {/* Indent to align with parent */}
                                      <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      <div className="min-w-0">
                                        <span className="text-sm truncate block max-w-[280px] text-muted-foreground">{child.name}</span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm text-muted-foreground">
                                      {child.folder_path || "-"}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm text-muted-foreground">-</span>
                                  </TableCell>
                                  <TableCell>
                                    {childBadge && (
                                      <Badge className={childBadge.className + " text-xs"}>
                                        {childBadge.label}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm text-muted-foreground">-</span>
                                  </TableCell>
                                  <TableCell>
                                    {(child.web_url || child.document_id) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openDocument(child)}
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </React.Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Image Lightbox */}
        <ImageLightbox
          photos={imagePhotos}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          resolveFullUrl={resolveFullUrl}
          showDelete={true}
          onDelete={handleDeletePhoto}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}
      {message && (
        <Card className={message.type === "info"
          ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
          : "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
        }>
          <CardContent className="p-4 flex items-center gap-2">
            {message.type === "info" ? (
              <Spinner size={20} className="text-blue-600" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
            <p className={message.type === "info"
              ? "text-sm text-blue-700 dark:text-blue-300"
              : "text-sm text-green-700 dark:text-green-300"
            }>{message.text}</p>
          </CardContent>
        </Card>
      )}

      {/* View Mode Toggle - hide for photo categories */}
      {!isPhotoCategory(selectedSubCategory || selectedCategory) && (
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1 w-fit">
          <Button
            variant={viewMode === "tasks" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("tasks")}
          >
            <FileText className="h-4 w-4 mr-2" />
            Document Tasks
          </Button>
          <Button
            variant={viewMode === "sharepoint" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("sharepoint")}
          >
            <Cloud className="h-4 w-4 mr-2" />
            SharePoint Folders
          </Button>
          <Button
            variant={viewMode === "allfiles" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("allfiles")}
          >
            <Folder className="h-4 w-4 mr-2" />
            All Files
          </Button>
        </div>
      )}

      {/* For photo categories, show photo gallery directly */}
      {isPhotoCategory(selectedSubCategory || selectedCategory) ? (
        renderTasksView()
      ) : (
        <>
          {viewMode === "tasks" && renderTasksView()}
          {viewMode === "sharepoint" && renderSharePointView()}
          {viewMode === "allfiles" && renderAllFilesView()}
        </>
      )}

      {/* Import Legacy Files Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="h-5 w-5" />
              Import from Legacy Folder
            </DialogTitle>
            <DialogDescription>
              Select files from the old SharePoint folder to import into this job's folder.
              Files will be automatically categorized and moved.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingLegacy ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size={32} className="text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Searching for files...</span>
              </div>
            ) : legacyItems.length === 0 ? (
              <div className="py-12 text-center">
                <Folder className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="mt-2 text-muted-foreground">No legacy files found for this job.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The old folder structure may not contain files matching this job.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Select All - all files from all subfolders */}
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <Checkbox
                    id="select-all"
                    checked={
                      selectedLegacyFiles.length > 0 &&
                      selectedLegacyFiles.length === legacyItems.length
                    }
                    onCheckedChange={selectAllFiles}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Select All ({legacyItems.length} files)
                  </label>
                </div>

                {/* Files list - flat list with folder paths */}
                <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                  {legacyItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => toggleFileSelection(item.id)}
                    >
                      <Checkbox
                        checked={selectedLegacyFiles.includes(item.id)}
                        onCheckedChange={() => toggleFileSelection(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <File className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.folder_path && (
                            <span className="text-blue-600 dark:text-blue-400">{item.folder_path}/</span>
                          )}
                          {item.size ? formatFileSize(item.size) : ""}
                          {item.modified && ` • Modified ${new Date(item.modified).toLocaleDateString()}`}
                        </p>
                      </div>
                      {(item.web_url || item.document_id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDocument(item);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowImportModal(false)} disabled={importing}>
              Cancel
            </Button>
            <Button
              onClick={handleImportLegacy}
              disabled={importing || selectedLegacyFiles.length === 0}
            >
              {importing ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Import {selectedLegacyFiles.length} {selectedLegacyFiles.length === 1 ? "File" : "Files"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!open && !deleting) {
          setDeleteDialogOpen(false);
          setPhotosToDelete([]);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Delete {photosToDelete.length} Photo{photosToDelete.length > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete {photosToDelete.length === 1 ? "this photo" : "these photos"} from SharePoint. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {photosToDelete.length > 0 && photosToDelete.length <= 5 && (
            <div className="space-y-2 max-h-40 overflow-auto">
              {photosToDelete.map((photo) => (
                <div key={photo.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <File className="h-4 w-4" />
                  <span className="truncate">{photo.name}</span>
                </div>
              ))}
            </div>
          )}
          {photosToDelete.length > 5 && (
            <div className="text-sm text-muted-foreground">
              {photosToDelete.slice(0, 3).map((photo) => (
                <div key={photo.id} className="flex items-center gap-2">
                  <File className="h-4 w-4" />
                  <span className="truncate">{photo.name}</span>
                </div>
              ))}
              <div className="text-muted-foreground mt-1">
                ...and {photosToDelete.length - 3} more
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setPhotosToDelete([]);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={executeDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Deleting...
                </>
              ) : (
                <>Delete</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden inputs for photo capture */}
      {/* Camera input - uses capture="environment" for back camera on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />
      {/* Photo library input - standard file picker for images (supports multi-select) */}
      <input
        ref={photoLibraryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handlePhotoLibrarySelect}
      />

      {/* Click-outside handler for photo options dropdown */}
      {showPhotoOptions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPhotoOptions(false)}
        />
      )}

      {/* Bulk Categorization Summary Dialog */}
      <Dialog open={showCategorizeSummary} onOpenChange={setShowCategorizeSummary}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              {categorizeResult?.dry_run ? "Categorization Preview" : "Categorization Complete"}
            </DialogTitle>
            <DialogDescription>
              {categorizeResult?.dry_run
                ? "Preview of documents that would be categorized based on folder structure"
                : "Documents have been categorized based on folder structure"
              }
            </DialogDescription>
          </DialogHeader>

          {categorizeResult && (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Stats Summary - Clickable to filter */}
              <div className="grid grid-cols-6 gap-2">
                <Card
                  className={`bg-muted/50 cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${categorizeFilter === "all" ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setCategorizeFilter("all")}
                >
                  <CardContent className="p-2 text-center">
                    <div className="text-lg font-bold">{categorizeResult.stats.total}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </CardContent>
                </Card>
                <Card
                  className={`bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 cursor-pointer transition-all hover:ring-2 hover:ring-green-500/50 ${categorizeFilter === "new" ? "ring-2 ring-green-500" : ""}`}
                  onClick={() => setCategorizeFilter("new")}
                >
                  <CardContent className="p-2 text-center">
                    <div className="text-lg font-bold text-green-600">{categorizeResult.stats.categorized || 0}</div>
                    <div className="text-xs text-muted-foreground">
                      {categorizeResult.dry_run ? "New" : "Categorized"}
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className={`bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 cursor-pointer transition-all hover:ring-2 hover:ring-orange-500/50 ${categorizeFilter === "fixed" ? "ring-2 ring-orange-500" : ""}`}
                  onClick={() => setCategorizeFilter("fixed")}
                >
                  <CardContent className="p-2 text-center">
                    <div className="text-lg font-bold text-orange-600">{categorizeResult.stats.recategorized || 0}</div>
                    <div className="text-xs text-muted-foreground">
                      {categorizeResult.dry_run ? "Fix" : "Fixed"}
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className={`bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 cursor-pointer transition-all hover:ring-2 hover:ring-blue-500/50 ${categorizeFilter === "correct" ? "ring-2 ring-blue-500" : ""}`}
                  onClick={() => setCategorizeFilter("correct")}
                >
                  <CardContent className="p-2 text-center">
                    <div className="text-lg font-bold text-blue-600">{categorizeResult.stats.already_correct || 0}</div>
                    <div className="text-xs text-muted-foreground">Correct</div>
                  </CardContent>
                </Card>
                <Card
                  className={`bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 cursor-pointer transition-all hover:ring-2 hover:ring-yellow-500/50 ${categorizeFilter === "skipped" ? "ring-2 ring-yellow-500" : ""}`}
                  onClick={() => setCategorizeFilter("skipped")}
                >
                  <CardContent className="p-2 text-center">
                    <div className="text-lg font-bold text-yellow-600">{categorizeResult.stats.skipped}</div>
                    <div className="text-xs text-muted-foreground">Skipped</div>
                  </CardContent>
                </Card>
                <Card
                  className={`bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 cursor-pointer transition-all hover:ring-2 hover:ring-red-500/50 ${categorizeFilter === "failed" ? "ring-2 ring-red-500" : ""}`}
                  onClick={() => setCategorizeFilter("failed")}
                >
                  <CardContent className="p-2 text-center">
                    <div className="text-lg font-bold text-red-600">{categorizeResult.stats.failed}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </CardContent>
                </Card>
              </div>

              {/* Sample Details */}
              {categorizeResult.details.length > 0 && (() => {
                // Filter results based on selected filter
                const filteredDetails = categorizeResult.details.filter((item) => {
                  if (categorizeFilter === "all") return true;
                  if (categorizeFilter === "new") return item.status === "would_categorize" || item.status === "categorized";
                  if (categorizeFilter === "fixed") return item.status === "would_recategorize" || item.status === "recategorized";
                  if (categorizeFilter === "correct") return item.status === "already_correct";
                  if (categorizeFilter === "skipped") return item.status === "skipped";
                  if (categorizeFilter === "failed") return item.status === "failed";
                  return true;
                });
                // Show all when filtered, limit to 100 when showing all
                const displayLimit = categorizeFilter === "all" ? 100 : filteredDetails.length;
                const displayDetails = filteredDetails.slice(0, displayLimit);

                return (
                <div>
                  <h4 className="font-medium mb-2 text-sm">
                    {categorizeFilter === "all"
                      ? `Sample Results (${Math.min(displayDetails.length, displayLimit)} of ${categorizeResult.details.length})`
                      : `${categorizeFilter.charAt(0).toUpperCase() + categorizeFilter.slice(1)} Results (${filteredDetails.length})`
                    }
                    {categorizeFilter !== "all" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-6 text-xs"
                        onClick={() => setCategorizeFilter("all")}
                      >
                        Show All
                      </Button>
                    )}
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[300px]">File</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Document Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayDetails.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">
                              <div className="truncate max-w-[280px]" title={item.file_name}>
                                {item.file_name}
                              </div>
                              {item.folder_path && (
                                <div className="text-muted-foreground truncate max-w-[280px]" title={item.folder_path}>
                                  {item.folder_path}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.status.includes("categorize") || item.status.includes("recategorize")
                                    ? "default"
                                    : item.status === "already_correct"
                                    ? "default"
                                    : item.status === "skipped"
                                    ? "secondary"
                                    : "destructive"
                                }
                                className={
                                  item.status.includes("recategorize")
                                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
                                    : item.status === "already_correct"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                                    : item.status.includes("categorize")
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                    : ""
                                }
                              >
                                {item.status === "would_categorize" ? "new" :
                                 item.status === "would_recategorize" ? "fix" :
                                 item.status === "recategorized" ? "fixed" :
                                 item.status === "already_correct" ? "correct" : item.status}
                              </Badge>
                              {item.reason && (
                                <span className="ml-2 text-xs text-muted-foreground">({item.reason})</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.document_type ? (
                                <div>
                                  {item.old_type && (
                                    <div className="text-xs text-red-500 line-through">{item.old_type}</div>
                                  )}
                                  <div className="font-medium">{item.document_type}</div>
                                  {item.entity_tab && (
                                    <div className="text-xs text-muted-foreground">{item.entity_tab}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                );
              })()}
            </div>
          )}

          <DialogFooter className="mt-4">
            {categorizeResult?.dry_run ? (
              <>
                <Button variant="outline" onClick={() => setShowCategorizeSummary(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowCategorizeSummary(false);
                    handleBulkCategorize(false, forceRecategorize);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={(categorizeResult.stats.categorized || 0) + (categorizeResult.stats.recategorized || 0) === 0}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {forceRecategorize ? "Re-categorize" : "Categorize"} {(categorizeResult.stats.categorized || 0) + (categorizeResult.stats.recategorized || 0)} Files
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowCategorizeSummary(false)}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JobDocumentsTab;
