"use client";

/**
 * ImageLightbox - Fullscreen image viewer with navigation
 *
 * THE ONE component for viewing images in a lightbox/modal.
 * See: frontend-next/lib/component-registry.ts
 *
 * Features:
 * - Fullscreen overlay
 * - Prev/Next navigation (arrows + keyboard)
 * - Close on Escape or click outside
 * - Photo counter
 * - Filename and date display
 * - Touch swipe support
 * - Authenticated image loading for backend proxy URLs
 *
 * Usage:
 * ```tsx
 * import { ImageLightbox } from "@/components/ui/image-lightbox";
 * import { PhotoItem } from "@/components/ui/photo-gallery";
 *
 * <ImageLightbox
 *   photos={photos}
 *   initialIndex={clickedIndex}
 *   open={lightboxOpen}
 *   onClose={() => setLightboxOpen(false)}
 * />
 * ```
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  ExternalLink,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDateTime } from "@/utils/formatters";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/contexts/ConfirmationContext";
import type { PhotoItem } from "@/components/ui/photo-gallery";
import { Spinner } from "@/components/ui/spinner";

export interface ImageLightboxProps {
  /** Array of photos */
  photos: PhotoItem[];
  /** Starting index */
  initialIndex?: number;
  /** Whether lightbox is open */
  open: boolean;
  /** Callback to close */
  onClose: () => void;
  /** Show download button */
  showDownload?: boolean;
  /** Show open in SharePoint button */
  showOpenExternal?: boolean;
  /** Show delete button */
  showDelete?: boolean;
  /** Optional callback to resolve full-size URL on demand (for SharePoint images) */
  resolveFullUrl?: (photoId: string) => Promise<string | null>;
  /** Optional callback when photo is deleted */
  onDelete?: (photoId: string) => Promise<void>;
}

// Check if URL needs authenticated fetch (backend proxy URLs)
function needsAuthenticatedFetch(url: string): boolean {
  // Backend proxy URLs that require authentication
  return url.includes("/api/v1/documents/download") || url.includes("/api/v1/documents/job_document_download");
}

// Check if URL is already a presigned URL (S3/SharePoint direct)
function isPresignedUrl(url: string): boolean {
  return url.includes("X-Amz-Signature") || url.includes("sharepoint.com/personal") || url.includes("blob.core.windows.net");
}

// Extract document_id from backend proxy URL
function extractDocumentId(url: string): string | null {
  try {
    const urlObj = new URL(url, window.location.origin);
    return urlObj.searchParams.get("document_id");
  } catch {
    return null;
  }
}

// Extract the endpoint path from a full URL for api.getBlob
function getEndpointFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname + urlObj.search;
  } catch {
    // If it's already a path, return as-is
    return url;
  }
}

export function ImageLightbox({
  photos,
  initialIndex = 0,
  open,
  onClose,
  showDownload = true,
  showOpenExternal = true,
  showDelete = false,
  resolveFullUrl,
  onDelete,
}: ImageLightboxProps) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);
  // Cache for resolved full URLs (photoId -> url)
  const [resolvedUrls, setResolvedUrls] = React.useState<Record<string, string>>({});
  const [resolving, setResolving] = React.useState(false);
  // Track which resolved URLs have failed (to fall back to proxy)
  const [failedUrls, setFailedUrls] = React.useState<Set<string>>(new Set());
  // Cache for authenticated blob URLs (photoId -> object URL)
  const [blobUrls, setBlobUrls] = React.useState<Record<string, string>>({});
  // Cache for presigned URLs (photoId -> presigned URL)
  const [presignedUrls, setPresignedUrls] = React.useState<Record<string, string>>({});
  // Track URLs currently being fetched
  const fetchingRef = React.useRef<Set<string>>(new Set());
  // Ref for cleanup to avoid stale closure issue
  const blobUrlsRef = React.useRef<Record<string, string>>({});
  // Track delete in progress
  const [deleting, setDeleting] = React.useState(false);

  // Resolve full URL for current photo
  const resolveCurrentPhotoUrl = React.useCallback(async () => {
    const photo = photos[currentIndex];
    if (!photo || !resolveFullUrl) return;

    // Already have a resolved URL for this photo
    if (resolvedUrls[photo.id]) return;

    setResolving(true);
    try {
      const fullUrl = await resolveFullUrl(photo.id);
      if (fullUrl) {
        setResolvedUrls((prev) => ({ ...prev, [photo.id]: fullUrl }));
      }
    } catch (err) {
      console.error("Failed to resolve full URL:", err);
    } finally {
      setResolving(false);
    }
  }, [currentIndex, photos, resolveFullUrl, resolvedUrls]);

  // Reset index when opening with new initialIndex
  React.useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setLoading(true);
      setError(false);
    }
  }, [open, initialIndex]);

  // Resolve URL when photo changes
  React.useEffect(() => {
    if (open && resolveFullUrl) {
      resolveCurrentPhotoUrl();
    }
  }, [open, currentIndex, resolveFullUrl, resolveCurrentPhotoUrl]);

  // Fetch presigned URL for a photo (used by current image fetch and prefetch)
  const fetchPresignedUrl = React.useCallback(async (photo: PhotoItem): Promise<string | null> => {
    // If URL is already a presigned URL or external URL, use directly
    if (isPresignedUrl(photo.url) || !needsAuthenticatedFetch(photo.url)) {
      return photo.url;
    }

    // Already have a presigned URL cached
    if (presignedUrls[photo.id]) {
      return presignedUrls[photo.id];
    }

    // Extract document_id from the proxy URL
    const documentId = extractDocumentId(photo.url);
    if (!documentId) {
      console.warn("[ImageLightbox] No document_id in URL, falling back to proxy");
      return null;
    }

    try {
      // Get presigned URL from backend (SSoT: same endpoint as PDF viewer)
      const response = await api.get(`/api/v1/documents/presigned_url?document_id=${documentId}`) as {
        success?: boolean;
        url?: string;
        error?: string;
      };

      if (response.success && response.url) {
        // Cache the presigned URL
        setPresignedUrls((prev) => ({ ...prev, [photo.id]: response.url as string }));
        return response.url;
      }
    } catch (err) {
      console.warn("[ImageLightbox] Presigned URL failed, will use proxy:", err);
    }

    return null;
  }, [presignedUrls]);

  // Fetch authenticated image for current photo
  React.useEffect(() => {
    if (!open) return;

    const photo = photos[currentIndex];
    if (!photo) return;

    // Determine which URL to use
    const resolvedUrl = resolvedUrls[photo.id];
    const hasFailed = failedUrls.has(photo.id);
    const cachedPresignedUrl = presignedUrls[photo.id];

    // Priority: presigned URL > resolved URL > photo.url
    const urlToUse = cachedPresignedUrl || ((resolvedUrl && !hasFailed) ? resolvedUrl : photo.url);

    // Skip if we already have a blob URL for this photo
    if (blobUrls[photo.id]) return;

    // Skip if URL doesn't need auth (and we have no presigned URL to try)
    if (!needsAuthenticatedFetch(urlToUse) && !cachedPresignedUrl) {
      // URL is already external/direct, just let the img tag load it
      return;
    }

    // Skip if already fetching
    if (fetchingRef.current.has(photo.id)) return;

    // Mark as fetching
    fetchingRef.current.add(photo.id);
    setLoading(true);

    const fetchImage = async () => {
      try {
        // Step 1: Try to get a presigned URL (fast path - no double transfer!)
        const presignedUrl = await fetchPresignedUrl(photo);

        if (presignedUrl) {
          // SSoT: Use presigned URL directly - browser fetches from S3/SharePoint
          // This avoids the double transfer (S3 → Rails → Browser)
          setBlobUrls((prev) => ({ ...prev, [photo.id]: presignedUrl }));
          setLoading(false);
          return;
        }

        // Step 2: Fall back to api.getBlob() proxy (slow path)
        console.log("[ImageLightbox] Using proxy fallback for:", photo.name);
        const endpoint = getEndpointFromUrl(urlToUse);
        const blob = await api.getBlob(endpoint, { skipAuthRedirect: true });
        const objectUrl = URL.createObjectURL(blob);
        setBlobUrls((prev) => ({ ...prev, [photo.id]: objectUrl }));
        setLoading(false);
      } catch (err) {
        console.error("[ImageLightbox] Failed to fetch image:", err);
        setLoading(false);
        setError(true);
      } finally {
        fetchingRef.current.delete(photo.id);
      }
    };

    fetchImage();
  }, [open, currentIndex, photos, resolvedUrls, failedUrls, blobUrls, presignedUrls, fetchPresignedUrl]);

  // Prefetch adjacent images when lightbox is open
  React.useEffect(() => {
    if (!open || photos.length <= 1) return;

    const prefetchImage = async (index: number) => {
      const photo = photos[index];
      if (!photo) return;

      // Skip if already have URL cached
      if (blobUrls[photo.id] || presignedUrls[photo.id]) return;

      // Skip if already fetching
      if (fetchingRef.current.has(photo.id)) return;

      // Try to get presigned URL (don't block on this)
      fetchPresignedUrl(photo).catch(() => {
        // Silent fail for prefetch
      });
    };

    // Prefetch prev and next images
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
    const nextIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;

    // Use setTimeout to not block the current image load
    const timeoutId = setTimeout(() => {
      prefetchImage(prevIndex);
      prefetchImage(nextIndex);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [open, currentIndex, photos, blobUrls, presignedUrls, fetchPresignedUrl]);

  // Keep ref in sync with state for cleanup
  React.useEffect(() => {
    blobUrlsRef.current = blobUrls;
  }, [blobUrls]);

  // Cleanup blob URLs when component unmounts
  React.useEffect(() => {
    return () => {
      Object.values(blobUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          goToPrev();
          break;
        case "ArrowRight":
          goToNext();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, photos.length]);

  // Lock body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const currentPhoto = photos[currentIndex];

  // Determine the URL to display
  // Priority: 1) blobUrls (presigned URL or object URL), 2) resolved URL, 3) photo.url
  const currentImageUrl = React.useMemo(() => {
    if (!currentPhoto) return "";

    // If we have a cached URL (presigned or blob object URL), use it
    if (blobUrls[currentPhoto.id]) {
      return blobUrls[currentPhoto.id];
    }

    // If we have a presigned URL cached (not yet in blobUrls), use it
    if (presignedUrls[currentPhoto.id]) {
      return presignedUrls[currentPhoto.id];
    }

    // If we have a resolved URL that hasn't failed, use it (but it may fail due to CORS)
    if (resolvedUrls[currentPhoto.id] && !failedUrls.has(currentPhoto.id)) {
      return resolvedUrls[currentPhoto.id];
    }

    // Fall back to photo.url (may be a proxy URL that needs auth fetch)
    return currentPhoto.url;
  }, [currentPhoto, blobUrls, presignedUrls, resolvedUrls, failedUrls]);

  const goToPrev = () => {
    setLoading(true);
    setError(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const goToNext = () => {
    setLoading(true);
    setError(false);
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  // Touch swipe handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrev();
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Handle download
  const handleDownload = async () => {
    if (!currentPhoto) return;

    try {
      let blob: Blob;
      let downloadUrl: string | null = null;

      // Priority: Use presigned URL if available (fast path)
      if (presignedUrls[currentPhoto.id]) {
        downloadUrl = presignedUrls[currentPhoto.id];
      } else if (needsAuthenticatedFetch(currentPhoto.url)) {
        // Try to get a presigned URL for download
        downloadUrl = await fetchPresignedUrl(currentPhoto);
      }

      if (downloadUrl && isPresignedUrl(downloadUrl)) {
        // Fast path: Fetch directly from presigned URL
        const response = await fetch(downloadUrl);
        blob = await response.blob();
      } else if (needsAuthenticatedFetch(currentPhoto.url)) {
        // Fallback: Use authenticated fetch through backend proxy
        const endpoint = getEndpointFromUrl(currentPhoto.url);
        blob = await api.getBlob(endpoint, { skipAuthRedirect: true });
      } else {
        const response = await fetch(currentPhoto.url);
        blob = await response.blob();
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = currentPhoto.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download image:", err);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!currentPhoto || !onDelete) return;

    const confirmDelete = await confirm({
      title: "Delete Image",
      description: `Are you sure you want to delete "${currentPhoto.name}"? This will permanently delete the file from SharePoint.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });

    if (!confirmDelete) return;

    setDeleting(true);
    try {
      await onDelete(currentPhoto.id);
      // If this was the last photo, close the lightbox
      if (photos.length <= 1) {
        onClose();
      } else {
        // Move to next photo (or previous if at end)
        if (currentIndex >= photos.length - 1) {
          setCurrentIndex(Math.max(0, currentIndex - 1));
        }
        // The parent component should update the photos array
      }
    } catch (err) {
      console.error("Failed to delete image:", err);
      toast({ title: "Error", description: "Failed to delete the image. Please try again.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (!open || !currentPhoto) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 shrink-0">
        {/* Photo info */}
        <div className="text-white">
          <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-md">
            {currentPhoto.name}
          </p>
          <p className="text-xs text-white/60">
            {currentIndex + 1} of {photos.length}
            {currentPhoto.createdAt && (
              <span className="ml-2">
                {formatDateTime(currentPhoto.createdAt)}
              </span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {showDownload && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="text-white hover:bg-white/10"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </Button>
          )}
          {showOpenExternal && currentPhoto.webUrl && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(currentPhoto.webUrl, "_blank")}
              className="text-white hover:bg-white/10"
              title="Open in Cloud Storage"
            >
              <ExternalLink className="h-5 w-5" />
            </Button>
          )}
          {showDelete && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={deleting}
              className="text-white hover:bg-red-500/20 hover:text-red-400"
              title="Delete photo"
            >
              {deleting ? (
                <Spinner />
              ) : (
                <Trash2 className="h-5 w-5" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
            title="Close (Esc)"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Main image area */}
      <div
        className="flex-1 flex items-center justify-center relative min-h-0 p-4"
        onClick={(e) => {
          // Close on background click
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {/* Previous button */}
        {photos.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrev}
            className={cn(
              "absolute left-2 sm:left-4 z-10",
              "h-10 w-10 sm:h-12 sm:w-12",
              "text-white hover:bg-white/10 rounded-full",
              "transition-opacity"
            )}
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
          </Button>
        )}

        {/* Image container */}
        <div className="relative max-h-full max-w-full flex items-center justify-center">
          {/* Loading spinner */}
          {(loading || resolving) && (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
              <Spinner size={40} className="text-white" />
              <p className="text-white/60 text-sm">
                {resolving ? "Loading full image..." : "Fetching image..."}
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center justify-center text-white/60">
              <ImageIcon className="h-16 w-16 mb-2" />
              <p>Failed to load image</p>
            </div>
          )}

          {/* Image */}
          {!error && (
            <img
              key={currentPhoto.id + (blobUrls[currentPhoto.id] ? "-blob" : resolvedUrls[currentPhoto.id] && !failedUrls.has(currentPhoto.id) ? "-resolved" : "")}
              src={currentImageUrl}
              alt={currentPhoto.name}
              onLoad={() => setLoading(false)}
              onError={() => {
                // If using a blob URL, it shouldn't fail (local object URL)
                if (blobUrls[currentPhoto.id]) {
                  console.error("[ImageLightbox] Blob URL failed unexpectedly");
                  setLoading(false);
                  setError(true);
                  return;
                }

                // If we tried the resolved URL (SharePoint direct) and it failed (CORS),
                // mark it as failed so we trigger the authenticated fetch
                if (currentPhoto && resolvedUrls[currentPhoto.id] && !failedUrls.has(currentPhoto.id)) {
                  console.log("[ImageLightbox] SharePoint URL failed (CORS), triggering auth fetch");
                  setFailedUrls((prev) => new Set(prev).add(currentPhoto.id));
                  setLoading(true); // Will trigger authenticated fetch via useEffect
                } else if (needsAuthenticatedFetch(currentPhoto.url)) {
                  // URL needs auth but we're here from img tag - wait for blob fetch
                  // This shouldn't happen if the useEffect is working correctly
                  console.log("[ImageLightbox] Waiting for authenticated fetch...");
                  setLoading(true);
                } else {
                  // External URL failed and doesn't need our auth
                  setLoading(false);
                  setError(true);
                }
              }}
              className={cn(
                "max-h-[calc(100vh-180px)] max-w-full object-contain",
                "transition-opacity duration-300",
                loading || resolving ? "opacity-0" : "opacity-100"
              )}
            />
          )}
        </div>

        {/* Next button */}
        {photos.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            className={cn(
              "absolute right-2 sm:right-4 z-10",
              "h-10 w-10 sm:h-12 sm:w-12",
              "text-white hover:bg-white/10 rounded-full",
              "transition-opacity"
            )}
            title="Next (Right Arrow)"
          >
            <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
          </Button>
        )}
      </div>

      {/* Thumbnail strip (for more than a few photos) */}
      {photos.length > 1 && photos.length <= 20 && (
        <div className="p-2 overflow-x-auto shrink-0">
          <div className="flex gap-1 justify-center">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                onClick={() => {
                  setLoading(true);
                  setError(false);
                  setCurrentIndex(index);
                }}
                className={cn(
                  "h-12 w-12 rounded-none overflow-hidden border-2 shrink-0",
                  "transition-all duration-200",
                  index === currentIndex
                    ? "border-white ring-1 ring-white"
                    : "border-transparent opacity-50 hover:opacity-80"
                )}
              >
                <img
                  src={photo.thumbnailUrl || photo.url}
                  alt={photo.name}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation dots (for many photos) */}
      {photos.length > 20 && (
        <div className="p-4 flex justify-center gap-1 shrink-0">
          {/* Show subset of dots */}
          <span className="text-white/60 text-sm">
            {currentIndex + 1} / {photos.length}
          </span>
        </div>
      )}
    </div>
  );
}

export default ImageLightbox;
