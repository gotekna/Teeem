"use client";

/**
 * PhotoGallery - Grid view for displaying photo thumbnails
 *
 * THE ONE component for displaying photos in a grid layout.
 * See: frontend-next/lib/component-registry.ts
 *
 * Features:
 * - CSS Grid layout (responsive)
 * - Lazy loading images
 * - Optional date grouping
 * - Loading skeleton state
 * - Click to open lightbox
 *
 * Usage:
 * ```tsx
 * import { PhotoGallery, PhotoItem } from "@/components/ui/photo-gallery";
 *
 * <PhotoGallery
 *   photos={photos}
 *   onPhotoClick={(photo, index) => openLightbox(index)}
 *   groupByDate
 *   loading={isLoading}
 * />
 * ```
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { ImageIcon, Loader2 } from "lucide-react";
import { getTodayAsString, getCompanyTimezone } from "@/lib/timezone-utils";

export interface PhotoItem {
  id: string;
  name: string;
  url: string; // Full-size image URL
  thumbnailUrl?: string; // Optional thumbnail URL (uses url if not provided)
  webUrl?: string; // SharePoint web URL for opening in browser
  createdAt?: string; // ISO date string for grouping
  modifiedAt?: string; // Last modified date
  size?: number; // File size in bytes
  mimeType?: string; // e.g., "image/jpeg"
}

export interface PhotoGalleryProps {
  /** Array of photos to display */
  photos: PhotoItem[];
  /** Callback when a photo is clicked */
  onPhotoClick?: (photo: PhotoItem, index: number) => void;
  /** Group photos by date */
  groupByDate?: boolean;
  /** Show loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Thumbnail size: sm (100px), md (150px), lg (200px), xl (250px) */
  thumbnailSize?: "sm" | "md" | "lg" | "xl";
}

// Skeleton loader for loading state
function PhotoSkeleton({ size = "md" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  const sizeClasses = {
    sm: "h-24 w-24",
    md: "h-36 w-36",
    lg: "h-48 w-48",
    xl: "h-60 w-60",
  };

  return (
    <div
      className={cn(
        "rounded-none bg-muted animate-pulse",
        sizeClasses[size]
      )}
    />
  );
}

// Individual photo thumbnail
function PhotoThumbnail({
  photo,
  index,
  onClick,
  size = "md",
}: {
  photo: PhotoItem;
  index: number;
  onClick?: (photo: PhotoItem, index: number) => void;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);

  const sizeClasses = {
    sm: "h-24 w-24",
    md: "h-36 w-36",
    lg: "h-48 w-48",
    xl: "h-60 w-60",
  };

  const thumbnailSrc = photo.thumbnailUrl || photo.url;

  return (
    <button
      type="button"
      onClick={() => onClick?.(photo, index)}
      className={cn(
        "relative overflow-hidden rounded-none border border-border bg-muted",
        "transition-all duration-200",
        "hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        "group cursor-pointer",
        sizeClasses[size]
      )}
      title={photo.name}
    >
      {/* Loading placeholder */}
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
          <ImageIcon className="h-8 w-8 mb-1" />
          <span className="text-xs">Failed</span>
        </div>
      )}

      {/* Image */}
      {!error && (
        <img
          src={thumbnailSrc}
          alt={photo.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            "transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
            "group-hover:scale-105 transition-transform duration-300"
          )}
        />
      )}

      {/* Hover overlay with filename */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent",
          "p-2 pt-6",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        )}
      >
        <p className="text-xs text-white truncate">{photo.name}</p>
      </div>
    </button>
  );
}

// Format date for group headers using company timezone (SSoT: Admin Settings)
function formatGroupDate(dateStr: string): string {
  const tz = getCompanyTimezone();
  const date = new Date(dateStr);

  // Get today's date in company timezone (YYYY-MM-DD)
  const todayStr = getTodayAsString();

  // Get photo date in company timezone (YYYY-MM-DD)
  const photoDateStr = date.toLocaleDateString("en-CA", { timeZone: tz });

  // Calculate day difference using calendar dates in company timezone
  const todayDate = new Date(todayStr + "T00:00:00");
  const photoDate = new Date(photoDateStr + "T00:00:00");
  const diffDays = Math.floor(
    (todayDate.getTime() - photoDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  // Get current year in company timezone for year display logic
  const nowYear = parseInt(todayStr.split("-")[0]);
  const photoYear = date.getFullYear();

  return date.toLocaleDateString("en-AU", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: photoYear !== nowYear ? "numeric" : undefined,
  });
}

// Group photos by date using company timezone (SSoT: Admin Settings)
function groupPhotosByDate(photos: PhotoItem[]): Map<string, PhotoItem[]> {
  const groups = new Map<string, PhotoItem[]>();
  const tz = getCompanyTimezone();

  photos.forEach((photo) => {
    const dateStr = photo.createdAt || photo.modifiedAt;
    // Convert to company timezone date (YYYY-MM-DD) for consistent grouping
    const dateKey = dateStr
      ? new Date(dateStr).toLocaleDateString("en-CA", { timeZone: tz })
      : "unknown";

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(photo);
  });

  // Sort by date descending (newest first)
  return new Map(
    [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  );
}

export function PhotoGallery({
  photos,
  onPhotoClick,
  groupByDate = false,
  loading = false,
  className,
  emptyMessage = "No photos found",
  thumbnailSize = "md",
}: PhotoGalleryProps) {
  // Loading state
  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <PhotoSkeleton key={i} size={thumbnailSize} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (photos.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12 text-center",
          className
        )}
      >
        <ImageIcon className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // Get index for a photo considering grouping
  const getGlobalIndex = (photo: PhotoItem): number => {
    return photos.findIndex((p) => p.id === photo.id);
  };

  // Grouped view
  if (groupByDate) {
    const groupedPhotos = groupPhotosByDate(photos);

    return (
      <div className={cn("space-y-6", className)}>
        {[...groupedPhotos.entries()].map(([dateKey, groupPhotos]) => (
          <div key={dateKey}>
            {/* Date header */}
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              {dateKey !== "unknown"
                ? formatGroupDate(dateKey)
                : "Unknown date"}
              <span className="ml-2 text-xs">({groupPhotos.length})</span>
            </h3>

            {/* Photo grid */}
            <div className="flex flex-wrap gap-2">
              {groupPhotos.map((photo) => (
                <PhotoThumbnail
                  key={photo.id}
                  photo={photo}
                  index={getGlobalIndex(photo)}
                  onClick={onPhotoClick}
                  size={thumbnailSize}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Flat grid view
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {photos.map((photo, index) => (
        <PhotoThumbnail
          key={photo.id}
          photo={photo}
          index={index}
          onClick={onPhotoClick}
          size={thumbnailSize}
        />
      ))}
    </div>
  );
}

export default PhotoGallery;
