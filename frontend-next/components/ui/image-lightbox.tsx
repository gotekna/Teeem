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
  Loader2,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PhotoItem } from "@/components/ui/photo-gallery";

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
  /** Optional callback to resolve full-size URL on demand (for SharePoint images) */
  resolveFullUrl?: (photoId: string) => Promise<string | null>;
}

// Format date for display
function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ImageLightbox({
  photos,
  initialIndex = 0,
  open,
  onClose,
  showDownload = true,
  showOpenExternal = true,
  resolveFullUrl,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [touchStart, setTouchStart] = React.useState<number | null>(null);
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null);
  // Cache for resolved full URLs (photoId -> url)
  const [resolvedUrls, setResolvedUrls] = React.useState<Record<string, string>>({});
  const [resolving, setResolving] = React.useState(false);

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

  // Use resolved URL if available, otherwise fall back to photo.url
  const currentImageUrl = currentPhoto
    ? resolvedUrls[currentPhoto.id] || currentPhoto.url
    : "";

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
      const response = await fetch(currentPhoto.url);
      const blob = await response.blob();
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
                {formatDate(currentPhoto.createdAt)}
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
              title="Open in SharePoint"
            >
              <ExternalLink className="h-5 w-5" />
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
              <Loader2 className="h-10 w-10 animate-spin text-white" />
              {resolving && (
                <p className="text-white/60 text-sm">Loading full image...</p>
              )}
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
              key={currentPhoto.id + (resolvedUrls[currentPhoto.id] ? "-resolved" : "")}
              src={currentImageUrl}
              alt={currentPhoto.name}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(true);
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
